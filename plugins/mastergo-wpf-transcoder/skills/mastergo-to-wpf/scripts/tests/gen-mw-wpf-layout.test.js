#!/usr/bin/env node
"use strict";

// 作业A（mw-wpf）布局推导回归：设计稿声明的 flex 主轴必须参与分格，没有声明才回退坐标聚类。
// 锁定六件事（口径 A）：
//   1) 一条带 = 条目 + 它后面的间距（= 到下一带起始边的距离），不发射任何间距元素；
//   2) 哪一段间距落成星号带只看设计稿自身（分组结构优先，散条目按相对判据，真值见 gen-mw-wpf-layout.js），每层最多一条；
//      没有大空档时最后一条带吃剩余（星号），有大空档时最后一条按条目自身尺寸写死；
//   3) 主轴 row 且没有大空档时：固定项（相机链 / 区域根网格最末条目＝常驻右栏）照设计稿像素、
//      容器条目自适应（单个裸星号、多个按设计稿比例加权）、叶子控件照设计稿像素；
//   4) 没有 flex 声明的层级仍按 x 区间重叠 / y 起始边聚类，同一套口径 A 成带；
//   5) 设计稿没打组的地方由代码补组：区域根网格里同一条列带（x 区间重叠）里 ≥2 个条目 → 合成一个栏容器（栏内再成行）；
//   6) 落格按「起始边」判定，横跨多行的控件不会把整页算进第一行。
// 另：成层容器（设计稿声明的 flex 容器，或带尺寸约束的容器）在页面里要保留层级——容器 = 一层 Grid，≥2 条目的容器成层，
// 单条目容器展平（没有主轴关系可表达）、区域根网格不做 1×1 空壳——这两条收口规则都对带尺寸约束的容器例外（约束必须有承载物）。
// 另：控件 bbox 覆盖到的带必须写进 columnSpan / rowSpan——拆带后列会变窄，
// 跨带控件若只占一个格、又按设计稿 bbox 写宽度，就会溢出压住邻格。
// 背景：落格按 [start, end) 包含关系判定时，一条横跨多行的控件（如相机）会让其余控件全部落到第一行，
// 再靠撞格逐行下移——设计稿的行列语义丢失（实测某页 25 个控件被顶 151 次）。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { deriveLayout, readLayoutGroups } = require(path.join(__dirname, "..", "adapters", "mw-wpf", "gen-mw-wpf-layout.js"));

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

function derive(dsl, types, extra) {
  return deriveLayout(Object.assign({
    dsl: dsl,
    types: types,
    map: MAP,
    containers: CONTAINERS,
    tokens: TOKENS,
    pageTarget: "SamplePage",
    visibility: null
  }, extra || {}));
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
  return bands.map(function (band) {
    if (band.size === "Star") return band.weight ? "Star*" + band.weight : "Star";
    if (band.size === "Auto") return "Auto(" + band.gap + ")";
    return band.value;
  });
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

  // 散标签与容器同栏（x 区间重叠）→ 代码补成一个栏容器：区域根网格只留这一栏，
  // 栏内再按口径 A 成行（标签一行、容器一行）。加控件只动栏内那一层，顶层不动。
  assert.strictEqual(region.grid.cells.length, 1, "区域根网格：散标签与容器同栏 → 补成一个栏容器");
  const synthCell = region.grid.cells[0];
  assert.strictEqual(synthCell.synth, true, "合成容器必须登记 synth");
  assert.strictEqual(synthCell.synthAxis, "y", "栏容器的主轴是竖直（栏内成行）");
  const wideLabelCell = synthCell.children.cells.filter(function (cell) { return cell.ref === "wideLabel"; })[0];
  const boxCell = synthCell.children.cells.filter(function (cell) { return cell.container; })[0];
  assert.ok(boxCell && boxCell.children, "row 容器成层，带内层 Grid");
  assert.deepStrictEqual(sizes(boxCell.children.columns), [160, 160, 120],
    "口径 A：带 = 条目 + 它后面的间距（120+40、120+40、末条 120），不发射间隙元素");
  assert.strictEqual(boxCell.children.rows.length, 1, "三个条目同一行 → 内层只有一行");
  assert.strictEqual(layout.pending.length, 0, "不得有待确认项");
  assert.strictEqual(boxCell.children.cells.length, 3, "不再有间隙格：格子数＝条目数");
  assert.strictEqual(boxCell.children.cells.filter(function (cell) { return cell.spacer; }).length, 0,
    "口径 A 不发射空 Grid 间隙格");
  const items = boxCell.children.cells;
  assert.deepStrictEqual(items.map(function (cell) { return cell.column; }), [0, 1, 2],
    "三个条目各占一条条目带");
  assert.deepStrictEqual(items.map(function (cell) { return cell.row; }), [0, 0, 0], "三个条目必须在同一行");
  const inner = items;
  // 栏内的行序照设计稿：标签在前、容器在后，中间那段空档单独成星号带。
  assert.deepStrictEqual([wideLabelCell.row, boxCell.row], [0, 2], "标签一行、容器一行，中间是那条空档带");
  assert.strictEqual(synthCell.children.rows[1].size, "Star", "标签与容器之间的那段空档 → 星号带");
  assert.deepStrictEqual([wideLabelCell.offsetX, boxCell.offsetX], [0, 0], "栏容器原点起点 → 两行横向偏移为 0");
  assert.strictEqual(inner[1].columnSpan, 1, "单个条目的占格不跨列");
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

  // 标签与三个按钮同栏（x 区间重叠）→ 先补成一个栏容器；栏内仍按 x 区间重叠聚类 + 撞格下移。
  assert.strictEqual(region.grid.cells.length, 1, "同栏的散条目补成一个栏容器");
  const synth = region.grid.cells[0];
  assert.strictEqual(synth.synth, true, "合成容器必须登记 synth");
  assert.strictEqual(synth.synthAxis, "y", "栏容器的主轴是竖直（栏内成行）");
  const innerGrid = synth.children;
  const innerOf = function (ref) {
    const hit = innerGrid.cells.filter(function (cell) { return cell.ref === ref; });
    assert.strictEqual(hit.length, 1, "每个控件必须恰好落一格: " + ref);
    return hit[0];
  };
  assert.deepStrictEqual(sizes(innerGrid.columns), ["Star"], "没有 flex 声明 → 回退 x 区间重叠聚类（同一条列带）");
  const cols = ["btnA", "btnB", "btnC"].map(function (ref) { return innerOf(ref).column; });
  assert.deepStrictEqual(cols, [0, 0, 0], "同一条列带里的三个控件共列");
  const rows = ["btnA", "btnB", "btnC"].map(function (ref) { return innerOf(ref).row; });
  assert.strictEqual(new Set(rows).size, 3, "共列时靠撞格逐行下移，三个控件各占一行");
  assert.ok(rows[0] < rows[1] && rows[1] < rows[2], "撞格下移按 y 向后找空格");
  assert.ok(innerOf("wideLabel").row < rows[0], "上方标签在更前面的行");
  assert.ok(innerGrid.rows.length >= 4, "撞格必须插入新行，而不是丢控件");
}

// ---------- 3. flexDirection=column：同一起点带里的条目独占一条行带 ----------
{
  const colBox = node("colBox", "FRAME", { width: 200, height: 120, relativeX: 700, relativeY: 215 },
    [
      node("rowA", "INSTANCE", { width: 200, height: 60, relativeX: 0, relativeY: 0 }),
      node("rowB", "INSTANCE", { width: 200, height: 60, relativeX: 0, relativeY: 66 })
    ],
    { flexContainerInfo: { flexDirection: "column", gap: "6px" } });
  const layout = derive(snapshot([], [colBox]),
    typesOf([
      { ref: "rowA", controlType: "IconButton", absX: 700, absY: 300, w: 200, h: 60 },
      { ref: "rowB", controlType: "IconButton", absX: 700, absY: 366, w: 200, h: 60 }
    ]));
  const region = workArea(layout);

  // 区域根网格是"单容器链"时把最内层提上来：根网格直接就是该容器的两个条目。
  assert.deepStrictEqual(sizes(region.grid.rows), [215, 66, "Star"],
    "首段空档成带（分区顶边 → 容器顶边 215）；口径 A：6 的间距并进上一条带（60+6），末条吃剩余");
  assert.strictEqual(region.grid.cells.filter(function (cell) { return cell.spacer; }).length, 0,
    "口径 A 不发射空 Grid 间隙格");
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

  assert.strictEqual(region.grid.rows.length, 3, "首段空档带 + 两个 y 起点两条行带");
  assert.strictEqual(cellOf(region, "tall").row, 1, "高控件落在自己的行带（第 0 行是首段空档带）");
  assert.strictEqual(cellOf(region, "target").row, 2, "后面的控件落在自己的行带，不被高控件的带吞掉");
  assert.strictEqual(cellOf(region, "tall").rowSpan, 2, "高 300 的控件覆盖两条行带，必须写 rowSpan");
  assert.strictEqual(cellOf(region, "target").rowSpan, 1, "单行控件不跨行");
}

// ---------- 5. 层级照设计稿：成层容器 → 一层 Grid；单条目容器展平（带约束的容器除外）----------
{
  // 设计：外层 row 容器（两个条目：相机 + 竖排容器），竖排容器里两行文本，
  // 相机外面还套了一层只有 1 个条目的 row 容器（必须展平）。
  const singleWrap = node("singleWrap", "FRAME", { width: 600, height: 600, relativeX: 20, relativeY: 115 },
    [node("camera", "INSTANCE", { width: 600, height: 600, relativeX: 0, relativeY: 0 })],
    { flexContainerInfo: { flexDirection: "row" } });
  const column = node("column", "FRAME", { width: 300, height: 600, relativeX: 700, relativeY: 115 },
    [
      node("labelA", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 0 }),
      node("labelB", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 40 })
    ],
    { flexContainerInfo: { flexDirection: "column", gap: "24px" } });
  const outer = node("outer", "FRAME", { width: 1159, height: 608, relativeX: 60, relativeY: 115 }, [singleWrap, column],
    { flexContainerInfo: { flexDirection: "row", gap: "45px" } });
  const layout = derive(snapshot([], [outer]),
    typesOf([
      { ref: "camera", controlType: "Camera", absX: 20, absY: 200, w: 600, h: 600 },
      { ref: "labelA", controlType: "TextBlock", absX: 760, absY: 200, w: 80, h: 16 },
      { ref: "labelB", controlType: "TextBlock", absX: 760, absY: 240, w: 80, h: 16 }
    ]));
  const region = workArea(layout);

  // 区域根网格 = 外层 row 容器的两个条目：相机（singleWrap 已展平）+ 竖排容器
  assert.strictEqual(region.grid.cells.length, 2, "区域根网格应有两个条目，且没有间隙格");
  const cameraCell = cellOf(region, "camera");
  assert.strictEqual(cameraCell.container, undefined, "相机是控件格子");
  assert.deepStrictEqual(sizes(region.grid.columns).slice(0, 2), [20, 600],
    "首段空档带 20 + 相机所在列固定成设计稿像素 600");
  assert.deepStrictEqual(sizes(region.grid.columns), [20, 600, "Star", 300],
    "首段空档带 20；两个条目之间 80 是设计稿留下的空档 → 单独成星号带；相机列固定 600、容器列照设计稿 300");
  const columnCell = region.grid.cells.filter(function (cell) { return cell.container; });
  assert.strictEqual(columnCell.length, 1, "≥2 条目的容器必须成层");
  assert.strictEqual(columnCell[0].ref, "column", "成层的是竖排容器");
  assert.notStrictEqual(cameraCell.column, columnCell[0].column, "两个条目分列");
  assert.ok(columnCell[0].children, "容器格子必须带内层 Grid");
  const innerItems = columnCell[0].children.cells;
  assert.strictEqual(innerItems.length, 2, "内层 Grid 装容器自己的两个条目");
  assert.deepStrictEqual(innerItems.map(function (cell) { return cell.ref; }), ["labelA", "labelB"],
    "内层条目的顺序与设计稿一致");
  assert.strictEqual(columnCell[0].children.cells.filter(function (cell) { return cell.spacer; }).length, 0,
    "口径 A 不发射间隙格");
  assert.deepStrictEqual(sizes(columnCell[0].children.rows), [16, "Star", 16],
    "内层 column 容器：这一层只有一段间距、且它比相邻条目的一半还大 → 落成星号带（设计尺寸下等于 24）");
}

// ---------- 6. 口径 A 的星号位置：设计稿留下的空档单独成带，末条写死 ----------
{
  // 右侧栏：3 个按钮（行拍 120）＋ 100 的大空档 ＋ 2 个按钮（行拍 108 / 80）
  const rail = node("rail", "FRAME", { width: 210, height: 608, relativeX: 1000, relativeY: 115 },
    [
      node("btn1", "INSTANCE", { width: 170, height: 80, relativeX: 20, relativeY: 0 }),
      node("btn2", "INSTANCE", { width: 170, height: 80, relativeX: 20, relativeY: 120 }),
      node("btn3", "INSTANCE", { width: 170, height: 80, relativeX: 20, relativeY: 240 }),
      node("btn4", "INSTANCE", { width: 170, height: 80, relativeX: 20, relativeY: 420 }),
      node("btn5", "INSTANCE", { width: 170, height: 80, relativeX: 20, relativeY: 528 })
    ],
    { flexContainerInfo: { flexDirection: "column", gap: "100px" } });
  const layout = derive(snapshot([], [rail]),
    typesOf([
      { ref: "btn1", controlType: "IconButton", absX: 1020, absY: 200, w: 170, h: 80 },
      { ref: "btn2", controlType: "IconButton", absX: 1020, absY: 320, w: 170, h: 80 },
      { ref: "btn3", controlType: "IconButton", absX: 1020, absY: 440, w: 170, h: 80 },
      { ref: "btn4", controlType: "IconButton", absX: 1020, absY: 620, w: 170, h: 80 },
      { ref: "btn5", controlType: "IconButton", absX: 1020, absY: 728, w: 170, h: 80 }
    ]));
  const region = workArea(layout);

  assert.deepStrictEqual(sizes(region.grid.rows), [115, 120, 120, 80, "Star", 108, 80],
    "首段空档带 115（分区顶边 → 右栏顶边）＋ 行拍：80+40 ／ 80+40 ／ 80 ／ 星号（100）／ 80+28 ／ 80");
  assert.deepStrictEqual(["btn1", "btn2", "btn3", "btn4", "btn5"].map(function (ref) {
    return cellOf(region, ref).row;
  }), [1, 2, 3, 5, 6], "第 0 行是首段空档带；星号带占第 4 行，后面两个按钮顺延");
  assert.strictEqual(region.grid.cells.filter(function (cell) { return cell.spacer; }).length, 0,
    "口径 A 一个间隙元素都不发射");
  assert.strictEqual(layout.pending.length, 0, "不得有待确认项");
}

// ---------- 7. 设计稿没打组 → 代码补组（同一栏里 ≥2 个条目）----------
{
  const camera = node("camera", "INSTANCE", { width: 600, height: 600, relativeX: 20, relativeY: 115 });
  const railButtons = [
    node("btn1", "INSTANCE", { width: 170, height: 80, relativeX: 1090, relativeY: 182 }),
    node("btn2", "INSTANCE", { width: 170, height: 80, relativeX: 1090, relativeY: 282 }),
    node("btn3", "INSTANCE", { width: 170, height: 80, relativeX: 1090, relativeY: 382 }),
    node("btn4", "INSTANCE", { width: 170, height: 80, relativeX: 1090, relativeY: 606 }),
    node("btn5", "INSTANCE", { width: 170, height: 80, relativeX: 1090, relativeY: 714 })
  ];
  const layout = derive(snapshot([], [camera].concat(railButtons)),
    typesOf([
      { ref: "camera", controlType: "Camera", absX: 20, absY: 200, w: 600, h: 600 }
    ].concat(railButtons.map(function (item, index) {
      return {
        ref: item.id, controlType: "IconButton",
        absX: 1090, absY: 85 + 182 + [0, 100, 200, 424, 532][index], w: 170, h: 80
      };
    }))));
  const region = workArea(layout);

  const synth = region.grid.cells.filter(function (cell) { return cell.container && cell.synth; });
  assert.strictEqual(synth.length, 1, "同一栏里的 5 个按钮 → 补出一个栏容器");
  assert.strictEqual(cellOf(region, "camera").container, undefined, "相机仍是控件格子");
  assert.deepStrictEqual(sizes(synth[0].children.rows), [100, 100, 80, "Star", 108, 80],
    "补出来的容器里同样是口径 A 的 6 行");
  assert.strictEqual(synth[0].children.cells.length, 5, "5 个按钮平铺在补出来的容器里");
  assert.strictEqual(layout.pending.length, 0, "补组后不得有待确认项");
}

// ---------- 8. 偏移基准：格子起点 = 网格原点 + 前面各带尺寸，不是"带起点" ----------
{
  // 容器整体下移 200、容器里的按钮再内缩 20：两段偏移都必须原样落进产物，
  // （用"带起点"当格子起点会把首条带前面的内缩整段丢掉：容器被贴到分区顶边、按钮被贴到容器左边）
  const box = node("box", "FRAME", { width: 210, height: 200, relativeX: 100, relativeY: 200 },
    [
      node("btn1", "INSTANCE", { width: 170, height: 80, relativeX: 20, relativeY: 0 }),
      node("btn2", "INSTANCE", { width: 170, height: 80, relativeX: 20, relativeY: 120 })
    ],
    { flexContainerInfo: { flexDirection: "column", gap: "40px" } });
  const side = node("side", "TEXT", { width: 40, height: 16, relativeX: 700, relativeY: 200 });
  const layout = derive(snapshot([], [box, side]),
    typesOf([
      { ref: "btn1", controlType: "IconButton", absX: 120, absY: 285, w: 170, h: 80 },
      { ref: "btn2", controlType: "IconButton", absX: 120, absY: 405, w: 170, h: 80 },
      { ref: "side", controlType: "TextBlock", absX: 700, absY: 285, w: 40, h: 16 }
    ]));
  const region = workArea(layout);

  const boxCell = cellOf(region, "box");
  assert.strictEqual(region.grid.rows[0].value, 200, "首段空档成带：分区顶边 → 容器顶边 200");
  assert.strictEqual(region.grid.columns[0].value, 100, "首段空档成带：分区左边 → 容器左边 100");
  assert.deepStrictEqual([boxCell.offsetX, boxCell.offsetY], [0, 0],
    "容器落在带里 → 偏移为 0（不必用 Margin 顶到设计稿位置）");
  const inner = region.grid.cells.filter(function (cell) { return cell.container; })[0].children;
  assert.strictEqual(inner.columns[0].value, 20, "容器内的左边内缩（padding 20）落成首段空档带");
  assert.deepStrictEqual(inner.cells.map(function (cell) { return cell.offsetX; }), [0, 0],
    "条目落在带里 → 偏移为 0（不会被贴到容器左边）");
  assert.deepStrictEqual(inner.cells.map(function (cell) { return cell.offsetY; }), [0, 0],
    "第一条条目带与容器顶边齐平");
}

// ---------- 9. 分组表（意图输入）：只写关系，不写事实 ----------
{
  const mk = function (id, x, y) {
    return node(id, "TEXT", { width: 60, height: 16, relativeX: x, relativeY: y });
  };
  const typeOf = function (ref, x, y) {
    return { ref: ref, controlType: "TextBlock", absX: x, absY: y + 85, w: 60, h: 16 };
  };
  const boxes = [mk("a", 100, 115), mk("b", 100, 215), mk("c", 400, 115), mk("d", 400, 215)];
  const types = typesOf([typeOf("a", 100, 115), typeOf("b", 100, 215), typeOf("c", 400, 115), typeOf("d", 400, 215)]);

  // 没有分组表：机械判据只看位置 → 两条列带各补一个栏容器。
  const mechanical = workArea(derive(snapshot([], boxes), types));
  assert.strictEqual(mechanical.grid.cells.filter(function (cell) { return cell.synth; }).length, 2,
    "没有分组表：机械判据按两条列带各补一个栏容器");
  assert.strictEqual(mechanical.unresolved.length, 0, "两条列带都收走了，没有未归宿条目");

  // 有分组表：四条并成一个声明的栏容器，顶层只剩这一个格子。
  const declared = workArea(derive(snapshot([], boxes), types, {
    groups: { groups: [{ id: "all", kind: "column", members: ["a", "b", "c", "d"] }] }
  }));
  const declaredCells = declared.grid.cells.filter(function (cell) { return cell.ref === "declared:all"; });
  assert.strictEqual(declaredCells.length, 1, "分组表把四条收成一个声明的栏容器");
  assert.strictEqual(declared.grid.cells.length, 1, "四条都被声明收走 → 顶层只剩这一个容器格子");
  assert.deepStrictEqual(declaredCells[0].children.cells.map(function (cell) { return cell.ref; }).sort(),
    ["a", "b", "c", "d"], "声明容器的成员就是分组表里那几个 ref，一个不多一个不少");

  // 分组表没覆盖到的散条目仍走机械判据；既不在表里、又凑不成一条栏的条目进未归宿清单。
  const mixedBoxes = boxes.concat([mk("e", 700, 115)]);
  const mixedTypes = typesOf([
    typeOf("a", 100, 115), typeOf("b", 100, 215), typeOf("c", 400, 115), typeOf("d", 400, 215), typeOf("e", 700, 115)
  ]);
  const mixed = workArea(derive(snapshot([], mixedBoxes), mixedTypes, {
    groups: { groups: [{ id: "left", kind: "column", members: ["a", "b"] }] }
  }));
  assert.strictEqual(mixed.grid.cells.filter(function (cell) { return cell.ref === "declared:left"; }).length, 1,
    "声明的那一栏按表落成");
  assert.strictEqual(mixed.grid.cells.filter(function (cell) { return cell.ref === "synth:c"; }).length, 1,
    "表没覆盖到的两条同栏条目仍由机械判据补成栏容器");
  assert.deepStrictEqual(mixed.unresolved.map(function (item) { return item.ref; }), ["e"],
    "既不在分组表里、又凑不成一条栏的条目 → 进未归宿清单");

  // 失败面：ref 不存在 / 一个 ref 进两个分组 / 组的地盘里夹着未归组条目（标注与几何矛盾）。
  assert.throws(function () {
    derive(snapshot([], boxes), types, { groups: { groups: [{ id: "bad", kind: "column", members: ["a", "nope"] }] } });
  }, /不在本层条目里/, "分组表引用了不存在的 ref → 失败");
  assert.throws(function () {
    derive(snapshot([], boxes), types, {
      groups: { groups: [{ id: "g1", kind: "column", members: ["a", "b"] }, { id: "g2", kind: "column", members: ["a", "c"] }] }
    });
  }, /出现在多个分组里/, "同一个 ref 出现在两个分组 → 失败");
  assert.throws(function () {
    derive(snapshot([], boxes), types, { groups: { groups: [{ id: "wide", kind: "column", members: ["a", "b", "d"] }] } });
  }, /还有未归组的条目/, "组的地盘里夹着未归组条目 → 失败（标注与设计稿几何矛盾）");
  assert.throws(function () {
    derive(snapshot([], boxes), types, {
      groups: { pageTarget: "OtherPage", groups: [{ id: "g", kind: "column", members: ["a", "b"] }] }
    });
  }, /pageTarget/, "分组表标的页面与本次页面不一致 → 失败（防套错页）");

  // 文件形状：schema 版本、kind、成员数量都在读表时就失败。
  const tmp = path.join(os.tmpdir(), "layout-groups-" + process.pid + ".json");
  try {
    const write = function (doc) { fs.writeFileSync(tmp, JSON.stringify(doc), "utf8"); };
    write({ schemaVersion: "nope", groups: [] });
    assert.throws(function () { readLayoutGroups(tmp); }, /schemaVersion/, "分组表 schema 版本不对 → 失败");
    write({ schemaVersion: "mw-wpf-layout-groups/1", groups: [{ id: "g", kind: "diagonal", members: ["a", "b"] }] });
    assert.throws(function () { readLayoutGroups(tmp); }, /kind/, "分组表的 kind 只能是 column / row");
    write({ schemaVersion: "mw-wpf-layout-groups/1", groups: [{ id: "g", kind: "column", members: ["a"] }] });
    assert.throws(function () { readLayoutGroups(tmp); }, /至少 2 个 ref/, "分组至少要有 2 个成员");
  } finally {
    fs.unlinkSync(tmp);
  }
}

