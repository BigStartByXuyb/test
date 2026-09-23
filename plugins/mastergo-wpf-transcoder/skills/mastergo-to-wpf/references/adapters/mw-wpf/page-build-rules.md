# 作业A（Mw WPF）页面产物规则

本文写作业A 的**产物布局**、**本页 Icon 字典与合并点**、**多语言键**与**写入门禁**。页面骨架与布局规则见 `mw-wpf-mode.md`；写法表字段口径见 `mw-wpf-map.json`。

## 1. 产物布局

| 产物 | 路径 | 级别 |
|---|---|---|
| 页面 View | `UI/<区域>/View/<页面名>View.xaml` | 页面级 |
| code-behind | `UI/<区域>/View/<页面名>View.xaml.cs` | 页面级（`<DependentUpon>` 挂在 View 下） |
| ViewModel | `UI/<区域>/ViewModel/<页面名>ViewModel.cs` | 页面级 |
| 本页 Icon 字典 | `Resources/Pages/<页面名>/<页面名>Icons.xaml` | 页面级 |
| 本页语言字典 | `Resources/Pages/<页面名>/<页面名>_<语言>.xaml` | 页面级 |
| Layout 注册 | `Resources/Layout/Layout.xml` | 项目级（本页只增量写自己的注册） |
| 类型判定产物 | `Generated/<页面名>.component-types.json` | 页面级（第 5 步） |
| 布局产物 | `Generated/<页面名>.wpf-layout.json` | 页面级（第 8 步） |

跨页不得同名、不得互相引用。作业A 不产出 IOContorl 页面 XML。

## 2. 本页 Icon 字典与合并点

1. 图形资源名由 `discover` 步骤机械给出候选、由人工命名表定名，台账落在 `Generated/_inputs/<页面名>.icon-map.json`；命名规则与作业B 相同（`…Geometry`、禁止用图层 ID/坐标/外观拼名）。
2. 台账里的每条图形名写进本页 `Icons.xaml` 的 `x:Key`。
3. `View.xaml` 的 `<UserControl.Resources>` **必须**合并本页 Icon 字典：

```xml
<ResourceDictionary Source="/<程序集名>;component/Resources/Pages/<页面名>/<页面名>Icons.xaml" />
```

合并点是硬要求：A 页面用 `{StaticResource …Geometry}` 引用图形，`StaticResource` 在加载期解析，页面自身没有合并点就会抛 `XamlParseException`（框架规则 R5）。程序集名取 `.csproj` 的 `AssemblyName`（缺省回退 `RootNamespace` 末段）。

## 3. 多语言键

- 一页一套语言字典（`CN` / `EN`），与作业B 同一套产键与译文口径：设计稿给出的每个文本都产键，文本一律走 `{DynamicResource <LangName>}`。
- 键名按「页面名 + 设计文本语义」派生，写进语言字典；中英文写法相同的键在交付说明里单列。
- **零硬编码中文**：`emit:true` 的区域里不得出现字面中文，门禁按这条拦。

## 4. 写入门禁

`scripts/adapters/mw-wpf/check-wpf-layout.js`（`run-all.ps1 -Mode mw-wpf` 第 11、12 步）逐条断言：

1. **禁止写法**：发射区出现写法表未登记或登记为待确认的类型（`Border` / `Camera`）即失败；框架固定区里出现控件也失败。
2. **协议语法**：协议属性必须符合写法表 `protocols` 的形状；出现未登记的协议属性失败。
3. **格子越界**：`row` / `column` / 跨格数必须落在本 region 的行列范围内。
4. **空行空列**：**不失败，只作为提示（`notices`）登记**。目标框架允许 Grid 出现空行空列（框架自身控件模板里就有空列），且保留空列能让后续控件维持设计稿坐标，不因折叠空列而左移/上移。
5. **同格冲突**：同一**锚点格**（`Grid.Row` + `Grid.Column` 起点）多控件必须各自带互斥条件；跨格控件覆盖到的邻格不算冲突（设计稿允许互相压住），门禁也只按锚点判重。
6. **资源键闭环**：用到的 `{StaticResource <键>}` 必须来自写法表样式族、本页 Icon 台账或本页 Icon 字典合并点。
7. **文本零硬编码中文**。
8. **尺寸来源**：框架固定区必须是 `framework:<Token>`，其余必须是 `design`。
9. **推导待确认**：布局推导阶段挂起的节点（未归格 / 无尺寸 / 结构对不上 / 类型无处发射）逐条失败——它与第 1 条不同：第 1 条是"写法表没这个类型"，第 9 条是"布局推导没把它放下"。

门禁报告落在 `Generated/_inputs/<页面名>.wpf-gate.json`；发射器自己的报告（命中的样式键、未命中变体、待办文本、跳过的固定区）落在 `Generated/_inputs/<页面名>.wpf-xaml.report.json`。
