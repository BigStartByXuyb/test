#!/usr/bin/env node
"use strict";

// 作业A（mw-wpf）布局门禁：布局产物 + 类型判定 + A 写法表（可选再查发射出的 View.xaml）逐条断言。
//
// CLI（本门禁各条目的入参前提以本块为唯一真值源，文档不复述）
//   node check-wpf-layout.js --layout <Generated/<页面名>.wpf-layout.json>
//        --types <类型判定 json 或 mapping.json> --map <mw-wpf-map.json>
//        [--xaml <发射出的 View.xaml>] [--xaml-report <发射器报告>] [--dsl <带约束的 DSL 快照>]
//        [--icon-map <本页图标台账>] [--json <报告路径>]
//   入参前提：--dsl 是 R11 / R12 / R13 的前提（不传这三条整体跳过；R13 还要 --xaml 才能比对发射结果）；
//   --xaml-report 是 R14 的前提（不传整条跳过）；--xaml 对 R13 是前提，对 R6 / R7 只是可选输入
//   （不传只少校验 XAML 侧那一半，布局产物侧照常检查）。
//
// 退出码：0 通过；2 有 findings（门禁失败）；1 输入/契约错误。
//
// 条目（编号固定）
//   R1 禁止写法：发射区出现写法表未登记/待确认的类型（Border）；框架固定区里出现控件
//   R2 协议属性名：--types 产物节点的 attrs 里，凡属协议属性名集合（由写法表 protocols 派生）的键，
//                  必须在该类型的 protocols 里登记过（不校验取值形状；布局格子不承载协议属性）
//   R3 格子越界：row/column/rowSpan/columnSpan 必须落在本 region 的行列范围内
//   R4 空行空列：没有格子覆盖、也不是被星号撑开的收尾行/列
//   R5 锚点格冲突：同一锚点格（Grid.Row/Column 起点）只允许一个控件（推导用占用表 + 行下移保证唯一）
//   R10 待人工确认（提示）：页面用到写法表 manual-only 类型（证据不全，如 Camera 只有用户确认）
//   R11 尺寸约束一致性：格子带的 min/max 宽高必须与 DSL 节点上的 constraints 逐个一致（多/少/改值都失败）
//   R12 尺寸约束未落格：DSL 里带尺寸约束的节点在布局产物里没有对应格子、也不在该产物登记的
//       constraintExempt 里即失败。豁免的节点只有 constraintExempt 里登记的三类（页面根 / 不可见 /
//       框架固定区，提示不失败）；其余未落格的带约束节点一律失败——常见成因与处置（不封闭枚举）：
//       容器子树里没有可发射的控件（补内容或交设计确认）、待确认类型 / 无尺寸等不进格子的节点
//       （先按 R1 / R9 修类型判定与映射）、产物与本次输入不同步（先重跑第 8 步）
//   R13 尺寸约束未发射：带约束的格子必须在 View.xaml 里出现对应的 MinWidth/MaxWidth/MinHeight/MaxHeight
//   R14 格子尺寸与尺寸/对齐发射：每个格子必须登记格子尺寸与承载物设计尺寸（含跨格累加、收尾星号带残差），
//       且发射报告里该格子的 Width/Height/对齐/Margin 必须与 lib/design-box.js 的同一实现一致
//   R6 资源键闭环：{StaticResource <键>} 必须来自写法表样式族、本页 Icon 台账或 Icon 字典合并点
//   R7 文本零硬编码中文：发射区不得出现字面中文
//   R8 尺寸来源：框架固定区必须是 framework:<Token>，其余必须是 design
//   R9 推导待确认：布局推导阶段挂起的节点（未归格 / 无尺寸 / 结构对不上 / 类型无处发射）逐条失败

const fs = require("fs");
const path = require("path");
const { readJson } = require(path.join(__dirname, "..", "..", "lib", "script-helpers.js"));
const {
  CONSTRAINT_KEYS, CONSTRAINT_ATTRS, normalizeConstraints, collectConstraints
} = require(path.join(__dirname, "..", "..", "lib", "constraints.js"));
const { designBoxAttrs } = require(path.join(__dirname, "..", "..", "lib", "design-box.js"));
const {
  bandExtents, extentOf, contentSizeOf
} = require(path.join(__dirname, "gen-mw-wpf-layout.js"));

const findings = [];
const counts = {};
const manualOnlyTypes = new Set();

// 提示（notice）：不失败、不进 findings，只在报告里登记事实。
// 目标框架允许 Grid 出现空行空列（框架自身控件模板里就有空列），保留空列还能让后续控件保持设计稿坐标，
// 因此"空行空列"只作为提示登记。
const notices = [];

function report(rule, ref, message) {
  findings.push({ rule: rule, ref: ref || null, message: message });
  counts[rule] = (counts[rule] || 0) + 1;
}

function notice(rule, ref, message) {
  notices.push({ rule: rule, ref: ref || null, message: message });
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
    else if (token === "--dsl") args.dslPath = argv[++i];
    else if (token === "--xaml-report") args.xamlReportPath = argv[++i];
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

// 尺寸约束（min/max 宽高）：来源是 core/apply-constraints.js 合并进 DSL 的 node.constraints。
// 布局推导只透传，因此这里逐格比对：格子的约束必须与 DSL 完全一致，且必须真的发射进 XAML。
function checkConstraints(layout, dslConstraints, xamlText) {
  if (!dslConstraints) return;
  const placedRefs = new Set();
  const visit = function (grid) {
    if (!grid || !Array.isArray(grid.cells)) return;
    grid.cells.forEach(function (cell) {
      placedRefs.add(cell.ref);
      const expected = normalizeConstraints(dslConstraints[cell.ref]);
      const actual = normalizeConstraints(cell.constraints);
      CONSTRAINT_KEYS.forEach(function (key) {
        if (expected[key] !== actual[key]) {
          report("R11", cell.ref, "尺寸约束与 DSL 不一致：" + key + " 期望 " +
            (expected[key] === undefined ? "未设置" : expected[key]) + "，布局产物为 " +
            (actual[key] === undefined ? "未设置" : actual[key]));
        }
        if (xamlText && actual[key] && xamlText.indexOf(CONSTRAINT_ATTRS[key] + '="' + Math.round(actual[key]) + '"') < 0) {
          report("R13", cell.ref, "尺寸约束未发射到 XAML：缺少 " + CONSTRAINT_ATTRS[key] + '="' + Math.round(actual[key]) + '"');
        }
      });
      if (cell.children) visit(cell.children);
    });
  };
  (layout.regions || []).forEach(function (region) { visit(region.grid); });
  // 本页不发射的节点（页面根 / 不可见 / 框架固定区）由布局推导登记豁免原因：约束不落格是它的应有状态。
  const exemptReasons = new Map();
  (layout.constraintExempt || []).forEach(function (item) { exemptReasons.set(item.ref, item.reason); });
  Object.keys(dslConstraints).forEach(function (ref) {
    if (placedRefs.has(ref)) return;
    if (exemptReasons.has(ref)) {
      notice("R12", ref, "本页不发射该节点（" + exemptReasons.get(ref) + "），尺寸约束不落格");
      return;
    }
    report("R12", ref, "DSL 里带尺寸约束的节点在布局产物里没有对应格子，也不在产物登记的 constraintExempt 里（豁免与处置见 page-build-rules.md 第 5 节第 4 条）");
  });
}

// R14：格子尺寸与"尺寸/对齐"发射。逐格复核两件事：
//   ① 布局产物自己算出来的格子尺寸必须与按行列定义（含跨格累加、收尾星号带残差）重算的一致；
//   ② 发射报告里该格子的 Width/Height/对齐/Margin 必须等于 lib/design-box.js 的同一实现给出的结果。
// 判据只比对集合与取值，不判断成因；产物与输入不同步同样命中。
function checkDesignBoxes(layout, emission) {
  const emitted = new Map();
  (emission.designBox || []).forEach(function (item) {
    if (!item || !item.ref) return;
    if (emitted.has(item.ref)) report("R14", item.ref, "发射报告里同一个格子出现两次");
    emitted.set(item.ref, item.attrs || {});
  });
  const seen = new Set();
  const visitGrid = function (grid, size) {
    const columnExtents = bandExtents(grid.columns || [], size.w);
    const rowExtents = bandExtents(grid.rows || [], size.h);
    (grid.cells || []).forEach(function (cell) {
      seen.add(cell.ref);
      const width = extentOf(columnExtents, cell.column, cell.columnSpan);
      const height = extentOf(rowExtents, cell.row, cell.rowSpan);
      // 撞格下移的格子没有设计稿偏移真值：期望值仍是 designBoxAttrs(cell)（有格子尺寸就写控件自身尺寸、
      // 不写对齐），只把"不是设计稿那条带"这件事登记成提示，不失败。
      // 维度判定一律按维：cell.unsized 只免掉真正算不出的那一维，另一维照常重算与比对。
      if (cell.shifted) {
        notice("R14", cell.ref, "该格子由推导挪位（撞格下移），不是设计稿那条带：只写控件自身尺寸，不表达间距（没有偏移真值）");
      }
      const unsized = cell.unsized || {};
      [["width", cell.width, width], ["height", cell.height, height]].forEach(function (axis) {
        const name = axis[0];
        const size = axis[1];
        const recomputed = axis[2];
        const label = name === "width" ? "格子宽" : "格子高";
        if (!(size > 0)) {
          if (cell.shifted) return;   // 撞格下移的格子本来就没有设计稿尺寸，上面已登记提示
          if (unsized[name]) {
            notice("R14", cell.ref, "该格子的" + (name === "width" ? "宽" : "高") +
              "算不出正数（所在带超出承载物）：该维不表达尺寸与间距");
            return;
          }
          report("R14", cell.ref, "布局产物没有登记" + label + "（推导必须登记：跨格累加 + 收尾星号带残差）");
          return;
        }
        if (!cell.shifted && size !== recomputed) {
          report("R14", cell.ref, label + "与行列定义重算不一致：产物 " + size + "，重算 " + recomputed);
        }
      });
      if (!cell.shifted && (!(cell.nodeWidth > 0) || !(cell.nodeHeight > 0))) {
        report("R14", cell.ref, "布局产物没有登记承载物设计尺寸（nodeWidth / nodeHeight）");
      }
      const expected = designBoxAttrs(cell);
      const actual = emitted.get(cell.ref);
      if (!actual) {
        report("R14", cell.ref, "发射报告里没有这个格子的尺寸/对齐记录");
      } else {
        const names = new Set(Object.keys(expected).concat(Object.keys(actual)));
        names.forEach(function (name) {
          if (String(expected[name]) !== String(actual[name])) {
            report("R14", cell.ref, "尺寸/对齐与设计稿不一致：" + name + " 期望 " +
              (expected[name] === undefined ? "不写" : expected[name]) + "，发射为 " +
              (actual[name] === undefined ? "不写" : actual[name]));
          }
        });
      }
      if (cell.children) visitGrid(cell.children, contentSizeOf(cell));
    });
  };
  (layout.regions || []).forEach(function (region) {
    if (region.emit === false || !region.grid) return;
    visitGrid(region.grid, { w: region.w, h: region.h });
  });
  emitted.forEach(function (attrs, ref) {
    if (!seen.has(ref)) report("R14", ref, "发射报告里有布局产物中不存在的格子");
  });
}

function checkCells(region, map, layout) {
  const rows = region.grid.rows.length;
  const columns = region.grid.columns.length;
  // R8 先判：框架固定区是 emit:false，走不到下面的发射区断言，尺寸来源检查必须在这之前跑。
  const isFramework = /^framework-/.test(region.role || "");
  region.grid.rows.concat(region.grid.columns).forEach(function (size) {
    if (!size || !size.source) {
      report("R8", region.id, "行列尺寸缺少 source");
      return;
    }
    // 框架固定区只在**被框架钉住的那一维**上用 Token（顶部栏 / 底部栏都钉在高度上）；
    // 另一维是自由伸展的星号，来源仍是设计稿。
    if (isFramework && size.size === "Pixel" && size.source.indexOf("framework:") !== 0) {
      report("R8", region.id, "框架固定区的固定尺寸必须用 framework:<Token>，当前: " + size.source);
    }
    if (!isFramework && size.source !== "design") {
      report("R8", region.id, "发射区尺寸必须取设计稿（source=design），当前: " + size.source);
    }
  });
  const seen = new Map();
  region.grid.cells.forEach(function (cell) {
    const entry = (map.controlTypes || {})[cell.controlType];
    if (region.emit === false) {
      report("R1", cell.ref, "框架固定区（" + region.id + "）里不得有控件");
      return;
    }
    // 容器格子（成层容器：flex 容器或带尺寸约束的容器）没有控件类型：类型检查交给内层 Grid 里的控件。
    if (!cell.container && (!entry || entry.status === "pending")) {
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

  // R4：空行空列 → 提示，不失败（框架允许；收尾的星号行/列本来就是用来吃掉剩余空间的）。
  const coveredRows = new Set();
  const coveredColumns = new Set();
  region.grid.cells.forEach(function (cell) {
    for (let r = cell.row; r < cell.row + (cell.rowSpan || 1); r += 1) coveredRows.add(r);
    for (let c = cell.column; c < cell.column + (cell.columnSpan || 1); c += 1) coveredColumns.add(c);
  });
  region.grid.rows.forEach(function (size, index) {
    if (!coveredRows.has(index) && !(index === rows - 1 && size.size === "Star")) {
      notice("R4", region.id, "第 " + (index + 1) + " 行没有控件覆盖（也不是收尾星号行）");
    }
  });
  region.grid.columns.forEach(function (size, index) {
    if (!coveredColumns.has(index) && !(index === columns - 1 && size.size === "Star")) {
      notice("R4", region.id, "第 " + (index + 1) + " 列没有控件覆盖（也不是收尾星号列）");
    }
  });

  // R5：同一**锚点格**（Grid.Row + Grid.Column 起点）只允许一个控件。布局产物由推导机械生成，
  // 推导用占用表 + 撞格下移保证锚点格唯一，所以重复只可能来自产物被改坏——直接失败。
  seen.forEach(function (list, key) {
    if (list.length < 2) return;
    report("R5", null, "同一个锚点格 " + key + " 上有 " + list.length + " 个控件（推导保证锚点格唯一，重复即布局产物损坏）");
  });

}

// 协议属性：写法表里登记过、且在真实页面里出现的形状（Click / PageName / IOEnable / IOVisible / IOName）。
// 协议属性名：写法表 protocols 的一条登记里可能用 + / 、 / ； 连接多个属性，也可能带中文前缀
// （如「只读点位：IOName="…" + IOEnable="false" + IsAutoRead="True"」），逐个拆出来取属性名。
function protocolNamesOf(text) {
  return String(text).split(/[+、；;]/).map(function (part) {
    // 形如 "i:InvokeCommandAction Command={Binding …}" 的登记，属性名取空格前的那个标识符。
    const name = part.split(/[={]/)[0].split("：").pop().trim().split(/\s+/)[0];
    return /^[A-Za-z][A-Za-z0-9.:]*$/.test(name) ? name : null;
  }).filter(Boolean);
}

// R2 读 --types 产物节点的 attrs 键名（步骤 8 传类型判定产物，步骤 11/12 传 mapping 定稿），
// 只校验属性名是否在该类型的写法表 protocols 里登记，不校验取值形状——布局格子只登记落格信息。
function checkProtocols(cell, entry, node, protocolAttrs) {
  const allowed = new Set();
  (entry.protocols || []).forEach(function (text) {
    protocolNamesOf(text).forEach(function (name) { allowed.add(name); });
  });
  Object.keys((node && node.attrs) || {}).forEach(function (name) {
    if (!protocolAttrs.has(name)) return;
    if (!allowed.has(name)) report("R2", cell.ref, "未登记协议属性: " + name + "（写法表 " + cell.controlType + " 未登记）");
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
    // 容器内的子控件（格子里的嵌套 Grid）同样要过 R1/R3/R4/R5/R8：**递归**到与发射端同深度，
    // 否则"分组框套分组框"时内层子控件会落在门禁看不到的地方。
    const walkNested = function (grid) {
      (grid.cells || []).forEach(function (cell) {
        if (!cell.children) return;
        checkCells(Object.assign({}, region, { grid: cell.children }), map, layout);
        walkNested(cell.children);
      });
    };
    walkNested(region.grid);
    // 协议检查同样要递归到每一层 Grid——新容器层让"容器里的控件"不在顶层 cells 里了；
    // 协议属性来源是类型判定产物的 attrs。
    const protocolAttrs = new Set();
    Object.values(map.controlTypes || {}).forEach(function (entry) {
      (entry.protocols || []).forEach(function (text) {
        protocolNamesOf(text).forEach(function (name) { protocolAttrs.add(name); });
      });
    });
    const walkProtocols = function (grid) {
      (grid.cells || []).forEach(function (cell) {
        if (!cell.container) {
          const entry = (map.controlTypes || {})[cell.controlType];
          if (entry && entry.status !== "pending") checkProtocols(cell, entry, typesByRef.get(cell.ref), protocolAttrs);
          if (entry && entry.status === "manual-only") manualOnlyTypes.add(cell.controlType);
        }
        if (cell.children) walkProtocols(cell.children);
      });
    };
    walkProtocols(region.grid);
  });
  // R10：manual-only 类型（证据不全：有手册条目但真实页面未出现，或只有用户确认）不阻断，
  // 但必须登记成提示，让"首次生成需人工确认、事后补齐缺的证据"有可观测落点。
  manualOnlyTypes.forEach(function (type) {
    notice("R10", null, "写法表把 " + type + " 记为 manual-only（证据不全）：发射前需人工确认，事后补齐缺的证据（真实页面或手册条目）");
  });
  checkStyleKeys(layout, map, iconNames, xamlText);
  checkHardcodedText(xamlText, layout, typesByRef);

  // R11/R12/R13：尺寸约束。--dsl 传的是 core/apply-constraints.js 产出的带 constraints 的快照；
  // 没传就整体跳过这三条（旧流水线行为不变）。
  let dslConstraints = null;
  if (args.dslPath) {
    const snapshot = readJson(args.dslPath);
    const roots = (snapshot.dsl && snapshot.dsl.nodes) || snapshot.nodes || [];
    dslConstraints = collectConstraints(roots);
  }
  checkConstraints(layout, Object.keys(dslConstraints || {}).length ? dslConstraints : null, xamlText);

  // R14：格子尺寸与尺寸/对齐发射。--xaml-report 传的是发射器的报告（gen-mw-wpf-xaml.js --report）；
  // 没传就整体跳过（旧流水线行为不变）。
  if (args.xamlReportPath) {
    checkDesignBoxes(layout, readJson(args.xamlReportPath, "发射报告"));
  }

  // 推导阶段的待确认项（R9）：类型无处发射、节点没归格、节点没有尺寸、结构对不上——逐条报出来，
  // 不能与 R1 的"写法表未登记"混在一条消息里（两类的排障方向不同）。
  const pending = Array.isArray(layout.pending) ? layout.pending : [];
  pending.forEach(function (item) {
    report("R9", item.ref || null, "推导阶段待确认：" + (item.reason || ""));
  });

  const result = { status: findings.length ? "fail" : "pass", findings: findings, counts: counts, notices: notices, pending: pending };
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
