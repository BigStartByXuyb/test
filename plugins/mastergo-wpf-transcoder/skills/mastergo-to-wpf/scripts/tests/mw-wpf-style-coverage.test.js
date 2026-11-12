#!/usr/bin/env node
"use strict";

// A 路线样式族覆盖门禁：共享类型表可命中的每个变体，都必须能从写法表解析出一个有效样式键；
// 写法表自己的样式规则也只能引用已登记 ControlType 与已登记样式键。

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const TYPES_PATH = path.join(ROOT, "references", "component-types.json");
const MAP_PATH = path.join(ROOT, "references", "adapters", "mw-wpf", "mw-wpf-map.json");

const types = JSON.parse(fs.readFileSync(TYPES_PATH, "utf8"));
const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
const controlTypes = map.controlTypes || {};
const pageDefault = (map.styleRules && map.styleRules.pageDefault) || {};
const byVariant = (map.styleRules && map.styleRules.byVariant) || {};

function assertKnownStyle(controlType, style, label) {
  assert.ok(controlTypes[controlType], label + " 引用了未登记 ControlType: " + controlType);
  if (style === "implicit") return;
  assert.ok((controlTypes[controlType].styleKeys || []).includes(style),
    label + " 的样式键未在 " + controlType + ".styleKeys 登记: " + style);
}

for (const [familyName, family] of Object.entries(types)) {
  if (!family || typeof family !== "object" || !family.variants) continue;
  for (const [variantName, variant] of Object.entries(family.variants)) {
    const controlType = variant.controlType;
    const spec = controlTypes[controlType];
    assert.ok(spec, familyName + "/" + variantName + " 的 ControlType 未在 A 写法表登记: " + controlType);
    if (spec.status === "pending") continue;
    const style = ((byVariant[controlType] || {})[variantName]) || pageDefault[controlType];
    assert.ok(style, familyName + "/" + variantName + " 无法解析样式族: " + controlType);
    assertKnownStyle(controlType, style, familyName + "/" + variantName);
  }
}

for (const [controlType, style] of Object.entries(pageDefault)) {
  assertKnownStyle(controlType, style, "styleRules.pageDefault." + controlType);
}
for (const [controlType, variants] of Object.entries(byVariant)) {
  for (const [variantName, style] of Object.entries(variants)) {
    assertKnownStyle(controlType, style, "styleRules.byVariant." + controlType + "." + variantName);
  }
}
for (const controlType of Object.keys((map.textBinding && map.textBinding.byControlType) || {})) {
  assert.ok(controlTypes[controlType], "textBinding 引用了未登记 ControlType: " + controlType);
}

assert.ok(controlTypes.ToggleButton, "A 写法表必须使用共享命名 ToggleButton");
assert.ok(!controlTypes.Togglebutton, "A 写法表不得保留 Togglebutton 拼写");

console.log("PASS MW WPF style family coverage");
