<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；属性 .cs 默认值不可见); pending=[待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOProgressBar.xaml, {source_root}/ManualView.xaml] -->

# IOProgressBar（带标题/结果状态进度条）

## 1. 用途

**结果状态型**进度条（非百分比数值型）：左侧可显标题（Title）+ 中段圆角进度轨（Indicator）+ 右侧结果图标（PART_Path，勾/叉 0.2s 淡入）。由 `Result`（成功/失败）与 `IsComplete`（完成态）驱动视觉——失败且完成时进度轨变 `WarningBrush` 红色。用于流程完成/失败结果反馈。

典型场景（推断，无 P2 实例）：流程步骤结果提示。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:IOProgressBar … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOProgressBar`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件仅含隐式默认样式；同文件内还定义 `IORangeProgressBar` 的隐式样式（见 [io-range-progress-bar](io-range-progress-bar.md)）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Title | string | 左侧标题文字（列 0）；`ShowTitle=True` 时显示（默认 Collapsed） | `x:Name="PART_Title"` TextBlock `Text="{TemplateBinding Title}"` + `Trigger Property="ShowTitle"` | ✅ |
| Text | string | 条内右侧文字（字号 10，白底反色）；`ShowText=True` 时显示（默认 Hidden） | `x:Name="PART_TextBlock"` `Text="{TemplateBinding Text}"` + `Trigger Property="ShowText"` | ✅ |
| Result | bool | 结果态：True→图标 SuccessGeometry + 勾色 `NormalBrush`；False→ErrorGeometry + 叉色 `WarningBrush`（Indicator 底色保持） | `Trigger Property="Result" Value="True"/"False"` | ✅ |
| ShowText | bool | 条内文字显隐 | `Trigger Property="ShowText" Value="True"` | ✅ |
| ShowTitle | bool | 标题显隐 | `Trigger Property="ShowTitle" Value="True"` | ✅ |
| IsComplete | bool | 完成态：True 时结果图标 0.2s 淡入（StoryboardShow），退出淡出（StoryboardHidden）；且 IsComplete=True + Result=False 时 Indicator 变 `WarningBrush` | `Trigger Property="IsComplete"` + `MultiTrigger`（IsComplete=true, Result=false） | ✅ |
| Height / Width | 18 / 280 | 默认尺寸（模板内固定） | `Setter Property="Height"/"Width"` | ✅ |
| Background / BorderBrush / BorderThickness | `BackgroundBrush` / `BorderBrush` / 0 | 默认画刷与无边框；Background 经 TemplateBinding 到模板轨 Border | `Setter Property="Background"/"BorderBrush"/"BorderThickness"` + 模板 `TemplateRoot` Border | ✅ |
| （无 IOEnable 证据） | — | 模板中无 IOEnable / 协议挂点；设备联锁协议见 TD-001 | 模板全文 + `{source_root}/ManualView.xaml`（IOEnable 仅出现于 IconButton） | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\IOProgressBar.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| （隐式默认样式 IOProgressBar） | 无（独立，MergedDictionaries 引 BaseStyle.xaml） | 18×280；三列 Auto/*/23；PART_Title + TemplateRoot(圆角5) + Indicator(圆角5) + PART_TextBlock + PART_Path 结果图标；Result/ShowText/ShowTitle/IsComplete 4 组触发器 + 1 组 MultiTrigger + 2 Storyboard | 结果状态反馈 |
| （同文件 IORangeProgressBar 隐式样式） | 无（独立） | 同文件定义——同名隐式样式另见 IORangeProgressBar.xaml（合并顺序决定生效者，关联 TD-008） | 见 [io-range-progress-bar](io-range-progress-bar.md) |

模板内资源键（ControlTemplate.Resources）：`StoryboardShow`（PART_Path Opacity→1，0.2s）/ `StoryboardHidden`（Opacity→0，0s）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 FrameworkGeneric.xaml 均未出现 `s:IOProgressBar`。

```xml
<s:IOProgressBar Title="{DynamicResource …标题键}"
                 ShowTitle="True"
                 Result="True"
                 IsComplete="True" />
```

- 语义是**结果反馈**：Result 决定勾/叉（SuccessGeometry/NormalBrush vs ErrorGeometry/WarningBrush），IsComplete 触发图标 0.2s 淡入，双条件（IsComplete+失败）把 Indicator 染红 `WarningBrush`——不是填进度百分比；
- 图标几何经 DynamicResource 键引用：`SuccessGeometry`/`ErrorGeometry`（`{source_root}/SDC/Geometries.xaml`，SDC 根，非 Style/）；
- 需要百分比数值进度的场景，本控件无模板证据（无 Value/Maximum 绑定），不得硬套。

## 6. 禁止写法对照

### ❌ 禁止：手写 ProgressBar / Grid + Border + 图标拼装结果反馈（常规 WPF 写法）

```xml
<Grid>
    <Grid.ColumnDefinitions>
        <ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/><ColumnDefinition Width="23"/>
    </Grid.ColumnDefinitions>
    <TextBlock Grid.Column="0" Text="结果" Margin="0 0 15 0" Visibility="Collapsed"/>
    <Border Grid.Column="1" Height="16" CornerRadius="5" Background="…">
        <Border x:Name="ind" Height="14" Background="{StaticResource …}" CornerRadius="5" HorizontalAlignment="Left"/>
    </Border>
    <Path Grid.Column="2" x:Name="icon" Width="18" Height="18" Opacity="0"
          Data="{StaticResource SuccessGeometry}"/>
</Grid>
<!-- 再在代码里手写：完成→图标淡入、失败→叉与红色、标题显隐… -->
```

### ✅ 推荐：IOProgressBar 属性化（模板证据构造）

```xml
<s:IOProgressBar Title="{DynamicResource …标题键}" ShowTitle="True"
                 Result="True" IsComplete="True" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版缺失全套状态——Result 勾/叉切换（SuccessGeometry/ErrorGeometry + NormalBrush/WarningBrush）、IsComplete 淡入动画（0.2s StoryboardShow）、失败+完成 Indicator 变红（MultiTrigger 双条件）；
2. **② 丢失协议挂点**：Title/Text/Result/ShowText/ShowTitle/IsComplete 属性协议全无，状态只能靠页面代码散写；
3. **③ 无法样式族切换**：轨/条尺寸（18×280、圆角 5、Indicator 高 14）、画刷（ProgressBoxFillBrush）全部散写，不能由隐式默认样式一处调整；
4. **⑤ 脱离视觉规范**：用原生 `ProgressBar` 或手拼 Border 模拟——百分比语义与结果语义混用，视觉规范（ProgressBoxFillBrush 渐变轨、圆角、图标位 23px 列）脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOProgressBar.xaml`（锚点：隐式 `Style TargetType="{x:Type controls:IOProgressBar}"`、`x:Name="PART_Title"` / `x:Name="PART_TextBlock"` / `x:Name="PART_Path"`、`Trigger Property="Result"` / `Trigger Property="IsComplete"` / `Trigger Property="ShowText"` / `Trigger Property="ShowTitle"`、`MultiTrigger`）
- 画刷/几何：`{source_root}/SDC/Brushes.xaml`（`x:Key="ProgressBoxFillBrush"` / `x:Key="NormalBrush"` / `x:Key="WarningBrush"`）、`{source_root}/SDC/Geometries.xaml`（`x:Key="SuccessGeometry"` / `x:Key="ErrorGeometry"`）
- 真实使用：无（ManualView.xaml / FrameworkGeneric.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOProgressBar.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：IOProgressBar 属性集（Title/Text/Result/ShowText/ShowTitle/IsComplete）的 .cs 默认值与驱动逻辑（模板 Trigger 可见，控件代码不可见）。
- [待确认 TD-xxx]：`ProgressBoxFillBrush` 双定义（`{source_root}/SDC/Brushes.xaml` 与 `{source_root}/SDC/Style/Progress.xaml`）的合并顺序生效语义（关联 TD-008）。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据；IOEnable 使用面仅见 IconButton（`{source_root}/ManualView.xaml`），「IO 系列核心协议 IOEnable」在 IOProgressBar 无模板支持，待框架作者确认（见手册发布说明）。
