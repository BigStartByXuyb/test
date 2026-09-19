#!/usr/bin/env node
"use strict";

/*
 * Build the page-level icon map from the current MasterGo extraction.
 *
 * This is deliberately a discovery step, not a naming step.  Every PATH in
 * the page mapping is recorded as a candidate, but only an entry already
 * present in the page's confirmed map is emitted in icons[].  Resource names
 * must come from an approved mapping; layer names, coordinates and SVG names
 * are never converted into XAML resource keys.
 *
 * approved 的判定口径：approved = 名称已登记在本页图标台账（icon-map 的 icons[]）中。
 * 本页自建的语义键、以及页面内唯一临时键（status=provisional）都算 approved，不要求跨页复用，
 * 也不依赖外部清单；键只要求在本页 Icons.xaml 内唯一并被本页引用。被禁止的只是“由图层 ID/
 * 坐标/几何外观自动拼名”（例如 MGIcon_<layer-id>），不限制人按语义起名。
 *
 * Usage:
 *   node discover-mtslg-page-icon-map.js --svg extractSvg.json \
 *     --mapping mapping.json --confirmed icon-map.json --out icon-map.json \
 *     [--dsl dsl.snapshot.json]
 *
 * 台账提示（ledgerFields）：每条候选额外给出「写台账时可直接粘贴」的字段，ref 全部来自
 * 机器读取（本脚本不猜、不拼），人只负责填 name / comment 与语义判断：
 *   ownerRef / ownerText / ownerControlType —— 该图标属于哪个已映射控件（沿真实父子链向上找到的最近映射节点）
 *   parentRef / parentType / siblingPathCount —— 图形所在层与其同级 PATH 数（>1 时说明是多路径图标，台账应登记父层）
 *   ledgerFields.sourceId     —— extractSvg 条目 id；为 null 时以 sourceRef + fromDsl:true 合成
 *   ledgerFields.sourceRef    —— 只包住图形的 PATH 节点（从 DSL 原样复制）
 *   ledgerFields.fromDsl      —— extractSvg 没有该条目时为 true（生成器从 DSL 合成几何）
 *   ledgerFields.bakeAncestorTransform —— 该 PATH 到所属控件之间的祖先链上存在 rotate/flipH/flipV 时为 true；
 *                                          未传 --dsl 时输出 null（无法判断）
 *   ledgerFields.iconSize     —— 图形的 bbox（宽/高），供台账核对 IconWidth/IconHeight
 * 该字段只做提示：脚本仍然不按图层名/坐标/几何自动起名，也不自动写入台账。
 */
const fs = require("fs");
const path = require("path");
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { readJson } = require(path.join(__dirname, "lib", "script-helpers.js"));
// 图标归属判据的唯一实现（见 scripts/lib/icon-ownership.js；禁止在本脚本再抄一份）。
const ICON_OWNERSHIP = require(path.join(__dirname, "lib", "icon-ownership.js"));

function usage() {
  console.error("Usage: node discover-mtslg-page-icon-map.js --svg <extractSvg.json> --mapping <mapping.json> [--confirmed <icon-map.json>] [--dsl <dsl.snapshot.json>] --out <page-icon-map.json>");
  process.exit(2);
}

function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) usage();
    const value = argv[++i];
    if (!value || value.startsWith("--")) usage();
    result[key.slice(2)] = value;
  }
  if (!result.svg || !result.mapping || !result.out) usage();
  return result;
}

// 候选 PATH ↔ extractSvg 条目 的归属匹配：与 gen-mtslg-mapping-from-dsl.js 共用
// lib/icon-ownership.js 的**同一份**判据（① 树判据优先 ② 仅当无树命中才回退 id 前缀
// ③ 多条命中取树最深者）。本脚本只负责把 mapping.sourceNodes 组装成树索引适配器。
function buildSourceTreeIndex(sourceNodes) {
  const nodeByRef = new Map();
  const childrenByParent = new Map();
  const parentByRef = new Map();
  for (const node of sourceNodes) {
    if (!node || typeof node.ref !== "string" || !node.ref) continue;
    nodeByRef.set(node.ref, node);
    const parent = node.parentRef === undefined ? null : node.parentRef;
    parentByRef.set(node.ref, parent);
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(node.ref);
  }
  return {
    hasNode: ref => nodeByRef.has(ref),
    childrenOf: ref => childrenByParent.get(ref) || [],
    parentOf: ref => (parentByRef.has(ref) ? parentByRef.get(ref) : null),
    isPathNode: ref => {
      const node = nodeByRef.get(ref);
      return Boolean(node && node.type === "PATH");
    },
  };
}

function exactExtractEntry(svgs, ref, tree) {
  if (typeof ref !== "string" || !ref) return null;
  const owners = ICON_OWNERSHIP.selectOwningEntries({
    index: tree,
    entries: svgs,
    entryRef: item => (item ? item.id : null),
    targetPathRefs: [ref],
  });
  return owners[0] || null;
}

// 可选 --dsl：给台账提示补「祖先朝向」与「图形 bbox 兜底」。只用于提示，不参与归属判定。
function buildLedgerDslIndex(snapshot) {
  const byRef = new Map();
  const parentOf = new Map();
  const root = snapshot && snapshot.dsl && Array.isArray(snapshot.dsl.nodes) ? snapshot.dsl.nodes[0] : null;
  (function visitLedgerNode(node, parentRef) {
    if (!node || typeof node.id !== "string") return;
    byRef.set(node.id, node);
    parentOf.set(node.id, parentRef);
    for (const child of node.children || []) visitLedgerNode(child, node.id);
  })(root, null);
  return { byRef, parentOf };
}

function ledgerHasOrientation(node) {
  if (!node) return false;
  // 口径必须与 gen-mtslg-page-icons.js 的 nodeOrientationMatrix 完全一致：只读 layoutStyle。
  const layoutStyle = (node && node.layoutStyle) || {};
  if (layoutStyle.flipH === true || layoutStyle.flipV === true) return true;
  const rotate = Number(layoutStyle.rotate);
  return Number.isFinite(rotate) && rotate !== 0;
}

// 从图形节点向上走到所属控件（含端点），看中间是否有旋转/翻转。
function ledgerOrientationFlag(dslIndex, ref, stopRef) {
  if (!dslIndex) return null;
  let current = dslIndex.parentOf.get(ref) || null;
  let guard = 0;
  while (current && guard < 128) {
    if (ledgerHasOrientation(dslIndex.byRef.get(current))) return true;
    if (stopRef && current === stopRef) break;
    current = dslIndex.parentOf.get(current) || null;
    guard += 1;
  }
  return false;
}

// 沿真实父子链向上找到最近的「已映射控件」节点（mapping.nodes 的 sourceRef）。
function ledgerOwnerRef(tree, mappedRefs, ref) {
  let current = ref;
  let guard = 0;
  while (current && guard < 128) {
    if (mappedRefs.has(current)) return current;
    current = tree.parentOf(current) || null;
    guard += 1;
  }
  return null;
}

function main() {
  const input = args(process.argv.slice(2));
  const svgData = readJson(input.svg, "extractSvg JSON");
  const mapping = readJson(input.mapping, "page mapping JSON");
  const confirmed = input.confirmed ? readJson(input.confirmed, "confirmed page icon map") : { icons: [] };
  const dslIndex = input.dsl ? buildLedgerDslIndex(readJson(input.dsl, "DSL snapshot")) : null;
  if (!Array.isArray(svgData.svgs)) throw new Error("extractSvg JSON must contain svgs[]");
  if (!Array.isArray(mapping.sourceNodes)) throw new Error("page mapping JSON must contain sourceNodes[]");
  if (!Array.isArray(confirmed.icons)) throw new Error("confirmed page icon map must contain icons[]");

  const tree = buildSourceTreeIndex(mapping.sourceNodes);
  const sourceNodeByRef = new Map();
  for (const node of mapping.sourceNodes) {
    if (node && typeof node.ref === "string" && node.ref && !sourceNodeByRef.has(node.ref)) sourceNodeByRef.set(node.ref, node);
  }
  const mappedRefs = new Set(
    (Array.isArray(mapping.nodes) ? mapping.nodes : [])
      .map(node => (node && (node.sourceRef || node.ref)) || null)
      .filter(Boolean)
  );
  const mappedByRef = new Map();
  for (const node of Array.isArray(mapping.nodes) ? mapping.nodes : []) {
    const ref = node && (node.sourceRef || node.ref);
    if (ref && !mappedByRef.has(ref)) mappedByRef.set(ref, node);
  }
  const confirmedByRef = new Map();
  const confirmedBySource = new Map();
  for (const icon of confirmed.icons) {
    if (!icon || typeof icon.sourceRef !== "string" || typeof icon.sourceId !== "string") continue;
    confirmedByRef.set(icon.sourceRef, icon);
    confirmedBySource.set(`${icon.sourceId}\u0000${icon.sourceRef}`, icon);
  }

  const candidates = [];
  const seenRefs = new Set();
  for (const node of mapping.sourceNodes) {
    if (!node || node.type !== "PATH" || typeof node.ref !== "string" || !node.ref) continue;
    if (seenRefs.has(node.ref)) continue;
    seenRefs.add(node.ref);
    const svg = exactExtractEntry(svgData.svgs, node.ref, tree);
    const confirmedIcon = (svg && confirmedBySource.get(`${svg.id}\u0000${node.ref}`)) || confirmedByRef.get(node.ref);
    // A confirmed page mapping is allowed to point at an extracted SVG whose
    // PATH ref is not an ancestor (for example an icon container PATH).  In
    // that case the confirmed sourceId remains the authoritative binding.
    const sourceId = svg ? svg.id : (confirmedIcon ? confirmedIcon.sourceId : null);
    const candidate = {
      sourceId,
      sourceRef: node.ref,
      svgName: node.svgName || (svg && svg.name) || null,
      nodeName: node.name || null,
      status: confirmedIcon ? (confirmedIcon.status === "provisional" ? "provisional" : "confirmed") : "unmapped",
      reason: confirmedIcon ? (confirmedIcon.status === "provisional" ? "provisional-page-map" : "confirmed-page-map") : (svg ? "missing-page-resource-name" : "no-exact-extractSvg-entry")
    };
    // 台账提示：ref 全部来自真实节点数据，人只填 name / comment。
    const ownerRef = ledgerOwnerRef(tree, mappedRefs, node.ref);
    const ownerNode = ownerRef ? mappedByRef.get(ownerRef) : null;
    const parentRef = tree.parentOf(node.ref) || null;
    const parentSource = parentRef ? sourceNodeByRef.get(parentRef) : null;
    const parentDsl = parentRef && dslIndex ? dslIndex.byRef.get(parentRef) : null;
    // 图形 bbox：优先用 mapping.sourceNodes 自带的 width/height，缺失时回退该节点自己的 layoutStyle。
    const dslLayout = (dslIndex && dslIndex.byRef.get(node.ref) && dslIndex.byRef.get(node.ref).layoutStyle) || {};
    const boxWidth = Number(node.width !== undefined ? node.width : dslLayout.width);
    const boxHeight = Number(node.height !== undefined ? node.height : dslLayout.height);
    candidate.ownerRef = ownerRef;
    candidate.ownerText = ownerNode ? (ownerNode.sourceText || "") : "";
    candidate.ownerControlType = ownerNode ? (ownerNode.controlType || null) : null;
    candidate.parentRef = parentRef;
    candidate.parentType = (parentSource && parentSource.type) || (parentDsl && parentDsl.type) || null;
    candidate.siblingPathCount = parentRef
      ? tree.childrenOf(parentRef).filter(childRef => tree.isPathNode(childRef)).length
      : 0;
    candidate.ledgerFields = {
      sourceId: sourceId || null,
      sourceRef: node.ref,
      fromDsl: !svg,
      bakeAncestorTransform: ledgerOrientationFlag(dslIndex, node.ref, ownerRef),
      iconSize: Number.isFinite(boxWidth) && Number.isFinite(boxHeight)
        ? { width: boxWidth, height: boxHeight }
        : null
    };
    if (confirmedIcon) {
      candidate.name = confirmedIcon.name;
      candidate.comment = confirmedIcon.comment;
    }
    candidates.push(candidate);
  }

  const output = {
    icons: confirmed.icons,
    candidates,
    unmapped: candidates.filter((candidate) => candidate.status === "unmapped")
  };
  fs.mkdirSync(require("path").dirname(input.out), { recursive: true });
  fs.writeFileSync(input.out, JSON.stringify(output, null, 2) + "\n", "utf8");
  const needSynthesis = candidates.filter(candidate => candidate.ledgerFields.fromDsl).length;
  const needBake = candidates.filter(candidate => candidate.ledgerFields.bakeAncestorTransform === true).length;
  console.log(`Discovered ${candidates.length} page icon candidate(s); ${output.icons.length} confirmed;`
    + ` 台账提示：待命名 ${output.unmapped.length} 条，需 fromDsl 合成 ${needSynthesis} 条，需烘焙祖先朝向 ${needBake} 条：${input.out}`);
}

try { main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
