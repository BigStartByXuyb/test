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

console.log("PASS page icon discovery regression test");
