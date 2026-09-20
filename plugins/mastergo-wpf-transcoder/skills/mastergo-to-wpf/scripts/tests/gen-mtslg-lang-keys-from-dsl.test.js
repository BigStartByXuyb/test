#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "gen-mtslg-lang-keys-from-dsl.js");
const LANG = require(path.join(__dirname, "..", "gen-mtslg-page-lang.js"));
const KEYS = require(script);

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mtslg-lang-keys-"));
const write = (name, data) => {
  const file = path.join(root, name);
  fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
  return file;
};

// 目标项目已登记语言字典：一个 CN 文件 + 一个 EN 文件。
const catalogCn = write("Client_CN.xaml", [
  '<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
  '                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
  '                    xmlns:sys="clr-namespace:System;assembly=mscorlib">',
  '    <sys:String x:Key="PCHeaderSoftwareVersion">软件版本</sys:String>',
  '    <sys:String x:Key="MenuItemParamMaintain">参数维护</sys:String>',
  '    <sys:String x:Key="CommonOK">确定</sys:String>',
  "    <!--<sys:String x:Key=\"LegacyRemoved\">已废弃</sys:String>-->",
  "</ResourceDictionary>",
  ""
].join("\n"));
const catalogEn = write("Client_EN.xaml", [
  '<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
  '                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
  '                    xmlns:sys="clr-namespace:System;assembly=mscorlib">',
  '    <sys:String x:Key="PCHeaderSoftwareVersion">Software Version</sys:String>',
  '    <sys:String x:Key="MenuItemParamMaintain">Parameter</sys:String>',
  '    <sys:String x:Key="CommonOK">OK</sys:String>',
  "</ResourceDictionary>",
  ""
].join("\n"));

const mapping = {
  contentOriginY: 192,
  rootRef: "p",
  textAudit: [{ sourceRef: "p/1158:1", sourceText: "配方管理", role: "page-title", decision: "omit" }],
  nodes: [
    // IconButton：语义名来自 Icon 资源名。
    { sourceRef: "p/btn-auto", controlType: "IconButton", sourceText: "全自动操作", valueSource: "dsl.text", attrs: { Value: "全自动操作", Icon: "AutoOperationGeometry" } },
    // 步骤按钮：正负号短标签必须生成语言键，不能被当成动态值。
    { sourceRef: "p/btn-plus5", controlType: "Button", sourceText: "+5", valueSource: "dsl.text", attrs: { Value: "+5" } },
    { sourceRef: "p/btn-minus5", controlType: "Button", sourceText: "-5", valueSource: "dsl.text", attrs: { Value: "-5" } },
    // 与目标项目字典同文案 → 复用已登记 key，并且 English 用真实翻译。
    { sourceRef: "p/tb-version", controlType: "TextBlock", sourceText: "软件版本", valueSource: "dsl.text", attrs: { Value: "软件版本" } },
    // 命中的是 MenuItem 命名空间的键 → 页面内容不得借用，退回 Icon 派生。
    { sourceRef: "p/btn-param", controlType: "IconButton", sourceText: "参数维护", valueSource: "dsl.text", attrs: { Value: "参数维护", Icon: "ParameterMaintenanceGeometry" } },
    // 同一共享文案出现两次 → 一个 key 绑定两个节点。
    { sourceRef: "p/tb-ok-a", controlType: "TextBlock", sourceText: "确定", valueSource: "dsl.text", attrs: { Value: "确定" } },
    { sourceRef: "p/tb-ok-b", controlType: "TextBlock", sourceText: "确定", valueSource: "dsl.text", attrs: { Value: "确定" } },
    // 同页同文案 → 共用一个 key（其余节点写入 sourceRefs）。
    { sourceRef: "p/btn-dup-a", controlType: "IconButton", sourceText: "设备维护", valueSource: "dsl.text", attrs: { Value: "设备维护", Icon: "DeviceMaintenanceGeometry" } },
    { sourceRef: "p/btn-dup-b", controlType: "IconButton", sourceText: "设备维护", valueSource: "dsl.text", attrs: { Value: "设备维护", Icon: "DeviceMaintenanceGeometry" } },
    // 不同文案但派生出的语义名相同 → 仍需要稳定数字后缀，不静默覆盖。
    { sourceRef: "p/btn-collide", controlType: "IconButton", sourceText: "维护设置", valueSource: "dsl.text", attrs: { Value: "维护设置", Icon: "DeviceMaintenanceGeometry" } },
    // 纯 ASCII 文案：没有 Icon 也要有语义名。
    { sourceRef: "p/tb-aux", controlType: "TextBlock", sourceText: "AUX.", valueSource: "dsl.text", attrs: { Value: "AUX." } },
    // 兜底：中文 + 无 Icon + 图层名不可用。
    { sourceRef: "p/tb-unknown", controlType: "TextBlock", sourceText: "工件边缘录入", valueSource: "dsl.text", attrs: { Value: "工件边缘录入" } },
    // 数值/型号类文本：全量多语言下照常产键（EN 值等于原文），并逐条留档在 identicalTextKeys。
    { sourceRef: "p/tb-sn", controlType: "TextBlock", sourceText: "4830259438956554", valueSource: "dsl.text", attrs: { Value: "4830259438956554" } },
    { sourceRef: "p/tb-ver2", controlType: "TextBlock", sourceText: "1.0.11.2222222", valueSource: "dsl.text", attrs: { Value: "1.0.11.2222222" } },
    { sourceRef: "p/tb-model", controlType: "TextBlock", sourceText: "DFL7362", valueSource: "dsl.text", attrs: { Value: "DFL7362" } },
    { sourceRef: "p/tb-pct", controlType: "TextBlock", sourceText: "9.0%", valueSource: "dsl.text", attrs: { Value: "9.0%" } },
    { sourceRef: "p/tb-hotkey", controlType: "TextBlock", sourceText: "F1", valueSource: "dsl.text", attrs: { Value: "F1" } },
    // 非 dsl.text 的节点不参与语言键派生。
    { sourceRef: "p/cam", controlType: "Camera", sourceText: "相机", valueSource: "dsl.name", attrs: {} },
    // 组件级固定语言键（映射表 langPolicy=fixed）：key 与文案都来自映射表登记。
    { sourceRef: "p/btn-enter", controlType: "IconButton", sourceText: "ENTER", valueSource: "dsl.text",
      attrs: { Value: "ENTER", Icon: "EnterGeometry" },
      fixedLang: { keyTemplate: "{page}Enter", text: { CN: "ENTER", EN: "ENTER" } } },
    // 同一个固定变体在设计文本缺失时（valueSource 非 dsl.text、无 sourceText）仍必须产键——
    // 固定键不依赖设计文本，这正是「设计稿只提供几何」场景。
    { sourceRef: "p/btn-exit", controlType: "IconButton", valueSource: null,
      attrs: { Value: "", Icon: "ExitGeometry" },
      fixedLang: { keyTemplate: "{page}Exit", text: { CN: "EXIT", EN: "EXIT" } } },
    // 选择框（ComboBox）：映射表槽位登记 langRefPolicy=none —— Value 是「默认选中的名称」，
    // 运行时由 IOName 数据决定，不是要翻译的固定文案：既不产语言键，也不占用 noLangRefs 通道。
    { sourceRef: "p/cb-direction", controlType: "ComboBox", sourceText: "后向", valueSource: "dsl.text",
      langRefPolicy: "none", attrs: { Value: "后向", ControlType: "ComboBox" } },
    { sourceRef: "p/cb-mode", controlType: "ComboBox", sourceText: "AUTO", valueSource: "dsl.text",
      langRefPolicy: "none", attrs: { Value: "AUTO", ControlType: "ComboBox" } }
  ]
};
const mappingPath = write("mapping.json", mapping);

const dsl = {
  dsl: {
    nodes: [{
      type: "INSTANCE",
      id: "p",
      name: "配方管理",
      children: [
        { type: "TEXT", id: "p/btn-param/1371:1", name: "参数维护", children: [] },
        { type: "TEXT", id: "p/tb-unknown", name: "Group 2525", children: [] }
      ]
    }]
  }
};
const dslPath = write("dsl.snapshot.json", dsl);

const layoutManifest = {
  menuItems: [
    { sourceRef: "m/1", name: "参数维护", icon: "ParameterMaintainGeometry", index: 1 },
    { sourceRef: "m/2", name: "AUX.", icon: "", index: 2 },
    { sourceRef: "m/3", name: "", icon: "", index: 3 }
  ]
};
const layoutPath = write("layout-manifest.json", layoutManifest);

// AI/工程师产出的英文译文清单：脚本只机械套用，不做翻译。
const translationsPath = write("translations.json", {
  "配方管理": "Recipe Management",
  "全自动操作": "Full Auto Operation",
  "工件边缘录入": "Workpiece Edge Teaching"
});

const outPath = path.join(root, "lang.json");
const reportPath = path.join(root, "lang.report.json");
const run = spawnSync(process.execPath, [
  script,
  "--page", "DemoRecipe",
  "--mapping", mappingPath,
  "--dsl", dslPath,
  "--layout-manifest", layoutPath,
  "--key-catalog", catalogCn,
  "--key-catalog", catalogEn,
  "--translations", translationsPath,
  "--out", outPath,
  "--report", reportPath
], { encoding: "utf8" });
assert.strictEqual(run.status, 0, run.stderr);

const languages = JSON.parse(fs.readFileSync(outPath, "utf8"));
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const keys = new Map(languages.keys.map((entry) => [entry.key, entry]));
const keyByRef = new Map();
for (const entry of languages.keys) {
  const refs = [];
  if (entry.sourceRef) refs.push(entry.sourceRef);
  if (Array.isArray(entry.sourceRefs)) refs.push(...entry.sourceRefs);
  for (const ref of refs) keyByRef.set(ref, entry.key);
}
const emittedKeys = languages.keys.map((entry) => entry.key).join(", ");

// 1) 页面标题：命名约定固定，文案来自 textAudit 的 page-title。
assert.strictEqual(languages.keys[0].key, "DemoRecipePageTitle");
assert.strictEqual(languages.keys[0].role, "page-title");
assert.strictEqual(languages.keys[0].text.CN, "配方管理");
assert.strictEqual(languages.keys[0].text.EN, "Recipe Management", "标题译文来自 translations");

// 2) 菜单项：目标项目已登记 MenuItem 键优先复用；没有登记时用 Icon 派生名或 ASCII 文案；空名称不产键。
assert.ok(keys.has("MenuItemParamMaintain"), "MenuItem 应复用目标项目已登记的菜单键");
assert.strictEqual(keys.get("MenuItemParamMaintain").menuIndex, 1);
assert.strictEqual(keys.get("MenuItemParamMaintain").text.EN, "Parameter", "复用登记键时同时采用其英文文案");
assert.ok(keys.has("MenuItemAUX"), "没有 Icon 的菜单项应回退到 ASCII 文案");
assert.ok(!languages.keys.some((entry) => entry.menuIndex === 3), "空名称菜单项不产键");

// 3) 内容节点：Icon 派生、ASCII 派生、值字面编码（数值/符号）、兜底临时键——全量多语言下都要产键。
assert.strictEqual(keyByRef.get("p/btn-auto"), "DemoRecipeAutoOperation");
assert.strictEqual(keyByRef.get("p/tb-aux"), "DemoRecipeAUX");
// 「工件边缘录入」没有图标、没有术语表项，但有英文译文 → 用译文转 PascalCase 当语义名。
assert.strictEqual(keyByRef.get("p/tb-unknown"), "DemoRecipeWorkpieceEdgeTeaching",
  "无图标无术语表但有译文时，必须用译文派生语义名（而不是 Text03 临时键）");
assert.ok(!keys.has("p/cam"), "非 dsl.text 节点不产键");
assert.strictEqual(keys.get("DemoRecipeAutoOperation").text.EN, "Full Auto Operation",
  "内容节点译文来自 translations");
assert.strictEqual(keys.get("DemoRecipeWorkpieceEdgeTeaching").text.EN, "Workpiece Edge Teaching",
  "译文派生键同样必须有真实译文");
assert.ok(report.sources.translated >= 1, "报告必须记录译文派生（sources.translated）");
assert.ok(!report.provisionalKeys.some((item) => item.text === "工件边缘录入"),
  "有译文时不得再落到临时键");

// 4) 目标项目已登记 key：内容节点复用（scope=shared），MenuItem 命名空间不得被内容节点借用。
assert.strictEqual(keyByRef.get("p/tb-version"), "PCHeaderSoftwareVersion");
assert.strictEqual(keys.get("PCHeaderSoftwareVersion").scope, "shared");
assert.strictEqual(keys.get("PCHeaderSoftwareVersion").text.EN, "Software Version", "已有真实英文时直接采用");
assert.ok(!report.pendingTranslations.some((item) => item.key === "PCHeaderSoftwareVersion"),
  "有真实英文时不应标记待翻译");
assert.strictEqual(keyByRef.get("p/btn-param"), "DemoRecipeParameterMaintenance",
  "内容节点不得复用 MenuItem 命名空间的键，应退回 Icon 派生");

// 5) 同一共享文案出现两次 → 一个 key 绑定多个节点。
assert.strictEqual(keyByRef.get("p/tb-ok-a"), "CommonOK", "keys=" + emittedKeys);
assert.strictEqual(keyByRef.get("p/tb-ok-b"), "CommonOK", "keys=" + emittedKeys);
assert.deepStrictEqual(keys.get("CommonOK").sourceRefs, ["p/tb-ok-a", "p/tb-ok-b"]);

// 6) 同页同文案 → 共用一个 LanguageKey，其余节点登记进 sourceRefs（不产生 Xxx2 重复键）。
assert.strictEqual(keyByRef.get("p/btn-dup-a"), "DemoRecipeDeviceMaintenance");
assert.strictEqual(keyByRef.get("p/btn-dup-b"), "DemoRecipeDeviceMaintenance");
assert.deepStrictEqual(keys.get("DemoRecipeDeviceMaintenance").sourceRefs, ["p/btn-dup-a", "p/btn-dup-b"],
  "同文案节点必须共用一个 key 并登记全部 sourceRefs");
assert.ok(report.reusedTextKeys.some((item) => item.key === "DemoRecipeDeviceMaintenance" && item.sourceRef === "p/btn-dup-b"),
  "同文案复用必须记入报告 reusedTextKeys");
assert.strictEqual(report.sources.reusedByText, 2, "复用计数应包含 确定 与 设备维护 各 1 次");
assert.ok(!keyByRef.has("DemoRecipeDeviceMaintenance2"), "同文案不得再派生 Xxx2 重复键");

// 6.1) 不同文案撞出相同语义名时，仍用稳定数字后缀，不静默覆盖。
assert.strictEqual(keyByRef.get("p/btn-collide"), "DemoRecipeDeviceMaintenance2");
assert.ok(report.duplicateKeys.some((item) => item.key === "DemoRecipeDeviceMaintenance2"));

// 7) 全量多语言：数字 / 符号 / 版本号 / 型号 / 功能键这类中英文写法相同的文本**同样产键挂 LangName**，
//    只是 EN 值等于原文（不记待翻译）；逐条登记进报告 identicalTextKeys 供交付说明核对。
for (const ref of ["p/tb-sn", "p/tb-ver2", "p/tb-model", "p/tb-pct", "p/tb-hotkey"]) {
  assert.ok(keyByRef.has(ref), ref + "（全量多语言）必须生成语言键");
  const entry = keys.get(keyByRef.get(ref));
  assert.strictEqual(entry.text.EN, entry.text.CN, ref + " 的 CN/EN 写法相同，EN 值等于原文");
  assert.ok(report.identicalTextKeys.some((item) => item.sourceRef === ref && item.reason),
    ref + " 必须在报告 identicalTextKeys 里登记分类原因");
  assert.ok(!languages.noLangRefs.includes(ref),
    ref + " 全量多语言下不得再进 noLangRefs（该通道只留给显式放行的节点）");
}

// 7.1) 按钮族例外：带文案的 IconButton / Button / StatusButton 一律挂 LangName，
//      数值 / 符号按钮（+5、-5）也产键，键名走 Plus5 / Minus5；产键结果额外记入 buttonFamilyKeys。
for (const ref of ["p/btn-plus5", "p/btn-minus5"]) {
  assert.ok(!languages.noLangRefs.includes(ref), ref + " 作为按钮族文案不得进入 noLangRefs");
  assert.ok(keyByRef.has(ref), ref + "（按钮族带文案）必须生成语言键");
  const entry = keys.get(keyByRef.get(ref));
  assert.strictEqual(entry.text.EN, entry.text.CN, "数值按钮文案在 CN/EN 里写法一致");
}
assert.ok(report.buttonFamilyKeys.some((item) => item.sourceRef === "p/btn-plus5"),
  "报告里必须记录按钮族数值键及其原因");

// 7.2) 选择框（ComboBox）的 Value 是「默认选中的名称」（运行时由 IOName 数据决定，不是固定文案）：
//      映射表槽位登记 langRefPolicy=none → 不产键、不挂 LangName，
//      也**不占用** noLangRefs（该通道只收调用方显式写入的条目，见 7）。
for (const ref of ["p/cb-direction", "p/cb-mode"]) {
  assert.ok(!keyByRef.has(ref), ref + "（选择框 Value）不得生成语言键");
  assert.ok(!languages.noLangRefs.includes(ref),
    ref + " 由槽位 langRefPolicy 豁免，不应占用 noLangRefs 通道");
  assert.ok(report.valueLangExempt.some((item) => item.sourceRef === ref && item.text),
    ref + " 必须登记进报告 valueLangExempt，供交付说明逐条列出");
}
assert.strictEqual(report.valueLangExempt.length, 2, "valueLangExempt 只登记槽位豁免的选择框 Value");
assert.ok(!languages.keys.some((entry) => entry.text.CN === "后向" || entry.text.CN === "AUTO"),
  "选择框 Value 的文案（后向 / AUTO）不得进入语言字典");

// 8) 语言文件里的文案不允许缺语言；没有译文来源的必须标记待翻译。
for (const entry of languages.keys) {
  assert.strictEqual(typeof entry.text.CN, "string");
  assert.strictEqual(typeof entry.text.EN, "string");
}
assert.strictEqual(report.translatedFromCatalog, 3,
  "字典命中（菜单 参数维护 / 软件版本 / 确定）应计入 translatedFromCatalog");
assert.strictEqual(report.translatedFromInput, 3, "译文清单命中（标题 / 全自动操作 / 工件边缘录入）应计入 translatedFromInput");
const pendingKeys = new Set(report.pendingTranslations.map((item) => item.key));
for (const entry of languages.keys) {
  const needsTranslation = /[\u4e00-\u9fa5]/.test(entry.text.CN);
  if (entry.text.EN !== entry.text.CN) {
    assert.ok(!pendingKeys.has(entry.key), entry.key + " 有真实译文时不得标记待翻译");
  } else if (needsTranslation) {
    assert.ok(pendingKeys.has(entry.key), entry.key + " 用中文占位时必须逐条标记待翻译");
  } else {
    assert.ok(!pendingKeys.has(entry.key),
      entry.key + " 中英文一致的 ASCII 文案不应标记待翻译");
  }
}

// 9) 端到端：派生结果直接喂给语言字典发射器，CN/EN 的 key 集合与顺序必须一致。
const spec = LANG.normalizeSpec(languages, "DemoRecipe");
assert.strictEqual(spec.titleKey, "DemoRecipePageTitle");
assert.strictEqual(spec.keys.length, languages.keys.length);
const langOutDir = path.join(root, "lang-out");
const langRun = spawnSync(process.execPath, [
  path.join(__dirname, "..", "gen-mtslg-page-lang.js"),
  "--page", "DemoRecipe",
  "--manifest", outPath,
  "--out-dir", langOutDir
], { encoding: "utf8" });
assert.strictEqual(langRun.status, 0, langRun.stderr);
const cnKeys = LANG.readDictionaryKeys(fs.readFileSync(path.join(langOutDir, "DemoRecipe_CN.xaml"), "utf8"));
const enKeys = LANG.readDictionaryKeys(fs.readFileSync(path.join(langOutDir, "DemoRecipe_EN.xaml"), "utf8"));
assert.deepStrictEqual(cnKeys, enKeys, "CN/EN 的 x:Key 必须完全一致");
assert.deepStrictEqual(cnKeys, spec.keys.map((entry) => entry.key));
assert.match(fs.readFileSync(path.join(langOutDir, "DemoRecipe_CN.xaml"), "utf8"),
  /<sys:String x:Key="PCHeaderSoftwareVersion">软件版本<\/sys:String>/);
assert.match(fs.readFileSync(path.join(langOutDir, "DemoRecipe_EN.xaml"), "utf8"),
  /<sys:String x:Key="PCHeaderSoftwareVersion">Software Version<\/sys:String>/);

// 10) 单元级判定：动态值 vs 真实文案。
assert.strictEqual(KEYS.isDynamicText("+5").dynamic, true, "数字/符号中英文写法一致（分类留档；全量多语言下照样产键）");
assert.strictEqual(KEYS.isDynamicText("-1").dynamic, true);
assert.strictEqual(KEYS.isDynamicText("±0.5").dynamic, true);
assert.strictEqual(KEYS.isDynamicText("9.0%").dynamic, true);
assert.strictEqual(KEYS.isDynamicText("1.0.11.2222222").dynamic, true);
assert.strictEqual(KEYS.isDynamicText("2026/03/01 12:00:23").dynamic, true);
assert.strictEqual(KEYS.isDynamicText("全自动操作").dynamic, false);
assert.strictEqual(KEYS.isDynamicText("Notch位置调整").dynamic, false);
assert.strictEqual(KEYS.isDynamicText("AUX.").dynamic, false);
assert.strictEqual(KEYS.semanticFromIcon("AutoOperationGeometry"), "AutoOperation");
assert.strictEqual(KEYS.semanticFromIcon(""), "");
assert.strictEqual(KEYS.signNumberSuffix("+0.5"), "Plus0Dot5");
// 值字面编码：数值/符号型文本用值本身编码，稳定且不落临时键。
assert.strictEqual(KEYS.valueLiteralSuffix("0.000"), "Num0Dot000");
assert.strictEqual(KEYS.valueLiteralSuffix("4321"), "Num4321");
assert.strictEqual(KEYS.valueLiteralSuffix("9.0%"), "Num9Dot0Pct");
assert.strictEqual(KEYS.valueLiteralSuffix("～"), "SymWave");
assert.strictEqual(KEYS.valueLiteralSuffix("θ："), "SymThetaColon");
assert.strictEqual(KEYS.valueLiteralSuffix("°"), "SymDeg");
assert.strictEqual(KEYS.valueLiteralSuffix("DFL7362"), "", "字母开头的 ASCII 文案走 asciiSuffix，不做字面编码");
assert.strictEqual(KEYS.valueLiteralSuffix("切割方向"), "", "含中文文案不做字面编码（走语义名链）");
assert.strictEqual(KEYS.valueLiteralSuffix("⌀⌀"), "", "词表外的符号不猜，返回空串让后续来源兜底");
assert.strictEqual(KEYS.asciiSuffix("AUX."), "AUX");
assert.strictEqual(KEYS.asciiSuffix("工件边缘录入"), "");

// 11) 页面名必须是英文标识符，否则直接失败。
assert.throws(() => KEYS.deriveLangSpec({ pageName: "配方", mapping }), /页面名必须是英文标识符/);

// 12) 组件级固定语言键（映射表 langPolicy=fixed）：{page} 按页面名替换、文案取登记值、
//     且**不依赖设计文本存在**（设计文本缺失时同样必须产键并绑定到该节点）。
assert.strictEqual(keyByRef.get("p/btn-enter"), "DemoRecipeEnter", "固定键必须按 langKeyTemplate 产键");
assert.strictEqual(keys.get("DemoRecipeEnter").text.CN, "ENTER");
assert.strictEqual(keys.get("DemoRecipeEnter").text.EN, "ENTER");
assert.strictEqual(keyByRef.get("p/btn-exit"), "DemoRecipeExit",
  "设计文本缺失时固定键仍必须产出（不得因 valueSource 非 dsl.text 被静默跳过）");
assert.strictEqual(keys.get("DemoRecipeExit").text.CN, "EXIT");
assert.ok((report.fixedKeys || []).some(item => item.key === "DemoRecipeExit"),
  "固定键必须登记进 report.fixedKeys 供交付说明引用");

console.log("PASS MTSLG page language key derivation regression test");
