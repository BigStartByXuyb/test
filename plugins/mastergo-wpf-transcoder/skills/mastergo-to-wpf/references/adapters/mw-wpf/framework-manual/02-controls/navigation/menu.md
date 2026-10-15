<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；三处疑似笔误/遗留值标 🟡；无 P2 页面使用实例); pending=[待确认 TD-xxx, TD-002];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/Menu.xaml, {source_root}/ManualView.xaml] -->

# Menu（菜单家族）

## 1. 用途

菜单全家桶：顶部主菜单（MainMenuStyle + MenuItemBaseStyle + 子菜单 SubMenuItemStyle）、窄菜单（NarrowMenuStyle + NarrowMenuItem 族）、右键上下文菜单（ContextMenu 默认样式 + ContextMenuItemStyle）。菜单项图标/文字/快捷键/勾选/子菜单箭头由三个 StyleSelector 分发。典型场景（推断，无 P2 实例）：主界面顶部功能导航、窗口右键菜单——ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<Menu Style="{StaticResource MainMenuStyle}">…</Menu>、<ContextMenu>…</ContextMenu>
```

样式 TargetType = `{x:Type Menu}` / `MenuItem` / `controls:NarrowMenuItem`（MaxwellControl.Controls 自定义控件，.cs 不可见）/ `{x:Type ContextMenu}`。选择器：`MenuItemStyleSelector`、`NarrowMenuItemStyleSelector`、`ContextMenuItemStyleSelector`（MaxwellControl.Tools）。

## 3. 关键属性表

**Menu 级（MainMenuStyle / NarrowMenuStyle）**

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background / BorderBrush | Brush | 主菜单：HeaderTextGradientBrush / BorderDefaultGradientBrush；窄菜单：ThirdlyLightGradientBrush | `x:Key="MainMenuStyle"` / `x:Key="NarrowMenuStyle"` Setter | ✅ |
| BorderThickness | Thickness | 主菜单 2 | MainMenuStyle Setter | ✅ |
| Height | double | 主菜单 HeaderMenuHeight=70；窄菜单 ButtonHeight=35 | Setter（Sizes.xaml `HeaderMenuHeight`/`ButtonHeight`） | ✅ |
| FontSize / FontWeight | double / Bold | 主菜单 SubHeaderFontSize(14)；窄菜单 HeadFontSize(16) | Setter | ✅ |
| Foreground | Brush | 主菜单 PrimaryTextBrush；**窄菜单与 Background 同为 ThirdlyLightGradientBrush（疑似笔误）** | Setter | 🟡 [待确认 TD-xxx] |
| VerticalContentAlignment | Alignment | Center | Setter | ✅ |
| ItemContainerStyle | Style | 主菜单 MenuItemBaseStyle；窄菜单 NarrowMenuItemBaseStyle | Setter | ✅ |

**MenuItem 级（MenuItemBaseStyle / SubMenuItemStyle / ContextMenuItemStyle / NarrowMenuItem 族）**

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Header | object | 菜单项文字（RecognizesAccessKey；顶栏项 TextTrimming=CharacterEllipsis） | 模板 `ContentSource="Header"` | ✅ |
| HeaderTemplate / HeaderStringFormat | DataTemplate / string | 头部模板与格式透传 | 模板 TemplateBinding | ✅ |
| Icon | object | 图标：子菜单 16×16、顶栏 HeaderMenuIconWidth/Height(23)；Null 时隐藏 | `Trigger Property="Icon" Value="{x:Null}"` | ✅ |
| InputGestureText | string | 快捷键提示文字（Opacity 0.7） | 模板 `menuGestureText Text="{TemplateBinding InputGestureText}"` | ✅ |
| IsChecked | bool | 勾选态：Glyph 面板可见、图标隐藏 | `Trigger Property="IsChecked"` | ✅ |
| IsHighlighted | bool | 悬停高亮（主菜单 PrimaryDeepToolBrush 等） | `Trigger Property="IsHighlighted"` + MultiTrigger | ✅ |
| IsSubmenuOpen | bool | 子菜单弹出状态（Popup IsOpen 绑定） | 模板 `PART_Popup IsOpen="{Binding IsSubmenuOpen, …}"` + Trigger | ✅ |
| HasItems | bool | 有子项时显示右/下箭头 | `Trigger Property="HasItems"` | ✅ |
| IsSelected | bool（Narrow 族） | 选中态：PrimaryBrush 底、去边框、PrimaryDefaultBrush 字 | `Trigger Property="IsSelected"`（NarrowMenuItemStyle/NarrowMenuItemBaseStyle） | ✅ |
| IsPressed | bool | 按下态画刷组 | `MultiTrigger Condition Property="IsPressed"` | ✅ |
| ItemContainerStyleSelector | StyleSelector | 递归子项样式分发；**选取规则 .cs 不可见** | Setter（MenuItem/Narrow/Context 三 selector） | 🟡 [待确认 TD-xxx] |

## 4. 样式族表（SDC\Style\Menu.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| MainMenuStyle | BaseStyle | 主菜单：70 高（HeaderMenuHeight）、HeaderTextGradientBrush 底、BorderThickness 2、粗体 14；子项 MenuItemBaseStyle | 顶部主菜单栏 |
| MenuItemBaseStyle | BaseStyle | 顶栏菜单项：100×70（HeaderMenuWidth/Height）、图标上文字下（图标 23×23）、Popup 向下、右下三角箭头；Hover/SubmenuOpen/Pressed 触发器 | 主菜单一级项 |
| SubMenuItemStyle | BaseStyle | 子菜单项：150×50、图标 16×16 + 勾选 Glyph（30×30）+ 快捷键列 + 右箭头、DropShadowEffect 弹出面板、禁用 DisableTextBrush | 子菜单/下拉项 |
| NarrowMenuStyle | BaseStyle | 窄菜单：35 高（ButtonHeight）、HeadFontSize(16)、ThirdlyLightGradientBrush 底、**Foreground 与 Background 同值（疑似笔误）**；子项 NarrowMenuItemBaseStyle | 窄版主菜单 |
| NarrowMenuItemBaseStyle | BaseStyle | 窄菜单项：100×35（ButtonWidth/Height）、ThirdlyLightGradientBrush 底、图标上文字下、IsSelected/Hover/Pressed 触发器 | 窄菜单一级项 |
| NarrowMenuItemStyle | BaseStyle | 窄子菜单项：150×50、IsSelected 选中态（PrimaryBrush 底） | 窄菜单子项 |
| （ContextMenu 隐式默认样式） | BaseStyle | 右键菜单：Border+ItemsPresenter 模板、子项 ContextMenuItemStyle、selector MenuItemStyleSelector | ContextMenu 全局兜底 |
| ContextMenuItemStyle | BaseStyle | 右键子项：auto×45、PrimaryDefaultBrush 底、底部分隔线（DisableTextBrush 0 0 1 0）、Hover 双色边框、按下 PrimarySecondGradientBrush | 右键菜单项 |

弹出层共性：`PART_Popup`（MenuPopupAnimationKey）、DropShadowEffect（TextColor 阴影）、ScrollViewer 子菜单滚动。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `<Menu>`/`<MenuItem>`/`<ContextMenu>`。

```xml
<Menu Style="{StaticResource MainMenuStyle}">
    <MenuItem Header="{DynamicResource …一级菜单文本键}">
        <MenuItem Header="{DynamicResource …子项文本键}"
                  Icon="{StaticResource …Geometry键}"
                  Click="{s:Action …}" />
    </MenuItem>
</Menu>
```

- 一级项与子项样式由样式族（ItemContainerStyle/ItemContainerStyleSelector）自动递归分发，页面不写项样式；
- 子项动作接 `s:Action`（TD-002，协议写法见 03-protocols/action-protocol.md）；Header 文本一律 DynamicResource 键（总则 4）。

## 6. 禁止写法对照

### ❌ 禁止：手写 StackPanel + Button + Popup 拼菜单（常规 WPF 写法）

```xml
<StackPanel Orientation="Horizontal">
    <Button Content="…" Click="…" />
    <Popup IsOpen="…" Placement="Bottom">
        <Border Background="…">
            <StackPanel>
                <Button Content="…" Click="…"/>
            </StackPanel>
        </Border>
    </Popup>
</StackPanel>
```

### ✅ 推荐：Menu + MenuItem 树（模板证据构造）

```xml
<Menu Style="{StaticResource MainMenuStyle}">
    <MenuItem Header="{DynamicResource …一级菜单文本键}">
        <MenuItem Header="{DynamicResource …子项文本键}" Click="{s:Action …}"/>
    </MenuItem>
</Menu>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 IsHighlighted/IsPressed/IsChecked/IsSubmenuOpen/IsEnabled 触发器组、勾选 Glyph、禁用 DisableTextBrush（SubMenuItemStyle/MenuItemBaseStyle ControlTemplate.Triggers）；
2. **② 丢失协议挂点**：菜单项脱离框架项容器后无法统一挂接 `s:Action`（TD-002）等协议，菜单→动作链路断裂；
3. **③ 无法样式族切换**：MainMenuStyle↔NarrowMenuStyle↔ContextMenu 三套形态无法一键切换，Popup 弹出方向（Bottom/Right）与阴影规范需手工重写；
4. **④ 绕过本地化**：硬编码菜单文案绕过 DynamicResource 文本键体系；
5. **⑤ 脱离视觉规范**：HeaderMenuHeight=70、子项 150×50、右键项 45 行高、图标 16/23 尺寸规范全部失控，视觉无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Menu.xaml`（锚点 `x:Key="MainMenuStyle"`、`x:Key="MenuItemBaseStyle"`、`x:Key="SubMenuItemStyle"`、`x:Key="NarrowMenuStyle"`、`x:Key="NarrowMenuItemBaseStyle"`、`x:Key="NarrowMenuItemStyle"`、`x:Key="ContextMenuItemStyle"`、ContextMenu 隐式默认样式、`MenuItemStyleSelector`/`NarrowMenuItemStyleSelector`/`ContextMenuItemStyleSelector`）
- 尺寸键：`{source_root}/SDC/Sizes.xaml`（`HeaderMenuWidth/HeaderMenuHeight=100/70`、`HeaderMenuIconWidth/HeaderMenuIconHeight=23`、`ButtonWidth/ButtonHeight=100/35`）
- 真实使用：无（ManualView.xaml 不含 Menu 家族）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Menu.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：三个 StyleSelector（MenuItem/NarrowMenuItem/ContextMenuItem）的选取规则——selector 存在性与挂载已确认，判定逻辑 .cs 不可见（已建议编号，见 `../../05-best-practices/pending-confirmations.md`）。
- [待确认 TD-xxx]：`NarrowMenuStyle` Foreground 与 Background 同为 `ThirdlyLightGradientBrush`（疑似笔误）——窄菜单文字颜色真实意图待框架作者确认（已建议编号）。
- 关联 TD-002：子菜单项动作统一走 `{s:Action Name}`（调用形式见 ManualView.xaml，解析机制待回填）。
- 本控件模板中无 IOEnable / PageName 协议证据。
