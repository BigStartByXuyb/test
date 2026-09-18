#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "discover-mtslg-page-icon-map.js");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-icon-discovery-"));
const svgFile = path.join(dir, "extractSvg.json");
const mappingFile = path.join(dir, "mapping.json");
const confirmedFile = path.join(dir, "confirmed.json");
const outFile = path.join(dir, "page-icon-map.json");

fs.writeFileSync(svgFile, JSON.stringify({ svgs: [
  { id: "shell/top", name: "顶部状态栏", svg: "<svg><path d=\"M0,0 L1,1\"/></svg>" },
  { id: "page/known", name: "向上", svg: "<svg><path d=\"M1,1 L2,2\"/></svg>" }
] }), "utf8");
fs.writeFileSync(mappingFile, JSON.stringify({ sourceNodes: [
  { ref: "shell/top/path", type: "PATH", name: "路径", svgName: "顶部状态栏" },
  { ref: "page/known/path", type: "PATH", name: "多边形", svgName: "向上" }
] }), "utf8");
fs.writeFileSync(confirmedFile, JSON.stringify({ icons: [
  { sourceId: "page/known", name: "UpGeometry", comment: "向上", sourceRef: "page/known/path" }
] }), "utf8");

const result = spawnSync(process.execPath, [script, "--svg", svgFile, "--mapping", mappingFile, "--confirmed", confirmedFile, "--out", outFile], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
const output = JSON.parse(fs.readFileSync(outFile, "utf8"));
assert.deepStrictEqual(output.icons, JSON.parse(fs.readFileSync(confirmedFile, "utf8")).icons);
assert.strictEqual(output.candidates.length, 2);
const shell = output.candidates.find((candidate) => candidate.sourceId === "shell/top");
assert.ok(shell);
assert.strictEqual(shell.status, "unmapped");
assert.strictEqual(shell.reason, "missing-page-resource-name");
assert.strictEqual(shell.sourceRef, "shell/top/path");
assert.ok(!Object.prototype.hasOwnProperty.call(shell, "sectionIndex"));
assert.ok(!Object.prototype.hasOwnProperty.call(shell, "name"));
const known = output.candidates.find((candidate) => candidate.sourceId === "page/known");
assert.strictEqual(known.status, "confirmed");

// ---- 树判据回归：图标组 id 不是其子 PATH id 的字符串前缀时（部分设计稿里同一实例内的
//      节点 id 只共享外层实例前缀），候选仍必须归属到该图标组条目。
//      旧口径（纯 id 前缀）下这条候选会被误报成 no-exact-extractSvgEntry。----
const treeSvgFile = path.join(dir, "extractSvg.tree.json");
const treeMappingFile = path.join(dir, "mapping.tree.json");
const treeOutFile = path.join(dir, "page-icon-map.tree.json");
fs.writeFileSync(treeSvgFile, JSON.stringify({ svgs: [
  { id: "tree/root/icon-group", name: "图标组", svg: "<svg><path d=\"M0,0 L1,1\"/></svg>" }
] }), "utf8");
fs.writeFileSync(treeMappingFile, JSON.stringify({ sourceNodes: [
  { ref: "tree/root", type: "INSTANCE", name: "按钮", parentRef: null },
  { ref: "tree/root/icon-group", type: "GROUP", name: "图标组", parentRef: "tree/root" },
  // PATH 的父节点是图标组（树包含成立），但 id 不是「图标组 id + /」开头（id 前缀不成立）
  { ref: "tree/root/1066:329573", type: "PATH", name: "路径 203", svgName: "向上", parentRef: "tree/root/icon-group" }
] }), "utf8");
const treeResult = spawnSync(process.execPath,
  [script, "--svg", treeSvgFile, "--mapping", treeMappingFile, "--out", treeOutFile],
  { encoding: "utf8" });
assert.strictEqual(treeResult.status, 0, treeResult.stderr);
const treeOutput = JSON.parse(fs.readFileSync(treeOutFile, "utf8"));
assert.strictEqual(treeOutput.candidates.length, 1);
const treeCandidate = treeOutput.candidates[0];
assert.strictEqual(treeCandidate.sourceId, "tree/root/icon-group",
  "id 前缀断裂时，必须按 DSL 树归属匹配到图标组条目");
assert.strictEqual(treeCandidate.reason, "missing-page-resource-name",
  "命中条目但未起名 → missing-page-resource-name（而不是 no-exact-extractSvgEntry）");

console.log("PASS page icon discovery regression test");
