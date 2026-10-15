<!-- evidence=已确认(属性/模板/触发器均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[TD-060];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/ProgressBar.xaml, {source_root}/ManualView.xaml] -->

# ProgressBar（原生进度条·框架样式）

## 1. 用途

本文件含**两个独立 TargetType 的隐式默认样式**：

1. **原生 `ProgressBar`**：轨道 + 指示条（前景 `ProgressBoxFillBrush` 绿色渐变）+ `BorderElement.CornerRadius`=5 圆角；`IsIndeterminate` 状态经 VSM 驱动 2s 循环 **ScaleX 0.25 横移动画**；`Orientation=Vertical` 整体 `RotateTransform -90°` 旋转（垂直进度条）。
2. **`controls:ProgressBar`**（MaxwellControl.Controls 自定义控件）：**带标题/文本/结果图标的成品进度条**——`Title`（左侧标题，ShowTitle 控制）、`Text`（指示条内百分比文本，ShowText 控制）、`Result=True/False`（完成态 `SuccessGeometry`/失败态 `ErrorGeometry` 图标 + 画刷切换）、`IsComplete`（0.2s 图标淡入动画）。与 IOProgressBar 模板**逐行同构**（仅 TargetType 不同，见 TD-060）。

典型场景（推断，无 P2 实例）：批量任务进度（带结果反馈）、垂直/不确定进度指示。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<ProgressBar … />；<controls:ProgressBar … />，s = http://www.maxwell-gp.com/
```

两个样式均为**隐式默认样式（无 x:Key）**：原生 ProgressBar 样式（`ProgressBar.xaml:12`）、controls:ProgressBar 样式（`ProgressBar.xaml:79`）。无显式键式样式。

## 3. 关键属性表

**与 IOProgressBar 的差异面**：`controls:ProgressBar` 隐式样式与 `IOProgressBar` 隐式样式**逐行同构**——Setter 清单（Height 18/Width 280/BorderBrush/Background/BorderThickness 0）、模板（三列 Auto/*/23 + PART_Title/PART_TextBlock/PART_Path + StoryboardShow/Hidden）、全部触发器（Result/ShowText/ShowTitle/IsComplete/MultiTrigger）一致，仅 TargetType 不同（TD-060）。**原生版独有**：原生 `ProgressBar` 样式（IO 版无对应）、`PART_Path` 为 Popup 包裹的幽灵元素（Opacity 0，见待确认项）。

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Foreground | Brush | 指示条填充 `ProgressBoxFillBrush`（双定义：Brushes.xaml:257 与 Progress.xaml:7，TD-026） | 原生隐式样式 Setter（:13） | ✅ |
| Background | Brush | 轨道底 `BackgroundBrush`；控件版模板 TemplateRoot 同 | 原生 Setter（:14）+ 控件版模板（:83） | ✅ |
| BorderBrush / BorderThickness | Brush / Thickness | 原生版 Transparent/1（模板 BorderThickness 硬编码 0）；控件版 `BorderBrush`/0 | 两样式 Setter | ✅ |
| BorderElement.CornerRadius | CornerRadius | 原生版 =5，模板三处 Border 绑定（轨道/指示条/动画条） | 原生 Setter（:17）+ 模板（:41-45） | ✅ |
| IsIndeterminate | bool | True → `Indicator` Collapsed、`Animation` 2s 循环 ScaleX 0.25 + RenderTransformOrigin -0.5→1.5 横移 | VSM `VisualState x:Name="Indeterminate"`（:25-38）+ Trigger（:69-71） | ✅ |
| Orientation | Orientation | Vertical → TemplateRoot `RotateTransform -90°`（水平条旋转为垂直） | 模板 Trigger（:62-68） | ✅ |
| Title（控件版） | string | 左侧标题文本；ShowTitle=True 显示；FontSize 14、`PrimaryTextBrush` | `PART_Title` + `Trigger Property="ShowTitle"`（:102-104,132-134） | ✅ |
| Text（控件版） | string | 指示条内右对齐文本（百分比）；ShowText=True 显示；FontSize 10、白字 | `PART_TextBlock` + Trigger（:110-113,129-131） | ✅ |
| Result（控件版） | bool | True → `SuccessGeometry`+`NormalBrush` 图标、指示条保持 `ProgressBoxFillBrush`；False → `ErrorGeometry`+`WarningBrush` 图标、指示条 `WarningBrush` | 两个 `Trigger Property="Result"`（:120-128）+ MultiTrigger（:143-149） | ✅ |
| IsComplete（控件版） | bool | True → PART_Path Opacity 0→1（0.2s StoryboardShow）；False → 0（0s） | `Trigger Property="IsComplete"` EnterActions/ExitActions（:135-142） | ✅ |
| 尺寸 Token | — | 控件版 Height 18/Width 280 硬编码；模板内条高 16、指示条高 14 | 控件版 Setter（:80-81）+ 模板（:105-109） | ✅ |

## 4. 样式族表（SDC\Style\ProgressBar.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| （原生 ProgressBar 隐式样式） | 无 | 轨道+指示条+不确定动画（VSM ScaleX 横移）；BorderElement.CornerRadius=5；Vertical 旋转 | 未显式指定 Style 时 |
| （controls:ProgressBar 隐式样式） | 无 | 带标题/文本/结果图标成品进度条（18×280）；StoryboardShow/Hidden；Result 双态画刷 | 未显式指定 Style 时 |

原生版无显式键式样式与变体（控件版模板内 `ProgressBoxFillBrush` 等画刷见 Progress.xaml 家族——相关变体样式在 [progress](progress.md) 条目）。模板命名部件（P1 锚点）：`PART_Track`、`PART_Indicator`、`Indicator`、`Animation`、`PART_Path`（原生版为 **Popup** 类型、控件版为 Path）、`PART_Title`、`PART_TextBlock`、`TemplateRoot`。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<!-- 普通进度：Determinate 态直接用 -->
<ProgressBar Minimum="0" Maximum="100" Value="{Binding 进度值}" />

<!-- 不确定进度（等待中） -->
<ProgressBar IsIndeterminate="True" />

<!-- 带结果反馈的成品进度条 -->
<controls:ProgressBar Title="{DynamicResource …标题文本键}"
                      Text="{Binding 百分比文本}"
                      ShowTitle="True" ShowText="True"
                      Result="{Binding 完成结果}" IsComplete="{Binding 是否完成}" />
```

- 两个类型各有隐式默认样式，页面无需指定 Style；
- 控件版三个可显示部件（标题/文本/图标）默认均隐藏，需显式 `Show*` 打开。

## 6. 禁止写法对照

### ❌ 禁止：手写 Border 宽度动画拼等效进度条（常规 WPF 写法）

```xml
<Grid>
    <Border Height="16" CornerRadius="5" Background="#eceff3"/>
    <Border x:Name="fill" Height="14" CornerRadius="5" Background="#3d9e5f"
            HorizontalAlignment="Left" Width="{Binding 百分比换算宽度}"/>
    <TextBlock Text="50%" FontSize="10" HorizontalAlignment="Right" Margin="0,0,5,0"/>
    <!-- 宽度换算/刷新逻辑与"完成/失败"图标、淡入动画全部手写… -->
</Grid>
```

### ✅ 推荐：框架控件属性化

```xml
<ProgressBar Minimum="0" Maximum="100" Value="{Binding 进度值}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 `IsIndeterminate` 不确定态（VSM ScaleX 0.25 横移动画 + Indicator 折叠）与 `Result=True/False` 完成态图标（SuccessGeometry/ErrorGeometry + Normal/WarningBrush 双态）、`IsComplete` 淡入动画；
2. **③ 无法样式族切换**：圆角（BorderElement.CornerRadius=5 通道）、`ProgressBoxFillBrush` 填充、18×280 版式（控件版）等一处 Token 无法全局调整；`Orientation=Vertical` 旋转行为丢失；
3. **④ 绕过资源体系**：硬编码填充色绕过 `ProgressBoxFillBrush`（Progress.xaml/Brushes.xaml 键体系）、硬编码图标数据绕过 `SuccessGeometry`/`ErrorGeometry`（Geometries.xaml）；
4. **⑤ 脱离视觉规范**：指示条内 FontSize 10 百分比样式、标题 14px PrimaryTextBrush、轨道圆角 5 等视觉规范散写，页面无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/ProgressBar.xaml`（锚点 原生隐式 `Style TargetType="{x:Type ProgressBar}"`（:12）、`VisualState x:Name="Indeterminate"`、`Trigger Property="Orientation" Value="Vertical"`、`Popup x:Name="PART_Path"`（:55）、`Style TargetType="{x:Type controls:ProgressBar}"`（:79）、`Trigger Property="Result"`、`Trigger Property="IsComplete"`、`StoryboardShow`/`StoryboardHidden`）
- 画刷：`{source_root}/SDC/Brushes.xaml`（ProgressBoxFillBrush:257、NormalBrush、WarningBrush）；几何：`{source_root}/SDC/Geometries.xaml`（SuccessGeometry/ErrorGeometry）
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：IO 版 `{source_root}/SDC/Style/IOProgressBar.xaml` + [io-progress-bar](../io/io-progress-bar.md)；家族变体见 [progress](progress.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_ProgressBar.xaml.json`

## 8. 待确认项

- TD-060：`controls:ProgressBar` 与 IOProgressBar 隐式样式逐行同构（仅 TargetType 不同）——两控件类型真实差异（.cs 行为面）待确认；Progress 家族整体（含 Style2 的 Template Setter 非常规写法）一并核实。
- TD-026 关联：`ProgressBoxFillBrush` 双定义（Brushes.xaml:257 vs Progress.xaml:7）——本样式消费哪一份取决于 MergedDictionaries 顺序。
- [待确认 TD-xxx]：原生 ProgressBar 模板内 `Popup x:Name="PART_Path"`（Opacity 0、Grid.Column="2" 但无三列 Grid）——幽灵元素，疑似残留/未来扩展挂点（IO 版对应的 PART_Path 为 Path 正常图标位）。
