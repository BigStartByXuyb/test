<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-045]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/Calendar.xaml, {source_root}/ManualView.xaml] -->

# CalendarItemAttach（日历项行为附加属性）

## 1. 用途

框架日历项行为协议：宿主类 `controls:CalendarItemAttach` 暴露 `MouseRelease` 附加属性——挂在天数格（CalendarItem）上，控制鼠标释放行为（语义待确认，.cs 不可见）。**唯一消费点**：Calendar.xaml 隐式 CalendarItem 样式设 `True`（:205）——全库仅此一处，无变体、无覆盖。

## 2. 声明

```xml
<Calendar …/>
<!-- 隐式 CalendarItem 样式已设 controls:CalendarItemAttach.MouseRelease="true"，页面无需书写 -->
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 挂载面：CalendarItem（框架日历模板的日期格元素）；行为型附加属性（模板内无触发器消费）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| MouseRelease | bool | 鼠标释放行为开关（true）；语义（按下拖动 vs 点击释放提交等）待确认 | Calendar.xaml:205（隐式 CalendarItem 样式 Setter `Value="true"`） | ❓ [TD-045] |
| 其余成员 | — | 全库 grep 仅 MouseRelease 一属性、一消费点命中 | grep 统计 | ❓ TD-045 |

**阴性证据**：全库仅此一处——无样式族差异、无页面覆盖实例、无组合模板显式禁用；CalendarExtend / DateTimePicker 家族均未直接引用（其日期交互经 Calendar 模板间接生效）。

## 4. 样式族表

无（本条目为附加属性；消费样式见 [calendar](../grid-tree/calendar.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<Calendar …/>
```

- 隐式样式已设 MouseRelease=true，页面零书写——默认日期选择行为即框架行为。

## 6. 禁止写法对照

### ❌ 禁止：手写 CalendarItem 样式替代（等效替代）

```xml
<Calendar.Resources>
    <Style TargetType="CalendarItem">
        <Setter Property="…鼠标行为自绘…" Value="true"/>
    </Style>
</Calendar.Resources>
<!-- 或以自绘日期按钮网格取代 Calendar -->
```

### ✅ 推荐：框架 Calendar + 隐式协议

```xml
<Calendar …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：MouseRelease 行为协议丢失——.cs 挂钩的鼠标释放语义（与日期选中、高亮联动）页面无从获得；
2. **③ 无法样式族切换**：日历样式族（CalendarBaseStyle / CalendarExtend）统一切换的协议被手写 Resources 覆盖打断；
3. **① 丢失状态**：手写/自绘日期格缺失选中/今日/禁用日状态画刷触发器（Calendar.xaml 家族模板全套）；
4. **⑤ 脱离视觉规范**：自绘日期网格与框架日历视觉基线（MonthNameConverter 月份头、星期头布局）完全脱节。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/Calendar.xaml`（锚点 隐式 CalendarItem 样式 :205；月份头 `MonthNameConverter` :13/:29）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Calendar.xaml.json`

## 8. 待确认项

- **TD-045**（复用）：CalendarItemAttach.MouseRelease 行为语义（触发条件、与选中/高亮联动）——唯一消费点 Setter 为直接证据，语义 .cs 不可见；关联本批 Calendar.xaml 家族（MonthNameConverter、CalenderHeaderButtonBaseStyle 拼写）。
