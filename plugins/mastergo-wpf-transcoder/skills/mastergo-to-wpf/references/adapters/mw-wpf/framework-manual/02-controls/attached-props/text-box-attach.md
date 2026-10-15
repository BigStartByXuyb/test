<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-027,TD-006]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/TextBox.xaml, {source_root}/SDC/Style/IOTextBox.xaml, {source_root}/ManualView.xaml] -->

# TextBoxAttach（文本框行为附加属性）

## 1. 用途

框架文本框行为协议：宿主类 `controls:TextBoxAttach` 提供 `SelectAll` 附加属性——`True` 时开启文本全选行为（聚焦全选等，语义待确认）。**活跃消费仅一处**：IOTextBoxBaseStyle 开启（IOTextBox.xaml:25）；TextBox.xaml 家族对应 Setter 已注释（:26，疑似待启用）。

## 2. 声明

```xml
<s:IOTextBox controls:TextBoxAttach.SelectAll="True" …/>
<!-- IO 家族族级默认已含 -->
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 行为由 .cs 挂钩（行为细节不可见）；模板侧无触发器消费（纯行为型附加属性）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| SelectAll | bool | 文本全选行为开关（聚焦全选？语义待确认）；IOTextBox 家族默认 True，TextBox 家族 Setter 已注释 | IOTextBox.xaml:25（IOTextBoxBaseStyle Setter，唯一活跃）；TextBox.xaml:26（注释） | ❓ [TD-027/TD-006] |
| 其余成员 | — | 全库 grep 仅 SelectAll 一属性命中 | grep 统计 | ❓ TD-006 |

**阴性证据**：全库模板 Trigger 零消费 TextBoxAttach——纯行为协议，与 BorderElement（模板消费型）形成对照。

## 4. 样式族表

无（本条目为附加属性；消费样式族见 [io-text-box](../io/io-text-box.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<s:IOTextBox controls:TextBoxAttach.SelectAll="True"
             Value="{Binding …}"/>
```

- IO 家族默认开启，页面通常不写；关闭可显式 `"False"`；
- TextBox 家族默认关闭（Setter 注释），需要时显式开启。

## 6. 禁止写法对照

### ❌ 禁止：手写 GotFocus 事件 + SelectAll()（等效替代）

```xml
<TextBox GotFocus="Tb_GotFocus" …/>
<!-- 事件侧：
     private void Tb_GotFocus(object sender, RoutedEventArgs e)
     { ((TextBox)sender).SelectAll(); } -->
```

### ✅ 推荐：TextBoxAttach 属性化

```xml
<s:IOTextBox controls:TextBoxAttach.SelectAll="True" …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：行为协议丢失——框架 .cs 挂钩的行为细节（触发时机、与 IME/输入法联动）页面无法获得，事件版只是近似；
2. **③ 无法样式族切换**：开/关靠属性随样式族切换（IOTextBox 家族 True / TextBox 家族关闭）的机制失效，需逐个事件挂钩/摘除；
3. **① 丢失状态**：手写事件与控件内部状态（只读/禁用/错误态）叠加时行为分叉，聚焦时序难以对齐框架内部实现；
4. **④ 代码分散**：XAML 声明式 → 代码后置的范式倒退回事件散落页面。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/IOTextBox.xaml`（锚点 `x:Key="IOTextBoxBaseStyle"` Setter :25）
- 对照：`{source_root}/SDC/Style/TextBox.xaml`（:26 注释态 Setter，家族未启用）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOTextBox.xaml.json`

## 8. 待确认项

- **TD-027**（复用）：TextBoxAttach.SelectAll 行为语义（触发时机、是否聚焦全选）与 TextBox.xaml:26 注释的原因——定义与行为 .cs 不可见。
- **TD-006**（复用）：宿主类成员全集确认。
