<!-- evidence=部分确认(模板/绑定/命令引用为 P1 直接证据；PagableDataGrid/Pagination 的 .cs 行为面不可见);
     pending=[TD-041,TD-042,TD-052,TD-034,TD-004]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/DataGrid.xaml, {source_root}/SDC/Style/Pagination.xaml, {source_root}/ManualView.xaml]
     反例有效性（grep 验证）：ManualView.xaml 零原生 <DataGrid>（0 命中）；SDC/Style 72 文件 0 处代码后置 Click；DataGrid.xaml 内翻页按钮全部走 Command="commands:ControlCommands.Prev/Next"（PART_PrevBtn :849、PART_NextBtn :864）。本文件反例结构（DataGrid + 手写翻页按钮 + Click 代码后置）不出现在真实页面。 -->

# 场景⑥ 表格分页

> **关键规则**：大表翻页用 `s:PagableDataGrid`（右侧翻页按钮内建、翻页命令零书写）；独立分页条（数据量/页码跳转/每页条数一体）用 `s:Pagination`；**两者为并列机制、互不引用**（PagableDataGrid 模板不引用 Pagination.xaml，家族关系待核实 TD-041）。

## 场景描述

大数据量表格分页浏览：翻页、页码跳转、每页条数、数据量显示。

## 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 大表 + 内建翻页按钮 | PagableDataGrid（仅隐式默认样式，无具名键） | [pagable-data-grid](../02-controls/grid-tree/pagable-data-grid.md) |
| 独立分页条（页码跳转/每页条数） | Pagination | [pagination](../02-controls/grid-tree/pagination.md) |
| 翻页命令 | `commands:ControlCommands.Prev/Next` | [control-commands](../02-controls/attached-props/control-commands.md) |
| 列样式/编辑能力 | DataGridAttach.* / 列样式键 | [data-grid](../02-controls/grid-tree/data-grid.md)、[data-grid-attach](../02-controls/attached-props/data-grid-attach.md) |
| 冻结行大表（对照场景） | RowFreezableDataGrid（FrozenRowSource） | pagable-data-grid.md |

## 对照

### ❌ 禁止：常规 WPF 写法（手写 DataGrid + 独立翻页按钮拼装）

```xml
<Grid>
    <DataGrid x:Name="dg" ItemsSource="{Binding …分页数据}" RowHeight="45">
        <!-- 手写列头/行/单元格样式… -->
    </DataGrid>
    <StackPanel VerticalAlignment="Top" HorizontalAlignment="Right" Margin="5">
        <Button Width="40" Height="40" Click="Prev_Click">
            <Path Width="12" Height="12" Fill="Gray" Stretch="Uniform"
                  Data="{StaticResource UpTriangleGeometry}"/>
        </Button>
        <Button Width="40" Height="40" Click="Next_Click">
            <Path Width="12" Height="12" Fill="Gray" Stretch="Uniform"
                  Data="{StaticResource DownTriangleGeometry}"/>
        </Button>
    </StackPanel>
</Grid>
```

```csharp
private void Prev_Click(object sender, RoutedEventArgs e)
{
    _page--;
    dg.ItemsSource = GetPage(_page);    // 手写翻页逻辑
}
private void Next_Click(object sender, RoutedEventArgs e)
{
    _page++;
    dg.ItemsSource = GetPage(_page);
}
```

### ✅ 推荐：框架写法（原样摘自已写条目）

分页大表（pagable-data-grid.md §5 典型用法）：

```xml
<s:PagableDataGrid ItemsSource="{Binding …分页数据}"
                   controls:TitleElement.Title="{DynamicResource …表格标题文本键}"
                   AutoGenerateColumns="False">
    <DataGridTextColumn Binding="{Binding …}" Header="{DynamicResource …列标题键}"/>
</s:PagableDataGrid>
```

独立分页条（pagination.md §5 典型用法）：

```xml
<s:Pagination DataCount="{Binding …总条数}"
              Index="{Binding …当前页, UpdateSourceTrigger=PropertyChanged}"
              PageCount="{Binding …总页数}"/>
```

说明：PagableDataGrid 翻页命令/按钮全在模板内（PART_PrevBtn/PART_NextBtn = `commands:ControlCommands.Prev/Next`，DataGrid.xaml:849/:864），页面只绑 ItemsSource；Pagination 按钮可用性由 CanGo* 四属性驱动、Tag 分段（0/1/3/5/6）由 .cs 处理——语义 🟡 [待确认 TD-042]，**调用形式已确认、按上例书写即可**；分页文本键（ControlHome 等）定义位置见 TD-004；ControlCommands 命令全集见 TD-052。

## 禁止原因（≥3 条）

1. **② 丢失协议挂点**：`ControlCommands.Prev/Next` 命令语义通道丢失——框架命令的 CanExecute 禁用联动与边界钳制（control-commands.md §6，TD-052），手写 Click 必须自研翻页/边界逻辑且行为分叉（边界/只读/禁用叠加时状态错乱）；
2. **① 丢失状态**：手写版没有滚动条悬停淡入淡出（Opacity=0 初始 + Storyboard）、翻页按钮 IsEnabled 随控件态联动、斑马纹（AlternationCount=2，PrimaryDefaultBrush/BackgroundLightBrush）与整表 Disabled Opacity 0.5（pagable-data-grid.md §3/§6）；
3. **③ 无法样式族切换**：不能一键 DataGridBaseStyle→PagableDataGrid/RowFreezableDataGrid（右侧翻页区、冻结行 4 行网格布局差异无法页面拼装替代）；Pagination 的 CanGo* 四组可用性联动（首页/上一页成对、跳转独立）与 Tag 分段路由也无法复刻（pagination.md §6）；
4. **④ 绕过本地化**：分页条文字硬编码「首页/上一页/下一页」绕过 `ControlHome`/`ControlPrePage`/`ControlNextPage` 等 DynamicResource 文本键（pagination.md §3，键定义位置 TD-004）；
5. **⑤ 脱离视觉规范**：翻页按钮 40×40/三角 Geometry、标题 `LargeFontSize`（PagableDataGrid 版）/行高 45 Token（DataGridItemHeight）、分页条 56 高/按钮 30 高规范失控。

## 证据来源

- 模板证据：{source_root}/SDC/Style/DataGrid.xaml（锚点 `Style TargetType="controls:PagableDataGrid"`（无键）、`x:Key="RowFreezableDataGridStyle"`、`PART_PrevBtn` :849、`PART_NextBtn` :864）、{source_root}/SDC/Style/Pagination.xaml（锚点 `S_TextB`、`Tag="0"~"6"`、`Binding CanGoCombo/CanGoFirstOrPrev/CanGoJump/CanGoLastOrNext`）
- 命令引用：{source_root}/SDC/Style/NumberBox.xaml（PART_UpButton :123 / PART_DownButton :132，同一命令族跨家族映射证据）
- 真实页面：无（ManualView.xaml 与 Demo 均不含本控件）
- 对照：原生版 [data-grid](../02-controls/grid-tree/data-grid.md)、IO 版 [io-data-grid](../02-controls/io/io-data-grid.md)
