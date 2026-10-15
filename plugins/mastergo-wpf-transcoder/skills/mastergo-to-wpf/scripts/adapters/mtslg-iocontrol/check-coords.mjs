// 从 mapping 审计重算「坐标核对输入」并落盘，交给官方 check-iocontrol-coords.js 逐控件核对。
// 构建逻辑的唯一实现在 lib/coord-nodes.js（Bundle 第 10 步调用同一份）。
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const { buildCoordNodes } = createRequire(import.meta.url)("../../lib/coord-nodes.js");

const [mappingFile, outFile] = process.argv.slice(2);
if (!mappingFile || !outFile) {
  console.error("usage: node check-coords.mjs <mapping.json> <out-coords.json>");
  process.exit(2);
}

const mapping = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
const out = buildCoordNodes(mapping, {
  // 不猜原点：输入损坏时给出可定位的失败。
  fail: (message) => { console.error(message); process.exit(1); }
});

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ out: outFile, nodes: out.length }, null, 2));
