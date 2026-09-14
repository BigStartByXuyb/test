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
const FEISHU_MAPPING = path.join(__dirname, "..", "..", "references", "adapters", "mtslg-iocontrol", "feishu-component-library-mapping.md");
const MODE_DOC = path.join(__dirname, "..", "..", "references", "adapters", "mtslg-iocontrol", "mtslg-mode.md");

const map = JSON.parse(fs.readFileSync(MAP, "utf8"));
const docFormat = fs.readFileSync(DOC_FORMAT_SKILL, "utf8");
const mainSkill = fs.readFileSync(MAIN_SKILL, "utf8");
const generator = fs.readFileSync(GENERATOR, "utf8");
const validator = fs.readFileSync(VALIDATOR, "utf8");
const feishuMapping = fs.readFileSync(FEISHU_MAPPING, "utf8");
const modeDoc = fs.readFileSync(MODE_DOC, "utf8");

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
// 图标三件套必须全有或全无：避免出现「登记了 IconWidth 却没登记 Icon」这类半套模板。
for (const [type, attrs] of Object.entries(required)) {
  if (type.startsWith("_") || !Array.isArray(attrs)) continue;
  const flags = ["Icon", ...family.iconSizeAttrs].map((attr) => attrs.includes(attr));
  assert.ok(flags.every(Boolean) || flags.every((hit) => !hit),
    `${type} 的图标字段必须全有或全无: ${JSON.stringify(attrs)}`);
}
assert.ok(!JSON.stringify(map).includes("无图标槽位时不发射"),
  "映射表描述不得保留「无图标槽位时不发射」——与 controlTypeRequiredAttrs 的空字符串占位口径相反");

// ---------- 2. 脚本内置默认 == 映射表（防止三处各写一份后漂移） ----------
function objectLiteralOf(source, constName) {
  const match = source.match(new RegExp("const " + constName + "\\s*=\\s*\\{([\\s\\S]*?)\\n\\};"));
  assert.ok(match, `源码中必须存在 const ${constName} = { ... }`);
  return match[1];
}

function splitList(text) {
  return text.split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
}

function arrayFields(chunk) {
  const result = {};
  const re = /([A-Za-z_][\w]*)\s*:\s*\[([^\]]*)\]/g;
  let match;
  while ((match = re.exec(chunk))) {
    result[match[1]] = splitList(match[2]);
  }
  return result;
}

function arrayLiteralOf(source, constName) {
  const match = source.match(new RegExp("const " + constName + "\\s*=\\s*\\[([^\\]]*)\\]"));
  assert.ok(match, `源码中必须存在 const ${constName} = [ ... ]`);
  return splitList(match[1]);
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

// 「哪些 ControlType 的模板含图标字段」在三处必须是同一个集合：映射表、生成器内置默认、
// 校验器无模板信息时的内置口径。任一处漏改都会让两条门禁对同一映射给出相反结论。
const iconTemplateTypes = Object.entries(required)
  .filter(([type, attrs]) => !type.startsWith("_") && Array.isArray(attrs) && attrs.includes("Icon"))
  .map(([type]) => type).sort();
const generatorIconTemplateTypes = Object.entries(arrayFields(objectLiteralOf(generator, "DEFAULT_CONTROL_TYPE_REQUIRED_ATTRS")))
  .filter(([, attrs]) => attrs.includes("Icon")).map(([type]) => type).sort();
const validatorFallbackTypes = arrayLiteralOf(validator, "DEFAULT_ICON_TEMPLATE_CONTROL_TYPES");
assert.deepStrictEqual(generatorIconTemplateTypes, iconTemplateTypes,
  "生成器内置默认中「模板含图标字段」的 ControlType 集合必须与映射表一致");
assert.deepStrictEqual(validatorFallbackTypes, iconTemplateTypes,
  "校验器无模板信息时的内置图标口径必须与映射表「模板含图标字段」的集合一致");

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

// ---------- 5. 两份人读参考文档的口径不得与映射表相反 ----------
for (const [file, source] of [
  ["feishu-component-library-mapping.md", feishuMapping],
  ["mtslg-mode.md", modeDoc],
]) {
  const contradicted = skillLines(source).filter((line) => line.includes("无图标槽位时不发射"));
  assert.deepStrictEqual(contradicted, [], `${file} 不得保留「无图标槽位时不发射」的旧口径`);
  const stated = skillLines(source).filter((line) => line.includes("无图标槽位时") && line.includes("空字符串"));
  assert.ok(stated.length > 0, `${file} 必须写明「无图标槽位时…空字符串」`);
}

// ---------- 6. 已作废表述不得在文档里残留；关键文档必须写明新口径 ----------
// 背景：口径迁移（例如「父节点语义不再作为匹配键」）要改 5~6 份文档，只改一处就会被 CI 判矛盾。
// 这里把"已作废表述"和"必须出现的新口径"都变成字符串断言，本地跑一次就知道有没有漏改。
// 覆盖范围：插件根目录下的全部 .md（不含仓库外的快照文档）。
const PLUGIN_ROOT = path.join(__dirname, "..", "..", "..", "..");
const RETIRED_PHRASES = [
  "父节点语义 + 公开属性名",
  "追加父节点语义",
  "才使用“完整父节点语义",
  "parentVariants",
];
const RETIRED_EXEMPT = /已作废|不作为匹配键|不是匹配键|不参与匹配|不得使用/;
const mdFiles = fs.readdirSync(PLUGIN_ROOT, { recursive: true })
  .filter((entry) => String(entry).endsWith(".md"))
  .map((entry) => path.join(PLUGIN_ROOT, String(entry)));
assert.ok(mdFiles.length > 0, "必须能在插件根下枚举到文档");
for (const file of mdFiles) {
  skillLines(fs.readFileSync(file, "utf8")).forEach((line, index) => {
    for (const phrase of RETIRED_PHRASES) {
      if (!line.includes(phrase)) continue;
      assert.ok(RETIRED_EXEMPT.test(line),
        `${path.relative(PLUGIN_ROOT, file)}:${index + 1} 出现已作废表述「${phrase}」，须改成新口径或显式标注已作废`);
    }
  });
}

const MUST_STATE_NO_PARENT_MATCH_KEY = [
  "skills/mastergo-to-wpf/SKILL.md",
  "skills/mastergo-iocontrol-document-format/SKILL.md",
  "skills/mastergo-to-wpf/references/mastergo-component-mapping-rules.md",
  "skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/mtslg-mode.md",
  "skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/feishu-component-library-mapping.md",
];
for (const rel of MUST_STATE_NO_PARENT_MATCH_KEY) {
  const text = fs.readFileSync(path.join(PLUGIN_ROOT, rel), "utf8");
  const stated = skillLines(text).some((line) =>
    line.includes("父节点语义") && /不作为匹配键|不是匹配键|不参与匹配/.test(line));
  assert.ok(stated,
    `${rel} 必须有一句同时出现「父节点语义」与「不作为匹配键 / 不是匹配键 / 不参与匹配」`);
}

console.log("PASS 按钮族固定字段单一真值源（映射表 ↔ 脚本默认 ↔ 两份 Skill ↔ 两份人读参考）一致性回归测试");
console.log("PASS 已作废表述（父节点语义匹配键 / parentVariants）插件根 .md 扫描");
