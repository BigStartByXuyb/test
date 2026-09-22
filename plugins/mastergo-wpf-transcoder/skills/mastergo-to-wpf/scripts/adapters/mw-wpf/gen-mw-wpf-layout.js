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
//   - 分区按设计稿带状切分：顶栏按框架 Token 高度、底栏按框架 Token 高度，其余进内容区；
//     内容区顶部/底部的扁平条（高度不超过 strip 阈值）单独成日志条。
//   - 行列由节点 bbox 聚类得到（列 = x 向互不重叠的带，行 = y 向互不重叠的带），尺寸照设计稿像素。
//   - 容器（写法表登记为可容纳子节点的类型）内部的节点递归成嵌套 Grid，不与被容纳节点抢同一格。
//   - 归不进任何格的节点进 pending，不猜坐标。

const fs = require("fs");
const path = require("path");
const { fail, readJson } = require(path.join(__dirname, "..", "..", "lib", "script-helpers.js"));

const ROUTE_MAP = path.join(__dirname, "..", "..", "..", "references", "adapters", "mw-wpf", "mw-wpf-map.json");
// 内容区里高度不超过该值的扁平带单独成日志条（设计稿把日志/提示条与工作区并排放时用）。
const STRIP_MAX_HEIGHT = 60;
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

function bandIndex(bands, item, startOf) {
  const value = startOf(item);
  for (let i = 0; i < bands.length; i += 1) {
    if (value >= bands[i].start - EPSILON && value < bands[i].end) return i;
  }
  return bands.length - 1;
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
  // 列按 x 区间重叠聚（同一列的控件横向重叠）；行按**起始边**聚（容器跨多行是常态，
  // 按 y 区间重叠会把整页并成一行，位置就丢了）。
  const columns = clusterByOverlap(nodes, function (n) { return n.x; }, function (n) { return Math.max(n.w, 1); });
  const rows = clusterBands(nodes, function (n) { return n.y; }, function (n) { return Math.max(n.h, 1); });
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
    const column = bandIndex(columns, node, function (n) { return n.x; });
    const row = bandIndex(rows, node, function (n) { return n.y; });
    // 同格只放一个控件（同格多控件必须带互斥条件，那是设计稿的语义，不由推导生成）：
    // 撞格时按 y 向后找第一个空格子；后面放不下就插入新行，保证每个控件都有确定落点。
    let target = row;
    while (occupied.has(target + ":" + column)) {
      if (target + 1 < rowSizes.length) target += 1;
      else target = appendRow(node);
    }
    occupied.add(target + ":" + column);
    const childNodes = ctx.childrenOf.get(node.ref) || [];
    cells.push({
      ref: node.ref, controlType: node.controlType, row: target, column: column, rowSpan: 1, columnSpan: 1,
      ...(childNodes.length ? { children: buildGridFrom(childNodes, ctx) } : {})
    });
  });
  return {
    rows: rowSizes,
    columns: bandSizes(columns, "x"),
    cells: cells
  };
}

function buildRegionGrid(entries, containers, pending) {
  const tree = buildContainmentTree(entries, containers, pending);
  return buildGridFrom(tree.roots, { childrenOf: tree.childrenOf });
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
  const strips = content.filter(function (n) { return n.h <= STRIP_MAX_HEIGHT && n.y >= design.height - tokens.bottomHeight - 4 * STRIP_MAX_HEIGHT; });
  const work = content.filter(function (n) { return strips.indexOf(n) < 0; });

  const regions = [
    frameworkRegion("top-strip", "顶部栏", "framework-top", "MaxwellFramework_HeaderHeight", tokens.headerHeight, design, "y"),
    frameworkRegion("bottom-bar", "底部栏", "framework-bottom", "MaxwellFramework_BottomHeight", tokens.bottomHeight, design, "y")
  ];
  if (work.length) {
    // 工作区与日志条必须是不重叠的纵向区间：发射端按分区顺序给根 Grid 分行，
    // 若工作区整段盖住日志条，两行的高度就没法同时对上设计稿（门禁 R3 也会判重叠）。
    const stripTop = strips.length ? Math.min.apply(null, strips.map(function (n) { return n.y; })) : null;
    regions.push({
      id: "work-area", name: "工作区", ref: null, role: "work-area", emit: true,
      x: 0, y: tokens.headerHeight, w: design.width,
      h: (stripTop === null ? design.height - tokens.bottomHeight : stripTop) - tokens.headerHeight,
      grid: buildRegionGrid(work, containers, pending)
    });
  }
  if (strips.length) {
    const stripTop = Math.min.apply(null, strips.map(function (n) { return n.y; }));
    const stripBottom = Math.max.apply(null, strips.map(function (n) { return n.y + n.h; }));
    regions.push({
      id: "log-strip", name: "日志条", ref: null, role: "log-strip", emit: true,
      x: 0, y: stripTop, w: design.width, h: stripBottom - stripTop,
      grid: buildRegionGrid(strips, containers, pending)
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
  work.concat(strips).forEach(function (node) {
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
