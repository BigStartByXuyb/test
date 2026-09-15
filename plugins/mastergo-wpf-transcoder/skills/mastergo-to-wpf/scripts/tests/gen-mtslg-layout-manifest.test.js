#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "gen-mtslg-layout-manifest.js");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mtslg-layout-manifest-"));

function text(text, id) {
  return { type: "TEXT", id: id, name: "固定文本框", layoutStyle: { width: 100, height: 16, relativeX: 0, relativeY: 0 }, text: [{ text: text }] };
}

function menuItemButton(id, x, y, label, fKey) {
  return {
    type: "INSTANCE",
    id: id,
    name: "非首页-长方形",
    layoutStyle: { width: 180, height: 84, relativeX: x, relativeY: y },
    componentInfo: { properties: { "属性 1": "非首页-长方形" } },
    children: [
      {
        type: "INSTANCE",
        id: id + "/icon",
        name: "icon",
        layoutStyle: { width: 40, height: 30, relativeX: 10, relativeY: 10 },
        children: [{
          type: "PATH",
          id: id + "/icon/path",
          name: "路径",
          layoutStyle: { width: 40, height: 30, relativeX: 0, relativeY: 0 },
          path: [{ fill: "paint_1", data: id.endsWith("1") || id.endsWith("3") ? "M0,0L40,0L40,30L0,30Z" : "M0,0L20,0L20,30L0,30Z" }],
        }],
      },
      text(label, id + "/label"),
      text(fKey, id + "/fkey"),
    ],
  };
}

const residentGroup = {
  type: "INSTANCE",
  id: "42:1/resident",
  name: "右侧底部-常驻button",
  layoutStyle: { width: 200, height: 200, relativeX: 1000, relativeY: 0 },
  children: [
    { type: "GROUP", id: "42:1/resident/line", name: "分割线", layoutStyle: { width: 2, height: 200, relativeX: 0, relativeY: 0 } },
    { type: "INSTANCE", id: "42:1/resident/a", name: "底部栏", layoutStyle: { width: 84, height: 84, relativeX: 16, relativeY: 12 }, componentInfo: { properties: { "属性 1": "方-icon" } } },
    { type: "INSTANCE", id: "42:1/resident/b", name: "底部栏", layoutStyle: { width: 84, height: 84, relativeX: 110, relativeY: 12 }, componentInfo: { properties: { "属性 1": "方-icon" } } },
  ],
};

const dsl = {
  dsl: {
    nodes: [{
      type: "INSTANCE",
      id: "42:1",
      name: "页面",
      layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
      children: [{
        type: "FRAME",
        id: "42:1/bar",
        name: "底部button",
        layoutStyle: { width: 1280, height: 202, relativeX: 0, relativeY: 822 },
        children: [
          { type: "LAYER", id: "42:1/bar/bg", name: "矩形 108", layoutStyle: { width: 1280, height: 202, relativeX: 0, relativeY: 0 } },
          residentGroup,
          menuItemButton("42:1/bar/1", 28, 12, "文案展示", "F1"),
          menuItemButton("42:1/bar/2", 236, 12, "文案展示", "F1"),
          menuItemButton("42:1/bar/3", 28, 106, "程序控制", "F6"),
          menuItemButton("42:1/bar/4", 236, 106, "测量", "F10"),
        ],
      }],
    }],
    styles: {},
    components: [],
  },
};
fs.writeFileSync(path.join(root, "dsl.snapshot.json"), JSON.stringify(dsl, null, 2), "utf8");

// 只给第一个按钮登记图标；第三个按钮几何相同（extractSvg 去重场景），应通过几何回退命中同一资源名
const iconMap = {
  icons: [
    { name: "FirstGeometry", comment: "第一", sourceId: "42:1/bar/1/icon", sourceRef: "42:1/bar/1/icon/path" },
    { name: "OtherGeometry", comment: "其它", sourceId: "42:1/bar/3/icon", sourceRef: "42:1/bar/3/icon/path" },
  ],
};
fs.writeFileSync(path.join(root, "icon-map.json"), JSON.stringify(iconMap, null, 2), "utf8");

const map = {
  layoutRules: {
    bottomBar: {
      match: { componentName: true },
      residentGroupPattern: "常驻(button|按钮|分组)",
      fKeyPattern: "^F\\d+$",
      decorativeNamePattern: "背景|分割",
      menuItemAlwaysWrittenAttrs: ["LangName", "PageName", "IOCommand", "IOVisible"],
      iconSizeAttrs: ["IconWidth", "IconHeight"],
      variants: {
        "首页-长方形": { topLeftContent: "none" },
        "非首页-长方形": { topLeftContent: "text" },
        "方-icon": { topLeftContent: "none" },
      },
    },
  },
};
fs.writeFileSync(path.join(root, "map.json"), JSON.stringify(map, null, 2), "utf8");

const out = path.join(root, "layout-manifest.json");
const report = path.join(root, "report.json");
const result = spawnSync(process.execPath, [script,
  "--dsl", path.join(root, "dsl.snapshot.json"),
  "--icon-map", path.join(root, "icon-map.json"),
  "--map", path.join(root, "map.json"),
  "--page-target", "FixturePage",
  "--page-lang-name", "",
  "--layout-path", "Resources/Layout/Layout.xml",
  "--out", out,
  "--report", report,
], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);

const manifest = JSON.parse(fs.readFileSync(out, "utf8"));
// Index 从 1 起、按菜单项连续编号：常驻分组不生成 MenuItem、也不占 Index（框架单独处理）
assert.deepStrictEqual(manifest.menuItems.map(item => item.index), [1, 2, 3, 4]);
// 文本照设计稿原样写入（不做占位符判定）
assert.strictEqual(manifest.menuItems[0].name, "文案展示");
assert.strictEqual(manifest.menuItems[0].topLeftContent, "F1");
assert.strictEqual(manifest.menuItems[1].name, "文案展示");
assert.strictEqual(manifest.menuItems[2].name, "程序控制");
assert.strictEqual(manifest.menuItems[2].topLeftContent, "F6");
assert.strictEqual(manifest.menuItems[3].name, "测量");
// 图标：第一个按钮命中登记条目，第三个按钮几何相同，通过几何回退拿回同一个资源名
assert.strictEqual(manifest.menuItems[0].icon, "FirstGeometry");
assert.strictEqual(manifest.menuItems[2].icon, "OtherGeometry");
assert.deepStrictEqual(manifest.menuItems[0].iconSize.width, 40);
assert.deepStrictEqual(manifest.menuItems[0].iconSize.height, 30);
// 常驻分组内的 2 个实例登记进 residentGroupItems，match 总数 = 菜单项 + 常驻项
assert.strictEqual(manifest.layoutEvidence.residentGroupItems, 2);
assert.strictEqual(manifest.layoutEvidence.matchedBottomBarItems, 6);
assert.strictEqual(manifest.layoutStatus, "complete");
assert.match(manifest.layoutEvidence.note, /底部栏/);

const reportJson = JSON.parse(fs.readFileSync(report, "utf8"));
assert.ok(Array.isArray(reportJson.menuItems) && reportJson.menuItems.length === 4);

// ---- 设计稿标记：红字文案 → IsNeedRedMark；左上角状态方框 → IsShowStatus ----
function flagText(value, id, color) {
  const node = { type: "TEXT", id: id, name: "固定文本框", layoutStyle: { width: 100, height: 16, relativeX: 0, relativeY: 56 }, text: [{ text: value }] };
  if (color) node._color = color;
  return node;
}
function flagButton(id, x, label, color, withStatusBox, withSmallIcon) {
  const children = [flagText(label, id + "/label", color)];
  // 左上角的小图标（INSTANCE + PATH）：不得被误判成状态方框。
  if (withSmallIcon) {
    children.push({
      type: "INSTANCE", id: id + "/icon", name: "icon",
      layoutStyle: { width: 20, height: 20, relativeX: 8, relativeY: 8 },
      children: [{ type: "PATH", id: id + "/icon/path", name: "路径", layoutStyle: { width: 20, height: 20, relativeX: 0, relativeY: 0 }, path: [{ fill: "paint_1", data: "M0,0L20,0L20,20Z" }] }]
    });
  }
  if (withStatusBox) {
    children.push({
      type: "GROUP", id: id + "/status", name: "组 2492",
      layoutStyle: { width: 18, height: 18, relativeX: 8, relativeY: 8 },
      children: [{ type: "LAYER", id: id + "/status/rect", name: "矩形 49", layoutStyle: { width: 18, height: 18, relativeX: 0, relativeY: 0 } }]
    });
  }
  return {
    type: "INSTANCE", id: id, name: "非首页-长方形",
    layoutStyle: { width: 180, height: 84, relativeX: x, relativeY: 12 },
    componentInfo: { properties: { "属性 1": "非首页-长方形" } },
    children: children
  };
}
const flagDsl = {
  dsl: {
    nodes: [{
      type: "INSTANCE", id: "42:9", name: "页面",
      layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
      children: [{
        type: "FRAME", id: "42:9/bar", name: "底部button",
        layoutStyle: { width: 1280, height: 202, relativeX: 0, relativeY: 822 },
        children: [
          { type: "INSTANCE", id: "42:9/bar/resident", name: "右侧底部-常驻button", layoutStyle: { width: 200, height: 200, relativeX: 1000, relativeY: 0 }, children: [] },
          flagButton("42:9/bar/1", 28, "报警", "#F8274B", false),
          flagButton("42:9/bar/2", 236, "普通", "#000000", false),
          flagButton("42:9/bar/3", 444, "开关", "#000000", true),
          flagButton("42:9/bar/4", 652, "小图标", "#000000", false, true)
        ]
      }]
    }],
    styles: {},
    components: []
  }
};
fs.writeFileSync(path.join(root, "flag-dsl.json"), JSON.stringify(flagDsl, null, 2), "utf8");
fs.writeFileSync(path.join(root, "flag-icon-map.json"), JSON.stringify({ icons: [] }, null, 2), "utf8");
const flagOut = path.join(root, "flag-layout-manifest.json");
const flagResult = spawnSync(process.execPath, [script,
  "--dsl", path.join(root, "flag-dsl.json"),
  "--icon-map", path.join(root, "flag-icon-map.json"),
  "--map", path.join(root, "map.json"),
  "--page-target", "FlagPage",
  "--page-lang-name", "",
  "--layout-path", "Resources/Layout/Layout.xml",
  "--out", flagOut,
], { encoding: "utf8" });
assert.strictEqual(flagResult.status, 0, flagResult.stderr);
const flagManifest = JSON.parse(fs.readFileSync(flagOut, "utf8"));
const byName = new Map(flagManifest.menuItems.map((item) => [item.name, item]));
// 红字文案（#F8274B）→ IsNeedRedMark=true；黑字不写该字段
assert.strictEqual(byName.get("报警").isNeedRedMark, true, "红色文案必须推导出 IsNeedRedMark");
assert.strictEqual(byName.get("普通").isNeedRedMark, undefined, "非红字不得写 IsNeedRedMark");
// 左上角状态方框 → IsShowStatus=true；没有方框的不写该字段
assert.strictEqual(byName.get("开关").isShowStatus, true, "左上角有状态方框必须推导出 IsShowStatus");
assert.strictEqual(byName.get("普通").isShowStatus, undefined, "没有状态方框不得写 IsShowStatus");
assert.strictEqual(byName.get("小图标").isShowStatus, undefined,
  "左上角的小图标（INSTANCE + PATH）不得被误判成状态方框");

// ---- 未命中变体的实例：必须计入 unresolvedBottomBarItems，且 Layout 生成器拒绝生成 ----
const unknownDsl = {
  dsl: {
    nodes: [{
      type: "INSTANCE", id: "42:8", name: "页面",
      layoutStyle: { width: 1280, height: 1024, relativeX: 0, relativeY: 0 },
      children: [{
        type: "FRAME", id: "42:8/bar", name: "底部button",
        layoutStyle: { width: 1280, height: 202, relativeX: 0, relativeY: 822 },
        children: [
          { type: "INSTANCE", id: "42:8/bar/resident", name: "右侧底部-常驻button", layoutStyle: { width: 200, height: 200, relativeX: 1000, relativeY: 0 }, children: [] },
          menuItemButton("42:8/bar/1", 28, 12, "已登记按钮", "F1"),
          { type: "INSTANCE", id: "42:8/bar/unknown", name: "未登记按钮", layoutStyle: { width: 180, height: 84, relativeX: 236, relativeY: 12 }, componentInfo: {}, children: [] },
        ],
      }],
    }],
    styles: {},
    components: [],
  },
};
fs.writeFileSync(path.join(root, "unknown-dsl.json"), JSON.stringify(unknownDsl, null, 2), "utf8");
const unknownOut = path.join(root, "unknown-layout-manifest.json");
const unknownResult = spawnSync(process.execPath, [script,
  "--dsl", path.join(root, "unknown-dsl.json"),
  "--icon-map", path.join(root, "flag-icon-map.json"),
  "--map", path.join(root, "map.json"),
  "--page-target", "UnknownPage",
  "--page-lang-name", "",
  "--layout-path", path.join(root, "UnknownLayout.xml"),
  "--out", unknownOut,
], { encoding: "utf8" });
assert.strictEqual(unknownResult.status, 0, unknownResult.stderr);
const unknownManifest = JSON.parse(fs.readFileSync(unknownOut, "utf8"));
assert.strictEqual(unknownManifest.layoutEvidence.unresolvedBottomBarItems, 1,
  "未命中变体的实例必须计入 unresolvedBottomBarItems，不允许静默跳过");
assert.match(unknownManifest.layoutEvidence.note, /未登记按钮/, "证据里要能看出是哪个实例没识别");
assert.deepStrictEqual(unknownManifest.menuItems.map((item) => item.sourceRef), ["42:8/bar/1"]);
// Layout 生成器：未决项非 0 时直接拒绝，避免静默少一个按钮
const layoutScript = path.join(__dirname, "..", "gen-mtslg-layout.js");
const unknownLayoutRun = spawnSync(process.execPath, [layoutScript, "--manifest", unknownOut, "--map", path.join(root, "map.json")], { encoding: "utf8" });
assert.notStrictEqual(unknownLayoutRun.status, 0, "存在未决底部栏组件时必须拒绝生成 Layout");
assert.match(unknownLayoutRun.stderr + unknownLayoutRun.stdout, /未决底部栏组件/, "失败信息必须指出未决底部栏组件");

console.log("PASS MTSLG Layout manifest derivation regression test");
