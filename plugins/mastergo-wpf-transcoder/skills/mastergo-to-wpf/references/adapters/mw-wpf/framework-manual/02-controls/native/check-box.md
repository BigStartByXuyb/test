<!-- evidence=已确认(模板/触发器/勾画动画均为 P1 模板源码直接证据；无 P2 页面使用实例); pending=[TD-023];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/CheckBox.xaml, {source_root}/ManualView.xaml] -->

# CheckBox（原生复选框·框架样式）

## 1. 用途

原生 `CheckBox` 的框架默认样式：18×18 方形勾选框，勾选动画为**笔画绘制式**（`StrokeDashArray 8,8` + `StrokeDashOffset 8→0`，0.2s），支持三态（选中/未选/不确定）与全套状态画刷切换。**与 IOCheckBox 逐行同构**（仅 TargetType 与键名不同，见 TD-023）——本条目为原生类型在框架里的默认外观，非独立控件。

典型场景（推断，无 P2 实例）：非 IO 联锁的普通勾选项（如界面选项开关）。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<CheckBox … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `CheckBox`。本文件含 `CheckBoxBaseStyle`（x:Key）+ 隐式默认样式（BasedOn 前者，全局兜底）。

## 3. 关键属性表

**与 IOCheckBox 的差异面**：`{source_root}/SDC/Style/CheckBox.xaml` 与 `{source_root}/SDC/Style/IOCheckBox.xaml` 逐行同构——Setter 清单（Background/BorderBrush/BorderThickness 2/HorizontalAlignment Left/VerticalAlignment Center/VerticalContentAlignment Center/Padding 5,0,0,0）、模板（templateRoot 两列 Grid + checkBoxBorder + markGrid SimplePanel + path + contentPresenter）、8 组 Trigger/MultiTrigger 完全一致，仅 TargetType 与样式键名不同（CheckBoxBaseStyle vs IOCheckBoxBaseStyle）。**无原生版独有属性**；完整属性面见 [io-check-box](../io/io-check-box.md)。

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 默认 PrimaryDefaultBrush（白）；选中 → CheckBox_SelectDefaultBrush、不确定 → CheckBox_UnCertainDefaultBrush | `x:Key="CheckBoxBaseStyle"` Setter + `Trigger Property="IsChecked"`（true/{x:Null}） | ✅ |
| BorderBrush | Brush | 未选/悬停/按下/选中/不确定各态切换（CheckBox_UnSelectHoverBrush 等） | Setter + 4 组 `MultiTrigger`（IsChecked × IsMouseOver/IsPressed） | ✅ |
| BorderThickness | Thickness | 默认 2 | CheckBoxBaseStyle Setter | ✅ |
| IsChecked | bool? | 三态：true 勾画动画 + 选中画刷；false 勾 Stroke 置 CheckBox_UnSelectDisabledBrush；Null 不确定画刷 | `Trigger Property="IsChecked"` 三组 + `Trigger.EnterActions`/`ExitActions`（StoryboardCheckedTrue/False） | ✅ |
| Content | object | 右侧文字/内容；HasContent=true 时显示；字号 SubHeaderFontSize（14）、前景 PrimaryTextBrush | ContentPresenter `Trigger Property="HasContent"` + `TextElement.FontSize="{DynamicResource SubHeaderFontSize}"` | ✅ |
| Padding | Thickness | 默认 5,0,0,0 | CheckBoxBaseStyle Setter | ✅ |
| 尺寸 Token | double | 勾选框 18×18（`CheckBoxWidth`/`CheckBoxHeight`，Sizes.xaml:122-123）；勾形 11×11、StrokeThickness 2、Data 取 `CheckedGeometry` | 模板 checkBoxBorder/path + {source_root}/SDC/Sizes.xaml | ✅ |

## 4. 样式族表（SDC\Style\CheckBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| CheckBoxBaseStyle | BaseStyle | 18×18 勾选框 + 0.2s 笔画动画（StoryboardCheckedTrue/False）+ 8 个状态 Trigger/MultiTrigger（CheckBox_* 画刷组）+ 三态支持；FocusVisualStyle=Null（BaseStyle 继承） | 基样式，不直接用 |
| （隐式默认样式） | CheckBoxBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |

模板内无 PART_ 命名部件（x:Name 内部名：`templateRoot`/`checkBoxBorder`/`markGrid`/`path`/`contentPresenter`）。配套画刷在 `{source_root}/SDC/Brushes/CheckBoxBrushes.xaml`（`CheckBox_UnSelectDefaultBrush` 等）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 项目均未出现框架样式下的 `CheckBox` 元素（Demo 的 MainMenuView.xaml 使用 `CheckBoxSize`/`CheckBoxStrokeBrush` 系 Demo 自建资源，非本框架样式）。

```xml
<CheckBox Content="{DynamicResource …复选文本键}" IsChecked="True" />
```

- 默认（不写 Style）即框架样式（隐式默认样式兜底）；
- Content 走 DynamicResource 文本键（本地化，见 [localization-text](../../03-protocols/localization-text.md)）；
- 三态（`IsChecked="{x:Null}"`）为框架内建状态，可直接使用。

## 6. 禁止写法对照

### ❌ 禁止：CheckBox 不套框架样式 + 手写勾画动画与状态触发器拼装等效视觉（常规 WPF 写法）

```xml
<CheckBox>
    <CheckBox.Resources>
        <Storyboard x:Key="On">
            <DoubleAnimationUsingKeyFrames Storyboard.TargetProperty="(Shape.StrokeDashOffset)" Storyboard.TargetName="path">
                <EasingDoubleKeyFrame KeyTime="0:0:0.2" Value="0"/>
            </DoubleAnimationUsingKeyFrames>
        </Storyboard>
    </CheckBox.Resources>
    <Grid>
        <Border Width="18" Height="18" x:Name="box" BorderThickness="2" BorderBrush="#bbc2cc"/>
        <Path x:Name="path" Width="11" Height="11" Stretch="Uniform"
              Data="M2.749,4.350 L5.035,6.750 L10.749,0.750"
              StrokeDashArray="8,8" StrokeDashOffset="8" Stroke="#ffffff"/>
        <!-- 手写 IsChecked/悬停/按下/不确定/禁用 8 组触发器与画刷… -->
    </Grid>
</CheckBox>
```

### ✅ 推荐：默认样式即框架效果

```xml
<CheckBox Content="{DynamicResource …文本键}" IsChecked="True" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有模板的 8 组 Trigger/MultiTrigger（未选/悬停/按下/选中/不确定/禁用 + Opacity 0.5）与 0.2s 笔画绘制动画——三态（`{x:Null}`）与禁用视觉均无从谈起；
2. **③ 无法样式族切换**：18×18 Token、11×11 勾形、2px 边框、CheckBox_* 状态画刷全部散写，不能由 CheckBoxBaseStyle 一处调整（框架调整时手写页不跟随）；
3. **④ 绕过资源体系**：硬编码勾形 Data 与画刷颜色，绕过 `CheckedGeometry`（Geometries.xaml）与 CheckBoxBrushes.xaml 键体系；
4. **⑤ 脱离视觉规范**：勾选字号（SubHeaderFontSize 14）、文本色（PrimaryTextBrush）、对齐/间距（Padding 5,0,0,0）脱离框架控制，页面视觉无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/CheckBox.xaml`（锚点 `x:Key="CheckBoxBaseStyle"`、`x:Key="StoryboardCheckedTrue"`/`x:Key="StoryboardCheckedFalse"`、`Trigger Property="IsChecked"`、`TargetName="path"`、隐式默认 `Style BasedOn="{StaticResource CheckBoxBaseStyle}" TargetType="CheckBox"`）
- 同构对照：`{source_root}/SDC/Style/IOCheckBox.xaml`（`x:Key="IOCheckBoxBaseStyle"`）+ [io-check-box](../io/io-check-box.md)
- 配套资源：`{source_root}/SDC/Brushes/CheckBoxBrushes.xaml`、`{source_root}/SDC/Sizes.xaml`（`CheckBoxWidth`/`CheckBoxHeight`）、`{source_root}/SDC/Geometries.xaml`（`CheckedGeometry`）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_CheckBox.xaml.json`

## 8. 待确认项

- TD-023：CheckBox/IOCheckBox 模板逐行同构（仅 TargetType 不同）——「IO」版真实差异（.cs 行为面）待确认。
- 继承自 io-check-box.md 的通用疑点：`CheckBox_UnSelectDisabledBrush` 在 IsChecked=false 时充当勾形 Stroke 的命名语义疑点（原生版同模式）。
