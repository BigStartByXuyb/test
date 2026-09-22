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

1. **分区**：设计稿的具名容器/带状区域切成 region，每个 region 有自己的行列定义与格子。
2. **框架固定区以框架为准**：顶部栏、底部栏、右侧栏常驻由框架渲染，**不发射进页面**；它们的尺寸用框架 Token（`MaxwellFramework_HeaderWidth/Height`、`MaxwellFramework_BottomHeight` 等）登记在布局产物的 `source` 里，并只用于生成 Layout 注册与菜单项。
3. **尺寸照设计稿**：普通 region 的行列尺寸取设计稿像素（`source: "design"`），控件自身尺寸取设计稿 bbox；格子放不下时是设计问题，不改写成"凑得下"的值。
4. **落格**：控件写 `Grid.Row` / `Grid.Column`（跨格再写 `Grid.RowSpan` / `Grid.ColumnSpan`）；同一格只放一个控件，放多个必须各自带互斥条件（`IOVisible` 或 `IOEnable` 表达式且互不相同），否则门禁失败。
5. **单行/单列**：只有一行或一列时不写 `Grid.RowDefinitions` / `Grid.ColumnDefinitions`，也不写 `Grid.Row` / `Grid.Column`。
6. **一维星号**：星号尺寸写成裸 `<RowDefinition />` / `<ColumnDefinition />`，像素尺寸写 `Height="<值>"`。

## 3. 外观与协议

- **外观只走样式族**：`Style`、`Background`、边框与状态模板一律取 `mw-wpf-map.json` 的样式族键；设计稿的配色/边框与样式族冲突时**停下报告**，不散写属性凑。
- **样式族选择键是 `(ControlType, 设计稿变体名)`**：命中 `styleRules.byVariant` 用具名键；未命中则用该类型的 `pageDefault`（`"implicit"` 表示走框架隐式默认样式），并记入发射报告供人工评审。两者都取不到即 fail-closed。
- **文本**：一律走 `{DynamicResource <LangName>}`，挂载属性由 `textBinding` 决定（按钮默认 `Content`，`RightButtonStyle` / `UpDownRightButtonStyle` 这类"图标上+文字下"的样式族改挂 `IconText`，`TextBlock` 挂 `Text`，`GroupBox` 挂 `Header`）。没有语言键的文本不写字面量，进发射报告的待办。
- **图形**：`Icon="{StaticResource <图形名>}"`，图形名取自本页 Icon 台账。
- **协议**（`Click="{s:Action …}"`、`PageName="Jump:…"`、`IOEnable`、`IOVisible`、`IOName`）：只在有来源时发射，A 侧不写空串占位（与作业B 的"恒写空串"口径不同，因为 A 侧没有宿主恒写字段）。

## 4. ViewModel 契约

ViewModel 与作业B 共用同一套生成器（`scripts/host/gen-mw-wpf-page.js`）：构造函数、`pageDesign` 之外恒含 `OnViewLoaded` / `HandleButtonEvent` 等固定成员，底部栏菜单项（`menuItems[].langName`）派生出按钮处理方法并在 `switch (message.ButtonName)` 里落 case。A 侧页面**不加载** IOContorl 页面 XML（控件在 `View.xaml` 里），因此 `.csproj` 不注册 `<Content>` 的页面 XML 项；其余注册项（View / code-behind / ViewModel / 本页 Icon / 本页语言字典）与作业B 相同。

## 5. 验证

静态门禁 = `scripts/adapters/mw-wpf/check-wpf-layout.js`（越界 / 空行空列 / 同格冲突 / 禁止写法 / 协议语法 / 资源键闭环 / 硬编码文本 / 尺寸来源 / 推导待确认），`run-all.ps1 -Mode mw-wpf` 的第 11、12 步就是它。

编译与加载验证属「项目运行时交付」门禁，只在目标项目接入且用户明确要求时执行；没有目标项目时只出静态脚手架。
