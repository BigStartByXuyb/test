#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "gen-mastergo-page-bundle.js");
const scriptText = fs.readFileSync(script, "utf8");
assert.match(
  scriptText,
  /run\(LAYOUT_SCRIPT,\s*\["--manifest",\s*layoutInput\]/,
  "Bundle 必须通过 Layout 生成器做增量注册"
);
assert.match(scriptText, /run\(ICON_DISCOVERY_SCRIPT,/, "bundle 必须先执行页面 Icon 候选发现");
assert.match(scriptText, /PathGeometry\|GeometryGroup.*MatrixTransform|MatrixTransform.*PathGeometry\|GeometryGroup/, "bundle 必须拒绝旧式 Icon 几何结构");
assert.match(scriptText, /o:Freeze=\[\"'\]True\[\"'\].*x:Key=|x:Key=\[\"'\].*o:Freeze=\[\"'\]True/, "bundle 必须校验 Geometry 的冻结和资源键");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-bundle-"));
const project = path.join(root, "Demo.Pages");
fs.mkdirSync(project, { recursive: true });
const csproj = path.join(project, "Demo.Pages.csproj");
fs.writeFileSync(csproj, [
  "<Project xmlns=\"http://schemas.microsoft.com/developer/msbuild/2003\">",
  "  <PropertyGroup><RootNamespace>Demo.Pages</RootNamespace></PropertyGroup>",
  "  <ItemGroup><Compile Include=\"Properties\\\\AssemblyInfo.cs\" /></ItemGroup>",
  "  <ItemGroup><Page Include=\"Resources\\\\Files\\\\Language.xaml\"><Generator>MSBuild:Compile</Generator><SubType>Designer</SubType></Page></ItemGroup>",
  "  <ItemGroup><Page Include=\"UI\\\\F2-Teach\\\\View\\\\ExistingView.xaml\"><Generator>MSBuild:Compile</Generator><SubType>Designer</SubType></Page><Compile Include=\"UI\\\\F2-Teach\\\\ViewModel\\\\ExistingViewModel.cs\" /></ItemGroup>",
  "  <ItemGroup><Content Include=\"Common\\\\Pages\\\\Existing.xml\" /></ItemGroup>",
  "</Project>",
  ""
].join("\n"), "utf8");

const mapping = path.join(root, "mapping.json");
fs.writeFileSync(mapping, JSON.stringify({
  rootRef: "body-text",
  sourceNodes: [{
    ref: "body-text", parentRef: null, pageAbsX: 100, pageAbsY: 292,
    relativeX: 100, relativeY: 292, width: 80, height: 20, text: "测试页面"
  }],
  nodes: [{
    ref: "body-text", xmlId: "body-text", id: "body-text", sourceRef: "body-text",
    sourceParent: null, sourceText: "测试页面", valueSource: "dsl.text",
    controlType: "TextBlock", absX: 100, absY: 292, w: 80, h: 40,
    expectedLeft: 100, expectedTop: 100, expectedWidth: 80, expectedHeight: 40,
    heightSource: "mtslg.textblock.fixed-40",
    attrs: { Value: "测试页面", IOName: "" }
  }]
}, null, 2), "utf8");

const dslSnapshot = path.join(root, "dsl.snapshot.json");
fs.writeFileSync(dslSnapshot, JSON.stringify({
  schemaVersion: "mastergo-dsl-capture/1",
  fileId: "test-file",
  layerId: "body-text",
  pageName: "mapping-test",
  ui: "test",
  dsl: {
    styles: {},
    nodes: [{
      type: "INSTANCE",
      id: "body-text",
      name: "界面内操作组",
      layoutStyle: { width: 342, height: 60, relativeX: 0, relativeY: 0 },
      componentInfo: { properties: { "属性 1": "加减快捷键-无标题" } },
      children: [{
        type: "INSTANCE",
        id: "body-text/inner",
        name: "加减快捷键-无标题",
        layoutStyle: { width: 342, height: 60, relativeX: 0, relativeY: 0 },
        children: [
          { type: "GROUP", id: "body-text/inner/plus5", name: "按钮", layoutStyle: { width: 60, height: 60, relativeX: 0, relativeY: 0 }, children: [{ type: "TEXT", id: "body-text/inner/plus5/text", name: "+5", layoutStyle: { width: 20, height: 20, relativeX: 10, relativeY: 10 }, text: [{ text: "+5" }] }] },
          { type: "GROUP", id: "body-text/inner/minus5", name: "按钮", layoutStyle: { width: 60, height: 60, relativeX: 72, relativeY: 0 }, children: [{ type: "TEXT", id: "body-text/inner/minus5/text", name: "-5", layoutStyle: { width: 20, height: 20, relativeX: 10, relativeY: 10 }, text: [{ text: "-5" }] }] },
          { type: "GROUP", id: "body-text/inner/plus1", name: "按钮", layoutStyle: { width: 60, height: 60, relativeX: 144, relativeY: 0 }, children: [{ type: "TEXT", id: "body-text/inner/plus1/text", name: "+1", layoutStyle: { width: 20, height: 20, relativeX: 10, relativeY: 10 }, text: [{ text: "+1" }] }] },
          { type: "GROUP", id: "body-text/inner/minus1", name: "按钮", layoutStyle: { width: 60, height: 60, relativeX: 216, relativeY: 0 }, children: [{ type: "TEXT", id: "body-text/inner/minus1/text", name: "-1", layoutStyle: { width: 20, height: 20, relativeX: 10, relativeY: 10 }, text: [{ text: "-1" }] }] },
          { type: "GROUP", id: "body-text/inner/value-group", name: "组 2525", layoutStyle: { width: 50, height: 48, relativeX: 0, relativeY: 0 }, children: [
            { type: "TEXT", id: "body-text/inner/value-group/value", name: "9.0%", layoutStyle: { width: 40, height: 22, relativeX: 0, relativeY: 26 }, text: [{ text: "9.0%" }] },
            { type: "TEXT", id: "body-text/inner/value-group/direction", name: "Dir", layoutStyle: { width: 21, height: 16, relativeX: 29, relativeY: 0 }, text: [{ text: "Dir" }] }
          ] }
        ]
      }, {
        // 设计稿的页面标题文本：必须放在组件之后，避免参与组件内部的文本槽位排序；
        // 它不在内容区发射（决策 omit），但必须作为 textAudit 的 role=page-title
        // 记录，成为页面标题文案的机械来源。
        type: "TEXT",
        id: "page-title",
        name: "标题演示",
        layoutStyle: { width: 200, height: 40, relativeX: 20, relativeY: 60 },
        text: [{ text: "标题演示" }]
      }]
    }]
  },
  components: [],
  componentDocumentLinks: [],
  rules: []
}, null, 2), "utf8");
const visibility = path.join(root, "visibility.json");
fs.writeFileSync(visibility, JSON.stringify({ nodes: [] }, null, 2), "utf8");

const svg = path.join(root, "extractSvg.json");
fs.writeFileSync(svg, JSON.stringify({
  svgs: [{ id: "page/icon-a", svg: "<svg><path d=\"M0,0 L1,1\"/></svg>" }]
}), "utf8");
const iconMap = path.join(root, "icon-map.json");
fs.writeFileSync(iconMap, JSON.stringify({
  icons: [{ sourceId: "page/icon-a", name: "ActionGeometry", comment: "操作", sourceRef: "icon/a" }]
}), "utf8");

const manifest = path.join(root, "bundle.json");
fs.writeFileSync(manifest, JSON.stringify({
  projectRoot: project,
  csproj: "Demo.Pages.csproj",
  pageName: "F2NewPage",
  area: "F2-Teach",
  viewPath: "UI/F2-Teach/View/F2NewPageView.xaml",
  codeBehindPath: "UI/F2-Teach/View/F2NewPageView.xaml.cs",
  viewModelPath: "UI/F2-Teach/ViewModel/F2NewPageViewModel.cs",
  pageTarget: "F2NewPage",
  pageLangName: "F2NewPagePageTitle",
  pageXmlPath: "Resources/Pages/F2NewPage/F2NewPagePage.xml",
  iconPath: "Resources/Pages/F2NewPage/F2NewPageIcons.xaml",
  layoutPath: "Resources/Layout/Layout.xml",
  mappingPath: mapping,
  dslPath: dslSnapshot,
  visibilityPath: visibility,
  svgPath: svg,
  iconMapPath: iconMap,
  menuItems: [{
    name: "操作", icon: "ActionGeometry",
    iconSize: { width: 24, height: 24, sourceRef: "ref-action" },
    topLeftContent: "F1", index: 1
  }],
  layoutStatus: "complete",
  layoutEvidence: { matchedBottomBarItems: 1, unresolvedBottomBarItems: 0 }
}, null, 2), "utf8");

let result = spawnSync(process.execPath, [script, "--manifest", manifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
for (const relative of [
  "UI/F2-Teach/View/F2NewPageView.xaml",
  "UI/F2-Teach/View/F2NewPageView.xaml.cs",
  "UI/F2-Teach/ViewModel/F2NewPageViewModel.cs",
  "Resources/Pages/F2NewPage/F2NewPagePage.xml",
  "Resources/Pages/F2NewPage/F2NewPageIcons.xaml",
  "Resources/Layout/Layout.xml",
  "Generated/F2NewPage.mapping.json",
  "Generated/F2NewPage.icon-map.json",
  "Generated/F2NewPage.bundle.manifest.json"
]) {
  assert.ok(fs.existsSync(path.join(project, ...relative.split("/"))), relative);
}
// 一页一目录：页面 XML 与页面 Icon 必须同处 Resources/Pages/<页面名>/。
assert.deepStrictEqual(
  fs.readdirSync(path.join(project, "Resources", "Pages", "F2NewPage")).sort(),
  ["F2NewPageIcons.xaml", "F2NewPagePage.xml", "F2NewPage_CN.xaml", "F2NewPage_EN.xaml"]
);
// 旧约定路径不得再生成。
for (const stale of ["Common/Pages/F2NewPagePage.xml", "Resources/Icons/F2NewPageIcons.xaml", "Resources/Files/Layout.xml"]) {
  assert.ok(!fs.existsSync(path.join(project, ...stale.split("/"))), "旧输出路径不应再生成: " + stale);
}
assert.match(fs.readFileSync(path.join(project, "Resources/Pages/F2NewPage/F2NewPageIcons.xaml"), "utf8"), /ActionGeometry/);
assert.match(fs.readFileSync(path.join(project, "Resources/Pages/F2NewPage/F2NewPagePage.xml"), "utf8"), /Value="\+5"/);
// 必写字段：TextBlock 即使没有 IO 来源也要发射空 IOName 占位
assert.match(fs.readFileSync(path.join(project, "Resources/Pages/F2NewPage/F2NewPagePage.xml"), "utf8"), /IOName=""/);
assert.match(fs.readFileSync(path.join(project, "Resources/Layout/Layout.xml"), "utf8"), /Index="1"/);
assert.match(fs.readFileSync(csproj, "utf8"), /F2NewPagePage\.xml|F2NewPageIcons\.xaml/);
const iconMapAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/F2NewPage.icon-map.json"), "utf8"));
assert.ok(Array.isArray(iconMapAudit.candidates));
assert.ok(Array.isArray(iconMapAudit.unmapped));
const bundleAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/F2NewPage.bundle.manifest.json"), "utf8"));
assert.strictEqual(bundleAudit.mappingTag, "新页面完整DSL映射");
assert.deepStrictEqual(bundleAudit.layout, {
  status: "complete",
  evidence: { matchedBottomBarItems: 1, unresolvedBottomBarItems: 0 },
  menuItemCount: 1
});
// 多语言是默认能力：manifest 没写 languages 也必须自动生成 CN/EN 字典并挂 LangName。
assert.strictEqual(bundleAudit.languagesDefaulted, true);
assert.strictEqual(bundleAudit.languageDisabled, false);
assert.strictEqual(bundleAudit.languageWarning, null);
assert.strictEqual(bundleAudit.languages.locales.join(","), "CN,EN");
assert.ok(bundleAudit.languages.keyCount >= 1, "默认多语言必须派生出语言键");
assert.match(fs.readFileSync(path.join(project, "Resources/Pages/F2NewPage/F2NewPagePage.xml"), "utf8"), /LangName="/);
assert.match(fs.readFileSync(path.join(project, "Resources/Pages/F2NewPage/F2NewPage_CN.xaml"), "utf8"), /F2NewPagePageTitle/);
assert.match(fs.readFileSync(path.join(project, "Resources/Layout/Layout.xml"), "utf8"), /<Page Target="F2NewPage" LangName="F2NewPagePageTitle">/);
// 页面标题文案来源：manifest 没写 pageTitleText 时必须取 mapping.textAudit 的 page-title
// （DSL 机械产物），不得静默回退成设计画板框名；实际用到的来源写入审计 languages.titleSource。
assert.strictEqual(
  bundleAudit.languages.titleSource,
  "mapping.textAudit",
  "未提供 pageTitleText 时必须取 textAudit 的 page-title，并记录来源"
);
assert.match(
  fs.readFileSync(path.join(project, "Resources/Pages/F2NewPage/F2NewPage_CN.xaml"), "utf8"),
  /<sys:String x:Key="F2NewPagePageTitle">标题演示<\/sys:String>/,
  "标题文案必须等于设计稿 textAudit 的 page-title 原文（不是画板框名 界面内操作组）"
);
// 译文/术语表是页面级产物：本场景没有提供译文与术语表输入，因此不应凭空生成这两个文件。
assert.ok(!fs.existsSync(path.join(project, "Generated/F2NewPage.lang-translations.json")));
assert.ok(!fs.existsSync(path.join(project, "Generated/F2NewPage.lang-glossary.json")));
// ViewModel 的 switch (message.ButtonName) 必须包含本页底部菜单项（Layout MenuItem）
const hostViewModel = fs.readFileSync(path.join(project, "UI/F2-Teach/ViewModel/F2NewPageViewModel.cs"), "utf8");
assert.match(hostViewModel, /case "操作":/, "ViewModel 必须按底部菜单项生成 case 骨架");

const emptyIconMap = path.join(root, "empty-icon-map.json");
fs.writeFileSync(emptyIconMap, JSON.stringify({ icons: [] }, null, 2), "utf8");
const noIconManifest = JSON.parse(fs.readFileSync(manifest, "utf8"));
noIconManifest.pageName = "NoIconPage";
noIconManifest.pageTarget = "NoIconPage";
  noIconManifest.pageLangName = "NoIconPagePageTitle";
noIconManifest.viewPath = "UI/F2-Teach/View/NoIconPageView.xaml";
noIconManifest.codeBehindPath = "UI/F2-Teach/View/NoIconPageView.xaml.cs";
noIconManifest.viewModelPath = "UI/F2-Teach/ViewModel/NoIconPageViewModel.cs";
noIconManifest.pageXmlPath = "Resources/Pages/NoIconPage/NoIconPagePage.xml";
noIconManifest.iconPath = "Resources/Pages/NoIconPage/NoIconPageIcons.xaml";
noIconManifest.iconMapPath = emptyIconMap;
noIconManifest.menuItems = [];
noIconManifest.layoutStatus = "none";
noIconManifest.layoutEvidence = { matchedBottomBarItems: 0, unresolvedBottomBarItems: 0 };
const noIconManifestPath = path.join(root, "no-icon.json");
fs.writeFileSync(noIconManifestPath, JSON.stringify(noIconManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", noIconManifestPath], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
assert.doesNotMatch(
  fs.readFileSync(path.join(project, "Resources/Pages/NoIconPage/NoIconPageIcons.xaml"), "utf8"),
  /<Geometry\b/,
  "没有实际 Icon 引用的页面允许生成空 ResourceDictionary"
);

const auditCollision = JSON.parse(JSON.stringify(noIconManifest));
auditCollision.pageName = "AuditCollision";
auditCollision.pageTarget = "AuditCollision";
  auditCollision.pageLangName = "AuditCollisionPageTitle";
auditCollision.viewPath = "UI/F2-Teach/View/AuditCollisionView.xaml";
auditCollision.codeBehindPath = "UI/F2-Teach/View/AuditCollisionView.xaml.cs";
auditCollision.viewModelPath = "UI/F2-Teach/ViewModel/AuditCollisionViewModel.cs";
auditCollision.pageXmlPath = "Resources/Pages/AuditCollision/AuditCollisionPage.xml";
auditCollision.iconPath = "Resources/Pages/AuditCollision/AuditCollisionIcons.xaml";
const auditCollisionPath = path.join(root, "audit-collision.json");
fs.mkdirSync(path.join(project, "Generated"), { recursive: true });
fs.writeFileSync(path.join(project, "Generated/AuditCollision.mapping.json"), "{}", "utf8");
fs.writeFileSync(auditCollisionPath, JSON.stringify(auditCollision, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", auditCollisionPath], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "已存在审计文件时不得在没有 --overwrite 的情况下覆盖");
assert.match(result.stderr + result.stdout, /审计文件已存在|未覆盖/);
assert.ok(!fs.existsSync(path.join(project, "Resources/Pages/AuditCollision/AuditCollisionPage.xml")));

// 空项目脚手架：目标目录可以尚不存在，但必须生成完整文件结构；只做静态校验，不编译或加载 WPF。
const scaffoldProject = path.join(root, "EmptyScaffold");
const scaffoldManifest = path.join(root, "scaffold.json");
fs.writeFileSync(scaffoldManifest, JSON.stringify({
  projectRoot: scaffoldProject,
  projectName: "EmptyScaffold",
  scaffold: true,
  pageName: "Scaffold",
  area: "F2-Teach",
  pageTarget: "ScaffoldPage",
  pageLangName: "ScaffoldPageTitle",
  pageXmlPath: "Resources/Pages/Scaffold/ScaffoldPage.xml",
  iconPath: "Resources/Pages/Scaffold/ScaffoldIcons.xaml",
  layoutPath: "Resources/Layout/Layout.xml",
  mappingPath: mapping,
  dslPath: dslSnapshot,
  visibilityPath: visibility,
  svgPath: svg,
  iconMapPath: emptyIconMap,
  menuItems: [],
  layoutStatus: "none",
  layoutEvidence: { matchedBottomBarItems: 0, unresolvedBottomBarItems: 0 }
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", scaffoldManifest], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
for (const relative of [
  "EmptyScaffold.csproj",
  "framework.config.json",
  "UI/F2-Teach/View/ScaffoldView.xaml",
  "UI/F2-Teach/View/ScaffoldView.xaml.cs",
  "UI/F2-Teach/ViewModel/ScaffoldViewModel.cs",
  "Resources/Pages/Scaffold/ScaffoldPage.xml",
  "Resources/Pages/Scaffold/ScaffoldIcons.xaml",
  "Resources/Layout/Layout.xml",
  "Generated/Scaffold.mapping.json",
  "Generated/Scaffold.icon-map.json",
  "Generated/Scaffold.bundle.manifest.json"
]) {
  assert.ok(fs.existsSync(path.join(scaffoldProject, ...relative.split("/"))), relative);
}
const scaffoldConfig = JSON.parse(fs.readFileSync(path.join(scaffoldProject, "framework.config.json"), "utf8"));
assert.strictEqual(scaffoldConfig.mode, "mtslg-iocontrol");
assert.strictEqual(scaffoldConfig.scaffold, true);
assert.strictEqual(scaffoldConfig.source_root, "");
assert.strictEqual(scaffoldConfig.index_root, "");
assert.deepStrictEqual(scaffoldConfig.resource_roots, []);
assert.strictEqual(scaffoldConfig.key_catalog, "");
// 脚手架声明的运行路径必须与目标项目真实结构一致。
assert.strictEqual(scaffoldConfig.pages_root, "Resources/Pages");
assert.strictEqual(scaffoldConfig.icons_root, "Resources/Pages");
assert.strictEqual(scaffoldConfig.layout_file, "Resources/Layout/Layout.xml");
const scaffoldAudit = JSON.parse(fs.readFileSync(
  path.join(scaffoldProject, "Generated/Scaffold.bundle.manifest.json"), "utf8"
));
assert.strictEqual(scaffoldAudit.projectMode, "scaffold");
assert.deepStrictEqual(scaffoldAudit.verification, {
  static: "passed",
  compile: "skipped",
  wpfLoad: "skipped",
  runtimeLoad: "skipped"
});
assert.ok(scaffoldAudit.generated.includes("EmptyScaffold.csproj"));
assert.ok(scaffoldAudit.generated.includes("framework.config.json"));
assert.ok(scaffoldAudit.generated.includes("UI/F2-Teach/View/ScaffoldView.xaml"));

const incompleteManifest = JSON.parse(fs.readFileSync(manifest, "utf8"));
incompleteManifest.pageName = "NoLayoutState";
incompleteManifest.pageTarget = "NoLayoutState";
incompleteManifest.viewPath = "UI/F2-Teach/View/NoLayoutStateView.xaml";
incompleteManifest.codeBehindPath = "UI/F2-Teach/View/NoLayoutStateView.xaml.cs";
incompleteManifest.viewModelPath = "UI/F2-Teach/ViewModel/NoLayoutStateViewModel.cs";
incompleteManifest.pageXmlPath = "Resources/Pages/NoLayoutState/NoLayoutStatePage.xml";
incompleteManifest.iconPath = "Resources/Pages/NoLayoutState/NoLayoutStateIcons.xaml";
incompleteManifest.menuItems = [];
delete incompleteManifest.layoutStatus;
delete incompleteManifest.layoutEvidence;
const incompleteManifestPath = path.join(root, "incomplete-layout-state.json");
fs.writeFileSync(incompleteManifestPath, JSON.stringify(incompleteManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", incompleteManifestPath], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "缺少 Layout 状态时不得继续生成 bundle");
assert.match(result.stderr + result.stdout, /layoutStatus|Layout/i);
assert.ok(!fs.existsSync(path.join(project, "Resources/Pages/NoLayoutState/NoLayoutStatePage.xml")));

// 坐标门禁必须实际执行（CI REVIEW-002）：merge 路径允许直接提供 mapping（未给 dslPath/visibilityPath 时），
// 该 mapping 由上游/工程师维护，其 sourceNodes 的 bbox 允许写成数值字符串（"100"）——
// gen-iocontrol-xml 只对 nodes 的 absX/w/h 做 typeof number 门禁，provenance 与坐标核对器都按 num() 归一化，
// 因此 bundle 的坐标门禁也必须先归一化再照常核对：既不能整段静默跳过（旧行为），
// 也不能把 Number.isFinite("100") === false 误判成缺度量而失败。
assert.doesNotMatch(scriptText, /coordNodesUsable/,
  "坐标门禁不得保留「度量不可用就整段跳过」的分支");
assert.match(scriptText, /unusableCoordNodes/,
  "坐标门禁缺度量必须显式失败，而不是静默跳过");

const mergeMapping = JSON.parse(
  fs.readFileSync(path.join(project, "Generated/F2NewPage.mapping.json"), "utf8")
);
for (const source of mergeMapping.sourceNodes) {
  for (const field of ["pageAbsX", "pageAbsY", "width", "height"]) {
    if (typeof source[field] === "number") source[field] = String(source[field]);
  }
}
const stringMetricMapping = path.join(root, "merge-mapping-string-metrics.json");
fs.writeFileSync(stringMetricMapping, JSON.stringify(mergeMapping, null, 2), "utf8");
const mergeManifest = JSON.parse(fs.readFileSync(manifest, "utf8"));
mergeManifest.operation = "modify-existing";
delete mergeManifest.dslPath;
delete mergeManifest.visibilityPath;
mergeManifest.mappingPath = stringMetricMapping;
const mergeManifestPath = path.join(root, "merge-string-metrics.json");
fs.writeFileSync(mergeManifestPath, JSON.stringify(mergeManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", mergeManifestPath, "--overwrite"], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr + result.stdout);

const brokenManifest = path.join(root, "broken-bundle.json");
const brokenProject = path.join(root, "Broken.Pages");
fs.mkdirSync(brokenProject, { recursive: true });
fs.copyFileSync(csproj, path.join(brokenProject, "Broken.Pages.csproj"));
fs.writeFileSync(brokenManifest, JSON.stringify({
  projectRoot: brokenProject,
  csproj: "Broken.Pages.csproj",
  pageName: "BrokenPage",
  area: "F2-Teach",
  pageXmlPath: "Resources/Pages/BrokenPage/BrokenPagePage.xml",
  iconPath: "Resources/Pages/BrokenPage/BrokenPageIcons.xaml",
  layoutPath: "Resources/Layout/Layout.xml",
  mappingPath: mapping,
  svgPath: svg,
  iconMapPath: path.join(root, "missing-icon-map.json"),
  pageTarget: "BrokenPage",
  menuItems: []
}, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", brokenManifest], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0);
assert.match(result.stderr + result.stdout, /新建页面必须提供当前页面的 dslPath 和 visibilityPath/);
assert.ok(!fs.existsSync(path.join(brokenProject, "Resources/Pages/BrokenPage/BrokenPage.xml")));
assert.ok(!fs.existsSync(path.join(brokenProject, "Resources/Layout/Layout.xml")));

// 多语言：CN/EN 字典生成 + 按文案自动匹配 LangName + 未挂 key 必须失败 + 豁免生效。
const readLangKeys = (text) => {
  const keys = [];
  const re = /<sys:String\b[^>]*\bx:Key="([^"]*)"[^>]*>/g;
  let match;
  while ((match = re.exec(text)) !== null) keys.push(match[1]);
  return keys;
};
const langBase = JSON.parse(fs.readFileSync(manifest, "utf8"));
const langPageTextKeys = [
  { key: "LangDemoPlusFive", group: "页面内容", text: { CN: "+5", EN: "+5" } },
  { key: "LangDemoMinusFive", group: "页面内容", text: { CN: "-5", EN: "-5" } },
  { key: "LangDemoPlusOne", group: "页面内容", text: { CN: "+1", EN: "+1" } },
  { key: "LangDemoMinusOne", group: "页面内容", text: { CN: "-1", EN: "-1" } },
  { key: "LangDemoValue", group: "页面内容", text: { CN: "9.0%", EN: "9.0%" } },
  { key: "LangDemoDirection", group: "页面内容", text: { CN: "Dir", EN: "Dir" } }
];
function langManifestFor(pageName, languages) {
  const item = JSON.parse(JSON.stringify(langBase));
  item.pageName = pageName;
  item.pageTarget = pageName;
  item.pageLangName = pageName + "PageTitle";
  item.viewPath = "UI/F2-Teach/View/" + pageName + "View.xaml";
  item.codeBehindPath = "UI/F2-Teach/View/" + pageName + "View.xaml.cs";
  item.viewModelPath = "UI/F2-Teach/ViewModel/" + pageName + "ViewModel.cs";
  item.pageXmlPath = "Resources/Pages/" + pageName + "/" + pageName + "Page.xml";
  item.iconPath = "Resources/Pages/" + pageName + "/" + pageName + "Icons.xaml";
  item.languages = languages;
  return item;
}

// 显式 pageTitleText 是覆盖通道（优先于 textAudit），来源记为 manifest.pageTitleText。
const titleOverrideManifest = langManifestFor("TitleOverride", { auto: true, locales: ["CN", "EN"] });
titleOverrideManifest.pageTitleText = "手填标题";
const titleOverridePath = path.join(root, "title-override-bundle.json");
fs.writeFileSync(titleOverridePath, JSON.stringify(titleOverrideManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", titleOverridePath], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
assert.match(
  fs.readFileSync(path.join(project, "Resources/Pages/TitleOverride/TitleOverride_CN.xaml"), "utf8"),
  /<sys:String x:Key="TitleOverridePageTitle">手填标题<\/sys:String>/,
  "显式 pageTitleText 必须覆盖 textAudit 的 page-title"
);
assert.strictEqual(
  JSON.parse(fs.readFileSync(path.join(project, "Generated/TitleOverride.bundle.manifest.json"), "utf8")).languages.titleSource,
  "manifest.pageTitleText",
  "显式覆盖时来源必须记为 manifest.pageTitleText"
);

// 正向：文案自动匹配（不写 sourceRef），页面里所有文本控件都必须挂上 LangName。
const langManifest = langManifestFor("LangDemo", {
  locales: ["CN", "EN"],
  keys: [
    { key: "LangDemoPageTitle", group: "页面标题", text: { CN: "多语言示例", EN: "Language Demo" }, role: "page-title" },
    { key: "MenuItemOperation", group: "页面底部菜单名称", text: { CN: "操作", EN: "Operation" }, menuIndex: 1 },
    ...langPageTextKeys
  ]
});
const langManifestPath = path.join(root, "lang-bundle.json");
fs.writeFileSync(langManifestPath, JSON.stringify(langManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", langManifestPath], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
const langPageDir = path.join(project, "Resources", "Pages", "LangDemo");
assert.deepStrictEqual(fs.readdirSync(langPageDir).sort(),
  ["LangDemoIcons.xaml", "LangDemoPage.xml", "LangDemo_CN.xaml", "LangDemo_EN.xaml"]);
const langCn = fs.readFileSync(path.join(langPageDir, "LangDemo_CN.xaml"), "utf8");
const langEn = fs.readFileSync(path.join(langPageDir, "LangDemo_EN.xaml"), "utf8");
assert.match(langCn, /<sys:String x:Key="LangDemoPageTitle">多语言示例<\/sys:String>/);
assert.match(langEn, /<sys:String x:Key="LangDemoPageTitle">Language Demo<\/sys:String>/);
assert.deepStrictEqual(readLangKeys(langCn), readLangKeys(langEn), "CN/EN 的 key 必须完全一致");
assert.deepStrictEqual(readLangKeys(langCn), langManifest.languages.keys.map((key) => key.key));
const langPageXml = fs.readFileSync(path.join(langPageDir, "LangDemoPage.xml"), "utf8");
const langPageBlocks = langPageXml.split("<IOContorl").slice(1).filter((block) => /Value="/.test(block));
assert.ok(langPageBlocks.length >= 6, "示例页应包含多个带文案的控件");
langPageBlocks.forEach((block) => {
  assert.match(block, /LangName="/, "带文案的控件必须挂 LangName，实际: " + block.split("\n")[1]);
});
assert.match(langPageXml, /LangName="LangDemoPlusFive"/, "应按 CN 文案自动匹配到 key");
const langLayout = fs.readFileSync(path.join(project, "Resources/Layout/Layout.xml"), "utf8");
assert.match(langLayout, /<Page Target="LangDemo" LangName="LangDemoPageTitle">/);
assert.match(langLayout, /LangName="MenuItemOperation"/, "MenuItem 必须引用语言文件中的 key");
const langCsproj = fs.readFileSync(csproj, "utf8");
assert.match(langCsproj, /<Page Include="Resources\\Pages\\LangDemo\\LangDemo_CN\.xaml">/);
assert.match(langCsproj, /<Page Include="Resources\\Pages\\LangDemo\\LangDemo_EN\.xaml">/);
const langAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/LangDemo.bundle.manifest.json"), "utf8"));
assert.strictEqual(langAudit.languages.keyCount, 8);
assert.deepStrictEqual(langAudit.languages.locales, ["CN", "EN"]);
assert.ok(langAudit.languages.bindings.some((line) => /按文案匹配/.test(line)), "审计需记录自动匹配结果");

// 负例：有文案没登记 key → 必须失败并回滚，错误信息要指出是哪些节点。
const badLangManifest = langManifestFor("LangBad", {
  locales: ["CN", "EN"],
  keys: [
    { key: "LangBadPageTitle", group: "页面标题", text: { CN: "标题", EN: "Title" }, role: "page-title" }
  ]
});
badLangManifest.menuItems = [{ name: "操作", icon: "", index: 1 }];
const badLangPath = path.join(root, "lang-bad.json");
fs.writeFileSync(badLangPath, JSON.stringify(badLangManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", badLangPath], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "文本没有 LangName 时必须失败");
assert.match(result.stderr + result.stdout, /必须挂 LangName/);
assert.match(result.stderr + result.stdout, /body-text\/inner\/minus5/);
assert.ok(!fs.existsSync(path.join(project, "Resources/Pages/LangBad/LangBadPage.xml")),
  "多语言门禁失败后不得留下页面产物");

// 负例：菜单项引用了一个不符合 MenuItem 前缀的 key → 命名约定不通过。
const badMenuManifest = langManifestFor("LangBadMenu", {
  locales: ["CN", "EN"],
  keys: [
    { key: "LangBadMenuPageTitle", group: "页面标题", text: { CN: "标题", EN: "Title" } },
    { key: "LangBadMenuContent", group: "页面内容", text: { CN: "操作", EN: "Operation" } }
  ]
});
badMenuManifest.menuItems = [{ name: "操作", icon: "", index: 1, langName: "LangBadMenuContent" }];
badMenuManifest.languages.noLangRefs = [
  "body-text/inner/plus5", "body-text/inner/minus5", "body-text/inner/plus1",
  "body-text/inner/minus1", "body-text/inner/value-group/value", "body-text/inner/value-group/direction"
];
const badMenuPath = path.join(root, "lang-bad-menu.json");
fs.writeFileSync(badMenuPath, JSON.stringify(badMenuManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", badMenuPath], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "菜单项 key 必须以 MenuItem 开头");
assert.match(result.stderr + result.stdout, /不符合菜单项命名约定/);

// 负例：缺少 {页面名}PageTitle → Layout <Page LangName> 没有可引用的 key。
const noTitleManifest = langManifestFor("LangNoTitle", {
  locales: ["CN", "EN"],
  noLangRefs: badMenuManifest.languages.noLangRefs,
  keys: [{ key: "MenuItemOperation", group: "页面底部菜单名称", text: { CN: "操作", EN: "Operation" }, menuIndex: 1 }]
});
noTitleManifest.pageLangName = "";
const noTitlePath = path.join(root, "lang-no-title.json");
fs.writeFileSync(noTitlePath, JSON.stringify(noTitleManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", noTitlePath], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "缺少页面标题 key 时必须失败");
assert.match(result.stderr + result.stdout, /缺少页面标题 LanguageKey：LangNoTitlePageTitle/);

// 豁免：动态值节点显式写入 noLangRefs 后可以放行。
const exemptManifest = langManifestFor("LangExempt", {
  locales: ["CN", "EN"],
  noLangRefs: ["body-text/inner/value-group/value", "body-text/inner/value-group/direction"],
  keys: [
    { key: "LangExemptPageTitle", group: "页面标题", text: { CN: "豁免示例", EN: "Exempt" }, role: "page-title" },
    { key: "MenuItemOperation", group: "页面底部菜单名称", text: { CN: "操作", EN: "Operation" }, menuIndex: 1 },
    ...langPageTextKeys.slice(0, 4).map((item) => ({ ...item, key: item.key.replace("LangDemo", "LangExempt") }))
  ]
});
const exemptPath = path.join(root, "lang-exempt.json");
fs.writeFileSync(exemptPath, JSON.stringify(exemptManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", exemptPath], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
const exemptXml = fs.readFileSync(path.join(project, "Resources/Pages/LangExempt/LangExemptPage.xml"), "utf8");
const exemptBlocks = exemptXml.split("<IOContorl").slice(1).filter((block) => /Value="9\.0%"/.test(block));
assert.strictEqual(exemptBlocks.length, 1);
assert.doesNotMatch(exemptBlocks[0], /LangName="/, "被豁免的动态值节点不应挂 LangName");

// 自动产键：languages.auto=true 时语言键由 DSL/mapping 机械派生，
// 每个带文案的控件（含 IconButton）都必须自动挂上 LangName，不需要人工登记 key。
const autoCatalog = path.join(root, "AutoClient_CN.xaml");
fs.writeFileSync(autoCatalog, [
  '<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
  '                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
  '                    xmlns:sys="clr-namespace:System;assembly=mscorlib">',
  '    <sys:String x:Key="CommonDir">Dir</sys:String>',
  "</ResourceDictionary>",
  ""
].join("\n"), "utf8");
const autoManifest = langManifestFor("LangAuto", {
  auto: true,
  locales: ["CN", "EN"],
  keyCatalog: autoCatalog,
  // 英文译文由 AI 产出后显式落盘，脚本只机械套用。
  translations: {
    "标题演示": "Title Demo",
    "操作": "Operation"
  }
});
const autoManifestPath = path.join(root, "lang-auto.json");
fs.writeFileSync(autoManifestPath, JSON.stringify(autoManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", autoManifestPath], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
const autoDir = path.join(project, "Resources", "Pages", "LangAuto");
assert.deepStrictEqual(fs.readdirSync(autoDir).sort(),
  ["LangAutoIcons.xaml", "LangAutoPage.xml", "LangAuto_CN.xaml", "LangAuto_EN.xaml"]);
const autoCn = fs.readFileSync(path.join(autoDir, "LangAuto_CN.xaml"), "utf8");
const autoEn = fs.readFileSync(path.join(autoDir, "LangAuto_EN.xaml"), "utf8");
assert.deepStrictEqual(readLangKeys(autoCn), readLangKeys(autoEn), "CN/EN 的 key 必须完全一致");
assert.match(autoEn, /<sys:String x:Key="LangAutoPageTitle">Title Demo<\/sys:String>/,
  "页面标题必须取设计稿 textAudit 的 page-title，并使用 translations 里的真实英文");
assert.match(autoEn, /<sys:String x:Key="MenuItemAction">Operation<\/sys:String>/,
  "菜单项必须使用 translations 里的真实英文");
assert.match(autoCn, /<sys:String x:Key="LangAutoPageTitle">标题演示<\/sys:String>/,
  "页面标题 CN 必须取设计稿 textAudit 的 page-title 原文（不是画板框名）");
assert.match(autoCn, /<sys:String x:Key="LangAutoText\d+">\+5<\/sys:String>/,
  "按钮族数值文案（+5）必须产键（CN/EN 文案一致）");
assert.match(autoCn, /<sys:String x:Key="CommonDir">Dir<\/sys:String>/,
  "必须复用目标项目已登记的语言键");
const autoXml = fs.readFileSync(path.join(autoDir, "LangAutoPage.xml"), "utf8");
const autoBlocks = autoXml.split("<IOContorl").slice(1).filter((block) => /Value="/.test(block));
assert.ok(autoBlocks.length >= 5, "自动产键示例页应包含多个带文案的控件");
const autoBlocksWithoutLang = autoBlocks.filter((block) => !/LangName="/.test(block));
assert.ok(autoBlocksWithoutLang.length >= 1, "动态值节点（如 9.0%）仍不挂 LangName");
autoBlocksWithoutLang.forEach((block) => {
  const value = /Value="([^"]*)"/.exec(block)[1];
  assert.ok(!/[\u4e00-\u9fa5]/.test(value),
    "没有 LangName 的必须是中英文一致的数字/符号文本，实际: " + value);
  assert.ok(!/ControlType="(IconButton|Button|StatusButton)"/.test(block),
    "按钮族带文案一律挂 LangName，实际未挂: " + value);
});
const plus5Block = autoXml.split("<IOContorl").slice(1).find((block) => /Value="\+5"/.test(block));
assert.match(plus5Block, /LangName="/, "按钮族数值文案（+5）必须挂 LangName");
assert.match(autoXml, /LangName="CommonDir"/, "复用已登记键的节点必须挂上该 key");
const autoLangLayout = fs.readFileSync(path.join(project, "Resources/Layout/Layout.xml"), "utf8");
assert.match(autoLangLayout, /<Page Target="LangAuto" LangName="LangAutoPageTitle">/);
assert.match(autoLangLayout, /LangName="MenuItemAction"/,
  "Layout 菜单项也必须引用自动派生的 MenuItem key");
const autoAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/LangAuto.bundle.manifest.json"), "utf8"));
assert.strictEqual(autoAudit.languages.auto, true);
assert.strictEqual(autoAudit.languageWarning, null);
assert.ok(autoAudit.languages.keyCount >= 3, "应派生标题/菜单/内容三类键");
assert.strictEqual(autoAudit.languages.derivation.translatedFromInput, 2,
  "标题与菜单的英文必须来自 translations");
assert.strictEqual(autoAudit.languages.derivation.pendingTranslations.length, 0,
  "该页中文文案已全部给出译文，不应再有待翻译项");
assert.ok(autoAudit.languages.derivation.autoNoLangRefs.some((item) => item.text === "9.0%"),
  "动态值必须自动进入 noLangRefs 并记录原因");
assert.ok(autoAudit.languages.derivation.buttonFamilyKeys.some((item) => item.text === "+5"),
  "按钮族数值文案必须产键并在审计里记录原因");
// 译文清单必须作为本页产物落盘（不是插件里固定的共享文件）。
const autoTranslationAudit = path.join(project, "Generated/LangAuto.lang-translations.json");
assert.ok(fs.existsSync(autoTranslationAudit), "译文清单必须随本页生成落盘");
assert.deepStrictEqual(JSON.parse(fs.readFileSync(autoTranslationAudit, "utf8")), autoManifest.languages.translations);

// 显式关闭多语言：必须给出 reason，审计记录 languageDisabled，且不生成字典、不挂 LangName。
const langOffManifest = langManifestFor("LangOff", { disabled: true, reason: "该页确认不做多语言" });
const langOffPath = path.join(root, "lang-off.json");
fs.writeFileSync(langOffPath, JSON.stringify(langOffManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", langOffPath], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
const langOffDir = path.join(project, "Resources", "Pages", "LangOff");
assert.deepStrictEqual(fs.readdirSync(langOffDir).sort(), ["LangOffIcons.xaml", "LangOffPage.xml"]);
assert.doesNotMatch(fs.readFileSync(path.join(langOffDir, "LangOffPage.xml"), "utf8"), /LangName="/);
const langOffAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/LangOff.bundle.manifest.json"), "utf8"));
assert.strictEqual(langOffAudit.languages, null);
assert.strictEqual(langOffAudit.languageDisabled, true);
assert.match(langOffAudit.languageDisabledReason, /确认不做多语言/);

console.log("PASS MasterGo page bundle regression test");
