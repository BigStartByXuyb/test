<!-- evidence=已确认(模板为 P1 直接证据；P2 页面使用实例存在——ManualView.xaml:12 以 TextBlockStyle 为 BasedOn 建页面级样式);
     pending=[]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/TextBlock.xaml, {source_root}/ManualView.xaml] -->

# TextBlock（文本·框架样式）

## 1. 用途

原生 `TextBlock` 的框架样式：极简两键——**隐式默认样式**（仅 `VerticalAlignment=Center`，任何 TextBlock 默认垂直居中）与**键式 `TextBlockStyle`**（+ `HorizontalAlignment=Left`、字号 `SubHeaderFontSize`、前景 `PrimaryTextBrush`，即「标准正文」形态）。

**本条目是 16 个原生控件中唯一有 P2 使用实例的控件**：ManualView.xaml 在页面级资源中 `BasedOn="{StaticResource TextBlockStyle}"` 扩展页面内所有 TextBlock（`{source_root}/ManualView.xaml:12`）。

## 2. 声明

```xml
<TextBlock … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `TextBlock`。本文件含 1 个隐式默认样式（无 x:Key）+ 1 个键式 `TextBlockStyle`；**无模板、无触发器**（纯 Setter 样式）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| VerticalAlignment | VerticalAlignment | 隐式默认 =Center（全局兜底）；TextBlockStyle 亦 Center | 隐式 Setter（:6）+ TextBlockStyle Setter（:10） | ✅ |
| HorizontalAlignment | HorizontalAlignment | TextBlockStyle =Left | TextBlockStyle Setter（:11） | ✅ |
| FontSize | double | TextBlockStyle = `SubHeaderFontSize`（Sizes 体系，14） | TextBlockStyle Setter（:12） | ✅ |
| Foreground | Brush | TextBlockStyle = `PrimaryTextBrush`（正文主色） | TextBlockStyle Setter（:13） | ✅ |

**差异面（vs IOTextBlock）**：IO 版为独立 TargetType（IOTextBlock）且隐式样式无模板；本族为原生 TextBlock，`TextBlockStyle` 常被页面级样式 BasedOn 复用（ManualView.xaml:12 即范例）。

## 4. 样式族表（SDC\Style\TextBlock.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （隐式默认样式） | 无 | 仅 `VerticalAlignment=Center`（:5-7） | 未显式指定 Style 时（全局兜底） |
| TextBlockStyle | 无（独立键） | Center + Left + SubHeaderFontSize + PrimaryTextBrush（:9-14） | 「标准正文」；常被页面级样式 BasedOn 复用 |

## 5. 框架写法示例

**有使用实例（P2 证据）**——`{source_root}/ManualView.xaml:12`：

```xml
<UserControl.Resources>
    <Style TargetType="{x:Type TextBlock}" BasedOn="{StaticResource TextBlockStyle}" />
</UserControl.Resources>
```

页面级兜底样式使页面内全部 TextBlock 继承 TextBlockStyle 四属性。普通正文用法：

```xml
<TextBlock Text="{DynamicResource …文本键}" />
```

- 默认（不写 Style）即隐式样式（仅垂直居中）；要标准正文形态写 `Style="{StaticResource TextBlockStyle}"` 或页面级 BasedOn；
- 文本一律走 DynamicResource 文本键（本地化）。

## 6. 禁止写法对照

### ❌ 禁止：硬编码字号与颜色散写（常规 WPF 写法）

```xml
<TextBlock Text="手工文本" FontSize="14" Foreground="#333333"
           HorizontalAlignment="Left" VerticalAlignment="Center"/>
```

### ✅ 推荐：TextBlockStyle / 隐式样式 + 文本键

```xml
<TextBlock Text="{DynamicResource …文本键}" Style="{StaticResource TextBlockStyle}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **⑤ 脱离视觉规范**：硬编码 FontSize/Foreground 绕过 `SubHeaderFontSize`（Sizes 体系）与 `PrimaryTextBrush`（Brushes 键体系）——正文视觉规范无法统一调整（字号/色板改版时散写文本不跟随）；
2. **④ 绕过资源体系**：硬编码文本绕过 DynamicResource 文本键（本地化体系，见 [localization-text](../../03-protocols/localization-text.md)）；
3. **③ 无法样式族切换**：页面级 `BasedOn TextBlockStyle` 的批量兜底机制失效——每处文本各自为政，无法一处调整全页。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/TextBlock.xaml`（锚点 隐式默认 `Style TargetType="TextBlock"`（:5）、`Style TargetType="TextBlock" x:Key="TextBlockStyle"`（:9））
- 尺寸/字号：`{source_root}/SDC/Sizes.xaml`（SubHeaderFontSize 等字号 Token）；画刷：`{source_root}/SDC/Brushes.xaml`（PrimaryTextBrush）
- 真实使用：**有**——`{source_root}/ManualView.xaml:12`（`<Style TargetType="{x:Type TextBlock}" BasedOn="{StaticResource TextBlockStyle}" />`）
- 对照：IO 版 `{source_root}/SDC/Style/IOTextBlock.xaml` + [io-text-block](../io/io-text-block.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_TextBlock.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：隐式默认样式仅有 `VerticalAlignment=Center` 一项——其余属性（FontSize/Foreground）无全局兜底，依赖 BaseStyle 或页面级样式（如 ManualView 范例），默认形态策略待确认。
