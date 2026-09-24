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

1. **禁止写法**：发射区出现写法表未登记或登记为待确认的类型（`Border`：手册有条目但没有 A 侧控件）即失败；框架固定区里出现控件也失败。`Camera` 是 `manual-only`（证据不全，只有用户确认），可以发射。
2. **协议属性名**：`--types` 产物节点的 `attrs` 里，凡属协议属性名集合（由写法表 `protocols` 派生）的键，必须在该类型的 `protocols` 里登记过（只校验名字，不校验取值形状）。门禁只在第 11/12 步运行，`--types` 恒为 Bundle 定稿的 `Generated/<页面名>.mapping.json`；第 8 步的布局推导另用类型判定产物。
3. **格子越界**：`row` / `column` / 跨格数必须落在本 region 的行列范围内。
4. **空行空列**：**不失败，只作为提示（`notices`）登记**。目标框架允许 Grid 出现空行空列（框架自身控件模板里就有空列），且保留空列能让后续控件维持设计稿坐标，不因折叠空列而左移/上移。
5. **锚点格冲突**：同一**锚点格**（`Grid.Row` + `Grid.Column` 起点）只允许一个控件（推导保证唯一，重复即产物损坏）。跨格覆盖邻格的判定见 `mw-wpf-mode.md` 第 2 节第 4 条。
6. **资源键闭环**：用到的 `{StaticResource <键>}` 必须来自写法表样式族、本页 Icon 台账或本页 Icon 字典合并点。
7. **文本零硬编码中文**。
8. **尺寸来源**：框架固定区必须是 `framework:<Token>`，其余必须是 `design`。
9. **推导待确认**：布局推导阶段挂起的节点（未归格 / 无尺寸 / 结构对不上 / 类型无处发射）逐条失败——它与第 1 条不同：第 1 条是"写法表没这个类型"，第 9 条是"布局推导没把它放下"。
10. **待人工确认（提示）**：页面用到写法表 `status: manual-only` 的类型（证据不全：有手册条目但真实页面未出现，或只有用户确认，如 `Camera`）时，登记提示 `R10`，不失败——"首次生成需人工确认、事后补齐缺的证据"以提示为落点。
11. **尺寸约束一致性**：格子带的尺寸约束必须与 DSL 节点上的 `constraints` 逐个一致（多一项 / 少一项 / 改数值都失败）——约束是设计意图，不允许推导侧改动。
12. **尺寸约束未落格**：带约束的节点在布局产物里既没有对应格子、也不在产物登记的 `constraintExempt` 里即失败（`R12`）——约束是设计意图，产物漏了就是漏了。豁免只有 `constraintExempt` 里登记的三类（页面根 / 不可见 / 框架固定区）；其余未落格的带约束节点（含待确认类型、无尺寸等）一律失败。判定范围与常见成因见第 5 节第 4 条。
13. **尺寸约束未发射**：带约束的格子必须在 `View.xaml` 里出现对应的 `MinWidth / MaxWidth / MinHeight / MaxHeight`（入参前提见 `check-wpf-layout.js` 头部 CLI 注释）。
14. **格子尺寸与尺寸/对齐发射**：每个格子必须登记格子尺寸（像素带照值、唯一的收尾星号带取"可用尺寸 − 其余像素带"、跨格按 span 累加）与承载物设计尺寸；发射报告里该格子的 `Width / Height / HorizontalAlignment / VerticalAlignment / Margin` 必须与 `scripts/lib/design-box.js` 的同一实现一致（格子尺寸 − 控件尺寸 = 间距，差值落在哪一侧由设计稿偏移决定）。缺格子尺寸、格子尺寸与行列定义重算不一致、报告缺条目或取值不一致都失败（入参前提见 `check-wpf-layout.js` 头部 CLI 注释）。**例外两类**（都由推导登记在格子上，按维判定）：`cell.shifted`（为避让撞格被挪出设计带）没有偏移真值——只写控件自身尺寸、不表达间距 / 对齐，只有这一半按提示登记；`cell.unsized = {width?,height?}`（收尾星号带被前面的像素带吃光＝内容溢出承载物）——该维什么都不写，且只在该维重算值非正数时才放行（重算 > 0 即失败，说明产物被改坏）。两类格子的重算值都有机械真值（`unsized` 的那一维只在重算非正数时允许缺尺寸），格子尺寸与承载物设计尺寸的登记要求照常适用；发射报告缺条目、取值不一致与第 11 / 13 条照常失败。

门禁报告落在 `Generated/_inputs/<页面名>.wpf-gate.json`；发射器自己的报告（命中的样式键、未命中变体、待办文本、跳过的固定区）落在 `Generated/_inputs/<页面名>.wpf-xaml.report.json`。

## 5. 尺寸约束（min/max 宽高）

设计稿可以在「宽度 / 高度」栏用「添加」设置**最小 / 最大宽高**。这四个值只存在于插件 API（`LayoutMixin` 的 `minWidth` / `maxWidth` / `minHeight` / `maxHeight`），DevMode DSL 与 MCP 都不导出，所以由插件侧单独取、由流水线合并：

1. **取约束**：需要一份**外部导出的约束 JSON**（本仓库不产出该文件）。形状固定为 `{ pageId, nodes: [{ id, minWidth, maxWidth, minHeight, maxHeight, … }] }`；**未设置返回 `0`（不是 `null`）**，只有 `> 0` 才算设置。
2. **合并**：`scripts/core/apply-constraints.js --dsl <dsl.snapshot.json> --constraints <约束.json>` 把 `node.constraints = { minWidth, maxWidth, minHeight, maxHeight }`（只保留 `> 0` 的项）合并进 DSL 快照，**不改动 DSL 任何原生字段**。配对先按完整 id，再按复合 id 末段兜底（实例内子层两边链长不同）；末段歧义不猜，记进报告。
3. **入口**：`run-all.ps1 -Constraints <约束.json>`；不给就自动找 `Generated/_inputs/<页面名>.constraints.json`；两者都没有 = 无约束。`-RequireConstraints` 要求约束来源必须存在且至少配上一条（缺失或全空直接失败，不静默退化成"无约束"）。解析与合并只有 `Resolve-LayoutDslSnapshot` 一处实现：第 8 步（布局推导）与第 11 / 12 步（门禁、复核）都调它重算，不读磁盘上遗留的合并快照。
4. **透传**：布局推导只把 `constraints` 透传进对应格子（`cell.constraints`），不推算、不补默认值。**带约束的容器不展平**——不展平是落格的必要条件，不是充分条件：容器还要有可发射的内容才落到产物（展平等于放弃承载物，所以不展平是前提）。
   **豁免的只有 `constraintExempt` 三类**：页面根（画布本身不是页面里的控件）、不可见节点、落在框架固定区（顶部栏 / 底部栏）的节点——由布局推导登记进产物的 `constraintExempt`（含原因），门禁按它登记提示、不失败。其余带约束节点在产物里没有格子即失败（门禁报 `R12`），不许静默丢；常见成因与处置（不封闭枚举）：容器子树里没有可发射的控件（补可发射内容，或由设计侧确认这个盒子是否真的要在页面里存在）、待确认类型 / 无尺寸等不进格子的节点（先按门禁第 1 / 9 条修类型判定与映射）、产物与本次输入不同步（先重跑第 8 步）。
5. **发射**：`View.xaml` 上落 `MinWidth / MaxWidth / MinHeight / MaxHeight`（控件与容器 Grid 都写）；`TextBlock` 在设了最大宽时补 `TextWrapping="Wrap"`。
6. **门禁**：第 4 节第 11 / 12 / 13 条。

**官方 DSL 支持这四个字段之后**：删掉 `apply-constraints.js` 这一步与 `run-all.ps1` 的 `-Constraints` / `-RequireConstraints` 入口，改由下游直接读 DSL 节点自带的同名字段。键名一致时，布局推导、XAML 发射、门禁三处一行都不用改——要动的只有"约束来源"这一处适配。
