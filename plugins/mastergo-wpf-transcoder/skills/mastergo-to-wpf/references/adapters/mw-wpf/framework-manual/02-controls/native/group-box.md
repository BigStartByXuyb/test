<!-- evidence=已确认(属性/模板/触发器均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[TD-023,TD-026];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/GroupBox.xaml, {source_root}/ManualView.xaml] -->

# GroupBox（原生分组框·框架样式）

> **适用范围**：本文属**作业 A（MW WPF / XAML 侧）**参考资料，描述 `TargetType=GroupBox` 的隐式 `Style` 解析，来自某次本地框架快照。作业 B（MTSLG IOContorl 页面 XML）的 GroupBox **`Style` 是空串**（`Style=""`），其内容区原点为 `IOGroupBoxSecondary` 的 `{left:1, top:35}`——见 `mtslg-mode.md` 第 3 节（坐标规则）与 `mtslg-iocontrol-map.json` 的 `infoGroupTemplates.styleInsets`。

## 1. 用途

原生 `GroupBox` 的框架默认样式：**上下两段式（标题条 + 内容区）**，标题条由 `controls:TitleElement.*` 附加属性族驱动（高度/画刷/字号/对齐），内建 `IsEnabled=False` 整体与标题双重透明度 0.5。与 IOGroupBox 的基样式模板**逐行同构**（TD-023）；本文件另含**内容分组框**形态（`ContentGroupBoxStyle`，圆角 3 边框 + 左缩进内容区）——且它是隐式默认样式的 BasedOn，即框架下 GroupBox 默认形态。

典型场景（推断，无 P2 实例）：页面多级分区容器。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<GroupBox … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `GroupBox`。本文件含 2 个 ControlTemplate 资源键（`GroupBoxBaseTemplate`/`GroupBoxSecondaryTemplate`/`GroupBoxThirdlyTemplate` 共 3 个）+ 4 个显式样式键 + 1 个隐式默认样式（BasedOn `ContentGroupBoxStyle`，`GroupBox.xaml:156`——注意默认形态是「内容分组框」而非 GroupBoxBaseStyle）。

## 3. 关键属性表

**与 IOGroupBox 的差异面**：`GroupBoxBaseStyle`（GroupBox.xaml:30）与 `IOGroupBoxBaseStyle` 逐行同构（Setter 清单、GroupBoxBaseTemplate 模板、IsEnabled 双 0.5 触发器一致，仅 TargetType 与键名不同，TD-023）。原生版**独有**：`GroupBoxSecondary`/`GroupBoxThirdly` 键式变体、`ContentGroupBoxStyle`（内容分组框）及以其为 BasedOn 的隐式默认样式；IO 版另有 Four 级变体与 IO 命名键。

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Header | object | 标题内容；Bold、经 `TitleElement.Foreground/FontSize` 继承；`IsEnabled=False` 时与整体同 0.5 透明度 | `x:Key="GroupBoxBaseTemplate"` ContentPresenterMain（ContentSource="Header"）+ `Trigger Property="IsEnabled" Value="False"` | ✅ |
| Background | Brush | 内容区背景；GroupBoxBaseStyle `GroupBox_BackBrush`；ContentGroupBoxStyle `#EAEDF2` 硬编码 | GroupBoxBaseStyle / ContentGroupBoxStyle Setter | ✅ |
| BorderBrush / BorderThickness | Brush / Thickness | 内容区边框；基样式 `GroupBox_BorderBrush` / 2；Secondary/Thirdly/ContentGroupBoxStyle 覆盖 1~2 | 各样式 Setter | ✅ |
| TitleElement.Background | Brush | 标题条背景；基样式 `GroupBox_HeaderBackBrush`；Secondary `SecondGroupBox_*`；Thirdly `ThirdGroupBox_*` | 各样式 Setter（模板 `Binding (controls:TitleElement.Background)`） | ✅ |
| TitleElement.TitleHeight | double | 标题条高度；基样式 `GroupBoxBaseHeader`=40、Secondary=`GroupBoxSecondaryHeader`=35、Thirdly=`GroupBoxThirdlyHeader`=25 | 各样式 Setter + {source_root}/SDC/Sizes.xaml:58-60 | ✅ |
| TitleElement.Foreground | Brush | 标题文字色；基样式 `GroupBox_HeaderTextBrush`；Secondary/Thirdly 各自画刷组 | 各样式 Setter | ✅ |
| TitleElement.FontSize | double | 标题字号；基样式 `HeadFontSize`=16、Secondary/Thirdly=`SubHeaderFontSize`=14 | 各样式 Setter | ✅ |
| TitleElement.TitleAlignment | HorizontalAlignment | 基样式 Left；Secondary/Thirdly 继承 | GroupBoxBaseStyle Setter | ✅ |
| Focusable | bool | 基样式 True | GroupBoxBaseStyle Setter | ✅ |

## 4. 样式族表（SDC\Style\GroupBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| GroupBoxBaseStyle | 无（独立） | 标题左对齐、头高 40、字号 16、BorderThickness 2、Focusable=True；模板 `GroupBoxBaseTemplate`（头条 Padding 15 0 + 内容区 2 0 2 2 描边） | 一级标题容器（基样式） |
| GroupBoxSecondary | GroupBoxBaseStyle | `SecondGroupBox_*` 画刷组；头高 35、字号 14、BorderThickness 1；模板 `GroupBoxSecondaryTemplate`（内容区 1 0 1 1 描边） | 二级标题容器 |
| GroupBoxThirdly | GroupBoxBaseStyle | `ThirdGroupBox_*` 画刷组；头高 25、字号 14；模板 `GroupBoxThirdlyTemplate`（**无边框包裹**、白底、`GroupBoxHeaderGeometry` 20×12 图标 + `ThirdGroupBox_IconBrush` 标题头） | 三级标题容器 |
| ContentGroupBoxStyle | 无（独立内联模板） | 圆角 3 边框 + 标题跨行浮于内容左上（列 5/auto/*/6、行 Auto/Auto/*/6）；`PrimaryControlToolBrush` 边框、#EAEDF2 底、标题 FontWeight=Normal 字号 14 | 内容分组容器 |
| （隐式默认样式） | **ContentGroupBoxStyle** | TargetType 默认样式 BasedOn ContentGroupBoxStyle——默认 GroupBox 呈现为内容分组框形态 | 未显式指定 Style 时 |

配套画刷：`{source_root}/SDC/Brushes/GroupBoxBrushes.xaml`（`GroupBox_*`/`SecondGroupBox_*`/`ThirdGroupBox_*` 系列）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现框架样式下的 `GroupBox` 元素。

```xml
<GroupBox Header="{DynamicResource …一级标题文本键}">
    <GroupBox Style="{StaticResource GroupBoxSecondary}"
              Header="{DynamicResource …二级标题文本键}">
        <!-- 内容区 -->
    </GroupBox>
</GroupBox>
```

- 默认（不写 Style）即 `ContentGroupBoxStyle` 内容分组框形态；要换一~三级标题形态显式 `Style="…"` 即可；
- 标题一律用 `Header="{DynamicResource …}"` 本地化键；分组框本身为纯容器，不承载 IOEnable 表达式。

## 6. 禁止写法对照

### ❌ 禁止：手写 Border + Grid + TextBlock 拼装等效分组框（常规 WPF 写法）

```xml
<Border BorderBrush="{DynamicResource PrimaryDeepBrush}" BorderThickness="2" CornerRadius="3">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/><RowDefinition Height="*"/>
        </Grid.RowDefinitions>
        <TextBlock Grid.Row="0" Text="手工标题" FontWeight="Bold" FontSize="16"
                   HorizontalAlignment="Center" VerticalAlignment="Center"/>
        <Border Grid.Row="1" Background="Transparent" BorderThickness="2 0 2 2">
            <!-- 内容… -->
        </Border>
    </Grid>
</Border>
```

### ✅ 推荐：GroupBox 属性化 + 样式族

```xml
<GroupBox Header="{DynamicResource …文本键}" Style="{StaticResource GroupBoxSecondary}">
    <!-- 内容… -->
</GroupBox>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 `IsEnabled=False → Opacity 0.5`（整体 + ContentPresenterMain 双份）触发器；
2. **③ 无法样式族切换**：一~三级标题（头高 40/35/25 三级 Token、字号 16/14、画刷组）与默认内容分组框形态不能一键切换 GroupBoxBaseStyle→Secondary→Thirdly；
3. **④ 绕过本地化**：手写 TextBlock 硬编码标题绕过 DynamicResource 文本键体系；
4. **⑤ 脱离视觉规范**：标题条渐变（GroupBox_HeaderBackBrush）、Bold、Padding 15 0、左对齐策略与 Focusable=True 焦点策略失控，页面无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/GroupBox.xaml`（锚点 `x:Key="GroupBoxBaseTemplate"`/`x:Key="GroupBoxSecondaryTemplate"`/`x:Key="GroupBoxThirdlyTemplate"`、`x:Key="GroupBoxBaseStyle"`、`x:Key="GroupBoxSecondary"`、`x:Key="GroupBoxThirdly"`、`x:Key="ContentGroupBoxStyle"`、隐式默认 `Style TargetType="GroupBox" BasedOn="{StaticResource ContentGroupBoxStyle}"`）
- 画刷：`{source_root}/SDC/Brushes/GroupBoxBrushes.xaml`；尺寸：`{source_root}/SDC/Sizes.xaml`（GroupBoxBaseHeader/Secondary/Thirdly）；字号：`{source_root}/SDC/Fonts.xaml`
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：IO 版 `{source_root}/SDC/Style/IOGroupBox.xaml` + [io-group-box](../io/io-group-box.md)
- 索引交叉：`{index_root}/files/refence_SDC_Style_GroupBox.xaml.json`、`{index_root}/files/refence_SDC_Brushes_GroupBoxBrushes.xaml.json`

## 8. 待确认项

- TD-023：GroupBox/IOGroupBox 模板逐行同构（仅 TargetType 不同）——「IO」版真实差异（.cs 行为面）待确认。
- TD-026：`ContentGroupBoxStyle` 同名键在 GroupBox.xaml 与 IOGroupBox.xaml 双文件定义且均为隐式默认样式 BasedOn——合并顺序决定生效方，关联 TD-008 资源加载顺序。
- 继承 io-group-box.md 疑点：`GroupBoxHeaderGeometry` 键仅被引用（GroupBoxThirdlyTemplate Path Data）、refence 全库无定义——定义位置待确认。
