<!-- evidence=已确认(属性/触发器/勾画动画均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-001, 待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOCheckBox.xaml, {source_root}/ManualView.xaml] -->

# IOCheckBox（IO 复选按钮）

## 1. 用途

设备条件绑定复选框：18×18 方形勾选框，勾选动画为**笔画绘制式**（`StrokeDashArray 8,8` + `StrokeDashOffset 8→0`，0.2s），支持三态（选中/未选/不确定）与全套状态画刷切换。典型场景（推断，无 P2 实例）：设备状态条件开关类勾选项——按 IO 系列定位（见 [device-condition-protocol](../../03-protocols/device-condition-protocol.md)），应挂 IOEnable 设备联锁通道，但本模板无 IOEnable 引用证据（见区块 3/8）。

## 2. 声明

```xml
<s:IOCheckBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOCheckBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件含 `IOCheckBoxBaseStyle` + 隐式默认样式；模板与原生 `CheckBoxBaseStyle`（CheckBox.xaml）**逐行同构，仅 TargetType 不同**——「IO」差异体现在控件类型本身（属性面 .cs 不可见）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 默认 PrimaryDefaultBrush（白）；选中 → CheckBox_SelectDefaultBrush、不确定 → CheckBox_UnCertainDefaultBrush | `x:Key="IOCheckBoxBaseStyle"` Setter + `Trigger Property="IsChecked" Value="true"` / `Value="{x:Null}"` Setter | ✅ |
| BorderBrush | Brush | 未选/悬停/按下/选中/不确定各态切换（CheckBox_UnSelectHoverBrush 等） | Setter + `MultiTrigger`（`Condition Property="IsChecked"` + `IsMouseOver`/`IsPressed`） | ✅ |
| BorderThickness | Thickness | 默认 2 | IOCheckBoxBaseStyle Setter | ✅ |
| IsChecked | bool? | 三态：true 勾画动画 + 选中画刷；false 勾 Stroke 置 UnSelectDisabledBrush；Null 不确定画刷 | `Trigger Property="IsChecked"`（true/false/{x:Null} 三组）+ `Trigger.EnterActions`/`ExitActions`（StoryboardCheckedTrue/False） | ✅ |
| Content | object | 右侧文字/内容；HasContent=true 时显示；字号 SubHeaderFontSize（14）、前景 PrimaryTextBrush | ContentPresenter `Trigger Property="HasContent"` + `TextElement.FontSize="{DynamicResource SubHeaderFontSize}"` | ✅ |
| HorizontalContentAlignment / SnapsToDevicePixels | — | 透传至 ContentPresenter | ContentPresenter `TemplateBinding` | ✅ |
| Padding | Thickness | 默认 5,0,0,0（文字与勾选框间距） | IOCheckBoxBaseStyle Setter | ✅ |
| IOEnable | string/bool | 设备条件表达式或 `true`；**本模板无任何引用**，IO 系列走 IOEnable 通道为协议文档声明（SDC 全库 XAML 无 IOEnable 字样） | 无锚点 + [device-condition-protocol](../../03-protocols/device-condition-protocol.md) | 🟡 [待确认 TD-001] |

尺寸 Token：勾选框 18×18（`CheckBoxWidth`/`CheckBoxHeight`，Sizes.xaml），勾形 11×11、StrokeThickness 2，勾形几何取 `CheckedGeometry`（SDC\Geometries.xaml，笔画路径 `M2.749,4.350 L5.035,6.750 L10.749,0.750`）。

## 4. 样式族表（SDC\Style\IOCheckBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IOCheckBoxBaseStyle | BaseStyle | 18×18 勾选框 + 0.2s 笔画动画（StoryboardCheckedTrue/False）+ 8 个状态 Trigger/MultiTrigger（CheckBox_* 画刷组）+ 三态支持；FocusVisualStyle=Null（BaseStyle 继承） | 基样式，不直接用 |
| （隐式默认样式） | IOCheckBoxBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |

模板内无 PART_ 命名部件（全部 x:Name 内部名，触发器直接 Setter TargetName）。配套画刷 8 键在 `{source_root}/SDC/Brushes/CheckBoxBrushes.xaml`（`CheckBox_UnSelectDefaultBrush` 等，全部系 Primary* 色系 SolidColorBrush）。注意 `CheckBox_UnSelectDisabledBrush` 在未选态充当勾形 Stroke（命名语义疑点，见区块 8）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 项目均未出现 `s:IOCheckBox`。

```xml
<s:IOCheckBox Content="{DynamicResource …复选文本键}" IsChecked="True" />
```

- Content 走 DynamicResource 文本键（本地化，见 [localization-text](../../03-protocols/localization-text.md)）；
- IOEnable 是否挂载待确认（见区块 8），确认前页面侧不自行设置；
- 三态（`IsChecked="{x:Null}"`）为框架内建状态，页面可直接使用。

## 6. 禁止写法对照

### ❌ 禁止：原生 CheckBox + 手写勾画动画与状态触发器拼装等效视觉（常规 WPF 写法）

```xml
<CheckBox IsChecked="{Binding …}">
    <CheckBox.Resources>
        <Storyboard x:Key="On">
            <DoubleAnimationUsingKeyFrames Storyboard.TargetProperty="(Shape.StrokeDashOffset)" Storyboard.TargetName="path">
                <EasingDoubleKeyFrame KeyTime="0:0:0.2" Value="0"/>
            </DoubleAnimationUsingKeyFrames>
        </Storyboard>
    </CheckBox.Resources>
    <Grid>
        <Border Width="18" Height="18" x:Name="box" BorderThickness="2" BorderBrush="#bbc2cc"/>
        <Path x:Name="path" Width="11" Height="11" Stretch="Uniform"
              Data="M2.749,4.350 L5.035,6.750 L10.749,0.750"
              StrokeDashArray="8,8" StrokeDashOffset="8" Stroke="#ffffff"/>
    </Grid>
    <!-- 手写 IsChecked/悬停/按下/不确定/禁用 8 组触发器与画刷… -->
</CheckBox>
```

### ✅ 推荐：IOCheckBox 一行属性化（模板证据构造）

```xml
<s:IOCheckBox Content="{DynamicResource …文本键}" IsChecked="True" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有模板的 8 组 Trigger/MultiTrigger（未选/悬停/按下/选中/选中按下/不确定/不确定悬停/禁用 + Opacity 0.5）与 0.2s 笔画绘制动画——三态（`{x:Null}`）与禁用视觉均无从谈起；
2. **② 丢失协议挂点**：IO 系列控件走 IOEnable 设备联锁通道（协议文档声明，见 [device-condition-protocol](../../03-protocols/device-condition-protocol.md)），手写 CheckBox 手工 `IsChecked="{Binding …}"` 是等价机制的重复发明；
3. **③ 无法样式族切换**：18×18 Token、11×11 勾形、2px 边框、CheckBox_* 状态画刷全部散写，不能由 IOCheckBoxBaseStyle 一处调整；
4. **④ 绕过资源体系**：硬编码勾形 Data 与画刷颜色，绕过 `CheckedGeometry`（Geometries.xaml）与 CheckBoxBrushes.xaml 键体系；
5. **⑤ 脱离视觉规范**：勾选字号（SubHeaderFontSize 14）、文本色（PrimaryTextBrush）、对齐/间距（Padding 5,0,0,0）脱离框架控制，页面视觉无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOCheckBox.xaml`（锚点 `x:Key="IOCheckBoxBaseStyle"`、`x:Key="StoryboardCheckedTrue"`、`x:Key="StoryboardCheckedFalse"`、`Trigger Property="IsChecked"`、`TargetName="path"`）
- 同构对照：`{source_root}/SDC/Style/CheckBox.xaml`（`x:Key="CheckBoxBaseStyle"`）
- 配套资源：`{source_root}/SDC/Brushes/CheckBoxBrushes.xaml`（8 键）、`{source_root}/SDC/Sizes.xaml`（`CheckBoxWidth`/`CheckBoxHeight`）、`{source_root}/SDC/Geometries.xaml`（`CheckedGeometry`）、`{source_root}/SDC/Fonts.xaml`（`SubHeaderFontSize`）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOCheckBox.xaml.json`

## 8. 待确认项

- TD-001：IOEnable 表达式语义（[device-condition-protocol](../../03-protocols/device-condition-protocol.md)）——IO 系列是否实际挂载 IOEnable 及条件失败行为，模板无证据。
- [待确认 TD-xxx]：IOCheckBox 与原生 CheckBox 模板逐行同构（仅 TargetType 不同）——「IO」控件与原生控件的实际差异面（除 .cs 属性外）待确认（已建议编号，见 [pending-confirmations](../../05-best-practices/pending-confirmations.md)）。
- [待确认 TD-xxx]：`CheckBox_UnSelectDisabledBrush` 在 IsChecked=false 时充当勾形 Stroke——「未选态用 Disabled 画刷」命名语义疑点（与原生 CheckBox.xaml 同模式，意图待确认）。
