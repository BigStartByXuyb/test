<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-006,TD-041]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/DataGrid.xaml, {source_root}/SDC/Style/IODataGrid.xaml, {source_root}/ManualView.xaml] -->

# DataGridAttach（表格行为附加属性）

## 1. 用途

框架 DataGrid 家族统一配置协议：宿主类 `controls:DataGridAttach` 提供**列样式注入 + 编辑行为**附加属性族，挂在 DataGrid 上，由 DataGrid 家族各样式（DataGridBaseStyle / RowFreezableDataGridStyle / PagableDataGrid / IODataGridBaseStyle）在模板内统一消费——文本列/编辑文本列/下拉列/编辑下拉列的样式替换与提交行为全部由附加属性驱动，页面零列级样式配置。

## 2. 声明

```xml
<s:DataGrid controls:DataGridAttach.AutoCommitEdit="True"
            controls:DataGridAttach.TextColumnStyle="{StaticResource DataGridTextColumnStyle}"
            controls:DataGridAttach.ComboBoxColumnStyle="{StaticResource TextBlockComboBoxStyle}"
            …/>
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 族级默认由 DataGridBaseStyle 的 Setter 群提供（DataGrid.xaml:344-349），页面按需覆盖；
- 列样式注入由模板内部列工厂消费（列样式挂点细节 .cs 不可见，消费证据为 Setter 键值对指向本家族样式键）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| AutoCommitEdit | bool | 编辑提交行为开关（家族默认 True） | DataGrid.xaml:344（DataGridBaseStyle Setter） | 🟡 [TD-006/TD-041] |
| TextColumnStyle | Style | 文本列样式（族默认 `DataGridTextColumnStyle`） | DataGrid.xaml:345 | 🟡 [TD-006] |
| EditingTextColumnStyle | Style | 编辑态文本列样式（族默认 `DataGridTextBoxStyle`） | DataGrid.xaml:346 | 🟡 [TD-006] |
| ComboBoxColumnStyle | Style | 下拉列样式（族默认 `TextBlockComboBoxStyle`） | DataGrid.xaml:347 | 🟡 [TD-006] |
| EditingComboBoxColumnStyle | Style | 编辑态下拉列样式（族默认 `DataGridComboBoxStyle`） | DataGrid.xaml:348 | 🟡 [TD-006] |
| ApplyDefaultStyle | bool | 默认样式应用开关（族默认 True） | DataGrid.xaml:349 | 🟡 [TD-006] |

家族分布（模板源码证据）：DataGridBaseStyle Setter 群 :344-349；RowFreezableDataGridStyle 再设（:517-522）；PagableDataGrid 再设（:714-719）；IODataGridBaseStyle 对应设置（IODataGrid.xaml:249-254）。样式族间存在参数覆盖差异（如 RowFreezable 家族 TextColumnStyle 指向冻结列变体）。

## 4. 样式族表

无（本条目为附加属性；消费样式族见 [data-grid](../grid-tree/data-grid.md)、[pagable-data-grid](../grid-tree/pagable-data-grid.md)、[io-data-grid](../io/io-data-grid.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<s:DataGrid controls:TitleElement.Title="台账"
            controls:DataGridAttach.AutoCommitEdit="True"
            ItemsSource="{Binding …}">
    <s:DataGrid.Columns>
        <DataGridTextColumn Binding="{Binding …}"/>
        <DataGridComboBoxColumn …/>
    </s:DataGrid.Columns>
</s:DataGrid>
```

- 页面只声明列与绑定，列样式由 DataGridAttach 注入（族默认已含，无需写任何 Style= 列属性）；
- 需要自定义列样式时覆盖对应附加属性并指向自定义键。

## 6. 禁止写法对照

### ❌ 禁止：逐列手写 Style 属性（等效替代）

```xml
<DataGrid …>
    <DataGrid.Columns>
        <DataGridTextColumn Binding="{Binding A}" CellStyle="{StaticResource …}"
                            EditingElementStyle="{StaticResource …}"/>
        <DataGridComboBoxColumn Binding="{Binding B}" ElementStyle="{StaticResource …}"
                                EditingElementStyle="{StaticResource …}"/>
    </DataGrid.Columns>
</DataGrid>
```

### ✅ 推荐：DataGridAttach 属性化

```xml
<s:DataGrid controls:DataGridAttach.AutoCommitEdit="True" …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：列样式注入协议失效——框架列工厂按 DataGridAttach 键值注入列级样式，手写 CellStyle/ElementStyle 与注入协议冲突或悬空；
2. **③ 无法样式族切换**：列样式随 DataGrid 样式族（Base→RowFreezable→Pagable→IO）统一切换的机制失效，每列样式钉死在页面；
3. **① 丢失状态**：AutoCommitEdit 编辑提交行为（焦点移出自动提交等）无从表达——手写版只能退回原生 DataGrid 默认行为；
4. **⑤ 脱离视觉规范**：列样式键（DataGridTextColumnStyle 等家族键）引用丢失，视觉与家族基准确认（对齐/编辑态外观）脱节；
5. **④ 绕过统一配置**：ApplyDefaultStyle 开关失效，无法按需求整体切换默认样式应用范围。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/DataGrid.xaml`（锚点 `x:Key="DataGridBaseStyle"` Setter 群 :344-349、`x:Key="RowFreezableDataGridStyle"` :517-522、PagableDataGrid 隐式样式 :714-719）
- IO 家族：`{source_root}/SDC/Style/IODataGrid.xaml`（:249-254）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_DataGrid.xaml.json`

## 8. 待确认项

- **TD-006**（复用）：DataGridAttach 宿主类成员全集与类型确认（Style 型属性值引用为模板 Setter 直接证据，类型推断）。
- **TD-041**（复用）：DataGrid 家族列工厂注入机制与 AutoCommitEdit 行为语义——.cs 不可见，家族运行时差异待框架作者回填。
