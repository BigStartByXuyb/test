#!/usr/bin/env node
"use strict";

// 运行登记表回归：init / artifact / path / check / step / outputs / legacy shadow。
// 背景：采集产物改成"按页归档"（Generated/runs/<Target>/）后，消费端仍在拼顶层 Generated/*.json，
// 而顶层恰好留着上一次运行的同名旧文件——存在性检查通过，于是静默用了旧数据。
// 登记表的职责就是：产出即登记（path + sha256），消费只按登记取，未登记的旧同名文件一律拒绝。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const cli = path.join(__dirname, "..", "core", "run-registry.mjs");
const registry = require(path.join(__dirname, "..", "lib", "run-registry.js"));

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-run-registry-"));
const write = (relative, data) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
  return file;
};
const runCli = (args) => spawnSync(process.execPath, [cli].concat(args), { encoding: "utf8" });

const runDir = "Generated/runs/Demo";
write(runDir + "/dsl.snapshot.json", { dsl: { nodes: [] }, nodeCount: 1 });
write(runDir + "/visibility.json", { nodes: [] });
write(runDir + "/extractSvg.json", { svgs: [] });
write("Generated/_inputs/Demo.lang-translations.json", { "标题": "Title" });

// 1) init：写入身份、页面标题与输入指纹；默认落在 Generated/runs/<Target>/run.json
let result = runCli(["init", "--project-root", root, "--target", "Demo", "--file-id", "123",
  "--layer-id", "4:4", "--ui", "F2", "--design-page", "示例（1.2）", "--page-title", "示例",
  "--translations", "Generated/_inputs/Demo.lang-translations.json"]);
assert.strictEqual(result.status, 0, result.stderr);
const registryFile = path.join(root, runDir, "run.json");
assert.ok(fs.existsSync(registryFile), "init 必须创建 Generated/runs/<Target>/run.json");
let run = JSON.parse(fs.readFileSync(registryFile, "utf8"));
assert.strictEqual(run.target, "Demo");
assert.strictEqual(run.identity.layerId, "4:4");
assert.strictEqual(run.identity.designPageName, "示例（1.2）");
assert.strictEqual(run.inputs.pageTitleText, "示例");
assert.ok(run.inputs.translations && run.inputs.translations.sha256, "译文清单必须登记指纹");

// 2) artifact：逐个登记产出（每条带 sha256 / size / 所属步骤）
for (const [key, file, step] of [
  ["snapshot", runDir + "/dsl.snapshot.json", 2],
  ["visibility", runDir + "/visibility.json", 4],
  ["extractSvg", runDir + "/extractSvg.json", 3]
]) {
  result = runCli(["artifact", "--run", registryFile, "--key", key, "--path", file, "--step", String(step)]);
  assert.strictEqual(result.status, 0, result.stderr);
}
run = JSON.parse(fs.readFileSync(registryFile, "utf8"));
assert.strictEqual(Object.keys(run.artifacts).length, 3);
assert.strictEqual(run.artifacts.snapshot.step, 2);
assert.match(run.artifacts.snapshot.sha256, /^[0-9a-f]{64}$/);
assert.strictEqual(run.artifacts.snapshot.path, runDir + "/dsl.snapshot.json");

// 3) path：按登记表取路径（绝对路径）
result = runCli(["path", "--run", registryFile, "--key", "snapshot"]);
assert.strictEqual(result.status, 0, result.stderr);
assert.strictEqual(result.stdout.trim(), path.join(root, runDir, "dsl.snapshot.json"));

// 4) 内容被改写 → check 必须失败（登记 sha256 与磁盘不一致）
fs.appendFileSync(path.join(root, runDir, "visibility.json"), "\n", "utf8");
result = runCli(["check", "--run", registryFile]);
assert.notStrictEqual(result.status, 0, "登记后内容变化必须让 check 失败");
assert.match(result.stderr, /与磁盘不一致/);
write(runDir + "/visibility.json", { nodes: [] });          // 恢复内容
runCli(["artifact", "--run", registryFile, "--key", "visibility", "--path", runDir + "/visibility.json", "--step", "4"]);
assert.strictEqual(runCli(["check", "--run", registryFile]).status, 0);

// 5) 未登记的旧同名文件（legacy shadow）：内容不同 → 直接失败，不允许静默回落
write("Generated/dsl.snapshot.json", { dsl: { nodes: [] }, nodeCount: 999 });
result = runCli(["path", "--run", registryFile, "--key", "snapshot"]);
assert.notStrictEqual(result.status, 0, "旧同名文件与本次登记不同时必须失败");
assert.match(result.stderr, /未登记的旧同名文件/);

// 6) 旧同名文件内容一致 → 允许通过（但提示可清理）
fs.copyFileSync(path.join(root, runDir, "dsl.snapshot.json"), path.join(root, "Generated/dsl.snapshot.json"));
result = runCli(["path", "--run", registryFile, "--key", "snapshot"]);
assert.strictEqual(result.status, 0, result.stderr);

// 7) step / outputs / show
assert.strictEqual(runCli(["step", "--run", registryFile, "--id", "2", "--name", "capture", "--status", "ok", "--seconds", "1.2"]).status, 0);
assert.strictEqual(runCli(["step", "--run", registryFile, "--id", "3", "--name", "svg", "--status", "failed", "--note", "模拟失败"]).status, 0);
write("Generated/Demo.bundle.manifest.json", {
  files: [
    { path: "Resources/Pages/Demo/DemoPage.xml", kind: "project" },
    { path: "Generated/Demo.mapping.json", kind: "audit" }
  ]
});
write("Resources/Pages/Demo/DemoPage.xml", "<IOContorl ID=\"\" />");
write("Generated/Demo.mapping.json", { nodes: [] });
result = runCli(["outputs", "--run", registryFile, "--manifest", "Generated/Demo.bundle.manifest.json"]);
assert.strictEqual(result.status, 0, result.stderr);
run = JSON.parse(fs.readFileSync(registryFile, "utf8"));
assert.strictEqual(run.steps.length, 2);
assert.strictEqual(run.steps[1].status, "failed");
assert.strictEqual(Object.keys(run.outputs).length, 2);
assert.strictEqual(run.outputs["Resources/Pages/Demo/DemoPage.xml"].kind, "project");
assert.match(run.outputs["Resources/Pages/Demo/DemoPage.xml"].sha256, /^[0-9a-f]{64}$/);

// 8) keep 模式（断点续跑）保留 runId 与已登记产物；非 keep 会新开一次运行
const runIdBefore = run.runId;
runCli(["init", "--project-root", root, "--target", "Demo", "--keep"]);
assert.strictEqual(JSON.parse(fs.readFileSync(registryFile, "utf8")).runId, runIdBefore, "--keep 必须沿用 runId");
runCli(["init", "--project-root", root, "--target", "Demo"]);
const fresh = JSON.parse(fs.readFileSync(registryFile, "utf8"));
assert.notStrictEqual(fresh.runId, runIdBefore, "非 keep 必须新开一次运行");
assert.strictEqual(Object.keys(fresh.artifacts).length, 0, "新运行不得继承上一次的产物登记");

// 9) 库层：未知产物键与未登记键的报错要明确
assert.throws(() => registry.recordArtifact({ artifacts: {} }, "notAKey", { projectRoot: root, path: runDir + "/dsl.snapshot.json" }),
  /未知产物键/);
assert.throws(() => registry.resolveArtifact({ artifacts: {} }, "snapshot", { projectRoot: root }),
  /登记表里没有产物 "snapshot"/);

console.log("PASS MasterGo run registry regression test");
