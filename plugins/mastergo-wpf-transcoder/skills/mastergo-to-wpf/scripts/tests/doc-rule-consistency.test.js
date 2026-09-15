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

// ---------- TextBlock FontWeight：映射表是唯一真值源，正文只引用不另立枚举 ----------
// 背景：该规则曾在「映射表 note + 两份正文（SKILL.md / mtslg-mode.md）+ 生成器内置默认」四处
// 各写一份 normal 名单，2026-09-15 的 CI 语义审计连续两轮以 REVIEW 报出「正文枚举漏项 / 口径两读」。
const fontWeightRule = map.textBlockFontWeight;
assert.ok(fontWeightRule, "映射表必须登记 textBlockFontWeight 规则");
assert.strictEqual(fontWeightRule.attr, "FontWeight", "textBlockFontWeight.attr 必须是 FontWeight");
assert.deepStrictEqual(fontWeightRule.controlTypes, ["TextBlock"], "FontWeight 规则只作用于 TextBlock");
assert.ok(Array.isArray(fontWeightRule.normalStyleNames) && fontWeightRule.normalStyleNames.length > 0,
  "必须登记 normalStyleNames（设计稿字体样式名里的正常体写法）");
assert.ok(Array.isArray(fontWeightRule.normalValues) && fontWeightRule.normalValues.length > 0,
  "必须登记 normalValues（样式名缺失时回退判定用的 weight 值）");
assert.ok(typeof fontWeightRule.fallbackValueSource === "string" && fontWeightRule.fallbackValueSource,
  "必须登记 fallbackValueSource（样式名取不到时的回退来源）");
// 允许集必须放开 FontWeight；但它是「命中才写」，不得进入恒写集合。
assert.ok((map.controlTypes.TextBlock.attrs || []).includes("FontWeight"),
  "controlTypes.TextBlock.attrs 必须允许 FontWeight");
assert.ok(!(required.TextBlock || []).includes("FontWeight"),
  "FontWeight 是命中才写的条件属性，不得进入 controlTypeRequiredAttrs 恒写集合");
// 映射生成器必须从映射表读规则并实现「样式名优先 + weight 回退」；
// 发射器只需把 FontWeight 纳入固定属性顺序（值由 mapping 携带）。
const fontGenerator = fs.readFileSync(path.join(__dirname, "..", "gen-mtslg-mapping-from-dsl.js"), "utf8");
assert.ok(fontGenerator.includes("textBlockFontWeight") && fontGenerator.includes("designFontStyleName"),
  "映射生成器必须消费 textBlockFontWeight 并解析设计稿字体样式名（designFontStyleName）");
assert.ok(/ATTR_ORDER[\s\S]{0,600}FontWeight/.test(generator),
  "gen-iocontrol-xml.js 的 ATTR_ORDER 必须包含 FontWeight（属性顺序：FontSize → FontWeight → Width/Height）");
// 三份人读文档必须写 FontWeight 并指向真值源，不得再抄一份 normal 名单（那是历史漂移点）。
for (const [label, text] of [
  ["SKILL.md", mainSkill],
  ["mtslg-mode.md", modeDoc],
  ["feishu-component-library-mapping.md", feishuMapping],
]) {
  assert.ok(text.includes("FontWeight"), label + " 必须登记 FontWeight 规则");
  assert.ok(text.includes("normalStyleNames"), label + " 必须指向映射表的 normalStyleNames，不得另立 normal 名单枚举");
  assert.ok(!text.includes("`Regular`/`Normal`/`Book`/`常规体`/`常规`"),
    label + " 不得再硬编码已漂移过的 normal 名单枚举，改用 normalStyleNames 指真值源");
}

// ---------- 相机视口（cameraTemplates）：Camera 不写 Style、字段集固定 ----------
const cameraFamily = map.cameraTemplates;
assert.ok(cameraFamily && cameraFamily.variants, "映射表必须登记 cameraTemplates.variants");
assert.strictEqual(cameraFamily.stylePolicy, "none", "相机族必须声明 stylePolicy=none（不发射 Style）");
assert.strictEqual(cameraFamily.innerCandidatePolicy, "never",
  "相机族只认实例自身名，禁止用内部实例子节点名当候选（否则页面根会被误判成 Camera）");
assert.ok(Object.keys(cameraFamily.variants).length > 0, "相机族至少要登记一个组件集");
for (const [name, spec] of Object.entries(cameraFamily.variants)) {
  assert.strictEqual(spec.componentSet, name, "相机变体的 componentSet 必须等于组件集名: " + name);
  assert.strictEqual(spec.controlType, "Camera", "相机变体必须发射 ControlType=Camera: " + name);
  assert.strictEqual(spec.style, null, "相机变体不得登记 Style: " + name);
}
assert.ok(!(required.Camera || []).includes("Style"), "Camera 的恒写字段集不得包含 Style");
for (const attr of ["DesignPanelID", "Value"]) {
  assert.ok((required.Camera || []).includes(attr), "Camera 恒写字段必须包含 " + attr);
}
assert.ok((map.controlTypes.Camera.attrs || []).includes("DesignPanelID"), "controlTypes.Camera 必须允许 DesignPanelID");
assert.ok(feishuMapping.includes("cameraTemplates"), "人读映射文档必须登记相机族（cameraTemplates）");
// 相机视口内部文本的处置必须显式登记，且 omit 角色要在校验器里放行（否则内部文本会漏成根级 TextBlock）。
assert.ok(cameraFamily.innerTextPolicy && cameraFamily.innerTextPolicy.role,
  "相机族必须登记 innerTextPolicy.role（内部文本整体 omit 的角色）");
assert.strictEqual(cameraFamily.innerTextPolicy.decision, "omit", "相机内部文本必须 decision=omit");
assert.ok(validator.includes("'" + cameraFamily.innerTextPolicy.role + "'"),
  "相机内部文本的 omit 角色必须登记进 validate-iocontrol-provenance.js 的 OMIT_ROLES: " + cameraFamily.innerTextPolicy.role);
assert.ok(mainSkill.includes(cameraFamily.innerTextPolicy.role),
  "SKILL.md 的可见性映射边界必须写明相机内部文本的 omit 角色");
assert.ok(fontGenerator.includes("innerTextPolicy"),
  "映射生成器必须按 innerTextPolicy 消费/omit 相机内部文本");
// innerTextPolicy 的每个字段都必须被生成器真正消费（禁止"登记了但没人读"）。
for (const field of ["innerTextPolicy.decision", "innerTextPolicy.role"]) {
  const token = field.split(".")[1];
  assert.ok(fontGenerator.includes("innerPolicy." + token),
    "映射生成器必须读取 " + field + "（登记字段必须是行为真值源）: " + token);
}
// SKILL.md 的 omit 说明必须指向 OMIT_ROLES 真值源，并列出集合里的全部角色（避免封闭清单与指针两读）。
const omitRolesMatch = /const OMIT_ROLES = \[([^\]]+)\]/.exec(validator);
assert.ok(omitRolesMatch, "必须能在校验器里读到 OMIT_ROLES 定义");
for (const role of omitRolesMatch[1].split(",").map((item) => item.trim().replace(/^'|'$/g, "")).filter(Boolean)) {
  assert.ok(mainSkill.includes(role), "SKILL.md 的 omit 说明必须列出 OMIT_ROLES 里的角色: " + role);
}
// hidden 是第二条 omit 路径（OMIT_REASONS = ['hidden', ...OMIT_ROLES]），SKILL.md 必须同时写清，
// 不能把 omit 说成只由 OMIT_ROLES 决定。
assert.ok(/const OMIT_REASONS = \['hidden'\]\.concat\(OMIT_ROLES\)/.test(validator),
  "校验器必须保持 OMIT_REASONS = ['hidden'].concat(OMIT_ROLES) 的定义");
assert.ok(mainSkill.includes("OMIT_REASONS") && mainSkill.includes("hidden"),
  "SKILL.md 的 omit 说明必须写明 hidden 这条路径（omitReason='hidden' 登记在 OMIT_REASONS）");

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

// ---------- 7. ViewModel 按钮处理方法名：人读文档口径 ↔ 宿主壳脚本实现必须同步 ----------
// 规则真值源只有两处：page-shell-generator.md 的「按钮处理方法（一钮一方法）」+ gen-mw-wpf-page.js。
// 背景：方法名曾在文档里只写「case 骨架」、脚本也只发内联 TODO；新增一钮一方法后若只改一处，
// 就会出现「文档说调用方法、脚本还在发 TODO」的两读。
const SHELL_DOC = path.join(__dirname, "..", "..", "references", "adapters", "mw-wpf", "page-shell-generator.md");
const shellDoc = fs.readFileSync(SHELL_DOC, "utf8");
const hostGenerator = fs.readFileSync(path.join(__dirname, "..", "gen-mw-wpf-page.js"), "utf8");
assert.ok(shellDoc.includes("按钮处理方法（一钮一方法）"), "页面壳文档必须登记「按钮处理方法（一钮一方法）」小节");
for (const token of ["langName", "MenuItem", "MenuItemIndex"]) {
  assert.ok(shellDoc.includes(token), "页面壳文档必须写明按钮方法名取值链里的 " + token);
}
// 清单里没有独立的方法名字段：方法名只从 langName（LanguageKey）派生。
assert.ok(!shellDoc.includes("methodName"), "页面壳文档不得再出现清单字段 methodName（方法名只从 langName 派生）");
assert.ok(!hostGenerator.includes("item.methodName"), "宿主壳生成器不得读取清单的 methodName 字段");
assert.ok(hostGenerator.includes("resolveMethodNameFromLangName") && hostGenerator.includes("resolveButtonHandlers"),
  "宿主壳生成器必须实现按钮方法名解析（resolveMethodNameFromLangName / resolveButtonHandlers）");
assert.ok(hostGenerator.includes('const MENU_KEY_PREFIX = "MenuItem"'),
  "方法名派生必须以菜单键前缀 MenuItem 为界（langName 去前缀 = 按钮英文语义名）");
assert.ok(hostGenerator.includes("PROVISIONAL_MENU_KEY"),
  "临时键 MenuItemIndex<n> 必须显式排除，不得当作按钮英文名");
// 取名步骤只有「是否带 MenuItem 前缀」一条：带前缀去前缀、不带前缀取整键（scope 不参与）；
// 临时键检查必须写在去前缀之前（否则 MenuItemIndex3 会派生出 Index3）。
assert.ok(hostGenerator.includes("=== 0 ? key.slice(MENU_KEY_PREFIX.length) : key"),
  "带 MenuItem 前缀时去前缀，不带前缀时取整键");
assert.ok(!shellDoc.includes("共享键直接取整键"),
  "文档不得把 scope=shared 写成独立分支（共享键通常也带 MenuItem 前缀）");
assert.ok(shellDoc.includes("这一检查发生在取名之前"),
  "文档必须写明临时键检查发生在取名（去前缀）之前");
assert.ok(shellDoc.includes("一共四类"),
  "文档必须写明退回内联 TODO 一共四类（与 reason 一一对应）");
for (const item of ["没有 `langName`", "MenuItemIndex<n>", "不是合法 C# 标识符", "命中 C# 关键字"]) {
  assert.ok(shellDoc.includes(item), "退回内联 TODO 的清单必须写明: " + item);
}
// 文档声称四条「与审计 reason 一一对应」：脚本必须真的给出四条不同 reason 文案。
for (const reason of ["该菜单项没有 LangName", "是临时键 MenuItemIndex<n>", "不是合法 C# 标识符", "派生出的是 C# 关键字"]) {
  assert.ok(hostGenerator.includes(reason), "脚本必须为退回情形写出对应 reason: " + reason);
}
assert.ok(hostGenerator.includes('"        private void " + item.method + "()"'),
  "宿主壳生成器必须发射 private void <方法名>() 处理方法骨架");
assert.ok(hostGenerator.includes("inlineTodoCases"),
  "解析不出方法名的按钮必须退回内联 TODO，并登记进审计 inlineTodoCases");
// 固定成员清单在文档与脚本两侧必须逐项一致（CI 语义审计 REVIEW-001：只查字符串存在不足以防漂移）。
const reservedFromDoc = (function () {
  const marker = "与 ViewModel 固定成员同名（";
  const start = shellDoc.indexOf(marker);
  assert.ok(start >= 0, "文档必须写明「与 ViewModel 固定成员同名」的撞名口径");
  const end = shellDoc.indexOf("）", start + marker.length);
  return shellDoc.slice(start + marker.length, end).split("/")
    .map(function (item) { return item.trim().replace(/`/g, ""); })
    .filter(Boolean);
})();
const reservedFromScript = arrayLiteralOf(hostGenerator, "RESERVED_VIEWMODEL_MEMBERS");
assert.ok(sameList(reservedFromDoc, reservedFromScript),
  "文档列出的 ViewModel 固定成员必须与 RESERVED_VIEWMODEL_MEMBERS 逐项一致: " +
  JSON.stringify(reservedFromDoc) + " vs " + JSON.stringify(reservedFromScript));
assert.ok(shellDoc.includes("ViewModel 类名"), "文档必须写明与 ViewModel 类名同名的口径");
assert.ok(hostGenerator.includes("method === viewModelName"),
  "宿主壳生成器必须把 ViewModel 类名一并当保留名处理");
// 撞名提示里的 langName 来源清单必须与文档一致（图标资源名 / 术语表 / 英文译文）。
for (const source of ["图标资源名", "术语表 langGlossary", "该文案的英文译文"]) {
  assert.ok(hostGenerator.includes(source), "撞名提示必须列出 langName 来源: " + source);
  assert.ok(shellDoc.includes(source.replace(" langGlossary", "")), "文档必须写明 langName 来源: " + source);
}
// 一钮一方法的记法必须在文档里写明（避免把 ViewModel 侧又改回静态 TODO 骨架或加多余门禁）。
assert.ok(shellDoc.includes("一个按钮 = 一个 `case` = 一个处理方法"),
  "文档必须写明「一个按钮 = 一个 case = 一个处理方法」");
// 撞名口径：文档写「直接失败」，脚本就必须真失败（不能只写文档、也不能静默改名/静默退回）。
assert.ok(shellDoc.includes("撞名是输入错误，直接失败"),
  "文档必须写明方法名撞名（固定成员/类名/同页按钮）是输入错误、直接失败");
assert.ok(hostGenerator.includes("RESERVED_VIEWMODEL_MEMBERS"),
  "宿主壳生成器必须登记 ViewModel 固定成员集合（撞名直接失败）");
assert.ok(hostGenerator.includes("与 ViewModel 成员同名") && hostGenerator.includes("两个按钮算出同一个处理方法名"),
  "宿主壳生成器必须对固定成员撞名与同页按钮撞名两条都直接失败");

console.log("PASS 按钮族固定字段单一真值源（映射表 ↔ 脚本默认 ↔ 两份 Skill ↔ 两份人读参考）一致性回归测试");
console.log("PASS ViewModel 按钮处理方法名口径（page-shell-generator.md ↔ gen-mw-wpf-page.js）");
console.log("PASS 已作废表述（父节点语义匹配键 / parentVariants）插件根 .md 扫描");
