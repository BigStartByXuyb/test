#!/usr/bin/env node
/**
 * gen-iocontrol-xml.js —— IOContorl 页面 XML 发射器
 *
 * 两种模式：
 *   --fresh               从映射 JSON 全新渲染页面 XML
 *   --merge <现有XML>     按 merge 语义更新现有页面（当前主路径）
 *
 * 映射 JSON 输入格式（由 gen-mtslg-mapping-from-dsl.js 从 DSL 快照 + visibility + 正式模板映射表机械生成；
 * 本脚本只发射 XML，不生成映射、也不做语义判断）：
 * {
 *   "comment": "页面中文名（可选，写进 xml 声明后的注释）",
 *   "nodes": [
 *     {
 *       "ref": "dsl-node-id 或任意唯一键（供核对器与父子引用用）",
 *       "sourceRef": "真实 MasterGo TEXT ref（TextBlock 必填）",
 *       "sourceText": "DSL 原文（TextBlock 必填）",
 *       "valueSource": "dsl.text（TextBlock 必须为此值）",
 *       "id": "XML ID 属性值（可选；省略则节点不带 ID）",
 *       "controlType": "IconButton | GroupBox | ...（必填；页面根 IOContorl 不在 nodes 中）",
 *       "parent": null | "某节点 ref"（null = 页面根 IOContorl 的直接子级）",
 *       "absX": 10, "absY": 35,          // 页面绝对 bbox（double）
 *       "w": 160, "h": 150,              // 可省略（无宽高）；NaN 原样输出
 *       "attrs": { "Style": "MainButtonStyle", "Value": "全自动操作", ... },  // 业务属性
 *       "comment": "第一行（可选，渲染在该节点前一行）"
 *     }
 *   ]
 * }
 *
 * 坐标规则：Left = absX - parentAbsX，Top = normalizedY(absY) - parentAbsY，设计稿像素 1:1 直传。
 * 页面坐标固定扣除顶部公共栏 126px，再扣除被剥离的示例标题 66px；总偏移 192px。
 *
 * 按钮族固定参数（IconButton / Button / StatusButton 无差别发射；变体登记 omitRequiredAttrs 时按节点 omitAttrs 做减法）：
 *   PageName / IOVisible / IOCommand / IOEnable —— 无差别恒写；映射没有可靠来源时写空字符串占位，
 *   映射提供真实值时按真实值发射（merge 时保留现有真实值）。
 *   Icon / IconWidth / IconHeight —— 属 ControlType 固定必写字段：模板含图标字段的 IconButton 恒写，
 *   有图标槽位时 IconWidth / IconHeight 机械取「台账命中条目节点」bbox（映射字段 iconSize，四舍五入取整），
 *   无图标槽位时三项写空字符串占位；模板不含图标字段的 Button / StatusButton 不发射这三项；
 *   iconSize 只在「模板含图标字段」且「节点带 Icon」时被消费，映射残留的尺寸不单独生效；
 *   带 Icon 却没有 iconSize 视为映射不完整，直接失败，禁止猜图标尺寸。
 *
 * TextBlock 固定属性：Height 固定 40；Width 固定 "NaN"（不用设计稿文本 bbox 宽度），
 * FontSize 仍取 DSL 字体事实。
 *
 * merge 语义（改现有页面的强制模式）：
 *   1. 几何（Left/Top/Width/Height）按映射更新；
 *   2. ControlType 按映射更新（变化时写冲突报告）；
 *   3. 业务属性：现有 XML 已有同名的 → 一律保留现有值（值不同写冲突报告，不覆盖）；
 *      现有 XML 没有的 → 按映射新增（写新增报告）；
 *      例外：映射节点的 valueSource=dsl.text 时，文案承载属性是设计文本，merge 必须按 DSL 覆盖，
 *      否则 provenance 校验必然失败。文案承载属性与 validate-iocontrol-provenance.js 同口径：
 *      有 Value 比 Value；没有 Value 的容器类控件（如 GroupBox）由 Header 承载标题文案，比 Header。
 *   4. 映射中不存在的现有节点 → 原样保留（写"现有但设计稿无"报告）；
 *   5. 全新节点 → 按映射渲染，插入其父节点闭合标签之前。
 *
 * 用法：
 *   node gen-iocontrol-xml.js --fresh <mapping.json> [--out X.xml] [--map mtslg-iocontrol-map.json]
 *   node gen-iocontrol-xml.js --merge <existing.xml> <mapping.json> [--out X.xml] [--map mtslg-iocontrol-map.json]
 */
'use strict';

const fs = require('fs');
const { validateTextAudit } = require('./validate-iocontrol-provenance');
// 模板表规则块的解析唯一实现（见 scripts/lib/iocontrol-map-rules.js；禁止在本脚本再抄一份）。
const MAP_RULES = require('./lib/iocontrol-map-rules');
// XML 属性转义（含换行 → &#x0a;）的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { xmlAttr, normalizeForCompare, omittedAttrs } = require('./lib/script-helpers');

// ---------- 参数 ----------
function usage() {
  console.error('用法:');
  console.error('  node gen-iocontrol-xml.js --fresh <mapping.json> [--out X.xml] [--map mtslg-iocontrol-map.json]');
  console.error('  node gen-iocontrol-xml.js --merge <existing.xml> <mapping.json> [--out X.xml] [--map mtslg-iocontrol-map.json]');
  process.exit(2);
}

const args = process.argv.slice(2);
let mode = null, existingPath = null, mappingPath = null, outPath = null, templateMapPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--fresh') mode = 'fresh';
  else if (args[i] === '--merge') { mode = 'merge'; existingPath = args[++i]; }
  else if (args[i] === '--out') outPath = args[++i];
  else if (args[i] === '--map') templateMapPath = args[++i];
  else if (!mappingPath) mappingPath = args[i];
  else usage();
}
if (!mode || !mappingPath) usage();
if (mode === 'merge' && !existingPath) usage();

const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
// ---------- 节点发射顺序：按设计稿的上下布局 ----------
// 设计稿的图层树顺序与画面上的上下位置无关（mapping.nodes 由 DSL 树递归遍历产生），
// 而生成代码必须按设计坐标自上而下、同一行自左向右排列：上下布局容器的子节点顺序
// 直接决定运行时的显示顺序。排序只改变发射顺序，ID / 坐标 / 属性 / 层级关系都不变。
// 口径：Top（absY）主序 → Left（absX）次序 → 坐标相同保持映射原顺序（稳定）。
function sortNodesByDesignOrder(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(function (node, index) { return { node: node, index: index }; })
    .sort(function (a, b) {
      const ay = Number(a.node && a.node.absY);
      const by = Number(b.node && b.node.absY);
      const aHasY = Number.isFinite(ay);
      const bHasY = Number.isFinite(by);
      if (aHasY && bHasY && ay !== by) return ay - by;
      if (aHasY !== bHasY) return aHasY ? -1 : 1;
      const ax = Number(a.node && a.node.absX);
      const bx = Number(b.node && b.node.absX);
      const aHasX = Number.isFinite(ax);
      const bHasX = Number.isFinite(bx);
      if (aHasX && bHasX && ax !== bx) return ax - bx;
      if (aHasX !== bHasX) return aHasX ? -1 : 1;
      return a.index - b.index;
    })
    .map(function (item) { return item.node; });
}

const nodes = sortNodesByDesignOrder(mapping.nodes || []);

// 「视觉行」容差：同一父容器内，相邻控件 Top 差 ≤ 该值视为同一行，行内按 Left 从左到右。
// 依据：设计稿里成对的"标签 + 输入框"常有十几像素的高差（例如标签 Top=52、下拉框 Top=40），
// 严格按 Top 排序会把它们拆成两行、把成对控件排散。容差只用于排序，不改坐标/属性/层级。
const VISUAL_ROW_TOLERANCE_PX = 15;

// 按"先上后下、同一视觉行先左后右"排列同一个父容器下的直接子节点。
// 行聚类从每行第一个（Top 最小）节点起算，避免链式合并导致整块并成一行。
function orderChildrenByVisualRows(list) {
  if (!Array.isArray(list) || list.length < 2) return Array.isArray(list) ? list.slice() : [];
  const items = list.map(function (node, index) {
    const y = Number(node && node.absY);
    const x = Number(node && node.absX);
    return {
      node: node,
      index: index,
      y: Number.isFinite(y) ? y : Number.POSITIVE_INFINITY,
      x: Number.isFinite(x) ? x : Number.POSITIVE_INFINITY
    };
  });
  items.sort(function (a, b) {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return a.index - b.index;
  });
  const rows = [];
  for (const item of items) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(item.y - row.originY) <= VISUAL_ROW_TOLERANCE_PX) row.items.push(item);
    else rows.push({ originY: item.y, items: [item] });
  }
  const ordered = [];
  for (const row of rows) {
    row.items.sort(function (a, b) {
      if (a.x !== b.x) return a.x - b.x;
      if (a.y !== b.y) return a.y - b.y;
      return a.index - b.index;
    });
    for (const item of row.items) ordered.push(item.node);
  }
  return ordered;
}
const TOP_PUBLIC_BAR_Y = 126;
const TOP_ARTIFACT_TITLE_Y = 66;
const contentOriginY = TOP_PUBLIC_BAR_Y + TOP_ARTIFACT_TITLE_Y;

// ---------- 按钮族固定参数 ----------
// 规则真值来源：模板表 mtslg-iocontrol-map.json 的 buttonFamily（脚本不再各存一份）。
// 传入 --map 时读取该表；未传入或表中缺字段时退回下列内置默认（与表内容一致）。
const DEFAULT_BUTTON_FAMILY = {
  controlTypes: ['IconButton', 'Button', 'StatusButton'],
  alwaysWrittenAttrs: ['PageName', 'IOVisible', 'IOCommand', 'IOEnable'],
  iconSizeAttrs: ['IconWidth', 'IconHeight'],
};
// 每个 ControlType 的固定必写字段集（设计方给定的 IOContorl 字段模板）。
// 真值来源：模板表 mtslg-iocontrol-map.json 的 controlTypeRequiredAttrs；缺表时退回内置默认。
const DEFAULT_CONTROL_TYPE_REQUIRED_ATTRS = {
  GroupBox: ['Style', 'Header', 'LangName', 'IOName', 'IOEnable', 'IOVisible', 'MinValue', 'MaxValue'],
  Border: ['Style', 'Value', 'IOEnable', 'IOVisible'],
  TextBlock: ['Style', 'Value', 'LangName', 'IOName', 'IOEnable', 'IOVisible', 'IsAutoRead', 'Foreground', 'FontSize'],
  Button: ['Style', 'Value', 'LangName', 'PageName', 'IOCommand', 'IOEnable', 'IOVisible'],
  StatusButton: ['Style', 'Value', 'LangName', 'PageName', 'IOCommand', 'IOEnable', 'IOVisible'],
  IconButton: ['Style', 'Value', 'LangName', 'PageName', 'Icon', 'TopLeftContent', 'IsShowStatus', 'IsNeedRedMark', 'IOCommand', 'IOEnable', 'IOVisible', 'IconHeight', 'IconWidth'],
  Togglebutton: ['Style', 'Value', 'IOName', 'IOState', 'IsAutoRefresh', 'IOEnable', 'IOVisible'],
  RadioButton: ['Style', 'Value', 'IOName', 'IOState', 'IsAutoRefresh', 'IOEnable', 'IOVisible'],
  ComboBox: ['Style', 'Value', 'IOName', 'ItemsSourceFile', 'DisplayMemberPath', 'SelectedValuePath', 'IsAutoRead', 'IsAutoWrite', 'IsWriteIO', 'IOCommand', 'IOEnable', 'IOVisible'],
  CheckBox: ['Value', 'IOName', 'DefaultValue', 'IsWriteIO', 'IOEnable', 'IOVisible'],
  TextBox: ['Value', 'DefaultValue', 'IsWriteIO', 'Keypad', 'IOEnable', 'IOVisible'],
  NumberBox: ['Value', 'MinValue', 'MaxValue', 'DefaultValue', 'DecimalPlaces', 'IsWriteIO', 'Keypad', 'IsAutoRead', 'IOEnable', 'IOVisible'],
  IntNumberBox: ['Value', 'MinValue', 'MaxValue', 'DefaultValue', 'DecimalPlaces', 'IsWriteIO', 'Keypad', 'IsAutoRead', 'IOEnable', 'IOVisible'],
  DataGrid: ['Value', 'IOName', 'IOEnable', 'IOVisible'],
  Camera: ['DesignPanelID', 'Value', 'IOName'],
};
const BUTTON_FAMILY_RULES = loadButtonFamilyRules(templateMapPath);
const BUTTON_FAMILY_CONTROL_TYPES = new Set(BUTTON_FAMILY_RULES.controlTypes);
const BUTTON_ALWAYS_ATTRS = BUTTON_FAMILY_RULES.alwaysWrittenAttrs;
const BUTTON_ICON_SIZE_ATTRS = BUTTON_FAMILY_RULES.iconSizeAttrs;
const REQUIRED_ATTRS_BY_CONTROL_TYPE = loadControlTypeRequiredAttrs(templateMapPath);
// 必写字段的默认值（映射无来源时使用）；未登记的字段写空字符串。
const DEFAULT_ATTRS_BY_CONTROL_TYPE = loadControlTypeAttrDefaults(templateMapPath);

function loadControlTypeAttrDefaults(mapPath) {
  const fallback = { Border: { Value: '1' } };
  if (!mapPath) return fallback;
  let templateMap;
  try { templateMap = JSON.parse(fs.readFileSync(mapPath, 'utf8')); }
  catch (error) { throw new Error('读取模板表失败: ' + mapPath + ' - ' + error.message); }
  const spec = templateMap.controlTypeAttrDefaults;
  if (!spec || typeof spec !== 'object') return fallback;
  const result = {};
  for (const [type, attrs] of Object.entries(spec)) {
    if (type.startsWith('_')) continue;
    if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) result[type] = attrs;
  }
  return Object.keys(result).length ? result : fallback;
}

function loadControlTypeRequiredAttrs(mapPath) {
  if (!mapPath) return DEFAULT_CONTROL_TYPE_REQUIRED_ATTRS;
  return MAP_RULES.parseControlTypeRequiredAttrs(MAP_RULES.readTemplateMapOrFail(mapPath)) ||
    DEFAULT_CONTROL_TYPE_REQUIRED_ATTRS;
}

function loadButtonFamilyRules(mapPath) {
  if (!mapPath) return DEFAULT_BUTTON_FAMILY;
  return MAP_RULES.parseButtonFamilyRules(MAP_RULES.readTemplateMapOrFail(mapPath), DEFAULT_BUTTON_FAMILY) ||
    DEFAULT_BUTTON_FAMILY;
}

function isButtonFamily(node) {
  const type = node.controlType || (node.attrs && node.attrs.ControlType);
  return BUTTON_FAMILY_CONTROL_TYPES.has(type);
}

function hasIconAttr(node) {
  const icon = node.attrs && node.attrs.Icon;
  return typeof icon === 'string' && icon.trim() !== '';
}

// 台账命中条目节点 bbox（映射字段 iconSize），取整后用于 IconWidth/IconHeight。
function iconSizeOf(node) {
  const size = node.iconSize;
  if (!size || typeof size !== 'object') return null;
  const width = Number(size.width);
  const height = Number(size.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width: String(Math.round(width)), height: String(Math.round(height)) };
}

// 门禁：按钮族带 Icon 却没有 iconSize 时禁止生成（图标尺寸必须有真实来源）。
function assertButtonFamilyIconSize(node) {
  if (!isButtonFamily(node)) return;
  if (hasIconAttr(node) && !iconSizeOf(node)) {
    throw new Error('映射门禁失败: 按钮族节点 ' + node.ref +
      ' 带 Icon 但缺少 iconSize（台账命中条目节点 bbox；iconPolicy=runtime 的变体取实例子树唯一 PATH 的 bbox）；' +
      '请重新生成 mapping，禁止猜图标尺寸');
  }
}

// 就地补齐按钮族固定参数。
function applyButtonFamilyAttrs(node, attrMap) {
  if (!isButtonFamily(node)) return;
  const omitted = omittedAttrs(node);
  for (const key of BUTTON_ALWAYS_ATTRS) {
    if (omitted.has(key)) continue;                 // 变体登记 omitRequiredAttrs：该字段不发射
    if (attrMap[key] === undefined || attrMap[key] === null) attrMap[key] = '';
  }
  for (const key of omitted) delete attrMap[key];    // 映射里残留的同名字段同样不发射
  const type = node.controlType || (node.attrs && node.attrs.ControlType);
  const required = REQUIRED_ATTRS_BY_CONTROL_TYPE[type] || [];
  // 该 ControlType 的模板是否含图标字段：Button / StatusButton 的模板不含，恒不发射这三项。
  const wantsIconAttrs = required.indexOf('Icon') >= 0 || required.indexOf(BUTTON_ICON_SIZE_ATTRS[0]) >= 0;
  // 图标尺寸只在「模板含图标字段」且「节点带 Icon」时消费；映射残留的 iconSize 既不脱离
  // Icon 单独生效，也不越过 ControlType 模板生效——与 provenance 校验的「有图标」判据一致。
  const size = wantsIconAttrs && hasIconAttr(node) ? iconSizeOf(node) : null;
  if (size) {
    attrMap[BUTTON_ICON_SIZE_ATTRS[0]] = size.width;
    attrMap[BUTTON_ICON_SIZE_ATTRS[1]] = size.height;
  }
  else if (!wantsIconAttrs) {
    // 模板不含图标字段（如 Button / StatusButton）：不发射 Icon / IconWidth / IconHeight，
    // 即使映射里残留 Icon 或 iconSize。
    delete attrMap.Icon;
    delete attrMap[BUTTON_ICON_SIZE_ATTRS[0]];
    delete attrMap[BUTTON_ICON_SIZE_ATTRS[1]];
  }
  else if (!hasIconAttr(node)) {
    // 该 ControlType 的模板含图标字段（如 IconButton）但没有图标槽位：字段恒写，值写空字符串，
    // 同时丢弃映射里可能残留的陈旧尺寸。
    attrMap.Icon = '';
    attrMap[BUTTON_ICON_SIZE_ATTRS[0]] = '';
    attrMap[BUTTON_ICON_SIZE_ATTRS[1]] = '';
  }
}

// 就地补齐当前 ControlType 的固定必写字段（缺来源写空字符串）。
// 几何（Left/Top/Width/Height）、ID/ControlType 由 emit 单独发射，不在此覆盖。
function applyRequiredAttrs(node, attrMap) {
  const type = node.controlType || (node.attrs && node.attrs.ControlType);
  const required = REQUIRED_ATTRS_BY_CONTROL_TYPE[type];
  if (!Array.isArray(required)) return;
  const defaults = DEFAULT_ATTRS_BY_CONTROL_TYPE[type] || {};
  const omitted = omittedAttrs(node);
  for (const key of required) {
    if (omitted.has(key)) continue;                 // 变体登记 omitRequiredAttrs：该字段不发射
    // LangName 例外：只有多语言绑定层给出真实 key 时才挂，动态值等豁免节点不写空占位。
    if (key === 'LangName') continue;
    if (attrMap[key] === undefined || attrMap[key] === null) {
      attrMap[key] = Object.prototype.hasOwnProperty.call(defaults, key) ? String(defaults[key]) : '';
    }
  }
}

// 按钮族中由生成器按图标 bbox 计算的属性（merge 时按几何语义覆盖并报告）
function buttonFamilyIconSizeAttrNames(node) {
  const type = node.controlType || (node.attrs && node.attrs.ControlType);
  const required = REQUIRED_ATTRS_BY_CONTROL_TYPE[type] || [];
  const wantsIconAttrs = required.indexOf('Icon') >= 0 || required.indexOf(BUTTON_ICON_SIZE_ATTRS[0]) >= 0;
  return isButtonFamily(node) && wantsIconAttrs && hasIconAttr(node) && iconSizeOf(node)
    ? BUTTON_ICON_SIZE_ATTRS.slice()
    : [];
}

function validateFreshMapping() {
  if (!Array.isArray(mapping.sourceNodes)) {
    throw new Error('映射门禁失败: 缺少 sourceNodes，不能证明映射来自真实 DSL');
  }
  const sourceMap = new Map(mapping.sourceNodes.map(n => [n.ref, n]));
  const textAuditErrors = validateTextAudit(mapping, nodes);
  if (textAuditErrors.length > 0) {
    throw new Error('文本可见性闭环失败: ' + textAuditErrors.join('; '));
  }
  const seenRefs = new Set();
  const seenXmlIds = new Set();
  for (const n of nodes) {
    if (!n.ref || seenRefs.has(n.ref)) throw new Error('映射门禁失败: 每个节点必须有唯一 ref: ' + (n.ref || '(missing)'));
    seenRefs.add(n.ref);
    const xmlId = n.xmlId !== undefined ? n.xmlId : n.id;
    if (xmlId !== undefined && xmlId !== null && xmlId !== '') {
      if (seenXmlIds.has(xmlId)) {
        throw new Error('映射门禁失败: XML ID 必须唯一: ' + xmlId);
      }
      seenXmlIds.add(xmlId);
    }
    if (!sourceMap.has(n.sourceRef || n.ref)) {
      throw new Error('映射门禁失败: ' + n.ref + ' 没有对应 sourceNodes 记录');
    }
    if (n.sourceParent !== undefined) {
      const src = sourceMap.get(n.sourceRef || n.ref);
      if (n.sourceParent !== (src.parentRef || null)) {
        throw new Error('映射门禁失败: ' + n.ref + ' 的 sourceParent 不是 DSL 直接父节点');
      }
    }
    for (const field of ['absX', 'absY']) {
      if (typeof n[field] !== 'number' || !Number.isFinite(n[field])) {
        throw new Error('映射门禁失败: ' + n.ref + ' 缺少真实 ' + field + '，禁止猜坐标');
      }
    }
    if (n.w !== undefined && (typeof n.w !== 'number' || !Number.isFinite(n.w))) {
      throw new Error('映射门禁失败: ' + n.ref + ' 的 Width 不是同一 DSL bbox 的数值');
    }
    if (n.h !== undefined && (typeof n.h !== 'number' || !Number.isFinite(n.h))) {
      throw new Error('映射门禁失败: ' + n.ref + ' 的 Height 不是同一 DSL bbox 的数值');
    }
    if (n.w === undefined || n.h === undefined) {
      throw new Error('映射门禁失败: ' + n.ref + ' 缺少 Width/Height bbox，禁止猜尺寸');
    }
    const type = n.controlType || (n.attrs && n.attrs.ControlType);
    if (typeof type !== 'string' || !type.trim()) {
      throw new Error('映射门禁失败: ' + n.ref + ' 缺少 ControlType；MTSLG 页面根节点之外禁止生成无类型布局容器');
    }
    assertButtonFamilyIconSize(n);
    if (type === 'TextBlock') {
      if (typeof n.sourceRef !== 'string' || !n.sourceRef) {
        throw new Error('映射门禁失败: TextBlock ' + n.ref + ' 缺少 sourceRef');
      }
      if (typeof n.sourceText !== 'string') {
        throw new Error('映射门禁失败: TextBlock ' + n.ref + ' 缺少 sourceText');
      }
      if (n.valueSource !== 'dsl.text') {
        throw new Error('映射门禁失败: TextBlock ' + n.ref + ' 的 valueSource 必须是 dsl.text');
      }
      if (n.attrs && n.attrs.Value !== undefined && n.attrs.Value !== n.sourceText) {
        throw new Error('映射门禁失败: ' + n.ref + ' 的 Value 不等于 sourceText');
      }
    }
  }
}

// ---------- 工具 ----------
function fmtNum(n) {
  if (n === null || n === undefined) return null;
  if (typeof n === 'number' && Number.isNaN(n)) return 'NaN';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return String(Number(num.toFixed(4))); // 去浮点噪声、整数值不带小数点
}

// 属性转义：共享实现（xmlAttr）已经处理换行 → &#x0a;，此处只保留本文件的历史名字。
const escAttr = xmlAttr;

function normalizedY(y) {
  return Number(y) - contentOriginY;
}

function outputHeight(node) {
  const type = node.controlType || (node.attrs && node.attrs.ControlType);
  return type === 'TextBlock' ? 40 : node.h;
}

// TextBlock 宽度固定为 NaN（自适应），不使用设计稿文本 bbox 宽度；其余控件仍用自身 bbox。
function outputWidth(node) {
  const type = node.controlType || (node.attrs && node.attrs.ControlType);
  if (type === 'TextBlock') return 'NaN';
  return node.w;
}

// ---------- 表格列定义节点（nodeKind=table-column） ----------
// DataGrid 的列子节点是列定义，不是页面控件：几何按映射表 tableTemplates.columnTemplate 固定发射
// （Left=0 / Top=0 / Height=45，不写 Width），属性用映射已带的字段集，不套 controlTypeRequiredAttrs。
// 映射生成器已把模板值写进 expectedLeft/expectedTop/expectedHeight/omitWidth，这里只做发射；
// 校验器（provenance / coords）按同一组字段与映射表复核，三方同口径。
function isTableColumnNode(node) {
  return Boolean(node && node.nodeKind === 'table-column');
}

function tableColumnGeometryOf(node) {
  return {
    left: node.expectedLeft,
    top: node.expectedTop,
    height: node.expectedHeight,
    omitWidth: node.omitWidth !== false
  };
}

// 就地发射节点几何：表格列定义走模板固定几何，其余节点按 DSL bbox 相对父容器计算。
function applyNodeGeometry(node, attrMap, parentAbsX, parentAbsY, insetLeft, insetTop) {
  if (isTableColumnNode(node)) {
    const geometry = tableColumnGeometryOf(node);
    attrMap.Left = fmtNum(geometry.left);
    attrMap.Top = fmtNum(geometry.top);
    attrMap.Height = fmtNum(geometry.height);
    if (geometry.omitWidth) delete attrMap.Width;
    else if (node.expectedWidth !== undefined && node.expectedWidth !== null) attrMap.Width = fmtNum(node.expectedWidth);
    return;
  }
  attrMap.Left = fmtNum(node.absX - parentAbsX - insetLeft);
  attrMap.Top = fmtNum(normalizedY(node.absY) - parentAbsY - insetTop);
  if (outputWidth(node) !== undefined && outputWidth(node) !== null) attrMap.Width = fmtNum(outputWidth(node));
  if (outputHeight(node) !== undefined && outputHeight(node) !== null) attrMap.Height = fmtNum(outputHeight(node));
}

// 就地补齐模板属性：表格列定义按 columnTemplate 发射（字段已在映射里），其余节点按固定必写字段集。
function applyTemplateAttrs(node, attrMap) {
  if (isTableColumnNode(node)) return;
  applyButtonFamilyAttrs(node, attrMap);
  applyRequiredAttrs(node, attrMap);
}

// 属性渲染顺序（目标项目页面既有惯例）：
//   身份/类型/样式 → Icon → 文本(TopLeftContent/Value/Header) → LangName →
//   运行时字段(PageName/IO*) → 控件尺寸(Width/Height) → 图标尺寸(IconWidth/IconHeight) → 位置(Left/Top)
const ATTR_ORDER = [
  'ID', 'ControlType', 'Style', 'Icon', 'IconText', 'TopLeftContent', 'Value', 'Header', 'LangName',
  'PageName', 'IOName', 'IOCommand', 'IOVisible', 'IOEnable', 'IOParam', 'IOStyle', 'IOState', 'IOGroup',
  'UserRightId',
  'IsAutoRead', 'IsAutoWrite', 'IsAutoRefresh', 'IsWriteIO', 'IsSave',
  'IsShowDialog', 'DialogMessage', 'IsShowStatus', 'IsNeedRedMark', 'StatusBrush',
  'Foreground', 'FontSize', 'FontWeight', 'Orientation', 'ItemsSourceFile', 'DisplayMemberPath',
  'SelectedValuePath', 'Filter', 'DefaultValue', 'MinValue', 'MaxValue', 'MinRange',
  'MaxRange', 'DecimalPlaces', 'Keypad', 'MaxLength', 'DisableRow', 'DesignPanelID',
  'ParameterName',
  'Width', 'Height', 'IconWidth', 'IconHeight', 'Left', 'Top',
];
const GEOM_ATTRS = ['Left', 'Top', 'Width', 'Height'];

function orderedEntries(attrMap) {
  const entries = Object.entries(attrMap).filter(([, v]) => v !== null && v !== undefined);
  entries.sort((a, b) => {
    const ia = ATTR_ORDER.indexOf(a[0]);
    const ib = ATTR_ORDER.indexOf(b[0]);
    if (ia === -1 && ib === -1) return a[0] < b[0] ? -1 : 1;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return entries;
}

// 单行风格：  <IOContorl a="1" b="2" />
// 多行风格（真实文件惯例）：
//   <IOContorl
//       a="1"
//       b="2" />
// firstPrefix：第一行（<IOContorl）前的前缀。替换场景 = ''（原始 gap 已含缩进）；
//              全新渲染/插入场景 = indent（无 gap 提供缩进）。
// innerPad：多行风格属性行的缩进前缀。
function renderTag(attrMap, firstPrefix, innerPad, selfClose, style) {
  const entries = orderedEntries(attrMap);
  const end = selfClose ? ' />' : '>';
  if (style === 'single') {
    return `${firstPrefix}<IOContorl ${entries.map(([k, v]) => `${k}="${escAttr(v)}"`).join(' ')}${end}`;
  }
  let s = `${firstPrefix}<IOContorl`;
  for (const [k, v] of entries) s += `\n${innerPad}${k}="${escAttr(v)}"`;
  return s + end;
}

// ---------- fresh 渲染（多行风格） ----------
function renderFresh() {
  const childMap = new Map();
  const rootChildren = [];
  for (const n of nodes) {
    const p = n.parent || null;
    if (p === null) rootChildren.push(n);
    else {
      if (!childMap.has(p)) childMap.set(p, []);
      childMap.get(p).push(n);
    }
  }

  const lines = [];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  if (mapping.comment) lines.push(`<!-- ${mapping.comment} -->`);
  lines.push('<IOContorl');
  lines.push('    ID=""');
  lines.push('    Left="NaN"');
  lines.push('    Top="NaN"');
  lines.push('    Width="NaN"');
  lines.push('    Height="NaN">');

  const emit = (node, depth, parentAbsX, parentAbsY, parentInset) => {
    const indent = '    '.repeat(depth);
    const attrMap = Object.assign({}, node.attrs || {});
    if (node.id) attrMap.ID = node.id;
    if (node.controlType) attrMap.ControlType = node.controlType;
    // 父节点是容器（GroupBox 等）时，子坐标从"内容区原点"量：再扣掉内容区边框 + 标题条高度。
    // 原点由父节点的 contentInset 携带（映射按容器变体的 contentInsetStyle 查 styleInsets 得到，
    // 与发射到 XML 的 Style 是两个字段），与 provenance 校验同口径。
    const insetLeft = parentInset ? (Number(parentInset.left) || 0) : 0;
    const insetTop = parentInset ? (Number(parentInset.top) || 0) : 0;
    applyNodeGeometry(node, attrMap, parentAbsX, parentAbsY, insetLeft, insetTop);
    applyTemplateAttrs(node, attrMap);

    const kids = orderChildrenByVisualRows(childMap.get(node.ref) || []);
    if (node.comment) lines.push(`${indent}<!-- ${node.comment} -->`);
    if (kids.length > 0) {
      lines.push(renderTag(attrMap, indent, indent + '    ', false, 'multi'));
      for (const k of kids) emit(k, depth + 1, node.absX, normalizedY(node.absY), node.contentInset || null);
      lines.push(`${indent}</IOContorl>`);
    } else {
      lines.push(renderTag(attrMap, indent, indent + '    ', true, 'multi'));
    }
  };
  // 发射顺序：每个父容器内按"先上后下、同一视觉行先左后右"排列（只改顺序，不动坐标/属性/层级）。
  for (const n of orderChildrenByVisualRows(rootChildren)) emit(n, 1, 0, 0, null);
  lines.push('</IOContorl>');
  return lines.join('\n') + '\n';
}

// ---------- merge 模式：标签块级解析（支持多行标签） ----------
const TOKEN_RE = /<!--[\s\S]*?-->|<[^>]+>/g;
const ATTR_RE = /([A-Za-z][\w]*)\s*=\s*"([^"]*)"/g;

function parseXmlText(text) {
  const tokens = [];
  const openStack = [];
  const openClose = new Map(); // open tokenIdx -> close tokenIdx
  let depth = 0;
  let lastEnd = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > lastEnd) tokens.push({ type: 'raw', raw: text.slice(lastEnd, m.index) });
    const chunk = m[0];
    if (chunk.startsWith('<!--')) {
      tokens.push({ type: 'comment', raw: chunk });
    } else if (chunk.startsWith('<?') || chunk.startsWith('<!')) {
      // XML 声明 / 处理指令 / DOCTYPE 不是控件标签，原样保留；
      // 否则 `<?xml ...?>` 会被当成一个没有 ControlType 的 IOContorl 节点。
      tokens.push({ type: 'raw', raw: chunk });
    } else {
      // 行首缩进：该标签起始所在行，tag 之前的部分
      const lineStart = text.lastIndexOf('\n', m.index - 1) + 1;
      const indent = text.slice(lineStart, m.index);
      const isClose = /^<\/\s*/.test(chunk);
      const selfClose = /\/\s*>$/.test(chunk) || isClose;
      const nameM = chunk.match(/^<\/?\s*([A-Za-z][\w:.-]*)/);
      const attrs = [];
      let a;
      while ((a = ATTR_RE.exec(chunk)) !== null) attrs.push({ name: a[1], value: a[2] });
      const token = {
        type: 'tag',
        raw: chunk,
        indent,
        name: nameM ? nameM[1] : 'IOContorl',
        attrs,
        isClose,
        isSelfClose: selfClose,
        depth: isClose ? depth - 1 : depth,
        attrMap: Object.fromEntries(attrs.map(x => [x.name, x.value])),
      };
      if (!isClose && !selfClose) {
        openStack.push(tokens.length);
        depth++;
      } else if (isClose) {
        depth--;
        const openIdx = openStack.pop();
        if (openIdx !== undefined) openClose.set(openIdx, tokens.length);
      }
      tokens.push(token);
    }
    lastEnd = TOKEN_RE.lastIndex;
  }
  if (lastEnd < text.length) tokens.push({ type: 'raw', raw: text.slice(lastEnd) });
  return { tokens, openClose };
}

function mergeMode() {
  const existingText = fs.readFileSync(existingPath, 'utf8');
  // 唯一性硬门（读入时）：非空 ID 必须全页唯一——ID 是 WPF 控件的 .Name / GetValueByID 的句柄，
  // 一个 ID 指向两个控件就会取错对象。人工复制节点忘了改 ID 是最常见的来源，这里直接拦下要求先修。
  const inputDupIds = duplicateXmlIds(existingText);
  if (inputDupIds.length > 0) {
    throw new Error('现有页面存在重复 ID（同一 ID 指向多个控件），请先修好再 merge: ' + inputDupIds.join(', '));
  }
  const { tokens, openClose } = parseXmlText(existingText);

  const invalidUntyped = [];
  let rootSeen = false;
  tokens.forEach((token) => {
    if (token.type !== 'tag' || token.isClose || token.name !== 'IOContorl') return;
    if (!rootSeen) {
      rootSeen = true;
      return;
    }
    if (!token.attrMap.ControlType) {
      invalidUntyped.push(token.attrMap.ID || '(无 ID)');
    }
  });
  if (invalidUntyped.length > 0) {
    throw new Error('现有 IOContorl 页面包含无 ControlType 的非根节点，禁止继续生成: ' + invalidUntyped.join(', '));
  }

  const report = { conflicts: [], added: [], updated: [], textOverrides: [], langOverrides: [], newNodes: [], unmapped: [] };
  const matchedOpenIdx = new Set();

  // 现有节点索引：ID → tokenIdx
  const idIndex = new Map();
  tokens.forEach((t, i) => {
    if (t.type === 'tag' && !t.isClose && t.attrMap.ID && t.attrMap.ID !== '') {
      idIndex.set(t.attrMap.ID, i);
    }
  });

  // 映射节点 → 渲染数据（几何相对坐标在匹配后重算）
  const absOf = new Map();
  nodes.forEach(n => absOf.set(n.ref, { absX: n.absX, absY: normalizedY(n.absY) }));
  const nodeByRef = new Map(nodes.map(n => [n.ref, n]));

  function resolveParentAbs(n) {
    const p = n.parent || null;
    if (p === null) return { x: 0, y: 0, insetLeft: 0, insetTop: 0 };
    const pn = absOf.get(p);
    if (!pn) throw new Error(`映射节点 parent 引用不存在: ${p}（来自 ref=${n.ref}）`);
    // 父节点是容器时，子坐标从内容区原点量（再扣内容区边框 + 标题条高），与 fresh 发射同口径。
    const parentNode = nodeByRef.get(p);
    const inset = parentNode && parentNode.contentInset ? parentNode.contentInset : null;
    return {
      x: pn.absX,
      y: pn.absY,
      insetLeft: inset ? (Number(inset.left) || 0) : 0,
      insetTop: inset ? (Number(inset.top) || 0) : 0
    };
  }

  const rendered = new Map(); // ref -> {n, attrMap, tokenIdx, matchKind}
  for (const n of nodes) {
    const type = n.controlType || (n.attrs && n.attrs.ControlType);
    if (typeof type !== 'string' || !type.trim()) {
      throw new Error('映射门禁失败: ' + n.ref + ' 缺少 ControlType；MTSLG 页面根节点之外禁止生成无类型布局容器');
    }
    assertButtonFamilyIconSize(n);
    const pa = resolveParentAbs(n);
    const attrMap = Object.assign({}, n.attrs || {});
    if (n.id) attrMap.ID = n.id;
    if (n.controlType) attrMap.ControlType = n.controlType;
    applyNodeGeometry(n, attrMap, pa.x, pa.y, pa.insetLeft, pa.insetTop);
    applyTemplateAttrs(n, attrMap);
    rendered.set(n.ref, { n, attrMap, tokenIdx: null, matchKind: null });
  }

  // 匹配：ID 优先，其次 ControlType + 坐标（容差 0.5）
  const positionCandidates = [];
  tokens.forEach((t, i) => {
    if (t.type === 'tag' && !t.isClose && t.attrMap.ControlType) {
      positionCandidates.push({ i, controlType: t.attrMap.ControlType, left: parseFloat(t.attrMap.Left), top: parseFloat(t.attrMap.Top) });
    }
  });

  for (const [ref, r] of rendered) {
    const n = r.n;
    let tokenIdx = null, matchKind = null;
    if (n.id && idIndex.has(n.id)) { tokenIdx = idIndex.get(n.id); matchKind = 'id'; }
    if (tokenIdx === null && n.controlType) {
      const pa = resolveParentAbs(n);
      // 表格列定义按模板固定几何匹配（Left=0/Top=0），不能再用 DSL bbox 反推。
      const expected = isTableColumnNode(n)
        ? { left: Number(n.expectedLeft), top: Number(n.expectedTop) }
        : { left: n.absX - pa.x - pa.insetLeft, top: normalizedY(n.absY) - pa.y - pa.insetTop };
      const hit = positionCandidates.find(p =>
        !matchedOpenIdx.has(p.i) &&
        p.controlType === n.controlType &&
        Math.abs(p.left - expected.left) <= 0.5 &&
        Math.abs(p.top - expected.top) <= 0.5);
      if (hit) { tokenIdx = hit.i; matchKind = 'position'; }
    }
    r.tokenIdx = tokenIdx;
    r.matchKind = matchKind;
    if (tokenIdx !== null) matchedOpenIdx.add(tokenIdx);
  }

  // 替换：几何/ControlType 按映射；业务属性保留现有、冲突报告
  const replacements = new Map(); // tokenIdx -> newChunk
  for (const { n, attrMap, tokenIdx, matchKind } of rendered.values()) {
    if (tokenIdx === null) continue;
    const t = tokens[tokenIdx];
    const finalAttrs = new Map();
    for (const a of t.attrs) finalAttrs.set(a.name, a.value);
    // 按钮族的 IconWidth/IconHeight 属于生成器按图标 bbox 计算的属性，按几何语义覆盖。
    const geometryKeys = GEOM_ATTRS.concat(buttonFamilyIconSizeAttrNames(n));
    for (const k of geometryKeys) {
      if (attrMap[k] !== undefined && attrMap[k] !== null) {
        if (!finalAttrs.has(k)) {
          report.added.push(`[${n.ref}] ${k}="${attrMap[k]}" 新增`);
        } else if (finalAttrs.get(k) !== attrMap[k]) {
          report.updated.push(`[${n.ref}] ${k}: "${finalAttrs.get(k)}" -> "${attrMap[k]}" (匹配:${matchKind})`);
        }
        finalAttrs.set(k, attrMap[k]);
      }
    }
    if (attrMap.ControlType !== undefined && finalAttrs.get('ControlType') !== attrMap.ControlType) {
      report.conflicts.push(`[${n.ref}] ControlType: 现有 "${finalAttrs.get('ControlType')}" vs 映射 "${attrMap.ControlType}" → 按映射更新`);
      finalAttrs.set('ControlType', attrMap.ControlType);
    }
    // 文案承载属性（与 validate-iocontrol-provenance.js 同口径）：有 Value 比 Value；容器类控件
    // （GroupBox 等）没有 Value，标题文案由 Header 承载，此时比 Header。merge 必须覆盖承载属性，
    // 否则保留旧文案后 provenance 会报「Header/Value != DSL」。
    const declaresValue = finalAttrs.has('Value') || Object.prototype.hasOwnProperty.call(attrMap, 'Value');
    const declaresHeader = finalAttrs.has('Header') || Object.prototype.hasOwnProperty.call(attrMap, 'Header');
    const dslTextCarrier = declaresValue ? 'Value' : (declaresHeader ? 'Header' : null);
    for (const [k, v] of Object.entries(attrMap)) {
      if (geometryKeys.includes(k) || k === 'ControlType' || k === 'ID') continue;
      if (finalAttrs.has(k)) {
        // 值比较走统一文案口径：现有文件里的 &#x0a; 与映射里的 LF 视为同一个值，
        // 避免换行口径变化把「本来就一致」的文案误报成冲突/覆盖。
        const sameValue = normalizeForCompare(finalAttrs.get(k)) === normalizeForCompare(v);
        // dsl.text 来源的文案承载属性是设计文本，provenance 要求它与 sourceText 一致，必须按映射覆盖。
        const forcedByDslText = dslTextCarrier !== null && k === dslTextCarrier && n.valueSource === 'dsl.text';
        // LangName 是 Value 的多语言载体（键名由设计文本派生），口径与文案一致：映射里登记了就按映射覆盖，
        // 被覆盖的旧值写进报告由人确认；映射里没有该属性时不动现有值（人工自己挂的键保留）。
        const forcedByLangName = k === 'LangName';
        if (forcedByDslText || forcedByLangName) {
          if (!sameValue) {
            (forcedByLangName ? report.langOverrides : report.textOverrides).push(`[${n.ref}] ${k}: 现有 "${finalAttrs.get(k)}" -> ` +
              (forcedByLangName ? `设计派生 "${v}"（LangName 跟随设计稿）` : `设计文本 "${v}"（dsl.text 强制一致）`));
          }
          finalAttrs.set(k, v);
        } else if (n.force && n.force.includes(k)) {
          if (!sameValue) {
            report.conflicts.push(`[${n.ref}] ${k}: 现有 "${finalAttrs.get(k)}" -> 映射 "${v}"（force 强制覆盖）`);
          }
          finalAttrs.set(k, v);
        } else if (!sameValue) {
          report.conflicts.push(`[${n.ref}] ${k}: 现有 "${finalAttrs.get(k)}" 保留（映射值 "${v}" 不覆盖）`);
        }
      } else {
        finalAttrs.set(k, v);
        report.added.push(`[${n.ref}] ${k}="${v}" 新增`);
      }
    }
    const style = t.raw.includes('\n') ? 'multi' : 'single';
    // 替换场景：行首缩进已在原始 gap 中，firstPrefix=''；属性行缩进按原标签缩进推导
    replacements.set(tokenIdx, renderTag(Object.fromEntries(finalAttrs), '', t.indent + '    ', t.isSelfClose, style));
  }

  // 现有但映射未涉及的节点
  tokens.forEach((t, i) => {
    if (t.type !== 'tag' || t.isClose) return;
    if (t.attrMap.ControlType && !matchedOpenIdx.has(i)) {
      report.unmapped.push(`ID="${t.attrMap.ID || ''}" ControlType="${t.attrMap.ControlType}" 保留原样`);
    }
  });

  // 新节点：计算深度与插入点
  const depthOf = new Map();
  const depthOfRef = (ref) => {
    if (depthOf.has(ref)) return depthOf.get(ref);
    const n = nodes.find(x => x.ref === ref);
    const d = (n && n.parent) ? depthOfRef(n.parent) + 1 : 1;
    depthOf.set(ref, d);
    return d;
  };

  const insertions = new Map(); // closeTokenIdx -> [chunks]
  // merge 新增的「同级兄弟」也必须按「视觉行」排序（与 fresh 同一口径）：
  // 先按父分组，再对每组的**新节点**跑一次 orderChildrenByVisualRows，得到组内名次；
  // 然后把新节点按（父, 组内名次）顺序生成块，插入时同级新增就是"先上后下、行内先左后右"。
  const pendingNew = [];
  for (const r of rendered.values()) {
    if (r.tokenIdx !== null) continue;
    pendingNew.push(r);
  }
  const newRankByRef = new Map();
  const newByParent = new Map();
  for (const r of pendingNew) {
    const parentKey = r.n.parent || '';
    if (!newByParent.has(parentKey)) newByParent.set(parentKey, []);
    newByParent.get(parentKey).push(r.n);
  }
  for (const list of newByParent.values()) {
    orderChildrenByVisualRows(list).forEach(function (node, index) {
      newRankByRef.set(node.ref, index);
    });
  }
  pendingNew.sort(function (a, b) {
    const pa = a.n.parent || '';
    const pb = b.n.parent || '';
    if (pa !== pb) return pa < pb ? -1 : 1;
    return (newRankByRef.get(a.n.ref) || 0) - (newRankByRef.get(b.n.ref) || 0);
  });

  for (const r of pendingNew) {
    const ref = r.n.ref;
    const { n, attrMap } = r;
    const pa = resolveParentAbs(n);
    const attrMap2 = Object.assign({}, attrMap);
    if (isTableColumnNode(n)) {
      applyNodeGeometry(n, attrMap2, pa.x, pa.y, 0, 0);
      applyTemplateAttrs(n, attrMap2);
    } else {
      attrMap2.Left = fmtNum(n.absX - pa.x);
      attrMap2.Top = fmtNum(normalizedY(n.absY) - pa.y);
    }
    const indent = '    '.repeat(depthOfRef(ref));
    const kids = orderChildrenByVisualRows(nodes.filter(k => (k.parent || null) === ref));

    const renderSub = (node, d) => {
      const pa2 = resolveParentAbs(node);
      const am = Object.assign({}, node.attrs || {});
      if (node.id) am.ID = node.id;
      if (node.controlType) am.ControlType = node.controlType;
      if (isTableColumnNode(node)) {
        applyNodeGeometry(node, am, pa2.x, pa2.y, 0, 0);
        applyTemplateAttrs(node, am);
      } else {
        am.Left = fmtNum(node.absX - pa2.x);
        am.Top = fmtNum(normalizedY(node.absY) - pa2.y);
        if (outputWidth(node) !== undefined && outputWidth(node) !== null) am.Width = fmtNum(outputWidth(node));
        if (outputHeight(node) !== undefined && outputHeight(node) !== null) am.Height = fmtNum(outputHeight(node));
        applyButtonFamilyAttrs(node, am);
        applyRequiredAttrs(node, am);
      }
      const kk = orderChildrenByVisualRows(nodes.filter(x => (x.parent || null) === node.ref));
      const ind = '    '.repeat(d);
      const parts = [];
      if (node.comment) parts.push(`${ind}<!-- ${node.comment} -->\n`);
      if (kk.length > 0) {
        parts.push(renderTag(am, ind, ind + '    ', false, 'multi') + '\n');
        for (const x of kk) parts.push(renderSub(x, d + 1));
        parts.push(`${ind}</IOContorl>\n`);
      } else {
        parts.push(renderTag(am, ind, ind + '    ', true, 'multi') + '\n');
      }
      return parts.join('');
    };

    let block = '';
    if (n.comment) block += `${indent}<!-- ${n.comment} -->\n`;
    if (kids.length > 0) {
      block += renderTag(attrMap2, indent, indent + '    ', false, 'multi') + '\n';
      for (const k of kids) block += renderSub(k, depthOfRef(ref) + 1);
      block += `${indent}</IOContorl>\n`;
    } else {
      block += renderTag(attrMap2, indent, indent + '    ', true, 'multi') + '\n';
    }

    // 插入点：父闭合标签（父为根 → 最后一个闭合标签；父是新节点 → 挂在该新块的插入点后）
    let closeIdx = null;
    const p = n.parent || null;
    if (p === null) {
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].type === 'tag' && tokens[i].isClose) { closeIdx = i; break; }
      }
    } else {
      const pn = nodes.find(x => x.ref === p);
      if (pn && pn.id && idIndex.has(pn.id)) {
        const openIdx = idIndex.get(pn.id);
        if (openClose.has(openIdx)) closeIdx = openClose.get(openIdx);
      }
    }
    if (closeIdx !== null) {
      if (!insertions.has(closeIdx)) insertions.set(closeIdx, []);
      insertions.get(closeIdx).push(block);
    } else {
      // 父是新节点：挂到最后一个根级闭合标签前（保守回退）
      if (!insertions.has('root-pending')) insertions.set('root-pending', []);
      insertions.get('root-pending').push(block);
    }
    report.newNodes.push(`[${ref}] ${n.controlType || '(容器)'} 新增`);
  }

  // 组装输出
  const out = [];
  tokens.forEach((t, i) => {
    if (insertions.has(i)) out.push(...insertions.get(i));
    out.push(replacements.has(i) ? replacements.get(i) : t.raw);
  });
  const pending = insertions.get('root-pending');
  if (pending && pending.length) {
    const lastCloseIdx = out.map((x, i) => ({ x, i })).filter(o => typeof o.x === 'string' && /^\s*<\/IOContorl>\s*$/.test(o.x)).pop();
    if (lastCloseIdx) out.splice(lastCloseIdx.i, 0, ...pending);
  }

  return { text: out.join(''), report };
}

// 非空 ID 的全页唯一性检查（fresh / merge 共用；新节点与现有节点撞号也会在这里被拦下）。
function duplicateXmlIds(text) {
  const seen = new Set();
  const dup = new Set();
  for (const match of text.matchAll(/<IOContorl\b[^>]*?\bID="([^"]*)"/g)) {
    const id = match[1];
    if (!id) continue;
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return [...dup];
}

// ---------- 主流程 ----------
let outText, report = null;
if (mode === 'fresh') {
  validateFreshMapping();
  outText = renderFresh();
} else {
  const r = mergeMode();
  outText = r.text;
  report = r.report;
}

// 输出唯一性硬门：无论是新插入的节点与现有节点撞号，还是人工文件本身有重复，都不允许写出交付物。
const outputDupIds = duplicateXmlIds(outText);
if (outputDupIds.length > 0) {
  throw new Error('生成结果存在重复 ID（同一 ID 指向多个控件），已拒绝输出: ' + outputDupIds.join(', '));
}

if (outPath) {
  fs.writeFileSync(outPath, outText, 'utf8');
  console.log(`OK -> ${outPath}`);
} else {
  process.stdout.write(outText);
}

if (report) {
  const list = (title, arr) => {
    if (arr.length) {
      console.error(`\n${title} (${arr.length}):`);
      arr.forEach(x => console.error(`  - ${x}`));
    }
  };
  console.error('\n--- merge 报告 ---');
  list('冲突（保留现有值）', report.conflicts);
  list('设计文本覆盖（dsl.text）', report.textOverrides);
  list('语言键覆盖（LangName 跟随设计稿）', report.langOverrides);
  list('新增属性', report.added);
  list('几何/类型更新', report.updated);
  list('新增节点', report.newNodes);
  list('现有但设计稿无（原样保留：人工/外部节点，或设计稿已删除）', report.unmapped);
}
