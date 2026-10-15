<!-- evidence=已确认(属性/尺寸/键位/Tag/附加属性引用均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-029,TD-030,TD-031,TD-033];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/BigStringKeypad.xaml, {source_root}/SDC/Style/BigNumericKeypad.xaml, {source_root}/SDC/Style/Button.xaml, {source_root}/ManualView.xaml] -->

# BigStringKeypad（大字符串键盘）

## 1. 用途

BigNumericKeypad 的**字母扩展版**：3 行 3 列布局——左列三排字母键（qwerty 排布，第 2/3 行逐行缩进）、中列数字键 + 竖排 Enter、右列功能键区（BackTab/方向/Shift/BackSpace/Del，与 BigNumericKeypad **逐键同构**）。字母键 Content 小写、**Tag 为大写字母**（大小写协议）。行高取 `*` 等分（BigNumericKeypad 为 Auto）。

典型场景（推断，无 P2 实例）：需字母+数字混合输入、带方向/制表导航的大键输入面板。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:BigStringKeypad … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:BigStringKeypad`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。声明为**隐式默认样式**（无 x:Key，BigStringKeypad.xaml:79），全局兜底。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（file:line 或锚点） | 状态 |
|---|---|---|---|---|
| Width / Height | Auto（默认） | 自适配内容；模板 `Num_Border` TemplateBinding | BigStringKeypad.xaml:80-81 + 模板 :88 | ✅ |
| Focusable | bool，默认 False | 控件本体、内部网格与按钮均不可聚焦 | Setter :82 + 模板 :86/:89 | ✅ |
| BorderBrush / BorderThickness / Background | Brush/Thickness/Brush | 外框与衬底；Background 默认 SecondaryBrush（模板硬编码 :87，无 TemplateBinding，同 BigNumericKeypad） | 模板 :86-87 | 🟡 [待确认 TD-030] |
| 功能键/字母 Tag 协议 | 字面量 | 字母键 `Content="q" Tag="Q"`（Content 小写、Tag 大写）；数字键 Content=Tag；功能键 Tag=Enter/BackTab/UpArrow/Tab/LeftArrow/Shift/RightArrow/BackSpace/DwArrow/Del | :107-116/:143-147/:162/:165-180 | 🟡 [待确认 TD-030] |
| controls:ButtonAttach.IconGeometory | Geometry（附加属性） | 图标注入挂点（Enter=NumberEnterGeometry、四方向箭头）；拼写 "Geometory" 同 BigNumericKeypad | :162/:166/:171/:173/:178 | 🟡 [待确认 TD-031] |

## 4. 样式族表（SDC\Style\BigStringKeypad.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| BigStringKeypadButtonStyle | `{StaticResource ButtonBaseStyle}`（Button.xaml:93） | **55×53**（BigNumeric 版为 120×53）；Focusable=False；FontSize 20；FontWeight Bold；FontFamily Microsoft YaHei；Foreground MenuTextBrush；Hover/Pressed 走 DefaultButton_* 画刷组（Style.Triggers，无独立模板） | 字母/数字/功能键（Grid.Resources 隐式套用 :91） |
| BigStringKeypadToggleStyle | 无（独立模板） | **120×53**（跨列大键）；ToggleButton 独立 ControlTemplate；Hover 换 DefaultButton_Hover*、IsChecked 换 DefaultButton_Select* | Shift 键（x:Name="Shift"，:172） |
| keyrow | 无 | StackPanel 行样式：Orientation Horizontal、Margin 2.5、VerticalAlignment/HorizontalAlignment Center/Left | 每行键容器（:106 等） |
| （无键默认样式） | — | TargetType=`controls:BigStringKeypad` 隐式默认样式，全局兜底 | 未显式指定 Style 时 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 全库 grep `Keypad` 0 命中；Demo（MasterGo_WPF_V0.0.3）无本控件使用。

```xml
<s:BigStringKeypad />
```

- 键位（模板内建）：左列字母 `q w e r t y u i o p` / `a s d f g h j k l`（Margin 30 缩进）/ `z x c v b n m -`（Margin 55 缩进）（:107-140）；中列数字 `7 8 9 0`、`4 5 6`、`1 2 3` + 竖排 Enter 109×55 图标键（:143-162）；右列功能键 `BackTab/UpArrow/Tab`、`LeftArrow/Shift/RightArrow`、`BackSpace/DwArrow/Del`（:164-180，宽 80、FontSize 18）；
- Shift 为 `ToggleButton` x:Name="Shift"（无 T_ 前缀，BigNumericKeypad 为 T_Shift，:172）；字母键大小写协议：Content 小写 / Tag 大写（如 `Content="q" Tag="Q"`）；
- 行高为 `*` 等分（:95-97），网格 3 列（:100-104）；注意 Tag 拼写 `"DwArrow"`（:178）与 BigNumericKeypad 一致；
- 与 BigNumericKeypad 家族互引：Button/Toggle 双样式 + `keyrow` 布局 + 右列功能键区逐键同构（仅字母键宽 55 vs 120、行高 * vs Auto、Shift 命名差异）。

## 6. 禁止写法对照

### ❌ 禁止：手写三列 Grid（字母/数字/功能）拼装等效大字符串键盘（常规 WPF 写法）

```xml
<Border Background="#F0F0F0">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="*"/><RowDefinition Height="*"/><RowDefinition Height="*"/>
        </Grid.RowDefinitions>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/>
        </Grid.ColumnDefinitions>
        <StackPanel Grid.Row="0" Grid.Column="0" Orientation="Horizontal">
            <Button Content="q" Tag="Q" Width="55" Height="53" FontSize="20"
                    FontWeight="Bold" Background="#F4F4F4" Margin="2.5,0"/>
            <!-- w e r t y u i o p 逐个手写，三排字母每键重复尺寸/画刷… -->
        </StackPanel>
        <!-- 数字列 + Enter 竖排（手画回车图标）+ 功能键列（方向箭头手画 Path、
             ToggleButton Shift 手写 Checked 模板）… -->
    </Grid>
</Border>
```

### ✅ 推荐：BigStringKeypad 一行声明

```xml
<s:BigStringKeypad />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写键没有 Hover/Pressed（DefaultButton_* 画刷组）触发器；ToggleButton Shift 的 Checked→Select 画刷切换需手写模板；
2. **② 丢失协议挂点**：大小写 Tag 协议（Content 小写/Tag 大写）、功能键 Tag 路由（BackTab/UpArrow/…/DwArrow/Del）无载体，按键路由与 Shift 联动全部自研；
3. **③ 无法样式族切换**：字母键 55×53 / 功能键 80 宽 / Shift 120×53 跨列 / Enter 109 竖排的尺寸协议散写，无法随 BigStringKeypadButtonStyle→ToggleStyle 换型；
4. **⑤ 脱离视觉规范**：FontSize 20 Microsoft YaHei、Focusable=False、`ButtonAttach.IconGeometory` 图标注入（箭头几何 826 键库）与行缩进（30/55）规范脱离，手画 Path 绕过 Geometry 键体系。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/BigStringKeypad.xaml`（锚点 `x:Key="BigStringKeypadButtonStyle"`:14、`x:Key="BigStringKeypadToggleStyle"`:38、`x:Key="keyrow"`:72、隐式样式 :79、`x:Name="Shift"` :172、`controls:ButtonAttach.IconGeometory` :162/:166/:171/:173/:178、Tag 字面量 :107-180）
- 关联文件：`{source_root}/SDC/Style/Button.xaml`（`x:Key="ButtonBaseStyle"`:93，IconGeometory 模板消费 :35/:102）；`{source_root}/SDC/Geometries.xaml`（`NumberEnterGeometry`:90、`UpArrowGeometry`:73、`DownArrowGeometry`:77、`LeftArrowGeometry`:81、`RightArrowGeometry`:86）
- 家族互引：BigNumericKeypad（`x:Key="keyrow"` 同名键双定义 `{source_root}/SDC/Style/BigNumericKeypad.xaml:72`，见第 8 区块 TD-029；右列功能键区逐键同构）；老家族 StringNumericKeypad（字母排布同构但键型/布局体系不同，见 string-numeric-keypad.md）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_BigStringKeypad.xaml.json`

## 8. 待确认项

- TD-029（家族键碰撞）：`keyrow` 同名双定义——`{source_root}/SDC/Style/BigStringKeypad.xaml:72` 与 `{source_root}/SDC/Style/BigNumericKeypad.xaml:72`，**当前内容一致**（StackPanel 横排、Margin 2.5）；两文件互不合并，宿主同时合并两字典时生效者取决于合并顺序（关联 TD-008）；凡引用该键必须写「文件+键」双定位
- TD-030（键盘交互协议 .cs 面）：字母键大小写 Tag 协议（Content 小写/Tag 大写）与功能键 Tag 语义（Content=Tag：Enter/BackTab/…/DwArrow/Del）、Shift 状态联动；无内建显示框时的值回显机制；BorderBrush/BorderThickness/Background 模板硬编码是否可覆盖
- TD-031（ButtonAttach 附加属性）：`controls:ButtonAttach.IconGeometory` 拼写（"Geometory"）与参数类型/行为——模板消费证据 Button.xaml:35/102，定义 .cs 不可见（TD-006 延伸）
- TD-033（Tag 拼写疑点）：`Tag="DwArrow"`（:178，与 UpArrow 不对称，疑似 DownArrow 笔误）；`Content="Back&#x0a;Tab"`/`"Back&#x0a;Space"`（:165/:177）换行文本的解析与渲染行为
