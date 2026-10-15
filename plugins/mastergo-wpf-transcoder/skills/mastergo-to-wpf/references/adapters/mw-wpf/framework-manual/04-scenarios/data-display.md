<!-- evidence=场景对照(组装层,无新证据;正确写法原样摘自已写条目); pending=[TD-022,TD-024,TD-025]; verified=2026-08-14; sources=[{source_root}/SDC/Style/IOStatusLight.xaml, {source_root}/ManualView.xaml]
     反例有效性(2026-08-14 grep 验证): ManualView.xaml 无 `<Ellipse`(零命中); SDC\Style\ 中 Ellipse 仅存在于框架自身模板(IOStatusLight.xaml 的 EllipseElement、StatusButton/Dashboard/WaferLine 等),页面层手写裸 Ellipse+手写颜色动画的结构未出现在真实页面 -->

# 场景：数据展示

## 场景⑪：状态灯（设备运行/停止/报警点位指示）

> **关键规则**：设备状态点位指示一律用 IOStatusLight（VSM `StatusStates` ON/OFF 两态），状态切换由控件内部驱动，页面禁止手写裸 Ellipse + 手动置色/写动画。

### 场景描述

页面上放一排 20×20 状态灯指示设备状态（运行=绿、停止/报警=红），状态由设备侧驱动切换。

### 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 状态灯（两态圆点） | IOStatusLight（隐式默认样式，`<s:IOStatusLight />` 即用） | ../02-controls/io/io-status-light.md |
| 带状态的功能按钮（可选路由） | StatusButton | ../02-controls/navigation/status-button.md |
| 状态画刷族（供模板 Trigger 使用，页面不直接引用） | Brushes/ 状态画刷 | ../01-resources/brushes.md |

### 对照

#### ❌ 禁止：常规 WPF 写法（手写 Ellipse + 手动状态切换）

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

#### ✅ 推荐：框架写法（IOStatusLight 一行，原样摘自 02-controls/io/io-status-light.md §5，模板证据构造）

```xml
<s:IOStatusLight />
```

- 状态切换由控件内部驱动（VSM `StatusStates` ON/OFF 两态：ON 时渐变填充两 stops 0.1s 动画至 `#09ed09`/`Green`，OFF 恢复默认红系），页面侧**无可设属性**（模板无 TemplateBinding）；
- 状态属性名/取值未确认前，不得在页面 XAML 中自行设置状态属性（待 TD-024）；
- 模板 VSM 结构约束：状态组必须直接位于模板根（Grid）第一层，多包一层即无法切换状态（IOStatusLight.xaml 模板内注释证据）。

### 禁止原因

1. **① 丢失状态**：手写版没有 VSM `StatusStates` 两态与 0.1s 双 stop 渐变颜色动画（`#09ed09`/`Green`），状态切换要么硬编码要么丢动画；
2. **② 丢失协议挂点**：手写 Ellipse 没有状态协议挂点——设备状态（运行/停止/报警）只能靠页面散写代码置色，无法由框架统一驱动（状态属性面待 [TD-024](../05-best-practices/pending-confirmations.md)；设备联锁另见 [TD-001](../03-protocols/device-condition-protocol.md)，且 IOEnable 在 IOStatusLight 模板无挂点证据，见 [TD-022](../05-best-practices/pending-confirmations.md)）；
3. **③ 无法样式族切换**：渐变画刷（LinearEllipseFill/Stroke）、描边 2px、尺寸 20×20 全部散写，不能由 IOStatusLightBaseStyle 一处调整；
4. **⑤ 脱离视觉规范**：状态灯渐变/描边/尺寸脱离框架控制——且与 Sizes 尺寸 Token（StatusLightWidth/Height 13×13）关系未明（模板硬编码 20×20，见 [TD-025](../02-controls/io/io-status-light.md)），手写更无从对齐。

## 证据来源

- 模板证据（P1）：`{source_root}/SDC/Style/IOStatusLight.xaml`（锚点 `x:Key="IOStatusLightBaseStyle"`、`VisualStateGroup Name="StatusStates"`、`x:Name="EllipseElement"`、资源键 `LinearEllipseFill`/`LinearEllipseStroke`）
- 尺寸 Token：`{source_root}/SDC/Sizes.xaml`（`x:Key="StatusLightWidth"`/`StatusLightHeight`/`MaxwellFramework_StatusLightHeight`）
- 真实使用：**无 P2 实例**（ManualView.xaml / FrameworkGeneric.xaml 不含本控件）；正确写法为模板证据构造
- 反例有效性：见文件头注释（grep 验证结论，2026-08-14）
- 待确认项：TD-024（状态属性名与 ON/OFF 激活机制）、TD-025（尺寸硬编码与 Token 矛盾）、TD-022（IOEnable 在 IO 家族模板零引用）——见 `../05-best-practices/pending-confirmations.md`
