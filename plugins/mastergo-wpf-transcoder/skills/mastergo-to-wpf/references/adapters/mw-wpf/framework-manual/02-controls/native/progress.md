<!-- evidence=已确认(属性/模板/触发器均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[TD-026,TD-060];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/Progress.xaml, {source_root}/ManualView.xaml] -->

# Progress（ProgressBar 样式家族·键式变体）

## 1. 用途

Progress.xaml 提供**键式 ProgressBar 变体样式**（与 ProgressBar.xaml 的隐式默认样式并存、独立成族）：黄色填充（`#FFD805`，硬编码）风格，无边框（BorderThickness 0），圆角 `processBarCornerRadio`=0（直角）。两键：`ProgressBarStyle1`（无百分比文本，模板 `NoNumberPBTemplate`）、`ProgressBarStyle2`（**条内居中百分比文本**，`{}{0:f1}%` 一位小数格式，模板 `HaveNumberPBTemplate`）。两个模板共用同一套 VSM 不确定态动画（ScaleX 0.25 横移 2s 循环）与 Vertical 旋转触发器，与 ProgressBar.xaml 原生模板同构、但圆角改为 StaticResource 直引（**不走 `BorderElement.CornerRadius` 通道**）。

典型场景（推断，无 P2 实例）：黄色警示/完成进度条、需要条内百分比数字的进度条。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<ProgressBar Style="{StaticResource ProgressBarStyle1}" … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `ProgressBar`。本文件含 2 个样式键 + 2 个 ControlTemplate 键 + 4 个画刷键 + 1 个 CornerRadius 键；**无隐式默认样式**（隐式默认在 ProgressBar.xaml）。

## 3. 关键属性表

**与 ProgressBar.xaml 隐式默认的差异面**：① 本族**无隐式样式、需显式 StaticResource**；② 填充 `Foreground`=#FFD805 硬编码黄（原生为 `ProgressBoxFillBrush` 键）；③ 圆角 0 且经 `processBarCornerRadio` 静态资源（原生 =5 经 `BorderElement.CornerRadius` 附加属性）；④ 无 `controls:ProgressBar` 成品版对应；⑤ `ProgressBarStyle2` 独有条内百分比文本。

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Foreground | Brush | 填充黄 **#FFD805 硬编码**（无画刷键；族内另有 ProgressBoxFillBrush1/2 绿/红渐变键但未消费） | `x:Key="ProgressBarStyle1"`/`ProgressBarStyle2` Setter（:130/:138） | ✅ |
| Background | Brush | 轨道底 `ProgressBar.Background`（#f0f3f6，SolidColorBrush 键——**键名含点号**，SystemKey 式命名） | 两样式 Setter（:131/:139）+ 键定义（:11） | ✅ |
| BorderBrush / BorderThickness | Brush / Thickness | Transparent / 0（无边框） | 两样式 Setter（:132-133/:140-141） | ✅ |
| Template | ControlTemplate | Style1→`NoNumberPBTemplate`、Style2→`HaveNumberPBTemplate`；Setter 用 `Value="{Binding Source={StaticResource …}}"` **非常规写法**（见待确认项） | 两样式 Setter（:134/:142） | ✅ |
| processBarCornerRadio | CornerRadius | =0（直角）；键名 **"process" 拼写**（非 progress） | 键定义（:13）+ 两模板 Border 引用 | ✅ |
| IsIndeterminate | bool | True → Indicator Collapsed、Animation 2s ScaleX 0.25 + RenderTransformOrigin -0.5→1.5 横移 | 两模板 VSM Indeterminate + Trigger（:28-41,69-71） | ✅ |
| Orientation | Orientation | Vertical → TemplateRoot RotateTransform -90° | 两模板 Trigger（:62-68,116-122） | ✅ |
| Value（Style2 百分比） | double | PART_TextBlock `DataContext={TemplateBinding Value}`、`Text="{Binding StringFormat={}{0:f1}%}"`（一位小数百分比，居中，FontSize 10、**#000 硬编码**） | `x:Key="HaveNumberPBTemplate"` PART_TextBlock（:112） | ✅ |

## 4. 样式族表（SDC\Style\Progress.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| ProgressBarStyle1 | 无 | 黄条（#FFD805）、无边框直角、无百分比文本；VSM 不确定动画 + Vertical 旋转 | 纯色进度条（无数字） |
| ProgressBarStyle2 | 无 | 同 Style1 + **条内居中 `{}{0:f1}%` 百分比**（Value 直绑） | 需要显示百分比的进度条 |
| NoNumberPBTemplate | （ControlTemplate 键） | 与 ProgressBar.xaml 原生模板同构（PART_Track/PART_Indicator/Indicator/Animation）但圆角走 StaticResource | Style1 引用 |
| HaveNumberPBTemplate | （ControlTemplate 键） | 上者 + PART_Track 内 PART_TextBlock 百分比文本 | Style2 引用 |
| ProgressBoxFillBrush / 1 / 2 | （画刷键） | 单停点渐变#FFF2E066（**实为纯色黄**）/ 绿#1AB04A / 红渐变 #E6807B→#C72424 | ProgressBoxFillBrush 双定义（TD-026）；1/2 当前无消费方 |

命名部件（P1 锚点）：`TemplateRoot`、`PART_Track`、`PART_Indicator`、`Indicator`、`Animation`、`PART_TextBlock`。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<!-- 无数字黄条 -->
<ProgressBar Style="{StaticResource ProgressBarStyle1}" Minimum="0" Maximum="100" Value="{Binding 进度值}" />

<!-- 带百分比数字（一位小数） -->
<ProgressBar Style="{StaticResource ProgressBarStyle2}" Minimum="0" Maximum="100" Value="{Binding 进度值}" />
```

- 本族为键式样式，**必须显式 `Style="{StaticResource …}"`**；不指定时落到 ProgressBar.xaml 隐式默认（绿色圆角 5）；
- `Value` 同时驱动指示条宽度与 Style2 的百分比文本（StringFormat 由模板内建）。

## 6. 禁止写法对照

### ❌ 禁止：手写 TextBlock 百分比 + Border 宽度计算拼等效进度条（常规 WPF 写法）

```xml
<Grid>
    <Border Height="14" Background="#f0f3f6"/>
    <Border x:Name="fill" Background="#FFD805" HorizontalAlignment="Left"
            Width="{Binding 换算出的像素宽}"/>
    <TextBlock Text="{Binding 手工格式化百分比}" FontSize="10" HorizontalAlignment="Center"/>
    <!-- 宽度换算、百分比格式化、旋转垂直条、不确定态动画全部手写… -->
</Grid>
```

### ✅ 推荐：样式族 + Value 绑定

```xml
<ProgressBar Style="{StaticResource ProgressBarStyle2}" Minimum="0" Maximum="100" Value="{Binding 进度值}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 `IsIndeterminate` 不确定态（VSM ScaleX 横移动画 + Indicator 折叠）与 `Orientation=Vertical` 旋转触发器；
2. **③ 无法样式族切换**：有无百分比文本两形态（Style1/Style2 + NoNumber/HaveNumber 双模板）不能一键切换；`{}{0:f1}%` 格式化内建于模板，手写必然复造或格式漂移；
3. **④ 绕过资源体系**：轨道底色硬编码绕过 `ProgressBar.Background` 键；圆角绕过 `processBarCornerRadio` 键；
4. **⑤ 脱离视觉规范**：指示条内 FontSize 10 居中文本样式、黄色填充规范散写，页面无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Progress.xaml`（锚点 `x:Key="ProgressBoxFillBrush"`（:7，双定义）、`x:Key="ProgressBar.Background"`、`x:Key="processBarCornerRadio"`、`x:Key="ProgressBoxFillBrush1"`/`"ProgressBoxFillBrush2"`、`x:Key="NoNumberPBTemplate"`、`x:Key="HaveNumberPBTemplate"`（PART_TextBlock `{}{0:f1}%`）、`x:Key="ProgressBarStyle1"`、`x:Key="ProgressBarStyle2"`（Template `{Binding Source={StaticResource …}}`））
- 画刷：`{source_root}/SDC/Brushes.xaml`（`ProgressBoxFillBrush`:257 双定义之一，TD-026）
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：原生隐式版 [progress-bar](progress-bar.md)；IO 版 [io-progress-bar](../io/io-progress-bar.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_Progress.xaml.json`

## 8. 待确认项

- TD-060：Progress 家族（ProgressBar.xaml 的 controls:ProgressBar ↔ IOProgressBar 同构 + 本文件疑点合并）——① `ProgressBarStyle1/2` 的 Template Setter 用 `Value="{Binding Source={StaticResource …}}"` 非常规写法（正常应为直接 `{StaticResource}`，疑为复制残留或跨程序集规避手段）；② `ProgressBoxFillBrush` 单停点渐变实为纯色黄但未被本族消费；③ `ProgressBar.Background` 键名含点号（SystemKey 式命名）语义。
- TD-026 关联：`ProgressBoxFillBrush` 双定义（Progress.xaml:7 vs Brushes.xaml:257）——合并顺序决定生效方（原生 ProgressBar 隐式样式消费方）。
- [待确认 TD-xxx]：`ProgressBoxFillBrush1/2`（绿/红渐变）与 `processBarCornerRadio`（"process" 拼写）当前无消费方——历史残留或供其他页面直接引用，待确认。
