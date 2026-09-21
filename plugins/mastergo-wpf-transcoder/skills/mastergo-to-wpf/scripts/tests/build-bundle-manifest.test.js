#!/usr/bin/env node
"use strict";

// Bundle 清单生成器回归：采集输入只从运行登记表取（并写 digests 供 Bundle 复校），
// 缺 --run-json 直接失败；未登记的旧同名文件一律拒绝。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "build-bundle-manifest.mjs");
const registryCli = path.join(__dirname, "..", "run-registry.mjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-bundle-manifest-"));
const write = (relative, data) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
  return file;
};
const run = (args) => spawnSync(process.execPath, [script].concat(args), { encoding: "utf8" });
const runRegistry = (args) => spawnSync(process.execPath, [registryCli].concat(args), { encoding: "utf8" });

// 目标项目最小结构：一个 .csproj（页面名/区域由它和 Layout 清单推导）
write("Demo.Pages.csproj", "<Project xmlns=\"http://schemas.microsoft.com/developer/msbuild/2003\"></Project>");
const layoutManifest = write("Generated/_inputs/F2Demo.layout-manifest.json", {
  pageTarget: "F2Demo",
  pageLangName: "F2DemoPageTitle",
  layoutPath: "Resources/Layout/Layout.xml",
  layoutStatus: "none",
  layoutEvidence: { matchedBottomBarItems: 0, unresolvedBottomBarItems: 0, residentGroupItems: 0 },
  menuItems: []
});

const runDir = "Generated/runs/F2Demo";
write(runDir + "/dsl.snapshot.json", { dsl: { nodes: [] }, nodeCount: 3 });
write(runDir + "/visibility.json", { nodes: [] });
write(runDir + "/extractSvg.json", { svgs: [] });

// 1) 先建登记表并登记三个采集产物
let result = runRegistry(["init", "--project-root", root, "--target", "F2Demo",
  "--file-id", "1", "--layer-id", "2:3", "--ui", "F2", "--page-title", "演示页"]);
assert.strictEqual(result.status, 0, result.stderr);
const registryFile = path.join(root, runDir, "run.json");
for (const [key, file, step] of [
  ["snapshot", runDir + "/dsl.snapshot.json", 2],
  ["visibility", runDir + "/visibility.json", 4],
  ["extractSvg", runDir + "/extractSvg.json", 3]
]) {
  assert.strictEqual(runRegistry(["artifact", "--run", registryFile, "--key", key, "--path", file, "--step", String(step)]).status, 0);
}
const registered = JSON.parse(fs.readFileSync(registryFile, "utf8"));

// 2) 给 --run-json：三个采集输入必须来自登记表，并带 digests + pageTitleText
const bundleJson = path.join(root, "Generated/_inputs/F2Demo.bundle.json");
result = run([layoutManifest, bundleJson, root, "F2", "--run-json", registryFile, "--replace-existing"]);
assert.strictEqual(result.status, 0, result.stderr);
const manifest = JSON.parse(fs.readFileSync(bundleJson, "utf8"));
assert.strictEqual(manifest.name, "F2Demo");
assert.strictEqual(manifest.dslPath, runDir + "/dsl.snapshot.json");
assert.strictEqual(manifest.visibilityPath, runDir + "/visibility.json");
assert.strictEqual(manifest.svgPath, runDir + "/extractSvg.json");
assert.strictEqual(manifest.pageTitleText, "演示页", "页面标题必须来自登记表/命令行，不能退回设计原文");
assert.ok(manifest.runRegistry && manifest.runRegistry.runId === registered.runId, "清单必须带上运行身份（runId）");
assert.strictEqual(manifest.runRegistry.digests.snapshot, registered.artifacts.snapshot.sha256);
assert.strictEqual(manifest.runRegistry.digests.extractSvg, registered.artifacts.extractSvg.sha256);
assert.strictEqual(manifest.operation, "replace-existing");

// 3) 采集产物未登记（缺 snapshot）→ 必须失败，并指出是登记表缺项
const missingRun = JSON.parse(fs.readFileSync(registryFile, "utf8"));
delete missingRun.artifacts.snapshot;
const missingRunFile = write(runDir + "/run.missing.json", missingRun);
result = run([layoutManifest, path.join(root, "Generated/_inputs/F2Demo.missing.json"), root, "F2",
  "--run-json", missingRunFile]);
assert.notStrictEqual(result.status, 0, "登记表缺少 snapshot 时必须失败");
assert.match(result.stderr, /登记表里没有产物 "snapshot"/);

// 4) 旧同名影子文件（内容不同）→ 必须失败，不允许静默用旧数据
write("Generated/dsl.snapshot.json", { dsl: { nodes: [] }, nodeCount: 999 });
result = run([layoutManifest, path.join(root, "Generated/_inputs/F2Demo.shadow.json"), root, "F2",
  "--run-json", registryFile]);
assert.notStrictEqual(result.status, 0, "存在未登记的旧同名文件时必须失败");
assert.match(result.stderr, /未登记的旧同名文件/);
fs.rmSync(path.join(root, "Generated/dsl.snapshot.json"));

// 5) 不给 --run-json：采集输入没有来源，必须失败（不再回落顶层 Generated/*.json）
result = run([layoutManifest, path.join(root, "Generated/_inputs/F2Demo.legacy.json"), root, "F2"]);
assert.notStrictEqual(result.status, 0, "缺少 --run-json 时必须失败（禁止回落顶层旧路径）");
assert.match(result.stderr, /缺少 --run-json/);
assert.ok(!fs.existsSync(path.join(root, "Generated/_inputs/F2Demo.legacy.json")), "失败时不得写出清单");

// 6) area 缺失必须报错，且不能被带值开关的取值顶掉（`… <projectRoot> --run-json X` 不能把 X 当 area）
result = run([layoutManifest, path.join(root, "Generated/_inputs/F2Demo.no-area.json"), root]);
assert.notStrictEqual(result.status, 0, "缺少 area 必须失败");
assert.match(result.stderr, /缺少区域前缀 area/);
result = run([layoutManifest, path.join(root, "Generated/_inputs/F2Demo.no-area2.json"), root,
  "--run-json", registryFile]);
assert.notStrictEqual(result.status, 0, "带值开关的存在不能绕过 area 必填门禁");
assert.match(result.stderr, /缺少区域前缀 area/);

console.log("PASS MasterGo bundle manifest (run registry binding) regression test");

for (const [field, value] of [["target", "AnotherPage"], ["ui", "AnotherArea"], ["projectRoot", path.join(root, "other")]]) {
  const conflicting = JSON.parse(fs.readFileSync(registryFile, "utf8"));
  if (field === "ui") conflicting.identity.ui = value;
  else conflicting[field] = value;
  const conflictFile = write(runDir + "/conflict-" + field + ".json", conflicting);
  const output = path.join(root, "rejected-" + field + ".json");
  const rejected = run([layoutManifest, output, root, "F2", "--run-json", conflictFile]);
  assert.notStrictEqual(rejected.status, 0);
  assert.match(rejected.stderr, /与本次/);
  assert.strictEqual(fs.existsSync(output), false);
}
