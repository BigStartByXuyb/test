<!-- evidence=部分确认(消费处为模板源码直接证据；宿主定义 SDC 全库零命中); pending=[TD-032,TD-035]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/NumberBox.xaml, {source_root}/SDC/Style/IntNumberBox.xaml, {source_root}/SDC/Style/StringNumberBox.xaml, {source_root}/SDC/Style/DateTimeSelector.xaml, {source_root}/ManualView.xaml] -->

# NumericKeypadAttach（数字键盘附加属性）

## 1. 用途

框架数字键盘弹出协议：宿主类 `controls:NumericKeypadAttach` 暴露 `IsEnabled` 附加属性，挂在输入控件上，控制「输入焦点移交弹出键垫」行为——`True` 时输入框 PART_TextBox 失焦（Focusable=False），输入交由 Pop_keyBoard 弹层中的数字键盘；`False` 时显式禁用键垫。

**关键事实**：SDC 全库 grep **零定义**（无任何 Style Setter 引用它）——它完全由模板触发器消费 + 组合侧显式禁用。宿主类定义在 .cs 中不可见（TD-032）。

## 2. 声明

```xml
<s:NumberBox controls:NumericKeypadAttach.IsEnabled="True" …/>
<!-- 或显式禁用：controls:NumericKeypadAttach.IsEnabled="False" -->
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 模板消费：`Trigger Property="controls:NumericKeypadAttach.IsEnabled" Value="True"` → PART_TextBox Focusable=False（NumberBox.xaml:179-181）；
- 键垫内容由 Pop_keyBoard（Popup 挂点）承载，注入机制 .cs 不可见（TD-035）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| IsEnabled | bool | True → PART_TextBox Focusable=False（输入移交键垫）；默认值未知 | NumberBox.xaml:179（模板 Trigger）+ :180（Focusable=False Setter） | ❓ [TD-032/TD-035] |
| 其余成员 | — | 全库 grep 仅 IsEnabled 一属性命中 | grep 统计 | ❓ TD-032 |

消费分布（模板源码证据）：

- **NumberBox 家族**：NumberBox.xaml:179（默认模板触发器）、:415（另一消费点）；IntNumberBox.xaml:121/:282；StringNumberBox.xaml:105；
- **显式禁用**：DateTimeSelector.xaml:35/39/43（PART_Hour/Minute/SecondNumberBox `NumericKeypadAttach.IsEnabled="False"`）——时间选择器场景内建框不用键垫的官方写法，即「组合侧显式关闭」的唯一模板实例。

## 4. 样式族表

无（本条目为附加属性；消费样式族见 [number-box](../keypad-input/number-box.md)、[int-number-box](../keypad-input/int-number-box.md)、[string-number-box](../keypad-input/string-number-box.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<s:NumberBox controls:NumericKeypadAttach.IsEnabled="True"
             Value="{Binding …}"/>
```

- 打开键垫：IsEnabled="True"（或省略——默认值未知，显式写最稳）；
- 关闭键垫（内建框输入）：`controls:NumericKeypadAttach.IsEnabled="False"`（DateTimeSelector.xaml:35 原样写法）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Popup + 手写键垫挂 TextBox（等效替代）

```xml
<Grid>
    <TextBox x:Name="PART_TextBox" …/>
    <Popup x:Name="myPad" PlacementTarget="{Binding ElementName=PART_TextBox}"
           IsOpen="False" StaysOpen="False">
        <UniformGrid Rows="4" Columns="3">
            <!-- 手写 1-9/0/退格按钮 + Click 事件追加文本 -->
        </UniformGrid>
    </Popup>
</Grid>
```

### ✅ 推荐：NumericKeypadAttach 属性化

```xml
<s:NumberBox controls:NumericKeypadAttach.IsEnabled="True" …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：键垫弹出/焦点移交/数值回写协议全部丢失——手写 Popup 与框架 NumericKeypad 控件族（NumericKeypad/StringNumericKeypad/SwitchKeypad，见 keypad-input 批）无任何集成；
2. **① 丢失状态**：Focusable=False 焦点移交联动（NumberBox.xaml:179-181）无从表达，焦点行为分叉；
3. **③ 无法样式族切换**：键垫开/关不能靠一个附加属性在 NumberBox 家族内切换（DateTimeSelector 内建框的官方关闭写法失效）；
4. **⑤ 脱离视觉规范**：键垫布局/尺寸/字号/图标（KeyButtonStyle 家族）全部散写，与框架键垫视觉规范脱节；
5. **④ 重复造轮子**：框架已内建完整键垫协议，手写 Popup 属「重新发明已有框架能力」（framework.config.json 规则 4）。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/NumberBox.xaml`（锚点 `Trigger Property="controls:NumericKeypadAttach.IsEnabled"` :179-181、`x:Name="Pop_keyBoard"` :165-171、:415）
- 家族分布：`{source_root}/SDC/Style/IntNumberBox.xaml`（:121/:282）、`{source_root}/SDC/Style/StringNumberBox.xaml`（:105）
- 显式禁用实例：`{source_root}/SDC/Style/DateTimeSelector.xaml`（:35/39/43）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_NumberBox.xaml.json`

## 8. 待确认项

- **TD-032**（复用）：NumericKeypadAttach 宿主定义在全库 XAML 零命中——类名与属性集合、默认值仅从模板触发器侧推断，定义位置待 .cs 确认。
- **TD-035**（复用）：键垫弹出机制（Pop_keyBoard 内容注入、Focusable=False 联动、键垫数值回写协议）——关联键垫控件批（NumericKeypad.xaml 等）。
