<!-- evidence=已确认(属性 Setter/模板/触发器均为模板源码直接证据；ErrorStr 语义与附加属性行为 .cs 不可见); pending=[TD-035,TD-036,TD-039];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/StringNumberBox.xaml, {source_root}/ManualView.xaml] -->

# StringNumberBox（字符串输入框）

## 1. 用途

框架版字符串输入框：与 NumberBox 同构的输入骨架（PART_TextBox + 悬停步进钮 + 弹出键盘挂点），差异面——**Poptip 错误提示内建于模板**（`Poptip.Instance` 消费 `ErrorStr`，错误态 BorderBrush=WarningBrush 而非红色）、无 MaxLength、无历史值浮层（IsWaitingAccept）。用于字符串参数录入。

典型场景（推断，无 P2 实例）：配方名、路径等字符串参数输入。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:StringNumberBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:StringNumberBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件经 MergedDictionaries 引用 NumberBox.xaml（复用 `InputTextBoxBase` / `UpdownButtonStyle`）；**仅定义隐式默认样式，无 x:Key 基样式、无布局变体**——样式族结构与 NumberBox/IntNumberBox 不同（家族核对结论见报告）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| ErrorStr | string | 错误提示文案；模板经 `Poptip.Instance` 的 Content 绑定消费（TemplateBinding），由谁设置 .cs 不可见 | 模板 `Content="{TemplateBinding ErrorStr}"`（Poptip 内） | 🟡 [待确认 TD-039] |
| IsError | bool | 错误态：**双条件**（IsError + PART_TextBox 聚焦）→ 整控件 BorderBrush=WarningBrush + templateRoot 打开 Poptip | 模板 `MultiTrigger`（IsError + IsFocused SourceName=PART_TextBox）+ `controls:Poptip.IsOpen=True` | ✅（触发条件）/ 🟡 TD-039 |
| IsReadOnly | bool | 只读：灰底 #FFF0F0F0、灰边 #FFB0B0B0、步进钮禁用并隐藏；**模板内同一触发器重复出现两次**（疑似死代码） | 模板 `Trigger Property="IsReadOnly"`（出现两处） | ✅ / 🟡 TD-039 |
| IsEnabled | bool | 禁用：Opacity 0.56 | 模板 `Trigger Property="IsEnabled"` | ✅ |
| controls:NumericKeypadAttach.IsEnabled | bool | True 时 PART_TextBox Focusable=False（弹出键盘挂点） | 模板 `Trigger Property="controls:NumericKeypadAttach.IsEnabled"` | 🟡 [待确认 TD-035] |
| TextWrapping | 绑定透传 | 文本换行策略（模板 PART_TextBox 经 TemplateBinding 透传） | 模板 `TextWrapping="{TemplateBinding TextWrapping}"` | ✅ |
| Height / Width | DynamicResource TextBoxHeight（35）/ TextBoxWidth（100） | 默认尺寸 Token | 样式 Setter + Sizes.xaml | ✅ |
| HorizontalContentAlignment / FontSize / Foreground / VerticalContentAlignment / IsTabStop / FocusVisualStyle | — | TextHorizontalAlignment / SubHeaderFontSize / TextBrush / Center / False / {x:Null} | 样式各 Setter | ✅ |
| Background / BorderBrush | DynamicResource PrimaryDefaultBrush / BorderBrush | 默认底色与边框（错误态覆盖为 WarningBrush） | 样式 Setter + 错误 MultiTrigger | ✅ |
| （无 Value / Minimum / Maximum / ShowUpDownButton 证据） | — | 本控件模板与组合用法中无数值属性证据——StringNumberBox 为字符串输入，不具数值语义 | 模板全文 + 全库 grep 无组合用法 | ✅（阴性证据） |
| （无 IOEnable / s:Action / PageName 证据） | — | 模板无协议挂点 | 模板全文 + `{source_root}/ManualView.xaml` | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\StringNumberBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| （隐式默认样式，无 x:Key） | 无（独立；合并 NumberBox.xaml） | 默认 Setter 全集 + 独立模板：PART_TextBox（Tag 绑定元素 Name、无 MaxLength）+ Poptip.Instance（ErrorStr/WarningBrush）+ Updown + 裸 oldValueBlock + Pop_keyBoard；Hover/聚焦 PrimaryBrush、错误 WarningBrush+Poptip、只读灰底 | 未显式指定 Style 时（本文件唯一样式） |
| （共享键来自 NumberBox.xaml） | — | InputTextBoxBase / UpdownButtonStyle（经 MergedDictionaries 引用） | 内部共用 |

**家族结构差异**：本文件无命名基样式、无 LeftRight 布局变体；`x:Name="oldValueBlock"` 为**无 Border 包裹、无 IsWaitingAccept 触发器的裸 TextBlock**——与 NumberBox/IntNumberBox 的 oldValueBorder（带 ToolTip、有触发器）不同，疑似复制遗留死元素（TD-036）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 与组合模板均未使用 StringNumberBox（全库 grep 仅定义处命中）。以下为模板证据构造。

```xml
<s:StringNumberBox s:NumericKeypadAttach.IsEnabled="True"
                   Text="{Binding …字符串参数}" />
```

- 模板 PART_TextBox 经 `Tag="{TemplateBinding Name}"` 标记元素名（供 .cs 定位），页面侧无需关心；
- 错误提示内建于模板：.cs 设置 IsError 与 ErrorStr 后自动红字提示（语义待确认 TD-039）；
- 尺寸、字号、圆角、Hover/聚焦/只读/禁用全套交互态默认生效。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBox + 自绘错误提示（常规 WPF 写法）

```xml
<TextBox x:Name="str" VerticalContentAlignment="Center" Padding="5,0"
         InputMethod.IsInputMethodEnabled="False"/>
<!-- 再手写：错误文案绑定、错误状态 BorderBrush 切换、Popup/ToolTip 提示、聚焦恢复、禁用半透明… -->
```

### ✅ 推荐：StringNumberBox 一行（模板证据构造）

```xml
<s:StringNumberBox Text="{Binding …字符串参数}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版缺失错误态 WarningBrush+Poptip 联动、Hover/聚焦 PrimaryBrush、只读灰底 #FFF0F0F0、禁用 Opacity 0.56 全套触发；
2. **② 丢失协议挂点**：ErrorStr / Poptip.IsOpen / NumericKeypadAttach / BorderElement 附加属性协议全无，错误提示只能手写 ToolTip 或自造 Popup；
3. **③ 无法样式族切换**：字符串输入框规范（尺寸 Token 100×35、字号 14、Tag 定位约定）散写失控，无法随框架一处调整；
4. **④ 键盘挂点缺失**：NumericKeypadAttach 弹出键盘（字符键盘）无法启用，字符串输入必须依赖硬件键盘；
5. **⑤ 脱离视觉规范**：Padding 5,0、IsTabStop=False、FocusVisualStyle 等规范脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/StringNumberBox.xaml`（锚点 `x:Name="PART_TextBox"`、`controls:Poptip.Instance`、`Content="{TemplateBinding ErrorStr}"`、`Trigger Property="IsError"`、`Trigger Property="IsReadOnly"`）
- 共享键定义：`{source_root}/SDC/Style/NumberBox.xaml`（`x:Key="InputTextBoxBase"`、`x:Key="UpdownButtonStyle"`）
- Token：`{source_root}/SDC/Sizes.xaml`（TextBoxWidth/TextBoxHeight）、`{source_root}/SDC/Fonts.xaml`（SubHeaderFontSize）、`{source_root}/SDC/RightAlignment.xaml`（TextHorizontalAlignment）
- 真实使用：无（ManualView.xaml 与组合模板不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_StringNumberBox.xaml.json`

## 8. 待确认项

- **TD-035**：NumericKeypadAttach.IsEnabled 键垫弹出机制（本控件为字符串输入，键垫应为字符键盘——键盘类型选择机制待确认）。
- **TD-036**：本模板裸 oldValueBlock（无包裹 Border、无触发器）是否复制遗留死元素；与 NumberBox 的 oldValueBorder 历史值机制关系。
- **TD-039**：ErrorStr 属性语义（文案由谁设置、与 IsError 的联动）；重复 IsReadOnly 触发器（同文件两处，第二处仅 BorderBrush 复原 + Updown 折叠）是否死代码；错误画刷为 WarningBrush 而 NumberBox/IntNumberBox 为红 SolidColorBrush 的家族差异是否有意。
