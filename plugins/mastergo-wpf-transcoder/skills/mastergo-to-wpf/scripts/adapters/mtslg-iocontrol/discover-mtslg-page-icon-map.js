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
 *     --template-map mtslg-iocontrol-map.json [--dsl dsl.snapshot.json]
 *
 * 登记结论（registration）：每条候选直接给出「要不要进本页图标台账」的结论，模型不再回文档推判定表：
 *   registration.register —— true=必须进台账并定名；false=不要说它被 Icon 槽位引用
 *   registration.basis    —— 判据名（icon-policy-* / bottom-bar-* / host-shell / decorative /
 *                            camera-viewport-internal / no-icon-slot / unregistered-variant /
 *                            variant-without-icon-policy）
 *   registration.source   —— 结论的真值源（映射表里的具体登记项 / 宿主壳标记词实现）
 * 判据唯一实现在 scripts/adapters/mtslg-iocontrol/lib/icon-registration-policy.js；本脚本只负责把候选与真值源喂进去。
 * 输出里的 mustName 是「命名表必须覆盖的候选下标」（= register=true 的候选），
 * build-icon-ledger.mjs 按它做双向门禁（漏定名 / 多定名都失败）。
 *
 * 台账提示（ledgerFields）：每条候选给出「写台账时照抄」的字段，值全部由机器读取（本脚本不猜、
 * 不拼路径），人只负责填 name / comment 与语义判断（是否同一个图标、要不要合并、是否装饰）：
 *   ownerRef / ownerText / ownerControlType —— 该图标属于哪个已映射控件（沿真实父子链找到的最近映射节点）
 *   parentRef / parentType / siblingPathCount —— 图形所在层与其同级 PATH 数
 *   ledgerFields.sourceId     —— extractSvg 条目 id；为 null 时用 sourceRef + fromDsl:true 从 DSL 合成
 *   ledgerFields.sourceRef    —— 图形所在节点的事实值（该候选的 PATH）
 *   ledgerFields.ledgerSourceRef —— **台账里写这个值**：单路径图标=PATH；多路径图标=父层（组）。
 *                                   口径与 gen-mtslg-page-icons.js 的 synthesizeFromDsl 一致（sourceId 优先、
 *                                   sourceRef 兜底），多路径图标登记成组才不会丢子路径。
 *   ledgerFields.fromDsl      —— extractSvg 没有该条目时为 true（生成器从 DSL 合成几何）
 *   ledgerFields.bakeAncestorTransform —— PATH 的祖先链上存在 rotate/flipH/flipV 时为 true；范围是**一路到页面根**，
 *                                          与 gen-mtslg-page-icons.js 的 ancestorOrientationMatrix 同口径；
 *                                          未传 --dsl 时输出 null（无法判断，不猜）
 *   ledgerFields.iconSize     —— ledgerSourceRef 节点的 bbox（宽/高），供台账核对 IconWidth/IconHeight
 * 该字段只做提示：脚本仍然不按图层名/坐标/几何自动起名，也不自动写入台账。
 */
const fs = require("fs");
const path = require("path");
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { readJson } = require(path.join(__dirname, "..", "..", "lib", "script-helpers.js"));
// 图标归属判据的唯一实现（见 scripts/adapters/mtslg-iocontrol/lib/icon-ownership.js；禁止在本脚本再抄一份）。
const ICON_OWNERSHIP = require(path.join(__dirname, "lib", "icon-ownership.js"));
// 登记判据的唯一实现（见 scripts/adapters/mtslg-iocontrol/lib/icon-registration-policy.js；禁止在本脚本再抄一份）。
const ICON_REGISTRATION = require(path.join(__dirname, "lib", "icon-registration-policy.js"));

function usage() {
  console.error("Usage: node discover-mtslg-page-icon-map.js --svg <extractSvg.json> --mapping <mapping.json> --template-map <mtslg-iocontrol-map.json> [--confirmed <icon-map.json>] [--dsl <dsl.snapshot.json>] --out <page-icon-map.json>");
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
  if (!result.svg || !result.mapping || !result["template-map"] || !result.out) usage();
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

function ledgerHasOrientation(node) {
  if (!node) return false;
  // 口径必须与 gen-mtslg-page-icons.js 的 nodeOrientationMatrix 完全一致：只读 layoutStyle。
  const layoutStyle = (node && node.layoutStyle) || {};
  if (layoutStyle.flipH === true || layoutStyle.flipV === true) return true;
  const rotate = Number(layoutStyle.rotate);
  return Number.isFinite(rotate) && rotate !== 0;
}

// 从图形节点向上**一路走到页面根**，看是否有旋转/翻转——范围必须与
// gen-mtslg-page-icons.js 的 ancestorOrientationMatrix 完全一致（它不在所属控件处停止）。
function ledgerOrientationFlag(dslIndex, ref) {
  if (!dslIndex) return null;
  let current = dslIndex.parentOf.get(ref) || null;
  let guard = 0;
  while (current && guard < 128) {
    if (ledgerHasOrientation(dslIndex.byRef.get(current))) return true;
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
  const templateMap = readJson(input["template-map"], "mtslg-iocontrol map");
  const snapshot = input.dsl ? readJson(input.dsl, "DSL snapshot") : null;
  const dslIndex = snapshot ? ICON_REGISTRATION.buildDslIndex(snapshot) : null;
  // 登记结论依赖真实节点树：只有 Bundle 在 manifest 未提供 dslPath（续用旧台账）时会不传 --dsl，
  // 那种路径不产结论；run-all 的一键流水线恒传 dsl.snapshot.json。
  const registration = snapshot ? ICON_REGISTRATION.buildRegistrationPolicy({ templateMap, mapping, snapshot }) : null;
  if (!registration) {
    console.error("警告：未传 --dsl，本次不产出登记结论（registration）——只有 Bundle 在 manifest 未提供 dslPath（续用旧台账）时才会走到这里；"
      + "新建页面必须传 dsl.snapshot.json，否则台账门禁无判据可用。");
  }
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
    const siblingPathCount = parentRef
      ? tree.childrenOf(parentRef).filter(childRef => tree.isPathNode(childRef)).length
      : 0;
    // 台账里应登记的节点：单路径图标=PATH；多路径图标=父层（组），否则合成几何会丢子路径。
    const ledgerSourceRef = siblingPathCount > 1 && parentRef ? parentRef : node.ref;
    // bbox 取「台账登记节点」的尺寸（优先 mapping.sourceNodes 的 width/height，回退其 layoutStyle）。
    const ledgerNode = sourceNodeByRef.get(ledgerSourceRef) || node;
    const ledgerDsl = dslIndex ? dslIndex.byRef.get(ledgerSourceRef) : null;
    const ledgerLayout = (ledgerDsl && ledgerDsl.layoutStyle) || {};
    const boxWidth = Number(ledgerNode.width !== undefined ? ledgerNode.width : ledgerLayout.width);
    const boxHeight = Number(ledgerNode.height !== undefined ? ledgerNode.height : ledgerLayout.height);
    candidate.ownerRef = ownerRef;
    candidate.ownerText = ownerNode ? (ownerNode.sourceText || "") : "";
    candidate.ownerControlType = ownerNode ? (ownerNode.controlType || null) : null;
    candidate.parentRef = parentRef;
    candidate.parentType = (parentSource && parentSource.type) || (parentDsl && parentDsl.type) || null;
    candidate.siblingPathCount = siblingPathCount;
    // 登记结论：直接给答案，不让调用方回文档推判定表（判据唯一实现在 lib/icon-registration-policy.js）。
    if (registration) candidate.registration = registration.evaluate(node.ref);
    candidate.ledgerFields = {
      sourceId: sourceId || null,
      sourceRef: node.ref,
      ledgerSourceRef,
      fromDsl: !svg,
      bakeAncestorTransform: ledgerOrientationFlag(dslIndex, node.ref),
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

  const registered = candidates.filter(candidate => candidate.registration && candidate.registration.register === true);
  // 命中实例、但变体或该变体的 iconPolicy 在映射表里查不到：说明映射表缺登记 / 漏字段
  // （或用了旧 mapping），不能当成"不用登记"蒙过去——登记判据没有依据，先补齐再重跑。
  const REVIEW_BASES = new Set(["unregistered-variant", "variant-without-icon-policy"]);
  const review = candidates.filter(candidate => candidate.registration && REVIEW_BASES.has(candidate.registration.basis));
  const byBasis = {};
  for (const candidate of candidates) {
    const basis = candidate.registration ? candidate.registration.basis : "registration-unavailable";
    byBasis[basis] = (byBasis[basis] || 0) + 1;
  }
  const output = {
    registrationAvailable: Boolean(registration),
    icons: confirmed.icons,
    // 命名表必须**恰好**覆盖这些候选（register=true 的下标）——build-icon-ledger.mjs 按它双向门禁。
    mustName: registered.map(candidate => candidates.indexOf(candidate)),
    candidates,
    unmapped: candidates.filter((candidate) => candidate.status === "unmapped"),
    registrationSummary: {
      register: registered.length,
      skip: candidates.length - registered.length,
      review: review.length,
      byBasis,
      notes: registration
      ? "结论来自 scripts/adapters/mtslg-iocontrol/lib/icon-registration-policy.js（iconPolicy 与 layoutRules.bottomBar 取映射表登记值）"
        : "本次未传 --dsl，没有登记结论"
    }
  };
  fs.mkdirSync(require("path").dirname(input.out), { recursive: true });
  fs.writeFileSync(input.out, JSON.stringify(output, null, 2) + "\n", "utf8");
  const needSynthesis = candidates.filter(candidate => candidate.ledgerFields.fromDsl).length;
  const needBake = candidates.filter(candidate => candidate.ledgerFields.bakeAncestorTransform === true).length;
  console.log(`Discovered ${candidates.length} page icon candidate(s); ${output.icons.length} confirmed;`
    + ` 台账提示：待命名 ${output.unmapped.length} 条，需 fromDsl 合成 ${needSynthesis} 条，需烘焙祖先朝向 ${needBake} 条：${input.out}`);
  console.log(`登记结论：需登记 ${output.registrationSummary.register} 条（下标 ${output.mustName.join(",") || "无"}），`
    + `不登记 ${output.registrationSummary.skip} 条；判据明细 `
    + `${Object.entries(byBasis).map(([basis, count]) => basis + "=" + count).join(" ") || "无"}`);
  if (review.length) {
    for (const candidate of review) {
      const cause = candidate.registration.basis === "variant-without-icon-policy"
        ? `在映射表里漏登记 iconPolicy（变体本身已登记）`
        : `在映射表里查不到（变体没登记）`;
      console.error(`登记判据缺依据：${candidate.sourceRef} 所属实例的变体 ${candidate.registration.family}.${candidate.registration.variant}`
        + ` ${cause}（${candidate.registration.source}）`);
    }
    console.error(`共 ${review.length} 条候选的登记判据缺依据：按上面每条的原因补映射表登记（缺变体补变体、缺 iconPolicy 补字段），`
      + `再重跑 -Progress mapping / discover（不要当成"不用登记"继续生成）`);
    process.exitCode = 1;
  }
}

try { main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
