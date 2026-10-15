<!-- evidence=已确认(属性/模板/触发器均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[TD-006,TD-023];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/TabControl.xaml, {source_root}/ManualView.xaml] -->

# TabControl（原生选项卡·框架样式）

## 1. 用途

原生 `TabControl` 的框架样式族：与 IO 版共用同一套 `controls:TabControlAttach.*` 附加属性族（头高/头宽/字号/背景）与四向 `TabStripPlacement` 重排机制，但**头栏面板不同**（原生基样式用 `TabPanel` 按内容自适应宽度，IO 版为 UniformGrid 等分），并**独有 4 个变体样式**：`TabControlSecondaryStyle`（WrapPanel 换行头栏）、`TabControlThirdlyStyle`（**ScrollViewer 可横向滚动头栏**，页签多时专用）、`SecondTabControlStyle`（Second 系列画刷 + 纵向项文字 90° 旋转）、`SensorTab`（固定 Left 布局、Transparent 底、无内容边框）。

典型场景（推断，无 P2 实例）：页签数量不确定需滚动/换行的头栏场景、传感器面板左侧固定纵向导航。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<TabControl … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `TabControl`；`TabItem` 亦为原生类型（ItemContainerStyle 由 Style.Triggers 按 TabStripPlacement 自动注入）。本文件含 4 个 TabItem 样式键 + 6 个 TabControl 样式键（含 1 个隐式默认，BasedOn `TabControlBaseStyle`，`TabControl.xaml:233`）+ 1 个局部 `FocusVisual` 键。

## 3. 关键属性表

**与 IOTabControl 的差异面**：共享 `TabControlAttach.*` 属性族、四向 TabStripPlacement 触发器、IsEnabled→Opacity 0.4、TabItem 横/纵两形态机制（仅键名前缀不同）。**原生版独有**：① 基样式头栏为 `TabPanel`（内容自适应）而非 UniformGrid 等分；② Secondary 头栏 WrapPanel、Thirdly 头栏 ScrollViewer+StackPanel（可横向滚动）；③ `TabItemVerticalStyle` 选中态 #182445 深蓝底（IO 版为 #E1E1E1 浅灰）；④ 4 个变体样式（SecondTabControlStyle/SensorTab 等）；IO 版无这些键。IO 版独有：无（IOTabControlBaseStyle 之外无其他变体）。

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| TabStripPlacement | Dock | Top/Bottom/Left/Right 四向：模板触发器重排头栏/内容区网格与边框；Style.Triggers 同步注入横/纵 TabItem 样式 | `x:Key="TabControlBaseStyle"` 模板内 4 个 Trigger + Style.Triggers 4 个 | ✅ |
| TabControlAttach.Background | Brush | 头栏背景 `TabItem_DefaultBackBrush`；TabItem 模板 mainBorder 直接 TemplateBinding | TabControlBaseStyle Setter（:123）+ `x:Key="TabItemHorizontalStyle"` 模板（:77） | ✅ |
| TabControlAttach.HeaderHeight | double | 头高 Token：基样式 `TabControlHeaderHeight`=40、Secondary `TabControlSecondaryHeaderHeight`=35、Thirdly `TabControlThirdlyHeaderHeight`=25 | 各样式 Setter + {source_root}/SDC/Sizes.xaml:98-102 | ✅ |
| TabControlAttach.HeaderWidth | double | 头宽 Token：`TabControlHeaderWidth`（基/Thirdly/SensorTab）、Secondary `TabControlSecondaryHeaderWidth`=110；Thirdly 硬编码 Auto | 各样式 Setter + Sizes.xaml:101 | ✅ |
| TabControlAttach.FontSize | double | 头字：基/Thirdly/SensorTab `HeadFontSize`=16；SecondTabControlStyle 降为 `SubHeaderFontSize`=14 | 各样式 Setter | ✅ |
| BorderBrush / Background | Brush | 基样式内容区 `TabControl_DefaultBackBrush`；Secondary/Thirdly 同；SecondTabControlStyle 用 `SecondTabControl_*` 系 | 各样式 Setter | ✅ |
| BorderThickness | Thickness | 基样式 0；Secondary/Thirdly/SecondTabControl 1；模板 contentPanel 硬编码描边（基 2,0,2,2、其余 1,0,1,1） | 各样式 Setter + 模板 `contentPanel BorderThickness` | ✅ |
| ItemContainerStyle | Style | 自动注入：基/Secondary/Thirdly→TabItemVerticalStyle（Left/Right）或 TabItemHorizontalStyle（Top/Bottom）；SecondTabControl→SecondTabItem*；SensorTab→TabItemVerticalStyle | 各样式 Style.Triggers | ✅ |
| IsEnabled | bool | False → 整体 Opacity 0.4（控件 + TabItem 内容双份） | 各样式 Style.Triggers + TabItem 模板 `Trigger Property="IsEnabled"` | ✅ |
| 选中/悬停态（横向 TabItem） | Brush | 三态画刷组：TabItem_Default/Hover/Select*（Second 版用 SecondTabItem_*）；TabItemHorizontalStyle 内容区描边 2,0,2,2（Second 版 1） | TabItemHorizontalStyle / SecondTabItemHorizontalStyle 模板 Trigger | ✅ |
| 选中/悬停态（纵向 TabItem） | Brush | 60×60 方块 CornerRadius 3；Hover #D7DCE3 硬编码、Select #182445 深蓝底 + #fff 白字（IO 版 Select 为 #E1E1E1——两版不一致） | `x:Key="TabItemVerticalStyle"` 模板 Trigger（:44-58） | ✅ |
| 纵向文字 | RotateTransform | SecondTabItemVerticalStyle 的 ContentPresenter 挂 `LayoutTransform RotateTransform Angle="90"`（内容沿纵向旋转），宽/高互换（Width=HeaderHeight、Height=HeaderWidth） | SecondTabItemVerticalStyle 模板（:490-508） | ✅ |

模板命名部件（P1 锚点）：`PART_HeaderBorder`、`Part_HeaderPanel`（IsItemsHost：TabPanel / WrapPanel / StackPanel 视样式而定）、`PART_SelectedContentHost`。

## 4. 样式族表（SDC\Style\TabControl.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| TabItemVerticalStyle | 无（独立） | 60×60 方块、圆角 3、`TabItem_SelectBorderBrush` 常态描边；Hover #D7DCE3/Select #182445 硬编码 | Left/Right 布局项（自动注入） |
| TabItemHorizontalStyle | 无（独立） | `controls:SimplePanel` 头条 + innerBorder 2,0,2,2；TabItem_Default/Hover/Select 三态画刷组；Padding 6,2、Min 尺寸取 Token | Top/Bottom 布局项（自动注入） |
| TabControlBaseStyle | 无（独立） | 头栏 **TabPanel**（内容自适应不等分）+ PART_HeaderBorder/PART_SelectedContentHost；四向 TabStripPlacement 触发器；IsEnabled 0.4 | 基样式，不直接用 |
| （隐式默认样式） | TabControlBaseStyle | TargetType 默认样式，全局兜底（:233） | 未显式指定 Style 时 |
| TabControlSecondaryStyle | TabControlBaseStyle | 头栏 **WrapPanel**（自动换行）；BorderThickness 1、内容描边 1,0,1,1；头高 35/头宽 110 | 页签较多需换行 |
| TabControlThirdlyStyle | TabControlBaseStyle | 头栏 **ScrollViewer(HorizontalScrollBarVisibility=Auto) + StackPanel 横向**（页签溢出可横向滚动）；头高 25、头宽 Auto | 页签多到需滚动 |
| SecondTabItemVerticalStyle | 无（独立） | SecondTabItem_* 画刷组；宽/高互换（Width=HeaderHeight、Height=HeaderWidth）；**文字 RotateTransform 90° 纵向** | SecondTabControl Left/Right 项（自动注入） |
| SecondTabItemHorizontalStyle | 无（独立） | SecondTabItem_* 画刷组；BorderThickness 1；Min 尺寸取 Secondary Token | SecondTabControl Top/Bottom 项（自动注入） |
| SecondTabControlStyle | 无（独立模板） | `SecondTabControl_*` 画刷组（内容区描边 1,0,1,1）；头字降为 SubHeaderFontSize；注入 SecondTabItem* 样式 | 二级选项卡 |
| SensorTab | 无（独立模板） | **固定 TabStripPlacement=Left**、Background Transparent、PART_HeaderBorder 0,0,2,0、内容区无边框（Left 时 0,2,2,2）；注入 TabItemVerticalStyle | 传感器侧边导航 |

配套画刷：`{source_root}/SDC/Brushes/TabControlBrushes.xaml`（`TabControl_*`/`TabItem_*` 三态 × 3；`SecondTab*` 系列被 SecondTabControlStyle/SecondTabItem* 消费——IO 版条目注明该系列由本文件消费）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<TabControl TabStripPlacement="Top">
    <TabItem Header="{DynamicResource …页签一文本键}">
        <!-- 页签内容… -->
    </TabItem>
    <TabItem Header="{DynamicResource …页签二文本键}">
        <!-- 页签内容… -->
    </TabItem>
</TabControl>

<!-- 页签较多时：可滚动头栏 -->
<TabControl Style="{StaticResource TabControlThirdlyStyle}" TabStripPlacement="Top">…</TabControl>
```

- 默认（不写 Style）即 `TabControlBaseStyle`；TabItem 横/纵形态由 TabStripPlacement 自动注入，页面只写页签与内容；
- 头栏宽度策略注意：基样式 TabPanel 按内容自适应（不等分）——若需等分头栏请用 IO 版 `s:IOTabControl`（UniformGrid Columns=Items.Count）。

## 6. 禁止写法对照

### ❌ 禁止：原生 TabControl + 手写 TabItem 模板拼等效视觉（常规 WPF 写法）

```xml
<TabControl>
    <TabControl.Resources>
        <Style TargetType="TabItem">
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="TabItem">
                        <Border x:Name="bd" BorderBrush="Gray" BorderThickness="2 0 2 2" Background="LightGray">
                            <ContentPresenter ContentSource="Header" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
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

### ✅ 推荐：框架样式属性化

```xml
<TabControl TabStripPlacement="Top">
    <TabItem Header="{DynamicResource …文本键}">…</TabItem>
</TabControl>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写 TabItem 没有 Default/Hover/Select 三态画刷组（TabItem_*Brushes，含渐变）与 Disabled 0.4（控件+内容双份）触发器；
2. **③ 无法样式族切换**：`TabStripPlacement` 四向重排 + 横/纵形态自动注入（TabItemVertical/HorizontalStyle），以及 Secondary（WrapPanel）/Thirdly（ScrollViewer 滚动头栏）/SecondTabControl（90° 旋转纵向字）/SensorTab 四个变体一键切换均无法复刻；头高 40/35/25 三级 Token 散写失控；
3. **④ 绕过资源体系**：手写 BorderBrush 颜色绕过 TabItem_* 三态画刷键与 TabControlAttach 附加属性族（TemplateBinding 挂点）；
4. **⑤ 脱离视觉规范**：TabPanel 头栏、FocusVisual 虚线焦点框策略、头字 HeadFontSize=16（Second 版 14）无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/TabControl.xaml`（锚点 `x:Key="TabControlBaseStyle"`、`x:Key="TabItemHorizontalStyle"`、`x:Key="TabItemVerticalStyle"`、`x:Key="TabControlSecondaryStyle"`、`x:Key="TabControlThirdlyStyle"`（ScrollViewer+StackPanel 头栏）、`x:Key="SecondTabControlStyle"`、`x:Key="SecondTabItemHorizontalStyle"`、`x:Key="SecondTabItemVerticalStyle"`（RotateTransform 90）、`x:Key="SensorTab"`、隐式默认 `Style TargetType="TabControl" BasedOn="{StaticResource TabControlBaseStyle}"`、`PART_HeaderBorder`/`Part_HeaderPanel`/`PART_SelectedContentHost`）
- 画刷：`{source_root}/SDC/Brushes/TabControlBrushes.xaml`；尺寸：`{source_root}/SDC/Sizes.xaml`（TabControlHeaderHeight 40/SecondaryHeight 35/SecondaryWidth 110/ThirdlyHeight 25）；字号：`{source_root}/SDC/Fonts.xaml`
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：IO 版 `{source_root}/SDC/Style/IOTabControl.xaml` + [io-tab-control](../io/io-tab-control.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_TabControl.xaml.json`、`{index_root}/files/refence_SDC_Brushes_TabControlBrushes.xaml.json`

## 8. 待确认项

- TD-006（`TabControlAttach` 附加属性族语义——TemplateBinding 直挂模板，消费方 .cs 不可见）。
- TD-023 关联：TabControl 不在五对同构（TD-023）内——TabItemVertical/Horizontal 与 IO 版对应样式仅键名不同，但**纵向项选中色不一致**（原生 #182445 vs IO #E1E1E1）且头栏面板不同（TabPanel vs UniformGrid），两版并存为独立设计。
- [待确认 TD-xxx]：`SensorTab` 与 `SecondTabControlStyle` 无 P1 之外的使用证据（SDC 内仅定义未引用），真实消费场景待确认。
- [待确认 TD-xxx]：`TabItemVerticalStyle` 的 Hover #D7DCE3 / Select #182445 / #fff 为硬编码色（无画刷键）——与 IO 版 Select 色 #E1E1E1 并存，疑为历史迭代残留。
