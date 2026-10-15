<!-- evidence=已确认(隐式样式/空模板结构为模板源码直接证据；绘制协议与数据源待确认); pending=[TD-050];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/WaferMapping.xaml, {source_root}/SDC/Style/WaferMappingCoat.xaml, {source_root}/ManualView.xaml] -->

# WaferMapping（晶圆映射图）

## 1. 用途

**晶圆 Die 映射图容器**：模板仅为单一空白 Canvas（myCanvas），全部图元（Die 阵列、状态着色等）由 .cs 注入绘制。XAML 面无任何数据/视觉属性。

典型场景：晶圆缺陷/良率映射（Mapping）与镀膜工艺映射（Coat 版）。**无 P2 实例**——ManualView.xaml 与 refence 全部页面均未使用本控件。

## 2. 声明

```xml
<s:WaferMapping … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:WaferMapping`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件为独立 ResourceDictionary（无 MergedDictionaries）；仅含隐式默认样式。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| VerticalAlignment / HorizontalAlignment | Center | 隐式默认样式 Setter | 隐式样式 `Setter Property="VerticalAlignment"/"HorizontalAlignment"` | ✅ |
| （其它属性） | — | 模板仅空 Canvas，无任何 TemplateBinding/Trigger/Setter 属性证据；控件属性面与数据源协议全部在 .cs（本地不可见） | 模板全文（阴性） | ❓ [待确认 TD-050] |

命名部件：`myCanvas`（模板内唯一元素，全部绘制内容注入点；Row/Col 布局无）。

## 4. 样式族表（SDC\Style\WaferMapping.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （隐式默认样式 `TargetType="controls:WaferMapping"`） | 无（独立字典） | 无 x:Key；Vertical/HorizontalAlignment=Center；模板：`<Canvas x:Name="myCanvas"/>` | 晶圆 Die 映射图容器 |
| （无其它具名键） | — | 文件仅此一样式；无资源、无 ControlTemplate 具名键 | — |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 refence 全部页面未出现 `s:WaferMapping`（grep 阴性）。

```xml
<s:WaferMapping Width="360" Height="300" />
```

- 尺寸由使用方指定（模板无默认尺寸）；Alignment 由隐式默认样式居中；
- XAML 面仅此而已——映射数据源、Die 状态着色、图元绘制全部在 .cs（TD-050），回填前不要试图在 XAML 传数据；
- 与 [WaferMappingCoat](wafer-mapping-coat.md) 逐行同构（仅 TargetType 不同），差异面在 .cs 行为（Coat=镀膜映射）。

## 6. 禁止写法对照

### ❌ 禁止：页面内手写 Canvas + 代码绘制 Die 阵列（常规 WPF 写法）

```xml
<Canvas x:Name="dieCanvas" Width="360" Height="300"/>
<!-- 再在页面代码里手写循环：for x in 0..N { for y in 0..N { dieCanvas.Children.Add(rect…) } } -->
```

### ✅ 推荐：WaferMapping 占位 + .cs 协议（模板证据构造）

```xml
<s:WaferMapping Width="360" Height="300" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：myCanvas 注入协议全无——映射数据源、Die 图元绘制约定无法接入框架统一入口，只能在页面代码散写绘制循环；
2. **③ 无法样式族切换**：Alignment 策略与容器骨架散写，不能随隐式默认样式一处调整；Mapping/Coat 双控件同构切换无从谈起；
3. **⑤ 脱离视觉规范**：Die 尺寸/间距/状态配色脱离框架控制，各页面映射图视觉无法统一；
4. **总则 1/6**：框架已封装 WaferMapping（承载 .cs 绘制协议），手写 Canvas 拼装等效结构即绕过框架（绘制协议细节以 TD-050 回填为准）。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/WaferMapping.xaml`（锚点：隐式 `Style TargetType="{x:Type controls:WaferMapping}"`、`x:Name="myCanvas"`）
- 真实使用：无（ManualView.xaml / refence 全部页面不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_WaferMapping.xaml.json`（resource_references）
- 家族对照：`{source_root}/SDC/Style/WaferMappingCoat.xaml`——与 Coat 版逐行同构（见下方家族键矩阵结论与 [wafer-mapping-coat](wafer-mapping-coat.md)）

## 8. 待确认项

- [待确认 TD-050]：WaferMapping / WaferMappingCoat 双控件的 .cs 绘制协议——myCanvas 注入内容与数据源格式、Die 图元（尺寸/间距/状态着色）约定、两控件真实差异（Mapping vs Coat）全在 .cs 面；XAML 模板零属性证据，任何 XAML 使用面断言均需回填后确认。
