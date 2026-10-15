# 01 框架架构

<!-- evidence=部分确认(资源分层链为归纳推断,单文件事实为源码确认); verified=2026-08-13;
     sources=[framework.config.json, {source_root}/SDC/**, {demo_root}/App.xaml, docs/ai-index/semantic/sdc-resource-and-style-system.md] -->

## 1. 框架组成

框架名：**MW 自研 WPF 框架**（定义于 `{framework_root}/framework.config.json`；框架源码位置 = 该配置的 `source_root`，由手册路径令牌动态解析，不写死盘符——见 `00-guide/02-evidence-policy.md` 第 4 节）。✅

| 部分 | 内容 | 可见性 |
|---|---|---|
| **MaxwellControl 私有程序集** | 87 个自定义控件类型的实现（Controls / Tools / Commands / Themes 命名空间） | ❌ .cs 本地不可见，仅 XAML 使用面可见 |
| **SDC 资源层** | 纯 XAML：资源 Token + 画刷 + 图标 Geometry + 72 个控件样式/模板 | ✅ 全部可见，本手册的证据主体 |

因此本手册只覆盖**使用面**：`SDC` 中的属性绑定证据 + `ManualView.xaml` 的真实调用。

## 2. SDC 资源分层链 🟡（结构推断，来源 semantic/sdc-resource-and-style-system.md）

```text
语义颜色 Colors.xaml
    ↓
通用画刷 Brushes.xaml
    ↓
控件状态画刷 Brushes/*.xaml（按"控件_状态_用途"命名）
    ↓
尺寸/字体 Token（Sizes.xaml / Fonts.xaml）
    ↓
基础样式 Style/BaseStyle.xaml
    ↓
控件样式与 ControlTemplate（Style/*.xaml，经 MergedDictionaries 引用 BaseStyle）
    ↓
业务变体（如 MainButtonStyle / RightButtonStyle）
```

单文件职责为源码确认，整体分层为归纳推断——新增组件按此顺序添加（见 `01-resources/README.md` 的"新增组件步骤"）。

## 3. refence 目录职责 ✅（源码确认）

| 路径 | 职责 | 规模 |
|---|---|---|
| `SDC\Colors.xaml` | 语义颜色 Token（Primary/Secondary/Background/Text/Warning 等，中文注释） | 53 行 |
| `SDC\Fonts.xaml` | 字体字号 Token（LargeFontSize=18…TextFontSize=12） | — |
| `SDC\Sizes.xaml` | 尺寸 Token（`Button_*`、`ComboBox*`、`SideMenu*`、`MaxwellFramework_*` 约 90 键） | 126 行 |
| `SDC\Brushes.xaml` | 通用 SolidColorBrush/渐变画刷（`xxxGradientBrush` 家族，`o:Freeze="True"` 待验证 TD-007） | 262 行 |
| `SDC\Brushes\` | 按控件分类的状态画刷 12 文件（Button/CheckBox/ComboBox/DataGrid/GroupBox/RadioButton/ScrollViewer/SideMenu/StepFrame/TabControl/Tree/Window） | 12 文件 |
| `SDC\Geometries.xaml` + `SDC\IconGeometry.xaml` | 图标 Geometry 资源库 | 826 键（588+238） |
| `SDC\FrameworkGeneric.xaml` | 框架级默认模板（ComboBox/PasswordBox 重模板、`controls:` 附加属性模板） | 567 行 |
| `SDC\Converters.xaml` / `Effects.xaml` / `RightAlignment.xaml` | 转换器/效果/右对齐小工具资源 | — |
| `SDC\Style\` | 72 个控件样式文件（BaseStyle.xaml 为公共基样式，各文件 MergedDictionaries 引用它） | 389 样式键 |
| `refence\ManualView.xaml` | 真实业务页（使用面权威证据） | — |

## 4. 宿主加载方式 🟡（P3 证据 + 待确认）

`{demo_root}/App.xaml`（可编译 Demo）按职责合并资源字典，注释明确"资源职责分离(对齐 refence/SDC 框架结构)"，顺序：

```text
Colors → Fonts → Sizes → Brushes → Icons → Style
```

注意：refence 本体**没有 App.xaml**（不是独立可编译工程，需嵌入宿主项目）；Demo 中的 `SDC/Icons.xaml`、`SDC/Style/MenuButtons.xaml` 为 Demo 本地文件，refence SDC 中不存在同名文件。完整宿主合并顺序与外部程序集来源 → **TD-008 待确认**。

## 5. 框架开发规则（framework.config.json development_rules）✅

1. 优先复用框架已有控件、样式和资源
2. 按照 refence 原目录职责组织代码
3. 先查框架索引，再读取原始源码
4. 不重新发明已有框架能力
5. 无法确认的私有 API 必须标记为待确认

第 1、4 条即本手册"写法对照"总则的制度来源；第 5 条即证据政策来源。
