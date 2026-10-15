<!-- evidence=已确认(属性/TemplateBinding 均为模板源码直接证据；无 P2 页面使用实例); pending=[待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IconControl.xaml, {source_root}/ManualView.xaml] -->

# IconControl（图标控件）

## 1. 用途

纯图标（Geometry）显示元素：模板即一个 `Path`（Stretch=Fill），按 `Icon`/`IconWidth`/`IconHeight` 呈现图标。典型场景（推断，无 P2 实例）：页面内嵌小图标、只读图标标记——ManualView.xaml 未使用本控件（其图标由 IconButton 的 `Icon` 属性承载）。

## 2. 声明

```xml
<s:IconControl … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IconControl`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件仅含一个隐式默认样式（无 `x:Key`）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Icon | Geometry | 图标几何（Path.Data） | 隐式默认样式模板 `Path Data="{TemplateBinding Icon}"` | ✅ |
| IconWidth | double | 图标宽 | 模板 `Width="{TemplateBinding IconWidth}"` | ✅ |
| IconHeight | double | 图标高 | 模板 `Height="{TemplateBinding IconHeight}"` | ✅ |
| Fill（模板硬编码） | Brush | 模板固定 `Fill="Black"`，无 Foreground/TemplateBinding——着色机制 .cs 不可见 | 模板 `Path … Fill="Black"` | 🟡 [待确认 TD-xxx] |

## 4. 样式族表（SDC\Style\IconControl.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （隐式默认样式） | 无（独立，TargetType 隐式） | Grid+Path 模板：`Stretch="Fill"`、Fill 硬编码 Black、尺寸取自 IconWidth/IconHeight | 未显式指定 Style 时全局生效；无变体 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `s:IconControl`。

```xml
<s:IconControl Icon="{StaticResource ManualOperationF1Geometry}"
               IconWidth="20" IconHeight="20" />
```

- 图标必须引用 Geometry 资源键（826 键图标库，见 01-resources/geometries-icons.md），禁止手写 Path Data（总则 5）；
- 与 IconButton 的 `Icon` 属性（IconButton.xaml PathMain，模板同样 TemplateBinding 自 Icon/IconWidth/IconHeight）同构——IconControl 是无交互的纯显示元素。

## 6. 禁止写法对照

### ❌ 禁止：手写 Path 散落拼图标（常规 WPF 写法）

```xml
<Path Data="M…（手写几何）…" Fill="Black" Stretch="Fill" Width="20" Height="20"/>
```

### ✅ 推荐：IconControl 引用 Geometry 键

```xml
<s:IconControl Icon="{StaticResource ManualOperationF1Geometry}" IconWidth="20" IconHeight="20"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **⑤ 脱离视觉规范**：手写 `Path.Data` 绕过 826 键 Geometry 图标库，图标无法统一替换与维护（总则 5）；
2. **③ 无法样式族切换**：散写 Path 的尺寸/Stretch 不可由样式统一控制，改 IconControl 的 IconWidth/IconHeight 一处生效；
3. **① 丢失状态/行为面**：各页面散写 Path 时 `Stretch="Fill"` 等比例填充行为无法保证一致，图标缩放呈现失控；
4. **④/② 不适用说明**：本控件无文本与协议面，等效反例即手写 Path——IconControl 本身就是 Path 的框架封装（P1 模板证据），常规 WPF 对应物即裸 Path。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IconControl.xaml`（锚点：隐式默认样式 `TargetType controls:IconControl`、模板 `Path Data/Height/Width TemplateBinding`）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IconControl.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：IconControl 的着色机制——模板 Fill 硬编码 `Black`、无 Foreground/TemplateBinding，是否存在着色属性或着色约定（.cs 不可见）（已建议编号，见 `../../05-best-practices/pending-confirmations.md`）。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据。
