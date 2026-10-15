<!-- evidence=已确认(属性 Setter/模板/触发器均为模板源码直接证据；附加属性行为与基类 .cs 不可见); pending=[待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOTextBox.xaml, {source_root}/ManualView.xaml] -->

# IOTextBox（输入框）

## 1. 用途

框架版文本输入框：标准 TextBox 功能 + 内建水印（WatermarkElement）、圆角（BorderElement）、聚焦全选（TextBoxAttach.SelectAll）与完整交互态——Hover/聚焦边框变 `PrimaryToolBrush`、禁用半透明（Opacity 0.5）、只读灰底（#EAEDF2）。用于参数录入、查询输入等场景。

典型场景（推断，无 P2 实例）：参数设置区输入框。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:IOTextBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOTextBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件仅含样式层（`IOTextBoxBaseStyle` + 隐式默认样式）。模板 `ControlTemplate TargetType="TextBox"` 与样式 TargetType=IOTextBox 并存——强证据表明 IOTextBox 继承自 TextBox（基类确认待 .cs）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| BorderThickness | 1 | 默认 1px 边框（Setter 出现两次，同值） | `Setter Property="BorderThickness"` | ✅ |
| FontSize | DynamicResource `SubHeaderFontSize`（14） | 默认字号走框架字号 Token | `Setter Property="FontSize"` | ✅ |
| Padding | 5,0 | 水平内边距 | `Setter Property="Padding"` | ✅ |
| VerticalContentAlignment | Center | 内容垂直居中 | `Setter Property="VerticalContentAlignment"` | ✅ |
| Background | DynamicResource `PrimaryDefaultBrush` | 默认底色；IsReadOnly=True 时切 #EAEDF2 | `Setter Property="Background"` + `Trigger Property="IsReadOnly"` | ✅ |
| BorderBrush | DynamicResource `BorderBrush` | 默认边框；Hover/聚焦切 `PrimaryToolBrush` | `Setter Property="BorderBrush"` + `Trigger Property="IsMouseOver"` / `Trigger Property="IsKeyboardFocused"` | ✅ |
| Foreground | DynamicResource `PrimaryTextBrush` | 默认文字色（水印同时继承并半透明） | `Setter Property="Foreground"` + 模板 Watermark 绑定 | ✅ |
| Height / Width | DynamicResource `TextBoxHeight`（35）/ `TextBoxWidth`（100） | 默认尺寸走 Sizes Token | `Setter Property="Height"/"Width"` + `Sizes.xaml` `x:Key="TextBoxHeight"`/`x:Key="TextBoxWidth"` | ✅ |
| AllowDrop | true | 默认允许拖放 | `Setter Property="AllowDrop"` | ✅ |
| s:WatermarkElement.Watermark | string，默认 "" | 附加属性水印；Text 为空时显示（Opacity 0.5），Text 非空隐藏 | `Setter Property="controls:WatermarkElement.Watermark"` + 模板 `x:Name="Watermark"` TextBlock 绑定 + `Trigger Property="Text" Value=""` | ✅ |
| s:BorderElement.CornerRadius | 3 | 附加属性圆角（模板 Border 消费） | `Setter Property="controls:BorderElement.CornerRadius"` + 模板 `CornerRadius="{TemplateBinding controls:BorderElement.CornerRadius}"` | ✅ |
| s:TextBoxAttach.SelectAll | True | 附加属性聚焦全选；行为语义 .cs 不可见 | `Setter Property="controls:TextBoxAttach.SelectAll"` | 🟡 [待确认 TD-xxx] |
| PART_ContentHost | ScrollViewer | 标准 TextBox 命名部件（文本框宿主） | 模板 `x:Name="PART_ContentHost"` | ✅ |
| （无 IOEnable 证据） | — | 模板中无 IOEnable / 协议挂点；设备联锁协议见 TD-001 | 模板全文 + `{source_root}/ManualView.xaml`（IOEnable 仅出现于 IconButton） | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\IOTextBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IOTextBoxBaseStyle | 无（独立，MergedDictionaries 引 BaseStyle.xaml） | 默认模板：Border（圆角 3）+ PART_ContentHost + Watermark 层；触发态 Hover/聚焦/禁用/只读/空文本 5 组 | 基样式，不直接用 |
| （隐式默认样式） | IOTextBoxBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 FrameworkGeneric.xaml 均未出现 `s:IOTextBox`。

```xml
<s:IOTextBox s:WatermarkElement.Watermark="{DynamicResource …水印文本键}"
             Text="{Binding …参数}" />
```

- 水印经附加属性注入（`s:WatermarkElement.Watermark`），空文本自动显示、输入后自动隐藏（模板 `Trigger Property="Text" Value=""`）；
- 默认样式已含尺寸（100×35）、圆角 3、Hover/聚焦/禁用/只读全套交互态，页面侧只需 Text 与绑定；
- 输入框可用性（禁用/只读）由 IsEnabled/IsReadOnly 标准属性控制。

## 6. 禁止写法对照

### ❌ 禁止：手写 Border + TextBox + 自绘水印与触发态（常规 WPF 写法）

```xml
<Border CornerRadius="3" BorderBrush="{StaticResource …}" BorderThickness="1">
    <Grid>
        <TextBox x:Name="tb" BorderThickness="0" VerticalContentAlignment="Center" Padding="5,0"/>
        <TextBlock x:Name="wm" Text="请输入…" Opacity="0.5" IsHitTestVisible="False"
                   VerticalAlignment="Center" Padding="5,0" Visibility="Collapsed"/>
    </Grid>
</Border>
<!-- 再在 Style.Triggers 手写：空文本→显示水印、聚焦→换边框色、禁用→半透明、只读→灰底… -->
```

### ✅ 推荐：IOTextBox 一行（模板证据构造）

```xml
<s:IOTextBox s:WatermarkElement.Watermark="{DynamicResource …水印文本键}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版缺失 5 组触发态——Hover/聚焦 `PrimaryToolBrush` 边框、禁用 Opacity 0.5、只读灰底 #EAEDF2、空文本水印显隐；
2. **② 丢失协议挂点**：`WatermarkElement.Watermark`、`TextBoxAttach.SelectAll`（聚焦全选）、`BorderElement.CornerRadius` 三个附加属性协议全无，水印只能硬编码在模板里；
3. **③ 无法样式族切换**：尺寸（TextBoxWidth/Height 100×35）、圆角、画刷全部散写，不能由 IOTextBoxBaseStyle 一处调整；
4. **④ 绕过本地化**：水印"请输入…"硬编码绕过 DynamicResource 文本键体系；
5. **⑤ 脱离视觉规范**：PART_ContentHost 宿主、Padding 5,0、字号 14 等规范脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOTextBox.xaml`（锚点 `x:Key="IOTextBoxBaseStyle"`、`x:Name="PART_ContentHost"`、`x:Name="Watermark"`、`Trigger Property="IsReadOnly"`、`Setter Property="controls:TextBoxAttach.SelectAll"`）
- 尺寸 Token：`{source_root}/SDC/Sizes.xaml`（`x:Key="TextBoxWidth"` / `x:Key="TextBoxHeight"`）；字号：`{source_root}/SDC/Fonts.xaml`（`x:Key="SubHeaderFontSize"`）
- 真实使用：无（ManualView.xaml / FrameworkGeneric.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOTextBox.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：`TextBoxAttach.SelectAll` 行为语义（聚焦是否全选）与 WatermarkElement/BorderElement 附加属性运行时行为（关联 TD-006 附加属性族）。
- [待确认 TD-xxx]：IOTextBox 基类确认（模板 TargetType="TextBox" 强证据，.cs 确认）；Text/IsReadOnly/IsEnabled 等标准 TextBox 属性直接可用。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据；IOEnable 使用面仅见 IconButton（`{source_root}/ManualView.xaml`），「IO 系列核心协议 IOEnable」在 IOTextBox 无模板支持，待框架作者确认（见手册发布说明）。
