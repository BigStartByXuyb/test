// 由 discover 候选机械生成「已确认图标台账」：ref / sourceId / fromDsl / iconSize 全部照抄候选的
// ledgerFields（机器读取值），只由人补 name / comment。禁止在这里手写 ref 或坐标。
//
// 命名表（页面级产物，不是脚本内置）：{ "6": { "name": "PreAlignmentGeometry", "comment": "预对位" }, ... }
// 键 = candidates 数组下标；只登记「真正被 Icon 槽位引用」的图形。
//
// 登记结论双向门禁：候选清单的 registration.register 由 discover 机械判定（判据唯一实现在
// lib/icon-registration-policy.js），这里只做对账——少定名（register=true 却没进命名表）与
// 多定名（register=false 却进了命名表）都直接失败。这两类错误以前只能靠事后语义审计发现。
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
const registrationAvailable = data.registrationAvailable !== false &&
  candidates.every(candidate => candidate && candidate.registration && typeof candidate.registration.register === "boolean");

// 对账：命名表必须恰好覆盖 discover 判定为「要登记」的候选。
// 缺结论（未传 --dsl / 旧候选清单）时拒绝生成——没有判据就生成台账，等于把判定又交回人脑。
if (!registrationAvailable) {
  throw new Error("候选清单没有登记结论（registration）：请在 run-all 的 discover 步骤用当前 DSL 快照重新生成候选清单"
        + "（判据实现 scripts/adapters/mtslg-iocontrol/lib/icon-registration-policy.js，禁止手工判断哪条要登记）");
}
const mustName = candidates
  .map((candidate, index) => (candidate.registration.register === true ? index : -1))
  .filter(index => index >= 0);
const missingNames = mustName.filter(index => !approved.has(index));
const unneededNames = [...approved.keys()].filter(index => !mustName.includes(index));
if (missingNames.length) {
  throw new Error("台账缺少图标：候选下标 " + missingNames.join(", ") + " 被 Icon 槽位引用，但命名表没有定名"
    + missingNames.map(index => "\n  #" + index + " basis=" + candidates[index].registration.basis +
      " source=" + candidates[index].registration.source +
      " owner=" + (candidates[index].ownerText || candidates[index].ownerRef || "")).join(""));
}
if (unneededNames.length) {
  throw new Error("台账多出图标：候选下标 " + unneededNames.join(", ") + " 没有被任何 Icon 槽位引用，不能登记（登记了就是 Icons.xaml 里的死资源）"
    + unneededNames.map(index => "\n  #" + index + " basis=" + candidates[index].registration.basis +
      " source=" + candidates[index].registration.source +
      " node=" + candidates[index].nodeName).join(""));
}

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
