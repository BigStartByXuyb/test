<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-055]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/StringNumberBox.xaml, {source_root}/SDC/Style/IntNumberBox.xaml, {source_root}/SDC/Style/TextBox.xaml, {source_root}/SDC/Style/Poptip.xaml, {source_root}/ManualView.xaml] -->

# Poptip（错误提示弹层附加属性）

> 补充条目：枚举 FrameworkGeneric.xaml 时发现的清单外工具类（非业务性），依约定补写。含宿主控件 Poptip 与附加属性 Instance/IsOpen。

## 1. 用途

框架错误提示弹层协议：宿主类 `controls:Poptip` 提供两个附加属性——**Instance（注入弹层实例）+ IsOpen（打开开关）**，挂在输入控件上，由错误态触发器打开，弹层显示校验/错误信息。服务于输入校验场景（NumberBox 家族错误提示、HitTextBox 输入错误提示）。

弹层视觉由 Poptip.xaml 的 PoptipBaseStyle 定义（透明底、Offset=6、BorderElement.CornerRadius=3、IsHitTestVisible=False）。

## 2. 声明

```xml
<!-- 模板内原样（StringNumberBox.xaml :39-48） -->
<controls:Poptip Background="Transparent" Padding="0"
                 Foreground="{DynamicResource WarningBrush}" BorderThickness="0"
                 Offset="2" Content="{TemplateBinding ErrorStr}"
                 PlacementType="BottomRight" HitMode="None"/>
<!-- 触发器：<Trigger Property="IsError" Value="True"><Setter Property="controls:Poptip.IsOpen" Value="True"/></Trigger> -->
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；页面零书写（模板内建）。

## 3. 关键属性表

| 属性/成员 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Instance | Poptip | 注入弹层实例（元素属性语法 `<controls:Poptip …/>` 内嵌宿主模板） | StringNumberBox.xaml:39-48（Poptip 完整配置：ErrorStr 绑定、WarningBrush、PlacementType="BottomRight"、HitMode="None"） | 🟡 [TD-055] |
| IsOpen | bool | 打开开关；错误态触发器置 True | StringNumberBox.xaml:140（IsError→IsOpen Trigger）；IntNumberBox.xaml:197/:302；TextBox.xaml:128（HitTextBox） | 🟡 [TD-055] |
| Poptip 控件属性 | Offset / PlacementType / HitMode / Content / Foreground / BorderThickness | 弹层外观与定位（PoptipBaseStyle 默认 Offset=6、圆角 3、IsHitTestVisible=False） | Poptip.xaml:20（CornerRadius=3）/25-35（模板 Border+ContentPresenter）；StringNumberBox.xaml:39-48（覆盖实例） | 🟡 [TD-055] |

消费分布（模板源码证据）：StringNumberBox 隐式样式（Poptip 注入 :39-48 + IsOpen 触发器 :140）；IntNumberBox.xaml:197/:302；HitTextBox 样式（TextBox.xaml:128，ResultType=Failed 语义）；PoptipBaseStyle 定义 Poptip.xaml（43 行，模板 Border+ContentPresenter）。

## 4. 样式族表

无（本条目为附加属性 + 宿主控件；PoptipBaseStyle 为唯一样式，见 [poptip](../native/poptip.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零引用。以下为 P1 模板证据构造。

```xml
<s:StringNumberBox Value="{Binding …}"/>
<!-- 错误提示由框架模板内建：IsError=True 时 IsOpen 触发器打开 Poptip 弹层 -->
```

- 校验错误 → 弹层自动浮现（WarningBrush 红字、BottomRight 定位），页面零书写。

## 6. 禁止写法对照

### ❌ 禁止：手写 ToolTip/Popup + 触发器（等效替代）

```xml
<Popup IsOpen="{Binding IsError}" PlacementTarget="{Binding ElementName=box}"
       Placement="Bottom">
    <Border Background="#FFFF…" CornerRadius="3" Padding="…">
        <TextBlock Text="{Binding ErrorStr}" Foreground="Red"/>
    </Border>
</Popup>
```

### ✅ 推荐：框架 Poptip 协议

```xml
<s:StringNumberBox …/>  <!-- 错误提示模板内建 -->
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写 Popup 无错误态时序管理（ErrorStr 更新、消失时机、重入），弹层与输入状态联动错乱；
2. **② 丢失协议挂点**：Instance/IsOpen 注入协议丢失——复用框架模板（StringNumberBox/IntNumberBox/HitTextBox）时错误提示无法经附加属性统一管理；
3. **③ 无法样式族切换**：提示外观（WarningBrush、圆角 3、Offset 2/6）随 PoptipBaseStyle 族统一调整的机制失效；
4. **⑤ 脱离视觉规范**：弹层底色/字色/定位/边距散写页面，与框架提示视觉基线脱节；
5. **④ 重复造轮子**：框架已内建 Poptip 弹层协议（framework.config.json 规则 4 违反）。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/StringNumberBox.xaml`（Poptip 注入 :39-48、IsOpen 触发器 :140）、`{source_root}/SDC/Style/IntNumberBox.xaml`（:197/:302）、`{source_root}/SDC/Style/TextBox.xaml`（HitTextBox :128）
- 宿主样式：`{source_root}/SDC/Style/Poptip.xaml`（PoptipBaseStyle :20/:25-35）
- 真实使用：无（ManualView.xaml 零引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Poptip.xaml.json`

## 8. 待确认项

- **TD-055**（新）：Poptip.Instance 注入机制与 Poptip.IsOpen 打开语义（含 Poptip 控件属性 Offset/PlacementType/HitMode 行为）；.cs 不可见，当前仅确认模板消费侧语法。
