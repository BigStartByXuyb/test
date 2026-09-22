#!/usr/bin/env node
"use strict";

// 作业A（mw-wpf）布局门禁：布局产物 + 类型判定 + A 写法表（可选再查发射出的 View.xaml）逐条断言。
//
// CLI
//   node check-wpf-layout.js --layout <Generated/<页面名>.wpf-layout.json>
//        --types <类型判定 json 或 mapping.json> --map <mw-wpf-map.json>
//        [--xaml <发射出的 View.xaml>] [--json <报告路径>]
//
// 退出码：0 通过；2 有 findings（门禁失败）；1 输入/契约错误。
//
// 条目（编号固定）
//   R1 禁止写法：发射区出现写法表未登记或登记为待确认的类型；框架固定区里出现控件
//   R2 协议语法：XAML 里的协议属性必须是写法表登记过的形状
//   R3 格子越界：row/column/rowSpan/columnSpan 必须落在本 region 的行列范围内
//   R4 空行空列：没有格子覆盖、也不是被星号撑开的收尾行/列
//   R5 同格冲突：同一格多控件必须各自带互斥条件（IOVisible / IOEnable 表达式且互不相同）
//   R6 资源键闭环：{StaticResource <键>} 必须来自写法表样式族、本页 Icon 台账或 Icon 字典合并点
//   R7 文本零硬编码中文：发射区不得出现字面中文
//   R8 尺寸来源：框架固定区必须是 framework:<Token>，其余必须是 design

const fs = require("fs");
const path = require("path");
const { readJson } = require(path.join(__dirname, "..", "..", "lib", "script-helpers.js"));

const findings = [];
const counts = {};

function report(rule, ref, message) {
  findings.push({ rule: rule, ref: ref || null, message: message });
  counts[rule] = (counts[rule] || 0) + 1;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--layout") args.layoutPath = argv[++i];
    else if (token === "--types") args.typesPath = argv[++i];
    else if (token === "--map") args.mapPath = argv[++i];
    else if (token === "--xaml") args.xamlPath = argv[++i];
    else if (token === "--json") args.reportPath = argv[++i];
    else if (token === "--icon-map") args.iconMapPath = argv[++i];
    else {
      console.error("未知参数: " + token);
      process.exit(1);
    }
  }
  ["layoutPath", "typesPath", "mapPath"].forEach(function (key) {
    if (!args[key]) {
      console.error("缺少参数: " + key);
      process.exit(1);
    }
  });
  return args;
}

function checkCells(region, map, layout) {
  const spec = (map.controlTypes || {})[region.role === "framework-top" || region.role === "framework-bottom" ? "" : ""];
  void spec;
  const rows = region.grid.rows.length;
  const columns = region.grid.columns.length;
  const seen = new Map();
  region.grid.cells.forEach(function (cell) {
    const entry = (map.controlTypes || {})[cell.controlType];
    if (region.emit === false) {
      report("R1", cell.ref, "框架固定区（" + region.id + "）里不得有控件");
      return;
    }
    if (!entry || entry.status === "pending") {
      report("R1", cell.ref, "写法表未登记或登记为待确认的类型: " + cell.controlType);
      return;
    }
    const rowSpan = cell.rowSpan || 1;
    const columnSpan = cell.columnSpan || 1;
    if (cell.row < 0 || cell.column < 0 || cell.row + rowSpan > rows || cell.column + columnSpan > columns) {
      report("R3", cell.ref, "格子越界: row=" + cell.row + "/" + rows + " column=" + cell.column + "/" + columns);
    }
    const key = cell.row + ":" + cell.column;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(cell);
  });
  if (region.emit === false) return;

  // R4：空行空列（收尾的星号行/列除外——它就是用来吃掉剩余空间的）。
  const coveredRows = new Set();
  const coveredColumns = new Set();
  region.grid.cells.forEach(function (cell) {
    for (let r = cell.row; r < cell.row + (cell.rowSpan || 1); r += 1) coveredRows.add(r);
    for (let c = cell.column; c < cell.column + (cell.columnSpan || 1); c += 1) coveredColumns.add(c);
  });
  region.grid.rows.forEach(function (size, index) {
    if (!coveredRows.has(index) && !(index === rows - 1 && size.size === "Star")) {
      report("R4", region.id, "第 " + (index + 1) + " 行没有控件覆盖（也不是收尾星号行）");
    }
  });
  region.grid.columns.forEach(function (size, index) {
    if (!coveredColumns.has(index) && !(index === columns - 1 && size.size === "Star")) {
      report("R4", region.id, "第 " + (index + 1) + " 列没有控件覆盖（也不是收尾星号列）");
    }
  });

  // R5：同格多控件必须各自带互斥条件。
  seen.forEach(function (list, key) {
    if (list.length < 2) return;
    const conditions = list.map(function (cell) { return cell.exclusive || null; });
    const missing = list.filter(function (cell) { return !cell.exclusive; });
    if (missing.length || new Set(conditions).size !== conditions.length) {
      report("R5", null, "同一个格子 " + key + " 上有 " + list.length + " 个控件但缺少互斥条件（IOVisible/IOEnable 且互不相同）");
    }
  });

  // R8：尺寸来源。
  const isFramework = /^framework-/.test(region.role || "");
  region.grid.rows.concat(region.grid.columns).forEach(function (size) {
    if (!size || !size.source) {
      report("R8", region.id, "行列尺寸缺少 source");
      return;
    }
    if (isFramework && size.source.indexOf("framework:") !== 0) {
      report("R8", region.id, "框架固定区尺寸必须用 framework:<Token>，当前: " + size.source);
    }
    if (!isFramework && size.source !== "design") {
      report("R8", region.id, "发射区尺寸必须取设计稿（source=design），当前: " + size.source);
    }
  });
}

// 协议属性：写法表里登记过、且在真实页面里出现的形状（Click / PageName / IOEnable / IOVisible / IOName）。
function checkProtocols(cell, entry) {
  const protocols = new Set((entry.protocols || []).map(function (text) { return String(text).split(/[={]/)[0].trim(); }));
  Object.keys(cell.protocols || {}).forEach(function (name) {
    if (!protocols.has(name)) report("R2", cell.ref, "未登记协议属性: " + name + "（写法表 " + cell.controlType + " 未登记）");
  });
}

function checkStyleKeys(layout, map, iconNames, xamlText) {
  const styleKeys = new Set();
  Object.values(map.controlTypes || {}).forEach(function (entry) {
    (entry.styleKeys || []).forEach(function (key) { styleKeys.add(key); });
  });
  const referenced = new Set();
  if (xamlText) {
    const matches = xamlText.match(/\{StaticResource\s+([^}]+?)\s*\}/g) || [];
    matches.forEach(function (match) { referenced.add(match.replace(/^\{StaticResource\s+/, "").replace(/\}$/, "").trim()); });
  }
  layout.regions.forEach(function (region) {
    (region.grid.cells || []).forEach(function (cell) {
      Object.values(cell.staticResources || {}).forEach(function (key) { referenced.add(key); });
    });
  });
  referenced.forEach(function (key) {
    if (styleKeys.has(key)) return;
    if (iconNames.has(key)) return;
    report("R6", null, "StaticResource 键既不在写法表样式族、也不在本页 Icon 台账: " + key);
  });
}

function checkHardcodedText(xamlText, layout, typesByRef) {
  const literal = /(?:Text|Content|Header|IconText)\s*=\s*"([^"{}]*[\u4e00-\u9fa5][^"{}]*)"/g;
  if (xamlText) {
    let match;
    while ((match = literal.exec(xamlText)) !== null) {
      report("R7", null, "文本必须走 {DynamicResource <LangName>}，不得写字面文案: " + match[1]);
    }
  }
  layout.regions.forEach(function (region) {
    if (region.emit === false) return;
    (region.grid.cells || []).forEach(function (cell) {
      const node = typesByRef.get(cell.ref);
      if (!node) return;
      const hasLang = Boolean(node.langName || (node.attrs && node.attrs.LangName));
      const text = String(node.sourceText || "").trim();
      if (text && !hasLang && !cell.textPending) {
        report("R7", cell.ref, "有设计文本但没有语言键（必须产键挂 DynamicResource）: " + text);
      }
    });
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const layout = readJson(args.layoutPath, "布局产物");
  const map = readJson(args.mapPath, "A 写法表");
  const types = readJson(args.typesPath, "类型判定产物");
  if (!Array.isArray(layout.regions) || !Array.isArray(types.nodes)) {
    console.error("布局产物必须有 regions、类型判定必须有 nodes");
    process.exit(1);
  }
  const typesByRef = new Map(types.nodes.map(function (node) { return [node.ref, node]; }));
  const iconNames = new Set();
  (types.runtimeIcons || []).forEach(function (icon) { if (icon.name) iconNames.add(icon.name); });
  if (args.iconMapPath && fs.existsSync(args.iconMapPath)) {
    readJson(args.iconMapPath, "图标台账").icons.forEach(function (icon) { if (icon.name) iconNames.add(icon.name); });
  }
  types.nodes.forEach(function (node) {
    const name = node.icon || (node.attrs && node.attrs.Icon);
    if (name) iconNames.add(name);
  });
  const xamlText = args.xamlPath && fs.existsSync(args.xamlPath) ? fs.readFileSync(args.xamlPath, "utf8") : null;

  layout.regions.forEach(function (region) {
    if (!region.grid) {
      report("R3", region.id, "分区缺少 grid");
      return;
    }
    checkCells(region, map, layout);
    (region.grid.cells || []).forEach(function (cell) {
      const entry = (map.controlTypes || {})[cell.controlType];
      if (entry && entry.status !== "pending") checkProtocols(cell, entry);
    });
  });
  checkStyleKeys(layout, map, iconNames, xamlText);
  checkHardcodedText(xamlText, layout, typesByRef);

  const result = { status: findings.length ? "fail" : "pass", findings: findings, counts: counts };
  // 待确认项（写法表未登记的类型等）不是门禁失败，但必须出现在报告里供交付说明引用。
  result.pending = Array.isArray(layout.pending) ? layout.pending : [];
  if (args.reportPath) {
    fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
    fs.writeFileSync(args.reportPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  }
  console.log(JSON.stringify(result, null, 2));
  if (findings.length) process.exitCode = 2;
}

try { main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }

module.exports = { findings };
