#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  loadTemplateMap,
  resolveTemplateMapping
} = require("../adapters/mtslg-iocontrol/resolve-mtslg-template-mapping.js");

const mapPath = path.join(__dirname, "..", "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const templateMap = loadTemplateMap(mapPath);

function source(ref, text) {
  return {
    ref,
    parentRef: "instance/1",
    pageAbsX: 100,
    pageAbsY: 292,
    relativeX: 100,
    relativeY: 100,
    width: 60,
    height: 60,
    ...(text === undefined ? {} : { text })
  };
}

function node(sourceRef, sourceText, controlType) {
  const resolvedType = controlType || (sourceText === undefined ? "IconButton" : "TextBlock");
  return {
    ref: sourceRef,
    sourceRef,
    sourceParent: "instance/1",
    absX: 100,
    absY: 292,
    w: 60,
    h: 60,
    controlType: resolvedType,
    attrs: {
      ControlType: resolvedType,
      ...(resolvedType === "IconButton" ? { Style: "SmallButton" } : {}),
      ...(sourceText === undefined ? {} : { Value: sourceText })
    },
    ...(sourceText === undefined ? {} : {
      sourceText,
      valueSource: "dsl.text",
      valueSourceRef: sourceRef
    })
  };
}

function makeMapping(variant, slots) {
  const sourceNodes = [
    { ref: "root", parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 832 },
    { ref: "instance/1", parentRef: "root", pageAbsX: 100, pageAbsY: 292, relativeX: 100, relativeY: 292, width: 384, height: 88 }
  ];
  const nodes = [];
  for (const slot of slots) {
    const text = slot.text;
    sourceNodes.push(source(slot.sourceRef, text));
    nodes.push(node(slot.sourceRef, text, slot.controlType));
  }
  return {
    contentOriginY: 192,
    sourceNodes,
    nodes,
    componentInstances: [{
      instanceRef: "instance/1",
      properties: { "属性 1": variant },
      requiredSlots: slots.map(({ slot, sourceRef, valueSourceRef }) => ({ slot, sourceRef, valueSourceRef }))
    }]
  };
}

function makeRightSidebarMapping(buttonType, sourceRef, text, icon) {
  const instanceRef = sourceRef;
  const textRef = sourceRef + "/text";
  const sourceNodes = [
    { ref: "root", parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 832 },
    { ref: sourceRef, parentRef: "root", pageAbsX: 1090, pageAbsY: 282, relativeX: 1090, relativeY: 282, width: 170, height: 80 },
    { ref: textRef, parentRef: sourceRef, pageAbsX: 1162, pageAbsY: 310, relativeX: 72, relativeY: 28, width: 65, height: 24, text }
  ];
  return {
    contentOriginY: 192,
    sourceNodes,
    nodes: [{
      ref: sourceRef,
      sourceRef,
      sourceParent: "root",
      absX: 1090,
      absY: 282,
      w: 170,
      h: 80,
      controlType: "IconButton",
      attrs: {
        ControlType: "IconButton",
        Value: text,
        ...(icon ? { Icon: icon } : {})
      },
      sourceText: text,
      valueSourceRef: textRef,
      valueSource: "dsl.text"
    }],
    componentInstances: [{
      template: "rightSidebarTemplates",
      instanceRef,
      properties: { "按钮类型": buttonType },
      requiredSlots: [{ slot: "button", sourceRef }]
    }]
  };
}

function slotsForWithTitle() {
  return [
    { slot: "button_plus_5", sourceRef: "button/plus5" },
    { slot: "button_minus_5", sourceRef: "button/minus5" },
    { slot: "button_plus_1", sourceRef: "button/plus1" },
    { slot: "button_minus_1", sourceRef: "button/minus1" },
    { slot: "title", sourceRef: "text/title", valueSourceRef: "text/title", text: "光源调整", controlType: "TextBlock" },
    { slot: "value", sourceRef: "text/value", valueSourceRef: "text/value", text: "9.0%", controlType: "TextBlock" },
    { slot: "direction", sourceRef: "text/direction", valueSourceRef: "text/direction", text: "Dir", controlType: "TextBlock" }
  ];
}

assert.deepStrictEqual(
  templateMap.componentTemplates.match,
  { property: "属性 1" },
  "模板匹配必须使用公开属性1"
);
assert.deepStrictEqual(
  templateMap.inputTemplates.match,
  { property: "属性 1" },
  "输入框模板匹配必须使用公开属性1"
);
assert.ok(templateMap.rightSidebarTemplates, "缺少右侧栏通用模板");
assert.strictEqual(templateMap.rightSidebarTemplates.variants.stop.style, "RightButtonStyle");
assert.strictEqual(templateMap.rightSidebarTemplates.variants["上下结构-icon+文案"].style, "UpDownRightButtonStyle");
for (const variant of ["F+文案", "文案 大button", "删除料盒-1", "删除料盒-2", "文案-小button"]) {
  assert.strictEqual(templateMap.rightSidebarTemplates.variants[variant].style, null, "默认右侧栏变体不得带 Style: " + variant);
}
for (const variant of ["start", "恢复切割", "stop", "左右结构-icon+文案"]) {
  assert.strictEqual(templateMap.rightSidebarTemplates.variants[variant].style, "RightButtonStyle", "左右结构变体必须使用 RightButtonStyle: " + variant);
}
// enter / exit：组件级固定变体（Style 逐变体固定、图标与语言键由运行时/映射表提供）。
// 这两个变体是唯一使用 iconPolicy=runtime 与 langPolicy=fixed 的登记；其余右栏变体保持原口径。
for (const [variant, style, icon] of [
  ["enter", "EnterButtonStyle", "EnterGeometry"],
  ["exit", "ExitButtonStyle", "ExitGeometry"],
]) {
  const entry = templateMap.rightSidebarTemplates.variants[variant];
  assert.strictEqual(entry.style, style, "固定变体 Style 必须是自身的运行时 Style: " + variant);
  assert.strictEqual(entry.iconPolicy, "runtime", "固定变体图标必须由运行时提供: " + variant);
  assert.strictEqual(entry.runtimeIcon, icon, "固定变体必须登记运行时图标键: " + variant);
  assert.strictEqual(entry.langPolicy, "fixed", "固定变体语言键必须由映射表登记: " + variant);
  assert.strictEqual(entry.langKeyTemplate, "{page}" + (variant === "enter" ? "Enter" : "Exit"),
    "固定变体必须登记页面级语言键模板: " + variant);
  assert.ok(entry.langText && entry.langText.CN && entry.langText.EN, "固定变体必须登记 CN/EN 文案: " + variant);
  assert.ok(entry.fixedAttrs && typeof entry.fixedAttrs === "object", "固定变体必须登记逐变体固定属性: " + variant);
  assert.deepStrictEqual(entry.omitRequiredAttrs, ["IOVisible", "IOEnable", "IsShowStatus", "IsNeedRedMark"],
    "固定变体必须登记收窄掉的必写字段: " + variant);
  assert.strictEqual(entry.slots[0].style, style, "固定变体槽位 Style 必须与变体一致: " + variant);
  assert.strictEqual(entry.slots[0].iconPolicy, "runtime", "固定变体槽位 iconPolicy 必须与变体一致: " + variant);
  assert.strictEqual(entry.slots[0].runtimeIcon, icon, "固定变体槽位 runtimeIcon 必须与变体一致: " + variant);
}
assert.strictEqual(templateMap.rightSidebarTemplates.variants.enter.fixedAttrs.IsSave, "true",
  "enter 固定属性必须登记 IsSave");
assert.strictEqual(templateMap.rightSidebarTemplates.variants.exit.fixedAttrs.PageName, "GoBack",
  "exit 固定属性必须登记 PageName");
// 独立组件族（可直接放置的右栏按钮）：按组件名（componentSet）命中，Style 与同名聚合变体一致。
assert.ok(templateMap.rightSidebarComponentTemplates, "缺少右栏独立组件模板族");
assert.deepStrictEqual(templateMap.rightSidebarComponentTemplates.match, { componentSet: true },
  "右栏独立组件族必须按 componentSet 匹配");
for (const [component, style] of [
  ["右侧栏-左右结构-icon+文案", "RightButtonStyle"],
  ["右侧栏-上下结构-icon+文案", "UpDownRightButtonStyle"],
  ["start", "RightButtonStyle"],
]) {
  const entry = templateMap.rightSidebarComponentTemplates.variants[component];
  assert.ok(entry, "右栏独立组件族缺少登记: " + component);
  assert.strictEqual(entry.componentSet, component, "componentSet 必须等于组件名: " + component);
  assert.strictEqual(entry.controlType, "IconButton", "独立组件必须是 IconButton: " + component);
  assert.strictEqual(entry.style, style, "独立组件 Style 必须与其聚合变体一致: " + component);
}
// 聚合变体登记的 componentSet 必须与同名独立组件一致：登记后解析器会拿内部实例的组件名交叉核对，
// 不一致直接失败；文档对照表的「内部独立组件名（componentSet）」列也依赖这一项（BLOCK-001）。
for (const [variant, component] of [
  ["左右结构-icon+文案", "右侧栏-左右结构-icon+文案"],
  ["上下结构-icon+文案", "右侧栏-上下结构-icon+文案"],
]) {
  assert.strictEqual(templateMap.rightSidebarTemplates.variants[variant].componentSet, component,
    "聚合变体 " + variant + " 必须登记 componentSet=" + component + "（否则交叉核对被静默跳过）");
  assert.ok(templateMap.rightSidebarComponentTemplates.variants[component],
    "componentSet 指向的独立组件必须在 rightSidebarComponentTemplates 中登记: " + component);
}
const documentedTemplateFamilies = {
  inputTemplates: [
    "输入框-整数-40", "输入框-整数-36", "输入框-整数-32",
    "输入框-小数-40", "输入框-小数-36", "输入框-小数-32",
    "输入框-文字-40", "输入框-文字-36", "输入框-文字-32"
  ],
  selectionTemplates: ["单选-选中", "单选-未选择", "多选-选中", "多选-未选择"],
  infoGroupTemplates: ["信息分组-模块化"],
  mainMenuTemplates: ["主菜单button", "主菜单button-文字"],
  tableTemplates: ["Table"]
};
for (const [family, variants] of Object.entries(documentedTemplateFamilies)) {
  assert.ok(templateMap[family], "缺少正式模板族: " + family);
  for (const variant of variants) {
    assert.ok(templateMap[family].variants[variant], "缺少正式模板变体: " + family + "/" + variant);
  }
}
for (const variant of [
  "加减快捷操作-有标题",
  "加减快捷键-无标题",
  "加减快捷键操作-2有标题",
  "轴操作",
  "方向",
  "图像移动-单侧",
  "图像移动-双侧",
  "缺口位置",
  "拟合数据-双侧上下",
  "拟合数据-前后",
  "拟合数据-单侧上下",
  "扫描"
]) {
  assert.ok(templateMap.componentTemplates.variants[variant], "缺少正式模板: " + variant);
}
assert.strictEqual(templateMap.selectionTemplates.variants["单选-选中"].controlType, "RadioButton");
assert.strictEqual(templateMap.selectionTemplates.variants["单选-未选择"].controlType, "RadioButton");
assert.strictEqual(templateMap.selectionTemplates.variants["多选-选中"].controlType, "CheckBox");
assert.strictEqual(templateMap.selectionTemplates.variants["多选-未选择"].controlType, "CheckBox");

const resolved = resolveTemplateMapping(
  makeMapping("加减快捷操作-有标题", slotsForWithTitle()),
  templateMap
);
assert.strictEqual(resolved.resolvedTemplates.length, 1);
assert.strictEqual(resolved.resolvedTemplates[0].variant, "加减快捷操作-有标题");
assert.deepStrictEqual(
  resolved.resolvedTemplates[0].requiredSlots.map(slot => slot.slot),
  ["button_plus_5", "button_minus_5", "button_plus_1", "button_minus_1", "title", "value", "direction"]
);

const hiddenTitleMapping = makeMapping(
  "加减快捷操作-有标题",
  slotsForWithTitle().filter(slot => slot.slot !== "title")
);
hiddenTitleMapping.sourceNodes.push(source("text/title", "光源调整"));
hiddenTitleMapping.componentInstances[0].omittedSlots = [
  { slot: "title", sourceRef: "text/title", valueSourceRef: "text/title", omitReason: "hidden" }
];
const resolvedHiddenTitle = resolveTemplateMapping(hiddenTitleMapping, templateMap);
assert.deepStrictEqual(
  resolvedHiddenTitle.resolvedTemplates[0].omittedSlots.map(slot => slot.slot),
  ["title"]
);

const extraTextMapping = makeMapping(
  "加减快捷键-无标题",
  slotsForWithTitle().filter(slot => slot.slot !== "title")
);
extraTextMapping.sourceNodes.push(source("text/extra", "额外可见文本"));
extraTextMapping.nodes.push(node("text/extra", "额外可见文本", "TextBlock"));
extraTextMapping.componentInstances[0].extraTextSlots = [
  { slot: "extra", sourceRef: "text/extra", valueSourceRef: "text/extra" }
];
const resolvedExtraText = resolveTemplateMapping(extraTextMapping, templateMap);
assert.deepStrictEqual(
  resolvedExtraText.resolvedTemplates[0].extraTextSlots.map(slot => slot.slot),
  ["extra"]
);

const inputMapping = makeMapping("输入框-整数-28", [
  { slot: "input", sourceRef: "input/28", controlType: "IntNumberBox" }
]);
inputMapping.componentInstances[0].template = "inputTemplates";
assert.strictEqual(
  resolveTemplateMapping(inputMapping, templateMap).resolvedTemplates[0].variant,
  "输入框-整数-28"
);

assert.throws(
  () => resolveTemplateMapping(makeMapping("未知变体", slotsForWithTitle()), templateMap),
  /未登记的 MTSLG 模板变体/
);

const singleSelectedMapping = makeMapping("单选-选中", [{ slot: "choice", sourceRef: "choice/selected", controlType: "RadioButton" }]);
singleSelectedMapping.componentInstances[0].template = "selectionTemplates";
const resolvedSingleSelected = resolveTemplateMapping(singleSelectedMapping, templateMap);
assert.strictEqual(resolvedSingleSelected.resolvedTemplates[0].variant, "单选-选中");
assert.strictEqual(resolvedSingleSelected.nodes[0].attrs.ControlType, "RadioButton");

const multiUnselectedMapping = makeMapping("多选-未选择", [{ slot: "choice", sourceRef: "choice/unselected", controlType: "CheckBox" }]);
multiUnselectedMapping.componentInstances[0].template = "selectionTemplates";
const resolvedMultiUnselected = resolveTemplateMapping(multiUnselectedMapping, templateMap);
assert.strictEqual(resolvedMultiUnselected.nodes[0].attrs.ControlType, "CheckBox");

const legacyTemplateInstancesMapping = makeMapping("加减快捷操作-有标题", slotsForWithTitle());
delete legacyTemplateInstancesMapping.componentInstances;
legacyTemplateInstancesMapping.templateInstances = [{ template: "componentTemplates", variant: "加减快捷操作-有标题", instanceRef: "component" }];
assert.throws(
  () => resolveTemplateMapping(legacyTemplateInstancesMapping, templateMap),
  /mapping 必须使用 componentInstances 字段/
);

const missingSlot = makeMapping("加减快捷操作-有标题", slotsForWithTitle().slice(0, -1));
assert.throws(
  () => resolveTemplateMapping(missingSlot, templateMap),
  /缺失必经槽位/
);

const badText = makeMapping("加减快捷操作-有标题", slotsForWithTitle());
badText.nodes.find(item => item.sourceRef === "text/value").attrs.Value = "64";
assert.throws(
  () => resolveTemplateMapping(badText, templateMap),
  /Value 不是 DSL 文本/
);

const confirmedFastAxis = makeMapping("轴操作-快慢", [
  { slot: "up_inner", sourceRef: "button/up-inner" },
  { slot: "up_outer", sourceRef: "button/up-outer" },
  { slot: "down_inner", sourceRef: "button/down-inner" },
  { slot: "down_outer", sourceRef: "button/down-outer" },
  { slot: "left_inner", sourceRef: "button/left-inner" },
  { slot: "left_outer", sourceRef: "button/left-outer" },
  { slot: "right_inner", sourceRef: "button/right-inner" },
  { slot: "right_outer", sourceRef: "button/right-outer" },
  { slot: "scan", sourceRef: "text/scan", valueSourceRef: "text/scan", text: "SCAN", controlType: "TextBlock" }
]);
const resolvedFastAxis = resolveTemplateMapping(confirmedFastAxis, templateMap);
assert.strictEqual(resolvedFastAxis.resolvedTemplates.length, 1);
assert.strictEqual(resolvedFastAxis.resolvedTemplates[0].variant, "轴操作-快慢");
assert.strictEqual(resolvedFastAxis.nodes.length, 9);

const resolvedRight = resolveTemplateMapping(
  makeRightSidebarMapping("stop", "right/stop", "STOP"),
  templateMap
);
assert.strictEqual(resolvedRight.resolvedTemplates.length, 1);
assert.strictEqual(resolvedRight.resolvedTemplates[0].template, "rightSidebarTemplates");
assert.strictEqual(resolvedRight.nodes[0].attrs.Style, "RightButtonStyle");

const resolvedRightIcon = resolveTemplateMapping(
  makeRightSidebarMapping("exit", "right/exit", "EXIT", "ExitGeometry"),
  templateMap
);
assert.strictEqual(resolvedRightIcon.nodes[0].attrs.Style, "ExitButtonStyle");
assert.strictEqual(resolvedRightIcon.nodes[0].attrs.Icon, "ExitGeometry");
// 组件级固定变体：固定属性逐字发射、图标由运行时提供、语言键由映射表登记（不按设计文本派生）。
assert.strictEqual(resolvedRightIcon.nodes[0].attrs.PageName, "GoBack");
assert.strictEqual(resolvedRightIcon.nodes[0].runtimeIcon, "ExitGeometry");
assert.deepStrictEqual(resolvedRightIcon.nodes[0].fixedLang,
  { keyTemplate: "{page}Exit", text: { CN: "EXIT", EN: "EXIT" } });

const resolvedRightEnter = resolveTemplateMapping(
  // 故意传入与映射表不同的图标名：运行时图标必须以映射表登记为准，不能被台账值改写。
  makeRightSidebarMapping("enter", "right/enter", "ENTER", "SomeLedgerGeometry"),
  templateMap
);
assert.strictEqual(resolvedRightEnter.nodes[0].attrs.Style, "EnterButtonStyle");
assert.strictEqual(resolvedRightEnter.nodes[0].attrs.IsSave, "true");
assert.strictEqual(resolvedRightEnter.nodes[0].attrs.Icon, "EnterGeometry");
assert.strictEqual(resolvedRightEnter.nodes[0].runtimeIcon, "EnterGeometry");
assert.strictEqual(resolvedRightEnter.nodes[0].fixedLang.keyTemplate, "{page}Enter");
assert.deepStrictEqual(resolvedRightEnter.nodes[0].omitAttrs, ["IOVisible", "IOEnable", "IsShowStatus", "IsNeedRedMark"],
  "解析器必须把变体登记的 omitRequiredAttrs 盖成节点标记");

// 运行时图标变体不得要求台账里有图标来源：页面台账本来就不该有这两条（由目标项目提供），
// iconRequired 只对「从 DSL/台账取图标」的变体生效。
const noLedgerIcon = makeRightSidebarMapping("enter", "right/enter-noledger", "ENTER");
delete noLedgerIcon.nodes.find(item => item.sourceRef === "right/enter-noledger").attrs.Icon;
const resolvedNoLedgerIcon = resolveTemplateMapping(noLedgerIcon, templateMap);
assert.strictEqual(resolvedNoLedgerIcon.nodes[0].attrs.Icon, "EnterGeometry",
  "iconPolicy=runtime 的变体必须能在台账无图标时用映射表登记键补齐");
assert.strictEqual(resolvedNoLedgerIcon.nodes[0].runtimeIcon, "EnterGeometry");

const resolvedRightTextIcon = resolveTemplateMapping(
  makeRightSidebarMapping("上下结构-icon+文案", "right/text-icon", "文案"),
  templateMap
);
assert.strictEqual(resolvedRightTextIcon.nodes[0].attrs.Style, "UpDownRightButtonStyle");

const resolvedRightDefault = resolveTemplateMapping(
  makeRightSidebarMapping("F+文案", "right/f-plus-text", "文案"),
  templateMap
);
assert.ok(!Object.prototype.hasOwnProperty.call(resolvedRightDefault.nodes[0].attrs, "Style"));

const resolvedRightLeft = resolveTemplateMapping(
  makeRightSidebarMapping("左右结构-icon+文案", "right/left-icon-text", "文案"),
  templateMap
);
assert.strictEqual(resolvedRightLeft.nodes[0].attrs.Style, "RightButtonStyle");

const mainMenuMapping = makeRightSidebarMapping("enter", "main/menu", "传感器", "SensorGeometry");
mainMenuMapping.componentInstances[0] = {
  template: "mainMenuTemplates",
  instanceRef: "main/menu",
  properties: { "属性 1": "主菜单button" },
  requiredSlots: [{ slot: "button", sourceRef: "main/menu" }]
};
const resolvedMainMenu = resolveTemplateMapping(mainMenuMapping, templateMap);
assert.strictEqual(resolvedMainMenu.resolvedTemplates[0].variant, "主菜单button");

// 右栏独立组件（componentSet 族）：按组件名命中，不依赖图层名
const standaloneMapping = makeRightSidebarMapping("左右结构-icon+文案", "right/standalone", "文案", "SaveGeometry");
standaloneMapping.componentInstances[0] = {
  template: "rightSidebarComponentTemplates",
  instanceRef: "right/standalone",
  componentSet: "右侧栏-左右结构-icon+文案",
  properties: {},
  requiredSlots: [{ slot: "button", sourceRef: "right/standalone" }]
};
const resolvedStandalone = resolveTemplateMapping(standaloneMapping, templateMap);
assert.strictEqual(resolvedStandalone.resolvedTemplates[0].variant, "右侧栏-左右结构-icon+文案");
assert.strictEqual(resolvedStandalone.nodes[0].attrs.Style, "RightButtonStyle");

const standaloneMissingComponent = JSON.parse(JSON.stringify(standaloneMapping));
delete standaloneMissingComponent.componentInstances[0].componentSet;
assert.throws(
  () => resolveTemplateMapping(standaloneMissingComponent, templateMap),
  /缺少真实变体值/
);

const conflictComponentSet = makeRightSidebarMapping("左右结构-icon+文案", "right/conflict", "文案", "SaveGeometry");
conflictComponentSet.componentInstances[0].componentSet = "start";
assert.throws(
  () => resolveTemplateMapping(conflictComponentSet, templateMap),
  /组件集与公开属性值不一致/
);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mtslg-template-resolver-"));
const inputPath = path.join(tempDir, "input.json");
const outputPath = path.join(tempDir, "output.json");
fs.writeFileSync(inputPath, JSON.stringify(makeMapping("加减快捷操作-有标题", slotsForWithTitle())), "utf8");
fs.writeFileSync(outputPath, JSON.stringify(resolved), "utf8");
assert.ok(fs.existsSync(inputPath) && fs.existsSync(outputPath));
fs.rmSync(tempDir, { recursive: true, force: true });

// 轴操作-快慢：8 个方向键槽位；optional 的 SCAN 在设计稿不存在时允许缺席，必经槽位仍不得缺失。
const axisSlots = ['up_inner', 'up_outer', 'down_inner', 'down_outer',
  'left_inner', 'left_outer', 'right_inner', 'right_outer']
  .map(slot => ({ slot, sourceRef: 'axis/' + slot, controlType: 'IconButton' }));
const axisResolved = resolveTemplateMapping(makeMapping('轴操作-快慢', axisSlots), templateMap);
assert.strictEqual(axisResolved.resolvedTemplates[0].requiredSlots.length, 8);
assert.ok(!axisResolved.resolvedTemplates[0].requiredSlots.some(item => item.slot === 'scan'),
  'optional 槽位缺席时不应写入 requiredSlots');
assert.throws(
  () => resolveTemplateMapping(makeMapping('轴操作-快慢', axisSlots.slice(0, 7)), templateMap),
  /缺失必经槽位/
);

// 容器族（infoGroupTemplates）：GroupBox 以 Header 承载标题文案，槽位 valueSourceRef 走 Header 而非 Value。
function makeInfoGroupMapping(headerTextAttrs) {
  return {
    contentOriginY: 192,
    sourceNodes: [
      { ref: 'root', parentRef: null, pageAbsX: 0, pageAbsY: 0, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
      { ref: 'instance/1', parentRef: 'root', pageAbsX: 790, pageAbsY: 204, relativeX: 790, relativeY: 204, width: 252, height: 534 },
      { ref: 'instance/1/header', parentRef: 'instance/1', pageAbsX: 814, pageAbsY: 220, relativeX: 24, relativeY: 16, width: 79, height: 20, text: '周期名称' }
    ],
    nodes: [{
      ref: 'instance/1', sourceRef: 'instance/1', sourceParent: 'root', controlType: 'GroupBox',
      sourceText: '周期名称', valueSource: 'dsl.text', valueSourceRef: 'instance/1/header',
      absX: 790, absY: 204, w: 252, h: 534,
      expectedLeft: 790, expectedTop: 12, expectedWidth: 252, expectedHeight: 534,
      attrs: Object.assign({ ControlType: 'GroupBox' }, headerTextAttrs)
    }],
    componentInstances: [{
      template: 'infoGroupTemplates',
      componentSet: '信息分组-模块化',
      instanceRef: 'instance/1',
      requiredSlots: [{ slot: 'header', sourceRef: 'instance/1', valueSourceRef: 'instance/1/header' }]
    }]
  };
}

const headerResolved = resolveTemplateMapping(makeInfoGroupMapping({ Header: '周期名称' }), templateMap);
assert.strictEqual(headerResolved.nodes[0].controlType, 'GroupBox');
assert.strictEqual(headerResolved.nodes[0].attrs.Header, '周期名称', 'Header 文案必须原样保留');
assert.throws(
  () => resolveTemplateMapping(makeInfoGroupMapping({ Header: '别的标题' }), templateMap),
  /Header 不是 DSL 文本/
);
assert.throws(
  () => resolveTemplateMapping(makeInfoGroupMapping({}), templateMap),
  /既没有 Value 也没有 Header/
);

console.log("PASS MTSLG template mapping resolver test");
