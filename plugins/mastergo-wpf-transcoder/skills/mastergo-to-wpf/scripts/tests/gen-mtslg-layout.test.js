#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "gen-mtslg-layout.js");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mtslg-layout-"));
const manifest = path.join(root, "layout.json");
const layout = path.join(root, "Layout.xml");

fs.writeFileSync(manifest, JSON.stringify({
  layoutPath: layout,
  pageTarget: "F2NewPage",
  pageLangName: "F2NewPageTitle",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 2, unresolvedBottomBarItems: 0 },
  menuItems: [
    { name: "第一项", icon: "FirstGeometry", iconSize: { width: 35.4, height: 33.2, sourceRef: "ref-1" }, topLeftContent: "F1", index: 1 },
    { icon: "SecondGeometry", iconSize: { width: 40, height: 40, sourceRef: "ref-2" }, topLeftContent: "F2", index: 2 }
  ]
}, null, 2), "utf8");

let result = spawnSync(process.execPath, [script, "--manifest", manifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
let text = fs.readFileSync(layout, "utf8");
assert.match(text, /<Page Target="F2NewPage" LangName="F2NewPageTitle">/);
assert.match(text, /<Layout>[\s\S]*<Header>[\s\S]*<Body>[\s\S]*<Pages>[\s\S]*<Page Target="F2NewPage"[\s\S]*<\/Pages>[\s\S]*<LeftToolBox \/>[\s\S]*<ToolBox \/>[\s\S]*<\/Body>[\s\S]*<Footer \/>[\s\S]*<\/Layout>/);
// MenuItem 常驻属性：LangName / PageName / IOCommand / IOVisible / IOEnable 恒写（来源缺失时为空字符串）；
// 图标尺寸与页面 XML 按钮族同一规则：有 Icon 必须有 iconSize，取整后写 IconWidth/IconHeight。
// 属性顺序与页面 XML 同一约定：Name → Icon → TopLeftContent/Index → LangName → PageName/IO* → IconWidth/IconHeight。
assert.match(text, /Name="第一项" Icon="FirstGeometry" TopLeftContent="F1" Index="1" LangName="" PageName="" IOCommand="" IOVisible="" IOEnable="" IconWidth="35" IconHeight="33"/);
assert.match(text, /Icon="SecondGeometry" TopLeftContent="F2" Index="2" LangName="" PageName="" IOCommand="" IOVisible="" IOEnable="" IconWidth="40" IconHeight="40"/);
assert.doesNotMatch(text, /UserRightId=/);
// MenuItem 不写 Value（菜单文本只放在 Name）
assert.doesNotMatch(text, /Value=/);

const emptyFieldsManifest = path.join(root, "empty-fields.json");
const emptyFieldsLayout = path.join(root, "EmptyFieldsLayout.xml");
fs.writeFileSync(emptyFieldsManifest, JSON.stringify({
  layoutPath: emptyFieldsLayout,
  pageTarget: "EmptyFieldsPage",
  pageLangName: "",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 1, unresolvedBottomBarItems: 0 },
  menuItems: [{
    name: "",
    langName: "",
    icon: "",
    topLeftContent: "",
    index: 1,
    pageName: "",
    ioEnable: "",
    userRightId: ""
  }]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", emptyFieldsManifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(emptyFieldsLayout, "utf8");
assert.match(text, /<Page Target="EmptyFieldsPage" LangName="">/);
assert.match(text, /Name="" Icon="" TopLeftContent="" Index="1" LangName="" PageName="" IOCommand="" IOVisible="" IOEnable="" UserRightId=""/);

const emptyCompleteManifest = path.join(root, "empty-complete.json");
fs.writeFileSync(emptyCompleteManifest, JSON.stringify({
  layoutPath: path.join(root, "EmptyLayout.xml"),
  pageTarget: "EmptyPage",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 1, unresolvedBottomBarItems: 0 },
  menuItems: []
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", emptyCompleteManifest], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "检测到 Layout 组件但 menuItems 为空时必须失败");
assert.match(result.stderr + result.stdout, /menuItems|Layout/i);

const emptyNoneManifest = path.join(root, "empty-none.json");
fs.writeFileSync(emptyNoneManifest, JSON.stringify({
  layoutPath: path.join(root, "NoneLayout.xml"),
  pageTarget: "NoMenuPage",
  layoutStatus: "none",
  layoutEvidence: { matchedBottomBarItems: 0, unresolvedBottomBarItems: 0 },
  menuItems: []
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", emptyNoneManifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);

// layoutStatus=none 且 Layout.xml 已存在（登记着别的页面）：必须与 complete 走同一条注册路径
// ——插入本页的 <Page>（Menu 为空），而不是「保留原文件、不注册」。
// 跳过注册会让同一个 none 状态随 Layout.xml 是否存在而分叉（不存在时反而注册），
// 而 verify-page 要求本页必须有 <Page> 注册 → 这类页面过了 bundle 却在第 12 步失败。
const noneExistingLayout = path.join(root, "NoneExistingLayout.xml");
fs.writeFileSync(noneExistingLayout, [
  "<Layout>",
  "  <Body>",
  "    <Pages>",
  "      <Page Target=\"OtherPage\" LangName=\"OtherPageTitle\">",
  "        <Menu>",
  "        </Menu>",
  "      </Page>",
  "    </Pages>",
  "  </Body>",
  "</Layout>",
  ""
].join("\n"), "utf8");
const noneExistingManifest = path.join(root, "none-existing.json");
fs.writeFileSync(noneExistingManifest, JSON.stringify({
  layoutPath: noneExistingLayout,
  pageTarget: "NoMenuPageExisting",
  pageLangName: "NoMenuPageExistingTitle",
  layoutStatus: "none",
  layoutEvidence: { matchedBottomBarItems: 0, unresolvedBottomBarItems: 0, residentGroupItems: 0 },
  menuItems: []
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", noneExistingManifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(noneExistingLayout, "utf8");
assert.match(text, /Target="OtherPage"/, "既有页面必须原样保留");
assert.match(text, /<Page Target="NoMenuPageExisting" LangName="NoMenuPageExistingTitle">/,
  "none 页面同样必须注册本页 <Page>");
assert.match(text, /<Page Target="NoMenuPageExisting"[\s\S]*?<Menu>\s*<\/Menu>/,
  "none 页面注册时 Menu 必须为空");

fs.writeFileSync(layout, [
  "<Layout>",
  "  <Page Target=\"ExistingPage\"><Menu><MenuItem Name=\"旧页面\" Index=\"9\" /></Menu></Page>",
  "</Layout>",
  ""
].join("\n"), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", manifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(layout, "utf8");
assert.match(text, /Target="ExistingPage"/);
assert.match(text, /Name="旧页面" Index="9"/);
assert.match(text, /Target="F2NewPage"/);

const nestedLayout = path.join(root, "NestedLayout.xml");
const nestedManifest = path.join(root, "nested-layout.json");
fs.writeFileSync(nestedLayout, [
  "<Layout>",
  "  <Header />",
  "  <Body>",
  "    <Pages>",
  "      <Page Target=\"ExistingPage\" />",
  "    </Pages>",
  "  </Body>",
  "</Layout>",
  ""
].join("\n"), "utf8");
fs.writeFileSync(nestedManifest, JSON.stringify({
  ...JSON.parse(fs.readFileSync(manifest, "utf8")),
  layoutPath: nestedLayout,
  pageTarget: "NestedPage"
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", nestedManifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(nestedLayout, "utf8");
assert.match(text, /<Pages>[\s\S]*Target="NestedPage"[\s\S]*<\/Pages>/);
assert.doesNotMatch(text, /<\/Pages>[\s\S]*<Page Target="NestedPage"/);

fs.writeFileSync(layout, [
  "<Layout>",
  "  <Page Target=\"F2NewPage\"><Menu><MenuItem Name=\"旧页面\" Index=\"9\" /></Menu></Page>",
  "</Layout>",
  ""
].join("\n"), "utf8");
const existingPageBeforeOverwrite = fs.readFileSync(layout, "utf8");
result = spawnSync(process.execPath, [script, "--manifest", manifest], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "替换已有 Page 必须显式使用 --overwrite");
assert.match(result.stderr + result.stdout, /相同 Target|overwrite|覆盖/i);
assert.strictEqual(
  fs.readFileSync(layout, "utf8"),
  existingPageBeforeOverwrite,
  "未加 --overwrite 时 Layout.xml 必须保持不变"
);
result = spawnSync(process.execPath, [script, "--manifest", manifest, "--overwrite"], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(layout, "utf8");
assert.strictEqual((text.match(/<Page\s+Target="F2NewPage"/g) || []).length, 1);
assert.match(text, /Name="第一项" Icon="FirstGeometry" TopLeftContent="F1" Index="1" LangName="" PageName="" IOCommand="" IOVisible="" IOEnable="" IconWidth="35" IconHeight="33"/);
assert.doesNotMatch(text, /Name="旧页面"/);

// 替换已有页面块：块内各行的缩进必须跟随该页在原文件里的深度，且重复注册字节幂等。
// 背景：渲染出来的页块自带固定基础缩进（Page 2 / Menu 4 / MenuItem 6），替换时若只去掉首行
// 缩进、不管其余行，就会出现「Page 缩进 6、Menu 缩进 4」的父子错位——内容没变、文件却每次重跑
// 都产生一次纯空白 diff（1.0.277 之前 F2LaserFocus 的实际现象）。
{
  const indentManifest = path.join(root, "indent.json");
  const indentLayout = path.join(root, "IndentLayout.xml");
  fs.writeFileSync(indentManifest, JSON.stringify({
    layoutPath: indentLayout,
    pageTarget: "IndentPage",
    pageLangName: "IndentPageTitle",
    layoutStatus: "complete",
    layoutEvidence: { matchedBottomBarItems: 1, unresolvedBottomBarItems: 0 },
    menuItems: [{ name: "第一项", icon: "", topLeftContent: "F1", index: 1 }]
  }, null, 2), "utf8");
  // 该页位于 <Body><Pages> 下 → 原文件里 <Page> 的缩进是 6 格
  fs.writeFileSync(indentLayout, [
    "<Layout>",
    "  <Body>",
    "    <Pages>",
    "      <Page Target=\"IndentPage\"><Menu /></Page>",
    "    </Pages>",
    "  </Body>",
    "</Layout>",
    ""
  ].join("\n"), "utf8");
  let indentRun = spawnSync(process.execPath, [script, "--manifest", indentManifest, "--overwrite"], { encoding: "utf8" });
  assert.strictEqual(indentRun.status, 0, indentRun.stderr);
  const indentFirst = fs.readFileSync(indentLayout, "utf8");
  const indentLines = indentFirst.split("\n");
  const indentOf = (line) => (line.match(/^[ \t]*/) || [""])[0].length;
  const indentPageLine = indentLines.find((line) => line.includes('<Page Target="IndentPage"'));
  const indentMenuLine = indentLines.find((line) => line.trim() === "<Menu>");
  const indentItemLine = indentLines.find((line) => line.includes("<MenuItem "));
  assert.strictEqual(indentOf(indentPageLine), 6, "<Page> 必须保持原文件里的缩进深度");
  assert.strictEqual(indentOf(indentMenuLine), 8, "<Menu> 必须比 <Page> 深两格");
  assert.strictEqual(indentOf(indentItemLine), 10, "<MenuItem> 必须比 <Menu> 深两格");
  indentRun = spawnSync(process.execPath, [script, "--manifest", indentManifest, "--overwrite"], { encoding: "utf8" });
  assert.strictEqual(indentRun.status, 0, indentRun.stderr);
  assert.strictEqual(fs.readFileSync(indentLayout, "utf8"), indentFirst,
    "同一页面重复注册必须字节幂等（否则每次重跑都会产生纯空白 diff）");
}

// 右下角常驻分组（右侧底部-常驻button）内的实例不生成 MenuItem：
// matchedBottomBarItems 仍统计全部命中变体，常驻分组内的数量单独登记进 residentGroupItems。
const residentManifest = path.join(root, "resident-group.json");
const residentLayout = path.join(root, "ResidentLayout.xml");
fs.writeFileSync(residentManifest, JSON.stringify({
  layoutPath: residentLayout,
  pageTarget: "ResidentPage",
  pageLangName: "",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 3, unresolvedBottomBarItems: 0, residentGroupItems: 1 },
  menuItems: [
    { name: "第一项", icon: "FirstGeometry", iconSize: { width: 35, height: 33, sourceRef: "ref-1" }, index: 1 },
    { name: "第二项", icon: "SecondGeometry", iconSize: { width: 40, height: 40, sourceRef: "ref-2" }, index: 2 }
  ]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", residentManifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(residentLayout, "utf8");
assert.strictEqual((text.match(/<MenuItem /g) || []).length, 2, "常驻分组内的实例不得生成 MenuItem");
assert.match(text, /Name="第一项" Icon="FirstGeometry" Index="1" LangName="" PageName="" IOCommand="" IOVisible="" IOEnable="" IconWidth="35" IconHeight="33"/);
assert.match(text, /Name="第二项" Icon="SecondGeometry" Index="2" LangName="" PageName="" IOCommand="" IOVisible="" IOEnable="" IconWidth="40" IconHeight="40"/);

const residentMismatch = path.join(root, "resident-mismatch.json");
fs.writeFileSync(residentMismatch, JSON.stringify({
  layoutPath: path.join(root, "ResidentMismatch.xml"),
  pageTarget: "ResidentMismatchPage",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 3, unresolvedBottomBarItems: 0, residentGroupItems: 0 },
  menuItems: [
    { name: "第一项", index: 1 },
    { name: "第二项", index: 2 }
  ]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", residentMismatch], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "menuItems + residentGroupItems 与 matchedBottomBarItems 不一致时必须失败");
assert.match(result.stderr + result.stdout, /residentGroupItems/);

const duplicateIndexManifest = path.join(root, "duplicate-index.json");
fs.writeFileSync(duplicateIndexManifest, JSON.stringify({
  layoutPath: path.join(root, "DuplicateIndex.xml"),
  pageTarget: "DuplicateIndexPage",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 2, unresolvedBottomBarItems: 0 },
  menuItems: [
    { name: "第一项", index: 1 },
    { name: "第二项", index: 1 }
  ]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", duplicateIndexManifest], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "重复 Index 必须失败");
assert.match(result.stderr + result.stdout, /重复 Index/);

// Index 必须是 1..N 连续编号：右下角常驻分组的按钮由框架单独处理、不占 Index，
// 旧版"按底栏物理槽位编号、为常驻按钮留空档"的清单必须重新推导。
const gappedIndexManifest = path.join(root, "gapped-index.json");
fs.writeFileSync(gappedIndexManifest, JSON.stringify({
  layoutPath: path.join(root, "GappedIndex.xml"),
  pageTarget: "GappedIndexPage",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 6, unresolvedBottomBarItems: 0, residentGroupItems: 2 },
  menuItems: [
    { name: "第一项", index: 1 },
    { name: "第二项", index: 2 },
    { name: "第三项", index: 5 },
    { name: "第四项", index: 6 }
  ]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", gappedIndexManifest], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "Index 留空档（按底栏物理槽位编号）必须失败");
assert.match(result.stderr + result.stdout, /连续编号/);
assert.match(result.stderr + result.stdout, /Index=3/);

// MenuItem 常驻属性：LangName / PageName / IOCommand / IOVisible / IOEnable 恒写，来源缺失时写空字符串
// （与页面 XML 按钮族同一策略）；Value 不写（菜单文本只放在 Name）。
const residentAttrsManifest = path.join(root, "menu-always-attrs.json");
const residentAttrsLayout = path.join(root, "MenuAlwaysAttrsLayout.xml");
fs.writeFileSync(residentAttrsManifest, JSON.stringify({
  layoutPath: residentAttrsLayout,
  pageTarget: "MenuAlwaysAttrsPage",
  pageLangName: "",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 1, unresolvedBottomBarItems: 0 },
  menuItems: [{ name: "激光设置", icon: "", index: 1 }]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", residentAttrsManifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(residentAttrsLayout, "utf8");
assert.match(text, /Name="激光设置" Icon="" Index="1" LangName="" PageName="" IOCommand="" IOVisible="" IOEnable=""/);

// 显式给出 LangName / PageName 时保留真实值。
const explicitAttrsManifest = path.join(root, "menu-explicit-attrs.json");
const explicitAttrsLayout = path.join(root, "MenuExplicitAttrsLayout.xml");
fs.writeFileSync(explicitAttrsManifest, JSON.stringify({
  layoutPath: explicitAttrsLayout,
  pageTarget: "MenuExplicitAttrsPage",
  pageLangName: "MenuExplicitAttrs",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 1, unresolvedBottomBarItems: 0 },
  menuItems: [{ name: "激光设置", langName: "Menu.Laser", icon: "", index: 1, pageName: "LaserPage" }]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", explicitAttrsManifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(explicitAttrsLayout, "utf8");
assert.match(text, /Name="激光设置" Icon="" Index="1" LangName="Menu\.Laser" PageName="LaserPage"/);

// 可用 menuItemAlwaysAttrs 追加恒写字段（扩展性）。
const extraAttrsManifest = path.join(root, "menu-extra-attrs.json");
const extraAttrsLayout = path.join(root, "MenuExtraAttrsLayout.xml");
fs.writeFileSync(extraAttrsManifest, JSON.stringify({
  layoutPath: extraAttrsLayout,
  pageTarget: "MenuExtraAttrsPage",
  layoutStatus: "complete",
  menuItemAlwaysAttrs: ["UserRightId"],
  layoutEvidence: { matchedBottomBarItems: 1, unresolvedBottomBarItems: 0 },
  menuItems: [{ name: "激光设置", icon: "", index: 1 }]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", extraAttrsManifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(extraAttrsLayout, "utf8");
assert.match(text, /Icon="" Index="1" LangName="" PageName="" IOCommand="" IOVisible="" IOEnable=""/);
assert.match(text, /IOEnable="" UserRightId=""/, "manifest.menuItemAlwaysAttrs 追加的字段必须发射");

// 有 Icon 但没有 iconSize 必须失败（禁止猜图标尺寸），与页面 XML 按钮族同一门禁。
const missingIconSizeManifest = path.join(root, "menu-missing-icon-size.json");
fs.writeFileSync(missingIconSizeManifest, JSON.stringify({
  layoutPath: path.join(root, "MenuMissingIconSize.xml"),
  pageTarget: "MenuMissingIconSizePage",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 1, unresolvedBottomBarItems: 0 },
  menuItems: [{ name: "激光设置", icon: "LaserSettingsGeometry", index: 1 }]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", missingIconSizeManifest], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "有 Icon 却没有 iconSize 时必须失败");
assert.match(result.stderr + result.stdout, /iconSize/);

// MenuItem 常驻属性改为读模板表（--map）：表里怎么写就怎么发射
const mapManifest = path.join(root, "map-always-attrs.json");
const mapLayout = path.join(root, "MapAlwaysAttrsLayout.xml");
const mapPath = path.join(root, "layout-map.json");
fs.writeFileSync(mapPath, JSON.stringify({
  layoutRules: { bottomBar: { menuItemAlwaysWrittenAttrs: ["LangName", "IOEnable"] } }
}, null, 2), "utf8");
fs.writeFileSync(mapManifest, JSON.stringify({
  layoutPath: mapLayout,
  pageTarget: "MapAttrsPage",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 1, unresolvedBottomBarItems: 0 },
  menuItems: [{ name: "激光设置", icon: "", index: 1 }]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", mapManifest, "--map", mapPath], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(mapLayout, "utf8");
assert.match(text, /Icon="" Index="1" LangName="" IOEnable=""/,
  "常驻属性集合必须来自模板表（LangName + IOEnable，且不再补 PageName/IOCommand/IOVisible）");
assert.doesNotMatch(text, /PageName=|IOCommand=|IOVisible=/,
  "模板表未声明的常驻属性不得发射");

// 设计稿标记：红字 → IsNeedRedMark="true"，左上角状态方框 → IsShowStatus="true"；
// 只有 true 才发射，false / 缺省都不写这两个属性（不是常驻字段）。
const flagManifest = path.join(root, "menu-flags.json");
const flagLayout = path.join(root, "MenuFlagsLayout.xml");
fs.writeFileSync(flagManifest, JSON.stringify({
  layoutPath: flagLayout,
  pageTarget: "MenuFlagsPage",
  pageLangName: "",
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 4, unresolvedBottomBarItems: 0 },
  menuItems: [
    { name: "报警", icon: "", index: 1, isNeedRedMark: true, isShowStatus: true },
    { name: "普通", icon: "", index: 2, isNeedRedMark: false },
    // 空串一律不发射（不得写 IsShowStatus=""）
    { name: "空串", icon: "", index: 3, isShowStatus: "", isNeedRedMark: "   " },
    // 常驻字段取到布尔 false 也必须发射，不能被布尔过滤吃掉
    { name: "恒写false", icon: "", index: 4, ioVisible: false }
  ]
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", flagManifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(flagLayout, "utf8");
assert.match(text, /Name="报警"[\s\S]*?IsShowStatus="true" IsNeedRedMark="true"/,
  "红字文案与左上角状态方框必须分别发射 IsNeedRedMark / IsShowStatus");
assert.match(text, /Name="普通"[^>]*\/>/, "第二个菜单项必须存在");
assert.ok(!/Name="普通"[^>]*IsShowStatus=/.test(text), "缺省时不得发射 IsShowStatus");
assert.ok(!/Name="普通"[^>]*IsNeedRedMark=/.test(text), "false 时不得发射 IsNeedRedMark");
assert.ok(!/Name="空串"[^>]*IsShowStatus=/.test(text), "空串不得发射 IsShowStatus");
assert.ok(!/Name="空串"[^>]*IsNeedRedMark=/.test(text), "纯空白串不得发射 IsNeedRedMark");
assert.match(text, /Name="恒写false"[\s\S]*?IOVisible="false"/,
  "恒写字段取到布尔 false 时仍必须发射（布尔过滤只能作用于设计稿标记）");

// 属性名真值源：用真实模板表运行时，标记属性名必须取自 layoutRules.bottomBar.menuItemFlags.*.attr
const realMapForFlags = path.resolve(__dirname, "..", "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const mapFlagLayout = path.join(root, "MenuFlagsFromMapLayout.xml");
const mapFlagManifest = path.join(root, "menu-flags-from-map.json");
const mapFlagSource = JSON.parse(fs.readFileSync(flagManifest, "utf8"));
mapFlagSource.layoutPath = mapFlagLayout;
fs.writeFileSync(mapFlagManifest, JSON.stringify(mapFlagSource, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", mapFlagManifest, "--map", realMapForFlags], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
text = fs.readFileSync(mapFlagLayout, "utf8");
assert.match(text, /IsShowStatus="true" IsNeedRedMark="true"/,
  "标记属性名必须与模板表 menuItemFlags 登记一致");

// 真值源回归锁：模板表（mtslg-iocontrol-map.json）与脚本内置默认必须一致，
// 且右栏“父节点语义（parentVariants）”建模必须保持作废状态。
const realMapPath = path.resolve(__dirname, "..", "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const realMap = JSON.parse(fs.readFileSync(realMapPath, "utf8"));
assert.deepStrictEqual(
  realMap.layoutRules.bottomBar.menuItemAlwaysWrittenAttrs,
  ["LangName", "PageName", "IOCommand", "IOVisible", "IOEnable"],
  "MenuItem 常驻属性表必须与页面 XML 按钮族同策略（含 IOEnable）"
);
const mapText = fs.readFileSync(realMapPath, "utf8");
assert.strictEqual(mapText.indexOf("parentVariants"), -1, "右栏 parentVariants 建模必须保持作废");
assert.strictEqual(mapText.indexOf("父节点语义"), -1, "映射表不得再出现“父节点语义”匹配层");

console.log("PASS MTSLG Layout generator regression test");
