#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { auditMappingCoverage } = require("../audit-mtslg-feishu-map.js");

const docPath = path.join(__dirname, "..", "..", "references", "adapters", "mtslg-iocontrol", "feishu-component-library-mapping.md");
const mapPath = path.join(__dirname, "..", "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const report = auditMappingCoverage(fs.readFileSync(docPath, "utf8"), JSON.parse(fs.readFileSync(mapPath, "utf8")));

assert.deepStrictEqual(report.undocumented, [],
  "映射表登记的模板族/变体必须都在映射文档里出现（反向覆盖）: " + JSON.stringify(report.undocumented));
assert.deepStrictEqual(report.unregisteredVariants, [],
  "文档结构化写出的变体值必须能在映射表里找到归属族: " + JSON.stringify(report.unregisteredVariants));
assert.deepStrictEqual(report.unregisteredFamilies, [],
  "映射表里的每个模板族都必须出现在映射文档里: " + JSON.stringify(report.unregisteredFamilies));
assert.ok(report.covered.length >= 35, "正式模板覆盖数量异常（文档解析可能失效）: " + report.covered.length);
assert.deepStrictEqual(report.ambiguous, [], "文档不应保留没有组件集/变体标题的孤立结构");
assert.deepStrictEqual(report.unconfirmed, ["inputTemplates/密码输入框"], "密码框只保留待确认状态");
assert.deepStrictEqual(report.duplicateMatchKeys, [],
  "同一匹配属性名 + 属性值不得登记在两个模板族: " + JSON.stringify(report.duplicateMatchKeys));

// ---- 文档侧期望值必须来自"解析文档"，不能来自手写清单 ----
// 背景：审计曾维护一份手写的「族 → 变体」数组，`infoGroupTemplates` 漏登了《信息模块-手动控制弹层》，
// 于是该变体在「文档 → 映射表」方向的输入里整条消失（漏改不报错、只静默少检）。
assert.ok(report.covered.includes("infoGroupTemplates/信息模块-手动控制弹层"),
  "文档标题里写出的《信息模块-手动控制弹层》必须被解析并归属到 infoGroupTemplates");
assert.ok(report.covered.includes("infoGroupTemplates/信息分组-模块化"),
  "同族的另一个变体也必须被解析到");
assert.deepStrictEqual(report.documented.labels.includes("单选+多选"), true,
  "章节名（如《单选+多选》）不是变体值，必须归入 labels 而不是报 unregisteredVariants");

const doc = fs.readFileSync(docPath, "utf8");
const templateMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));

// ① 文档正文完全不提该变体名（模拟"表里加了、文档忘了写"）→ 反向覆盖必须报出
const docWithoutModal = doc.split("信息模块-手动控制弹层").join("已删除的组件集");
const droppedInDoc = auditMappingCoverage(docWithoutModal, templateMap);
assert.ok(droppedInDoc.undocumented.includes("infoGroupTemplates/信息模块-手动控制弹层"),
  "文档删掉该变体章节后，undocumented 必须报出: " + JSON.stringify(droppedInDoc.undocumented));
assert.ok(droppedInDoc.unregisteredVariants.includes("已删除的组件集"),
  "整组的变体都不见了（章节名也解析不到）→ 该章节是孤儿，必须报 unregisteredVariants: " +
  JSON.stringify(droppedInDoc.unregisteredVariants));
assert.ok(droppedInDoc.unresolvedSections.length > 0, "孤儿章节必须登记在 unresolvedSections 里便于定位");

// ② 映射表删掉该变体 → 文档仍写着它，必须被当成"文档多写的变体"报出（旧手写清单漏登时这条完全看不见）
const mapWithoutModal = JSON.parse(JSON.stringify(templateMap));
delete mapWithoutModal.infoGroupTemplates.variants["信息模块-手动控制弹层"];
const droppedInMap = auditMappingCoverage(doc, mapWithoutModal);
assert.ok(droppedInMap.unregisteredVariants.includes("信息模块-手动控制弹层"),
  "映射表删掉变体而文档仍写着时，unregisteredVariants 必须报出: " + JSON.stringify(droppedInMap.unregisteredVariants));

// ③ 文档凭空多写一个变体值（`属性 1=` 段）→ 必须报出
const docWithInvented = doc.replace(/^### 固定模板：属性 1=扫描$/m, "### 固定模板：属性 1=扫描 / 凭空变体");
const invented = auditMappingCoverage(docWithInvented, templateMap);
assert.ok(invented.unregisteredVariants.includes("凭空变体"),
  "文档写出的、映射表没有的变体值必须报出: " + JSON.stringify(invented.unregisteredVariants));

assert.ok(!doc.includes("RightUpDownButtonStyle"), "不得保留旧的 RightUpDownButtonStyle 兼容别名");
assert.ok(!doc.includes("或其他实际变量值"), "按钮模板必须使用明确的 startstop 变体");
assert.ok(doc.includes("40/36/32/28"), "高度规则必须包含 28 变体");
console.log("PASS Feishu mapping coverage audit test");
