#!/usr/bin/env node
"use strict";

// 尺寸约束（min/max 宽高）回归：适配层 → 布局透传 → XAML 发射 → 门禁。
// 锁定的约定：
//   1) 未设置 = 0（插件 API 对"没设约束"返回 0，不是 null），只有 > 0 才算设置；
//   2) 配对先按完整 id，再按复合 id 末段兜底；末段歧义不猜（记进报告）；
//   3) 适配层只增加 node.constraints，不改 DSL 任何原生字段；官方 DSL 支持后只改这一处取值来源；
//   4) 布局只透传（cell.constraints），XAML 才发射 MinWidth/MaxWidth（文本控件有最大宽才补 TextWrapping）；
//   5) 带约束的容器不展平（约束必须有承载物），无 flex 声明的容器同样成层；
//   6) 门禁 R11 一致性 / R12 未落格（失败）/ R13 是否发射（缺 --xaml 时不做 R13）。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT_DIR = path.join(__dirname, "..");
const { applyConstraints } = require(path.join(SCRIPT_DIR, "core", "apply-constraints.js"));
const { deriveLayout } = require(path.join(SCRIPT_DIR, "adapters", "mw-wpf", "gen-mw-wpf-layout.js"));
const { renderXaml } = require(path.join(SCRIPT_DIR, "adapters", "mw-wpf", "gen-mw-wpf-xaml.js"));
const CHECK = path.join(SCRIPT_DIR, "adapters", "mw-wpf", "check-wpf-layout.js");
const ROUTE_MAP = path.join(SCRIPT_DIR, "..", "references", "adapters", "mw-wpf", "mw-wpf-map.json");
const MAP = JSON.parse(fs.readFileSync(ROUTE_MAP, "utf8"));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "constraints-"));
let seq = 0;

function writeJson(name, value) {
  const file = path.join(tmp, (++seq) + "-" + name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
  return file;
}

function node(id, type, style, children, extra) {
  return Object.assign({ id, name: id, type, layoutStyle: style, children: children || [] }, extra || {});
}

// ── ① 适配层：0 = 未设置、末段兜底、只有 constraints 这一个字段被增加 ───────────────
{
  const dsl = {
    dsl: {
      nodes: [
        node("root", "FRAME", { width: 100, height: 100, relativeX: 0, relativeY: 0 }, [
          node("1:1", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 0 }, [], { name: "工件厚度" }),
          node("1:2/9:9", "TEXT", { width: 60, height: 16, relativeX: 0, relativeY: 20 }),
          node("1:3", "TEXT", { width: 60, height: 16, relativeX: 0, relativeY: 40 })
        ])
      ]
    }
  };
  const constraints = {
    pageId: "4:0",
    count: 3,
    nodes: [
      { id: "1:1", name: "工件厚度", width: 80, minWidth: 80, maxWidth: 194, minHeight: 0, maxHeight: 0 },
      { id: "7:7/9:9", minWidth: 50, maxWidth: 120, minHeight: 0, maxHeight: 0 },
      { id: "1:3", minWidth: 0, maxWidth: 0, minHeight: 0, maxHeight: 0 }
    ]
  };
  const dslPath = writeJson("dsl.json", dsl);
  const constraintsPath = writeJson("constraints.json", constraints);
  const before = JSON.parse(fs.readFileSync(dslPath, "utf8"));

  const summary = applyConstraints({ dsl: dslPath, constraints: constraintsPath });
  assert.strictEqual(summary.constraintRows, 2, "0 值不算约束：3 行里只有 2 行是真约束");
  assert.strictEqual(summary.matchedFullId, 1, "1:1 按完整 id 命中");
  assert.strictEqual(summary.matchedLastSegment, 1, "1:2/9:9 按末段 9:9 命中 7:7/9:9");
  assert.strictEqual(summary.constrainedNodes, 2, "只有两个节点被合并");

  const merged = JSON.parse(fs.readFileSync(summary.out, "utf8"));
  const text = merged.dsl.nodes[0].children[0];
  assert.deepStrictEqual(text.constraints, { minWidth: 80, maxWidth: 194 }, "约束只保留 > 0 的项");
  assert.deepStrictEqual(merged.dsl.nodes[0].children[1].constraints, { minWidth: 50, maxWidth: 120 }, "末段兜底");
  assert.strictEqual(merged.dsl.nodes[0].children[2].constraints, undefined, "全 0 不合并");
  // 原生字段逐一不丢：与合并前的快照逐键比对（只允许多出 constraints）。
  const strip = (value) => JSON.parse(JSON.stringify(value, (key, item) => (key === "constraints" ? undefined : item)));
  assert.deepStrictEqual(strip(merged), before, "除 constraints 外，DSL 内容必须与合并前完全一致");
}

// ── ② 末段歧义：不猜，记进报告 ────────────────────────────────────────────────
{
  const dsl = { dsl: { nodes: [node("root", "FRAME", { width: 10, height: 10, relativeX: 0, relativeY: 0 }, [
    node("1:1/9:9", "TEXT", { width: 10, height: 10, relativeX: 0, relativeY: 0 })
  ])] } };
  const constraints = { pageId: "4:0", nodes: [
    { id: "7:7/9:9", minWidth: 10, maxWidth: 20 },
    { id: "8:8/9:9", minWidth: 10, maxWidth: 20 }
  ] };
  const summary = applyConstraints({
    dsl: writeJson("ambiguous-dsl.json", dsl),
    constraints: writeJson("ambiguous-constraints.json", constraints)
  });
  assert.strictEqual(summary.constrainedNodes, 0, "末段有两个候选时不配对");
  assert.strictEqual(summary.ambiguous, 1, "歧义必须记进报告");
}

// ── ③ 布局：只透传 constraints ────────────────────────────────────────────────
function snapshotWithConstraints() {
  return {
    schemaVersion: "mastergo-dsl-snapshot/2",
    dsl: {
      nodes: [node("root", "FRAME", { width: 1280, height: 1024, relativeX: 0, relativeY: 0 }, [
        node("body", "FRAME", { width: 1280, height: 902, relativeX: 0, relativeY: 85 }, [
          node("t1", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 0 }, [], {
            name: "工件厚度", constraints: { minWidth: 80, maxWidth: 194 }
          }),
          node("t2", "TEXT", { width: 60, height: 16, relativeX: 0, relativeY: 20 })
        ])
      ])]
    }
  };
}

const layoutInput = snapshotWithConstraints();
// 类型判定产物带绝对 bbox（布局按它分格），与真实产物同形状。
const TYPES_NODES = [
  { ref: "t1", sourceRef: "t1", controlType: "TextBlock", sourceText: "工件厚度", absX: 0, absY: 85, w: 80, h: 16, langName: "PXThickness" },
  { ref: "t2", sourceRef: "t2", controlType: "TextBlock", sourceText: "膜带厚度", absX: 0, absY: 105, w: 60, h: 16, langName: "PXTape" }
];
const TYPES_FILE = { schemaVersion: 1, nodes: TYPES_NODES, pending: [], unmappedComponents: [] };
const layout = deriveLayout({
  dsl: layoutInput,
  types: { byRef: new Map(TYPES_NODES.map(function (item) { return [item.ref, item]; })) },
  map: MAP,
  containers: new Set(["IOGroupBox"]),
  tokens: { headerHeight: 85, bottomHeight: 180 },
  pageTarget: "P",
  visibility: null
});
const cells = [];
(function collect(grid) {
  if (!grid || !Array.isArray(grid.cells)) return;
  grid.cells.forEach(function (cell) {
    cells.push(cell);
    if (cell.children) collect(cell.children);
  });
})(layout.regions.find(function (region) { return region.emit !== false; }).grid);
const constrainedCell = cells.find(function (cell) { return cell.ref === "t1"; });
assert.ok(constrainedCell, "t1 必须落格");
assert.deepStrictEqual(constrainedCell.constraints, { minWidth: 80, maxWidth: 194 }, "布局只透传 DSL 上的约束");
assert.strictEqual(cells.find(function (cell) { return cell.ref === "t2"; }).constraints, undefined, "没有约束的节点不得凭空生成");

// ── ④ XAML：发射 MinWidth/MaxWidth，文本控件有最大宽才补 TextWrapping ───────────────
{
  const layoutPath = writeJson("layout.json", layout);
  const typesPath = writeJson("types.json", TYPES_FILE);
  const outPath = path.join(tmp, "view.xaml");
  const result = spawnSync(process.execPath, [
    path.join(SCRIPT_DIR, "adapters", "mw-wpf", "gen-mw-wpf-xaml.js"),
    "--layout", layoutPath, "--types", typesPath, "--map", ROUTE_MAP,
    "--page", "P", "--x-class", "X.P", "--assembly", "X",
    "--icon-page", "Resources/Pages/P/PIcons.xaml", "--out", outPath, "--overwrite"
  ], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, "XAML 发射应成功: " + result.stderr);
  const xaml = fs.readFileSync(outPath, "utf8");
  assert.ok(/MinWidth="80"/.test(xaml), "必须发射 MinWidth");
  assert.ok(/MaxWidth="194"/.test(xaml), "必须发射 MaxWidth");
  assert.ok(/TextWrapping="Wrap"/.test(xaml), "TextBlock 有最大宽时必须补 TextWrapping");
  assert.strictEqual((xaml.match(/MinWidth="/g) || []).length, 1, "没有约束的控件不得被补约束");
}

// ── ⑤ 门禁：R11 一致 / R12 未落格失败 / R13 一致性（缺 --xaml 时跳过 R13）────────────
{
  const layoutPath = writeJson("gate-layout.json", layout);
  const typesPath = writeJson("gate-types.json", TYPES_FILE);
  const dslPath = writeJson("gate-dsl.json", layoutInput);
  const reportPath = path.join(tmp, "gate-report.json");
  const pass = spawnSync(process.execPath, [CHECK, "--layout", layoutPath, "--types", typesPath, "--map", ROUTE_MAP, "--dsl", dslPath, "--json", reportPath], { encoding: "utf8" });
  assert.strictEqual(pass.status, 0, "约束一致时门禁必须通过: " + pass.stdout + pass.stderr);

  // 篡改：格子上的约束与 DSL 不一致 → R11 失败。
  const tampered = JSON.parse(JSON.stringify(layout));
  (function findAndTamper(grid) {
    if (!grid || !Array.isArray(grid.cells)) return;
    grid.cells.forEach(function (cell) {
      if (cell.ref === "t1") cell.constraints = { minWidth: 80, maxWidth: 200 };
      if (cell.children) findAndTamper(cell.children);
    });
  })(tampered.regions.find(function (region) { return region.emit !== false; }).grid);
  const tamperedLayoutPath = writeJson("gate-layout-tampered.json", tampered);
  const fail = spawnSync(process.execPath, [CHECK, "--layout", tamperedLayoutPath, "--types", typesPath, "--map", ROUTE_MAP, "--dsl", dslPath, "--json", reportPath], { encoding: "utf8" });
  assert.strictEqual(fail.status, 2, "约束被改动时门禁必须失败");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.ok(report.findings.some(function (item) { return item.rule === "R11"; }), "R11 必须报出不一致");

  // DSL 里有约束但没落格 → R12 失败（约束是设计意图，不许静默丢）。
  const orphanDsl = JSON.parse(JSON.stringify(layoutInput));
  orphanDsl.dsl.nodes[0].children[0].children.push(
    node("t3", "TEXT", { width: 40, height: 16, relativeX: 0, relativeY: 60 }, [], { constraints: { minWidth: 30, maxWidth: 60 } })
  );
  const orphanDslPath = writeJson("gate-dsl-orphan.json", orphanDsl);
  const orphan = spawnSync(process.execPath, [CHECK, "--layout", layoutPath, "--types", typesPath, "--map", ROUTE_MAP, "--dsl", orphanDslPath, "--json", reportPath], { encoding: "utf8" });
  assert.strictEqual(orphan.status, 2, "有约束没落格必须失败");
  const orphanReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.ok(orphanReport.findings.some(function (item) { return item.rule === "R12" && item.ref === "t3"; }), "R12 必须报出未落格的约束节点");
}

// ── ⑥ 带约束的单条目容器不展平（约束必须有承载物）────────────────────────────────
{
  const dsl = {
    dsl: {
      nodes: [node("root", "FRAME", { width: 1280, height: 1024, relativeX: 0, relativeY: 0 }, [
        node("body", "FRAME", { width: 1280, height: 902, relativeX: 0, relativeY: 85 }, [
          node("row", "FRAME", { width: 400, height: 100, relativeX: 0, relativeY: 0 }, [
            node("box", "FRAME", { width: 200, height: 40, relativeX: 0, relativeY: 0 }, [
              node("t1", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 0 })
            ], { flexContainerInfo: { flexDirection: "column" }, constraints: { minWidth: 80, maxWidth: 194 } })
          ], { flexContainerInfo: { flexDirection: "row" } })
        ])
      ])]
    }
  };
  const types = {
    byRef: new Map([["t1", { ref: "t1", controlType: "TextBlock", absX: 0, absY: 85, w: 80, h: 16 }]])
  };
  const derived = deriveLayout({
    dsl: dsl, types: types, map: MAP, containers: new Set(["IOGroupBox"]),
    tokens: { headerHeight: 85, bottomHeight: 180 }, pageTarget: "P", visibility: null
  });
  let boxCell = null;
  (function walk(grid) {
    if (!grid || !Array.isArray(grid.cells)) return;
    grid.cells.forEach(function (cell) {
      if (cell.ref === "box") boxCell = cell;
      if (cell.children) walk(cell.children);
    });
  })(derived.regions.find(function (region) { return region.emit !== false; }).grid);
  assert.ok(boxCell, "带约束的单条目容器必须保留成一层 Grid（否则约束无处落）");
  assert.strictEqual(boxCell.container, true, "保留下来的是容器格子");
  assert.deepStrictEqual(boxCell.constraints, { minWidth: 80, maxWidth: 194 }, "容器格子带上约束");
}

// ── ⑦ 带约束但没声明 flex 的容器同样成层（内层按 bbox 聚类）────────────────────────
{
  const dsl = {
    dsl: {
      nodes: [node("root", "FRAME", { width: 1280, height: 1024, relativeX: 0, relativeY: 0 }, [
        node("body", "FRAME", { width: 1280, height: 902, relativeX: 0, relativeY: 85 }, [
          node("row", "FRAME", { width: 400, height: 100, relativeX: 0, relativeY: 0 }, [
            node("box2", "FRAME", { width: 200, height: 60, relativeX: 0, relativeY: 0 }, [
              node("t1", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 0 }),
              node("t2", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 32 })
            ], { constraints: { minWidth: 80, maxWidth: 194 } })
          ], { flexContainerInfo: { flexDirection: "row" } })
        ])
      ])]
    }
  };
  const types = {
    byRef: new Map([
      ["t1", { ref: "t1", controlType: "TextBlock", absX: 0, absY: 85, w: 80, h: 16 }],
      ["t2", { ref: "t2", controlType: "TextBlock", absX: 0, absY: 117, w: 80, h: 16 }]
    ])
  };
  const derived = deriveLayout({
    dsl: dsl, types: types, map: MAP, containers: new Set(["IOGroupBox"]),
    tokens: { headerHeight: 85, bottomHeight: 180 }, pageTarget: "P", visibility: null
  });
  let boxCell = null;
  let childRefs = [];
  (function walk(grid) {
    if (!grid || !Array.isArray(grid.cells)) return;
    grid.cells.forEach(function (cell) {
      if (cell.ref === "box2") {
        boxCell = cell;
        childRefs = (cell.children ? cell.children.cells : []).map(function (item) { return item.ref; });
      }
      if (cell.children) walk(cell.children);
    });
  })(derived.regions.find(function (region) { return region.emit !== false; }).grid);
  assert.ok(boxCell, "带约束但没有 flex 声明的容器也必须成层（否则约束无处落）");
  assert.strictEqual(boxCell.container, true, "保留下来的是容器格子");
  assert.deepStrictEqual(boxCell.constraints, { minWidth: 80, maxWidth: 194 }, "容器格子带上约束");
  assert.deepStrictEqual(childRefs.sort(), ["t1", "t2"], "容器的子控件进它的内层 Grid");
  assert.deepStrictEqual(derived.pending, [], "没有节点因为成层而漏落格");
}

// ── ⑧ 本页不发射的带约束节点（页面根 / 不可见 / 框架固定区）登记豁免，不失败 ─────────
{
  const dsl = {
    dsl: {
      nodes: [node("root", "FRAME", { width: 1280, height: 1024, relativeX: 0, relativeY: 0 }, [
        node("top", "TEXT", { width: 80, height: 16, relativeX: 10, relativeY: 10 }, [], { constraints: { minHeight: 20 } }),
        node("body", "FRAME", { width: 1280, height: 902, relativeX: 0, relativeY: 85 }, [
          node("hidden", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 0 }, [], { constraints: { minWidth: 80 } }),
          node("shown", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 20 })
        ])
      ], { constraints: { minHeight: 600 } })]
    }
  };
  const types = {
    byRef: new Map([
      ["top", { ref: "top", controlType: "TextBlock", absX: 10, absY: 10, w: 80, h: 16, langName: "PXTop" }],
      ["hidden", { ref: "hidden", controlType: "TextBlock", absX: 0, absY: 85, w: 80, h: 16, langName: "PXHidden" }],
      ["shown", { ref: "shown", controlType: "TextBlock", absX: 0, absY: 105, w: 80, h: 16, langName: "PXShown" }]
    ])
  };
  const derived = deriveLayout({
    dsl: dsl, types: types, map: MAP, containers: new Set(["IOGroupBox"]),
    tokens: { headerHeight: 85, bottomHeight: 180 }, pageTarget: "P",
    visibility: { nodes: { hidden: { effectiveVisible: false } } }
  });
  const exempt = new Map((derived.constraintExempt || []).map(function (item) { return [item.ref, item.reason]; }));
  assert.ok(exempt.has("root"), "页面根带约束 → 登记豁免");
  assert.ok(exempt.has("top"), "框架固定区里的节点带约束 → 登记豁免");
  assert.ok(exempt.has("hidden"), "不可见节点带约束 → 登记豁免");
  assert.strictEqual(exempt.has("shown"), false, "没有约束的节点不得进豁免清单");

  const layoutPath = writeJson("exempt-layout.json", derived);
  const typesPath = writeJson("exempt-types.json", { schemaVersion: 1, nodes: Array.from(types.byRef.values()), pending: [], unmappedComponents: [] });
  const dslPath = writeJson("exempt-dsl.json", dsl);
  const reportPath = path.join(tmp, "exempt-report.json");
  const run = spawnSync(process.execPath, [CHECK, "--layout", layoutPath, "--types", typesPath, "--map", ROUTE_MAP, "--dsl", dslPath, "--json", reportPath], { encoding: "utf8" });
  assert.strictEqual(run.status, 0, "本页不发射的带约束节点不得阻断门禁: " + run.stdout + run.stderr);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  ["root", "top", "hidden"].forEach(function (ref) {
    assert.ok(report.notices.some(function (item) { return item.rule === "R12" && item.ref === ref; }), ref + " 的约束豁免必须登记提示");
  });
  assert.strictEqual(report.findings.length, 0, "豁免情形不得产生失败项");
}

// ── ⑨ 内容区里带约束、却没有任何可发射内容的容器 → R12 失败（交人工处置，不静默丢）────────
{
  const dsl = { dsl: { nodes: [node("root", "FRAME", { width: 1280, height: 1024, relativeX: 0, relativeY: 0 }, [
    node("box", "FRAME", { width: 200, height: 60, relativeX: 0, relativeY: 200 }, [
      node("deco", "ELLIPSE", { width: 40, height: 16, relativeX: 0, relativeY: 0 })
    ], { constraints: { minWidth: 80, maxWidth: 194 } }),
    node("shown", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 300 })
  ])] } };
  const derived = deriveLayout({
    dsl: dsl,
    types: { byRef: new Map([["shown", { ref: "shown", controlType: "TextBlock", absX: 0, absY: 300, w: 80, h: 16, langName: "PXShown" }]]) },
    map: MAP, containers: new Set(["IOGroupBox"]),
    tokens: { headerHeight: 85, bottomHeight: 180 }, pageTarget: "P", visibility: null
  });
  assert.deepStrictEqual(derived.constraintExempt, [], "内容区里的容器不算豁免");
  const layoutPath = writeJson("no-content-layout.json", derived);
  const typesPath = writeJson("no-content-types.json", { schemaVersion: 1, nodes: [{ ref: "shown", controlType: "TextBlock", absX: 0, absY: 300, w: 80, h: 16, langName: "PXShown" }], pending: [], unmappedComponents: [] });
  const dslPath = writeJson("no-content-dsl.json", dsl);
  const reportPath = path.join(tmp, "no-content-report.json");
  const run = spawnSync(process.execPath, [CHECK, "--layout", layoutPath, "--types", typesPath, "--map", ROUTE_MAP, "--dsl", dslPath, "--json", reportPath], { encoding: "utf8" });
  assert.strictEqual(run.status, 2, "内容区里放不下的约束必须失败，不得静默丢");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.ok(report.findings.some(function (item) { return item.rule === "R12" && item.ref === "box"; }), "R12 必须报出这个容器");
}

console.log("constraints.test.js: 全部通过");
