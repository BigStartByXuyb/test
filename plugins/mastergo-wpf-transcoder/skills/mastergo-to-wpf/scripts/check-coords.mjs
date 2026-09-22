// 从 mapping 审计独立重算「坐标核对输入」（x/y = 该节点来源的页面绝对坐标，contentOriginX/Y = 输出父容器原点），
// 交给官方 check-iocontrol-coords.js 做逐控件核对。重算口径与 Bundle 一致：
//   根级节点 → 原点 (0, 192)；容器子节点 → 父容器 pageAbs + 容器内容区原点（contentInset）。
// 注意：x/y 传来源 pageAbs（不是发射坐标），核对器自己用 (x - contentOriginX, y - contentOriginY) 推出 Left/Top。
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// 原点口径的唯一实现在 lib/script-helpers.js（与 Bundle 同一份）：0 是合法坐标，取不到父容器
// pageAbs 时返回 null → 本脚本按"不猜原点"直接失败（历史写法 `Number(y) || 192` 会把贴页面顶边的
// 父容器算成 192，让核对器与生成器对同一份 mapping 得出相差 192 的原点）。
const { outputOrigin } = createRequire(import.meta.url)("./lib/script-helpers.js");

const [mappingFile, outFile] = process.argv.slice(2);
if (!mappingFile || !outFile) {
  console.error("usage: node check-coords.mjs <mapping.json> <out-coords.json>");
  process.exit(2);
}

const mapping = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
const nodes = Array.isArray(mapping.nodes) ? mapping.nodes : [];
const sourceByRef = new Map((mapping.sourceNodes || []).map((node) => [node.ref, node]));
const nodeByRef = new Map(nodes.map((node) => [node.ref, node]));
const rootRef = mapping.rootRef || null;

// 不猜原点：输入损坏时给出可定位的失败，而不是算出一个错的原点让后面误判。
const failOrigin = (message) => {
  console.error(message);
  process.exit(1);
};

const number = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const out = nodes.map((node) => {
  const source = sourceByRef.get(node.sourceRef || node.ref) || {};
  const outputParentRef = node.layoutParent !== undefined
    ? node.layoutParent
    : (node.parent !== undefined ? node.parent : (source.parentRef || null));
  const parentSource = outputParentRef ? (sourceByRef.get(outputParentRef) || null) : null;
  const parentIsRoot = !parentSource || (rootRef !== null && parentSource.ref === rootRef);
  const parentNode = outputParentRef ? nodeByRef.get(outputParentRef) : null;
  const parentInset = !parentIsRoot && parentNode && parentNode.contentInset ? parentNode.contentInset : null;
  const origin = outputOrigin({
    parentIsRoot: parentIsRoot,
    parentPageAbsX: parentSource ? parentSource.pageAbsX : null,
    parentPageAbsY: parentSource ? parentSource.pageAbsY : null,
    inset: parentInset
  });
  if (!origin) {
    failOrigin("无法确定输出父容器原点：节点 " + (node.xmlId || node.id || node.ref) + " 的输出父容器 " +
      outputParentRef + " 缺少 pageAbsX/pageAbsY（不能猜原点）");
  }
  const originX = origin.x;
  const originY = origin.y;
  const isTextBlock = (node.controlType || (node.attrs && node.attrs.ControlType)) === "TextBlock";
  if (node.nodeKind === "table-column") {
    return {
      id: node.xmlId || node.id || node.ref,
      x: originX,
      y: originY,
      w: "NaN",
      h: node.expectedHeight,
      contentOriginX: originX,
      contentOriginY: originY
    };
  }
  return {
    id: node.xmlId || node.id || node.ref,
    x: number(source.pageAbsX !== undefined ? source.pageAbsX : node.absX),
    y: number(source.pageAbsY !== undefined ? source.pageAbsY : node.absY),
    w: isTextBlock ? "NaN" : number(node.expectedWidth !== undefined ? node.expectedWidth : source.width),
    h: number(node.expectedHeight !== undefined ? node.expectedHeight : source.height),
    contentOriginX: originX,
    contentOriginY: originY
  };
});

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ out: outFile, nodes: out.length }, null, 2));
