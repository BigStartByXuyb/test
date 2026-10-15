<!-- evidence=已确认(属性/模板/触发器均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[TD-061];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/ScrollViewer.xaml, {source_root}/SDC/Style/ScrollViewer15.xaml, {source_root}/ManualView.xaml] -->

# ScrollViewer（滚动容器·框架样式，两版并存）

## 1. 用途

ScrollViewer 在框架中有**两个并存版本**（两文件两套键，无键冲突——15 版全部键名带 `15` 后缀）：

- **ScrollViewer.xaml（v1，默认版）**：细滚动条（宽 25px）、无箭头按钮、滑道 `Opacity .5→.7` 悬停增强、`TouchableThumb` 触摸滑块。样式为**隐式默认**（不写 Style 即生效）。
- **ScrollViewer15.xaml（v15，键式版）**：粗滚动条（宽 35px）、**带上下箭头按钮**（Polygon 箭头 + `ScrollBar.LineUp/DownCommand`）、普通 Thumb、白底灰边框包裹。样式为**键式** `DefaultScrollViewerStyle`（SDC 内零引用，需显式指定才生效）。

两版模板结构同构（Grid + ScrollContentPresenter + 纵横 ScrollBar），均含 `PanningMode=Both`/`IsManipulationEnabled=True`（触摸滚动）与 `Focusable=False`。v1 的 `ScrollBarBaseStyle` 同时被 **DataGrid.xaml（:439/:450/:626/:637/:812/:824）与 IODataGrid.xaml（:345/:356）共享**（表格滚动条同一套）。

典型场景（推断，无 P2 实例）：默认内容滚动（v1 隐式生效）；如需传统带箭头滚动条显式引用 v15。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<ScrollViewer … />；<ScrollViewer Style="{StaticResource DefaultScrollViewerStyle}" … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `ScrollViewer`。两文件键清单：v1 = 2 Thumb 键 + 1 ScrollBar 键 + 1 ControlTemplate 键 + 1 隐式默认；v15 = 1 RepeatButton 键 + 4 箭头按钮键 + 2 Thumb 键 + 1 ScrollBar 键 + 1 ControlTemplate 键 + 1 键式样式。

## 3. 关键属性表

**双版逐键比对**（文件+键双定位）：

| 比对项 | ScrollViewer.xaml（v1） | ScrollViewer15.xaml（v15） | 差异结论 |
|---|---|---|---|
| 滚动条宽 | 25px（Width/MinWidth=25，横条高 25） | **35px**（Width/MinWidth=35） | 粗条版本 |
| 箭头按钮 | 无 | **有**（VerticalScrollBarPageButton1/2 上下箭头、3/4 左右箭头，Polygon #182445/#8994a1，LineUp/Down/Left/RightCommand） | v15 独有传统按钮 |
| 滑块 | `TouchableThumb`（自定义可触摸） | 普通 `Thumb`（35×35，硬编码 #d7dde4） | v1 触摸优化，v15 传统 |
| 滑块圆角 | Rectangle RadiusX/Y 4（20px） | 无圆角（方形 Border） | v1 圆角细条 |
| 滑道透明度 | Track Opacity .5，悬停→.7（Trigger） | 常显（无 Opacity 动画） | v1 悬停增强 |
| 轨道背景 | Transparent（不画底） | 白底 + `PrimaryBorderBrush` 1px 边框包裹 | v15 可见边框 |
| Track 装饰按钮 | 无 | Decrease/IncreaseRepeatButton（PageUp/Down 命令，`ScrollBarBaseRepeatButton`） | v15 页滚动支持 |
| 前景 | `ScrollViewer_BackBrush`（Brushes\ScrollViewerBrushes.xaml:3） | `ThirdlyDeepBrush` | 滑块色来源不同 |
| 模板 | `ScrollViewerNativeBaseControlTemplate`：**含 Storyboard1/2 滚动条 0.2s 淡入淡出资源（无 EventTrigger 挂载 = 死资源）** | `ScrollViewerNativeBaseControlTemplate15`：无任何动画资源 | v1 动画为死代码 |
| 滚动条样式键 | `ScrollBarBaseStyle`（**被 DataGrid 家族共享**） | `ScrollBarBaseStyle15`（仅本模板引用） | 共享面不同 |
| 容器样式 | 隐式默认（PanningMode=Both、IsManipulationEnabled=True、VerticalScrollBarVisibility=Auto、Focusable=False，Template 直引） | 键式 `DefaultScrollViewerStyle`（同 4 Setter，Template 引 15） | v1 全局生效；v15 显式引用、SDC 内零引用 |

**两版共有**（模板结构证据）：`PART_ScrollContentPresenter`（CanContentScroll 直绑）、`PART_VerticalScrollBar`/`PART_HorizontalScrollBar`（Computed*ScrollBarVisibility、VerticalOffset/HorizontalOffset OneWay 绑定、ViewportSize 直绑、AutomationId）、`CanContentScroll` 支持。

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| PanningMode | PanningMode | 隐式默认 Both（触摸平移） | v1 隐式 Setter（:140）/ v15 键式 Setter（:273） | ✅ |
| IsManipulationEnabled | bool | 默认 True（触控操纵） | 同上（:141/:274） | ✅ |
| VerticalScrollBarVisibility | ScrollBarVisibility | 默认 Auto | 同上（:142/:275） | ✅ |
| Focusable | bool | 默认 False | 同上（:143/:276） | ✅ |
| CanContentScroll | bool | 模板直绑（逻辑滚动开关，ScrollViewer 原生属性） | 两模板 PART_ScrollContentPresenter（v1:120 / v15:254） | ✅ |
| Padding | Thickness | 模板直绑 Margin | 两模板 | ✅ |
| 触摸支持（v1） | — | `TouchableThumb` 滑块 + `IsEnabled={TemplateBinding IsMouseOver}` 的 Track | v1 ScrollBarBaseStyle 模板（:48-51） | ✅ |
| 页滚动（v15） | — | Track.Decrease/IncreaseRepeatButton + PageUp/Down/Left/RightCommand | v15 ScrollBarBaseStyle15 模板（:176-186,219-229） | ✅ |

## 4. 样式族表（双文件合表）

| 样式键 | 所在文件 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|---|
| ScrollBarBaseThumbVertical / Horizontal | ScrollViewer.xaml | 无 | 20px 圆角细条 Rectangle，OverridesDefaultStyle | v1 滚动条滑块 |
| ScrollBarBaseStyle | ScrollViewer.xaml | 无 | 25px 细条、TouchableThumb、Opacity .5→.7、无箭头；**DataGrid 家族共享**（DataGrid.xaml:439/450/626/637/812/824、IODataGrid.xaml:345/356） | v1 滚动条（含表格） |
| ScrollViewerNativeBaseControlTemplate | ScrollViewer.xaml | （ControlTemplate 键） | Grid+ContentPresenter+双 ScrollBar；Storyboard1/2 死资源 | v1 隐式模板 |
| （隐式默认样式） | ScrollViewer.xaml | 无 | PanningMode=Both 等 4 Setter + 引上模板（:139-146） | 未显式指定 Style 时（全局生效） |
| ScrollBarBaseRepeatButton | ScrollViewer15.xaml | 无 | 页滚动 RepeatButton（PrimaryDefaultBrush） | v15 Track 页按钮 |
| VerticalScrollBarPageButton1/2/3/4 | ScrollViewer15.xaml | 无 | 上/下/左/右箭头（Polygon + Line*Command，IsPressed→DefaultButton_SelectBackBrush，1/2 为上下箭头 35px） | v15 箭头按钮 |
| ScrollBarBaseThumbVertical15 / Horizontal15 | ScrollViewer15.xaml | 无 | 35×35 方形 Thumb（SecondaryLightBrush） | v15 滚动条滑块 |
| ScrollBarBaseStyle15 | ScrollViewer15.xaml | 无 | 35px 白底灰边包裹、箭头+页按钮齐全 | v15 滚动条 |
| ScrollViewerNativeBaseControlTemplate15 | ScrollViewer15.xaml | （ControlTemplate 键） | 无动画资源的模板（结构同 v1） | v15 模板 |
| DefaultScrollViewerStyle | ScrollViewer15.xaml | 无 | 键式样式（4 Setter 同 v1 隐式，引 15 模板）；**SDC 内零引用** | 需带箭头传统滚动条时显式指定 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<!-- 默认版：隐式样式全局生效，无需任何声明 -->
<ScrollViewer>
    <Grid Height="900">…超出可视区内容…</Grid>
</ScrollViewer>

<!-- 传统带箭头版：必须显式引用键式样式 -->
<ScrollViewer Style="{StaticResource DefaultScrollViewerStyle}">
    <Grid Height="900">…</Grid>
</ScrollViewer>
```

- 默认即 v1（25px 细条）；要 v15 带箭头大滚动条必须 `Style="{StaticResource DefaultScrollViewerStyle}"`；
- 表格（DataGrid 家族）滚动条自动复用 `ScrollBarBaseStyle`（v1），不受 DefaultScrollViewerStyle 影响。

## 6. 禁止写法对照

### ❌ 禁止：手写 Grid + ScrollBar 部件拼等效滚动容器（常规 WPF 写法）

```xml
<Grid>
    <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/>
    </Grid.ColumnDefinitions>
    <ContentPresenter x:Name="content"/>
    <ScrollBar x:Name="vsb" Grid.Column="1" Orientation="Vertical"
               Maximum="{Binding 手写最大滚动值}" Value="{Binding 手写偏移}" Width="25"/>
    <!-- 偏移同步、触摸操作、滚动条悬停增强全部手写… -->
</Grid>
```

### ✅ 推荐：ScrollViewer 属性化

```xml
<ScrollViewer>
    <Grid Height="900">…</Grid>
</ScrollViewer>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 Track 悬停 Opacity .5→.7 增强、箭头按钮 IsPressed 态（DefaultButton_SelectBackBrush）、触摸平移（PanningMode=Both + IsManipulationEnabled=True）与 `TouchableThumb` 触摸滑块；
2. **② 丢失协议挂点**：绕过 `PART_ScrollContentPresenter`/`PART_VerticalScrollBar`/`PART_HorizontalScrollBar` 部件协议与 Computed*ScrollBarVisibility/Offset OneWay 绑定通道——CanContentScroll（逻辑滚动）、ScrollableHeight/Width 语义需自行重造；
3. **③ 无法样式族切换**：25px 细条（默认）与 35px 带箭头（DefaultScrollViewerStyle）两形态无法一键切换；表格共享的 `ScrollBarBaseStyle` 调整时手写页不跟随；
4. **④ 绕过资源体系**：硬编码滑轨/滑块颜色绕过 `ScrollViewer_BackBrush`（ScrollViewerBrushes.xaml）与 `ThirdlyDeepBrush`；
5. **⑤ 脱离视觉规范**：滚动条 25/35px 宽度 Token、AutomationId 命名（VerticalScrollBar/HorizontalScrollBar）、无边框策略（v1）或白底灰边（v15）脱离框架控制。

## 7. 参考锚点

- v1 源码：`{source_root}/SDC/Style/ScrollViewer.xaml`（锚点 `x:Key="ScrollBarBaseStyle"`（:34）、`x:Key="ScrollBarBaseThumbVertical"`/`Horizontal`（:10/:22）、`x:Key="ScrollViewerNativeBaseControlTemplate"`（:92，Storyboard1/2 无 EventTrigger）、隐式默认 `Style TargetType="ScrollViewer"`（:139））
- v15 源码：`{source_root}/SDC/Style/ScrollViewer15.xaml`（锚点 `x:Key="VerticalScrollBarPageButton1/2/3/4"`（:26/:52/:78/:99）、`x:Key="ScrollBarBaseThumbVertical15"`/`Horizontal15`（:121/:136）、`x:Key="ScrollBarBaseStyle15"`（:151）、`x:Key="ScrollViewerNativeBaseControlTemplate15"`（:244）、`x:Key="DefaultScrollViewerStyle"`（:272））
- 画刷：`{source_root}/SDC/Brushes/ScrollViewerBrushes.xaml`（`ScrollViewer_BackBrush`:3）、`{source_root}/SDC/Brushes.xaml`（ThirdlyDeepBrush）
- 共享消费：`{source_root}/SDC/Style/DataGrid.xaml`（:439/:450/:626/:637/:812/:824）、`{source_root}/SDC/Style/IODataGrid.xaml`（:345/:356）引用 ScrollBarBaseStyle
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_ScrollViewer.xaml.json`、`{index_root}/files/refence_SDC_Style_ScrollViewer15.xaml.json`

## 8. 待确认项

- TD-061：ScrollViewer 双版并存——① v1 模板 Storyboard1/2（滚动条 0.2s 淡入淡出）无 EventTrigger 挂载，**死资源**（历史淡入设计残留？）；② v15 `DefaultScrollViewerStyle` SDC 内零引用（选型权在页面还是被废弃？）；③ 两版滚动条 25/35px 并存是否有迁移计划。
- [待确认 TD-xxx]：v1 `ScrollBarBaseThumbVertical` 内 `HorizontalAlignment="Right"` 与 v15 Thumb 硬编码 #d7dde4 颜色（无键）——细节策略待确认。
- [待确认 TD-xxx]：v15 箭头按钮 VerticalScrollBarPageButton3/4 命名（"Vertical" 前缀但承载横向箭头）——命名语义待确认。
