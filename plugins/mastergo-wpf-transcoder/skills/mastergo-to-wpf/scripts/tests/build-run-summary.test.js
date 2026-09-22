#!/usr/bin/env node
"use strict";

// 本页现状摘要回归：摘要必须"只按登记取数 + 复校 sha256"，这是它替代手写探针的前提。
// 三条纪律各有一个反例用例，缺一条就等于把"看着像本次、其实掺旧数据"重新放回来。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const scripts = path.join(__dirname, "..");
const registryCli = path.join(scripts, "run-registry.mjs");
const summaryCli = path.join(scripts, "build-run-summary.mjs");

const runNode = (cli, args) => spawnSync(process.execPath, [cli].concat(args), { encoding: "utf8" });

function newProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-run-summary-"));
  const write = (relative, data) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
    return file;
  };

  // 一份最小但字段齐全的产物集（形状与真实流水线一致）。
  write("Generated/runs/Demo/dsl.snapshot.json", { nodes: [] });
  write("Generated/runs/Demo/coverage-report.json", { capturedNodeCount: 12 });
  write("Generated/runs/Demo/extractSvg.json", { count: 3, svgs: [{ id: "a" }, { id: "b" }, { id: "c" }] });
  write("Generated/runs/Demo/visibility.json", { nodes: [] });
  write("Generated/_work/Demo.mapping.draft.json", {
    sourceNodes: [{ ref: "1" }, { ref: "2" }],
    nodes: [{ controlType: "TextBlock" }, { controlType: "IconButton" }],
    componentInstances: [{}, {}, {}],
    textAudit: [{}],
    pending: [],
    unmappedComponents: []
  });
  write("Generated/_inputs/Demo.icon-candidates.json", {
    candidates: [{ sourceId: "s1", sourceRef: "r1", status: "confirmed" }, { sourceId: "s2", sourceRef: "r2", status: "unmapped", reason: "missing-page-resource-name" }],
    unmapped: [{ sourceId: "s2", sourceRef: "r2", status: "unmapped", reason: "missing-page-resource-name" }]
  });
  write("Generated/_inputs/Demo.icon-map.json", { icons: [{ sourceId: "s1", name: "X" }] });
  write("Generated/_inputs/Demo.layout-manifest.json", { layoutStatus: "complete", menuItems: [{}], layoutEvidence: { unresolvedBottomBarItems: 0 } });
  write("Generated/_inputs/Demo.bundle.json", { nesting: { enabled: true } });
  write("Generated/Demo.nesting-report.json", { containers: [{}], reparented: [{}], skipped: [], conflicts: [] });
  // 产物层：页面 XML 的 ControlType 是属性（元素名统一是 IOContorl），图标字典按 x:Key 计数。
  write("Resources/Pages/Demo/DemoPage.xml", [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<IOContorl ID="" Left="NaN" Top="NaN" Width="NaN" Height="NaN">',
    '  <IOContorl ID="a" ControlType="TextBlock" Value="镜头倍率" />',
    '  <IOContorl ID="b" ControlType="IconButton" Icon="PageOnlyGeometry" />',
    '</IOContorl>'
  ].join("\n"));
  write("Resources/Pages/Demo/DemoIcons.xaml", '<ResourceDictionary><Geometry x:Key="PageOnlyGeometry" /></ResourceDictionary>');

  const init = runNode(registryCli, [
    "init", "--project-root", root, "--target", "Demo",
    "--file-id", "123", "--layer-id", "4:4", "--ui", "F2", "--design-page", "示例（1.2）"
  ]);
  assert.strictEqual(init.status, 0, init.stderr);

  const artifacts = [
    ["snapshot", "Generated/runs/Demo/dsl.snapshot.json"],
    ["coverage", "Generated/runs/Demo/coverage-report.json"],
    ["extractSvg", "Generated/runs/Demo/extractSvg.json"],
    ["visibility", "Generated/runs/Demo/visibility.json"],
    ["mappingDraft", "Generated/_work/Demo.mapping.draft.json"],
    ["iconCandidates", "Generated/_inputs/Demo.icon-candidates.json"],
    ["iconMap", "Generated/_inputs/Demo.icon-map.json"],
    ["layoutManifest", "Generated/_inputs/Demo.layout-manifest.json"],
    ["bundleManifest", "Generated/_inputs/Demo.bundle.json"]
  ];
  const runFile = path.join(root, "Generated", "runs", "Demo", "run.json");
  for (const [key, rel] of artifacts) {
    const out = runNode(registryCli, ["artifact", "--run", runFile, "--key", key, "--path", rel, "--step", "1", "--project-root", root]);
    assert.strictEqual(out.status, 0, key + ": " + out.stderr);
  }

  // 页面局部产出走 outputs（由 bundle 步的审计 files[] 登记），摘要只能按它取数。
  write("Generated/Demo.bundle.manifest.json", {
    files: [
      { path: "Generated/Demo.nesting-report.json", kind: "project" },
      { path: "Generated/Demo.mapping.json", kind: "project" },
      { path: "Resources/Pages/Demo/DemoPage.xml", kind: "project" },
      { path: "Resources/Pages/Demo/DemoIcons.xaml", kind: "project" }
    ]
  });
  const outputs = runNode(registryCli, ["outputs", "--run", runFile, "--manifest", "Generated/Demo.bundle.manifest.json", "--project-root", root]);
  assert.strictEqual(outputs.status, 0, outputs.stderr);
  return { root, write, runFile };
}

const summarize = (root, extra = []) => runNode(summaryCli, ["--project-root", root, "--target", "Demo"].concat(extra));

// 1) 正常路径：字段从登记条目投影；摘要是派生视图，绝不写回登记表。
{
  const { root, runFile } = newProject();
  const registryBefore = fs.readFileSync(runFile, "utf8");
  const result = summarize(root);
  assert.strictEqual(result.status, 0, result.stderr);

  const summaryFile = path.join(root, "Generated", "Demo.summary.json");
  assert.ok(fs.existsSync(summaryFile), "必须产出 Generated/<Target>.summary.json");
  const summary = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
  assert.strictEqual(summary.schemaVersion, "mastergo-run-summary/1");
  assert.strictEqual(summary.run.target, "Demo");
  assert.strictEqual(summary.run.runId.length > 0, true);
  assert.strictEqual(summary.page.capturedNodes, 12);
  assert.deepStrictEqual(summary.page.controlTypes, { TextBlock: 1, IconButton: 1 });
  assert.strictEqual(summary.page.icons.extractSvgEntries, 3);
  // candidates 与 unmapped 是重叠视图：去重后是 2 条，不是 3 条。
  assert.strictEqual(summary.page.icons.candidates, 2);
  assert.deepStrictEqual(summary.page.icons.byStatus, { confirmed: 1, unmapped: 1 });
  assert.strictEqual(summary.page.nesting.reparented, 1);
  // 产物层与映射层分开报：两层数字可以不同，必须各自标来源。
  assert.deepStrictEqual(summary.pageProduct.counts, { pageXmlControls: 2, pageIconKeys: 1, ledgerIcons: 1 });
  assert.deepStrictEqual(summary.pageProduct.pageXmlControlTypes, { TextBlock: 1, IconButton: 1 });
  assert.deepStrictEqual(summary.pageProduct.pageIconKeys, ["PageOnlyGeometry"]);
  // 台账里的 X 没进页面图标字典 → 差集要报出来，而不是当成"产物缺图标"。
  assert.deepStrictEqual(summary.pageProduct.ledgerNotInPageIcons, ["X"]);
  assert.strictEqual(summary.sources.iconsXaml.path, "Resources/Pages/Demo/DemoIcons.xaml");
  assert.strictEqual(summary.sources.mappingDraft.path, "Generated/_work/Demo.mapping.draft.json");
  assert.strictEqual(summary.sources.mappingDraft.step, 1);
  assert.deepStrictEqual(summary.unavailable, []);

  // 台账已生成，剩下的未确认候选是信息项、差集是状态说明，两者都不该混进 todos。
  assert.deepStrictEqual(summary.todos, []);
  assert.deepStrictEqual(summary.notices.map((item) => item.kind), ["icons.unconfirmed", "icons.ledgerNotInPageIcons"]);
  // 摘要是派生视图：不得写回登记表（写进去的 sha256 下一次刷新就过期）。
  assert.strictEqual(fs.readFileSync(runFile, "utf8"), registryBefore, "摘要不得修改登记表");
  assert.strictEqual(JSON.parse(registryBefore).outputs["Generated/Demo.summary.json"], undefined,
    "摘要不得把自身登记进 outputs");
}

// 2) 登记产物被改写 → 必须失败，不许"读到了就先用着"。
{
  const { root, write } = newProject();
  assert.strictEqual(summarize(root).status, 0);
  write("Generated/_inputs/Demo.layout-manifest.json", { layoutStatus: "complete", menuItems: [], layoutEvidence: { unresolvedBottomBarItems: 9 } });
  const result = summarize(root);
  assert.notStrictEqual(result.status, 0, "产物与登记 sha256 不符时必须失败");
  assert.match(result.stderr, /与磁盘不一致|不一致/);
}

// 3) 登记产物被后续步骤清理（outputs 记了 removed/exists=false）→ 记入 consumed，不算失败。
{
  const { root, runFile } = newProject();
  const registry = JSON.parse(fs.readFileSync(runFile, "utf8"));
  const draft = registry.artifacts.mappingDraft.path;
  registry.outputs[draft] = { kind: "work", dependsOn: null, removed: true, exists: false, sha256: null };
  fs.writeFileSync(runFile, JSON.stringify(registry, null, 2), "utf8");
  fs.unlinkSync(path.join(root, draft));
  const result = summarize(root);
  assert.strictEqual(result.status, 0, result.stderr);
  const summary = JSON.parse(fs.readFileSync(path.join(root, "Generated", "Demo.summary.json"), "utf8"));
  assert.deepStrictEqual(summary.consumed.map((item) => item.key), ["mappingDraft"]);
}

// 4) 登记产物消失但登记表没记清理记录 → 必须失败（这是登记表与磁盘漂移，不能静默跳过）。
{
  const { root, runFile } = newProject();
  const registry = JSON.parse(fs.readFileSync(runFile, "utf8"));
  fs.unlinkSync(path.join(root, registry.artifacts.mappingDraft.path));
  const result = summarize(root);
  assert.notStrictEqual(result.status, 0, "无清理记录的缺失产物必须失败");
  assert.match(result.stderr, /登记表与磁盘|不存在/);
}

// 5) 只看登记表：磁盘上放一个"看起来更完整"的未登记同名文件，摘要不得消费它。
{
  const { root, write } = newProject();
  write("Generated/_inputs/Demo.icon-map.json", { icons: [{ sourceId: "ghost", name: "影子" }] });
  const before = JSON.parse(fs.readFileSync(path.join(root, "Generated", "_inputs", "Demo.icon-map.json"), "utf8"));
  assert.strictEqual(before.icons.length, 1, "前提：磁盘文件已被改成影子数据");
  const result = summarize(root);
  assert.notStrictEqual(result.status, 0, "未登记同名的改写文件必须被 sha256 拦住");
}

// 6) 新开运行（登记表清空）而磁盘上仍留着上次的全部产物 → 摘要必须一律 null，绝不读旧文件。
//    这是摘要能替代手写探针的前提：手写探针会去读磁盘，摘要只认本次登记。
{
  const { root } = newProject();
  const fresh = runNode(registryCli, [
    "init", "--project-root", root, "--target", "Demo",
    "--file-id", "999", "--layer-id", "9:9", "--ui", "F9", "--design-page", "新一次运行"
  ]);
  assert.strictEqual(fresh.status, 0, fresh.stderr);
  // 前提：产物文件全部还在磁盘上
  assert.ok(fs.existsSync(path.join(root, "Generated", "_work", "Demo.mapping.draft.json")));
  assert.ok(fs.existsSync(path.join(root, "Resources", "Pages", "Demo", "DemoPage.xml")));

  const result = summarize(root);
  assert.strictEqual(result.status, 0, result.stderr);
  const summary = JSON.parse(fs.readFileSync(path.join(root, "Generated", "Demo.summary.json"), "utf8"));
  assert.strictEqual(summary.page.capturedNodes, null, "未登记的覆盖报告不得被读出来");
  assert.strictEqual(summary.page.mappingNodes, null, "未登记的 mapping 不得被读出来");
  assert.strictEqual(summary.page.icons.candidates, null, "取不到候选时必须 null，不能显示成 0");
  assert.deepStrictEqual(summary.pageProduct.counts, { pageXmlControls: null, pageIconKeys: null, ledgerIcons: null });
  assert.strictEqual(summary.pageProduct.pageXmlControlTypes, null, "未登记的页面 XML 不得被读出来");
  assert.deepStrictEqual(summary.sources, {});
  assert.strictEqual(summary.unavailable.length >= 7, true, "全部产物都该进 unavailable");
}

console.log("build-run-summary: all cases passed");
