# 颜色 / 字体 / 尺寸 Token

<!-- evidence=已确认; verified=2026-08-13; sources=[{source_root}/SDC/Colors.xaml, {source_root}/SDC/Fonts.xaml, {source_root}/SDC/Sizes.xaml, {source_root}/ManualView.xaml] -->

## 1. 颜色 Token（Colors.xaml ✅）

语义色分系（`Colors.xaml`），中文注释说明用途：

| 色系 | 键 | 说明 |
|---|---|---|
| 主色 | `PrimaryDeepColor` #182445 / `PrimaryColor` #1f2e54 / `PrimaryLightColor` #1e4e8d / `PrimaryDefaultColor` #ffffff | 主深色/主中间色/主浅色/白色 |
| 主辅色 | `PrimaryToolColor` #448ec9 / `PrimaryDeepToolColor` #2561a9 / `PrimaryControlToolColor` #bbc2cc / `PrimaryLightToolColor` #3ca6ff | 主辅四档 |
| 辅色 | `SecondaryDeepColor` #5b81a0 / `SecondaryColor` #bbc2cc / `SecondaryLightColor` #729bbc | — |
| 背景 | `BackgroundDeepColor` #e1e1e1 / `BackgroundColor` #f0f3f6 / `BackgroundLightColor` #eaedf2 / `BackgroundLightToolColor` #1E90FF | — |
| 第三色系 | `ThirdlyDeepColor` / `ThirdlyColor` / `ThirdlyLightColor` #f4f5f6 / `ThirdlyLightToolColor` #e5e5ef | — |
| 悬停 | `HoverColor` #ccdfeb | — |
| 边框 | `PrimaryBorderColor` #b0b9c4 / `BorderColor` #b4b4b4 / `SecondaryBorderColor` #dae7ed | — |
| 文字 | `SpecialTextColor` #2561a9（重要文字）/ `PrimaryTextColor` #505050 / `TextColor` #5f5f5f / `SecondaryTextColor` #969696 / `DisableTextColor` #b4b4b4 / `MenuTextColor` #323232 | — |
| 状态 | `WarningColor` #b30c0d / `WarningToolColor` #f68484（警告）；`NormalColor` #128a3b / `NormalToolColor` #a4eaad（正常） | — |

状态画刷（`Colors.xaml` ✅，注意：这 4 个是 **Brush 不是 Color**）：

| 键 | 值 | 用途证据 |
|---|---|---|
| `StartBackground` | #42de23 绿 | 启动类状态 |
| `StopBackground` | #ff0301 红 | 停止类状态 |
| `EnterBackground` | #6734ff 紫 | 进入类状态 |
| `ExitBackground` | #ffad01 橙 | 退出类状态；`ManualView.xaml` 退出按钮 `Background="{StaticResource ExitBackground}"` ✅ |

## 2. 字体 Token（Fonts.xaml ✅）

| 键 | 值 | 说明 |
|---|---|---|
| `LargeFontSize` | 18 | 大字号（Fonts.xaml） |
| `HeadFontSize` | 16 | 标题字号 |
| `SubHeaderFontSize` | 14 | 副标题 |
| `TextFontSize` | 12 | 正文 |
| `HeaderMenuFontSize` | 22 | 顶栏菜单 |
| `KeyInputEnabled` | false（Boolean） | 用途待确认 [待确认 TD-009] |

## 3. 尺寸 Token（Sizes.xaml ✅，按前缀分组）

| 前缀 | 键示例 | 数值示例 | 用途 |
|---|---|---|---|
| `MaxwellFramework_*` | `MaxwellFramework_HeaderHeight` / `_StatusBarHeight` / `_StatusLightHeight` / `_SideMenuWidth` / `_SideMenuHeight` / `_BottomHeight` | 85 / 80 / 70 / 85 / 855 / 180 | 框架级布局 |
| `MaxwellFramework_*Margin` | `_MainMargin` `_PageMargin` `_CoverPageMargin` `_BottomMargin` | `5 0` / `15 0` / `15` / `0 0 15 0` | 框架级边距 |
| `Button_*` | `ButtonWidth` / `ButtonHeight` | 100 / 35 | 普通按钮 |
| `Button_IconButton*` | `Button_IconButtonWidth` / `_Height` | 140 / 75 | 图标按钮 |
| `Button_Icon*` | `Button_IconWidth` / `_Height` | 20 / 20 | 图标默认尺寸 |
| `ComboBox*` | `ComboBoxWidth` / `_Height` / `ComboBoxItemWidth` / `_Height` | 100 / 35 / 200 / 35 | 下拉框与选项 |
| `TextBox*` | `TextBoxWidth` / `_Height` | 100 / 35 | 文本框 |
| `DataGridItemHeight` | — | 45 | 表格行高 |
| `GroupBox*` | `GroupBoxBaseHeader` / `_SecondaryHeader` / `_ThirdlyHeader` | 40 / 35 / 25 | 分组框头 |
| `HeaderMenu*` | `HeaderMenuWidth` / `_Height` / `HeaderMenuIconWidth` / `_Height` | 100 / 70 / 23 / 23 | 顶栏菜单 |
| `ListBox*` | `ListBoxTitleHeight` 等 + `ListBoxItemHeight` | 35 / 45 | 列表 |
| `MessageBox*` | `MessageBoxHeaderHeight` / `_HeaderCloseButtonWidth` | 40 / 40 | 消息框 |
| `SideMenu*` | `SideMenuBoxWidth` / `_Height` / `SideMenuSecondaryWidth` / `_Height` | 400 / 780 / 150 / 50 | 侧边菜单 |
| `SearchBox*` | `SearchBoxWidth` / `_Height` / `SearchBoxIcon*` | 130 / 35 / 35 / 15 | 搜索框 |
| `StatusLight*` | `StatusLightWidth` / `_Height` | 13 / 13 | 状态灯 |
| `StatusButton*` | `StatusButtonWidth` / `_Height` | 102 / 35 | 状态按钮 |
| `TabControl*` | `TabControlHeaderHeight` / `_Width` / `TabControlSecondary*` / `_Thirdly*` | 40 / 100 / 35 / 110 / 25 | Tab 头 |
| `ToggleButton*` | `ToggleButtonWidth` / `_Height` / `_Square*` / `_Circular*` | 55 / 25 / 25 / 15 | 开关按钮（:104-110 为注释掉的旧值） |
| `ScrollView*` | `ScrollViewWidth` / `_Height` | 10 / 10 | 滚动条 |
| `CheckBox*` | `CheckBoxWidth` / `_Height` | 18 / 18 | 勾选框 |
| `TreeItemHeight` | — | 45 | 树项行高 |

## 4. 写法对照

### ❌ 禁止：散写字面量
```xml
<Button Width="140" Height="75" FontSize="16" Background="#1f2e54"/>
```

### ✅ 推荐：引用 Token + 样式族
```xml
<s:IconButton Style="{StaticResource MainButtonStyle}" …/>
```
禁止原因：① 颜色/尺寸 Token 是主题唯一事实源，散写字面量后主题切换与视觉统一失效；② 控件尺寸有专用 Token（`Button_IconButtonWidth` 140/75），散写绕过 Token 体系；③ 样式族内含全套状态触发器，散写属性无法复现（对照 00-guide/03-writing-paradigm.md 五类依据 ②⑤）。

## 5. 待确认项

- TD-009：`KeyInputEnabled`（Fonts.xaml，Boolean false）的用途与影响范围。
