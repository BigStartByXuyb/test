# 样式选择规范

<!-- evidence=组装汇总(内容全部源自 02-controls 条目区块 4/5 与 00-guide/03-writing-paradigm,无新证据、无新 TD); pending=[TD-023,TD-029,TD-037,TD-046,TD-011,TD-026]; verified=2026-08-14; sources=[{source_root}/SDC/Style/IconButton.xaml, {source_root}/SDC/Style/SwitchKeypad.xaml, {source_root}/SDC/Style/NumericKeypad.xaml, {source_root}/SDC/Style/DatePickerExtend.xaml, {source_root}/ManualView.xaml] -->

> 本篇为**组装层**文档：汇总 [02-controls/README](../02-controls/README.md) 与各控件条目「样式族表」（区块 4）和「框架写法示例」（区块 5）的选型结论，不产生新证据。写法总则见 [00-guide/03-writing-paradigm](../00-guide/03-writing-paradigm.md)。

## 1. 选择流程（三步）

### 第 1 步：定位控件 → 条目 → 样式族表「适用场景」列

1. 从 [02-controls/README](../02-controls/README.md) 分类表正向定位控件与样式文件（反向：文件→控件映射表）；
2. 进入对应条目，读**区块 4 样式族表**；
3. 按「适用场景」列匹配当前业务 → 得到目标样式键。

以 IconButton 为例（[icon-button](../02-controls/navigation/icon-button.md) 区块 4）：

| 业务场景 | 选中键 | 适用场景列原文 |
|---|---|---|
| 页面主功能按钮 | `MainButtonStyle`（页面级 BasedOn 统一） | ManualView 主功能按钮（页面级 BasedOn） |
| 底部小按钮 / 底部操作区 | `BottomButtonSmallStyle` / `BottomButtonStyle` | 底部小按钮 / 底部操作区 |
| 灰底、右贴边 | `GrayIconButtonStyle` | 灰底/右贴边变体 |
| 右侧退出/返回 | `RightButtonStyle` | 右侧退出/返回按钮（ManualView 退出按钮） |
| 图标上 + 文字下 | `UpDownRightButtonStyle` | 上下排列按钮 |
| 普通右贴边 | `NormalRightButtonStyle` | 普通右贴边按钮 |
| 内嵌纯图标小按钮 | `ButtonIconStyle`（30×30，`IconColor` 着色） | 内嵌图标按钮 |
| 基样式 | `IconButtonBaseStyle`——**不直接用** | 基类，不直接用 |

### 第 2 步：页面级统一样式（BasedOn）

同页面大量同型控件时，用 `UserControl.Resources` 统一（ManualView.xaml 原文，icon-button 区块 5「页面级统一样式（推荐）」）：

```xml
<UserControl.Resources>
    <Style TargetType="{x:Type s:IconButton}" BasedOn="{StaticResource MainButtonStyle}"/>
</UserControl.Resources>
```

效果：页内所有 IconButton 默认即主按钮样式。

### 第 3 步：个别变体显式覆盖

个别按钮用具名样式键覆盖（icon-button 区块 5「返回/退出按钮变体」原文）：

```xml
<s:IconButton Style="{StaticResource RightButtonStyle}"
              IconText="{DynamicResource ManualOperationEXIT}"
              Icon="{StaticResource EXITGeometry}"
              PageName="Jump:Home" IOEnable="true"
              Background="{StaticResource ExitBackground}"/>
```

### 判断依据

- 样式族表「关键特征」列描述模板/尺寸/画刷差异——变体选择只看**形态语义（适用场景列）**，不按属性值手配；
- 样式链基类统一走 `BaseStyle`（公共基样式：焦点视觉/默认文字色/默认字号，README 反向表）——页面不直接 BasedOn BaseStyle，而是 BasedOn 目标控件的具名基样式（如 `IconButtonBaseStyle`）。

## 2. 样式族阅读要点

- **隐式默认样式（无 x:Key）与具名样式键并存**：未显式指定 Style 时走隐式默认（全局兜底），显式 `Style="{StaticResource …}"` 走具名键（icon-button 区块 4 末行「（无键默认样式）… 全局兜底」）；
- 同一样式族内同名键跨文件存在时，必须「文件+键」双定位（见区块 3）；
- 状态画刷族（`{控件前缀}_{状态}_{用途}`）由模板 Trigger 代管，页面不直接引用（[brushes](../01-resources/brushes.md) 区块 2/3）。

## 3. 键名双定义 / 遮蔽风险：同名键必须「文件+键」双定位

通用规避规则（源自 [switch-keypad](../02-controls/keypad-input/switch-keypad.md) 区块 8 的 TD-029 原文「凡引用该键必须写『文件+键』双定位」）：

> 引用任何 x:Key 前，先确认该键是否在多文件重复定义；若重复，引用处注释/文档一律写「文件+键」，不得只写键名。

已登记案例表：

| 键名 | 双定义位置 | 风险 | TD |
|---|---|---|---|
| `KeyButtonStyle` | SwitchKeypad.xaml:15（本地重定义）vs NumericKeypad.xaml:13（合并项） | 本地定义覆盖合并项；内容当前逐属性一致，**单方修改即分叉** | TD-029 |
| `keyrow` | BigNumericKeypad.xaml:72 vs BigStringKeypad.xaml:72 | 两处内容逐属性比对一致，单方修改即分叉 | TD-029 |
| `WindowBaseButton` | CommonWindow.xaml（Button 版）vs CornerRadiusWindow.xaml（IconButton 版） | 同名不同 TargetType，合并顺序决定生效方 | TD-011 |
| `ProgressBoxFillBrush` | Brushes.xaml vs Progress.xaml | 双定义，取值随合并顺序漂移 | TD-026 |
| `LoginPasswordBox` / `LoginPasswordBoxStyle` | PasswordBox.xaml vs FrameworkGeneric.xaml | 双定义合并语义待确认 | TD-038 |
| `ContentGroupBoxStyle`、IORangeProgressBar 隐式样式 | IOGroupBox.xaml vs GroupBox.xaml；IORangeProgressBar.xaml vs IOProgressBar.xaml | 双文件定义 | TD-026 |
| `DateTimePickerBaseStyle` | DatePickerExtend.xaml——**键名与 DateTimePicker 控件同名，TargetType 却是 DatePickerExtend** | 键名误导 + 可能被 DateTimePicker.xaml 合并顺序遮蔽（关联 TD-008） | TD-046 |

查证方法：grep 源文件，或 `{index_root}/files/*.json` 的 `resource_references` 交叉核对键的存在性与文件归属（「查不靠记」，见 [resource-usage](resource-usage.md) 区块 4）。

## 4. 同构族选择（视觉同构、语义不同）

### 4.1 IO 版 vs 原生版（TD-023）

五对模板**逐行同构、仅 TargetType 不同**（[io-check-box](../02-controls/io/io-check-box.md) 区块 2 等条目）：`IOCheckBox`/`CheckBox`、`IORadioButton`/`RadioButton`、`IOToggleButton`/`ToggleButton`、`IOButton`/`Button`、`IOGroupBox`/`GroupBox`（README「原生控件框架样式」批注，TD-023）。

选择规则：

- **设备条件 / 联锁语义**的控件选 IO 版（`s:IOCheckBox` 等）——IO 系列定位见 [device-condition-protocol](../03-protocols/device-condition-protocol.md)；
- 纯 UI 用途选原生版（`s:CheckBox` 等）；
- 注意：IO 模板 XAML 内**零 IOEnable 引用**（TD-022），协议挂载在 .cs 属性面；真实差异待 TD-023 回填，回填前按上述语义选型，两版模板修改同构。

### 4.2 StringNumberBox 三件套（TD-037）

`SwitchBox` / `SwitchPasswordBox` / `StringNumberBox` 模板**逐行同构**，差异仅宿主类型（TextBox / PasswordBox）与 `Background`（BackgroundLightBrush vs PrimaryDefaultBrush）、PART_TextBox Tag 绑定（[switch-box](../02-controls/keypad-input/switch-box.md) 区块 4「家族结构差异」；[string-number-box](../02-controls/keypad-input/string-number-box.md) 区块 2）。

选择规则（按语义）：

| 需求 | 控件 |
|---|---|
| 字符串参数录入（默认背景） | `s:StringNumberBox` |
| 紧凑型可切换输入（25×150） | `s:SwitchBox` |
| 密码输入 | `s:SwitchPasswordBox` |

- 共享键 `InputTextBoxBase` / `UpdownButtonStyle` **定义于 NumberBox.xaml**，三件套经 MergedDictionaries 引用——引用/修改时注意定义文件；
- 「Switch」语义与 .cs 差异待 TD-037 回填，回填前按模板差异选型。

## 5. 写法对照

### ❌ 禁止：散写属性拼视觉 + 页面手写状态触发器

```xml
<Button Width="160" Height="150" FontSize="16" Background="#1f2e54">
    <Button.Style>
        <Style TargetType="Button">
            <Style.Triggers>
                <Trigger Property="IsMouseOver" Value="True">
                    <Setter Property="Background" Value="{StaticResource DefaultButton_HoverBackBrush}"/>
                </Trigger>
            </Style.Triggers>
        </Style>
    </Button.Style>
</Button>
```

### ✅ 推荐：样式族一键切换

```xml
<s:IconButton Style="{StaticResource MainButtonStyle}" …/>
```

禁止原因（对照写法总则 2/3 与 [icon-button](../02-controls/navigation/icon-button.md) 区块 6）：① 样式族内含全套状态触发器（Hover/Pressed/Selected/Disabled）与 Disabled 透明度 0.56，手写无法复现且新增状态不可传导；② 不能一键 MainButtonStyle→RightButtonStyle 换形态（③ 无法样式族切换）；③ 页面直接引用状态画刷绕过状态机、键更名即全页面断裂（brushes.md 区块 3）；④ 尺寸/圆角/焦点策略（Focusable=False）脱离 Token 与样式链（⑤ 脱离视觉规范）。

## 6. 关联待确认项（只引用既有 TD）

| TD | 内容 | 本篇影响 |
|---|---|---|
| TD-023 | IO 与原生五对模板同构的真实差异（.cs 行为面） | 区块 4.1 选型边界 |
| TD-029 | KeyButtonStyle / keyrow 同名双定义生效语义（关联 TD-008） | 区块 3 核心案例 |
| TD-037 | SwitchBox/SwitchPasswordBox 三件套「Switch」语义 | 区块 4.2 选型边界 |
| TD-046 | DateTimePickerBaseStyle 键名遮蔽风险 | 区块 3 案例 |
| TD-011 | WindowBaseButton 键冲突合并顺序生效语义 | 区块 3 案例 |
| TD-026 | 零引用/双定义键清单（ProgressBoxFillBrush 等） | 区块 3 案例 |
