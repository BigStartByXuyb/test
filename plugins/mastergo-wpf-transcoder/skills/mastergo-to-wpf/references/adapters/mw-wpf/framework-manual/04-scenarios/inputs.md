<!-- evidence=部分确认(属性/模板/触发器为 P1 模板源码直接证据；数值语义与键垫弹出机制 .cs 不可见);
     pending=[TD-034,TD-035,TD-036,TD-039,TD-030,TD-032,TD-044,TD-006]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/NumberBox.xaml, {source_root}/SDC/Style/IntNumberBox.xaml, {source_root}/SDC/Style/NumericKeypad.xaml, {source_root}/SDC/Style/StringNumericKeypad.xaml, {source_root}/SDC/Style/ComboBox.xaml, {source_root}/ManualView.xaml]
     反例有效性（grep 验证）：ManualView.xaml 零原生 <TextBox>/<ComboBox>/<ListBox>/<Popup>/<CheckBox>（0 命中，输入与下拉场景页面均走框架控件）；SDC/Style 无页面级拼装结构——SelectionMode="Multiple" 仅存在于 MultiComboBox 自身模板 PART_ListBox（ComboBox.xaml:359/370/455/471），与反例结构不同源。本文件反例结构（手写步进按钮 / 手写键盘 Popup / TextBox+ListBox 拼装下拉）不出现在真实页面。 -->

# 场景：④ 数字输入键盘 ⑤ 多选下拉

---

# 场景④ 数字输入键盘

> **关键规则**：数值/整数录入一律用 `s:NumberBox` / `s:IntNumberBox`（步进、钳制、错误态内建），需要弹出键盘时挂 `controls:NumericKeypadAttach.IsEnabled`，独立键盘弹板用 `s:NumericKeypad` / `s:StringNumericKeypad`（字母+符号）。

## 场景描述

数值/整数参数输入：悬停步进、范围钳制、错误提示、可选弹出数字键盘（如参数配置行、时分秒、坐标输入）。

## 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 数值输入（步进/钳制） | NumberBox | [number-box](../02-controls/keypad-input/number-box.md) |
| 整数输入（时分秒/页码/计数） | IntNumberBox | [int-number-box](../02-controls/keypad-input/int-number-box.md) |
| 弹出键盘开关 | `controls:NumericKeypadAttach.IsEnabled` | [numeric-keypad-attach](../02-controls/attached-props/numeric-keypad-attach.md) |
| 独立数字键盘弹板 | NumericKeypad | [numeric-keypad](../02-controls/keypad-input/numeric-keypad.md) |
| 全键盘（字母+符号） | StringNumericKeypad | [string-numeric-keypad](../02-controls/keypad-input/string-numeric-keypad.md) |
| 步进/增减命令 | ControlCommands.Prev/Next | [control-commands](../02-controls/attached-props/control-commands.md) |

## 对照

### ❌ 禁止：常规 WPF 写法（手写 Border + TextBox + 步进按钮 + 自绘状态/键盘）

```xml
<Border CornerRadius="3" BorderBrush="#999999" BorderThickness="1" Background="White">
    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="18"/>
        </Grid.ColumnDefinitions>
        <TextBox x:Name="num" BorderThickness="0" Background="Transparent"
                 Padding="5,0" VerticalContentAlignment="Center"/>
        <Grid Grid.Column="1" x:Name="updown" Visibility="Collapsed">
            <Button Content="▲" Click="Up_Click"/>
            <Button Content="▼" Grid.Row="1" Click="Down_Click"/>
        </Grid>
    </Grid>
</Border>
<!-- 再手写：悬停显示步进钮、聚焦换边框色、范围校验、错误红框红字、禁用半透明、软键盘 Popup… -->
```

```csharp
private void Up_Click(object sender, RoutedEventArgs e)
{
    var v = int.Parse(num.Text) + 1;        // 手写步进
    if (v > 100) v = 100;                   // 手写钳制
    num.Text = v.ToString();
}
```

### ✅ 推荐：框架写法（原样摘自已写条目）

数值输入（number-box.md §5 典型用法）：

```xml
<s:NumberBox Value="{Binding …参数}"
             Minimum="0" Maximum="100" />
```

打开弹出键盘（numeric-keypad-attach.md §5）：

```xml
<s:NumberBox controls:NumericKeypadAttach.IsEnabled="True"
             Value="{Binding …}"/>
```

整数 + 显式关闭键垫（int-number-box.md §5 组合模板原样，DateTimeSelector.xaml:35 小时框）：

```xml
<controls:IntNumberBox x:Name="PART_HourNumberBox" Style="{StaticResource LeftRightButtonIntNumberBoxStyle}" UseTriangleGeometry="True" Width="120" Height="30" VerticalAlignment="Center" Maximum="23" Minimum="0"  controls:NumericKeypadAttach.IsEnabled="False"/>
```

独立键盘弹板（numeric-keypad.md §5）：

```xml
<s:NumericKeypad />
```

说明：Value/Minimum/Maximum 钳制语义与键垫弹出机制为 🟡 [待确认 TD-034/TD-035]，**调用形式已确认、按上例书写即可，不得自行扩展语法**；IsWaitingAccept 历史值浮层语义见 TD-036，功能键 Tag 协议见 TD-030。

## 禁止原因（≥3 条）

1. **① 丢失状态**：手写版缺失 8 组交互触发器——Hover/聚焦 #FF409EFF、错误态（IsError 红字红框；IntNumberBox 为 IsError+聚焦双条件并联动 Poptip）、只读灰底 #FFF0F0F0、禁用 Opacity 0.56、IsWaitingAccept 历史值浮层（number-box.md §3 属性表 / int-number-box.md §3）；
2. **② 丢失协议挂点**：`controls:NumericKeypadAttach.IsEnabled` 键垫弹出/焦点移交（TD-035）、`ControlCommands.Prev/Next` 增减命令（TD-034）全无——手写 Popup 与框架键垫控件族（NumericKeypad/StringNumericKeypad）零集成，且 `NumericKeypadAttach` 宿主定义本身待确认（TD-032）；
3. **③ 无法样式族切换**：不能一键 NumberBoxBaseStyle→LeftRightButtonNumberBoxStyle 切换上下/左右步进布局，也失去 IntNumberBox 模板硬编码 `MaxLength="9"` 的统一输入约束；
4. **④ 数值语义自研**：Minimum/Maximum 钳制与值域边界（TD-034 待确认）手写必然分叉（整数越界、输入法残留、边界按键状态错乱）；
5. **⑤ 脱离视觉规范**：Padding 5,0、字号 14（SubHeaderFontSize）、尺寸 Token（100×35）、IsTabStop=False 散写失控。

## 证据来源

- 模板证据：{source_root}/SDC/Style/NumberBox.xaml（锚点 `x:Key="NumberBoxBaseStyle"`、`Trigger Property="IsError"`、`controls:NumericKeypadAttach.IsEnabled` :179-181）、{source_root}/SDC/Style/IntNumberBox.xaml（锚点 `x:Key="LeftRightButtonIntNumberBoxStyle"`、`MaxLength="9"`）、{source_root}/SDC/Style/NumericKeypad.xaml（锚点 `x:Key="KeyButtonStyle"`、Tag 字面量 :147/:158/:162/:163）
- 组合原样：{source_root}/SDC/Style/DateTimeSelector.xaml:35（PART_HourNumberBox）、{source_root}/SDC/Style/Pagination.xaml（S_TextB 页码框）
- 真实页面：无（ManualView.xaml 未使用输入框家族——反例结构亦未出现，见文件头）

---

# 场景⑤ 多选下拉

> **关键规则**：多选下拉一律用 `s:MultiComboBox`（搜索 + 全选 + 勾选列表一体）；单值搜索下拉用 `s:SingleComboBox`；IO 联动的普通下拉用 `s:IOComboBox`（见 [io-combo-box](../02-controls/io/io-combo-box.md)）。

## 场景描述

从大量选项中选择多个值：下拉内搜索、全选复选、勾选列表。

## 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 多选 + 搜索 + 全选 | MultiComboBox（DefaultMultiComboBox） | [multi-combo-box](../02-controls/grid-tree/multi-combo-box.md) |
| 单值搜索下拉 | SingleComboBox | multi-combo-box.md §3 |
| 输入型双模板切换 | `IsEditable="True"` | multi-combo-box.md §3 |
| IO 版普通下拉（区分） | IOComboBox | [io-combo-box](../02-controls/io/io-combo-box.md) |

## 对照

### ❌ 禁止：常规 WPF 写法（手写 TextBox + Popup + ListBox（CheckBox 项）拼装）

```xml
<Grid Width="100" Height="35">
    <TextBox x:Name="search"/>
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

### ✅ 推荐：框架写法（原样摘 multi-combo-box.md §5）

```xml
<s:MultiComboBox ItemsSource="{Binding …选项集合}"
                 ItemsSourceSearch="{Binding …搜索结果}"
                 DisplayMemberPath="…"
                 Text="{Binding …已选文本}"/>
```

说明：搜索触发机制、全选联动、勾选项→Text 汇总规则为 🟡 [待确认 TD-044]，**调用形式已确认、按上例书写即可**；SingleComboBox 弹层行为待确认（TD-044），目前仅可作搜索框使用；`LoggerViewInputQueryKeyword` 跨业务文本键定义位置见 TD-004。

## 禁止原因（≥3 条）

1. **① 丢失状态**：手写版没有框体三态（Hover/IsOpen/Disabled 画刷族）、项勾选模板（CheckItemStyle 分隔线 + ComboBoxItemHeight=35 项高）、搜索切换双 ListBox（PART_ListBox / PART_ListBoxSearch）的显隐联动；
2. **② 丢失协议挂点**：`ItemsSourceSearch` 搜索结果协议、`controls:DropDownElement.ConsistentWidth` 等宽、`controls:WatermarkElement.Watermark` 水印协议全无（multi-combo-box.md §6 ②；附加属性参数类型待确认 TD-006）；
3. **③ 无法样式族切换**：`IsEditable` 双模板（MultiComboBoxTemplate ⇄ MultiComboBoxEditableTemplate）与 EditableComboBox_* 双画刷族切换机制无法复刻（multi-combo-box.md §3）；
4. **④ 绕过本地化**：手写「搜索…」/「All」硬编码绕过 `LoggerViewInputQueryKeyword` 文本键体系（跨业务引用键，TD-044/TD-004）。

## 证据来源

- 模板证据：{source_root}/SDC/Style/ComboBox.xaml（锚点 `x:Key="DefaultMultiComboBox"`、`x:Key="MultiComboBoxTemplate"`、`x:Key="MultiComboBoxEditableTemplate"`、`x:Key="CheckItemStyle"`、`PART_SearchTextBox`、`PART_SelectAllBox`、`PART_ListBox`）
- 真实页面：无（ManualView.xaml 与 Demo 均不含本控件）
- 对照：IO 版 [io-combo-box](../02-controls/io/io-combo-box.md)
