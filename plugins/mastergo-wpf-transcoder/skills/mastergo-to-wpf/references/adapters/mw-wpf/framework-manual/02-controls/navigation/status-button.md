<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；无 P2 页面使用实例); pending=[待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/StatusButton.xaml, {source_root}/ManualView.xaml] -->

# StatusButton（状态按钮）

## 1. 用途

状态指示灯 + 按钮二合一：左侧 20×20 圆形状态灯（默认红系渐变，`ON` 状态动画切换为绿色）+ 右侧文字/内容，带 Hover（淡蓝底）与按下（深蓝底白字）反馈。典型场景（推断，无 P2 实例）：设备运行/停止状态反馈类操作按钮——ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:StatusButton … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:StatusButton`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件仅含样式层（`StatusButtonBaseStyle` + 隐式默认样式），控件代码不可见。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Content | object | 右侧文字/内容，经 ContentPresenter 呈现 | 模板 `ContentPresenter Grid.Column="1"` | ✅ |
| Width / Height | double | 基样式默认 100×40 | `x:Key="StatusButtonBaseStyle"` Setter | ✅ |
| Margin | Thickness | 基样式默认 5 | StatusButtonBaseStyle Setter | ✅ |
| FontWeight | FontWeight | 基样式默认 Bold | StatusButtonBaseStyle Setter | ✅ |
| Background | Brush | 默认 LinearBackground（白→浅灰渐变）；Hover→LightBlue；Pressed→#1b3a6a | StatusButtonBaseStyle Setter + `Trigger Property="IsMouseOver"` / `Trigger Property="IsPressed"` | ✅ |
| BorderBrush / BorderThickness | Brush / Thickness | 默认 DarkGray / 2（BorderCornerRadis 资源为圆角 5，**非** BorderElement 绑定） | StatusButtonBaseStyle Setter + 模板 Border `TemplateBinding` | ✅ |
| HorizontalContentAlignment / VerticalContentAlignment | Alignment | 默认 Center | StatusButtonBaseStyle Setter | ✅ |
| Foreground | Brush | Pressed 时切换为 White | `Trigger Property="IsPressed"` | ✅ |
| 状态属性（名待确认） | 取值 ON/OFF | 左侧椭圆状态灯切换：ON 时渐变填充两 stops 动画为 #09ed09/Green（0.1s），OFF 无动画；属性名与 VSM 激活机制 .cs 不可见 | `VisualStateGroup Name="StatusStates"` + `VisualState Name="ON"/"OFF"` | 🟡 [待确认 TD-xxx] |

## 4. 样式族表（SDC\Style\StatusButton.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| StatusButtonBaseStyle | 无（独立） | 100×40、Bold、白→浅灰渐变底、DarkGray 边 2、圆角 5（BorderCornerRadis）、左椭圆灯 20×20（LinearEllipseFill/Stroke）、Hover/Pressed 触发器、VSM StatusStates | 基样式，不直接用 |
| （隐式默认样式） | StatusButtonBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |

模板内资源键（同文件）：`LinearBackground`（底渐变）、`EllipseStroke/EllipseFill`、`LinearEllipseStroke/LinearEllipseFill`（椭圆灯渐变，默认含红 stop `#ed7a6d`）、`BorderBrush/BorderThickness/BorderCornerRadis`。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `s:StatusButton`。

```xml
<s:StatusButton Width="100" Height="40"
                Content="{DynamicResource …状态按钮文本键}" />
```

- 状态灯切换由控件内部驱动（VSM `StatusStates` 的 ON/OFF 两态），页面侧只负责 Content 与尺寸；
- 状态属性名/取值未确认前，不得在页面 XAML 中自行设置状态属性（见区块 8）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Button + Grid + Ellipse 拼装等效状态灯（常规 WPF 写法）

```xml
<Button>
    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="30"/><ColumnDefinition/>
        </Grid.ColumnDefinitions>
        <Ellipse Grid.Column="0" Width="20" Height="20">
            <Ellipse.Fill>
                <LinearGradientBrush>
                    <GradientStop Offset="0" Color="LightGray"/>
                    <GradientStop Offset="0.3" Color="#ed7a6d"/>
                    <GradientStop Offset="1" Color="Red"/>
                </LinearGradientBrush>
            </Ellipse.Fill>
        </Ellipse>
        <TextBlock Grid.Column="1" Text="…" FontWeight="Bold"/>
    </Grid>
    <Button.Triggers>
        <!-- 自行实现状态切换动画与 Hover/Pressed 画刷… -->
    </Button.Triggers>
</Button>
```

### ✅ 推荐：StatusButton 属性化（模板证据构造）

```xml
<s:StatusButton Content="{DynamicResource …文本键}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 VSM `StatusStates`（ON/OFF 两态 + 0.1s 渐变颜色动画）与 Hover/Pressed 触发器组（LightBlue/#1b3a6a/白字）；
2. **③ 无法样式族切换**：状态灯尺寸（20×20）、圆角（5）、渐变资源（LinearEllipseFill）全部散写，不能由 StatusButtonBaseStyle 一处调整；
3. **④ 绕过本地化**：手写 TextBlock 硬编码文案绕过 DynamicResource 文本键体系；
4. **⑤ 脱离视觉规范**：椭圆灯 stroke/fill 渐变、按下色 #1b3a6a、圆角 5 等视觉规范脱离框架控制，无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/StatusButton.xaml`（锚点 `x:Key="StatusButtonBaseStyle"`、`VisualStateGroup Name="StatusStates"`、`Trigger Property="IsMouseOver"`、`Trigger Property="IsPressed"`）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_StatusButton.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：状态属性名与 ON/OFF 取值、VSM 激活机制（GoToState 调用方）——仅模板两态定义可直接证明，属性面 .cs 不可见（已建议编号，见手册发布说明/TD 总表 `../../05-best-practices/pending-confirmations.md`）。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据，不涉及 TD-001/TD-002/TD-003。
