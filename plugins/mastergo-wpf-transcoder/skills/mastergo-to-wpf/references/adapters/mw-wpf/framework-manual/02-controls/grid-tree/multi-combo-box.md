<!-- evidence=部分确认(模板/部件均为 P1 直接证据；ItemsSourceSearch/全选/搜索机制与 SingleComboBox 行为待确认); pending=[TD-044,TD-006];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/ComboBox.xaml, {source_root}/ManualView.xaml] -->

# MultiComboBox / SingleComboBox（多选下拉框与搜索下拉框）

## 1. 用途

`SDC/Style/ComboBox.xaml` 内两个框架专用下拉控件：

- **MultiComboBox**：多选下拉框——下拉内建**搜索框（`PART_SearchTextBox`，带水印）+ 全选复选（`PART_SelectAllBox`）+ 双 ListBox 列表（全量 `PART_ListBox`/搜索结果 `PART_ListBoxSearch`，项为 CheckBox 勾选式 `CheckItemStyle`）**；框体显示 `Text`，`IsEditable` 切换输入型双模板（`MultiComboBoxTemplate`⇄`MultiComboBoxEditableTemplate`）；
- **SingleComboBox**：搜索型单值下拉——极简模板（搜索 `TextBox` + 空 `PopupEx`），行为面待确认（TD-044）。

注意与 IO 版区分：`IOComboBox`（IOComboBox.xaml）为 IO 系列，键名边界见下节；`IOComboBox` 条目见 [io-combo-box](../io/io-combo-box.md)，本条目不重复覆盖。

## 2. 声明

```xml
<s:MultiComboBox … />，s = http://www.maxwell-gp.com/
<s:SingleComboBox … />
```

TargetType = `controls:MultiComboBox` / `controls:SingleComboBox`（MaxwellControl.Controls，私有程序集）。`MultiComboBox` 有具名样式 `DefaultMultiComboBox` + 隐式默认；`SingleComboBox` **仅隐式默认（无命名键）**。合并字典仅 BaseStyle.xaml。

## 3. 关键属性表

### MultiComboBox

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| ItemsSource | IEnumerable | 全量列表；模板内经 TemplatedParent 透传给 `PART_ListBox` | `x:Key="MultiComboBoxTemplate"` `PART_ListBox ItemsSource="{Binding ItemsSource, RelativeSource={RelativeSource TemplatedParent}}"` | ✅ |
| ItemsSourceSearch | IEnumerable | 搜索结果列表；透传给 `PART_ListBoxSearch`（默认 Visibility=Collapsed，搜索时切换） | `PART_ListBoxSearch ItemsSource="{Binding ItemsSourceSearch, …}"` | 🟡 [待确认 TD-044] |
| Text | string | 框体显示文本（`PART_EditableTextBox` 双向/`contentPresenter` Content 绑定） | MultiComboBoxTemplate contentPresenter `Content="{TemplateBinding Text}"` + MultiComboBoxEditableTemplate `Text="{TemplateBinding Text}"` | ✅ |
| DisplayMemberPath / ItemTemplate | string / DataTemplate | 透传给两个 ListBox | 两模板 ListBox 绑定 | ✅ |
| MaxDropDownHeight | double | 默认 400；SimplePanel/ListBox 高度约束 | `x:Key="DefaultMultiComboBox"` Setter（Value=400） | ✅ |
| IsEditable | bool | true → 切 `MultiComboBoxEditableTemplate`（+`PART_EditableTextBox`，EditableComboBox_* 画刷族） | DefaultMultiComboBox Style.Triggers `Trigger Property="IsEditable"` | ✅ |
| Height / Width | double | `ComboBoxHeight`=35 / `ComboBoxWidth`=100 | DefaultMultiComboBox Setter + {source_root}/SDC/Sizes.xaml:46-47 | ✅ |
| Padding | Thickness | 5,0 | DefaultMultiComboBox Setter | ✅ |
| WatermarkElement.Watermark（搜索框） | string | `PART_SearchTextBox` 水印 = `LoggerViewInputQueryKeyword` 文本键（跨业务引用） | MultiComboBoxTemplate/Editable `PART_SearchTextBox` | ✅（语义 TD-006） |
| DropDownElement.ConsistentWidth | bool | true → 下拉宽=框宽（toggleButton ActualWidth 作 Min/MaxWidth） | 两模板 Trigger | ✅ |
| 框体三态 | Brush | Hover → `ComboBox_Hover*`；IsOpen → `ComboBox_Select*`；Disabled → `BackgroundBrush` | MultiComboBoxTemplate 触发器 | ✅ |
| 项勾选样式 | Style | `CheckItemStyle`（ListBoxItem 模板内 CheckBox `IsChecked="{Binding IsSelected, …Mode=TwoWay}"`，项高 `ComboBoxItemHeight`=35，分隔线 0,0,0,1） | `x:Key="CheckItemStyle"` + Sizes.xaml:49 | ✅ |
| 全选框 | CheckBox | `PART_SelectAllBox`，Content="All"（硬编码英文）、Focusable=False——选中联动 .cs 面 | MultiComboBoxTemplate | 🟡 [待确认 TD-044] |

### SingleComboBox

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Text | string | 模板内 `Part_SearchTextBox` 绑定 `Text` | 隐式样式 ControlTemplate | ✅ |
| Part_SearchTextBox / Part_Popup | TextBox / PopupEx | 模板仅两部件：搜索输入框 + **空 PopupEx**（无内容声明）——弹层内容与选择行为在 .cs 面 | 隐式 `Style TargetType="{x:Type controls:SingleComboBox}"` | ❓ [待确认 TD-044] |

## 4. 样式族表（ComboBox.xaml 家族键归属矩阵）

| 样式键 | TargetType | 归属 |
|---|---|---|
| ComboBoxBaseStyle / ComboBoxTemplate / ComboBoxEditableTemplate / ComboBoxToggleButton / EditableComboBoxToggleButton / ComboBoxEditableTextBox / ComboBoxItemBaseStyle / SDCComboBoxToggleButton / SDCComboBoxTemplate / SDCComboBoxBaseStyle | ComboBox 系 | **原生 ComboBox**（`SDCComboBox*` 为"SDC 下拉框"变体；`ComboBoxItemBaseStyle`/`ComboBoxEditableTemplate` 同时被 DataGrid.xaml 的列内编辑引用——跨文件共享） |
| DefaultMultiComboBox / MultiComboBoxTemplate / MultiComboBoxEditableTemplate / CheckItemStyle | MultiComboBox | **MultiComboBox** |
| （隐式默认，无命名键） | SingleComboBox | **SingleComboBox**（极简模板） |

边界结论（与 IOComboBox 不串）：`ComboBox.xaml` 的键全部归属框架原生 ComboBox/MultiComboBox/SingleComboBox 三型；`IOComboBox.xaml` 自成一套 `IOComboBoxBaseStyle/IOComboBoxTemplate/IOComboBoxEditableTemplate/IOComboBoxItemBaseStyle/IOComboBoxToggleButton/IOEditableComboBoxToggleButton/IOComboBoxEditableTextBox`，两文件**无同名键冲突**；`ComboBoxItemBaseStyle` 为 ComboBox.xaml 独有但被 IO 版（ItemContainerStyle）与 DataGrid 版（DataGridComboBoxStyle）跨文件引用（见 [io-data-grid](../io/io-data-grid.md)、[data-grid](data-grid.md)）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 均未出现 `s:MultiComboBox`/`s:SingleComboBox`。

```xml
<s:MultiComboBox ItemsSource="{Binding …选项集合}"
                 ItemsSourceSearch="{Binding …搜索结果}"
                 DisplayMemberPath="…"
                 Text="{Binding …已选文本}"/>
```

```xml
<s:SingleComboBox Text="{Binding …搜索关键词}"/>
```

- 多选下拉 = 搜索框 + 全选 + 勾选列表一体，页面只绑 `ItemsSource`/`ItemsSourceSearch`/`DisplayMemberPath`；
- 输入型与选择型是同一控件两个属性状态（`IsEditable="True"` 切双模板 + EditableComboBox_* 画刷族），无需换控件；
- SingleComboBox 交互（弹层内容）依赖 .cs，登记 TD-044 前仅可作搜索框使用。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBox + Popup + ListBox（CheckBox 项）拼装等效多选下拉（常规 WPF 写法）

```xml
<Grid Width="100" Height="35">
    <TextBox x:Name="search" Watermark="搜索…"/>
    <Popup PlacementTarget="{Binding ElementName=search}" IsOpen="{Binding …}">
        <StackPanel>
            <CheckBox Content="All" IsChecked="{Binding …全选}"/>
            <ListBox x:Name="lst" SelectionMode="Multiple">
                <ListBox.ItemTemplate>
                    <DataTemplate>
                        <CheckBox IsChecked="{Binding IsSelected, RelativeSource={RelativeSource AncestorType=ListBoxItem}}"
                                  Content="{Binding …}"/>
                    </DataTemplate>
                </ListBox.ItemTemplate>
            </ListBox>
        </StackPanel>
    </Popup>
</Grid>
```

### ✅ 推荐：MultiComboBox 属性化

```xml
<s:MultiComboBox ItemsSource="{Binding …}" Text="{Binding …}"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有框体三态（Hover/IsOpen/Disabled 画刷族）、项勾选模板（CheckItemStyle 分隔线 + ComboBoxItemHeight 项高）、搜索切换双 ListBox 的显隐联动；
2. **② 丢失协议挂点**：`ItemsSourceSearch` 搜索结果协议、`DropDownElement.ConsistentWidth` 等宽、`WatermarkElement.Watermark` 水印附加属性协议全无；
3. **③ 无法样式族切换**：`IsEditable` 双模板（MultiComboBoxTemplate⇄MultiComboBoxEditableTemplate）与双画刷族切换机制无法复刻，单/多选也换不了控件；
4. **④ 绕过本地化**：手写"搜索…"硬编码绕过 `LoggerViewInputQueryKeyword` 文本键体系。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/ComboBox.xaml`（锚点 `x:Key="DefaultMultiComboBox"`、`x:Key="MultiComboBoxTemplate"`、`x:Key="MultiComboBoxEditableTemplate"`、`x:Key="CheckItemStyle"`、隐式 `Style TargetType="{x:Type controls:SingleComboBox}"`、`x:Key="ComboBoxBaseStyle"`、`x:Key="ComboBoxItemBaseStyle"`、`PART_SearchTextBox`、`PART_SelectAllBox`、`PART_ListBox`、`PART_ListBoxSearch`、`PART_EditableTextBox`、`PART_ToggleButton`、`Trigger Property="controls:DropDownElement.ConsistentWidth"`）
- 画刷：`{source_root}/SDC/Brushes/ComboBoxBrushes.xaml`；尺寸：`{source_root}/SDC/Sizes.xaml`（ComboBoxWidth:46/ComboBoxHeight:47/ComboBoxItemHeight:49）；字号：`{source_root}/SDC/Fonts.xaml`（SubHeaderFontSize:6）；基样式：`{source_root}/SDC/Style/BaseStyle.xaml`（FocusVisualRadius0Margin0:13）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 对照：IO 版 `IOComboBox` 见 [io-combo-box](../io/io-combo-box.md)；DataGrid 列内 ComboBox 引用 `ComboBoxItemBaseStyle`/`ComboBoxEditableTemplate` 见 [data-grid](data-grid.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_ComboBox.xaml.json`、`{index_root}/files/refence_SDC_Brushes_ComboBoxBrushes.xaml.json`

## 8. 待确认项

- TD-044（MultiComboBox/SingleComboBox 语义）：
  - `ItemsSourceSearch` 搜索触发机制与 `PART_SearchTextBox` 输入联动（搜索结果何时写入、双 ListBox 切换时机）；
  - `PART_SelectAllBox`（Content="All" 硬编码）全选/反选与列表的联动，以及勾选项到 `Text` 的汇总规则；
  - `SingleComboBox` 空 Popup 的行为面（弹层内容注入方式、选择如何回写 `Text`）；
  - `LoggerViewInputQueryKeyword` 跨业务文本键引用（键定义位置见 TD-004）。
- TD-006（`DropDownElement`/`WatermarkElement` 附加属性族参数类型与运行时行为）
