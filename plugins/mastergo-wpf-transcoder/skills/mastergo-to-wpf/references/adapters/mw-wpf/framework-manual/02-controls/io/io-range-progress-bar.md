<!-- evidence=已确认(模板/转换器声明为模板源码直接证据；值属性名与宽度驱动机制仅推断); pending=[待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IORangeProgressBar.xaml, {source_root}/ManualView.xaml] -->

# IORangeProgressBar（范围进度条）

## 1. 用途

范围型进度条：轨道（PART_back，圆角 4）+ 指示条（PART_Indicator，左侧起始、宽度 0 起步）。**模板无任何值绑定与触发器**——指示宽度由控件内部驱动（.cs 不可见），同文件声明的 `ProgressWidthConverter` 未在模板引用，推断由代码侧经 FindResource 取用将值换算为宽度。

典型场景（推断，无 P2 实例）：范围/区间占比显示（非百分比结果型——区别于 IOProgressBar）。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:IORangeProgressBar … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IORangeProgressBar`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件仅含隐式默认样式 + 转换器资源；**同名隐式默认样式另见于 `{source_root}/SDC/Style/IOProgressBar.xaml`（区块 4）**——两处合并顺序决定生效者（关联 TD-008）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 轨道背景：IORangeProgressBar.xaml 版默认 `#FFE0E0E0`；IOProgressBar.xaml 版默认 `BackgroundBrush` | `Setter Property="Background"`（两文件各自 Setter）+ 模板 `PART_back Background="{TemplateBinding Background}"` | ✅ |
| 值属性（名待确认，疑为 RangeProgress——无模板证据） | — | 指示条宽度驱动值；模板 `PART_Indicator Width="0"` 硬编码 + `ProgressWidthConverter` 声明但模板零引用 → 推断代码侧 FindResource 取转换器算宽 | `PART_Indicator Width="0"` + `<mw:ProgressWidthConverter x:Key="ProgressWidthConverter" />`（未引用） | ❓ [待确认 TD-xxx] |
| Height / Width（IOProgressBar.xaml 版） | 18 / 280 | 该版默认尺寸；IORangeProgressBar.xaml 版无尺寸 Setter（依赖轨道自高） | IOProgressBar.xaml `Setter Property="Height"/"Width"` | ✅ |
| PART_back / PART_Indicator | Border | 命名部件（带 PART_ 前缀）——模板契约，控件代码驱动目标 | `x:Name="PART_back"` / `x:Name="PART_Indicator"` | ✅ |
| （无触发器） | — | 模板 ControlTemplate.Triggers 为空；无状态/动画/结果语义（区别于 IOProgressBar） | ControlTemplate 全文 | ✅ |
| （无 IOEnable 证据） | — | 模板中无 IOEnable / 协议挂点；设备联锁协议见 TD-001 | 模板全文 + `{source_root}/ManualView.xaml`（IOEnable 仅出现于 IconButton） | ✅（阴性证据） |

## 4. 样式族表（同名隐式样式两处）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| （隐式默认样式，IORangeProgressBar.xaml） | 无（独立） | Grid(ClipToBounds) + PART_back（圆角 4）+ PART_Indicator（左对齐、高度绑 TemplatedParent.ActualHeight、Width=0）；默认底 #FFE0E0E0；含 `ProgressWidthConverter` 资源 | 指示宽度 .cs 驱动版 |
| （隐式默认样式，IOProgressBar.xaml） | 无（独立，引 BaseStyle.xaml） | 18×280；三列 Auto/*/23 + TemplateRoot（圆角 5）+ Indicator（圆角 5，ProgressBoxFillBrush）；**空触发器** | 带尺寸默认值版 |

两处同名隐式样式——合并字典顺序在后者胜（关联 TD-008），实际生效版本待宿主资源加载顺序确认。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 FrameworkGeneric.xaml 均未出现 `s:IORangeProgressBar`。

```xml
<s:IORangeProgressBar />
```

- 值属性名未确认前，**不得**在页面 XAML 中自行设置值属性（见区块 8）——模板零绑定，页面侧目前无可写属性；
- 轨道默认底两版不同（#FFE0E0E0 vs BackgroundBrush），生效版本取决于资源合并顺序（关联 TD-008）。

## 6. 禁止写法对照

### ❌ 禁止：手写双 Border + 自接宽度换算（常规 WPF 写法）

```xml
<Grid ClipToBounds="True">
    <Border x:Name="back" Background="#FFE0E0E0" CornerRadius="4"/>
    <Border x:Name="ind" HorizontalAlignment="Left"
            Height="{Binding ActualHeight, RelativeSource={RelativeSource AncestorType=Grid}}"
            Width="{Binding …, Converter={StaticResource …}}"/>
</Grid>
<!-- 再在代码里手写 值→宽度 换算与转换器注册… -->
```

### ✅ 推荐：IORangeProgressBar（模板证据构造）

```xml
<s:IORangeProgressBar />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版缺失框架指示宽度驱动机制——模板证据（PART_Indicator Width=0 + 未引用的 ProgressWidthConverter）表明宽度逻辑在控件内部，手写只能各自实现换算与刷新；
2. **② 丢失协议挂点**：值属性与宽度换算协议（推断 ProgressWidthConverter 消费）全无挂点，指示条宽度行为页面散写无法统一；
3. **③ 无法样式族切换**：轨道/指示条结构（PART_back/PART_Indicator、圆角 4、ClipToBounds）散写，且两文件同名隐式样式暗示框架仍在调整形态，手写完全脱离调整链；
4. **⑤ 脱离视觉规范**：轨道圆角、指示条高度（绑 TemplatedParent.ActualHeight 的全高指示）等规范脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IORangeProgressBar.xaml`（锚点：隐式 `Style TargetType="{x:Type controls:IORangeProgressBar}"`、`x:Name="PART_back"` / `x:Name="PART_Indicator"`、`<mw:ProgressWidthConverter x:Key="ProgressWidthConverter" />`）；另见 `{source_root}/SDC/Style/IOProgressBar.xaml`（同 TargetType 第二处隐式样式）
- 真实使用：无（ManualView.xaml / FrameworkGeneric.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IORangeProgressBar.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：IORangeProgressBar 值属性名（任务线索「RangeProgress」在 refence 全库无任何模板证据——grep 仅命中 README 控件名）与宽度驱动机制（ProgressWidthConverter 声明未引用 → 推断 .cs FindResource 消费）；无刻度条证据（任务线索中的"刻度条"在模板中不存在）。
- [待确认 TD-xxx]：同名隐式默认样式双定义（IORangeProgressBar.xaml vs IOProgressBar.xaml）的合并顺序生效语义与是否遗留（关联 TD-008）。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据；IOEnable 使用面仅见 IconButton（`{source_root}/ManualView.xaml`），「IO 系列核心协议 IOEnable」在 IORangeProgressBar 无模板支持，待框架作者确认（见手册发布说明）。
