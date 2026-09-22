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
          ] },
          // 设计稿里的**空文本节点**（真实设计稿常见）：它仍是 valueSource=dsl.text 的内容节点，
          // 但没有可翻译的文案。派生器跳过它（不产键），"必须挂 LangName" 门禁必须同口径跳过，
          // 否则整个页面生成会被一句空字符串卡住（历史上要靠显式 noLangRefs 放行）。
          { type: "TEXT", id: "body-text/inner/empty-text", name: "空文本", layoutStyle: { width: 0, height: 22, relativeX: 0, relativeY: 48 }, text: [{ text: "" }] }
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
  name: "F2NewPage",
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

// 统一文件登记 + 收尾清理：<generatedRoot>/_work/ 是中间工作目录（输入清单、派生清单、校验脚本），
// 跑完默认清空；这里先放一份探针文件，验证它被登记成 work 并在收尾时删掉。
const workDir = path.join(project, "Generated", "_work");
fs.mkdirSync(workDir, { recursive: true });
const workProbe = path.join(workDir, "F2NewPage.bundle.json");
fs.writeFileSync(workProbe, JSON.stringify({ note: "本次运行的输入清单快照" }), "utf8");
// DSL 采集阶段的产物落在 <generatedRoot> 顶层（getDsl/coverage-report/manifest/timing 等），
// 它们不在任何输出清单里，必须由生成目录扫描兜住，否则就是"项目里有、登记表里没有"。
const captureProbe = path.join(project, "Generated", "coverage-report.json");
fs.writeFileSync(captureProbe, JSON.stringify({ status: "complete" }), "utf8");
// 历史副本（本次运行之前就存在）：必须**不**入表——登记表的口径是"这一次生成产生了什么"，
// 不是"项目里现在有什么"，详见下方备份类断言与 bundle-manifest.md「登记边界」。
const viewDir = path.join(project, "UI", "F2-Teach", "View");
fs.mkdirSync(viewDir, { recursive: true });
const historicalBackup = path.join(viewDir, "F2NewPageView.xaml.bak-20200101000000");
fs.writeFileSync(historicalBackup, "历史副本\n", "utf8");

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

// 统一文件登记：审计里每条文件都带 kind（project / audit / work / backup），供人工与收尾清理共用。
assert.ok(Array.isArray(bundleAudit.files), "审计必须带统一文件登记 files[]");
const viewEntry = bundleAudit.files.find(function (entry) { return entry.path === "UI/F2-Teach/View/F2NewPageView.xaml"; });
const codeBehindEntry = bundleAudit.files.find(function (entry) { return entry.path === "UI/F2-Teach/View/F2NewPageView.xaml.cs"; });
assert.strictEqual(viewEntry.kind, "project", "View.xaml 必须登记为 project");
assert.strictEqual(codeBehindEntry.kind, "project", "code-behind 必须登记为 project");
assert.strictEqual(codeBehindEntry.dependsOn, "UI/F2-Teach/View/F2NewPageView.xaml",
  "code-behind 登记必须标出它挂在哪个 View.xaml 下");
assert.strictEqual(
  bundleAudit.files.find(function (entry) { return entry.path === "Generated/F2NewPage.mapping.json"; }).kind,
  "audit", "mapping 属于交付证据，登记为 audit");
// 语言文件是项目文件，且必须按项目相对路径原样登记（不得被解析成 ../ 之类的越界路径）。
const langEntries = bundleAudit.files.filter(function (entry) {
  return /F2NewPage_(CN|EN)\.xaml$/.test(entry.path);
});
assert.strictEqual(langEntries.length, 2, "语言文件必须登记进统一登记表");
langEntries.forEach(function (entry) {
  assert.strictEqual(entry.kind, "project");
  assert.strictEqual(entry.path, "Resources/Pages/F2NewPage/" + entry.path.split("/").pop(),
    "语言文件必须登记为项目相对路径");
});
// 采集阶段产物由生成目录扫描兜住：必须登记为 audit。
const auditPaths = bundleAudit.files.filter(function (entry) { return entry.kind === "audit"; })
  .map(function (entry) { return entry.path; });
assert.ok(auditPaths.includes("Generated/coverage-report.json"),
  "生成目录下的采集产物必须登记为 audit");
// 备份类只登记本次运行新产生的副本：运行前就存在的历史副本不得入表
// （登记表口径是"这一次生成产生了什么"，不是"项目里现在有什么"）。
assert.ok(
  !bundleAudit.files.some(function (entry) { return /\.bak-20200101000000$/.test(entry.path); }),
  "历史副本不得登记进 files[]");
// work 类：登记 + 收尾删除；输入快照保留在审计里，所以删掉 _work 不会丢本次运行的输入。
const workEntry = bundleAudit.files.find(function (entry) { return entry.path === "Generated/_work/F2NewPage.bundle.json"; });
assert.ok(workEntry, "_work 下的中间文件必须登记");
assert.strictEqual(workEntry.kind, "work");
assert.strictEqual(workEntry.removed, true, "登记表必须标出该 work 文件已被收尾删除");
assert.strictEqual(bundleAudit.cleanup.work.enabled, true, "work 清理默认开启");
assert.deepStrictEqual(bundleAudit.cleanup.work.removed, ["Generated/_work/F2NewPage.bundle.json"]);
assert.ok(!fs.existsSync(workProbe), "_work 下的中间文件必须被收尾删除");
assert.strictEqual(bundleAudit.inputs.pageName, "F2NewPage", "审计必须内嵌本次运行的输入快照");

const emptyIconMap = path.join(root, "empty-icon-map.json");
fs.writeFileSync(emptyIconMap, JSON.stringify({ icons: [] }, null, 2), "utf8");
const noIconManifest = JSON.parse(fs.readFileSync(manifest, "utf8"));
noIconManifest.name = "NoIconPage";
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
auditCollision.name = "AuditCollision";
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

// 关闭开关：manifest.cleanup.work === false 时保留 _work 中间文件（重跑前想留着输入清单的场景）。
const keepWorkManifest = JSON.parse(JSON.stringify(noIconManifest));
keepWorkManifest.name = "WorkKeep";
keepWorkManifest.pageTarget = "WorkKeep";
keepWorkManifest.pageLangName = "WorkKeepPageTitle";
keepWorkManifest.viewPath = "UI/F2-Teach/View/WorkKeepView.xaml";
keepWorkManifest.codeBehindPath = "UI/F2-Teach/View/WorkKeepView.xaml.cs";
keepWorkManifest.viewModelPath = "UI/F2-Teach/ViewModel/WorkKeepViewModel.cs";
keepWorkManifest.pageXmlPath = "Resources/Pages/WorkKeep/WorkKeepPage.xml";
keepWorkManifest.iconPath = "Resources/Pages/WorkKeep/WorkKeepIcons.xaml";
keepWorkManifest.cleanup = { work: false };
const keepWorkManifestPath = path.join(root, "work-keep.json");
fs.writeFileSync(keepWorkManifestPath, JSON.stringify(keepWorkManifest, null, 2), "utf8");
const keepProbe = path.join(workDir, "WorkKeep.bundle.json");
fs.writeFileSync(keepProbe, JSON.stringify({ note: "关闭清理时必须保留" }), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", keepWorkManifestPath], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
assert.ok(fs.existsSync(keepProbe), "cleanup.work=false 时不得删除 _work 中间文件");
const keepAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/WorkKeep.bundle.manifest.json"), "utf8"));
assert.strictEqual(keepAudit.cleanup.work.enabled, false);
assert.deepStrictEqual(keepAudit.cleanup.work.removed, []);
assert.ok(!keepAudit.files.find(function (entry) { return entry.kind === "work"; }).removed,
  "保留模式下不得标记 removed");

// 坐标门禁必须每次都执行：不得保留「度量不可用就整段跳过」的分支。
// 核对输入的归一化与构建的唯一实现在 lib/coord-nodes.js（Bundle 与 check-coords.mjs 共用），
// 本脚本只负责调用它并无条件把结果交给坐标核对器；缺度量由核对器点名 MISMATCH。
assert.doesNotMatch(scriptText, /coordNodesUsable/,
  "坐标门禁不得保留「度量不可用就整段跳过」的分支");
assert.match(scriptText, /buildCoordNodes\(mapping/,
  "坐标门禁必须调用 lib/coord-nodes.js 的 buildCoordNodes 后无条件执行核对");
assert.doesNotMatch(scriptText, /normalizedCoordNodes|coordNumber/,
  "坐标核对输入不得在编排器里再内联一份（唯一实现在 lib/coord-nodes.js）");

// 数值字符串度量（手写 / merge mapping 常见：写成 "292" 而不是 292）必须照常核对并通过。
const stringMetricMapping = JSON.parse(
  fs.readFileSync(path.join(project, "Generated/F2NewPage.mapping.json"), "utf8")
);
for (const source of stringMetricMapping.sourceNodes) {
  for (const field of ["pageAbsX", "pageAbsY", "width", "height"]) {
    if (typeof source[field] === "number") source[field] = String(source[field]);
  }
}
const stringMetricMappingPath = path.join(root, "string-metric-mapping.json");
fs.writeFileSync(stringMetricMappingPath, JSON.stringify(stringMetricMapping, null, 2), "utf8");
const stringMetricManifest = JSON.parse(fs.readFileSync(manifest, "utf8"));
stringMetricManifest.operation = "replace-existing";
delete stringMetricManifest.dslPath;
delete stringMetricManifest.visibilityPath;
stringMetricManifest.mappingPath = stringMetricMappingPath;
const stringMetricManifestPath = path.join(root, "string-metric-manifest.json");
fs.writeFileSync(stringMetricManifestPath, JSON.stringify(stringMetricManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", stringMetricManifestPath, "--overwrite"], { encoding: "utf8" });
assert.strictEqual(result.status, 0,
  "数值字符串度量必须照常执行坐标核对并通过: " + result.stderr + result.stdout);

// 生成目录下的备份必须登记为 backup（不得被生成目录扫描抢成 audit）。
// 这次是同一页面的第二次生成，Generated/<页面>.*.json 已被覆盖过，所以必然存在 .bak 条目。
const rerunAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/F2NewPage.bundle.manifest.json"), "utf8"));
const generatedBackups = rerunAudit.files.filter(function (entry) {
  return /^Generated\/.*\.bak-\d{8,}$/.test(entry.path);
});
assert.ok(generatedBackups.length > 0, "生成目录下的备份必须登记进 files[]");
generatedBackups.forEach(function (entry) {
  assert.strictEqual(entry.kind, "backup", "生成目录下的 .bak 必须登记为 backup: " + entry.path);
});
// 子脚本产生的备份也必须入表：View.xaml.cs 由 gen-mw-wpf-page.js 备份，不经过 Bundle 的
// backups 数组，只能靠"运行前后差集"兜住；历史副本仍不得入表。
assert.ok(
  rerunAudit.files.some(function (entry) {
    return entry.kind === "backup" && /^UI\/F2-Teach\/View\/F2NewPageView\.xaml\.bak-\d{8,}$/.test(entry.path);
  }),
  "子脚本产生的备份必须登记进 files[]");
assert.ok(
  !rerunAudit.files.some(function (entry) { return /\.bak-20200101000000$/.test(entry.path); }),
  "历史副本仍不得登记进 files[]");
// 审计文件自己的旧版本也必须登记成 backup（否则就是"登记表写完之后才产生的备份"这个漏项）。
assert.ok(
  rerunAudit.files.some(function (entry) {
    return entry.kind === "backup" && /F2NewPage\.bundle\.manifest\.json\.bak-\d{8,}$/.test(entry.path);
  }),
  "审计文件自身的备份必须登记进 files[]");

// 容器嵌套：bundle 默认调用 apply-container-containment.js 并产出审计文件；
// 本 fixture 没有容器实例 → containers=0、无冲突，但审计字段与报告文件必须存在。
assert.match(scriptText, /apply-container-containment\.js/, "bundle 必须调用 apply-container-containment.js");
const nestingAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/F2NewPage.nesting-report.json"), "utf8"));
assert.strictEqual(nestingAudit.schemaVersion, "mastergo-nesting-report/1");
assert.strictEqual(nestingAudit.containers.length, 0, "无容器实例时容器清单必须为空");
assert.strictEqual(nestingAudit.reparented.length, 0);
assert.deepStrictEqual(nestingAudit.conflicts, []);
const nestingBundleAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/F2NewPage.bundle.manifest.json"), "utf8"));
assert.strictEqual(nestingBundleAudit.nesting.enabled, true, "容器嵌套默认开启");
assert.strictEqual(nestingBundleAudit.nesting.containers, 0);
assert.strictEqual(nestingBundleAudit.nesting.report, "Generated/F2NewPage.nesting-report.json");

// manifest.nesting.enabled=false 时：不产出嵌套报告（审计 enabled=false、report=null）。
const nestingOffMapping = path.join(root, "nesting-off-mapping.json");
// 复用上一轮产出的 mapping 时必须剥掉已绑定的 LangName（新页面名会与旧键冲突）。
const nestingOffMappingDoc = JSON.parse(fs.readFileSync(path.join(project, "Generated/F2NewPage.mapping.json"), "utf8"));
for (const item of nestingOffMappingDoc.nodes || []) {
  if (item.attrs) delete item.attrs.LangName;
}
fs.writeFileSync(nestingOffMapping, JSON.stringify(nestingOffMappingDoc, null, 2), "utf8");
const nestingOffManifest = JSON.parse(fs.readFileSync(manifest, "utf8"));
nestingOffManifest.name = "NestingOff";
nestingOffManifest.pageTarget = "NestingOff";
nestingOffManifest.pageLangName = "NestingOffPageTitle";
nestingOffManifest.viewPath = "UI/F2-Teach/View/NestingOffView.xaml";
nestingOffManifest.codeBehindPath = "UI/F2-Teach/View/NestingOffView.xaml.cs";
nestingOffManifest.viewModelPath = "UI/F2-Teach/ViewModel/NestingOffViewModel.cs";
nestingOffManifest.pageXmlPath = "Resources/Pages/NestingOff/NestingOffPage.xml";
nestingOffManifest.iconPath = "Resources/Pages/NestingOff/NestingOffIcons.xaml";
nestingOffManifest.operation = "replace-existing";
nestingOffManifest.nesting = { enabled: false };
delete nestingOffManifest.dslPath;
delete nestingOffManifest.visibilityPath;
nestingOffManifest.mappingPath = nestingOffMapping;
const nestingOffManifestPath = path.join(root, "nesting-off.json");
fs.writeFileSync(nestingOffManifestPath, JSON.stringify(nestingOffManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", nestingOffManifestPath], { encoding: "utf8" });
assert.strictEqual(result.status, 0, "关闭 nesting 时必须正常生成: " + result.stderr + result.stdout);
const nestingOffAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/NestingOff.bundle.manifest.json"), "utf8"));
assert.strictEqual(nestingOffAudit.nesting.enabled, false);
assert.strictEqual(nestingOffAudit.nesting.report, null);
assert.ok(!fs.existsSync(path.join(project, "Generated/NestingOff.nesting-report.json")),
  "关闭 nesting 时不得产出嵌套报告文件");

// 空项目脚手架：目标目录可以尚不存在，但必须生成完整文件结构；只做静态校验，不编译或加载 WPF。
const scaffoldProject = path.join(root, "EmptyScaffold");
const scaffoldManifest = path.join(root, "scaffold.json");
fs.writeFileSync(scaffoldManifest, JSON.stringify({
  projectRoot: scaffoldProject,
  projectName: "EmptyScaffold",
  scaffold: true,
  name: "Scaffold",
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
// 唯一文件清单是 files[]：脚手架模式同样必须把 csproj / framework.config.json / View 登记进去。
const scaffoldPaths = scaffoldAudit.files.map(function (entry) { return entry.path; });
assert.ok(scaffoldPaths.includes("EmptyScaffold.csproj"));
assert.ok(scaffoldPaths.includes("framework.config.json"));
assert.ok(scaffoldPaths.includes("UI/F2-Teach/View/ScaffoldView.xaml"));

const incompleteManifest = JSON.parse(fs.readFileSync(manifest, "utf8"));
incompleteManifest.name = "NoLayoutState";
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

const brokenManifest = path.join(root, "broken-bundle.json");
const brokenProject = path.join(root, "Broken.Pages");
fs.mkdirSync(brokenProject, { recursive: true });
fs.copyFileSync(csproj, path.join(brokenProject, "Broken.Pages.csproj"));
fs.writeFileSync(brokenManifest, JSON.stringify({
  projectRoot: brokenProject,
  csproj: "Broken.Pages.csproj",
  name: "BrokenPage",
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
  item.name = pageName;
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
// 只统计**带文案**的控件：空文本节点（Value=""）没有可翻译文案，本就不该挂 LangName。
const langPageBlocks = langPageXml.split("<IOContorl").slice(1).filter((block) => /Value="[^"]+"/.test(block));
assert.ok(langPageBlocks.length >= 6, "示例页应包含多个带文案的控件");
langPageBlocks.forEach((block) => {
  assert.match(block, /LangName="/, "带文案的控件必须挂 LangName，实际: " + block.split("\n")[1]);
});
// 空文本节点：保留 Value=""，不挂 LangName，也不产语言键——同时证明它没有让整套生成失败。
const emptyBlock = langPageXml.split("<IOContorl").slice(1).find((block) => /Value=""\s/.test(block));
assert.ok(emptyBlock, "空文本节点必须照常发射（Value=\"\"）");
assert.doesNotMatch(emptyBlock, /LangName="/, "空文本节点不得挂 LangName");
assert.deepStrictEqual(
  langManifest.languages.keys.filter((entry) => entry.text && entry.text.CN === ""),
  [],
  "空文本不得产语言键");
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
assert.match(autoCn, /<sys:String x:Key="LangAutoPlus5">\+5<\/sys:String>/,
  "按钮族正负数值文案（+5）必须产键，键名用语义名 Plus5（CN/EN 文案一致）");
assert.match(autoCn, /<sys:String x:Key="LangAutoMinus1">-1<\/sys:String>/,
  "按钮族正负数值文案（-1）必须产键，键名用语义名 Minus1");
assert.match(autoCn, /<sys:String x:Key="LangAutoNum9Dot0Pct">9\.0%<\/sys:String>/,
  "数值+单位文本（9.0%）同样产键，键名走值字面编码 Num9Dot0Pct（不落临时键）");
assert.match(autoCn, /<sys:String x:Key="CommonDir">Dir<\/sys:String>/,
  "必须复用目标项目已登记的语言键");
const autoXml = fs.readFileSync(path.join(autoDir, "LangAutoPage.xml"), "utf8");
const autoBlocks = autoXml.split("<IOContorl").slice(1).filter((block) => /Value="/.test(block));
assert.ok(autoBlocks.length >= 5, "自动产键示例页应包含多个带文案的控件");
const autoBlocksWithoutLang = autoBlocks.filter((block) => !/LangName="/.test(block));
const noLangValues = autoBlocksWithoutLang.map((block) => /Value="([^"]*)"/.exec(block)[1]);
assert.ok(noLangValues.every((value) => value === ""),
  "全量多语言：带 Value 的节点都必须挂 LangName，未挂的只允许是空占位 Value，实际: " + JSON.stringify(noLangValues));
const percentBlock = autoXml.split("<IOContorl").slice(1).find((block) => /Value="9\.0%"/.test(block));
assert.match(percentBlock, /LangName="[^"]+"/, "数字/符号文本（如 9.0%）也必须产键挂 LangName");
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
assert.ok(autoAudit.languages.derivation.identicalTextKeys.some((item) => item.text === "9.0%"),
  "中英文写法相同的文本必须产键，并在审计 identicalTextKeys 里逐条留档");
assert.ok(autoAudit.languages.derivation.buttonFamilyKeys.some((item) => item.text === "+5"),
  "按钮族数值文案必须产键并在审计里记录原因");
// 译文清单必须作为本页产物落盘（不是插件里固定的共享文件）。
const autoTranslationAudit = path.join(project, "Generated/LangAuto.lang-translations.json");
assert.ok(fs.existsSync(autoTranslationAudit), "译文清单必须随本页生成落盘");
assert.deepStrictEqual(JSON.parse(fs.readFileSync(autoTranslationAudit, "utf8")), autoManifest.languages.translations);

// 选择框（ComboBox）的 Value 是「默认选中的名称」（MT3.0 界面设计器文档：运行时由 IOName 数据决定），
// 映射表槽位登记 langRefPolicy=none → Bundle 不得给它派生语言键、不得给它挂 LangName
// （requireLangName 门禁必须跳过该槽位），也不得占用 noLangRefs 通道。
const comboMapping = JSON.parse(fs.readFileSync(path.join(project, "Generated/F2NewPage.mapping.json"), "utf8"));
for (const item of comboMapping.nodes || []) {
  if (item.attrs) delete item.attrs.LangName;
}
comboMapping.nodes.push({
  ref: "body-text/select-direction",
  xmlId: "body-text/select-direction",
  id: "body-text/select-direction",
  sourceRef: "body-text/select-direction",
  sourceParent: "body-text",
  sourceText: "后向",
  valueSource: "dsl.text",
  langRefPolicy: "none",
  controlType: "ComboBox",
  absX: 300, absY: 292, w: 80, h: 32,
  expectedLeft: 300, expectedTop: 100, expectedWidth: 80, expectedHeight: 32,
  heightSource: "dsl.bbox",
  attrs: { Value: "后向", ControlType: "ComboBox", Style: "", IOName: "" }
});
comboMapping.sourceNodes.push({
  ref: "body-text/select-direction", parentRef: "body-text",
  pageAbsX: 300, pageAbsY: 292, relativeX: 300, relativeY: 292, width: 80, height: 32, text: "后向"
});
const comboMappingPath = path.join(root, "lang-combo-mapping.json");
fs.writeFileSync(comboMappingPath, JSON.stringify(comboMapping, null, 2), "utf8");
const comboManifest = langManifestFor("LangCombo", { auto: true, locales: ["CN", "EN"], keyCatalog: autoCatalog });
comboManifest.operation = "replace-existing";
comboManifest.mappingPath = comboMappingPath;
delete comboManifest.dslPath;
delete comboManifest.visibilityPath;
const comboManifestPath = path.join(root, "lang-combo.json");
fs.writeFileSync(comboManifestPath, JSON.stringify(comboManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", comboManifestPath], { encoding: "utf8" });
assert.strictEqual(result.status, 0,
  "选择框 Value 由槽位豁免后不得再触发「必须挂 LangName」门禁: " + result.stderr + result.stdout);
const comboDir = path.join(project, "Resources", "Pages", "LangCombo");
const comboXml = fs.readFileSync(path.join(comboDir, "LangComboPage.xml"), "utf8");
const comboBlock = comboXml.split("<IOContorl").slice(1).find((block) => /Value="后向"/.test(block));
assert.ok(comboBlock, "选择框必须出现在页面 XML 里");
assert.match(comboBlock, /ControlType="ComboBox"/);
assert.doesNotMatch(comboBlock, /LangName="/, "选择框的「默认选中的名称」不得挂 LangName");
assert.doesNotMatch(fs.readFileSync(path.join(comboDir, "LangCombo_CN.xaml"), "utf8"), />后向</,
  "选择框 Value 的文案不得进入语言字典");
const comboAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated/LangCombo.bundle.manifest.json"), "utf8"));
assert.ok(comboAudit.languages.derivation.valueLangExempt.some((item) => item.sourceRef === "body-text/select-direction"),
  "槽位豁免必须登记进 derivation.valueLangExempt");
assert.ok(!comboAudit.languages.derivation.identicalTextKeys.some((item) => item.sourceRef === "body-text/select-direction"),
  "槽位豁免既不产键也不占用 identicalTextKeys 留档");

// 反例：给槽位豁免的节点登记显式 keys[] 是自相矛盾的输入 → 必须失败，不静默忽略、也不静默挂 LangName。
const comboForcedManifest = JSON.parse(JSON.stringify(comboManifest));
comboForcedManifest.name = "LangComboForced";
comboForcedManifest.pageTarget = "LangComboForced";
comboForcedManifest.pageLangName = "LangComboForcedPageTitle";
comboForcedManifest.viewPath = "UI/F2-Teach/View/LangComboForcedView.xaml";
comboForcedManifest.codeBehindPath = "UI/F2-Teach/View/LangComboForcedView.xaml.cs";
comboForcedManifest.viewModelPath = "UI/F2-Teach/ViewModel/LangComboForcedViewModel.cs";
comboForcedManifest.pageXmlPath = "Resources/Pages/LangComboForced/LangComboForcedPage.xml";
comboForcedManifest.iconPath = "Resources/Pages/LangComboForced/LangComboForcedIcons.xaml";
comboForcedManifest.languages = Object.assign({}, comboManifest.languages, {
  keys: [{ key: "LangComboForcedBackward", text: { CN: "后向", EN: "Backward" }, sourceRef: "body-text/select-direction" }]
});
const comboForcedPath = path.join(root, "lang-combo-forced.json");
fs.writeFileSync(comboForcedPath, JSON.stringify(comboForcedManifest, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", comboForcedPath], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "给槽位豁免节点登记显式语言键时必须失败");
assert.match(result.stderr + result.stdout, /指向槽位豁免的节点（langRefPolicy=none/);
assert.ok(!fs.existsSync(path.join(project, "Resources/Pages/LangComboForced/LangComboForcedPage.xml")),
  "该门禁失败后不得留下页面产物");

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

// ---- 运行登记表绑定（B）：采集输入只认登记表，且拒绝旧同名影子文件 ----
// 背景：采集产物改成按页归档（Generated/runs/<Target>/）后，消费端一度仍在读顶层 Generated/*.json，
// 而顶层恰好留着上一次运行的旧文件 → 静默用了旧数据。这里逐条锁住新行为。
const registryCli = path.join(__dirname, "..", "run-registry.mjs");
const registryTarget = "LangRegistry";
const registryRunDir = path.join(project, "Generated", "runs", registryTarget);
fs.mkdirSync(registryRunDir, { recursive: true });
for (const [dest, src] of [["dsl.snapshot.json", dslSnapshot], ["visibility.json", visibility], ["extractSvg.json", svg]]) {
  fs.copyFileSync(src, path.join(registryRunDir, dest));
}
let registryResult = spawnSync(process.execPath, [registryCli, "init", "--project-root", project,
  "--target", registryTarget, "--file-id", "test-file", "--layer-id", "body-text", "--ui", "F2"], { encoding: "utf8" });
assert.strictEqual(registryResult.status, 0, registryResult.stderr);
const registryFile = path.join(registryRunDir, "run.json");
for (const [key, name, step] of [["snapshot", "dsl.snapshot.json", 2], ["visibility", "visibility.json", 4], ["extractSvg", "extractSvg.json", 3]]) {
  registryResult = spawnSync(process.execPath, [registryCli, "artifact", "--run", registryFile, "--key", key,
    "--path", "Generated/runs/" + registryTarget + "/" + name, "--step", String(step)], { encoding: "utf8" });
  assert.strictEqual(registryResult.status, 0, registryResult.stderr);
}
const registryDoc = JSON.parse(fs.readFileSync(registryFile, "utf8"));
const registryManifestFor = (suffix) => {
  const item = langManifestFor(registryTarget, { auto: true, locales: ["CN", "EN"], keyCatalog: autoCatalog });
  item.runRegistry = {
    path: "Generated/runs/" + registryTarget + "/run.json",
    runId: registryDoc.runId,
    digests: {
      snapshot: registryDoc.artifacts.snapshot.sha256,
      visibility: registryDoc.artifacts.visibility.sha256,
      extractSvg: registryDoc.artifacts.extractSvg.sha256
    }
  };
  // 清单里故意留旧顶层路径：Bundle 必须被登记表改写，而不是照旧路径读
  item.dslPath = "Generated/dsl.snapshot.json";
  item.visibilityPath = "Generated/visibility.json";
  item.svgPath = "Generated/extractSvg.json";
  const file = path.join(root, "registry-" + suffix + ".json");
  fs.writeFileSync(file, JSON.stringify(item, null, 2), "utf8");
  return { file, item };
};

// 正向：采集输入被登记表改写为 runs/<Target>/…，并把 files[] 回写进登记表 outputs
const registryOk = registryManifestFor("ok");
result = spawnSync(process.execPath, [script, "--manifest", registryOk.file], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr + result.stdout);
const registryAudit = JSON.parse(fs.readFileSync(path.join(project, "Generated", registryTarget + ".bundle.manifest.json"), "utf8"));
assert.strictEqual(registryAudit.inputs.dslPath, "Generated/runs/" + registryTarget + "/dsl.snapshot.json",
  "Bundle 必须按登记表绑定采集输入，而不是清单里写的顶层旧路径");
assert.match(result.stdout, /运行登记表: runId=/);
const registryAfter = JSON.parse(fs.readFileSync(registryFile, "utf8"));
assert.ok(Object.keys(registryAfter.outputs).length > 0, "Bundle 必须把本次产物回写进运行登记表的 outputs");
assert.strictEqual(registryAfter.outputs["Resources/Pages/" + registryTarget + "/" + registryTarget + "Page.xml"].kind, "project");

// 反向 1：磁盘上的采集文件被改写 → 与登记 sha256 不一致 → 失败
fs.appendFileSync(path.join(registryRunDir, "visibility.json"), "\n", "utf8");
result = spawnSync(process.execPath, [script, "--manifest", registryOk.file, "--overwrite"], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "采集文件与登记指纹不一致时必须失败");
assert.match(result.stderr + result.stdout, /与磁盘不一致|运行登记表/);
fs.copyFileSync(visibility, path.join(registryRunDir, "visibility.json"));

// 反向 2：清单自身登记的 digests 被改写 → 与登记表不一致 → 失败
const registryTampered = registryManifestFor("tampered");
registryTampered.item.runRegistry.digests.visibility = "0".repeat(64);
fs.writeFileSync(registryTampered.file, JSON.stringify(registryTampered.item, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", registryTampered.file, "--overwrite"], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "清单 digests 与登记表不一致时必须失败");
assert.match(result.stderr + result.stdout, /与运行登记表不一致/);

// 反向 3：磁盘上存在未登记的旧同名文件（内容不同）→ 失败，不允许静默用旧数据
fs.writeFileSync(path.join(project, "Generated", "dsl.snapshot.json"), JSON.stringify({ dsl: { nodes: [] }, nodeCount: 999 }), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", registryOk.file, "--overwrite"], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "存在未登记的旧同名文件时必须失败");
assert.match(result.stderr + result.stdout, /未登记的旧同名文件/);
fs.rmSync(path.join(project, "Generated", "dsl.snapshot.json"));

// 反向 4：清单里出现 pageName（页面名的第二个字段名）→ 失败。页面名只有一个字段 name。
const legacyNameManifest = path.join(root, "legacy-page-name.json");
const legacyNameDoc = JSON.parse(fs.readFileSync(manifest, "utf8"));
legacyNameDoc.pageName = legacyNameDoc.name;
fs.writeFileSync(legacyNameManifest, JSON.stringify(legacyNameDoc, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", legacyNameManifest], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "清单出现 pageName 字段时必须失败");
assert.match(result.stderr + result.stdout, /不接受 pageName 字段/);

// 反向 5：operation=modify-existing → 失败。Bundle 的页面 XML 恒为 --fresh，没有合并语义；
// 改已有页面的业务属性必须走 gen-iocontrol-xml.js --merge。
const legacyOpManifest = path.join(root, "legacy-operation.json");
const legacyOpDoc = JSON.parse(fs.readFileSync(manifest, "utf8"));
legacyOpDoc.operation = "modify-existing";
fs.writeFileSync(legacyOpManifest, JSON.stringify(legacyOpDoc, null, 2), "utf8");
result = spawnSync(process.execPath, [script, "--manifest", legacyOpManifest], { encoding: "utf8" });
assert.notStrictEqual(result.status, 0, "operation=modify-existing 时必须失败");
assert.match(result.stderr + result.stdout, /只接受 replace-existing/);

console.log("PASS MasterGo page bundle regression test");
