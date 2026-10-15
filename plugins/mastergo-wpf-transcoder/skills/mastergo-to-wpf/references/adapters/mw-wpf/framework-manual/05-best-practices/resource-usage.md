# 资源使用规范

<!-- evidence=组装汇总(内容全部源自 01-resources 五篇与 00-guide/02-evidence-policy,无新证据、无新 TD); pending=[TD-004,TD-007,TD-008,TD-009]; verified=2026-08-14; sources=[{source_root}/SDC/Colors.xaml, {source_root}/SDC/Brushes.xaml, {source_root}/SDC/Sizes.xaml, {source_root}/SDC/Geometries.xaml, {source_root}/SDC/FrameworkGeneric.xaml, {source_root}/ManualView.xaml] -->

> 本篇为**组装层**文档：汇总 [01-resources/README](../01-resources/README.md) 及五篇资源文档（[brushes](../01-resources/brushes.md) / [colors-fonts-sizes](../01-resources/colors-fonts-sizes.md) / [geometries-icons](../01-resources/geometries-icons.md) / [resource-loading](../01-resources/resource-loading.md) / [effects-converters](../01-resources/effects-converters.md)）的使用面结论，不产生新证据。证据等级与令牌引用规范见 [00-guide/02-evidence-policy](../00-guide/02-evidence-policy.md)。

## 1. 唯一事实源原则

SDC 资源层是框架的**唯一视觉事实源**：颜色/字体/尺寸/画刷/图标全部以资源键引用，页面代码禁止散写颜色值、字号、几何路径（01-resources/README 区块 1；写法总则 2/4/5）。资源职责分布：

| 文件 | 职责 |
|---|---|
| `Colors.xaml` | 语义颜色 Token（30 Color）+ 4 状态画刷（Start/Stop/Enter/Exit） |
| `Fonts.xaml` / `Sizes.xaml` | 字号 / 尺寸 Token |
| `Brushes.xaml` + `Brushes/`（12 文件） | 通用画刷 / 控件状态画刷 |
| `Geometries.xaml` + `IconGeometry.xaml` | 图标 Geometry 资源库（826 键） |
| `Style/`（72 文件） | 控件样式与 ControlTemplate（389 样式键） |

## 2. StaticResource vs DynamicResource 选择规则

选用规则表（归纳自 [resource-loading](../01-resources/resource-loading.md) 区块 3「已确认」）：

| 引用对象 | 用 | 证据 |
|---|---|---|
| 样式键 | `StaticResource` | `Style="{StaticResource MainButtonStyle}"`（ManualView.xaml） |
| 图标 Geometry | `StaticResource` | `Icon="{StaticResource ManualOperationF1Geometry}"` |
| 画刷 | `StaticResource` | `Background="{StaticResource ExitBackground}"`；`Fill="{StaticResource BorderBrush}"` |
| 本地化文本键 | `DynamicResource` | `Content="{DynamicResource ManualOperationLoad}"`——运行时语言切换 |
| 模板内资源 | `DynamicResource` | `Data="{DynamicResource ExitGeometry}"`（FrameworkGeneric.xaml 的 ExitButtonStyle） |

经验规则：**样式/图标/画刷用 StaticResource（加载期解析、性能）；文本用 DynamicResource（支持运行时换语言）**。

### 2.1 键存在性差异（选择时的后果）

- `StaticResource` **加载期解析**：键不存在 → XamlParseException（P3 Demo 以 `dotnet build` 0 错误验证键存在性，证据政策第 1 节 P3）；
- `DynamicResource` **运行时查找**：键缺失通常静默降级——页面文本键必须确保宿主语言资源字典已定义该键（键定义位置待确认，见区块 6 的 TD-004）。

### 2.2 主题切换的边界

- 内层链：`Brushes.xaml` 所有画刷的 `Color` 均以 `{DynamicResource XXXColor}` 引用 `Colors.xaml` 语义色，实现「换色不改刷」（brushes.md 区块 1）；
- 画刷带 `o:Freeze="True"`：冻结行为与主题切换影响待运行时验证（TD-007）；
- 页面引用层固定 `StaticResource`：样式族/画刷/几何不随皮肤更换而变，换肤发生在资源字典内部（Colors→Brushes 链），页面无需 DynamicResource 兜底。

### 2.3 写法对照

❌ 禁止：文本键用 StaticResource（或直接硬编码文案）

```xml
<Button Content="{StaticResource ManualOperationLoad}"/>
<Button Content="装片到切割台"/>
```

✅ 推荐：文本键一律 DynamicResource

```xml
<s:IconButton Content="{DynamicResource ManualOperationLoad}" …/>
```

禁止原因（依据 [localization-text](../03-protocols/localization-text.md) 区块 1/3）：① StaticResource 加载期取值，运行时语言切换不生效；② 硬编码文案绕过文本键体系（写法总则 4），ManualView 中零硬编码中文是先例；③ 全页面已按 DynamicResource 执行，混用破坏一致性。

## 3. 路径令牌约定

手册/脚本引用资源文件一律用路径令牌，**不写死盘符**（证据政策区块 4，由 `{framework_root}/framework.config.json` 动态解析）：

| 令牌 | 含义 | 用途 |
|---|---|---|
| `{framework_root}` | 含 framework.config.json 的目录 | 动态入口（脚本自发现） |
| `{source_root}` | 框架源码目录（refence，SDC 所在） | 证据引用主体 |
| `{index_root}` | ai-index 目录 | 索引交叉核对 |
| `{demo_root}` | 可编译 Demo（P3 证据） | 键存在性 / XamlParseException 验证 |

- **锚点引用（证据主体）**：`x:Key="MainButtonStyle"`、资源键名——稳定，源码变动不影响有效性；
- **文件+行号引用（仅提示）**：`{source_root}/SDC/Sizes.xaml:41-42`——行号可漂移、不参与硬校验；
- 校验：`python tools/check-manual-paths.py` 检查全部令牌引用是否存在；换机器只改配置，手册内容不动。

## 4. 命名模式与查键方法（查不靠记）

手册不维护穷举键清单（必然随源码过时，证据政策区块 4「查，不靠记」）；按命名模式找族、按查键方法取键。

### 4.1 命名模式（各资源文档「已确认」）

| 资源 | 命名模式 | 例 |
|---|---|---|
| 颜色（Colors.xaml） | 语义色系键 `{色系}Color` | `PrimaryColor` / `PrimaryDeepColor` / `TextColor` |
| 通用画刷（Brushes.xaml） | 颜色键名 + `Brush` 后缀；渐变按用途组 | `PrimaryBrush`（←`PrimaryColor`）；`ButtonGradientBrush` |
| 状态画刷（Brushes/ 12 文件） | 三段式 `{控件前缀}_{状态}_{用途}` | `DefaultButton_HoverBorderBrush`；`IconButton_DefaultBackBrush` |
| 几何（Geometries.xaml / IconGeometry.xaml） | `{业务}{用途}Geometry`（826 键） | `ManualOperationF1Geometry` / `EXITGeometry` |
| 尺寸（Sizes.xaml） | 按控件前缀分组 | `Button_IconButtonWidth`；`MaxwellFramework_HeaderHeight` |
| 字体（Fonts.xaml） | `{用途}FontSize` | `SubHeaderFontSize` / `HeadFontSize` |

注意大小写并存实例：`EXITGeometry`（ManualView.xaml）与 `ExitGeometry`（FrameworkGeneric.xaml）——引用时以目标文件实际键为准（geometries-icons 区块 2）。

### 4.2 查键方法（不靠记忆）

1. **grep 源文件**：如 `grep -n 'x:Key=' {source_root}/SDC/Sizes.xaml`（或按命名模式过滤）；
2. **查 ai-index**：`{index_root}/files/*.json` 的 `resource_references` 字段——键存在性交叉核对（如 `refence_SDC_Sizes.xaml.json`）；
3. 新增图标/资源后同步刷新索引（`tools/generate-ai-index.py`，geometries-icons 区块 4「新增图标」）；
4. ⚠️ ai-index 是**导航层（P4）**：JSON 只用来定位/核对存在性，**不得作为事实引用**（证据政策第 5 节）。

### 4.3 写法对照

❌ 禁止：凭记忆写键，键不存在 → 加载期崩溃

```xml
<!-- 手写 "MyCustomGeometry"（无此键）→ StaticResource 加载期 XamlParseException -->
<ContentControl Content="{StaticResource MyCustomGeometry}"/>
```

✅ 推荐：先查后写

```xml
<!-- grep 源文件或 ai-index resource_references 确认 x:Key 存在后再引用 -->
<s:IconButton Icon="{StaticResource ManualOperationF1Geometry}" …/>
```

禁止原因：① 键清单随源码变动，手册不维护（「查不靠记」）；② StaticResource 键缺失是加载期崩溃，代价高于查一次；③ 同义键大小写并存（EXIT/Exit）、同名键多文件定义（见 [style-selection](style-selection.md) 区块 3），记忆不可靠。

## 5. 页面资源边界

- 页面级 `UserControl.Resources` 只允许两类：**目标类型默认样式** / **基于样式族的 `BasedOn` 局部统一样式**（ManualView.xaml 示范，resource-loading 区块 4）——不允许造新视觉；
- **禁止**在页面摊平公共资源（重复 Color/画刷/样式/阴影/转换器）——公共资源只能存在于 SDC（resource-loading 区块 4、effects-converters 区块 4 三要素对照）；
- 状态画刷**不直接引用**（brushes.md 区块 2/3）：由样式族 ControlTemplate.Triggers 代管；页面直接引用会绕过状态机、键更名即全页面断裂。

## 6. 关联待确认项（只引用既有 TD）

| TD | 内容 | 本篇影响 |
|---|---|---|
| TD-004 | 文本键（ManualOperationLoad 等）定义位置与语言切换机制 | 文本键用 DynamicResource 为已确认形式；键定义位置待回填 |
| TD-007 | Brushes.xaml `o:Freeze="True"` 冻结行为与主题切换影响 | 换肤链（Colors→Brushes）的运行时行为 |
| TD-008 | 宿主完整资源字典合并顺序（refence 本体无 App.xaml） | 多定义键的生效方（关联区块 4 查键） |
| TD-009 | `KeyInputEnabled`（Fonts.xaml）用途 | 字体 Token 表的遗留键 |
