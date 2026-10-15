<!-- evidence=已确认(属性/模板/触发器均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/Slider.xaml, {source_root}/ManualView.xaml] -->

# Slider（滑块·框架样式，RangeSlider 家族）

## 1. 用途

本文件同时覆盖**原生 `Slider` 与 `controls:RangeSlider`（双滑块区间滑块，自定义控件）**两族的框架样式：

- **Slider 族**：`SliderBaseStyle`（+隐式默认）+ `TextBoxSlider`（**滑块右侧内嵌 `controls:NumberBox` 数值框**，`PART_TextBox`，Value 双向直绑 + N2 格式）。横向模板固定宽 120，轨高 10 圆角 3，滑块 15×22 圆点形（椭圆几何），选中区间（`PART_SelectionRange`）随 `IsSelectionRangeEnabled` 显示。
- **RangeSlider 族**：`RangeSliderBaseStyle`（+隐式默认，双滑块 `RangeThumb`，区间中段 `CenterLarge` 命令拖动）+ `TextBlockRangeSlider`（右侧文本框 `MultiBinding "{}{0:N2}-{1:N2}"` 显示 ValueStart-ValueEnd）。

两族共用：滑块圆点几何、RepeatButton 样式、`BorderElement.CornerRadius` 圆角通道、刻度条（`controls:HorizontalTickBar`/`VerticalTickBar` 自定义控件，TickPlacement 三向触发器）、`Orientation` 横竖切换（垂直时整模板换 `SliderVertical`）、`IsEnabled=False → Opacity .4`。

典型场景（推断，无 P2 实例）：数值调节（TextBoxSlider）、区间取值（RangeSlider 族）。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<Slider … />；<controls:RangeSlider … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `Slider` + `controls:RangeSlider`（MaxwellControl.Controls，依赖 `controls:RangeTrack`/`RangeThumb`/`HorizontalTickBar`/`VerticalTickBar` 部件控件）。本文件含 4 个 RepeatButton/Thumb 样式键、6 个 ControlTemplate 键、6 个样式键（4 键式 + 2 隐式默认）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Value | double | 当前值；TextBoxSlider 经 NumberBox 编辑（N2 格式） | `x:Key="TextBoxSliderHorizontal"` PART_TextBox（:305） | ✅ |
| ValueStart / ValueEnd | double | RangeSlider 双值；RangeThumb `Content` 直绑（滑块上可显示值）；文本版 MultiBinding N2-N2 | `x:Key="RangeSliderHorizontal"` ThumbStart/ThumbEnd（:215/:218）+ `x:Key="TextBlockRangeSliderHorizontal"` Text（:344-351） | ✅ |
| Minimum / Maximum | double | 轨道区间；模板多处直绑（Track、刻度条、SelectionRange） | 各模板 Track/TickBar | ✅ |
| Orientation | Orientation | Vertical → 整模板切 `SliderVertical`/`RangeSliderVertical`（横竖两套独立模板）；RangeSlider 另经 RangeTrack Orientation 直绑 | `x:Key="SliderBaseStyle"` Style.Triggers（:160-163）+ 各模板 | ✅ |
| IsSelectionRangeEnabled | bool | True → `PART_SelectionRange`（`SliderSelectionBackgroundBrush`）显示 | SliderBaseStyle Setter（:154）+ 模板 Trigger（:101-103） | ✅ |
| TickPlacement | TickPlacement | TopLeft/BottomRight/Both → TopTick（`TextBrush`）与 BottomTick（`Foreground`）显隐（TopTick 原生 TickBar、BottomTick 为 controls:Horizontal/VerticalTickBar） | 各模板 Trigger（TickPlacement 三组） | ✅ |
| Ticks / TickFrequency | — | 刻度参数，RangeSlider 模板直绑（原生 Slider 仅 TickFrequency 直绑） | 模板 TickBar 绑定 | ✅ |
| IsDirectionReversed | bool | 区间反向，RangeSlider 模板直绑（TopTick/BottomTick/RangeTrack） | RangeSliderHorizontal 模板（:201-204） | ✅ |
| MinHeight / MinWidth | double | 基样式 22；垂直时 MinWidth 22 | SliderBaseStyle/RangeSliderBaseStyle Setter | ✅ |
| IsEnabled | bool | False → Opacity .4（两族四样式统一） | 各样式 Style.Triggers | ✅ |
| BorderBrush（Slider） | Brush | 滑块描边 `PrimaryBorderBrush`；Thumb 圆点画笔 `SliderThumbBackgroundBrush`/`SliderThumbPathBrush`（垂直 `SliderThumbVertical*`） | SliderBaseStyle Setter（:157）+ 模板 Thumb（:42-47） | ✅ |
| 轨道画刷 | Brush | 轨底 `SliderIncreaseBackgroundBrush`/`SliderIncreaseVerticalBrush`；已滑区 `ButtonPressGradientBrushRevert`/`ButtonPressVerticalBrush`（DecreaseRepeatButton 背景） | 模板 TrackBackground/RepeatButton（:71-78） | ✅ |

## 4. 样式族表（SDC\Style\Slider.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| SliderRepeatButtonHorizontalStyle / VerticalStyle | 无（独立） | 透明 RepeatButton（CornerRadius 经 BorderElement 直绑），供 Track 增/减大步长用 | Slider 族部件 |
| SliderHorizontalThumb / SliderVerticalThumb | （ControlTemplate 键） | 15×22（横）/22×15（纵）圆点滑块：Border 描边 + 椭圆几何 Path | Slider 族滑块 |
| SliderHorizontal / SliderVertical | （ControlTemplate 键） | 横模板固定 **Width=120**、轨高 10 圆角 3、PART_SelectionRange 选中区间、刻度三向显隐 | Slider 族模板 |
| SliderBaseStyle | BaseStyle | IsSelectionRangeEnabled=True、MinHeight 22、Vertical 切模板、IsEnabled .4 | 基样式，不直接用 |
| （Slider 隐式默认） | SliderBaseStyle | TargetType 默认样式（:170） | 未显式指定 Style 时 |
| TextBoxSlider | BaseStyle | 模板 `TextBoxSliderHorizontal`：右侧 Border+**controls:NumberBox（PART_TextBox，Width 50、Value N2 直绑、ShowUpDownButton=False）**；无 Vertical 变体 | 数值输入型滑块 |
| RangeSliderHorizontalThumb / VerticalThumb | （ControlTemplate 键） | TargetType=`controls:RangeThumb`；圆点几何同 Slider 族 | RangeSlider 族滑块 |
| RangeSliderHorizontal / RangeSliderVertical | （ControlTemplate 键） | `controls:RangeTrack`（PART_Track，**三按键：Decrease/Center/Increase + RangeSlider.DecreaseLarge/CenterLarge/IncreaseLarge 命令**）；ThumbStart/ThumbEnd Content 直绑 ValueStart/ValueEnd、Margin ±7.5 外扩 | RangeSlider 族模板 |
| RangeSliderBaseStyle | BaseStyle | MinHeight 22、Vertical 切模板、IsEnabled .4 | 基样式，不直接用 |
| （RangeSlider 隐式默认） | RangeSliderBaseStyle | TargetType 默认样式（:295） | 未显式指定 Style 时 |
| TextBlockRangeSlider | BaseStyle | 模板 `TextBlockRangeSliderHorizontal`：右侧文本框 `MultiBinding "{}{0:N2}-{1:N2}"`（ValueStart-ValueEnd，AncestorType=controls:RangeSlider）；无 Vertical 变体 | 区间值文本显示型 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<!-- 普通滑块 -->
<Slider Minimum="0" Maximum="100" Value="{Binding 数值}" />

<!-- 带数字输入框的滑块（N2 两位小数） -->
<Slider Style="{StaticResource TextBoxSlider}" Minimum="0" Maximum="100" Value="{Binding 数值}" />

<!-- 区间滑块（双滑块） -->
<controls:RangeSlider Minimum="0" Maximum="100" ValueStart="{Binding 起始值}" ValueEnd="{Binding 结束值}" />

<!-- 区间滑块 + 区间文本显示 -->
<controls:RangeSlider Style="{StaticResource TextBlockRangeSlider}"
                      Minimum="0" Maximum="100"
                      ValueStart="{Binding 起始值}" ValueEnd="{Binding 结束值}" />
```

- 默认（不写 Style）即基样式；TextBoxSlider/TextBlockRangeSlider 需显式引用；
- 原生 Slider 默认横置固定宽 120，垂直需 `Orientation="Vertical"`（模板自动切换）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Grid + Thumb 拖动逻辑拼等效滑块（常规 WPF 写法）

```xml
<Grid Width="120">
    <Border Height="10" CornerRadius="3" Background="#d9e0e8"/>
    <Thumb x:Name="thumb" Width="15" Height="22" HorizontalAlignment="Left"
           DragDelta="手写偏移换算"/>
    <!-- 手写：拖动↔数值换算、区间高亮、刻度、禁用态、数字输入框同步… -->
</Grid>
```

### ✅ 推荐：框架控件属性化

```xml
<Slider Minimum="0" Maximum="100" Value="{Binding 数值}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 IsEnabled→Opacity .4、Track 大步长命令（DecreaseLarge/IncreaseLarge）、刻度（TickPlacement 三向显隐）、选中区间（PART_SelectionRange）与**区间拖动（RangeTrack CenterLarge）**——区间中段整体拖动必须手工实现；
2. **② 丢失协议挂点**：绕过 `PART_Track`/`PART_SelectionRange`/`PART_TextBox` 部件协议与 Value/ValueStart/ValueEnd→滑块几何换算（RangeTrack 内部布局）——数据绑定驱动几何位移的逻辑需自行重造；
3. **③ 无法样式族切换**：普通/TextBoxSlider（NumberBox 编辑）/RangeSlider/TextBlockRangeSlider 四形态无法一键切换；垂直模板（SliderVertical）行为丢失；
4. **④ 绕过资源体系**：硬编码轨道/滑块颜色绕过 SliderIncreaseBackgroundBrush/SliderThumbBackgroundBrush/ButtonPressGradientBrushRevert 键体系；
5. **⑤ 脱离视觉规范**：15×22 圆点滑块、轨高 10 圆角 3、N2 数字格式、固定宽 120 等规范散写，页面无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Slider.xaml`（锚点 `x:Key="SliderBaseStyle"`（:153）、隐式默认（:170）、`x:Key="SliderHorizontal"`（:61，Width=120）/`SliderVertical"`、`x:Key="SliderHorizontalThumb"`/`SliderVerticalThumb"`（:41/:51）、`x:Key="TextBoxSlider"`（:324，PART_TextBox N2 直绑）、`x:Key="RangeSliderBaseStyle"`（:280）、隐式默认（:295）、`x:Key="RangeSliderHorizontal"`（:194，CenterLarge 命令）/`RangeSliderVertical"`、`x:Key="RangeThumb` 模板（Content 直绑 ValueStart/ValueEnd）、`x:Key="TextBlockRangeSlider"`（:377，`{}{0:N2}-{1:N2}` MultiBinding））
- 画刷：`{source_root}/SDC/Brushes.xaml`（SliderThumbBackgroundBrush:211、SliderThumbPathBrush:216、SliderThumbVerticalBackgroundBrush:221、SliderThumbVerticalPathBrush:225、SliderIncreaseBackgroundBrush:230、SliderSelectionBackgroundBrush:235、SliderIncreaseVerticalBrush:242、ButtonPressGradientBrushRevert:172、ButtonPressVerticalBrush:252）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Slider.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：`TextBoxSlider` 与 `TextBlockRangeSlider` 无 Vertical 变体（Orientation=Vertical 时仍用横向模板）——是设计取舍还是遗漏待确认。
- [待确认 TD-xxx]：`PART_TextBox`（controls:NumberBox）的 Value 绑定未显式 Mode——依赖 NumberBox.Value 依赖属性默认绑定模式，双向性待确认（.cs 不可见）。
- [待确认 TD-xxx]：SliderHorizontal 模板固定 `Width=120`（RangeSlider 模板无此限制）——固定宽度是否业务遗留待确认。
