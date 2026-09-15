#!/usr/bin/env node
/**
 * apply-container-containment.js —— 容器类组件（infoGroupTemplates 的 GroupBox）嵌套重挂
 *
 * 背景：设计稿里"视觉上在容器框内"的控件，在 DSL 层级上常常是容器的**平级兄弟**
 * （设计者没把它们放进组件里）。本脚本按**坐标完全包含**关系，把这些平级控件重挂到
 * 已登记并已发射的容器节点下，使 XML 里出现真正的父子层级（子坐标相对父容器）。
 *
 * 用法：
 *   node apply-container-containment.js --mapping <mapping.json> \
 *        --template-map <mtslg-iocontrol-map.json> --out <mapping.out.json> [--report <report.json>]
 *
 * 生效范围与规则（全部 fail-closed，不猜）：
 *   - 容器：仅"已发射"且其变体 spec.childPolicy === "nested-page-templates" 的组件实例；
 *   - 包含判定：控件 bbox **完全**落在容器 bbox 内（贴边可以，越界 1px 即不算）；
 *   - 多容器同时包含 → 取**面积最小**者（= 最内层）；面积并列 → 记为冲突、保持原状；
 *   - 部分相交/越界 → 记为冲突、保持原状；
 *   - 宿主壳（顶部栏 / 底部 / 常驻信息）内的节点、容器自身不参与；会形成输出环的容器记为冲突；
 *   - 改写字段：parent 与 layoutParent 同时写为容器 ref，并重算 expectedLeft/expectedTop
 *     （根级父容器扣一次 192；嵌套父容器按相对偏移）；sourceParent / expectedWidth /
 *     expectedHeight / 节点顺序保持不变；脚本幂等。
 *
 * 退出码：0 = 正常（冲突只记录不失败）；1 = 参数/文件/映射结构错误。
 */
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--mapping') out.mapping = argv[++i];
    else if (key === '--template-map') out.templateMap = argv[++i];
    else if (key === '--out') out.out = argv[++i];
    else if (key === '--report') out.report = argv[++i];
    else fail('无法识别的参数: ' + key);
  }
  if (!out.mapping || !out.templateMap || !out.out) {
    fail('用法: node apply-container-containment.js --mapping <mapping.json> --template-map <mtslg-iocontrol-map.json> --out <mapping.out.json> [--report <report.json>]');
  }
  return out;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail('读取 ' + label + ' 失败: ' + error.message);
  }
}

const args = parseArgs(process.argv.slice(2));
const mapping = readJson(args.mapping, 'mapping');
const templateMap = readJson(args.templateMap, 'template map');

if (!Array.isArray(mapping.sourceNodes)) fail('mapping 缺少 sourceNodes');
if (!Array.isArray(mapping.nodes)) fail('mapping 缺少 nodes');

const sourceByRef = new Map(mapping.sourceNodes.map(function (node) { return [node.ref, node]; }));
const nodeByRef = new Map(mapping.nodes.map(function (node) { return [node.ref, node]; }));
const emittedBySource = new Map(mapping.nodes.map(function (node) { return [node.sourceRef || node.ref, node]; }));

function bboxOf(ref) {
  const source = sourceByRef.get(ref);
  if (!source) return null;
  const x = Number(source.pageAbsX);
  const y = Number(source.pageAbsY);
  const w = Number(source.width);
  const h = Number(source.height);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return { x, y, w, h };
}

// 宿主壳：与 gen-mtslg-mapping-from-dsl.js 的 isHostShell 同口径（含节点自身）。
function ancestorsOf(ref) {
  const chain = [];
  let current = ref;
  while (current) {
    chain.push(current);
    const source = sourceByRef.get(current);
    current = source ? (source.parentRef || null) : null;
  }
  return chain;
}
function isHostShell(ref) {
  return ancestorsOf(ref).some(function (id) {
    const source = sourceByRef.get(id);
    const name = String((source && source.name) || '');
    return name.includes('顶部栏') || name.includes('底部') || name.includes('常驻信息');
  });
}

// 容器清单：已发射 + 变体声明 childPolicy = nested-page-templates
const containerSpecs = [];
const seenContainers = new Set();
for (const instance of mapping.componentInstances || []) {
  const family = templateMap[instance.template];
  if (!family || !family.variants) continue;
  const variantKey = instance.componentSet || instance.variant;
  const spec = variantKey ? family.variants[variantKey] : null;
  if (!spec || spec.childPolicy !== 'nested-page-templates') continue;
  const ref = instance.instanceRef;
  if (!ref || seenContainers.has(ref)) continue;
  const node = emittedBySource.get(ref);
  if (!node) continue;                                  // 未发射的容器不参与
  const bbox = bboxOf(ref);
  if (!bbox) continue;
  seenContainers.add(ref);
  containerSpecs.push({
    ref: ref,
    xmlId: node.xmlId || node.id || ref,
    controlType: node.controlType || (node.attrs && node.attrs.ControlType) || null,
    family: instance.template,
    componentSet: variantKey || null,
    bbox: bbox,
    area: bbox.w * bbox.h
  });
}
const containerRefs = new Set(containerSpecs.map(function (spec) { return spec.ref; }));

const report = {
  schemaVersion: 'mastergo-nesting-report/1',
  mapping: path.resolve(args.mapping),
  rootRef: mapping.rootRef || null,
  contentOriginY: mapping.contentOriginY === undefined ? 192 : Number(mapping.contentOriginY),
  containers: containerSpecs.map(function (spec) {
    return {
      ref: spec.ref, xmlId: spec.xmlId, controlType: spec.controlType,
      componentSet: spec.componentSet,
      bbox: { x: spec.bbox.x, y: spec.bbox.y, width: spec.bbox.w, height: spec.bbox.h }
    };
  }),
  reparented: [],
  skipped: [],
  conflicts: [],
  unchanged: 0
};

if (containerSpecs.length > 0) {
  for (const node of mapping.nodes) {
    const ref = node.sourceRef || node.ref;
    const bbox = bboxOf(ref);
    if (!bbox) { report.skipped.push({ ref: ref, xmlId: node.xmlId || ref, reason: 'missing-bbox' }); continue; }
    if (isHostShell(ref)) continue;                       // 宿主壳节点直接不参与（背景层 1280×1024 也在此列）

    const fully = [];
    const partial = [];
    for (const spec of containerSpecs) {
      if (spec.ref === ref) continue;                     // 容器自身
      const ancestors = ancestorsOf(ref);
      // 防环：若容器本身是"我"的 DSL 后代，把我挂进容器会形成输出环 → 记冲突、不挂。
      if (ancestorsOf(spec.ref).includes(ref)) {
        report.conflicts.push({ ref: ref, xmlId: node.xmlId || ref, reason: 'container-is-descendant-of-node', container: spec.ref });
        continue;
      }
      const inside = bbox.x >= spec.bbox.x && bbox.y >= spec.bbox.y &&
        bbox.x + bbox.w <= spec.bbox.x + spec.bbox.w && bbox.y + bbox.h <= spec.bbox.y + spec.bbox.h;
      const overlaps = bbox.x < spec.bbox.x + spec.bbox.w && bbox.x + bbox.w > spec.bbox.x &&
        bbox.y < spec.bbox.y + spec.bbox.h && bbox.y + bbox.h > spec.bbox.y;
      if (inside) fully.push(spec);
      else if (overlaps) partial.push(spec);
    }

    if (fully.length === 0) {
      // 容器与容器之间的正常重叠（外层容器比内层大）不算冲突，只有普通控件"看着在框里却压边"才记冲突。
      if (partial.length > 0 && !containerRefs.has(ref)) {
        report.conflicts.push({
          ref: ref, xmlId: node.xmlId || ref, reason: 'partial-overlap',
          containers: partial.map(function (spec) { return spec.ref; })
        });
      }
      continue;
    }

    const minArea = Math.min.apply(null, fully.map(function (spec) { return spec.area; }));
    const innermost = fully.filter(function (spec) { return spec.area === minArea; });
    if (innermost.length > 1) {
      report.conflicts.push({
        ref: ref, xmlId: node.xmlId || ref, reason: 'ambiguous-smallest-container',
        containers: innermost.map(function (spec) { return spec.ref; })
      });
      continue;
    }

    const target = innermost[0];
    const fromParent = node.layoutParent !== undefined ? node.layoutParent : (node.parent || null);
    if (fromParent === target.ref && node.parent === target.ref) {
      report.unchanged += 1;
      continue;
    }

    const parentIsRoot = !mapping.rootRef || target.ref === mapping.rootRef;
    const originX = parentIsRoot ? 0 : target.bbox.x;
    const originY = parentIsRoot ? 0 : target.bbox.y;
    node.parent = target.ref;
    node.layoutParent = target.ref;
    node.expectedLeft = bbox.x - originX;
    node.expectedTop = bbox.y - originY - (parentIsRoot ? report.contentOriginY : 0);
    report.reparented.push({
      ref: ref,
      xmlId: node.xmlId || ref,
      controlType: node.controlType || (node.attrs && node.attrs.ControlType) || null,
      fromParent: fromParent,
      toParent: target.ref,
      rule: 'fully-contained@smallest-area',
      bbox: { x: bbox.x, y: bbox.y, width: bbox.w, height: bbox.h },
      containerBBox: { x: target.bbox.x, y: target.bbox.y, width: target.bbox.w, height: target.bbox.h },
      expectedLeft: node.expectedLeft,
      expectedTop: node.expectedTop
    });
  }
}

fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
fs.writeFileSync(args.out, JSON.stringify(mapping, null, 2) + '\n', 'utf8');
if (args.report) {
  fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true });
  fs.writeFileSync(args.report, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

console.log(JSON.stringify({
  containers: report.containers.length,
  reparented: report.reparented.length,
  unchanged: report.unchanged,
  skipped: report.skipped.length,
  conflicts: report.conflicts.length,
  out: args.out,
  report: args.report || null
}, null, 2));
