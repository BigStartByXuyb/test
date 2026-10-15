<!-- evidence=已确认(属性/尺寸/双面板结构/Tag 字面量均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-029,TD-030,TD-032];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/SwitchKeypad.xaml, {source_root}/SDC/Style/NumericKeypad.xaml, {source_root}/SDC/Style/StringNumericKeypad.xaml, {source_root}/ManualView.xaml] -->

# SwitchKeypad（数字/字母可切换键盘）

## 1. 用途

NumericKeypad 与 StringNumericKeypad 的**合体切换版**：同一控件内建两个自包含面板——数字面板（默认可见，285×226 停靠左上）与字母面板（500×240，初始 `Visibility="Hidden"`），由 .cs 按切换协议互斥显隐。数字面板与 NumericKeypad 键位逐键同构，字母面板与 StringNumericKeypad 布局逐键同构但键型换 **Swi 前缀族**。

典型场景（推断，无 P2 实例）：同一输入点按需在数字/字母两键盘间切换的弹板。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:SwitchKeypad … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:SwitchKeypad`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。声明为**隐式默认样式**（无 x:Key，SwitchKeypad.xaml:138），全局兜底。

**注意键碰撞**：本文件合并 `NumericKeypad.xaml`（:10），并在 :15 **重定义同名键 `KeyButtonStyle`**（对比 `{source_root}/SDC/Style/NumericKeypad.xaml:13`）。凡引用该键必须写「文件+键」双定位（见第 8 区块 TD-029）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（file:line 或锚点） | 状态 |
|---|---|---|---|---|
| Width / Height | double，默认 500×240 | 控件整体尺寸（即字母面板尺寸）；模板 `Str_Border` 直接 TemplateBinding | SwitchKeypad.xaml:139-140 + 模板 :148-151 | ✅ |
| BorderBrush | Brush，默认 PrimaryDefaultBrush | 两面板边框色（Str_Border :149、Num_Border :230） | Setter :141 + 模板 | ✅ |
| BorderThickness | Thickness，默认 3 | 两面板边框厚度 | Setter :142 | ✅ |
| Background | Brush，默认 ThirdlyLightToolBrush | 字母面板键区衬底（`S_Grid Background` :155）；数字面板键区衬底亦取 TemplateBinding（:242） | Setter :143 + 模板 :155/:242 | ✅ |
| （模板命名部件） | CT_Grid / Str_Border / S_TextB / S_Grid / Num_Border / G_TextB / G_Grid | 双面板 + 各自显示框/键区；**字母面板初始 `Visibility="Hidden"`**（:151），显隐切换驱动 .cs 不可见 | 模板 :147-151/:155/:164/:229/:241/:243 | 🟡 [待确认 TD-030] |
| 功能键 Tag 协议（字母面） | Tag 0~5 | 字面量：0=Shift（keyUpperGeometry）、1=退出（keyBoardEscapeGeometry）、2=清空（ControlClear）、3=空格（keyBoardSpaceGeometry）、4=⇄（Content 文本 `"⇄"`）、5=确认（ControlConfirm） | :192/:204/:213/:215/:223/:224 | 🟡 [待确认 TD-030] |
| 功能键 Tag 协议（数字面） | Tag 6~10 | 字面量：6=退出、7=清空、8=⇄、9=退格（SubGeometry 横杠）、10=确认——**与 NumericKeypad 的 0~3 编号体系不同** | :263/:275/:279/:280/:285 | 🟡 [待确认 TD-030] |

## 4. 样式族表（SDC\Style\SwitchKeypad.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| KeyButtonStyle（本地 :15） | 无（独立） | 65×40；与 NumericKeypad.xaml:13 同名键**内容一致**（PrimaryDefaultBrush 底/TextBrush 字/HeadFontSize Bold/圆角 3），本地定义覆盖合并项 | 数字面板主键（Grid.Resources 隐式 BasedOn :245） |
| SwiKeyButtonStyle | 无（独立） | 40×40；PrimaryDefaultBrush 底 + **FontFamily=Arial**；HeadFontSize(16) Bold；Hover/Pressed 同画刷切换 | 字母面板字符键 |
| SwiSubButtonStyle | 无（独立） | 70×40；ThirdlyDeepGradientBrush 渐变底 + PrimaryDefaultBrush 字；Pressed BorderThickness=0 + Revert 渐变 | 字母面板确认键（:224） |
| SwiGrayButtonStyle | 无（独立） | 50×40；SecondaryBrush 灰底 + PrimaryTextBrush 字；Hover/Pressed 换 SecondaryDeepBrush | 字母面板功能键（Shift/退出/清空/⇄） |
| GrayButtonStyle / SubButtonStyle | 无（独立） | **引用 NumericKeypad.xaml 的同名键**（本文件未重定义）；数字面板功能键用 GrayButtonStyle（:263/:275/:279/:280/:284）、确认键用 SubButtonStyle 65×40 单格（:285，NumericKeypad 版为 50×83 跨 2 格） | 数字面板功能/确认键（跨文件键引用） |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 全库 grep `Keypad` 0 命中；Demo（MasterGo_WPF_V0.0.3）无本控件使用。

```xml
<s:SwitchKeypad />
```

- 初始显示数字面板；切字母面板由 .cs 控制 `Str_Border` 的 Visibility（模板内无切换触发器，属 .cs 行为面）；
- 数字面板键位与 NumericKeypad 逐键同构（1~9、0、.、ESC 图标、清空、退格横杠），仅确认键由 50×83 跨格改为 65×40 单格、Tag 编号整体平移为 6~10；
- 字母面板键位与 StringNumericKeypad 逐键同构（数字行并入字母行的布局仅保留字母三排 + 功能底行），键型换 Swi 前缀族（40×40 vs 28×38）；
- 面板内容与键位均内建于模板，页面只放置元素。

## 6. 禁止写法对照

### ❌ 禁止：手写双面板 Grid + 代码切 Visibility 拼装等效可切换键盘（常规 WPF 写法）

```xml
<Grid>
    <StackPanel x:Name="NumPanel" Visibility="Visible">
        <!-- 1~9、0、.、ESC/清空/退格/确认 手写 4×4 网格，每键重复尺寸/画刷… -->
    </StackPanel>
    <StackPanel x:Name="StrPanel" Visibility="Collapsed">
        <!-- 三排字母 + Shift/空格/退出/清空/确认 手写 6 行，
             图标键手画 Path（keyUpper/escape/space 几何复制粘贴）… -->
    </StackPanel>
</Grid>
<!-- 代码：NumPanel.Visibility 与 StrPanel.Visibility 互斥切换、
     两套 Tag 路由、Shift 大小写逻辑全部手写 -->
```

### ✅ 推荐：SwitchKeypad 一行声明

```xml
<s:SwitchKeypad />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：两套键族（Swi* 40×40 字符键 / Gray、Sub 功能键）的 Hover/Pressed 触发器与三档画刷切换丢失，图标键需手画 Path；
2. **② 丢失协议挂点**：双面板显隐切换、功能键 Tag 编号协议（字母面 0~5 / 数字面 6~10）无载体——面板切换、按键路由、Shift 行为全需自研代码；
3. **③ 无法样式族切换**：数字面板复用 NumericKeypad 键族、字母面板换 Swi 键族的两套组合散写，无法随框架样式族整体换型；
4. **⑤ 脱离视觉规范**：双面板 285×226/500×240 尺寸协议、阴影（ShadowDepth 3 字母面 / 2 数字面）、Arial 键字、输入法禁用等规范脱离框架 Token 体系。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/SwitchKeypad.xaml`（锚点 `x:Key="KeyButtonStyle"`:15、`x:Key="SwiKeyButtonStyle"`:45、`x:Key="SwiSubButtonStyle"`:76、`x:Key="SwiGrayButtonStyle"`:107、隐式样式 :138、`x:Name="Str_Border"` Visibility="Hidden" :151、`x:Name="Num_Border"` :229、Tag 字面量 :192/:204/:213/:215/:223/:224/:263/:275/:279/:280/:285）
- 关联文件：`{source_root}/SDC/Style/NumericKeypad.xaml`（合并源 :10，`KeyButtonStyle` :13 同名键、`GrayButtonStyle` :74、`SubButtonStyle` :43 跨文件引用）；`{source_root}/SDC/Geometries.xaml`（keyUpperGeometry:62、keyBoardEscapeGeometry:61、keyBoardSpaceGeometry:64、SubGeometry:49）
- 家族互引：NumericKeypad（数字面板键位同构）、StringNumericKeypad（字母面板布局同构，键型换 Swi 族）、Big* 家族（新一代 Tag=Content 协议，见 big-numeric-keypad.md）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_SwitchKeypad.xaml.json`

## 8. 待确认项

- TD-029（家族键碰撞）：`KeyButtonStyle` 同名双定义——`{source_root}/SDC/Style/SwitchKeypad.xaml:15`（本地）vs `{source_root}/SDC/Style/NumericKeypad.xaml:13`（合并项）。本文件 MergedDictionaries 含 NumericKeypad.xaml（:10），WPF 合并顺序下**本地定义生效**（内容当前一致，单方修改即分叉，生效语义关联 TD-008 宿主合并顺序）；凡引用该键必须写「文件+键」双定位
- TD-030（键盘交互协议 .cs 面）：双面板 Visibility 切换驱动与功能键 Tag 编号语义（本控件字母面 0~5 / 数字面 6~10 与 NumericKeypad 0~3、StringNumericKeypad 0~4 编号体系不一致）；`Content="⇄"`（:223/:279）切换键语义待确认
- TD-032（联动挂点）：`NumericKeypadAttach.IsEnabled` 定义位置与键盘弹出联动机制（见 numeric-keypad.md 第 8 区块）
