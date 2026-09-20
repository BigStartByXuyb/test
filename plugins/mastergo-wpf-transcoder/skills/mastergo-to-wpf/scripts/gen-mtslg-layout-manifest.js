#!/usr/bin/env node
"use strict";

// 从 DSL 快照 + 页面 Icon 映射 + 模板表机械推导 Layout 清单（menuItems），
// 替代"人工往 bundle JSON 里写菜单"。规则见 feishu-layout-mapping.md。
//
// 用法:
//   node gen-mtslg-layout-manifest.js --dsl <dsl.snapshot.json> --icon-map <page.icon-map.json>
//        --map <mtslg-iocontrol-map.json> --page-target <Target> --page-lang-name <LangName>
//        --layout-path <Layout.xml> --out <layout-manifest.json> [--report <report.json>]

const fs = require("fs");
const path = require("path");

const SCRIPT_DIR = __dirname;
const DEFAULT_MAP = path.resolve(SCRIPT_DIR, "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const { fail, normalizeNewlines } = require(path.join(SCRIPT_DIR, "lib", "script-helpers.js"));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) out[key] = true;
    else { out[key] = value; i += 1; }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
for (const field of ["dsl", "icon-map", "page-target", "layout-path", "out"]) {
  if (!args[field]) fail("缺少参数 --" + field);
}

const dslSnapshot = JSON.parse(fs.readFileSync(path.resolve(args.dsl), "utf8"));
const iconMap = JSON.parse(fs.readFileSync(path.resolve(args["icon-map"]), "utf8"));
const templateMap = JSON.parse(fs.readFileSync(path.resolve(args.map || DEFAULT_MAP), "utf8"));
const bottomBar = templateMap.layoutRules && templateMap.layoutRules.bottomBar;
if (!bottomBar || !bottomBar.variants) fail("模板表缺少 layoutRules.bottomBar（底部栏变体表）");

const residentPattern = new RegExp(bottomBar.residentGroupPattern || "常驻(button|按钮|分组)");
const fKeyPattern = new RegExp(bottomBar.fKeyPattern || "^F\\d+$");
const decorPattern = new RegExp(bottomBar.decorativeNamePattern || "背景|分割");
const variantNames = new Set(Object.keys(bottomBar.variants));
// 底部栏变体的匹配键（真值来源：模板表 layoutRules.bottomBar.match，一族一个键）：
//   componentName = true                → 变体值 = 被引用组件的名字（实例的 name）
//   property = "<属性名>"               → 变体值 = 该公开属性的值
// 未登记匹配键时不做匹配（该实例计入 unresolvedBottomBarItems）。
const bottomBarMatch = bottomBar.match || {};
// 底部栏标记的判定参数（真值来源：模板表 layoutRules.bottomBar.menuItemFlags）。
const flagSpec = bottomBar.menuItemFlags || {};
const redSpec = flagSpec.redText || {};
const statusSpec = flagSpec.statusBox || {};
const RED_MIN_RED = Number.isFinite(Number(redSpec.minRed)) ? Number(redSpec.minRed) : 180;
const RED_MAX_GREEN_BLUE = Number.isFinite(Number(redSpec.maxGreenBlue)) ? Number(redSpec.maxGreenBlue) : 100;
const STATUS_MIN_SIZE = Number.isFinite(Number(statusSpec.minSize)) ? Number(statusSpec.minSize) : 8;
const STATUS_MAX_SIZE = Number.isFinite(Number(statusSpec.maxSize)) ? Number(statusSpec.maxSize) : 32;
const STATUS_MAX_OFFSET_X = Number.isFinite(Number(statusSpec.maxOffsetX)) ? Number(statusSpec.maxOffsetX) : 20;
const STATUS_MAX_OFFSET_Y = Number.isFinite(Number(statusSpec.maxOffsetY)) ? Number(statusSpec.maxOffsetY) : 20;
// 状态方框只可能是 GROUP / LAYER（实测：状态方框 = GROUP 组 2492 + 两个 LAYER 矩形；
// 图标 = INSTANCE + PATH，F 键提示 = TEXT），因此按节点类型排除即可区分。
const STATUS_NODE_TYPES = Array.isArray(statusSpec.nodeTypes) && statusSpec.nodeTypes.length
  ? new Set(statusSpec.nodeTypes.map(String))
  : new Set(["GROUP", "LAYER"]);
const STATUS_EXCLUDE_ICON = statusSpec.excludeIconSubtree === undefined ? true : Boolean(statusSpec.excludeIconSubtree);

const root = dslSnapshot.dsl && Array.isArray(dslSnapshot.dsl.nodes) ? dslSnapshot.dsl.nodes[0] : null;
if (!root) fail("DSL 快照缺少 dsl.nodes[0]");

const nodeById = new Map();
(function walk(node, parent) {
  nodeById.set(node.id, node);
  nodeById.set(String(node.id).split("/").pop(), node);
  node.__parent = parent;
  for (const child of node.children || []) walk(child, node);
})(root, null);

const iconByRef = new Map();
const iconBySourceId = new Map();
for (const icon of iconMap.icons || []) {
  if (icon.sourceRef) iconByRef.set(icon.sourceRef, icon);
  if (icon.sourceId) iconBySourceId.set(icon.sourceId, icon);
}

// extractSvg 会把几何完全相同的复用实例去重，导致"同一个图标被第二次使用"时映射表里没有条目。
// 因此再建一份"几何指纹 → 图标"索引作为回退（指纹 = 子树里所有 PATH 的 d + transform）。
function geometryKeyOf(node) {
  const parts = [];
  (function walk(current) {
    for (const entry of current.path || []) {
      if (entry && typeof entry.data === "string") parts.push(entry.data + "|" + (entry.transform || ""));
    }
    for (const child of current.children || []) walk(child);
  })(node);
  return parts.length ? parts.join("||") : "";
}

const iconByGeometry = new Map();
for (const icon of iconMap.icons || []) {
  const geometryNode = nodeById.get(icon.sourceRef || icon.sourceId);
  if (!geometryNode) continue;
  const key = geometryKeyOf(geometryNode);
  if (key && !iconByGeometry.has(key)) iconByGeometry.set(key, icon);
}

function childrenOf(node) { return (node.children || []).slice(); }

// ---------- 底部栏标记推导：红字文案 / 左上角状态方框 ----------
// 红字 → MenuItem 写 IsNeedRedMark="true"；左上角有状态方框 → 写 IsShowStatus="true"。
// 两者都只取设计稿事实（文案 TEXT 的颜色 / 组件内的方框节点），取不到就不写。
function colorOf(node) {
  if (!node) return "";
  if (typeof node._color === "string" && node._color.trim()) return node._color.trim();
  const styles = dslSnapshot.dsl && dslSnapshot.dsl.styles ? dslSnapshot.dsl.styles : {};
  const paint = node.fill && styles[node.fill] ? styles[node.fill].value : null;
  const first = Array.isArray(paint) ? paint[0] : paint;
  return typeof first === "string" ? first.trim() : "";
}

function isRedColor(value) {
  const match = /^#([0-9a-fA-F]{6})$/.exec(String(value || "").trim());
  if (!match) return false;
  const r = parseInt(match[1].slice(0, 2), 16);
  const g = parseInt(match[1].slice(2, 4), 16);
  const b = parseInt(match[1].slice(4, 6), 16);
  return r >= RED_MIN_RED && g <= RED_MAX_GREEN_BLUE && b <= RED_MAX_GREEN_BLUE;
}

// 菜单项左上角的状态方框：宽高在阈值内、相对菜单项左上角偏移在阈值内。
// 必须排除 TEXT 文本、PATH 图形以及图标子树（否则左上角的小图标会被误判成状态方框）。
function hasStatusBox(node) {
  const excluded = new Set();
  if (STATUS_EXCLUDE_ICON) {
    const iconEntry = iconEntryOf(node);
    const iconNode = iconEntry ? nodeById.get(iconEntry.sourceRef || iconEntry.sourceId) : null;
    if (iconNode) {
      (function mark(current) {
        excluded.add(current.id);
        for (const child of current.children || []) mark(child);
      })(iconNode);
    }
  }
  let found = false;
  (function walk(current, absX, absY) {
    if (found) return;
    for (const child of current.children || []) {
      if (excluded.has(child.id)) continue;
      const ls = child.layoutStyle || {};
      const x = absX + (Number(ls.relativeX) || 0);
      const y = absY + (Number(ls.relativeY) || 0);
      const w = Number(ls.width) || 0;
      const h = Number(ls.height) || 0;
      const isCandidateType = STATUS_NODE_TYPES.has(String(child.type || ""));
      if (isCandidateType && w >= STATUS_MIN_SIZE && w <= STATUS_MAX_SIZE &&
          h >= STATUS_MIN_SIZE && h <= STATUS_MAX_SIZE &&
          x <= STATUS_MAX_OFFSET_X && y <= STATUS_MAX_OFFSET_Y) {
        found = true;
        return;
      }
      walk(child, x, y);
      if (found) return;
    }
  })(node, 0, 0);
  return found;
}

// 底部栏按钮按"视觉行序"排列：先按 y 分行（同一行内 y 差不超过行高的一半视为同行），行内按 x。
function visualOrder(entries) {
  const items = entries.map(function (entry) {
    const ls = entry.node.layoutStyle || {};
    return {
      entry: entry,
      node: entry.node,
      x: Number(entry.absX !== undefined ? entry.absX : ls.relativeX) || 0,
      y: Number(entry.absY !== undefined ? entry.absY : ls.relativeY) || 0,
      height: Number(ls.height) || 0,
    };
  });
  const tolerance = Math.max(4, (items.reduce(function (sum, item) { return sum + item.height; }, 0) /
    Math.max(items.length, 1)) / 2);
  items.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
  const rows = [];
  for (const item of items) {
    const row = rows[rows.length - 1];
    if (!row || item.y - row.y > tolerance) rows.push({ y: item.y, items: [item] });
    else row.items.push(item);
  }
  return rows.reduce(function (all, row) {
    return all.concat(row.items.slice().sort(function (a, b) { return a.x - b.x; }));
  }, []);
}

// 底部栏容器 = 直接子节点里含"右下角常驻分组"的那个容器。
// 候选守卫：设计稿可能在页面根级**额外复制**一份常驻分组（与底栏内那份同组件、不同节点 id），
// 此时页面根节点也满足"直接子节点里含常驻分组"，只取深度最先命中的候选会把整个页面当成底栏，
// 把真实页面控件（信息分组 / 输入框 / 单选多选 / 选择框 / 右侧栏）全部记成 unresolvedBottomBarItems。
// 因此与 icon-ownership 同一判据：**多条命中取树深度最深（最专属）的候选**，全部候选写进 report 供复核。
const barCandidates = [];
(function collectBarCandidates(node, depth) {
  if (childrenOf(node).some(function (child) {
    return child.type === "INSTANCE" && typeof child.name === "string" && residentPattern.test(child.name);
  })) barCandidates.push({ node: node, depth: depth });
  for (const child of childrenOf(node)) collectBarCandidates(child, depth + 1);
})(root, 0);
if (!barCandidates.length) fail("未找到底部栏容器（子节点里没有常驻分组）: " + args["page-target"]);
barCandidates.sort(function (a, b) { return b.depth - a.depth; });
const bar = barCandidates[0].node;

const barChildren = childrenOf(bar);
// 底栏内的常驻分组：用于菜单推导与 unresolved 判定（常驻分组内的实例既不是菜单项、也不计入 unresolved）。
const residentGroups = barChildren.filter(function (child) {
  return child.type === "INSTANCE" && typeof child.name === "string" && residentPattern.test(child.name);
});
// 审计口径：residentGroupItems 统计**整个页面 DSL** 里的常驻分组实例，
// 与 Bundle 的 validateResidentGroupEvidence 同一口径（映射 sourceNodes 里所有常驻分组的 INSTANCE 子节点）。
// 设计稿可能在页面根级额外复制一份常驻分组，此时底栏内只有一组、整页有两组：
// 若这里只数底栏内那一组，Bundle 会因数量不一致硬失败（并要求人工改清单），所以按 DSL 事实登记。
// 由此带来的口径：matchedBottomBarItems = menuItems.length + residentGroupItems 也会把底栏外那份
// 副本算进去（与 feishu-layout-mapping.md 的换算式一致）；差异在 note 里写明（"DSL 里共 N 组，底栏内 M 项"），
// 需要"只统计底栏内"的数量时应以 note 里的底栏内数字为准。
const allResidentGroups = [];
(function collectResidentGroups(node) {
  for (const child of childrenOf(node)) {
    if (child.type === "INSTANCE" && typeof child.name === "string" && residentPattern.test(child.name)) {
      allResidentGroups.push(child);
    }
    collectResidentGroups(child);
  }
})(root);
const countResidentItems = function (groups) {
  return groups.reduce(function (sum, group) {
    return sum + childrenOf(group).filter(function (child) {
      return child.type === "INSTANCE" && !decorPattern.test(child.name || "");
    }).length;
  }, 0);
};
const residentGroupItems = countResidentItems(allResidentGroups);
const residentGroupItemsInBar = countResidentItems(residentGroups);

// 唯一的底部栏变体解析入口：按登记的键取值，命中 variants 才返回（与组件模板族同一套机制）。
function resolveBottomBarVariant(node) {
  if (!node || node.type !== "INSTANCE") return "";
  if (bottomBarMatch.componentName === true) {
    return typeof node.name === "string" && variantNames.has(node.name) ? node.name : "";
  }
  if (typeof bottomBarMatch.property === "string") {
    const props = (node.componentInfo && node.componentInfo.properties) || {};
    const value = props[bottomBarMatch.property];
    return typeof value === "string" && variantNames.has(value) ? value : "";
  }
  return "";
}

function isBottomBarVariant(node) {
  return resolveBottomBarVariant(node) !== "";
}

const residentRefs = new Set(residentGroups.map(function (node) { return node.id; }));
// 底部栏里既非装饰、又不在常驻分组、也没命中变体的实例：必须报出来，不允许静默丢按钮。
const unresolvedNodes = barChildren.filter(function (child) {
  return child.type === "INSTANCE" && !decorPattern.test(child.name || "") &&
    !residentRefs.has(child.id) && !isBottomBarVariant(child);
});
// 参与排序的按钮 = 底部菜单按钮 + 常驻分组内的按钮
// （后者参与视觉排序以便按设计稿顺序排列菜单项，但既不生成 MenuItem、也不占 Index）
const orderedEntries = visualOrder(
  barChildren.filter(isBottomBarVariant).map(function (node) { return { node: node, resident: false }; }).concat(
    residentGroups.reduce(function (all, group) {
      const groupStyle = group.layoutStyle || {};
      for (const child of childrenOf(group)) {
        if (child.type !== "INSTANCE" || decorPattern.test(child.name || "")) continue;
        const childStyle = child.layoutStyle || {};
        all.push({
          node: child,
          resident: true,
          absX: (Number(groupStyle.relativeX) || 0) + (Number(childStyle.relativeX) || 0),
          absY: (Number(groupStyle.relativeY) || 0) + (Number(childStyle.relativeY) || 0),
        });
      }
      return all;
    }, [])
  )
);
const candidateEntries = orderedEntries.filter(function (item) { return !item.entry.resident; });
if (process.env.DEBUG_LAYOUT_MANIFEST) {
  orderedEntries.forEach(function (item, i) {
    console.error('  ' + (i + 1) + ') ' + String(item.node.id).split('/').pop() + ' ' +
      (item.node.name || '') + ' x=' + item.x + ' y=' + item.y + (item.entry.resident ? ' [常驻]' : ''));
  });
}

function textNodesOf(node) {
  const out = [];
  (function walk(node) {
    for (const child of node.children || []) {
      if (Array.isArray(child.text) && child.text.length) {
        // 文案取值：换行码点归一成 LF（发射时由 xmlAttr 写成 &#x0a;），与页面 XML 同一口径。
        out.push({
          node: child,
          text: normalizeNewlines(child.text.map(function (part) { return part.text || ""; }).join(""))
        });
      }
      walk(child);
    }
  })(node);
  return out;
}

function iconEntryOf(node) {
  let hit = null;
  (function walk(current) {
    if (hit) return;
    hit = iconByRef.get(current.id) || iconBySourceId.get(current.id) || null;
    for (const child of current.children || []) walk(child);
  })(node);
  if (!hit) {
    const key = geometryKeyOf(node);
    if (key) hit = iconByGeometry.get(key) || null;
  }
  return hit;
}

const raw = candidateEntries.map(function (item) {
  const node = item.node;
  // Index = 菜单项自己的连续序号（从 1 起，按底部栏视觉顺序）。
  // 右下角常驻分组的按钮由框架单独处理，不占 Index，因此这里按"会生成 MenuItem 的按钮"计数，
  // 而不是按底栏物理槽位计数——底栏槽位含常驻按钮时不会把空档带进 Index。
  const position = candidateEntries.indexOf(item) + 1;
  const texts = textNodesOf(node);
  const nameText = texts.find(function (entry) { return !fKeyPattern.test(entry.text); });
  const fKeyText = texts.find(function (entry) { return fKeyPattern.test(entry.text); });
  const iconEntry = iconEntryOf(node);
  const geometryNode = iconEntry ? nodeById.get(iconEntry.sourceRef || iconEntry.sourceId) : null;
  return {
    ref: node.id,
    position: position,
    variant: resolveBottomBarVariant(node),
    name: nameText ? nameText.text : "",
    topLeftContent: fKeyText ? fKeyText.text : "",
    // 红字文案（实测 #F8274B）→ IsNeedRedMark；左上角状态方框 → IsShowStatus。
    labelColor: nameText ? colorOf(nameText.node) : "",
    isNeedRedMark: nameText ? isRedColor(colorOf(nameText.node)) : false,
    isShowStatus: hasStatusBox(node),
    icon: iconEntry ? iconEntry.name : "",
    iconSize: geometryNode ? {
      width: geometryNode.layoutStyle.width,
      height: geometryNode.layoutStyle.height,
      sourceRef: geometryNode.id,
    } : null,
  };
});

// 文本一律照抄设计稿（不做"占位符"判定、不登记默认值）。
const menuItems = raw.map(function (item) {
  const out = {
    sourceRef: item.ref,
    name: item.name,
    icon: item.icon,
  };
  if (item.icon && item.iconSize) out.iconSize = item.iconSize;
  // 布尔标记只在成立时写；不成立不发射该属性。
  if (item.isNeedRedMark) out.isNeedRedMark = true;
  if (item.isShowStatus) out.isShowStatus = true;
  if (bottomBar.variants[item.variant] && bottomBar.variants[item.variant].topLeftContent !== "none") {
    out.topLeftContent = item.topLeftContent;
  }
  out.index = item.position;
  return out;
});

const manifest = {
  layoutPath: args["layout-path"],
  pageTarget: args["page-target"],
  pageLangName: args["page-lang-name"] === undefined ? "" : args["page-lang-name"],
  layoutStatus: menuItems.length + residentGroupItems === 0 ? "none" : "complete",
  layoutEvidence: {
    matchedBottomBarItems: menuItems.length + residentGroupItems,
    unresolvedBottomBarItems: unresolvedNodes.length,
    residentGroupItems: residentGroupItems,
    note: "由 gen-mtslg-layout-manifest.js 从 DSL 机械推导：底部栏 " + bar.id +
      "，菜单项 " + menuItems.length + " 项，" +
      (allResidentGroups.length > 1
        ? "右下角常驻分组 " + residentGroupItems + " 项（DSL 里共 " + allResidentGroups.length +
          " 组，底栏内 " + residentGroupItemsInBar + " 项）"
        : "右下角常驻分组 " + residentGroupItems + " 项") +
      "不生成 MenuItem、不占 Index（框架单独处理），Index 按菜单项从 1 连续编号，文本按设计稿原样写入；" +
      "未命中变体的实例 " + unresolvedNodes.length + " 个" +
      (unresolvedNodes.length
        ? "（" + unresolvedNodes.map(function (node) { return node.id + " " + JSON.stringify(node.name); }).join("、") + "）"
        : "") + "。",
  },
  menuItems: menuItems,
};

fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
fs.writeFileSync(path.resolve(args.out), JSON.stringify(manifest, null, 2) + "\n", "utf8");
if (args.report) {
  fs.writeFileSync(path.resolve(args.report), JSON.stringify({
    pageTarget: args["page-target"],
    bottomBarRef: bar.id,
    barCandidates: barCandidates.map(function (candidate) {
      return {
        ref: candidate.node.id,
        name: candidate.node.name || "",
        depth: candidate.depth,
        selected: candidate.node === bar,
      };
    }),
    residentGroups: residentGroups.map(function (node) { return { ref: node.id, name: node.name }; }),
    residentGroupItems: residentGroupItems,
    menuItems: menuItems.map(function (item) {
      return {
        index: item.index, sourceRef: item.sourceRef, name: item.name, icon: item.icon,
        topLeftContent: item.topLeftContent,
        isNeedRedMark: item.isNeedRedMark === true, isShowStatus: item.isShowStatus === true
      };
    }),
  }, null, 2) + "\n", "utf8");
}
console.log(JSON.stringify({
  out: path.resolve(args.out),
  pageTarget: manifest.pageTarget,
  bottomBarRef: bar.id,
  menuItemCount: menuItems.length,
  residentGroupItems: residentGroupItems,
}, null, 2));
