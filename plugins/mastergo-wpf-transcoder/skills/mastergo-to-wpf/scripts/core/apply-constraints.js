#!/usr/bin/env node
"use strict";

// 约束适配层：把「插件 API 的尺寸约束（min/max 宽高）」合并进 DSL 快照。
//
// 这是**唯一**读取约束来源的地方：下游（布局推导 / XAML 发射 / 布局门禁）只认统一字段
// `node.constraints = { minWidth, maxWidth, minHeight, maxHeight }`（只保留 > 0 的项）。
// 官方 DSL 支持这四个字段后，只需改本文件的 readConstraintSource()，其余脚本不动。
//
// CLI
//   node apply-constraints.js --dsl <dsl.snapshot.json> --constraints <constraints.json>
//        [--out <dsl.constrained.json>] [--report <report.json>] [--require]
//
// --constraints 接受两种形态（都来自常驻桥）：
//   A. { pageId, count, nodes:[{ id, minWidth, maxWidth, minHeight, maxHeight, ... }] }   ← bridge:constraints
//   B. { pageId, rootIds, nodes:[ ... 同上 ... ] }                                        ← bridge:exportPage
//
// 约定
//   - 未设置 = 0（MasterGo 插件 API 对"没设约束"返回 0，不是 null）；只有 > 0 才算设置。
//   - 配对：先按完整 id，再按复合 id 末段（实例内子层两边链长不同）；一个 DSL 节点只取一次。
//   - 只增加 node.constraints，不改动 DSL 任何原生字段。
//   - --require：没有约束来源、或来源里一条约束都没有时 fail-closed（顺序严格时用）。

const fs = require("fs");
const path = require("path");
const { fail, readJson } = require(path.join(__dirname, "..", "lib", "script-helpers.js"));

const CONSTRAINT_KEYS = ["minWidth", "maxWidth", "minHeight", "maxHeight"];

function parseArgs(argv) {
  const args = { require: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--require") {
      args.require = true;
      continue;
    }
    if (!token.startsWith("--")) fail("无法识别的参数: " + token);
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail("--" + key + " 缺少取值");
    i += 1;
    args[key] = value;
  }
  if (!args.dsl) fail("缺少 --dsl");
  if (!args.constraints) fail("缺少 --constraints");
  return args;
}

// ── 唯一的约束来源读取点（官方 DSL 支持后只改这里） ─────────────────────────────
// 现在：插件 API（常驻桥）的节点数组。
// 以后：改成从 DSL 节点自身读 minWidth / maxWidth / minHeight / maxHeight（同名字段）。
function readConstraintSource(sourcePath) {
  const file = readJson(sourcePath);
  const rows = Array.isArray(file) ? file : (file.nodes || []);
  if (!Array.isArray(rows) || rows.length === 0) {
    fail("约束来源里没有 nodes 数组: " + sourcePath);
  }
  return {
    origin: "plugin-bridge",
    sourcePath: sourcePath,
    pageId: file.pageId || null,
    rows: rows
  };
}

function normalizeConstraints(row) {
  const result = {};
  CONSTRAINT_KEYS.forEach(function (key) {
    const value = Number(row[key]);
    if (Number.isFinite(value) && value > 0) result[key] = value;
  });
  return Object.keys(result).length ? result : null;
}

function lastSegment(id) {
  return String(id).split("/").pop();
}

function walkDsl(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(function (item) { walkDsl(item, visit); });
    return;
  }
  visit(node);
  (node.children || []).forEach(function (child) { walkDsl(child, visit); });
}

function applyConstraints(options) {
  const args = options || {};
  const source = readConstraintSource(args.constraints);

  const byFullId = new Map();
  const byLastSegment = new Map();
  let constraintRowCount = 0;
  source.rows.forEach(function (row) {
    const constraints = normalizeConstraints(row);
    if (!constraints) return;
    constraintRowCount += 1;
    byFullId.set(row.id, constraints);
    const key = lastSegment(row.id);
    if (!byLastSegment.has(key)) byLastSegment.set(key, []);
    byLastSegment.get(key).push({ id: row.id, constraints: constraints });
  });

  if (args.require && constraintRowCount === 0) {
    fail("--require：约束来源里没有任何 min/max 约束（" + args.constraints + "）");
  }

  const snapshot = readJson(args.dsl);
  const roots = (snapshot.dsl && snapshot.dsl.nodes) || snapshot.nodes;
  if (!Array.isArray(roots)) fail("DSL 快照缺少 dsl.nodes: " + args.dsl);

  const report = {
    origin: source.origin,
    sourcePath: source.sourcePath,
    pageId: source.pageId,
    constraintRows: constraintRowCount,
    dslNodes: 0,
    matchedFullId: 0,
    matchedLastSegment: 0,
    unmatchedDslNodes: [],
    constrainedNodes: 0,
    usedConstraintIds: []
  };

  roots.forEach(function (root) {
    walkDsl(root, function (node) {
      if (typeof node.id !== "string" || !node.id) return;
      report.dslNodes += 1;
      let constraints = byFullId.get(node.id) || null;
      let matchedBy = constraints ? "full-id" : null;
      if (!constraints) {
        const candidates = byLastSegment.get(lastSegment(node.id)) || [];
        if (candidates.length === 1) {
          constraints = candidates[0].constraints;
          matchedBy = "last-segment";
        } else if (candidates.length > 1) {
          // 末段歧义：不猜，记进报告由门禁/人工处置。
          report.unmatchedDslNodes.push({ id: node.id, reason: "末段配对歧义（" + candidates.length + " 个候选）" });
          return;
        }
      }
      if (!constraints) return;
      if (matchedBy === "full-id") report.matchedFullId += 1;
      else report.matchedLastSegment += 1;
      node.constraints = constraints;
      report.constrainedNodes += 1;
      if (report.usedConstraintIds.length < 200) report.usedConstraintIds.push(node.id);
    });
  });

  if (args.require && report.constrainedNodes === 0) {
    fail("--require：约束来源与 DSL 节点一个都没配上（" + args.constraints + "）");
  }

  const outPath = args.out || args.dsl.replace(/\.json$/, "") + ".constrained.json";
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");

  const reportPath = args.report || outPath.replace(/\.json$/, "") + ".apply-report.json";
  report.out = outPath;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  return {
    out: outPath,
    report: reportPath,
    origin: report.origin,
    constraintRows: report.constraintRows,
    dslNodes: report.dslNodes,
    matchedFullId: report.matchedFullId,
    matchedLastSegment: report.matchedLastSegment,
    constrainedNodes: report.constrainedNodes,
    ambiguous: report.unmatchedDslNodes.length
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = applyConstraints(args);
  process.stdout.write(JSON.stringify(summary) + "\n");
}

if (require.main === module) main();

module.exports = { applyConstraints, normalizeConstraints, lastSegment, readConstraintSource, CONSTRAINT_KEYS };
