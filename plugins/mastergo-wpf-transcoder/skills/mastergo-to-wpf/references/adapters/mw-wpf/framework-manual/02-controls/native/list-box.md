<!-- evidence=已确认(属性/模板/触发器均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[TD-064];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/ListBox.xaml, {source_root}/ManualView.xaml] -->

# ListBox（原生列表框·框架样式）

## 1. 用途

原生 `ListBox` 的框架默认样式：白底 + 1px 边框 + `AlternationCount=2` 斑马纹（`AlternationIndex=1 → BackgroundLightBrush`）列表项，项分隔线 0,0,0,1，行高 Token 化（`ListBoxItemHeight`=45），项圆角经 `BorderElement.CornerRadius` 附加属性。同文件另含 `controls:HeaderedListBox` 自定义控件家族（**带标题条列表**：标题条高 `ListBoxTitleHeight`=35，TitleElement 附加属性族驱动，二级/三级变体），`HeaderedListBox` 是独立控件类型（MaxwellControl.Controls），非 ListBox 子类形态。

典型场景（推断，无 P2 实例）：设置项/数据明细列表（斑马纹）、带分组标题的列表（HeaderedListBox）。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<ListBox … />；<controls:HeaderedListBox … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `ListBox` + `controls:HeaderedListBox`（独立控件类型）。本文件含 2 个 ListBoxItem 样式键、1 个 ListBox 基样式 + 1 个隐式默认、1 个 HeaderedListBox 基样式 + 1 个隐式默认 + 2 个键式变体。

## 3. 关键属性表

**与 IOListBox 的差异面**：`ListBoxItemBaseStyle` 与 IO 版同名对应样式**非** TD-023 五对同构（不含 ListBox）——差异：① 原生版 `AlternationIndex` 触发器**激活生效**（配合 `AlternationCount=2`，IO 版为注释状态）；② 原生版多 `HeaderListBoxItemBaseStyle`（主文字色 + `NextButtonGradientBrush` 选中态，供 HeaderedListBox 使用）；③ 原生版独有 `HeaderedListBox` 家族 4 键（IO 版无）；④ 原生版项模板 `Bd` 绑定 `BorderElement.CornerRadius`（IO 版待核对是否同模式）。

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 列表底 `PrimaryDefaultBrush`；选中项 `BackgroundLightToolBrush`；斑马纹行 `BackgroundLightBrush` | `x:Key="ListBoxBaseStyle"` Setter（:111）+ 项触发器（:44-54） | ✅ |
| BorderBrush / BorderThickness | Brush / Thickness | 列表 1px `PrimaryBorderBrush`；项底部分隔线 0,0,0,1 `SecondaryBorderBrush` | ListBoxBaseStyle Setter（:113-114）+ ListBoxItemBaseStyle Setter（:21-22） | ✅ |
| AlternationCount | int | 基样式 =2，激活项 `AlternationIndex=1` 斑马纹（列表与 HeaderedListBox 两处均设） | ListBoxBaseStyle Setter（:117）/ HeaderdListBoxBaseStyle Setter（:145） | ✅ |
| ItemContainerStyle | Style | ListBoxBaseStyle→`ListBoxItemBaseStyle`；HeaderdListBoxBaseStyle→`HeaderListBoxItemBaseStyle` | 两基样式 Setter | ✅ |
| 行高 / 行 Padding | double / Thickness | `MinHeight={DynamicResource ListBoxItemHeight}`（Sizes.xaml:70，=45）；`Padding=15,0` | ListBoxItemBaseStyle/HeaderListBoxItemBaseStyle Setter | ✅ |
| IsMouseOver（项） | Brush | 普通项 → `HoverBrush`；标题项 → `SecondaryBorderBrush` | 两样式 `Trigger Property="IsMouseOver"` | ✅ |
| IsSelected（项） | Brush | 普通项 → `BackgroundLightToolBrush` + 前景 `PrimaryDefaultBrush`；标题项 → `NextButtonGradientBrush` + 前景 `PrimaryDefaultBrush` | 两样式 `Trigger Property="IsSelected"` | ✅ |
| IsEnabled | bool | False → 项 Opacity .4（项模板触发器，列表本身无整体 0.4——注意与 TabControl 不同） | 两样式 `Trigger Property="IsEnabled"` | ✅ |
| BorderElement.CornerRadius | CornerRadius | 项 Border 圆角经该附加属性注入（框架统一圆角通道） | 项模板 `CornerRadius="{Binding Path=(controls:BorderElement.CornerRadius)…}"`（:33/:85） | ✅ |
| Header（HeaderedListBox） | object | 标题条内容；Bold、字号 `SubHeaderFontSize`；`TitleElement.Foreground/Background/TitleAlignment` 驱动（默认隐式样式：`TabSecondDefaultGradient` 底 / `PrimaryTextBrush` 字 / Center） | `x:Key="HeaderdListBoxBaseStyle"` 模板 ContentControl（:161-169）+ 隐式默认样式 Setter（:188-194） | ✅ |
| TitleElement.TitleAlignment | HorizontalAlignment | 隐式默认 Center（基样式内 Setter 亦为 Center） | HeaderdListBoxBaseStyle Setter（:144） | ✅ |
| 标题条高度 | double | `ListBoxTitleHeight`=35（Sizes.xaml:67） | 模板 Border Height（:160）+ Sizes.xaml | ✅ |

## 4. 样式族表（SDC\Style\ListBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| ListBoxItemBaseStyle | BaseStyle | 行高 45、Padding 15,0、底部分隔线、斑马纹（AlternationIndex=1）、HoverBrush/BackgroundLightToolBrush 双态 | ListBox 项（自动注入） |
| HeaderListBoxItemBaseStyle | BaseStyle | 同形体但前景 `PrimaryTextBrush`（主色文字）、选中 `NextButtonGradientBrush` | HeaderedListBox 项（自动注入） |
| ListBoxBaseStyle | 无（独立） | 白底 1px 边框、AlternationCount=2、Stylus.IsFlicksEnabled=False、ScrollViewer 模板 | 基样式，不直接用 |
| （隐式默认样式） | ListBoxBaseStyle | TargetType 默认样式，全局兜底（:137） | 未显式指定 Style 时 |
| HeaderdListBoxBaseStyle | 无（独立） | **TargetType=controls:HeaderedListBox**；标题条 + 内容两行 Grid；AlternationCount=2 | 基样式，不直接用 |
| （隐式默认 HeaderedListBox） | HeaderdListBoxBaseStyle | `TabSecondDefaultGradient` 标题渐变底 + `PrimaryDeepBrush` 边框 + `PrimaryTextBrush` 字（:188-194） | 未显式指定 Style 时 |
| HeaderedListBoxSecondaryStyle | HeaderdListBoxBaseStyle | `ThirdlyLightGradientBrush` 标题底、标题字 **#5b81a0 硬编码**、`PrimaryBorderBrush` 边框 | 二级标题列表 |
| HeaderedListBoxThirdlyStyle | HeaderdListBoxBaseStyle | `BackgroundBrush` 标题底、标题字 **#5f5f5f 硬编码**、`PrimaryBorderBrush` 边框 | 三级标题列表 |

模板命名部件（P1 锚点）：`Bd`（列表/标题项 Border）、`ItemsPresenter` + 内嵌 `ScrollViewer Focusable="false"`。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `ListBox`/`HeaderedListBox`。

```xml
<ListBox>
    <ListBoxItem Content="{DynamicResource …文本键}" />
    <ListBoxItem Content="{DynamicResource …文本键}" />
</ListBox>

<controls:HeaderedListBox Header="{DynamicResource …标题文本键}"
                          Style="{StaticResource HeaderedListBoxSecondaryStyle}">
    <ListBoxItem Content="{DynamicResource …文本键}" />
</controls:HeaderedListBox>
```

- 默认（不写 Style）即框架样式；斑马纹由 `AlternationCount=2` 自动生效，无需页面设置；
- 项通常走 ItemsSource 数据绑定（ItemContainerStyle 已注入，页面不写 `ListBox.ItemContainerStyle`）；
- 标题一律 `Header="{DynamicResource …}"` 本地化键。

## 6. 禁止写法对照

### ❌ 禁止：手写 StackPanel + 手工分隔线拼等效列表（常规 WPF 写法）

```xml
<StackPanel>
    <!-- 手写每一行：Border 底部分隔线 + TextBlock，手工"选中/悬停"画刷切换… -->
    <Border BorderBrush="#dde3ea" BorderThickness="0,0,0,1">
        <TextBlock Text="手工行一" Padding="15,0" Height="45" VerticalAlignment="Center"/>
    </Border>
    <Border BorderBrush="#dde3ea" BorderThickness="0,0,0,1">
        <TextBlock Text="手工行二" Padding="15,0" Height="45" VerticalAlignment="Center"/>
    </Border>
    <!-- 数据驱动时再手写 ItemsControl + ItemTemplate 重做一遍… -->
</StackPanel>
```

### ✅ 推荐：ListBox 数据驱动 + 框架项样式

```xml
<ListBox ItemsSource="{Binding 数据集合}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写行没有悬停（HoverBrush）/选中（BackgroundLightToolBrush）/禁用（Opacity .4）触发器与斑马纹（AlternationIndex）——手工切换画刷必然缺态；
2. **② 丢失协议挂点**：绕过 `ItemContainerStyle`（ListBoxItemBaseStyle）与 `BorderElement.CornerRadius` 附加属性通道——圆角策略失控；
3. **③ 无法样式族切换**：行高 45（ListBoxItemHeight Token）、分隔线、二/三级 HeaderedListBox 标题形态（Secondary/Thirdly 键）无法一键切换；
4. **④ 绕过资源体系**：硬编码行色/分隔线色绕过 PrimaryDefaultBrush/SecondaryBorderBrush/BackgroundLightBrush 键体系；
5. **⑤ 脱离视觉规范**：标题条（TabSecondDefaultGradient 渐变底、Bold、SubHeaderFontSize、Center 对齐、高 35）与滚动策略（ScrollViewer 模板内嵌）脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/ListBox.xaml`（锚点 `x:Key="ListBoxItemBaseStyle"`、`x:Key="HeaderListBoxItemBaseStyle"`、`x:Key="ListBoxBaseStyle"`、隐式默认 `Style BasedOn="{StaticResource ListBoxBaseStyle}" TargetType="ListBox"`、`x:Key="HeaderdListBoxBaseStyle"`、隐式默认 HeaderedListBox、`x:Key="HeaderedListBoxSecondaryStyle"`、`x:Key="HeaderedListBoxThirdlyStyle"`、`Trigger Property="ListBox.AlternationIndex" Value="1"`、`Trigger Property="IsSelected"`）
- 尺寸：`{source_root}/SDC/Sizes.xaml`（`ListBoxItemHeight` 45 / `ListBoxTitleHeight` 35）；字号：`{source_root}/SDC/Fonts.xaml`（SubHeaderFontSize）
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：IO 版 `{source_root}/SDC/Style/IOListBox.xaml` + [io-list-box](../io/io-list-box.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_ListBox.xaml.json`

## 8. 待确认项

- TD-064：`controls:HeaderedListBox` 家族（含 `HeaderdListBoxBaseStyle` 的 **"Headerd" 拼写**疑点、二级/三级标题字 #5b81a0/#5f5f5f 硬编码）——SDC 内仅定义零使用实例，真实消费方与 .cs 行为待确认。
- [待确认 TD-xxx]：`HeaderListBoxItemBaseStyle` 的选中画刷 `NextButtonGradientBrush`（命名属 Button 系）——跨控件族复用语义待确认。
- [待确认 TD-xxx]：IOListBox 的 AlternationIndex 注释与原生版激活是否同为历史迭代差异（IO 版条目如未记录请交叉回填）。
