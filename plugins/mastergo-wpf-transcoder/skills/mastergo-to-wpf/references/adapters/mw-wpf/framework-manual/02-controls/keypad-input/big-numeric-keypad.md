<!-- evidence=已确认(属性/尺寸/键位/Tag/附加属性引用均为模板源码直接证据；无 P2 页面使用实例); pending=[TD-029,TD-030,TD-031,TD-033];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/BigNumericKeypad.xaml, {source_root}/SDC/Style/BigStringKeypad.xaml, {source_root}/SDC/Style/Button.xaml, {source_root}/ManualView.xaml] -->

# BigNumericKeypad（大数字键盘）

## 1. 用途

数字键盘家族**新一代大键版**：120×53 大键、3 行 4 列自适配网格（`Width/Height=Auto`），数字区外挂**方向键/制表键功能列**（BackTab/UpArrow/Tab、LeftArrow/Shift/RightArrow、BackSpace/DownArrow/Del）与竖排 Enter，Shift 为独立 ToggleButton。与老一代（NumericKeypad 等）的差异：尺寸自适应、无内建显示框、**Tag=Content 协议**、图标经 `controls:ButtonAttach.IconGeometory` 附加属性注入。

典型场景（推断，无 P2 实例）：键盘直控输入（含方向/制表导航）的大键输入面板。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:BigNumericKeypad … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:BigNumericKeypad`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。声明为**隐式默认样式**（无 x:Key，BigNumericKeypad.xaml:79），全局兜底。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（file:line 或锚点） | 状态 |
|---|---|---|---|---|
| Width / Height | Auto（默认） | 自适配内容；模板 `Num_Border` TemplateBinding | BigNumericKeypad.xaml:80-81 + 模板 :88 | ✅ |
| Focusable | bool，默认 False | 控件本体与内部网格、按钮均不可聚焦（键区 :86/:89 + 样式族） | Setter :82 + 模板 :86/:89 | ✅ |
| BorderBrush / BorderThickness / Background | Brush/Thickness/Brush | 外框与衬底；Background 默认 SecondaryBrush（模板硬编码 :87，无 TemplateBinding——注意与老家族不同） | 模板 :86-87 | 🟡 [待确认 TD-030] |
| 功能键 Tag 协议 | Content=Tag 字面量 | 数字键 `Content="7" Tag="7"` 等一致；特殊键：`+/-`、Enter、BackTab、UpArrow、Tab、LeftArrow、Shift、RightArrow、BackSpace、DwArrow、Del——**与老家族 0~10 数字编号体系完全不同** | :108-112/:128-131/:137/:138/:142-144 | 🟡 [待确认 TD-030] |
| controls:ButtonAttach.IconGeometory | Geometry（附加属性） | 图标注入挂点（Enter=NumberEnterGeometry、四方向箭头 UpArrowGeometry 等）；注意**属性拼写为 "Geometory"**（非 Geometry，框架命名疑似笔误），模板消费证据见 Button.xaml:35/102 | :128/:131/:136/:138/:143 | 🟡 [待确认 TD-031] |

## 4. 样式族表（SDC\Style\BigNumericKeypad.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| BigNumericKeypadButtonStyle | `{StaticResource ButtonBaseStyle}`（Button.xaml:93） | 120×53；Focusable=False；FontSize 20；FontWeight Bold；FontFamily Microsoft YaHei；Foreground MenuTextBrush；Margin 2.5 0；Hover/Pressed 走 **DefaultButton_* 画刷组**（Style.Triggers，无独立模板） | 数字/功能主键（Grid.Resources 隐式套用 :91） |
| BigNumericKeypadToggleStyle | 无（独立模板） | 120×53；ToggleButton；独立 ControlTemplate（圆角 3、BorderThickness 2）；Hover 换 DefaultButton_Hover*、**IsChecked 换 DefaultButton_Select*** | Shift 键（T_Shift，:137） |
| keyrow | 无 | StackPanel 行样式：Orientation Horizontal、Margin 2.5、VerticalAlignment/HorizontalAlignment Center/Left | 每行键容器（:107 等） |
| （无键默认样式） | — | TargetType=`controls:BigNumericKeypad` 隐式默认样式，全局兜底 | 未显式指定 Style 时 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 全库 grep `Keypad` 0 命中；Demo（MasterGo_WPF_V0.0.3）无本控件使用。

```xml
<s:BigNumericKeypad />
```

- 键位（模板内建）：数字区 `7 8 9 +/-`、`4 5 6 .`、`1 2 3 0`（:108-126）；竖排 Enter 111×53 图标键（NumberEnterGeometry，Tag=Enter，:128）；功能列 `BackTab/UpArrow/Tab`、`LeftArrow/Shift/RightArrow`、`BackSpace/DwArrow/Del`（:130-145，功能键宽 80、FontSize 18）；
- Shift 为 `ToggleButton`（x:Name="T_Shift"，Style=BigNumericKeypadToggleStyle，:137）；方向/Enter 键经 `controls:ButtonAttach.IconGeometory` 注入几何；
- 注意 Tag 拼写：下行箭头键 Tag=**`"DwArrow"`**（:143，与 UpArrow 不对称，疑似 DownArrow 笔误，BigStringKeypad 同）；
- 与 BigStringKeypad 家族互引：Button/Toggle 双样式 + keyrow 布局逐键同构（见 big-string-keypad.md）。

## 6. 禁止写法对照

### ❌ 禁止：手写 3×4 Grid + 方向键列 + ToggleButton Shift 拼装等效大键盘（常规 WPF 写法）

```xml
<Border Background="#F0F0F0" BorderThickness="1">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/>
        </Grid.ColumnDefinitions>
        <Button Grid.Row="0" Grid.Column="0" Content="7" Tag="7"
                Width="120" Height="53" FontSize="20" FontWeight="Bold"
                Background="#F4F4F4" Margin="2.5,0"/>
        <!-- 8 9 +/-、四行数字、Enter 竖排、方向箭头（手画 Path）逐键手写… -->
        <ToggleButton Grid.Row="1" Grid.Column="2" x:Name="Shift" Content="Shift"
                      Width="80" Height="53" IsChecked="False">
            <!-- 手写 Checked/Unchecked 画刷切换模板… -->
        </ToggleButton>
    </Grid>
</Border>
```

### ✅ 推荐：BigNumericKeypad 一行声明

```xml
<s:BigNumericKeypad />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写键没有 Hover/Pressed（DefaultButton_Hover*/Select* 画刷组）触发器，ToggleButton 需自写 Checked 画刷切换模板（BigNumericKeypadToggleStyle 的 IsChecked→Select 触发器）；
2. **② 丢失协议挂点**：Tag=Content 键值协议与方向键路由、Shift 状态联动无载体，全部需要手写事件代码；
3. **③ 无法样式族切换**：数字键 120×53 / 功能键 80 宽 / Enter 111 竖排 / Toggle 双形态的尺寸协议散写，无法随 BigNumericKeypadButtonStyle→ToggleStyle 换型；
4. **⑤ 脱离视觉规范**：FontSize 20 Microsoft YaHei、Focusable=False 焦点策略、`ButtonAttach.IconGeometory` 图标注入挂点（箭头几何 826 键库）全部脱离框架规范，手画 Path 绕过 Geometry 键体系。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/BigNumericKeypad.xaml`（锚点 `x:Key="BigNumericKeypadButtonStyle"`:14、`x:Key="BigNumericKeypadToggleStyle"`:38、`x:Key="keyrow"`:72、隐式样式 :79、`x:Name="T_Shift"` :137、`controls:ButtonAttach.IconGeometory` :128/:131/:136/:138/:143、Tag 字面量 :108-145）
- 关联文件：`{source_root}/SDC/Style/Button.xaml`（`x:Key="ButtonBaseStyle"`:93，IconGeometory 模板消费 :35/:102）；`{source_root}/SDC/Geometries.xaml`（`NumberEnterGeometry`:90、`UpArrowGeometry`:73、`DownArrowGeometry`:77、`LeftArrowGeometry`:81、`RightArrowGeometry`:86）
- 家族互引：BigStringKeypad（`x:Key="keyrow"` 同名键双定义 `{source_root}/SDC/Style/BigStringKeypad.xaml:72`，见第 8 区块 TD-029；Button/Toggle 双样式 + 右列功能键逐键同构）；老家族 NumericKeypad/SwitchKeypad（Tag 数字编号协议 vs 本族 Content=Tag，见 numeric-keypad.md/switch-keypad.md）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_BigNumericKeypad.xaml.json`

## 8. 待确认项

- TD-029（家族键碰撞）：`keyrow` 同名双定义——`{source_root}/SDC/Style/BigNumericKeypad.xaml:72` 与 `{source_root}/SDC/Style/BigStringKeypad.xaml:72`，**当前内容一致**（StackPanel 横排、Margin 2.5）；两文件互不合并，宿主同时合并两字典时生效者取决于合并顺序（关联 TD-008）；凡引用该键必须写「文件+键」双定位
- TD-030（键盘交互协议 .cs 面）：功能键 Tag 协议（Content=Tag：BackTab/UpArrow/Tab/LeftArrow/Shift/RightArrow/BackSpace/DwArrow/Del 与 Enter 等）语义与老家族 0~10 编号体系不一致；无内建显示框时的值回显机制；BorderBrush/BorderThickness/Background 模板硬编码（Background=SecondaryBrush :87 无 TemplateBinding）是否可覆盖
- TD-031（ButtonAttach 附加属性）：`controls:ButtonAttach.IconGeometory` 拼写（"Geometory"）与参数类型/行为——模板消费证据 Button.xaml:35/102（`{Binding Path=(controls:ButtonAttach.IconGeometory)}`），定义 .cs 不可见（TD-006 延伸）
- TD-033（Tag 拼写疑点）：`Tag="DwArrow"`（:143，与 UpArrow 不对称，疑似 DownArrow 笔误）；`Content="Back&#x0a;Tab"`/`"Back&#x0a;Space"`（:130/:142）换行文本的解析与渲染行为
