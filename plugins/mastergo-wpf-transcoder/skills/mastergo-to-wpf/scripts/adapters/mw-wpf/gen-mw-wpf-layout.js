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
//     width / height        格子尺寸（跨格累加；像素带照值、星号带吃剩余；推导给不出正数时不写）
//     nodeWidth / nodeHeight 承载物（控件 / 容器）自身设计稿尺寸
//     offsetX / offsetY     承载物起点相对格子起点的偏移（撞格下移的格子不写）
//     shifted:true          该格子由推导挪位（撞格下移），不是设计稿那条带（只免间距/对齐，未免尺寸）
//     unsized:{width?,height?} 哪一维算不出正数格子尺寸（星号带被前面的固定带吃光＝内容溢出承载物）
//     synth:true            由代码补出来的容器（设计稿没打组：同一条列带里 ≥2 个条目，见 buildRegionGrid）
//   网格带：rows[] / columns[] 的每项是 {size:"Pixel"|"Star", value?, source:"design"}（星号带带 gap 便于核对）；
//     grid.owner = {ref,direction,gap,root} 记录该层对应的 flex 容器（推导内部用它成带）。
//     发射器与门禁（R14）按 width/height/nodeWidth/nodeHeight/offsetX/offsetY 出尺寸与对齐。
//   constraintExempt 由本脚本登记「本页不发射的带约束节点」（页面根 / 不可见 / 框架固定区）及原因，
//   门禁据此把 R12 从失败降为提示（见 page-build-rules.md 第 5 节）。
//
// 规则
//   - 分区只有两类：框架固定区（顶部栏 / 底部栏，按框架 Token 高度，emit=false）
//     与**一个**内容区（emit=true）。框架固定区只有顶部栏与底部栏（框架加载壳只有这两条常驻带），
//     不进页面，因此页面外层只有**一个** Grid（内容网格本身）；设计稿的业务内容（含容器链条）
//     全部落在同一个内容区里，内部再按行列分格。
//   - 成带只有一条口径（口径 A）：一条带 = 条目 + 它后面的间距（= 到下一带起始边的距离）；
//     哪一段间距成星号带走两条判据（**不写死像素阈值**）：① 结构——相邻条目分属不同子组时那段是"组间空档"
//     （容器的 flexContainerInfo.gap 就体现在这里）；② 相对——散条目按"最大的一段 ≥ 其余间距中位数 × 2"、
//     只有一段间距时按"≥ 相邻条目较小者的一半"判；
//     每层最多一条星号带；没有大空档时最后一条带吃剩余（星号），有大空档时最后一条按条目自身尺寸写死。
//     **不发射任何间距元素**：间距要么并进前一带，要么就是那段星号带。
//     **首段空档也成带**：第一个条目与网格原点之间那段（容器内缩 / 分区顶边到内容的空白）是第一条带。
//   - 格子起点 = 网格原点 + 前面各带尺寸之和（不是"带起点"：带起点是设计稿里条目的位置，
//     首条带前面还有首段空档，用带起点会把首段空档丢掉）。
//   - 行列由节点 bbox 聚类得到（列 = x 区间重叠的带，行 = y 起始边邻近的带），同样按口径 A 成带。
//   - 落格按起始边判定归属；控件 bbox 覆盖到的带全部占住（跨带即写 RowSpan / ColumnSpan）。
//   - flex 主轴优先：容器声明了 flexContainerInfo.flexDirection（row/column）时，主轴上的每个条目独占一条带
//     （同一起点的条目合并成一条带），尺寸与星号位置仍走口径 A；没有声明的层级、以及声明层级的交叉轴按 bbox 聚类。
//   - 设计稿没打组的地方由代码补组：区域根网格里的散条目按**栏**收成合成容器——同一条列带（x 区间重叠）
//     里 ≥2 个条目 → 一个列容器（栏内再按口径 A 成行）；容器条目同样参与。判据只看位置，不猜语义；
//     收出来的容器（cell.synth，一层 Grid）与设计稿打的组同口径成带；已经成层的（owner 非空）不再补组。
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

// ---------- flex 声明与容器层级 ----------
// 成层容器与它的主轴方向由 levelAncestors / flexOwnerOf 读取：主轴按条目独占带（口径 A 成带），
// 交叉轴与没有声明 flex 的层级按 bbox 聚类（同一套口径）。
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

// 成层祖先（含带约束的无 flex 声明的容器），由近及远：有 flex 方向的层主轴显式成带，
// 没有 flex 方向的层（带约束的容器）主干与交叉轴都走 bbox 聚类。
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

// 主轴方向（只认 row/column）。
function mainAxisOf(record) {
  const direction = record && record.flex && record.flex.flexDirection;
  return direction === "row" || direction === "column" ? direction : null;
}

// 子容器是否与父容器同轴、且自己没声明交叉轴（交叉轴声明是子容器独有的排版语义，展平会丢）。
function sameAxisAsParent(tree, parentKey, containerRef) {
  const parentRecord = parentKey ? tree.byRef.get(parentKey) : null;
  const childRecord = tree.byRef.get(containerRef);
  const parentDirection = mainAxisOf(parentRecord);
  const childDirection = mainAxisOf(childRecord);
  if (!parentDirection || parentDirection !== childDirection) return false;
  const flex = childRecord.flex || {};
  return !flex.alignItems && !flex.justifyContent;
}

function buildFlexItems(entries, tree) {
  const membersOf = new Map();
  const containers = new Set();
  entries.forEach(function (entry) {
    const chain = levelAncestors(tree, entry.ref);
    chain.forEach(function (info) { containers.add(info.containerRef); });
    const key = chain.length ? chain[0].containerRef : null;
    if (!membersOf.has(key)) membersOf.set(key, []);
    // 记下这个条目直接属于哪个成层容器：同轴叶堆展平后，用它区分"组间空档"与"组内间距"。
    entry.group = key;
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
      // 展平三条收口规则（都不新增语义，只是不发射多余的网格层）：
      //   ① 单条目容器：没有主轴关系可表达；
      //   ② **同轴叶堆**：子容器与父容器主轴方向相同、子容器没有声明交叉轴
      //      （alignItems / justifyContent）、且子容器的条目全是**叶子**时，
      //      这些条目直接进父层——同轴套一层 Grid 只多一层壳，间距并进父层后由口径 A 统一成带
      //      （"嵌套太多"就是这一条要治的）；条目里还有容器时不展平，那一层是子结构的承载物。
      //   ③ 带尺寸约束的容器一律不展平（约束必须有承载物）。
      if ((inner.length < 2 || (sameAxisAsParent(tree, key, containerRef) &&
          inner.every(function (item) { return !item.container; }))) &&
          !carriesConstraints(tree, containerRef)) {
        items.push.apply(items, inner);
        return;
      }
      items.push({
        ref: containerRef, container: true,
        x: record.x, y: record.y, w: record.w, h: record.h, items: inner,
        flex: record.flex || null, group: key
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

// 口径 A（唯一成带口径）：一条带 = 条目 + 它后面的间距（= 到下一带起始边的距离）；
// 哪一段间距单独落成星号带，用两条判据（都不写死像素阈值）：
//   ① 结构优先：相邻条目分属**不同的子组**时，那一段就是设计稿声明的"组间空档"
//      （容器的 flexContainerInfo.gap 就体现在这里）——读设计稿的结构，不猜；
//   ② 散条目（设计师没打组、读不到结构）：同层最大的一段间距 ≥ 其余间距中位数 × STAR_RATIO 才算空档
//      —— 判的是"比周围大得多"这个相对关系，设计稿放大缩小都成立，与绝对像素无关。
// 两条都不命中就不给星号（全固定，末条带吃剩余）。每层最多一条星号带。
const STAR_RATIO = 2;      // 多段间距时：最大的一段 ≥ 其余间距中位数 × 2 才算"空档"
const GUTTER_RATIO = 0.5;  // 只有一段间距时：它 ≥ 相邻条目较小者的一半才算"空档"，否则是槽间距

function bandGroup(band) {
  const item = (band.items || [])[0];
  const group = item ? item.group : band.group;
  return group === undefined ? null : group;
}

// 星号带插在哪一段之后：返回带下标；没有就返回 -1。
function starGapIndex(bands) {
  const gaps = [];
  for (let i = 0; i < bands.length - 1; i += 1) {
    const space = bands[i + 1].start - bands[i].end;
    if (!(space > 0)) continue;
    gaps.push({ index: i, space: space });
  }
  if (!gaps.length) return -1;
  // ① 结构：相邻条目属于不同子组（且两边都读得到组）→ 组间空档
  const structural = gaps.filter(function (gap) {
    const left = bandGroup(bands[gap.index]);
    const right = bandGroup(bands[gap.index + 1]);
    return left !== null && right !== null && left !== right;
  });
  if (structural.length) {
    return structural.sort(function (a, b) { return b.space - a.space; })[0].index;
  }
  // ② 相对：最大的一段 ≥ 其余间距中位数 × STAR_RATIO（多段间距时）
  const sorted = gaps.slice().sort(function (a, b) { return b.space - a.space; });
  if (sorted.length >= 2) {
    const rest = sorted.slice(1).map(function (gap) { return gap.space; })
      .sort(function (a, b) { return a - b; });
    const median = rest[Math.floor((rest.length - 1) / 2)];
    if (sorted[0].space >= median * STAR_RATIO) return sorted[0].index;
    return -1;
  }
  // ③ 只有一段间距：它比相邻条目里较小那个（沿主轴方向的尺寸）的一半还大，才算设计稿留的"空档"，
  //    否则是普通槽间距（38 / 21 这类）。
  const only = sorted[0];
  const leftBand = bands[only.index];
  const rightBand = bands[only.index + 1];
  const near = Math.min(leftBand.end - leftBand.start, rightBand.end - rightBand.start);
  return only.space >= near * GUTTER_RATIO ? only.index : -1;
}

// 在带里插入星号带：带数组与尺寸数组必须一一对应，所以星号也占一条带。
function insertBigGapStar(bands) {
  const index = starGapIndex(bands);
  if (index < 0) return bands;
  const gap = Math.max(1, Math.round(bands[index + 1].start - bands[index].end));
  const out = bands.slice();
  out.splice(index + 1, 0, {
    kind: "star", star: true, items: [],
    start: bands[index].end, end: bands[index + 1].start, size: gap
  });
  return out;
}

// 首段空档也成带：第一个条目与网格原点之间的那段（容器内缩 / 分区上方的空白）落成第一条带，
// 这样格子起点就是网格原点 + 前面各带之和，承载物落在带里、偏移为 0，不必用 Margin 顶出去。
function insertLeadingBand(bands, originStart) {
  if (!bands.length) return bands;
  const lead = bands[0].start - originStart;
  if (!(lead > EPSILON)) return bands;
  const out = bands.slice();
  out.unshift({ kind: "lead", items: [], start: originStart, end: bands[0].start, size: Math.max(1, Math.round(lead)) });
  return out;
}

function bandSizes(bands, axis) {
  const hasStar = bands.some(function (band) { return band.star; });
  return bands.map(function (band, index) {
    if (band.star) return { size: "Star", source: "design", gap: Math.max(1, Math.round(band.size)) };
    const next = bands[index + 1];
    if (!next) {
      const own = Math.max(1, Math.round(band.end - band.start));
      return hasStar ? { size: "Pixel", value: own, source: "design" } : { size: "Star", source: "design" };
    }
    return { size: "Pixel", value: Math.max(1, Math.round(next.start - band.start)), source: "design" };
  });
}

// ---------- 主轴带（声明了 flex 主轴的容器）----------
// 条目独占一条带（否则"同一行横向排列的条目被并进同一条列带"后会被撞格规则竖排，设计稿语义丢失），
// 尺寸与星号位置都走口径 A（bandSizes）：间距并进前一带，只有判据认定的那段空档单独成星号带。
// 列宽策略（主轴是 row 且没有大空档）：固定项照设计稿像素，其余容器条目自适应
// （单个 → 裸星号；多个 → 按设计稿比例加权星号）。
// 固定项 = 子树里只有相机控件的条目（相机所在的 Grid），或**区域根网格里**贴主轴末端的最末条目（页面常驻右栏）。

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
  return insertBigGapStar(bands);
}

// 主轴带的尺寸：走口径 A（bandSizes）。主轴 row 且这一层没有大空档时，容器条目自适应
// （单个 → 裸星号；多个 → 按设计稿比例加权），固定项与叶子控件照设计稿像素。
function mainAxisSizes(bands, direction) {
  const hasStar = bands.some(function (band) { return band.star; });
  if (direction !== "row" || hasStar) return bandSizes(bands, direction === "row" ? "x" : "y");
  const autoItems = bands.filter(function (band) {
    return band.kind === "item" && !band.fixed && isAutoItem(band.items[0]);
  });
  return bands.map(function (band, index) {
    const next = bands[index + 1];
    if (band.fixed || !isAutoItem(band.items[0])) {
      if (!next) return { size: "Pixel", value: Math.max(1, Math.round(band.size)), source: "design" };
      return { size: "Pixel", value: Math.max(1, Math.round(next.start - band.start)), source: "design" };
    }
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

// 格子尺寸照设计稿：像素带照值、星号带吃剩余（带权重的按权重分）。
// 这样"格子尺寸 − 控件尺寸 = 间距"才有真值可对（星号带分到的是设计稿的剩余空间，不是猜的）。
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
// size 是本网格的可用尺寸（内容区 = 分区尺寸；嵌套网格 = 父格子尺寸）：星号带分多少靠它算。
// origin 是本网格在设计稿绝对坐标里的原点（内容区 = 分区原点；嵌套网格 = 承载物设计稿起点）：
// 格子起点一律按「原点 + 前面各带尺寸之和」推，**不能**用带起点——带起点是设计稿里条目的位置，
// 首条带前面可能还有容器内缩（padding），用带起点会把这段内缩丢掉（承载物被贴到格子起始边）。
// owner = 本网格对应的成层容器（{ref, direction, record}）：声明了 flex 主轴时，主轴由 owner 条目独占带，
// 交叉轴仍按聚类；没有 owner（或约束成层但无 flex 声明）时两轴都按聚类。两轴成带口径相同（口径 A）。
function buildGridFrom(nodes, ctx, size, owner, origin) {
  if (!nodes.length) return { rows: [], columns: [], cells: [] };
  const gridOrigin = origin || { x: 0, y: 0 };
  const xOf = function (n) { return n.x; };
  const yOf = function (n) { return n.y; };
  const direction = owner && owner.direction;
  // 列按 x 区间重叠聚（同一列的控件横向重叠）；行按**起始边**聚（容器跨多行是常态，
  // 按 y 区间重叠会把整页并成一行，位置就丢了）。
  const baseColumns = insertBigGapStar(clusterByOverlap(nodes, xOf, function (n) { return Math.max(n.w, 1); }));
  const baseRows = insertBigGapStar(clusterBands(nodes, yOf, function (n) { return Math.max(n.h, 1); }));
  // 设计稿声明了 flex 主轴的地方，主轴上的每个条目独占一条带——否则"同一行横向排列的条目
  // 被并进同一条列带"后会被撞格规则竖排（设计稿语义丢失）。没有声明的层级仍按上面的聚类。
  const mainBands = direction ? mainAxisBands(nodes, owner) : null;
  // 主轴（声明了 flex 方向）用显式带；交叉轴与没有声明的层级都用 bbox 聚类。
  // 两轴都先补"首段空档"带：承载物落在带里、偏移为 0，不必用 Margin 顶到设计稿位置。
  const columns = insertLeadingBand(direction === "row" ? mainBands : baseColumns, gridOrigin.x);
  const rows = insertLeadingBand(direction === "column" ? mainBands : baseRows, gridOrigin.y);
  const cells = [];
  // 每个格子承载物的设计稿起点（算偏移与内层网格原点用）。
  const nodeBoxes = [];
  // 落格阶段只决定"谁落在哪个格"；格子尺寸要等所有撞格插行做完再算（插行会把收尾星号行变成像素行，
  // 先算出来的尺寸会与最终行列定义不一致）。
  const childSets = [];
  const occupied = new Set();
  let rowSizes = direction === "column" ? mainAxisSizes(rows, "column") : bandSizes(rows, "y");
  const columnSizes = direction === "row" ? mainAxisSizes(columns, "row") : bandSizes(columns, "x");
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
    const sourceRecord = ctx.dslTree && ctx.dslTree.byRef.get(node.ref);
    if (sourceRecord && sourceRecord.constraints) cell.constraints = sourceRecord.constraints;
    if (node.container) {
      cell.container = true;
      if (node.synth) {
        cell.synth = true;
        // 补组容器的"主轴"就是它的排列方向（同列 → 竖直），发射器据此决定哪一维撑满。
        cell.synthAxis = node.axis || "y";
      }
    } else {
      cell.controlType = node.controlType;
    }
    cells.push(cell);
    nodeBoxes.push({ x: node.x, y: node.y });
    childSets.push(childNodes);
  });
  // 第二遍：按最终行列定义算每格的格子尺寸（跨格累加；含自适应带分的剩余），再递归内层网格。
  const columnExtents = bandExtents(columnSizes, size && size.w);
  const rowExtents = bandExtents(rowSizes, size && size.h);
  const extentSum = function (extents, count) {
    let total = 0;
    for (let i = 0; i < count; i += 1) total += Number(extents[i] || 0);
    return total;
  };
  cells.forEach(function (cell, index) {
    // 格子起点 = 网格原点 + 前面各带尺寸之和；偏移 = 承载物设计稿起点 − 格子起点。
    const box = nodeBoxes[index];
    if (!cell.shifted) {
      cell.offsetX = Math.round(box.x - (gridOrigin.x + extentSum(columnExtents, cell.column)));
      cell.offsetY = Math.round(box.y - (gridOrigin.y + extentSum(rowExtents, cell.row)));
    }
    const cellWidth = extentOf(columnExtents, cell.column, cell.columnSpan);
    const cellHeight = extentOf(rowExtents, cell.row, cell.rowSpan);
    // 算不出正数的格子尺寸（星号带被前面的固定带吃光：设计稿内容溢出了承载物）→ 登记 unsized，
    // 发射器不写尺寸与对齐，门禁按提示登记（这类格子没有设计稿尺寸可表达，不是产物损坏）。
    const unsized = {};
    if (cellWidth > 0) cell.width = cellWidth;
    else unsized.width = true;
    if (cellHeight > 0) cell.height = cellHeight;
    else unsized.height = true;
    if (Object.keys(unsized).length) cell.unsized = unsized;
    if (childSets[index].length) {
      const childRecord = ctx.dslTree && ctx.dslTree.byRef.get(cell.ref);
      cell.children = buildGridFrom(childSets[index], ctx, contentSizeOf(cell), flexOwnerOf(childRecord), box);
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

function buildRegionGrid(entries, containers, pending, dslTree, size, origin) {
  const tree = buildContainmentTree(entries, containers, pending);
  const flex = buildFlexItems(tree.roots, dslTree);
  const owner = flexOwnerOf(flex.owner);
  // 区域根网格是页面内容区那一层：页面常驻右栏（贴主轴末端的最末条目）在这一层固定。
  if (owner) owner.root = true;
  // 设计稿已经打了组（这一层由某个容器提上来的，owner 非空）就不再补组；只有散落条目才补。
  const items = owner ? flex.items : synthRegionGroups(flex.items);
  return buildGridFrom(items, { childrenOf: tree.childrenOf, dslTree: dslTree }, size, owner, origin);
}

// 设计稿没打组的地方，代码补组：区域根网格里的散条目按**栏**收成合成容器。
// 判据只有一条——位置：同一条列带（x 区间重叠，条目在竖直方向排）里 ≥2 个条目 → 一个列容器
// （axis="y"，栏内再按口径 A 成行）。容器条目与叶子同等参与。
// 这样"没打组的页"与"设计稿打了组的页"产物同构：一栏 = 一层 Grid，加控件只动栏内那一层。
//
// 只按栏补、不按行补（两条都有实测证据，见 tests/gen-mw-wpf-layout.test.js 用例 1/2/4）：
//   ① 行方向合并会把本该撑满主轴的容器钉死在自己的设计稿高度上（可用高度变成新容器自己的高度）；
//   ② y 区间重叠 ≠ 一行——它会把页面两端互不相干的条目（左标签 + 右侧高控件）也并进来，
//      把顶层本来分开的列并成一格，反而丢结构。
// 行语义另有来源：设计稿打了组时由容器的 flex 主轴（column）表达；没打组时，每一栏内部本来
// 就是按口径 A 成行的，加控件同样只动栏内那一层。
function synthRegionGroups(items) {
  if (items.length < 2) return items;
  const consumed = new Set();
  const groups = [];
  clusterByOverlap(items, function (n) { return n.x; }, function (n) { return Math.max(n.w, 1); })
    .forEach(function (band) {
      if (band.items.length < 2) return;
      const sorted = band.items.slice().sort(function (a, b) { return a.y - b.y; });
      const left = Math.min.apply(null, sorted.map(function (item) { return item.x; }));
      const right = Math.max.apply(null, sorted.map(function (item) { return item.x + item.w; }));
      const top = Math.min.apply(null, sorted.map(function (item) { return item.y; }));
      const bottom = Math.max.apply(null, sorted.map(function (item) { return item.y + item.h; }));
      sorted.forEach(function (item) { consumed.add(item.ref); });
      groups.push({
        ref: "synth:" + sorted[0].ref, container: true, synth: true, axis: "y", items: sorted,
        x: left, y: top, w: right - left, h: bottom - top
      });
    });
  if (!groups.length) return items;
  return items.filter(function (item) { return !consumed.has(item.ref); }).concat(groups);
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
      }, { x: 0, y: tokens.headerHeight })
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
