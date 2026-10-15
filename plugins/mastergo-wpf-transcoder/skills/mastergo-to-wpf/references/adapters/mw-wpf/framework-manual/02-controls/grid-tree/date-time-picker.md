<!-- evidence=部分确认(模板/部件均为 P1 直接证据；属性语义与 .cs 联动待确认); pending=[TD-046,TD-006];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/DateTimePicker.xaml, {source_root}/SDC/Style/DateTimeSelector.xaml, {source_root}/ManualView.xaml] -->

# DateTimePicker / DateTimeSelector（日期时间选择器）

## 1. 用途

两文件两个控件（DateTimePicker 内嵌 DateTimeSelector）：

- **DateTimePicker（DateTimePicker.xaml）**：160×40 日期时间输入框——左侧输入（`PART_TextBox`，带 `ControlSelectDateTime` 水印）+ 右侧日历图标按钮（`PART_SelectedButton`，30×30，点击变蓝 #2561a9），点击弹出 StackPanel：**DateTimeSelector 日历面板 + 底部 现在/清除/确认 三按钮（`PART_NowButton`/`PART_ClearButton`/`PART_ConfirmButton`）**；
- **DateTimeSelector（DateTimeSelector.xaml）**：日历 + 右侧时/分/秒调节面板——`PART_Calender`（SingleDate 单选）+ 220 宽面板（顶部标题 `PART_TextBlock` 显示 `TextOfTextBlock`，下方三行 Label+`IntNumberBox`：时 0-23/分 0-59/秒 0-59，`LeftRightButtonIntNumberBoxStyle` 左右钮样式、禁用软键盘 `NumericKeypadAttach.IsEnabled=False`）。

典型场景（推断，无 P2 实例）：工艺参数中的日期时间设定弹层。

## 2. 声明

```xml
<s:DateTimePicker … />，s = http://www.maxwell-gp.com/
<s:DateTimeSelector … />
```

TargetType = `controls:DateTimePicker` / `controls:DateTimeSelector`（MaxwellControl.Controls，私有程序集）。两控件均为**隐式默认样式**；DateTimeSelector 另具名 `DateTimeSelectorBaseStyle` 基样式。合并字典：DateTimePicker.xaml 仅 BaseStyle.xaml；DateTimeSelector.xaml 合并 BaseStyle.xaml + **IntNumberBox.xaml**（时/分/秒控件复用）。

## 3. 关键属性表

### DateTimePicker

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| WatermarkElement.Watermark | string | 输入框水印 = `ControlSelectDateTime` 文本键 | 隐式样式 Setter | ✅（语义 TD-006） |
| Height / Width | double | 40 / 160（模板内 PART_TextBox 固定宽 155） | 隐式样式 Setter + 模板 | ✅ |
| Text | string | 输入框文本（TextBox 模板默认绑定面，模板未显式绑定 Text——.cs 面） | 模板 `PART_TextBox` | 🟡 [待确认 TD-046] |
| PART_SelectedButton | Button | 30×30 日历图标钮（`DateTimePickerButtonStyle`：`CalendarGeometry` 图标、圆角 3、Tag=True → 蓝底 #2561a9 白图标）；IsMouseOver → 框体/按钮描边 #2561a9 | 模板 + `x:Key="DateTimePickerButtonStyle"` | ✅ |
| PART_Popup | Popup | StaysOpen=True、Slide 动画、PlacementTarget=PART_RootBorder；内容=DateTimeSelector（`PART_DateTimeSelector`）+ 按钮条（`PART_ButtonsBorder`） | 模板 Popup | ✅ |
| 底部按钮 | Button | `PART_NowButton`/`PART_ClearButton`/`PART_ConfirmButton`（60×40，`ControlNow`/`ControlClear`/`ControlConfirm` 文本键，`PART_ButtonsBorder` 内 Grid.Row=1 残留属性） | 模板 | 🟡 [待确认 TD-046] |
| 硬编码色值 | Color | #b4b4b4（边框）/ #ffffff/#5f5f5f（文字与图标）/ #2561a9（选中蓝）——无 Token | 模板各 Setter | ✅（记入 TD-046） |

### DateTimeSelector

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| TextOfTextBlock | string | 顶部标题文本（35 高 `HeaderTextGradientBrush` 渐变条） | 模板 `Text="{TemplateBinding TextOfTextBlock}"` | 🟡 [待确认 TD-046] |
| PART_Calender | Calendar | 内嵌框架版日历（SelectionMode=SingleDate、Focusable=True；无显式样式，吃 Calendar.xaml 隐式默认） | 模板 | ✅ |
| 时/分/秒 | IntNumberBox | `PART_HourNumberBox`（0-23）/`PART_MinuteNumberBox`/`PART_SecondNumberBox`（0-59），`LeftRightButtonIntNumberBoxStyle`（IntNumberBox.xaml:212）+ `UseTriangleGeometry=True` + `NumericKeypadAttach.IsEnabled=False` | 模板三行 | ✅ |
| 时间标签 | Label | `ControlHour`/`ControlMinute`/`ControlSecond` 文本键 | 模板 Label | ✅ |

## 4. 样式族表（双文件键名归属）

### DateTimePicker.xaml

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| DateTimePickerButtonStyle | 无 | 日历图标钮：圆角 3、`CalendarGeometry` 图标 15×15、Tag=True → 蓝底白图标 | PART_SelectedButton 内部件 |
| （隐式）DateTimePicker | 无 | 160×40 输入框 + 图标钮 + 弹层（DateTimeSelector+三按钮） | 未显式指定 Style 时（唯一入口） |

### DateTimeSelector.xaml

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| DateTimeSelectorBaseStyle | 无 | 日历 + 220 宽时间面板模板 | 基样式 |
| （隐式）DateTimeSelector | DateTimeSelectorBaseStyle | 全局兜底 | 未显式指定 Style 时 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 均未出现 `s:DateTimePicker`/`s:DateTimeSelector`。

```xml
<s:DateTimePicker/>
```

```xml
<s:DateTimeSelector TextOfTextBlock="{DynamicResource …时间标题键}"/>
```

- DateTimePicker 全交互内置（输入 + 图标钮 + 日历弹层 + 现在/清除/确认），页面零声明即可用；
- DateTimeSelector 供 DateTimePicker 弹层内嵌，也可独立用作"日历+时分秒"面板；
- 日期时间联动（选择→时/分/秒→回写 Text）在 .cs 面，登记 TD-046。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBox + Button + Popup（内嵌 Calendar + 三个 IntNumberBox）拼装等效日期时间选择器（常规 WPF 写法）

```xml
<Grid Width="160" Height="40">
    <TextBox x:Name="dtInput" Margin="0,0,30,0"/>
    <Button Width="30" Click="OpenCalendar_Click">
        <Path Data="{StaticResource CalendarGeometry}" …/>
    </Button>
    <Popup PlacementTarget="{Binding ElementName=dtInput}" IsOpen="{Binding …}">
        <StackPanel>
            <Calendar SelectionMode="SingleDate"/>
            <StackPanel Orientation="Horizontal">
                <Label Content="时"/><TextBox Width="40" x:Name="hourBox"/>
                <Label Content="分"/><TextBox Width="40" x:Name="minuteBox"/>
                <Label Content="秒"/><TextBox Width="40" x:Name="secondBox"/>
            </StackPanel>
        </StackPanel>
    </Popup>
</Grid>
```

### ✅ 推荐：DateTimePicker 属性化

```xml
<s:DateTimePicker/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：日历/时分秒联动、`TextOfTextBlock` 标题协议、`NumericKeypadAttach.IsEnabled` 软键盘禁用约定、图标按钮 Tag 选中态（#2561a9）均无从谈起；
2. **① 丢失状态**：手写版没有图标钮 Tag=True 蓝底白字切换、框体/按钮 IsMouseOver 联动描边（#2561a9）、按钮条三键（现在/清除/确认）行为；
3. **④ 绕过本地化**：硬编码"时/分/秒"绕过 `ControlHour`/`ControlMinute`/`ControlSecond` 文本键体系（模板内 Label 引用）；
4. **⑤ 脱离视觉规范**：160×40 尺寸、`ControlSelectDateTime` 水印、`HeaderTextGradientBrush` 渐变标题、时/分/秒 IntNumberBox（LeftRightButtonIntNumberBoxStyle）等规范失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/DateTimePicker.xaml`（锚点 `x:Key="DateTimePickerButtonStyle"`、隐式 `Style TargetType="{x:Type controls:DateTimePicker}"`、`PART_TextBox`、`PART_SelectedButton`、`PART_Popup`、`PART_DateTimeSelector`、`PART_ButtonsBorder`、`PART_NowButton`/`PART_ClearButton`/`PART_ConfirmButton`、`Trigger Property="Tag" Value="True"`）
- 模板源码：`{source_root}/SDC/Style/DateTimeSelector.xaml`（锚点 `x:Key="DateTimeSelectorBaseStyle"`、隐式默认、`PART_Calender`、`PART_TextBlock`（TextOfTextBlock）、`PART_HourNumberBox`/`PART_MinuteNumberBox`/`PART_SecondNumberBox`）
- 几何：`{source_root}/SDC/Geometries.xaml`（CalendarGeometry）；复用：`{source_root}/SDC/Style/IntNumberBox.xaml`（LeftRightButtonIntNumberBoxStyle:212）；日历：`{source_root}/SDC/Style/Calendar.xaml`（隐式默认样式）见 [calendar](calendar.md)
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 对照：DatePickerExtend（同类日期选择）见 [date-picker-extend](date-picker-extend.md)；`NumericKeypadAttach` 见 keypad-input 条目
- 索引交叉：`{index_root}/files/refence_SDC_Style_DateTimePicker.xaml.json`、`{index_root}/files/refence_SDC_Style_DateTimeSelector.xaml.json`

## 8. 待确认项

- TD-046（DateTimePicker/DateTimeSelector 语义）：
  - `TextOfTextBlock` 属性与日历/时分秒联动回写机制（选择日期→时/分/秒→Text 汇总在 .cs 面）；
  - `PART_NowButton`/`PART_ClearButton`/`PART_ConfirmButton` 的行为与 `PART_ButtonsBorder` 残留 `Grid.Row="1"`（StackPanel 内无效属性，疑似复制遗留）；
  - DateTimePicker 的 `Text`/`SelectedDate` 等属性面（模板未显式绑定，.cs 定义不可见）；
  - 硬编码色值 #b4b4b4/#2561a9/#5f5f5f（无 Token）与模板内 TextBox `FontSize="14"` 硬编码（TD-025 同模式）。
- TD-006（`WatermarkElement`/`NumericKeypadAttach` 附加属性族参数类型与运行时行为）
