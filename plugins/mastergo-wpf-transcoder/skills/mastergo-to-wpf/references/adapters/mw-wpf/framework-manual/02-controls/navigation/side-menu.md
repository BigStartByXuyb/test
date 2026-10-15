<!-- evidence=部分确认(属性/样式族/触发器均为模板源码直接证据；无真实页面使用，区块 5 为模板证据构造); pending=[TD-001,TD-002,TD-003,TD-004]; verified=2026-08-13; sources=[{source_root}/SDC/Style/SideMenu.xaml, {source_root}/ManualView.xaml] -->

# SideMenu（侧边菜单）

## 1. 用途

两级侧边导航容器：`SideMenu` 是容器（ItemsControl 语义），默认项容器为分组头样式（SideMenuItemHeaderBaseStyle），`SideMenuItem` 承担「可展开分组头 + 叶子子项」两级角色；`ExpandMode="Accordion"` 一键切换手风琴形态（换模板、换项容器样式、折叠区固定 PanelAreaLength=200）。分组头带 0.1s 三角旋转折叠动画（StoryboardVisable/StoryboardCollapsed，0↔90°）。

典型场景：主界面左侧功能导航树——**无真实页面使用**（ManualView.xaml / FrameworkGeneric.xaml / Demo 均未引用，见区块 5，以下均为模板证据构造）。

关联控件：`NarrowMenuItem`（窄菜单项）**不属于本文件**，定义于 `{source_root}/SDC/Style/Menu.xaml`（NarrowMenuItemStyle / NarrowMenuItemBaseStyle，150×50 / ButtonWidth×ButtonHeight）。

## 2. 声明

```xml
<s:SideMenu … />
<s:SideMenuItem … />
```

`s` = http://www.maxwell-gp.com/；TargetType = `controls:SideMenu` / `controls:SideMenuItem`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件同时声明 `tools:BoolToVisibilityConverter`（x:Key="B2CConverter"，IsExpanded→子面板显隐）。

## 3. 关键属性表

### SideMenu 级

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| ExpandMode | enum | 展开模式；仅 `Accordion` 值有模板证据——=Accordion 时 PanelAreaLength=200 + 换项容器 + 换模板 | `Trigger Property="ExpandMode" Value="Accordion"`（无键默认样式 Style.Triggers） | 🟡 |
| PanelAreaLength | double（200） | 折叠子面板区域高度，被子项模板 ItemsPresenter/ScrollViewer 的 Height 绑定（AncestorType=SideMenu） | `Setter Property="PanelAreaLength" Value="200"` + `Binding PanelAreaLength` | ✅ |
| ItemPadding | Thickness | 子项 DockPanel 的 Margin 绑定（FindAncestor=SideMenu）；活动样式未设置默认值（旧注释版本为 40 0 30 0） | `Binding ItemPadding, RelativeSource=FindAncestor AncestorType=controls:SideMenu` | 🟡 |
| ItemContainerStyle | Style | 默认 `SideMenuItemHeaderBaseStyle`（叶子项由分组头样式的 ItemContainerStyle 再指定） | `Setter Property="ItemContainerStyle"` | ✅ |
| ItemsPanel | Panel | StackPanel（IsItemsHost） | `Setter Property="ItemsPanel"` | ✅ |
| Focusable / FocusVisualStyle | bool / Style | False / {x:Null} | Setter | ✅ |
| MinWidth / MinHeight | double | 180 / 855 | Setter | ✅ |
| BorderThickness / Background / BorderBrush | — | 0；`SideMenu_DefaultBackBrush` | Setter | ✅ |
| IsEnabled | bool | False 时整树 Opacity 0.5 | `Trigger Property="IsEnabled" Value="False"`（模板） | ✅ |

### SideMenuItem 级

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Role | enum/string | 项角色；仅 `Item` 值有模板证据（基样式默认 + HasItems=False 时强制），`Header` 角色仅推断 | `Setter Property="Role" Value="Item"` + HasItems=False Trigger | 🟡 |
| Icon | Geometry | 分组头图标（15×15 / Accordion 20×20，模板绑定）；为 Null 时隐藏（Trigger） | `Path Data="{TemplateBinding Icon}"` + `Trigger Property="Icon" Value="{x:Null}"` | ✅ |
| Header | object | 项文本/内容（ContentSource） | `ContentPresenter ContentSource="Header"` | ✅ |
| IsExpanded | bool | 展开态：子面板经 B2CConverter 显隐、三角旋转 Storyboard Enter/ExitActions、展开换 PrimaryToolBrush | `Trigger Property="IsExpanded" Value="True"` + BeginStoryboard | ✅ |
| HasItems | bool | False 时隐藏三角并强制 Role=Item（叶子头自动降级为普通项） | `Trigger Property="HasItems" Value="False"` | ✅ |
| IsSelected | bool | 选中态（叶子：SideMenuItem_SelectBackBrush 渐变底 + SelectTextBrush） | `Trigger Property="IsSelected" Value="True"` + MultiTrigger(IsSelected+HasItems=False) | ✅ |
| IsMouseOver | bool | 悬停态（2px 渐变边框 + Hover 画刷） | `Trigger Property="IsMouseOver" Value="true"` + 悬停 MultiTrigger | ✅ |
| IsEnabled | bool | False 时 Opacity .5 | `Trigger Property="IsEnabled" Value="False"` | ✅ |
| VerticalContentAlignment | enum | Center | `Setter Property="VerticalContentAlignment"` | ✅ |
| MinHeight / MinWidth / FontSize / FontWeight / Margin | — | 45（头 45/手风琴头 50）/ 头 MinWidth 180 / SubHeaderFontSize(14) 头用 HeadFontSize(16) / Bold / 0 0 0 2 | 各样式 Setter | ✅ |

## 4. 样式族表（SDC\Style\SideMenu.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| SideMenuItemBaseStyle | BaseStyle | 叶子项：7×7 圆点（`CirclePointGeometry`，Foreground 着色）+ Header；MinHeight 45；FontSize SubHeaderFontSize(14) Bold；Margin 0 0 0 2；Role=Item；悬停 2px SideMenuItem_HoverBorderBrush 渐变边框；选中 SideMenuItem_SelectBackBrush 渐变底 | 普通模式叶子子项（分组头的默认 ItemContainerStyle） |
| SideMenuItemAccordionBaseStyle | SideMenuItemBaseStyle | 叶子项变体：Icon 20×20 模板绑定；悬停 HoverBrush/PrimaryBrush；选中 PrimaryLightGradientBrush/LightTextBrush | Accordion 模式叶子子项 |
| SideMenuItemHeaderBaseStyle | BaseStyle | 分组头：Icon 15×15 + Header + 右侧三角（8×15，RenderTransform 旋转 0↔90°，0.1s）；子面板 IsExpanded→B2CConverter 显隐、高度=PanelAreaLength；HasItems=False 隐藏三角 + Role=Item；FontSize HeadFontSize(16) | 可展开分组头（SideMenu 默认项容器） |
| SideMenuItemHeaderAccordionBaseStyle | SideMenuItemHeaderBaseStyle | 分组头变体：行高 50；Icon 20×20；子面板 ScrollViewer 滚动；展开换 SecondaryBrush；三组悬停 MultiTrigger | Accordion 分组头 |
| SideMenuBaseStyle | 无 | Focusable=False；Min 180×855；BorderThickness 0；SideMenu_DefaultBackBrush 底；默认 ItemContainerStyle=SideMenuItemHeaderBaseStyle；ScrollViewer+ItemsPresenter 模板 | 基类，不直接用 |
| （无键默认样式） | SideMenuBaseStyle | Style.Triggers：ExpandMode=Accordion → PanelAreaLength=200 + 项容器换 HeaderAccordion + 无滚动模板 | 全局兜底，ExpandMode 驱动切换 |
| SideMenuAccordion | SideMenuBaseStyle | 显式手风琴：ExpandMode=Accordion、PanelAreaLength=200、HeaderAccordion、无滚动模板 | 显式指定手风琴形态 |

- **动画资源**：`x:Key="StoryboardVisable"`（→90°）/ `x:Key="StoryboardCollapsed"`（→0°），0.1s EasingDoubleKeyFrame，仅作用于 Triangle 的 RotateTransform.Angle。
- **画刷家族**：`{source_root}/SDC/Brushes/SideMenuBrushes.xaml` 共 7 键（SideMenu_DefaultBackBrush、SideMenuItem_DefaultBackBrush/DefaultTextBrush/HoverBackBrush/HoverBorderBrush/SelectBackBrush/SelectTextBrush），全 Primary 色系；命名段见 `../../01-resources/brushes.md`。
- **尺寸 Token**（`{source_root}/SDC/Sizes.xaml`）：SideMenuBoxWidth 400 / SideMenuBoxHeight 780 / SideMenuSecondaryWidth 150 / SideMenuSecondaryHeight 50 / SideMenuThirdlyWidth 150 / SideMenuThirdlyHeight 50——样式族内**无引用**（页面级布局用）；MaxwellFramework_SideMenuWidth 85 / MaxwellFramework_SideMenuHeight 855 在 SDC 内**无任何引用**，疑似遗留。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**：ManualView.xaml、FrameworkGeneric.xaml、Demo（P3）均未引用 SideMenu/SideMenuItem。注意 FrameworkGeneric.xaml 存在同名 `SideMenuButtonStyle`，但那是 Button 样式（模板=SimplePanel+ContentPresenter，与 SideMenu 控件无关），且自身也未被任何页面引用。

构造示例（用法由模板证据推导）：

```xml
<s:SideMenu Style="{StaticResource SideMenuAccordion}"
            Width="{DynamicResource SideMenuBoxWidth}"
            Height="{DynamicResource SideMenuBoxHeight}">
    <s:SideMenuItem Header="{DynamicResource MenuStep}">
        <s:SideMenuItem Header="{DynamicResource MenuStep1}" Icon="{StaticResource …Geometry}"/>
        <s:SideMenuItem Header="{DynamicResource MenuStep2}"/>
    </s:SideMenuItem>
    <s:SideMenuItem Header="{DynamicResource MenuParam}" Icon="{StaticResource …Geometry}"/>
</s:SideMenu>
```

逐项说明（均为模板证据推导）：
- 不写 Style 时由无键默认样式兜底：ExpandMode 非 Accordion → ScrollViewer 模板 + SideMenuItemHeaderBaseStyle 项容器；`ExpandMode="Accordion"` 属性或显式 `Style="{StaticResource SideMenuAccordion}"` → 手风琴形态（无滚动、折叠区 200）。
- Header 走 DynamicResource 文本键（本地化体系，见 03-protocols/localization-text.md，TD-004 域）；Icon 走 Geometry 键（几何图标库）。
- 分组头无子项时（HasItems=False）模板自动隐藏三角并强制 Role=Item——纯叶子头自动降级，无需使用方干预。
- 子项内层 Header/Icon 排版（圆点 7×7 或 Icon 20×20、Margin 15/6）由样式族固化，使用方不散写。

## 6. 禁止写法对照

### ❌ 禁止：手写 Expander + StackPanel + Button 拼装等效侧边导航（常规 WPF 写法）

```xml
<StackPanel Width="180">
    <Expander Header="工序" IsExpanded="True">
        <StackPanel>
            <Button Content="步骤1" HorizontalContentAlignment="Left"/>
            <Button Content="步骤2" HorizontalContentAlignment="Left"/>
        </StackPanel>
    </Expander>
    <Button Content="参数设置" HorizontalContentAlignment="Left"/>
</StackPanel>
```

### ✅ 推荐：SideMenu 两级声明式导航

```xml
<s:SideMenu Style="{StaticResource SideMenuAccordion}">
    <s:SideMenuItem Header="{DynamicResource …工序文本键}">
        <s:SideMenuItem Header="{DynamicResource …步骤1文本键}"/>
        <s:SideMenuItem Header="{DynamicResource …步骤2文本键}"/>
    </s:SideMenuItem>
    <s:SideMenuItem Header="{DynamicResource …参数设置文本键}"/>
</s:SideMenu>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写拼装没有 SideMenuItem 的 IsSelected/IsMouseOver/IsExpanded/HasItems/IsEnabled(Opacity .5) 触发器族与 SideMenu_* 画刷三态（默认/悬停渐变边框/选中渐变底），更没有 0.1s 三角旋转折叠动画（SideMenu.xaml StoryboardVisable/StoryboardCollapsed）；
2. **② 丢失协议挂点**：框架导航容器是后续导航/联锁协议（TD-001/002/003 家族，见 03-protocols/）的承载面，手写 StackPanel 无从接续页面跳转与动作体系；
3. **③ 无法样式族切换**：不能一键 SideMenuBaseStyle→SideMenuAccordion（ExpandMode 驱动换模板、换项容器、换折叠区高度 200）——手写结构每次形态调整都要重写；
4. **④ 绕过本地化**：硬编码「工序/步骤1」绕过 DynamicResource 文本键体系（TD-004）；
5. **⑤ 脱离视觉规范**：180×855 尺寸、45px 行高、16px 分组头、2px 渐变悬停边框、折叠区 200 等规范全部失控，页面视觉无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/SideMenu.xaml`（锚点 `x:Key="SideMenuItemBaseStyle"`、`x:Key="SideMenuItemAccordionBaseStyle"`、`x:Key="SideMenuItemHeaderBaseStyle"`、`x:Key="SideMenuItemHeaderAccordionBaseStyle"`、`x:Key="SideMenuBaseStyle"`、`x:Key="SideMenuAccordion"`、`x:Key="StoryboardVisable"`、`x:Key="StoryboardCollapsed"`、`Trigger Property="ExpandMode" Value="Accordion"`、`Trigger Property="IsExpanded" Value="True"`、`Trigger Property="Role"`、`Trigger Property="HasItems"`、`Binding ItemPadding/PanelAreaLength`）
- 画刷家族：`{source_root}/SDC/Brushes/SideMenuBrushes.xaml`（7 键，见区块 4）
- 尺寸 Token：`{source_root}/SDC/Sizes.xaml`（SideMenuBoxWidth/SideMenuBoxHeight/SideMenuSecondaryWidth/SideMenuSecondaryHeight/SideMenuThirdlyWidth/SideMenuThirdlyHeight；MaxwellFramework_SideMenuWidth/Height 无引用）
- 真实使用：**无**（ManualView.xaml / FrameworkGeneric.xaml / Demo 均未引用）
- 关联控件：NarrowMenuItem 定义于 `{source_root}/SDC/Style/Menu.xaml`（`x:Key="NarrowMenuItemStyle"` / `x:Key="NarrowMenuItemBaseStyle"`）——不属于 SideMenu.xaml
- 索引交叉：`{index_root}/files/refence_SDC_Style_SideMenu.xaml.json`、`{index_root}/files/refence_SDC_Brushes_SideMenuBrushes.xaml.json`；capabilities/ 下无 side-menu.json
- 相关文档：`../README.md`（控件索引）、`../../01-resources/brushes.md`（SideMenu_ 命名段）、`../../01-resources/colors-fonts-sizes.md`（SideMenu* 尺寸段）、`../../03-protocols/localization-text.md`、`../../00-guide/03-writing-paradigm.md`

## 8. 待确认项

- TD-001 / TD-002 / TD-003：SideMenu 模板**无** IOEnable/s:Action/PageName 挂点（与 IconButton 不同，见 `./icon-button.md`），页面跳转需使用方自行接续；相关协议语义仍待回填。
- TD-004：Header 文本键定义位置与语言切换机制（与 icon-button.md 同域）。
- 建议新 TD（未登记，待维护者写入 `../../05-best-practices/pending-confirmations.md`）：
  - SideMenu.Role 取值全集（仅 `Item` 有模板证据；`Header` 仅推断）——区块 3 标 🟡；
  - SideMenu.ExpandMode 枚举全集与默认值（仅 `Accordion` 确认）；
  - SideMenuItem.ItemPadding 默认值（活动样式未设置，旧注释版本 40 0 30 0）；
  - `CirclePointGeometry` 定义位置（SDC 全目录无定义，仅 SideMenu.xaml:43 引用——疑似外部程序集资源）；
  - SideMenuBox* 系列 Token 在样式族中的用途（样式内无引用，疑似页面级布局 Token）；
  - MaxwellFramework_SideMenuWidth/Height（85/855）SDC 内无引用，疑似废弃；
  - `02-controls/README.md` 控件→文件映射「NarrowMenuItem | SideMenu.xaml」有误（实际定义于 Menu.xaml），建议修订。
