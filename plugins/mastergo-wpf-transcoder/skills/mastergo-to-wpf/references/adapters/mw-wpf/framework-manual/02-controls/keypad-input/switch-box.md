<!-- evidence=已确认(属性 Setter/模板/触发器均为模板源码直接证据；Switch 语义与附加属性行为 .cs 不可见); pending=[TD-035,TD-036,TD-037,TD-039];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/SwitchBox.xaml, {source_root}/ManualView.xaml] -->

# SwitchBox（切换输入框）

## 1. 用途

框架版可切换文本输入框：紧凑型（25×150）文本输入——模板内组合原生 TextBox（PART_TextBox，套 InputTextBoxBase）+ 悬停步进钮 + Poptip 错误提示（ErrorStr/WarningBrush）+ 弹出键盘挂点。「Switch」语义待确认（见 TD-037）。

典型场景（推断，无 P2 实例）：需要切换输入模式/键盘类型的文本字段。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:SwitchBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:SwitchBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件经 MergedDictionaries 引用 NumberBox.xaml（复用 `UpdownButtonStyle`）；仅定义隐式默认样式。模板与 SwitchPasswordBox 逐行同构（仅 PART_TextBox 宿主类型不同：TextBox vs PasswordBox），与 StringNumberBox 同构（宿主同、Background 不同）——家族核对结论见报告。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| ErrorStr | string | 错误提示文案；Poptip.Instance 的 Content 绑定（TemplateBinding） | 模板 `Content="{TemplateBinding ErrorStr}"` | 🟡 [待确认 TD-039] |
| IsError | bool | 错误态：**双条件**（IsError + PART_TextBox 聚焦）→ 整控件 BorderBrush=WarningBrush + templateRoot 打开 Poptip | 模板 `MultiTrigger`（IsError + IsFocused SourceName=PART_TextBox）+ `controls:Poptip.IsOpen=True` | ✅（触发条件）/ 🟡 TD-039 |
| IsReadOnly | bool | 只读：步进钮禁用（第一处）→ BorderBrush 复原 + 步进钮隐藏（第二处，重复触发器疑似死代码）；**PART_TextBox 经 TemplateBinding 透传** | 模板 `Trigger Property="IsReadOnly"`（出现两处）+ PART_TextBox `IsReadOnly="{TemplateBinding IsReadOnly}"` | ✅ / 🟡 TD-039 |
| TextWrapping | 绑定透传 | 文本换行策略 | 模板 PART_TextBox `TextWrapping="{TemplateBinding TextWrapping}"` | ✅ |
| IsEnabled | bool | 禁用：Opacity 0.56 | 模板 `Trigger Property="IsEnabled"` | ✅ |
| controls:NumericKeypadAttach.IsEnabled | bool | True 时 PART_TextBox Focusable=False（弹出键盘挂点） | 模板 `Trigger Property="controls:NumericKeypadAttach.IsEnabled"` | 🟡 [待确认 TD-035] |
| Height / Width | 25 / 150（硬编码） | 紧凑尺寸（非 Token） | 样式 Setter | ✅ |
| Background / BorderBrush / Foreground | BackgroundLightBrush / BorderBrush / TextBrush | 默认画刷（Hover/聚焦切 PrimaryBrush） | 样式 Setter + 模板 Trigger | ✅ |
| VerticalContentAlignment / IsTabStop / FocusVisualStyle | Center / False / {x:Null} | 对齐与焦点策略 | 样式 Setter | ✅ |
| （无 Value / Minimum / Maximum / ShowUpDownButton 证据） | — | 无数值属性证据——文本输入控件 | 模板全文 + 全库 grep 无组合用法 | ✅（阴性证据） |
| （无 IOEnable / s:Action / PageName 证据） | — | 模板无协议挂点 | 模板全文 + `{source_root}/ManualView.xaml` | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\SwitchBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| （隐式默认样式，无 x:Key） | 无（独立；合并 NumberBox.xaml） | 25×150 紧凑文本框：PART_TextBox=原生 TextBox（套 InputTextBoxBase、TextWrapping/IsReadOnly 透传）+ Poptip.Instance（ErrorStr）+ Updown + 裸 oldValueBlock + Pop_keyBoard；Hover/聚焦 PrimaryBrush、错误 WarningBrush+Poptip | 未显式指定 Style 时（本文件唯一样式） |
| （共享键来自 NumberBox.xaml） | — | InputTextBoxBase / UpdownButtonStyle（经 MergedDictionaries 引用） | 内部共用 |

**家族结构差异**：无命名基样式、无布局变体；与 SwitchPasswordBox 逐行同构（宿主类型：TextBox vs PasswordBox）；与 StringNumberBox 差异仅 Background（BackgroundLightBrush vs PrimaryDefaultBrush）与 PART_TextBox 无 Tag 绑定——三模板触发器块完全相同。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 与组合模板均未使用 SwitchBox（grep 全库仅定义处命中）。以下为模板证据构造。

```xml
<s:SwitchBox Text="{Binding …文本参数}"
             controls:NumericKeypadAttach.IsEnabled="True" />
```

- 文本内容经 Text/TextWrapping 标准属性透传内部 PART_TextBox；
- 悬停/聚焦边框 PrimaryBrush、错误 WarningBrush+Poptip 提示、禁用 Opacity 0.56、只读管控全部内建；
- 「Switch」（切换）具体能力面 .cs 不可见，待确认（TD-037）。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBox + 自绘错误提示与触发态（常规 WPF 写法）

```xml
<TextBox x:Name="sw" Width="150" Height="25" VerticalContentAlignment="Center"
         Padding="5,0" InputMethod.IsInputMethodEnabled="False"/>
<!-- 再手写：错误文案绑定、错误状态 BorderBrush 切换、Popup 提示、聚焦恢复、禁用半透明、键盘切换… -->
```

### ✅ 推荐：SwitchBox 一行（模板证据构造）

```xml
<s:SwitchBox Text="{Binding …文本参数}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版缺失错误态 WarningBrush+Poptip 联动、Hover/聚焦 PrimaryBrush、禁用 Opacity 0.56、只读步进钮管控全套触发；
2. **② 丢失协议挂点**：ErrorStr / Poptip.IsOpen / NumericKeypadAttach 附加属性协议全无，错误与键盘切换只能自绘自造；
3. **③ 无法样式族切换**：紧凑输入框规范（25×150、IsTabStop=False）散写失控，无法随框架一处调整；
4. **④ 键盘挂点缺失**：NumericKeypadAttach 弹出键盘无法启用，字符串输入必须依赖硬件键盘；
5. **⑤ 脱离视觉规范**：Padding 5,0、FocusVisualStyle、输入法策略（InputMethod.IsInputMethodEnabled=False）规范脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/SwitchBox.xaml`（锚点 `x:Name="PART_TextBox"`、`controls:Poptip.Instance`、`Content="{TemplateBinding ErrorStr}"`、`Trigger Property="controls:NumericKeypadAttach.IsEnabled"`）
- 共享键定义：`{source_root}/SDC/Style/NumberBox.xaml`（`x:Key="InputTextBoxBase"`、`x:Key="UpdownButtonStyle"`）
- 同构对照：`{source_root}/SDC/Style/SwitchPasswordBox.xaml`（同构模板，宿主 PasswordBox）、`{source_root}/SDC/Style/StringNumberBox.xaml`（同构模板，PrimaryDefaultBrush 底 + Tag 绑定）
- 真实使用：无（ManualView.xaml 与组合模板不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_SwitchBox.xaml.json`

## 8. 待确认项

- **TD-035**：NumericKeypadAttach.IsEnabled 键垫弹出机制。
- **TD-036**：裸 oldValueBlock 死元素确认（与历史值机制关系）。
- **TD-037**：SwitchBox/SwitchPasswordBox「Switch」语义与 .cs 差异——模板与 StringNumberBox 逐行同构（仅宿主类型与 Background 不同），真实差异在 .cs 行为面。
- **TD-039**：ErrorStr 语义；重复 IsReadOnly 触发器死代码；错误画刷 WarningBrush vs 红 SolidColorBrush 家族差异。
