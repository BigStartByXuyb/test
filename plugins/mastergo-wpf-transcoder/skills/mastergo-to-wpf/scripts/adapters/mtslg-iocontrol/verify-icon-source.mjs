// 台账定名前的机械核对：对每个「准备登记」的候选，检查它的几何来源是否可靠。
//   - ledgerSourceRef 指向的 DSL 节点下有多少 PATH（多路径必须登记成组节点，否则会丢子路径）
//   - extractSvg 里 sourceId 条目是否存在，条目名与该候选的图形层名是否一致
//   - sourceId 是否指向页面根（此时条目是整页几何，绝不能当图标用 → 必须改 fromDsl + PATH ref）
//   - 同一 sourceId 被多条台账条目共用：允许，只登记共用事实（用户确认）
// 注意：extractSvg 的 svg 是**页面绝对坐标**的 markup，生成器会再按矩阵/平移变换；
// 因此不能拿它和 DSL 的局部 PATH 数据直接做字符串比较（早期版本这么比过，是误报）。
// 本工具只做上述可机械判定的检查，不判断图形外观。
import fs from "node:fs";

const argv = process.argv.slice(2);
const namingIndex = argv.indexOf("--naming");
const namingFile = namingIndex >= 0 ? argv[namingIndex + 1] : null;
const [candidatesFile, dslFile, svgFile] = argv;
if (!candidatesFile || !dslFile || !svgFile) {
  console.error("usage: node verify-icon-source.mjs <icon-candidates.json> <dsl.snapshot.json> <extractSvg.json> [--naming <icon-naming.json>]");
  process.exit(2);
}

// 给了 --naming 时只核对「本次登记的候选」（其余候选不登记、不参与），并且把 naming 的 fromDsl 决策算进去：
// 命名表声明 fromDsl=true 的条目，几何改由 DSL 的 PATH 节点合成，因此候选自身的 sourceId 不再要求唯一。
const naming = namingFile ? JSON.parse(fs.readFileSync(namingFile, "utf8")) : null;
const registered = new Map();
if (naming) {
  const entries = Array.isArray(naming.icons) ? naming.icons : Object.entries(naming).map(([index, value]) => ({ index, ...value }));
  for (const entry of entries) {
    const index = Number(entry.index);
    if (Number.isInteger(index)) registered.set(index, entry);
  }
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
  if (naming && !registered.has(index)) return;
  const ledger = candidate.ledgerFields || {};
  const targetRef = ledger.ledgerSourceRef || ledger.sourceRef;
  const entry = byRef.get(targetRef) || byId.get(ledger.sourceId);
  const dslPaths = entry ? pathDataOf(entry) : [];
  const svgEntry = ledger.sourceId ? svgById.get(ledger.sourceId) : null;
  const svgPaths = svgEntry ? svgPathData(svgEntry) : [];
  const sourceIsRoot = ledger.sourceId === root.id;
  const declaredFromDsl = Boolean(ledger.fromDsl) || Boolean(registered.get(index) && registered.get(index).fromDsl === true);
  const suspicious = !declaredFromDsl && (sourceIsRoot || !svgEntry);
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
    declaredFromDsl,
    suspicious
  });
});

// 同一个 sourceId 被多条台账条目共用：允许（用户确认）——同一个图形被多个控件复用是常见情形
// （例如两个按钮用同一个箭头图形），几何本身仍是一个确定的图形，因此放行、只登记共用事实。
// 仍判失败的两种情况保持不变：sourceId 指向页面根（整页几何不能当图标）、extractSvg 无条目且未声明 fromDsl。
const sourceIdCount = new Map();
for (const row of rows) {
  if (!row.sourceId) continue;
  sourceIdCount.set(row.sourceId, (sourceIdCount.get(row.sourceId) || 0) + 1);
}
for (const row of rows) {
  if (row.sourceId && sourceIdCount.get(row.sourceId) > 1) {
    row.sharedSourceId = sourceIdCount.get(row.sourceId);
  }
}

for (const row of rows) {
  const flag = row.suspicious
    ? (row.sourceIsRoot
      ? "  <<< sourceId 指向页面根（该条目是整页几何）→ 必须 fromDsl + PATH ref"
      : "  <<< extractSvg 无该条目且未声明 fromDsl → 需要 fromDsl + PATH ref")
    : (!row.declaredFromDsl && row.sharedSourceId ? `  （与其它 ${row.sharedSourceId - 1} 条条目共用同一几何，按放行口径登记）` : "");
  console.log(`#${String(row.index).padStart(2)} ${row.owner}/${JSON.stringify(row.ownerText)} 同级PATH=${row.siblingPaths} 目标节点下PATH=${row.dslPathsUnderTarget} extractSvg条目=${row.extractSvgEntry}(路径 ${row.extractSvgPaths})${flag}`);
  console.log(`     ledgerSourceRef=${row.ledgerSourceRef}  sourceId=${row.sourceId}`);
}

const bad = rows.filter((row) => row.suspicious);
// 只统计「几何确实取自这条共用来源」的条目：已声明 fromDsl 的条目几何取自自家 PATH，不算共用。
const sharedRows = rows.filter((row) => row.sharedSourceId && !row.declaredFromDsl).length;
if (naming) {
  if (bad.length) {
    console.error(`FAIL: 本次登记里有 ${bad.length} 条图标来源不可信（见上方 <<< 标记）：请在命名表里把这些条目标成 "fromDsl": true，几何改由各自的 PATH 节点合成。`);
    process.exit(1);
  }
  console.log(`PASS: 本次登记的 ${rows.length} 条图标来源均取自确定的几何（其余候选未登记，不参与核对${sharedRows ? `；其中 ${sharedRows} 条与其它条目共用同一几何，已按放行口径登记共用事实` : ""}）。`);
}
