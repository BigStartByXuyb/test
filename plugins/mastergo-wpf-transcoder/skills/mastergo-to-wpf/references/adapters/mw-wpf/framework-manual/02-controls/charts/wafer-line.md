<!-- evidence=已确认(隐式样式/模板结构/命名部件为模板源码直接证据；WordColor 绑定与绘制协议待确认); pending=[TD-049];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/WaferLine.xaml, {source_root}/ManualView.xaml] -->

# WaferLine（晶圆线图）

## 1. 用途

**晶圆通道线图容器**：10×10 网格骨架 + 上左通道名（txtCurrentChannelType）+ 中央 Wafer 圆（ellipse）+ 两个空白 Canvas（canvasLines 绘制线 / canvasCheckFlag 检查标记）。模板只搭骨架，全部图元绘制由 .cs 向命名部件注入。

典型场景：晶圆传输通道（如激光划片/切割）的线图监控。**无 P2 实例**——ManualView.xaml 与 refence 全部页面均未使用本控件。

## 2. 声明

```xml
<s:WaferLine … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:WaferLine`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件为独立 ResourceDictionary（无 MergedDictionaries）；仅含隐式默认样式。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| VerticalAlignment / HorizontalAlignment | Center | 隐式默认样式 Setter | 隐式样式 `Setter Property="VerticalAlignment"/"HorizontalAlignment"` | ✅ |
| WordColor | Brush | 通道名字色；模板以 `{Binding WordColor, ElementName=waferLineControl}` 引用——但**模板 namescope 内无名为 waferLineControl 的元素**（模板命名部件仅 gd/txtCurrentChannelType/ellipse/canvasLines/canvasCheckFlag），绑定解析机制与属性存在性待确认 | 模板 `txtCurrentChannelType` TextBlock `Foreground="{Binding WordColor,ElementName=waferLineControl}"` | ❓ [待确认 TD-049] |
| （尺寸） | — | 模板内无 Width/Height Setter，尺寸由使用方指定 | 模板全文（无尺寸证据） | ✅（阴性） |

命名部件（模板证据）：`gd`（10×10 Grid）、`txtCurrentChannelType`（通道名 TextBlock，模板硬编码 `Text="CH1"`，FontSize 14，列 0 跨 8）、`ellipse`（Wafer 圆，Row1-8/Col1-8，模板无填充/描边设置）、`canvasLines`（绘制线 Canvas，Row1-8/Col1-8）、`canvasCheckFlag`（检查标记 Canvas，Row1-8/Col4-5，Width=10 拉伸）。

边框（模板硬编码）：`BorderBrush="#AFB9C3"`、`BorderThickness="2"`、`Background="Transparent"`。

## 4. 样式族表（SDC\Style\WaferLine.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （隐式默认样式 `TargetType="controls:WaferLine"`） | 无（独立字典） | 无 x:Key；Vertical/HorizontalAlignment=Center；模板：Border（#AFB9C3 2px 透明底）> 10×10 Grid > 通道名 + ellipse + canvasLines + canvasCheckFlag | 晶圆通道线图容器 |
| （无其它具名键） | — | 文件仅此一样式；无 ControlTemplate 具名键、无资源 | — |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 refence 全部页面未出现 `s:WaferLine`（grep 阴性）。

```xml
<s:WaferLine Width="360" Height="300"
             WordColor="#00A0FB" />
```

- 尺寸由使用方指定（模板无默认尺寸）；Alignment 由隐式默认样式居中；
- `WordColor` 为模板中唯一数据属性引用（通道名字色），但模板内 ElementName 悬空（见 TD-049），回填前不要依赖其生效；
- 通道名 `txtCurrentChannelType` 模板硬编码 `Text="CH1"`——运行时替换方式（.cs 注入 / 模板覆盖）待确认（TD-049）；
- Wafer 圆（ellipse）、线（canvasLines）、检查标记（canvasCheckFlag）的绘制内容全部由 .cs 注入，XAML 面无可配内容。

## 6. 禁止写法对照

### ❌ 禁止：手写 Grid + Ellipse + Canvas 拼装等效线图骨架（常规 WPF 写法）

```xml
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/>
        <RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/>
    </Grid.RowDefinitions>
    <Grid.ColumnDefinitions>
        <ColumnDefinition/><ColumnDefinition/><ColumnDefinition/><ColumnDefinition/>
        <ColumnDefinition/><ColumnDefinition/><ColumnDefinition/><ColumnDefinition/>
        <ColumnDefinition/><ColumnDefinition/>
    </Grid.ColumnDefinitions>
    <TextBlock Grid.Row="0" Grid.Column="0" Text="CH1" Foreground="#00A0FB"/>
    <Ellipse Grid.Row="1" Grid.Column="1" Grid.RowSpan="8" Grid.ColumnSpan="8"/>
    <Canvas x:Name="lineCanvas" Grid.Row="1" Grid.Column="1" Grid.RowSpan="8" Grid.ColumnSpan="8"/>
    <Canvas x:Name="flagCanvas" Grid.Row="1" Grid.Column="4" Grid.RowSpan="8" Grid.ColumnSpan="2" Width="10"/>
    <Border BorderBrush="#AFB9C3" BorderThickness="2" Background="Transparent"/>
</Grid>
<!-- 再在代码里向 lineCanvas/flagCanvas 手绘线、标记… -->
```

### ✅ 推荐：WaferLine 属性化（模板证据构造）

```xml
<s:WaferLine Width="360" Height="300" WordColor="#00A0FB" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：ellipse/canvasLines/canvasCheckFlag/txtCurrentChannelType 命名部件注入协议全无——Wafer 圆、线、检查标记、通道名的绘制约定（Row1-8/Col1-8 占位、检查标记列 Width=10）无从谈起；
2. **③ 无法样式族切换**：边框色（#AFB9C3）、2px 边框、10×10 网格布局、通道名位置全部散写，不能随隐式默认样式一处调整；
3. **⑤ 脱离视觉规范**：手写网格行数/列数、椭圆占位区、检查标记列宽与框架模板逐项易位，页面视觉无法统一；
4. **④ 绕过框架约定**：在页面内重复拼装框架已封装的骨架结构，属于总则 1「框架存在对应封装控件，手写等效结构即违规」。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/WaferLine.xaml`（锚点：隐式 `Style TargetType="{x:Type controls:WaferLine}"`、`x:Name="ellipse"`、`x:Name="canvasLines"`、`x:Name="canvasCheckFlag"`、`Name="txtCurrentChannelType"`、`Foreground="{Binding WordColor,ElementName=waferLineControl}"`）
- 真实使用：无（ManualView.xaml / refence 全部页面不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_WaferLine.xaml.json`（resource_references）
- 家族对照：`WaferMapping`（wafer-mapping.md）/ `WaferMappingCoat`（wafer-mapping-coat.md）——同属晶圆图家族，但 WaferLine 是线图骨架，与 WaferMapping 的 myCanvas 空模板结构不同构

## 8. 待确认项

- [待确认 TD-049]：WaferLine 绘制机制与数据协议——ellipse/canvasLines/canvasCheckFlag 的注入与绘制约定（Wafer 圆、线条、检查标记的 .cs 面）；`WordColor` 属性存在性及其 `ElementName=waferLineControl` 悬空绑定（模板 namescope 无此名字，WPF 模板内 ElementName 解析失败行为）；`txtCurrentChannelType` 硬编码 `Text="CH1"` 的运行时替换方式。
