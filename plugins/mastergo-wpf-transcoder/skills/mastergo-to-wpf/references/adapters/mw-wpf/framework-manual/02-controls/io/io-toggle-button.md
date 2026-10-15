<!-- evidence=已确认(属性/触发器/滑块动画均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-001, 待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOToggleButton.xaml, {source_root}/ManualView.xaml] -->

# IOToggleButton（IO 切换开关）

## 1. 用途

设备条件绑定滑动开关：55×25 轨道 + 25×25 方形滑块（内嵌 15×15 圆点），选中滑块以 **0.2s PowerEase(EaseOut) 平移动画**（TranslateTransform.X −1→30）右滑，轨道左侧填充以 ScaleX/Y 0→1 展开。典型场景（推断，无 P2 实例）：设备开关量使能（如某模组上电/启动开关）——按 IO 系列定位（见 [device-condition-protocol](../../03-protocols/device-condition-protocol.md)），应挂 IOEnable 设备联锁通道，但本模板无 IOEnable 引用证据（见区块 3/8）。

## 2. 声明

```xml
<s:IOToggleButton … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOToggleButton`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件含 `IOToggleButtonBaeControlTemplate`（模板资源键，原文件拼写即 "Bae"）+ 隐式默认样式（无命名基样式）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background / BorderBrush | Brush | 默认 ToggleButton_DefaultBackBrush / ToggleButton_DefaultBorderBrush（渐变） | 隐式默认样式 Setter | ✅ |
| BorderThickness | Thickness | 默认 1 | 隐式默认样式 Setter | ✅ |
| Width / Height | double | 默认 55×25（`ToggleButtonWidth`/`ToggleButtonHeight`，Sizes.xaml） | 隐式默认样式 Setter + 模板 `Width="{DynamicResource ToggleButtonWidth}"` | ✅ |
| IsChecked | bool | true：滑块 0.2s 右滑（X→30）+ 轨道填充展开 + 滑块/圆点切 Select 画刷；false：滑块回到 X=−1、填充收起 | `Trigger Property="IsChecked" Value="true"`（两组：EnterActions/ExitActions 的 StoryboardChecked/UnChecked；Setter TargetName="thumb"/"Circle"） | ✅ |
| Content | object | 右侧文字/内容；HasContent=true 时显示 | ContentPresenter `Trigger Property="HasContent"` | ✅ |
| Padding | Thickness | 默认 6,0,0,0 | 隐式默认样式 Setter | ✅ |
| VerticalContentAlignment | — | 默认 Center | 隐式默认样式 Setter | ✅ |
| IOEnable | string/bool | 设备条件表达式或 `true`；**本模板无任何引用**，IO 系列走 IOEnable 通道为协议文档声明（SDC 全库 XAML 无 IOEnable 字样） | 无锚点 + [device-condition-protocol](../../03-protocols/device-condition-protocol.md) | 🟡 [待确认 TD-001] |

结构尺寸 Token（Sizes.xaml）：轨道 55×25（`ToggleButtonWidth/Height`）、滑块 25×25（`ToggleButtonSquareWidth/Height`）、圆点 15×15（`ToggleButtonCircularWidth/Height`）；Sizes.xaml 中旧值（80×35 / 35×35 / 25×25 / `ToggleButtonAnimationOffset` 44）已注释（见区块 8）。模板整体包在 `Viewbox` 内（可整体缩放）。Disabled 态 Opacity **0.4**（区别于 IOCheckBox/IORadioButton 的 0.5）。

## 4. 样式族表（SDC\Style\IOToggleButton.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IOToggleButtonBaeControlTemplate | 无（ControlTemplate 资源键） | 滑动开关模板：backBorder（轨道底）+ innerBorder（选中填充，ScaleX/Y 0→1，RenderTransformOrigin .8,0.5）+ lightBorder（描边）+ thumb（25×25 方滑块内嵌 15×15 Circle）+ ContentPresenter；StoryboardChecked/UnChecked（0.2s PowerEase EaseOut） | 模板资源，被隐式默认样式引用 |
| （隐式默认样式） | BaseStyle | 55×25、Template 取 `{DynamicResource IOToggleButtonBaeControlTemplate}` | 未显式指定 Style 时 |

模板内无 PART_ 命名部件（x:Name 内部名：`backBorder`/`innerBorder`/`lightBorder`/`thumb`/`Circle`/`contentPresenter`）。配套画刷 8 键在 `{source_root}/SDC/Brushes/ButtonBrushes.xaml`（`ToggleButton_DefaultBackBrush`/`DefaultBorderBrush`/`DefaultSquareBrush`/`DefaultSquareBorderBrush`/`DefaultCircleBrush`/`SelectBackBrush`/`SelectBorderBrush`/`SelectSquareBrush`/`SelectSquareBorderBrush`/`SelectCircleBrush`，渐变系）。

**与同族切换类控件区分**（SDC\Style\ToggleButton.xaml）：
- 原生 `ToggleButton`：`BaseToggleBtnStyle`（x:Key）引用 `ToggleButtonBaeControlTemplate`——与 IOToggleButton 模板同构（同为 X −1→30 平移动画），区别仅在 TargetType 与基于的样式；
- `controls:LazyToggleButton`（隐式默认样式）：同款滑动开关 + **加载态**——`IsChecked={x:Null}` 时滑块收起、显示旋转加载 Path（1s 360° 无限旋转动画）；
- `controls:ToggleIconButton`（`ToggleIconButtonBaseStyle`）：图标式切换按钮，独立模板。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 项目均未出现 `s:IOToggleButton`。

```xml
<s:IOToggleButton IsChecked="True" />
```

- 纯开关通常无文字；如需文字走 Content + DynamicResource 文本键（本地化，见 [localization-text](../../03-protocols/localization-text.md)）；
- IOEnable 是否挂载待确认（见区块 8），确认前页面侧不自行设置；
- 与原生 ToggleButton 的视觉差异在控件类型层（.cs），模板层与 LazyToggleButton 同源，**页面选择依据是协议面而非视觉面**。

## 6. 禁止写法对照

### ❌ 禁止：原生 ToggleButton + 手写滑块平移动画与状态触发器拼装等效视觉（常规 WPF 写法）

```xml
<ToggleButton>
    <ToggleButton.Resources>
        <Storyboard x:Key="On">
            <DoubleAnimationUsingKeyFrames Storyboard.TargetProperty="(UIElement.RenderTransform).(TransformGroup.Children)[0].(TranslateTransform.X)" Storyboard.TargetName="thumb">
                <EasingDoubleKeyFrame KeyTime="0:0:0.2" Value="30">
                    <EasingDoubleKeyFrame.EasingFunction><PowerEase EasingMode="EaseOut"/></EasingDoubleKeyFrame.EasingFunction>
                </EasingDoubleKeyFrame>
            </DoubleAnimationUsingKeyFrames>
            <!-- innerBorder ScaleX/Y 0→1 同… -->
        </Storyboard>
    </ToggleButton.Resources>
    <Grid>
        <Border x:Name="track" Width="55" Height="25" CornerRadius="3" BorderThickness="1"/>
        <Border x:Name="fill" HorizontalAlignment="Left" Width="25" Height="25" CornerRadius="3" Background="…">
            <Border.RenderTransform><TransformGroup><TranslateTransform X="-1"/></TransformGroup></Border.RenderTransform>
        </Border>
        <!-- 手写 IsChecked 画刷切换 + 禁用 Opacity 0.4 触发器… -->
    </Grid>
</ToggleButton>
```

### ✅ 推荐：IOToggleButton 一行属性化（模板证据构造）

```xml
<s:IOToggleButton IsChecked="True" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有模板的 StoryboardChecked/UnChecked（0.2s PowerEase EaseOut）滑块动画、选中画刷组切换（ToggleButton_SelectSquareBrush/SelectCircleBrush）与禁用 Opacity 0.4——且 LazyToggleButton 式的加载态（IsChecked=Null）无从获得；
2. **② 丢失协议挂点**：IO 系列控件走 IOEnable 设备联锁通道（协议文档声明，见 [device-condition-protocol](../../03-protocols/device-condition-protocol.md)），手写 ToggleButton + Binding 联锁是等价机制的重复发明；
3. **③ 无法样式族切换**：55×25 轨道、25×25 滑块、15×15 圆点、PowerEase 动画参数全部散写，不能由 IOToggleButton 模板/样式一处调整；
4. **④ 绕过资源体系**：硬编码轨道/滑块/圆点渐变画刷，绕过 ButtonBrushes.xaml 的 ToggleButton_* 8 键体系；
5. **⑤ 脱离视觉规范**：Viewbox 整体缩放策略、CornerRadius 3、滑块描边（ToggleButton_DefaultSquareBorderBrush）脱离框架控制，且与框架内 LazyToggleButton/ToggleIconButton 形态无法保持族内一致。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOToggleButton.xaml`（锚点 `x:Key="IOToggleButtonBaeControlTemplate"`、`x:Key="StoryboardChecked"`、`x:Key="StoryboardUnChecked"`、`Trigger Property="IsChecked"`、`TargetName="thumb"`/`TargetName="innerBorder"`、`Trigger Property="IsEnabled"`）
- 族内对照：`{source_root}/SDC/Style/ToggleButton.xaml`（`x:Key="BaseToggleBtnStyle"`、`x:Key="ToggleButtonBaeControlTemplate"`、`controls:LazyToggleButton` 隐式样式、`x:Key="ToggleIconButtonBaseStyle"`）
- 配套资源：`{source_root}/SDC/Brushes/ButtonBrushes.xaml`（`ToggleButton_DefaultBackBrush` 等 8 键）、`{source_root}/SDC/Sizes.xaml`（`ToggleButtonWidth` 55/`ToggleButtonHeight` 25/`ToggleButtonSquareWidth` 25/`ToggleButtonCircularWidth` 15）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOToggleButton.xaml.json`

## 8. 待确认项

- TD-001：IOEnable 表达式语义（[device-condition-protocol](../../03-protocols/device-condition-protocol.md)）——IO 系列是否实际挂载 IOEnable 及条件失败行为，模板无证据。
- [待确认 TD-xxx]：模板资源键拼写 `IOToggleButtonBaeControlTemplate`（"Bae" 疑为 "Base" 笔误，ToggleButton.xaml 同有 `ToggleButtonBaeControlTemplate`）；IOToggleButton 无命名基样式（隐式默认直接 BasedOn BaseStyle，与 IOCheckBoxBaseStyle/IORadioButtonBaseStyle 命名模式不一致）；Sizes.xaml 注释掉的旧尺寸（80×35 等）与 `ToggleButtonAnimationOffset` 44 是否为遗留（已建议编号，见 [pending-confirmations](../../05-best-practices/pending-confirmations.md)）。
- [待确认 TD-xxx]：IOToggleButton 与 LazyToggleButton 模板同源（同款滑动动画结构）——两控件除加载态与 .cs 属性外的实际差异面待确认。
