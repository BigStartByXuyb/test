<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；三处疑似调试遗留值标 🟡；无 P2 页面使用实例); pending=[待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/ToolBar.xaml, {source_root}/ManualView.xaml] -->

# ToolBar（工具栏，框架版）

## 1. 用途

框架版工具栏全家桶：ToolBar（含拖拽把手、Header、溢出按钮 + Popup 溢出面板）、ToolBarTray 容器样式、工具栏内按钮/分隔线自动样式（`ToolBar.ButtonStyleKey` / `ToolBar.SeparatorStyleKey`）。典型场景（推断，无 P2 实例）：功能工具栏、快捷操作条——ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<ToolBar … />、<ToolBarTray … />（标准 WPF 控件；隐式默认样式自动应用）
```

样式 TargetType = `ToolBar` / `ToolBarTray`；模板资源 `ToolBarHorizontalTemplate` / `ToolBarVerticalTemplate` 按 `Orientation` 切换。溢出面板、把手、弹出层均为模板内建（`controls:SimplePanel`、`ToolBarOverflowPanel`）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 默认 SecondaryRegionBrush；**Tray 基样式为硬编码 Blue（疑似调试遗留）** | `x:Key="ToolBarBaseStyle"` Setter / `x:Key="ToolBarTrayBaseStyle"` Setter | ✅（Blue 值 🟡 [待确认 TD-xxx]） |
| Margin | Thickness | 默认 0,0,4,4 | ToolBarBaseStyle Setter | ✅ |
| Orientation | enum | Horizontal→HorizontalTemplate；Vertical→VerticalTemplate | `Trigger Property="Orientation" Value="Vertical"` | ✅ |
| Header | object | 工具栏标题；Null 时隐藏 | `Trigger Property="Header" Value="{x:Null}"` | ✅ |
| IsOverflowOpen | bool | 溢出弹出开合（Popup IsOpen 双向绑定） | 模板 `OverflowPopup IsOpen="{Binding IsOverflowOpen, …}"` + `Trigger Property="IsOverflowOpen"` | ✅ |
| HasOverflowItems | bool | 无溢出项时溢出按钮禁用（模板内 IsEnabled 绑定） | 模板 `OverflowButton IsEnabled="{TemplateBinding HasOverflowItems}"` | ✅ |
| ToolBarTray.IsLocked | bool（附加） | 锁定后隐藏拖拽把手（Thumb Collapsed） | `Trigger Property="ToolBarTray.IsLocked" Value="true"` | ✅ |
| Padding / BorderBrush / BorderThickness | Thickness/Brush/Thickness | 主面板边框/内边距透传 | 模板 `MainPanelBorder TemplateBinding` | ✅ |
| 分隔线样式（Separator） | Style（ToolBar.SeparatorStyleKey） | WarningBrush 竖线、宽 10；工具栏内 Separator 自动应用 | `x:Key="{x:Static ToolBar.SeparatorStyleKey}"` | ✅ |
| 按钮样式（Button） | Style（ToolBar.ButtonStyleKey） | 工具栏内 Button 自动应用：PrimaryTextBrush 字、BorderThickness 1、Hover→DarkDefaultBrush、Pressed→BorderBrush | `x:Key="{x:Static ToolBar.ButtonStyleKey}"`（BasedOn `ButtonBaseStyle`） | ✅ |
| 溢出面板 | ToolBarOverflowPanel | WrapWidth 200、Tab/Directional 循环导航 | 模板 `PART_ToolBarOverflowPanel` | ✅ |

## 4. 样式族表（SDC\Style\ToolBar.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| ToolBarBaseStyle | 无 | 默认 Horizontal 模板、SecondaryRegionBrush 底、Margin 0,0,4,4；Orientation=Vertical 换模板 | 工具栏默认 |
| ToolBarTrayBaseStyle | 无 | 仅设置 Background=Blue（**疑似调试遗留值**） | ToolBarTray 基样式 |
| ToolBar.ButtonStyleKey | ButtonBaseStyle | 工具栏按钮：PrimaryTextBrush、BorderThickness 1、Hover/Pressed 触发器 | 工具栏内 Button 自动应用 |
| ToolBar.SeparatorStyleKey | 无 | 分隔线：WarningBrush、Width 10 | 工具栏内 Separator 自动应用 |
| ToolBarThumbHorizontalStyle | 无（Thumb） | 拖拽把手：DragVerticalGeometry、宽 4；Hover Cursor=SizeAll | Horizontal 模板把手 |
| ToolBarThumbVerticalStyle | 无（Thumb） | 拖拽把手：**CalendarGeometry**（与水平把手不对称，疑似复制遗留）、高 4；Hover SizeAll | Vertical 模板把手 |
| ToolBarHorizontalOverflowButtonStyle / ToolBarVerticalOverflowButtonStyle | 无（ToggleButton） | 溢出按钮：DownGeometry/RightGeometry 箭头、WarningBrush→Hover/键盘焦点 PrimaryBrush、Disabled 折叠 | 模板内部溢出按钮 |
| ToolBarHorizontalTemplate / ToolBarVerticalTemplate | ControlTemplate 资源 | 完整模板：Thumb+Header+ToolBarPanel+溢出 Popup（Vertical 版 Popup 边框 RegionBrush；**Horizontal 版 Popup 为 BorderBrush=WarningBrush、Background=Red，疑似调试遗留**） | 模板切换用 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `<ToolBar>`。

```xml
<ToolBar Header="{DynamicResource …工具栏标题键}">
    <Button Content="{DynamicResource …按钮1文本键}"/>
    <Separator/>
    <Button Content="{DynamicResource …按钮2文本键}"/>
</ToolBar>
```

- 工具栏内 Button 自动套 `ToolBar.ButtonStyleKey`、Separator 自动套 `ToolBar.SeparatorStyleKey`（WPF 标准键机制 + 本文件键定义），页面不写按钮样式；
- 竖排工具栏只需 `Orientation="Vertical"`（模板触发器自动切换）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Border + StackPanel + Rectangle 分隔线拼工具栏（常规 WPF 写法）

```xml
<Border Background="…" BorderBrush="…">
    <StackPanel Orientation="Horizontal">
        <Button Content="…" Style="…"/>
        <Rectangle Width="1" Fill="…" Margin="4,0"/>
        <Button Content="…"/>
    </StackPanel>
</Border>
```

### ✅ 推荐：ToolBar + 内建样式键（模板证据构造）

```xml
<ToolBar Header="{DynamicResource …工具栏标题键}">
    <Button Content="{DynamicResource …按钮1文本键}"/>
    <Separator/>
    <Button Content="{DynamicResource …按钮2文本键}"/>
</ToolBar>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：溢出按钮 Hover/键盘焦点换色、Disabled 折叠、拖拽把手 Hover SizeAll 光标（ToolBar*OverflowButtonStyle/Thumb 模板触发器）全部丢失；
2. **② 丢失内建行为挂点**：溢出机制（HasOverflowItems→溢出按钮禁用、IsOverflowOpen Popup）、`ToolBarTray.IsLocked` 锁定隐藏把手、Header=Null 隐藏标题等模板触发器机制全部丢失；工具栏内按钮也失去 s:Action（TD-002）等协议统一挂接面；
3. **③ 无法样式族切换**：不能一键 Horizontal↔Vertical 模板切换，也不能整体换 ToolBarBaseStyle 变体；
4. **④ 绕过本地化**：手写硬编码标题与按钮文字绕过 DynamicResource 键；
5. **⑤ 脱离视觉规范**：SecondaryRegionBrush 底、分隔线 WarningBrush/宽 10、按钮 PrimaryTextBrush 规范全部散写，视觉无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/ToolBar.xaml`（锚点 `x:Key="ToolBarBaseStyle"`、`x:Key="ToolBarTrayBaseStyle"`、`x:Key="{x:Static ToolBar.ButtonStyleKey}"`、`x:Key="{x:Static ToolBar.SeparatorStyleKey}"`、`x:Key="ToolBarHorizontalTemplate"`、`Trigger Property="Orientation"`、`Trigger Property="ToolBarTray.IsLocked"`）
- 真实使用：无（ManualView.xaml 不含 ToolBar）
- 索引交叉：`{index_root}/files/refence_SDC_Style_ToolBar.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：三处疑似调试遗留值——`ToolBarTrayBaseStyle` Background=Blue、`ToolBarHorizontalTemplate` 溢出 Popup 边框 WarningBrush/背景 Red（Vertical 版为 RegionBrush/BorderBrush）、`ToolBarThumbVerticalStyle` 使用 CalendarGeometry（与水平把手 DragVerticalGeometry 不对称）（已建议编号，见 `../../05-best-practices/pending-confirmations.md`）。
- 本控件模板中无 IOEnable / PageName 协议证据（按钮动作面走 TD-002 的 s:Action）。
