#!/usr/bin/env node
/**
 * gen-iocontrol-xml.js —— IOContorl 页面 XML 发射器
 *
 * 两种模式：
 *   --fresh               从映射 JSON 全新渲染页面 XML
 *   --merge <现有XML>     按 merge 语义更新现有页面（当前主路径）
 *
 * 映射 JSON 输入格式（由 LLM 从 MasterGo 完整 DSL 逐节点建立，bbox 值机械抄录）：
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
 *       "layoutParent": null | "某节点 ref"（**输出父节点首选项**；null = 页面根 IOContorl 的直接子级）",
 *       "parent": null | "某节点 ref"（同 layoutParent，二选一或同时登记；未登记 layoutParent 时由它决定）",
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
 * 按钮族固定参数（IconButton / Button / StatusButton 无差别发射）：
 *   PageName / IOVisible / IOCommand / IOEnable —— 无差别恒写；映射没有可靠来源时写空字符串占位，
 *   映射提供真实值时按真实值发射（merge 时保留现有真实值）。
 *   Icon / IconWidth / IconHeight —— 属 ControlType 固定必写字段：模板含图标字段的 IconButton 恒写，
 *   有图标槽位时 IconWidth / IconHeight 机械取「图标图形节点」bbox（映射字段 iconSize，四舍五入取整），
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
 *      例外：映射节点的 valueSource=dsl.text 时，Value 是设计文本，merge 必须按 DSL 覆盖，
 *      否则 provenance 校验（Value 必须等于 sourceText）会失败。
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

// 输出父节点（XML 里真正的父容器）真值源，三处脚本共用同一优先级：
//   layoutParent → parent → DSL sourceParent（sourceNodes.parentRef）
// 与 validate-iocontrol-provenance.js、gen-mastergo-page-bundle.js 的坐标门禁一致；
// 当前 DSL→mapping 生成器把 parent / layoutParent 写成同一个值，二者不同只来自显式登记的 layoutParent。
// 唯一约束：输出父节点必须是**已发射的输出节点**（既在 mapping.nodes 的 ref 里、又在 sourceNodes 里有 bbox）
// 或页面根（null / mapping.rootRef）；指向未发射节点时 XML 无法表达该嵌套（按根级发射会与校验器重算的
// 相对坐标相反），因此这里直接失败，不静默降级。
const sourceByRef = new Map((mapping.sourceNodes || []).map(function (s) { return [s.ref, s]; }));
const nodeRefs = new Set((mapping.nodes || []).map(function (n) { return n.ref; }));
function parentRefOf(node) {
  let ref;
  let field;
  if (node.layoutParent !== undefined) { ref = node.layoutParent || null; field = 'layoutParent'; }
  else if (node.parent !== undefined) { ref = node.parent || null; field = 'parent'; }
  else {
    const src = sourceByRef.get(node.sourceRef || node.ref);
    ref = src ? (src.parentRef || null) : null;
    field = 'DSL sourceParent';
  }
  if (!ref || ref === mapping.rootRef) return null;
  if (!nodeRefs.has(ref) || !sourceByRef.has(ref)) {
    throw new Error('映射门禁失败: ' + node.ref + ' 的输出父节点（' + field + '=' + ref +
      '）不是已发射的输出节点（要求同时是 mapping.nodes 的 ref 与 sourceNodes 的记录）；' +
      '请把 layoutParent 登记为该节点的 ref，或用 null 表示页面根级');
  }
  return ref;
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
  GroupBox: ['Style', 'Header', 'LangName', 'IOEnable', 'IOVisible'],
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
  let templateMap;
  try { templateMap = JSON.parse(fs.readFileSync(mapPath, 'utf8')); }
  catch (error) { throw new Error('读取模板表失败: ' + mapPath + ' - ' + error.message); }
  const spec = templateMap.controlTypeRequiredAttrs;
  if (!spec || typeof spec !== 'object') return DEFAULT_CONTROL_TYPE_REQUIRED_ATTRS;
  const result = {};
  for (const [type, list] of Object.entries(spec)) {
    if (type.startsWith('_')) continue;
    if (Array.isArray(list)) result[type] = list.map(String);
  }
  return Object.keys(result).length ? result : DEFAULT_CONTROL_TYPE_REQUIRED_ATTRS;
}

function loadButtonFamilyRules(mapPath) {
  if (!mapPath) return DEFAULT_BUTTON_FAMILY;
  let templateMap;
  try { templateMap = JSON.parse(fs.readFileSync(mapPath, 'utf8')); }
  catch (error) { throw new Error('读取模板表失败: ' + mapPath + ' - ' + error.message); }
  const spec = templateMap.buttonFamily;
  if (!spec || typeof spec !== 'object') return DEFAULT_BUTTON_FAMILY;
  const controlTypes = Array.isArray(spec.controlTypes) && spec.controlTypes.length
    ? spec.controlTypes.map(String) : DEFAULT_BUTTON_FAMILY.controlTypes;
  const alwaysWrittenAttrs = Array.isArray(spec.alwaysWrittenAttrs)
    ? spec.alwaysWrittenAttrs.map(String) : DEFAULT_BUTTON_FAMILY.alwaysWrittenAttrs;
  const iconSizeAttrs = Array.isArray(spec.iconSizeAttrs) && spec.iconSizeAttrs.length === 2
    ? spec.iconSizeAttrs.map(String) : DEFAULT_BUTTON_FAMILY.iconSizeAttrs;
  return { controlTypes, alwaysWrittenAttrs, iconSizeAttrs };
}

function isButtonFamily(node) {
  const type = node.controlType || (node.attrs && node.attrs.ControlType);
  return BUTTON_FAMILY_CONTROL_TYPES.has(type);
}

function hasIconAttr(node) {
  const icon = node.attrs && node.attrs.Icon;
  return typeof icon === 'string' && icon.trim() !== '';
}

// 图标图形节点 bbox（映射字段 iconSize），取整后用于 IconWidth/IconHeight。
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
      ' 带 Icon 但缺少 iconSize（图标图形节点 bbox）；请重新生成 mapping，禁止猜图标尺寸');
  }
}

// 就地补齐按钮族固定参数。
function applyButtonFamilyAttrs(node, attrMap) {
  if (!isButtonFamily(node)) return;
  for (const key of BUTTON_ALWAYS_ATTRS) {
    if (attrMap[key] === undefined || attrMap[key] === null) attrMap[key] = '';
  }
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
  for (const key of required) {
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

function escAttr(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

// 属性渲染顺序（目标项目页面既有惯例）：
//   身份/类型/样式 → Icon → 文本(TopLeftContent/Value/Header) → LangName →
//   运行时字段(PageName/IO*) → 控件尺寸(Width/Height) → 图标尺寸(IconWidth/IconHeight) → 位置(Left/Top)
const ATTR_ORDER = [
  'ID', 'ControlType', 'Style', 'Icon', 'IconText', 'TopLeftContent', 'Value', 'Header', 'LangName',
  'PageName', 'IOName', 'IOCommand', 'IOVisible', 'IOEnable', 'IOParam', 'IOStyle', 'IOState', 'IOGroup',
  'UserRightId',
  'IsAutoRead', 'IsAutoWrite', 'IsAutoRefresh', 'IsWriteIO', 'IsSave',
  'IsShowDialog', 'DialogMessage', 'IsShowStatus', 'IsNeedRedMark', 'StatusBrush',
  'Foreground', 'FontSize', 'Orientation', 'ItemsSourceFile', 'DisplayMemberPath',
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
    const p = parentRefOf(n);
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

  const emit = (node, depth, parentAbsX, parentAbsY) => {
    const indent = '    '.repeat(depth);
    const attrMap = Object.assign({}, node.attrs || {});
    if (node.id) attrMap.ID = node.id;
    if (node.controlType) attrMap.ControlType = node.controlType;
    attrMap.Left = fmtNum(node.absX - parentAbsX);
    attrMap.Top = fmtNum(normalizedY(node.absY) - parentAbsY);
    if (outputWidth(node) !== undefined && outputWidth(node) !== null) attrMap.Width = fmtNum(outputWidth(node));
    if (outputHeight(node) !== undefined && outputHeight(node) !== null) attrMap.Height = fmtNum(outputHeight(node));
    applyButtonFamilyAttrs(node, attrMap);
    applyRequiredAttrs(node, attrMap);

    const kids = childMap.get(node.ref) || [];
    if (node.comment) lines.push(`${indent}<!-- ${node.comment} -->`);
    if (kids.length > 0) {
      lines.push(renderTag(attrMap, indent, indent + '    ', false, 'multi'));
      for (const k of kids) emit(k, depth + 1, node.absX, normalizedY(node.absY));
      lines.push(`${indent}</IOContorl>`);
    } else {
      lines.push(renderTag(attrMap, indent, indent + '    ', true, 'multi'));
    }
  };
  for (const n of rootChildren) emit(n, 1, 0, 0);
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

  const report = { conflicts: [], added: [], updated: [], textOverrides: [], newNodes: [], unmapped: [] };
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

  function resolveParentAbs(n) {
    const p = parentRefOf(n);
    if (p === null) return { x: 0, y: 0 };
    // parentRefOf() 已保证 p 是 mapping.nodes 的成员（absOf 的键来自同一批节点），无需再判空。
    const pn = absOf.get(p);
    return { x: pn.absX, y: pn.absY };
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
    attrMap.Left = fmtNum(n.absX - pa.x);
    attrMap.Top = fmtNum(normalizedY(n.absY) - pa.y);
    if (outputWidth(n) !== undefined && outputWidth(n) !== null) attrMap.Width = fmtNum(outputWidth(n));
    if (outputHeight(n) !== undefined && outputHeight(n) !== null) attrMap.Height = fmtNum(outputHeight(n));
    applyButtonFamilyAttrs(n, attrMap);
    applyRequiredAttrs(n, attrMap);
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
      const hit = positionCandidates.find(p =>
        !matchedOpenIdx.has(p.i) &&
        p.controlType === n.controlType &&
        Math.abs(p.left - (n.absX - pa.x)) <= 0.5 &&
        Math.abs(p.top - (normalizedY(n.absY) - pa.y)) <= 0.5);
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
    for (const [k, v] of Object.entries(attrMap)) {
      if (geometryKeys.includes(k) || k === 'ControlType' || k === 'ID') continue;
      if (finalAttrs.has(k)) {
        // dsl.text 来源的 Value 是设计文本，provenance 要求它与 sourceText 一致，必须按映射覆盖。
        const forcedByDslText = k === 'Value' && n.valueSource === 'dsl.text';
        if (forcedByDslText) {
          if (finalAttrs.get(k) !== v) {
            report.textOverrides.push(`[${n.ref}] Value: 现有 "${finalAttrs.get(k)}" -> 设计文本 "${v}"（dsl.text 强制一致）`);
          }
          finalAttrs.set(k, v);
        } else if (n.force && n.force.includes(k)) {
          if (finalAttrs.get(k) !== v) {
            report.conflicts.push(`[${n.ref}] ${k}: 现有 "${finalAttrs.get(k)}" -> 映射 "${v}"（force 强制覆盖）`);
          }
          finalAttrs.set(k, v);
        } else if (finalAttrs.get(k) !== v) {
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
    const parentRef = n ? parentRefOf(n) : null;
    const d = parentRef ? depthOfRef(parentRef) + 1 : 1;
    depthOf.set(ref, d);
    return d;
  };

  const insertions = new Map(); // closeTokenIdx -> [chunks]
  // 新增子树只以「子树根」为单位插入：输出父节点本身也是本次新增节点时，
  // 该节点已在父块的 renderSub/kids 递归里发射，不能再单独插入（否则会重复发射并被落到页面根）。
  const isNewNode = (parentRef) => {
    const parentRender = parentRef === null ? null : rendered.get(parentRef);
    return Boolean(parentRender && parentRender.tokenIdx === null);
  };
  for (const [ref, r] of rendered) {
    if (r.tokenIdx !== null) continue;
    const { n, attrMap } = r;
    if (isNewNode(parentRefOf(n))) continue;
    const pa = resolveParentAbs(n);
    const attrMap2 = Object.assign({}, attrMap);
    attrMap2.Left = fmtNum(n.absX - pa.x);
    attrMap2.Top = fmtNum(normalizedY(n.absY) - pa.y);
    const indent = '    '.repeat(depthOfRef(ref));
    const kids = nodes.filter(k => parentRefOf(k) === ref);

    const renderSub = (node, d) => {
      const pa2 = resolveParentAbs(node);
      const am = Object.assign({}, node.attrs || {});
      if (node.id) am.ID = node.id;
      if (node.controlType) am.ControlType = node.controlType;
      am.Left = fmtNum(node.absX - pa2.x);
      am.Top = fmtNum(normalizedY(node.absY) - pa2.y);
      if (outputWidth(node) !== undefined && outputWidth(node) !== null) am.Width = fmtNum(outputWidth(node));
      if (outputHeight(node) !== undefined && outputHeight(node) !== null) am.Height = fmtNum(outputHeight(node));
      applyButtonFamilyAttrs(node, am);
      applyRequiredAttrs(node, am);
      const kk = nodes.filter(x => parentRefOf(x) === node.ref);
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
    const p = parentRefOf(n);
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
      // 兜底：输出父节点是既有的、按位置匹配但无 ID 的节点，闭合标签定位不到时挂到最后一个根级闭合标签前。
      // 输出父节点本身是本次新增节点的情况不会到这里——其子节点随父块递归发射（见 isNewNode）。
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
  list('新增属性', report.added);
  list('几何/类型更新', report.updated);
  list('新增节点', report.newNodes);
  list('现有但设计稿无（原样保留）', report.unmapped);
}
