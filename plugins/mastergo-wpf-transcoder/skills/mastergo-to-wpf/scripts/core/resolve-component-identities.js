#!/usr/bin/env node
"use strict";

// 实例身份反查（唯一实现）：`componentId` → 组件定义（定义名 / 类型 / 子层数）。
//
// 为什么需要它：判定组件类型要用「组件身份」当键。DSL 里实例只带 `componentId`，
// 组件定义名不在 getDsl 响应里（`dsl.components` 为空、`componentInfo` 只放实例上的属性覆盖值）。
// 过去的做法是"拿实例直接子层里第一个 INSTANCE 的名字当组件名"——那是猜结构，
// 换个稿子就失效（实例 → GROUP → INSTANCE 时不成立）。这里改成问权威来源。
//
// 用法:
//   node resolve-component-identities.js --dsl <dsl.snapshot.json> --file-id <fileId> --out <components.json>
//        [--cache <缓存文件>] [--limit <最多解析多少个>] [--token <mg_xxx>]
//
// 产出:
//   { schemaVersion, fileId, resolved: { "<componentId>": {name,type,layerCount,source} }, unresolved: [...], stats }
//   - resolved：本次运行里出现的每个 componentId 的组件定义名（缓存命中标 source=cache，否则 source=mcp）
//   - unresolved：反查失败或没有组件定义的实例 ref（进待确认，不猜）

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { fail, readJson } = require(path.join(__dirname, "..", "lib", "script-helpers.js"));

const MCP_CALL = path.join(__dirname, "call-mastergo-mcp.js");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dsl") args.dslPath = argv[++i];
    else if (token === "--file-id") args.fileId = argv[++i];
    else if (token === "--out") args.outPath = argv[++i];
    else if (token === "--cache") args.cachePath = argv[++i];
    else if (token === "--limit") args.limit = Number(argv[++i]);
    else if (token === "--token") args.token = argv[++i];
    else fail("未知参数: " + token);
  }
  ["dslPath", "fileId", "outPath"].forEach(function (key) {
    if (!args[key]) fail("缺少参数: " + key);
  });
  return args;
}

// 收集实例：componentId → 该 id 下出现的实例 ref（同一 id 只解析一次）
function collectComponentIds(dslSnapshot) {
  const byId = new Map();
  const withoutId = [];
  const walk = function (node) {
    if (node.type === "INSTANCE") {
      const id = typeof node.componentId === "string" ? node.componentId.trim() : "";
      if (id) {
        if (!byId.has(id)) byId.set(id, []);
        byId.get(id).push(node.id);
      }
      else withoutId.push(node.id);
    }
    (node.children || []).forEach(walk);
  };
  (dslSnapshot.dsl.nodes || []).forEach(walk);
  return { byId, withoutId };
}

function readCache(cachePath) {
  if (!cachePath || !fs.existsSync(cachePath)) return {};
  try {
    const doc = readJson(cachePath, "身份缓存");
    return (doc && doc.resolved) || {};
  }
  catch (error) { return {}; }
}

function resolveOne(componentId, fileId, token) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mg-component-"));
  const outFile = path.join(tempDir, "layer.json");
  try {
    const args = [MCP_CALL, "--tool", "getPageLayers", "--fileId", fileId, "--layerId", componentId, "--out", outFile];
    if (token) args.push("--token", token);
    const result = spawnSync(process.execPath, args, { encoding: "utf8", stdio: "pipe", maxBuffer: 16 * 1024 * 1024 });
    if (result.status !== 0 || !fs.existsSync(outFile)) return null;
    const doc = readJson(outFile, "组件定义");
    const name = typeof doc.pageName === "string" ? doc.pageName.trim() : "";
    if (!name) return null;
    return { name: name, type: doc.pageType || null, layerCount: Number(doc.totalLayers || 0) };
  }
  catch (error) { return null; }
  finally { fs.rmSync(tempDir, { recursive: true, force: true }); }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dslSnapshot = readJson(args.dslPath, "DSL 快照");
  const collected = collectComponentIds(dslSnapshot);
  const cache = readCache(args.cachePath);
  const resolved = {};
  const unresolved = [];
  let fromMcp = 0;
  let fromCache = 0;
  let calls = 0;

  const ids = [...collected.byId.keys()];
  for (const componentId of ids) {
    const cached = cache[componentId];
    if (cached && cached.name) {
      resolved[componentId] = Object.assign({}, cached, { source: "cache" });
      fromCache += 1;
      continue;
    }
    if (typeof args.limit === "number" && args.limit > 0 && calls >= args.limit) {
      unresolved.push({ componentId: componentId, refs: collected.byId.get(componentId), reason: "超过本次解析上限（--limit）" });
      continue;
    }
    calls += 1;
    const info = resolveOne(componentId, args.fileId, args.token);
    if (info) {
      resolved[componentId] = Object.assign({}, info, { source: "mcp" });
      fromMcp += 1;
    }
    else {
      unresolved.push({ componentId: componentId, refs: collected.byId.get(componentId), reason: "组件定义反查失败（无权限/已删除/非组件图层）" });
    }
  }
  collected.withoutId.forEach(function (ref) {
    unresolved.push({ componentId: null, refs: [ref], reason: "实例没有 componentId，无法反查组件身份" });
  });

  const document = {
    schemaVersion: "mastergo-component-identities/1",
    fileId: args.fileId,
    resolved: resolved,
    unresolved: unresolved,
    stats: {
      componentIds: ids.length,
      resolvedFromMcp: fromMcp,
      resolvedFromCache: fromCache,
      unresolved: unresolved.length,
      mcpCalls: calls
    }
  };
  fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
  fs.writeFileSync(args.outPath, JSON.stringify(document, null, 2) + "\n", "utf8");
  if (args.cachePath) {
    fs.mkdirSync(path.dirname(args.cachePath), { recursive: true });
    fs.writeFileSync(args.cachePath, JSON.stringify({ schemaVersion: document.schemaVersion, fileId: args.fileId, resolved: resolved }, null, 2) + "\n", "utf8");
  }
  console.log(JSON.stringify({
    out: args.outPath,
    componentIds: ids.length,
    fromMcp: fromMcp,
    fromCache: fromCache,
    unresolved: unresolved.length
  }, null, 2));
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { collectComponentIds };
