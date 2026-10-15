#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { tmpDir } = require(path.join(__dirname, "helpers", "tmp-dir.js"));
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const registry = require("../lib/run-registry.js");
const cli = path.join(__dirname, "..", "core", "run-registry.mjs");

function registeredRun(overrides = {}) {
  const projectRoot = tmpDir("mastergo-integrity-");
  const options = {
    projectRoot, target: "Demo", fileId: "file-A", layerId: "layer-A",
    ui: "F2", designPageName: "设计页 A", ...overrides
  };
  const created = registry.createRegistry(options);
  const capture = path.join(projectRoot, "capture.json");
  fs.writeFileSync(capture, JSON.stringify({ design: "page-A" }));
  registry.recordArtifact(created.registry, "getDsl", { projectRoot, path: capture });
  registry.saveRegistry(created.file, created.registry);
  return { ...created, options, capture };
}

function registryCommand(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

for (const [field, changed] of [
  ["fileId", "file-B"], ["layerId", "layer-B"], ["ui", "F3"],
  ["designPageName", "设计页 B"], ["target", "AnotherPage"]
]) {
  test("resume rejects changed " + field + " without rewriting the registry", () => {
    const run = registeredRun();
    const before = fs.readFileSync(run.file);
    assert.throws(() => registry.createRegistry({
      ...run.options, keep: true, out: run.file, [field]: changed
    }), new RegExp(field));
    assert.deepEqual(fs.readFileSync(run.file), before);
    assert.equal(registry.resolveArtifact(registry.loadRegistry(run.file), "getDsl", run.options), run.capture);
  });
}

test("resume cannot assign a source identity to already registered anonymous bytes", () => {
  const run = registeredRun({ fileId: null });
  const before = fs.readFileSync(run.file);
  assert.throws(() => registry.createRegistry({ ...run.options, keep: true, fileId: "file-B" }), /fileId/);
  assert.deepEqual(fs.readFileSync(run.file), before);
});

test("resume rejects a different project root even with an explicit registry path", () => {
  const run = registeredRun();
  const before = fs.readFileSync(run.file);
  assert.throws(() => registry.createRegistry({
    ...run.options, keep: true, out: run.file, projectRoot: path.join(run.options.projectRoot, "another")
  }), /projectRoot/);
  assert.deepEqual(fs.readFileSync(run.file), before);
});

test("resume preserves identity and artifacts while allowing semantic input updates", () => {
  const run = registeredRun();
  const resumed = registry.createRegistry({
    projectRoot: path.join(run.options.projectRoot, "."), target: "Demo", keep: true,
    pageTitleText: "新标题", translations: { path: "translations.json", sha256: "new-input" }
  });
  assert.equal(resumed.registry.runId, run.registry.runId);
  assert.deepEqual(resumed.registry.identity, run.registry.identity);
  assert.deepEqual(resumed.registry.artifacts, run.registry.artifacts);
  assert.equal(resumed.registry.inputs.pageTitleText, "新标题");
  assert.equal(resumed.registry.inputs.translations.sha256, "new-input");
  assert.doesNotThrow(() => registry.createRegistry({ ...run.options, keep: true }));
});

for (const corrupt of [null, [], { schemaVersion: "unsupported" }]) {
  test("resume rejects invalid registry " + JSON.stringify(corrupt), () => {
    const run = registeredRun();
    fs.writeFileSync(run.file, JSON.stringify(corrupt));
    const before = fs.readFileSync(run.file);
    assert.throws(() => registry.createRegistry({ ...run.options, keep: true }), /schemaVersion/);
    assert.deepEqual(fs.readFileSync(run.file), before);
  });
}

test("resume requires an existing registry; fresh init can intentionally change source", () => {
  const run = registeredRun();
  const fresh = registry.createRegistry({ ...run.options, fileId: "file-B" });
  assert.notEqual(fresh.registry.runId, run.registry.runId);
  assert.deepEqual(fresh.registry.artifacts, {});
  fs.unlinkSync(run.file);
  assert.throws(() => registry.createRegistry({ ...run.options, keep: true }), /登记表不存在/);
  assert.equal(fs.existsSync(run.file), false);
});

for (const args of [["--key", "snapshot"], ["--key", "snapshop"], ["--key"], ["--key", ""]]) {
  test("explicit artifact check fails closed: " + JSON.stringify(args), () => {
    const run = registeredRun();
    const result = registryCommand(["check", "--run", run.file, ...args]);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /snapshot|snapshop|--key/);
  });
}

test("implicit checks allow partial runs; explicit checks still verify hashes", () => {
  const run = registeredRun();
  assert.equal(registryCommand(["check", "--run", run.file]).status, 0);
  assert.equal(registryCommand(["check", "--run", run.file, "--key", "getDsl"]).status, 0);
  fs.appendFileSync(run.capture, "\n");
  const changed = registryCommand(["check", "--run", run.file, "--key", "getDsl", "--quiet"]);
  assert.notEqual(changed.status, 0);
  assert.match(changed.stderr, /与磁盘不一致/);
});

test("CLI resume uses the same immutable identity guard", () => {
  const run = registeredRun();
  const before = fs.readFileSync(run.file);
  const result = registryCommand([
    "init", "--project-root", run.options.projectRoot, "--target", "Demo",
    "--file-id", "file-B", "--keep"
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fileId/);
  assert.deepEqual(fs.readFileSync(run.file), before);
});
