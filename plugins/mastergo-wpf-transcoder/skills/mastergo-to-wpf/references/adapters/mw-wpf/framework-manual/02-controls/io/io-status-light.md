<!-- evidence=已确认(模板/VSM/画刷资源均为模板源码直接证据；状态属性面 .cs 不可见); pending=[待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOStatusLight.xaml, {source_root}/ManualView.xaml] -->

# IOStatusLight（状态指示灯）

## 1. 用途

纯状态灯：20×20 圆形渐变指示灯（默认红系渐变），经 VSM `StatusStates` 在 ON/OFF 两态间切换——ON 时渐变填充的红色两 stops 在 0.1s 内动画为 `#09ed09`/`Green`，OFF 恢复默认红系。用于设备状态（运行/停止/报警）点位显示。

典型场景（推断，无 P2 实例）：设备状态指示区。ManualView.xaml 未使用本控件；模板注释「只能ControlTemplate的第一层中，再多层就不能切换状态了」为状态切换机制的结构约束证据。

## 2. 声明

```xml
<s:IOStatusLight … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOStatusLight`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件仅含样式层（`IOStatusLightBaseStyle` + 隐式默认样式），控件代码不可见。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| 状态属性（名待确认） | 取值 ON/OFF | 状态灯两态切换：ON 时 `EllipseElement` 渐变填充 `GradientStops[1]`/`[2]` 分别动画至 `#09ed09`/`Green`（0.1s），OFF 无动画；属性名与 VSM 激活机制 .cs 不可见 | `VisualStateGroup Name="StatusStates"` + `VisualState Name="ON"/"OFF"` + `ColorAnimation Storyboard.TargetName="EllipseElement"` | 🟡 [待确认 TD-xxx] |
| 尺寸（模板侧） | 20×20 | 椭圆灯尺寸/描边厚度模板内硬编码，**非** TemplateBinding，亦未引用 Sizes 尺寸 Token | `EllipseElement Width="20" Height="20" StrokeThickness="2"` | ✅ |
| StatusLightWidth / StatusLightHeight / MaxwellFramework_StatusLightHeight | 13 / 13 / 70 | Sizes.xaml 状态灯尺寸 Token；SDC 内 XAML 全库零引用（模板硬编码 20×20 与其不符），用途待确认 | `Sizes.xaml` 键 `x:Key="StatusLightWidth"` / `x:Key="StatusLightHeight"` / `x:Key="MaxwellFramework_StatusLightHeight"` | 🟡 [待确认 TD-xxx] |
| （模板无任何 TemplateBinding） | — | 模板不消费控件任何自身属性——视觉完全由模板资源 + VSM 决定，属性面全部在 .cs 侧 | ControlTemplate 全文（无 `TemplateBinding`） | ❓ [待确认 TD-xxx] |
| （无 IOEnable 证据） | — | 模板中无 IOEnable / 协议挂点；设备联锁协议见 TD-001 | 模板全文 + `{source_root}/ManualView.xaml`（IOEnable 仅出现于 IconButton） | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\IOStatusLight.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IOStatusLightBaseStyle | 无（独立） | 默认模板：Grid 单层（VSM 仅允许第一层）+ EllipseElement 20×20、StrokeThickness 2、Margin 5,0、水平居中；VSM StatusStates ON/OFF | 基样式，不直接用 |
| （隐式默认样式） | IOStatusLightBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |

模板内资源键（同文件）：`EllipseStroke`（#8b4b40）/ `EllipseFill`（#ed7a6d）实色版、`LinearEllipseStroke`（Gray→Lightgray 渐变）、`LinearEllipseFill`（LightGray→#ed7a6d→Red 三 stop 渐变，Stop1/Stop2 具名——ON 动画即动画这两个 stop）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 FrameworkGeneric.xaml 均未出现 `s:IOStatusLight`。

```xml
<s:IOStatusLight />
```

- 状态切换由控件内部驱动（VSM `StatusStates` ON/OFF 两态），页面侧**无可设属性**（模板无 TemplateBinding）；
- 状态属性名/取值未确认前，不得在页面 XAML 中自行设置状态属性（见区块 8）；
- 模板 VSM 结构约束：状态组必须直接位于模板根（Grid）第一层，多包一层即无法切换状态（模板内注释证据）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Ellipse + 手动状态切换（常规 WPF 写法）

```xml
<Ellipse Width="20" Height="20" StrokeThickness="2" Margin="5,0">
    <Ellipse.Fill>
        <LinearGradientBrush StartPoint="0,0" EndPoint="0,1">
            <GradientStop Offset="0" Color="LightGray"/>
            <GradientStop Offset="0.3" Color="#ed7a6d"/>
            <GradientStop Offset="1" Color="Red"/>
        </LinearGradientBrush>
    </Ellipse.Fill>
</Ellipse>
<!-- 再在代码或 Style.Triggers 里手写 ON/OFF 颜色切换与 0.1s 动画… -->
```

### ✅ 推荐：IOStatusLight 一行（模板证据构造）

```xml
<s:IOStatusLight />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 VSM `StatusStates` 两态与 0.1s 双 stop 渐变颜色动画（`#09ed09`/`Green`），状态切换要么硬编码要么丢动画；
2. **② 丢失协议挂点**：手写 Ellipse 没有状态协议挂点——设备状态（运行/停止/报警）只能靠页面散写代码置色，无法由框架统一驱动（状态属性面待 TD 确认，设备联锁另见 [TD-001](../../03-protocols/device-condition-protocol.md)）；
3. **③ 无法样式族切换**：渐变画刷（LinearEllipseFill/Stroke）、描边 2px、尺寸 20×20 全部散写，不能由 IOStatusLightBaseStyle 一处调整；
4. **⑤ 脱离视觉规范**：状态灯渐变/描边/尺寸脱离框架控制——且与 Sizes 尺寸 Token（StatusLightWidth/Height 13×13）关系未明，手写更无从对齐。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOStatusLight.xaml`（锚点 `x:Key="IOStatusLightBaseStyle"`、`VisualStateGroup Name="StatusStates"`、`x:Name="EllipseElement"`、资源键 `LinearEllipseFill`/`LinearEllipseStroke`）
- 尺寸 Token：`{source_root}/SDC/Sizes.xaml`（`x:Key="StatusLightWidth"` / `x:Key="StatusLightHeight"` / `x:Key="MaxwellFramework_StatusLightHeight"`）
- 真实使用：无（ManualView.xaml / FrameworkGeneric.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOStatusLight.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：IOStatusLight 状态属性名与 ON/OFF 取值、VSM 激活机制（GoToState 调用方）——与 StatusButton 同型问题（关联 `../navigation/status-button.md` 区块 8 与 TD-012 模式，建议独立编号）。
- [待确认 TD-xxx]：`StatusLightWidth/Height`（13×13）、`MaxwellFramework_StatusLightHeight`（70）Token 用途——模板硬编码 20×20 且全库零引用，疑似遗留或 .cs 侧消费（同 TD-019 模式）。
- [待确认 TD-xxx]：模板零 TemplateBinding 时控件的属性面（是否仍有 Width/Height/画刷类可覆盖属性）。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据；IOEnable 使用面仅见 IconButton（`{source_root}/ManualView.xaml`），「IO 系列核心协议 IOEnable」在 IOStatusLight 无模板支持，待框架作者确认（见手册发布说明）。
