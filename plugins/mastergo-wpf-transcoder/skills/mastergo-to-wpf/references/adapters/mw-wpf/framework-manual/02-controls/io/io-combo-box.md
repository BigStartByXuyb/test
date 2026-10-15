<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-001,TD-006];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOComboBox.xaml, {source_root}/ManualView.xaml] -->

# IOComboBox（IO 下拉框）

## 1. 用途

原生 ComboBox 的框架封装：**右 30px 箭头区 + 下拉 Popup（圆角 3）**，内建框体 Hover/打开（IsOpen）/Disabled 三态、下拉项三态（Hover 带 1px 描边切换）、空列表 95 高度、下拉等宽（`DropDownElement.ConsistentWidth`）、`IsEditable=true` 一键切换可编辑双模板（含 `PART_EditableTextBox`）。

典型场景（推断，无 P2 实例）：选择/输入型参数配置——ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:IOComboBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOComboBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。`IsEditable` 属性驱动模板切换（`IOComboBoxTemplate` ⇄ `IOComboBoxEditableTemplate`）。注意与原生框架版区分：`SDC/Style/ComboBox.xaml` 为非 IO 版（`ComboBoxBaseStyle` 及 `MultiComboBox`/`SingleComboBox` 家族）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| IsEditable | bool | true → 切 `IOComboBoxEditableTemplate` + `EditableComboBox_*` 画刷族 + IsTabStop=false + 输入框 | `x:Key="IOComboBoxBaseStyle"` Style.Triggers `Trigger Property="IsEditable"` | ✅ |
| Height / Width | double | 基样式默认 `ComboBoxHeight`=35 / `ComboBoxWidth`=100 | IOComboBoxBaseStyle Setter + {source_root}/SDC/Sizes.xaml | ✅ |
| Padding / Margin | Thickness | 10,0 / 5 | IOComboBoxBaseStyle Setter | ✅ |
| FontSize | double | `SubHeaderFontSize`=14 | IOComboBoxBaseStyle Setter + {source_root}/SDC/Fonts.xaml | ✅ |
| Background / BorderBrush / Foreground | Brush | `ComboBox_DefaultBackBrush` / `ComboBox_DefaultBorderBrush` / `ComboBox_DefaultTextBrush` | IOComboBoxBaseStyle Setter | ✅ |
| ItemContainerStyle | Style | `IOComboBoxItemBaseStyle`（项高 `ComboBoxItemHeight`=35、Padding 15,0） | IOComboBoxBaseStyle Setter + Sizes.xaml | ✅ |
| 框体 Hover 态 | Brush | toggleButton hover → `ComboBox_HoverBorderBrush/HoverBackBrush` + `ComboBox_HoverTextBrush` | `x:Key="IOComboBoxTemplate"` MultiTrigger（SourceName="toggleButton"） | ✅ |
| 框体打开态 | Brush | `PART_Popup IsOpen` → `ComboBox_SelectBorderBrush/SelectBackBrush` + `ComboBox_SelectTextBrush`；箭头翻转（Data M0,8 L6,0 12,8 z） | IOComboBoxTemplate `Trigger Property="IsOpen" SourceName="PART_Popup"` + `x:Key="IOComboBoxToggleButton"` `Trigger Property="IsChecked"` | ✅ |
| 框体禁用态 | Brush | IsEnabled=false → Background=`BackgroundBrush` | IOComboBoxTemplate `Trigger Property="IsEnabled"` | ✅ |
| 可编辑框悬停/聚焦 | Brush | PART_EditableTextBox hover/聚焦 → `EditableComboBox_HoverBorderBrush/HoverBackBrush`；聚焦 → `EditableComboBox_SelectCaretBrush/SelectTextBrush` | `x:Key="IOComboBoxEditableTemplate"` Trigger SourceName="PART_EditableTextBox" / "toggleButton" / `Trigger Property="IsFocused"` | ✅ |
| 可编辑框禁用态 | Brush | → Background=`BackgroundBrush` + Foreground=`DisableTextBrush` | IOComboBoxEditableTemplate `Trigger Property="IsEnabled"` | ✅ |
| 项三态（下拉） | Brush / Thickness | 项 hover（未选中）→ `ComboBoxItem_HoverBackBrush/HoverBorderBrush/HoverTextBrush` + BorderThickness 1；项选中 → `ComboBoxItem_SelectBackBrush/SelectTextBrush`（渐变） | `x:Key="IOComboBoxItemBaseStyle"` MultiTrigger | ✅ |
| 项禁用态 | double | IsEnabled=False → Opacity 0.5 | IOComboBoxItemBaseStyle `Trigger Property="IsEnabled"` | ✅ |
| MaxDropDownHeight | double | 下拉 Popup MaxHeight | IOComboBoxTemplate `dropDownBorder MaxHeight="{TemplateBinding MaxDropDownHeight}"` | ✅ |
| DropDownElement.ConsistentWidth | bool | true → 下拉宽 = 框宽（toggleButton ActualWidth 作 Min/MaxWidth） | IOComboBoxTemplate / IOComboBoxEditableTemplate `Trigger Property="controls:DropDownElement.ConsistentWidth"` | ✅ |
| SelectionBoxItem 族 | object / DataTemplate | 选中内容呈现（`SelectionBoxItem` + `SelectionBoxItemTemplate` + `SelectionBoxItemStringFormat`） | IOComboBoxTemplate `contentPresenter` | ✅ |
| HasItems | bool | false → 下拉高度 95 | IOComboBoxTemplate / Editable `Trigger Property="HasItems"` | ✅ |
| IOEnable | string/bool | 设备条件协议（IO 系列共同挂点）；本模板无直接引用 | ManualView.xaml 15 处（IconButton）+ TD-001 | 🟡 [待确认 TD-001] |

模板命名部件（P1 锚点）：`PART_Popup`、`PART_EditableTextBox`；`toggleButton`（ToggleButton）、`DropDownScrollViewer`、`dropDownBorder`、`arrow`。

## 4. 样式族表（SDC\Style\IOComboBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IOEditableComboBoxToggleButton | 无（独立） | ToggleButton：右 30px 图标区分隔（`EditableComboBox_DefaultIconBackBrush/DefaultIconBorderBrush`）、箭头 IsChecked 翻转（SelectTriangle）、Disabled 0.4 | 可编辑模式箭头（模板内部件样式） |
| IOComboBoxToggleButton | 无（独立） | ToggleButton：右 30px 透明图标区、`ComboBox_Default/Hover/SelectTriangleBrush` 三态、Disabled 0.4 | 选择模式箭头（模板内部件样式） |
| IOComboBoxEditableTextBox | 无（独立） | TextBox：无边框、`PART_ContentHost` ScrollViewer（滚动条隐藏）、Padding 8,0 | 可编辑模式输入框（模板内部件样式） |
| IOComboBoxItemBaseStyle | 无（独立） | 下拉项：高 35、Padding 15,0、Bd Tag=0 标记、三态画刷（Hover 1px 描边/Select 渐变） | 下拉项 |
| IOComboBoxBaseStyle | 无（独立） | 全部默认属性 + `IOComboBoxTemplate`；IsEditable 自动切可编辑模板与画刷族 | 基样式，不直接用 |
| （无键默认样式） | IOComboBoxBaseStyle | TargetType 隐式默认样式，全局兜底 | 未显式指定 Style 时 |

配套画刷：`{source_root}/SDC/Brushes/ComboBoxBrushes.xaml`（`EditableComboBox_Default*/Hover*/Select*`；`ComboBoxItem_Default*/Hover*/Select*`；`ComboBox_Default*/Hover*/Select*/Disabled*`）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `s:IOComboBox`。

```xml
<s:IOComboBox ItemsSource="{Binding …选项集合}"
              SelectedItem="{Binding …}"
              SelectedValuePath="…" />
```

```xml
<s:IOComboBox IsEditable="True"
              Text="{Binding …输入值}"
              ItemsSource="{Binding …}" />
```

- 选择型与可编辑型是同一控件的两个属性状态：`IsEditable="True"` 即切换模板与画刷族（EditableComboBox_*），无需换控件；
- 下拉项行高 35、框体 35×100 默认由 Token 决定，页面可覆盖 Width/Height。

## 6. 禁止写法对照

### ❌ 禁止：手写 ToggleButton + Popup + TextBox 拼装等效下拉（常规 WPF 写法）

```xml
<Grid Width="100" Height="35">
    <ToggleButton x:Name="btn" Click="btn_Click">
        <Path Data="M0,0 L6,8 12,0 z" Fill="…" Width="12" Height="8" HorizontalAlignment="Right"/>
    </ToggleButton>
    <Popup PlacementTarget="{Binding ElementName=btn}" IsOpen="{Binding IsChecked, ElementName=btn}">
        <Border CornerRadius="3">
            <ListBox x:Name="lst">
                <!-- 手写 ListBoxItem 样式与选中联动… -->
            </ListBox>
        </Border>
    </Popup>
</Grid>
```

### ✅ 推荐：IOComboBox 属性化

```xml
<s:IOComboBox ItemsSource="{Binding …}" SelectedItem="{Binding …}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有框体 Hover/IsOpen/Disabled、项三态（Hover 1px 描边 + Select 渐变 `ComboBoxItem_SelectBackBrush`）、箭头三态翻转触发器组；
2. **⑤ 脱离视觉规范**：高 35/宽 100/项高 35 Token（ComboBoxHeight/Width/ItemHeight）、圆角 3、Padding 10,0、Margin 5、空列表 95 高度等规范散写失控；
3. **③ 无法样式族切换**：`IsEditable` 双模板与双画刷族（EditableComboBox_*/ComboBox_*）一键切换机制、`DropDownElement.ConsistentWidth` 等宽协议无法复刻；
4. **② 丢失协议挂点**：IOEnable 设备联锁挂点无从谈起。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOComboBox.xaml`（锚点 `x:Key="IOComboBoxBaseStyle"`、`x:Key="IOComboBoxTemplate"`、`x:Key="IOComboBoxEditableTemplate"`、`x:Key="IOComboBoxItemBaseStyle"`、`x:Key="IOComboBoxToggleButton"`、`x:Key="IOEditableComboBoxToggleButton"`、`x:Key="IOComboBoxEditableTextBox"`、`Trigger Property="IsOpen" SourceName="PART_Popup"`、`Trigger Property="controls:DropDownElement.ConsistentWidth"`）
- 画刷：`{source_root}/SDC/Brushes/ComboBoxBrushes.xaml`；尺寸：`{source_root}/SDC/Sizes.xaml`（ComboBoxHeight/Width/ItemHeight）；字号：`{source_root}/SDC/Fonts.xaml`（SubHeaderFontSize）
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：非 IO 版 `{source_root}/SDC/Style/ComboBox.xaml`（`x:Key="ComboBoxBaseStyle"`、`Style TargetType="controls:SingleComboBox"`、`MultiComboBox`）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOComboBox.xaml.json`、`{index_root}/files/refence_SDC_Brushes_ComboBoxBrushes.xaml.json`

## 8. 待确认项

- TD-001（IOEnable 表达式语义——IO 系列共同协议，本模板无直接引用，属系列推断）
- TD-006（`DropDownElement` 附加属性族）
- [待确认 TD-xxx]：`ComboBox_DisabledBackBrush` 定义于 ComboBoxBrushes.xaml 但 IOComboBox 模板禁用态实际用 `BackgroundBrush`（画刷零引用，疑似遗留，与 TD-019 同模式）——建议登记新 TD
