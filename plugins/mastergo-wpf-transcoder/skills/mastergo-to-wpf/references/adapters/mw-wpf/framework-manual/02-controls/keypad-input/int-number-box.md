<!-- evidence=已确认(属性 Setter/模板/触发器均为模板源码直接证据；数值语义与附加属性行为 .cs 不可见); pending=[TD-034,TD-035,TD-036,TD-039];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/IntNumberBox.xaml, {source_root}/SDC/Style/DateTimeSelector.xaml, {source_root}/SDC/Style/Pagination.xaml, {source_root}/ManualView.xaml] -->

# IntNumberBox（整数输入框）

## 1. 用途

框架版整数输入框：与 NumberBox 同构的数字输入控件（PART_TextBox + 悬停步进钮 + 弹出键盘挂点 + 历史值浮层），差异面——模板内硬编码 MaxLength=9、错误态为双条件（IsError + 聚焦）并联动 `Poptip.IsOpen`。用于整数录入（时分秒、页码、计数等）。

典型场景（P1 组合模板证据）：DateTimeSelector.xaml 时分秒三连（`LeftRightButtonIntNumberBoxStyle` + `UseTriangleGeometry="True"` + Maximum/Minimum 范围）、Pagination.xaml 页码跳转（Value 双向绑定页索引）。

## 2. 声明

```xml
<s:IntNumberBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IntNumberBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件经 MergedDictionaries 引用 NumberBox.xaml，复用其 `InputTextBoxBase` / `UpdownButtonStyle` / `LeftRightButtonStyle` 三个共享键；模板结构（Grid + Border + PART_TextBox + Updown + Pop_keyBoard）与 NumberBox 逐键同构，仅 TargetType 与差异项不同（见 §4）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Value | 整数（类型待确认） | 当前值；Pagination 中双向绑定页索引 | Pagination.xaml `<controls:IntNumberBox … Value="{Binding Index,RelativeSource={RelativeSource TemplatedParent},UpdateSourceTrigger=PropertyChanged}" …>` | 🟡 [待确认 TD-034] |
| Minimum / Maximum | 整数 | 取值范围；组合模板直接赋值或绑定 | DateTimeSelector.xaml `Maximum="23" Minimum="0"`、Pagination.xaml `Minimum="1" Maximum="{Binding PageCount,…}"` | 🟡 [待确认 TD-034] |
| UseTriangleGeometry | bool | True 时左右步进钮切 PreviousButtonGeometry/NextButtonGeometry 三角图标并清空 +/- 文字 | LeftRightButtonIntNumberBoxStyle `Trigger Property="UseTriangleGeometry"` + DateTimeSelector.xaml `UseTriangleGeometry="True"` | 🟡 [待确认 TD-034] |
| IsError | bool | 错误态：**双条件**（IsError + PART_TextBox 聚焦）才红框红字并打开 Poptip | 模板 `MultiTrigger`（IsError + IsFocused SourceName=PART_TextBox）+ `controls:Poptip.IsOpen=True` | ✅（触发条件）/ 🟡 TD-039 |
| IsWaitingAccept | bool | True 时显示历史值浮层 oldValueBorder（基样式模板；**左右布局变体无此能力**） | 基样式模板 `Trigger Property="IsWaitingAccept"` + `x:Name="oldValueBorder"` | 🟡 [待确认 TD-036] |
| IsReadOnly | bool | 只读：灰底 #FFF0F0F0、灰边 #FFB0B0B0、步进钮禁用并隐藏（基样式模板） | 模板 `Trigger Property="IsReadOnly"` | ✅ |
| IsEnabled | bool | 禁用：Opacity 0.56 | 模板 `Trigger Property="IsEnabled"` | ✅ |
| controls:NumericKeypadAttach.IsEnabled | bool | True 时 PART_TextBox Focusable=False；DateTimeSelector 组合用法显式设 False | 模板 `Trigger Property="controls:NumericKeypadAttach.IsEnabled"` + DateTimeSelector.xaml | 🟡 [待确认 TD-035] |
| controls:BorderElement.CornerRadius | 3 | 附加属性圆角；**基样式模板 CornerRadius="3" 为硬编码**（未走 TemplateBinding），左右布局变体才消费附加属性 | 基样式模板字面量 vs LeftRight 模板绑定 | 🟡 TD-039 |
| MaxLength | 9（模板内硬编码） | 输入长度上限写死在模板 PART_TextBox，非公开属性 | 基样式与左右布局模板 PART_TextBox `MaxLength="9"` | ✅（模板字面量） |
| Height / Width | DynamicResource TextBoxHeight（35）/ TextBoxWidth（100） | 默认尺寸 Token | IntNumberBoxBaseStyle Setter + Sizes.xaml | ✅ |
| HorizontalContentAlignment / FontSize / Foreground / VerticalContentAlignment / IsTabStop / FocusVisualStyle / Background / BorderBrush | — | 与 NumberBoxBaseStyle 同 Token 族（TextHorizontalAlignment / SubHeaderFontSize / TextBrush / Center / False / {x:Null} / #FFFFFFFF / BorderBrush） | IntNumberBoxBaseStyle 各 Setter | ✅ |
| （无 IOEnable / s:Action / PageName 证据） | — | 模板无协议挂点 | 模板全文 + `{source_root}/ManualView.xaml` | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\IntNumberBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IntNumberBoxBaseStyle | 无（独立；合并 NumberBox.xaml） | 默认 Setter 全集 + 独立模板：PART_TextBox（MaxLength=9）、Updown（按钮无 PART 命名）、oldValueBorder、Pop_keyBoard；触发态 Hover/聚焦 #FF409EFF、错误双条件 + Poptip.IsOpen | 基样式，不直接用 |
| （隐式默认样式） | IntNumberBoxBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |
| LeftRightButtonIntNumberBoxStyle | 无 | 35×120 左右布局：左 "-"（Next）/ 右 "+"（Prev）、聚焦/悬停 **PrimaryBrush**（NumberBox 版为 PrimaryToolBrush）、BorderBrush=**BorderBrush**（NumberBox 版 ButtonBorderGradientBrush）、UseTriangleGeometry 清 Content 用 **" "**（NumberBox 版 ""）、错误双条件 + Poptip、**无 oldValueBorder/IsWaitingAccept** | 左右步进整数输入（DateTimeSelector 时分秒、Pagination 页码） |
| （共享键来自 NumberBox.xaml） | — | InputTextBoxBase / UpdownButtonStyle / LeftRightButtonStyle（经 MergedDictionaries 引用，定义见 number-box 条目 §4） | 内部共用 |

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 未使用 IntNumberBox。以下为 P1 组合模板原样证据 + 模板证据构造。

组合模板原样（DateTimeSelector.xaml，时分秒三连中的小时框）：

```xml
<controls:IntNumberBox x:Name="PART_HourNumberBox" Style="{StaticResource LeftRightButtonIntNumberBoxStyle}" UseTriangleGeometry="True" Width="120" Height="30" VerticalAlignment="Center" Maximum="23" Minimum="0"  controls:NumericKeypadAttach.IsEnabled="False"/>
```

组合模板原样（Pagination.xaml，页码跳转框）：

```xml
<controls:IntNumberBox x:Name="S_TextB"
        Width="60"
        Height="30" 
        Minimum="1"
        Maximum="{Binding PageCount,RelativeSource={RelativeSource TemplatedParent},UpdateSourceTrigger=PropertyChanged}"
        InputMethod.IsInputMethodEnabled="False"
        Value="{Binding Index,RelativeSource={RelativeSource TemplatedParent},UpdateSourceTrigger=PropertyChanged}"
        Margin="5,0" 
       />
```

典型用法（模板证据构造）：

```xml
<s:IntNumberBox Value="{Binding …整数参数}"
                Minimum="0" Maximum="999"
                controls:NumericKeypadAttach.IsEnabled="False" />
```

- 与 NumberBox 同族写法：Value / Minimum / Maximum 数据绑定即可，MaxLength=9 与钳制语义由 .cs/模板处理（TD-034）；
- `controls:NumericKeypadAttach.IsEnabled="False"` 关闭弹出键盘改走硬件输入（DateTimeSelector 组合用法原样）；
- 需要左右步进布局时显式 `Style="{StaticResource LeftRightButtonIntNumberBoxStyle}"`（DateTimeSelector 用法）。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBox + 步进 Button + 自绘错误提示（常规 WPF 写法）

```xml
<Grid>
    <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/>
        <ColumnDefinition Width="18"/>
    </Grid.ColumnDefinitions>
    <TextBox x:Name="num" MaxLength="9" VerticalContentAlignment="Center" Padding="5,0"
             InputMethod.IsInputMethodEnabled="False"/>
    <Grid Grid.Column="1">
        <Button Content="▲" Click="NumUp_Click"/>
        <Button Content="▼" Grid.Row="1" Click="NumDown_Click"/>
    </Grid>
</Grid>
<!-- 再手写：数值范围校验、越界红框红字、Poptip 提示、聚焦恢复、禁用半透明… -->
```

### ✅ 推荐：IntNumberBox 一行属性化（模板证据构造）

```xml
<s:IntNumberBox Value="{Binding …整数参数}" Minimum="0" Maximum="999" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版缺失双条件错误态（IsError + 聚焦红框红字 + Poptip 打开）、Hover/聚焦 #FF409EFF、只读灰底、禁用 Opacity 0.56、IsWaitingAccept 历史值浮层；
2. **② 丢失协议挂点**：NumericKeypadAttach / Poptip / BorderElement.CornerRadius 附加属性协议全无，错误提示只能自绘 ToolTip；
3. **③ 无法样式族切换**：不能一键 IntNumberBoxBaseStyle→LeftRightButtonIntNumberBoxStyle（上下↔左右步进）切换，也失去 MaxLength=9 的框架统一约束；
4. **④ 数值语义缺失**：Minimum/Maximum 钳制与 ControlCommands.Prev/Next 增减协议由框架封装（TD-034），手写需要自己实现整套校验逻辑；
5. **⑤ 脱离视觉规范**：尺寸 Token（100×35）、字号 14、IsTabStop=False 全部散写失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IntNumberBox.xaml`（锚点 `x:Key="IntNumberBoxBaseStyle"`、`x:Key="LeftRightButtonIntNumberBoxStyle"`、`x:Name="PART_TextBox"`、`MultiTrigger`（IsError+IsFocused）、`MaxLength="9"`）
- 组合使用：`{source_root}/SDC/Style/DateTimeSelector.xaml`（`PART_HourNumberBox`/`PART_MinuteNumberBox`/`PART_SecondNumberBox`）、`{source_root}/SDC/Style/Pagination.xaml`（`S_TextB`）
- 共享键定义：`{source_root}/SDC/Style/NumberBox.xaml`（`x:Key="InputTextBoxBase"`、`x:Key="UpdownButtonStyle"`、`x:Key="LeftRightButtonStyle"`）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IntNumberBox.xaml.json`

## 8. 待确认项

- **TD-034**：Value / Minimum / Maximum / UseTriangleGeometry 数值属性语义（类型、钳制、默认值）与 ControlCommands.Prev/Next 增减映射。
- **TD-035**：NumericKeypadAttach.IsEnabled 键垫弹出机制（组合模板显式设 False 的意图）。
- **TD-036**：IsWaitingAccept 与 oldValueBorder 历史值机制（本控件左右布局变体未实现该能力，是否为有意裁剪）。
- **TD-039**：错误态差异面——基样式模板 CornerRadius=3 硬编码未走 BorderElement、错误 MultiTrigger 打开 Poptip 但模板内无 `Poptip.Instance` 声明（与 StringNumberBox 三件套的 Poptip.Instance 结构不一致，挂载方式待确认）。
