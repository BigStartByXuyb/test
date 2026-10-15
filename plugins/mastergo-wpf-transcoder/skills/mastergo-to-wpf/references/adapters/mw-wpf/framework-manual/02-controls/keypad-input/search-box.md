<!-- evidence=已确认(属性 Setter/模板/触发器均为模板源码直接证据；SearchContent 行为与搜索触发 .cs 不可见); pending=[TD-040];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/SearchBox.xaml, {source_root}/SDC/Sizes.xaml, {source_root}/SDC/Geometries.xaml, {source_root}/ManualView.xaml] -->

# SearchBox（搜索输入框）

## 1. 用途

框架版搜索输入框：文本框 + 右侧搜索按钮（放大镜图标）一体——`SearchContent` 属性承载搜索关键字，搜索按钮内建 Hover/Pressed 触发态（Pressed 时图标反白）。**无键盘弹出挂点、无错误提示**——家族中功能面最简控件。

典型场景（推断，无 P2 实例）：查询/过滤输入条。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:SearchBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:SearchBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件合并 BaseStyle.xaml（未引用 NumberBox.xaml——不共享家族键），自带两个内部样式键 `InputTextBox`（TextBox 宿主）与 `SearchInputBoxSearchButton`（搜索按钮）。仅定义隐式默认样式。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| SearchContent | string | 搜索关键字；模板 PART 内部 TextBox 经 TemplateBinding 绑定——单向/双向与更新时机 .cs 不可见 | 模板 `<TextBox … Text="{TemplateBinding SearchContent}" …/>` | 🟡 [待确认 TD-040] |
| Height / Width | DynamicResource SearchBoxHeight（35）/ SearchBoxWidth（130） | 默认尺寸走专属 Sizes Token | 样式 Setter + `{source_root}/SDC/Sizes.xaml` `x:Key="SearchBoxHeight"`/`x:Key="SearchBoxWidth"` | ✅ |
| Background / BorderBrush / BorderThickness / Foreground | PrimaryDefaultBrush / ButtonBorderGradientBrush / 0 / PrimaryTextBrush | 默认画刷（外层无边框，内部 TextBox 自带边框） | 样式 Setter | ✅ |
| IsEnabled | bool | 禁用：外层模板 Opacity 0.5 | 模板 `Trigger Property="IsEnabled"` → templateRoot Opacity 0.5 | ✅ |
| （无 NumericKeypadAttach / Poptip / IsError / IsReadOnly 证据） | — | 本控件无键垫挂点、无错误提示、无只读态——与家族其它控件差异 | 模板全文 | ✅（阴性证据） |
| （无 IOEnable / s:Action / PageName 证据） | — | 模板无协议挂点 | 模板全文 + `{source_root}/ManualView.xaml` | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\SearchBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| SearchInputBoxSearchButton | 无（TargetType 原生 Button） | 搜索按钮：35 宽（SearchBoxIconBackgroundWidth）、放大镜图标（SearchGeometry，15×15，PrimaryDeepToolBrush）、BorderThickness 0 1 1 1；Hover=PrimaryToolBrush、Pressed=深底反白图标、禁用 0.5 | 内部共用（搜索条右按钮），不直接用 |
| InputTextBox | 无（TargetType 原生 TextBox） | 搜索框宿主：SubHeaderFontSize、TabNavigation=None、AllowDrop、PART_ContentHost 模板；**键名与 NumberBox.xaml 的 `InputTextBoxBase` 不同（同名易混，交叉核对无冲突）** | 内部共用（搜索条文本框），不直接用 |
| （隐式默认样式，无 x:Key） | 无（独立；合并 BaseStyle.xaml） | 默认 Setter 全集 + 模板：templateRoot Border（透明）包 Grid[*][auto]：InputTextBox（SearchContent 绑定）+ SearchInputBoxSearchButton；4 组触发器 | 未显式指定 Style 时 |

**家族结构差异**：不合并 NumberBox.xaml（无 InputTextBoxBase/UpdownButtonStyle 依赖）、无键垫 Popup、无 Poptip、无步进钮——「输入框家族」中唯一独立结构的成员。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 与组合模板均未使用 SearchBox（grep 全库仅定义处命中）。以下为模板证据构造。

```xml
<s:SearchBox SearchContent="{Binding …搜索关键字}" />
```

- 搜索关键字经 SearchContent 属性承载（绑定行为待确认 TD-040）；
- 搜索按钮的点击处理未在模板绑定 Command——搜索触发在 .cs 行为面（待确认 TD-040）；
- 内部 TextBox 悬停/聚焦自动高亮 PrimaryToolBrush，搜索按钮悬停时文本框右缘边框补全（模板 Trigger）；
- 尺寸走专属 Token（130×35），与家族 TextBox 尺寸 Token（100×35）不同。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBox + 放大镜 Button 拼装搜索条（常规 WPF 写法）

```xml
<Grid Width="130" Height="35">
    <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/>
        <ColumnDefinition Width="35"/>
    </Grid.ColumnDefinitions>
    <TextBox x:Name="searchInput" Padding="5 0 0 0" VerticalContentAlignment="Center"/>
    <Button Grid.Column="1" x:Name="searchBtn" Click="Search_Click">
        <Path Width="15" Height="15" Stretch="Uniform"
              Data="M8.333,13.333 …搜索几何路径…" Fill="Gray"/>
    </Button>
</Grid>
<!-- 再手写：按钮悬停/按下换色、图标反白、输入框聚焦高亮、禁用半透明… -->
```

### ✅ 推荐：SearchBox 一行（模板证据构造）

```xml
<s:SearchBox SearchContent="{Binding …搜索关键字}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版缺失搜索按钮 Hover=PrimaryToolBrush / Pressed 深底反白（SearchPath Fill 切 PrimaryDefaultBrush）、文本框悬停/聚焦高亮、按钮悬停时右缘边框补全（BorderThickness 1 1 0 1）、禁用 0.5 全套触发；
2. **② 丢失协议挂点**：SearchContent 数据协议与 .cs 搜索触发机制全无，关键字只能自行维护；
3. **③ 无法样式族切换**：搜索条规范（130×35 Token、按钮 35 宽、图标 15×15 SearchGeometry）散写失控，无法随框架一处调整；
4. **④ 图标规范丢失**：手写 Path Data 绕过 SearchGeometry 图标键（总则 5：图标一律引用 Geometry 键）；
5. **⑤ 脱离视觉规范**：TabNavigation=None、FocusVisualStyle 等交互规范脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/SearchBox.xaml`（锚点 `x:Key="SearchInputBoxSearchButton"`、`x:Key="InputTextBox"`、`Text="{TemplateBinding SearchContent}"`、`x:Name="SearchInputBoxSearchButton"`）
- 尺寸 Token：`{source_root}/SDC/Sizes.xaml`（`x:Key="SearchBoxWidth"`=130 / `x:Key="SearchBoxHeight"`=35 / `x:Key="SearchBoxIconBackgroundWidth"`=35 / `x:Key="SearchBoxIconWidth"`=15 / `x:Key="SearchBoxIconHeight"`=15）
- 图标：`{source_root}/SDC/Geometries.xaml`（`x:Key="SearchGeometry"`，放大镜）
- 真实使用：无（ManualView.xaml 与组合模板不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_SearchBox.xaml.json`

## 8. 待确认项

- **TD-040**：SearchContent 绑定行为（单向/双向、更新时机）与搜索触发协议（模板内搜索按钮无 Command 绑定——点击搜索在 .cs 行为面，含搜索确认机制）。
