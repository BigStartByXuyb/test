#!/usr/bin/env node
"use strict";

// Generic MasterGo DSL -> MTSLG mapping generator.
// It intentionally contains no page or instance layer IDs. Component structure
// comes from the formal template map; instance text, icon and geometry come
// from the current DSL snapshot.

const fs = require("fs");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
function required(name) {
  const value = arg(name);
  if (!value) throw new Error("missing " + name);
  return value;
}
function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { throw new Error(label + " read failed: " + e.message); }
}
function normalize(value) { return String(value || "").replace(/\s+/g, ""); }
function textOf(node) { return Array.isArray(node.text) ? node.text.map(x => x.text || "").join("") : undefined; }

const dslSnapshot = readJson(required("--dsl"), "DSL snapshot");
const visibility = readJson(required("--visibility"), "visibility");
const templateMap = readJson(required("--template-map"), "template map");
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
const parents = new Map();
const outputNodes = [];
const outputRefBySource = new Map();
const textAudit = [];
const consumedTexts = new Set();
const componentInstances = [];
const deferredValueAudits = [];
const pending = [];
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
function isHostShell(ref) {
  return ancestorRefs(ref).some(x => {
    const n = node(x);
    const name = String(n?.name || "");
    return name.includes("顶部栏") || name.includes("底部") || name.includes("常驻信息");
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
function iconForPath(pathRef) {
  const match = iconEntries
    .filter(icon => icon && typeof icon.sourceRef === "string" && (pathRef === icon.sourceRef || pathRef.startsWith(icon.sourceRef + "/") || icon.sourceRef.startsWith(pathRef + "/")))
    .sort((a, b) => String(b.sourceRef).length - String(a.sourceRef).length)[0];
  return match?.name || null;
}
function iconFor(ref) {
  const pathRef = pathDescendants(ref)[0];
  return pathRef ? iconForPath(pathRef) : null;
}
function iconEntryFor(ref) {
  const pathRef = pathDescendants(ref)[0];
  if (!pathRef) return null;
  return iconEntries
    .filter(icon => icon && typeof icon.sourceRef === "string" &&
      (pathRef === icon.sourceRef || pathRef.startsWith(icon.sourceRef + "/") || icon.sourceRef.startsWith(pathRef + "/")))
    .sort((a, b) => String(b.sourceRef).length - String(a.sourceRef).length)[0] || null;
}
// 图标图形节点 bbox：优先用图标映射的 sourceRef 节点，缺失时回退 sourceId 节点。
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
      if (candidate.fromInner && variantSpec?.childPolicy === "nested-page-templates") return false;
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
    expectedLeft: s.pageAbsX - (parentSource ? parentSource.pageAbsX : 0),
    expectedTop: s.pageAbsY - (parentSource ? parentSource.pageAbsY : 0) - (parentSource ? 0 : 192),
    expectedWidth: controlType === "TextBlock" ? "NaN" : s.width,
    expectedHeight: controlType === "TextBlock" ? 40 : s.height,
    widthSource: controlType === "TextBlock" ? "mtslg.textblock.fixed-nan" : "dsl.bbox",
    heightSource: controlType === "TextBlock" ? "mtslg.textblock.fixed-40" : "dsl.bbox",
    ...(controlType === "TextBlock" ? { dslWidth: s.width } : {}),
    id: xmlId,
    xmlId,
    attrs: Object.assign({}, attrs),
    ...(options.iconSize ? { iconSize: options.iconSize } : {}),
    // 容器类节点：内容区原点（边框 + 标题条高）。重挂子控件时必须按它换算相对坐标。
    ...(options.contentInset ? { contentInset: options.contentInset } : {})
  };
  outputNodes.push(out);
  outputRefBySource.set(sourceRef, xmlId);
  return xmlId;
}
function addText(ref) {
  if (consumedTexts.has(ref) || !visible(ref) || isHostShell(ref) || isPageTitle(ref)) return outputRefBySource.get(ref) || null;
  consumedTexts.add(ref);
  const s = source(ref);
  const attrs = { Value: s.text };
  const size = fontSizeByRef.get(ref);
  if (typeof size === "number") attrs.FontSize = String(size);
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

const matched = [];
for (const item of sourceNodes) {
  const matches = formalMatches(node(item.ref));
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
  if (match.family === "rightSidebarTemplates" || match.family === "rightSidebarComponentTemplates" ||
      match.family === "selectBoxTemplates" || match.family === "mainMenuTemplates") {
    const valueText = firstText(inst.ref, s => !/^F\d+$/.test(s.text));
    const attrs = {};
    if (spec.style) attrs.Style = spec.style;
    if (valueText) attrs.Value = valueText.text;
    const icon = spec.iconPolicy !== "none" ? iconFor(inst.ref) : null;
    if (icon) attrs.Icon = icon;
    const iconSize = icon ? iconSizeFor(inst.ref) : null;
    const fText = firstText(inst.ref, s => /^F\d+$/.test(s.text));
    if (fText && inst.properties["显示F"] !== false) attrs.TopLeftContent = fText.text;
    const sourceSlotRefs = [valueText?.ref, fText?.ref].filter(Boolean);
    const owner = addNode(inst.ref, spec.controlType, attrs, {
      ...(valueText ? { valueSourceRef: valueText.ref } : {}),
      ...(iconSize ? { iconSize } : {}),
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
    addNode(inst.ref, spec.controlType, attrs, valueText ? { valueSourceRef: valueText.ref } : {});
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
    // 内容区原点必须来自"显式登记的 Style"：不写 Style 会落到隐式 ContentGroupBoxStyle（5px + 标题行高，随字号变化），
    // 子控件相对坐标无法机械换算。这里 fail-closed，禁止容器变体 style=null 或未登记 styleInsets。
    const styleInsets = templateMap.infoGroupTemplates?.styleInsets || {};
    const contentInset = spec.style ? styleInsets[spec.style] : null;
    if (!contentInset) {
      throw new Error("容器变体缺少可换算的内容区原点: template=" + match.family +
        " componentSet=" + (match.componentSet || spec.componentSet || "") +
        " style=" + JSON.stringify(spec.style ?? null) +
        "；请在映射表 infoGroupTemplates.styleInsets 登记该 Style（内容区边框 + 标题条高）");
    }
    const attrs = {};
    if (spec.style) attrs.Style = spec.style;
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
  if (matchedRefs.has(s.ref) || isHostShell(s.ref)) continue;
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
  if (visible(s.ref) && !isHostShell(s.ref) && !isPageTitle(s.ref)) addText(s.ref);
  else textAudit.push({ sourceRef: s.ref, sourceText: s.text, visibility: visible(s.ref), role: isPageTitle(s.ref) ? "page-title" : (isHostShell(s.ref) ? "host-shell" : "hidden"), decision: "omit", omitReason: isPageTitle(s.ref) ? "page-title" : (isHostShell(s.ref) ? "host-shell" : "hidden"), outputRefs: [] });
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
  // 同一组件可能同时被隔离与“未命中”记录，按 sourceRef 去重后再写入清单。
  pending: pending.filter((item, index) => pending.findIndex(x => x.sourceRef === item.sourceRef) === index),
  unmappedComponents: [...new Set(pending.map(x => x.sourceRef))],
  ...(excludeInstances.size ? { excludedInstances: [...excludeInstances] } : {}),
  ...(templateConflicts.length ? { templateConflicts } : {})
};
fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ sourceNodes: sourceNodes.length, nodes: outputNodes.length, textAudit: textAudit.length, componentInstances: componentInstances.length, templateConflicts: templateConflicts.length, out: outPath }, null, 2));
if (templateConflicts.length) {
  console.error("模板匹配冲突（已按内部组件名执行）:");
  for (const conflict of templateConflicts) {
    console.error("  - [" + conflict.ref + "] " + conflict.reason +
      "；公开属性命中 " + conflict.propertyMatch + "；内部组件命中 " + conflict.componentSetMatch);
  }
}
