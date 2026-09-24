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
//     regions:[{id,name,ref,role,emit,x,y,w,h,grid:{rows[],columns[],cells[]}}], pending[],
//     constraintExempt:[{ref,reason}] }
//   cells[] 里的格子带 ref / row / column / rowSpan / columnSpan，容器格子再带 container:true 与 children；
//   带尺寸约束的格子带 constraints。格子尺寸与发射依据也在格子上：
//     width / height        格子尺寸（跨格累加 + 收尾星号带残差；推导给不出正数时不写）
//     nodeWidth / nodeHeight 承载物（控件 / 容器）自身设计稿尺寸
//     offsetX / offsetY     承载物起点相对格子起点的偏移（撞格下移的格子不写）
//     shifted:true          该格子由推导挪位（撞格下移），不是设计稿那条带（只免间距/对齐，未免尺寸）
//     unsized:{width?,height?} 哪一维算不出正数格子尺寸（自适应带被前面的固定带吃光＝内容溢出承载物）
//     spacer:{axis,size}    间隙格（主轴上的空隙）：空 Grid 的固定宽/高，轴上的带是 Auto + gap
//     发射器与门禁（R14）按 width/height/nodeWidth/nodeHeight/offsetX/offsetY 出尺寸与对齐。
//   网格带：rows[] / columns[] 的每项是 {size:"Pixel"|"Star"|"Auto", value?/weight?/gap?, source:"design"|"gap"}；
//     grid.owner = {ref,direction,gap,root} 记录该层对应的 flex 容器（主轴显式成带用它）。
//   constraintExempt 由本脚本登记「本页不发射的带约束节点」（页面根 / 不可见 / 框架固定区）及原因，
//   门禁据此把 R12 从失败降为提示（见 page-build-rules.md 第 5 节）。
//
// 规则
//   - 分区只有两类：框架固定区（顶部栏 / 底部栏，按框架 Token 高度，emit=false）
//     与**一个**内容区（emit=true）。框架固定区只有顶部栏与底部栏（框架加载壳只有这两条常驻带），
//     不进页面，因此页面外层只有**一个** Grid（内容网格本身）；设计稿的业务内容（含容器链条）
//     全部落在同一个内容区里，内部再按行列分格。
//   - 行列由节点 bbox 聚类得到（列 = x 区间重叠的带，行 = y 起始边邻近的带），尺寸照设计稿像素。
//   - 落格按起始边判定归属；控件 bbox 覆盖到的带全部占住（跨带即写 RowSpan / ColumnSpan）。
//   - flex 主轴优先：容器声明了 flexContainerInfo.flexDirection（row/column）时，主轴按「条目带 + 间隙带」显式成带
//     （间隙 = 相邻条目的实测间距，落成 Auto 带 + 空 Grid 固定尺寸；同一起点的条目合并成一条带）；
//     没有声明的层级、以及声明层级的交叉轴，仍按 bbox 聚类（带尺寸 = 到下一带起点）。
//   - 层级照设计稿：成层容器各自发射一个内层 Grid（格子带 container:true），它的条目（直接子控件 /
//     更内层的容器）进该层格子。成层容器 = 声明了 flex 主轴（flexDirection）的容器，或**带尺寸约束的容器**
//     （约束是设计意图，展平会让它没有落到产物的位置）；没有 flex 声明、也没有尺寸约束的包裹层展平到最近一层；
//     单条目容器同样展平（带约束的除外）。
//   - 容器（写法表登记为可容纳子节点的类型）内部的节点递归成嵌套 Grid，不与被容纳节点抢同一格。
//   - 归不进任何格的节点进 pending，不猜坐标。
//   - 尺寸约束（min/max 宽高）由 core/apply-constraints.js 合并进 DSL 节点的 `constraints` 字段，
//     本脚本只把它透传进对应格子（cell.constraints），不做任何推算。

const fs = require("fs");
const path = require("path");
const { fail, readJson } = require(path.join(__dirname, "..", "..", "lib", "script-helpers.js"));
const { normalizeConstraints } = require(path.join(__dirname, "..", "..", "lib", "constraints.js"));

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
      constraints: node.constraints || null,
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
// 成层容器在页面里要保留层级：容器 → 一层 Grid，它的条目进该层格子。成层容器的判据有两条：
// 设计稿声明的 flex 容器（节点带 flexContainerInfo.flexDirection），或**带尺寸约束的容器**
// （约束是设计意图，必须有承载物；展平后它就没有落到产物的位置，门禁 R12 按这条拦）。
// 两条收口规则（避免纯噪声层）：
//   ① 只有 ≥2 个条目的容器才成层——单条目容器没有主轴关系可表达，内容提到上一层（带约束的除外）；
//   ② 区域根网格不做 1×1 空壳——顶层如果是"单容器链"，把最内层条目的层提上来（带约束的除外）。
// 没有 flex 声明的成层容器内层 Grid 按 bbox 聚类（与"没有声明的层级"同一套聚类口径）。
function carriesConstraints(tree, ref) {
  const record = tree.byRef.get(ref);
  return Boolean(record) && Object.keys(normalizeConstraints(record.constraints)).length > 0;
}

// 成层祖先（含带约束的无 flex 声明的容器），由近及远。拆带用的主轴语义只归 flexAncestors，这里不掺和：
// 没有 flex 声明的成层容器在 chain 里 direction 为 null，`flexSplitStarts` 不认它，内层走 bbox 聚类。
function levelAncestors(tree, ref) {
  const chain = [];
  let record = tree.byRef.get(ref);
  if (!record) return chain;
  let parent = tree.byRef.get(record.parentRef);
  while (parent) {
    // 页面根是画布本身、不是页面里的控件：它不成层（区域根网格就是它的那一层），
    // 它自己的尺寸约束由 constraintExempt 登记。
    if (parent.ref !== tree.root.ref) {
      const direction = parent.flex && parent.flex.flexDirection;
      const isFlex = direction === "row" || direction === "column";
      if (isFlex || carriesConstraints(tree, parent.ref)) {
        chain.push({ containerRef: parent.ref, direction: isFlex ? direction : null });
      }
    }
    parent = tree.byRef.get(parent.parentRef);
  }
  return chain;
}

function levelContainerParent(tree, containerRef) {
  const chain = levelAncestors(tree, containerRef);
  return chain.length ? chain[0].containerRef : null;
}

function buildFlexItems(entries, tree) {
  const membersOf = new Map();
  const containers = new Set();
  entries.forEach(function (entry) {
    const chain = levelAncestors(tree, entry.ref);
    chain.forEach(function (info) { containers.add(info.containerRef); });
    const key = chain.length ? chain[0].containerRef : null;
    if (!membersOf.has(key)) membersOf.set(key, []);
    membersOf.get(key).push(entry);
  });
  const childContainers = new Map();
  containers.forEach(function (containerRef) {
    const parent = levelContainerParent(tree, containerRef);
    if (!childContainers.has(parent)) childContainers.set(parent, []);
    childContainers.get(parent).push(containerRef);
  });
  const build = function (key) {
    const items = (membersOf.get(key) || []).slice();
    (childContainers.get(key) || []).forEach(function (containerRef) {
      const record = tree.byRef.get(containerRef);
      if (!record) return;
      const inner = build(containerRef);
      if (inner.length < 2 && !carriesConstraints(tree, containerRef)) {
        items.push.apply(items, inner);
        return;
      }
      items.push({
        ref: containerRef, container: true,
        x: record.x, y: record.y, w: record.w, h: record.h, items: inner,
        flex: record.flex || null
      });
    });
    return items;
  };
  let items = build(null);
  // 区域根网格不做 1×1 空壳：顶层是单容器链时把最内层提上来，同时记住那一层属于哪个容器
  // —— 主轴显式成带要用它的 flex 方向与 gap。
  let ownerRef = null;
  while (items.length === 1 && items[0].container && !carriesConstraints(tree, items[0].ref)) {
    ownerRef = items[0].ref;
    items = build(ownerRef);
  }
  return { items: items, owner: ownerRef ? tree.byRef.get(ownerRef) : null };
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

// 交叉轴（没有声明 flex 主轴的层级）：一条带的尺寸 = 到下一带起始边的距离（最后一条用星号吃掉剩余空间）。
// 主轴改用 mainAxisSizes（条目带 + 间隙带显式成带），间距不再并进上一带。
function bandSizes(bands, axis) {
  return bands.map(function (band, index) {
    const next = bands[index + 1];
    if (!next) return { size: "Star", source: "design" };
    return { size: "Pixel", value: Math.max(1, Math.round(next.start - band.start)), source: "design" };
  });
}

// ---------- 主轴带（声明了 flex 主轴的容器）----------
// 声明的 flex 主轴不再"按起点聚类、间距并进上一带"，而是显式成带：条目带与间隙带交替。
// 间隙带 = DSL gap，单位置放一个空 Grid（列方向写固定 Width、行方向写固定 Height），该带的行列定义用 Auto。
// 列宽策略（主轴是 row）：固定项照设计稿像素，其余自适应（单个 → 裸星号；多个 → 按设计稿比例加权星号）。
// 固定项 = 子树里只有相机控件的条目（相机所在的 Grid），或**区域根网格里**贴主轴末端的最末条目（页面常驻右栏）。
// 行高策略（主轴是 column）：条目行照设计稿像素 + 间隙行（上下间隙与左右一致），不动条目行。
const GAP_MIN = 1;

function itemControlTypes(item) {
  const types = [];
  (function walk(node) {
    if (node.controlType) types.push(node.controlType);
    (node.items || []).forEach(walk);
  })(item);
  return types;
}

// 相机所在的 Grid：条目本身是相机控件，或它的子树里只有相机（相机链 / 只为相机服务的容器）。
function cameraOnlyItem(item) {
  const types = itemControlTypes(item);
  return types.length > 0 && types.every(function (type) { return type === "Camera"; });
}

function mainAxisBands(items, owner) {
  const horizontal = owner.direction === "row";
  const along = function (item) { return horizontal ? item.x : item.y; };
  const extent = function (item) { return horizontal ? item.w : item.h; };
  const record = owner.record;
  const containerEnd = horizontal ? record.x + record.w : record.y + record.h;
  const ordered = items.slice().sort(function (a, b) { return along(a) - along(b); });
  const bands = [];
  // 同一起点（同一列 / 同一行）的条目合并成同一条带：它们共用一条定义，靠撞格下移落到不同交叉带。
  ordered.forEach(function (item) {
    const start = along(item);
    const size = Math.max(1, Math.round(extent(item)));
    const last = bands[bands.length - 1];
    if (last && last.kind === "item" && Math.abs(last.start - start) <= EPSILON) {
      last.items.push(item);
      last.end = Math.max(last.end, start + size);
      last.size = Math.max(last.size, size);
      last.fixed = last.fixed || cameraOnlyItem(item);
      return;
    }
    bands.push({
      kind: "item", items: [item], start: start, end: start + size, size: size,
      fixed: cameraOnlyItem(item)
    });
  });
  // 页面常驻右栏判据（只在区域根网格）：贴主轴末端的那条粒子带固定。
  if (owner.root && bands.length) {
    const last = bands[bands.length - 1];
    if (Math.abs(last.end - containerEnd) <= EPSILON) last.fixed = true;
  }
  // 条目带之间插间隙带：尺寸 = 设计稿的实测间距（flex 行/列的声明 gap 就体现在这里）。
  const withGaps = [];
  bands.forEach(function (band, index) {
    withGaps.push(band);
    const next = bands[index + 1];
    if (!next) return;
    const gap = Math.round(next.start - band.end);
    if (gap > GAP_MIN) withGaps.push({ kind: "gap", items: [], start: band.end, end: next.start, gap: gap });
  });
  return withGaps;
}

// 主轴带的尺寸：行（主轴 column）照设计稿像素；列（主轴 row）里固定项照设计稿像素、
// 容器条目自适应（多个按设计稿比例加权）、叶子控件照设计稿像素；间隙带一律 Auto（由空 Grid 的固定尺寸决定）。
function mainAxisSizes(bands, direction) {
  const autoItems = bands.filter(function (band) {
    return band.kind === "item" && direction === "row" && !band.fixed && isAutoItem(band.items[0]);
  });
  return bands.map(function (band) {
    if (band.kind === "gap") return { size: "Auto", source: "gap", gap: band.gap };
    if (direction !== "row") return { size: "Pixel", value: band.size, source: "design" };
    if (band.fixed || !isAutoItem(band.items[0])) return { size: "Pixel", value: band.size, source: "design" };
    return autoItems.length > 1
      ? { size: "Star", weight: band.size, source: "design" }
      : { size: "Star", source: "design" };
  });
}

// 自适应条目 = 容器（中间区就是容器）；叶子控件保持设计稿像素，避免窗口缩放时被拉变形。
function isAutoItem(item) {
  return Boolean(item && item.container);
}

// 成层容器的 flex 描述（方向 / gap / 绝对 bbox）：主轴显式成带用它；没有 flex 声明时返回 null。
function flexOwnerOf(record) {
  const direction = record && record.flex && record.flex.flexDirection;
  if (direction !== "row" && direction !== "column") return null;
  return {
    ref: record.ref, direction: direction, record: record,
    gap: Math.max(0, Math.round(Number(String((record.flex && record.flex.gap) || "0").replace(/[^\d.-]/g, "")) || 0))
  };
}

// 格子尺寸照设计稿：像素带照值、间隙带照 gap；自适应带平分剩余（带权重的按权重分）。
// 这样"格子尺寸 − 控件尺寸 = 间距"才有真值可对（星号带的残差是设计稿的剩余空间，不是猜的）。
function bandExtents(sizes, available) {
  const fixed = sizes.map(function (item) {
    if (!item) return 0;
    if (item.size === "Pixel") return Number(item.value || 0);
    if (item.size === "Auto") return Number(item.gap || 0);
    return null;
  });
  const used = fixed.reduce(function (total, value) { return total + (value || 0); }, 0);
  const weight = sizes.reduce(function (total, item) {
    return total + (item && item.size === "Star" ? Number(item.weight || 1) : 0);
  }, 0);
  const rest = Math.max(0, Math.round(Number(available) || 0) - used);
  return fixed.map(function (value, index) {
    if (value !== null) return value;
    if (!weight) return rest;
    return Math.round(rest * (Number(sizes[index].weight || 1) / weight));
  });
}

function extentOf(extents, index, span) {
  let total = 0;
  for (let i = index; i < index + (span || 1); i += 1) total += Number(extents[i] || 0);
  return total;
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
// size 是本网格的可用尺寸（内容区 = 分区尺寸；嵌套网格 = 父格子尺寸）：收尾星号带的残差靠它算。
// owner = 本网格对应的成层容器（{ref, direction, record}）：声明了 flex 主轴时，主轴按 owner 显式成带
// （条目带 + 间隙带），交叉轴仍按聚类；没有 owner（或约束成层但无 flex 声明）时两轴都按聚类。
function buildGridFrom(nodes, ctx, size, owner) {
  if (!nodes.length) return { rows: [], columns: [], cells: [] };
  const xOf = function (n) { return n.x; };
  const yOf = function (n) { return n.y; };
  const direction = owner && owner.direction;
  // 列按 x 区间重叠聚（同一列的控件横向重叠）；行按**起始边**聚（容器跨多行是常态，
  // 按 y 区间重叠会把整页并成一行，位置就丢了）。
  const baseColumns = clusterByOverlap(nodes, xOf, function (n) { return Math.max(n.w, 1); });
  const baseRows = clusterBands(nodes, yOf, function (n) { return Math.max(n.h, 1); });
  // 设计稿声明了 flex 主轴的地方，主轴上的每个条目独占一条带——否则"同一行横向排列的条目
  // 被并进同一条列带"后会被撞格规则竖排（设计稿语义丢失）。没有声明的层级仍按上面的聚类。
  const mainBands = direction ? mainAxisBands(nodes, owner) : null;
  const columns = direction === "row" ? mainBands
    : splitBands(baseColumns, flexSplitStarts(baseColumns, nodes, ctx.dslTree, "column"));
  const rows = direction === "column" ? mainBands
    : splitBands(baseRows, flexSplitStarts(baseRows, nodes, ctx.dslTree, "row"));
  const cells = [];
  // 落格阶段只决定"谁落在哪个格"；格子尺寸要等所有撞格插行做完再算（插行会把收尾星号行变成像素行，
  // 先算出来的尺寸会与最终行列定义不一致）。
  const childSets = [];
  const occupied = new Set();
  let rowSizes = direction === "column" ? mainAxisSizes(rows, "column") : bandSizes(rows, "y");
  const columnSizes = direction === "row" ? mainAxisSizes(columns, "row") : bandSizes(columns, "x");
  // 间隙带独立成格：格子里放一个空 Grid（列方向固定宽 / 行方向固定高），尺寸 = DSL gap。
  // 先占位再排条目，撞格下移会绕开间隙格；跨格数等行列定义定稿后再补。
  const spacerCells = [];
  if (mainBands) {
    mainBands.forEach(function (band, index) {
      if (band.kind !== "gap") return;
      spacerCells.push({
        ref: "gap:" + owner.ref + ":" + index,
        spacer: { axis: direction === "row" ? "column" : "row", size: band.gap },
        row: direction === "row" ? 0 : index,
        column: direction === "row" ? index : 0
      });
    });
    spacerCells.forEach(function (cell) { occupied.add(cell.row + ":" + cell.column); });
  }
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
    // 容器格子（成层容器：flex 容器或带尺寸约束的容器）不带控件类型，只带内层 Grid；
    // 控件格子照旧：写法表登记 holdsChildren 的类型（GroupBox）可再挂一层内层 Grid。
    const childNodes = node.container ? node.items : (ctx.childrenOf.get(node.ref) || []);
    const cell = {
      ref: node.ref, row: target, column: column.index,
      rowSpan: rowSpan, columnSpan: columnSpan
    };
    // 承载物设计尺寸与"是否被撞格挪位"：撞格下移过的格子设计稿位置不在这个格子里，
    // 设计稿偏移没有真值 —— 登记 shifted，发射器只写承载物自身尺寸、不表达间距/对齐；
    // 格子尺寸与承载物尺寸照常登记（门禁照常核对）。
    cell.nodeWidth = Math.round(Number(node.w) || 0);
    cell.nodeHeight = Math.round(Number(node.h) || 0);
    if (target !== row.index) cell.shifted = true;
    if (target === row.index) {
      cell.offsetX = Math.round(node.x - columns[column.index].start);
      cell.offsetY = Math.round(node.y - rows[target].start);
    }
    const sourceRecord = ctx.dslTree && ctx.dslTree.byRef.get(node.ref);
    if (sourceRecord && sourceRecord.constraints) cell.constraints = sourceRecord.constraints;
    if (node.container) cell.container = true;
    else cell.controlType = node.controlType;
    cells.push(cell);
    childSets.push(childNodes);
  });
  // 间隙格：跨满交叉轴（列方向的间隙跨所有行、行方向的间隙跨所有列），不带控件类型、不带尺寸约束。
  spacerCells.forEach(function (cell) {
    if (cell.spacer.axis === "column") {
      cell.rowSpan = Math.max(1, rowSizes.length);
      cell.columnSpan = 1;
    } else {
      cell.rowSpan = 1;
      cell.columnSpan = Math.max(1, columnSizes.length);
    }
    cells.push(cell);
    childSets.push([]);
  });
  // 第二遍：按最终行列定义算每格的格子尺寸（跨格累加 + 收尾星号带残差），再递归内层网格。
  const columnExtents = bandExtents(columnSizes, size && size.w);
  const rowExtents = bandExtents(rowSizes, size && size.h);
  cells.forEach(function (cell, index) {
    if (cell.spacer) return;   // 间隙格没有承载物：尺寸由它自己的固定宽/高表达
    const cellWidth = extentOf(columnExtents, cell.column, cell.columnSpan);
    const cellHeight = extentOf(rowExtents, cell.row, cell.rowSpan);
    // 算不出正数的格子尺寸（自适应带被前面的固定带 / 间隙带吃光：设计稿内容溢出了承载物）→ 登记 unsized，
    // 发射器不写尺寸与对齐，门禁按提示登记（这类格子没有设计稿尺寸可表达，不是产物损坏）。
    const unsized = {};
    if (cellWidth > 0) cell.width = cellWidth;
    else unsized.width = true;
    if (cellHeight > 0) cell.height = cellHeight;
    else unsized.height = true;
    if (Object.keys(unsized).length) cell.unsized = unsized;
    if (childSets[index].length) {
      const childRecord = ctx.dslTree && ctx.dslTree.byRef.get(cell.ref);
      cell.children = buildGridFrom(childSets[index], ctx, contentSizeOf(cell), flexOwnerOf(childRecord));
    }
  });
  const grid = { rows: rowSizes, columns: columnSizes, cells: cells };
  if (owner && owner.direction) grid.owner = { ref: owner.ref, direction: owner.direction, gap: owner.gap, root: Boolean(owner.root) };
  return grid;
}

// 内层网格的可用尺寸＝本格承载物（容器 / 被容纳控件）的设计稿尺寸：它会被写成 Width/Height，
// 内层 Grid 填充的是那个尺寸，不是整个格子（格子比它大时多出来的部分是间距 / 剩余空间）。
function contentSizeOf(cell) {
  return {
    w: cell.nodeWidth > 0 ? cell.nodeWidth : cell.width,
    h: cell.nodeHeight > 0 ? cell.nodeHeight : cell.height
  };
}

function buildRegionGrid(entries, containers, pending, dslTree, size) {
  const tree = buildContainmentTree(entries, containers, pending);
  const flex = buildFlexItems(tree.roots, dslTree);
  const owner = flexOwnerOf(flex.owner);
  // 区域根网格是页面内容区那一层：页面常驻右栏（贴主轴末端的最末条目）在这一层固定。
  if (owner) owner.root = true;
  return buildGridFrom(flex.items, { childrenOf: tree.childrenOf, dslTree: dslTree }, size, owner);
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
    // 写法表登记为待确认的类型（Border）：挂待确认、不进任何格子，也不发射。
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

  // 节点落在哪条带（唯一判据）：顶部栏 / 底部栏由框架渲染、不进页面，其余进内容区。
  const bandOfBox = function (y, h) {
    if (y + h <= tokens.headerHeight + EPSILON) return "framework-top";
    if (y >= design.height - tokens.bottomHeight - EPSILON) return "framework-bottom";
    return "content";
  };
  const content = entries.filter(function (n) { return bandOfBox(n.y, n.h) === "content"; });

  const regions = [
    frameworkRegion("top-strip", "顶部栏", "framework-top", "MaxwellFramework_HeaderHeight", tokens.headerHeight, design, "y"),
    frameworkRegion("bottom-bar", "底部栏", "framework-bottom", "MaxwellFramework_BottomHeight", tokens.bottomHeight, design, "y")
  ];
  if (content.length) {
    regions.push({
      id: "work-area", name: "工作区", ref: null, role: "work-area", emit: true,
      x: 0, y: tokens.headerHeight, w: design.width,
      h: design.height - tokens.bottomHeight - tokens.headerHeight,
      grid: buildRegionGrid(content, containers, pending, tree, {
        w: design.width, h: design.height - tokens.bottomHeight - tokens.headerHeight
      })
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

  // 尺寸约束的承载范围：本页要发射的节点（可见、且落在内容区）必须落格；本页不发射的节点
  // （页面根、不可见节点、框架固定区里的节点）登记豁免原因，交门禁区分"产物漏约束"与"本页不发射"。
  const constraintExempt = [];
  tree.byRef.forEach(function (record) {
    if (!carriesConstraints(tree, record.ref) || placedRefs.has(record.ref)) return;
    if (record.ref === tree.root.ref) {
      constraintExempt.push({ ref: record.ref, reason: "页面根（画布本身不是页面里的控件）" });
      return;
    }
    if (visuallyHidden(options.visibility, record.ref)) {
      constraintExempt.push({ ref: record.ref, reason: "节点不可见" });
      return;
    }
    const band = bandOfBox(record.y, record.h);
    if (band !== "content") {
      constraintExempt.push({ ref: record.ref, reason: "落在框架固定区（" + band + "），本页不发射" });
    }
  });

  return {
    schemaVersion: 1,
    adapter: "mw-wpf",
    pageTarget: options.pageTarget,
    design: { width: Math.round(design.width), height: Math.round(design.height) },
    regions: regions,
    pending: pending,
    constraintExempt: constraintExempt
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
      pending: layout.pending,
      constraintExempt: layout.constraintExempt
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

// bandExtents / extentOf / contentSizeOf 同时被布局门禁（check-wpf-layout.js）复用来复核格子尺寸，
// 避免"格子尺寸怎么算"出现第二份实现。
module.exports = { deriveLayout, clusterBands, bandExtents, extentOf, contentSizeOf };
