<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-006];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/Expander.xaml, {source_root}/ManualView.xaml] -->

# Expander（折叠面板，框架版）

## 1. 用途

折叠/展开面板：头部标题栏（ToggleButton，粗体 14，右侧 10×10 三角箭头，高 30）+ 内容区（圆角下边框）。支持四方向 `ExpandDirection`（Down/Up/Right/Left，右侧与左侧经 RotateTransform 布局变换实现）。典型场景（推断，无 P2 实例）：参数分组、高级设置折叠区——ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<Expander … />（标准 WPF Expander；隐式默认样式自动应用）
```

样式 TargetType = `{x:Type Expander}`；头部复用两个 `ToggleButton` 样式（`ExpanderDownHeaderStyle`/`ExpanderUpHeaderStyle`）。依赖框架附加属性：`controls:TitleElement.TitleHeight`、`controls:BorderElement.CornerRadius`（MaxwellControl.Controls，.cs 不可见）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Header | object | 头部内容（粗体，RecognizesAccessKey） | 模板 `PART_Button Content="{TemplateBinding Header}"` | ✅ |
| HeaderTemplate / HeaderTemplateSelector | DataTemplate / 选择器 | 头部内容模板透传 | 模板 `ContentTemplate/ContentTemplateSelector TemplateBinding` | ✅ |
| IsExpanded | bool | 展开态；与 PART_Button.IsChecked 双向绑定 | `IsChecked="{Binding IsExpanded, Mode=TwoWay, …TemplatedParent}"` + `Trigger Property="IsExpanded"` | ✅ |
| ExpandDirection | enum | Down（默认）/Up/Right/Left；Up 换头部样式并翻转换位；Left/Right 用 RotateTransform 旋转整体布局 | `Trigger Property="ExpandDirection"`（Up/Right/Left） | ✅ |
| Padding | Thickness | 内容区边距（模板 Margin=TemplateBinding） | 模板 `PART_Content Margin="{TemplateBinding Padding}"` | ✅ |
| Content | object | 内容；为 Null 时头部整圆角 | `Trigger Property="Content" Value="{x:Null}"` | ✅ |
| controls:TitleElement.TitleHeight | double | 头部高度；默认 ExpanderHeight=30（Sizes.xaml） | 默认样式 Setter + 模板 `Height="{TemplateBinding controls:TitleElement.TitleHeight}"` | ✅（附加属性语义见 TD-006） |
| controls:BorderElement.CornerRadius | CornerRadius | 头部/内容区圆角联动：展开 3 3 0 0 / 0 0 3 3，折叠整圆角 3；Up 方向翻转 | 默认样式 Setter + `ControlTemplate.Triggers`（含 `MultiTrigger` ExpandDirection=Up & IsExpanded=False） | ✅ |
| FontSize | double | 头部/内容模板内固定 14 | 模板 `PART_Button FontSize="14"`、`PART_Content TextElement.FontSize="14"` | ✅ |

## 4. 样式族表（SDC\Style\Expander.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| ExpanderDownHeaderStyle | 无（独立，ToggleButton） | 头部按钮：ButtonGradientBrush 底、右列 50 宽箭头位、DownTriangleGeometry；IsChecked→UpTriangleGeometry；Hover 边框 PrimaryToolBrush；圆角 3（BorderElement.CornerRadius） | 默认（向下展开）头部 |
| ExpanderUpHeaderStyle | 无（独立，ToggleButton） | 同构模板：UpTriangleGeometry 默认、IsChecked→DownTriangleGeometry、Hover 边框 PrimaryBrush | 向上展开头部（ExpandDirection=Up 时自动替换） |
| （隐式默认 Expander 样式） | 无（独立模板） | PART_Button + PART_ContentBorder 两行结构；四方向触发器（Up 换样式/Left/Right 旋转）；Content=Null 与折叠态圆角联动 | 未显式指定 Style 时 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `<Expander>`。

```xml
<Expander Header="{DynamicResource …标题文本键}" IsExpanded="False">
    <StackPanel>
        <!-- 参数组内容 -->
    </StackPanel>
</Expander>
```

- Header 文本走 DynamicResource 键（总则 4）；展开态、圆角联动、箭头方向均由模板触发器处理，页面零散写。

## 6. 禁止写法对照

### ❌ 禁止：手写 ToggleButton + Border + Visibility 绑定拼折叠区（常规 WPF 写法）

```xml
<ToggleButton x:Name="MyTg" IsChecked="False">
    <ToggleButton.Template>
        <ControlTemplate>
            <!-- 手写箭头、手写 Hover 边框… -->
        </ControlTemplate>
    </ToggleButton.Template>
</ToggleButton>
<Border Visibility="{Binding IsChecked, ElementName=MyTg, Converter={StaticResource BoolToVis}}">
    <!-- 内容 -->
</Border>
```

### ✅ 推荐：Expander 标准属性（模板证据构造）

```xml
<Expander Header="{DynamicResource …标题文本键}" IsExpanded="False">
    <StackPanel><!-- 内容 --></StackPanel>
</Expander>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 Hover 边框换色（PrimaryToolBrush/PrimaryBrush）、箭头 DownTriangle↔UpTriangle 切换触发器（ExpanderDownHeaderStyle/UpHeaderStyle ControlTemplate.Triggers）；
2. **③ 无法样式族切换**：Up/Left/Right 四方向换向（PART_GridRoot/PART_Content 的 RotateTransform 布局变换与圆角翻转）需手写全套；框架 `ExpandDirection` 触发器一键切换；
3. **⑤ 脱离视觉规范**：头部高度（ExpanderHeight=30）、圆角联动（展开 3 3 0 0/0 0 3 3、折叠 3）、右列 50 宽箭头位全部失控；
4. **④ 绕过本地化**：手写硬编码标题文案绕过 DynamicResource 文本键体系。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Expander.xaml`（锚点：隐式默认样式、`x:Key="ExpanderDownHeaderStyle"`、`x:Key="ExpanderUpHeaderStyle"`、`Trigger Property="IsExpanded"`、`Trigger Property="ExpandDirection"`、`Trigger Property="Content"`）
- 资源：`{source_root}/SDC/Geometries.xaml`（`DownTriangleGeometry`/`UpTriangleGeometry`）；`{source_root}/SDC/Sizes.xaml` `ExpanderHeight=30`
- 真实使用：无（ManualView.xaml 不含 Expander）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Expander.xaml.json`

## 8. 待确认项

- 关联 TD-006：`controls:TitleElement.TitleHeight` 与 `controls:BorderElement.CornerRadius` 附加属性的参数类型与运行时行为（模板绑定证据可见，.cs 定义不可见）。
- 本控件模板中无 IOEnable / s:Action / PageName 协议证据。
