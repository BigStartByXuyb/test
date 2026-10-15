# 资源系统导航

<!-- evidence=已确认(键名清单为源码扫描); verified=2026-08-13; sources=[{source_root}/SDC/*.xaml, {source_root}/SDC/Brushes/*.xaml] -->

SDC 资源层是框架的**唯一视觉事实源**：颜色/字体/尺寸/画刷/图标全部以资源键引用，页面代码禁止散写颜色值、字号、几何路径。资源键清单由 `SDC` 顶层 10 文件 + `Brushes/` 12 文件 + `Style/` 72 文件构成（约 1655 资源键 + 389 样式键）。

## 资源文件职责表

| 文件 | 职责 | 键量级 | 章节 |
|---|---|---|---|
| `Colors.xaml` | 语义颜色 Token（30 个 Color）+ 4 个状态画刷（Start/Stop/Enter/Exit） | 34 | [colors-fonts-sizes](colors-fonts-sizes.md) |
| `Fonts.xaml` | 字体字号 Token（5 个 Double）+ KeyInputEnabled 开关 | 6 | [colors-fonts-sizes](colors-fonts-sizes.md) |
| `Sizes.xaml` | 尺寸 Token（MaxwellFramework_*/Button_*/ComboBox* 等约 90 键） | ~90 | [colors-fonts-sizes](colors-fonts-sizes.md) |
| `Brushes.xaml` | 通用画刷：SolidColorBrush 家族 + GradientBrush 家族（含 MessageBox 五色） | ~70 | [brushes](brushes.md) |
| `Brushes\`（12 文件） | 按控件分类的状态画刷（控件前缀_状态_用途） | — | [brushes](brushes.md) |
| `Geometries.xaml` + `IconGeometry.xaml` | 图标 Geometry 资源库 | 826 | [geometries-icons](geometries-icons.md) |
| `Converters.xaml` | 转换器资源（LineConverter） | 1 | [effects-converters](effects-converters.md) |
| `Effects.xaml` | 阴影效果（EffectShadow0） | 1 | [effects-converters](effects-converters.md) |
| `RightAlignment.xaml` | 右对齐枚举（TextHorizontalAlignment） | 1 | [effects-converters](effects-converters.md) |
| `FrameworkGeneric.xaml` | 框架级默认模板（ExitButtonStyle、UserComboBox 三件套、controls: 附加属性模板） | — | [resource-loading](resource-loading.md) |
| `Style\`（72 文件） | 控件样式/ControlTemplate（BaseStyle 为公共基样式） | 389 | 02-controls |

## 与 ai-index 的关系

- 对应索引：`{index_root}/files/` 下各资源文件的 JSON（如 `refence_SDC_Sizes.xaml.json`），`resource_references` 字段用于键存在性交叉核对。
- 对应能力入口：`capabilities/resource-system.json`。
- 语义笔记 `semantic/sdc-resource-and-style-system.md` 的分层结论已并入本目录各篇与 `00-guide/01-framework-architecture.md`。

## 新增组件步骤（源自 semantic/sdc-resource-and-style-system.md 建议 🟡 结构推断）

1. 在 `Colors.xaml` 定义语义颜色
2. 在 `Brushes.xaml` 定义通用画刷
3. 在 `Brushes/` 定义控件状态画刷
4. 在 `Fonts.xaml`、`Sizes.xaml` 定义共享 Token
5. 在 `Style/` 提供基础样式和派生样式
6. 在模板中绑定自研附加属性
7. 同时提供基础样式和业务场景变体
