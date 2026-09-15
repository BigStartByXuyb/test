#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'gen-mw-wpf-page.js');
const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-wpf-page-'));
const csprojPath = path.join(projectRoot, 'Demo.Pages.csproj');
const manifestPath = path.join(projectRoot, 'page.json');

fs.writeFileSync(csprojPath, `<?xml version="1.0" encoding="utf-8"?>\n<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">\n  <PropertyGroup>\n    <RootNamespace>Demo.Pages</RootNamespace>\n  </PropertyGroup>\n  <ItemGroup>\n    <Compile Include="Properties\\AssemblyInfo.cs" />\n  </ItemGroup>\n  <ItemGroup>\n    <Page Include="Resources\\Pages\\Existing\\Existing_CN.xaml">\n      <Generator>MSBuild:Compile</Generator>\n      <SubType>Designer</SubType>\n    </Page>\n  </ItemGroup>\n  <ItemGroup>\n    <Page Include="UI\\F2-Teach\\View\\ExistingView.xaml">\n      <Generator>MSBuild:Compile</Generator>\n      <SubType>Designer</SubType>\n    </Page>\n    <Compile Include="UI\\F2-Teach\\ViewModel\\ExistingViewModel.cs" />\n  </ItemGroup>\n  <ItemGroup>\n    <Content Include="Resources\\Pages\\Existing\\ExistingPage.xml" />\n  </ItemGroup>\n</Project>\n`, 'utf8');
fs.writeFileSync(manifestPath, JSON.stringify({
  projectRoot,
  csproj: 'Demo.Pages.csproj',
  area: 'F2-Teach',
  pageName: 'F2NewOperation',
  viewPath: 'UI/F2-Teach/View/F2NewOperationView.xaml',
  codeBehindPath: 'UI/F2-Teach/View/F2NewOperationView.xaml.cs',
  viewModelPath: 'UI/F2-Teach/ViewModel/F2NewOperationViewModel.cs',
  includeIcon: true,
  iconPath: 'Resources/Pages/F2NewOperation/F2NewOperationIcons.xaml',
  pageXmlPath: 'Resources/Pages/F2NewOperation/F2NewOperationPage.xml',
  // 底部按钮 → ViewModel 里 switch (message.ButtonName) 的 case 骨架（空名称不生成 case）
  // langName 是按钮处理方法名的来源：MenuItemFocus -> Focus；临时键 MenuItemIndex<n> 不派生方法名。
  menuItems: [
    { name: '新建示教', index: 1, langName: 'MenuItemNewTeaching' },
    { name: '', index: 2 },
    { name: '工件边缘录入', index: 3, langName: 'MenuItemIndex3' },
    { name: '对焦', index: 10, langName: 'MenuItemFocus' },
    // 菜单项没有独立方法名字段：方法名只从 langName 派生。
    { name: '倍率变更', index: 11, langName: 'MenuItemMagnificationChange' },
    // 跨页面共享键（scope=shared）可能不带 MenuItem 前缀：直接取整键。
    { name: '共享键按钮', index: 12, langName: 'SharedFocusKey' },
    // 没有 langName 的按钮：退回内联 TODO，并给出对应的 reason。
    { name: '无键按钮', index: 13 }
  ]
}, null, 2), 'utf8');

let result = spawnSync(process.execPath, [script, '--manifest', manifestPath], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);

const viewPath = path.join(projectRoot, 'UI', 'F2-Teach', 'View', 'F2NewOperationView.xaml');
const codeBehindPath = path.join(projectRoot, 'UI', 'F2-Teach', 'View', 'F2NewOperationView.xaml.cs');
const viewModelPath = path.join(projectRoot, 'UI', 'F2-Teach', 'ViewModel', 'F2NewOperationViewModel.cs');
assert.ok(fs.existsSync(viewPath));
assert.ok(fs.existsSync(codeBehindPath));
assert.ok(fs.existsSync(viewModelPath));

const view = fs.readFileSync(viewPath, 'utf8');
assert.match(view, /x:Class="Demo\.Pages\.F2_Teach\.View\.F2NewOperationView"/);
// View 不合并页面 Icon 资源字典：宿主壳只输出 UserControl 头 + PageDesign。
assert.ok(!/UserControl\.Resources/.test(view), "View 不得生成 <UserControl.Resources>");
assert.ok(!/F2NewOperationIcons\.xaml/.test(view), "View 不得引用页面 Icon 文件");
assert.ok(!/ResourceDictionary\s+Source=/.test(view), "View 不得合并页面级资源字典");
assert.match(view, /XmlPagePath="F2NewOperationPage"/);
assert.match(fs.readFileSync(codeBehindPath, 'utf8'), /partial class F2NewOperationView : UserControl/);
assert.match(fs.readFileSync(viewModelPath, 'utf8'), /class F2NewOperationViewModel : IOScreen, IPage/);
assert.match(fs.readFileSync(viewModelPath, 'utf8'), /Name = "F2NewOperation"/);
// 页面 ViewModel 固定方法集（与目标工程真实页面一致）：
//   OnViewLoaded / PageDesign_Loaded / HandleButtonEvent / OKCmd
const generatedViewModel = fs.readFileSync(viewModelPath, 'utf8');
assert.match(generatedViewModel, /using MaxwellFramework\.Core\.Events;/, '必须导入 ButtonEvent 所在命名空间');
assert.match(generatedViewModel, /public PageDesign pageDesign \{ get; set; \}/);
assert.match(generatedViewModel, /protected override void OnViewLoaded\(\)\s*\{\s*base\.OnViewLoaded\(\);\s*\}/);
assert.match(generatedViewModel, /public void PageDesign_Loaded\(object sender, RoutedEventArgs e\)/);
assert.match(generatedViewModel, /public override void HandleButtonEvent\(ButtonEvent message\)/);
assert.match(generatedViewModel, /if \(message\.IsMouseDown\)/);
assert.match(generatedViewModel, /switch \(message\.ButtonName\)/);
assert.match(generatedViewModel, /public void OKCmd\(\)\s*\{\s*pageDesign\.SaveXml\(\);\s*\}/);
// switch 的 case 必须是本页底部（Layout Menu）全部按钮名；空名称按钮不生成 case。
assert.match(generatedViewModel, /case "新建示教":/);
assert.match(generatedViewModel, /case "对焦":/);
assert.ok(!/case "":/.test(generatedViewModel), '空名称菜单项不得生成 case');
// 缩进：switch 的 { 在 16 空格，case 必须在 20 空格（比 { 再进一层），case 体 24 空格。
// 有 LangName 的按钮：case 只调用按钮处理方法（方法名 = LangName 去 MenuItem 前缀）。
assert.match(generatedViewModel, /\n {16}\{\n {20}case "新建示教":\n {24}NewTeaching\(\);\n {24}break;/,
  'case 必须相对 switch 的 { 再缩进一层，命中方法名的按钮 case 体调用该方法');
// 一钮一方法：<summary> 写设计稿按钮文案，方法体只留 TODO，业务由工程师填。
assert.match(generatedViewModel,
  / {8}\/\/\/ <summary>\n {8}\/\/\/ 新建示教\n {8}\/\/\/ <\/summary>\n {8}private void NewTeaching\(\)\n {8}\{\n {12}\/\/ TODO: 新建示教 按钮处理\n {8}\}/,
  '必须为命中方法名的按钮生成 <summary> + private void 处理方法');
assert.match(generatedViewModel, /private void Focus\(\)/, '对焦 -> Focus');
// 临时 LangName（MenuItemIndex<n>）不派生方法名，退回内联 TODO。
assert.match(generatedViewModel, /\n {20}case "工件边缘录入":\n {24}\/\/ TODO: 工件边缘录入 按钮处理\n {24}break;/,
  '临时键按钮必须退回内联 TODO，不得生成 Index3() 这样的方法名');
assert.ok(!/private void Index3\(\)/.test(generatedViewModel), '临时键不得派生按钮处理方法');
assert.match(result.stdout, /新建示教 -> NewTeaching/, 'stdout 审计必须列出按钮 -> 方法');
assert.match(result.stdout, /"name": "工件边缘录入"/, 'stdout 审计必须列出退回内联 TODO 的按钮');
// 退回原因必须按条件分文案（临时键 / 没有 langName），与文档的四条清单一一对应。
assert.match(result.stdout, /是临时键 MenuItemIndex<n>/, '临时键必须给出对应 reason');
assert.match(result.stdout, /该菜单项没有 LangName/, '没有 langName 必须给出对应 reason');
assert.ok(!/LangName "SharedFocusKey"/.test(result.stdout), '共享键应能派生方法名，不该出现退回 reason');
// 方法名只来自 langName：MenuItemMagnificationChange -> MagnificationChange。
assert.match(generatedViewModel, /\n {20}case "倍率变更":\n {24}MagnificationChange\(\);\n {24}break;/);
assert.match(generatedViewModel, /private void MagnificationChange\(\)/);
// 共享键（不带 MenuItem 前缀）不做前缀拦截：整键即方法名。
assert.match(generatedViewModel, /\n {20}case "共享键按钮":\n {24}SharedFocusKey\(\);\n {24}break;/);
assert.match(generatedViewModel, /private void SharedFocusKey\(\)/);
// 一个按钮对应一个方法：发射的方法数量必须与审计列出的方法数量一致。
const handlerCount = (generatedViewModel.match(/ {8}private void [A-Za-z_][A-Za-z0-9_]*\(\)/g) || []).length;
const methodListCount = (JSON.parse(result.stdout).viewModel.buttonMethods || []).length;
assert.strictEqual(handlerCount, methodListCount,
  '一个按钮一个方法：发射的方法数量必须与审计列出的按钮方法一致');

let csproj = fs.readFileSync(csprojPath, 'utf8');
assert.match(csproj, /<Compile Include="UI\\F2-Teach\\View\\F2NewOperationView\.xaml\.cs"\s*\/>/);
assert.match(csproj, /<Compile Include="UI\\F2-Teach\\ViewModel\\F2NewOperationViewModel\.cs"\s*\/>/);
assert.match(csproj, /<Page Include="UI\\F2-Teach\\View\\F2NewOperationView\.xaml">/);
assert.match(csproj, /<Page Include="Resources\\Pages\\F2NewOperation\\F2NewOperationIcons\.xaml">/);
assert.match(csproj, /<Content Include="Resources\\Pages\\F2NewOperation\\F2NewOperationPage\.xml"\s*\/>/);

result = spawnSync(process.execPath, [script, '--manifest', manifestPath], { encoding: 'utf8' });
assert.notStrictEqual(result.status, 0);
assert.match(result.stderr, /already exists|已存在/);

const noIconManifestPath = path.join(projectRoot, 'no-icon-page.json');
fs.writeFileSync(noIconManifestPath, JSON.stringify({
  projectRoot,
  csproj: 'Demo.Pages.csproj',
  area: 'F1-AutoCut',
  pageName: 'NoIconPage',
  viewPath: 'UI/F1-AutoCut/View/NoIconPageView.xaml',
  codeBehindPath: 'UI/F1-AutoCut/View/NoIconPageView.xaml.cs',
  viewModelPath: 'UI/F1-AutoCut/ViewModel/NoIconPageViewModel.cs',
  includeIcon: false
}, null, 2), 'utf8');
result = spawnSync(process.execPath, [script, '--manifest', noIconManifestPath], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const noIconViewPath = path.join(projectRoot, 'UI', 'F1-AutoCut', 'View', 'NoIconPageView.xaml');
assert.doesNotMatch(fs.readFileSync(noIconViewPath, 'utf8'), /UserControl\.Resources|ResourceDictionary/);
assert.doesNotMatch(fs.readFileSync(csprojPath, 'utf8'), /NoIconPageIcon\.xaml/);

fs.writeFileSync(manifestPath, JSON.stringify({
  projectRoot,
  csproj: 'Demo.Pages.csproj',
  area: 'F2-Teach',
  pageName: 'F2NewOperation',
  operation: 'modify-existing',
  viewPath: 'UI/F2-Teach/View/F2NewOperationView.xaml',
  codeBehindPath: 'UI/F2-Teach/View/F2NewOperationView.xaml.cs',
  viewModelPath: 'UI/F2-Teach/ViewModel/F2NewOperationViewModel.cs',
  includeIcon: true,
  iconPath: 'Resources/Pages/F2NewOperation/F2NewOperationIcons.xaml',
  pageXmlPath: 'Resources/Pages/F2NewOperation/F2NewOperationPage.xml'
}, null, 2), 'utf8');
result = spawnSync(process.execPath, [script, '--manifest', manifestPath, '--overwrite'], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
assert.match(result.stdout, /\.bak-/);

const fallbackRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-wpf-pages-fallback-'));
const fallbackCsproj = path.join(fallbackRoot, 'Fallback.csproj');
const fallbackManifest = path.join(fallbackRoot, 'fallback.json');
fs.writeFileSync(fallbackCsproj, '<Project><PropertyGroup><RootNamespace>Fallback</RootNamespace></PropertyGroup></Project>\n', 'utf8');
fs.writeFileSync(fallbackManifest, JSON.stringify({
  projectRoot: fallbackRoot,
  csproj: 'Fallback.csproj',
  area: 'F9',
  pageName: 'FallbackPage',
  includeIcon: false
}, null, 2), 'utf8');
result = spawnSync(process.execPath, [script, '--manifest', fallbackManifest], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
assert.ok(fs.existsSync(path.join(fallbackRoot, 'Pages', 'FallbackPageView.xaml')));
assert.ok(fs.existsSync(path.join(fallbackRoot, 'Pages', 'FallbackPageViewModel.cs')));

// 撞名是输入错误：与 ViewModel 固定成员同名、或两个按钮算出同一方法名 → 直接失败（不静默改名）。
const clashRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-wpf-page-clash-'));
fs.writeFileSync(path.join(clashRoot, 'Demo.Pages.csproj'),
  '<Project><PropertyGroup><RootNamespace>Demo.Pages</RootNamespace></PropertyGroup></Project>\n', 'utf8');
function writeClashManifest(name, menuItems) {
  const file = path.join(clashRoot, name + '.json');
  fs.writeFileSync(file, JSON.stringify({
    projectRoot: clashRoot,
    csproj: 'Demo.Pages.csproj',
    area: 'F3',
    pageName: name,
    includeIcon: false,
    menuItems: menuItems
  }, null, 2), 'utf8');
  return file;
}
let clash = spawnSync(process.execPath, [script, '--manifest',
  writeClashManifest('ClashReserved', [{ name: '确认按钮', index: 1, langName: 'MenuItemOKCmd' }])], { encoding: 'utf8' });
assert.notStrictEqual(clash.status, 0, '与固定成员同名必须直接失败');
assert.match(clash.stderr, /与 ViewModel 成员同名/);
assert.ok(!fs.existsSync(path.join(clashRoot, 'UI', 'F3', 'ViewModel', 'ClashReservedViewModel.cs')),
  '撞名失败时不得留下 ViewModel');
// 两个按钮的 LanguageKey 派生出同一方法名（语言键不唯一时）同样直接失败。
clash = spawnSync(process.execPath, [script, '--manifest',
  writeClashManifest('ClashSame', [
    { name: '按钮甲', index: 1, langName: 'MenuItemFocus' },
    { name: '按钮乙', index: 2, langName: 'MenuItemFocus' }
  ])], { encoding: 'utf8' });
assert.notStrictEqual(clash.status, 0, '两个按钮算出同一方法名必须直接失败');
assert.match(clash.stderr, /同一个处理方法名/);

console.log('PASS MW WPF page generator regression test');
