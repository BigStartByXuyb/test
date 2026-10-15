<!-- evidence=已确认(属性/模板/触发器均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[TD-059];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/TextBox.xaml, {source_root}/ManualView.xaml] -->

# TextBox（文本框·框架样式，TextBox/HitTextBox 家族）

## 1. 用途

TextBox.xaml 覆盖**两个独立控件类型**的框架样式：

1. **原生 `TextBox`**（`TextBoxBaseStyle` + 隐式默认）：白底圆角 3（`BorderElement.CornerRadius`）、100×35（`TextBoxWidth/Height` Token）、**水印**（`WatermarkElement.Watermark` 附加属性，Text 为空时 50% 透明显示）、悬停 `PrimaryToolBrush`、只读灰底 #EAEDF2、**校验失败红框**（`Validation.HasError → red`）、禁用 0.5。`TextBoxAttach.SelectAll` 挂点**被注释**（:26）。
2. **`controls:HitTextBox`**（`TextBoxExtendBaseStyle` + 隐式默认，**MaxwellControl.Controls 独立控件类型，非 TextBox 子类**——TD-059）：浅底 `BackgroundLightBrush` + 渐变边框 `ButtonBorderGradientBrush`，**错误协议**——`IsError=True` / `ResultType=Failed` 时边框 `WarningBrush`，且 `ResultType=Failed` 时在边框上挂 **`controls:Poptip.IsOpen=True`**（错误气泡提示，Poptip 由附加属性批条目专述）。

典型场景（推断，无 P2 实例）：普通输入（TextBox）、带校验/错误提示的输入（HitTextBox）。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<TextBox … />；<controls:HitTextBox … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `TextBox` + `controls:HitTextBox`（MaxwellControl.Controls）。本文件含 2 个键式基样式 + 2 个隐式默认 + 1 个转换器键（`bVisiableConverter`）。

## 3. 关键属性表

**与 IOTextBox 的差异面**：`TextBoxBaseStyle` 与 IO 版基样式同型（水印/圆角/高度等机制一致）；**原生版独有** `HitTextBox` 家族（`TextBoxExtendBaseStyle`，IO 版无）——`IsError`/`ResultType`/Poptip 错误气泡协议、`IsKeyboardFocused` 聚焦触发器、0.56 禁用透明度。

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| WatermarkElement.Watermark | string | 水印文本（附加属性，默认 `""`）；Text 为空时显示（Opacity .5） | `x:Key="TextBoxBaseStyle"` Setter（:20）+ 模板 Watermark TextBlock（:44-51）+ Trigger（:66-68） | ✅ |
| BorderElement.CornerRadius | CornerRadius | 两基样式 =3（模板直绑） | 两基样式 Setter（:21/:89） | ✅ |
| Height / Width | double | `TextBoxHeight`/`TextBoxWidth`（Sizes.xaml:51-52，=35/100） | 两基样式 Setter（:23-24/:91-92） | ✅ |
| FontSize / Foreground | — | `SubHeaderFontSize` / `PrimaryTextBrush`（HitTextBox 版 `TextBrush`） | 两基样式 Setter | ✅ |
| BorderBrush | Brush | TextBox 版 `BorderBrush`；HitTextBox 版 `ButtonBorderGradientBrush`；悬停 `PrimaryToolBrush`/`PrimaryBrush` | 两基样式 Setter + Trigger | ✅ |
| Validation.HasError | bool | True → 边框+前景 `red`（**硬编码红**，无画刷键） | TextBoxBaseStyle 模板 Trigger（:61-64） | ✅ |
| IsReadOnly | bool | True → 背景 **#EAEDF2 硬编码** | TextBoxBaseStyle 模板 Trigger（:69-71） | ✅ |
| IsError（HitTextBox） | bool | True → 边框 `WarningBrush` | TextBoxExtendBaseStyle 模板 Trigger（:123-125） | ✅ |
| ResultType（HitTextBox） | enum | Failed → 边框 `WarningBrush` + **border 挂 `Poptip.IsOpen=True`**（错误气泡） | TextBoxExtendBaseStyle 模板 Trigger（:126-130） | ✅ |
| IsKeyboardFocused（HitTextBox） | bool | True → 边框 `PrimaryBrush` | TextBoxExtendBaseStyle 模板 Trigger（:120-122） | ✅ |
| TextBoxAttach.SelectAll | bool | **挂点被注释**（:26）——该附加属性当前未接入本模板 | TextBoxBaseStyle 注释行 | 🟡 TD-059 关联 |
| IsEnabled | bool | TextBox 版 Opacity 0.5（border）；HitTextBox 版 **0.56** | 两模板 Trigger（:58-60/:131-133） | ✅ |

模板命名部件（P1 锚点）：`border`、`PART_ContentHost`（ScrollViewer）、`Watermark`。

## 4. 样式族表（SDC\Style\TextBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| TextBoxBaseStyle | 无（独立） | 白底（PrimaryDefaultBrush）+ BorderBrush + 水印 + 圆角 3 + 校验红框 + 只读灰底 + AllowDrop；Text 空时水印显 | 基样式，不直接用 |
| （TextBox 隐式默认） | TextBoxBaseStyle | TargetType 默认样式，全局兜底（:140） | 未显式指定 Style 时 |
| TextBoxExtendBaseStyle | 无（独立） | **TargetType=controls:HitTextBox**；浅底 + 渐变边框 + IsError/ResultType 错误协议 + Poptip.IsOpen 气泡挂点 + 聚焦触发器 | 基样式，不直接用 |
| （HitTextBox 隐式默认） | TextBoxExtendBaseStyle | TargetType 默认样式，全局兜底（:142） | 未显式指定 Style 时 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<!-- 普通文本框 + 水印 -->
<TextBox controls:WatermarkElement.Watermark="{DynamicResource …水印文本键}" />

<!-- 校验失败展示：Validation.HasError 由绑定源驱动（INotifyDataErrorInfo 等），模板自动红框 -->
<TextBox Text="{Binding 值, ValidatesOnDataErrors=True}" />

<!-- 错误提示输入框：ResultType=Failed 自动红框 + 错误气泡 -->
<controls:HitTextBox Text="{Binding 值}" ResultType="{Binding 结果类型}" />
```

- 默认（不写 Style）即各类型隐式样式；水印走 WatermarkElement 附加属性 + 文本键；
- HitTextBox 错误协议（IsError/ResultType）属性由 .cs 消费（TD-059）。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBox + 堆叠 TextBlock 水印 + 手写校验色（常规 WPF 写法）

```xml
<Grid>
    <TextBox x:Name="box" Height="35" Width="100"/>
    <TextBlock Text="手工水印" Margin="5,0" Foreground="Gray"
               IsHitTestVisible="False" Opacity=".5">
        <TextBlock.Style>
            <Style TargetType="TextBlock">
                <Style.Triggers>
                    <DataTrigger Binding="{Binding Text, ElementName=box}" Value="">
                        <Setter Property="Visibility" Value="Visible"/>
                    </DataTrigger>
                </Style.Triggers>
            </Style>
        </TextBlock.Style>
    </TextBlock>
</Grid>
<!-- 校验红框、只读灰底、悬停变色、错误气泡全部手写… -->
```

### ✅ 推荐：框架样式属性化

```xml
<TextBox controls:WatermarkElement.Watermark="{DynamicResource …水印文本键}" Text="{Binding 值}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 Validation.HasError 红框、只读灰底（#EAEDF2）、悬停/聚焦/禁用态（0.5/0.56）、HitTextBox 的 IsError/ResultType→WarningBrush + **Poptip 错误气泡**协议——校验反馈链全部丢失；
2. **② 丢失协议挂点**：绕过 `PART_ContentHost` 部件协议、`WatermarkElement`（水印）/`BorderElement.CornerRadius`/`TextBoxAttach`（注释挂点）附加属性族——模板级协议无法接入；
3. **③ 无法样式族切换**：普通/错误提示（HitTextBox）两形态无法切换；100×35 尺寸 Token（TextBoxWidth/Height）散写失控；
4. **④ 绕过资源体系**：硬编码水印文本绕过 DynamicResource 文本键；硬编码颜色绕过 BorderBrush/PrimaryToolBrush/WarningBrush 键体系；
5. **⑤ 脱离视觉规范**：FontSize 14、Padding 5,0、圆角 3、ScrollViewer Margin -2,0,-1,0 细节脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/TextBox.xaml`（锚点 `x:Key="TextBoxBaseStyle"`（:12，Watermark/Validation.HasError/IsReadOnly 触发器、注释 `TextBoxAttach.SelectAll`）、`x:Key="TextBoxExtendBaseStyle"`（:81，TargetType=controls:HitTextBox、IsError/ResultType 触发器、`controls:Poptip.IsOpen`（:128））、隐式默认 ×2（:140/:142）、`BooleanToVisibilityConverter x:Key="bVisiableConverter"`（:78））
- 尺寸：`{source_root}/SDC/Sizes.xaml`（TextBoxWidth=100/TextBoxHeight=35）；画刷：`{source_root}/SDC/Brushes.xaml`（BorderBrush/PrimaryToolBrush/WarningBrush 等）
- Poptip.IsOpen 消费全景：{source_root}/SDC/Style/TextBox.xaml:128、IntNumberBox.xaml:197/:302、StringNumberBox.xaml:140、SwitchBox.xaml:125、SwitchPasswordBox.xaml:122
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：IO 版 `{source_root}/SDC/Style/IOTextBox.xaml` + [io-text-box](../io/io-text-box.md)；水印/圆角附加属性族专述见附加属性条目
- 索引交叉：`{index_root}/files/refence_SDC_Style_TextBox.xaml.json`

## 8. 待确认项

- TD-059：`controls:HitTextBox` 为**独立控件类型**（TargetType 直指控件而非 TextBox 派生变体）——IsError/ResultType/Poptip 错误气泡协议的 .cs 行为面待确认；`TextBoxAttach.SelectAll` 注释（:26）是否表示该附加属性已被 HitTextBox 体系取代。
- [待确认 TD-xxx]：`TextBoxExtendBaseStyle` 模板第二列宽 25 的**空列死布局**（无任何元素）——残留或未来挂点待确认。
- [待确认 TD-xxx]：TextBox 版 Validation.HasError 红/只读 #EAEDF2 为硬编码色（无画刷键）；TextBox 版禁用 0.5 vs HitTextBox 版 0.56 透明度不一致——待确认。
