#!/usr/bin/env node
/**
 * Validate IOContorl text provenance and geometry evidence.
 * Mapping format: { contentOriginY, sourceNodes: [{ ref, parentRef,
 * pageAbsX, pageAbsY, relativeX, relativeY, width, height, text }],
 * nodes: [{ xmlId, sourceRef, sourceText, valueSource,
 * expectedLeft, expectedTop, expectedWidth, expectedHeight, heightSource }] }
 */
'use strict';

const fs = require('fs');
// 模板表规则块的解析唯一实现（见 scripts/lib/iocontrol-map-rules.js；禁止在本脚本再抄一份）。
const MAP_RULES = require('./lib/iocontrol-map-rules');
// 数值解析的唯一实现（见 scripts/lib/script-helpers.js；本校验器与坐标核对器共用同一口径）。
// 文案比对归一（解码字符引用 + 换行归一成 LF）的唯一实现，见 scripts/lib/script-helpers.js。
const { numberOrNull: num, normalizeForCompare, omittedAttrs } = require('./lib/script-helpers');

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

// 表格族规则块（列定义模板 + 行内容处置），真值来源是映射表 tableTemplates；
// 未传入 --map 时不做表格列的模板校验（与必写字段校验同一粒度）。
function loadTableTemplate(mapPath) {
  if (!mapPath) return null;
  return MAP_RULES.parseTableTemplate(MAP_RULES.readTemplateMapOrFail(mapPath));
}

let BUTTON_FAMILY_RULES = DEFAULT_BUTTON_FAMILY_RULES;
let BUTTON_FAMILY_CONTROL_TYPES = BUTTON_FAMILY_RULES.controlTypes;
let BUTTON_ALWAYS_ATTRS = BUTTON_FAMILY_RULES.alwaysWrittenAttrs;
let REQUIRED_ATTRS_BY_CONTROL_TYPE = {};
let TABLE_TEMPLATE = null;

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
// table-data-cell：表格的行是数据不是控件，表格内的行数据文本按映射表 tableTemplates.innerTextPolicy 一律 omit。
const OMIT_ROLES = ['page-title', 'host-shell', 'excluded-component', 'unmapped-component', 'camera-viewport-internal', 'table-data-cell'];
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
    if (normalizeForCompare(audit.sourceText) !== normalizeForCompare(source.text)) {
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
      // 文案比对与其它三处同口径：先解码字符引用、再归一换行（normalizeForCompare）。
      if (!outputForSource || outputForSource.valueSource !== 'dsl.text' ||
          normalizeForCompare(mappedText) !== normalizeForCompare(source.text)) {
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

// options.templateMapPath：显式给定时按该表重载规则块（按钮族 / 必写字段 / 表格列模板）。
// options.allowExternalNodes：合并人工维护过的页面时用（CLI: --allow-external-nodes）。
//   没有设计来源的节点（人工新增/外部工具写的）不再判死，改为登记进 externalNodes 由人复核；
//   我们从头生成的页面（fresh）不要开这个开关，保持"每个节点都必须有来源"的硬门。
// CLI 用 --map 走同一条路径；单测可以直接传路径，避免再写一份规则。
function validate(xmlPath, manifestPath, options) {
  if (options && options.templateMapPath) {
    const loaded = MAP_RULES.readTemplateMapOrFail(options.templateMapPath);
    BUTTON_FAMILY_RULES = MAP_RULES.parseButtonFamilyRules(loaded, DEFAULT_BUTTON_FAMILY_RULES) || DEFAULT_BUTTON_FAMILY_RULES;
    BUTTON_FAMILY_CONTROL_TYPES = BUTTON_FAMILY_RULES.controlTypes;
    BUTTON_ALWAYS_ATTRS = BUTTON_FAMILY_RULES.alwaysWrittenAttrs;
    REQUIRED_ATTRS_BY_CONTROL_TYPE = MAP_RULES.parseControlTypeRequiredAttrs(loaded) || {};
    TABLE_TEMPLATE = MAP_RULES.parseTableTemplate(loaded);
  }
  const errors = [];
  let xml;
  let manifest;
  try { xml = fs.readFileSync(xmlPath, 'utf8'); }
  catch (e) { return { ok: false, errors: ['读取 XML 失败: ' + e.message] }; }
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { return { ok: false, errors: ['读取映射清单失败: ' + e.message] }; }

  const entries = Array.isArray(manifest) ? manifest : manifest.nodes;
  if (!Array.isArray(entries)) return { ok: false, errors: ['映射清单必须是数组或 {nodes: []}'] };
  if (!Array.isArray(manifest.sourceNodes)) {
    return { ok: false, errors: ['映射清单缺少 sourceNodes：不能证明 mapping 本身来自真实 DSL'] };
  }
  const sourceMap = new Map(manifest.sourceNodes.map(n => [n.ref, n]));
  // 兜底只在"字段完全没给"（undefined/null）时发生，不能把显式的 0 换成 192：
  // `(x || 192)` 会让非法的 contentOrigin:{y:0} 静默通过本门禁（fail-open），
  // 而 0 恰恰是唯一会被 falsy 兜底吞掉的非法值。
  const declaredOriginY = manifest.contentOriginY !== undefined && manifest.contentOriginY !== null
    ? manifest.contentOriginY
    : (manifest.contentOrigin ? manifest.contentOrigin.y : undefined);
  const originY = Number(declaredOriginY === undefined || declaredOriginY === null ? 192 : declaredOriginY);
  if (originY !== 192) {
    errors.push('contentOriginY 必须固定为 192');
    return { ok: false, errors };
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
    // 表格列定义（nodeKind=table-column）是 DataGrid 的**列结构**，不是页面控件：
    // 几何按映射表 tableTemplates.columnTemplate 固定发射（Left=0 / Top=0 / Height=45、不写 Width），
    // 真实 DSL bbox 只作为 dslLeft/dslTop/dslWidth/dslHeight 溯源。这里与生成器同口径地单独校验，
    // 不套用「控件坐标 = DSL bbox」与 controlTypeRequiredAttrs 两条规则。
    const isTableColumn = n.nodeKind === 'table-column';
    if (isTableColumn) {
      const columnTemplate = TABLE_TEMPLATE && TABLE_TEMPLATE.columnTemplate;
      if (!columnTemplate) {
        errors.push('[' + n.xmlId + '] 表格列定义节点需要映射表 tableTemplates.columnTemplate（请带 --map）');
      } else {
        if (!sameNumber(n.expectedLeft, columnTemplate.left) ||
            !sameNumber(n.expectedTop, columnTemplate.top) ||
            !sameNumber(n.expectedHeight, columnTemplate.height)) {
          errors.push('[' + n.xmlId + '] 表格列定义几何与 columnTemplate（left/top/height）不一致');
        }
        if (columnTemplate.omitWidth && n.expectedWidth !== 'NaN' && !isNanValue(n.expectedWidth)) {
          errors.push('[' + n.xmlId + '] 表格列定义不写 Width，expectedWidth 必须是 NaN');
        }
        for (const attr of columnTemplate.alwaysWrittenAttrs) {
          if (x[attr] === undefined) {
            errors.push('[' + n.xmlId + '] 表格列定义缺少恒写属性 ' + attr + '（取不到来源时必须写空值占位）');
          }
        }
        if (columnTemplate.omitWidth) {
          if (x.Width !== undefined) errors.push('[' + n.xmlId + '] 表格列定义不得发射 Width');
        } else if (!sameNumber(x.Width, n.expectedWidth)) {
          errors.push('[' + n.xmlId + '] Width=' + (x.Width || '') + ' != expected=' + n.expectedWidth);
        }
        const dslLeft = outputParent ? Number(src.pageAbsX) - Number(outputParent.pageAbsX) : Number(src.pageAbsX);
        const dslTop = outputParent ? Number(src.pageAbsY) - Number(outputParent.pageAbsY) : Number(src.pageAbsY) - originY;
        if (!sameNumber(n.dslLeft, dslLeft) || !sameNumber(n.dslTop, dslTop) ||
            !sameNumber(n.dslWidth, src.width) || !sameNumber(n.dslHeight, src.height)) {
          errors.push('[' + n.xmlId + '] 表格列定义的 dslLeft/dslTop/dslWidth/dslHeight 不是同一 sourceRef 的 bbox');
        }
        for (const pair of [['expectedLeft', 'Left'], ['expectedTop', 'Top'], ['expectedHeight', 'Height']]) {
          if (n[pair[0]] === undefined) { errors.push('[' + n.xmlId + '] 缺少 ' + pair[0]); continue; }
          if (!sameNumber(x[pair[1]], n[pair[0]])) {
            errors.push('[' + n.xmlId + '] ' + pair[1] + '=' + (x[pair[1]] || '') + ' != expected=' + n[pair[0]]);
          }
        }
      }
    }
    const outputParentNode = outputParentRef ? nodeByRef.get(outputParentRef) : null;
    const parentInset = !parentIsRoot && outputParentNode && outputParentNode.contentInset
      ? outputParentNode.contentInset : null;
    const insetLeft = parentInset ? (Number(parentInset.left) || 0) : 0;
    const insetTop = parentInset ? (Number(parentInset.top) || 0) : 0;
    if (!isTableColumn) {
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
    }
    if (typeof src.text === 'string' && typeof n.sourceText === 'string' &&
        normalizeForCompare(src.text) !== normalizeForCompare(n.sourceText)) {
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
        } else if (normalizeForCompare(x[carrier]) !== normalizeForCompare(n.sourceText)) {
          errors.push('[' + n.xmlId + '] ' + carrier + '="' + (x[carrier] || '') + '" != DSL="' + n.sourceText + '"');
        }
      }
    } else if (x.ControlType === 'TextBlock') {
      errors.push('[' + n.xmlId + '] TextBlock 的 ValueSource 必须为 dsl.text');
    }
    for (const pair of [['expectedLeft', 'Left'], ['expectedTop', 'Top'], ['expectedWidth', 'Width'], ['expectedHeight', 'Height']]) {
      const field = pair[0], attr = pair[1];
      if (n[field] === undefined) { errors.push('[' + n.xmlId + '] 缺少 ' + field); continue; }
      // 表格列定义已在上面按 columnTemplate 校验过几何（含「不写 Width」），这里不重复判。
      if (isTableColumn) continue;
      if (attr === 'Width' && x.ControlType === 'TextBlock') {
        if (!isNanValue(x[attr])) errors.push('[' + n.xmlId + '] TextBlock 的 Width 必须固定为 NaN');
        continue;
      }
      if (!sameNumber(x[attr], n[field])) errors.push('[' + n.xmlId + '] ' + attr + '=' + (x[attr] || '') + ' != expected=' + n[field]);
    }
    const controlType = x.ControlType || n.controlType || (n.attrs && n.attrs.ControlType);
    const requiredAttrs = REQUIRED_ATTRS_BY_CONTROL_TYPE[controlType];
    // 变体登记 omitRequiredAttrs 的节点（如右栏 enter/exit）：被收窄的必写字段不发射，
    // 因此这里也不要求它们存在。判据与生成器共用 scripts/lib/script-helpers.js 的 omittedAttrs。
    const omitted = omittedAttrs(n);
    // 表格列定义的字段集来自映射表 columnTemplate（列结构，不是页面控件），不套 controlTypeRequiredAttrs。
    if (!isTableColumn && Array.isArray(requiredAttrs)) {
      for (const attr of requiredAttrs) {
        if (omitted.has(attr)) continue;
        // LangName 例外：动态值等 noLangRefs 豁免节点不挂 LangName，也不写空占位。
        if (attr === 'LangName') continue;
        if (x[attr] === undefined) {
          errors.push('[' + n.xmlId + '] ' + controlType + ' 缺少必写属性 ' + attr + '（取不到来源时必须写空值占位）');
        }
      }
    }
    if (BUTTON_FAMILY_CONTROL_TYPES.includes(controlType)) {
      for (const attr of BUTTON_ALWAYS_ATTRS) {
        if (omitted.has(attr)) continue;
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
            errors.push('[' + n.xmlId + '] 按钮族带 Icon 但映射缺少 iconSize（台账命中条目节点 bbox）');
          } else {
            const iconSource = sourceMap.get(size.sourceRef);
            if (!iconSource) {
              errors.push('[' + n.xmlId + '] iconSize.sourceRef 不存在于 sourceNodes: ' + size.sourceRef);
            } else if (!sameNumber(iconSource.width, size.width) || !sameNumber(iconSource.height, size.height)) {
              errors.push('[' + n.xmlId + '] iconSize 与台账命中条目节点 bbox 不一致');
            }
            if (!sameNumber(x.IconWidth, Math.round(Number(size.width))) ||
                !sameNumber(x.IconHeight, Math.round(Number(size.height)))) {
              errors.push('[' + n.xmlId + '] IconWidth/IconHeight 必须等于台账命中条目节点 bbox 取整值');
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

  // 没有设计来源的节点：fresh 模式下是我们自己的 bug（硬失败）；merge 模式下多为人工/外部节点，
  // 由 --allow-external-nodes 放行并登记，交给人工复核（重复 ID 仍由 merge 的唯一性硬门拦住）。
  const externalNodes = [];
  for (const x of actual.filter(a => a.ControlType === 'TextBlock')) {
    if (mappedIds.has(x.ID)) continue;
    if (options && options.allowExternalNodes) {
      externalNodes.push(x.ID || '(无 ID)');
      continue;
    }
    errors.push('TextBlock 未建立来源映射: xmlId="' + (x.ID || '') + '"');
  }
  return { ok: errors.length === 0, errors, externalNodes };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const get = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  const xml = get('--xml');
  const manifest = get('--mapping');
  if (!xml || !manifest) { console.error('用法: node validate-iocontrol-provenance.js --xml <page.xml> --mapping <mapping.json> [--map mtslg-iocontrol-map.json] [--allow-external-nodes]'); process.exit(2); }
  const mapPath = get('--map');
  if (mapPath) {
    BUTTON_FAMILY_RULES = loadButtonFamilyRules(mapPath);
    BUTTON_FAMILY_CONTROL_TYPES = BUTTON_FAMILY_RULES.controlTypes;
    BUTTON_ALWAYS_ATTRS = BUTTON_FAMILY_RULES.alwaysWrittenAttrs;
    REQUIRED_ATTRS_BY_CONTROL_TYPE = loadControlTypeRequiredAttrs(mapPath);
    TABLE_TEMPLATE = loadTableTemplate(mapPath);
  }
  // --allow-external-nodes：只用于"人工维护过的页面"（merge 流程）；从头生成的页面不要带这个开关。
  const result = validate(xml, manifest, { allowExternalNodes: args.includes('--allow-external-nodes') });
  if (!result.ok) { console.error(result.errors.join('\n')); process.exit(1); }
  if (result.externalNodes && result.externalNodes.length) {
    console.log('外部/人工节点（无设计来源，已放行，请人工复核） (' + result.externalNodes.length + '): ' +
      result.externalNodes.join(', '));
  }
  console.log('PASS: provenance and geometry validation');
}

module.exports = { validate, validateTextAudit };
