<!-- evidence=部分确认(模板/触发器均为 P1 直接证据；空 Popup 内容与键名语义待确认); pending=[TD-046,TD-004];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/DatePickerExtend.xaml, {source_root}/ManualView.xaml] -->

# DatePickerExtend（扩展日期选择器）

## 1. 用途

单行日期输入控件：**45 高输入框（`PART_TextBox`，水印"请输入时间"）+ 右侧日历图标按钮（`PART_Button`，30 宽）**，弹出 `PART_Popup`（StaysOpen=False，**模板内为空 Popup**——弹层内容由 .cs 注入）。四组触发器：Disabled 0.5、Hover `PrimaryToolBrush`、聚焦 `PrimaryDeepToolBrush`、弹开（IsOpen）框体/按钮转蓝底白图标。

典型场景（推断，无 P2 实例）：单值日期设定。与 [date-time-picker](date-time-picker.md) 的 DateTimePicker 同类不同型（本控件更窄 100 宽、45 高，Pop 内容未在模板声明）。

## 2. 声明

```xml
<s:DatePickerExtend … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:DatePickerExtend`（MaxwellControl.Controls，私有程序集）。隐式默认样式 + 具名基样式 `DateTimePickerBaseStyle`——⚠️ **键名"DateTimePickerBaseStyle"与 DateTimePicker 控件同名，TargetType 却是 DatePickerExtend**（键名误导，疑似复制遗留，登记 TD-046）。合并字典仅 BaseStyle.xaml。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Text | string | 输入框文本（`PART_TextBox` Text 绑定；TextBox 边框 0、背景随控件） | 模板 `Text="{TemplateBinding Text}"` | ✅ |
| WatermarkElement.Watermark | string | 输入框水印 **硬编码中文"请输入时间"**（模板字面量，未走文本键） | 模板 PART_TextBox | ✅（记入 TD-004/046） |
| Height / Width / MinHeight | double | 45 / 100 / 30 | `x:Key="DateTimePickerBaseStyle"` Setter | ✅ |
| BorderElement.CornerRadius | double | 框体圆角 3（`templateRoot` Border 内联）+ PART_Button 圆角 3 | 模板 + 样式 Setter | ✅ |
| IsEnabled | bool | False → 整体 Opacity 0.5 | 模板 Trigger | ✅ |
| 悬停/聚焦态 | Brush | IsMouseOver → `PrimaryToolBrush` 描边；PART_TextBox IsFocused → `PrimaryDeepToolBrush` 描边 | 模板 Trigger | ✅ |
| 弹开态（IsOpen） | Brush | PART_Popup IsOpen → 框体 `PrimaryDeepToolBrush` 描边 + PART_Button 蓝底（`PrimaryDeepToolBrush`）白图标（`PrimaryDefaultBrush`） | 模板 `Trigger Property="IsOpen" SourceName="PART_Popup"` | ✅ |
| PART_Popup | Popup | **模板内无内容**（StaysOpen=False、Slide、Placement=Bottom、PlacementTarget=PART_TextBox、Offset 0,-10）——日历弹层由 .cs 注入或外部设置 | 模板 Popup | ❓ [待确认 TD-046] |
| PART_Button | Button | 30 宽日历图标钮（`DatePickerButton` 样式：`CalendarGeometry` 图标 15×15、`ButtonGradientBrush` 底、BorderThickness=1 0 0 0 左侧分隔） | 模板 + `x:Key="DatePickerButton"` | ✅ |

## 4. 样式族表（SDC\Style\DatePickerExtend.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| DatePickerButton | BaseStyle | 30×30 日历图标钮（`CalendarGeometry`、圆角 3、左分隔线 1 0 0 0） | PART_Button 内部件 |
| DateTimePickerBaseStyle | 无 | DatePickerExtend 全部默认属性 + 主模板——**键名与控件名不符**（TargetType=DatePickerExtend） | 基样式（键名见 TD-046） |
| （隐式）DatePickerExtend | DateTimePickerBaseStyle | TargetType=DatePickerExtend 全局兜底 | 未显式指定 Style 时 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 均未出现 `s:DatePickerExtend`。

```xml
<s:DatePickerExtend Text="{Binding …日期值}"/>
```

- 输入 + 图标钮 + 弹层触发器（Hover/聚焦/弹开三态描边）全内置，页面只绑 `Text`；
- 弹层内容依赖 .cs 注入（模板空 Popup），TD-046 回填前按输入框+图标钮使用。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBox + Button + Popup 拼装等效日期输入（常规 WPF 写法）

```xml
<Grid Width="100" Height="45">
    <TextBox x:Name="dateInput" Margin="0,0,30,0" VerticalContentAlignment="Center"/>
    <Button Width="30" Click="OpenDatePicker_Click">
        <Path Data="{StaticResource CalendarGeometry}" Width="15" Height="15"/>
    </Button>
    <Popup PlacementTarget="{Binding ElementName=dateInput}" IsOpen="{Binding …}" StaysOpen="False">
        <!-- 自行挂日历弹层与选中回写… -->
    </Popup>
</Grid>
```

### ✅ 推荐：DatePickerExtend 属性化

```xml
<s:DatePickerExtend Text="{Binding …日期值}"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有四组触发器（Disabled 0.5 / Hover / 聚焦 / IsOpen 弹开蓝底白图标联动），图标钮与框体描边不同步；
2. **② 丢失协议挂点**：`WatermarkElement.Watermark` 水印附加属性、`BorderElement.CornerRadius` 圆角协议与弹层注入机制无从谈起；
3. **③ 无法样式族切换**：不能一键切 `DatePickerButton`/`DateTimePickerBaseStyle` 键或换 DateTimePicker（[date-time-picker](date-time-picker.md)）同族变体；
4. **⑤ 脱离视觉规范**：45×100/MinHeight 30 尺寸、圆角 3、日历图标 `CalendarGeometry`、聚焦/弹开 `PrimaryDeepToolBrush` 描边等规范失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/DatePickerExtend.xaml`（锚点 `x:Key="DatePickerButton"`、`x:Key="DateTimePickerBaseStyle"`、隐式 `Style TargetType="controls:DatePickerExtend"`、`PART_Button`、`PART_TextBox`、`PART_Popup`、`Trigger Property="IsOpen" SourceName="PART_Popup"`）
- 几何：`{source_root}/SDC/Geometries.xaml`（CalendarGeometry）；画刷：`{source_root}/SDC/Brushes/ButtonBrushes.xaml`（ButtonGradientBrush/ButtonBorderGradientBrush）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 对照：DateTimePicker/DateTimeSelector 见 [date-time-picker](date-time-picker.md)；Calendar/CalendarExtend 见 [calendar](calendar.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_DatePickerExtend.xaml.json`

## 8. 待确认项

- TD-046（DatePickerExtend 语义，与 date-time-picker.md 共享编号）：
  - `PART_Popup` 模板内为空——弹层日历内容注入方式（.cs 创建？外部设置？）与日期选中回写机制；
  - 键名 `DateTimePickerBaseStyle` 与 DateTimePicker 控件同名、TargetType 为 DatePickerExtend——命名冲突是否刻意（可能被 DateTimePicker.xaml 字典合并顺序遮蔽，关联 TD-008）；
  - 模板水印硬编码"请输入时间"（未走 DynamicResource 文本键，TD-004 关联）；
  - `Text` 属性面与选中日期的格式约定（.cs 不可见）。
