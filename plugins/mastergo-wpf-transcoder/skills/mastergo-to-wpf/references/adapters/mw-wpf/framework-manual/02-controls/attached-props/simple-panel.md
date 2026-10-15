<!-- evidence=已确认(使用处为模板源码直接证据；面板布局语义 .cs 不可见); pending=[TD-054]; verified=2026-08-14;
     sources=[{source_root}/SDC/FrameworkGeneric.xaml, {source_root}/SDC/Style/ComboBox.xaml, {source_root}/SDC/Style/Calendar.xaml, {source_root}/SDC/Style/DataGrid.xaml, {source_root}/ManualView.xaml] -->

# SimplePanel（框架基础面板）

> 补充条目：枚举 FrameworkGeneric.xaml 时发现的清单外工具类（非业务性），依约定补写。

## 1. 用途

框架自定义布局面板 `controls:SimplePanel`（MaxwellControl.Controls，.cs 不可见）——作为**模板根面板**承载叠放/覆盖布局，子元素支持 `Grid.Row`/`Grid.Column` 附加属性。全库 7+ 处模板根使用，是框架模板的基础布局设施（非页面级控件）。

典型场景：Button 双层 Border 结构（背景层 + 边框层叠放，FrameworkGeneric.xaml ExitButtonStyle :21-36）、ComboBox 弹层 mask 层（ScrollViewer + 半透明 mask Border 经 OpacityMask 叠放）、Calendar 日期格多层矩形叠放、DataGrid 分页浮动按钮层。

## 2. 声明

```xml
<!-- 模板内原样（FrameworkGeneric.xaml ExitButtonStyle） -->
<controls:SimplePanel Width="…" Height="…">
    <Border Grid.Row="0" …/>
    <ContentPresenter Grid.Row="0" …/>
</controls:SimplePanel>
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 使用形态：**仅模板内部**——SDC 页面层（ManualView.xaml）零引用；页面不直接用。

## 3. 关键属性表

| 属性/能力 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|
| Grid.Row / Grid.Column 附加属性 | 子元素定位支持（经附加属性路由，语义待确认——等同 Grid 单格叠放或列布局） | FrameworkGeneric.xaml:21-36（ExitButtonStyle 模板内 Path + ContentPresenter 叠放）；ComboBox.xaml:100-109（ScrollViewer + mask Border） | ❓ [TD-054] |
| 公开属性 | 面板无 XAML 可见属性设置（布局尺寸经 Width/Height 直设） | 全库使用处 | ❓ TD-054 |

使用分布（模板源码证据）：FrameworkGeneric.xaml:21/36/187/286/395/436/474（七处模板根）；ComboBox.xaml:102/166/596（弹层 mask 结构）；Calendar.xaml / DataGrid.xaml（分页浮动层）等——均以 `<controls:SimplePanel>` 开标签直接使用，无属性配置。

## 4. 样式族表

无（本条目为布局工具类，非样式族）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零引用（页面不直接用）。以下为 P1 模板证据构造。

```xml
<!-- 页面不书写 SimplePanel；需要叠放时使用框架模板承载的结构 -->
<s:Button Style="{StaticResource ExitButtonStyle}" …/>
```

- SimplePanel 是模板设施，页面通过使用框架控件间接受益。

## 6. 禁止写法对照

### ❌ 禁止：手写 Grid 单行单列模拟叠放（等效替代）

```xml
<Grid>
    <Grid.RowDefinitions><RowDefinition/></Grid.RowDefinitions>
    <Grid.ColumnDefinitions><ColumnDefinition/></Grid.ColumnDefinitions>
    <Border Grid.Row="0" …/>
    <ContentPresenter Grid.Row="0" …/>
</Grid>
```

### ✅ 推荐：使用框架模板承载

```xml
<s:Button Style="{StaticResource ExitButtonStyle}" …/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：SimplePanel 的附加属性路由（Grid.Row/Column 支持、叠放顺序语义）失效——框架模板内层结构依赖其布局行为，手写 Grid 行为分叉；
2. **③ 无法样式族切换**：模板根面板被替换后，样式族调整（叠放顺序、mask 结构）无法穿透；
3. **① 状态一致性**：面板性能特征（轻量、无 Grid 开销）与布局节拍由框架统管，手写版在复杂模板中失去一致性；
4. **⑤ 脱离规范**：模板结构偏离框架基线，升级维护时与官方模板 diff 困难。

## 7. 参考锚点

- 使用分布：`{source_root}/SDC/FrameworkGeneric.xaml`（:21/36/187/286/395/436/474）、`{source_root}/SDC/Style/ComboBox.xaml`（:102/166/596）、`{source_root}/SDC/Style/Calendar.xaml`、`{source_root}/SDC/Style/DataGrid.xaml`
- 真实使用：无（ManualView.xaml 零引用；模板内部设施）
- 索引交叉：`{index_root}/files/refence_SDC_FrameworkGeneric.xaml.json`

## 8. 待确认项

- **TD-054**（新）：SimplePanel 布局语义——叠放规则、Grid.Row/Column 附加属性支持机制、与 Grid 的差异；.cs 不可见，当前仅确认使用形态（模板根、叠放场景）。
