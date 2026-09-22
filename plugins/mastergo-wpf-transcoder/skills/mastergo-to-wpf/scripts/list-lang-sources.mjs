// 列出本页需要多语言条目的设计文案（页面节点 Value + Layout 菜单名 + 页面标题），
// 供人工/AI 产出 languages.translations（脚本不做翻译）。
//
// 用法:
//   node list-lang-sources.mjs <mapping.json> [layout-manifest.json]
//        [--page-name <Target>] [--translations <译文清单>] [--glossary <术语表>]
//
// 给了 --page-name 时，额外用真实派生器（gen-mtslg-lang-keys-from-dsl.js 的 deriveLangSpec）
// 算出「哪些文案派生不出语义键、必须补术语表」——这些文案若不管，会落成临时键，
// 直到第 11 步门禁才失败，导致整段返工。判定口径与生成器完全同源，不在这里另写一套规则。
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const langKeys = require("./gen-mtslg-lang-keys-from-dsl.js");

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) { out._.push(token); continue; }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) out[key] = true;
    else { out[key] = value; i += 1; }
  }
  return out;
}

function readJsonIfExists(file) {
  if (typeof file !== "string" || !file) return null;
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const args = parseArgs(process.argv.slice(2));
const [mappingFile, layoutManifestFile] = args._;
if (!mappingFile) {
  console.error("usage: node list-lang-sources.mjs <mapping.json> [layout-manifest.json] " +
    "[--page-name <Target>] [--translations <译文清单>] [--glossary <术语表>]");
  process.exit(2);
}

const mapping = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
const nodes = Array.isArray(mapping.nodes) ? mapping.nodes : [];

const values = new Map();
for (const node of nodes) {
  const attrs = node.attrs || {};
  const value = attrs.Value !== undefined ? attrs.Value : attrs.Header;
  if (value === undefined || value === "") continue;
  if (node.valueSource !== "dsl.text" && !node.valueSource) continue;
  if (!values.has(value)) values.set(value, []);
  values.get(value).push(node.xmlId);
}

console.log("--- 页面节点文案（" + values.size + " 条）---");
for (const [value, ids] of values) {
  console.log(JSON.stringify(value) + "  x" + ids.length);
}

const title = (mapping.textAudit || []).find((entry) => entry.role === "page-title");
console.log("--- 页面标题 ---");
console.log(JSON.stringify(title ? title.sourceText : null), title ? title.sourceRef : "-");

const layout = typeof layoutManifestFile === "string" ? readJsonIfExists(layoutManifestFile) : null;
if (layout) {
  console.log("--- Layout 菜单名 ---");
  for (const item of layout.menuItems || []) {
    console.log(`#${item.index} ${JSON.stringify(item.name)} topLeft=${JSON.stringify(item.topLeftContent || "")}`);
  }
}

// 需要术语表的文案：用生成器同一套派生链算，避免两处规则漂移。
if (typeof args["page-name"] === "string" && args["page-name"]) {
  const derived = langKeys.deriveLangSpec({
    pageName: args["page-name"],
    locales: ["CN", "EN"],
    mapping,
    menuItems: layout ? layout.menuItems || [] : [],
    glossary: readJsonIfExists(args.glossary) || {},
    translations: readJsonIfExists(args.translations) || {}
  });
  const provisional = derived.report.provisionalKeys || [];
  // 拆两组，否则"还没写译文"和"写了译文也派生不出"会混在一起：
  // 前者补译文即可自动派生；后者才是必须补术语表的（单字符等形态问题）。
  const translations = readJsonIfExists(args.translations) || {};
  const normalized = (value) => String(value === undefined || value === null ? "" : value).replace(/\s+/g, " ").trim();
  const translationKeys = new Map(
    Object.keys(translations).map((key) => [normalized(key), translations[key]])
  );
  const needsGlossary = provisional.filter((entry) => translationKeys.has(normalized(entry.text)));
  const needsTranslation = provisional.filter((entry) => !translationKeys.has(normalized(entry.text)));
  const describe = (entry) => {
    const where = entry.menuIndex === undefined ? "页面节点" : "Layout 菜单项 #" + entry.menuIndex;
    return JSON.stringify(entry.text) + "   " + where + "   临时键=" + entry.key;
  };
  console.log("--- 必须补术语表条目（已有译文却仍派生不出语义键；漏了会到第 11 步才失败）---");
  if (!needsGlossary.length) console.log("（无）");
  else {
    for (const entry of needsGlossary) console.log(describe(entry));
    console.log("格式：" + JSON.stringify({ [needsGlossary[0].text || "文案"]: "EnglishIdentifier" }) +
      "，写进 Generated/_inputs/<Target>.lang-glossary.json");
  }
  console.log("--- 还没有译文（补上合格英文译文后通常会自动派生，不必进术语表）---");
  if (!needsTranslation.length) console.log("（无）");
  else for (const entry of needsTranslation) console.log(describe(entry));
}
