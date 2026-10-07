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
const path = require("path");
const { tmpDir } = require(path.join(__dirname, "helpers", "tmp-dir.js"));
const { spawnSync } = require("child_process");

const SCRIPT_DIR = path.join(__dirname, "..");
const { designBoxAttrs, containerBoxAttrs } = require(path.join(SCRIPT_DIR, "lib", "design-box.js"));
const { deriveLayout } = require(path.join(SCRIPT_DIR, "adapters", "mw-wpf", "gen-mw-wpf-layout.js"));
const { renderXaml } = require(path.join(SCRIPT_DIR, "adapters", "mw-wpf", "gen-mw-wpf-xaml.js"));
const CHECK = path.join(SCRIPT_DIR, "adapters", "mw-wpf", "check-wpf-layout.js");
const ROUTE_MAP = path.join(SCRIPT_DIR, "..", "references", "adapters", "mw-wpf", "mw-wpf-map.json");
const MAP = JSON.parse(fs.readFileSync(ROUTE_MAP, "utf8"));

const tmp = tmpDir("design-box-");
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

// ── ② 布局推导：口径 A 成带（带 = 条目 + 间距；大空档成星号带；无间隙元素）/ 交叉轴聚类 ──
{
  const dsl = {
    dsl: {
      nodes: [node("root", "FRAME", { width: 1280, height: 1024, relativeX: 0, relativeY: 0 }, [
        node("body", "FRAME", { width: 1280, height: 902, relativeX: 0, relativeY: 85 }, [
          // 容器 600×320，column + gap 40：行 = 80+40 / 80+40 / 80（口径 A，不再有间隙行）。
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
    return band.size === "Star" ? "Star" : band.value;
  }), [120, 120, "Star"], "口径 A：间距并进前一带（80+40），没有大空档时末条吃剩余");
  assert.strictEqual(containerGrid.cells.filter(function (cell) { return cell.spacer; }).length, 0,
    "口径 A 不发射空 Grid 间隙格");

  const column = cells.get("col");
  assert.strictEqual(column.container, true, "容器成层");
  assert.strictEqual(column.width, 600, "容器格子＝容器自己的列带（右边 100 的空档是设计稿留下的空档，单独成星号列）");
  assert.strictEqual(grids[0].columns.filter(function (band) { return band.size === "Star"; }).length, 1,
    "100 的空档是这一层唯一的星号带");
  assert.strictEqual(column.height, 1024 - 85 - 180, "容器格子高＝收尾星号带残差（内容区可用高 − 前面像素带）");
  assert.strictEqual(column.nodeWidth, 600, "登记容器自身设计尺寸");
  assert.deepStrictEqual(designBoxAttrs(column),
    { Height: "320", VerticalAlignment: "Top" },
    "容器格子宽＝容器自身宽（不写 Width），格子高大于容器 → 贴起始边");
  assert.deepStrictEqual(designBoxAttrs(cells.get("side")),
    { Height: "48", VerticalAlignment: "Top" },
    "顶层控件落在自己的列带里（列宽＝控件宽），只表达纵向偏移");

  assert.strictEqual(cells.get("b1").height, 120, "格子高 = 控件 + 它后面的间距（80+40）");
  assert.strictEqual(cells.get("b1").offsetY, 0, "控件贴带起点");
  assert.deepStrictEqual(designBoxAttrs(cells.get("b1")),
    { Width: "170", Height: "80", HorizontalAlignment: "Left", VerticalAlignment: "Top" },
    "控件写自身尺寸 + 贴带起点（剩下 40 就是间距）");
  assert.ok(cells.get("b3").height > 0, "末条带吃剩余，尺寸为正");
}

// ── ③ 容器格子：主轴撑满（不写主轴尺寸/对齐），交叉轴照设计稿 ─────────────────────
{
  const columnOwner = { owner: { direction: "column" }, rows: [{ size: "Pixel", value: 120 }, { size: "Star", source: "design" }], columns: [{ size: "Star", source: "design" }] };
  const rowOwner = { owner: { direction: "row" }, rows: [{ size: "Star", source: "design" }], columns: [{ size: "Pixel", value: 638 }, { size: "Star", source: "design" }] };
  // 右栏：主轴 column → 高度不写（撑满格子，星号带吸收），位置偏移改用 Margin。
  assert.deepStrictEqual(containerBoxAttrs({
    ref: "rail", container: true, children: columnOwner,
    width: 210, height: 759, nodeWidth: 210, nodeHeight: 608, offsetX: 1, offsetY: 157
  }), { Margin: "0,157,0,0" }, "主轴那一维不写尺寸/对齐，偏移落成 Margin；交叉轴同尺寸也不写");
  // 左中区：主轴 row → 宽度不写；交叉轴照设计稿写尺寸，越过格子末端时锚点按上边。
  assert.deepStrictEqual(containerBoxAttrs({
    ref: "left", container: true, children: rowOwner,
    width: 1070, height: 759, nodeWidth: 1026, nodeHeight: 600, offsetX: 0, offsetY: 161
  }), { Height: "600", VerticalAlignment: "Top", Margin: "0,161,0,0" },
  "主轴撑满、交叉轴照设计稿；设计稿越过格子末端 → 锚点按上边 + Margin（窗口变化时不漂）");
}

// ── ④ 发射器：属性落到 XAML，并逐格进发射报告 ────────────────────────────────────
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
// 口径 A 下星号带只承载"大空档"，正常推导不会出现载体落进零尺寸星号带；这一节按格子级
// （手写布局 JSON）验证门禁对 unsized 的判别强度，形态与"溢出"一致。
{
  const types = {
    byRef: new Map([
      ["a", { ref: "a", controlType: "TextBlock", absX: 0, absY: 85, w: 40, h: 16 }],
      ["y1", { ref: "y1", controlType: "TextBlock", absX: 110, absY: 85, w: 80, h: 16 }],
      ["y2", { ref: "y2", controlType: "TextBlock", absX: 110, absY: 105, w: 80, h: 16 }]
    ])
  };
  // 手写布局：容器只有 100 宽，列定义 340 + 星号 → 星号带被前面的固定带吃光（重算为 0）。
  const derived = {
    schemaVersion: 1, adapter: "mw-wpf", pageTarget: "P", design: { width: 1280, height: 1024 },
    regions: [{
      id: "work-area", name: "工作区", ref: null, role: "work-area", emit: true,
      x: 0, y: 85, w: 1280, h: 759,
      grid: {
        rows: [{ size: "Star", source: "design" }],
        columns: [{ size: "Star", source: "design" }],
        cells: [{
          ref: "box", container: true, row: 0, column: 0, rowSpan: 1, columnSpan: 1,
          width: 1280, height: 759, nodeWidth: 100, nodeHeight: 60, offsetX: 0, offsetY: 0,
          children: {
            rows: [{ size: "Pixel", value: 20, source: "design" }, { size: "Star", source: "design" }],
            columns: [{ size: "Pixel", value: 340, source: "design" }, { size: "Star", source: "design" }],
            cells: [
              {
                ref: "a", controlType: "TextBlock", row: 0, column: 0, rowSpan: 1, columnSpan: 1,
                width: 340, height: 20, nodeWidth: 40, nodeHeight: 16, offsetX: 0, offsetY: 0
              },
              {
                ref: "y", controlType: "TextBlock", row: 1, column: 1, rowSpan: 1, columnSpan: 1,
                height: 40, nodeWidth: 300, nodeHeight: 20, offsetY: 0, unsized: { width: true }
              }
            ]
          }
        }]
      }
    }],
    pending: [], constraintExempt: []
  };
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
    grid.cells.forEach(function (cell) { if (cell.ref === "y") cell.height = 999; if (cell.children) find(cell.children); });
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
