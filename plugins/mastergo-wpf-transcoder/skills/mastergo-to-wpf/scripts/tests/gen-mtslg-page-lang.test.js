#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "gen-mtslg-page-lang.js");
const LANG = require(script);

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mtslg-lang-"));
const specPath = path.join(root, "lang.json");
// 命名约定：页面标题 {页面名}PageTitle、菜单项 MenuItem{名称}、页面内容 {页面名}{名称}。
const spec = {
  locales: ["CN", "EN"],
  keys: [
    { key: "DemoRecipeStart", text: { CN: "开始", EN: "Start" } },
    { key: "MenuItemRecipe", text: { CN: "配方", EN: "Recipe" } },
    { key: "DemoRecipePageTitle", text: { CN: "配方管理", EN: "Recipe" } },
    { key: "DemoRecipePlusFive", text: { CN: "+5", EN: "+5" } }
  ]
};
fs.writeFileSync(specPath, JSON.stringify(spec, null, 2), "utf8");

const outDir = path.join(root, "out");
let result = spawnSync(process.execPath,
  [script, "--page", "DemoRecipe", "--manifest", specPath, "--out-dir", outDir], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);

const cn = fs.readFileSync(path.join(outDir, "DemoRecipe_CN.xaml"), "utf8");
const en = fs.readFileSync(path.join(outDir, "DemoRecipe_EN.xaml"), "utf8");
assert.match(cn, /^<ResourceDictionary /);
assert.match(cn, /xmlns:sys="clr-namespace:System;assembly=mscorlib"/);
assert.match(cn, /<sys:String x:Key="DemoRecipePageTitle">配方管理<\/sys:String>/);
assert.match(en, /<sys:String x:Key="DemoRecipePageTitle">Recipe<\/sys:String>/);
// 分组注释按约定推导，顺序固定为 页面标题 → 页面底部菜单名称 → 页面内容。
assert.match(cn, /<!-- 页面标题 -->/);
assert.match(cn, /<!-- 页面底部菜单名称 -->/);
assert.match(cn, /<!-- 页面内容 -->/);
const emitted = LANG.readDictionaryKeys(cn);
assert.deepStrictEqual(emitted,
  ["DemoRecipePageTitle", "MenuItemRecipe", "DemoRecipeStart", "DemoRecipePlusFive"]);
assert.deepStrictEqual(emitted, LANG.readDictionaryKeys(en), "CN/EN 的 key 必须完全一致");
// 生成文件必须是 UTF-8 无 BOM（与目标项目现有语言文件一致）。
const cnBytes = fs.readFileSync(path.join(outDir, "DemoRecipe_CN.xaml"));
assert.ok(!(cnBytes[0] === 0xEF && cnBytes[1] === 0xBB && cnBytes[2] === 0xBF), "语言文件不得带 BOM");

function expectFail(title, mutate) {
  const bad = JSON.parse(JSON.stringify(spec));
  mutate(bad);
  const name = title.replace(/[^\w]/g, "_");
  const badPath = path.join(root, name + ".json");
  fs.writeFileSync(badPath, JSON.stringify(bad, null, 2), "utf8");
  const run = spawnSync(process.execPath,
    [script, "--page", "DemoRecipe", "--manifest", badPath, "--out-dir", path.join(root, "bad-" + name)],
    { encoding: "utf8" });
  assert.notStrictEqual(run.status, 0, title + " 必须失败");
  return run.stderr + run.stdout;
}

expectFail("缺 EN 文案", (bad) => { delete bad.keys[1].text.EN; });
expectFail("key 重复", (bad) => { bad.keys[1].key = bad.keys[0].key; });
expectFail("key 非法", (bad) => { bad.keys[0].key = "MGIcon_1:2"; });
expectFail("未登记语言", (bad) => { bad.keys[0].text.JP = "レシピ"; });
expectFail("空 keys", (bad) => { bad.keys = []; });
expectFail("locale 重复", (bad) => { bad.locales = ["CN", "CN"]; });
assert.match(expectFail("页面内容 key 缺页面名前缀", (bad) => { bad.keys[0].key = "StartButton"; }),
  /不符合命名约定/);
assert.match(expectFail("key 不属于三类约定", (bad) => { bad.keys[1].key = "MenuRecipe"; }),
  /不符合命名约定/);
assert.match(expectFail("通用 PageTitle 前缀也不合约定", (bad) => { bad.keys[2].key = "PageTitle"; }),
  /不符合命名约定/);
// scope=shared 允许跨页面共享字典的 key 不受页面名前缀约束。
const sharedSpec = JSON.parse(JSON.stringify(spec));
sharedSpec.keys[0] = { key: "CommonOK", text: { CN: "确定", EN: "OK" }, scope: "shared" };
const sharedPath = path.join(root, "shared.json");
fs.writeFileSync(sharedPath, JSON.stringify(sharedSpec, null, 2), "utf8");
const sharedRun = spawnSync(process.execPath,
  [script, "--page", "DemoRecipe", "--manifest", sharedPath, "--out-dir", path.join(root, "shared-out")],
  { encoding: "utf8" });
assert.strictEqual(sharedRun.status, 0, sharedRun.stderr);
assert.ok(LANG.readDictionaryKeys(
  fs.readFileSync(path.join(root, "shared-out", "DemoRecipe_CN.xaml"), "utf8")).includes("CommonOK"));

// 文案索引：按 CN 文案建立匹配表；同一文案多个 key 时如实返回全部候选（歧义由 Bundle 报错）。
const textIndexSpec = LANG.normalizeSpec({
  keys: [
    { key: "DemoRecipeStart", text: { CN: "开始", EN: "Start" } },
    { key: "MenuItemStart", text: { CN: "开始", EN: "Begin" } },
    { key: "DemoRecipeEmpty", text: { CN: "", EN: "Empty CN" } }
  ]
}, "DemoRecipe");
const byText = LANG.indexKeysByText(textIndexSpec);
// 候选顺序跟随发射顺序（已按 页面标题 → 页面底部菜单名称 → 页面内容 分组排序）。
assert.deepStrictEqual(byText.get("开始"), ["MenuItemStart", "DemoRecipeStart"]);
assert.strictEqual(byText.has(""), false, "空 CN 文案不参与自动匹配");
assert.strictEqual(textIndexSpec.titleKey, "DemoRecipePageTitle");
assert.strictEqual(textIndexSpec.bindByText, true, "bindByText 默认开启");
assert.strictEqual(textIndexSpec.requireLangName, true, "requireLangName 默认开启");
assert.deepStrictEqual(textIndexSpec.noLangRefs, []);

// sourceRefs：同一文案在本页出现多次时，一个 key 可以绑定多个节点（sourceRef 的复数形式）。
const multiSpec = LANG.normalizeSpec({
  keys: [{
    key: "DemoRecipeCommonOK",
    text: { CN: "确定", EN: "OK" },
    sourceRef: "1:1",
    sourceRefs: ["1:1", "1:2", "1:2"]
  }]
}, "DemoRecipe");
assert.deepStrictEqual(multiSpec.keys[0].sourceRefs, ["1:1", "1:2"], "sourceRefs 必须去重并保持顺序");
assert.strictEqual(multiSpec.keys[0].sourceRef, "1:1");
assert.throws(
  () => LANG.normalizeSpec({
    keys: [{ key: "DemoRecipeBadRefs", text: { CN: "确定", EN: "OK" }, sourceRefs: ["1:1", ""] }]
  }, "DemoRecipe"),
  /sourceRefs 必须是 DSL ref 字符串数组/);

console.log("PASS MTSLG page language dictionary regression test");
