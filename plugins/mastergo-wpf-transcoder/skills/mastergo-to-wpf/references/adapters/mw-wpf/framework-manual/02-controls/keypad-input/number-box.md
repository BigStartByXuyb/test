<!-- evidence=已确认(属性 Setter/模板/触发器均为模板源码直接证据；数值语义与附加属性行为 .cs 不可见); pending=[TD-034,TD-035,TD-036];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/NumberBox.xaml, {source_root}/SDC/Style/IOListBox.xaml, {source_root}/SDC/Style/Slider.xaml, {source_root}/ManualView.xaml] -->

# NumberBox（数字输入框）

## 1. 用途

框架版数字输入框：组合原生 TextBox（PART_TextBox）+ 悬停浮现的上下步进按钮（ShowUpDownButton）+ 历史值浮层（IsWaitingAccept / oldValueBorder）+ 弹出数字键盘挂点（Pop_keyBoard / NumericKeypadAttach），内建 8 组交互触发器（Hover/聚焦蓝 #FF409EFF、只读灰底 #FFF0F0F0、错误红字红框、禁用半透明 0.56）。用于数值录入场景。

典型场景（推断，无 P2 实例）：组合模板中的数值配置行——IOListBox.xaml 进度条参数行（Value/Minimum/Maximum 一行绑定）、Slider.xaml 右侧数值显示（`ShowUpDownButton="False"` 隐藏步进钮）。

## 2. 声明

```xml
<s:NumberBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:NumberBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。模板根为 ContentControl、内部组合原生 TextBox（PART_TextBox）——独立控件而非 TextBox 子类（模板证据；基类确认待 .cs）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Value | 数值（类型待确认） | 当前值；组合模板中直接绑定数据源 | IOListBox.xaml `<controls:NumberBox  Value="{Binding Y}" …>`、Slider.xaml `Value="{Binding Value,…,StringFormat=N2}"` | 🟡 [待确认 TD-034] |
| Minimum / Maximum | 数值 | 取值范围；组合模板可见 | IOListBox.xaml `Minimum="0" Maximum="100"` | 🟡 [待确认 TD-034] |
| ShowUpDownButton | bool | True 且悬停时显示上下步进钮（模板 MultiTrigger）；Slider.xaml 显式设 False | 模板 `MultiTrigger`（IsMouseOver + ShowUpDownButton）+ Slider.xaml | ✅ |
| UseTriangleGeometry | bool | True 时左右步进钮切三角几何图标（PreviousButtonGeometry/NextButtonGeometry）并清空 +/- 文字 | LeftRightButtonNumberBoxStyle `Trigger Property="UseTriangleGeometry"` | 🟡 [待确认 TD-034] |
| IsError | bool | 错误态：红边框红字 | 模板 `Trigger Property="IsError"` | ✅ |
| IsWaitingAccept | bool | True 时右侧浮现历史值浮层 oldValueBorder（ToolTip 显示旧值） | 模板 `Trigger Property="IsWaitingAccept"` + `x:Name="oldValueBorder"` | 🟡 [待确认 TD-036] |
| IsReadOnly | bool | 只读：灰底 #FFF0F0F0、灰边 #FFB0B0B0、步进钮禁用并隐藏 | 模板 `Trigger Property="IsReadOnly"` | ✅ |
| IsEnabled | bool | 禁用：Opacity 0.56 | 模板 `Trigger Property="IsEnabled"` | ✅ |
| controls:BorderElement.CornerRadius | 3（默认） | 圆角附加属性，模板 Border 消费 | NumberBoxBaseStyle Setter + 模板 `CornerRadius="{Binding Path=(controls:BorderElement.CornerRadius),…}"` | ✅ |
| controls:NumericKeypadAttach.IsEnabled | bool | True 时 PART_TextBox Focusable=False（输入交由弹出键垫）；Popup 内容注入 .cs 不可见 | 模板 `Trigger Property="controls:NumericKeypadAttach.IsEnabled"` | 🟡 [待确认 TD-035] |
| Height / Width | DynamicResource TextBoxHeight（35）/ TextBoxWidth（100） | 默认尺寸走 Sizes Token | NumberBoxBaseStyle Setter + `{source_root}/SDC/Sizes.xaml` `x:Key="TextBoxHeight"`/`x:Key="TextBoxWidth"` | ✅ |
| HorizontalContentAlignment | DynamicResource TextHorizontalAlignment（Right） | 内容默认右对齐 | Setter + `{source_root}/SDC/RightAlignment.xaml` `x:Key="TextHorizontalAlignment"` | ✅ |
| FontSize | DynamicResource SubHeaderFontSize（14） | 字号 Token | Setter + `{source_root}/SDC/Fonts.xaml` `x:Key="SubHeaderFontSize"` | ✅ |
| Background / BorderBrush / BorderThickness / Foreground / VerticalContentAlignment / IsTabStop / FocusVisualStyle | — | 默认 #fff / BorderBrush / 1 / TextBrush / Center / False / {x:Null} | NumberBoxBaseStyle 各 Setter | ✅ |
| （无 IOEnable / s:Action / PageName 证据） | — | 模板无协议挂点；IOEnable 使用面仅见 IconButton | 模板全文 + `{source_root}/ManualView.xaml` | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\NumberBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| InputTextBoxBase | 无 | 文本框宿主基样式：Padding 5,0、AllowDrop、OverridesDefaultStyle=true、PART_ContentHost 模板 | 内部共用（本家族所有模板的 PART_TextBox），不直接用 |
| UpdownButtonStyle | 无 | 上下步进钮：透明底、圆角 0 2 0 0、Hover=HoverBrush / Pressed=PrimaryBrush、禁用 Opacity 0.4 | 内部共用，不直接用 |
| NumberBoxDefaultTemplate | —（ControlTemplate） | 默认模板：PART_TextBox + Updown（PART_UpButton=Prev / PART_DownButton=Next）+ oldValueBorder + Pop_keyBoard；7 组触发器 | 内部模板键（NumberBoxBaseStyle.Template 引用） |
| NumberBoxBaseStyle | 无（独立） | 默认 Setter 全集（Token 尺寸 35×100）+ 默认模板 | 基样式，不直接用 |
| （隐式默认样式） | NumberBoxBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |
| LeftRightButtonStyle | 无 | IconButton 样式的左右步进钮：Text+Path 层叠、PrimaryToolBrush 触发、禁用 0.4 | 内部共用（本家族左右布局变体） |
| LeftRightButtonNumberBoxStyle | 无 | 左右布局变体：35×120、左 "-"（Next）/ 右 "+"（Prev）、聚焦文本左对齐、错误红、UseTriangleGeometry 切图标 | 左右步进数字输入 |

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 未使用 NumberBox。以下为 P1 组合模板原样证据 + 模板证据构造。

组合模板原样（IOListBox.xaml，进度条参数配置行）：

```xml
<controls:NumberBox  Value="{Binding Y}"  Minimum="0" Maximum="100" />
```

组合模板原样（Slider.xaml，数值显示：隐藏步进钮 + 无边框 + 圆角归零 + 右对齐被覆盖）：

```xml
<controls:NumberBox x:Name="PART_TextBox" Width="50"  FontSize="{DynamicResource TextFontSize}" Background="{DynamicResource PrimaryDefaultBrush}" HorizontalAlignment="Left"  BorderThickness="0" controls:BorderElement.CornerRadius="0"  Foreground="{DynamicResource PrimaryTextBrush}" ShowUpDownButton="False" Value="{Binding Value,RelativeSource={RelativeSource AncestorType=Slider},StringFormat=N2}" VerticalAlignment="Center"/>
```

典型用法（模板证据构造）：

```xml
<s:NumberBox Value="{Binding …参数}"
             Minimum="0" Maximum="100" />
```

- Value / Minimum / Maximum 直接数据绑定，数值钳制由 .cs 处理（语义待确认 TD-034）；
- 悬停自动浮现上下步进钮；`ShowUpDownButton="False"` 可隐藏（Slider 组合用法）；
- 只读 / 禁用 / 错误三态由 IsReadOnly / IsEnabled / IsError 标准属性驱动，页面侧零模板代码；
- 尺寸、圆角、字号默认已含（100×35、圆角 3、14），页面只需数据绑定。

## 6. 禁止写法对照

### ❌ 禁止：手写 Border + TextBox + 双 Button 步进 + 自绘状态（常规 WPF 写法）

```xml
<Border CornerRadius="3" BorderBrush="{StaticResource …}" BorderThickness="1" Background="White">
    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="18"/>
        </Grid.ColumnDefinitions>
        <TextBox x:Name="tb" BorderThickness="0" Background="Transparent" Padding="5,0"
                 VerticalContentAlignment="Center"/>
        <Grid Grid.Column="1" x:Name="updown" Visibility="Collapsed">
            <Button Content="▲" Click="Up_Click"/>
            <Button Content="▼" Grid.Row="1" Click="Down_Click"/>
        </Grid>
    </Grid>
</Border>
<!-- 再手写：悬停显示步进钮、聚焦换边框色、错误红框、只读灰底、禁用半透明、软键盘 Popup… -->
```

### ✅ 推荐：NumberBox 一行属性化（模板证据构造）

```xml
<s:NumberBox Value="{Binding …参数}" Minimum="0" Maximum="100" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版缺失 8 组触发态——Hover/聚焦 #FF409EFF、错误红字红框（IsError）、只读灰 #FFF0F0F0/#FFB0B0B0、禁用 Opacity 0.56、IsWaitingAccept 历史值浮层；
2. **② 丢失协议挂点**：NumericKeypadAttach（数字键盘弹出）、BorderElement.CornerRadius 附加属性协议全无，键垫与圆角只能硬编码在页面；
3. **③ 无法样式族切换**：不能一键 NumberBoxBaseStyle→LeftRightButtonNumberBoxStyle 切换上下/左右步进布局；
4. **④ 步进命令语义缺失**：ControlCommands.Prev/Next 与上下（及左右 +/-）按钮的映射由框架封装，手写 Button 无对应协议（TD-034）；
5. **⑤ 脱离视觉规范**：Padding 5,0、字号 14、IsTabStop=False、尺寸 Token（100×35）散写失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/NumberBox.xaml`（锚点 `x:Key="NumberBoxBaseStyle"`、`x:Key="NumberBoxDefaultTemplate"`、`x:Key="LeftRightButtonNumberBoxStyle"`、`x:Name="PART_TextBox"`、`Trigger Property="IsError"` / `"IsWaitingAccept"` / `"ShowUpDownButton"`）
- 组合使用：`{source_root}/SDC/Style/IOListBox.xaml`（`<controls:NumberBox …>` 原样用法）、`{source_root}/SDC/Style/Slider.xaml`（`PART_TextBox` 原样用法）
- Token：`{source_root}/SDC/Sizes.xaml`（`x:Key="TextBoxWidth"`=100 / `x:Key="TextBoxHeight"`=35）、`{source_root}/SDC/Fonts.xaml`（`x:Key="SubHeaderFontSize"`=14）、`{source_root}/SDC/RightAlignment.xaml`（`x:Key="TextHorizontalAlignment"`=Right）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_NumberBox.xaml.json`

## 8. 待确认项

- **TD-034**：Value / Minimum / Maximum / ShowUpDownButton / UseTriangleGeometry 数值属性语义（类型、钳制行为、默认值）与 ControlCommands.Prev/Next 增减映射（见本文件 §5 组合证据）。
- **TD-035**：NumericKeypadAttach.IsEnabled 键垫弹出机制（Pop_keyBoard 内容注入、Focusable=False 联动，关联键垫控件批次 NumericKeypad.xaml）。
- **TD-036**：IsWaitingAccept 语义与 oldValueBorder 历史值数据来源（oldValueBlock 模板内无绑定，.cs 注入；家族无 oldValueBorder 变体见 StringNumberBox/SwitchBox 条目）。
