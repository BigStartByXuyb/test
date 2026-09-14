#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  loadTemplateMap,
  resolveTemplateMapping
} = require("../resolve-mtslg-template-mapping.js");

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
      template: "rightSidebar",
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
for (const variant of ["enter", "exit", "start", "恢复切割", "stop", "左右结构-icon+文案"]) {
  assert.strictEqual(templateMap.rightSidebarTemplates.variants[variant].style, "RightButtonStyle", "左右结构变体必须使用 RightButtonStyle: " + variant);
}
const documentedTemplateFamilies = {
  inputTemplates: [
    "输入框-整数-40", "输入框-整数-36", "输入框-整数-32",
    "输入框-小数-40", "输入框-小数-36", "输入框-小数-32",
    "输入框-文字-40", "输入框-文字-36", "输入框-文字-32"
  ],
  selectionInfoTemplates: ["单选-选中/未选择", "多选-选中/未选中"],
  selectionTemplates: ["单选-选中", "单选-未选择", "多选-选中", "多选-未选择"],
  infoGroupTemplates: ["信息分组-模块化"],
  mainMenuTemplates: ["主菜单button", "主菜单button-文字"],
  tableTemplates: ["Table"],
  textTemplates: ["独立文本"]
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
assert.strictEqual(resolvedRight.resolvedTemplates[0].template, "rightSidebar");
assert.strictEqual(resolvedRight.nodes[0].attrs.Style, "RightButtonStyle");

const resolvedRightIcon = resolveTemplateMapping(
  makeRightSidebarMapping("exit", "right/exit", "EXIT", "ExitGeometry"),
  templateMap
);
assert.strictEqual(resolvedRightIcon.nodes[0].attrs.Style, "RightButtonStyle");
assert.strictEqual(resolvedRightIcon.nodes[0].attrs.Icon, "ExitGeometry");

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

console.log("PASS MTSLG template mapping resolver test");
