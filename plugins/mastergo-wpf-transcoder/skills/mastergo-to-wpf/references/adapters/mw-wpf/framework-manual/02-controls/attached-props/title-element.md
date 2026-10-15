<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-006,TD-041]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/DataGrid.xaml, {source_root}/SDC/Style/IODataGrid.xaml, {source_root}/SDC/Style/GroupBox.xaml, {source_root}/SDC/Style/IOGroupBox.xaml, {source_root}/SDC/Style/Expander.xaml, {source_root}/ManualView.xaml] -->

# TitleElement（标题条附加属性）

## 1. 用途

框架标题条协议：宿主类 `controls:TitleElement` 提供标题条全参附加属性（Title/Background/Foreground/FontSize/TitleHeight/TitleAlignment/BorderBrush），挂在容器控件上，由模板内「标题条」结构（Border + TextBlock）消费。**Title=Null 时标题条整体折叠**（DataGrid.xaml:467 触发器）——同一控件可无标题使用。

消费家族（grep 全库）：DataGrid 家族（DataGridBaseStyle / RowFreezableDataGridStyle / PagableDataGrid / SecondaryDataGridStyle、IODataGrid）、GroupBox / IOGroupBox（表头型标题）、Expander（头部型标题）。

## 2. 声明

```xml
<s:DataGrid controls:TitleElement.Title="台账列表"
            controls:TitleElement.Background="{DynamicResource DataGrid_TitleBackBrush}"
            controls:TitleElement.Foreground="{DynamicResource DataGrid_TitleForegroundBrush}"
            controls:TitleElement.TitleAlignment="Left"/>
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 由各容器样式族内 Setter 提供默认（DataGridBaseStyle 在 `DataGrid.xaml:341-342` 设 Title/Background/Foreground），页面按需覆盖；
- 模板消费：`TitleBorder`（Border）+ 内嵌 `TextBlock`（DataGrid.xaml:381-391），Text 绑定 Title，Background 绑定 TitleElement.Background。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Title | string | 标题文本；**Null → 标题条 Collapsed** | DataGrid.xaml:341（Setter）+ :391（模板 Text 绑定）+ :467（Title=Null → TitleBorder Collapsed Trigger） | ✅ |
| Background | Brush | 标题条底色（族默认 DataGrid_TitleBackBrush / ButtonGradientBrush） | DataGrid.xaml:341（Setter）+ :381（TitleBorder Background TemplateBinding）；SecondaryDataGridStyle :908-912 | ✅ |
| Foreground | Brush | 标题文字色（族默认 DataGrid_TitleForegroundBrush） | DataGrid.xaml:342（Setter）+ :390（TextBlock Foreground TemplateBinding） | ✅ |
| TitleAlignment | HorizontalAlignment | 标题对齐（Left / Center） | DataGrid.xaml:386（TextBlock HorizontalAlignment TemplateBinding）；IOGroupBox.xaml:42（Center 实例） | 🟡 [TD-006] |
| FontSize | double | 标题字号 | GroupBox.xaml:37（Setter）+ :16（TextBlock FontSize TemplateBinding） | 🟡 [TD-006] |
| TitleHeight | double | 标题条高度 | GroupBox.xaml:35（Setter）+ :15（TitleBorder Height TemplateBinding）；Expander.xaml:87/102 | 🟡 [TD-006] |
| BorderBrush | Brush | 标题下边线/边框色 | GroupBox.xaml:34（Setter）+ :15（TitleBorder BorderBrush TemplateBinding） | 🟡 [TD-006] |
| 其余成员 | — | 全库 grep 命中集中于上述属性 | grep 统计 | ❓ TD-006 |

家族差异（模板源码证据）：DataGrid 家族标题条在模板顶部（TitleBorder 满宽行）；GroupBox 家族标题条缩进内嵌；Expander 家族标题条与展开按钮同区布局。IOGroupBox.xaml:42 展示页面级 `TitleAlignment="Center"` 覆盖写法。

## 4. 样式族表

无（本条目为附加属性；消费样式族见 [data-grid](../grid-tree/data-grid.md)、[io-group-box](../io/io-group-box.md)、[expander](../navigation/expander.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<s:DataGrid controls:TitleElement.Title="{DynamicResource …台账文本键}"
            controls:TitleElement.TitleAlignment="Left"/>
```

- 不写 Title（保持 Null）则无标题条，表格内容占满——折叠协议由 :467 触发器保证，页面零额外代码；
- 标题文本走 DynamicResource 本地化键（03-protocols/localization-text.md）；
- 家族默认（底色/字色/字号）已含，页面只覆盖 Title。

## 6. 禁止写法对照

### ❌ 禁止：手写 Grid 两行 + Border + TextBlock 拼装标题条（等效替代）

```xml
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition Height="30"/>
        <RowDefinition Height="*"/>
    </Grid.RowDefinitions>
    <Border Grid.Row="0" Background="{StaticResource …}" Height="30">
        <TextBlock Text="台账列表" VerticalAlignment="Center" Margin="8,0"/>
    </Border>
    <s:DataGrid Grid.Row="1" …/>
</Grid>
```

### ✅ 推荐：TitleElement 属性化

```xml
<s:DataGrid controls:TitleElement.Title="台账列表" …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写标题条无「Title=Null 折叠」协议——想无标题时必须删 Grid 行并重排 RowDefinitions，而非清属性；
2. **② 丢失协议挂点**：Title/Background/Foreground/TitleAlignment 数据绑定协议全失，样式族 Setter 默认值与页面覆盖均失效；
3. **③ 无法样式族切换**：DataGridBaseStyle→SecondaryDataGridStyle 的标题条底色切换（ButtonGradientBrush）无法穿透到手写标题条；
4. **④ 绕过本地化**：硬编码「台账列表」绕过 DynamicResource 文本键体系；
5. **⑤ 脱离视觉规范**：标题条高度（30）、字色/底色 Token、左对齐缩进散写页面，与家族视觉基线脱节。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/DataGrid.xaml`（锚点 `x:Key="DataGridBaseStyle"` Setter :341-342、`x:Name="TitleBorder"` :381-391、Title=Null Trigger :467、`x:Key="SecondaryDataGridStyle"` :908-912）
- 其他家族：`{source_root}/SDC/Style/GroupBox.xaml`（:15-16/34-37）、`{source_root}/SDC/Style/IOGroupBox.xaml`（:42 页面级覆盖实例）、`{source_root}/SDC/Style/Expander.xaml`（:87/102）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_DataGrid.xaml.json`

## 8. 待确认项

- **TD-006**（复用）：TitleElement 宿主类成员全集与类型确认（TitleAlignment/TitleHeight/FontSize/BorderBrush 为模板绑定推断）。
- **TD-041**（复用）：DataGrid 家族各样式（DataGridBaseStyle/RowFreezableDataGridStyle/PagableDataGrid/SecondaryDataGridStyle）标题条差异与运行时行为——家族语义待回填。
