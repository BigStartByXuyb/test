"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const registry = require("../lib/run-registry.js");
const skill = path.resolve(__dirname, "../..");
const entry = path.join(skill, "scripts/run-all.ps1");

function fixture(t) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-boundary-"));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const options = { projectRoot, target: "Demo", fileId: "file-A", layerId: "root", ui: "F8", designPageName: "Demo" };
  const created = registry.createRegistry(options);
  const runDir = path.dirname(created.file);
  return { ...created, options, projectRoot, runDir };
}
function invoke(projectRoot, args, script = entry) {
  const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-File", script,
    "-ProjectRoot", projectRoot, "-Target", "Demo", ...args], {
    encoding: "utf8", timeout: 60000,
    env: { ...process.env, MASTERGO_MCP_TOKEN: "", CODEX_CONFIG: path.join(projectRoot, "no-config.toml") }
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return { ...result, text: result.stdout + result.stderr };
}

for (const projectRegistry of [undefined, "{invalid", '{"pages":[]}', '{"pages":[{"target":"Other"}]}']) {
  test("offline resume ignores mutable project registry " + String(projectRegistry), (t) => {
    const f = fixture(t);
    if (projectRegistry !== undefined) {
      fs.mkdirSync(path.join(f.projectRoot, "docs"));
      fs.writeFileSync(path.join(f.projectRoot, "docs/page-registry.json"), projectRegistry);
    }
    const result = invoke(f.projectRoot, ["-Progress", "gates", "-StopAfter", "gates"]);
    assert.notEqual(result.status, 0);
    assert.match(result.text, /缺少 Bundle 审计/);
    assert.doesNotMatch(result.text, /缺少 MasterGo (token|文件 id)/);
    assert.equal(registry.loadRegistry(f.file).identity.ui, "F8");
  });
}

for (const mode of ["unregistered", "changed", "different-path"]) {
  test("capture rejects " + mode + " bytes before conversion", (t) => {
    const f = fixture(t);
    const actual = path.join(f.runDir, "getDsl.json");
    fs.writeFileSync(actual, '{"dsl":{"nodes":[]}}');
    if (mode !== "unregistered") {
      const registered = mode === "different-path" ? path.join(f.runDir, "other.json") : actual;
      if (registered !== actual) fs.writeFileSync(registered, "trusted bytes");
      registry.recordArtifact(f.registry, "getDsl", { projectRoot: f.projectRoot, path: registered });
      registry.saveRegistry(f.file, f.registry);
      if (mode === "changed") fs.appendFileSync(actual, " ");
    }
    const result = invoke(f.projectRoot, ["-Progress", "capture", "-StopAfter", "capture"]);
    assert.notEqual(result.status, 0);
    assert.match(result.text, /没有产物|与磁盘不一致|实际消费路径不一致/);
    assert.equal(fs.existsSync(path.join(f.runDir, "dsl.snapshot.json")), false);
    assert.equal(registry.loadRegistry(f.file).steps.find((x) => x.name === "capture").status, "failed");
  });
}

test("fresh fetch rejects existing evidence before clearing run.json or asking for credentials", (t) => {
  const f = fixture(t);
  const capture = path.join(f.runDir, "getDsl.json");
  fs.writeFileSync(capture, "old capture");
  const before = fs.readFileSync(f.file);
  const result = invoke(f.projectRoot, ["-FileId", "file-A", "-LayerId", "root", "-Ui", "F8", "-StopAfter", "fetch"]);
  assert.notEqual(result.status, 0);
  assert.match(result.text, /请先归档/);
  assert.deepEqual(fs.readFileSync(f.file), before);
  assert.equal(fs.readFileSync(capture, "utf8"), "old capture");
});

test("an exit-zero producer that emits no file is not a successful stage", (t) => {
  const f = fixture(t);
  const copy = path.join(f.projectRoot, "skill");
  fs.cpSync(skill, copy, { recursive: true });
  fs.writeFileSync(path.join(copy, "scripts/call-mastergo-mcp.js"), "process.exit(0);\n");
  const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-File", path.join(copy, "scripts/run-all.ps1"),
    "-ProjectRoot", f.projectRoot, "-Target", "Demo", "-FileId", "file-A", "-LayerId", "root", "-Ui", "F8", "-StopAfter", "fetch"], {
    encoding: "utf8", timeout: 30000, env: { ...process.env, MASTERGO_MCP_TOKEN: "fake" }
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /未产出必需文件/);
  const run = registry.loadRegistry(f.file);
  assert.equal(run.artifacts.getDsl, undefined);
  assert.equal(run.steps.find((x) => x.name === "fetch").status, "failed");
});

test("all twelve stages generate and verify a page; resumed gates reject altered outputs", (t) => {
  const f = fixture(t);
  const copy = path.join(f.projectRoot, "skill");
  fs.cpSync(skill, copy, { recursive: true });
  const box = (width, height, relativeX, relativeY) => ({ width, height, relativeX, relativeY });
  const payload = {
    dsl: { styles: {}, components: [], nodes: [{ id: "root", type: "FRAME", name: "Demo",
      layoutStyle: box(1280, 1024, 0, 0), children: [
        { id: "root/title", type: "TEXT", name: "title", layoutStyle: box(80, 22, 20, 210), text: [{ text: "标题" }] },
        { id: "root/bar", type: "FRAME", name: "底部button", layoutStyle: box(1280, 202, 0, 822), children: [
          { id: "root/resident", type: "INSTANCE", name: "右侧底部-常驻button", layoutStyle: box(200, 202, 1000, 0), children: [] }
        ] }
      ] }] }, componentDocumentLinks: [], rules: []
  };
  // Only acquisition is stubbed. Capture, mapping, Bundle, language, Layout and all validators are real.
  fs.writeFileSync(path.join(copy, "scripts/call-mastergo-mcp.js"), `
const fs = require("node:fs");
const path = require("node:path");
const get = (key) => process.argv[process.argv.indexOf(key) + 1];
const out = get("--out");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(get("--tool") === "getDsl" ? ${JSON.stringify(payload)} :
  { totalCount: 0, count: 0, page: 0, hasMore: false, svgs: [] }));
`);
  fs.writeFileSync(path.join(f.projectRoot, "Demo.csproj"), '<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><RootNamespace>Demo</RootNamespace></PropertyGroup></Project>');
  fs.mkdirSync(path.join(f.projectRoot, "Generated/_inputs"), { recursive: true });
  fs.writeFileSync(path.join(f.projectRoot, "Generated/_inputs/Demo.lang-translations.json"), JSON.stringify({ "标题": "Title", Demo: "Demo" }));
  const first = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-File", path.join(copy, "scripts/run-all.ps1"),
    "-ProjectRoot", f.projectRoot, "-Target", "Demo", "-FileId", "file-A", "-LayerId", "root", "-Ui", "F8", "-AllowEmptyLedger"], {
    encoding: "utf8", timeout: 60000, env: { ...process.env, MASTERGO_MCP_TOKEN: "fake" }
  });
  assert.ifError(first.error);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const run = registry.loadRegistry(f.file);
  assert.equal(run.steps.length, 12);
  assert.ok(run.steps.every((step) => step.status === "ok"));
  const xml = path.join(f.projectRoot, "Resources/Pages/Demo/DemoPage.xml");
  assert.match(fs.readFileSync(xml, "utf8"), /标题/);
  const resumed = invoke(f.projectRoot, ["-Progress", "gates"], path.join(copy, "scripts/run-all.ps1"));
  assert.equal(resumed.status, 0, resumed.text);
  const audit = path.join(f.projectRoot, "Generated/Demo.mapping.json");
  fs.appendFileSync(audit, " ");
  const rejected = invoke(f.projectRoot, ["-Progress", "gates", "-StopAfter", "gates"], path.join(copy, "scripts/run-all.ps1"));
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.text, /输出与本次登记不一致/);
});
