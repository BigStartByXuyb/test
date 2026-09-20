#!/usr/bin/env node
"use strict";

// Generic MasterGo DSL -> MTSLG mapping generator.
// It intentionally contains no page or instance layer IDs. Component structure
// comes from the formal template map; instance text, icon and geometry come
// from the current DSL snapshot.

const fs = require("fs");
const path = require("path");
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { readJson, normalizeToken: normalize, normalizeNewlines } = require(path.join(__dirname, "lib", "script-helpers.js"));
const { isHostShellName } = require(path.join(__dirname, "lib", "mastergo-rules.js"));
// 图标归属判据的唯一实现（见 scripts/lib/icon-ownership.js；禁止在本脚本再抄一份）。
const ICON_OWNERSHIP = require(path.join(__dirname, "lib", "icon-ownership.js"));
// 模板表规则块的解析唯一实现（见 scripts/lib/iocontrol-map-rules.js；禁止在本脚本再抄一份）。
const MAP_RULES = require(path.join(__dirname, "lib", "iocontrol-map-rules.js"));

// 槽位级多语言策略（langRefPolicy）的**唯一**登记点：值槽位（各族 slots[0]）——即该族
// 用来充当控件 Value 的那个槽位，且只允许登记在下面这些会被消费的族上。
// 两条不开放的边界（都 fail-closed，不静默放过）：
//   1) 同一族第 2 个及以后槽位、或生成分支不消费该字段的族；
//   2) **按钮族**（IconButton / Button / StatusButton）——按钮文案按语言规则一律产键挂 LangName，
//      没有槽位豁免这一说（否则右栏/主菜单这类"值槽位就是按钮"的族一登记就会静默改写按钮契约）。
const LANG_REF_POLICY_FAMILIES = new Set([
  "rightSidebarTemplates",
  "rightSidebarComponentTemplates",
  "selectBoxTemplates",
  "mainMenuTemplates",
  "inputTemplates"
]);
function valueSlotLangRefPolicy(spec) {
  const first = spec && Array.isArray(spec.slots) ? spec.slots[0] : null;
  return first && first.langRefPolicy === "none" ? "none" : undefined;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
function required(name) {
  const value = arg(name);
  if (!value) throw new Error("missing " + name);
  return value;
}
// 文本取值：同一行内的多个 text run（不同字体段）用空串拼接；换行码点统一归一成 LF
// （设计换行口径见映射表 textNewlinePolicy；发射时由 xmlAttr 写成 &#x0a;）。
function textOf(node) {
  return Array.isArray(node.text)
    ? normalizeNewlines(node.text.map(x => x.text || "").join(""))
    : undefined;
}

const dslSnapshot = readJson(required("--dsl"), "DSL snapshot");
const visibility = readJson(required("--visibility"), "visibility");
const templateMap = readJson(required("--template-map"), "template map");
// 按钮族清单的唯一真值源是映射表 buttonFamily.controlTypes（不在生成器里再抄一份名单）。
const buttonFamilyControlTypes = new Set(
  templateMap.buttonFamily && Array.isArray(templateMap.buttonFamily.controlTypes) &&
    templateMap.buttonFamily.controlTypes.length
    ? templateMap.buttonFamily.controlTypes.map(String)
    : ["IconButton", "Button", "StatusButton"]
);
// 槽位级多语言策略登记点校验：仅「值槽位（slots[0]）」且仅下面这些族会被消费，
// 其它位置的登记、以及按钮族值槽位上的登记一律 fail-closed，避免"登记了却不生效、也不报错"。
for (const [family, spec] of Object.entries(templateMap)) {
  if (!family.endsWith("Templates") || !spec || !spec.variants) continue;
  for (const [variant, entry] of Object.entries(spec.variants)) {
    const slots = entry && Array.isArray(entry.slots) ? entry.slots : [];
    slots.forEach(function (slotSpec, index) {
      if (!slotSpec || slotSpec.langRefPolicy === undefined) return;
      if (slotSpec.langRefPolicy !== "none") {
        throw new Error("映射表 " + family + "." + variant + " 槽位 " + slotSpec.slot +
          " 的 langRefPolicy 取值非法: " + slotSpec.langRefPolicy + "（目前只支持 \"none\"）");
      }
      if (!LANG_REF_POLICY_FAMILIES.has(family)) {
        throw new Error("映射表 " + family + "." + variant + " 槽位 " + slotSpec.slot +
          " 登记了 langRefPolicy，但该族的生成分支不消费该字段——请撤销登记，或先让生成器支持该族的 Value 槽位");
      }
      if (index !== 0) {
        throw new Error("映射表 " + family + "." + variant + " 在 slots[" + index + "]（" + slotSpec.slot +
          "）登记了 langRefPolicy：该字段只支持值槽位 slots[0]，其余槽位登记不会生效");
      }
      if (buttonFamilyControlTypes.has(String(slotSpec.controlType || ""))) {
        throw new Error("映射表 " + family + "." + variant + " 的值槽位 " + slotSpec.slot +
          " 控件类型是按钮族（" + slotSpec.controlType +
          "）：按钮族带文案一律产键挂 LangName，不开放槽位豁免——请撤销该登记");
      }
    });
  }
}
const iconMap = arg("--icon-map") ? readJson(arg("--icon-map"), "icon map") : { icons: [] };
// 明确隔离的组件实例：正式模板与设计结构不匹配时按 SKILL 规则只隔离该组件，
// 保留其 DSL 来源并进入 pending，不强行套用模板，也不阻塞其他已命中组件。
const excludeInstances = new Set(
  String(arg("--exclude-instances") || "")
    .split(/[,\s]+/)
    .map(value => value.trim())
    .filter(Boolean)
);
const outPath = required("--out");
const MAPPING_TAG = "新页面完整DSL映射";
const dsl = dslSnapshot.dsl;
const root = dsl.nodes[0];
const visibilityByRef = new Map((visibility.nodes || []).map(x => [x.ref, x]));
const iconEntries = Array.isArray(iconMap.icons) ? iconMap.icons : [];
const sourceNodes = [];
const nodeByRef = new Map();
const fontSizeByRef = new Map();
const fontWeightByRef = new Map();
const fontStyleNameByRef = new Map();
// 映射表登记的 TextBlock FontWeight 规则：值取设计稿的字体样式名（fontStyle），
// normal（样式名命中 normalStyleNames，或样式名缺失时 weight 命中 normalValues）不写该属性。
const fontWeightRule = templateMap.textBlockFontWeight || {};
// 表格族规则块（结构签名命中 + 列定义模板 + 行内容处置），真值来源是映射表 tableTemplates。
const tableTemplate = MAP_RULES.parseTableTemplate(templateMap);
const fontWeightAttr = typeof fontWeightRule.attr === "string" && fontWeightRule.attr ? fontWeightRule.attr : "FontWeight";
const fontWeightControlTypes = new Set(
  Array.isArray(fontWeightRule.controlTypes) && fontWeightRule.controlTypes.length
    ? fontWeightRule.controlTypes.map(String) : ["TextBlock"]
);
const fontWeightNormalValues = new Set(
  (Array.isArray(fontWeightRule.normalValues) && fontWeightRule.normalValues.length
    ? fontWeightRule.normalValues : ["", "normal", "400", "regular"]).map(function (value) {
    return String(value).trim().toLowerCase();
  })
);
// 设计稿字体样式名里的"正常体"写法（各字体族不一致：Regular / 55 Regular / 常规体 …）。
const fontStyleNormalNames = new Set(
  (Array.isArray(fontWeightRule.normalStyleNames) && fontWeightRule.normalStyleNames.length
    ? fontWeightRule.normalStyleNames
    : ["regular", "normal", "book", "标准体", "常规体", "常规"]).map(function (value) {
    return String(value).trim().toLowerCase();
  })
);
// 解析设计稿的字体样式名（styles[...].value.style）：
//   - style 是 `{"fontStyle":"75 SemiBold",...}` 这类 JSON → 取 fontStyle，去掉字体族档位数字前缀；
//   - style 本身就是裸样式名（如 "Bold"）→ 原样使用；
//   - 解析不出 fontStyle（非法 JSON / JSON 里没有 fontStyle）→ 返回 null，由调用方回退到 weight 数值。
function designFontStyleName(rawStyle) {
  if (typeof rawStyle !== "string" || !rawStyle.trim()) return null;
  const raw = rawStyle.trim();
  let name = raw;
  // 以 { 或 [ 开头一律按 JSON 处理：解析失败或没有 fontStyle 就返回 null（回退 weight），
  // 绝不把原始 JSON 文本当成字重值。
  if (/^[{[]/.test(raw)) {
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null; // look like JSON but is not parseable → 交给 weight 回退，不猜
    }
    if (!parsed || typeof parsed.fontStyle !== "string" || !parsed.fontStyle.trim()) return null;
    name = parsed.fontStyle.trim();
  }
  name = name.replace(/^\d+(?:\.\d+)?[\s\-–_]*/, "").trim();
  return name || null;
}
const parents = new Map();
const outputNodes = [];
const outputRefBySource = new Map();
const textAudit = [];
const consumedTexts = new Set();
const componentInstances = [];
const deferredValueAudits = [];
const pending = [];
// 表格（结构签名命中）的逐表审计：列定义来源、每列单元格分布、行数据登记、Value 待绑定标记。
const tableAudits = [];
let textIndex = 0;

function walk(node, parentRef, pageAbsX, pageAbsY) {
  const ls = node.layoutStyle || {};
  const rx = typeof ls.relativeX === "number" ? ls.relativeX : null;
  const ry = typeof ls.relativeY === "number" ? ls.relativeY : null;
  const x = rx === null ? null : pageAbsX + rx;
  const y = ry === null ? null : pageAbsY + ry;
  const source = {
    ref: node.id,
    parentRef: parentRef || null,
    type: node.type,
    name: node.name || "",
    componentId: node.componentId || null,
    properties: node.componentInfo?.properties || {},
    pageAbsX: x,
    pageAbsY: y,
    relativeX: rx,
    relativeY: ry,
    width: typeof ls.width === "number" ? ls.width : null,
    height: typeof ls.height === "number" ? ls.height : null
  };
  const text = textOf(node);
  if (typeof text === "string") source.text = text;
  sourceNodes.push(source);
  nodeByRef.set(node.id, { node, source });
  parents.set(node.id, parentRef || null);
  const font = Array.isArray(node.text) && node.text[0] ? node.text[0].font : null;
  const fontValue = font && dsl.styles && dsl.styles[font] ? dsl.styles[font].value : null;
  if (fontValue && typeof fontValue.size === "number") fontSizeByRef.set(node.id, fontValue.size);
  // font-weight：值取设计稿自己的字体样式名（styles[...].value.style → fontStyle，
  // 如 "Bold" / "75 SemiBold"→"SemiBold" / "55 Regular"→normal），规则见映射表 textBlockFontWeight。
  if (fontValue && fontValue.weight !== undefined && fontValue.weight !== null) {
    fontWeightByRef.set(node.id, String(fontValue.weight).trim());
  }
  if (fontValue && typeof fontValue.style === "string") {
    // 解析不出 fontStyle 时返回 null：该节点不写 fontStyleName，由 weight 回退路径决定。
    const styleName = designFontStyleName(fontValue.style);
    if (styleName) fontStyleNameByRef.set(node.id, styleName);
  }
  for (const child of node.children || []) walk(child, node.id, x === null ? pageAbsX : x, y === null ? pageAbsY : y);
}
walk(root, null, 0, 0);

function source(ref) {
  const item = nodeByRef.get(ref);
  if (!item) throw new Error("missing DSL source " + ref);
  return item.source;
}
function node(ref) { return nodeByRef.get(ref)?.node; }
function visible(ref) { return visibilityByRef.get(ref)?.effectiveVisible !== false; }
function ancestorRefs(ref) {
  const result = [];
  let current = ref;
  while (current) {
    result.push(current);
    current = parents.get(current) || null;
  }
  return result;
}
// 宿主壳判定：规则唯一实现在 lib/mastergo-rules.js；本脚本只负责按自己的祖先链取名字。
function isInHostShell(ref) {
  return ancestorRefs(ref).some(x => {
    const n = node(x);
    return isHostShellName(n && n.name);
  });
}
function isPageTitle(ref) {
  const s = source(ref);
  if (s.parentRef !== root.id) return false;
  const clean = value => String(value || "").replace(/[.。\s]/g, "");
  return clean(s.name) === clean(root.name) ||
    clean(s.text) === clean(root.name) ||
    (s.type === "TEXT" && typeof s.pageAbsY === "number" && s.pageAbsY < 192);
}
function descendants(ref) {
  const result = [];
  function visit(id) {
    for (const child of node(id)?.children || []) {
      result.push(child.id);
      visit(child.id);
    }
  }
  visit(ref);
  return result;
}
function textDescendants(ref) {
  return descendants(ref).filter(x => source(x).type === "TEXT");
}
function pathDescendants(ref) {
  return descendants(ref).filter(x => source(x).type === "PATH");
}
function directChildren(ref) { return (node(ref)?.children || []).map(x => x.id); }
function firstText(ref, predicate = () => true) {
  const match = textDescendants(ref).find(x => visible(x) && predicate(source(x))) || null;
  return match ? source(match) : null;
}
// 图标台账条目 → 按钮 的归属匹配：判据唯一实现在 lib/icon-ownership.js
// （① 树判据优先 ② 仅当无树命中才回退 id 前缀 ③ 多条命中取树最深者）。
// 本脚本只负责把 nodeByRef / parents 组装成树索引适配器。
function iconTreeIndex() {
  return {
    hasNode: ref => nodeByRef.has(ref),
    childrenOf: ref => (node(ref)?.children || []).map(child => child.id),
    parentOf: ref => parents.get(ref) || null,
    isPathNode: ref => {
      const item = nodeByRef.get(ref);
      return Boolean(item && item.source && item.source.type === "PATH");
    },
  };
}
function iconEntryCandidates(ref) {
  return ICON_OWNERSHIP.selectOwningEntries({
    index: iconTreeIndex(),
    entries: iconEntries,
    entryRef: icon => (icon ? icon.sourceRef : null),
    targetPathRefs: pathDescendants(ref),
  });
}
function iconFor(ref) {
  const match = iconEntryCandidates(ref)[0];
  return match && typeof match.name === "string" ? match.name : null;
}
function iconEntryFor(ref) {
  return iconEntryCandidates(ref)[0] || null;
}
// 台账命中条目节点 bbox：优先用图标映射的 sourceRef 节点，缺失时回退 sourceId 节点。
function iconSizeFor(ref) {
  const entry = iconEntryFor(ref);
  if (!entry) return null;
  for (const candidate of [entry.sourceRef, entry.sourceId]) {
    if (!candidate) continue;
    const item = nodeByRef.get(candidate);
    const s = item && item.source;
    if (!s) continue;
    const width = Number(s.width);
    const height = Number(s.height);
    if (Number.isFinite(width) && Number.isFinite(height)) return { width, height, sourceRef: candidate };
  }
  return null;
}
// 运行时图标（映射表登记 iconPolicy=runtime）：图标资源由目标项目提供，台账里没有条目，
// 但 IconWidth/IconHeight 仍必须来自设计稿的图标槽位——取该实例子树里的 PATH bbox。
// 多个 PATH 时尺寸来源不唯一，直接失败并要求在台账登记，禁止猜尺寸。
function runtimeIconSizeFor(ref) {
  const sizes = [];
  for (const pathRef of pathDescendants(ref)) {
    const item = nodeByRef.get(pathRef);
    const s = item && item.source;
    if (!s) continue;
    const width = Number(s.width);
    const height = Number(s.height);
    if (Number.isFinite(width) && Number.isFinite(height)) sizes.push({ width, height, sourceRef: pathRef });
  }
  if (sizes.length === 0) return null;
  if (sizes.length > 1) {
    throw new Error("运行时图标的尺寸来源不唯一（实例 " + ref + " 子树有 " + sizes.length +
      " 个 PATH）：请在页面图标台账登记该图标");
  }
  return sizes[0];
}

// 变体内部实例的组件名（= 独立组件集/组件的名称，用于右栏等族的交叉核对）。
function innerComponentName(n) {
  const child = (n && Array.isArray(n.children) ? n.children : []).find(c => c && c.type === "INSTANCE");
  return child ? String(child.name || "") : "";
}

// componentSet 索引：变体登记了 componentSet 时，允许按内部组件名直接命中。
const componentSetIndex = new Map();
for (const [family, spec] of Object.entries(templateMap)) {
  if (!family.endsWith("Templates") || !spec?.variants) continue;
  for (const [variant, entry] of Object.entries(spec.variants)) {
    const componentSet = entry && entry.componentSet;
    if (typeof componentSet !== "string" || !componentSet) continue;
    if (!componentSetIndex.has(componentSet)) componentSetIndex.set(componentSet, []);
    componentSetIndex.get(componentSet).push({ family, variant, spec: entry });
  }
}
const templateConflicts = [];

function propertyMatches(n) {
  const props = n.componentInfo?.properties || {};
  const matches = [];
  for (const [family, spec] of Object.entries(templateMap)) {
    if (!family.endsWith("Templates") || !spec?.match?.property || !spec.variants) continue;
    const value = Object.keys(props).find(key => normalize(key) === normalize(spec.match.property));
    const variant = value ? props[value] : null;
    if (variant && spec.variants[variant]) matches.push({ family, variant, spec: spec.variants[variant], properties: props, matchKind: "property" });
  }
  return matches;
}

function formalMatches(n) {
  if (!n || !["INSTANCE", "COMPONENT"].includes(n.type)) return [];
  const props = n.componentInfo?.properties || {};
  let componentSet = "";
  let byComponent = [];
  // 组件名来源：先看变体内部实例（聚合集合的变体），再看实例自身（独立组件直接放置）。
  // 容器族（childPolicy=nested-page-templates）额外要求命中实例**自身名**等于组件集名：
  // 「先看内部实例名」是给聚合集合（如右栏）用的，页面根的第一个实例子节点恰好与外层容器同名时
  // 会把整页误判成容器，因此容器族不允许走内部实例名这条候选路径。
  const candidateNames = [
    { name: innerComponentName(n), fromInner: true },
    { name: typeof n.name === "string" ? n.name : "", fromInner: false }
  ].filter(candidate => candidate.name);
  for (const candidate of candidateNames) {
    const hits = componentSetIndex.get(candidate.name);
    if (!hits || !hits.length) continue;
    const usable = hits.filter(hit => {
      const variantSpec = templateMap[hit.family]?.variants?.[hit.variant];
      const familySpec = templateMap[hit.family];
      // 只认实例自身名的族（如下面的相机视口）：禁止用"内部实例子节点名"当候选，
      // 否则页面根的第一个实例子节点是相机时，整页会被误判成 Camera。
      if (candidate.fromInner &&
          (variantSpec?.childPolicy === "nested-page-templates" || familySpec?.innerCandidatePolicy === "never")) {
        return false;
      }
      return true;
    });
    if (!usable.length) continue;
    componentSet = candidate.name;
    byComponent = usable;
    break;
  }
  if (byComponent.length > 0) {
    // 同一组件名可能同时登记在“聚合变体族”和“独立组件族”：
    // 实例带该族的公开属性（如 按钮类型）时按聚合族，否则按独立组件族。
    const propertyFamilies = byComponent.filter(h => {
      const spec = templateMap[h.family];
      const matchProperty = spec && spec.match && spec.match.property;
      return matchProperty && Object.keys(props).some(key => normalize(key) === normalize(matchProperty));
    });
    const componentOnlyFamilies = byComponent.filter(h => templateMap[h.family]?.match?.componentSet === true);
    if (propertyFamilies.length > 0) byComponent = propertyFamilies;
    else if (componentOnlyFamilies.length > 0) byComponent = componentOnlyFamilies;
  }
  const byProperty = propertyMatches(n);
  if (byComponent.length > 0) {
    const chosen = byComponent[0];
    if (byProperty.length > 0 &&
        !byProperty.some(m => m.family === chosen.family && m.variant === chosen.variant)) {
      templateConflicts.push({
        ref: n.id,
        name: n.name || null,
        componentSet,
        propertyMatch: byProperty.map(m => `${m.family}#${m.variant}`).join(", "),
        componentSetMatch: byComponent.map(m => `${m.family}#${m.variant}`).join(", "),
        reason: "内部组件名与公开属性值指向不同模板，按内部组件名（componentSet）执行"
      });
    }
    return byComponent.map(m => ({
      family: m.family, variant: m.variant, spec: m.spec,
      properties: props, matchKind: "componentSet", componentSet
    }));
  }
  return byProperty;
}
// ---------- 表格族：结构签名命中 ----------
// 表格在团队组件库里没有组件集，设计稿里只是一个 GROUP，因此按「结构签名 + 图层名后缀」命中：
// 节点类型 ∈ nodeTypes + 图层名以 nameSuffix 结尾 + 孩子里含表头群组 + ≥minRows 个行群组
// + 表头至少有 minHeaderTexts 条可见文本。签名与名字必须同时成立——只成立一半时登记 pending，
// 既不静默套模板，也不静默按平铺发射。
function tableStructuralStatus(n) {
  const structural = tableTemplate && tableTemplate.structural;
  if (!structural || !n) return null;
  if (!structural.nodeTypes.includes(String(n.type || ""))) return null;
  const children = Array.isArray(n.children) ? n.children : [];
  const header = children.find(c => c && structural.headerGroupNames.includes(String(c.name || "")));
  const rows = children.filter(c => c && structural.rowGroupNames.includes(String(c.name || "")));
  const headerTextCount = header ? textDescendants(header.id).filter(visible).length : 0;
  const nameOk = !structural.nameSuffix || String(n.name || "").endsWith(structural.nameSuffix);
  const signatureOk = Boolean(header) && rows.length >= structural.minRows &&
    headerTextCount >= structural.minHeaderTexts;
  if (!nameOk && !signatureOk) return null; // 与表格无关的普通 GROUP，不参与本族判定
  return {
    nameOk,
    signatureOk,
    headerRef: header ? header.id : null,
    rowRefs: rows.map(row => row.id)
  };
}

function structuralTableMatches(n) {
  const status = tableStructuralStatus(n);
  if (!status) return [];
  if (!status.nameOk || !status.signatureOk) {
    pending.push({
      sourceRef: n.id,
      reason: "表格结构签名与图层名没有同时成立，未按 Table 模板发射（保留 DSL 来源待确认）: " +
        "图层名" + (status.nameOk ? "以「" + tableTemplate.structural.nameSuffix + "」结尾" : "不以「" +
          tableTemplate.structural.nameSuffix + "」结尾") +
        "，结构签名" + (status.signatureOk ? "成立" : "不成立（缺表头群组、缺行群组，或表头没有可见文本）")
    });
    return [];
  }
  const spec = tableTemplate.variants[tableTemplate.structural.variant];
  return [{
    family: "tableTemplates",
    variant: tableTemplate.structural.variant,
    spec,
    properties: {},
    matchKind: "structural",
    signature: { headerRef: status.headerRef, rowRefs: status.rowRefs }
  }];
}

// 值块里的「最上层叶子」：遇到 INSTANCE / TEXT 就收下且不再下钻（输入框内部的固定文本属于该单元格，
// 不能当成第二个单元格）；LAYER / PATH 等绘制节点直接跳过；只有容器类才继续下钻。
function cellLeaves(ref) {
  const result = [];
  for (const child of node(ref)?.children || []) {
    const s = source(child.id);
    if (s.type === "INSTANCE" || s.type === "TEXT") {
      if (visible(child.id)) result.push(s);
      continue;
    }
    if (s.type === "GROUP" || s.type === "FRAME" || s.type === "COMPONENT") {
      result.push(...cellLeaves(child.id));
    }
  }
  return result;
}

// 单元格归类：输入框实例取它命中的正式模板 ControlType；纯文本取 TextBlock；其余记 null（不参与多数判定）。
function cellControlType(s) {
  if (s.type === "TEXT") return "TextBlock";
  if (s.type !== "INSTANCE" && s.type !== "COMPONENT") return null;
  const matches = formalMatches(node(s.ref));
  return matches.length ? (matches[0].spec.controlType || null) : null;
}

function nearestColumnIndex(centres, x) {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < centres.length; i++) {
    const distance = Math.abs(centres[i] - x);
    if (distance < bestDistance) { bestDistance = distance; best = i; }
  }
  return best;
}

function outerGroups(ref, minWidth = 55, minHeight = 40) {
  const candidates = descendants(ref).filter(id => {
    const s = source(id);
    return s.type === "GROUP" && Number(s.width) >= minWidth && Number(s.height) >= minHeight;
  });
  return candidates.filter(id => !candidates.some(parent => parent !== id && ancestorRefs(id).includes(parent))).map(id => source(id));
}
// 槽位声明 position 时，按几何位置把按钮组绑到槽位：以候选按钮组整体包围盒的中心为基准，
// 主轴方向决定 up/down/left/right，到中心的距离决定 inner（近）/outer（远）。
// 未声明 position 的模板沿用既有行为：按设计稿层级顺序取前 N 个。
function selectButtonGroups(buttonGroups, buttonSlots, variant) {
  const positioned = buttonSlots.filter(item => typeof item.position === "string" && item.position);
  if (positioned.length === 0) return buttonGroups.slice(0, buttonSlots.length);
  if (positioned.length !== buttonSlots.length) {
    throw new Error("固定模板槽位混用了 position 与无 position 声明: " + variant);
  }
  const items = buttonGroups.map(item => item.ref ? item : source(item));
  const minX = Math.min(...items.map(item => item.pageAbsX));
  const maxX = Math.max(...items.map(item => item.pageAbsX + item.width));
  const minY = Math.min(...items.map(item => item.pageAbsY));
  const maxY = Math.max(...items.map(item => item.pageAbsY + item.height));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const labelled = items.map(item => {
    const dx = item.pageAbsX + item.width / 2 - cx;
    const dy = item.pageAbsY + item.height / 2 - cy;
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
    return { item, dir, distance: Math.sqrt(dx * dx + dy * dy) };
  });
  const used = new Set();
  return buttonSlots.map(slotSpec => {
    const parts = String(slotSpec.position).split("_");
    const candidates = labelled
      .filter(candidate => candidate.dir === parts[0] && !used.has(candidate.item.ref))
      .sort((a, b) => a.distance - b.distance);
    if (candidates.length === 0) {
      throw new Error("固定模板槽位找不到对应位置的按钮组: " + variant + "/" + slotSpec.slot);
    }
    const picked = (parts[1] || "inner") === "outer" ? candidates[candidates.length - 1] : candidates[0];
    used.add(picked.item.ref);
    return picked.item;
  });
}
function firstInner(ref) {
  return directChildren(ref).map(x => source(x)).find(s => s.type === "INSTANCE")?.ref || ref;
}
function addNode(sourceRef, controlType, attrs, options = {}) {
  const s = source(sourceRef);
  const valueSourceRef = options.valueSourceRef || null;
  const valueSource = valueSourceRef ? source(valueSourceRef) : s;
  const sourceSlotTexts = Object.assign({}, options.sourceSlotTexts || {});
  if (valueSourceRef && typeof valueSource.text === "string") sourceSlotTexts[valueSourceRef] = valueSource.text;
  if (![s.pageAbsX, s.pageAbsY, s.width, s.height].every(v => typeof v === "number" && Number.isFinite(v))) throw new Error("incomplete bbox " + sourceRef);
  if (outputRefBySource.has(sourceRef)) return outputRefBySource.get(sourceRef);
  const xmlId = options.xmlId || `MG_${String(outputNodes.length + 1).padStart(4, "0")}`;
  const parentRef = options.layoutParent || null;
  const parentSource = parentRef ? source(parentRef) : null;
  // 几何覆盖：登记在映射表模板里的固定几何（目前只有 DataGrid 的列定义节点走这条路）。
  // 覆盖值必须来自映射表（tableTemplates.columnTemplate），节点的真实 DSL bbox 仍按 dsl* 字段保留溯源。
  const geometry = options.geometryOverride || null;
  const expectedLeft = geometry ? Number(geometry.left)
    : s.pageAbsX - (parentSource ? parentSource.pageAbsX : 0);
  const expectedTop = geometry ? Number(geometry.top)
    : s.pageAbsY - (parentSource ? parentSource.pageAbsY : 0) - (parentSource ? 0 : 192);
  const out = {
    ref: sourceRef,
    sourceRef,
    sourceParent: s.parentRef,
    sourceText: typeof valueSource.text === "string" ? valueSource.text : undefined,
    valueSource: typeof valueSource.text === "string" ? "dsl.text" : undefined,
    valueSourceRef: valueSourceRef || undefined,
    sourceSlotRefs: Array.isArray(options.sourceSlotRefs) ? options.sourceSlotRefs : undefined,
    sourceSlotTexts: Object.keys(sourceSlotTexts).length ? sourceSlotTexts : undefined,
    controlType,
    parent: parentRef,
    layoutParent: parentRef,
    absX: s.pageAbsX,
    absY: s.pageAbsY,
    w: s.width,
    h: s.height,
    expectedLeft,
    expectedTop,
    expectedWidth: geometry ? "NaN" : (controlType === "TextBlock" ? "NaN" : s.width),
    expectedHeight: geometry ? Number(geometry.height) : (controlType === "TextBlock" ? 40 : s.height),
    widthSource: geometry ? "table.column-template"
      : (controlType === "TextBlock" ? "mtslg.textblock.fixed-nan" : "dsl.bbox"),
    heightSource: geometry ? "table.column-template"
      : (controlType === "TextBlock" ? "mtslg.textblock.fixed-40" : "dsl.bbox"),
    ...(controlType === "TextBlock" ? { dslWidth: s.width } : {}),
    ...(geometry ? {
      nodeKind: options.nodeKind || "table-column",
      geometrySource: "table.column-template",
      omitWidth: geometry.omitWidth !== false,
      dslLeft: s.pageAbsX - (parentSource ? parentSource.pageAbsX : 0),
      dslTop: s.pageAbsY - (parentSource ? parentSource.pageAbsY : 0) - (parentSource ? 0 : 192),
      dslWidth: s.width,
      dslHeight: s.height
    } : {}),
    id: xmlId,
    xmlId,
    attrs: Object.assign({}, attrs),
    ...(options.iconSize ? { iconSize: options.iconSize } : {}),
    // 槽位级多语言策略：langRefPolicy=none 表示该值不参与多语言（不产语言键、不挂 LangName）。
    ...(options.langRefPolicy ? { langRefPolicy: options.langRefPolicy } : {}),
    // 容器类节点：内容区原点（边框 + 标题条高）。重挂子控件时必须按它换算相对坐标。
    ...(options.contentInset ? { contentInset: options.contentInset } : {})
  };
  outputNodes.push(out);
  outputRefBySource.set(sourceRef, xmlId);
  return xmlId;
}
function addText(ref) {
  if (consumedTexts.has(ref) || !visible(ref) || isInHostShell(ref) || isPageTitle(ref)) return outputRefBySource.get(ref) || null;
  consumedTexts.add(ref);
  const s = source(ref);
  const attrs = { Value: s.text };
  const size = fontSizeByRef.get(ref);
  if (typeof size === "number") attrs.FontSize = String(size);
  // FontWeight 的值取设计稿的字体样式名（"Bold" / "SemiBold" …）；样式名缺失时才回退到 weight 数值。
  // 样式名或数值属于 normal（Regular / 常规体 / 400 / normal）时不写该属性。
  const styleName = fontStyleNameByRef.get(ref);
  const weight = fontWeightByRef.get(ref);
  if (styleName !== undefined && !fontStyleNormalNames.has(styleName.toLowerCase())) {
    attrs[fontWeightAttr] = styleName;
  } else if (styleName === undefined && weight !== undefined && !fontWeightNormalValues.has(weight.toLowerCase())) {
    attrs[fontWeightAttr] = weight;
  }
  const xmlId = addNode(ref, "TextBlock", attrs, { xmlId: `MGText_${String(textAudit.length + 1).padStart(4, "0")}` });
  textAudit.push({ sourceRef: ref, sourceText: s.text, visibility: true, role: "content", decision: "emit", outputRefs: [xmlId] });
  return xmlId;
}
function addValueAudit(textRef, ownerRef) {
  if (!textRef || consumedTexts.has(textRef)) return;
  consumedTexts.add(textRef);
  const s = source(textRef);
  textAudit.push({ sourceRef: textRef, sourceText: s.text, visibility: true, role: "component-value", decision: "emit", outputRefs: [outputRefBySource.get(ownerRef)] });
}
function slot(name, ref, valueSourceRef) { return Object.assign({ slot: name, sourceRef: ref }, valueSourceRef ? { valueSourceRef } : {}); }
function addInstance(match, instanceRef, requiredSlots, omittedSlots = []) {
  const properties = Object.assign({}, match.properties || source(instanceRef).properties);
  // 组件名用于右栏等族的交叉核对；图层重命名不影响 componentSet 的登记值。
  const componentSet = match.componentSet || innerComponentName(node(instanceRef)) || undefined;
  componentInstances.push({
    template: match.family,
    instanceRef,
    properties,
    ...(componentSet ? { componentSet } : {}),
    requiredSlots,
    ...(omittedSlots.length ? { omittedSlots } : {})
  });
}

// ---------- 表格（结构签名命中的 GROUP）→ DataGrid + 表头派生的列定义 ----------
// 设计口径（真值来源：映射表 tableTemplates）：
//   列定义 = 表头群组里的可见文本，从左到右；列节点几何与属性按 columnTemplate 固定发射；
//   行是数据不是控件：行内文本一律消费 + 以 innerTextPolicy.role 记 omit，行内容写进 tableAudits；
//   根节点 Value 指向 PageData 数据文件，设计稿没有来源 → 空串占位 + valuePending 标记。
function emitTable(inst, spec, match, columnTemplate) {
  const tableRef = inst.ref;
  const headerTexts = textDescendants(match.signature.headerRef)
    .filter(visible)
    .map(ref => source(ref))
    .sort((a, b) => (a.pageAbsX - b.pageAbsX) || (a.pageAbsY - b.pageAbsY));
  if (!headerTexts.length) throw new Error("表格结构签名命中但表头没有可见文本，列定义无处取值: " + tableRef);
  for (const text of headerTexts) {
    if (typeof text.text !== "string") throw new Error("表格列标题缺少 DSL 文本: " + text.ref);
  }
  const centres = headerTexts.map(t => t.pageAbsX + (Number(t.width) || 0) / 2);
  const bandLeft = Math.min(...headerTexts.map(t => t.pageAbsX));
  const bandRight = Math.max(...headerTexts.map(t => t.pageAbsX + (Number(t.width) || 0)));
  const cellKindsByColumn = headerTexts.map(() => []);

  // 每行：值块 = 与表头列带在 x 上重叠的直接子群组；单元格 = 值块里的最上层叶子。
  // 行内的直接文本（左标题 / 单位）按 x 从左到右登记为 left / right，不做语义猜测。
  const rows = [];
  for (const rowRef of match.signature.rowRefs) {
    const labels = [];
    const cells = [];
    for (const child of node(rowRef)?.children || []) {
      const s = source(child.id);
      if (s.type === "TEXT") {
        if (visible(child.id)) {
          labels.push({ ref: s.ref, name: s.name, text: s.text, pageAbsX: s.pageAbsX, pageAbsY: s.pageAbsY });
        }
        continue;
      }
      if (s.type !== "GROUP" && s.type !== "FRAME") continue;
      const right = s.pageAbsX + (Number(s.width) || 0);
      if (!(s.pageAbsX < bandRight && right > bandLeft)) continue;
      for (const leaf of cellLeaves(child.id)) {
        const controlType = cellControlType(leaf);
        const column = nearestColumnIndex(centres, leaf.pageAbsX + (Number(leaf.width) || 0) / 2);
        if (column >= 0 && controlType) cellKindsByColumn[column].push(controlType);
        cells.push({
          ref: leaf.ref,
          name: leaf.name,
          type: leaf.type,
          column,
          controlType,
          ...(typeof leaf.text === "string" ? { text: leaf.text } : {}),
          pageAbsX: leaf.pageAbsX,
          pageAbsY: leaf.pageAbsY
        });
      }
    }
    labels.sort((a, b) => (a.pageAbsX - b.pageAbsX) || (a.pageAbsY - b.pageAbsY));
    rows.push({
      ref: rowRef,
      name: source(rowRef).name,
      labels: labels.map((label, index) => Object.assign({}, label, {
        position: labels.length > 1 ? (index === 0 ? "left" : "right") : "only"
      })),
      cells
    });
  }

  // 列 ControlType：严格多数（> 50%）胜出，没有严格多数退化为 TextBlock（口径同映射表 columnControlTypePolicy）。
  const columnControlTypes = cellKindsByColumn.map(kinds => {
    const counts = new Map();
    for (const kind of kinds) counts.set(kind, (counts.get(kind) || 0) + 1);
    let best = null;
    let bestCount = 0;
    let tie = false;
    for (const [kind, count] of counts) {
      if (count > bestCount) { best = kind; bestCount = count; tie = false; }
      else if (count === bestCount) tie = true;
    }
    return best && !tie && bestCount * 2 > kinds.length ? best : "TextBlock";
  });

  const valuePolicy = tableTemplate.valuePolicy || {};
  const tableAttrs = {};
  if (typeof valuePolicy.attr === "string" && valuePolicy.attr) tableAttrs[valuePolicy.attr] = "";
  const tableXmlId = addNode(tableRef, spec.controlType, tableAttrs);

  const columns = headerTexts.map((text, index) => {
    const columnAttrs = { Value: text.text };
    for (const attr of columnTemplate.alwaysWrittenAttrs) columnAttrs[attr] = "";
    const xmlId = addNode(text.ref, columnControlTypes[index], columnAttrs, {
      layoutParent: tableRef,
      xmlId: `MGCol_${String(index + 1).padStart(4, "0")}`,
      valueSourceRef: text.ref,
      nodeKind: "table-column",
      geometryOverride: {
        left: columnTemplate.left,
        top: columnTemplate.top,
        height: columnTemplate.height,
        omitWidth: columnTemplate.omitWidth
      }
    });
    addValueAudit(text.ref, text.ref);
    return {
      ref: text.ref,
      xmlId,
      text: text.text,
      controlType: columnControlTypes[index],
      pageAbsX: text.pageAbsX,
      cellKinds: cellKindsByColumn[index]
    };
  });

  // 表格内其余文本：行标题 / 单位 / 单元格文本（含输入框实例内部的固定文本）一律 consume + omit。
  const innerPolicy = tableTemplate.innerTextPolicy || {};
  if (innerPolicy.decision !== "omit") {
    throw new Error("tableTemplates.innerTextPolicy.decision 必须是 omit：表格内的行数据文本不发射成控件");
  }
  for (const ref of descendants(tableRef)) {
    const s = source(ref);
    if (s.type !== "TEXT" || consumedTexts.has(ref)) continue;
    consumedTexts.add(ref);
    textAudit.push({
      sourceRef: ref,
      sourceText: s.text,
      visibility: visible(ref),
      role: innerPolicy.role,
      decision: "omit",
      omitReason: innerPolicy.role,
      outputRefs: []
    });
  }

  // 表格 bbox 与自身内容的实际范围：GROUP 的声明尺寸在设计稿里可能没跟上行数（内容溢出），
  // 这里把两个数都登记下来——节点几何仍按设计稿 bbox 直传，缺陷交由设计侧修正。
  const contentRefs = descendants(tableRef).map(ref => source(ref))
    .filter(s => Number.isFinite(s.pageAbsX) && Number.isFinite(s.pageAbsY));
  const declared = source(tableRef);
  const contentBox = contentRefs.length ? {
    left: Math.min(...contentRefs.map(s => s.pageAbsX)),
    top: Math.min(...contentRefs.map(s => s.pageAbsY)),
    right: Math.max(...contentRefs.map(s => s.pageAbsX + (Number(s.width) || 0))),
    bottom: Math.max(...contentRefs.map(s => s.pageAbsY + (Number(s.height) || 0)))
  } : null;
  const declaredBox = {
    left: declared.pageAbsX,
    top: declared.pageAbsY,
    right: declared.pageAbsX + (Number(declared.width) || 0),
    bottom: declared.pageAbsY + (Number(declared.height) || 0)
  };
  const boxCoversContent = Boolean(contentBox) &&
    contentBox.left >= declaredBox.left - 0.5 && contentBox.top >= declaredBox.top - 0.5 &&
    contentBox.right <= declaredBox.right + 0.5 && contentBox.bottom <= declaredBox.bottom + 0.5;

  tableAudits.push({
    ref: tableRef,
    name: declared.name,
    xmlId: tableXmlId,
    controlType: spec.controlType,
    valueAttr: valuePolicy.attr || "Value",
    valueDecision: valuePolicy.decision || null,
    valuePending: true,
    columnControlTypePolicy: tableTemplate.columnControlTypePolicy || null,
    columns,
    rows,
    geometry: { declared: declaredBox, content: contentBox, declaredBoxCoversContent: boxCoversContent }
  });
  if (!boxCoversContent) {
    console.error("表格 bbox 提醒: [" + tableRef + "] 图层声明尺寸 " +
      (declaredBox.right - declaredBox.left) + "×" + (declaredBox.bottom - declaredBox.top) +
      " 覆盖不了自身内容范围（实际到 y=" + (contentBox ? contentBox.bottom : "?") +
      "）；节点几何仍按设计稿 bbox 发射，请在设计稿里修正表格尺寸。");
  }
}

const matched = [];
for (const item of sourceNodes) {
  const matches = formalMatches(node(item.ref)).concat(structuralTableMatches(node(item.ref)));
  if (!matches.length) continue;
  if (excludeInstances.has(item.ref)) {
    pending.push({
      sourceRef: item.ref,
      reason: "已隔离（--exclude-instances）：正式模板与设计结构不匹配，保留 DSL 来源待确认"
    });
    continue;
  }
  // 隔离必须覆盖整个组件子树，否则内部实例会以另一个模板族命中并继续发射。
  if (ancestorRefs(item.ref).slice(1).some(ref => excludeInstances.has(ref))) continue;
  matched.push({ item, match: matches[0] });
}
const matchedRefSet = new Set(matched.map(x => x.item.ref));
const topLevelMatches = matched.filter(x => !ancestorRefs(x.item.ref).slice(1).some(ref => matchedRefSet.has(ref)));
matched.length = 0;
matched.push(...topLevelMatches);
const matchedRefs = new Set(matched.map(x => x.item.ref));

for (const { item: inst, match } of matched) {
  const variant = match.variant;
  const spec = match.spec;
  if (match.family === "tableTemplates") {
    // 表格（结构签名命中的 GROUP）→ DataGrid + 表头派生的列定义；行按数据登记，不发射控件。
    const columnTemplate = tableTemplate && tableTemplate.columnTemplate;
    if (!columnTemplate || !match.signature) {
      // 表格族只登记结构签名一条命中路径（映射表里没有 match.property / componentSet），
      // 因此走到这里只可能是结构签名或列模板缺失，报错必须点名真因，不能让人去查已经存在的登记项。
      throw new Error("表格族命中缺少" +
        (!match.signature ? "结构签名（match.signature）" : "") +
        (!match.signature && !columnTemplate ? " 与 " : "") +
        (!columnTemplate ? "列定义模板（tableTemplates.columnTemplate）" : "") +
        ": " + inst.ref +
        "；结构签名由 structuralTableMatches 产出（命中路径只有这一条，本族不登记 match.property / componentSet）");
    }
    emitTable(inst, spec, match, columnTemplate);
    // 变体值来自结构签名（顶点是 GROUP，没有公开属性），resolver 按 instance.variant 解析。
    componentInstances.push({
      template: "tableTemplates",
      variant,
      instanceRef: inst.ref,
      properties: {},
      requiredSlots: [slot("table", inst.ref)]
    });
    continue;
  }
  if (match.family === "cameraTemplates") {
    // 相机视口是**一个整体**：内部绘制内容（网格、坐标、通道名、JOG mode 等）完全不管，
    // 只发射外层的 Camera 控件（DesignPanelID / Value 空串占位 + Width/Height 取实例 bbox），
    // **不写 Style**——用运行时默认控件外观（映射表 cameraTemplates.stylePolicy 固定为 none）。
    const cameraSpec = templateMap.cameraTemplates;
    if (cameraSpec.stylePolicy !== "none") {
      throw new Error("cameraTemplates.stylePolicy 必须是 none：相机视口用运行时默认控件外观，不发射 Style");
    }
    const attrs = {};
    for (const attr of cameraSpec.alwaysWrittenAttrs) attrs[attr] = "";
    addNode(inst.ref, spec.controlType, attrs);
    addInstance(match, inst.ref, []);
    // 内部 TEXT 显式 consume + omit：既不发射成页面 TextBlock，也不让它们漏进通用文本循环。
    const innerPolicy = cameraSpec.innerTextPolicy;
    if (innerPolicy.decision !== "omit") {
      throw new Error("cameraTemplates.innerTextPolicy.decision 必须是 omit：相机视口内部文本不发射、不走通用文本循环");
    }
    for (const ref of descendants(inst.ref)) {
      const s = source(ref);
      if (s.type !== "TEXT" || consumedTexts.has(ref)) continue;
      consumedTexts.add(ref);
      textAudit.push({
        sourceRef: ref,
        sourceText: s.text,
        visibility: visible(ref),
        role: innerPolicy.role,
        decision: innerPolicy.decision,
        omitReason: innerPolicy.role,
        outputRefs: []
      });
    }
    continue;
  }
  if (match.family === "rightSidebarTemplates" || match.family === "rightSidebarComponentTemplates" ||
      match.family === "selectBoxTemplates" || match.family === "mainMenuTemplates") {
    const valueText = firstText(inst.ref, s => !/^F\d+$/.test(s.text));
    const attrs = {};
    if (spec.style) attrs.Style = spec.style;
    if (valueText) attrs.Value = valueText.text;
    // 运行时图标：Icon 名由映射表登记（目标项目已有的资源键），台账里没有条目；
    // 其余情况仍从台账取图标名。两者都要求 IconWidth/IconHeight 来自设计稿 bbox。
    const runtimeIcon = spec.iconPolicy === "runtime" ? spec.runtimeIcon : null;
    const icon = runtimeIcon || (spec.iconPolicy !== "none" ? iconFor(inst.ref) : null);
    if (icon) attrs.Icon = icon;
    const iconSize = runtimeIcon ? runtimeIconSizeFor(inst.ref) : (icon ? iconSizeFor(inst.ref) : null);
    const fText = firstText(inst.ref, s => /^F\d+$/.test(s.text));
    if (fText && inst.properties["显示F"] !== false) attrs.TopLeftContent = fText.text;
    const sourceSlotRefs = [valueText?.ref, fText?.ref].filter(Boolean);
    // 值槽位登记 langRefPolicy=none 时（当前是选择框的「默认选中的名称」）：该值运行时由 IOName 数据决定，
    // 不是要翻译的固定文案 → 标记为不参与多语言，后续不产键、不挂 LangName。
    const langRefPolicy = valueSlotLangRefPolicy(spec);
    const owner = addNode(inst.ref, spec.controlType, attrs, {
      ...(valueText ? { valueSourceRef: valueText.ref } : {}),
      ...(iconSize ? { iconSize } : {}),
      ...(langRefPolicy ? { langRefPolicy } : {}),
      sourceSlotRefs,
      sourceSlotTexts: Object.fromEntries([valueText, fText].filter(Boolean).map(text => [text.ref, text.text]))
    });
    if (valueText) addValueAudit(valueText.ref, inst.ref);
    if (fText && attrs.TopLeftContent) addValueAudit(fText.ref, inst.ref);
    addInstance({ family: match.family, componentSet: match.componentSet }, inst.ref, [slot(spec.slots[0]?.slot || "button", inst.ref)]);
    continue;
  }
  if (match.family === "inputTemplates") {
    const valueText = firstText(inst.ref);
    const attrs = valueText ? { Value: valueText.text } : {};
    const langRefPolicy = valueSlotLangRefPolicy(spec);
    addNode(inst.ref, spec.controlType, attrs, Object.assign(
      valueText ? { valueSourceRef: valueText.ref } : {},
      langRefPolicy ? { langRefPolicy } : {}
    ));
    if (valueText) addValueAudit(valueText.ref, inst.ref);
    addInstance(match, inst.ref, [slot("input", inst.ref, valueText?.ref)]);
    continue;
  }
  if (match.family === "selectionTemplates") {
    // Selection components are icon/vector-only in this design and have no
    // TEXT child. Register the formal choice slot without inventing a Value.
    // The resolver validates the component slot while the XML keeps runtime
    // state/value attributes empty until a real binding is confirmed.
    const attrs = {};
    addNode(inst.ref, spec.controlType, attrs);
    addInstance(match, inst.ref, [slot("choice", inst.ref)]);
    continue;
  }
  if (match.family === "infoGroupTemplates") {
    // 容器类组件（信息分组 / 弹层）：发射一个 GroupBox 外壳，Header 取实例内第一条可见 TEXT。
    // 该 TEXT 作为槽位被消费（不再作为独立 TextBlock，也不进入「未映射组件内部文本」隔离）；
    // 壳内子控件由 apply-container-containment.js 按坐标完全包含关系重挂（childPolicy=nested-page-templates）。
    const headerText = firstText(inst.ref);
    // Style 发射值与"内容区原点查表键"是两个字段：
    //   spec.style             —— 发射到 XML 的 Style 值。当前项目框架口径：GroupBox 的 Style 恒为空串。
    //   spec.contentInsetStyle —— 只用于查 styleInsets 的内部键，不发射。
    // 子控件的相对坐标原点必须能机械换算，因此这里仍 fail-closed：contentInsetStyle 未登记对应
    // styleInsets 时直接报错，不猜原点。
    const styleInsets = templateMap.infoGroupTemplates?.styleInsets || {};
    // 只认 contentInsetStyle：不再保留"用已废弃的非空 style 当查表键"的回退路径——
    // 那条回退会让按旧口径登记的变体静默通过，并使文档承诺的 fail-closed 门禁失效。
    const insetStyle = spec.contentInsetStyle;
    const contentInset = insetStyle ? styleInsets[insetStyle] : null;
    if (!contentInset) {
      throw new Error("容器变体缺少可换算的内容区原点: template=" + match.family +
        " componentSet=" + (match.componentSet || spec.componentSet || "") +
        " contentInsetStyle=" + JSON.stringify(insetStyle ?? null) +
        "；请在映射表 infoGroupTemplates.styleInsets 登记该内容区原点键（内容区边框 + 标题条高）");
    }
    const attrs = {};
    // Style 是 GroupBox 的必写字段：按变体登记原样发射（当前为空串，由框架落默认样式）。
    attrs.Style = spec.style === undefined || spec.style === null ? "" : spec.style;
    if (headerText) attrs.Header = headerText.text;
    addNode(inst.ref, spec.controlType || "GroupBox", attrs,
      headerText ? { valueSourceRef: headerText.ref, contentInset: contentInset }
        : { contentInset: contentInset });
    if (headerText) addValueAudit(headerText.ref, inst.ref);
    // 槽位 sourceRef 必须是**已发射的输出节点**（= GroupBox 自己，实例 ref），
    // 标题文本作为 valueSourceRef 被消费（与 inputTemplates 的 slot 写法一致）。
    addInstance(match, inst.ref, [slot("header", inst.ref, headerText ? headerText.ref : undefined)]);
    continue;
  }
  const innerRef = firstInner(inst.ref);
  const groupMinWidth = Number.isFinite(Number(spec.groupMinWidth))
    ? Number(spec.groupMinWidth)
    : (variant.startsWith("加减") ? 55 : 70);
  const groupMinHeight = Number.isFinite(Number(spec.groupMinHeight)) ? Number(spec.groupMinHeight) : 40;
  const buttonGroups = outerGroups(innerRef, groupMinWidth, groupMinHeight);
  if (variant.startsWith("加减")) {
    const slots = spec.slots || [];
    const buttonSlots = slots.filter(s => s.controlType === "IconButton");
    const orderedButtons = buttonGroups.slice(0, buttonSlots.length);
    const required = [];
    for (let i = 0; i < orderedButtons.length; i++) {
      const group = orderedButtons[i].ref;
      const text = firstText(group);
      const attrs = { Style: "SmallButton" };
      if (text) attrs.Value = text.text;
      addNode(group, "IconButton", attrs, text ? { valueSourceRef: text.ref } : {});
      if (text) addValueAudit(text.ref, group);
      required.push(slot(buttonSlots[i].slot, group, text?.ref));
    }
    // The title/value texts may be siblings of the button container rather
    // than children of innerRef. Traverse the whole formal component and
    // remove only text descendants belonging to the emitted button groups.
    const groupText = textDescendants(inst.ref).filter(x => !orderedButtons.some(b => ancestorRefs(x).includes(b.ref)));
    const textSlots = slots.filter(s => s.controlType === "TextBlock");
    const hasTitleSlot = textSlots.some(s => s.slot === "title");
    const titleRef = hasTitleSlot && groupText[0] && source(groupText[0]).text ? groupText[0] : null;
    const valueTexts = groupText.filter(x => x !== titleRef);
    const omitted = [];
    let textIndexLocal = 0;
    for (const textSlot of textSlots) {
      const candidate = textSlot.slot === "title" ? titleRef : valueTexts[textIndexLocal++];
      if (candidate && visible(candidate)) {
        addText(candidate);
        required.push(slot(textSlot.slot, candidate, candidate));
      } else if (candidate) {
        omitted.push({ slot: textSlot.slot, sourceRef: candidate, valueSourceRef: candidate, omitReason: "hidden" });
      }
    }
    addInstance(match, inst.ref, required, omitted);
    continue;
  }
  const buttonSlots = (spec.slots || []).filter(s => s.controlType === "IconButton");
  const textSlots = (spec.slots || []).filter(s => s.controlType === "TextBlock");
  const groups = selectButtonGroups(buttonGroups, buttonSlots, variant);
  const required = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i].ref;
    const icon = iconFor(group);
    const iconSize = icon ? iconSizeFor(group) : null;
    const attrs = icon ? { Icon: icon } : {};
    addNode(group, "IconButton", attrs, iconSize ? { iconSize } : {});
    required.push(slot(buttonSlots[i].slot, group));
  }
  for (const textSlot of textSlots) {
    const text = firstText(inst.ref, s => s.text === "SCAN" || s.name === textSlot.slot);
    if (text) { addText(text.ref); required.push(slot(textSlot.slot, text.ref, text.ref)); }
  }
  addInstance(match, inst.ref, required);
}

// 未命中的顶层组件先登记，供下面的文本扫描判断“文本是否位于被隔离的组件内”。
for (const child of root.children || []) {
  const s = source(child.id);
  if (!["INSTANCE", "FRAME", "COMPONENT"].includes(s.type)) continue;
  if (matchedRefs.has(s.ref) || isInHostShell(s.ref)) continue;
  if (/背景|常驻信息|分割线/.test(s.name)) continue;
  if (!Object.keys(s.properties || {}).length && s.width === source(root.id).width && s.height === source(root.id).height) continue;
  pending.push({ sourceRef: s.ref, reason: "正式组件模板未命中，保留 DSL 来源，未猜测 ControlType" });
}

// 被隔离（模板不匹配）或未命中正式模板的组件，其内部文本不得泄漏成独立 TextBlock；
// 按 SKILL 规则只保留来源与 provenance，因此以 omit + 专用 omitReason 记录。
const isolatedRoots = new Set(pending.map(item => item.sourceRef));
function isolatedComponentReason(ref) {
  const owners = ancestorRefs(ref).slice(1).filter(ancestor => isolatedRoots.has(ancestor));
  if (owners.length === 0) return null;
  return owners.some(owner => excludeInstances.has(owner)) ? "excluded-component" : "unmapped-component";
}

for (const s of sourceNodes) {
  if (s.type !== "TEXT" || typeof s.text !== "string" || consumedTexts.has(s.ref)) continue;
  const isolated = isolatedComponentReason(s.ref);
  if (isolated) {
    textAudit.push({
      sourceRef: s.ref,
      sourceText: s.text,
      visibility: visible(s.ref),
      role: isolated,
      decision: "omit",
      omitReason: isolated,
      outputRefs: []
    });
    continue;
  }
  if (visible(s.ref) && !isInHostShell(s.ref) && !isPageTitle(s.ref)) addText(s.ref);
  else textAudit.push({ sourceRef: s.ref, sourceText: s.text, visibility: visible(s.ref), role: isPageTitle(s.ref) ? "page-title" : (isInHostShell(s.ref) ? "host-shell" : "hidden"), decision: "omit", omitReason: isPageTitle(s.ref) ? "page-title" : (isInHostShell(s.ref) ? "host-shell" : "hidden"), outputRefs: [] });
}

const mapping = {
  schemaVersion: "mastergo-mtslg-mapping/3",
  adapter: "mtslg-iocontrol",
  mappingTag: MAPPING_TAG,
  comment: "Generated from complete MasterGo DSL; component semantics come from the formal template map.",
  contentOriginX: 0,
  contentOriginY: 192,
  rootRef: root.id,
  source: { fileId: dslSnapshot.fileId, layerId: dslSnapshot.layerId, ui: dslSnapshot.ui, pageName: dslSnapshot.pageName },
  sourceNodes,
  textAudit,
  nodes: outputNodes,
  componentInstances,
  // 表格逐表审计：列定义来源、每列单元格分布、行数据登记、Value 待绑定标记、bbox 与内容范围。
  ...(tableAudits.length ? { tableAudits } : {}),
  // 同一组件可能同时被隔离与“未命中”记录，按 sourceRef 去重后再写入清单。
  pending: pending.filter((item, index) => pending.findIndex(x => x.sourceRef === item.sourceRef) === index),
  unmappedComponents: [...new Set(pending.map(x => x.sourceRef))],
  ...(excludeInstances.size ? { excludedInstances: [...excludeInstances] } : {}),
  ...(templateConflicts.length ? { templateConflicts } : {})
};
fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  sourceNodes: sourceNodes.length,
  nodes: outputNodes.length,
  textAudit: textAudit.length,
  componentInstances: componentInstances.length,
  templateConflicts: templateConflicts.length,
  tables: tableAudits.map(item => ({
    ref: item.ref, name: item.name, xmlId: item.xmlId,
    columns: item.columns.length, rows: item.rows.length,
    valuePending: item.valuePending,
    declaredBoxCoversContent: item.geometry.declaredBoxCoversContent
  })),
  out: outPath
}, null, 2));
for (const table of tableAudits) {
  console.error("表格已发射: [" + table.ref + "] " + (table.name || "") +
    " → DataGrid " + table.xmlId + "，" + table.columns.length + " 列（" +
    table.columns.map(column => column.controlType).join("/") + "），" +
    table.rows.length + " 行按数据登记（未发射控件）；Value 固定空串（已置 valuePending 待绑定提示）。" +
    (table.geometry.declaredBoxCoversContent ? "" : " 注意：图层声明尺寸覆盖不了内容范围，见 tableAudits.geometry。"));
}
if (templateConflicts.length) {
  console.error("模板匹配冲突（已按内部组件名执行）:");
  for (const conflict of templateConflicts) {
    console.error("  - [" + conflict.ref + "] " + conflict.reason +
      "；公开属性命中 " + conflict.propertyMatch + "；内部组件命中 " + conflict.componentSetMatch);
  }
}
