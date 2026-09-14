#!/usr/bin/env node
"use strict";

// 按钮族固定字段口径的单一真值源回归：映射表 buttonFamily / controlTypeRequiredAttrs
// 必须与两个脚本的内置默认、两份 Skill 的正文表述逐项一致。
// 背景：同一规则曾在「映射表 + 生成器常量 + 校验器常量 + 文档」四处各写一遍，
// 2026-09-10 的按钮族改动就是在这里漂移的（文档写「无图标不发射」，脚本发空字符串占位），
// 之后十几轮 CI 语义审计因为只读抽查范围不同，一直没对上，最终以 BLOCK 形式爆出。

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const MAP = path.join(__dirname, "..", "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const DOC_FORMAT_SKILL = path.join(__dirname, "..", "..", "..", "mastergo-iocontrol-document-format", "SKILL.md");
const MAIN_SKILL = path.join(__dirname, "..", "..", "SKILL.md");
const GENERATOR = path.join(__dirname, "..", "gen-iocontrol-xml.js");
const VALIDATOR = path.join(__dirname, "..", "validate-iocontrol-provenance.js");

const map = JSON.parse(fs.readFileSync(MAP, "utf8"));
const docFormat = fs.readFileSync(DOC_FORMAT_SKILL, "utf8");
const mainSkill = fs.readFileSync(MAIN_SKILL, "utf8");
const generator = fs.readFileSync(GENERATOR, "utf8");
const validator = fs.readFileSync(VALIDATOR, "utf8");

const family = map.buttonFamily;
const required = map.controlTypeRequiredAttrs;
const skillLines = (text) => text.split(/\r?\n/);

// ---------- 1. 映射表内部自洽 ----------
assert.ok(family && Array.isArray(family.alwaysWrittenAttrs), "映射表必须登记 buttonFamily.alwaysWrittenAttrs");
assert.ok(family.alwaysWrittenAttrs.includes("IOEnable"), "按钮族固定参数必须包含 IOEnable");
assert.ok(required.IconButton.includes("Icon"), "IconButton 的必写字段必须包含 Icon");
for (const attr of family.iconSizeAttrs) {
  assert.ok(required.IconButton.includes(attr), `IconButton 的必写字段必须包含 ${attr}`);
}
for (const type of ["Button", "StatusButton"]) {
  for (const attr of ["Icon", ...family.iconSizeAttrs]) {
    assert.ok(!(required[type] || []).includes(attr), `${type} 不含图标字段，不得登记 ${attr}`);
  }
}
assert.ok(!JSON.stringify(map).includes("无图标槽位时不发射"),
  "映射表描述不得保留「无图标槽位时不发射」——与 controlTypeRequiredAttrs 的空字符串占位口径相反");

// ---------- 2. 脚本内置默认 == 映射表（防止三处各写一份后漂移） ----------
function objectLiteralOf(source, constName) {
  const match = source.match(new RegExp("const " + constName + "\\s*=\\s*\\{([\\s\\S]*?)\\n\\};"));
  assert.ok(match, `源码中必须存在 const ${constName} = { ... }`);
  return match[1];
}

function arrayFields(chunk) {
  const result = {};
  const re = /([A-Za-z_][\w]*)\s*:\s*\[([^\]]*)\]/g;
  let match;
  while ((match = re.exec(chunk))) {
    result[match[1]] = match[2].split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  }
  return result;
}

const sameList = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

for (const [file, source, constName] of [
  ["gen-iocontrol-xml.js", generator, "DEFAULT_BUTTON_FAMILY"],
  ["validate-iocontrol-provenance.js", validator, "DEFAULT_BUTTON_FAMILY_RULES"],
]) {
  const defaults = arrayFields(objectLiteralOf(source, constName));
  for (const [key, value] of Object.entries(defaults)) {
    assert.ok(sameList(value, family[key] || []),
      `${file} 的 ${constName}.${key} 与映射表 buttonFamily.${key} 漂移: ${JSON.stringify(value)} vs ${JSON.stringify(family[key])}`);
  }
}

for (const [type, attrs] of Object.entries(arrayFields(objectLiteralOf(generator, "DEFAULT_CONTROL_TYPE_REQUIRED_ATTRS")))) {
  assert.ok(required[type] && sameList(attrs, required[type]),
    `gen-iocontrol-xml.js 的 DEFAULT_CONTROL_TYPE_REQUIRED_ATTRS.${type} 与映射表 controlTypeRequiredAttrs.${type} 漂移`);
}

// ---------- 3. 文档格式 Skill 与映射表同口径 ----------
const exceptionLine = skillLines(docFormat).find((line) => line.startsWith("例外：按钮族"));
assert.ok(exceptionLine, "文档格式 Skill 必须保留按钮族例外段");
for (const attr of [...family.alwaysWrittenAttrs, "Icon", ...family.iconSizeAttrs]) {
  assert.ok(exceptionLine.includes("`" + attr + "`"),
    `文档格式 Skill 的按钮族例外段必须逐项登记固定字段 ${attr}`);
}
assert.ok(exceptionLine.includes("写空字符串值"), "按钮族例外段必须写明取不到来源时写空字符串值");
assert.ok(!docFormat.includes("没有图标槽位时不发射"),
  "文档格式 Skill 不得保留「没有图标槽位时不发射」——与映射表/生成器的空字符串占位口径相反");

const iconRuleLine = skillLines(docFormat)
  .find((line) => line.startsWith("- ") && line.includes("IconWidth") && line.includes("无图标槽位时写空字符串值"));
assert.ok(iconRuleLine, "文档格式 Skill 的特殊规则必须按映射表写明无图标槽位时写空字符串值");
assert.ok(iconRuleLine.includes("IconHeight"), "特殊规则的图标字段规则必须同时覆盖 IconWidth / IconHeight");

// ---------- 4. 主 Skill 与生成器注释不得留下相反表述 ----------
assert.ok(!mainSkill.includes('不得写 `Icon=""`'), "主 Skill 不得保留可两读的否定写法");
assert.ok(mainSkill.includes("模板不含图标字段时不写"), "主 Skill 必须写明模板不含图标字段时不写这三项");
assert.ok(mainSkill.includes("没有图标槽位时仍按必写字段发射空字符串占位"),
  "主 Skill 必须写明 IconButton 无图标槽位时仍发射空字符串占位");
assert.ok(!generator.includes("都不发射"), "生成器注释不得保留「无图标槽位时都不发射」的旧口径");

console.log("PASS 按钮族固定字段单一真值源（映射表 ↔ 脚本默认 ↔ 两份 Skill）一致性回归测试");
