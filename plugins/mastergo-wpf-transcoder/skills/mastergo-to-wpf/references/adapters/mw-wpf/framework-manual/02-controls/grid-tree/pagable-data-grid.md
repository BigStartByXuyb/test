<!-- evidence=部分确认(模板/触发器为 P1 直接证据；两者是否独立控件类型及 .cs 属性面待核实); pending=[TD-041,TD-006];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/DataGrid.xaml, {source_root}/ManualView.xaml] -->

# PagableDataGrid / RowFreezableDataGrid（分页表格与冻结行表格）

## 1. 用途

`SDC/Style/DataGrid.xaml` 内的两个 DataGrid 子类控件（TargetType=`controls:PagableDataGrid` / `controls:RowFreezableDataGrid`，均非原生类型）：

- **PagableDataGrid**：数据表格 + 右侧**上下翻页双按钮**（40×40，`ControlCommands.Prev/Next` 命令、上/下三角 Geometry），滚动条初始 Opacity=0 悬停淡入淡出；
- **RowFreezableDataGrid**：顶部**冻结行区**（内嵌 `PART_DataGrid`，数据源 `FrozenRowSource`），行区双色斑马纹（AlternationCount=2）。

典型场景（推断，无 P2 实例）：大表翻页浏览 / 表头式冻结行清单。两控件关系（是否同一基类、.cs 行为面）为 README 标注的「家族待核实」项，登记 TD-041。

## 2. 声明

```xml
<s:PagableDataGrid … />，s = http://www.maxwell-gp.com/
<s:RowFreezableDataGrid … />
```

TargetType = `controls:PagableDataGrid` / `controls:RowFreezableDataGrid`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。两者模板的 `ControlTemplate TargetType` 均为原生 `DataGrid`（子类复用基类模板的合法写法）。

## 3. 关键属性表

### PagableDataGrid

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| （样式键） | — | **仅隐式默认样式，无命名键**（与 RowFreezable/DataGrid 的具名基样式不同） | `Style TargetType="controls:PagableDataGrid"`（DataGrid.xaml 无 x:Key） | ✅ |
| RowHeight | double | `DataGridItemHeight`=45 | PagableDataGrid Setter | ✅ |
| AlternationCount | int | 2；RowBackground=`PrimaryDefaultBrush`、AlternatingRowBackground=`BackgroundLightBrush`（斑马纹） | PagableDataGrid Setter | ✅ |
| ColumnHeaderStyle / RowStyle / CellStyle | Style | 复用 `DataGridColumnHeaderStyle`/`DataGridRowStyle`/`DataGridCellStyle`（与基版同键） | PagableDataGrid Setter | ✅ |
| TitleElement.Background / Foreground | Brush | `SecondaryLightBrush` / `PrimaryTextBrush`；标题字号 **`LargeFontSize`=18**（基版为 TextFontSize=12） | PagableDataGrid Setter + 模板 TextBlock | ✅ |
| 翻页按钮 | — | 右侧 `PART_PrevBtn`/`PART_NextBtn`（40×40、Margin 5、上/下三角 `UpTriangleGeometry`/`DownTriangleGeometry`、Fill=`SecondaryTextBrush`），Command=`commands:ControlCommands.Prev/Next`，IsEnabled 随模板 | PagableDataGrid 模板 SimplePanel | ✅ |
| 滚动条 | — | `PART_ScrollViewer`（命名不同基版 `DG_ScrollViewer`）；滚动条 `Opacity="0"` 初始 + MouseEnter/MouseLeave EventTrigger 播放 Storyboard1/Storyboard2（淡入 .8/淡出 0） | PagableDataGrid 模板 + EventTrigger | ✅ |
| DataGridAttach.* / 编辑能力开关 | — | 同基版全 6 键 + CanUser* False、RowDetailsVisibilityMode=VisibleWhenSelected | PagableDataGrid Setter | ✅ |
| IsEnabled | bool | False → Opacity 0.5 | 模板 Trigger | ✅ |

### RowFreezableDataGrid

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| FrozenRowSource | IEnumerable | 冻结行数据源；内嵌 `PART_DataGrid`（HeadersVisibility=None、AutoGenerateColumns=False、IsReadOnly=False）的 ItemsSource 经 RelativeSource 绑定本属性 | `x:Key="RowFreezableDataGridStyle"` 模板 `PART_DataGrid` `ItemsSource="{Binding FrozenRowSource, … AncestorType=controls:RowFreezableDataGrid}"` | ✅ |
| SelectedIndex | int | 内嵌表选中行经 **OneWayToSource** 上抛到本控件 | PART_DataGrid `SelectedIndex="{Binding SelectedIndex, … Mode=OneWayToSource}"` | ✅ |
| RowHeight | double | 透传给内嵌表 | PART_DataGrid `RowHeight="{Binding RowHeight, …}"` | ✅ |
| AlternationCount | int | 2 + 斑马纹双色（同 Pagable） | RowFreezableDataGridStyle Setter | ✅ |
| BorderBrush | Brush | `PrimaryBorderBrush`（基版为 `DataGrid_OutBorderBrush`） | RowFreezableDataGridStyle Setter | ✅ |
| TitleElement.Background / Foreground | Brush | `SecondaryLightBrush` / `PrimaryTextBrush`；标题字号 TextFontSize=12（与基版同） | RowFreezableDataGridStyle Setter + 模板 | ✅ |
| 滚动条淡入淡出 | — | ScrollViewer 模板 4 行网格（含冻结区行）+ MouseEnter/MouseLeave EventTrigger | RowFreezableDataGridStyle 模板 | ✅ |
| DataGridAttach.* / 列头行单元格样式 | — | 与基版共用全 6 键与 `DataGridColumnHeaderStyle`/`DataGridRowStyle`/`DataGridCellStyle` | RowFreezableDataGridStyle Setter | ✅ |

## 4. 样式族表（家族键归属矩阵，DataGrid.xaml）

| 样式键 | TargetType | 键类型 | 归属 |
|---|---|---|---|
| DataGridBaseStyle | DataGrid | 具名基样式 | 原生 DataGrid（data-grid.md） |
| （隐式默认） | DataGrid | BasedOn DataGridBaseStyle | 原生 DataGrid 全局兜底 |
| PrimaryDataGridStyle / SecondaryDataGridStyle | DataGrid | 具名变体（BasedOn 基样式） | 原生 DataGrid 变体 |
| RowFreezableDataGridStyle | controls:RowFreezableDataGrid | 具名基样式 | RowFreezableDataGrid |
| （隐式默认） | controls:RowFreezableDataGrid | BasedOn RowFreezableDataGridStyle | RowFreezableDataGrid 全局兜底 |
| （无键） | controls:PagableDataGrid | **仅隐式默认，无具名键** | PagableDataGrid |

交叉核对结论（与 IODataGrid.xaml 不串）：两文件共享 `DataGridColumnHeaderStyle` 之外的 `DataGridRowStyle`/`DataGridCellStyle`/`DataGridTextColumnStyle`/`DataGridTextBoxStyle`/`TextBlockComboBoxStyle`/`DataGridComboBoxStyle` 六键同名双定义（IO 版用 `IODataGridColumnHeaderStyle`/`IODataGridBaseStyle` 区分自身）；`DataGridComboBoxTemplate`/`DataGridComboBoxToggleButton` 仅 DataGrid.xaml 定义（关联 TD-028）。隐式样式按 TargetType 分型，`RowFreezableDataGrid`/`PagableDataGrid` 实例不会被原生 DataGrid 隐式样式命中（WPF 按类型精确匹配，不向上漂移）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 均未出现 `s:PagableDataGrid`/`s:RowFreezableDataGrid`。

```xml
<s:PagableDataGrid ItemsSource="{Binding …分页数据}"
                   controls:TitleElement.Title="{DynamicResource …表格标题文本键}"
                   AutoGenerateColumns="False">
    <DataGridTextColumn Binding="{Binding …}" Header="{DynamicResource …列标题键}"/>
</s:PagableDataGrid>
```

```xml
<s:RowFreezableDataGrid ItemsSource="{Binding …行数据}"
                        FrozenRowSource="{Binding …冻结行数据}"
                        SelectedIndex="{Binding …}"
                        AutoGenerateColumns="False">
    <DataGridTextColumn Binding="{Binding …}" Header="{DynamicResource …列标题键}"/>
</s:RowFreezableDataGrid>
```

- PagableDataGrid 翻页命令/按钮全在模板内，页面只绑 ItemsSource；斑马纹、标题、列样式协议全部默认；
- RowFreezableDataGrid 冻结行独立数据源 `FrozenRowSource`，选中行经 `SelectedIndex` OneWayToSource 上抛（绑定模式已确认，语义见 TD-041）。

## 6. 禁止写法对照

### ❌ 禁止：手写 DataGrid + 独立翻页按钮（或双 DataGrid 拼冻结行）拼装等效 UI（常规 WPF 写法）

```xml
<Grid>
    <DataGrid ItemsSource="{Binding …}" RowHeight="45">
        <!-- 手写列头/行样式… -->
    </DataGrid>
    <StackPanel VerticalAlignment="Top" HorizontalAlignment="Right" Margin="5">
        <Button Width="40" Height="40" Click="Prev_Click">
            <Path Data="{StaticResource UpTriangleGeometry}" …/>
        </Button>
        <Button Width="40" Height="40" Click="Next_Click">
            <Path Data="{StaticResource DownTriangleGeometry}" …/>
        </Button>
    </StackPanel>
</Grid>
```

### ✅ 推荐：PagableDataGrid 属性化

```xml
<s:PagableDataGrid ItemsSource="{Binding …}"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：`ControlCommands.Prev/Next` 命令协议与 `FrozenRowSource`/`SelectedIndex`（OneWayToSource）冻结行协议无从谈起，翻页逻辑只能手写 Click 事件；
2. **① 丢失状态**：手写版没有滚动条悬停淡入淡出（Opacity=0 初始 + Storyboard 0.2s）、按钮 IsEnabled 随控件态联动、斑马纹与整表 Disabled 0.5；
3. **③ 无法样式族切换**：不能一键换 DataGridBaseStyle → PagableDataGrid / RowFreezableDataGrid，两控件模板差异（右侧翻页区、冻结行网格 4 行布局）无法通过页面拼装替代；
4. **⑤ 脱离视觉规范**：翻页按钮 40×40/三角 Geometry、标题 `LargeFontSize`（Pagable）/行高 45 Token 等规范失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/DataGrid.xaml`（锚点 `x:Key="RowFreezableDataGridStyle"`、`Style TargetType="controls:PagableDataGrid"`（无键）、`x:Key="DataGridBaseStyle"`、`x:Key="PrimaryDataGridStyle"`、`x:Key="SecondaryDataGridStyle"`、`PART_DataGrid`（FrozenRowSource/SelectedIndex/RowHeight 绑定）、`PART_PrevBtn`/`PART_NextBtn`（ControlCommands.Prev/Next）、`PART_ScrollViewer`、`EventTrigger RoutedEvent="MouseEnter"`）
- 画刷：`{source_root}/SDC/Brushes/DataGridBrushes.xaml`；几何：`{source_root}/SDC/Geometries.xaml`（UpTriangleGeometry/DownTriangleGeometry）；尺寸：`{source_root}/SDC/Sizes.xaml`（DataGridItemHeight:54）；字号：`{source_root}/SDC/Fonts.xaml`（LargeFontSize:4/TextFontSize:7）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 对照：原生版 `DataGridBaseStyle` 见 [data-grid](data-grid.md)；IO 版 `IODataGridBaseStyle` 见 [io-data-grid](../io/io-data-grid.md)；分页条控件 `Pagination` 见 [pagination](pagination.md)（PagableDataGrid 模板不引用 Pagination.xaml，两者为并列机制，待核实）
- 索引交叉：`{index_root}/files/refence_SDC_Style_DataGrid.xaml.json`、`{index_root}/files/refence_SDC_Style_Pagination.xaml.json`

## 8. 待确认项

- TD-041（家族核实，README「家族待核实」闭环项）：
  - PagableDataGrid / RowFreezableDataGrid 是否独立控件类型（TargetType 为两独立类型，模板 TargetType 均为原生 DataGrid）——.cs 行为面（翻页实现、冻结行滚动同步）不可见；
  - PagableDataGrid 无具名样式键是否刻意设计（无法 `Style="{StaticResource …}"` 引用）——应用是否只能依赖隐式默认；
  - `FrozenRowSource`/`SelectedIndex`(OneWayToSource)/`ItemsSource` 与冻结区滚动同步的运行时语义；
  - 基版 DataGrid 模板 `Storyboard1/2` 无 EventTrigger 挂载（本两模板有）——基版滚动条淡入淡出疑似失效，关联 data-grid.md；
  - 分页交互是否应与 `Pagination.xaml` 控件联动（本模板内置翻页按钮，未引用 Pagination 样式）。
