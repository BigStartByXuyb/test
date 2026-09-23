#!/usr/bin/env node
"use strict";

// 作业A（mw-wpf）布局推导回归：设计稿声明的 flex 主轴必须参与分格，没有声明才回退坐标聚类。
// 锁定四件事：
//   1) 容器声明 flexDirection=row 时，主轴上的每个条目独占一条列带（尺寸=相邻起点差，末带 Star）；
//   2) 容器声明 flexDirection=column 时同理拆行；
//   3) 没有 flex 声明的层级仍按 x 区间重叠聚类（同一条列带里的控件靠撞格下移）；
//   4) 落格按「起始边」判定，横跨多行的控件不会把整页算进第一行。
// 另：控件 bbox 覆盖到的带必须写进 columnSpan / rowSpan——拆带后列会变窄，
// 跨带控件若只占一个格、又按设计稿 bbox 写宽度，就会溢出压住邻格（审计 REVIEW-003）。
// 背景：落格按 [start, end) 包含关系判定时，一条横跨多行的控件（如相机）会让其余控件全部落到第一行，
// 再靠撞格逐行下移——设计稿的行列语义丢失（实测某页 25 个控件被顶 151 次）。

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { deriveLayout } = require(path.join(__dirname, "..", "adapters", "mw-wpf", "gen-mw-wpf-layout.js"));

const TOKENS = { headerHeight: 85, bottomHeight: 180 };
const ROUTE_MAP = path.join(__dirname, "..", "..", "references", "adapters", "mw-wpf", "mw-wpf-map.json");
const MAP = JSON.parse(fs.readFileSync(ROUTE_MAP, "utf8"));
const CONTAINERS = new Set(
  Object.entries(MAP.controlTypes || {})
    .filter(function (entry) { return entry[1] && entry[1].holdsChildren === true; })
    .map(function (entry) { return entry[0]; })
);

function node(id, type, style, children, extra) {
  return Object.assign({ id: id, name: id, type: type, layoutStyle: style, children: children || [] }, extra || {});
}

function snapshot(rootChildren, contentChildren) {
  const body = node("body", "FRAME", { width: 1280, height: 902, relativeX: 0, relativeY: 85 }, contentChildren || []);
  return {
    schemaVersion: "mastergo-dsl-snapshot/2",
    nodeCount: 2 + (rootChildren || []).length,
    dsl: {
      nodes: [
        node("root", "FRAME", { width: 1280, height: 1024, relativeX: 0, relativeY: 0 }, [body].concat(rootChildren || []))
      ]
    }
  };
}

function typesOf(nodes) {
  const byRef = new Map();
  nodes.forEach(function (item) { byRef.set(item.ref, item); });
  return { byRef: byRef };
}

function derive(dsl, types) {
  return deriveLayout({
    dsl: dsl,
    types: types,
    map: MAP,
    containers: CONTAINERS,
    tokens: TOKENS,
    pageTarget: "SamplePage",
    visibility: null
  });
}

function workArea(layout) {
  const region = layout.regions.filter(function (item) { return item.emit !== false; });
  assert.strictEqual(region.length, 1, "内容区必须恰好一个");
  return region[0];
}

function cellOf(region, ref) {
  const hit = region.grid.cells.filter(function (cell) { return cell.ref === ref; });
  assert.strictEqual(hit.length, 1, "每个控件必须恰好落一格: " + ref);
  return hit[0];
}

function sizes(bands) {
  return bands.map(function (band) { return band.size === "Star" ? "Star" : band.value; });
}

// ---------- 1. flexDirection=row：条目独占一条列带 ----------
{
  const rowBox = node("rowBox", "FRAME", { width: 500, height: 60, relativeX: 100, relativeY: 215 },
    [
      node("btnA", "INSTANCE", { width: 120, height: 60, relativeX: 0, relativeY: 0 }),
      node("btnB", "INSTANCE", { width: 120, height: 60, relativeX: 160, relativeY: 0 }),
      node("btnC", "INSTANCE", { width: 120, height: 60, relativeX: 320, relativeY: 0 })
    ],
    { flexContainerInfo: { flexDirection: "row", gap: "40px" } });
  // 横跨三个按钮的同层控件：没有 flex 声明时它会把三条 x 带链成一条。
  const wide = node("wideLabel", "TEXT", { width: 500, height: 20, relativeX: 100, relativeY: 115 });
  const layout = derive(snapshot([], [rowBox, wide]),
    typesOf([
      { ref: "btnA", controlType: "IconButton", absX: 100, absY: 300, w: 120, h: 60 },
      { ref: "btnB", controlType: "IconButton", absX: 260, absY: 300, w: 120, h: 60 },
      { ref: "btnC", controlType: "IconButton", absX: 420, absY: 300, w: 120, h: 60 },
      { ref: "wideLabel", controlType: "TextBlock", absX: 100, absY: 200, w: 500, h: 20 }
    ]));
  const region = workArea(layout);

  assert.deepStrictEqual(sizes(region.grid.columns), [160, 160, "Star"],
    "row 容器的条目必须各占一条列带，尺寸取相邻起点差");
  assert.strictEqual(region.grid.rows.length, 2, "两个 y 起点 → 两条行带，不得出现撞格插入行");
  assert.strictEqual(layout.pending.length, 0, "不得有待确认项");
  const rowA = cellOf(region, "btnA");
  const rowB = cellOf(region, "btnB");
  const rowC = cellOf(region, "btnC");
  assert.strictEqual(rowA.row, rowB.row, "同一行容器里的条目必须在同一行");
  assert.strictEqual(rowB.row, rowC.row, "同一行容器里的条目必须在同一行");
  assert.deepStrictEqual([rowA.column, rowB.column, rowC.column], [0, 1, 2], "三个条目必须落在三条列带上");
  assert.strictEqual(cellOf(region, "wideLabel").row, 0, "上方的标签落在第一行");
  assert.strictEqual(cellOf(region, "wideLabel").columnSpan, 3, "宽 500 的标签覆盖三条列带，必须写 columnSpan");
  assert.strictEqual(rowB.columnSpan, 1, "单个条目的占格不跨列");
  assert.strictEqual(region.grid.columns[2].size, "Star", "末列用星号吃掉剩余空间，容得下跨带控件");
}

// ---------- 2. 没有 flex 声明：回退 x 区间重叠聚类 ----------
{
  const plainBox = node("plainBox", "FRAME", { width: 500, height: 60, relativeX: 100, relativeY: 215 },
    [
      node("btnA", "INSTANCE", { width: 120, height: 60, relativeX: 0, relativeY: 0 }),
      node("btnB", "INSTANCE", { width: 120, height: 60, relativeX: 160, relativeY: 0 }),
      node("btnC", "INSTANCE", { width: 120, height: 60, relativeX: 320, relativeY: 0 })
    ]);
  const wide = node("wideLabel", "TEXT", { width: 500, height: 20, relativeX: 100, relativeY: 115 });
  const layout = derive(snapshot([], [plainBox, wide]),
    typesOf([
      { ref: "btnA", controlType: "IconButton", absX: 100, absY: 300, w: 120, h: 60 },
      { ref: "btnB", controlType: "IconButton", absX: 260, absY: 300, w: 120, h: 60 },
      { ref: "btnC", controlType: "IconButton", absX: 420, absY: 300, w: 120, h: 60 },
      { ref: "wideLabel", controlType: "TextBlock", absX: 100, absY: 200, w: 500, h: 20 }
    ]));
  const region = workArea(layout);

  assert.deepStrictEqual(sizes(region.grid.columns), ["Star"], "没有 flex 声明就按 x 区间重叠聚成一条列带");
  const cols = ["btnA", "btnB", "btnC"].map(function (ref) { return cellOf(region, ref).column; });
  assert.deepStrictEqual(cols, [0, 0, 0], "同一条列带里的三个控件共列");
  const rows = ["btnA", "btnB", "btnC"].map(function (ref) { return cellOf(region, ref).row; });
  assert.deepStrictEqual(rows, [1, 2, 3], "共列时靠撞格逐行下移（插入行）");
  assert.ok(region.grid.rows.length >= 4, "撞格必须插入新行，而不是丢控件");
}

// ---------- 3. flexDirection=column：同一起点带里的条目独占一条行带 ----------
{
  const colBox = node("colBox", "FRAME", { width: 200, height: 120, relativeX: 700, relativeY: 215 },
    [
      node("rowA", "INSTANCE", { width: 200, height: 60, relativeX: 0, relativeY: 0 }),
      node("rowB", "INSTANCE", { width: 200, height: 60, relativeX: 0, relativeY: 6 })
    ],
    { flexContainerInfo: { flexDirection: "column", gap: "6px" } });
  const layout = derive(snapshot([], [colBox]),
    typesOf([
      { ref: "rowA", controlType: "IconButton", absX: 700, absY: 300, w: 200, h: 60 },
      { ref: "rowB", controlType: "IconButton", absX: 700, absY: 306, w: 200, h: 60 }
    ]));
  const region = workArea(layout);

  assert.deepStrictEqual(sizes(region.grid.rows), [6, "Star"], "column 容器的条目必须各占一条行带");
  assert.notStrictEqual(cellOf(region, "rowA").row, cellOf(region, "rowB").row, "两个条目不得挤在同一行");
}

// ---------- 4. 落格按起始边判定：横跨多行的控件不吃掉后面的行 ----------
{
  const tall = node("tall", "FRAME", { width: 100, height: 300, relativeX: 900, relativeY: 115 });
  const target = node("target", "TEXT", { width: 50, height: 20, relativeX: 100, relativeY: 315 });
  const layout = derive(snapshot([], [tall, target]),
    typesOf([
      { ref: "tall", controlType: "IconButton", absX: 900, absY: 200, w: 100, h: 300 },
      { ref: "target", controlType: "TextBlock", absX: 100, absY: 400, w: 50, h: 20 }
    ]));
  const region = workArea(layout);

  assert.strictEqual(region.grid.rows.length, 2, "两个 y 起点 → 两条行带");
  assert.strictEqual(cellOf(region, "tall").row, 0, "高控件落在自己的行带");
  assert.strictEqual(cellOf(region, "target").row, 1, "后面的控件落在自己的行带，不被高控件的带吞掉");
  assert.strictEqual(cellOf(region, "tall").rowSpan, 2, "高 300 的控件覆盖两条行带，必须写 rowSpan");
  assert.strictEqual(cellOf(region, "target").rowSpan, 1, "单行控件不跨行");
}

