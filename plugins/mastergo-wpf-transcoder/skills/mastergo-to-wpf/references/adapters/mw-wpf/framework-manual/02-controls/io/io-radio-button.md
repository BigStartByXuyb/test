<!-- evidence=已确认(属性/触发器/缩放动画均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-001, 待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IORadioButton.xaml, {source_root}/ManualView.xaml] -->

# IORadioButton（IO 单选按钮）

## 1. 用途

设备条件绑定单选按钮：13×13 圆环 + 7×7 圆点，选中圆点以 **0.1s ScaleTransform 缩放动画**（0→1）弹出；自带虚线焦点框（FocusVisualStyle）。典型场景（推断，无 P2 实例）：设备互斥条件选择组（如模式单选）——按 IO 系列定位（见 [device-condition-protocol](../../03-protocols/device-condition-protocol.md)），应挂 IOEnable 设备联锁通道，但本模板无 IOEnable 引用证据（见区块 3/8）。

## 2. 声明

```xml
<s:IORadioButton … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IORadioButton`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件含 `IORadioButtonBaseStyle` + 隐式默认样式；模板与原生 `RadioButtonBaseStyle`（RadioButtonBaseStyle.xaml）同构（同 Storyboard 结构），「IO」差异体现在控件类型本身（属性面 .cs 不可见）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| BorderBrush | Brush | 未选默认 CheckBox 系同色 PrimaryControlToolColor（#bbc2cc）；悬停/按下/选中/选中按下各态切换（RadioButton_UnSelectHoverBorderBrush 等） | `x:Key="IORadioButtonBaseStyle"` Setter + `MultiTrigger`（`Condition Property="IsChecked"` + `IsMouseOver`/`IsPressed`） | ✅ |
| Background | Brush | 默认 Transparent（圆环空心）；未选中态与画刷无关 | IORadioButtonBaseStyle Setter | ✅ |
| BorderThickness | Thickness | 默认 2 | IORadioButtonBaseStyle Setter | ✅ |
| Foreground | Brush | 默认 PrimaryTextBrush | IORadioButtonBaseStyle Setter | ✅ |
| FontSize | double | 默认 14 | IORadioButtonBaseStyle Setter | ✅ |
| IsChecked | bool? | true：圆点动画弹出（0.1s scale 0→1）+ 圆点可见 + 选中画刷；false：圆点缩回 | `Trigger Property="IsChecked" Value="true"`（两组）+ `Trigger.EnterActions`/`ExitActions`（StoryboardCheckedTrue/False） | ✅ |
| Content | object | 右侧文字/内容；HasContent=true 时显示 | ContentPresenter `Trigger Property="HasContent"` | ✅ |
| FocusVisualStyle | Style | 虚线圆角矩形焦点框（PrimaryLightBrush、StrokeDashArray 1 1） | IORadioButtonBaseStyle Setter | ✅ |
| HorizontalContentAlignment / VerticalContentAlignment / SnapsToDevicePixels | — | 透传至圆环 Border 与 ContentPresenter | 模板 `TemplateBinding` | ✅ |
| Padding | Thickness | 默认 5,0,0,0（文字与圆环间距） | IORadioButtonBaseStyle Setter | ✅ |
| IOEnable | string/bool | 设备条件表达式或 `true`；**本模板无任何引用**，IO 系列走 IOEnable 通道为协议文档声明（SDC 全库 XAML 无 IOEnable 字样） | 无锚点 + [device-condition-protocol](../../03-protocols/device-condition-protocol.md) | 🟡 [待确认 TD-001] |

结构尺寸：圆环 13×13、`CornerRadius="100"`、圆点 7×7——**硬编码，无 Token**（对比 IOCheckBox 的 18×18 Token，见区块 8）。圆点 Fill 绑定 `BorderBrush`（TemplateBinding），即选中画刷同时驱动圆环与圆点颜色。

## 4. 样式族表（SDC\Style\IORadioButton.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IORadioButtonBaseStyle | BaseStyle | 13×13 圆环 + 0.1s 圆点缩放动画（StoryboardCheckedTrue/False）+ 6 个状态 Trigger/MultiTrigger（RadioButton_*BorderBrush 画刷组）+ 虚线焦点框 | 基样式，不直接用 |
| （隐式默认样式） | IORadioButtonBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |

模板内无 PART_ 命名部件（x:Name 内部名：`radioButtonBorder`/`optionMark`/`contentPresenter`）。配套画刷 6 键在 `{source_root}/SDC/Brushes/RadioButtonBrushes.xaml`（`RadioButton_UnSelectDefaultBrush`/`UnSelectHoverBorderBrush`/`UnSelectPressedBorderBrush`/`SelectDefaultBorderBrush`/`SelectPressedBorderBrush`/`UnSelectDisabledBrush`）；同文件 `MainMenuRadioButton_*` 渐变画刷组为**主菜单栏专用**（MainMenuRadioButtonStyle，非本控件）。注意 `RadioButton_UnSelectDisabledBrush` 定义但全库未引用（见区块 8）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 项目均未出现 `s:IORadioButton`。

```xml
<s:IORadioButton Content="{DynamicResource …单选文本键}" IsChecked="True" />
```

- Content 走 DynamicResource 文本键（本地化，见 [localization-text](../../03-protocols/localization-text.md)）；
- 互斥行为由原生 RadioButton 分组机制提供（同容器内互斥），页面无需自写；
- IOEnable 是否挂载待确认（见区块 8），确认前页面侧不自行设置。

## 6. 禁止写法对照

### ❌ 禁止：原生 RadioButton + 手写圆点缩放动画与状态触发器拼装等效视觉（常规 WPF 写法）

```xml
<RadioButton>
    <RadioButton.Resources>
        <Storyboard x:Key="On">
            <DoubleAnimationUsingKeyFrames Storyboard.TargetProperty="(UIElement.RenderTransform).(TransformGroup.Children)[0].(ScaleTransform.ScaleX)" Storyboard.TargetName="dot">
                <EasingDoubleKeyFrame KeyTime="0:0:0.1" Value="1"/>
            </DoubleAnimationUsingKeyFrames>
            <!-- ScaleY 同… -->
        </Storyboard>
    </RadioButton.Resources>
    <Grid>
        <Border Width="13" Height="13" CornerRadius="100" BorderThickness="2" BorderBrush="#bbc2cc">
            <Ellipse x:Name="dot" Width="7" Height="7" Fill="#bbc2cc">
                <Ellipse.RenderTransform>
                    <TransformGroup><ScaleTransform ScaleX="0" ScaleY="0"/></TransformGroup>
                </Ellipse.RenderTransform>
            </Ellipse>
        </Border>
        <TextBlock Text="…"/>
    </Grid>
    <!-- 手写 IsChecked/悬停/按下/禁用 6 组触发器与画刷… -->
</RadioButton>
```

### ✅ 推荐：IORadioButton 一行属性化（模板证据构造）

```xml
<s:IORadioButton Content="{DynamicResource …文本键}" IsChecked="True" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有模板的 6 组 Trigger/MultiTrigger（未选/悬停/按下/选中/选中按下/禁用 Opacity 0.5）与 0.1s 圆点缩放动画、虚线焦点框（PrimaryLightBrush）——选中反馈与焦点可见性无从统一；
2. **② 丢失协议挂点**：IO 系列控件走 IOEnable 设备联锁通道（协议文档声明，见 [device-condition-protocol](../../03-protocols/device-condition-protocol.md)），手写 RadioButton + Binding 联锁是等价机制的重复发明；
3. **③ 无法样式族切换**：圆环 13×13、圆点 7×7、2px 边框、RadioButton_*BorderBrush 画刷全部散写，不能由 IORadioButtonBaseStyle 一处调整；
4. **④ 绕过资源体系**：硬编码圆点/圆环尺寸与画刷颜色，绕过 RadioButtonBrushes.xaml 键体系；
5. **⑤ 脱离视觉规范**：字号（FontSize 14）、文本色（PrimaryTextBrush）、对齐策略（Center/Center）脱离框架控制，且手工 TextBlock 绕过 ContentPresenter 的 HasContent 机制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IORadioButton.xaml`（锚点 `x:Key="IORadioButtonBaseStyle"`、`x:Key="StoryboardCheckedTrue"`、`x:Key="StoryboardCheckedFalse"`、`Trigger Property="IsChecked"`、`TargetName="optionMark"`、`CornerRadius="100"`）
- 同构对照：`{source_root}/SDC/Style/RadioButtonBaseStyle.xaml`（`x:Key="RadioButtonBaseStyle"`）
- 配套资源：`{source_root}/SDC/Brushes/RadioButtonBrushes.xaml`（6 键）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IORadioButton.xaml.json`

## 8. 待确认项

- TD-001：IOEnable 表达式语义（[device-condition-protocol](../../03-protocols/device-condition-protocol.md)）——IO 系列是否实际挂载 IOEnable 及条件失败行为，模板无证据。
- [待确认 TD-xxx]：圆环 13×13/圆点 7×7 硬编码无尺寸 Token（对比 IOCheckBox 18×18 Token 化）；`RadioButton_UnSelectDisabledBrush` 定义后全库无引用（RadioButtonBrushes.xaml）——疑似遗留（已建议编号，见 [pending-confirmations](../../05-best-practices/pending-confirmations.md)）。
- [待确认 TD-xxx]：IORadioButton 与原生 RadioButtonBaseStyle 模板同构（同 Storyboard 结构）——「IO」控件与原生控件的实际差异面（除 .cs 属性外）待确认。
