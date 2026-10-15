<!-- evidence=已确认(全部为 P1 模板源码直接证据——纯 Setter 样式族，无模板无触发器); pending=[TD-064];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/Loading.xaml, {source_root}/ManualView.xaml] -->

# Loading（加载指示·框架样式，LoadingBase/LoadingLine/LoadingCircle）

## 1. 用途

Loading 家族三个自定义控件（MaxwellControl.Controls：`LoadingBase` 基类 / `LoadingLine` 直线加载条 / `LoadingCircle` 圆形加载条）的框架样式。**本文件为纯 Setter 样式族（无模板、无触发器）**——所有动画/绘制逻辑在 .cs（本仓库不可见），XAML 侧仅配置参数化属性：

- `DotDiameter`（点径）、`DotInterval`（点间距）、`DotOffSet`、`DotDelayTime`（动画延迟）、`DotSpeed`（速度）——圆点动画参数；
- `Foreground`（点颜色，默认 `LightTextBrush`）、`Width/Height`（圆形版 40×40）。

样式族：`LoadingBaseStyle` → `LoadingLineBaseStyle`/`LoadingCircleBaseStyle`（各带隐式默认）→ **Light（亮色）/Large（加长/加大）/LargeLight（亮+大）六变体**。

典型场景（推断，无 P2 实例）：页面/区块加载等待（直线）、按钮或独立加载指示（圆形）。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<controls:LoadingLine … />；<controls:LoadingCircle … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:LoadingBase`/`controls:LoadingLine`/`controls:LoadingCircle`（MaxwellControl.Controls）。本文件含 9 个样式键 + 2 个隐式默认样式。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Focusable | bool | 基样式 False（不参与键盘焦点） | `x:Key="LoadingBaseStyle"` Setter（:12） | ✅ |
| DotDiameter | double | 点径：基 10、Line 5、Circle 5；Large 变体 10 | 各样式 Setter | ✅ |
| Foreground | Brush | 点颜色：基样式即 `LightTextBrush`（**Light 变体同值，冗余**） | LoadingBaseStyle Setter（:14）+ Light 变体 Setter | ✅ |
| DotInterval / DotOffSet / DotDelayTime / DotSpeed | int | 圆点动画参数：Circle 基 30/60/90/4；Large 20/40/120/继承 4 | `x:Key="LoadingCircleBaseStyle"`/`LoadingCircleLarge` Setter | ✅ |
| Width / Height | double | Circle 基 40×40；Large 100×100（Line 无尺寸，宽度随容器） | LoadingCircleBaseStyle/Large Setter | ✅ |

## 4. 样式族表（SDC\Style\Loading.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/参数差异） | 适用场景 |
|---|---|---|---|
| LoadingBaseStyle | 无（独立） | Focusable=False、DotDiameter=10、Foreground=LightTextBrush（基类配置） | 基样式，不直接用 |
| LoadingLineBaseStyle | LoadingBaseStyle | DotDiameter=5（直线条） | 基样式，不直接用 |
| （LoadingLine 隐式默认） | LoadingLineBaseStyle | TargetType 默认样式（:22） | 未显式指定 Style 时 |
| LoadingCircleBaseStyle | LoadingBaseStyle | 40×40、DotDiameter=5、Interval 30/OffSet 60/DelayTime 90/Speed 4 | 基样式，不直接用 |
| （LoadingCircle 隐式默认） | LoadingCircleBaseStyle | TargetType 默认样式（:36） | 未显式指定 Style 时 |
| LoadingLineLight | LoadingLineBaseStyle | Foreground=LightTextBrush（**与基样式同值**） | 亮色直线条 |
| LoadingLineLarge | LoadingLineBaseStyle | DotDiameter=10（加长） | 大号直线条 |
| LoadingLineLargeLight | LoadingLineLarge | Foreground=LightTextBrush | 亮+大直线条 |
| LoadingCircleLight | LoadingCircleBaseStyle | Foreground=LightTextBrush（**与基样式同值**） | 亮色圆加载 |
| LoadingCircleLarge | LoadingCircleBaseStyle | 100×100、DotDiameter=10、Interval 20/OffSet 40/DelayTime 120 | 大号圆加载 |
| LoadingCircleLargeLight | LoadingCircleLarge | Foreground=LightTextBrush | 亮+大圆加载 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<!-- 直线加载条（默认） -->
<controls:LoadingLine />

<!-- 圆形加载条（默认 40×40） -->
<controls:LoadingCircle />

<!-- 大号圆形加载条（100×100） -->
<controls:LoadingCircle Style="{StaticResource LoadingCircleLarge}" />
```

- Line/Circle 不写 Style 即隐式默认；变体按需显式引用；
- 颜色默认 `LightTextBrush`（白系，适合深底）；浅色底需自定 Foreground 或选 Light 变体（注意 Light 与默认同值——见待确认项）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Ellipse 堆叠 + 手工动画拼等效加载圈（常规 WPF 写法）

```xml
<StackPanel Orientation="Horizontal">
    <Ellipse Width="10" Height="10" Fill="#fff" x:Name="d1"/>
    <Ellipse Width="10" Height="10" Fill="#fff" x:Name="d2"/>
    <Ellipse Width="10" Height="10" Fill="#fff" x:Name="d3"/>
    <!-- 手写 Storyboard：透明度/缩放错拍、循环、间距计算… -->
</StackPanel>
```

### ✅ 推荐：框架控件属性化

```xml
<controls:LoadingLine />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 .cs 内建的圆点动画协议（DotInterval/DotOffSet/DotDelayTime/DotSpeed 参数化错拍动画）——逐点手写 Storyboard 必然错拍或无法参数化；
2. **② 丢失协议挂点**：绕过 `controls:LoadingBase` 控件协议（Focusable=False 焦点策略、参数化属性挂点）——参数无法在 XAML 侧统一配置与样式族切换；
3. **④ 绕过资源体系**：硬编码点色绕过 `LightTextBrush`（Brushes 键体系）；
4. **⑤ 脱离视觉规范**：点径 5/10、圆加载 40×40/100×100 规格散写，页面无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Loading.xaml`（锚点 `x:Key="LoadingBaseStyle"`（:11）、`x:Key="LoadingLineBaseStyle"`（:18）+ 隐式（:22）、`x:Key="LoadingCircleBaseStyle"`（:26，DotInterval 30/DotOffSet 60/DotDelayTime 90/DotSpeed 4）+ 隐式（:36）、`LoadingLineLight`/`LoadingLineLarge`/`LoadingLineLargeLight`（:39-49）、`LoadingCircleLight`/`LoadingCircleLarge`/`LoadingCircleLargeLight`（:53-70））
- 画刷：`{source_root}/SDC/Brushes.xaml`（LightTextBrush）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Loading.xaml.json`

## 8. 待确认项

- TD-064：Loading 家族并入零使用实例用途类——① 动画/绘制逻辑全部在 .cs（不可见），Dot* 参数语义待确认；② `LoadingBaseStyle` 已设 `Foreground=LightTextBrush` 而 **Light/LargeLight 变体再设同值（冗余变体）**；③ 三控件（LoadingBase/LoadingLine/LoadingCircle）真实消费场景待确认。
