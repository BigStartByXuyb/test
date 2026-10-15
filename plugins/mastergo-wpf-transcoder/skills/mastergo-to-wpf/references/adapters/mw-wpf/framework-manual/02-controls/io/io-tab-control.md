<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-001,TD-006];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOTabControl.xaml, {source_root}/ManualView.xaml] -->

# IOTabControl（IO 选项卡）

## 1. 用途

原生 TabControl 的框架封装：**等分头栏**（`UniformGrid Columns=Items.Count`）+ 四向 `TabStripPlacement`（Top/Bottom/Left/Right）自动重排，TabItem 两套形态（横向横幅式 / 纵向 60×60 方块式），头高/头宽/字号走 `controls:TabControlAttach.*` 附加属性族。

典型场景（推断，无 P2 实例）：多页签内容分区——ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:IOTabControl … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOTabControl`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。模板使用 `controls:SimplePanel` 自定义面板与 `PART_` 命名部件；**TabItem 为原生类型**（ItemContainerStyle 由 Style.Triggers 按 TabStripPlacement 注入）。注意与原生框架版区分：`SDC/Style/TabControl.xaml` 为非 IO 版（`TabControlBaseStyle`/`TabControlSecondaryStyle`/`TabControlThirdlyStyle`/`SecondTabControlStyle`/`SensorTab`）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| TabStripPlacement | Dock | Top/Bottom/Left/Right 四向：模板触发器重排头栏/内容区网格与边框，Style.Triggers 同步切换横/纵 TabItem 形态 | `x:Key="IOTabControlBaseStyle"` `Trigger Property="TabStripPlacement"`（模板内 4 个 + Style.Triggers 4 个） | ✅ |
| TabControlAttach.Background | Brush | 头栏背景（`TabItem_DefaultBackBrush` 竖向渐变）；TabItem 模板 `mainBorder Background` 直接绑定 | IOTabControlBaseStyle Setter + `x:Key="IOTabItemHorizontalStyle"` 模板 | ✅ |
| TabControlAttach.HeaderHeight | double | 头高 `TabControlHeaderHeight`=40（Top/Bottom 布局生效）；模板内无直接 TemplateBinding，消费方 .cs 不可见 | IOTabControlBaseStyle Setter + {source_root}/SDC/Sizes.xaml | 🟡 [待确认 TD-xxx] |
| TabControlAttach.HeaderWidth | double | 头宽 `TabControlHeaderWidth`=100（Left/Right 布局预留）；同上 .cs 不可见 | IOTabControlBaseStyle Setter + Sizes.xaml | 🟡 [待确认 TD-xxx] |
| TabControlAttach.FontSize | double | 头字 `HeadFontSize`=16；模板内未见直接引用，消费方 .cs 不可见 | IOTabControlBaseStyle Setter + {source_root}/SDC/Fonts.xaml | 🟡 [待确认 TD-xxx] |
| BorderBrush / Background | Brush | `TabControl_DefaultBorderBrush` / `TabControl_DefaultBackBrush`（内容区） | IOTabControlBaseStyle Setter | ✅ |
| BorderThickness | Thickness | 基样式 0；仅头栏 PART_HeaderBorder 生效，内容区边框为模板硬编码（Top: 2,0,2,2 / Bottom: 2,2,2,0 / Left: 0,2,2,2 / Right: 2,2,0,2） | IOTabControlBaseStyle Setter + 模板 `contentPanel BorderThickness` | 🟡 [待确认 TD-xxx] |
| ItemContainerStyle | Style | Top/Bottom→`IOTabItemHorizontalStyle`；Left/Right→`IOTabItemVerticalStyle`（自动注入，页面不设） | IOTabControlBaseStyle Style.Triggers | ✅ |
| IsEnabled | bool | False → 整体 Opacity 0.4（控件 + TabItem 内容双份） | IOTabControlBaseStyle Style.Triggers + IOTabItem*Style `Trigger Property="IsEnabled"` | ✅ |
| 选中/悬停态（横向 TabItem） | Brush | 三态画刷组：Default（TabItem_DefaultBorderBrush/TextBrush）/ Hover / Select（TabItem_SelectBackBrush 等） | IOTabItemHorizontalStyle `Trigger Property="IsMouseOver"` / `Trigger Property="IsSelected"` | ✅ |
| 选中/悬停态（纵向 TabItem） | Brush | 60×60 方块 CornerRadius 3；Hover #D7DCE3、Select #E1E1E1 + 白字 | IOTabItemVerticalStyle 模板 + Trigger | ✅ |
| IOEnable | string/bool | 设备条件协议（IO 系列共同挂点）；本模板无直接引用 | ManualView.xaml 15 处（IconButton）+ TD-001 | 🟡 [待确认 TD-001] |

模板命名部件（P1 锚点）：`PART_HeaderBorder`、`Part_HeaderPanel`（UniformGrid IsItemsHost、Columns=Items.Count）、`PART_SelectedContentHost`。

## 4. 样式族表（SDC\Style\IOTabControl.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IOTabItemVerticalStyle | 无（独立） | 60×60 方块、圆角 3、`TabItem_SelectBorderBrush` 常态描边；Hover/Select/Disabled 触发器 | Left/Right 布局项（自动注入） |
| IOTabItemHorizontalStyle | 无（独立） | `controls:SimplePanel` 头条 + innerBorder 2,0,2,2；TabItem_Default/Hover/Select 三态画刷组 | Top/Bottom 布局项（自动注入） |
| IOTabControlBaseStyle | 无（独立） | 等分头栏（UniformGrid Columns=Items.Count）、PART_HeaderBorder/Part_HeaderPanel/PART_SelectedContentHost、四向 TabStripPlacement 触发器、IsEnabled 0.4 | 基样式，不直接用 |
| （无键默认样式） | IOTabControlBaseStyle | TargetType 隐式默认样式，全局兜底 | 未显式指定 Style 时 |

配套画刷：`{source_root}/SDC/Brushes/TabControlBrushes.xaml`（`TabControl_DefaultBorderBrush/DefaultBackBrush`；`TabItem_Default*/Hover*/Select*` 三态 × 3 画刷；`SecondTab*` 系列由非 IO 版 TabControl.xaml 消费）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `s:IOTabControl`。

```xml
<s:IOTabControl TabStripPlacement="Top">
    <TabItem Header="{DynamicResource …页签一文本键}">
        <!-- 页签内容… -->
    </TabItem>
    <TabItem Header="{DynamicResource …页签二文本键}">
        <!-- 页签内容… -->
    </TabItem>
</s:IOTabControl>
```

- TabItem 直接用原生 `TabItem`，其横/纵形态由 TabStripPlacement 自动注入的 ItemContainerStyle 决定；
- 头栏等分、头高 40、三态画刷全部由框架处理，页面只写页签与内容。

## 6. 禁止写法对照

### ❌ 禁止：原生 TabControl + 手写 TabItem 模板拼等效视觉（常规 WPF 写法）

```xml
<TabControl>
    <TabControl.Resources>
        <Style TargetType="TabItem">
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="TabItem">
                        <Grid>
                            <Border x:Name="bd" BorderBrush="Gray" BorderThickness="2 0 2 2" Background="LightGray">
                                <ContentPresenter ContentSource="Header" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                            </Border>
                        </Grid>
                        <ControlTemplate.Triggers>
                            <!-- 自行补 IsSelected/IsMouseOver/IsEnabled 画刷切换… -->
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </TabControl.Resources>
    <TabItem Header="手工页签">…</TabItem>
</TabControl>
```

### ✅ 推荐：IOTabControl 属性化

```xml
<s:IOTabControl TabStripPlacement="Top">
    <TabItem Header="{DynamicResource …文本键}">…</TabItem>
</s:IOTabControl>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写 TabItem 没有 Default/Hover/Select 三态画刷组（TabItem_*Brushes，含渐变）与 Disabled 0.4（控件+内容双份）触发器；
2. **③ 无法样式族切换**：`TabStripPlacement` 四向重排 + 横/纵形态自动切换（Style.Triggers 注入 IOTabItemHorizontalStyle/VerticalStyle）无法复刻；头高 40/头宽 100（TabControlHeaderHeight/HeaderWidth Token）散写失控；
3. **⑤ 脱离视觉规范**：等分头栏（UniformGrid Columns=Items.Count）、TabControlAttach 附加属性、FocusVisual 虚线框策略、头字 HeadFontSize=16 等规范无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOTabControl.xaml`（锚点 `x:Key="IOTabControlBaseStyle"`、`x:Key="IOTabItemHorizontalStyle"`、`x:Key="IOTabItemVerticalStyle"`、`Trigger Property="TabStripPlacement"`、`PART_HeaderBorder`/`Part_HeaderPanel`/`PART_SelectedContentHost`）
- 画刷：`{source_root}/SDC/Brushes/TabControlBrushes.xaml`；尺寸：`{source_root}/SDC/Sizes.xaml`（TabControlHeaderHeight/Width）；字号：`{source_root}/SDC/Fonts.xaml`（HeadFontSize）
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：非 IO 版 `{source_root}/SDC/Style/TabControl.xaml`（`x:Key="TabControlBaseStyle"`、`TabControlSecondaryStyle`、`TabControlThirdlyStyle`、`SecondTabControlStyle`、`SensorTab`）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOTabControl.xaml.json`、`{index_root}/files/refence_SDC_Brushes_TabControlBrushes.xaml.json`

## 8. 待确认项

- TD-001（IOEnable 表达式语义——IO 系列共同协议，本模板无直接引用，属系列推断）
- TD-006（`TabControlAttach` 附加属性族）
- [待确认 TD-xxx]：`TabControlAttach.HeaderHeight/HeaderWidth/FontSize` 在模板内无直接 TemplateBinding（仅 Background 被 TabItem 模板消费）——实际消费方 .cs 不可见，语义待确认
- [待确认 TD-xxx]：IOTabItemVerticalStyle 60×60 尺寸与 Select 色 #E1E1E1/#fff 为硬编码（无 Token/画刷键）；`BorderThickness=0` 与模板 contentPanel 硬编码 2,0,2,2 等——建议登记新 TD
