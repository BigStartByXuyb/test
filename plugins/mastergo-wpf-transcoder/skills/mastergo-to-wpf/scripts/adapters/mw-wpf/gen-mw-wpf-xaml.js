#!/usr/bin/env node
"use strict";

// 作业A（mw-wpf）页面 XAML 发射器：把「布局产物 + 类型判定 + A 写法表」发射成真 WPF 页面
// （框架 `s:` 控件 + Grid 布局），产物形态对齐本框架真实页面（ManualView.xaml / AutoCutView.xaml）。
//
// 输入
//   --layout     Generated/<页面名>.wpf-layout.json（分区 → 行列 → 格子；由 gen-mw-wpf-layout.js 产出）
//   --types      Generated/<页面名>.component-types.json（或 mapping.json；取 ref/controlType/sourceText/bbox 等字段）
//   --map        references/adapters/mw-wpf/mw-wpf-map.json（写法表：元素名 / 样式族 / 文本与图形挂载点 / 协议）
//   --page       页面名（Target）
//   --x-class    UserControl 的 x:Class 全名（与 code-behind 一致，由宿主脚本给出）
//   --assembly   目标程序集名（页面 Icon 字典合并点用它拼 pack 路径）
//   --icon-page  页面 Icon 字典的项目相对路径（Resources/Pages/<页面名>/<页面名>Icons.xaml）
//   --out        发射目标 .xaml 路径
//   [--report]   发射报告落盘路径（命中的样式键 / 未命中变体 / 跳过项 / 逐格尺寸与对齐）
//   [--overwrite]
//
// 边界
//   - 只发射 `emit !== false` 的分区；框架固定区（顶部栏 / 底部栏）由框架渲染，本发射器不写。
//   - 外观只取写法表的样式族键，不散写颜色/边框/模板；写法表没有对应条目时 fail-closed。
//   - 协议属性（IOEnable / IOVisible / Click / PageName）只在类型判定给出取值时发射，不写空串占位。
//   - 文本一律走 `{DynamicResource <LangName>}`；没有语言键的文本走待确认，不写字面量。
//   - 尺寸与对齐照设计稿：控件写自身 bbox，格子尺寸与控件在格内的偏移取自布局产物；
//     格子尺寸 − 控件尺寸 = 间距，差值落在哪一侧由偏移决定（唯一实现在 lib/design-box.js）。

const fs = require("fs");
const path = require("path");
const {
  fail, xmlAttr, readJson
} = require(path.join(__dirname, "..", "..", "lib", "script-helpers.js"));
const { constraintAttributes } = require(path.join(__dirname, "..", "..", "lib", "constraints.js"));
const { designBoxAttrs } = require(path.join(__dirname, "..", "..", "lib", "design-box.js"));

function parseArgs(argv) {
  const args = { overwrite: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--overwrite") args.overwrite = true;
    else if (token === "--layout") args.layoutPath = argv[++i];
    else if (token === "--types") args.typesPath = argv[++i];
    else if (token === "--map") args.mapPath = argv[++i];
    else if (token === "--page") args.page = argv[++i];
    else if (token === "--x-class") args.xClass = argv[++i];
    else if (token === "--assembly") args.assembly = argv[++i];
    else if (token === "--icon-page") args.iconPage = argv[++i];
    else if (token === "--out") args.outPath = argv[++i];
    else if (token === "--report") args.reportPath = argv[++i];
    else fail("未知参数: " + token);
  }
  ["layoutPath", "typesPath", "mapPath", "page", "xClass", "outPath"].forEach(function (key) {
    if (!args[key]) fail("缺少参数: " + key);
  });
  return args;
}

// ---------- 形状校验：契约字段缺失一律报错，不静默兜底 ----------
function requireArray(value, label) {
  if (!Array.isArray(value)) fail(label + " 必须是数组");
  return value;
}

function loadLayout(layoutPath) {
  const layout = readJson(layoutPath, "布局产物");
  if (layout.adapter !== "mw-wpf") fail("布局产物的 adapter 必须是 mw-wpf: " + layoutPath);
  requireArray(layout.regions, "布局产物 regions");
  if (!layout.design || typeof layout.design.width !== "number" || typeof layout.design.height !== "number") {
    fail("布局产物缺少 design.width / design.height: " + layoutPath);
  }
  return layout;
}

function loadTypes(typesPath) {
  const types = readJson(typesPath, "类型判定产物");
  requireArray(types.nodes, "类型判定产物 nodes");
  const byRef = new Map();
  types.nodes.forEach(function (node) { byRef.set(node.ref, node); });
  return { types: types, byRef: byRef };
}

// 语言键：类型判定把它写在顶层 langName，IOContorl 写入规则写在 attrs.LangName —— 两者都认。
function langNameOf(node) {
  if (typeof node.langName === "string" && node.langName) return node.langName;
  const attrs = node.attrs || {};
  return typeof attrs.LangName === "string" && attrs.LangName ? attrs.LangName : null;
}

function iconNameOf(node) {
  if (typeof node.icon === "string" && node.icon) return node.icon;
  const attrs = node.attrs || {};
  if (typeof attrs.Icon === "string" && attrs.Icon) return attrs.Icon;
  return typeof node.runtimeIcon === "string" && node.runtimeIcon ? node.runtimeIcon : null;
}

// 变体名：类型判定给出时用它查样式族覆盖表；缺省即"页级默认样式"。
function variantOf(node) {
  for (const key of ["variant", "templateVariant", "matchVariant"]) {
    if (typeof node[key] === "string" && node[key]) return node[key];
  }
  const attrs = node.attrs || {};
  return typeof attrs.Variant === "string" && attrs.Variant ? attrs.Variant : null;
}

function specOf(map, controlType) {
  const spec = (map.controlTypes || {})[controlType];
  if (!spec) fail("写法表未登记该 ControlType: " + controlType);
  // 待确认类型（如 Border）挂待确认、不发射：与本路线其它未命中项的处置一致
  // （页面照常发射，待确认项进报告与门禁的警告清单，不静默猜测替代控件）。
  if (spec.status === "pending") return null;
  if (!spec.element) fail("写法表 " + controlType + " 缺少 element");
  return spec;
}

function resolveStyle(map, controlType, variant, report, ref) {
  const rules = map.styleRules || {};
  const byVariant = (rules.byVariant || {})[controlType] || {};
  if (variant && byVariant[variant]) {
    report.styleHits.push({ ref: ref, controlType: controlType, style: byVariant[variant], from: "byVariant:" + variant });
    return { style: byVariant[variant], pageLevel: false };
  }
  const pageDefault = (rules.pageDefault || {})[controlType] || null;
  if (pageDefault) {
    report.styleHits.push({ ref: ref, controlType: controlType, style: pageDefault, from: "pageDefault" });
    report.styleFallback.push({ ref: ref, controlType: controlType, variant: variant, style: pageDefault });
    // "implicit" = 框架隐式默认样式：既不写 Style，也不进页级 Resources（不能写成 BasedOn="{StaticResource null}"）。
    if (pageDefault === "implicit") return { style: null, pageLevel: false };
    return { style: pageDefault, pageLevel: true };
  }
  fail("写法表没有 " + controlType + " 的样式族：变体 " + (variant || "(缺)") + " 既不命中 byVariant，也没有 pageDefault");
  return null;
}

function textAttrFor(map, controlType, style) {
  const binding = ((map.textBinding || {}).byControlType || {})[controlType];
  if (!binding) fail("写法表 textBinding 未登记该 ControlType: " + controlType);
  const byStyle = binding.byStyle || {};
  return byStyle[style] || binding.default || null;
}

function iconAttrFor(map, controlType) {
  return ((map.iconBinding || {}).byControlType || {})[controlType] || null;
}

// ---------- 尺寸与位置 ----------
function rowDefinition(size) {
  if (!size || !size.size) fail("行列尺寸缺少 size");
  if (size.size === "Pixel") {
    if (typeof size.value !== "number") fail("Pixel 尺寸缺少数值: " + JSON.stringify(size));
    return "  <RowDefinition Height=\"" + xmlAttr(Math.round(size.value)) + "\" />";
  }
  if (size.size === "Auto") return "  <RowDefinition Height=\"Auto\" />";
  if (size.size === "Star") return "  <RowDefinition />";
  fail("未知的行列尺寸类型: " + size.size);
  return null;
}

function columnDefinition(size) {
  if (!size || !size.size) fail("行列尺寸缺少 size");
  if (size.size === "Pixel") {
    if (typeof size.value !== "number") fail("Pixel 尺寸缺少数值: " + JSON.stringify(size));
    return "  <ColumnDefinition Width=\"" + xmlAttr(Math.round(size.value)) + "\" />";
  }
  if (size.size === "Auto") return "  <ColumnDefinition Width=\"Auto\" />";
  if (size.size === "Star") return "  <ColumnDefinition />";
  fail("未知的行列尺寸类型: " + size.size);
  return null;
}

function indentOf(depth) { return "    ".repeat(depth); }

// 格子契约：设计稿格子尺寸必须由布局推导登记（跨格累加 + 收尾星号带残差）。缺了就没法表达
// "格子尺寸 − 控件尺寸 = 间距"，宁可停在这里，也不要发射一个尺寸静默丢失的页面。
// 例外有两类，都按维判定（只免掉真正没有真值的那一维）：
//   cell.shifted（为避让撞格被挪出设计带）——没有偏移真值，只写控件自身尺寸、不表达间距/对齐，
//     但格子尺寸照登记、缺了照样在这里失败（它照样会被写成 Width/Height）；
//   cell.unsized = {width?,height?}（该维算不出正数格子尺寸，内容溢出承载物）——该维允许缺尺寸。
function assertDesignBox(cell) {
  const unsized = cell.unsized || {};
  if (!(cell.width > 0) && !unsized.width) {
    fail("格子缺少设计稿格子宽（width）: " + cell.ref +
      "——布局产物必须由 gen-mw-wpf-layout.js 产出（旧产物没有这两个字段）");
  }
  if (!(cell.height > 0) && !unsized.height) {
    fail("格子缺少设计稿格子高（height）: " + cell.ref +
      "——布局产物必须由 gen-mw-wpf-layout.js 产出（旧产物没有这两个字段）");
  }
}

// 格子定位属性：只有多行/多列的 Grid 才写 Grid.Row/Column（单行单列不写，与真实页面一致），
// 跨格再写 RowSpan/ColumnSpan。控件与容器 Grid 共用同一套口径。
function gridCellAttrs(cell, ctx) {
  if (!ctx.gridIsMulti) return null;
  if (typeof cell.row !== "number" || typeof cell.column !== "number") {
    fail("格子里缺少 row/column: " + cell.ref);
  }
  const attrs = { "Grid.Row": String(cell.row), "Grid.Column": String(cell.column) };
  if (cell.rowSpan > 1) attrs["Grid.RowSpan"] = String(cell.rowSpan);
  if (cell.columnSpan > 1) attrs["Grid.ColumnSpan"] = String(cell.columnSpan);
  return attrs;
}

// 尺寸约束属性：来自布局格子（core/apply-constraints.js 合并进 DSL 节点、布局推导透传）。
// 键集与"未设置 = 0"的口径唯一实现在 lib/constraints.js；本函数只决定"有没有"。
function constraintAttrs(cell) {
  if (!cell || !cell.constraints) return null;
  const attrs = constraintAttributes(cell.constraints);
  return Object.keys(attrs).length ? attrs : null;
}

// 控件属性：顺序固定为 定位 → 约束 → 文本 → 图形 → 样式 → 协议，便于逐行比对真实页面。
function renderControl(node, cell, ctx, depth) {
  const spec = specOf(ctx.map, node.controlType);
  if (!spec) {
    ctx.report.pending.push({ ref: node.ref, reason: "写法表把 " + node.controlType + " 登记为待确认（无对应元素），未发射" });
    return null;
  }
  const attrs = node.attrs || {};
  // 控件是所在 <Grid> 的直接子元素，缩进比 <Grid> 深一级（attr 再深一级）。
  const pad = indentOf(depth) + "  ";

  const element = spec.element;
  const styleInfo = resolveStyle(ctx.map, node.controlType, variantOf(node), ctx.report, node.ref);
  if (styleInfo.style && styleInfo.pageLevel) ctx.pageLevelStyles.add(node.controlType + "|" + styleInfo.style);

  const attrLines = [];
  const attr = function (name, value) { attrLines.push([name, value]); };

  const cellAttrs = gridCellAttrs(cell, ctx);
  assertDesignBox(cell);
  if (cellAttrs) Object.keys(cellAttrs).forEach(function (name) { attr(name, cellAttrs[name]); });
  const constraintAttrLines = constraintAttrs(cell);
  if (constraintAttrLines) {
    Object.keys(constraintAttrLines).forEach(function (name) { attr(name, constraintAttrLines[name]); });
    // 文本控件只在有最大宽时补换行：没有最大宽的文本不该被改成换行形态。
    if (constraintAttrLines.MaxWidth && spec.element === "TextBlock") attr("TextWrapping", "Wrap");
  }

  // 尺寸与对齐照设计稿：格子尺寸取自布局产物（含跨格与星号带残差），控件写自身设计稿尺寸，
  // 两者的差就是间距；差值落在哪一侧由格子上的 offsetX/offsetY 决定（唯一实现在 lib/design-box.js）。
  const boxAttrLines = designBoxAttrs(cell);
  Object.keys(boxAttrLines).forEach(function (name) { attr(name, boxAttrLines[name]); });
  ctx.report.designBox.push({ ref: node.ref, container: false, attrs: boxAttrLines });

  const iconName = iconNameOf(node);
  const iconAttr = iconAttrFor(ctx.map, node.controlType);
  if (iconName) {
    if (!iconAttr) fail(node.controlType + " 在写法表里没有图形挂载属性，却带有图形: " + node.ref);
    attr(iconAttr, "{StaticResource " + iconName + "}");
  }

  const langName = langNameOf(node);
  const textAttr = textAttrFor(ctx.map, node.controlType, styleInfo.style);
  if (langName && textAttr) {
    attr(textAttr, "{DynamicResource " + langName + "}");
  } else if (langName && !textAttr) {
    fail(node.controlType + " 的文本挂载属性未登记（写法表 textBinding）：" + node.ref);
  } else if (!langName && (node.sourceText || "").trim()) {
    ctx.report.textPending.push({ ref: node.ref, controlType: node.controlType, text: node.sourceText });
  }

  if (styleInfo.style && !styleInfo.pageLevel) attr("Style", "{StaticResource " + styleInfo.style + "}");
  // 页级样式命中时不写 Style：外观由 <UserControl.Resources> 的 BasedOn 统一。

  // 协议挂载：只在类型判定给出取值时发射，不写空串占位（A 侧没有「必须恒写的宿主字段」）。
  (spec.protocols || []).forEach(function (protocol) {
    const name = String(protocol).split(/[={]/)[0].trim();
    if (!name) return;
    if (name.indexOf(":") >= 0) return; // 形如 "s:TextBoxAttach.TagName=…" 的附加属性单独处理
    const source = attrs[name] !== undefined ? attrs[name] : node[name];
    if (source === undefined || source === null || String(source).trim() === "") return;
    attr(name, String(source));
  });
  const tagName = attrs["s:TextBoxAttach.TagName"];
  if (typeof tagName === "string" && tagName.trim()) attr("s:TextBoxAttach.TagName", tagName);

  const lines = [];
  lines.push(pad + "<" + element);
  attrLines.forEach(function (pair) {
    lines.push(pad + "  " + pair[0] + "=\"" + xmlAttr(pair[1]) + "\"");
  });
  // 容器（写法表 holdsChildren）：子控件按嵌套 Grid 放进容器内容区，不允许平铺到外层格子里
  // ——平铺会让"分组框里的控件"跑出分组框，语义与外观都错。
  if (cell.children) {
    if (!spec.holdsChildren) fail(node.controlType + " 的格子里有子控件，但写法表没有登记 holdsChildren: " + node.ref);
    lines.push(pad + ">");
    lines.push(renderGrid(cell.children, ctx, depth + 1));
    lines.push(pad + "</" + element.trim() + ">");
  } else {
    lines.push(pad + "/>");
  }
  return lines.join("\n");
}

function renderGrid(grid, ctx, depth, gridAttrs) {
  requireArray(grid.rows, "grid.rows");
  requireArray(grid.columns, "grid.columns");
  requireArray(grid.cells, "grid.cells");
  const pad = indentOf(depth);
  const attrs = gridAttrs || {};
  const attrText = Object.keys(attrs).map(function (name) { return " " + name + "=\"" + xmlAttr(attrs[name]) + "\""; }).join("");
  const lines = [pad + "<Grid" + attrText + ">"];
  // 单行/单列不写行列定义：与真实页面一致（一维网格直接落子元素）。
  if (grid.rows.length > 1) {
    lines.push(pad + "  <Grid.RowDefinitions>");
    grid.rows.forEach(function (size) { lines.push(pad + "    " + rowDefinition(size).trim()); });
    lines.push(pad + "  </Grid.RowDefinitions>");
  }
  if (grid.columns.length > 1) {
    lines.push(pad + "  <Grid.ColumnDefinitions>");
    grid.columns.forEach(function (size) { lines.push(pad + "    " + columnDefinition(size).trim()); });
    lines.push(pad + "  </Grid.ColumnDefinitions>");
  }
  const multi = grid.rows.length > 1 || grid.columns.length > 1;
  const childCtx = Object.assign({}, ctx, { gridIsMulti: multi });
  grid.cells.forEach(function (cell) {
    const node = ctx.byRef.get(cell.ref);
    // 容器格子（产物里 container: true）：成层容器（flex 容器或带尺寸约束的容器）没有控件类型，
    // 它自己就是一层 <Grid>。
    if (cell.container) {
      if (!cell.children) fail("容器格子缺少内层 Grid: " + cell.ref);
      assertDesignBox(cell);
      // 容器 Grid 自己也照设计稿写尺寸与对齐：格子比容器大时，多出来的部分就是间距。
      const containerBox = designBoxAttrs(cell);
      ctx.report.designBox.push({ ref: cell.ref, container: true, attrs: containerBox });
      lines.push(renderGrid(cell.children, ctx, depth + 1, Object.assign({},
        gridCellAttrs(cell, childCtx) || {}, containerBox, constraintAttrs(cell) || {})));
      return;
    }
    if (!node) fail("格子引用的节点不在类型判定产物里: " + cell.ref);
    if (!node.controlType) fail("节点缺少 controlType: " + cell.ref);
    const rendered = renderControl(node, cell, childCtx, depth);
    if (rendered) lines.push(rendered);
  });
  lines.push(pad + "</Grid>");
  return lines.join("\n");
}

function renderResources(ctx) {
  const lines = ["  <UserControl.Resources>"];
  if (ctx.iconPage && ctx.assembly) {
    lines.push("    <ResourceDictionary Source=\"/" + ctx.assembly +
      ";component/" + ctx.iconPage + "\" />");
  }
  ctx.pageLevelStyles.forEach(function (entry) {
    const controlType = entry.split("|")[0];
    const style = entry.split("|")[1];
    const element = specOf(ctx.map, controlType).element;
    lines.push("    <Style TargetType=\"{x:Type " + element + "}\" BasedOn=\"{StaticResource " +
      style + "}\" />");
  });
  lines.push("  </UserControl.Resources>");
  return lines.join("\n");
}

// 纯渲染：给定布局产物 + 类型判定 + 写法表，返回 { xaml, report }（不落盘）。
function renderXaml(args, layout, typeInfo, map) {
  const report = {
    styleHits: [], styleFallback: [], textPending: [], skippedRegions: [], pending: layout.pending || [],
    // 每个格子发射的尺寸/对齐（门禁按 lib/design-box.js 的同一实现复核）。
    designBox: []
  };
  const ctx = {
    map: map, byRef: typeInfo.byRef, report: report,
    pageLevelStyles: new Set(), iconPage: args.iconPage || null,
    assembly: args.assembly || null, gridIsMulti: false
  };

  const bodyLines = [];
  const emitRegions = [];
  requireArray(layout.regions, "布局产物 regions");
  layout.regions.forEach(function (region) {
    if (region.emit === false) {
      report.skippedRegions.push({ id: region.id, role: region.role, reason: "框架固定区不进页面" });
      return;
    }
    if (!region.grid) fail("发射分区缺少 grid: " + region.id);
    emitRegions.push(region);
  });
  // 分区模型固定为「框架固定区（不发射：顶部栏 / 底部栏）+ 一个内容区」：外层唯一的 Grid 就是内容网格本身，
  // 不再套「根 Grid + Grid.Row」的包裹层。
  if (emitRegions.length !== 1) {
    fail("布局产物必须恰好有一个发射分区（内容区），当前 " + emitRegions.length + " 个: " +
      emitRegions.map(function (region) { return region.id; }).join(", "));
  }
  bodyLines.push(renderGrid(emitRegions[0].grid, ctx, 1, null));

  const head = [
    "<UserControl x:Class=\"" + args.xClass + "\"",
    "             xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\"",
    "             xmlns:x=\"http://schemas.microsoft.com/winfx/2006/xaml\"",
    "             xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\"",
    "             xmlns:d=\"http://schemas.microsoft.com/expression/blend/2008\"",
    "             xmlns:s=\"http://www.maxwell-gp.com/\"",
    "             mc:Ignorable=\"d\"",
    "             FocusVisualStyle=\"{x:Null}\"",
    "             d:DesignHeight=\"" + xmlAttr(Math.round(layout.design.height)) +
      "\" d:DesignWidth=\"" + xmlAttr(Math.round(layout.design.width)) + "\">"
  ];
  // 页级样式表要在 Resources 生成之前定稿，所以先渲染一遍 body 收集命中，再拼最终文本。
  const body = bodyLines.join("\n");
  const xaml = head.join("\n") + "\n" + renderResources(ctx) + "\n" + body + "\n</UserControl>\n";
  return { xaml: xaml, report: report };
}

function emit(args, layout, typeInfo, map) {
  const result = renderXaml(args, layout, typeInfo, map);
  if (fs.existsSync(args.outPath) && !args.overwrite) {
    fail("目标已存在，未覆盖: " + args.outPath);
  }
  fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
  fs.writeFileSync(args.outPath, result.xaml, "utf8");
  if (args.reportPath) {
    fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
    fs.writeFileSync(args.reportPath, JSON.stringify(result.report, null, 2) + "\n", "utf8");
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const layout = loadLayout(args.layoutPath);
  const typeInfo = loadTypes(args.typesPath);
  const map = readJson(args.mapPath, "A 写法表");
  const result = emit(args, layout, typeInfo, map);
  console.log(JSON.stringify({
    out: args.outPath,
    page: args.page,
    regions: requireArray(layout.regions, "regions").filter(function (r) { return r.emit !== false; }).length,
    skippedRegions: result.report.skippedRegions.length,
    styleHits: result.report.styleHits.length,
    styleFallback: result.report.styleFallback.length,
    textPending: result.report.textPending.length,
    designBox: result.report.designBox.length,
    pending: result.report.pending.length
  }, null, 2));
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { renderXaml, emit, loadLayout, loadTypes };
