<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-006]; verified=2026-08-14;
     sources=[{source_root}/SDC/FrameworkGeneric.xaml, {source_root}/SDC/Style/ComboBox.xaml, {source_root}/SDC/Style/DataGrid.xaml, {source_root}/SDC/Style/IOComboBox.xaml, {source_root}/ManualView.xaml] -->

# DropDownElement（下拉弹层宽度附加属性）

## 1. 用途

框架下拉弹层对齐协议：宿主类 `controls:DropDownElement` 暴露 `ConsistentWidth` 附加属性——`True` 时**下拉弹层宽度锁定为触发按钮（toggleButton）实际宽度**（弹层 Border 的 MaxWidth/MinWidth 双绑定 toggleButton.ActualWidth），实现「下拉与输入框等宽」的对齐效果。

消费模板：FrameworkGeneric.xaml UserComboBox 家族双模板、ComboBox.xaml 家族五模板（含 Editable/Multi/SDCComboBox）、DataGrid.xaml 组合模板、IOComboBox 家族——所有框架下拉弹出式模板统一采用。

## 2. 声明

```xml
<controls:ComboBox controls:DropDownElement.ConsistentWidth="True" …/>
<!-- 族级默认由各下拉样式 Setter 提供 -->
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 模板消费：弹层 Border（dropDownBorder / comboBoxBorder 等）`MaxWidth="{Binding ActualWidth, ElementName=…toggleButton}"` 且 `MinWidth` 同值（FrameworkGeneric.xaml:244-246 触发器内）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| ConsistentWidth | bool | True → 弹层 Border 宽=toggleButton 实际宽（MaxWidth/MinWidth 双绑定 ActualWidth） | FrameworkGeneric.xaml:244-246（触发器）+ :334-336；ComboBox.xaml:121-123/185-187 | 🟡 [TD-006] |
| 其余成员 | — | 全库 grep 仅 ConsistentWidth 一属性命中 | grep 统计 | ❓ TD-006 |

消费分布（模板源码证据）：

- **FrameworkGeneric.xaml UserComboBox 家族**：:244-246 与 :334-336（两模板触发器，弹层 Border 名 dropDownBorder、宽绑定 toggleButton ActualWidth）；
- **ComboBox.xaml 家族**：EditableComboBoxTemplate :121-123、ComboBoxTemplate :185-187、MultiComboBox 模板 :390（PART_DropDownBorder）、:500、SDCComboBoxTemplate :623（弹层名 comboBoxBorder）；
- **DataGrid 组合**：DataGrid.xaml:177（下拉列模板）；IOComboBox 家族亦有消费（文件内 grep 确认）。

## 4. 样式族表

无（本条目为附加属性；消费样式族见 [multi-combo-box](../grid-tree/multi-combo-box.md)、[io-combo-box](../io/io-combo-box.md) 条目；通用 ComboBox 的具体样式证据仍以 `ComboBox.xaml` 为准）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<controls:ComboBox controls:DropDownElement.ConsistentWidth="True"
                   ItemsSource="{Binding …}"/>
```

- 族级默认已含，页面通常不写；
- 需要「弹层自适应内容、不做等宽」时显式 `"False"`（弹层按内容展开）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Popup + 手动绑定 Width（等效替代）

```xml
<Popup Width="{Binding ActualWidth, ElementName=toggleButton}" …>
    <ListBox …/>
</Popup>
```

### ✅ 推荐：DropDownElement 属性化

```xml
<controls:ComboBox controls:DropDownElement.ConsistentWidth="True" …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：ConsistentWidth 等宽协议丢失——MaxWidth/MinWidth 双绑定结构（防弹层宽于/窄于触发钮的边界钳制）手写版只仿其一；
2. **① 丢失状态**：窗口尺寸变化/缩放时 ActualWidth 联动由模板触发器维持，手写单绑定在边缘场景（滚动条出现等）失去钳制；
3. **③ 无法样式族切换**：等宽开关不能随下拉样式族（Editable/Multi/SDC/UserComboBox 家族）统一切换；
4. **⑤ 脱离视觉规范**：弹层宽度策略散写页面，与框架「触发钮等宽」视觉基线脱节；
5. **④ 重复造轮子**：框架已内建 PopupEx 自定义弹层控件（ComboBox.xaml:334/426），手写 Popup 与框架弹层协议无集成。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/FrameworkGeneric.xaml`（锚点 :244-246/:334-336，dropDownBorder + toggleButton ActualWidth 绑定）
- ComboBox 家族：`{source_root}/SDC/Style/ComboBox.xaml`（:121-123/:185-187/:390/:500/:623）
- DataGrid 组合：`{source_root}/SDC/Style/DataGrid.xaml`（:177）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_ComboBox.xaml.json`

## 8. 待确认项

- **TD-006**（复用）：DropDownElement 宿主类成员全集与 ConsistentWidth 默认值（各家族 Setter 默认值差异）——.cs 不可见。
