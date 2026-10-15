<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；项样式族证据在 Button.xaml；无 P2 页面使用实例); pending=[待确认 TD-xxx, TD-006];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/ButtonGroup.xaml, {source_root}/ManualView.xaml] -->

# ButtonGroup（按钮组）

## 1. 用途

一组相邻按钮拼成整体：`UniformGrid` 均分布局 + 首尾项自动圆角（`ButtonGroupItemStyleSelector` 分发），`Orientation` 一键横/纵切换，整组禁用时半透明（0.5）。典型场景（推断，无 P2 实例）：分步操作区、模式切换段——ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:ButtonGroup … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:ButtonGroup`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。行为面证据（ItemsPanel/ItemContainerStyleSelector/Orientation）全部来自 `ButtonGroupBaseStyle` 与 `ButtonGroupItemStyleSelector`（MaxwellControl.Tools）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| ItemsPanel | ItemsPanelTemplate | 默认水平均分面板（UniformGrid Rows=1，FocusVisualStyle=Null） | `x:Key="ButtonGroupHorizontalItemsPanelTemplate"` + Setter | ✅ |
| Orientation | Orientation（Horizontal/Vertical） | Vertical 时切换为纵向均分面板（UniformGrid Columns=1） | `Trigger Property="Orientation" Value="Vertical"` → ItemsPanel Setter | ✅ |
| ItemContainerStyleSelector | StyleSelector | `ButtonGroupItemStyleSelector` 自动为子项选 ButtonGroupItem* 变体（首/尾/中/单）；**选取规则 .cs 不可见** | `ButtonGroupItemStyleSelector` Setter | 🟡 [待确认 TD-xxx] |
| Padding | Thickness | 默认 5 | ButtonGroupBaseStyle Setter | ✅ |
| Background | Brush | 默认 Transparent | ButtonGroupBaseStyle Setter | ✅ |
| IsEnabled | bool | False 时整组 Opacity 0.5 | `Trigger Property="IsEnabled" Value="False"` | ✅ |
| Focusable / FocusVisualStyle | bool / Style | False / `{x:Null}` | ButtonGroupBaseStyle Setter | ✅ |
| VerticalAlignment | Alignment | 默认 Top | ButtonGroupBaseStyle Setter | ✅ |
| Width | double | 默认 auto | ButtonGroupBaseStyle Setter | ✅ |
| 组内子项属性（继承自 ButtonGroupItemBaseStyle，Button.xaml） | — | 高 ButtonGroupHeight(40)、Padding 10,0、Margin -1,0,0,0、FontSize SubHeaderFontSize(14)、Bold；Hover 时 ZIndex 置顶 | `x:Key="ButtonGroupItemBaseStyle"` + `controls:BorderElement.CornerRadius` Setter | ✅（附加属性语义见 TD-006） |

## 4. 样式族表

**组容器样式（SDC\Style\ButtonGroup.xaml）**

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| ButtonGroupBaseStyle | 无 | 行为集：水平 UniformGrid、Padding 5、透明底、整组禁用 0.5 透明度、Focusable=False | 基样式，不直接用 |
| （隐式默认样式） | ButtonGroupBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |

**组内子项样式族（SDC\Style\Button.xaml，供 selector 分发）**

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| ButtonGroupItemBaseStyle | BaseStyle | 项基样式：ThirdlyLightGradientBrush 底、PrimaryBorderBrush 边、高 40、Padding 10,0、Hover/Pressed/Disabled 触发器 + Content=Null 折叠 | 项基类 |
| ButtonGroupItemDefault | ButtonGroupItemBaseStyle | 直角（CornerRadius 0） | 组中间项 |
| ButtonGroupItemHorizontalFirst | ButtonGroupItemBaseStyle | 左半圆角 `3,0,0,3`、Margin 0 | 横向组首项 |
| ButtonGroupItemHorizontalLast | ButtonGroupItemBaseStyle | 右半圆角 `0,3,3,0` | 横向组尾项 |
| ButtonGroupItemSingle | ButtonGroupItemBaseStyle | 全圆角 3 | 单项组 |
| ButtonGroupItemVerticalFirst | ButtonGroupItemBaseStyle | 上半圆角 `3,3,0,0`、Margin 0 | 纵向组首项 |
| ButtonGroupItemVerticalLast | ButtonGroupItemBaseStyle | 下半圆角 `0,0,3,3` | 纵向组尾项 |

关联：`ToggleButton.xaml` 存在同构的 `ToggleButtonGroupItemBaseStyle` 及其 6 个变体（ToggleButton 组）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `s:ButtonGroup`。

```xml
<s:ButtonGroup Orientation="Horizontal">
    <Button Content="{DynamicResource …项1文本键}"/>
    <Button Content="{DynamicResource …项2文本键}"/>
    <Button Content="{DynamicResource …项3文本键}"/>
</s:ButtonGroup>
```

- **项类型 = 普通 `Button`，不是 IconButton**：项样式族 `ButtonGroupItem*` 全部 `TargetType="Button"`（`{source_root}/SDC/Style/Button.xaml` 的 `ButtonGroupItemBaseStyle` 及 6 变体）——组内放 `<Button>` 即可；
- 子项圆角（首/尾/单）由 `ButtonGroupItemStyleSelector` 自动分配，页面**不**手写项样式；
- 换纵向只需 `Orientation="Vertical"`（ItemsPanel 触发器自动切换为 Columns=1）；
- 若需开关型按钮组，`ToggleButton.xaml` 有同构的 `ToggleButtonGroupItemBaseStyle` 及 6 变体（TargetType 为 ToggleButton）。

## 6. 禁止写法对照

### ❌ 禁止：手写 StackPanel + 手动首尾圆角 + 边框重叠处理（常规 WPF 写法）

```xml
<StackPanel Orientation="Horizontal">
    <Button Style="{StaticResource …}" CornerRadius="3,0,0,3" Margin="0">项1</Button>
    <Button CornerRadius="0">项2</Button>
    <Button CornerRadius="0,3,3,0">项3</Button>
</StackPanel>
```

### ✅ 推荐：ButtonGroup 一行声明（模板证据构造）

```xml
<s:ButtonGroup Orientation="Horizontal">
    <Button Content="{DynamicResource …项1文本键}"/>
    <Button Content="{DynamicResource …项2文本键}"/>
    <Button Content="{DynamicResource …项3文本键}"/>
</s:ButtonGroup>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有组级禁用弱化（IsEnabled=False→Opacity 0.5）、Hover 时 `Panel.ZIndex` 置顶、Pressed 组（ThirdlyDeepGradientBrush/白字）触发器（ButtonGroupItemBaseStyle Style.Triggers）；
2. **② 丢失协议挂点**：子项脱离框架项容器后无法统一挂接 IOEnable/s:Action（TD-001/TD-002）等协议，设备联锁与动作绑定无从谈起；
3. **③ 无法样式族切换**：横↔纵（Orientation 触发器）、首/尾/单圆角变体需手工逐项改，不能一键切换 ButtonGroupItem* 族；
4. **④ 绕过本地化**：硬编码「项1/项2/项3」绕过 DynamicResource 文本键体系；
5. **⑤ 脱离视觉规范**：-1 边距叠压拼缝、ButtonGroupHeight=40、圆角 3 等规范全部手工重写，视觉无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/ButtonGroup.xaml`（锚点 `x:Key="ButtonGroupBaseStyle"`、`x:Key="ButtonGroupHorizontalItemsPanelTemplate"`、`x:Key="ButtonGroupVerticalItemsPanelTemplate"`、`ButtonGroupItemStyleSelector`、`Trigger Property="Orientation"`、`Trigger Property="IsEnabled"`）
- 项样式族：`{source_root}/SDC/Style/Button.xaml`（`x:Key="ButtonGroupItemBaseStyle"` 及 6 变体）；`{source_root}/SDC/Sizes.xaml` `ButtonGroupHeight=40`
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_ButtonGroup.xaml.json`、`{index_root}/files/refence_SDC_Style_Button.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：`ButtonGroupItemStyleSelector` 的选取规则（按位置/方向如何映射到 6 个 ButtonGroupItem* 变体）——selector 存在性与属性挂载已确认，判定逻辑 .cs 不可见（已建议编号，见 `../../05-best-practices/pending-confirmations.md`）。
- 关联 TD-006：项样式中的 `controls:BorderElement.CornerRadius` 附加属性语义（模板绑定证据可见，.cs 定义不可见）。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据。
