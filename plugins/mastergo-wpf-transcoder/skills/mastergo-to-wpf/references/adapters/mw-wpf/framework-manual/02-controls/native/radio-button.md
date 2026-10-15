<!-- evidence=已确认(属性/模板/触发器均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[TD-023];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/RadioButtonBaseStyle.xaml, {source_root}/ManualView.xaml] -->

# RadioButton（原生单选按钮·框架样式）

## 1. 用途

原生 `RadioButton` 的框架样式（`RadioButtonBaseStyle` + 隐式默认），**与 IORadioButton 逐行同构**（仅 TargetType 与键名不同，TD-023）：13×13 硬编码圆环（CornerRadius=100）+ 7×7 选中圆点（**0.1s 缩放动画**，ScaleTransform 0↔1），未选/悬停/按下/选中/禁用六态画刷（RadioButton_* 组）。**原生版独有**：

- `MainMenuRadioButtonStyle`：**主菜单大按钮**（150×65、LargeFontSize Bold、图标+文字上下排，`ButtonAttach.IconGeometory` 附加属性驱动图标）；
- `RadioGroupItemBaseStyle` + 6 圆角变体（Default/HorizontalFirst/Last/Single/VerticalFirst/Last）：`controls:ButtonGroup` 分组项（高 30、圆角 4、负边距叠合 + ZIndex 压缝）。

典型场景（推断，无 P2 实例）：选项单选（基样式）、主菜单入口（MainMenuRadioButtonStyle）、分组互斥（RadioGroupItem 族）。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<RadioButton … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `RadioButton`。本文件含 9 个样式键 + 1 个隐式默认（BasedOn `RadioButtonBaseStyle`，`RadioButtonBaseStyle.xaml:267`）+ 1 个转换器键（`KeyToResourceConverter`）。

## 3. 关键属性表

**与 IORadioButton 的差异面**：`RadioButtonBaseStyle`（:69）与 IO 版对应基样式模板逐行同构（13×13 圆环 + optionMark 7×7 缩放动画、六态画刷、IsEnabled 双 0.5），仅 TargetType 与键名不同（TD-023）。**原生版独有**：`MainMenuRadioButtonStyle`、`RadioGroupItem` 六键族（IO 版无）。

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| IsChecked | bool? | true → 圆点 0.1s 缩放出现 + `RadioButton_SelectDefaultBorderBrush`；false → 圆点缩没；按下/悬停复合态画刷 | `x:Key="RadioButtonBaseStyle"` StoryboardCheckedTrue/False + MultiTrigger（:148-167） | ✅ |
| Background | Brush | 基样式 Transparent；MainMenuRadioButtonStyle 各态 MainMenuRadioButton_* 画刷 | 各样式 Setter | ✅ |
| BorderBrush | Brush | 基样式 `RadioButton_UnSelectDefaultBrush`（常态圆环）/ `RadioButton_UnSelectPressedBorderBrush` / `_UnSelectHoverBorderBrush` / `_SelectDefaultBorderBrush` / `_SelectPressedBorderBrush` 六态 | 基样式 Setter + 模板 Triggers | ✅ |
| BorderThickness | Thickness | 基样式 2（圆环粗细） | 基样式 Setter（:87） | ✅ |
| 圆环/圆点尺寸 | double | 圆环 13×13、圆点 7×7（**硬编码**，无 Token） | 模板 radioButtonBorder/optionMark（:118-119） | ✅ |
| Padding | Thickness | 5,0,0,0（内容左偏） | 基样式 Setter（:91） | ✅ |
| FontSize / Foreground | — | 基样式 14 / `PrimaryTextBrush`；MainMenuRadioButtonStyle `LargeFontSize` / MainMenuRadioButton_DefaultTextBrush | 各样式 Setter | ✅ |
| ButtonAttach.IconGeometory | Geometry | MainMenuRadioButtonStyle 图标几何（38×38 Path 直绑，TemplatedParent 相对源）；图标 Null 时整体折叠、标题无上边距 | MainMenuRadioButtonStyle 模板（:30）+ Trigger（:37-40） | ✅ |
| 尺寸 | — | MainMenuRadioButtonStyle **150×65 硬编码**；RadioGroupItemBaseStyle 高 30、Padding 10,0、Margin -1,0,0,0 | 各样式 Setter | ✅ |
| BorderElement.CornerRadius | CornerRadius | RadioGroupItem 族经附加属性注入：基 0、Single 4、横首 4,0,0,4、横尾 0,4,4,0、纵首 4,4,0,0、纵尾 0,0,4,4 | RadioGroupItemBaseStyle Setter + 6 变体 | ✅ |
| 选中（GroupItem） | — | `ThirdlyDeepGradientBrush` 底 + 透明边框 + 前景 PrimaryDefaultBrush + `Panel.ZIndex=MaxValue`；Vertical 经 DataTrigger（ButtonGroup.Orientation）改 Margin 0,-1,0,0 | RadioGroupItemBaseStyle Style.Triggers（:213-235） | ✅ |
| IsEnabled | bool | 基样式 Opacity 0.5（控件 + 内容双份，**重复 Setter 残留**）；GroupItem 0.5；MainMenu 0.5（重复） | 各样式/模板 Trigger | ✅ |

## 4. 样式族表（SDC\Style\RadioButtonBaseStyle.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| MainMenuRadioButtonStyle | BaseStyle | **150×65 大按钮**：图标（ButtonAttach.IconGeometory，38×38）+ 标题上下排；LargeFontSize Bold；MainMenuRadioButton_* 全态画刷；BorderDefaultGradientBrush 2px | 主菜单入口 |
| RadioButtonBaseStyle | BaseStyle | 13×13 圆环 + 7×7 圆点（0.1s 缩放动画）+ 六态画刷 + 双份 0.5 禁用；自定义 FocusVisualStyle（PrimaryLightBrush 虚线圆角框） | 基样式，不直接用 |
| （隐式默认样式） | RadioButtonBaseStyle | TargetType 默认样式，全局兜底（:267） | 未显式指定 Style 时 |
| RadioGroupItemBaseStyle | BaseStyle | 高 30、Bold、SubHeaderFontSize、Padding 10,0、负边距叠合、BorderElement 圆角 0；全态触发器 + ButtonGroup.Vertical DataTrigger | 基样式，不直接用 |
| RadioGroupItemDefault | GroupItemBaseStyle | 无覆盖 | 组内默认项 |
| RadioGroupItemHorizontalFirst / HorizontalLast | GroupItemBaseStyle | 圆角 4,0,0,4 / 0,4,4,0、首项 Margin 0 | 横向组首/尾项 |
| RadioGroupItemSingle | GroupItemBaseStyle | 圆角 4 | 单按钮组 |
| RadioGroupItemVerticalFirst / VerticalLast | GroupItemBaseStyle | 圆角 4,4,0,0 / 0,0,4,4、首项 Margin 0 | 纵向组首/尾项 |

模板命名部件（P1 锚点）：`templateRoot`、`radioButtonBorder`、`optionMark`、`contentPresenter`；MainMenu 版：`BorderBack`、`PanelHeader`、`PresenterIcon`、`Icon`、`PresenterHeader`。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<!-- 普通单选 -->
<RadioButton GroupName="组A" Content="{DynamicResource …选项文本键}" IsChecked="True" />

<!-- 主菜单入口按钮 -->
<RadioButton Style="{StaticResource MainMenuRadioButtonStyle}"
             ButtonAttach.IconGeometory="{StaticResource …几何键}"
             Content="{DynamicResource …菜单文本键}" />
```

- 默认（不写 Style）即基样式；分组互斥用 `GroupName`（WPF 原生协议）；
- GroupItem 族由 `controls:ButtonGroup` 容器内部注入（页面不直接指定）；
- 图标一律走 `ButtonAttach.IconGeometory`（Geometries 键体系）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Ellipse 圆环 + 手动 IsChecked 切换拼等效单选（常规 WPF 写法）

```xml
<RadioButton>
    <StackPanel Orientation="Horizontal">
        <Ellipse Width="13" Height="13" Stroke="Gray" StrokeThickness="2" x:Name="ring"/>
        <Ellipse Width="7" Height="7" Fill="Gray" x:Name="dot" Visibility="Collapsed" Margin="3,0,0,0"/>
        <TextBlock Text="手工选项" Margin="5,0,0,0"/>
    </StackPanel>
    <!-- 手写选中切换：圆环变色 + 圆点显隐 + 0.1s 动画 + 悬停/按下/禁用态… -->
</RadioButton>
```

### ✅ 推荐：框架样式默认即单选

```xml
<RadioButton GroupName="组A" Content="{DynamicResource …文本键}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有六态画刷（UnSelect/Hover/Pressed/Select × Default 系列 + 复合 MultiTrigger）、圆点 0.1s 缩放动画（StoryboardCheckedTrue/False）与双份 0.5 禁用态；
2. **③ 无法样式族切换**：普通单选/主菜单大按钮（MainMenuRadioButtonStyle 150×65 图标式）/分组项（RadioGroupItem 族 30 高圆角变体 + ZIndex 压缝）三形态无法切换；
3. **④ 绕过资源体系**：硬编码圆环色绕过 RadioButton_* 画刷键体系与 `BorderElement.CornerRadius` 通道；
4. **⑤ 脱离视觉规范**：13×13/7×7 圆环圆点比例、FontSize 14、Padding 5,0,0,0、自定义 FocusVisual 虚线框（PrimaryLightBrush）脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/RadioButtonBaseStyle.xaml`（锚点 `x:Key="MainMenuRadioButtonStyle"`（:12，ButtonAttach.IconGeometory）、`x:Key="RadioButtonBaseStyle"`（:69，StoryboardCheckedTrue/False、radioButtonBorder 13×13、optionMark 7×7）、`x:Key="RadioGroupItemBaseStyle"`（:182）+ 6 变体（:242-265）、隐式默认 `Style BasedOn="{StaticResource RadioButtonBaseStyle}" TargetType="RadioButton"`（:267）、`tools:KeyToResourceConverter`（:10））
- 画刷：`{source_root}/SDC/Brushes/RadioButtonBrushes.xaml`（RadioButton_UnSelect*/Select* 系列 + MainMenuRadioButton_* 系列，按键名定位）
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：IO 版 `{source_root}/SDC/Style/IORadioButton.xaml` + [io-radio-button](../io/io-radio-button.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_RadioButtonBaseStyle.xaml.json`

## 8. 待确认项

- TD-023：RadioButton/IORadioButton 模板逐行同构（仅 TargetType 不同）——「IO」版真实差异（.cs 行为面）待确认。
- [待确认 TD-xxx]：`MainMenuRadioButtonStyle` 与 `RadioGroupItem` 家族无 P1 之外使用证据——ButtonGroup 容器注入机制与主菜单实际消费场景待确认。
- [待确认 TD-xxx]：基样式与 MainMenuRadioButtonStyle 的 IsEnabled 触发器中 **Opacity 0.5 重复 Setter**（:60-61、:171-172）——残留疑点；GroupItem 禁用为 0.5、ToggleButton 组为 0.4，透明度策略两文件不一致待确认。
