#!/usr/bin/env node
"use strict";

// 作业A（mw-wpf）布局推导：把「类型判定结果 + DSL 结构」推导成 Grid 布局产物
// （分区 → 行列 → 格子），供页面发射器与布局门禁共同消费。
//
// 输入
//   --types        Generated/<页面名>.component-types.json（或 mapping.json；取 ref/controlType/bbox 等字段）
//   --dsl          dsl.snapshot.json（节点树与父子链；算绝对坐标用）
//   --visibility   visibility.json（可选；effectiveVisible=false 的节点不参与分格）
//   --map          references/adapters/mw-wpf/mw-wpf-map.json（判定哪些类型是容器）
//   --page-target  页面名
//   --out          Generated/<页面名>.wpf-layout.json
//   [--report]     推导报告（分区摘要 / 未归格节点）
//
// 输出（冻结；发射器与门禁按它读）
//   { schemaVersion, adapter:"mw-wpf", pageTarget, design:{width,height},
//     regions:[{id,name,ref,role,emit,x,y,w,h,grid:{rows[],columns[],cells[]}}], pending[] }
//
// 规则
//   - 分区只有两类：框架固定区（顶部栏 / 底部栏，按框架 Token 高度，emit=false）
//     与**一个**内容区（emit=true）。框架固定区只有顶部栏与底部栏（框架加载壳只有这两条常驻带），
//     不进页面，因此页面外层只有**一个** Grid（内容网格本身）；设计稿的业务内容（含容器链条）
//     全部落在同一个内容区里，内部再按行列分格。
//   - 行列由节点 bbox 聚类得到（列 = x 区间重叠的带，行 = y 起始边邻近的带），尺寸照设计稿像素。
//   - 落格按起始边判定归属；控件 bbox 覆盖到的带全部占住（跨带即写 RowSpan / ColumnSpan）。
//   - flex 主轴优先：容器声明了 flexContainerInfo.flexDirection（row/column）时，该容器主轴上的每个
//     flex 条目独占一条带（同一条带里出现 ≥2 个条目才拆，拆点取设计稿起点，gap 体现在"下一带起点 − 本带起点"）；
//     没有声明的层级仍按 bbox 聚类。
//   - 层级照设计稿：声明了 flex 主轴（flexDirection）的容器各自发射一个内层 Grid（格子带 container:true），
//     它的条目（直接子控件 / 更内层的容器）进该层格子；没有 flex 声明的包裹层展平到最近一层。
//   - 容器（写法表登记为可容纳子节点的类型）内部的节点递归成嵌套 Grid，不与被容纳节点抢同一格。
//   - 归不进任何格的节点进 pending，不猜坐标。

const fs = require("fs");
const path = require("path");
const { fail, readJson } = require(path.join(__dirname, "..", "..", "lib", "script-helpers.js"));

const ROUTE_MAP = path.join(__dirname, "..", "..", "..", "references", "adapters", "mw-wpf", "mw-wpf-map.json");
const EPSILON = 2;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--types") args.typesPath = argv[++i];
    else if (token === "--dsl") args.dslPath = argv[++i];
    else if (token === "--visibility") args.visibilityPath = argv[++i];
    else if (token === "--map") args.mapPath = argv[++i];
    else if (token === "--page-target") args.pageTarget = argv[++i];
    else if (token === "--out") args.outPath = argv[++i];
    else if (token === "--report") args.reportPath = argv[++i];
    else fail("未知参数: " + token);
  }
  ["typesPath", "dslPath", "pageTarget", "outPath"].forEach(function (key) {
    if (!args[key]) fail("缺少参数: " + key);
  });
  return args;
}

// ---------- DSL 绝对坐标（父子链累加相对坐标） ----------
function layoutTree(dslSnapshot) {
  const root = dslSnapshot.dsl.nodes[0];
  const nodes = new Map();
  const visit = function (node, originX, originY, parentRef) {
    const style = node.layoutStyle || {};
    const x = originX + Number(style.relativeX || 0);
    const y = originY + Number(style.relativeY || 0);
    const record = {
      ref: node.id, name: node.name, type: node.type, parentRef: parentRef,
      x: x, y: y, w: Number(style.width || 0), h: Number(style.height || 0),
      flex: node.flexContainerInfo || null,
      children: []
    };
    nodes.set(node.id, record);
    (node.children || []).forEach(function (child) {
      record.children.push(visit(child, x, y, node.id));
    });
    return record;
  };
  const rootRecord = visit(root, 0, 0, null);
  return { root: rootRecord, byRef: nodes };
}

function visuallyHidden(visibility, ref) {
  if (!visibility) return false;
  const entry = (visibility.nodes || {})[ref] || (visibility.byRef || {})[ref];
  return Boolean(entry) && entry.effectiveVisible === false;
}

// ---------- 行列聚类 ----------
// 把一维区间聚成带：按**起始边**聚类（间隙不超过 ROW_GAP 的算同一条带），带的范围取组内并集。
// 只看起始边而不是区间重叠：容器跨多行是常态，按区间重叠会把整页并成一条带。
const ROW_GAP = 6;

function clusterBands(items, startOf, sizeOf) {
  const sorted = items.slice().sort(function (a, b) { return startOf(a) - startOf(b); });
  const bands = [];
  sorted.forEach(function (item) {
    const start = startOf(item);
    const end = start + sizeOf(item);
    const last = bands[bands.length - 1];
    if (last && start - last.lastStart <= ROW_GAP) {
      last.end = Math.max(last.end, end);
      last.lastStart = start;
      last.items.push(item);
      return;
    }
    bands.push({ start: start, end: end, lastStart: start, items: [item] });
  });
  return bands;
}

// 带是按"起始边邻近"聚出来的（行带上一条横跨多行的控件会让带区间互相覆盖），
// 所以判断"某个起点属于哪条带"只能按起始边找：取起始边 ≤ 该起点的最后一条带。
// 按 [start, end) 包含关系找会把整页都算进第一条带，后面的行全靠撞格下移凑出来。
function bandOfStart(bands, value) {
  let found = 0;
  for (let i = 0; i < bands.length; i += 1) {
    if (bands[i].start <= value + EPSILON) found = i;
    else break;
  }
  return found;
}

// 控件区间覆盖到的带：起点所在带为第 0 条，之后只要带起点还在控件区间内就继续算跨度。
// 带起点与控件区间同为设计稿绝对坐标（clusterBands / clusterByOverlap 的输入），两边可直接比较；
// 网格里的相对坐标只在 bandSizes 里按"相邻带起点差"体现。
function bandSpan(bands, start, end) {
  const index = bandOfStart(bands, start);
  let last = index;
  for (let i = index + 1; i < bands.length; i += 1) {
    if (bands[i].start < end - EPSILON) last = i;
    else break;
  }
  return { index: index, span: last - index + 1 };
}

// ---------- flex 主轴 ----------
// 设计稿里任何节点都可以声明 flexContainerInfo（flexDirection / gap / alignItems ...）：
// 那是设计稿自己的布局语义。沿父链收集每个节点能看到的 flex 声明（不限声明节点的类型），
// 返回 [{containerRef, direction, itemRef}]，
// itemRef 是"该容器下承载本节点的那一条 flex 条目"（容器 → … → 节点 这条路径上容器的直接子节点）。
function flexAncestors(tree, ref) {
  const chain = [];
  let record = tree.byRef.get(ref);
  if (!record) return chain;
  let child = record;
  let parent = tree.byRef.get(record.parentRef);
  while (parent) {
    const direction = parent.flex && parent.flex.flexDirection;
    if (direction === "row" || direction === "column") {
      chain.push({ containerRef: parent.ref, direction: direction, itemRef: child.ref });
    }
    child = parent;
    parent = tree.byRef.get(parent.parentRef);
  }
  return chain;
}

// 某个轴上要拆的起点：axis="column" 取 flexDirection=row 容器的条目 x（主轴是横向），
// axis="row" 取 flexDirection=column 容器的条目 y。按容器分组，便于后面判断"是否落在同一条带"。
function flexMainAxisItems(nodes, tree, axis) {
  const wantDirection = axis === "row" ? "column" : "row";
  const byContainer = new Map();
  nodes.forEach(function (node) {
    flexAncestors(tree, node.ref).forEach(function (info) {
      if (info.direction !== wantDirection) return;
      const item = tree.byRef.get(info.itemRef);
      if (!item) return;
      if (!byContainer.has(info.containerRef)) byContainer.set(info.containerRef, []);
      const entries = byContainer.get(info.containerRef);
      if (!entries.some(function (entry) { return entry.itemRef === info.itemRef; })) {
        entries.push({ itemRef: info.itemRef, start: axis === "row" ? item.y : item.x });
      }
    });
  });
  return byContainer;
}

// ---------- flex 容器层级 ----------
// 设计稿声明的 flex 容器在页面里要保留层级：容器 → 一层 Grid，它的条目进该层格子。
// 两条收口规则（避免纯噪声层）：
//   ① 只有 ≥2 个条目的容器才成层——单条目容器没有主轴关系可表达，内容提到上一层；
//   ② 区域根网格不做 1×1 空壳——顶层如果是"单容器链"，把最内层条目的层提上来。
function flexContainerParent(tree, containerRef) {
  const chain = flexAncestors(tree, containerRef);
  return chain.length ? chain[0].containerRef : null;
}

function buildFlexItems(entries, tree) {
  const membersOf = new Map();
  const containers = new Set();
  entries.forEach(function (entry) {
    const chain = flexAncestors(tree, entry.ref);
    chain.forEach(function (info) { containers.add(info.containerRef); });
    const key = chain.length ? chain[0].containerRef : null;
    if (!membersOf.has(key)) membersOf.set(key, []);
    membersOf.get(key).push(entry);
  });
  const childContainers = new Map();
  containers.forEach(function (containerRef) {
    const parent = flexContainerParent(tree, containerRef);
    if (!childContainers.has(parent)) childContainers.set(parent, []);
    childContainers.get(parent).push(containerRef);
  });
  const build = function (key) {
    const items = (membersOf.get(key) || []).slice();
    (childContainers.get(key) || []).forEach(function (containerRef) {
      const record = tree.byRef.get(containerRef);
      if (!record) return;
      const inner = build(containerRef);
      if (inner.length < 2) {
        items.push.apply(items, inner);
        return;
      }
      items.push({
        ref: containerRef, container: true,
        x: record.x, y: record.y, w: record.w, h: record.h, items: inner
      });
    });
    return items;
  };
  let items = build(null);
  while (items.length === 1 && items[0].container) items = build(items[0].ref);
  return items;
}

// 只有"同一条带里出现 ≥2 个 flex 条目"才需要拆带：一个条目独占一条带时拆了也没有信息量。
function flexSplitStarts(bands, nodes, tree, axis) {
  const perBand = bands.map(function () { return []; });
  flexMainAxisItems(nodes, tree, axis).forEach(function (entries) {
    const grouped = new Map();
    entries.forEach(function (entry) {
      const index = bandOfStart(bands, entry.start);
      if (!grouped.has(index)) grouped.set(index, []);
      grouped.get(index).push(entry.start);
    });
    grouped.forEach(function (starts, index) {
      if (starts.length < 2) return;
      perBand[index] = perBand[index].concat(starts);
    });
  });
  return perBand;
}

// 按拆点把带切开：[本带起点, 拆点1) / [拆点1, 拆点2) / … / [最后拆点, 本带终点)。
function splitBands(bands, splitStarts) {
  const out = [];
  bands.forEach(function (band, index) {
    const starts = (splitStarts[index] || [])
      .filter(function (start) { return start > band.start + EPSILON && start < band.end - EPSILON; })
      .sort(function (a, b) { return a - b; });
    if (!starts.length) { out.push(band); return; }
    let cursor = band.start;
    starts.forEach(function (start) {
      if (start <= cursor + EPSILON) return;
      out.push({ start: cursor, end: start, items: band.items });
      cursor = start;
    });
    out.push({ start: cursor, end: band.end, items: band.items });
  });
  return out;
}

// 尺寸照设计稿：一条带的尺寸 = 到下一带起始边的距离（最后一条用星号吃掉剩余空间）。
// 只写"节点自身高度"会把设计稿里两条带之间的间隔压掉，位置就不再忠实。
function bandSizes(bands, axis) {
  return bands.map(function (band, index) {
    const next = bands[index + 1];
    if (!next) return { size: "Star", source: "design" };
    return { size: "Pixel", value: Math.max(1, Math.round(next.start - band.start)), source: "design" };
  });
}

function containsNode(parent, child) {
  return parent !== child &&
    child.x >= parent.x - EPSILON && child.x + child.w <= parent.x + parent.w + EPSILON &&
    child.y >= parent.y - EPSILON && child.y + child.h <= parent.y + parent.h + EPSILON;
}

// 父子树：每个节点挂到"完全包含它、且面积最小的容器"下（容器 = 写法表登记 holdsChildren 的类型）。
// 递归由 buildGridFrom 负责，因此"分组框里再放分组框"任意层数都能落到正确的内层容器里。
function buildContainmentTree(entries, containers, pending) {
  const childrenOf = new Map();
  entries.forEach(function (node) { childrenOf.set(node.ref, []); });
  const roots = [];
  entries.forEach(function (node) {
    let parent = null;
    entries.forEach(function (candidate) {
      if (!containers.has(candidate.controlType)) return;
      if (!containsNode(candidate, node)) return;
      if (!parent || candidate.w * candidate.h < parent.w * parent.h) parent = candidate;
    });
    if (!parent) { roots.push(node); return; }
    // 非容器类型里却包着别的控件：写法表没登记它容纳子控件，不能猜 → 挂待确认。
    childrenOf.get(parent.ref).push(node);
  });
  entries.forEach(function (node) {
    const children = childrenOf.get(node.ref);
    if (!children.length) return;
    if (containers.has(node.controlType)) return;
    children.forEach(function (child) {
      pending.push({
        ref: child.ref,
        reason: "被 " + node.controlType + "（" + node.ref + "）包含，但写法表未登记该类型 holdsChildren，无法嵌套发射"
      });
    });
    childrenOf.set(node.ref, []);
    children.forEach(function (child) { roots.push(child); });
  });
  return { roots: roots, childrenOf: childrenOf };
}

// 同层节点 → Grid（列按 x 区间重叠聚、行按起始边聚），容器节点带上自己的嵌套 Grid。
function buildGridFrom(nodes, ctx) {
  if (!nodes.length) return { rows: [], columns: [], cells: [] };
  const xOf = function (n) { return n.x; };
  const yOf = function (n) { return n.y; };
  // 列按 x 区间重叠聚（同一列的控件横向重叠）；行按**起始边**聚（容器跨多行是常态，
  // 按 y 区间重叠会把整页并成一行，位置就丢了）。
  const baseColumns = clusterByOverlap(nodes, xOf, function (n) { return Math.max(n.w, 1); });
  const baseRows = clusterBands(nodes, yOf, function (n) { return Math.max(n.h, 1); });
  // 设计稿声明了 flex 主轴的地方，主轴上的每个条目独占一条带——否则"同一行横向排列的条目
  // 被并进同一条列带"后会被撞格规则竖排（设计稿语义丢失）。没有声明的层级仍按上面的聚类。
  const columns = splitBands(baseColumns, flexSplitStarts(baseColumns, nodes, ctx.dslTree, "column"));
  const rows = splitBands(baseRows, flexSplitStarts(baseRows, nodes, ctx.dslTree, "row"));
  const cells = [];
  const occupied = new Set();
  let rowSizes = bandSizes(rows, "y");
  // 撞格时在收尾星号行之前插入一个像素行（保留"最后一行吃剩余空间"的形态）。
  const appendRow = function (node) {
    const tailIsStar = rowSizes.length && rowSizes[rowSizes.length - 1].size === "Star";
    const starRow = tailIsStar ? rowSizes.pop() : null;
    rowSizes.push({ size: "Pixel", value: Math.max(1, Math.round(node.h)), source: "design" });
    if (starRow) rowSizes.push(starRow);
    return rowSizes.length - (starRow ? 2 : 1);
  };
  nodes.forEach(function (node) {
    const column = bandSpan(columns, node.x, node.x + node.w);
    const row = bandSpan(rows, node.y, node.y + node.h);
    // 同格只放一个控件（同格多控件必须带互斥条件，那是设计稿的语义，不由推导生成）：
    // 撞格时按 y 向后找第一个空格子；后面放不下就插入新行，保证每个控件都有确定落点。
    // 占格只按锚点（起始格）判定：跨格控件与设计稿一样允许压住邻格，否则重叠区会被推开。
    let target = row.index;
    while (occupied.has(target + ":" + column.index)) {
      if (target + 1 < rowSizes.length) target += 1;
      else target = appendRow(node);
    }
    occupied.add(target + ":" + column.index);
    // 跨格数不得越界：末尾可用行/列不足时收到格子里，越界由门禁兜底。
    const rowSpan = Math.max(1, Math.min(row.span, rowSizes.length - target));
    const columnSpan = Math.max(1, Math.min(column.span, columns.length - column.index));
    // 容器格子（设计稿声明的 flex 容器）不带控件类型，只带内层 Grid；
    // 控件格子照旧：写法表登记 holdsChildren 的类型（GroupBox）可再挂一层内层 Grid。
    const childNodes = node.container ? node.items : (ctx.childrenOf.get(node.ref) || []);
    const cell = {
      ref: node.ref, row: target, column: column.index,
      rowSpan: rowSpan, columnSpan: columnSpan
    };
    if (node.container) cell.container = true;
    else cell.controlType = node.controlType;
    if (childNodes.length) cell.children = buildGridFrom(childNodes, ctx);
    cells.push(cell);
  });
  return {
    rows: rowSizes,
    columns: bandSizes(columns, "x"),
    cells: cells
  };
}

function buildRegionGrid(entries, containers, pending, dslTree) {
  const tree = buildContainmentTree(entries, containers, pending);
  return buildGridFrom(buildFlexItems(tree.roots, dslTree), { childrenOf: tree.childrenOf, dslTree: dslTree });
}

// 区间重叠聚类：x/y 区间相交的算同一条带。用于"互不包含"的同层节点——
// 容器先被摘进嵌套 Grid，剩下的节点不再互相跨行跨列重叠，聚类结果就是设计稿的行列。
function clusterByOverlap(items, startOf, sizeOf) {
  const sorted = items.slice().sort(function (a, b) { return startOf(a) - startOf(b); });
  const bands = [];
  sorted.forEach(function (item) {
    const start = startOf(item);
    const end = start + sizeOf(item);
    const last = bands[bands.length - 1];
    if (last && start < last.end - EPSILON) {
      last.end = Math.max(last.end, end);
      last.items.push(item);
      return;
    }
    bands.push({ start: start, end: end, items: [item] });
  });
  return bands;
}

function frameworkRegion(id, name, role, token, size, design, axis) {
  const rows = axis === "y"
    ? [{ size: "Pixel", value: size, source: "framework:" + token }]
    : [{ size: "Star", source: "design" }];
  const columns = axis === "x"
    ? [{ size: "Pixel", value: size, source: "framework:" + token }]
    : [{ size: "Star", source: "design" }];
  return {
    id: id, name: name, ref: null, role: role, emit: false,
    x: 0, y: 0, w: design.width, h: design.height,
    grid: { rows: rows, columns: columns, cells: [] }
  };
}

// ---------- 主流程 ----------
function deriveLayout(options) {
  const tokens = options.tokens;
  const tree = layoutTree(options.dsl);
  const byRef = options.types.byRef;
  const containers = options.containers;
  const routeMap = options.map || { controlTypes: {} };
  const pending = [];
  const design = {
    width: Number(tree.root.w || options.designWidth || 0),
    height: Number(tree.root.h || options.designHeight || 0)
  };
  if (!design.width || !design.height) fail("DSL 根节点缺少画板尺寸");

  const entries = [];
  byRef.forEach(function (node) {
    if (!node.controlType) return;
    // 写法表登记为待确认的类型（Border / Camera）：挂待确认、不进任何格子，也不发射。
    const typeEntry = (routeMap.controlTypes || {})[node.controlType];
    if (!typeEntry || typeEntry.status === "pending") {
      pending.push({ ref: node.ref, reason: "写法表未登记或登记为待确认的类型: " + node.controlType });
      return;
    }
    if (visuallyHidden(options.visibility, node.ref)) return;
    const source = tree.byRef.get(node.ref);
    if (!source) {
      pending.push({ ref: node.ref, reason: "类型判定里的节点在 DSL 结构里找不到（父子链或 ref 不一致）" });
      return;
    }
    if (!(node.w > 0) || !(node.h > 0)) {
      pending.push({ ref: node.ref, reason: "节点没有可用尺寸（bbox 为 0），无法分格" });
      return;
    }
    entries.push({
      ref: node.ref, controlType: node.controlType,
      x: Number(node.absX), y: Number(node.absY), w: Number(node.w), h: Number(node.h)
    });
  });

  const headerBand = entries.filter(function (n) { return n.y + n.h <= tokens.headerHeight + EPSILON; });
  const bottomBand = entries.filter(function (n) { return n.y >= design.height - tokens.bottomHeight - EPSILON; });
  const content = entries.filter(function (n) { return headerBand.indexOf(n) < 0 && bottomBand.indexOf(n) < 0; });

  const regions = [
    frameworkRegion("top-strip", "顶部栏", "framework-top", "MaxwellFramework_HeaderHeight", tokens.headerHeight, design, "y"),
    frameworkRegion("bottom-bar", "底部栏", "framework-bottom", "MaxwellFramework_BottomHeight", tokens.bottomHeight, design, "y")
  ];
  if (content.length) {
    regions.push({
      id: "work-area", name: "工作区", ref: null, role: "work-area", emit: true,
      x: 0, y: tokens.headerHeight, w: design.width,
      h: design.height - tokens.bottomHeight - tokens.headerHeight,
      grid: buildRegionGrid(content, containers, pending, tree)
    });
  }
  // 归位核对：发射分区里的每个节点（含嵌套 Grid 内的）都必须被某个格子引用，否则挂待确认——
  // 嵌套是递归的，所以这里也递归收集格子里的 ref。
  const placedRefs = new Set();
  const collectRefs = function (grid) {
    (grid.cells || []).forEach(function (cell) {
      placedRefs.add(cell.ref);
      if (cell.children) collectRefs(cell.children);
    });
  };
  regions.filter(function (region) { return region.emit !== false; })
    .forEach(function (region) { collectRefs(region.grid); });
  content.forEach(function (node) {
    if (!placedRefs.has(node.ref)) pending.push({ ref: node.ref, reason: "未归入任何分区/格子" });
  });

  return {
    schemaVersion: 1,
    adapter: "mw-wpf",
    pageTarget: options.pageTarget,
    design: { width: Math.round(design.width), height: Math.round(design.height) },
    regions: regions,
    pending: pending
  };
}

function loadInputs(args) {
  const typesDoc = readJson(args.typesPath, "类型判定产物");
  if (!Array.isArray(typesDoc.nodes)) fail("类型判定产物缺少 nodes 数组: " + args.typesPath);
  const byRef = new Map();
  typesDoc.nodes.forEach(function (node) { byRef.set(node.ref, node); });
  const map = readJson(args.mapPath || ROUTE_MAP, "A 写法表");
  const containers = new Set(
    Object.entries(map.controlTypes || {})
      .filter(function (entry) { return entry[1] && entry[1].holdsChildren === true; })
      .map(function (entry) { return entry[0]; })
  );
  return {
    types: { doc: typesDoc, byRef: byRef },
    dsl: readJson(args.dslPath, "DSL 快照"),
    visibility: args.visibilityPath && fs.existsSync(args.visibilityPath)
      ? readJson(args.visibilityPath, "可见性产物") : null,
    map: map,
    containers: containers,
    tokens: (map.frameworkTokens && typeof map.frameworkTokens === "object") ? map.frameworkTokens : {},
    pageTarget: args.pageTarget
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputs = loadInputs(args);
  const tokens = Object.assign({ headerHeight: 85, bottomHeight: 180 }, inputs.tokens);
  const layout = deriveLayout(Object.assign({}, inputs, { tokens: tokens }));
  fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
  fs.writeFileSync(args.outPath, JSON.stringify(layout, null, 2) + "\n", "utf8");
  if (args.reportPath) {
    const summary = {
      pageTarget: layout.pageTarget,
      design: layout.design,
      regions: layout.regions.map(function (region) {
        return {
          id: region.id, role: region.role, emit: region.emit,
          rows: region.grid.rows.length, columns: region.grid.columns.length,
          cells: region.grid.cells.length
        };
      }),
      pending: layout.pending
    };
    fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
    fs.writeFileSync(args.reportPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
  }
  console.log(JSON.stringify({
    out: args.outPath,
    pageTarget: layout.pageTarget,
    emitRegions: layout.regions.filter(function (r) { return r.emit !== false; }).length,
    cells: layout.regions.reduce(function (total, r) { return total + r.grid.cells.length; }, 0),
    pending: layout.pending.length
  }, null, 2));
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { deriveLayout, clusterBands };
