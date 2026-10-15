<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-006,TD-044]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/TextBox.xaml, {source_root}/SDC/Style/IOTextBox.xaml, {source_root}/SDC/Style/ComboBox.xaml, {source_root}/ManualView.xaml] -->

# WatermarkElement（水印附加属性）

## 1. 用途

框架水印/占位提示协议：宿主类 `controls:WatermarkElement` 暴露 `Watermark` 附加属性，挂在输入控件上，由模板内叠层 TextBlock 消费。**输入为空时水印显示，输入非空时水印隐藏**（TextBox 家族由 `Text=""` 触发器驱动，DataGrid.xaml:467 类协议不同——本族为 Text 空值触发）。

消费家族：TextBox 家族（TextBoxBaseStyle / TextBoxExtendBaseStyle / 隐式默认）、IOTextBox 家族、MultiComboBox 搜索框（PART_SearchTextBox）、DateTimePicker 组合（ControlSelectDateTime）。

## 2. 声明

```xml
<s:TextBox controls:WatermarkElement.Watermark="{DynamicResource …提示文本键}"
           Width="200" Height="30"/>
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 模板消费：模板内叠层 TextBlock（`Text="{TemplateBinding controls:WatermarkElement.Watermark}"`，TextBox.xaml:49），触发条件 `Text="" 且非聚焦`（TextBox.xaml:66-68 触发器 → Watermark Visible）；
- 水印文本支持 DynamicResource 本地化键（ComboBox.xaml:352/439 使用 `{DynamicResource LoggerViewInputQueryKeyword}` 业务键）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Watermark | string | 水印文本；TextBox 家族 Text="" 时显示（Trigger），非空隐藏 | TextBox.xaml:20（TextBoxBaseStyle Setter）+ :49（模板 TextBlock 绑定）+ :66-68（Trigger） | ✅ |
| 其余成员 | — | 全库 grep 命中仅 Watermark 一属性 | grep 统计 | ❓ TD-006 |

家族细节（模板源码证据）：

- TextBoxBaseStyle：Setter 默认空串 + 模板 TextBlock 叠层（ScrollViewer 之上）+ Text="" 触发显示（TextBox.xaml:20/49/66-68）；
- IOTextBoxBaseStyle：双处消费（IOTextBox.xaml:19/48），模板同构；
- MultiComboBox 搜索框：PART_SearchTextBox 消费业务键 `LoggerViewInputQueryKeyword`（ComboBox.xaml:352/439）——水印可承载 DynamicResource 跨业务键（关联 TD-044）。

## 4. 样式族表

无（本条目为附加属性；消费样式族见 [text-box](../native/text-box.md)、[io-text-box](../io/io-text-box.md)、[multi-combo-box](../grid-tree/multi-combo-box.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<s:TextBox controls:WatermarkElement.Watermark="{DynamicResource …输入提示文本键}"
           Width="200" Height="30"/>
```

- 页面只写 Watermark 一属性，显隐联动由模板触发器完成；
- 提示文本走 DynamicResource 本地化键。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBlock 叠层 + 触发器模拟水印（等效替代）

```xml
<Grid>
    <s:TextBox x:Name="tb" Width="200" Height="30"/>
    <TextBlock Text="请输入…" IsHitTestVisible="False" Margin="5,0"
               VerticalAlignment="Center">
        <TextBlock.Style>
            <Style TargetType="TextBlock">
                <Setter Property="Visibility" Value="Visible"/>
                <Style.Triggers>
                    <DataTrigger Binding="{Binding Text, ElementName=tb}" Value="">
                        <Setter Property="Visibility" Value="Hidden"/>
                    </DataTrigger>
                </Style.Triggers>
            </Style>
        </TextBlock.Style>
    </TextBlock>
</Grid>
```

### ✅ 推荐：WatermarkElement 属性化

```xml
<s:TextBox controls:WatermarkElement.Watermark="{DynamicResource …提示文本键}" …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写触发器只有空值态，丢失聚焦/非聚焦差异与只读态等联动（模板含多条件触发）；
2. **② 丢失协议挂点**：水印文本绑定协议失效——组合模板（如 MultiComboBox 搜索框）中由父模板注入的水印无法到达手写 TextBlock；
3. **③ 无法样式族切换**：Text="" 显隐规则被钉死在页面触发器，样式族调整（水印配色、字号）无法统一生效；
4. **④ 绕过本地化**：硬编码提示文本绕过 DynamicResource 键体系；
5. **⑤ 脱离视觉规范**：水印灰字（默认 Foreground 淡化处理）与间距散写页面失控。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/TextBox.xaml`（锚点 `x:Key="TextBoxBaseStyle"` Setter :20 + 模板 :49 + Text="" Trigger :66-68）
- 其他家族：`{source_root}/SDC/Style/IOTextBox.xaml`（:19/48）、`{source_root}/SDC/Style/ComboBox.xaml`（PART_SearchTextBox :352/439，`LoggerViewInputQueryKeyword` 业务键）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_TextBox.xaml.json`

## 8. 待确认项

- **TD-006**（复用）：WatermarkElement 宿主类成员全集与显隐联动完整触发条件（聚焦态差异）。
- **TD-044**（复用）：`LoggerViewInputQueryKeyword` 跨业务键由框架样式引用业务资源——文本键归属与替换机制待确认（关联多 ComboBox 条目）。
