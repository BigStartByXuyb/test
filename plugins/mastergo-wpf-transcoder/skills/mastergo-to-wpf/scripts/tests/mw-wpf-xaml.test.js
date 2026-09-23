#!/usr/bin/env node
"use strict";

// 作业A（mw-wpf）页面 XAML 发射器回归：
//   1) 发射形态对齐真实页面（UserControl 头 / Resources 合并本页 Icon 字典 / Grid 行列 / Grid.Row / 语言键 / 形状资源）；
//   2) 框架固定区（顶部栏 / 底部栏）不发射；
//   3) 未登记类型（写法表 status=pending）与取不到样式族的变体一律 fail-closed；
//   4) 没有语言键的文本不写字面量，进 textPending；
//   5) 目标已存在且未加 --overwrite 时拒绝覆盖。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT_DIR = path.join(__dirname, "..");
const XAML_SCRIPT = path.join(SCRIPT_DIR, "adapters", "mw-wpf", "gen-mw-wpf-xaml.js");
const ROUTE_MAP = path.join(SCRIPT_DIR, "..", "references", "adapters", "mw-wpf", "mw-wpf-map.json");

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mw-wpf-xaml-"));
let caseIndex = 0;

function writeJson(name, value) {
  const file = path.join(tmpRoot, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
  return file;
}

function baseLayout(overrides = {}) {
  return Object.assign({
    schemaVersion: 1,
    adapter: "mw-wpf",
    pageTarget: "SamplePage",
    design: { width: 1280, height: 1024 },
    regions: [
      {
        id: "top-strip", name: "顶部栏", ref: "root/top", role: "framework-top", emit: false,
        x: 0, y: 0, w: 1280, h: 90,
        grid: {
          rows: [{ size: "Pixel", value: 90, source: "framework:MaxwellFramework_HeaderHeight" }],
          columns: [{ size: "Star", source: "design" }],
          cells: [{ ref: "root/top/btn", controlType: "IconButton", row: 0, column: 0, rowSpan: 1, columnSpan: 1 }]
        }
      },
      {
        id: "work-area", name: "工作区", ref: "root/work", role: "work-area", emit: true,
        x: 0, y: 90, w: 1280, h: 682,
        grid: {
          rows: [{ size: "Pixel", value: 160, source: "design" }, { size: "Star", source: "design" }],
          columns: [{ size: "Pixel", value: 600, source: "design" }, { size: "Star", source: "design" }],
          cells: [
            { ref: "work/group", controlType: "GroupBox", row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
            { ref: "work/enter", controlType: "IconButton", row: 0, column: 1, rowSpan: 1, columnSpan: 1 },
            { ref: "work/label", controlType: "TextBlock", row: 1, column: 0, rowSpan: 1, columnSpan: 1 }
          ]
        }
      }
    ],
    pending: []
  }, overrides);
}

function baseTypes(nodes) {
  return { schemaVersion: 1, nodes: nodes, pending: [], unmappedComponents: [] };
}

const NODES = [
  {
    ref: "work/group", sourceRef: "work/group", controlType: "GroupBox", variant: "信息分组-模块化",
    sourceText: "设定XY轴位置", absX: 658, absY: 514, w: 200, h: 160, langName: "SamplePageSetXYAxisPosition"
  },
  {
    ref: "work/enter", sourceRef: "work/enter", controlType: "IconButton", variant: "enter",
    sourceText: "ENTER", absX: 1090, absY: 606, w: 170, h: 80, langName: "SamplePageEnter", icon: "EnterGeometry"
  },
  {
    ref: "work/label", sourceRef: "work/label", controlType: "TextBlock",
    sourceText: "工件厚度", absX: 16, absY: 106, w: 120, h: 30, langName: "SamplePageWorkpieceThickness"
  },
  {
    ref: "root/top/btn", sourceRef: "root/top/btn", controlType: "IconButton",
    sourceText: "顶部按钮", absX: 10, absY: 10, w: 100, h: 60, langName: "SamplePageTopButton"
  }
];

function run(args, expectFailure) {
  const result = spawnSync(process.execPath, [XAML_SCRIPT].concat(args), { encoding: "utf8" });
  if (expectFailure) {
    assert.notStrictEqual(result.status, 0, "应当失败却成功了: " + result.stdout);
    return result.stderr + result.stdout;
  }
  assert.strictEqual(result.status, 0, result.stderr);
  return result.stdout;
}

function emitArgs(layoutPath, typesPath, outPath, extra = []) {
  caseIndex += 1;
  return [
    "--layout", layoutPath, "--types", typesPath, "--map", ROUTE_MAP,
    "--page", "SamplePage", "--x-class", "MaxWell.SLGPages.F2.View.SamplePageView",
    "--assembly", "MaxWell.SLGPages",
    "--icon-page", "Resources/Pages/SamplePage/SamplePageIcons.xaml",
    "--out", outPath
  ].concat(extra);
}

// 1) 正常发射：形态与真实页面一致。
{
  const layoutPath = writeJson("layout.ok.json", baseLayout());
  const typesPath = writeJson("types.ok.json", baseTypes(NODES));
  const outPath = path.join(tmpRoot, "ok", "SamplePageView.xaml");
  const reportPath = path.join(tmpRoot, "ok", "report.json");
  run(emitArgs(layoutPath, typesPath, outPath, ["--report", reportPath, "--overwrite"]));
  const xaml = fs.readFileSync(outPath, "utf8");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

  assert.match(xaml, /^<UserControl x:Class="MaxWell\.SLGPages\.F2\.View\.SamplePageView"/,
    "UserControl 头必须带清单给出的 x:Class");
  assert.match(xaml, /xmlns:s="http:\/\/www\.maxwell-gp\.com\/"/, "必须声明框架命名空间 s");
  assert.match(xaml, /FocusVisualStyle="\{x:Null\}"/, "焦点视觉必须关闭（与真实页面一致）");
  assert.match(xaml, /d:DesignHeight="1024" d:DesignWidth="1280"/, "设计尺寸取布局产物的 design");
  assert.match(xaml,
    /<ResourceDictionary Source="\/MaxWell\.SLGPages;component\/Resources\/Pages\/SamplePage\/SamplePageIcons\.xaml" \/>/,
    "必须合并本页 Icon 字典（作业A 用 StaticResource 引用图形，缺合并点会在加载期抛异常）");
  assert.match(xaml, /<Style TargetType="\{x:Type TextBlock\}" BasedOn="\{StaticResource TextBlockStyle\}" \/>/,
    "TextBlock 走页级 BasedOn");
  assert.match(xaml, /<Grid\.RowDefinitions>/, "多行必须写行定义");
  assert.match(xaml, /<RowDefinition Height="160" \/>/, "行尺寸照设计稿像素");
  assert.match(xaml, /<RowDefinition \/>/, "星号尺寸写成裸 RowDefinition");
  assert.match(xaml, /<s:IconButton\n\s+Grid\.Row="0"\n\s+Grid\.Column="1"/, "控件落格必须写 Grid.Row/Grid.Column");
  assert.match(xaml, /Icon="\{StaticResource EnterGeometry\}"/, "图形走 StaticResource");
  // RightButtonStyle 是「图标上 + 文字下」，文本挂 IconText（见写法表 textBinding.byStyle）。
  assert.match(xaml, /IconText="\{DynamicResource SamplePageEnter\}"/, "文本走 DynamicResource 语言键，并挂到样式族对应的属性");
  assert.match(xaml, /Style="\{StaticResource RightButtonStyle\}"/, "enter 变体走 RightButtonStyle");
  assert.match(xaml, /Header="\{DynamicResource SamplePageSetXYAxisPosition\}"/, "GroupBox 文本挂 Header");
  assert.match(xaml, /Style="\{StaticResource IOGroupBoxSecondary\}"/, "信息分组-模块化 走 IOGroupBoxSecondary");
  assert.ok(!xaml.includes("顶部按钮"), "框架固定区里的控件不得发射");
  assert.ok(!xaml.includes("SamplePageTopButton"), "框架固定区里的文本不得发射");
  assert.strictEqual(report.skippedRegions.length, 1, "跳过的框架固定区要进报告");
  assert.strictEqual(report.skippedRegions[0].role, "framework-top");
  assert.strictEqual(report.textPending.length, 0);
}

// 2) 未登记/待确认类型（写法表 status=pending，当前是 Border）→ 挂待确认、不发射（与作业B 的 pending 处置一致）。
{
  const layout = baseLayout();
  layout.regions[1].grid.cells = [{ ref: "work/border", controlType: "Border", row: 0, column: 0, rowSpan: 1, columnSpan: 1 }];
  const layoutPath = writeJson("layout.pendingtype.json", layout);
  const typesPath = writeJson("types.pendingtype.json", baseTypes([
    { ref: "work/border", sourceRef: "work/border", controlType: "Border", absX: 0, absY: 0, w: 10, h: 10 }
  ]));
  const outPath = path.join(tmpRoot, "pendingtype", "View.xaml");
  const reportPath = path.join(tmpRoot, "pendingtype", "report.json");
  run(emitArgs(layoutPath, typesPath, outPath, ["--report", reportPath, "--overwrite"]));
  const xaml = fs.readFileSync(outPath, "utf8");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.ok(!xaml.includes("s:Border") && !xaml.includes("<Border"), "待确认类型不得发射成任何控件");
  assert.strictEqual(report.pending.length, 1);
  assert.match(report.pending[0].reason, /待确认/);
}

// 3) 变体取不到样式族（GroupBox 未登记变体）→ fail-closed，并指出是哪个变体。
{
  const layout = baseLayout();
  layout.regions[1].grid.cells = [{ ref: "work/group", controlType: "GroupBox", row: 0, column: 0, rowSpan: 1, columnSpan: 1 }];
  const layoutPath = writeJson("layout.novariant.json", layout);
  const typesPath = writeJson("types.novariant.json", baseTypes([
    { ref: "work/group", sourceRef: "work/group", controlType: "GroupBox", sourceText: "分组", absX: 0, absY: 0, w: 200, h: 160, langName: "SamplePageGroup" }
  ]));
  const out = run(emitArgs(layoutPath, typesPath, path.join(tmpRoot, "novariant", "View.xaml")), true);
  assert.match(out, /样式族/, "必须指出取不到样式族");
  assert.match(out, /\(缺\)/, "变体缺省要显式写出");
}

// 4) 有文本但无语言键 → 不写字面量，进 textPending。
{
  const layout = baseLayout();
  layout.regions[1].grid.cells = [{ ref: "work/label", controlType: "TextBlock", row: 1, column: 0, rowSpan: 1, columnSpan: 1 }];
  const layoutPath = writeJson("layout.nolang.json", layout);
  const typesPath = writeJson("types.nolang.json", baseTypes([
    { ref: "work/label", sourceRef: "work/label", controlType: "TextBlock", sourceText: "工件厚度", absX: 16, absY: 106, w: 120, h: 30 }
  ]));
  const outPath = path.join(tmpRoot, "nolang", "View.xaml");
  const reportPath = path.join(tmpRoot, "nolang", "report.json");
  run(emitArgs(layoutPath, typesPath, outPath, ["--report", reportPath, "--overwrite"]));
  const xaml = fs.readFileSync(outPath, "utf8");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.ok(!xaml.includes("工件厚度"), "没有语言键的文本不得写成字面量");
  assert.strictEqual(report.textPending.length, 1);
  assert.strictEqual(report.textPending[0].text, "工件厚度");
}

// 5) 目标已存在且未加 --overwrite → 拒绝覆盖。
{
  const layoutPath = writeJson("layout.exists.json", baseLayout());
  const typesPath = writeJson("types.exists.json", baseTypes(NODES));
  const outPath = path.join(tmpRoot, "exists", "View.xaml");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, "<!-- 既有产物 -->\n", "utf8");
  const out = run(emitArgs(layoutPath, typesPath, outPath), true);
  assert.match(out, /已存在/);
  assert.strictEqual(fs.readFileSync(outPath, "utf8"), "<!-- 既有产物 -->\n", "拒绝覆盖时原文件必须逐字节不变");
}

// 6) 隐式默认样式（pageDefault="implicit"，如 Camera）：不写 Style、也不许进页级 Resources
//    ——曾经错写成 BasedOn="{StaticResource null}"，被资源键门禁 R6 拦下。
{
  const layout = baseLayout();
  layout.regions[1].grid.cells = [{ ref: "work/camera", controlType: "Camera", row: 0, column: 0, rowSpan: 1, columnSpan: 1 }];
  const layoutPath = writeJson("layout.implicit.json", layout);
  const typesPath = writeJson("types.implicit.json", baseTypes([
    { ref: "work/camera", sourceRef: "work/camera", controlType: "Camera", absX: 0, absY: 0, w: 200, h: 150 }
  ]));
  const outPath = path.join(tmpRoot, "implicit", "View.xaml");
  run(emitArgs(layoutPath, typesPath, outPath, ["--overwrite"]));
  const xaml = fs.readFileSync(outPath, "utf8");
  assert.match(xaml, /<s:Camera/, "Camera 按写法表发射成 s:Camera");
  assert.ok(!xaml.includes("StaticResource null"), "隐式默认样式不得写成 BasedOn=\"{StaticResource null}\"");
  assert.ok(!/BasedOn="\{StaticResource [^}]*\}" \/>\s*$/m.test(xaml.split("<s:Camera")[0].split("<UserControl.Resources>")[1] || ""),
    "隐式默认样式不得进页级 Resources");
}

console.log("PASS 作业A 页面 XAML 发射（形态 / 固定区 / fail-closed / 语言键 / 覆盖保护）回归测试");
