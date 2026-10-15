<!-- evidence=已确认(属性/尺寸/键位/Tag 字面量均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-029,TD-030,TD-032];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/NumericKeypad.xaml, {source_root}/SDC/Style/SwitchKeypad.xaml, {source_root}/ManualView.xaml] -->

# NumericKeypad（数字键盘）

## 1. 用途

自包含数字输入弹板：**顶部输入显示框（输入法禁用）+ 3×4 数字键网格（1~9、0、小数点）+ 三个功能键（退出/清空/确认）+ 退格键**，全部内建于模板——页面只需声明一个元素，键位布局、键样式、显示框与功能键 Tag 协议均由框架承担。

典型场景（推断，无 P2 实例）：数值参数、坐标等弹出式输入键盘。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:NumericKeypad … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:NumericKeypad`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。声明为**隐式默认样式**（无 x:Key，NumericKeypad.xaml:105），全局兜底。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（file:line 或锚点） | 状态 |
|---|---|---|---|---|
| Width / Height | double，默认 285×226 | 控件整体尺寸；模板 `Num_Border` 直接 TemplateBinding（修改会牵连内部键区排版，建议保持默认） | NumericKeypad.xaml:106-107 + 模板 :114-116 | ✅ |
| BorderBrush | Brush，默认 PrimaryDefaultBrush | 外层边框色 | Setter :108 + 模板 :114 | ✅ |
| BorderThickness | Thickness，默认 3 | 外层边框厚度 | Setter :109 | ✅ |
| Background | Brush，默认 ThirdlyLightToolBrush | 仅作用于数字键区衬底（`Border` Grid.Row=1 的 TemplateBinding :126）；外层 `Num_Border` 底色为模板硬编码 PrimaryDefaultBrush（:115） | Setter :110 + 模板 :115/:126 | ✅ |
| （模板命名部件） | Num_Border / G_TextB / G_Grid | 显示框（`InputMethod.IsInputMethodEnabled="False"`，右对齐，280×40，HeadFontSize）与键区网格；部件契约 .cs 消费方不可见 | 模板 :114/:125/:127 | 🟡 [待确认 TD-030] |
| 功能键 Tag 协议 | Tag 0~3 | 模板字面量：`Tag="0"`=退出（keyBoardEscapeGeometry 图标）、`Tag="1"`=清空（ControlClear）、`Tag="2"`=确认（ControlConfirm）、`Tag="3"`=退格（SubGeometry 横杠）；语义由 .cs 消费方解析 | :147/:158/:162/:163 | 🟡 [待确认 TD-030] |

## 4. 样式族表（SDC\Style\NumericKeypad.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| KeyButtonStyle | 无（独立） | 65×40；PrimaryDefaultBrush 底 + TextBrush 字 + PrimaryBorderBrush 描边；HeadFontSize(16) Bold；圆角 3、BorderThickness 2；Hover 换 PrimaryBorderBrush 边框、Pressed 换 PrimaryBorderBrush 底 | 数字主键（模板内 Grid.Resources 隐式套用 :129） |
| SubButtonStyle | 无（独立） | 50×83 竖长键；ThirdlyDeepGradientBrush 渐变底 + PrimaryDefaultBrush 字；Pressed BorderThickness=0 + ThirdlyDeepGradientBrushRevert 反渐变 | 确认键（2×2 跨格 :162） |
| GrayButtonStyle | 无（独立） | 65×40；SecondaryBrush 灰底 + PrimaryTextBrush 字；Hover/Pressed 换 SecondaryDeepBrush | 功能键（退出/清空/退格 :147/:158/:163/:167） |
| （无键默认样式） | — | TargetType=`controls:NumericKeypad` 隐式默认样式，全局兜底 | 未显式指定 Style 时 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 全库 grep `Keypad` 0 命中，Demo（MasterGo_WPF_V0.0.3）亦无本控件使用（仅有 BtnKeypad 菜单按钮，非本控件）。

```xml
<s:NumericKeypad />
```

- 键位（1~9、0、.）、显示框、退出/清空/确认/退格全部内建于模板，页面只放置元素；
- 显示框已禁输入法（`InputMethod.IsInputMethodEnabled="False"`），数值只能经按键输入；
- 尺寸不建议覆盖：显示框 280×40 与键区 Auto 网格按 285×226 设计，改动会造成排版错位。

## 6. 禁止写法对照

### ❌ 禁止：手写 Popup + Grid 逐键拼装等效数字键盘（常规 WPF 写法）

```xml
<Popup x:Name="KeypadPopup" IsOpen="True">
    <Border BorderBrush="#3366FF" BorderThickness="3" CornerRadius="3">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/>
            </Grid.RowDefinitions>
            <Grid.ColumnDefinitions>
                <ColumnDefinition/><ColumnDefinition/><ColumnDefinition/><ColumnDefinition/>
            </Grid.ColumnDefinitions>
            <Button Grid.Row="0" Grid.Column="0" Content="1"
                    Width="65" Height="40" Background="#3366FF" FontSize="16" FontWeight="Bold"/>
            <!-- 其余 1~9、0、.、退出/清空/确认/退格逐个手写，
                 每键重复写 Width/Height/FontSize/画刷/Margin，
                 再在代码里挂 Click 事件路由 Tag… -->
            <TextBox Grid.Row="0" Grid.ColumnSpan="4" Width="280" Height="40"
                     HorizontalContentAlignment="Right" InputMethod.IsInputMethodEnabled="False"/>
        </Grid>
    </Border>
</Popup>
```

### ✅ 推荐：NumericKeypad 一行声明

```xml
<s:NumericKeypad />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写 Button 没有三档样式的 Hover/Pressed 触发器与画刷切换（KeyButtonStyle/GrayButtonStyle/SubButtonStyle 模板 Trigger）；
2. **② 丢失协议挂点**：功能键 Tag 编号（0=退出/1=清空/2=确认/3=退格）与键盘控件按键路由协议无从谈起，需自行写 12+ 个 Click 事件并手工对值；
3. **③ 无法样式族切换**：主键/功能键/确认键三档尺寸（65×40 / 65×40 / 50×83）与三套画刷组散写在每个 Button 上，无法像 KeyButtonStyle→GrayButtonStyle 一样换肤；
4. **⑤ 脱离视觉规范**：显示框右对齐、输入法禁用、阴影（DropShadowEffect Direction 300）、圆角 3、BorderThickness 2 等规范散落失控，页面间无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/NumericKeypad.xaml`（锚点 `x:Key="KeyButtonStyle"`:13、`x:Key="SubButtonStyle"`:43、`x:Key="GrayButtonStyle"`:74、隐式样式 :105、`x:Name="G_TextB"`/`G_Grid`/`Num_Border`、Tag 字面量 :147/:158/:162/:163）
- 关联文件：`{source_root}/SDC/Geometries.xaml`（`keyBoardEscapeGeometry`:61、`SubGeometry`:49）；`{source_root}/SDC/Brushes.xaml`（PrimaryDefaultBrush:11、PrimaryBorderBrush:35、SecondaryBrush:17、ThirdlyLightToolBrush:31、ThirdlyDeepGradientBrush:121）；`{source_root}/SDC/Fonts.xaml`（HeadFontSize:5、SubHeaderFontSize:6）
- 家族互引：`{source_root}/SDC/Style/SwitchKeypad.xaml` 合并本文件（:10）且**重定义同名键 `KeyButtonStyle`**（:15，与 `{source_root}/SDC/Style/NumericKeypad.xaml:13` 双定义，见第 8 区块 TD-029）；StringNumericKeypad 为 Str 前缀同构变体（见 string-numeric-keypad.md）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_NumericKeypad.xaml.json`

## 8. 待确认项

- TD-029（家族键碰撞）：`KeyButtonStyle` 同名双定义——本文件 :13 与 `{source_root}/SDC/Style/SwitchKeypad.xaml:15`；逐属性比对**当前内容一致**（均 65×40、PrimaryDefaultBrush 底、HeadFontSize Bold），但 SwitchKeypad.xaml 合并本文件（:10）后本地定义覆盖合并项，单方修改即分叉；凡引用该键一律写「文件+键」双定位
- TD-030（键盘交互协议 .cs 面）：功能键 Tag 编号语义与跨键盘编号不一致（本控件 0~3，StringNumericKeypad 0~4，SwitchKeypad 字母面 0~5/数字面 6~10）；显示框/键区部件契约由 .cs 消费
- TD-032（联动挂点）：`NumericKeypadAttach.IsEnabled`（定义位置 SDC 全库 grep 零命中，README 称在 FrameworkGeneric.xaml）被 NumberBox/IntNumberBox 等模板 Trigger 消费，键盘控件自身模板零引用——弹出/联动机制待确认
