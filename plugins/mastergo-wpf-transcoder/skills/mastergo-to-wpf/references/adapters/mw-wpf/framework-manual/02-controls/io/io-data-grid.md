<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-001,TD-006];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IODataGrid.xaml, {source_root}/ManualView.xaml] -->

# IODataGrid（IO 表格）

## 1. 用途

原生 DataGrid 的框架封装：**可选标题条（`TitleElement.Title`，Null 自动折叠）+ 30px 列头（排序箭头）+ 行高 45**，内建行/单元格三态画刷、编辑列样式协议（`controls:DataGridAttach.*`：文本列/编辑框/下拉列样式 + AutoCommitEdit + ApplyDefaultStyle）、滚动条淡入淡出（Storyboard），并附无边框/无表头两个变体样式键。

典型场景（推断，无 P2 实例）：参数/日志类表格——ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:IODataGrid … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IODataGrid`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。模板经 MergedDictionaries 引用 BaseStyle/ScrollViewer/ComboBox（列内编辑控件样式复用）；`DataGridAttach.ApplyDefaultStyle=True` 时各列自动应用框架编辑样式。注意与原生框架版区分：`SDC/Style/DataGrid.xaml` 为非 IO 版（`DataGridBaseStyle`/`RowFreezableDataGridStyle`/`PagableDataGrid`/`PrimaryDataGridStyle`/`SecondaryDataGridStyle`）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| RowHeight | double | `DataGridItemHeight`=45 | `x:Key="IODataGridBaseStyle"` Setter + {source_root}/SDC/Sizes.xaml | ✅ |
| ColumnHeaderStyle | Style | `IODataGridColumnHeaderStyle`（列头高 30、Bold、`TextFontSize`=12、排序箭头 Ascending/Descending 翻转） | IODataGridBaseStyle Setter + `x:Key="IODataGridColumnHeaderStyle"` `Trigger Property="SortDirection"` | ✅ |
| RowStyle | Style | `DataGridRowStyle`：IsSelected → `DataGrid_RowSelectBackBrush/SelectTextBrush`；IsMouseOver → `DataGrid_RowHoverBackBrush/HoverTextBrush` | IODataGridBaseStyle Setter + `x:Key="DataGridRowStyle"` Trigger | ✅ |
| CellStyle | Style | `DataGridCellStyle`：居中、IsSelected → Select 画刷 | IODataGridBaseStyle Setter + `x:Key="DataGridCellStyle"` Trigger | ✅ |
| ColumnWidth | DataGridLength | 基样式 * | IODataGridBaseStyle Setter | ✅ |
| HorizontalGridLinesBrush / VerticalGridLinesBrush | Brush | `SecondaryBorderBrush` | IODataGridBaseStyle Setter | ✅ |
| 编辑能力开关 | bool | CanUserAddRows/CanUserDeleteRows/CanUserReorderColumns/CanUserResizeRows=False、EnableRowVirtualization=False、RowHeaderWidth=0 | IODataGridBaseStyle Setter | ✅ |
| RowDetailsVisibilityMode | enum | VisibleWhenSelected | IODataGridBaseStyle Setter | ✅ |
| TitleElement.Title | string | 表格标题；Null → TitleBorder Collapsed（30px 标题条整条隐藏） | 模板 `TextBlock Text="{TemplateBinding controls:TitleElement.Title}"` + `Trigger Property="controls:TitleElement.Title" Value="{x:Null}"` | ✅ |
| TitleElement.Background / Foreground | Brush | `DataGrid_TitleBackBrush`（渐变）/ `DataGrid_TitleTextBrush`；标题条 BorderBrush=`DataGrid_TitleBorderBrush`（模板内） | IODataGridBaseStyle Setter + 模板 TitleBorder | ✅ |
| DataGridAttach.AutoCommitEdit | bool | 基样式 True | IODataGridBaseStyle Setter | ✅ |
| DataGridAttach.TextColumnStyle | Style | `DataGridTextColumnStyle`（TextBlock 省略号居中） | IODataGridBaseStyle Setter | ✅ |
| DataGridAttach.EditingTextColumnStyle | Style | `DataGridTextBoxStyle`（编辑框铺满单元格、Hover/聚焦 `PrimaryBrush` 描边、Disabled 0.56） | IODataGridBaseStyle Setter + `x:Key="DataGridTextBoxStyle"` Trigger | ✅ |
| DataGridAttach.ComboBoxColumnStyle | Style | `TextBlockComboBoxStyle`（只读列显示省略号文本） | IODataGridBaseStyle Setter | ✅ |
| DataGridAttach.EditingComboBoxColumnStyle | Style | `DataGridComboBoxStyle`（下拉铺满单元格、ItemContainerStyle=ComboBoxItemBaseStyle、模板 DataGridComboBoxTemplate） | IODataGridBaseStyle Setter + `x:Key="DataGridComboBoxStyle"` | ✅ |
| DataGridAttach.ApplyDefaultStyle | bool | 基样式 True | IODataGridBaseStyle Setter | ✅ |
| IsEnabled | bool | False → 整体 Opacity 0.5 | 模板 `Trigger Property="IsEnabled"` | ✅ |
| IOEnable | string/bool | 设备条件协议（IO 系列共同挂点）；本模板无直接引用 | ManualView.xaml 15 处（IconButton）+ TD-001 | 🟡 [待确认 TD-001] |

模板命名部件（P1 锚点）：`PART_ColumnHeadersPresenter`、`PART_ScrollContentPresenter`、`PART_VerticalScrollBar`、`PART_HorizontalScrollBar`；`TitleBorder`、`DG_ScrollViewer`；Storyboard1/Storyboard2（滚动条 Opacity 0.2s 淡入淡出）。

## 4. 样式族表（SDC\Style\IODataGrid.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IODataGridColumnHeaderStyle | 无（独立） | 列头：高 30（MinHeight 28）、Bold、Foreground=#000、Cursor=Hand、排序箭头 Path（Ascending 180°/Descending 0°） | 列头基样式 |
| DataGridRowStyle | 无（独立） | 行三态画刷（Default/Hover/Select） | 行样式 |
| DataGridCellStyle | 无（独立） | 居中单元格模板 + Select 画刷 | 单元格样式 |
| DataGridTextColumnStyle | 无（独立） | TextBlock：CharacterEllipsis 居中 | DataGridAttach.TextColumnStyle |
| DataGridTextBoxStyle | 无（独立） | 编辑框：铺满单元格（Width/Height 绑 AncestorType=DataGridCell）、Hover/聚焦 PrimaryBrush 描边、Disabled 0.56 | DataGridAttach.EditingTextColumnStyle |
| TextBlockComboBoxStyle | 无（独立） | ComboBox 模板化为 TextBlock（Text=SelectionBox 文本） | DataGridAttach.ComboBoxColumnStyle |
| DataGridComboBoxStyle | 无（独立） | 编辑下拉：铺满单元格、ItemContainerStyle=ComboBoxItemBaseStyle（ComboBox.xaml）、模板 DataGridComboBoxTemplate | DataGridAttach.EditingComboBoxColumnStyle |
| IODataGridBaseStyle | 无（独立） | 全部默认属性 + 主模板（标题条 + DG_ScrollViewer + 滚动条 Storyboard） | 基样式，不直接用 |
| ColumnHeaderStyle | IODataGridColumnHeaderStyle | 加 BorderThickness 0,0,1,1 分隔线 | 隐式默认样式列头 |
| NoBorderDataGridStyle | IODataGridBaseStyle | BorderThickness 0/BorderBrush、Background、RowBackground=Transparent；`NoBorderColumnHeaderStyle` + `NoBorderDataGridRowStyle` | 嵌入式（无线框）表格 |
| NoHeaderDataGridStyle | NoBorderDataGridStyle | HeadersVisibility=None、再清列头样式 | 无表头表格 |
| （无键默认样式） | IODataGridBaseStyle | BorderThickness 1 + ColumnHeaderStyle=`ColumnHeaderStyle` | 未显式指定 Style 时 |

配套画刷：`{source_root}/SDC/Brushes/DataGridBrushes.xaml`（`DataGrid_OutBorderBrush`/`DataGrid_InnerBorderBrush`；`DataGrid_TitleBackBrush/TitleBorderBrush/TitleTextBrush`；`DataGrid_ColumnHeaderBackBrush/ColumnHeaderBorderBrush/ColumnHeaderTextBrush`；`DataGrid_RowDefaultBackBrush/RowDefaultTextBrush`、`DataGrid_RowHoverBackBrush/RowHoverTextBrush`、`DataGrid_RowSelectBackBrush/RowSelectTextBrush`）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `s:IODataGrid`。

```xml
<s:IODataGrid ItemsSource="{Binding …表格数据}"
              controls:TitleElement.Title="{DynamicResource …表格标题文本键}"
              AutoGenerateColumns="False">
    <DataGridTextColumn Binding="{Binding …}" Header="{DynamicResource …列标题键}"/>
    <DataGridTextColumn Binding="{Binding …}" Header="{DynamicResource …列标题键}"/>
</s:IODataGrid>
```

- 列只声明 `Binding` 与 `Header`：文本列/编辑框/下拉列的样式由 `DataGridAttach.*`（ApplyDefaultStyle=True）自动注入，页面不写列样式；
- 行高 45、行/单元格三态、列头 30 + 排序箭头、标题条（Null 自动折叠）全部框架处理；
- 变体：内嵌表格用 `NoBorderDataGridStyle`，纯内容表用 `NoHeaderDataGridStyle`。

## 6. 禁止写法对照

### ❌ 禁止：原生 DataGrid + 手写列样式与单元格拼装等效表格（常规 WPF 写法）

```xml
<DataGrid ItemsSource="{Binding …}" AutoGenerateColumns="False">
    <DataGrid.ColumnHeaderStyle>
        <Style TargetType="DataGridColumnHeader">
            <Setter Property="Height" Value="30"/>
            <!-- 自行补排序箭头模板与画刷… -->
        </Style>
    </DataGrid.ColumnHeaderStyle>
    <DataGrid.RowStyle>
        <Style TargetType="DataGridRow">
            <!-- 自行补 Hover/Select 画刷触发器… -->
        </Style>
    </DataGrid.RowStyle>
    <DataGridTemplateColumn Header="…">
        <DataGridTemplateColumn.CellTemplate>
            <DataTemplate>
                <TextBlock Text="{Binding …}"/>
            </DataTemplate>
        </DataGridTemplateColumn.CellTemplate>
        <DataGridTemplateColumn.CellEditingTemplate>
            <DataTemplate>
                <ComboBox ItemsSource="{Binding …}" Style="…"/>
            </DataTemplate>
        </DataGridTemplateColumn.CellEditingTemplate>
    </DataGridTemplateColumn>
</DataGrid>
```

### ✅ 推荐：IODataGrid + 列声明式

```xml
<s:IODataGrid ItemsSource="{Binding …}" controls:TitleElement.Title="{DynamicResource …}">
    <DataGridTextColumn Binding="{Binding …}" Header="{DynamicResource …}"/>
</s:IODataGrid>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有行/单元格三态画刷（`DataGrid_RowDefault/Hover/Select*` 全套）、列头排序箭头（SortDirection 触发器）、编辑框 Hover/聚焦描边与 Disabled 0.56、整表 Disabled 0.5；
2. **② 丢失协议挂点**：`DataGridAttach` 编辑列样式协议（TextColumnStyle/EditingTextColumnStyle/ComboBoxColumnStyle/EditingComboBoxColumnStyle/AutoCommitEdit/ApplyDefaultStyle）与 IOEnable 挂点全无；
3. **③ 无法样式族切换**：IODataGridBaseStyle → NoBorderDataGridStyle → NoHeaderDataGridStyle 三态无法一键切换；
4. **⑤ 脱离视觉规范**：行高 45（`DataGridItemHeight` Token）、列头 30、滚动条淡入淡出 Storyboard、标题条自动折叠、编辑框铺满单元格等机制失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IODataGrid.xaml`（锚点 `x:Key="IODataGridBaseStyle"`、`x:Key="IODataGridColumnHeaderStyle"`、`x:Key="DataGridRowStyle"`、`x:Key="DataGridCellStyle"`、`x:Key="DataGridTextBoxStyle"`、`x:Key="DataGridComboBoxStyle"`、`x:Key="NoBorderDataGridStyle"`、`x:Key="NoHeaderDataGridStyle"`、`Trigger Property="SortDirection"`、`Trigger Property="controls:TitleElement.Title" Value="{x:Null}"`、`PART_ColumnHeadersPresenter`/`PART_ScrollContentPresenter`/`PART_VerticalScrollBar`/`PART_HorizontalScrollBar`）
- 画刷：`{source_root}/SDC/Brushes/DataGridBrushes.xaml`；尺寸：`{source_root}/SDC/Sizes.xaml`（DataGridItemHeight）；字号：`{source_root}/SDC/Fonts.xaml`（TextFontSize）；复用：`{source_root}/SDC/Style/ComboBox.xaml`（ComboBoxItemBaseStyle/ComboBoxEditableTemplate）、`{source_root}/SDC/Style/ScrollViewer.xaml`（ScrollBarBaseStyle）
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：非 IO 版 `{source_root}/SDC/Style/DataGrid.xaml`（`x:Key="DataGridBaseStyle"`、`RowFreezableDataGridStyle`、`PagableDataGrid`）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IODataGrid.xaml.json`、`{index_root}/files/refence_SDC_Brushes_DataGridBrushes.xaml.json`

## 8. 待确认项

- TD-001（IOEnable 表达式语义——IO 系列共同协议，本模板无直接引用，属系列推断）
- TD-006（`DataGridAttach`/`TitleElement` 附加属性族的参数类型与运行时行为）
- [待确认 TD-xxx]：`DataGridComboBoxStyle` 模板引用 `{StaticResource DataGridComboBoxTemplate}`，但该键仅定义于非 IO 版 `DataGrid.xaml`，IODataGrid.xaml 未合并 DataGrid.xaml——StaticResource 解析依赖宿主字典合并顺序（关联 TD-008），疑似缺陷或隐含合并约定——建议登记新 TD
- [待确认 TD-xxx]：模板 `TitleBorder Height="30"` 与列头 `MinHeight 28/Height 30` 为硬编码（无尺寸 Token）——建议登记新 TD
- [待确认 TD-xxx]：`DataGrid_InnerBorderBrush`、`DataGrid_ColumnHeaderTextBrush` 定义于 DataGridBrushes.xaml 但 IODataGrid.xaml 未引用（列头 Foreground=#000 硬编码）——零引用画刷疑似遗留（与 TD-019 同模式）——建议登记新 TD
