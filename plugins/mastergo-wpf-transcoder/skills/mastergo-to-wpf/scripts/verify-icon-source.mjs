// 台账定名前的机械核对：对每个「准备登记」的候选，检查它的几何来源是否可靠。
//   - ledgerSourceRef 指向的 DSL 节点下有多少 PATH（多路径必须登记成组节点，否则会丢子路径）
//   - extractSvg 里 sourceId 条目是否存在，条目名与该候选的图形层名是否一致
//   - sourceId 是否指向页面根（此时条目是整页几何，绝不能当图标用 → 必须改 fromDsl + PATH ref）
// 注意：extractSvg 的 svg 是**页面绝对坐标**的 markup，生成器会再按矩阵/平移变换；
// 因此不能拿它和 DSL 的局部 PATH 数据直接做字符串比较（早期版本这么比过，是误报）。
// 本工具只做上述可机械判定的检查，不判断图形外观。
import fs from "node:fs";

const [candidatesFile, dslFile, svgFile] = process.argv.slice(2);
if (!candidatesFile || !dslFile || !svgFile) {
  console.error("usage: node verify-icon-source.mjs <icon-candidates.json> <dsl.snapshot.json> <extractSvg.json>");
  process.exit(2);
}

const candidates = JSON.parse(fs.readFileSync(candidatesFile, "utf8")).candidates || [];
const dsl = JSON.parse(fs.readFileSync(dslFile, "utf8"));
const svg = JSON.parse(fs.readFileSync(svgFile, "utf8"));
const root = dsl.nodes ? dsl.nodes[0] : dsl.dsl.nodes[0];

const byRef = new Map();
const byId = new Map();
const walk = (node, prefix) => {
  const ref = node.ref || (prefix ? `${prefix}/${node.id}` : node.id);
  byRef.set(ref, { node, ref });
  if (!byId.has(node.id)) byId.set(node.id, { node, ref });
  for (const child of node.children || []) walk(child, ref);
};
walk(root, "");

const pathDataOf = (entry) => {
  const out = [];
  const collect = (node) => {
    const own = node.path || node.d || (node.layoutStyle && node.layoutStyle.path);
    if (own) out.push(String(own));
    for (const child of node.children || []) collect(child);
  };
  collect(entry.node);
  return out;
};

const svgs = Array.isArray(svg.svgs) ? svg.svgs : [];
const svgById = new Map(svgs.map((item) => [item.id, item]));
// extractSvg 条目结构是 { name, id, svg }（svg 是标记字符串），路径数据要从 svg 里抽 d="…"。
const svgPathData = (item) => {
  const markup = String(item.svg || "");
  return [...markup.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
};
console.log(`DSL 根: ${root.id} / extractSvg 条目: ${svgs.length}`);
if (svgs[0]) console.log(`extractSvg 条目: id=${svgs[0].id} name=${JSON.stringify(svgs[0].name)} 路径数=${svgPathData(svgs[0]).length}`);

const rows = [];
candidates.forEach((candidate, index) => {
  const ledger = candidate.ledgerFields || {};
  const targetRef = ledger.ledgerSourceRef || ledger.sourceRef;
  const entry = byRef.get(targetRef) || byId.get(ledger.sourceId);
  const dslPaths = entry ? pathDataOf(entry) : [];
  const svgEntry = ledger.sourceId ? svgById.get(ledger.sourceId) : null;
  const svgPaths = svgEntry ? svgPathData(svgEntry) : [];
  const sourceIsRoot = ledger.sourceId === root.id;
  const suspicious = sourceIsRoot || (!svgEntry && !ledger.fromDsl);
  rows.push({
    index,
    owner: candidate.ownerControlType || "-",
    ownerText: candidate.ownerText || "",
    ledgerSourceRef: targetRef,
    sourceId: ledger.sourceId || null,
    siblingPaths: candidate.siblingPathCount,
    dslPathsUnderTarget: dslPaths.length,
    extractSvgEntry: Boolean(svgEntry),
    extractSvgPaths: svgPaths.length,
    sourceIsRoot,
    suspicious
  });
});

// 同一个 sourceId 被多条台账条目共用 → 它不可能唯一代表每个图标（典型：多个按钮的图标被
// extractSvg 归到同一个分组/页面节点上）→ 这些条目必须改 fromDsl + PATH ref。
const sourceIdCount = new Map();
for (const row of rows) {
  if (!row.sourceId) continue;
  sourceIdCount.set(row.sourceId, (sourceIdCount.get(row.sourceId) || 0) + 1);
}
for (const row of rows) {
  if (row.sourceId && sourceIdCount.get(row.sourceId) > 1) {
    row.suspicious = true;
    row.sharedSourceId = sourceIdCount.get(row.sourceId);
  }
}

for (const row of rows) {
  const flag = row.suspicious
    ? (row.sharedSourceId
      ? `  <<< sourceId 被 ${row.sharedSourceId} 条台账条目共用（不唯一）→ 必须 fromDsl + PATH ref`
      : row.sourceIsRoot
      ? "  <<< sourceId 指向页面根（该条目是整页几何）→ 必须 fromDsl + PATH ref"
      : "  <<< extractSvg 无该条目且未声明 fromDsl → 需要 fromDsl + PATH ref")
    : "";
  console.log(`#${String(row.index).padStart(2)} ${row.owner}/${JSON.stringify(row.ownerText)} 同级PATH=${row.siblingPaths} 目标节点下PATH=${row.dslPathsUnderTarget} extractSvg条目=${row.extractSvgEntry}(路径 ${row.extractSvgPaths})${flag}`);
  console.log(`     ledgerSourceRef=${row.ledgerSourceRef}  sourceId=${row.sourceId}`);
}
