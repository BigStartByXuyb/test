<!-- evidence=已确认(样式 Setter/DataTemplate 均为模板源码直接证据；无 P2 页面使用实例); pending=[待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/Lable.xaml, {source_root}/ManualView.xaml] -->

# Label（标签，框架版）

## 1. 用途

框架统一样式版 `Label`（标准 WPF Label + 隐式默认样式）：居中排布、主题前景（PrimaryTextBrush）、主题字号（TextFontSize=12）。同文件还定义 `DefaultLabelPanel` 模板（底部小标签面板）。典型场景（推断，无 P2 实例）：表单字段名、分组标题——ManualView.xaml 未使用 Label（其文字以 TextBlock/IconButton Content 承载）。

注意：样式文件名为 `Lable.xaml`（框架内拼写），但 TargetType 为标准 `Label`。

## 2. 声明

```xml
<Label … />（标准 WPF Label；默认样式自动应用，无自定义前缀控件）
```

样式 TargetType = `{x:Type Label}`，基于 `x:Key="LableBaseStyle"` 的隐式默认样式全局兜底。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Foreground | Brush | 默认 PrimaryTextBrush | `x:Key="LableBaseStyle"` Setter | ✅ |
| FontSize | double | 默认 TextFontSize（12，Fonts.xaml） | LableBaseStyle Setter + `{source_root}/SDC/Fonts.xaml` `TextFontSize` | ✅ |
| HorizontalAlignment / VerticalAlignment | Alignment | 默认 Center / Center | LableBaseStyle Setter | ✅ |
| Content | object | 标准 Label 内容（隐式样式继承 LableBaseStyle） | 隐式默认样式 BasedOn | ✅ |
| DefaultLabelPanel（DataTemplate 资源） | DataTemplate（x:Shared=False） | 底部小标签面板：宽 70、蓝边 #00A0FB、圆角 3、Agency FB 白字；`x:Shared="False"` 防「元素已是逻辑子元素」复用冲突；**挂载场景仅推断** | `x:Key="DefaultLabelPanel"` + 同文件注释 | 🟡 [待确认 TD-xxx] |

## 4. 样式族表（SDC\Style\Lable.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| LableBaseStyle | 无（独立，TargetType Label） | 居中 + PrimaryTextBrush + TextFontSize(12) | 基样式，不直接用 |
| （隐式默认 Label 样式） | LableBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |
| DefaultLabelPanel | DataTemplate 资源 | 70 宽底对齐蓝边小面板、Agency FB 白字、x:Shared=False | 图表/看板底部标签（需 ContentTemplate 引用的挂件；见下） |

关联：`Dashboard.xaml` 存在**同名** `DefaultLabelPanel`（自身副本，作 `ContentTemplate` 使用）——两处定义的关系待确认（区块 8）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `<Label>`。

```xml
<Label Content="{DynamicResource …标签文本键}"/>
```

- 文本一律走 DynamicResource 键（总则 4），标签只声明内容，样式由隐式默认样式承载；
- `DefaultLabelPanel` 需在宿主页显式引用：`ContentTemplate="{StaticResource DefaultLabelPanel}"`（参照 Dashboard.xaml 的用法）。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBlock 模拟标签（散写颜色/字号/居中）

```xml
<TextBlock Text="…硬编码文案…" Foreground="#…" FontSize="12"
           HorizontalAlignment="Center" VerticalAlignment="Center"/>
```

### ✅ 推荐：Label + 本地化键

```xml
<Label Content="{DynamicResource …标签文本键}"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **⑤ 脱离视觉规范**：硬编码颜色绕过 PrimaryTextBrush/TextFontSize 主题画刷体系，主题切换后无法跟随；
2. **④ 绕过本地化**：硬编码文案绕过 DynamicResource 文本键体系；
3. **③ 无法样式族切换**：LableBaseStyle 一处修改（字号/前景）即可全局生效，散写 TextBlock 需逐处改；
4. **① 丢失状态/语义**：Label 的 Control 无障碍语义与访问键（RecognizesAccessKey）行为丢失，TextBlock 非可聚焦控件。
5. 适用边界：ManualView 中 TextBlock 用于 F 键角标、状态文字等**非标签场景**，不属反例范围；本对照仅针对「语义是标签」的场景。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Lable.xaml`（锚点 `x:Key="LableBaseStyle"`、`x:Key="DefaultLabelPanel"`、隐式默认样式）
- 关联副本：`{source_root}/SDC/Style/Dashboard.xaml`（同名 `x:Key="DefaultLabelPanel"` 及其 `Setter Property="ContentTemplate"` 用法）
- 真实使用：无（ManualView.xaml 不含 Label）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Lable.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：`DefaultLabelPanel` 的实际挂载场景与 Lable.xaml/Dashboard.xaml 同名重复定义的关系（x:Shared=False 注释暗示多挂载点，但调用方证据缺失）（已建议编号，见 `../../05-best-practices/pending-confirmations.md`）。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据。
