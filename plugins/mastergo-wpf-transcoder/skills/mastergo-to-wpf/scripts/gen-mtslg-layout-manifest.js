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

function fail(message) { throw new Error(message); }

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

// 菜单项左上角的状态方框：非 TEXT 节点、宽高在阈值内、相对菜单项左上角偏移在阈值内。
function hasStatusBox(node) {
  let found = false;
  (function walk(current, absX, absY) {
    if (found) return;
    for (const child of current.children || []) {
      const ls = child.layoutStyle || {};
      const x = absX + (Number(ls.relativeX) || 0);
      const y = absY + (Number(ls.relativeY) || 0);
      const w = Number(ls.width) || 0;
      const h = Number(ls.height) || 0;
      const isText = child.type === "TEXT" || Array.isArray(child.text);
      if (!isText && w >= STATUS_MIN_SIZE && w <= STATUS_MAX_SIZE &&
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

// 底部栏容器 = 直接子节点里含"右下角常驻分组"的那个容器
let bar = null;
(function findBar(node) {
  if (bar) return;
  if (childrenOf(node).some(function (child) {
    return child.type === "INSTANCE" && typeof child.name === "string" && residentPattern.test(child.name);
  })) { bar = node; return; }
  for (const child of childrenOf(node)) findBar(child);
})(root);
if (!bar) fail("未找到底部栏容器（子节点里没有常驻分组）: " + args["page-target"]);

const barChildren = childrenOf(bar);
const residentGroups = barChildren.filter(function (child) {
  return child.type === "INSTANCE" && typeof child.name === "string" && residentPattern.test(child.name);
});
const residentGroupItems = residentGroups.reduce(function (sum, group) {
  return sum + childrenOf(group).filter(function (child) {
    return child.type === "INSTANCE" && !decorPattern.test(child.name || "");
  }).length;
}, 0);

function isBottomBarVariant(node) {
  if (node.type !== "INSTANCE") return false;
  const props = (node.componentInfo && node.componentInfo.properties) || {};
  const byProperty = Object.keys(props).map(function (key) { return props[key]; })
    .some(function (value) { return typeof value === "string" && variantNames.has(value); });
  const byName = typeof node.name === "string" && variantNames.has(node.name);
  return byProperty || byName;
}

const residentRefs = new Set(residentGroups.map(function (node) { return node.id; }));
// 参与定位的按钮 = 底部菜单按钮 + 常驻分组内的按钮（后者只占 Index 位置、不生成 MenuItem）
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
        out.push({ node: child, text: child.text.map(function (part) { return part.text || ""; }).join("") });
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
  const position = orderedEntries.indexOf(item) + 1;
  const texts = textNodesOf(node);
  const nameText = texts.find(function (entry) { return !fKeyPattern.test(entry.text); });
  const fKeyText = texts.find(function (entry) { return fKeyPattern.test(entry.text); });
  const iconEntry = iconEntryOf(node);
  const geometryNode = iconEntry ? nodeById.get(iconEntry.sourceRef || iconEntry.sourceId) : null;
  const props = (node.componentInfo && node.componentInfo.properties) || {};
  return {
    ref: node.id,
    position: position,
    variant: Object.keys(props).map(function (key) { return props[key]; })
      .find(function (value) { return typeof value === "string" && variantNames.has(value); }) || node.name,
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
    unresolvedBottomBarItems: 0,
    residentGroupItems: residentGroupItems,
    note: "由 gen-mtslg-layout-manifest.js 从 DSL 机械推导：底部栏 " + bar.id +
      "，菜单项 " + menuItems.length + " 项，右下角常驻分组 " + residentGroupItems +
      " 项不生成 MenuItem（Index 空档保留），文本按设计稿原样写入。",
  },
  menuItems: menuItems,
};

fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
fs.writeFileSync(path.resolve(args.out), JSON.stringify(manifest, null, 2) + "\n", "utf8");
if (args.report) {
  fs.writeFileSync(path.resolve(args.report), JSON.stringify({
    pageTarget: args["page-target"],
    bottomBarRef: bar.id,
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
