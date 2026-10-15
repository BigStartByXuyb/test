<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-041,TD-006,TD-008];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/DataGrid.xaml, {source_root}/ManualView.xaml] -->

# DataGrid（框架版表格）

## 1. 用途

原生 DataGrid 的框架版默认样式（隐式）与样式族：**30px 标题条（`TitleElement.Title`，Null 自动折叠）+ 30px 列头 + 行高 45**，内建行/单元格选中与悬停三态画刷、编辑列样式协议（`controls:DataGridAttach.*`：文本列/编辑框/下拉列样式 + AutoCommitEdit + ApplyDefaultStyle）、滚动条淡入淡出 Storyboard，并附 `PrimaryDataGridStyle`/`SecondaryDataGridStyle` 两个具名变体。

典型场景（推断，无 P2 实例）：参数/日志类只读或可编辑表格。注意与 IO 版区分：`SDC/Style/IODataGrid.xaml` 为 IO 系列（`IODataGridBaseStyle`/`NoBorderDataGridStyle`/`NoHeaderDataGridStyle`，见 [io-data-grid](../io/io-data-grid.md)）；本条目覆盖框架原生版（原生 `DataGrid` 类型 + 隐式默认样式）。

## 2. 声明

```xml
<DataGrid … />（默认 WPF 命名空间；框架隐式默认样式自动生效）
```

TargetType = `DataGrid`（原生类型）；MaxwellControl 私有程序集通过隐式默认样式 `{source_root}/SDC/Style/DataGrid.xaml` 全局接管。同文件另有两个子类控件 `controls:PagableDataGrid` / `controls:RowFreezableDataGrid`（家族核实见 [pagable-data-grid](pagable-data-grid.md)）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| RowHeight | double | `DataGridItemHeight`=45 | `x:Key="DataGridBaseStyle"` Setter + {source_root}/SDC/Sizes.xaml:54 | ✅ |
| ColumnHeaderStyle | Style | `DataGridColumnHeaderStyle`：高 30（MinHeight 28）、Bold、`TextFontSize`=12、Foreground=#000（硬编码）、Cursor=Hand、`DataGrid_ColumnHeaderBackBrush` 底 + 右/下 1px 分隔线 | DataGridBaseStyle Setter + `x:Key="DataGridColumnHeaderStyle"` | ✅ |
| RowStyle | Style | `DataGridRowStyle`：IsSelected → `DataGrid_RowSelectBackBrush/SelectTextBrush`；IsMouseOver → `DataGrid_RowHoverBackBrush/HoverTextBrush` | DataGridBaseStyle Setter + `x:Key="DataGridRowStyle"` Trigger | ✅ |
| CellStyle | Style | `DataGridCellStyle`：居中模板（Grid+ContentPresenter）、IsSelected → Select 画刷、`TextFontSize` | DataGridBaseStyle Setter + `x:Key="DataGridCellStyle"` | ✅ |
| ColumnWidth | DataGridLength | 基样式 `*` | DataGridBaseStyle Setter | ✅ |
| BorderBrush / BorderThickness | Brush / Thickness | `DataGrid_OutBorderBrush` / 1 | DataGridBaseStyle Setter | ✅ |
| RowBackground | Brush | `DataGrid_RowDefaultBackBrush` | DataGridBaseStyle Setter | ✅ |
| HorizontalGridLinesBrush / VerticalGridLinesBrush | Brush | `SecondaryBorderBrush` | DataGridBaseStyle Setter | ✅ |
| 编辑能力开关 | bool | CanUserAddRows/CanUserDeleteRows/CanUserReorderColumns/CanUserResizeRows=False、RowHeaderWidth=0、RowDetailsVisibilityMode=VisibleWhenSelected、EnableRowVirtualization=True、EnableColumnVirtualization=False | DataGridBaseStyle Setter | ✅ |
| TitleElement.Title | string | 表格标题；Null → TitleBorder Collapsed（30px 标题条整条隐藏） | 模板 `TitleBorder Height="30"` + `Trigger Property="controls:TitleElement.Title" Value="{x:Null}"` | ✅ |
| TitleElement.Background / Foreground / TitleAlignment | Brush / HorizontalAlignment | 标题条画刷与对齐；基样式默认 `DataGrid_TitleBackBrush`/`DataGrid_TitleTextBrush`；标题文字 Bold + `TextFontSize` | DataGridBaseStyle Setter + 模板 TextBlock | ✅ |
| DataGridAttach.AutoCommitEdit | bool | 基样式 True | DataGridBaseStyle Setter | ✅ |
| DataGridAttach.TextColumnStyle | Style | `DataGridTextColumnStyle`（TextBlock 居中省略号） | DataGridBaseStyle Setter | ✅ |
| DataGridAttach.EditingTextColumnStyle | Style | `DataGridTextBoxStyle`（编辑框铺满单元格、Hover/聚焦 `PrimaryBrush` 描边、Disabled 0.56） | DataGridBaseStyle Setter + `x:Key="DataGridTextBoxStyle"` Trigger | ✅ |
| DataGridAttach.ComboBoxColumnStyle | Style | `TextBlockComboBoxStyle`（只读列显示省略号文本） | DataGridBaseStyle Setter | ✅ |
| DataGridAttach.EditingComboBoxColumnStyle | Style | `DataGridComboBoxStyle`（下拉铺满单元格、ItemContainerStyle=`ComboBoxItemBaseStyle`、模板 `DataGridComboBoxTemplate`、IsEditable 切 `ComboBoxEditableTemplate`） | DataGridBaseStyle Setter + `x:Key="DataGridComboBoxStyle"` | ✅ |
| DataGridAttach.ApplyDefaultStyle | bool | 基样式 True | DataGridBaseStyle Setter | ✅ |
| IsEnabled | bool | False → 整体 Opacity 0.5 | 模板 `Trigger Property="IsEnabled"` | ✅ |

模板命名部件（P1 锚点）：`TitleBorder`（30px）、`DG_ScrollViewer`（自绘 ScrollViewer 模板：`PART_ColumnHeadersPresenter`、`PART_ScrollContentPresenter`、`PART_VerticalScrollBar`/`PART_HorizontalScrollBar`，滚动条用 `ScrollBarBaseStyle`）；`Storyboard1`/`Storyboard2`（滚动条 Opacity 0.2s 淡入淡出资源）。

## 4. 样式族表（SDC\Style\DataGrid.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| DataGridBaseStyle | 无（独立） | 全部默认属性 + 主模板（标题条 + DG_ScrollViewer + 滚动条 Storyboard 资源） | 基样式，不直接用 |
| （无键默认样式） | DataGridBaseStyle | TargetType=DataGrid 隐式默认，全局兜底 | 未显式指定 Style 时 |
| PrimaryDataGridStyle | DataGridBaseStyle | 空变体（仅转发基样式） | 具名样式引用点 |
| SecondaryDataGridStyle | DataGridBaseStyle | 仅覆盖 `TitleElement.Background=ButtonGradientBrush`（标题条渐变） | 渐变标题变体 |
| RowFreezableDataGridStyle | 无（独立） | `controls:RowFreezableDataGrid`：冻结行模板 + AlternationCount=2 | 见 pagable-data-grid.md |
| （无键，PagableDataGrid） | 无（独立） | `controls:PagableDataGrid` 隐式样式（无命名键）+ 上下翻页双按钮 | 见 pagable-data-grid.md |

列编辑样式（同文件头部 `#region Columns Style`，被 `DataGridAttach.*` 消费）：`TextBlockComboBoxStyle`、`DataGridTextColumnStyle`、`DataGridTextBoxStyle`、`DataGridComboBoxToggleButton`（内部件）、`DataGridComboBoxTemplate`（模板）、`DataGridComboBoxStyle`。⚠️ 其中 `DataGridTextColumnStyle`/`DataGridTextBoxStyle`/`TextBlockComboBoxStyle`/`DataGridComboBoxStyle`/`DataGridRowStyle`/`DataGridCellStyle` 六键在 `IODataGrid.xaml` 各有一份同名定义（双定义键，生效者取决于宿主字典合并顺序，关联 TD-008）；`DataGridComboBoxTemplate`/`DataGridComboBoxToggleButton` 仅本文件定义（IO 版引用前者 → TD-028）。

配套画刷：`{source_root}/SDC/Brushes/DataGridBrushes.xaml`（`DataGrid_OutBorderBrush`/`DataGrid_InnerBorderBrush`；`DataGrid_TitleBackBrush/TitleBorderBrush/TitleTextBrush`；`DataGrid_ColumnHeaderBackBrush/ColumnHeaderBorderBrush/ColumnHeaderTextBrush`；`DataGrid_RowDefault*/RowHover*/RowSelect*` 各 Back/Text 对）。合并字典：BaseStyle.xaml、ScrollViewer.xaml（ScrollBarBaseStyle）、ComboBox.xaml（ComboBoxItemBaseStyle/ComboBoxEditableTemplate）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 DataGrid（含 `s:` 前缀家族），Demo MasterGo_WPF_V0.0.3 亦未使用。

```xml
<DataGrid ItemsSource="{Binding …表格数据}"
          controls:TitleElement.Title="{DynamicResource …表格标题文本键}"
          AutoGenerateColumns="False">
    <DataGridTextColumn Binding="{Binding …}" Header="{DynamicResource …列标题键}"/>
    <DataGridTextColumn Binding="{Binding …}" Header="{DynamicResource …列标题键}"/>
</DataGrid>
```

- 隐式默认样式自动生效：行高 45、行/单元格三态、列头 30、标题条（Null 自动折叠）全部框架处理，页面零样式声明；
- 列只声明 `Binding` 与 `Header`：文本列/编辑框/下拉列样式由 `DataGridAttach.*`（ApplyDefaultStyle=True）自动注入；
- 变体：需要具名引用时用 `Style="{StaticResource PrimaryDataGridStyle}"`；渐变标题用 `SecondaryDataGridStyle`；分页/冻结行场景换控件（见 [pagable-data-grid](pagable-data-grid.md)）。

## 6. 禁止写法对照

### ❌ 禁止：原生 DataGrid + 手写列头/行/单元格样式与编辑模板拼装等效表格（常规 WPF 写法）

```xml
<DataGrid ItemsSource="{Binding …}" AutoGenerateColumns="False" RowHeight="45">
    <DataGrid.ColumnHeaderStyle>
        <Style TargetType="DataGridColumnHeader">
            <Setter Property="Height" Value="30"/>
            <Setter Property="FontWeight" Value="Bold"/>
            <!-- 自行补排序箭头与画刷… -->
        </Style>
    </DataGrid.ColumnHeaderStyle>
    <DataGrid.RowStyle>
        <Style TargetType="DataGridRow">
            <Style.Triggers>
                <Trigger Property="IsMouseOver" Value="True">
                    <Setter Property="Background" Value="#eee"/>
                    <!-- 自行补 Select/Hover 双态画刷… -->
                </Trigger>
            </Style.Triggers>
        </Style>
    </DataGrid.RowStyle>
    <DataGridTemplateColumn Header="…">
        <DataGridTemplateColumn.CellTemplate>
            <DataTemplate><TextBlock Text="{Binding …}"/></DataTemplate>
        </DataGridTemplateColumn.CellTemplate>
        <DataGridTemplateColumn.CellEditingTemplate>
            <DataTemplate><ComboBox ItemsSource="{Binding …}" Style="…"/></DataTemplate>
        </DataGridTemplateColumn.CellEditingTemplate>
    </DataGridTemplateColumn>
</DataGrid>
```

### ✅ 推荐：DataGrid 隐式样式 + 列声明式

```xml
<DataGrid ItemsSource="{Binding …}" controls:TitleElement.Title="{DynamicResource …}">
    <DataGridTextColumn Binding="{Binding …}" Header="{DynamicResource …}"/>
</DataGrid>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有行/单元格三态画刷（`DataGrid_RowDefault/Hover/Select*` 全套）、编辑框 Hover/聚焦描边与 Disabled 0.56、整表 Disabled 0.5；
2. **② 丢失协议挂点**：`DataGridAttach` 编辑列样式协议（TextColumnStyle/EditingTextColumnStyle/ComboBoxColumnStyle/EditingComboBoxColumnStyle/AutoCommitEdit/ApplyDefaultStyle）与 `TitleElement` 标题条协议（Null 自动折叠）全无；
3. **③ 无法样式族切换**：DataGridBaseStyle → PrimaryDataGridStyle → SecondaryDataGridStyle 无法一键切换，分页/冻结行家族更无从谈起；
4. **⑤ 脱离视觉规范**：行高 45（`DataGridItemHeight` Token）、列头 30/28、`#000` 列头文字、滚动条淡入淡出 Storyboard、编辑框铺满单元格等机制失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/DataGrid.xaml`（锚点 `x:Key="DataGridBaseStyle"`、`x:Key="PrimaryDataGridStyle"`、`x:Key="SecondaryDataGridStyle"`、`x:Key="DataGridColumnHeaderStyle"`、`x:Key="DataGridRowStyle"`、`x:Key="DataGridCellStyle"`、`x:Key="DataGridTextBoxStyle"`、`x:Key="DataGridComboBoxStyle"`、`x:Key="DataGridComboBoxTemplate"`、`x:Key="DataGridTextColumnStyle"`、`x:Key="TextBlockComboBoxStyle"`、`Trigger Property="controls:TitleElement.Title" Value="{x:Null}"`、`Trigger Property="IsEnabled"`、`PART_ColumnHeadersPresenter`/`PART_ScrollContentPresenter`/`PART_VerticalScrollBar`/`PART_HorizontalScrollBar`）
- 画刷：`{source_root}/SDC/Brushes/DataGridBrushes.xaml`；尺寸：`{source_root}/SDC/Sizes.xaml`（DataGridItemHeight:54）；字号：`{source_root}/SDC/Fonts.xaml`（TextFontSize:7）；复用：`{source_root}/SDC/Style/ComboBox.xaml`（ComboBoxItemBaseStyle/ComboBoxEditableTemplate）、`{source_root}/SDC/Style/ScrollViewer.xaml`（ScrollBarBaseStyle）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 对照：IO 版 `{source_root}/SDC/Style/IODataGrid.xaml`（六键双定义、DataGridComboBoxTemplate 引用 → TD-028）；家族 `RowFreezableDataGridStyle`/PagableDataGrid 见 [pagable-data-grid](pagable-data-grid.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_DataGrid.xaml.json`、`{index_root}/files/refence_SDC_Brushes_DataGridBrushes.xaml.json`

## 8. 待确认项

- TD-041（DataGrid 家族核实——见 pagable-data-grid.md；本条目相关子项：基模板 `Storyboard1/Storyboard2` 已定义但无 EventTrigger 挂载（RowFreezable/Pagable 模板有），滚动条淡入淡出在基版疑似不生效；`DataGridColumnHeaderStyle` 的 `SortArrow` Path 常驻 Collapsed 且无 SortDirection 触发器（IO 版列头有 Ascending/Descending 触发器），排序箭头疑似不显示）
- TD-006（`DataGridAttach`/`TitleElement` 附加属性族的参数类型与运行时行为）
- TD-008（本文件与 IODataGrid.xaml 六键同名双定义，生效者依赖宿主字典合并顺序）
