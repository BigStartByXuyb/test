<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-006]; verified=2026-08-14;
     sources=[{source_root}/SDC/FrameworkGeneric.xaml, {source_root}/SDC/Style/Button.xaml, {source_root}/SDC/Style/NumberBox.xaml, {source_root}/SDC/Style/Slider.xaml, {source_root}/SDC/Style/PasswordBox.xaml, {source_root}/SDC/Style/Poptip.xaml, {source_root}/ManualView.xaml] -->

# BorderElement（圆角附加属性）

## 1. 用途

框架统一圆角协议：宿主类 `controls:BorderElement` 暴露 `CornerRadius` 附加属性，挂到任意 UIElement 上，由该元素样式模板内的 `Border` 圆角消费。全库 grep 统计 **112 处使用**（SDC 全目录属性使用量第一），是消费面最广的附加属性。

典型场景（按消费分布）：Button 家族全套样式（Button.xaml、IconButton 基样式）、输入框家族（NumberBox/TextBox/IOTextBox/IntNumberBox/PasswordBox）、Slider/RangeSlider 轨道、Poptip、ProgressBar/ListBox/Expander/DateTimePicker 等样式族。

## 2. 声明

```xml
<Button controls:BorderElement.CornerRadius="3" … />
```

- `controls` = `clr-namespace:MaxwellControl.Controls`（私有程序集，.cs 本地不可见）；
- 挂载方式：Style Setter（族级默认）、样式族变体覆盖、元素内联覆盖三种形态；
- 消费方式：模板内 `CornerRadius="{TemplateBinding controls:BorderElement.CornerRadius}"`（简单模板）或 `{Binding Path=(controls:BorderElement.CornerRadius), RelativeSource={RelativeSource TemplatedParent}}`（括号附加属性绑定语法，多层模板场景）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| CornerRadius | CornerRadius 字符串（"3"、"3,0,0,3"、"3 3 0 0"、"2 0 0 2"、"0 0 3 3"、"0 0 3 3,0 0" 等） | 模板 Border 圆角；双层 Border 结构（背景层/边框层）同值消费 | Button.xaml:27（ControlButtonBaseStyle Setter）+ :32-33（模板双 Border TemplateBinding）、:94 + :99-100（ButtonBaseStyle） | ✅ |
| 其余成员 | — | 全库 112 处命中仅 CornerRadius 一属性 | grep 统计 | ❓ TD-006 |

消费形态三式（均为模板源码直接证据）：

1. **Style Setter 定义默认**：`Button.xaml:27`（ControlButtonBaseStyle 圆角 3）、`Button.xaml:94`（ButtonBaseStyle 圆角 3）、`PasswordBox.xaml:133`（隐式默认 3）、`TextBox.xaml:21`（TextBoxBaseStyle 3）、`Poptip.xaml:20`（PoptipBaseStyle 3）；
2. **样式族变体覆盖**：ButtonGroupItem 五变体 `Button.xaml:408/414/419/424/430`（0/3/3,0,0,3/3 3 0 0/0 0 3 3 交替）、ButtonGroup 变体；
3. **元素内联覆盖**：Slider.xaml:305（NumberBox 组合处 `CornerRadius="0"` 归零）、DatePickerExtend.xaml 等——页面级「就近覆盖」。

模板消费语法双式：TemplateBinding（Button.xaml:32-33/99-100 等绝大多数）与括号绑定（Button.xaml:373-374/475/509、NumberBox.xaml:153 oldValueBorder `CornerRadius="{Binding Path=(controls:BorderElement.CornerRadius),…}"`）。

**重要阴性证据**：`{source_root}/SDC/FrameworkGeneric.xaml` 全文 **零使用** BorderElement——该文件仅宿主 DropDownElement / PasswordBoxAttach / SimplePanel，无 BorderElement 消费。

## 4. 样式族表

无（本条目为附加属性，非样式族；各消费样式族见对应控件条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用（`controls:` 前缀 grep 零命中）。以下为 P1 模板证据构造。

```xml
<Button Style="{StaticResource ControlButtonBaseStyle}"
        controls:BorderElement.CornerRadius="3"/>
```

- 族级默认由样式 Setter 提供，页面通常无需书写（Button 家族默认已带圆角 3）；
- 需要异形时元素级覆盖：`<Slider …><s:NumberBox controls:BorderElement.CornerRadius="0" …/></Slider>`（Slider.xaml:305 原样用法）；
- 角标差异布局用四角拆写字符串（"3 3 0 0" 等，Button.xaml:414-430 变体原样）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Border 包裹 + 硬编码 CornerRadius（等效替代）

```xml
<Border CornerRadius="3" Background="…" BorderBrush="…" BorderThickness="1">
    <Button …/>
</Border>
```

### ✅ 推荐：BorderElement 属性化

```xml
<Button controls:BorderElement.CornerRadius="3" …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写外层 Border 不参与按钮模板的 Hover/Pressed/Disabled 触发器——按压/禁用时圆角与状态画刷各自为政；
2. **② 丢失协议挂点**：BorderElement 是模板内部 Border 的数据源协议，手写包裹使模板的 TemplateBinding 悬空，样式族任何圆角调整无法穿透到页面；
3. **③ 无法样式族切换**：圆角被钉死在页面，一键换样式族（ControlButtonBaseStyle→ButtonGroupItem* 变体）时圆角不随族切换；
4. **④ 双层 Border 结构断裂**：框架模板为背景层+边框层双 Border 同值圆角，手写单层无法在按压等状态触发时保持一致；
5. **⑤ 脱离视觉规范**：圆角 Token（3 为主、0/10 按场景）散写页面，与整体视觉基线脱节。

## 7. 参考锚点

- 定义/消费：`{source_root}/SDC/Style/Button.xaml`（`x:Key="ControlButtonBaseStyle"` Setter :27 + 模板 :32-33、`x:Key="ButtonBaseStyle"` :94 + :99-100、ButtonGroupItem 五变体 :408-430、括号语法 :373-374/475/509）
- 输入框家族：`{source_root}/SDC/Style/NumberBox.xaml`（oldValueBorder 绑定 :153）、`{source_root}/SDC/Style/TextBox.xaml`（:21）、`{source_root}/SDC/Style/PasswordBox.xaml`（:133）、`{source_root}/SDC/Style/IOTextBox.xaml`（:20/32）
- 轨道/提示：`{source_root}/SDC/Style/Slider.xaml`（内联覆盖 :305 等 13 处）、`{source_root}/SDC/Style/Poptip.xaml`（:20）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Button.xaml.json` 等

## 8. 待确认项

- **TD-006**（复用）：BorderElement 宿主类完整成员清单与 CornerRadius 运行时行为（默认值、四角拆写解析、与 FocusVisual 圆角联动）——.cs 不可见，当前仅确认模板消费侧语法。
