<!-- evidence=已确认(各转换器定义/消费处为模板源码直接证据；类语义部分推断); pending=[TD-006,TD-008,TD-021,TD-027,TD-043,TD-045]; verified=2026-08-14;
     sources=[{source_root}/SDC/Converters.xaml, {source_root}/SDC/Style/TreeView.xaml, {source_root}/SDC/Style/IconButton.xaml, {source_root}/SDC/Style/SideMenu.xaml, {source_root}/SDC/Style/ToggleButton.xaml, {source_root}/SDC/Style/StepFrame.xaml, {source_root}/SDC/Style/Calendar.xaml, {source_root}/SDC/Style/IORangeProgressBar.xaml, {source_root}/SDC/Style/TextBox.xaml, {source_root}/SDC/Style/RadioButtonBaseStyle.xaml, {source_root}/ManualView.xaml] -->

# 转换器族（Converters）

## 1. 用途

框架转换器资源族汇总：各 `IValueConverter`/`IMultiValueConverter` 以资源实例（x:Key）方式注册在各样式文件，`Converter="{StaticResource …}"` 消费。**框架不提供单一 Converters.xaml 聚合**——除 LineConverter 外，转换器键按需定义在消费文件本地（同键多定义模式，见下）。

与既有笔记的关系：01-resources/effects-converters.md 仅覆盖 Converters.xaml 的 LineConverter 单键；本条目以全库 grep 为准补全全部 x:Key 证据并交叉核对。

## 2. 声明

```xml
<!-- 定义侧（消费文件本地资源） -->
<Style.Resources>
    <tools:BoolToVisibilityConverter x:Key="B2CConverter"/>
</Style.Resources>
<!-- 消费侧 -->
<Border Visibility="{Binding IsShowStatus, Converter={StaticResource B2CConverter}}" …/>
```

- `tools` = `clr-namespace:MaxwellControl.Tools`、`controls` = `clr-namespace:MaxwellControl.Controls`、`mw` = `clr-namespace:MaxwellControl.Tools`（IORangeProgressBar.xaml 的声明前缀）；
- 转换器类归属：多数在 MaxwellControl.Tools；**TreeViewLineConverter 在 MaxwellControl.Controls**（Converters.xaml:6 原样 `controls:` 前缀）。

## 3. 转换器总表

| x:Key | 类 | 用途（推断 + 证据） | 定义位置 | 消费处 | 状态 |
|---|---|---|---|---|---|
| LineConverter | controls:TreeViewLineConverter | 树形连接竖线高度计算；5 参 MultiBinding（TreeView ActualHeight/ActualWidth + TemplatedParent + Self + Expander.IsChecked）→ VerLn Rectangle.Height | Converters.xaml:6 + TreeView.xaml:11（**双定义**） | TreeView.xaml:68/:150 | 🟡 [TD-043] |
| B2CConverter | tools:BoolToVisibilityConverter | bool→Visibility（True=Visible） | IconButton.xaml:8、SideMenu.xaml:9/397、ToggleButton.xaml:265（**四处同键**） | IconButton.xaml:51、SideMenu.xaml:156/242/539/642、ToggleButton.xaml:293 | ✅ 参数实例化确认 |
| B2VConverter | tools:BoolToVisibilityConverter | 同上（独立键名） | TreeView.xaml:12 | 零消费（死键） | 🟡 |
| T2BConverter | tools:IsRootNodeConverter | 根/子节点判定 → Icon 尺寸/字号切换 | TreeView.xaml:13 | TreeView.xaml:176/:337（根节点判定 → Icon 13px / FontSize 14） | 🟡 [TD-043] |
| K2BConverter | tools:KeyToResourceConverter | 键→资源转换（推断） | TreeView.xaml:16 | 零消费 | ❓ [TD-043] |
| KeyToResourceConverter | tools:KeyToResourceConverter | 同 K2BConverter（键名不同） | RadioButtonBaseStyle.xaml:10 | 零消费 | ❓ |
| multiBooleanConverter | tools:MultiBooleanConverter | 多 bool 合取 → IsStepButtonEnabled（IsStepButtonEnabled 双绑两次） | StepFrame.xaml:11 | StepFrame.xaml:37/146/190/408 | 🟡 [TD-021] |
| IndexConverter | tools:IndexConverter | 序号→文本（步骤编号显示） | StepFrame.xaml:13 | StepFrame.xaml:263/311/361（TemplatedParent→序号文本） | 🟡 [TD-021] |
| MonthNameConverter | tools:MonthNameConverter | 月份名转换（月份头显示） | Calendar.xaml:13 | Calendar.xaml:29（`Text="{Binding Content,…,Converter={StaticResource MonthNameConverter}}"`） | 🟡 [TD-045] |
| ProgressWidthConverter | mw:ProgressWidthConverter | 进度条宽计算（推断）；模板 PART_Indicator Width=0 静态 | IORangeProgressBar.xaml:7 | 零消费 | ❓ [TD-027] |
| WordAngleConverter | tools:WordAngleConverter | 文字角度转换（推断） | Dashboard.xaml:9 | 零消费 | ❓（图表批） |
| bVisiableConverter | 原生 BooleanToVisibilityConverter | bool→Visibility（页面级直配原生） | TextBox.xaml:78 | 零消费（死键） | 🟡 |
| DataGrid.HeadersVisibilityConverter | 原生 `x:Static`（DataGrid 类内置） | 列头/全选可见性 | —（框架内置） | DataGrid.xaml:418/424/592/598/792/798、IODataGrid.xaml:323/330 | ✅（原生） |

**LineConverter 双定义比对结论**（Converters.xaml:6 vs TreeView.xaml:11）：类名（`controls:TreeViewLineConverter`）、键名（LineConverter）、属性配置（零属性）**逐字相同**，仅缩进/换行空白差异。语义要点：TreeView.xaml 自包含（:8 仅合并 BaseStyle.xaml，**不合并 Converters.xaml**）；Converters.xaml 为全局顶层字典——双定义来源相同，无行为分歧；重复定义的字典合并顺序语义见 TD-008。

**同键多定义模式**：B2CConverter 四处定义内容相同（工具类 + 键 + 零参数）——「消费文件本地注册」模式而非全局共享；该模式下各定义独立存在，改动需同步四处。

## 4. 样式族表

无（本条目为资源族汇总，非样式族；消费样式见各控件条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零转换器引用（`Converter` grep 零命中）。以下为 P1 模板证据构造。

```xml
<Border Visibility="{Binding IsShowStatus,
        Converter={StaticResource B2CConverter}}"/>
```

- 优先复用消费文件/全局已注册键（B2CConverter、LineConverter 等）；页面级场景走自定义绑定 + 原生 BooleanToVisibilityConverter（TextBox.xaml:78 先例）；
- 多值合并（步骤启用）用 multiBooleanConverter；树形视觉用 T2BConverter/LineConverter；
- 页面如需新转换器，参照 B2CConverter 模式在页面资源注册同名键即可覆盖族默认（同名覆盖语义见 TD-029 同类键覆盖）。

## 6. 禁止写法对照

### ❌ 禁止：页面内重复定义等效资源/自建转换器（等效替代）

```xml
<UserControl.Resources>
    <BooleanToVisibilityConverter x:Key="MyVisConverter"/>
</UserControl.Resources>
<!-- 或更糟：代码后置 new IValueConverter 逐处绑定 -->
```

### ✅ 推荐：复用框架键

```xml
<Border Visibility="{Binding IsShowStatus, Converter={StaticResource B2CConverter}}"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **④ 重复造轮子**：框架已注册 B2CConverter/LineConverter 等键，页面内重复定义违反「不重新发明已有框架能力」（framework.config.json 规则 4）；
2. **③ 无法统一调整**：转换逻辑（bool 映射、树高计算）分散定义后调参无法全局生效——框架转换器族统一治理失效；
3. **① 状态一致性**：自建转换器实例化时机/线程亲和与框架约定不一致，跨模板复用时行为分叉；
4. **⑤ 资源职责混乱**：公共转换器应只注册于框架样式文件，页面散写资源归属失控（05-best-practices/resource-usage.md）。

## 7. 参考锚点

- 全局字典：`{source_root}/SDC/Converters.xaml`（:6 LineConverter）
- 树形族：`{source_root}/SDC/Style/TreeView.xaml`（:8 仅合并 BaseStyle.xaml；LineConverter :11/:68/:150、B2VConverter :12、T2BConverter :13/:176/:337、K2BConverter :16）
- 布尔族：`{source_root}/SDC/Style/IconButton.xaml`（:8/:51）、`{source_root}/SDC/Style/SideMenu.xaml`（:9/:156/:242、:397/:539/:642）、`{source_root}/SDC/Style/ToggleButton.xaml`（:265/:293）
- 步骤族：`{source_root}/SDC/Style/StepFrame.xaml`（multiBooleanConverter :11/:37/:146/:190/:408、IndexConverter :13/:263/:311/:361）
- 其他：`{source_root}/SDC/Style/Calendar.xaml`（MonthNameConverter :13/:29）、`{source_root}/SDC/Style/IORangeProgressBar.xaml`（ProgressWidthConverter :7）、`{source_root}/SDC/Style/TextBox.xaml`（bVisiableConverter :78）、`{source_root}/SDC/Style/RadioButtonBaseStyle.xaml`（KeyToResourceConverter :10）、`{source_root}/SDC/Style/Dashboard.xaml`（WordAngleConverter :9）
- 真实使用：无（ManualView.xaml 不含转换器引用）
- 索引交叉：`{index_root}/files/refence_SDC_Converters.xaml.json`、`{index_root}/files/refence_SDC_Style_TreeView.xaml.json` 等

## 8. 待确认项

- **TD-043**（复用）：TreeView 家族转换器语义（LineConverter 五参计算、T2BConverter 根判定、K2BConverter 键→资源）——MultiBinding 参数结构与模板消费为直接证据，转换逻辑 .cs 不可见。
- **TD-021**（复用）：multiBooleanConverter 双绑 IsStepButtonEnabled 两次与 IndexConverter 序号语义。
- **TD-027**（复用）：ProgressWidthConverter 定义存在但零消费（模板 PART_Indicator Width=0 静态）——是否遗留键待确认。
- **TD-045**（复用）：MonthNameConverter 月份名转换语义。
- **TD-006**（复用）：转换器类全集与命名空间归属（tools vs controls vs mw 前缀并存）；B2CConverter 四处同键定义的维护策略。
- **TD-008**（复用）：重复键定义的字典合并顺序语义（LineConverter 双定义、B2CConverter 四定义）。
