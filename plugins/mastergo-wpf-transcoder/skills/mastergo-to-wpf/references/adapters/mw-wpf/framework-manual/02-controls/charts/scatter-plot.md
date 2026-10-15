<!-- evidence=已确认(隐式样式/模板结构为模板源码直接证据；散点绘制协议待确认); pending=[TD-051];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/ScatterPlot.xaml, {source_root}/ManualView.xaml] -->

# ScatterPlotControl（散点图）

## 1. 用途

**散点图容器**：模板仅为空白 Border（背景可配），散点数据与图元绘制全部由 .cs 注入。XAML 面唯一可配属性为 Background。

典型场景：数据分布/相关性散点监控。**无 P2 实例**——ManualView.xaml 与 refence 全部页面均未使用本控件。

## 2. 声明

```xml
<s:ScatterPlotControl … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:ScatterPlotControl`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）——注意**控件类型名为 ScatterPlotControl**（非 ScatterPlot），样式文件名为 ScatterPlot.xaml。本文件为独立 ResourceDictionary（无 MergedDictionaries）；仅含隐式默认样式。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 图区背景；模板 `TemplateBinding Background` 到 Border | 模板 `Border Background="{TemplateBinding Background}"` | ✅ |
| （其它属性） | — | 模板仅空 Border，无任何其它 TemplateBinding/Trigger/Setter 属性证据；散点数据源/坐标系/注入协议全部在 .cs（本地不可见） | 模板全文（阴性） | ❓ [待确认 TD-051] |

模板细节：`Border SnapsToDevicePixels="True"`（对齐像素，防止散点图元渲染模糊）。

## 4. 样式族表（SDC\Style\ScatterPlot.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （隐式默认样式 `TargetType="controls:ScatterPlotControl"`） | 无（独立字典） | 无 x:Key；模板：`Border`（Background=TemplateBinding、SnapsToDevicePixels=True）；无 Alignment Setter、无命名部件 | 散点图容器 |
| （无其它具名键） | — | 文件仅此一样式；无资源、无 ControlTemplate 具名键 | — |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 refence 全部页面未出现 `s:ScatterPlotControl`（grep 阴性）。

```xml
<s:ScatterPlotControl Width="400" Height="300"
                      Background="{StaticResource …图区画刷}" />
```

- 尺寸由使用方指定（模板无默认尺寸、无 Alignment Setter）；
- Background 是模板中唯一 XAML 可配属性（TemplateBinding 证据）；
- 散点数据源、坐标换算、点图元注入全部在 .cs（TD-051），回填前不要试图在 XAML 传数据。

## 6. 禁止写法对照

### ❌ 禁止：页面内手写 Canvas/ItemsControl + 代码画散点（常规 WPF 写法）

```xml
<Canvas x:Name="scatterCanvas" Width="400" Height="300" Background="…"/>
<!-- 再在页面代码里手写：foreach point in data { scatterCanvas.Children.Add(ellipse…按坐标定位…) } -->
```

### ✅ 推荐：ScatterPlotControl 占位 + .cs 协议（模板证据构造）

```xml
<s:ScatterPlotControl Width="400" Height="300"
                      Background="{StaticResource …图区画刷}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：散点数据注入协议全无——数据源、坐标系统、点图元绘制约定无法接入框架统一入口（机制以 TD-051 回填为准），只能在页面代码散写绘制循环；
2. **③ 无法样式族切换**：图区容器骨架（Border + SnapsToDevicePixels）与背景策略散写，不能随隐式默认样式一处调整；
3. **⑤ 脱离视觉规范**：散点坐标/半径/配色脱离框架控制，各页面散点图视觉无法统一；
4. **总则 1/6**：框架已封装 ScatterPlotControl（承载 .cs 绘制协议），手写 Canvas 拼装等效结构即绕过框架。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/ScatterPlot.xaml`（锚点：隐式 `Style TargetType="{x:Type controls:ScatterPlotControl}"`、`Background="{TemplateBinding Background}"`）
- 真实使用：无（ManualView.xaml / refence 全部页面不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_ScatterPlot.xaml.json`（resource_references）
- 家族对照：与 WaferMapping/WaferMappingCoat 同属「空模板 + .cs 绘制」型图表容器，但本控件模板为 Border 且无命名部件（与 Wafer 家族 myCanvas 结构不同构）

## 8. 待确认项

- [待确认 TD-051]：ScatterPlotControl 散点绘制协议——散点数据源/坐标系统/图元注入机制（模板仅空 Border，无命名部件）；控件类型名与文件名的对应（ScatterPlotControl ↔ ScatterPlot.xaml）；除 Background 外是否存在坐标/着色属性（模板无证据，.cs 面待确认）。
