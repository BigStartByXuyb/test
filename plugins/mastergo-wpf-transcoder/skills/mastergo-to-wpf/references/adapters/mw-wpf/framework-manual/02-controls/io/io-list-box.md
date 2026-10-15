<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-001,TD-006];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOListBox.xaml, {source_root}/ManualView.xaml] -->

# IOListBox（IO 列表）

## 1. 用途

原生 ListBox 的框架封装：**行高 45（`ListBoxItemHeight`）+ 单项底边分隔线的列表**，内建行 Hover/Selected（加粗 + 深色底 + 白字）/Disabled（0.4）三态触发器；`AlternationCount=2` 预留隔行底色（AlternationIndex 触发器被注释，见区块 8）。文件附带三个业务 DataTemplate（`RecipeFolderListTemplate`/`RecipeListTemplate`/`MeasureSizeTemplate`）。

典型场景（推断，无 P2 实例）：配方/列表选择类清单——ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:IOListBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOListBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。项容器为**原生 ListBoxItem**（`ItemContainerStyle = IOListBoxItemBaseStyle`）。注意与原生框架版区分：`SDC/Style/ListBox.xaml` 为非 IO 版（`ListBoxBaseStyle` 及 `HeaderedListBox*` 家族）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| ItemContainerStyle | Style | 行项样式（`IOListBoxItemBaseStyle`），基样式已绑定，页面一般不覆盖 | `x:Key="IOListBoxBaseStyle"` Setter | ✅ |
| AlternationCount | int | 基样式 2；对应 AlternationIndex 隔行底色触发器**被注释**（残留注释块，实际不生效） | IOListBoxBaseStyle Setter + IOListBoxItemBaseStyle 注释 `Trigger Property="ListBox.AlternationIndex"` | 🟡 [待确认 TD-xxx] |
| Background / BorderBrush / BorderThickness | Brush / Thickness | 基样式 `PrimaryDefaultBrush` / `PrimaryBorderBrush` / 1 | IOListBoxBaseStyle Setter | ✅ |
| 行高（项 Height） | double | `ListBoxItemHeight`=45 | IOListBoxItemBaseStyle Setter + {source_root}/SDC/Sizes.xaml | ✅ |
| 行 Padding | Thickness | 15,0 | IOListBoxItemBaseStyle Setter | ✅ |
| 行分隔线 | Thickness / Brush | BorderThickness 0,0,0,1 + `SecondaryBorderBrush` | IOListBoxItemBaseStyle Setter | ✅ |
| 行 Hover 态 | Brush | IsMouseOver → `HoverBrush` 底 | IOListBoxItemBaseStyle `Trigger Property="IsMouseOver"` | ✅ |
| 行 Selected 态 | Brush / FontWeight | IsSelected → `PrimaryDeepToolBrush` 底 + Bold + `PrimaryDefaultBrush` 字 | IOListBoxItemBaseStyle `Trigger Property="IsSelected"` | ✅ |
| 行 Disabled 态 | double | IsEnabled=False → Opacity 0.4 | IOListBoxItemBaseStyle `Trigger Property="IsEnabled"` | ✅ |
| BorderElement.CornerRadius | CornerRadius | 行圆角（模板 Bd `CornerRadius` 绑定） | IOListBoxItemBaseStyle 模板 | ✅ |
| FocusVisualStyle | Style | 行项 `FocusVisualRadius0Margin0`（BaseStyle.xaml） | IOListBoxItemBaseStyle Setter | ✅ |
| VerticalContentAlignment | VerticalAlignment | 基样式 Center；行项继承 ItemsControl 的 HorizontalContentAlignment | IOListBoxBaseStyle / IOListBoxItemBaseStyle Setter | ✅ |
| IOEnable | string/bool | 设备条件协议（IO 系列共同挂点）；本模板无直接引用 | ManualView.xaml 15 处（IconButton）+ TD-001 | 🟡 [待确认 TD-001] |

## 4. 样式族表（SDC\Style\IOListBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IOListBoxItemBaseStyle | BaseStyle | 行项：高 45、Padding 15,0、底边 1 分隔线（0,0,0,1）、Hover/Selected/Disabled 触发器、BorderElement.CornerRadius 圆角 | 列表行项（基样式，ItemContainerStyle 已绑） |
| IOListBoxBaseStyle | 无（独立） | 容器：单层 Border + ScrollViewer + ItemsPresenter、AlternationCount 2、FocusVisualStyle=null、Stylus.IsFlicksEnabled=False | 列表容器（基样式） |
| （无键默认样式） | IOListBoxBaseStyle | TargetType 隐式默认样式，全局兜底 | 未显式指定 Style 时 |

同文件附带 DataTemplate（页面面，非样式）：

| 键 | 特征 | 场景 |
|---|---|---|
| RecipeFolderListTemplate | 40 列 `FolderGeometry`（Orange 20×20）+ 文件夹名（ToolTip） | 配方文件夹列表 |
| RecipeListTemplate | `RecipeGeometry`（LightSkyBlue）+ Bold RecipeName + 右对齐 RecipeID/CreateTime 双行 | 配方项目列表 |
| MeasureSizeTemplate | 行内 `controls:NumberBox`（Y 值 0~100）+ Set 按钮（Command=`SetYStepValueCommand`，经 AncestorType=ListBox/ListBoxItem DataContext） | 测量尺寸编辑行 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `s:IOListBox`。

```xml
<s:IOListBox ItemsSource="{Binding RecipeList}"
             ItemTemplate="{StaticResource RecipeListTemplate}"
             SelectedItem="{Binding SelectedRecipe}" />
```

- 行视觉（高 45、分隔线、三态）由 `IOListBoxItemBaseStyle` 全包，页面只提供 ItemsSource / ItemTemplate / SelectedItem 绑定；
- 行内复杂内容（编辑控件）用同文件 DataTemplate（如 `MeasureSizeTemplate`）承载，不在页面散写。

## 6. 禁止写法对照

### ❌ 禁止：原生 ListBox 裸用 + 手写行模板拼等效视觉（常规 WPF 写法）

```xml
<ListBox ItemsSource="{Binding …}">
    <ListBox.ItemContainerStyle>
        <Style TargetType="ListBoxItem">
            <Setter Property="Height" Value="45"/>
            <Setter Property="Padding" Value="15,0"/>
            <Setter Property="BorderBrush" Value="Gray"/>
            <Setter Property="BorderThickness" Value="0,0,0,1"/>
            <!-- 自行补 IsMouseOver/IsSelected 触发器与分隔线模板… -->
        </Style>
    </ListBox.ItemContainerStyle>
    <ListBox.ItemTemplate>
        <DataTemplate>
            <TextBlock Text="硬编码列表项"/>
        </DataTemplate>
    </ListBox.ItemTemplate>
</ListBox>
```

### ✅ 推荐：IOListBox + 业务 DataTemplate

```xml
<s:IOListBox ItemsSource="{Binding RecipeList}"
             ItemTemplate="{StaticResource RecipeListTemplate}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写行没有 Hover（HoverBrush）/Selected（PrimaryDeepToolBrush 底 + Bold + 白字）/Disabled 0.4 全套触发器；
2. **③ 无法样式族切换**：行高 45（`ListBoxItemHeight` Token）、Padding 15,0、分隔线 0,0,0,1 散写，不能由 IOListBoxItemBaseStyle 一处调整；
3. **④ 绕过本地化**：ItemTemplate 内硬编码文案绕过 DynamicResource 文本键体系；
4. **⑤ 脱离视觉规范**：行圆角（BorderElement.CornerRadius）、焦点视觉（FocusVisualRadius0Margin0）、触摸策略（Stylus.IsFlicksEnabled=False）等规范失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOListBox.xaml`（锚点 `x:Key="IOListBoxItemBaseStyle"`、`x:Key="IOListBoxBaseStyle"`、`Trigger Property="IsMouseOver"`/`IsSelected`/`IsEnabled`、`x:Key="RecipeFolderListTemplate"`/`RecipeListTemplate`/`MeasureSizeTemplate`）
- 尺寸：`{source_root}/SDC/Sizes.xaml`（ListBoxItemHeight）；基样式：`{source_root}/SDC/Style/BaseStyle.xaml`（FocusVisualRadius0Margin0）
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：非 IO 版 `{source_root}/SDC/Style/ListBox.xaml`（`x:Key="ListBoxBaseStyle"`、`x:Key="HeaderedListBoxBaseStyle"`）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOListBox.xaml.json`

## 8. 待确认项

- TD-001（IOEnable 表达式语义——IO 系列共同协议，本模板无直接引用，属系列推断）
- TD-006（`BorderElement` 附加属性族）
- [待确认 TD-xxx]：`AlternationCount=2` 的隔行底色 AlternationIndex 触发器被整块注释——交替底色是否仍生效（.cs 侧处理？）、注释是否遗留——建议登记新 TD
- `MeasureSizeTemplate` 内嵌 `controls:NumberBox`（数字键盘家族，见 02-controls/README.md 阶段 4），与本条目跨家族引用
