#!/usr/bin/env node
"use strict";

// 映射表拆分回归：路由映射表（IOContorl 写入规则）声明 extends 指向共享类型表（设计稿 → ControlType + 槽位），
// 加载器合并后必须是完整映射表；族内目标专属子键由 familyOverlays 贴回。
// 拆分后单看任一个文件都不再是完整映射表，禁止任何脚本/用例绕过加载器直接解析路由文件。

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadTemplateMap } = require(path.join(__dirname, "..", "lib", "load-template-map.js"));

const SKILL = path.join(__dirname, "..", "..");
const ROUTE = path.join(SKILL, "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const SHARED = path.join(SKILL, "references", "component-types.json");

const route = JSON.parse(fs.readFileSync(ROUTE, "utf8"));
const shared = JSON.parse(fs.readFileSync(SHARED, "utf8"));
const merged = loadTemplateMap(ROUTE);

// 1) 声明与指向
assert.ok(route.extends, "路由映射表必须声明 extends");
assert.strictEqual(
  path.resolve(path.dirname(ROUTE), route.extends),
  path.resolve(SHARED),
  "extends 必须指向 references/component-types.json"
);

// 2) 合并结果：共享与路由的顶层键都在，且不含指令键
for (const key of [...Object.keys(shared), ...Object.keys(route)]) {
  if (key === "extends" || key === "familyOverlays") continue;
  assert.ok(key in merged, "合并后的映射表缺顶层键: " + key);
}
assert.strictEqual(merged.extends, undefined, "合并结果不得残留 extends");
assert.strictEqual(merged.familyOverlays, undefined, "合并结果不得残留 familyOverlays");

// 3) 组件族（共享）与写入规则（路由）都必须齐
for (const family of [
  "componentTemplates", "rightSidebarTemplates", "rightSidebarComponentTemplates",
  "inputTemplates", "selectBoxTemplates", "selectionTemplates", "infoGroupTemplates",
  "cameraTemplates", "mainMenuTemplates", "tableTemplates",
]) {
  assert.ok(merged[family] && merged[family].variants, "合并后的映射表缺组件族: " + family);
}
assert.ok(merged.controlTypes, "合并后的映射表缺 IOContorl 写入规则 controlTypes");
assert.ok(merged.layoutRules && merged.layoutRules.bottomBar, "合并后的映射表缺 layoutRules.bottomBar");
assert.ok(merged.buttonFamily && merged.textBlockAlign, "合并后的映射表缺 buttonFamily / textBlockAlign");

// 4) 族内目标专属子键必须由 familyOverlays 贴回
assert.ok(merged.tableTemplates.columnTemplate, "tableTemplates.columnTemplate 必须贴回");
assert.ok(merged.infoGroupTemplates.styleInsets, "infoGroupTemplates.styleInsets 必须贴回");
assert.ok(!("columnTemplate" in shared.tableTemplates), "列定义几何属目标写入，不得留在共享类型表");
assert.ok(!("styleInsets" in shared.infoGroupTemplates), "内容区 inset 属目标写入，不得留在共享类型表");

// 5) 无 extends 的映射表按原样返回
const plain = loadTemplateMap(SHARED);
assert.ok(plain.componentTemplates && plain.layoutRules, "无 extends 的映射表必须原样返回");
assert.strictEqual(plain.extends, undefined);

console.log("PASS 映射表拆分（共享类型表 + 路由写入规则 + 加载器）回归测试");
