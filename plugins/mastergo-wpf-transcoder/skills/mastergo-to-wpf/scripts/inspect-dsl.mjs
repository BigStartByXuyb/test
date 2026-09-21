// 打印 DSL 结构摘要（根节点、一级子节点、类型计数），不输出整份 DSL。
//   --texts              额外打印所有可见文本节点
//   --subtree <layerId>  打印指定节点（按 id 或 ref 匹配）的子树，最多 4 层
import fs from "node:fs";

const args = process.argv.slice(2);
const file = args[0];
const flag = args[1];
const subtreeIndex = args.indexOf("--subtree");
const subtreeTarget = subtreeIndex >= 0 ? args[subtreeIndex + 1] : null;
if (!file) {
  console.error("usage: node inspect-dsl.mjs <dsl.snapshot.json|getDsl.json> [--texts]");
  process.exit(2);
}

const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const root = raw.nodes ? raw.nodes[0] : (raw.dsl && raw.dsl.nodes ? raw.dsl.nodes[0] : null);
if (!root) throw new Error("找不到根节点（期望 dsl.snapshot.json 或 getDsl.json）");

const counts = new Map();
const texts = [];
let total = 0;
const walk = (node, depth) => {
  total += 1;
  counts.set(node.type, (counts.get(node.type) || 0) + 1);
  if (Array.isArray(node.text) && node.text.length) {
    const joined = node.text.map((run) => run.text || "").join("");
    if (joined.trim()) texts.push({ ref: node.ref || node.id, depth, text: joined });
  }
  for (const child of node.children || []) walk(child, depth + 1);
};
walk(root, 0);

console.log(`root: ${root.id} | ${JSON.stringify(root.name)} | ${root.type} | ${root.layoutStyle ? root.layoutStyle.width + "x" + root.layoutStyle.height : "-"} | 一级子节点 ${(root.children || []).length}`);
console.log(`总节点: ${total}`);
console.log("类型计数: " + [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", "));
console.log("一级子节点:");
for (const [index, child] of (root.children || []).entries()) {
  const size = child.layoutStyle ? `${Math.round(child.layoutStyle.width)}x${Math.round(child.layoutStyle.height)}` : "-";
  console.log(`  ${String(index).padStart(2)} ${child.id} ${JSON.stringify(child.name)} ${child.type} ${size} 子=${(child.children || []).length}`);
}
if (flag === "--texts") {
  console.log(`可见文本节点（${texts.length}）:`);
  for (const item of texts) console.log(`  d${item.depth} ${item.ref} ${JSON.stringify(item.text)}`);
}

if (subtreeTarget) {
  let found = null;
  const find = (node, ref) => {
    const current = node.ref || ref;
    if (node.id === subtreeTarget || current === subtreeTarget) { found = { node, ref: current }; return true; }
    for (const child of node.children || []) if (find(child, current)) return true;
    return false;
  };
  find(root, "");
  if (!found) { console.log(`未找到节点: ${subtreeTarget}`); }
  else {
    console.log(`子树 ${found.ref} ${JSON.stringify(found.node.name)} ${found.node.type}（最多 4 层）:`);
    const dump = (node, depth, ref) => {
      const current = node.ref || `${ref}/${node.id}`;
      const size = node.layoutStyle ? `${Math.round(node.layoutStyle.width)}x${Math.round(node.layoutStyle.height)}` : "-";
      const text = Array.isArray(node.text) && node.text.length ? ` text=${JSON.stringify(node.text.map((run) => run.text || "").join(""))}` : "";
      console.log(`  ${"  ".repeat(depth)}${node.id} ${JSON.stringify(node.name)} ${node.type} ${size} 子=${(node.children || []).length}${text}`);
      if (depth >= 3) return;
      for (const child of node.children || []) dump(child, depth + 1, current);
    };
    dump(found.node, 0, found.ref);
  }
}
