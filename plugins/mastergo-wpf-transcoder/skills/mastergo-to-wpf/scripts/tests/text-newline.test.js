#!/usr/bin/env node
"use strict";

// 文本换行口径（映射表 textNewlinePolicy）的回归测试：
//   1) 设计换行码点（U+2028 / U+2029 / CR / CRLF）统一归一成 LF；
//   2) XML 属性里 LF 必须写成字符引用 &#x0a;（属性里不能出现字面换行）；
//   3) 语言字典值同样写 &#x0a;，且字典值保留换行（不再被压成空格）；
//   4) 比对口径 normalizeForCompare 能把「解码后的 XML 值」与「mapping 文案」判为一致；
//   5) 映射表登记的换行 token 与实现一致（防两处漂移）。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT_DIR = path.join(__dirname, "..");
const HELPERS = path.join(SCRIPT_DIR, "lib", "script-helpers.js");
const MAP = path.join(SCRIPT_DIR, "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const ADAPTER = path.join(SCRIPT_DIR, "adapters", "mtslg-iocontrol");
const LANG_KEYS = path.join(ADAPTER, "gen-mtslg-lang-keys-from-dsl.js");
const PAGE_LANG = path.join(ADAPTER, "gen-mtslg-page-lang.js");
const XML_SCRIPT = path.join(ADAPTER, "gen-iocontrol-xml.js");
const PROVENANCE = path.join(ADAPTER, "validate-iocontrol-provenance.js");

const { normalizeNewlines, langValueText, decodeXmlEntities, normalizeForCompare, xmlAttr, xmlElementText } = require(HELPERS);

// 1) 归一：四种设计换行都变成 LF，且其它字符不受影响。
assert.strictEqual(normalizeNewlines("保存\u2028激光"), "保存\n激光");
assert.strictEqual(normalizeNewlines("A\u2029B"), "A\nB");
assert.strictEqual(normalizeNewlines("A\r\nB"), "A\nB");
assert.strictEqual(normalizeNewlines("A\rB"), "A\nB");
assert.strictEqual(normalizeNewlines("A\nB"), "A\nB");
assert.strictEqual(normalizeNewlines("无换行"), "无换行");

// 1b) 字典值变换（共享实现 langValueText）：换行保留，行内空白折叠，行首行尾 trim。
assert.strictEqual(langValueText("保存\u2028激光- JF"), "保存\n激光- JF");
assert.strictEqual(langValueText("A  \n  B"), "A\nB");
assert.strictEqual(langValueText("    对位模式    "), "对位模式");
assert.strictEqual(langValueText("A\u2028B"), "A\nB");
assert.strictEqual(langValueText(["A\u2028", "B"]), "A\nB", "数组入参按空串拼接（同一行的多个 text run）");

// 2) XML 属性转义：& < > " 照旧；换行写成 &#x0a;。
assert.strictEqual(xmlAttr('a&b<c>d"e'), "a&amp;b&lt;c&gt;d&quot;e");
assert.strictEqual(xmlAttr("保存\u2028激光- JF"), "保存&#x0a;激光- JF");
assert.ok(!/\n/.test(xmlAttr("A\nB")), "属性值里不得残留字面换行");
assert.strictEqual(xmlElementText("A\nB"), "A&#x0a;B");

// 3) 比对归一：解码字符引用 + 换行归一，两端相等。
assert.strictEqual(decodeXmlEntities("A&#x0a;B"), "A\nB");
assert.strictEqual(decodeXmlEntities("A&#10;B"), "A\nB");
assert.strictEqual(decodeXmlEntities("&lt;x&gt;&amp;&quot;&apos;"), '<x>&"\'');
assert.strictEqual(normalizeForCompare("保存&#x0a;激光- JF"), "保存\n激光- JF");
assert.strictEqual(normalizeForCompare("保存\u2028激光- JF"), normalizeForCompare("保存&#x0a;激光- JF"));
assert.strictEqual(normalizeForCompare("保存 激光- JF") === normalizeForCompare("保存\u2028激光- JF"), false);

// 4) 映射表登记的 token 必须与实现一致（防「表里一套、脚本一套」）。
const map = JSON.parse(fs.readFileSync(MAP, "utf8"));
assert.ok(map.textNewlinePolicy, "映射表缺少 textNewlinePolicy");
assert.strictEqual(map.textNewlinePolicy.normalizedValue, "LF (U+000A)");
assert.strictEqual(xmlAttr("x\n y"), "x&#x0a; y");
assert.strictEqual(map.textNewlinePolicy.xmlAttrEscaping, "&#x0a;");
assert.strictEqual(map.textNewlinePolicy.langDictionaryEscaping, "&#x0a;");
assert.deepStrictEqual(map.textNewlinePolicy.designNewlineCodepoints, ["U+2028", "U+2029", "U+000D", "U+000A"]);
assert.ok(/script-helpers\.js/.test(map.textNewlinePolicy.implementationSource || ""),
  "映射表必须登记实现真值源（scripts/lib/script-helpers.js）");

// 5) 端到端：语言键派生 + 字典发射保留换行；页面 XML 写 &#x0a;；provenance 仍 PASS。
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-newline-"));
const ref = "page/btn";
const sourceText = "保存\u2028激光- JF";
const mapping = {
  schemaVersion: "mastergo-iocontrol-mapping/1",
  contentOriginX: 0,
  contentOriginY: 192,
  rootRef: "page",
  sourceNodes: [
    { ref: "page", parentRef: null, type: "INSTANCE", name: "Demo", pageAbsX: 0, pageAbsY: 192, relativeX: 0, relativeY: 0, width: 1280, height: 1024 },
    { ref, parentRef: "page", type: "TEXT", name: "固定文本框", pageAbsX: 10, pageAbsY: 202, relativeX: 10, relativeY: 10, width: 75, height: 44, text: sourceText }
  ],
  textAudit: [{ sourceRef: ref, sourceText, visibility: true, role: "component-value", decision: "emit", outputRefs: ["MG_0001"] }],
  nodes: [{
    ref,
    sourceRef: ref,
    sourceText,
    valueSource: "dsl.text",
    valueSourceRef: ref,
    sourceParent: "page",
    controlType: "TextBlock",
    parent: null,
    layoutParent: null,
    absX: 10,
    absY: 202,
    w: 75,
    h: 44,
    expectedLeft: 10,
    expectedTop: 10,
    expectedWidth: "NaN",
    expectedHeight: 40,
    widthSource: "mtslg.textblock.fixed-nan",
    heightSource: "mtslg.textblock.fixed-40",
    dslWidth: 75,
    id: "MG_0001",
    xmlId: "MG_0001",
    attrs: { Value: sourceText, FontSize: "16", LangName: "DemoSaveLaser", Align: "Left" }
  }]
};
const mappingFile = path.join(dir, "Demo.mapping.json");
fs.writeFileSync(mappingFile, JSON.stringify(mapping), "utf8");

const langKeysFile = path.join(dir, "lang-keys.json");
const langKeysResult = spawnSync(process.execPath, [
  LANG_KEYS, "--page", "Demo", "--mapping", mappingFile, "--out", langKeysFile
], { encoding: "utf8" });
assert.strictEqual(langKeysResult.status, 0, langKeysResult.stderr);
const langSpec = JSON.parse(fs.readFileSync(langKeysFile, "utf8"));
const laserKey = langSpec.keys.find((key) => key.sourceRef === ref);
assert.ok(laserKey, "未派生出按钮文案的语言键");
assert.strictEqual(laserKey.text.CN, "保存\n激光- JF", "字典 CN 值必须保留换行");

const langDir = path.join(dir, "lang");
fs.mkdirSync(langDir, { recursive: true });
const langSpecFile = path.join(dir, "lang.json");
fs.writeFileSync(langSpecFile, JSON.stringify({
  pageName: "Demo",
  locales: ["CN", "EN"],
  keys: langSpec.keys.map((key) => ({ key: key.key, text: key.text, sourceRef: key.sourceRef, menuIndex: key.menuIndex }))
}), "utf8");
const pageLangResult = spawnSync(process.execPath, [
  PAGE_LANG, "--page", "Demo", "--manifest", langSpecFile, "--out-dir", langDir
], { encoding: "utf8" });
assert.strictEqual(pageLangResult.status, 0, pageLangResult.stderr);
const cnXaml = fs.readFileSync(path.join(langDir, "Demo_CN.xaml"), "utf8");
assert.ok(cnXaml.includes(">" + laserKey.key + "&lt;") === false);
assert.ok(/<sys:String x:Key="[^"]+">保存&#x0a;激光- JF<\/sys:String>/.test(cnXaml), "字典值必须写 &#x0a;：" + cnXaml);

const xmlFile = path.join(dir, "DemoPage.xml");
const xmlResult = spawnSync(process.execPath, [XML_SCRIPT, "--fresh", mappingFile, "--out", xmlFile], { encoding: "utf8" });
assert.strictEqual(xmlResult.status, 0, xmlResult.stderr);
const xmlText = fs.readFileSync(xmlFile, "utf8");
assert.ok(xmlText.includes('Value="保存&#x0a;激光- JF"'), "页面 XML 的 Value 必须写 &#x0a;");
assert.ok(!/Value="[^"]*\u2028/.test(xmlText), "页面 XML 里不得残留 U+2028");

const provenanceResult = spawnSync(process.execPath, [PROVENANCE, "--xml", xmlFile, "--mapping", mappingFile], { encoding: "utf8" });
assert.strictEqual(provenanceResult.status, 0, provenanceResult.stdout + provenanceResult.stderr);

console.log("text-newline.test.js: OK");
