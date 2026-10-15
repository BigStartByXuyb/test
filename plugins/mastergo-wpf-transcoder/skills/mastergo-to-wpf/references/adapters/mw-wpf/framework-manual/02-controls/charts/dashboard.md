<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；Value 数据协议与 Skin 切换机制待确认); pending=[TD-047,TD-048];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/Dashboard.xaml, {source_root}/SDC/Style/Lable.xaml, {source_root}/ManualView.xaml] -->

# Dashboard（仪表盘）

## 1. 用途

**圆弧刻度仪表盘**：完整圆弧 + 当前值弧（PART_IncreaseCircle）+ 限位弧（橙色）+ 沿弧均匀分布的短/长刻度与数字 + 中央标签面板（默认以 `{0:N1}KW` 格式显示 Value）。模板内置 Speed（速度盘）/ Flow（流量盘）两种盘面。

典型场景：设备传感器数值（速度/流量）监控。**无 P2 实例**——ManualView.xaml 与 refence 全部页面均未使用本控件。

## 2. 声明

```xml
<s:Dashboard … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:Dashboard`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件为独立 ResourceDictionary（无 MergedDictionaries）；仅含隐式默认样式 + 两个具名 ControlTemplate + 一个具名 DataTemplate + 一个 tools: 转换器。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| StartAngle / EndAngle | double | 刻度盘起始/终止角（度）；Speed/Flow 全部弧与刻度路径共用；默认 -60/60 | 隐式样式 `Setter Property="StartAngle"/"EndAngle"` + 模板 `TemplateBinding StartAngle`/`TemplateBinding EndAngle`（Speed/Flow 各弧与 TickPath） | ✅ |
| LimitStartAngle / LimitEndAngle | double | 限位弧角度（橙色 Stroke 1px，**仅 Speed 模板消费**；Flow 模板无） | Speed 模板 `StartAngle="{TemplateBinding LimitStartAngle}"` / `EndAngle="{TemplateBinding LimitEndAngle}"`（限位 Arc） | ✅（仅 Speed 模板证据） |
| ShortTicks | 集合（ItemsSource） | 短刻度集合；1×8 灰条沿短刻度弧均匀分布（PathListBox）；Speed 模板硬编码 `Background="Gray"`，Flow 模板用 ShortTicksBrush | `ItemsSource="{TemplateBinding ShortTicks}"`（Speed/Flow 各一处） | ✅ |
| LongTicks | 集合（ItemsSource） | 长刻度集合；1×13 灰条沿长刻度弧均匀分布；配色同上（Speed 硬编码 / Flow 用 LongTicksBrush） | `ItemsSource="{TemplateBinding LongTicks}"` | ✅ |
| NumberList | 集合（ItemsSource） | 刻度数字集合；沿数字弧均匀分布（PathListBox + DataTemplate TextBlock `Text="{Binding}"`） | `ItemsSource="{TemplateBinding NumberList}"`（Speed/Flow 各一处） | ✅ |
| ShortTicksBrush / LongTicksBrush | Brush | 短/长刻度颜色；**仅 Flow 模板消费**（RelativeSource FindAncestor Dashboard）；Speed 模板硬编码 Gray，不读此属性 | Flow 模板 `Background="{Binding ShortTicksBrush, RelativeSource={RelativeSource AncestorType={x:Type controls:Dashboard}}}"` / LongTicksBrush 同式 | 🟡（Flow 消费确认；Speed 不消费） |
| Value | 数值 | 标签面板数值；默认标签以 `{0:N1}KW` 格式显示（一位小数 + KW 后缀）；类型/.cs 默认值不可见 | DefaultLabelPanel `Text="{Binding Path=Value,StringFormat={}{0:N1}KW, RelativeSource={RelativeSource Mode=FindAncestor, AncestorType={x:Type controls:Dashboard}}}"` | 🟡 [待确认 TD-047] |
| Skin | string | 皮肤值；本文件仅见 `Skin="Speed"` Trigger 且与默认 Setter 重复设置同一模板；Flow 模板键无任何 Trigger/Setter 引用——Flow 激活机制待确认 | 隐式样式 `Trigger Property="Skin" Value="Speed"`；`x:Key="Flow"` 无引用点 | 🟡 [待确认 TD-048] |
| Content / ContentTemplate | object / DataTemplate | 中央内容；默认 ContentTemplate=DefaultLabelPanel——注意默认标签显示 **Value**（KW 格式），不显示 Content 文本 | 模板 `ContentPresenter Content="{TemplateBinding Content}" ContentTemplate="{TemplateBinding ContentTemplate}"` + 隐式样式 `Setter Property="ContentTemplate" Value="{StaticResource DefaultLabelPanel}"` | ✅ |
| Foreground / FontSize | Brush / double | 默认 #FFFFFF / 12；Skin=Speed 时 Foreground #929093 | 隐式样式 Setter + `Trigger Property="Skin"` | ✅ |
| BorderBrush | Brush | 仅 Skin=Speed Trigger 设置（#746E7A）；两个模板内均无 BorderBrush 的 TemplateBinding 消费点 | 隐式样式 Trigger（阴性：模板全文无 BorderBrush 引用） | 🟡 |
| Height（模板内部消费） | double | Speed 模板第 4 弧 `ArcThickness="{TemplateBinding Height}"`（弧厚=控件高度，疑似遗留写法） | Speed 模板 Arc Setter | ✅（模板行为） |

命名部件（.cs 可能消费，协议待确认）：`PART_IncreaseCircle`（当前值弧，Speed/Flow 均有）、`DoubleCircle`、`ShoartTick`（源拼写如此）、`LongTick`、`Number`、`LongTickPath`、`ShortTickPath`、`NumberPath`。

## 4. 样式族表（SDC\Style\Dashboard.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （隐式默认样式 `TargetType="controls:Dashboard"`） | 无（独立字典） | 默认 Template=Speed；StartAngle=-60/EndAngle=60/FontSize=12/Foreground=#FFFFFF；ContentTemplate=DefaultLabelPanel；`Skin=Speed` Trigger 重设同模板并换灰系画刷（Foreground #929093、BorderBrush/ShortTicksBrush/LongTicksBrush #746E7A） | 速度/流量盘默认皮肤 |
| ControlTemplate `x:Key="Speed"` | — | 4 弧：PART_IncreaseCircle 红 #BB0104 当前值弧（ArcThickness 30px）+ 橙色限位弧 + 灰色完整弧（DoubleCircle）+ 弧厚=Height 弧；3 组 PathListBox（ShoartTick 1×8 / LongTick 1×13 / Number）沿对应路径弧均匀分布；中央 ContentPresenter | 速度盘皮肤 |
| ControlTemplate `x:Key="Flow"` | — | 2 弧：灰色 #746E7A 完整弧（Margin 50、ArcThickness 10）+ PART_IncreaseCircle 红（Fill+Stroke Red）；刻度 Border 用 ShortTicksBrush/LongTicksBrush | 流量盘皮肤（激活机制见 TD-048） |
| DataTemplate `x:Key="DefaultLabelPanel"`（`x:Shared="False"`） | — | 70 宽边框 #00A0FB 圆角 3 白字（Agency FB）；TextBlock 绑 Dashboard.Value 以 `{0:N1}KW` 显示；x:Shared=False 防"元素已是逻辑子元素"异常（注释原文） | 默认中央标签 |
| `tools:WordAngleConverter`（`x:Key="WordAngleConverter"`） | — | tools 命名空间转换器；SDC 全库仅此一处声明、零引用——疑似死资源或 .cs 消费 | — |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 refence 全部页面未出现 `s:Dashboard`（grep 阴性）。

```xml
<s:Dashboard Width="220" Height="220" Skin="Speed"
             StartAngle="-60" EndAngle="60"
             LimitStartAngle="-30" LimitEndAngle="45"
             ShortTicks="{Binding SpeedShortTicks}"
             LongTicks="{Binding SpeedLongTicks}"
             NumberList="{Binding SpeedScale}"
             Value="{Binding SpeedValue}" />
```

- 不写 `Skin` 即为 Speed 盘面（隐式样式默认 Template=Speed）；`Skin="Speed"` 显式触发灰系画刷（Foreground #929093 等）；
- 默认 `ContentTemplate=DefaultLabelPanel`——中央自动显示 Value（一位小数 + KW），无需写 Content；
- 限位弧仅 Speed 模板消费（`LimitStartAngle/LimitEndAngle`）；刻度/数字集合数据项格式（沿弧分布）见 TD-047；
- 若需自定义中央内容：`ContentTemplate="{StaticResource …自定义模板}"` + `Content="…"`（ContentPresenter 证据）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Ellipse/Path + ItemsControl 拼装等效盘面（常规 WPF 写法）

```xml
<Grid Width="220" Height="220">
    <Ellipse Stroke="Gray" StrokeThickness="1"/>
    <Path Data="…当前值弧几何…" Stroke="Red" StrokeThickness="30"/>
    <Path Data="…限位弧几何…" Stroke="Orange"/>
    <ItemsControl ItemsSource="{Binding SpeedTicks}">
        <ItemsControl.ItemsPanel>
            <ItemsPanelTemplate><StackPanel Orientation="Horizontal"/></ItemsPanelTemplate>
        </ItemsControl.ItemsPanel>
    </ItemsControl>
    <!-- 再在代码里手算每根刻度角度、每个数字位置、当前值弧端点… -->
</Grid>
```

### ✅ 推荐：Dashboard 属性化（模板证据构造）

```xml
<s:Dashboard Width="220" Height="220" Skin="Speed"
             ShortTicks="{Binding SpeedShortTicks}"
             LongTicks="{Binding SpeedLongTicks}"
             NumberList="{Binding SpeedScale}"
             Value="{Binding SpeedValue}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：PART_IncreaseCircle 当前值弧动态更新、限位弧、刻度沿弧均匀分布（PathListBox）等内建绘制全丢，手写只能静态拼图，刻度角度/数字位置/弧端点全部要手算；
2. **② 丢失协议挂点**：StartAngle/EndAngle/LimitStartAngle/LimitEndAngle/ShortTicks/LongTicks/NumberList/Value/Skin 属性协议全无，数据与角度只能散写在页面代码；
3. **③ 无法样式族切换**：Speed/Flow 双模板与 Skin 皮肤不能一键切换，换盘面必须整段重写；
4. **⑤ 脱离视觉规范**：盘面布局、刻度体系（1×8/1×13 条）、`{0:N1}KW` 标签格式失控，页面仪表视觉无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Dashboard.xaml`（锚点：隐式 `Style TargetType="{x:Type controls:Dashboard}"`、`x:Key="Speed"`、`x:Key="Flow"`、`x:Key="DefaultLabelPanel"`、`x:Name="PART_IncreaseCircle"`、`Trigger Property="Skin" Value="Speed"`、`TemplateBinding LimitStartAngle/LimitEndAngle/ShortTicks/LongTicks/NumberList`）
- 同名键交叉：`{source_root}/SDC/Style/Lable.xaml`（`x:Key="DefaultLabelPanel"` 双定义，内容差异：Lable 版 TextBlock 无 Value 绑定；合并顺序生效语义关联 TD-008，详见 [label](../navigation/label.md) 与 TD-017）
- 画刷：`{source_root}/SDC/Brushes.xaml`（#746E7A 系画刷键；模板内为硬编码色值，未走画刷键）
- 真实使用：无（ManualView.xaml / refence 全部页面不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Dashboard.xaml.json`（resource_references）

## 8. 待确认项

- [待确认 TD-047]：Dashboard 图表数据源协议——ShortTicks/LongTicks/NumberList 的数据项格式与生成方式（PathListBox 消费，.cs 不可见）；PART_IncreaseCircle 当前值弧的角度更新机制（Value→弧端点换算）；Value 类型与单位（仅 DefaultLabelPanel `{0:N1}KW` 字符串格式证据）。
- [待确认 TD-048]：Skin 取值全集与 Flow 模板激活机制——本文件仅 `Skin="Speed"` Trigger 且与默认 Setter 重复（默认已是 Speed 模板），`x:Key="Flow"` 模板无任何引用点，Flow 是否由 .cs 按 Skin 切换待确认；`WordAngleConverter` 零引用（疑似死资源）；`ArcThickness="{TemplateBinding Height}"`（Speed 模板第 4 弧）是否为遗留写法。
