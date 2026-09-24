# 作业A（Mw WPF）页面格式

本文是作业A 的页面格式口径：页面骨架、布局规则与 ViewModel 契约。**类型判定不在本文**——设计稿组件集/变体 → `ControlType` + 槽位由共享表 `references/component-types.json` 唯一决定；同一类型在 WPF 这一侧怎么写由 `mw-wpf-map.json` 唯一决定。

## 1. 页面骨架

页面是 `<UserControl>`，产物落在 `UI/<区域>/View/<页面名>View.xaml`，同名 code-behind（`.xaml.cs`）以 `<DependentUpon>` 挂在 View 下，ViewModel 在 `UI/<区域>/ViewModel/<页面名>ViewModel.cs`。

固定头（与真实页面 `ManualView.xaml` / `AutoCutView.xaml` 同形）：

```xml
<UserControl x:Class="<RootNamespace>.<区域>.View.<页面名>View"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
             xmlns:s="http://www.maxwell-gp.com/"
             mc:Ignorable="d"
             FocusVisualStyle="{x:Null}"
             d:DesignHeight="<设计稿高>" d:DesignWidth="<设计稿宽>">
```

`<UserControl.Resources>` 承担两件事：合并本页 Icon 字典（见 `page-build-rules.md`），以及把页级默认外观写成 `BasedOn`（例如 `<Style TargetType="{x:Type s:IconButton}" BasedOn="{StaticResource MainButtonStyle}" />`、`<Style TargetType="{x:Type TextBlock}" BasedOn="{StaticResource TextBlockStyle}" />`）。命中具名样式族的控件写 `Style="{StaticResource <样式键>}"`；命中页级默认或框架隐式默认的控件**不写** `Style`。

## 2. 布局规则

坐标载体是 Grid，不是绝对定位：

1. **分区**：只有「框架固定区（`emit=false`）」与**一个内容区**（`emit=true`）。框架固定区只有**顶部栏**与**底部栏**两类（框架的实际加载壳只有这两条常驻带）；它们不进页面，所以**页面外层只有唯一一个 Grid —— 内容网格本身**（不再另套一层带 `Grid.Row` 的根 Grid）；设计稿的业务内容全部落在内容区里，内部按下面的规则分层。
    **层级照设计稿**：成层容器各自发射一层 `<Grid>`（格子产物里是 `container: true`，没有控件类型，内层网格挂在 `children`），它的条目进该层格子。成层容器的判据有两条：设计稿声明的 flex 容器（节点带 `flexContainerInfo.flexDirection`；内层按主轴拆带），或**带尺寸约束的容器**（约束必须有承载物，内层按 bbox 聚类）。只有**一个条目**的容器展平（没有主轴关系可表达，内容提到上一层），区域根网格也不做 1×1 空壳（顶层是"单容器链"时把最内层条目提上来）；带约束的容器是这两条收口规则的例外，不展平。没有 flex 声明、也没有尺寸约束的包裹层同样展平到最近一层。
2. **框架固定区以框架为准**：顶部栏、底部栏由框架渲染，**不发射进页面**；它们的高度用框架 Token（`MaxwellFramework_HeaderHeight` / `MaxwellFramework_BottomHeight`）登记在布局产物的 `source` 里，只用于布局产物登记与 Layout 注册。设计稿的**右下角常驻分组**（`右侧底部-常驻button`）与 `mtslg-iocontrol` 同口径：整组不发射进页面、不参与布局计格、其中的图形不登记图标（框架单独处理），A 路线不另立口径。
3. **尺寸照设计稿**：普通 region 的行列尺寸取设计稿像素（`source: "design"`），控件自身尺寸取设计稿 bbox；格子放不下时是设计问题，不改写成"凑得下"的值。
4. **行列来源**：设计稿声明的 `flexContainerInfo.flexDirection`（`row`/`column`）优先——`flexDirection` 沿父链读取（不限节点类型），条目＝声明容器到该控件这条路径上容器的直接子节点；**同一个声明容器**在同一条带里出现两个及以上条目才拆，拆点取条目设计稿起点，`gap` 体现在"下一带起点 − 本带起点"。没有声明（或该带内只有一个条目）的层级按 bbox 聚类（列＝x 区间重叠、行＝y 起始边邻近）。容器内的条目、以及内容区这一层，都走同一套拆带规则。
   落格按**起始边**判定归属（横跨多行的控件不吞掉后面的行），控件 bbox 覆盖到的带全部算跨度：格子的 `rowSpan` / `columnSpan` 由覆盖带数得出，发射器照写 `Grid.RowSpan` / `Grid.ColumnSpan`；占格只按起始格判定，跨格控件与设计稿一样允许压住邻格。
5. **落格**：控件写 `Grid.Row` / `Grid.Column`，跨格再写 `Grid.RowSpan` / `Grid.ColumnSpan`。**同一锚点（起始）格只放一个控件**：推导用占用表 + 撞格下移保证锚点格唯一，门禁 R5 也按锚点判重，出现重复即产物被改坏。覆盖邻格见第 4 条。
6. **单行/单列**：只有一行或一列时不写 `Grid.RowDefinitions` / `Grid.ColumnDefinitions`，也不写 `Grid.Row` / `Grid.Column`。
7. **一维星号**：星号尺寸写成裸 `<RowDefinition />` / `<ColumnDefinition />`，像素尺寸写 `Height="<值>"`。
8. **尺寸约束**：设计稿用「宽度 / 高度」栏设置的最小/最大宽高走 DSL 节点的 `constraints` 字段（来源、合并与官方支持后的切换点见 `page-build-rules.md` 第 5 节）。布局推导只把它透传进格子，发射器在控件与容器 Grid 上写 `MinWidth / MaxWidth / MinHeight / MaxHeight`；`TextBlock` 在设了最大宽时补 `TextWrapping="Wrap"`。

## 3. 外观与协议

- **外观只走样式族**：`Style`、`Background`、边框与状态模板一律取 `mw-wpf-map.json` 的样式族键；设计稿的配色/边框与样式族冲突时**停下报告**，不散写属性凑。
- **样式族选择键是 `(ControlType, 设计稿变体名)`**：命中 `styleRules.byVariant` 用具名键；未命中则用该类型的 `pageDefault`（`"implicit"` 表示走框架隐式默认样式），并记入发射报告供人工评审。两者都取不到即 fail-closed。
- **文本**：一律走 `{DynamicResource <LangName>}`，挂载属性由 `textBinding` 决定（按钮默认 `Content`，`RightButtonStyle` / `UpDownRightButtonStyle` 这类"图标上+文字下"的样式族改挂 `IconText`，`TextBlock` 挂 `Text`，`GroupBox` 挂 `Header`）。没有语言键的文本不写字面量，进发射报告的待办。
- **图形**：`Icon="{StaticResource <图形名>}"`，图形名取自本页 Icon 台账。
- **协议**（`Click="{s:Action …}"`、`PageName="Jump:…"`、`IOEnable`、`IOVisible`、`IOName`）：只在有来源时发射，A 侧不写空串占位（与作业B 的"恒写空串"口径不同，因为 A 侧没有宿主恒写字段）。

## 4. ViewModel 契约

ViewModel 与作业B 共用同一套生成器（`scripts/host/gen-mw-wpf-page.js`）：构造函数、`pageDesign` 之外恒含 `OnViewLoaded` / `HandleButtonEvent` 等固定成员，底部栏菜单项（`menuItems[].langName`）派生出按钮处理方法并在 `switch (message.ButtonName)` 里落 case。A 侧页面**不加载** IOContorl 页面 XML（控件在 `View.xaml` 里），因此 `.csproj` 不注册 `<Content>` 的页面 XML 项；其余注册项（View / code-behind / ViewModel / 本页 Icon / 本页语言字典）与作业B 相同。

## 5. 验证

静态门禁 = `scripts/adapters/mw-wpf/check-wpf-layout.js`（越界 / 锚点格冲突 / 禁止写法 / 协议属性名 / 资源键闭环 / 硬编码文本 / 尺寸来源 / 推导待确认 / 尺寸约束一致性、落格与发射；尺寸约束三条需传 `--dsl`，其中发射一条还要 `--xaml`；**空行空列、`manual-only` 类型与布局产物 `constraintExempt` 里登记的带约束节点（页面根 / 不可见 / 框架固定区）只作提示，不失败**），`run-all.ps1 -Mode mw-wpf` 的第 11、12 步就是它。尺寸约束来源经 `run-all.ps1 -Constraints <约束.json>` 传入（见 `page-build-rules.md` 第 5 节）。

编译与加载验证属「项目运行时交付」门禁，只在目标项目接入且用户明确要求时执行；没有目标项目时只出静态脚手架。
