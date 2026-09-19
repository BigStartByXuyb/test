<!-- evidence=已确认(属性/模板/触发器均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-001,TD-006];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IOGroupBox.xaml, {source_root}/ManualView.xaml] -->

# IOGroupBox（IO 分组框）

> **适用范围**：本文属**作业 A（MW WPF / XAML 侧）**参考资料，描述 `TargetType=controls:IOGroupBox` 的隐式 `Style` 解析，来自某次本地框架快照（版本可能过期）。**不作为作业 B（MTSLG IOContorl 页面 XML）运行期口径的依据**——作业 B 的 GroupBox `Style`（恒为空串）与内容区原点口径见 `mtslg-mode.md` **第 3 节（坐标规则）**与 `mtslg-iocontrol-map.json` 的 `infoGroupTemplates.styleInsets`；两者冲突时以后者为准（该口径是项目框架侧的确定事实：空 `Style` 的内容区原点就是 `IOGroupBoxSecondary` 的 `{left:1, top:35}`）。

## 1. 用途

原生 GroupBox 的框架封装：**上下两段式（标题条 + 内容区）**，标题条由 `controls:TitleElement.*` 附加属性族驱动（高度/画刷/字号/对齐），内建 `IsEnabled=False` 整体与标题双重透明度 0.5。一~四级标题 + 内容分组框共 5 个样式键。

典型场景（推断，无 P2 实例）：页面多级分区容器——ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:IOGroupBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOGroupBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件仅含样式层（4 个显式样式键 + 1 个隐式默认样式），标题内容经 `ContentSource="Header"` 呈现（继承自 HeaderedContentControl）。注意与原生框架版区分：`SDC/Style/GroupBox.xaml` 为原生 `GroupBox` 目标类型的非 IO 版（`GroupBoxBaseStyle` 等）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Header | object | 标题内容；Bold、经 `TitleElement.Foreground/FontSize` 继承；`IsEnabled=False` 时与整体同 0.5 透明度 | `x:Key="IOGroupBoxBaseTemplate"` `ContentPresenterMain`（ContentSource="Header"）+ `Trigger Property="IsEnabled" Value="False"` | ✅ |
| Background | Brush | 内容区背景；基样式 `GroupBox_BackBrush`（Transparent） | `x:Key="IOGroupBoxBaseStyle"` Setter | ✅ |
| BorderBrush / BorderThickness | Brush / Thickness | 内容区边框；基样式 `GroupBox_BorderBrush` / 2（Secondary/Thirdly/Four 覆盖为 1） | IOGroupBoxBaseStyle Setter | ✅ |
| TitleElement.Background | Brush | 标题条背景；基样式 `GroupBox_HeaderBackBrush`（PrimaryColor→PrimaryDeepColor 竖向渐变） | IOGroupBoxBaseStyle Setter（模板 `Binding (controls:TitleElement.Background)`） | ✅ |
| TitleElement.BorderBrush | Brush | 标题条描边；基样式 `GroupBox_BorderBrush` | IOGroupBoxBaseStyle Setter | ✅ |
| TitleElement.TitleHeight | double | 标题条高度；基样式 `GroupBoxBaseHeader`=40、Secondary/Four=`GroupBoxSecondaryHeader`=35、Thirdly=`GroupBoxThirdlyHeader`=25 | IOGroupBoxBaseStyle / IOGroupBoxSecondary / IOGroupBoxThirdly / IOGroupBoxFour Setter + {source_root}/SDC/Sizes.xaml | ✅ |
| TitleElement.Foreground | Brush | 标题文字色；基样式 `GroupBox_HeaderTextBrush`（白） | IOGroupBoxBaseStyle Setter | ✅ |
| TitleElement.FontSize | double | 标题字号；基样式 `HeadFontSize`=16、Secondary/Thirdly/Four=`SubHeaderFontSize`=14 | IOGroupBoxBaseStyle Setter + {source_root}/SDC/Fonts.xaml | ✅ |
| TitleElement.TitleAlignment | HorizontalAlignment | 标题条水平对齐；基样式 Center、IOGroupBoxFour=Left | IOGroupBoxBaseStyle / IOGroupBoxFour Setter | ✅ |
| Focusable | bool | 基样式 True | IOGroupBoxBaseStyle Setter | ✅ |
| IOEnable | string/bool | 设备条件协议（IO 系列共同挂点，见 03-protocols/device-condition-protocol.md）；本模板无直接引用 | ManualView.xaml 15 处（IconButton）+ TD-001 | 🟡 [待确认 TD-001] |

## 4. 样式族表（SDC\Style\IOGroupBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| IOGroupBoxBaseStyle | 无（独立） | 标题居中（TitleAlignment=Center）、头高 40、字号 16、BorderThickness 2、Focusable=True；模板 `IOGroupBoxBaseTemplate`（头条 HorizontalAlignment=Center + 内容区 2 0 2 2 描边） | 一级标题容器（基样式） |
| IOGroupBoxSecondary | IOGroupBoxBaseStyle | `SecondGroupBox_*` 画刷组；头高 35、字号 14、BorderThickness 1；模板 `IOGroupBoxSecondaryTemplate`（头条 Stretch + 内容区 1 0 1 1 描边） | 二级标题容器 |
| IOGroupBoxThirdly | IOGroupBoxBaseStyle | `ThirdGroupBox_*` 画刷组；头高 25、字号 14；模板 `GroupBoxThirdlyTemplate`（白底 + 图标+文字标题头：`GroupBoxHeaderGeometry` 20×12 + `ThirdGroupBox_IconBrush`） | 三级标题容器 |
| IOGroupBoxFour | IOGroupBoxBaseStyle | `FourGroupBox_*` 画刷组；头高 35、字号 14、TitleAlignment=Left；复用 `IOGroupBoxSecondaryTemplate` | 四级标题容器 |
| ContentGroupBoxStyle | 无（独立内联模板） | 圆角 3 边框 + 内容区左缩进布局（列 5/auto/*/6）；`PrimaryControlToolBrush` 边框、#EAEDF2 底、标题 FontWeight=Normal 字号 14 | 内容分组容器 |
| （无键默认样式） | ContentGroupBoxStyle | TargetType 隐式默认样式，全局兜底。**作业 B 优先级**：MTSLG 页面 XML 下「空 `Style`」的内容区原点按项目框架侧确认的 `IOGroupBoxSecondary` `{left:1, top:35}`，本行仅记录 XAML 侧快照的样式解析 | 未显式指定 Style 时（XAML 侧） |

配套画刷：`{source_root}/SDC/Brushes/GroupBoxBrushes.xaml`（`GroupBox_*`/`SecondGroupBox_*`/`ThirdGroupBox_*`/`FourGroupBox_*`/`ContentGroupBox_*`，命名模式 `XxxGroupBox_HeaderBackBrush/BorderBrush/HeaderTextBrush/BackBrush`）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现 `s:IOGroupBox`。

```xml
<s:IOGroupBox Style="{StaticResource IOGroupBoxBaseStyle}"
              Header="{DynamicResource …一级标题文本键}">
    <s:IOGroupBox Style="{StaticResource IOGroupBoxSecondary}"
                  Header="{DynamicResource …二级标题文本键}">
        <!-- 内容区 -->
    </s:IOGroupBox>
</s:IOGroupBox>
```

- 默认（不写 Style）走 `ContentGroupBoxStyle`（圆角 3 内容分组形态）；要换形态显式 `Style="…"` 即可；**注意适用范围**：这是 **XAML 侧**的样式解析结论，作业 B（MTSLG 页面 XML）的空 `Style` 内容区原点按项目框架侧确认的 `IOGroupBoxSecondary` `{left:1, top:35}`，以 `mtslg-mode.md` 第 3 节为准；
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

### ✅ 推荐：IOGroupBox 属性化 + 样式族

```xml
<s:IOGroupBox Header="{DynamicResource …文本键}" Style="{StaticResource IOGroupBoxSecondary}">
    <!-- 内容… -->
</s:IOGroupBox>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 `IsEnabled=False → Opacity 0.5`（整体 + ContentPresenterMain 双份）触发器；
2. **③ 无法样式族切换**：一~四级标题（头高 40/35/25 三级 Token、字号 16/14、画刷组）不能一键切换 IOGroupBoxBaseStyle→Secondary→Thirdly→Four；
3. **④ 绕过本地化**：手写 TextBlock 硬编码标题绕过 DynamicResource 文本键体系；
4. **⑤ 脱离视觉规范**：标题条渐变（GroupBox_HeaderBackBrush）、Bold、Padding 15 0、居中/左对齐策略与 Focusable=True 焦点策略失控，页面无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IOGroupBox.xaml`（锚点 `x:Key="IOGroupBoxBaseStyle"`、`x:Key="IOGroupBoxSecondary"`、`x:Key="IOGroupBoxThirdly"`、`x:Key="IOGroupBoxFour"`、`x:Key="ContentGroupBoxStyle"`、`x:Key="IOGroupBoxBaseTemplate"`/`IOGroupBoxSecondaryTemplate`/`GroupBoxThirdlyTemplate`/`IOGroupBoxFourTemplate`、`Trigger Property="IsEnabled"`）
- 画刷：`{source_root}/SDC/Brushes/GroupBoxBrushes.xaml`；尺寸：`{source_root}/SDC/Sizes.xaml`（GroupBoxBaseHeader/Secondary/Thirdly）；字号：`{source_root}/SDC/Fonts.xaml`（HeadFontSize/SubHeaderFontSize）
- 真实使用：无（ManualView.xaml 不含本控件）
- 对照：非 IO 版 `{source_root}/SDC/Style/GroupBox.xaml`（`x:Key="GroupBoxBaseStyle"` 等，TargetType=原生 GroupBox）
- 索引交叉：`{index_root}/files/refence_SDC_Style_IOGroupBox.xaml.json`、`{index_root}/files/refence_SDC_Brushes_GroupBoxBrushes.xaml.json`

## 8. 待确认项

- TD-001（IOEnable 表达式语义——IO 系列共同协议，本模板无直接引用，属系列推断）
- TD-006（`TitleElement` 附加属性族的参数类型与运行时行为，见 05-best-practices/pending-confirmations.md）
- [待确认 TD-xxx]：`GroupBoxHeaderGeometry` 键仅被引用（GroupBoxThirdlyTemplate `Path Data`）、refence 全库无定义（GroupBox.xaml 同引）——定义位置待确认（与 TD-018 CirclePointGeometry 同模式）
- [待确认 TD-xxx]：`ContentGroupBoxStyle` 同名键在 IOGroupBox.xaml 与 GroupBox.xaml 均定义且均为隐式默认样式 BasedOn——合并顺序决定生效方，关联 TD-008 资源加载顺序
