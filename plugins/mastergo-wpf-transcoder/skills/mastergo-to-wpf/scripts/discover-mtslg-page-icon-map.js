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
 *     --mapping mapping.json --confirmed icon-map.json --out icon-map.json
 */
const fs = require("fs");
const path = require("path");
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { readJson } = require(path.join(__dirname, "lib", "script-helpers.js"));
// 图标归属判据的唯一实现（见 scripts/lib/icon-ownership.js；禁止在本脚本再抄一份）。
const ICON_OWNERSHIP = require(path.join(__dirname, "lib", "icon-ownership.js"));

function usage() {
  console.error("Usage: node discover-mtslg-page-icon-map.js --svg <extractSvg.json> --mapping <mapping.json> [--confirmed <icon-map.json>] --out <page-icon-map.json>");
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

function main() {
  const input = args(process.argv.slice(2));
  const svgData = readJson(input.svg, "extractSvg JSON");
  const mapping = readJson(input.mapping, "page mapping JSON");
  const confirmed = input.confirmed ? readJson(input.confirmed, "confirmed page icon map") : { icons: [] };
  if (!Array.isArray(svgData.svgs)) throw new Error("extractSvg JSON must contain svgs[]");
  if (!Array.isArray(mapping.sourceNodes)) throw new Error("page mapping JSON must contain sourceNodes[]");
  if (!Array.isArray(confirmed.icons)) throw new Error("confirmed page icon map must contain icons[]");

  const tree = buildSourceTreeIndex(mapping.sourceNodes);
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
  console.log(`Discovered ${candidates.length} page icon candidate(s); ${output.icons.length} confirmed: ${input.out}`);
}

try { main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
