// 列出本页需要多语言条目的设计文案（页面节点 Value + Layout 菜单名 + 页面标题），
// 供人工/AI 产出 languages.translations（脚本不做翻译）。
import fs from "node:fs";

const [mappingFile, layoutManifestFile] = process.argv.slice(2);
if (!mappingFile) {
  console.error("usage: node list-lang-sources.mjs <mapping.json> [layout-manifest.json]");
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

if (layoutManifestFile) {
  const layout = JSON.parse(fs.readFileSync(layoutManifestFile, "utf8"));
  console.log("--- Layout 菜单名 ---");
  for (const item of layout.menuItems || []) {
    console.log(`#${item.index} ${JSON.stringify(item.name)} topLeft=${JSON.stringify(item.topLeftContent || "")}`);
  }
}
