<!-- evidence=已确认(属性/尺寸/键位/Tag 字面量均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-029,TD-030,TD-032];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/StringNumericKeypad.xaml, {source_root}/SDC/Style/NumericKeypad.xaml, {source_root}/ManualView.xaml] -->

# StringNumericKeypad（字符串数字键盘）

## 1. 用途

NumericKeypad 的**全键盘化变体**：同一自包含弹板结构，键区扩展为「数字行 + 三排字母 + 功能行」（含 `-`、`_`、`/`、`\`、`#`、`.` 符号键），顶部仍为输入显示框（输入法禁用）。与 NumericKeypad 模板逐键同构，仅样式键换 **Str 前缀族** 且键宽收窄（28 vs 65）以容纳 6 行布局。

典型场景（推断，无 P2 实例）：需输入字母/符号的文本参数弹板。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:StringNumericKeypad … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:StringNumericKeypad`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。声明为**隐式默认样式**（无 x:Key，StringNumericKeypad.xaml:106），全局兜底。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（file:line 或锚点） | 状态 |
|---|---|---|---|---|
| Width / Height | double，默认 360×281 | 控件整体尺寸；模板 `Num_Border` 直接 TemplateBinding | StringNumericKeypad.xaml:107-108 + 模板 :115 | ✅ |
| BorderBrush | Brush，默认 PrimaryDefaultBrush | 外层边框色 | Setter :109 + 模板 :115 | ✅ |
| BorderThickness | Thickness，默认 3 | 外层边框厚度 | Setter :110 | ✅ |
| Background | Brush，默认 ThirdlyLightToolBrush | 键区衬底（模板 `S_Grid Background` :119）；外层 Num_Border 底色为硬编码 PrimaryDefaultBrush | Setter :111 + 模板 :115/:119 | ✅ |
| 阴影 | DropShadowEffect | ShadowDepth=3（NumericKeypad 为 2）、BlurRadius 5、Direction 300、色 TextColor | 模板 :116-118 | ✅ |
| （模板命名部件） | Num_Border / S_TextB / S_Grid | 显示框（360×40 居中、右对齐、输入法禁用）与 6 行 Auto 键区网格；部件契约 .cs 消费方不可见 | 模板 :115/:128/:119 | 🟡 [待确认 TD-030] |
| 功能键 Tag 协议 | Tag 0~4 | 模板字面量：`Tag="0"`=Shift（keyUpperGeometry 图标）、`Tag="1"`=退出（keyBoardEscapeGeometry）、`Tag="2"`=清空（ControlClear）、`Tag="3"`=空格（keyBoardSpaceGeometry）、`Tag="4"`=确认（ControlConfirm）；语义由 .cs 消费方解析 | :169/:181/:190/:192/:200 | 🟡 [待确认 TD-030] |

## 4. 样式族表（SDC\Style\StringNumericKeypad.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| StrKeyButtonStyle | 无（独立） | 28×38；PrimaryDefaultBrush 底 + TextBrush 字；**FontFamily=Arial**（NumericKeypad 的 KeyButtonStyle 无此设置）；HeadFontSize(16) Bold；圆角 3、BorderThickness 2；Hover/Pressed 同 KeyButtonStyle 画刷切换 | 全部字符键（1~0、字母、符号） |
| StrSubButtonStyle | 无（独立） | 60×38；ThirdlyDeepGradientBrush 渐变底 + PrimaryDefaultBrush 字；Pressed BorderThickness=0 + Revert 渐变 | 确认键（:200） |
| StrGrayButtonStyle | 无（独立） | 44×38；SecondaryBrush 灰底 + PrimaryTextBrush 字；Hover/Pressed 换 SecondaryDeepBrush | 功能键（Shift/退出/清空 :169/:181/:190） |
| （无键默认样式） | — | TargetType=`controls:StringNumericKeypad` 隐式默认样式，全局兜底 | 未显式指定 Style 时 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 全库 grep `Keypad` 0 命中；Demo（MasterGo_WPF_V0.0.3）无本控件使用。

```xml
<s:StringNumericKeypad />
```

- 键位：数字行 `1 2 3 4 5 6 7 8 9 0 -`（:130-140）；三排字母 `Q W E R T Y U I O P _` / `A S D F G H J K L \` / `Z X C V B N M`（:143-180）；底行 `Shift # 空格 . 确认`（:189-201）；
- 与 NumericKeypad 家族互引：布局结构同构、样式键 **Str 前缀逐键映射**（StrKeyButtonStyle↔KeyButtonStyle、StrSubButtonStyle↔SubButtonStyle、StrGrayButtonStyle↔GrayButtonStyle），仅尺寸族与 FontFamily 不同（28/60/44 vs 65/50/65）；KeyButtonStyle 同名键碰撞面不涉及本文件（本文件未合并 NumericKeypad.xaml，仅合并 BaseStyle.xaml :9）。

## 6. 禁止写法对照

### ❌ 禁止：手写 6 行 StackPanel 全键盘拼装等效输入板（常规 WPF 写法）

```xml
<StackPanel>
    <TextBox Width="360" Height="40" HorizontalContentAlignment="Right"
             InputMethod.IsInputMethodEnabled="False"/>
    <StackPanel Orientation="Horizontal">
        <Button Content="1" Width="28" Height="38" Margin="4,8,4,0"
                Background="#3366FF" FontSize="16" FontWeight="Bold"/>
        <!-- 其余 0~9、- 逐个手写… -->
    </StackPanel>
    <StackPanel Orientation="Horizontal">
        <Button Content="Q" Width="28" Height="38" Margin="4,8,4,8"
                Background="#3366FF" FontSize="16" FontWeight="Bold"/>
        <!-- 三排字母逐个手写，每键重复画刷/尺寸/边距… -->
    </StackPanel>
    <!-- Shift/空格/退出/清空/确认 行还要手画 Path 图标（箭头/退格/空格条）… -->
</StackPanel>
```

### ✅ 推荐：StringNumericKeypad 一行声明

```xml
<s:StringNumericKeypad />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写字符键没有 Hover/Pressed 触发器（StrKeyButtonStyle 模板 Trigger 与 PrimaryBorderBrush 切换），Shift/退出等图标键需手画 Path 且无 StrGrayButtonStyle 灰底态；
2. **② 丢失协议挂点**：Shift/退出/清空/空格/确认 Tag 编号协议（0~4）无载体，字母大小写切换、按键路由全部需要自研事件代码；
3. **③ 无法样式族切换**：字符键（28×38）/功能键（44×38）/确认键（60×38）三档尺寸与三套画刷散写，无法像 StrKeyButtonStyle→StrGrayButtonStyle 一键换型；
4. **⑤ 脱离视觉规范**：Arial 字体族、显示框 360×40 居中右对齐、输入法禁用、阴影 ShadowDepth=3 等规范脱离框架 Token 体系（HeadFontSize/SubHeaderFontSize、画刷键）。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/StringNumericKeypad.xaml`（锚点 `x:Key="StrKeyButtonStyle"`:13、`x:Key="StrSubButtonStyle"`:44、`x:Key="StrGrayButtonStyle"`:75、隐式样式 :106、`x:Name="S_TextB"`/`S_Grid`、Tag 字面量 :169/:181/:190/:192/:200）
- 关联文件：`{source_root}/SDC/Geometries.xaml`（`keyUpperGeometry`:62、`keyBoardEscapeGeometry`:61、`keyBoardSpaceGeometry`:64）；`{source_root}/SDC/Brushes.xaml`、`{source_root}/SDC/Fonts.xaml`（HeadFontSize:5、SubHeaderFontSize:6）
- 家族互引：NumericKeypad（Str 前缀逐键映射，见 numeric-keypad.md）；SwitchKeypad 的字母面板与本控件**布局逐键同构**但键型换 Swi 前缀族（见 switch-keypad.md）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_StringNumericKeypad.xaml.json`

## 8. 待确认项

- TD-030（键盘交互协议 .cs 面）：功能键 Tag 编号语义（本控件 0=Shift/1=ESC/2=Clear/3=Space/4=Confirm）与跨键盘编号不一致（NumericKeypad 0~3、SwitchKeypad 字母面 0~5/数字面 6~10、Big* 家族 Content=Tag）；字母键 Content 与 Tag 大小写约定（本模板字母键 Content 大写、无独立 Tag）
- TD-029（家族键碰撞）：`KeyButtonStyle` 双定义（`{source_root}/SDC/Style/NumericKeypad.xaml:13` vs `{source_root}/SDC/Style/SwitchKeypad.xaml:15`）——本文件不合并两文件，仅作家族共知引用
- TD-032（联动挂点）：`NumericKeypadAttach.IsEnabled` 定义位置与键盘弹出联动机制（见 numeric-keypad.md 第 8 区块）
