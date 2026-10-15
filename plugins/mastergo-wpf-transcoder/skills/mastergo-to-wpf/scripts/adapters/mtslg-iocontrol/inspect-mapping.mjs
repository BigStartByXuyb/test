// 只打印 mapping 的结构摘要（节点/控制类型/文案/图标/审计计数），不输出整份 mapping。
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node inspect-mapping.mjs <mapping.json> [--full]");
  process.exit(2);
}

const mapping = JSON.parse(fs.readFileSync(file, "utf8"));
const nodes = Array.isArray(mapping.nodes) ? mapping.nodes : [];
const sourceNodes = Array.isArray(mapping.sourceNodes) ? mapping.sourceNodes : [];
const textAudit = Array.isArray(mapping.textAudit) ? mapping.textAudit : [];
const tables = Array.isArray(mapping.tableAudits) ? mapping.tableAudits : [];

console.log("mappingTag:", mapping.mappingTag);
console.log("contentOriginX/Y:", mapping.contentOriginX, mapping.contentOriginY);
console.log("rootRef:", mapping.rootRef);
console.log("sourceNodes:", sourceNodes.length, "nodes:", nodes.length, "textAudit:", textAudit.length);
console.log("pending:", JSON.stringify(mapping.pending || []).slice(0, 1200));
console.log("unmappedComponents:", JSON.stringify(mapping.unmappedComponents || []).slice(0, 1200));
console.log("templateConflicts:", JSON.stringify(mapping.templateConflicts || []).slice(0, 600));

console.log("--- nodes ---");
for (const node of nodes) {
  const attrs = node.attrs || {};
  const bits = [
    node.xmlId || node.id,
    node.controlType || attrs.ControlType || "-",
    `ref=${node.sourceRef || node.ref}`,
    `parent=${node.parent === undefined ? "-" : node.parent}`,
    `L/T=${node.expectedLeft}/${node.expectedTop}`,
    `W/H=${node.expectedWidth}/${node.expectedHeight}`,
    attrs.Value !== undefined ? `Value=${JSON.stringify(attrs.Value)}` : "",
    attrs.Icon !== undefined ? `Icon=${JSON.stringify(attrs.Icon)}` : "",
    attrs.Header !== undefined ? `Header=${JSON.stringify(attrs.Header)}` : "",
    node.iconSourceRef ? `iconSrc=${node.iconSourceRef}` : ""
  ].filter(Boolean);
  console.log(bits.join(" | "));
}

if (tables.length) {
  console.log("--- tables ---");
  console.log(JSON.stringify(tables, null, 2).slice(0, 4000));
}

const omit = textAudit.filter((t) => t.decision === "omit");
if (omit.length) {
  console.log("--- omitted texts (deduped) ---");
  const seen = new Set();
  for (const entry of omit) {
    const key = `${entry.role}|${entry.omitReason}|${entry.sourceText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`${entry.role} | ${entry.omitReason} | ${JSON.stringify(entry.sourceText)} | ${entry.sourceRef}`);
  }
}
