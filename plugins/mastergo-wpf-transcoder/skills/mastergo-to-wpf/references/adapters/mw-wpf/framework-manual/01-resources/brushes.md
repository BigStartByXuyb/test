# 画刷（Brushes.xaml + Brushes/）

<!-- evidence=已确认; verified=2026-08-13; sources=[{source_root}/SDC/Brushes.xaml, {source_root}/SDC/Brushes/*.xaml] -->

## 1. 通用画刷（Brushes.xaml ✅）

所有画刷 `Color` 均以 `{DynamicResource XXXColor}` 引用 Colors.xaml 的语义色，实现"换色不改刷"。

### 1.1 SolidColorBrush 家族（约 40 键，Brushes.xaml）

命名规律：**颜色键名 + Brush 后缀**（`PrimaryColor` → `PrimaryBrush`）。

| 家族 | 键 | 示例值来源 |
|---|---|---|
| 主色 | `PrimaryBrush` / `PrimaryDeepBrush` / `PrimaryToolBrush` / `PrimaryLightBrush` / `PrimaryLightToolBrush` / `PrimaryDefaultBrush` / `PrimaryDeepToolBrush` / `PrimaryControlToolBrush` | `PrimaryColor` 等 |
| 辅色 | `SecondaryBrush`（渐变，:17-20）/ `SecondaryDeepBrush` / `SecondaryLightBrush` | — |
| 背景 | `BackgroundBrush` / `BackgroundDeepBrush` / `BackgroundLightBrush` / `BackgroundLightToolBrush` | — |
| 第三色系 | `ThirdlyBrush` / `ThirdlyDeepBrush` / `ThirdlyLightBrush` / `ThirdlyLightToolBrush` | — |
| 悬停 | `HoverBrush` | `HoverColor` |
| 边框 | `PrimaryBorderBrush` / `BorderBrush` / `SecondaryBorderBrush` | `ManualView.xaml` 使用 `BorderBrush` ✅ |
| 文字 | `SpecialTextBrush` / `PrimaryTextBrush` / `TextBrush` / `SecondaryTextBrush` / `DisableTextBrush` / `MenuTextBrush` / `LightTextBrush` | — |
| 状态 | `WarningBrush` / `WarningToolBrush` / `NormalBrush` / `NormalToolBrush` | — |
| MessageBox | `MessageBoxSuccessBrush` / `MessageBoxDangerBrush` / `MessageBoxAccentBrush` / `MessageBoxWarningBrush`（#f39700 直接色值）/ `MessageBoxInfoBrush` | :51-55 |

### 1.2 GradientBrush 家族（约 30 键，Brushes.xaml）

| 用途组 | 键 | 说明 |
|---|---|---|
| 通用 | `PrimarySecondGradientBrush` / `MainMenuGradientBrush` / `BorderDefaultGradientBrush` / `TabSecondDefaultGradient` / `HeaderMenuGradientBrush` / `HeaderTextGradientBrush` | 顶栏/边框/主菜单 |
| 按钮 | `ButtonBorderGradientBrush` / `NextButtonGradientBrush` / `CalenderButtonGradientBrush` / `ButtonGradientBrush` / `ButtonPressGradientBrush` / `ButtonPressGradientBrushRevert` / `ButtonPressVerticalBrush` / `StatusButtonBrush` | 按钮边框/按下态 |
| 开关 | `ToggleButtonBorderGradientBrush` / `ToggleButtonBackgroundBrush` / `ToggleButtonThumbBrush` / `ToggleButtonCircleBrush` | ToggleButton 专用 |
| 晶格 | `LightCrystalGradientBrush` / `DarkCrystalGradientBrush` / `GreenCrystalGradientBrush` / `RedCrystalGradientBrush` | 晶格按钮家族；`FrameworkGeneric.xaml` ExitButtonStyle 用 `RedCrystalGradientBrush` ✅ |
| 主题 | `PrimaryGradientBrush` / `PrimaryLightGradientBrush` / `ThirdlyLightGradientBrush` / `ThirdlyDeepGradientBrush`（+Revert）/ `BackgroundDeepGradientBrush`（+Revert）/ `BackgroundLightGradientBrush` / `BackgroundLightDefaultGradientBrushRevert` | 渐变主题 |
| 状态 | `WarningGradientBrush` / `NormalGradientBrush` | 警告/正常渐变 |
| 滑条 | `SliderThumbBackgroundBrush` / `SliderThumbPathBrush` / `SliderThumbVertical*` / `SliderIncreaseBackgroundBrush` / `SliderIncreaseVerticalBrush` / `SliderSelectionBackgroundBrush` / `SliderSelectionVerticalBrush` | RangeSlider 专用 |
| 进度 | `ProgressBoxFillBrush` | 进度条填充 |
| 窗口 | `WindowTitleBrush` | 窗口标题 |

## 2. 控件状态画刷（Brushes/ 12 文件 ✅）

命名三段式：**`{控件前缀}_{状态}_{用途}`**。

| 段 | 取值 | 证据 |
|---|---|---|
| 控件前缀 | `DefaultButton_` / `ControlButton_` / `IconButton_` / `CheckBox_` / `ComboBox_` / `DataGrid_` / `GroupBox_` / `RadioButton_` / `ScrollViewer_` / `SideMenu_` / `StepFrame_` / `TabControl_` / `Tree_` / `Window_` | 12 文件对应 |
| 状态 | `Default` / `Hover` / `Select` / `UnSelect` / `Disabled` | ButtonBrushes.xaml |
| 用途 | `BackBrush` / `BorderBrush` / `TextBrush` / `IconBrush` | 同上 |

示例（ButtonBrushes.xaml）：`DefaultButton_DefaultBackBrush`、`DefaultButton_HoverBorderBrush`、`DefaultButton_SelectTextBrush`、`DefaultButton_DisabledBackBrush`；`ControlButton_DefaultIconBrush`；`IconButton_DefaultBackBrush`、`IconButton_DefaultBorderBrush`。

规则：控件样式引用**本控件的状态画刷族**，页面代码**不直接引用**状态画刷（由样式的 Trigger 代管）——直接引用会绕过状态机。

## 3. 写法对照

### ❌ 禁止：页面直接切换状态画刷
```xml
<Button x:Name="Btn">
    <Button.Style>…触发器手写 Background={StaticResource DefaultButton_HoverBackBrush}…</Button.Style>
</Button>
```

### ✅ 推荐：用样式族，状态画刷由模板 Trigger 自动切换
```xml
<s:IconButton Style="{StaticResource MainButtonStyle}" …/>
```
禁止原因：① 状态画刷族是给 ControlTemplate.Triggers 用的，页面手写触发器 = 手写状态机，与框架重复；② 绕过样式族后新增/调整状态（如 Hover→Select）不可传导；③ 页面代码引用状态画刷键后，键更名即全页面断裂。

## 4. 待确认项

- TD-007：全部画刷带 `o:Freeze="True"`（Brushes.xaml 起），冻结行为与主题切换影响待运行时验证。
