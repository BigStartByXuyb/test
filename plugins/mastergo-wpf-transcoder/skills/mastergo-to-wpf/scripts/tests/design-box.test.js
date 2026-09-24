#!/usr/bin/env node
"use strict";

// 格子尺寸与「尺寸/对齐」回归：布局推导登记 → XAML 发射 → 门禁 R14。
// 锁定的口径（page-build-rules.md 第 4 节第 14 条 / mw-wpf-mode.md 第 2 节第 3 条）：
//   1) 格子尺寸照设计稿：像素带 = 到下一带起点的距离，唯一收尾星号带 = 可用尺寸 − 其余像素带之和；
//   2) 控件写自身设计稿尺寸，格子尺寸 − 控件尺寸 = 间距，差值落在哪一侧由格内偏移决定
//      （贴起始边 / 贴末端 / 居中 / 非对称内缩用对齐 + Margin 精确复现）；
//   3) 格子尺寸与控件尺寸相等 → 不写尺寸也不写对齐；跨格按 span 累加；
//   4) 门禁 R14 逐格复核：格子尺寸必须与行列定义重算一致，发射报告的尺寸/对齐必须与同一实现一致。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT_DIR = path.join(__dirname, "..");
const { designBoxAttrs } = require(path.join(SCRIPT_DIR, "lib", "design-box.js"));
const { deriveLayout } = require(path.join(SCRIPT_DIR, "adapters", "mw-wpf", "gen-mw-wpf-layout.js"));
const { renderXaml } = require(path.join(SCRIPT_DIR, "adapters", "mw-wpf", "gen-mw-wpf-xaml.js"));
const CHECK = path.join(SCRIPT_DIR, "adapters", "mw-wpf", "check-wpf-layout.js");
const ROUTE_MAP = path.join(SCRIPT_DIR, "..", "references", "adapters", "mw-wpf", "mw-wpf-map.json");
const MAP = JSON.parse(fs.readFileSync(ROUTE_MAP, "utf8"));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "design-box-"));
let seq = 0;

function writeJson(name, value) {
  const file = path.join(tmp, (++seq) + "-" + name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
  return file;
}

function node(id, type, style, children, extra) {
  return Object.assign({ id, name: id, type, layoutStyle: style, children: children || [] }, extra || {});
}

// ── ① 单轴判定：贴起始边 / 贴末端 / 居中 / 非对称内缩 / 同尺寸 ──────────────────────
{
  const box = function (nodeWidth, nodeHeight, width, height, offsetX, offsetY) {
    return {
      width: width, height: height,
      nodeWidth: nodeWidth, nodeHeight: nodeHeight,
      offsetX: offsetX, offsetY: offsetY
    };
  };
  assert.deepStrictEqual(designBoxAttrs(box(80, 80, 170, 120, 0, 0)),
    { Width: "80", Height: "80", HorizontalAlignment: "Left", VerticalAlignment: "Top" },
    "贴起始边：差值全部落在末端（间距）");
  assert.deepStrictEqual(designBoxAttrs(box(80, 16, 132, 16, 52, 0)),
    { Width: "80", HorizontalAlignment: "Right" },
    "贴末端：差值全部落在起点侧");
  assert.deepStrictEqual(designBoxAttrs(box(170, 80, 291, 80, 60.5, 0)),
    { Width: "170", HorizontalAlignment: "Center" },
    "两侧相等：居中");
  assert.deepStrictEqual(designBoxAttrs(box(80, 16, 132, 16, 31, 0)),
    { Width: "80", HorizontalAlignment: "Left", Margin: "31,0,0,0" },
    "非对称内缩：贴起始边 + Margin 精确复现");
  assert.deepStrictEqual(designBoxAttrs(box(80, 16, 80, 16, 0, 0)), {}, "格子与控件同尺寸：不写任何属性");
  assert.deepStrictEqual(designBoxAttrs(box(140, 40, 144, 40, undefined, undefined)),
    { Width: "140" }, "没有偏移来源：只写尺寸，不猜对齐");
}

// ── ② 布局推导：主轴条目带 + 间隙带（空 Grid 固定尺寸）/ 交叉轴聚类 ──────────────────
{
  const dsl = {
    dsl: {
      nodes: [node("root", "FRAME", { width: 1280, height: 1024, relativeX: 0, relativeY: 0 }, [
        node("body", "FRAME", { width: 1280, height: 902, relativeX: 0, relativeY: 85 }, [
          // 容器 600×320，column + gap 40：行 = 条目行 80 ×3 + 间隙行 40 ×2。
          node("col", "FRAME", { width: 600, height: 320, relativeX: 0, relativeY: 0 }, [
            node("b1", "TEXT", { width: 170, height: 80, relativeX: 0, relativeY: 0 }),
            node("b2", "TEXT", { width: 170, height: 80, relativeX: 0, relativeY: 120 }),
            node("b3", "TEXT", { width: 170, height: 80, relativeX: 0, relativeY: 240 })
          ], { flexContainerInfo: { flexDirection: "column", gap: "40px" } }),
          // 第二个顶层条目：让内容区不会把容器链收口掉（收口后容器就没有自己的格子了）。
          node("side", "TEXT", { width: 140, height: 48, relativeX: 700, relativeY: 0 })
        ])
      ])]
    }
  };
  const types = {
    byRef: new Map([
      ["b1", { ref: "b1", controlType: "IconButton", absX: 0, absY: 85, w: 170, h: 80 }],
      ["b2", { ref: "b2", controlType: "IconButton", absX: 0, absY: 205, w: 170, h: 80 }],
      ["b3", { ref: "b3", controlType: "IconButton", absX: 0, absY: 325, w: 170, h: 80 }],
      ["side", { ref: "side", controlType: "TextBlock", absX: 700, absY: 85, w: 140, h: 48 }]
    ])
  };
  const derived = deriveLayout({
    dsl: dsl, types: types, map: MAP, containers: new Set(["IOGroupBox"]),
    tokens: { headerHeight: 85, bottomHeight: 180 }, pageTarget: "P", visibility: null
  });
  const cells = new Map();
  const grids = [];
  (function walk(grid) {
    grids.push(grid);
    grid.cells.forEach(function (item) {
      cells.set(item.ref, item);
      if (item.children) walk(item.children);
    });
  })(derived.regions.find(function (region) { return region.emit !== false; }).grid);

  const containerGrid = grids.find(function (grid) { return grid.owner && grid.owner.direction === "column"; });
  assert.ok(containerGrid, "容器的内层网格必须登记 owner（flex 方向与 gap）");
  assert.deepStrictEqual(containerGrid.owner, { ref: "col", direction: "column", gap: 40, root: false },
    "owner 记录容器 ref / 方向 / gap");
  assert.deepStrictEqual(containerGrid.rows.map(function (band) {
    return band.size === "Auto" ? "Auto(" + band.gap + ")" : band.value;
  }), [80, "Auto(40)", 80, "Auto(40)", 80], "主轴成带：条目行照设计稿像素 + 间隙行（Auto）");
  const rowSpacers = containerGrid.cells.filter(function (cell) { return cell.spacer; });
  assert.deepStrictEqual(rowSpacers.map(function (cell) { return [cell.spacer.axis, cell.spacer.size]; }),
    [["row", 40], ["row", 40]], "上下间隙 = 空 Grid 固定高 40");
  assert.strictEqual(rowSpacers[0].controlType, undefined, "间隙格里没有控件类型");

  const column = cells.get("col");
  assert.strictEqual(column.container, true, "容器成层");
  assert.strictEqual(column.width, 700, "容器格子宽＝到下一列带起点的距离（容器 600 + 右侧空 100）");
  assert.strictEqual(column.height, 1024 - 85 - 180, "容器格子高＝收尾星号带残差（内容区可用高 − 前面像素带）");
  assert.strictEqual(column.nodeWidth, 600, "登记容器自身设计尺寸");
  assert.deepStrictEqual(designBoxAttrs(column),
    { Width: "600", Height: "320", HorizontalAlignment: "Left", VerticalAlignment: "Top" },
    "容器格子比容器大 → 容器写自身尺寸并贴起始边");
  assert.deepStrictEqual(designBoxAttrs(cells.get("side")),
    { Width: "140", Height: "48", HorizontalAlignment: "Left", VerticalAlignment: "Top" },
    "顶层控件同样照格子与自身尺寸的差写属性");

  assert.strictEqual(cells.get("b1").height, 80, "条目行 = 控件自身高度（间距不再并进行高）");
  assert.strictEqual(cells.get("b1").offsetY, 0, "控件贴带起点");
  assert.deepStrictEqual(designBoxAttrs(cells.get("b1")),
    { Width: "170", HorizontalAlignment: "Left" },
    "控件写自身尺寸 + 贴起始边（高度与格子相等 → 不写 Height）");
  assert.deepStrictEqual(designBoxAttrs(cells.get("b3")), { Width: "170", HorizontalAlignment: "Left" },
    "末条条目带同样照设计稿（不再被星号撑开）");
}

// ── ③ 发射器：属性落到 XAML，并逐格进发射报告 ────────────────────────────────────
{
  const layout = {
    schemaVersion: 1, adapter: "mw-wpf", pageTarget: "P", design: { width: 1280, height: 1024 },
    regions: [{
      id: "work-area", name: "工作区", ref: null, role: "work-area", emit: true,
      x: 0, y: 85, w: 1280, h: 759,
      grid: {
        rows: [{ size: "Star", source: "design" }],
        columns: [{ size: "Star", source: "design" }],
        cells: [{
          ref: "label", controlType: "TextBlock", row: 0, column: 0, rowSpan: 1, columnSpan: 1,
          // 两侧差值相等（300−120−90 = 90；100−30−35 = 35）→ 居中。
          width: 300, height: 100, nodeWidth: 120, nodeHeight: 30, offsetX: 90, offsetY: 35
        }]
      }
    }],
    pending: []
  };
  const types = {
    byRef: new Map([["label", {
      ref: "label", sourceRef: "label", controlType: "TextBlock", sourceText: "工件厚度",
      absX: 60, absY: 120, w: 120, h: 30, langName: "PWorkpieceThickness"
    }]])
  };
  const result = renderXaml({ iconPage: null, assembly: null }, layout, types, MAP);
  assert.match(result.xaml, /Width="120"\n\s+Height="30"\n\s+HorizontalAlignment="Center"\n\s+VerticalAlignment="Center"/,
    "尺寸与居中对齐必须落到 XAML");
  assert.strictEqual(result.report.designBox.length, 1, "发射报告必须逐格登记尺寸/对齐");
  assert.deepStrictEqual(result.report.designBox[0].attrs, designBoxAttrs(layout.regions[0].grid.cells[0]),
    "发射报告与共享实现同结果");
  // 缺格子尺寸（旧产物）→ fail-closed，不静默发射一个尺寸丢失的页面。
  const legacy = JSON.parse(JSON.stringify(layout));
  delete legacy.regions[0].grid.cells[0].width;
  assert.throws(function () { renderXaml({ iconPage: null, assembly: null }, legacy, types, MAP); },
    /缺少设计稿格子宽/, "旧布局产物必须失败");
}

// ── ④ 门禁 R14：正常通过；格子尺寸被改 / 发射报告缺条目 → 失败 ────────────────────
{
  const layout = {
    schemaVersion: 1, adapter: "mw-wpf", pageTarget: "P", design: { width: 1280, height: 1024 },
    regions: [{
      id: "work-area", name: "工作区", ref: null, role: "work-area", emit: true,
      x: 0, y: 85, w: 1280, h: 759,
      grid: {
        rows: [{ size: "Pixel", value: 120, source: "design" }, { size: "Star", source: "design" }],
        columns: [{ size: "Star", source: "design" }],
        cells: [
          { ref: "b1", controlType: "IconButton", row: 0, column: 0, rowSpan: 1, columnSpan: 1,
            width: 1280, height: 120, nodeWidth: 170, nodeHeight: 80, offsetX: 0, offsetY: 0 }
        ]
      }
    }],
    pending: []
  };
  const types = {
    schemaVersion: 1, nodes: [{ ref: "b1", controlType: "IconButton", absX: 0, absY: 85, w: 170, h: 80 }],
    pending: [], unmappedComponents: []
  };
  const report = { designBox: [{ ref: "b1", container: false, attrs: designBoxAttrs(layout.regions[0].grid.cells[0]) }] };
  const layoutPath = writeJson("gate-layout.json", layout);
  const typesPath = writeJson("gate-types.json", types);
  const reportPath = writeJson("gate-report.json", report);
  const outPath = path.join(tmp, "gate-gate.json");
  const run = function (layoutArg, reportArg) {
    return spawnSync(process.execPath, [CHECK, "--layout", layoutArg, "--types", typesPath, "--map", ROUTE_MAP,
      "--xaml-report", reportArg, "--json", outPath], { encoding: "utf8" });
  };
  assert.strictEqual(run(layoutPath, reportPath).status, 0, "产物自洽时 R14 必须通过");

  const tampered = JSON.parse(JSON.stringify(layout));
  tampered.regions[0].grid.cells[0].height = 200;
  const tamperedPath = writeJson("gate-layout-tampered.json", tampered);
  assert.strictEqual(run(tamperedPath, reportPath).status, 2, "格子尺寸与行列定义不一致必须失败");
  const tamperedReport = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.ok(tamperedReport.findings.some(function (item) { return item.rule === "R14" && /重算不一致/.test(item.message); }),
    "R14 必须报出格子尺寸不一致");


  const missing = writeJson("gate-report-missing.json", { designBox: [] });
  assert.strictEqual(run(layoutPath, missing).status, 2, "发射报告缺条目必须失败");
  const missingReport = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.ok(missingReport.findings.some(function (item) { return item.rule === "R14" && /没有这个格子/.test(item.message); }),
    "R14 必须报出报告缺条目");
}

// ── ⑤ 格子算不出正数尺寸（内容溢出承载物）→ unsized：不写尺寸/对齐，门禁按提示登记 ─────
{
  const dsl = { dsl: { nodes: [node("root", "FRAME", { width: 1280, height: 1024, relativeX: 0, relativeY: 0 }, [
    // 容器只有 100 宽：条目 40 + 间隙 70 已经 110 > 100 → 自适应的容器列算不出正数。
    node("box", "FRAME", { width: 100, height: 60, relativeX: 0, relativeY: 0 }, [
      node("a", "TEXT", { width: 40, height: 16, relativeX: 0, relativeY: 0 }),
      node("y", "FRAME", { width: 300, height: 20, relativeX: 110, relativeY: 0 }, [
        node("y1", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 0 }),
        node("y2", "TEXT", { width: 80, height: 16, relativeX: 0, relativeY: 20 })
      ], { flexContainerInfo: { flexDirection: "column" } })
    ], { flexContainerInfo: { flexDirection: "row", gap: "70px" } }),
    node("side", "TEXT", { width: 40, height: 16, relativeX: 300, relativeY: 0 })
  ])] } };
  const types = {
    byRef: new Map([
      ["a", { ref: "a", controlType: "TextBlock", absX: 0, absY: 85, w: 40, h: 16 }],
      ["y1", { ref: "y1", controlType: "TextBlock", absX: 110, absY: 85, w: 80, h: 16 }],
      ["y2", { ref: "y2", controlType: "TextBlock", absX: 110, absY: 105, w: 80, h: 16 }],
      ["side", { ref: "side", controlType: "TextBlock", absX: 300, absY: 85, w: 40, h: 16 }]
    ])
  };
  const derived = deriveLayout({
    dsl: dsl, types: types, map: MAP, containers: new Set(["IOGroupBox"]),
    tokens: { headerHeight: 85, bottomHeight: 180 }, pageTarget: "P", visibility: null
  });
  const cells = new Map();
  (function walk(grid) {
    grid.cells.forEach(function (item) { cells.set(item.ref, item); if (item.children) walk(item.children); });
  })(derived.regions.find(function (region) { return region.emit !== false; }).grid);
  const overflow = cells.get("y");
  assert.deepStrictEqual(overflow.unsized, { width: true }, "溢出带的格子必须按维登记 unsized");
  assert.strictEqual(overflow.width, undefined, "算不出正数尺寸时不写格子宽");
  assert.deepStrictEqual(designBoxAttrs(overflow), { Height: "20", VerticalAlignment: "Top" },
    "算不出的那一维不写，另一维照写");

  const layoutPath = writeJson("unsized-layout.json", derived);
  const typesPath = writeJson("unsized-types.json", { schemaVersion: 1, nodes: Array.from(types.byRef.values()), pending: [], unmappedComponents: [] });
  const reportPath = writeJson("unsized-report.json", {
    designBox: Array.from(cells.values()).filter(function (cell) { return !cell.spacer; }).map(function (cell) {
      return { ref: cell.ref, container: !!cell.container, attrs: designBoxAttrs(cell) };
    }),
    spacers: Array.from(cells.values()).filter(function (cell) { return cell.spacer; }).map(function (cell) {
      return { ref: cell.ref, axis: cell.spacer.axis, size: cell.spacer.size };
    })
  });
  const outPath = path.join(tmp, "unsized-gate.json");
  const run = spawnSync(process.execPath, [CHECK, "--layout", layoutPath, "--types", typesPath, "--map", ROUTE_MAP,
    "--xaml-report", reportPath, "--json", outPath], { encoding: "utf8" });
  assert.strictEqual(run.status, 0, "溢出带的格子只提示、不失败: " + run.stdout + run.stderr);
  const report = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.ok(report.notices.some(function (item) { return item.rule === "R14" && item.ref === "y"; }),
    "R14 必须把溢出带的格子登记成提示");
  assert.strictEqual(report.findings.length, 0, "溢出带的格子不得产生失败项");

  // 分维强度：unsized 只免宽度，高度被改坏仍必须失败。
  const tampered = JSON.parse(JSON.stringify(derived));
  (function find(grid) {
    grid.cells.forEach(function (cell) { if (cell.ref === "y1") cell.height = 999; if (cell.children) find(cell.children); });
  })(tampered.regions.find(function (region) { return region.emit !== false; }).grid);
  const tamperedPath = writeJson("unsized-layout-tampered.json", tampered);
  const tamperedRun = spawnSync(process.execPath, [CHECK, "--layout", tamperedPath, "--types", typesPath, "--map", ROUTE_MAP,
    "--xaml-report", reportPath, "--json", outPath], { encoding: "utf8" });

  assert.strictEqual(tamperedRun.status, 2, "unsized 只免算不出的那一维，另一维不一致必须失败");
  const tamperedReport = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.ok(tamperedReport.findings.some(function (item) { return item.rule === "R14" && /重算不一致/.test(item.message); }),
    "R14 必须报出另一维的重算不一致");

  // 自报 unsized 不能豁免重算：删掉宽度并标 unsized，但按行列定义重算 > 0 → 必须失败。
  const faked = JSON.parse(JSON.stringify(derived));
  (function find(grid) {
    grid.cells.forEach(function (cell) {
      if (cell.ref === "a") { delete cell.width; cell.unsized = { width: true }; }
      if (cell.children) find(cell.children);
    });
  })(faked.regions.find(function (region) { return region.emit !== false; }).grid);
  const fakedPath = writeJson("unsized-layout-faked.json", faked);
  const fakedRun = spawnSync(process.execPath, [CHECK, "--layout", fakedPath, "--types", typesPath, "--map", ROUTE_MAP,
    "--xaml-report", reportPath, "--json", outPath], { encoding: "utf8" });
  assert.strictEqual(fakedRun.status, 2, "自报 unsized 但重算 > 0 必须失败（产物被改坏）");
  const fakedReport = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.ok(fakedReport.findings.some(function (item) { return item.rule === "R14" && /重算为/.test(item.message); }),
    "R14 必须报出自报算不出但重算 > 0");
}

// ── ⑥ 撞格下移（shifted）不豁免格子尺寸：缺尺寸时发射器与门禁都必须失败 ──────────────
{
  const layout = {
    schemaVersion: 1, adapter: "mw-wpf", pageTarget: "P", design: { width: 1280, height: 1024 },
    regions: [{
      id: "work-area", name: "工作区", ref: null, role: "work-area", emit: true,
      x: 0, y: 85, w: 1280, h: 759,
      grid: {
        rows: [{ size: "Pixel", value: 120, source: "design" }, { size: "Star", source: "design" }],
        columns: [{ size: "Star", source: "design" }],
        cells: [{
          ref: "moved", controlType: "IconButton", row: 1, column: 0, rowSpan: 1, columnSpan: 1, shifted: true,
          height: 300, nodeWidth: 170, nodeHeight: 80
        }]
      }
    }],
    pending: []
  };
  const types = {
    schemaVersion: 1, nodes: [{ ref: "moved", controlType: "IconButton", absX: 0, absY: 205, w: 170, h: 80 }],
    pending: [], unmappedComponents: []
  };
  // 发射器：shifted 也不能缺格子尺寸。
  const layoutPath = writeJson("shifted-layout.json", layout);
  const typesPath = writeJson("shifted-types.json", types);
  const outXaml = path.join(tmp, "shifted", "View.xaml");
  const emit = spawnSync(process.execPath, [
    path.join(SCRIPT_DIR, "adapters", "mw-wpf", "gen-mw-wpf-xaml.js"),
    "--layout", layoutPath, "--types", typesPath, "--map", ROUTE_MAP,
    "--page", "P", "--x-class", "X.P", "--assembly", "X", "--out", outXaml, "--overwrite"
  ], { encoding: "utf8" });
  assert.notStrictEqual(emit.status, 0, "shifted 格子缺格子宽时发射器必须失败");
  assert.match(emit.stderr + emit.stdout, /缺少设计稿格子宽/, "失败信息必须点名缺的是格子宽");

  // 门禁：同样必须失败（重算值有机械真值，不能静默放过）。
  const reportPath = writeJson("shifted-report.json", {
    designBox: [{ ref: "moved", container: false, attrs: {} }]
  });
  const outGate = path.join(tmp, "shifted-gate.json");
  const gate = spawnSync(process.execPath, [CHECK, "--layout", layoutPath, "--types", typesPath, "--map", ROUTE_MAP,
    "--xaml-report", reportPath, "--json", outGate], { encoding: "utf8" });
  assert.strictEqual(gate.status, 2, "shifted 格子缺格子宽时门禁必须失败");
  const gateReport = JSON.parse(fs.readFileSync(outGate, "utf8"));
  assert.ok(gateReport.findings.some(function (item) { return item.rule === "R14" && /没有登记格子宽/.test(item.message); }),
    "R14 必须报出 shifted 格子缺格子宽");
}

console.log("design-box.test.js: 全部通过");
