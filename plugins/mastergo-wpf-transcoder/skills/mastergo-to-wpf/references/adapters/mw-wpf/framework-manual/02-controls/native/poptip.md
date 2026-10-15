<!-- evidence=已确认(属性/模板为 P1 直接证据；P3 级使用实例——StringNumberBox.xaml:39-48 等三处 Poptip.Instance 实例化);
     pending=[TD-006]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/Poptip.xaml, {source_root}/SDC/Style/StringNumberBox.xaml, {source_root}/ManualView.xaml] -->

# Poptip（弹出提示·框架样式）

## 1. 用途

`controls:Poptip`（MaxwellControl.Controls 自定义控件）的框架样式：轻量弹出提示（气泡）——灰白底（`BackgroundBrush`/`BorderBrush`）、圆角 3（`BorderElement.CornerRadius`）、`Offset=6`（定位偏移）、**`IsHitTestVisible=False`（纯展示不拦截交互）**。模板为 Border + ContentPresenter（内容三通道：Template/Selector/StringFormat）。

**本控件是 16 个条目中少数有 P3 级真实使用实例的控件**：`StringNumberBox.xaml:39-48`、`SwitchBox.xaml:38-47`、`SwitchPasswordBox.xaml:38-47` 三处经 **`controls:Poptip.Instance` 附加属性实例化**（错误提示气泡：`Foreground=WarningBrush`、`Offset=2`、`PlacementType="BottomRight"`、`HitMode="None"`、`Content={TemplateBinding ErrorStr}`）；`Poptip.IsOpen` 附加属性的消费面另见附加属性批条目（本条目只管控件样式本身）。

## 2. 声明

```xml
<controls:Poptip … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:Poptip`（MaxwellControl.Controls）。本文件含 `PoptipBaseStyle`（x:Key）+ 隐式默认样式（BasedOn 前者）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| IsHitTestVisible | bool | 基样式 False（纯展示，不拦截鼠标） | `x:Key="PoptipBaseStyle"` Setter（:13） | ✅ |
| Offset | double | 定位偏移 6（气泡距宿主距离） | PoptipBaseStyle Setter（:17） | ✅ |
| Background / BorderBrush | Brush | `BackgroundBrush` / `BorderBrush` | PoptipBaseStyle Setter（:18-19） | ✅ |
| BorderElement.CornerRadius | CornerRadius | 3 | PoptipBaseStyle Setter（:20） | ✅ |
| Padding | Thickness | 2（内容内边距） | PoptipBaseStyle Setter（:21） | ✅ |
| BorderThickness | Thickness | 1 | PoptipBaseStyle Setter（:16） | ✅ |
| Content / ContentTemplate / ContentTemplateSelector / ContentStringFormat | object | 内容四通道（模板直绑 ContentPresenter） | PoptipBaseStyle 模板（:30-34） | ✅ |
| PlacementType / HitMode / IsOpen / Instance | — | **附加属性族**（Poptip.IsOpen/Instance 等）——挂载与开合协议由附加属性驱动，专述见附加属性批条目 | {source_root}/SDC/Style/StringNumberBox.xaml:39-48（Instance 实例化）、IntNumberBox.xaml:197/:302 等（IsOpen 消费） | 🟡 TD-006 |

## 4. 样式族表（SDC\Style\Poptip.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| PoptipBaseStyle | 无（独立） | 灰白底 1px 边框、圆角 3、Offset 6、IsHitTestVisible=False、Padding 2 | 基样式，不直接用 |
| （隐式默认样式） | PoptipBaseStyle | TargetType 默认样式，全局兜底（:41） | 未显式指定 Style 时 |

模板命名部件（P1 锚点）：无（模板内 Border/ContentPresenter 均未命名）。

## 5. 框架写法示例

**有使用实例（P3 证据）**——`{source_root}/SDC/Style/StringNumberBox.xaml:39-48`（SwitchBox.xaml:38-47、SwitchPasswordBox.xaml:38-47 同构）：

```xml
<controls:Poptip.Instance>
    <controls:Poptip
        Background="Transparent"
        Padding="0"
        Foreground="{DynamicResource WarningBrush}"
        Offset="2"
        Content="{TemplateBinding ErrorStr}"
        PlacementType="BottomRight" HitMode="None" />
</controls:Poptip.Instance>
```

- 错误提示气泡标准形态：`PlacementType="BottomRight"` + `HitMode="None"` + `Foreground=WarningBrush`（业务实例模式）；
- `Poptip.IsOpen` 开合由宿主模板 Trigger 控制（如 StringNumberBox.xaml:140 焦点+错误 MultiTrigger → True）——挂载与开合协议另见附加属性批条目。

## 6. 禁止写法对照

### ❌ 禁止：手写 ToolTip / Popup + 手工定位拼等效气泡（常规 WPF 写法）

```xml
<Popup PlacementTarget="{Binding ElementName=box}" Placement="Bottom"
       AllowsTransparency="True" IsOpen="{Binding 手工开合标志}">
    <Border Background="White" BorderBrush="Gray" BorderThickness="1" CornerRadius="3" Padding="2">
        <TextBlock Text="手工错误提示" Foreground="#E05B4D"/>
    </Border>
</Popup>
<!-- 手工：开合时机、定位偏移、命中测试、样式统一… -->
```

### ✅ 推荐：Poptip 控件 + 附加属性协议

```xml
<controls:Poptip Offset="2" PlacementType="BottomRight" HitMode="None"
                 Content="{TemplateBinding ErrorStr}"
                 Foreground="{DynamicResource WarningBrush}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有内建的 `PlacementType`/`HitMode`/`Offset` 定位协议（BottomRight + None 组合）与 `IsOpen` 附加属性开合通道——定位与开合时机全部手工重造；
2. **② 丢失协议挂点**：绕过 `Poptip.Instance` 挂载协议与宿主模板的 `Poptip.IsOpen` Trigger 联动（错误状态→气泡）——错误提示链（TextBox 家族 IsError/ResultType→Poptip）断裂；
3. **④ 绕过资源体系**：硬编码气泡底色/边框/文字色绕过 `BackgroundBrush`/`BorderBrush`/`WarningBrush` 键体系；
4. **⑤ 脱离视觉规范**：圆角 3、Padding 2、Offset 6 与 IsHitTestVisible=False（纯展示）策略脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Poptip.xaml`（锚点 `x:Key="PoptipBaseStyle"`（:12，IsHitTestVisible=False/Offset 6/BorderElement.CornerRadius 3）、隐式默认（:41））
- 使用实例：`{source_root}/SDC/Style/StringNumberBox.xaml:39-48`、`SwitchBox.xaml:38-47`、`SwitchPasswordBox.xaml:38-47`（Poptip.Instance 实例化）；`Poptip.IsOpen` 消费：IntNumberBox.xaml:197/:302、StringNumberBox.xaml:140、SwitchBox.xaml:125、SwitchPasswordBox.xaml:122、TextBox.xaml:128
- 真实使用：有（见上，P3 级业务模板内实例化）
- 附加属性协议（Poptip.IsOpen/Instance 等）：专述见附加属性批条目
- 索引交叉：`{index_root}/files/refence_SDC_Style_Poptip.xaml.json`

## 8. 待确认项

- TD-006：`Poptip` 附加属性族（Instance/IsOpen/PlacementType/HitMode 等参数语义）——.cs 不可见，行为面待确认（本条目仅覆盖控件样式本身）。
- [待确认 TD-xxx]：基样式 `Offset=6` 与业务实例 `Offset=2` 不一致（实例覆盖）；`HorizontalAlignment=Left/VerticalAlignment=Top` 在 Popup 宿主上下文中的定位语义待确认。
