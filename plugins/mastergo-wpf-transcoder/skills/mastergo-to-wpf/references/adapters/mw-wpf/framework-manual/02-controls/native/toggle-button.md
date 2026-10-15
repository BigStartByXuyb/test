<!-- evidence=已确认(属性/模板/触发器均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[TD-027,TD-062];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/ToggleButton.xaml, {source_root}/ManualView.xaml] -->

# ToggleButton（开关按钮·框架样式，ToggleButton/LazyToggleButton/ToggleIconButton 家族）

## 1. 用途

ToggleButton.xaml 覆盖**三个 TargetType**：

1. **原生 `ToggleButton`**：开关式两态按钮（开=滑块右移 + 选中色，0.2s PowerEase 动画）。含**隐式默认样式**与键式 `BaseToggleBtnStyle`（**两键 Setter 完全相同，重复定义**），共用 `ToggleButtonBaeControlTemplate`（**"Bae" 拼写**，与 IO 版同型拼写疑点，关联 TD-027）。
2. **`controls:LazyToggleButton`**（自定义控件）：开关滑块 + **三态**——`IsChecked={x:Null}` 时滑块消失、**Loading 图标 1s 360° 无限旋转**（异步等待语义）。
3. **`controls:ToggleIconButton`**（自定义控件）：SDC 右下角工具按钮——图标 + 文字 + 左上角状态标记（`TopLeftContent` 文本 + `StatusBrush` 状态方块，`IsShowStatus` 经 B2CConverter 显隐）+ IsChecked/悬停/按下全态 IconButton_* 画刷。

另含 **ToggleButtonGroupItem 六键族**（ButtonGroup 分组项：`ToggleButtonGroupItemBaseStyle` + Default/HorizontalFirst/HorizontalLast/Single/VerticalFirst/VerticalLast 圆角变体，供 `controls:ButtonGroup` 消费）+ `ToggleButtonSimpleStyle`（独立圆角 3 简化版）。

典型场景（推断，无 P2 实例）：设置开关（ToggleButton）、异步加载开关（LazyToggleButton 三态）、工具栏工具按钮（ToggleIconButton）。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<ToggleButton … />；<controls:LazyToggleButton … />；<controls:ToggleIconButton … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `ToggleButton` + `controls:LazyToggleButton` + `controls:ToggleIconButton`（MaxwellControl.Controls）。本文件含 1 个 ControlTemplate 键、1 个转换器键、10 个样式键 + 2 个隐式默认样式。

## 3. 关键属性表

**与 IOToggleButton 的差异面**：`ToggleButtonBaeControlTemplate` 与 IO 版 `IOToggleButtonBaeControlTemplate` 同源（"Bae" 拼写一致，TD-027），隐式 ToggleButton 与 IO 版隐式样式的 Setter 面一致（Background/BorderBrush/BorderThickness 1/Padding 6,0,0,0/尺寸 Token/模板）。**原生版独有**：`BaseToggleBtnStyle` 键式重复定义（IO 版无键式基样式）、`LazyToggleButton`/`ToggleIconButton`/GroupItem 六键族/`ToggleButtonSimpleStyle`（IO 版无）。

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| IsChecked | bool? | 三态：true → 滑块右移 + 选中画刷；false → 左位；`{x:Null}`（Lazy 版）→ Loading 旋转 | `x:Key="ToggleButtonBaeControlTemplate"` Trigger（:469-481）+ Lazy 模板 Trigger（:122-144） | ✅ |
| Background / BorderBrush | Brush | 隐式/BaseToggleBtnStyle：`ToggleButton_DefaultBackBrush`/`_DefaultBorderBrush`；Lazy：`ToggleButtonBackgroundBrush`/`ToggleButtonBorderGradientBrush` | 各样式 Setter | ✅ |
| BorderThickness | Thickness | 隐式 1；ToggleIconButton 2 | 各样式 Setter | ✅ |
| Padding | Thickness | 6,0,0,0（内容左偏，贴合开关位） | 隐式/Lazy/BaseToggleBtnStyle Setter | ✅ |
| Width / Height | double | `ToggleButtonWidth`/`ToggleButtonHeight`（Sizes.xaml:112-113） | 各样式 Setter | ✅ |
| 滑块尺寸 | double | `ToggleButtonSquareWidth/Height`（Sizes.xaml:114-115）；内圆 `ToggleButtonCircularWidth/Height`（Sizes.xaml:116-117） | 两模板 thumb/Circle 引用 | ✅ |
| TopLeftContent（ToggleIconButton） | string | 左上角状态文本；Null 时折叠 | `x:Key="ToggleIconButtonBaseStyle"` PART_MarkContent + Trigger（:292/:309-311） | ✅ |
| IsShowStatus（ToggleIconButton） | bool | 左上角状态方块显隐（B2CConverter：True=Visible/False=Collapsed） | PART_MarkIcon `Visibility="{TemplateBinding IsShowStatus,Converter={StaticResource B2CConverter}}"`（:293） | ✅ |
| StatusBrush（ToggleIconButton） | Brush | 状态方块填充 | PART_MarkIcon `Fill`（:293） | ✅ |
| Icon / IconWidth / IconHeight（ToggleIconButton） | Geometry / double | 主图标（`Button_IconWidth/Height`=20，Sizes.xaml:41-42）；Null 折叠图标、内容居中 | PathMain（:296）+ Trigger（:302-305） | ✅ |
| FontSize / FontWeight | — | ToggleIconButton：SubHeaderFontSize=14、Bold | ToggleIconButtonBaseStyle Setter（:278-279） | ✅ |
| IsEnabled | bool | ToggleButton/Lazy：Opacity 0.4；ToggleIconButton：**0.56**（不一致） | 各模板 Trigger | ✅ |
| CornerRadius | CornerRadius | GroupItem 族经 `BorderElement.CornerRadius` 通道注入（0 基/3 单/3,0,0,3 首/0,3,3,0 尾/3,3,0,0 纵首/0,0,3,3 纵尾） | `x:Key="ToggleButtonGroupItemBaseStyle"` + 6 变体 Setter | ✅ |
| 尺寸（GroupItem） | — | 35×100、Margin -1,0,0,0（负边距叠合）；Vertical 经 DataTrigger（ButtonGroup.Orientation）改 0,-1,0,0 | ToggleButtonGroupItemBaseStyle Setter（:165-167）+ DataTrigger（:210-212） | ✅ |
| 选中（GroupItem） | — | `ThirdlyDeepGradientBrush` 底 + 透明边框 + 前景 PrimaryDefaultBrush + `Panel.ZIndex=MaxValue`（压叠合缝） | GroupItemBaseStyle Style.Triggers（:204-209） | ✅ |

## 4. 样式族表（SDC\Style\ToggleButton.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| （ToggleButton 隐式默认） | BaseStyle | ToggleButton_Default* 画刷、1px 边框、Padding 6,0,0,0、尺寸 Token、模板 `ToggleButtonBaeControlTemplate`（:14） | 未显式指定 Style 时 |
| BaseToggleBtnStyle | BaseStyle | **与隐式样式 Setter 完全相同的重复定义**（:26） | 需键式引用时 |
| （LazyToggleButton 隐式默认） | BaseStyle | 独立内联模板（Viewbox 缩放）：thumb 滑块 + Circle + loading Path；三态（false/true/Null 旋转 1s 360°）；`ButtonPressGradientBrushRevert` 选中底（:37） | 异步等待开关 |
| ToggleButtonGroupItemBaseStyle | BaseStyle | 35×100、Bold、负边距叠合、BorderElement 圆角 0、全态触发器（Checked/Hover/Pressed/Disabled + ButtonGroup.Vertical DataTrigger） | 基样式，不直接用 |
| ToggleButtonGroupItemDefault | GroupItemBaseStyle | 无覆盖 | 组内默认项 |
| ToggleButtonGroupItemHorizontalFirst / HorizontalLast | GroupItemBaseStyle | 圆角 3,0,0,3（首）/ 0,3,3,0（尾）、首项 Margin 0 | 横向组首/尾项 |
| ToggleButtonGroupItemSingle | GroupItemBaseStyle | 圆角 3 | 单按钮组 |
| ToggleButtonGroupItemVerticalFirst / VerticalLast | GroupItemBaseStyle | 圆角 3,3,0,0 / 0,0,3,3、首项 Margin 0 | 纵向组首/尾项 |
| ToggleButtonSimpleStyle | GroupItemBaseStyle | 圆角 3 简化版（同 Single 键但独立命名） | 简化开关按钮 |
| ToggleIconButtonBaseStyle | BaseStyle | **TargetType=controls:ToggleIconButton**；图标+文字+左上状态标记（TopLeftContent/IsShowStatus/StatusBrush + B2CConverter）；BorderThickness 2、CornerRadius 0、Focusable=False；IconButton_* 四态画刷；IsEnabled **0.56**（:266） | SDC 右下角工具按钮 |

模板命名部件（P1 锚点）：`templateRoot`、`backBorder`、`innerBorder`、`lightBorder`（模板内注释掉的动画目标）、`thumb`、`Circle`、`contentPresenter`、`loading`（Lazy）、`PART_MarkContent`/`PART_MarkIcon`/`PathMain`/`ContentPresenterMain`（ToggleIconButton）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<!-- 普通开关 -->
<ToggleButton IsChecked="True" />

<!-- 带内容的开关（内容显示在开关右侧） -->
<ToggleButton IsChecked="True" Content="{DynamicResource …文本键}" />

<!-- 异步等待开关：IsChecked 置 Null 时转 Loading -->
<controls:LazyToggleButton IsChecked="{x:Null}" />

<!-- 工具按钮（图标+文字+左上状态标记） -->
<controls:ToggleIconButton Icon="{StaticResource …几何键}" Content="工具"
                           TopLeftContent="状态" IsShowStatus="True"
                           StatusBrush="{DynamicResource NormalBrush}" />
```

- 默认（不写 Style）即各类型隐式样式；GroupItem 族由 `controls:ButtonGroup` 容器内部注入（页面不直接指定）；
- 内容 Content 走 DynamicResource 文本键；Icon 走 Geometries 键体系。

## 6. 禁止写法对照

### ❌ 禁止：手写两色方块 + 手动 IsChecked 切换拼等效开关（常规 WPF 写法）

```xml
<ToggleButton>
    <ToggleButton.Resources>
        <Style TargetType="ToggleButton">
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="ToggleButton">
                        <Border Width="55" Height="25" CornerRadius="3" Background="Gray">
                            <Border x:Name="knob" Width="25" Height="25" CornerRadius="3"
                                    Background="White" HorizontalAlignment="Left"/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsChecked" Value="True">
                                <Setter TargetName="knob" Property="HorizontalAlignment" Value="Right"/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </ToggleButton.Resources>
    开关
</ToggleButton>
```

### ✅ 推荐：框架样式默认即开关

```xml
<ToggleButton IsChecked="True" Content="{DynamicResource …文本键}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有滑块 0.2s PowerEase 位移动画（StoryboardChecked/UnChecked：TranslateTransform X −1→30、innerBorder 缩放 0→1）、选中双画刷（thumb/Circle 三组 Select 画刷）与三态（Lazy 的 `{x:Null}` Loading 旋转）；
2. **③ 无法样式族切换**：普通/Lazy/Icon/GroupItem 四形态无法切换；尺寸 Token（ToggleButtonWidth/Height、Square、Circular 系列）散写失控；GroupItem 的圆角变体与负边距叠合（ZIndex MaxValue）不可复刻；
3. **④ 绕过资源体系**：硬编码开关色绕过 ToggleButton_Default* / ToggleButtonCircleBrush / IconButton_* 键体系与 `BorderElement.CornerRadius` 通道；
4. **⑤ 脱离视觉规范**：字号（ToggleIconButton SubHeaderFontSize Bold）、Padding 6,0,0,0 内容偏置、IsEnabled 0.4/0.56 透明度策略、B2CConverter 显隐通道脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/ToggleButton.xaml`（锚点 隐式默认 `Style TargetType="{x:Type ToggleButton}"`（:14）、`x:Key="BaseToggleBtnStyle"`（:26，重复定义）、隐式 `Style TargetType="{x:Type controls:LazyToggleButton}"`（:37，loading 旋转）、`x:Key="ToggleButtonGroupItemBaseStyle"`（:155）+ 6 变体（:232-255）、`x:Key="ToggleButtonSimpleStyle"`（:258）、`tools:BoolToVisibilityConverter x:Key="B2CConverter"`（:265）、`x:Key="ToggleIconButtonBaseStyle"`（:266，PART_MarkContent/PART_MarkIcon）、`x:Key="ToggleButtonBaeControlTemplate"`（:340，StoryboardChecked/UnChecked PowerEase））
- 画刷：`{source_root}/SDC/Brushes/ButtonBrushes.xaml`（ToggleButton_Default*/Select* 系列）；尺寸：`{source_root}/SDC/Sizes.xaml`（ToggleButtonWidth/Height 55×25、Square 25×25、Circular 15×15、Button_IconWidth/Height 20）
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：IO 版 `{source_root}/SDC/Style/IOToggleButton.xaml` + [io-toggle-button](../io/io-toggle-button.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_ToggleButton.xaml.json`

## 8. 待确认项

- TD-027：`ToggleButtonBaeControlTemplate` 的 **"Bae" 拼写**（应为 Base；与 IO 版 `IOToggleButtonBaeControlTemplate` 同型）——两文件各自独立登记还是同一疑点，待合并确认。
- TD-062：`LazyToggleButton` 三态语义（`{x:Null}` = 异步等待 Loading）与 `ToggleIconButton`（TopLeftContent/IsShowStatus/StatusBrush 状态标记协议）——消费方 .cs 不可见，语义待确认。
- [待确认 TD-xxx]：`BaseToggleBtnStyle` 与隐式样式 Setter 完全相同——重复定义的意图（版本残留 or 跨文件键式引用需求）待确认；`ToggleButtonSimpleStyle` 与 `ToggleButtonGroupItemSingle` 键值相同却独立命名——同上待确认。
- [待确认 TD-xxx]：`ToggleIconButtonBaseStyle` IsEnabled 透明度 0.56（其他控件族 0.4）——数值不一致待确认。
