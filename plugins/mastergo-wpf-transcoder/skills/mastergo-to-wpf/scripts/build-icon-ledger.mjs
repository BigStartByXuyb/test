// 由 discover 候选机械生成「已确认图标台账」：ref / sourceId / fromDsl / iconSize 全部照抄候选的
// ledgerFields（机器读取值），只由人补 name / comment。禁止在这里手写 ref 或坐标。
//
// 命名表（页面级产物，不是脚本内置）：{ "6": { "name": "PreAlignmentGeometry", "comment": "预对位" }, ... }
// 键 = candidates 数组下标；只登记「真正被 Icon 槽位引用」的图形。
import fs from "node:fs";

const [candidatesFile, outFile, namingFile] = process.argv.slice(2);
if (!candidatesFile || !outFile || !namingFile) {
  console.error("usage: node build-icon-ledger.mjs <icon-candidates.json> <out-icon-map.json> <icon-naming.json>");
  process.exit(2);
}

const naming = JSON.parse(fs.readFileSync(namingFile, "utf8"));
const approved = new Map();
const entries = Array.isArray(naming.icons) ? naming.icons : Object.entries(naming).map(([index, value]) => ({ index, ...value }));
for (const entry of entries) {
  const index = Number(entry.index);
  if (!Number.isInteger(index)) throw new Error(`命名表条目缺少整数 index: ${JSON.stringify(entry)}`);
  if (!entry.name || !entry.comment) throw new Error(`命名表 #${index} 需要 name 与 comment`);
  // fromDsl 必须一并带上：漏掉它会让「sourceId 不唯一的图标」退回错误几何（静默出错）。
  approved.set(index, { name: entry.name, comment: entry.comment, fromDsl: entry.fromDsl === true });
}
if (approved.size === 0) throw new Error("命名表为空：本页若确实没有 Icon 槽位，请直接手写空台账 icons[] 而不是跑这个脚本");

const data = JSON.parse(fs.readFileSync(candidatesFile, "utf8"));
const candidates = Array.isArray(data.candidates) ? data.candidates : [];

const icons = [];
for (const [index, naming] of approved) {
  const candidate = candidates[index];
  if (!candidate) throw new Error(`候选 #${index} 不存在，候选数=${candidates.length}`);
  const ledger = candidate.ledgerFields || {};
  const sourceRef = ledger.ledgerSourceRef || ledger.sourceRef;
  const sourceId = ledger.sourceId || sourceRef;
  // 命名表显式要求 fromDsl（例如 extractSvg 的 sourceId 指向页面根、几何不可信）时，
  // 几何改由 DSL 的 PATH 节点合成：sourceId 必须写 PATH 节点本身，不能写那个可疑的 id。
  const useDsl = Boolean(naming.fromDsl || ledger.fromDsl);
  const entry = {
    sourceId: useDsl ? sourceRef : sourceId,
    sourceRef,
    name: naming.name,
    comment: naming.comment
  };
  if (useDsl) entry.fromDsl = true;
  if (ledger.bakeAncestorTransform) entry.bakeAncestorTransform = true;
  icons.push(entry);
}

const names = new Set(icons.map((icon) => icon.name));
if (names.size !== icons.length) throw new Error("图标资源名重复");

const out = {
  icons,
  candidates: [],
  unmapped: []
};
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ out: outFile, icons: icons.length, names: icons.map((i) => i.name) }, null, 2));
