<!-- evidence=已确认(隐式默认样式 Setter 均为模板源码直接证据；StatusColor 绑定数据源待确认); pending=[待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOTextBlock.xaml, {source_root}/ManualView.xaml] -->

# IOTextBlock（状态文字）

## 1. 用途

框架版状态文字块：居中、自动换行、字号取 `SubHeaderFontSize`（14），前景色默认绑定 `StatusColor`——与设备/运行状态联动的文字展示。用于状态描述文字（如流程状态、报警文案）。

典型场景（推断，无 P2 实例）：状态面板中的描述性文字。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:IOTextBlock … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOTextBlock`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件仅含隐式默认样式（无 x:Key、无模板），控件继承自 TextBlock（按命名与无模板推断，基类默认模板生效），继承属性（Text 等）可直接使用。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| HorizontalAlignment | Center | 隐式默认样式默认水平居中 | `Setter Property="HorizontalAlignment"` | ✅ |
| VerticalAlignment | Center | 默认垂直居中 | `Setter Property="VerticalAlignment"` | ✅ |
| TextWrapping | Wrap | 默认自动换行 | `Setter Property="TextWrapping"` | ✅ |
| FontSize | DynamicResource `SubHeaderFontSize`（14） | 默认字号走框架字号 Token（Fonts.xaml:6 定义 14） | `Setter Property="FontSize"` | ✅ |
| Foreground | `{Binding StatusColor}` | 默认前景绑定 `StatusColor`——**无 RelativeSource**，即绑定 DataContext 属性；StatusColor 是页面 ViewModel 约定还是控件 DP，本地无法判定 | `Setter Property="Foreground"` | 🟡 [待确认 TD-xxx] |
| Text 及 TextBlock 继承属性 | 继承自 TextBlock | 无样式/模板证据；按控件命名与「无模板」推断继承 TextBlock | 无模板（隐式样式无 ControlTemplate） | ❓ [待确认 TD-xxx] |
| （无 IOEnable 证据） | — | 模板中无 IOEnable / 协议挂点；设备联锁协议见 TD-001 | 模板全文 + `{source_root}/ManualView.xaml`（IOEnable 仅出现于 IconButton） | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\IOTextBlock.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| （隐式默认样式） | 无（独立） | 无 x:Key、无模板；仅 5 个 Setter（居中×2、Wrap、FontSize=SubHeaderFontSize、Foreground=Binding StatusColor） | 未显式指定 Style 时全局生效 |

无样式族、无模板资源键。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 FrameworkGeneric.xaml 均未出现 `s:IOTextBlock`。

```xml
<s:IOTextBlock Text="{DynamicResource …状态文字键}" />
```

- Text 等继承属性照常使用（推断继承 TextBlock）；
- 默认样式已处理居中/换行/字号/状态色，页面侧只负责 Text 内容；
- 若页面 DataContext 提供 `StatusColor` 则前景自动跟随；在 StatusColor 数据源约定确认前（见区块 8），需要明确前景的场景可显式覆盖 Foreground。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBlock 散写属性 + 手工状态色绑定（常规 WPF 写法）

```xml
<TextBlock HorizontalAlignment="Center" VerticalAlignment="Center"
           TextWrapping="Wrap" FontSize="14"
           Foreground="{Binding StatusColor}" Text="…" />
```

### ✅ 推荐：IOTextBlock（模板证据构造）

```xml
<s:IOTextBlock Text="{DynamicResource …状态文字键}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：手写 TextBlock 没有框架状态色协议挂点——`StatusColor` 联动约定落在控件默认样式上（模板 Setter 证据），手写版只能各自为政地绑定；
2. **③ 无法样式族切换**：居中/换行/字号 14（SubHeaderFontSize）全部散写，框架调整默认样式（如换字号 Token）时手写页面不跟随；
3. **④ 绕过本地化**：手写 TextBlock 直接写文案绕过 DynamicResource 文本键体系（见 [03-protocols/localization-text.md](../../03-protocols/localization-text.md)）；
4. **⑤ 脱离视觉规范**：字号/对齐规范失控，页面文字视觉无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOTextBlock.xaml`（锚点：隐式 `Style TargetType="{x:Type controls:IOTextBlock}"` 与 5 个 Setter、`Foreground` Setter 的 `{Binding StatusColor}`）
- 字号 Token：`{source_root}/SDC/Fonts.xaml`（`x:Key="SubHeaderFontSize"`）
- 真实使用：无（ManualView.xaml / FrameworkGeneric.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOTextBlock.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：`Foreground="{Binding StatusColor}"` 的数据源约定——DataContext 属性（页面 ViewModel 需提供 StatusColor）还是控件 DP/继承机制；StatusColor 的类型与取值（Color/Brush/状态码）。
- [待确认 TD-xxx]：IOTextBlock 基类确认（推断继承 TextBlock，.cs 不可见）。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据；IOEnable 使用面仅见 IconButton（`{source_root}/ManualView.xaml`），「IO 系列核心协议 IOEnable」在 IOTextBlock 无模板支持，待框架作者确认（见手册发布说明）。
