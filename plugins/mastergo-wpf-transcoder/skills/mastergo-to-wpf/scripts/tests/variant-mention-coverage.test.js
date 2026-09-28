#!/usr/bin/env node
"use strict";

// 变体名只能有一处真值源：映射表。
//
// 任何文件里若出现「同一族 ≥2 个变体名」的枚举，要么它本身就是真值源（共享类型表 / 路线映射表），
// 要么必须在 scripts/lib/variant-mention-registry.json 里登记理由。
//
// 背景：2026-09-29 加「底部栏/非首页-长方形」时全仓库扫描发现，同一族的名字散落在
// 映射表、布局映射文档、测试 fixture 三处；而既有的 doc-rule-consistency 只挡住几个指定文档
// 里的几个字面量 —— 谁再手抄一份清单，没有任何门禁会发现，只会等到生成页面时才以
// 「未命中变体」的形式暴露。这条门禁把「漏同步」提前到提交时。

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadTemplateMap } = require(path.join(__dirname, "..", "lib", "load-template-map.js"));

const SKILL_ROOT = path.join(__dirname, "..", "..");
const PLUGIN_ROOT = path.join(SKILL_ROOT, "..", "..");
const MAP = path.join(SKILL_ROOT, "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const REGISTRY = path.join(__dirname, "..", "lib", "variant-mention-registry.json");

const SCAN_EXTENSIONS = new Set([".md", ".json", ".js", ".mjs", ".ps1"]);
const SKIP_DIRS = new Set(["node_modules", ".git"]);

function toKey(file) {
  return path.relative(PLUGIN_ROOT, file).split(path.sep).join("/");
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
      continue;
    }
    if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) out.push(path.join(dir, entry.name));
  }
  return out;
}

// 族的定义与映射表一致：顶层带 variants 的键 + layoutRules.bottomBar。
function familiesOf(map) {
  const families = [];
  for (const [key, value] of Object.entries(map)) {
    if (key.startsWith("_") || key === "layoutRules") continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    if (value.variants) families.push({ key: key, names: Object.keys(value.variants) });
  }
  const bar = map.layoutRules && map.layoutRules.bottomBar;
  if (bar && bar.variants) families.push({ key: "layoutRules.bottomBar", names: Object.keys(bar.variants) });
  return families;
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
 * 手抄清单的形态是「A、B、C」——同一族的名字被顿号/逗号/斜杠连成一串。
 * 只按「文件里出现 ≥2 个名字」判定会把 start / exit / 方向 / 扫描 这类通用词算进去
 * （任何脚本里都有 process.exit），误报淹掉真信号，所以判据只认这种枚举串。
 */
function enumerationHits(text, names) {
  const alt = names.slice().sort((left, right) => right.length - left.length).map(escapeRe).join("|");
  // 分隔符只认中文顿号/逗号：文档列举变体用的是它们；把 / 也当分隔符会把
  // 代码里的「enter/exit」这类写法算成清单。
  const pattern = new RegExp("(?:" + alt + ")(?:\\s*[、，]\\s*(?:" + alt + "))+", "g");
  const hits = new Set();
  for (const match of text.matchAll(pattern)) {
    for (const name of names) {
      if (match[0].includes(name)) hits.add(name);
    }
  }
  return Array.from(hits);
}

// 真值源自己当然会列出全部变体名。
function isTruthSource(key) {
  return key === "skills/mastergo-to-wpf/references/component-types.json" ||
    /^skills\/mastergo-to-wpf\/references\/adapters\/[^/]+\/[^/]+-map\.json$/.test(key);
}

const map = loadTemplateMap(MAP);
const families = familiesOf(map);
assert.ok(families.length > 0, "映射表必须登记模板族或底部栏变体");

const registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
const registered = new Set(Object.keys(registry).filter((key) => !key.startsWith("_")));

const offenders = [];
for (const file of walk(PLUGIN_ROOT, [])) {
  const key = toKey(file);
  if (isTruthSource(key) || registered.has(key)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const family of families) {
    const hit = enumerationHits(text, family.names);
    if (hit.length >= 2) offenders.push({ file: key, family: family.key, hit: hit });
  }
}

assert.deepStrictEqual(
  offenders,
  [],
  "以下文件在枚举映射表里的变体名（同一族 ≥2 个），等于手抄了一份清单 —— 必然与映射表漂移。\n" +
  "要么改成「以映射表 variants 为准」的表述，要么在 scripts/lib/variant-mention-registry.json 登记理由：\n" +
  offenders.map((item) => "  " + item.file + "  [" + item.family + "]  " + item.hit.join("、")).join("\n")
);

console.log("PASS 变体名枚举覆盖（全仓库非真值源文件都不得手抄变体清单）");
