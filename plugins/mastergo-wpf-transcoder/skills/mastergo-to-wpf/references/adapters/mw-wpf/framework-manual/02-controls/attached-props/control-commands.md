<!-- evidence=部分确认(命令引用处为模板源码直接证据；命令类定义 .cs 不可见); pending=[TD-052,TD-034,TD-042]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/NumberBox.xaml, {source_root}/SDC/Style/IntNumberBox.xaml, {source_root}/SDC/Style/StringNumberBox.xaml, {source_root}/SDC/Style/DataGrid.xaml, {source_root}/SDC/Style/Slider.xaml, {source_root}/ManualView.xaml] -->

# ControlCommands（框架命令族）

## 1. 用途

框架命令类 `ControlCommands`（命名空间 `MaxwellControl.Commands`，XAML 前缀 `commands:`）提供**步进/翻页方向命令**，挂给模板内 PART_* 按钮：NumberBox 家族上下步进钮（Prev/Next）、DataGrid 分页按钮（Prev/Next）。模板通过 `Command="commands:ControlCommands.Prev"` 消费，命令执行语义由框架 .cs 处理。

**关键事实**：命令类定义 .cs 本地不可见——当前仅能从模板命令引用推断成员存在性（Prev/Next 两命令经多文件独立引用确认）；全集未知（TD-052）。

## 2. 声明

```xml
<!-- 模板内原样（NumberBox.xaml） -->
<Button x:Name="PART_UpButton" Command="commands:ControlCommands.Prev" …/>
```

- `commands` = `clr-namespace:MaxwellControl.Commands`（NumberBox.xaml:5 声明）；
- 框架样式已挂好命令，页面零书写；页面自定义按钮可用同一命令（语义随宿主控件不同——NumberBox 为增减、DataGrid 为翻页）。

## 3. 关键命令表

| 命令成员 | 类型 | 用途（推断 + 证据） | 引用处（锚点） | 状态 |
|---|---|---|---|---|
| Prev | 静态命令（类型待确认）| 步进/翻页-方向（上一步/减；上一页） | NumberBox.xaml:123（PART_UpButton）、IntNumberBox.xaml:69/:244、StringNumberBox.xaml:71、DataGrid.xaml:849（PART_PrevBtn） | ❓ [TD-052] |
| Next | 静态命令（类型待确认）| 步进/翻页+方向（下一步/增；下一页） | NumberBox.xaml:132（PART_DownButton）、IntNumberBox.xaml:79/:265、StringNumberBox.xaml:79、DataGrid.xaml:864（PART_NextBtn） | ❓ [TD-052] |
| 其余成员 | — | 全库 grep 仅 Prev/Next 两命令命中（`commands:ControlCommands.`） | grep 统计 | ❓ TD-052 |

跨家族映射（模板源码证据）：

- **NumberBox 家族**：PART_UpButton=Prev（NumberBox.xaml:123）、PART_DownButton=Next（:132）——数值增/减；IntNumberBox.xaml:69/79（步进）+ :244/265（左右 +/-）；StringNumberBox.xaml:71/79；
- **DataGrid 家族**：PagableDataGrid 分页按钮 PART_PrevBtn=Prev（DataGrid.xaml:849，UpTriangleGeometry）、PART_NextBtn=Next（:864，DownTriangleGeometry）——上一页/下一页（关联 Pagination 家族 Tag 协议 TD-042）；
- **关联（非本类成员）**：`controls:RangeSlider.IncreaseLarge/DecreaseLarge/CenterLarge`（Slider.xaml:206/209/212 及垂直版 :250/:253/:256、:357/:359/:362）——RangeSlider 类自身的静态命令，不属于 ControlCommands，命令协议同类（命令成员经 TemplateBinding 挂给 RangeTrack 内 RepeatButton）。

## 4. 样式族表

无（本条目为命令族，非样式族；消费模板见 [number-box](../keypad-input/number-box.md)、[int-number-box](../keypad-input/int-number-box.md)、[pagable-data-grid](../grid-tree/pagable-data-grid.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零 `commands:` 引用。以下为 P1 模板证据构造。

```xml
<s:NumberBox Value="{Binding …}"/>
<!-- 步进命令已由框架模板挂好：PART_UpButton=Prev / PART_DownButton=Next -->
```

- 页面零命令书写；框架模板统一挂命令 + 图标 + Tag（键垫批）；
- 页面自定义方向按钮可用 `Command="commands:ControlCommands.Prev"` 接入同一语义通道。

## 6. 禁止写法对照

### ❌ 禁止：手写 Click 事件 + 代码增减/翻页（等效替代）

```xml
<Button Click="Up_Click">▲</Button>
<!-- 事件侧：
     private void Up_Click(object sender, RoutedEventArgs e)
     { _value--; … } -->
```

### ✅ 推荐：框架命令

```xml
<Button Command="commands:ControlCommands.Prev" …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：命令语义通道丢失——框架命令的 CanExecute（禁用态步进钮自动置灰）与边界钳制（值域上下限）事件版必须手写实现且行为分叉；
2. **③ 无法样式族切换**：命令与模板（PART_UpButton/DownButton、PrevBtn/NextBtn）绑定机制失效，换样式族后按钮失联；
3. **① 丢失状态**：命令与值域/页码状态联动（禁用、边界）由框架统一管理，手写事件在边界/只读/禁用叠加时状态错乱；
4. **④ 代码分散**：业务逻辑（步进、翻页）倒退回页面代码后置，与框架 MVVM 风格冲突（见 00-guide 写作范式）。

## 7. 参考锚点

- 命令消费：`{source_root}/SDC/Style/NumberBox.xaml`（`commands:` xmlns :5、PART_UpButton :123、PART_DownButton :132）、`{source_root}/SDC/Style/IntNumberBox.xaml`（:69/79/244/265）、`{source_root}/SDC/Style/StringNumberBox.xaml`（:71/79）
- 翻页消费：`{source_root}/SDC/Style/DataGrid.xaml`（PART_PrevBtn :849、PART_NextBtn :864，Up/DownTriangleGeometry）
- 关联命令：`{source_root}/SDC/Style/Slider.xaml`（`controls:RangeSlider.IncreaseLarge/DecreaseLarge/CenterLarge` :206/209/212、:250/253/256、:357/359/362）
- 真实使用：无（ManualView.xaml 不含命令引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_NumberBox.xaml.json`

## 8. 待确认项

- **TD-052**（新）：ControlCommands 命令族——除 Prev/Next 外全集未知；命令类型（静态 RoutedCommand/自实现 ICommand）与 CanExecute 行为待 .cs 确认。
- **TD-034**（复用）：NumberBox 家族 Prev/Next 与数值增减的映射语义（上下/左右 +/- 布局命令分配：LeftRight 布局左"-"=Next 右"+"=Prev 的反向映射）。
- **TD-042**（复用）：DataGrid 分页家族 Prev/Next 与 Pagination 家族 Tag 协议的关联语义。
