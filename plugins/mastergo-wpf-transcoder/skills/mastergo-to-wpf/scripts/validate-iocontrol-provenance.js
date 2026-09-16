#!/usr/bin/env node
/**
 * Validate IOContorl text provenance and geometry evidence.
 * Mapping format: { contentOriginY, source: { sourceSha256, sourceBytes, egress,
 * snapshotSha256, snapshotBytes }, sourceNodes: [{ ref, parentRef,
 * pageAbsX, pageAbsY, relativeX, relativeY, width, height, text }],
 * nodes: [{ xmlId, sourceRef, sourceText, valueSource,
 * expectedLeft, expectedTop, expectedWidth, expectedHeight, heightSource }] }
 *
 * capture provenance：mapping.source 的五项 provenance 必须存在且非空（AI-27 的冻结基准），
 * 缺任何一项都以非零状态失败——这是与既有规则相互独立的一道门禁，不改变其他校验的判定。
 * 冻结守卫上线前的历史产物没有这些字段：要么按下面的说明重新冻结，要么显式传
 * --allow-legacy-provenance 把「缺失」降级为警告（形状写错的值任何情况下都不豁免）。
 */
'use strict';

const fs = require('fs');
// 模板表规则块的解析唯一实现（见 scripts/lib/iocontrol-map-rules.js；禁止在本脚本再抄一份）。
const MAP_RULES = require('./lib/iocontrol-map-rules');
// 数值解析的唯一实现（见 scripts/lib/script-helpers.js；本校验器与坐标核对器共用同一口径）。
// 哈希的唯一实现同源（sha256File）——本校验器不再抄一份，否则会撞上脚本复用门禁。
const { numberOrNull: num, sha256File } = require('./lib/script-helpers');

// 按钮族固定参数：真值来源为模板表 mtslg-iocontrol-map.json 的 buttonFamily；
// 传入 --map 时读取该表，未传入或表缺字段时退回内置默认（与表内容一致）。
const DEFAULT_BUTTON_FAMILY_RULES = {
  controlTypes: ['IconButton', 'Button', 'StatusButton'],
  alwaysWrittenAttrs: ['PageName', 'IOVisible', 'IOCommand', 'IOEnable'],
};
// 图标字段名：与映射表 buttonFamily.iconSizeAttrs 一致（生成器用同一组名字）。
const BUTTON_ICON_SIZE_ATTR_NAMES = ['IconWidth', 'IconHeight'];
// 无模板信息时的内置图标口径：按钮族里只有 IconButton 的模板含图标字段。
// 适用场景只有「整张表缺失」——未传 --map，或传入的表没有 controlTypeRequiredAttrs 字段；
// 表已提供但缺某个 ControlType 条目时不算无模板信息，与生成器一致地按「模板不含图标字段」处理。
// 与 gen-iocontrol-xml.js 的 DEFAULT_CONTROL_TYPE_REQUIRED_ATTRS 一致，由
// doc-rule-consistency.test.js 守护该集合的一致性。
const DEFAULT_ICON_TEMPLATE_CONTROL_TYPES = ['IconButton'];

// 每个 ControlType 的固定必写字段集（设计方模板）：真值来源 mtslg-iocontrol-map.json 的
// controlTypeRequiredAttrs；未传入 --map 或表缺该字段时不做必写字段校验。
function loadControlTypeRequiredAttrs(mapPath) {
  if (!mapPath) return {};
  // 未传 --map 或表缺该块时不做必写字段校验（返回空表），这是校验器的口径，与生成器不同。
  return MAP_RULES.parseControlTypeRequiredAttrs(MAP_RULES.readTemplateMapOrFail(mapPath)) || {};
}

function loadButtonFamilyRules(mapPath) {
  if (!mapPath) return DEFAULT_BUTTON_FAMILY_RULES;
  return MAP_RULES.parseButtonFamilyRules(MAP_RULES.readTemplateMapOrFail(mapPath), DEFAULT_BUTTON_FAMILY_RULES) ||
    DEFAULT_BUTTON_FAMILY_RULES;
}

let BUTTON_FAMILY_RULES = DEFAULT_BUTTON_FAMILY_RULES;
let BUTTON_FAMILY_CONTROL_TYPES = BUTTON_FAMILY_RULES.controlTypes;
let BUTTON_ALWAYS_ATTRS = BUTTON_FAMILY_RULES.alwaysWrittenAttrs;
let REQUIRED_ATTRS_BY_CONTROL_TYPE = {};

function attrsFromTag(tag) {
  const attrs = {};
  const re = /([A-Za-z][\w]*)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tag))) attrs[m[1]] = m[2];
  return attrs;
}

function sameNumber(actual, expected, tolerance) {
  const a = num(actual);
  const e = num(expected);
  return a !== null && e !== null && a !== 'NaN' && e !== 'NaN' &&
    Math.abs(a - e) <= (tolerance || 0.0001);
}

function isNanValue(value) {
  return value === 'NaN' || (typeof value === 'number' && Number.isNaN(value));
}

// 允许 decision=omit 的角色/原因：除显式隐藏、页面标题、宿主外壳外，
// 还包括「未命中正式模板」与「按清单隔离」的组件内部文本（这些文本不进入页面 XML）。
// camera-viewport-internal：相机视口是整体控件，组件内部绘制文本按映射表 cameraTemplates.innerTextPolicy 一律 omit。
const OMIT_ROLES = ['page-title', 'host-shell', 'excluded-component', 'unmapped-component', 'camera-viewport-internal'];
const OMIT_REASONS = ['hidden'].concat(OMIT_ROLES);

function validateTextAudit(manifest, entries) {
  const errors = [];
  const textSources = (manifest.sourceNodes || []).filter(function (source) {
    return source && (source.type === 'TEXT' || source.type === 'text') && typeof source.text === 'string';
  });
  if (textSources.length === 0) return errors;
  if (!Array.isArray(manifest.textAudit)) {
    return ['映射清单缺少 textAudit：每个 TEXT 源节点都必须记录可见性和输出决定'];
  }
  const auditByRef = new Map();
  for (const audit of manifest.textAudit) {
    if (!audit || typeof audit.sourceRef !== 'string') {
      errors.push('textAudit 条目缺少 sourceRef');
      continue;
    }
    if (auditByRef.has(audit.sourceRef)) {
      errors.push('textAudit 重复 sourceRef: ' + audit.sourceRef);
      continue;
    }
    auditByRef.set(audit.sourceRef, audit);
  }
  const nodeBySource = new Map();
  (entries || []).filter(function (node) {
    return node && typeof node.sourceRef === 'string';
  }).forEach(function (node) {
    nodeBySource.set(node.sourceRef, node);
    if (typeof node.valueSourceRef === 'string') nodeBySource.set(node.valueSourceRef, node);
    if (Array.isArray(node.sourceSlotRefs)) node.sourceSlotRefs.forEach(function (ref) {
      if (typeof ref === 'string') nodeBySource.set(ref, node);
    });
  });
  for (const source of textSources) {
    const audit = auditByRef.get(source.ref);
    if (!audit) {
      errors.push('TEXT 源节点缺少 textAudit: ' + source.ref);
      continue;
    }
    if (audit.sourceText !== source.text) {
      errors.push('textAudit sourceText 与 DSL 不一致: ' + source.ref);
    }
    if (typeof audit.visibility !== 'boolean') {
      errors.push('textAudit visibility 必须是 boolean: ' + source.ref);
      continue;
    }
    const role = audit.role || 'content';
    const shouldEmit = audit.visibility && !OMIT_ROLES.includes(role);
    const outputRefs = Array.isArray(audit.outputRefs) ? audit.outputRefs : [];
    if (shouldEmit) {
      if (audit.decision !== 'emit' || outputRefs.length === 0) {
        errors.push('可见普通 TEXT 必须 decision=emit 且存在 outputRefs: ' + source.ref);
        continue;
      }
      const outputForSource = nodeBySource.get(source.ref);
      const mappedText = outputForSource && outputForSource.sourceSlotTexts && typeof outputForSource.sourceSlotTexts[source.ref] === 'string'
        ? outputForSource.sourceSlotTexts[source.ref]
        : outputForSource && outputForSource.sourceText;
      if (!outputForSource || outputForSource.valueSource !== 'dsl.text' || mappedText !== source.text) {
        errors.push('可见普通 TEXT 没有对应的 dsl.text 输出节点: ' + source.ref);
      }
    } else {
      if (audit.decision !== 'omit' || !OMIT_REASONS.includes(audit.omitReason)) {
        errors.push('隐藏/标题 TEXT 必须 decision=omit 并记录 omitReason: ' + source.ref);
      }
      if (outputRefs.length > 0) errors.push('被省略的 TEXT 不得存在 outputRefs: ' + source.ref);
    }
  }
  return errors;
}

// ---- capture provenance（AI-27 的冻结基准）----
// mapping.source 是 provenance 随页面产物一起流转的唯一载体，五项必须齐全：
//   sourceSha256 / sourceBytes / egress —— 原始 capture（getDsl 响应文件）的事实，由快照回指带过来；
//   snapshotSha256 / snapshotBytes      —— 本次实际消费的 dsl.snapshot.json 自身字节。
// 本校验器只判「存在且非空」与形状；值由生成侧写入。哈希口径与生成侧统一：
// 文件字节的 SHA256、十六进制小写（唯一实现见 lib/script-helpers.js）。
const PROVENANCE_SOURCE_KEY = 'mapping.source';
const PROVENANCE_HASH_FIELDS = ['sourceSha256', 'snapshotSha256'];
const PROVENANCE_BYTES_FIELDS = ['sourceBytes', 'snapshotBytes'];
const PROVENANCE_EGRESS_FIELD = 'egress';
const PROVENANCE_FIELDS = PROVENANCE_HASH_FIELDS.concat(PROVENANCE_BYTES_FIELDS, [PROVENANCE_EGRESS_FIELD]);
const SHA256_HEX = /^[0-9a-f]{64}$/;
// 旁证文件 → mapping.source 的字段对应关系：同一个事实在两处必须逐字相同，否则「capture → 快照 → mapping」是断链。
// 快照记的是 capture* 前缀（它就是回指），取数 sidecar 记的是自身文件的 sha256/bytes。
const PROVENANCE_WITNESS_FIELDS = {
  snapshot: { captureSha256: 'sourceSha256', captureBytes: 'sourceBytes', egress: 'egress' },
  captureProvenance: { sha256: 'sourceSha256', bytes: 'sourceBytes', egress: 'egress' }
};

// 缺失口径：字段不存在、为 null、或是全空白字符串都算「没记录」。
// AI-27 的快照里没有 capture provenance 时生成器会如实写 null，所以 null 必须走「缺失」这条路径，
// 不能与「写了个错值」混为一谈。
function isAbsentFact(value) {
  return value === undefined || value === null ||
    (typeof value === 'string' && value.trim() === '');
}

function readProvenanceWitness(filePath, label) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: label + ' 必须是 JSON 对象: ' + filePath };
    }
    return { value: parsed };
  } catch (error) {
    return { error: '读取 ' + label + ' 失败: ' + filePath + ': ' + error.message };
  }
}

/**
 * 断言 mapping.source 上的 capture provenance。
 *
 * @param manifest 映射清单（对象形态；数组形态没有 source，一律失败）
 * @param options.allowLegacyProvenance 历史产物豁免：只把「缺失」降级为警告。
 *        形状错误（哈希不是 64 位小写十六进制、字节数不是正整数、egress 不是字符串）永远失败——
 *        缺字段说明这是冻结守卫上线前的旧产物，写错值说明记录本身不可信，两者不能互相抵消。
 * @param options.snapshotPath 可选的 dsl.snapshot.json：复算 snapshotSha256/snapshotBytes，
 *        并核对快照对原始 capture 的回指与 mapping.source 一致。
 * @param options.captureProvenancePath 可选的取数 sidecar `<out>.provenance.json`：
 *        核对它记录的 sha256/bytes/egress 与 mapping.source 一致（这是唯一能对到真实 capture 字节的一环）。
 * @returns { errors, warnings }
 */
function validateCaptureProvenance(manifest, options) {
  const settings = options || {};
  const errors = [];
  const warnings = [];
  const source = manifest && !Array.isArray(manifest) && typeof manifest === 'object'
    ? manifest.source : null;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    const problem = '映射清单缺少 ' + PROVENANCE_SOURCE_KEY + '（capture provenance）：无法证明本次生成消费的是哪次冻结 capture';
    if (settings.allowLegacyProvenance) {
      warnings.push('历史产物豁免（未断言 provenance）: ' + problem);
      return { errors: errors, warnings: warnings };
    }
    errors.push(problem);
    return { errors: errors, warnings: warnings };
  }

  const missing = PROVENANCE_FIELDS.filter(function (field) { return isAbsentFact(source[field]); });
  if (missing.length > 0) {
    const problem = PROVENANCE_SOURCE_KEY + ' 缺少 provenance 字段（或值为空）: ' + missing.join(', ') +
      '；这些字段由 mastergo-dsl-pipeline.ps1（Capture）与 gen-mtslg-mapping-from-dsl.js 写入，' +
      '值为 null 表示快照里没有 capture provenance（冻结守卫上线前的产物）';
    if (settings.allowLegacyProvenance) warnings.push('历史产物豁免（未断言 provenance）: ' + problem);
    else errors.push(problem);
  }

  for (const field of PROVENANCE_HASH_FIELDS) {
    if (isAbsentFact(source[field])) continue;
    if (typeof source[field] !== 'string' || !SHA256_HEX.test(source[field])) {
      errors.push(PROVENANCE_SOURCE_KEY + '.' + field + ' 必须是 64 位小写十六进制的 SHA256: ' +
        JSON.stringify(source[field]));
    }
  }
  for (const field of PROVENANCE_BYTES_FIELDS) {
    if (isAbsentFact(source[field])) continue;
    if (typeof source[field] !== 'number' || !Number.isInteger(source[field]) || source[field] <= 0) {
      errors.push(PROVENANCE_SOURCE_KEY + '.' + field + ' 必须是正整数字节数: ' + JSON.stringify(source[field]));
    }
  }
  if (!isAbsentFact(source[PROVENANCE_EGRESS_FIELD]) && typeof source[PROVENANCE_EGRESS_FIELD] !== 'string') {
    errors.push(PROVENANCE_SOURCE_KEY + '.' + PROVENANCE_EGRESS_FIELD + ' 必须是非空字符串（出网链路标签）: ' +
      JSON.stringify(source[PROVENANCE_EGRESS_FIELD]));
  }

  // ---- 闭环核对：只对调用方显式给出的旁证文件做，缺省不改变既有判定 ----
  const witnesses = [
    { key: 'snapshot', label: 'DSL 快照', path: settings.snapshotPath },
    { key: 'captureProvenance', label: '取数 provenance sidecar', path: settings.captureProvenancePath }
  ];
  for (const witness of witnesses) {
    if (!witness.path) continue;
    const read = readProvenanceWitness(witness.path, witness.label);
    if (read.error) { errors.push(read.error); continue; }
    const fields = PROVENANCE_WITNESS_FIELDS[witness.key];
    for (const ownField of Object.keys(fields)) {
      const mappedField = fields[ownField];
      const actual = read.value[ownField];
      if (isAbsentFact(actual)) {
        errors.push(witness.label + ' 缺少 ' + ownField + ': ' + witness.path +
          '（无法与 ' + PROVENANCE_SOURCE_KEY + '.' + mappedField + ' 对齐）');
        continue;
      }
      if (!isAbsentFact(source[mappedField]) && String(actual) !== String(source[mappedField])) {
        errors.push(witness.label + ' 的 ' + ownField + ' 与 ' + PROVENANCE_SOURCE_KEY + '.' + mappedField +
          ' 不一致: ' + JSON.stringify(actual) + ' != ' + JSON.stringify(source[mappedField]));
      }
    }
    // 快照自身字节：直接复算，证明 snapshotSha256/snapshotBytes 记的就是这份文件。
    if (witness.key !== 'snapshot') continue;
    const recomputed = sha256File(witness.path);
    if (!isAbsentFact(source.snapshotSha256) && source.snapshotSha256 !== recomputed) {
      errors.push('DSL 快照字节与 ' + PROVENANCE_SOURCE_KEY + '.snapshotSha256 不一致: ' +
        witness.path + ' 实际为 ' + recomputed);
    }
    const actualBytes = fs.statSync(witness.path).size;
    if (!isAbsentFact(source.snapshotBytes) && source.snapshotBytes !== actualBytes) {
      errors.push('DSL 快照字节数与 ' + PROVENANCE_SOURCE_KEY + '.snapshotBytes 不一致: ' +
        witness.path + ' 实际为 ' + actualBytes);
    }
  }
  return { errors: errors, warnings: warnings };
}

function validate(xmlPath, manifestPath, options) {
  const errors = [];
  const warnings = [];
  let xml;
  let manifest;
  try { xml = fs.readFileSync(xmlPath, 'utf8'); }
  catch (e) { return { ok: false, errors: ['读取 XML 失败: ' + e.message], warnings: warnings }; }
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { return { ok: false, errors: ['读取映射清单失败: ' + e.message], warnings: warnings }; }

  // provenance 断言先于其余规则：它只判新增字段，不动其他既有校验的判定。
  const provenance = validateCaptureProvenance(manifest, options);
  errors.push(...provenance.errors);
  warnings.push(...provenance.warnings);

  const entries = Array.isArray(manifest) ? manifest : manifest.nodes;
  if (!Array.isArray(entries)) return { ok: false, errors: ['映射清单必须是数组或 {nodes: []}'], warnings: warnings };
  if (!Array.isArray(manifest.sourceNodes)) {
    return { ok: false, errors: ['映射清单缺少 sourceNodes：不能证明 mapping 本身来自真实 DSL'], warnings: warnings };
  }
  const sourceMap = new Map(manifest.sourceNodes.map(n => [n.ref, n]));
  const originY = Number(manifest.contentOriginY !== undefined
    ? manifest.contentOriginY
    : (manifest.contentOrigin && manifest.contentOrigin.y) || 192);
  if (originY !== 192) {
    errors.push('contentOriginY 必须固定为 192');
    return { ok: false, errors: errors, warnings: warnings };
  }
  errors.push(...validateTextAudit(manifest, entries));
  const rootRef = manifest.rootRef || (manifest.source && manifest.source.layerId) ||
    (manifest.sourceNodes.find(n => !n.parentRef) || {}).ref;
  const tags = Array.from(xml.matchAll(/<IOContorl\b[^<>]*>/g)).map(m => attrsFromTag(m[0]));
  const actual = tags.filter(a => a.ID !== '' || a.ControlType);
    const byId = new Map(actual.filter(a => a.ID).map(a => [a.ID, a]));
    // 输出节点索引：读容器的 contentInset（内容区原点）用。
    const nodeByRef = new Map(entries.map(function (node) { return [node.ref, node]; }));
  const mappedIds = new Set();

  for (const n of entries) {
    if (!n.xmlId || !n.sourceRef) { errors.push('映射节点缺少 xmlId 或 sourceRef'); continue; }
    if (mappedIds.has(n.xmlId)) { errors.push('重复映射 xmlId="' + n.xmlId + '"'); continue; }
    mappedIds.add(n.xmlId);
    const x = byId.get(n.xmlId);
    if (!x) { errors.push('UNTRACKED xmlId="' + n.xmlId + '"'); continue; }
    const src = sourceMap.get(n.sourceRef);
    if (!src) { errors.push('[' + n.xmlId + '] sourceRef 不存在于 sourceNodes: ' + n.sourceRef); continue; }
    const parent = src.parentRef ? sourceMap.get(src.parentRef) : null;
    if (src.parentRef && !parent) errors.push('[' + n.xmlId + '] sourceParentRef 不存在: ' + src.parentRef);
    if (n.sourceParent !== undefined && n.sourceParent !== (src.parentRef || null)) {
      errors.push('[' + n.xmlId + '] sourceParent 与 DSL 父节点不一致');
    }
    if (!sameNumber(src.pageAbsX, (parent ? parent.pageAbsX : 0) + Number(src.relativeX || 0)) ||
        !sameNumber(src.pageAbsY, (parent ? parent.pageAbsY : 0) + Number(src.relativeY || 0))) {
      errors.push('[' + n.xmlId + '] sourceNodes 的页面绝对坐标与父子相对坐标不一致');
    }
    const outputParentRef = n.layoutParent !== undefined
      ? n.layoutParent
      : (n.parent !== undefined ? n.parent : (src.parentRef || null));
    const outputParent = outputParentRef ? sourceMap.get(outputParentRef) : null;
    if (outputParentRef && !outputParent) {
      errors.push('[' + n.xmlId + '] layoutParent 不存在: ' + outputParentRef);
    }
    // Root-level output is content-relative: subtract the public shell/title once.
    // Nested output is parent-relative: subtract the output parent's raw page bbox, and — when the
    // output parent is a container (GroupBox 等) — also its content-area origin (border + title bar),
    // which the mapping carries as contentInset. 不扣这一项，容器内子控件会整体下移一个标题条高度。
    const parentIsRoot = outputParent && outputParent.ref === rootRef;
    const outputParentNode = outputParentRef ? nodeByRef.get(outputParentRef) : null;
    const parentInset = !parentIsRoot && outputParentNode && outputParentNode.contentInset
      ? outputParentNode.contentInset : null;
    const insetLeft = parentInset ? (Number(parentInset.left) || 0) : 0;
    const insetTop = parentInset ? (Number(parentInset.top) || 0) : 0;
    const expectedSourceLeft = Number(src.pageAbsX) - (outputParent ? Number(outputParent.pageAbsX) : 0) - insetLeft;
    const expectedSourceTop = Number(src.pageAbsY) -
      (outputParent ? Number(outputParent.pageAbsY) : 0) - (parentIsRoot || !outputParent ? originY : 0) - insetTop;
    if (!sameNumber(n.expectedLeft, expectedSourceLeft) || !sameNumber(n.expectedTop, expectedSourceTop)) {
      errors.push('[' + n.xmlId + '] expectedLeft/Top 不是由 sourceNodes 父子坐标计算得到');
    }
    const fixedTextBlockHeight = x.ControlType === 'TextBlock' || n.heightSource === 'mtslg.textblock.fixed-40';
    const expectedHeightSource = fixedTextBlockHeight ? 40 : src.height;
    if (fixedTextBlockHeight && x.ControlType !== 'TextBlock') {
      errors.push('[' + n.xmlId + '] fixed-40 高度规则只能用于 TextBlock');
    }
    // TextBlock：Width 固定 NaN（自适应），bbox 宽度只作为 dslWidth 来源保留。
    if (x.ControlType === 'TextBlock') {
      if (!isNanValue(n.expectedWidth)) {
        errors.push('[' + n.xmlId + '] TextBlock 的 expectedWidth 必须固定为 NaN');
      }
      if (n.widthSource !== undefined && n.widthSource !== 'mtslg.textblock.fixed-nan') {
        errors.push('[' + n.xmlId + '] TextBlock 的 widthSource 必须是 mtslg.textblock.fixed-nan');
      }
      if (n.dslWidth !== undefined && !sameNumber(n.dslWidth, src.width)) {
        errors.push('[' + n.xmlId + '] TextBlock 的 dslWidth 与 sourceNodes bbox 不一致');
      }
    } else if (!sameNumber(n.expectedWidth, src.width)) {
      errors.push('[' + n.xmlId + '] expectedWidth 不是同一 sourceRef 的 bbox');
    }
    if (!sameNumber(n.expectedHeight, expectedHeightSource)) {
      errors.push('[' + n.xmlId + '] expectedHeight 不是同一 sourceRef 或正式模板规则计算得到');
    }
    if (typeof src.text === 'string' && typeof n.sourceText === 'string' && src.text !== n.sourceText) {
      errors.push('[' + n.xmlId + '] sourceText 与 sourceNodes.text 不一致');
    }
    if (n.valueSource === 'dsl.text') {
      if (typeof n.sourceText !== 'string') errors.push('[' + n.xmlId + '] 缺少 sourceText');
      else {
        // 文案承载属性：带 Value 的控件（TextBlock/Button/输入类…）比 Value；
        // 容器类控件（GroupBox 等）以 Header 承载标题文案，此时比 Header。
        const carrier = x.Value !== undefined ? 'Value' : (x.Header !== undefined ? 'Header' : null);
        if (carrier === null) {
          errors.push('[' + n.xmlId + '] valueSource=dsl.text 但 XML 既没有 Value 也没有 Header');
        } else if (x[carrier] !== n.sourceText) {
          errors.push('[' + n.xmlId + '] ' + carrier + '="' + (x[carrier] || '') + '" != DSL="' + n.sourceText + '"');
        }
      }
    } else if (x.ControlType === 'TextBlock') {
      errors.push('[' + n.xmlId + '] TextBlock 的 ValueSource 必须为 dsl.text');
    }
    for (const pair of [['expectedLeft', 'Left'], ['expectedTop', 'Top'], ['expectedWidth', 'Width'], ['expectedHeight', 'Height']]) {
      const field = pair[0], attr = pair[1];
      if (n[field] === undefined) { errors.push('[' + n.xmlId + '] 缺少 ' + field); continue; }
      if (attr === 'Width' && x.ControlType === 'TextBlock') {
        if (!isNanValue(x[attr])) errors.push('[' + n.xmlId + '] TextBlock 的 Width 必须固定为 NaN');
        continue;
      }
      if (!sameNumber(x[attr], n[field])) errors.push('[' + n.xmlId + '] ' + attr + '=' + (x[attr] || '') + ' != expected=' + n[field]);
    }
    const controlType = x.ControlType || n.controlType || (n.attrs && n.attrs.ControlType);
    const requiredAttrs = REQUIRED_ATTRS_BY_CONTROL_TYPE[controlType];
    if (Array.isArray(requiredAttrs)) {
      for (const attr of requiredAttrs) {
        // LangName 例外：动态值等 noLangRefs 豁免节点不挂 LangName，也不写空占位。
        if (attr === 'LangName') continue;
        if (x[attr] === undefined) {
          errors.push('[' + n.xmlId + '] ' + controlType + ' 缺少必写属性 ' + attr + '（取不到来源时必须写空值占位）');
        }
      }
    }
    if (BUTTON_FAMILY_CONTROL_TYPES.includes(controlType)) {
      for (const attr of BUTTON_ALWAYS_ATTRS) {
        if (x[attr] === undefined) errors.push('[' + n.xmlId + '] 按钮族缺少必写属性 ' + attr);
      }
      // 图标字段判据与生成器保持一致：先看该 ControlType 的模板是否含图标字段；
      // 只有「整张表都没有」（未传 --map / 表缺该字段）才退回内置口径——与生成器的回退粒度一致：
      // 传入了表但表里没有该 ControlType 条目时，生成器视为「模板不含图标字段」，校验器同样处理。
      // 不能退化成「映射残留 Icon 就当有图标」，否则会与生成器结论相反。
      const hasTemplateMap = Object.keys(REQUIRED_ATTRS_BY_CONTROL_TYPE).length > 0;
      const declaresIconAttrs = Array.isArray(requiredAttrs)
        ? (requiredAttrs.includes('Icon') || requiredAttrs.includes(BUTTON_ICON_SIZE_ATTR_NAMES[0]))
        : (hasTemplateMap ? false : DEFAULT_ICON_TEMPLATE_CONTROL_TYPES.includes(controlType));
      if (declaresIconAttrs === false) {
        // 模板不含图标字段（如 Button / StatusButton）：不得发射这三项，映射里的残留 Icon 不参与判定。
        for (const attr of ['Icon'].concat(BUTTON_ICON_SIZE_ATTR_NAMES)) {
          if (x[attr] !== undefined && String(x[attr]).trim() !== '') {
            errors.push('[' + n.xmlId + '] ' + controlType + ' 的模板不含图标字段，不得发射 ' + attr);
          }
        }
      } else {
        const mappingIcon = n.attrs && n.attrs.Icon;
        const hasIcon = (typeof mappingIcon === 'string' && mappingIcon.trim() !== '') ||
          (typeof x.Icon === 'string' && x.Icon.trim() !== '');
        if (hasIcon) {
          const size = n.iconSize;
          if (!size || typeof size !== 'object') {
            errors.push('[' + n.xmlId + '] 按钮族带 Icon 但映射缺少 iconSize（图标图形节点 bbox）');
          } else {
            const iconSource = sourceMap.get(size.sourceRef);
            if (!iconSource) {
              errors.push('[' + n.xmlId + '] iconSize.sourceRef 不存在于 sourceNodes: ' + size.sourceRef);
            } else if (!sameNumber(iconSource.width, size.width) || !sameNumber(iconSource.height, size.height)) {
              errors.push('[' + n.xmlId + '] iconSize 与图标图形节点 bbox 不一致');
            }
            if (!sameNumber(x.IconWidth, Math.round(Number(size.width))) ||
                !sameNumber(x.IconHeight, Math.round(Number(size.height)))) {
              errors.push('[' + n.xmlId + '] IconWidth/IconHeight 必须等于图标图形节点 bbox 取整值');
            }
          }
        } else {
          // 无图标槽位：Icon / IconWidth / IconHeight 字段仍恒写，但值必须为空字符串。
          if (x.Icon !== undefined && String(x.Icon).trim() !== '') {
            errors.push('[' + n.xmlId + '] 无图标按钮的 Icon 必须为空值');
          }
          for (const attr of BUTTON_ICON_SIZE_ATTR_NAMES) {
            if (x[attr] !== undefined && String(x[attr]).trim() !== '') {
              errors.push('[' + n.xmlId + '] 无图标按钮的 ' + attr + ' 必须为空值');
            }
          }
        }
      }
    }
  }

  for (const x of actual.filter(a => a.ControlType === 'TextBlock')) {
    if (!mappedIds.has(x.ID)) errors.push('TextBlock 未建立来源映射: xmlId="' + (x.ID || '') + '"');
  }
  return { ok: errors.length === 0, errors: errors, warnings: warnings };
}

const USAGE = '用法: node validate-iocontrol-provenance.js --xml <page.xml> --mapping <mapping.json> ' +
  '[--map mtslg-iocontrol-map.json] [--snapshot <dsl.snapshot.json>] ' +
  '[--capture-provenance <getDsl.json.provenance.json>] [--allow-legacy-provenance]';

if (require.main === module) {
  const args = process.argv.slice(2);
  const get = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  const xml = get('--xml');
  const manifest = get('--mapping');
  if (!xml || !manifest) { console.error(USAGE); process.exit(2); }
  const mapPath = get('--map');
  if (mapPath) {
BUTTON_FAMILY_RULES = loadButtonFamilyRules(mapPath);
BUTTON_FAMILY_CONTROL_TYPES = BUTTON_FAMILY_RULES.controlTypes;
BUTTON_ALWAYS_ATTRS = BUTTON_FAMILY_RULES.alwaysWrittenAttrs;
REQUIRED_ATTRS_BY_CONTROL_TYPE = loadControlTypeRequiredAttrs(mapPath);
  }
  // --allow-legacy-provenance：冻结守卫上线前的历史产物没有 provenance 字段，用它把「缺失」
  // 降级为警告。这是显式豁免——必须由调用方写出来，默认（不带该参数）缺 provenance 就是失败。
  const result = validate(xml, manifest, {
    allowLegacyProvenance: args.includes('--allow-legacy-provenance'),
    snapshotPath: get('--snapshot'),
    captureProvenancePath: get('--capture-provenance')
  });
  // 豁免必须可见：即使通过也把警告打出来，避免「静默放行」被当成「已断言」。
  for (const warning of result.warnings || []) console.error('WARN: ' + warning);
  if (!result.ok) { console.error(result.errors.join('\n')); process.exit(1); }
  console.log('PASS: provenance and geometry validation');
}

module.exports = { validate, validateTextAudit, validateCaptureProvenance };
