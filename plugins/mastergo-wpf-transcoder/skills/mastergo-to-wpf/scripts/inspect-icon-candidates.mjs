// 只打印图标候选的“元数据摘要”，不读图、不渲染设计稿：用于人工为台账填写 name / comment。
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node inspect-icon-candidates.mjs <icon-candidates.json>");
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const candidates = Array.isArray(data.candidates) ? data.candidates : [];

console.log("top keys:", Object.keys(data).join(","));
console.log("candidates:", candidates.length);

for (const [i, entry] of candidates.entries()) {
  const ledger = entry.ledgerFields || {};
  const size = ledger.iconSize
    ? `${Math.round(ledger.iconSize.width)}x${Math.round(ledger.iconSize.height)}`
    : "-";
  const parts = [
    `#${i}`,
    `ownerControlType=${entry.ownerControlType || "-"}`,
    `ownerText=${JSON.stringify(entry.ownerText || "")}`,
    `parentType=${entry.parentType || "-"}`,
    `siblingPaths=${entry.siblingPathCount === undefined ? "-" : entry.siblingPathCount}`,
    `svgName=${JSON.stringify(entry.svgName || entry.iconName || "")}`,
    `ledgerSourceRef=${ledger.ledgerSourceRef || "-"}`,
    `sourceId=${ledger.sourceId || "null"}`,
    `fromDsl=${ledger.fromDsl === undefined ? "-" : ledger.fromDsl}`,
    `bakeAncestorTransform=${ledger.bakeAncestorTransform === undefined ? "-" : ledger.bakeAncestorTransform}`,
    `iconSize=${size}`
  ];
  console.log(parts.join(" | "));
}

const unmapped = Array.isArray(data.unmapped) ? data.unmapped : [];
if (unmapped.length) {
  console.log("--- unmapped ---");
  for (const [i, entry] of unmapped.entries()) {
    console.log(`#${i} ${JSON.stringify(entry)}`);
  }
}
