<!-- evidence=部分确认(模板/触发器均为 P1 直接证据；CalendarExtend 内容注入与附加属性语义待确认); pending=[TD-045,TD-006];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/Calendar.xaml, {source_root}/SDC/Style/CalendarExtend.xaml, {source_root}/ManualView.xaml] -->

# Calendar / CalendarExtend（日历与扩展日历）

## 1. 用途

两文件两个控件：

- **Calendar（Calendar.xaml）**：原生 Calendar 的框架样式——日按钮 50×50（VSM 五组 12 态：Common 四态/Selection 两态/BlackoutDay 两态/Active 两态/Day 两态，Today 高亮 `PrimaryDeepToolBrush`）、月/年按钮 52×56（`MonthNameConverter` 去"月"字）、头部导航（`CalenderHeaderButtonBaseStyle`，前后三角 `PreviousButtonGeometry`/`NextButtonGeometry`）、星期标题条（`DayTitleTemplateResourceKey`）；CalendarItem 隐式样式含 `controls:CalendarItemAttach.MouseRelease=True`；
- **CalendarExtend（CalendarExtend.xaml）**：日历+底部操作栏组合——350×390 固定尺寸，`PART_CalendarPresenter` 呈现日历（内容由 .cs 注入），底部 **今日/清除/确认** 三按钮（`CalenderSelectorButtonBase` 65×30）。

典型场景（推断，无 P2 实例）：日期选择弹层（DateTimePicker 内部即内嵌 DateTimeSelector→Calendar，见 [date-time-picker](date-time-picker.md)）。

## 2. 声明

```xml
<Calendar … />（原生类型 + 隐式默认样式）
<s:CalendarExtend … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `Calendar`/`CalendarItem`/`CalendarButton`/`CalendarDayButton`（隐式/具名样式）与 `controls:CalendarExtend`（隐式默认，无命名键）。两文件均仅合并 BaseStyle.xaml。

## 3. 关键属性表

### Calendar 侧（Calendar.xaml）

| 属性/项 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| CalendarDayButtonStyle | Style | `CalendarDayButtonStyle`（BasedOn `BaseStyle`）：日按钮 50×50、VSM 五组 12 态（Common：Normal/MouseOver（`PrimaryToolColor` 描边）/Focused/Disabled；Selection：Unselected/Selected（`SecondaryBorderBrush` 底）；BlackoutDay：Normal/Blackout（0.5 透明度）；Active：Active/Inactive（`PrimaryControlToolBrush`）；Day：Regular/Today（`PrimaryDeepToolBrush` 底白字）），文字 16 | `x:Key="CalendarDayButtonStyle"` | ✅ |
| CalendarButtonStyle | Style | `CalendarButtonStyle`：月/年格按钮 52×56、`MonthNameConverter` 去"月"（Text=Content 经转换器）、Hover `HoverBrush`/聚焦 `PrimaryLightBrush`/Inactive/Disabled 三态 | `x:Key="CalendarButtonStyle"` + `tools:MonthNameConverter x:Key="MonthNameConverter"` | ✅ |
| CalendarItemAttach.MouseRelease | bool | CalendarItem 隐式样式 Setter `True`——点击释放时机附加属性 | 隐式 `Style TargetType="CalendarItem"` Setter | 🟡 [待确认 TD-045] |
| DisplayMode | enum | 模板 DataTrigger：Year/Decade → `PART_MonthView` 隐藏 + `PART_YearView` 显示（三列/四列网格切换） | 模板 DataTrigger `Value="Year"`/`Value="Decade"` | ✅ |
| DayTitleTemplateResourceKey | DataTemplate | 星期标题条（Bold + `TextFontSize`） | 模板 `DataTemplate x:Key="{x:Static CalendarItem.DayTitleTemplateResourceKey}"` | ✅ |
| 头部导航 | — | `PART_PreviousButton`/`PART_NextButton`（30×30、透明底、前后三角 Geometry、Hover `SecondaryBorderBrush`/Pressed `PrimaryControlToolBrush`）、`PART_HeaderButton`（`ButtonCustom` 样式，Button.xaml:436 跨文件引用） | 模板 Button + `x:Key="CalenderHeaderButtonBaseStyle"` | ✅ |
| 标题条 | — | 头部 35 高渐变（`HeaderTextGradientBrush` 底 + `TabSecondDefaultGradient` 边） | 模板 | ✅ |

### CalendarExtend 侧（CalendarExtend.xaml）

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| ShowConfirmButton | bool | 默认 True（底部操作栏显隐语义，模板内无触发器——.cs 面） | 隐式样式 Setter | 🟡 [待确认 TD-045] |
| PART_CalendarPresenter | ContentPresenter | 日历内容呈现位（无绑定/无默认内容——由 .cs 注入） | 模板 `x:Name="PART_CalendarPresenter"` | ❓ [待确认 TD-045] |
| 底部三按钮 | Button | `PART_ButtonToday`（`ControlNow`）/`PART_ButtonClear`（`ControlClear`）/`PART_ButtonConfirm`（`ControlConfirm`），`CalenderSelectorButtonBase` 样式（65×30、`CalendarExtend_BottomButtonHeight`=30、ButtonGradientBrush 底圆角 3、Hover `PrimaryToolBrush` 描边/Pressed `CalenderButtonGradientBrush`） | 模板 + `x:Key="CalenderSelectorButtonBase"` + {source_root}/SDC/Sizes.xaml:44 | ✅ |
| 尺寸 | — | 模板硬编码 350×390（Border Width/Height）、底部栏 40 高 | 模板 Border | ✅ |

## 4. 样式族表（双文件键名归属）

### Calendar.xaml

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| CalendarButtonStyle | 无 | 月/年按钮 52×56 + MonthNameConverter | CalendarButton |
| CalendarDayButtonStyle | BaseStyle | 日按钮 50×50 + VSM 八组 | CalendarDayButton |
| CalenderHeaderButtonBaseStyle | 无 | 头部按钮（透明底、Hover/Pressed 态）——键名拼写"Calender" | 日历头部内部件 |
| （隐式）CalendarItem | 无 | CalendarItem 默认样式：`CalendarItemAttach.MouseRelease=True` + 星期标题模板 + Month/Year 视图切换 | Calendar 模板部件 |
| CalendarBaseStyle | 无 | Background=`PrimaryDefaultBrush` + 装配两个按钮样式 + `PART_CalendarItem` 模板 | 基样式，不直接用 |
| （隐式）Calendar | CalendarBaseStyle | TargetType=Calendar 全局兜底 | 未显式指定 Style 时 |

### CalendarExtend.xaml

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| CalenderSelectorButtonBase | 无 | 底部操作按钮 65×30（`CalendarExtend_BottomButtonHeight` Token）、渐变底圆角 3——键名拼写"Calender" | 今日/清除/确认 |
| （隐式）CalendarExtend | BaseStyle | 350×390 边框 + PART_CalendarPresenter + 底部三按钮栏 | 未显式指定 Style 时（唯一入口） |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 均未出现 `s:CalendarExtend`/Calendar。

```xml
<Calendar SelectedDate="{Binding …}" DisplayMode="Month"/>
```

```xml
<s:CalendarExtend/>
```

- 原生 `Calendar` 隐式样式自动生效：日/月年按钮、星期标题、Today 高亮、导航全部框架承担，页面只绑 `SelectedDate`；
- `CalendarExtend` 底部操作栏自带（今日/清除/确认文本键 DynamicResource），`PART_CalendarPresenter` 内容由框架 .cs 注入，页面零内容声明；
- 与 [date-time-picker](date-time-picker.md) 的关系：DateTimeSelector 模板内嵌 `Calendar`（`PART_Calender`），弹层确认按钮为 DateTimePicker 模板自建。

## 6. 禁止写法对照

### ❌ 禁止：手写 UniformGrid 数字网格 + 自绘 Today/选中态拼装等效日历（常规 WPF 写法）

```xml
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/>
        <RowDefinition/><RowDefinition/>
    </Grid.RowDefinitions>
    <Grid.ColumnDefinitions>
        <ColumnDefinition/><ColumnDefinition/><ColumnDefinition/><ColumnDefinition/>
        <ColumnDefinition/><ColumnDefinition/><ColumnDefinition/>
    </Grid.ColumnDefinitions>
    <!-- 手动循环生成 28~31 个 Button，自行算星期对齐、Today 高亮、跨月灰显… -->
</Grid>
```

### ✅ 推荐：Calendar 隐式样式 + 日期绑定

```xml
<Calendar SelectedDate="{Binding …}" DisplayMode="Month"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有日按钮 VSM 五组 12 态（Today `PrimaryDeepToolBrush` 高亮/Blackout 0.5/Selected/Inactive 等）、月年切换与 Year/Decade 视图、星期标题条、头部 Hover/Pressed 态；
2. **② 丢失协议挂点**：`CalendarItemAttach.MouseRelease`、`MonthNameConverter`、`DayTitleTemplateResourceKey` 等附加属性/转换器协议无法复刻；
3. **③ 无法样式族切换**：不能一键用 CalendarBaseStyle 或换 `CalendarExtend`（今日/清除/确认栏），也无法把日历嵌进 DateTimePicker 式弹层复用；
4. **⑤ 脱离视觉规范**：日 50×50/月年 52×56/标题 35 高、`HeaderTextGradientBrush` 渐变、`PrimaryToolBrush` 描边色、`CalendarExtend_BottomButtonHeight` Token 等规范失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Calendar.xaml`（锚点 `x:Key="CalendarBaseStyle"`、`x:Key="CalendarButtonStyle"`、`x:Key="CalendarDayButtonStyle"`、`x:Key="CalenderHeaderButtonBaseStyle"`、隐式 `Style TargetType="CalendarItem"`、`controls:CalendarItemAttach.MouseRelease`、`x:Key="MonthNameConverter"`、`{x:Static CalendarItem.DayTitleTemplateResourceKey}`、`PART_PreviousButton`/`PART_HeaderButton`/`PART_NextButton`、`PART_MonthView`/`PART_YearView`、`DataTrigger Binding="{Binding DisplayMode, …}"`）
- 模板源码：`{source_root}/SDC/Style/CalendarExtend.xaml`（锚点 `x:Key="CalenderSelectorButtonBase"`、隐式 `Style TargetType="controls:CalendarExtend"`、`PART_CalendarPresenter`、`PART_ButtonToday`/`PART_ButtonClear`/`PART_ButtonConfirm`、`ShowConfirmButton`）
- 尺寸：`{source_root}/SDC/Sizes.xaml`（CalendarExtend_BottomButtonHeight:44）；字号：`{source_root}/SDC/Fonts.xaml`（TextFontSize:7）；几何：`{source_root}/SDC/Geometries.xaml`（PreviousButtonGeometry/NextButtonGeometry）；跨文件：`{source_root}/SDC/Style/Button.xaml`（ButtonCustom:436）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 对照：DateTimeSelector 内嵌 Calendar 见 [date-time-picker](date-time-picker.md)；`MonthNameConverter` 等转换器 .cs 不可见（见 01-resources/README.md 转换器节）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Calendar.xaml.json`、`{index_root}/files/refence_SDC_Style_CalendarExtend.xaml.json`

## 8. 待确认项

- TD-045（Calendar/CalendarExtend 语义）：
  - `CalendarExtend.PART_CalendarPresenter` 内容注入方式（.cs 创建 Calendar 挂载？）与 `ShowConfirmButton` 运行时语义（模板无触发器）；
  - `CalendarItemAttach.MouseRelease` 附加属性的行为与用途；
  - `CalenderHeaderButtonBaseStyle`/`CalenderSelectorButtonBase` 键名拼写"Calender"（是否刻意保留、有无同名更正版）与 `CalenderButtonGradientBrush` 画刷定义位置；
  - `MonthNameConverter` 转换规则（去"月"字为推断）。
- TD-006（`CalendarItemAttach` 附加属性族参数类型与运行时行为）
