#!/usr/bin/env node
"use strict";

// 控件在格子里的「尺寸 + 对齐」唯一实现。
//
// 口径：格子尺寸照设计稿（含间距），控件写自身设计稿尺寸，两者的差就是间距；
// 差值落在哪一侧由设计稿偏移决定——偏移≈0 贴起始边、到末端≈0 贴末端、两侧≈相等居中，
// 非对称内缩（两侧都不为 0 且不等）贴起始边并用 Margin 补偏移，精确复现设计稿位置。
//
// 输入只有一个「设计稿格子」（布局产物的 cell），字段都由 gen-mw-wpf-layout.js 从 DSL 推出并登记：
//   cell.width / cell.height           格子尺寸（含跨格累加；像素带照值，星号带吃剩余）
//   cell.nodeWidth / cell.nodeHeight   控件（或容器）自身的设计稿尺寸
//   cell.offsetX / cell.offsetY        控件起点相对格子起点的偏移（撞格下移的格子不登记）
// 三种落空的情况各写各的：
//   - 格子尺寸与控件尺寸相等 → 不写尺寸也不写对齐（Stretch 正好填满）；
//   - 有格子尺寸、没有偏移（撞格下移的格子）→ 只写控件自身尺寸，不写对齐，不猜差值落哪一侧；
//   - 某一维没有格子尺寸（推导给不出正数：内容溢出承载物）→ 该维什么都不写（保持 Stretch），另一维照写。
//
// 消费者：adapters/mw-wpf/gen-mw-wpf-xaml.js（发射属性并写进发射报告）、
//         adapters/mw-wpf/check-wpf-layout.js（按同一实现核对发射报告）。

// 与布局推导同一容差：贴边 / 居中只在"完全贴合"时成立（偏移或剩余 ≤ EPS，或两侧相等）；
// 其余（非对称内缩）一律走 Margin 精确复现。
const EPSILON = 2;

function round(value) {
  return Math.round(Number(value));
}

// 单轴判定：返回 null 表示"格子与控件同尺寸（不写尺寸/对齐）"。
function axisPlan(nodeSize, cellSize, offset) {
  const size = round(nodeSize);
  const cell = round(cellSize);
  if (!(size > 0) || !(cell > 0) || size === cell) return null;
  const start = typeof offset === "number" && offset >= -EPSILON ? round(offset) : null;
  if (start === null) return { size: size, align: null, margin: 0 };
  const end = cell - size - start;
  if (start <= EPSILON) return { size: size, align: "start", margin: 0 };
  if (end <= EPSILON) return { size: size, align: "end", margin: 0 };
  if (Math.abs(start - end) <= EPSILON) return { size: size, align: "center", margin: 0 };
  return { size: size, align: "start", margin: start };
}

// 返回要写在控件（或容器 Grid）上的属性，顺序固定：Width/Height → 对齐 → Margin。
// 格子尺寸缺失（undefined）时返回空对象：调用方保持 Stretch，不猜。
function designBoxAttrs(cell) {
  const attrs = {};
  if (!cell) return attrs;
  const horizontal = axisPlan(cell.nodeWidth, cell.width, cell.offsetX);
  const vertical = axisPlan(cell.nodeHeight, cell.height, cell.offsetY);
  if (!horizontal && !vertical) return attrs;
  if (horizontal) attrs.Width = String(horizontal.size);
  if (vertical) attrs.Height = String(vertical.size);
  const aligns = [
    [horizontal, "HorizontalAlignment", { start: "Left", end: "Right", center: "Center" }],
    [vertical, "VerticalAlignment", { start: "Top", end: "Bottom", center: "Center" }]
  ];
  aligns.forEach(function (item) {
    const plan = item[0];
    if (plan && plan.align) attrs[item[1]] = item[2][plan.align];
  });
  const left = horizontal ? horizontal.margin : 0;
  const top = vertical ? vertical.margin : 0;
  if (left || top) attrs.Margin = left + "," + top + ",0,0";
  return attrs;
}

// 容器 Grid 的尺寸与对齐（发射器与门禁都调它，唯一实现）：
//   ① 主轴（flex 方向 / 补组方向）不写尺寸与对齐 —— 容器撑满格子，那一维的变化由星号带吸收：
//      顶部内容贴顶、底部内容贴底、中间（或末尾）那段空档随高度 / 宽度变长；位置偏移改用 Margin 表达；
//   ② 交叉轴照设计稿写尺寸与对齐；但设计稿本身让容器越过格子末端（end < 0）时，位置锚点按上边 / 左边，
//      写成 start + Margin —— 否则窗口一变容器就跟着末端漂。
function containerBoxAttrs(cell) {
  const box = designBoxAttrs(cell);
  const axis = cell.synthAxis || (cell.children && cell.children.owner && cell.children.owner.direction) || null;
  const stretchY = axis === "column" || axis === "y";
  const stretchX = axis === "row" || axis === "x";
  const margins = String(box.Margin || "0,0,0,0").split(",").map(function (value) { return Number(value) || 0; });
  const known = function (value) { return typeof value === "number" && isFinite(value); };
  if (stretchY) {
    delete box.Height;
    delete box.VerticalAlignment;
    margins[1] = Math.max(0, Math.round(known(cell.offsetY) ? cell.offsetY : 0));
  } else if (known(cell.offsetY) && cell.offsetY > EPSILON && (cell.height - cell.nodeHeight - cell.offsetY) < 0) {
    box.VerticalAlignment = "Top";
    margins[1] = Math.round(cell.offsetY);
  }
  if (stretchX) {
    delete box.Width;
    delete box.HorizontalAlignment;
    margins[0] = Math.max(0, Math.round(known(cell.offsetX) ? cell.offsetX : 0));
  } else if (known(cell.offsetX) && cell.offsetX > EPSILON && (cell.width - cell.nodeWidth - cell.offsetX) < 0) {
    box.HorizontalAlignment = "Left";
    margins[0] = Math.round(cell.offsetX);
  }
  if (margins[0] || margins[1]) box.Margin = margins[0] + "," + margins[1] + ",0,0";
  return box;
}

module.exports = { EPSILON, designBoxAttrs, axisPlan, containerBoxAttrs };
