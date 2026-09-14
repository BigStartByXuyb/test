#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { auditMappingCoverage } = require("../audit-mtslg-feishu-map.js");

const docPath = path.join(__dirname, "..", "..", "references", "adapters", "mtslg-iocontrol", "feishu-component-library-mapping.md");
const mapPath = path.join(__dirname, "..", "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const report = auditMappingCoverage(fs.readFileSync(docPath, "utf8"), JSON.parse(fs.readFileSync(mapPath, "utf8")));

assert.deepStrictEqual(report.missing, [], "飞书正式模板不应缺失机器映射");
assert.deepStrictEqual(report.undocumented, [],
  "映射表登记的模板族/变体必须都在映射文档里出现（反向覆盖）: " + JSON.stringify(report.undocumented));
assert.deepStrictEqual(report.unregisteredVariants, [],
  "文档标题里写出的变体必须能在映射表里找到归属族: " + JSON.stringify(report.unregisteredVariants));
assert.deepStrictEqual(report.unregisteredFamilies, [],
  "映射表里的每个模板族都必须登记进审计脚本的家族清单: " + JSON.stringify(report.unregisteredFamilies));
assert.ok(report.covered.length >= 30, "正式模板覆盖数量异常");
assert.deepStrictEqual(report.ambiguous, [], "文档不应保留没有组件集/变体标题的孤立结构");
assert.deepStrictEqual(report.unconfirmed, ["inputTemplates/密码输入框"], "密码框只保留待确认状态");
assert.deepStrictEqual(report.duplicateMatchKeys, [],
  "同一匹配属性名 + 属性值不得登记在两个模板族: " + JSON.stringify(report.duplicateMatchKeys));
const doc = fs.readFileSync(docPath, "utf8");
assert.ok(!doc.includes("RightUpDownButtonStyle"), "不得保留旧的 RightUpDownButtonStyle 兼容别名");
assert.ok(!doc.includes("或其他实际变量值"), "按钮模板必须使用明确的 startstop 变体");
assert.ok(doc.includes("40/36/32/28"), "高度规则必须包含 28 变体");
console.log("PASS Feishu mapping coverage audit test");
