<!-- evidence=已确认(模板为模板源码直接证据；模板极简，无触发器/无状态); pending=[待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOImage.xaml, {source_root}/ManualView.xaml] -->

# IOImage（图像容器）

## 1. 用途

框架版图像/内容容器：极简模板——Grid（背景可绑定）+ ContentPresenter。用于承载图像或任意内容并统一背景宿主。

典型场景（推断，无 P2 实例）：图标/图片显示位。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:IOImage … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOImage`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件仅含隐式默认样式（无 x:Key）。模板 ContentPresenter 证据表明继承自 ContentControl 族（基类确认待 .cs）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 容器背景（Grid 宿主）；无默认 Setter（用默认值或页面自设） | 模板 `Grid Background="{TemplateBinding Background}"` | ✅ |
| Content | object | 承载内容（Image/任意元素），经 ContentPresenter 呈现 | 模板 `ContentPresenter` | ✅ |
| （无触发器/无 VSM） | — | 模板无任何 Trigger/VisualState，无交互态 | ControlTemplate 全文 | ✅ |
| （无 IOEnable 证据） | — | 模板中无 IOEnable / 协议挂点；设备联锁协议见 TD-001 | 模板全文 + `{source_root}/ManualView.xaml`（IOEnable 仅出现于 IconButton） | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\IOImage.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| （隐式默认样式） | 无（独立） | 无 x:Key、无 Setter——仅 Template（Grid 背景 + ContentPresenter），零配置 | 未显式指定 Style 时全局生效 |

无样式族、无模板资源键。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 FrameworkGeneric.xaml 均未出现 `s:IOImage`。

```xml
<s:IOImage Background="{DynamicResource …画刷键}">
    <Image Source="…"/>
</s:IOImage>
```

- 内容与原生 Image 相同（继承 ContentControl 族推断），页面侧只多一层背景宿主；
- 图标类内容仍按 `00-guide/03-writing-paradigm.md` 总则 5 走 Geometry 键 + IconButton/IconControl 族（见 `../navigation/icon-button.md`），本控件适用于位图/自定义内容的承载位。

## 6. 禁止写法对照

### ❌ 禁止：手写 ContentControl + 背景容器（常规 WPF 写法）

```xml
<ContentControl Background="{StaticResource …}">
    <Image Source="…"/>
</ContentControl>
<!-- 或：手写 Grid 包 Image 并散写背景 -->
```

### ✅ 推荐：IOImage（模板证据构造）

```xml
<s:IOImage Background="{DynamicResource …画刷键}">
    <Image Source="…"/>
</s:IOImage>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：手写 ContentControl/Grid 没有框架统一内容承载契约——背景宿主 + ContentPresenter 结构是框架约定，页面散写后无法在框架层统一调整；
2. **③ 无法样式族切换**：背景宿主结构（Grid 包 ContentPresenter）散写，框架改模板时页面不跟随；
3. **④ 绕过本地化**：位图来源/内容未走框架资源键体系时绕过统一资源管理（内容文本应走 DynamicResource 键）；
4. **⑤ 脱离视觉规范**：内容承载位的结构约定（单一模板结构）脱离框架控制，页面拼法五花八门。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOImage.xaml`（锚点：隐式 `Style TargetType="{x:Type controls:IOImage}"`、`ContentPresenter`、`Grid Background="{TemplateBinding Background}"`）
- 真实使用：无（ManualView.xaml / FrameworkGeneric.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOImage.xaml.json`

## 8. 待确认项

- [待确认 TD-xxx]：IOImage 基类与命名来源确认（模板 ContentPresenter 推断继承 ContentControl；控件为何命名为 Image——是否存在图像专用语义/属性 .cs 不可见）。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据；IOEnable 使用面仅见 IconButton（`{source_root}/ManualView.xaml`），「IO 系列核心协议 IOEnable」在 IOImage 无模板支持，待框架作者确认（见手册发布说明）。
