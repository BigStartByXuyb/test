# 待确认事项说明文档

<!-- evidence=结构性文档; verified=2026-08-14; sources=[05-best-practices/pending-confirmations.md, 各条目] -->

> **给框架作者/维护者的确认清单**：每条 = 白话问题 + 当前证据 + 指向的框架文件 + 建议验证方式。编号与台账 `pending-confirmations.md` 一一对应，回填后两处同步更新。
>
> 背景：框架控件实现全在私有程序集 MaxwellControl（.cs 本地不可见），手册只能从 XAML 样式层推断使用面。以下事项均属"样式层说不清、必须问人"的部分。

## 一、协议类（TD-001~004）—— 最优先，影响所有页面

**TD-001 IOEnable 设备条件表达式**
- 问题：`IOEnable="CTC.RUN==0 && CTC.Transfer==0"` 的表达式语法全集是什么？`CTC` 数据从哪来？条件不满足时是禁用/拦截/隐藏？与 `IsEnabled` 什么关系？
- 证据：`{source_root}/ManualView.xaml` 15 处调用（全在 IconButton）；`{source_root}/SDC/` 全库模板 grep `IOEnable` **零命中**（见 TD-022）——联锁逻辑只在 .cs。
- 怎么确认：框架作者给出 IOEnable 属性定义与解析器说明；或 Demo 实测（改表达式看按钮行为）。

**TD-002 s:Action 动作协议**
- 问题：`Click="{s:Action Name}"` 返回委托/命令/框架代理？动作名解析到哪里？异步与异常怎么处理？
- 证据：`{source_root}/ManualView.xaml` 9 个动作名（LoadWaferToCutStage 等）。
- 怎么确认：框架作者给出 Action 标记扩展源码；或反编译 MaxwellControl。

**TD-003 PageName 跳转协议**
- 问题：`Jump:ManualAlignView:ini:Manual:True` 各冒号段语义？页面注册机制？与 Click 共存时优先级？
- 证据：`{source_root}/ManualView.xaml` 7 种形式（Jump:…:ini、Jump:…:ini:…:True、Jump:Home 等）。
- 怎么确认：框架作者给出跳转协议文档/解析代码。

**TD-004 文本键定义位置**
- 问题：`{DynamicResource ManualOperationLoad}` 等 15 个文本键在 refence 内找不到定义——定义在哪个语言资源字典？切换机制？
- 证据：`{source_root}/ManualView.xaml` 的 Content/IconText 引用；SDC 全库无定义。
- 怎么确认：提供宿主项目的语言资源文件位置。

## 二、资源与加载（TD-005~009）

**TD-005 ✅ 已回填**（2026-08-13）：`Button_IconWidth/Height` 定义于 `{source_root}/SDC/Sizes.xaml`（20×20），样式覆盖值见 icon-button 条目。

**TD-006 附加属性族**
- 问题：BorderElement/IconElement/TitleElement/WatermarkElement/DataGridAttach/TabControlAttach/NumericKeypadAttach/PasswordBoxAttach/TextBoxAttach/DropDownElement/ButtonAttach 的参数类型、默认值与运行时行为。
- 证据：`{source_root}/SDC/FrameworkGeneric.xaml` 与各样式文件中的 `controls:XXX.YYY` 绑定。
- 怎么确认：MaxwellControl 源码或反编译。

**TD-007 画刷冻结**
- 问题：`o:Freeze="True"`（`{source_root}/SDC/Brushes.xaml` 几乎全部画刷）实际冻结行为、DynamicResource 换色与主题切换是否受影响。

**TD-008 宿主加载顺序**
- 问题：refence 本体没有 App.xaml；完整合并顺序（含 Brushes/、Geometries、FrameworkGeneric、Style/* 的加入位置）与外部程序集来源。
- 证据：`{demo_root}/App.xaml` 只有 Demo 精简版顺序。
- 关联：TD-026/028 的资源键双定义问题都要靠合并顺序定性。

**TD-009 KeyInputEnabled**
- 问题：`{source_root}/SDC/Fonts.xaml` 里的 `KeyInputEnabled=false`（Boolean）是什么开关？

## 三、窗口与导航（TD-010~021）

| TD | 一句话问题 | 指向文件 |
|---|---|---|
| TD-010 | MessageBox 的 PART_Panel 按钮注入方式、Show 调用面、五色画刷族与 MessageBoxInfo/AskGeometry 配对语义 | `{source_root}/SDC/Style/MessageBox.xaml`；`{source_root}/SDC/Brushes.xaml` MessageBox* 键；`{source_root}/SDC/Geometries.xaml` |
| TD-011 | 窗口语义属性族（IsFullScreen/HideAllButton/HideMinMaxButton/NonClientAreaHeight/CloseButtonVisible）定义与默认值；CornerRadiusWindow 圆角硬编码 6 6 0 0 是否该可配置；WindowBaseButton 双文件同名键的合并顺序 | `{source_root}/SDC/Style/CommonWindow.xaml`；`{source_root}/SDC/Style/CornerRadiusWindow.xaml` |
| TD-012 | StatusButton 状态属性名与取值（ON/OFF）及 VisualState 激活机制（GoToState 在 .cs） | `{source_root}/SDC/Style/StatusButton.xaml`（StatusStates 两态） |
| TD-013 | IconControl 着色机制：模板 Fill 硬编码 Black，无 Foreground/TemplateBinding | `{source_root}/SDC/Style/IconControl.xaml` |
| TD-014 | 四个 StyleSelector 的选取规则：ButtonGroupItemStyleSelector（映射 6 个 ButtonGroupItem*）+ Menu 的 MenuItem/NarrowMenuItem/ContextMenuItem | `{source_root}/SDC/Style/Button.xaml`（ButtonGroupItem* 族）；`{source_root}/SDC/Style/Menu.xaml` |
| TD-015 | NarrowMenuStyle 的 Foreground 与 Background 同值（ThirdlyLightGradientBrush）疑似笔误 | `{source_root}/SDC/Style/Menu.xaml`（NarrowMenuStyle） |
| TD-016 | ToolBar 三处疑似调试遗留：ToolBarTray Background=Blue；水平模板溢出 Popup WarningBrush/Red；垂直 Thumb 用 CalendarGeometry | `{source_root}/SDC/Style/ToolBar.xaml` |
| TD-017 | DefaultLabelPanel 在 Lable.xaml 与 Dashboard.xaml 同名双定义及挂载场景 | `{source_root}/SDC/Style/Lable.xaml`；`{source_root}/SDC/Style/Dashboard.xaml` |
| TD-018 | SideMenu 语义属性族（Role 取值全集/ExpandMode 全集与默认/ItemPadding 默认）+ 外部资源 CirclePointGeometry 仅被引用无定义 | `{source_root}/SDC/Style/SideMenu.xaml` |
| TD-019 | SideMenu 尺寸 Token 用途：SideMenuBox* 样式族内无引用；MaxwellFramework_SideMenuWidth/Height（85/855）全库零引用疑似遗留 | `{source_root}/SDC/Sizes.xaml` |
| TD-020 | StepFrame 内容流动：SelectedContent 来源、CanRebackStep 类型与 bool→Visibility 机制、Status 三态置位驱动 | `{source_root}/SDC/Style/StepFrame.xaml` |
| TD-021 | StepFrame 转换器疑点：multiBooleanConverter 双绑同一属性、IndexConverter 仅注释旧模板引用、垂直 ItemsPanel 预留、返回文本键不一致（ControlBack vs Back） | `{source_root}/SDC/Style/StepFrame.xaml` |

## 四、IO 系列（TD-022~028）

| TD | 一句话问题 | 指向文件 |
|---|---|---|
| TD-022 | **IO 家族「IO」语义与 IOEnable 挂载方式**：15 个 IO 模板全部零引用 IOEnable，设备联锁是否在 .cs 属性面？ | 15 个 `{source_root}/SDC/Style/IO*.xaml` 阴性证据；`{source_root}/ManualView.xaml`（IconButton 15 处） |
| TD-023 | IO 与原生模板五对同构（IOCheckBox/CheckBox、IORadioButton/RadioButton、IOToggleButton、IOButton/Button、IOGroupBox/GroupBox），IO 版真实差异在 .cs 行为面的哪些能力？ | 五对 `{source_root}/SDC/Style/` 文件对比 |
| TD-024 | IO 状态/驱动语义：IOStatusLight 状态属性名与激活机制、IOTextBlock `Foreground={Binding StatusColor}` 数据源、IOProgressBar 属性集 .cs 默认值 | `{source_root}/SDC/Style/IOStatusLight.xaml`、`IOTextBlock.xaml`、`IOProgressBar.xaml` |
| TD-025 | IO 尺寸硬编码与 Token 矛盾：IORadioButton 13×13/7×7 无 Token；StatusLight Token 13×13 vs 模板 20×20；IOTabControl/IODataGrid 多处硬编码 | 对应 IO 模板字面量 vs `{source_root}/SDC/Sizes.xaml` |
| TD-026 | IO 相关资源键零引用/双定义/仅引用（RadioButton_UnSelectDisabledBrush、ComboBox_DisabledBackBrush、DataGrid_InnerBorderBrush/ColumnHeaderTextBrush、ProgressBoxFillBrush 双定义、GroupBoxHeaderGeometry 无定义、ContentGroupBoxStyle 与 IORangeProgressBar 隐式样式双文件） | 对应 `{source_root}/SDC/Style/` 与 `{source_root}/SDC/Brushes/` 文件 |
| TD-027 | IO 特殊实现疑点：`IOToggleButtonBaeControlTemplate` 拼写、IOListBox AlternationCount 注释块、IORangeProgressBar 值属性与 ProgressWidthConverter 消费、IOTextBlock/IOImage/IOProgressBar 基类、IOTextBox SelectAll | 对应 IO 模板文件 |
| TD-028 | IODataGrid 跨文件依赖：DataGridComboBoxTemplate 只定义在非 IO 版 DataGrid.xaml 而 IODataGrid.xaml 未合并——靠宿主字典顺序解析 | `{source_root}/SDC/Style/IODataGrid.xaml` vs `{source_root}/SDC/Style/DataGrid.xaml` |

## 五、输入键盘与表格树（TD-029~046）

| TD | 一句话问题 | 指向文件 |
|---|---|---|
| TD-029 | KeyButtonStyle / keyrow 同名双定义（两处内容逐属性比对一致）——合并后哪份生效？是否应收敛为一处定义防分叉？ | `{source_root}/SDC/Style/NumericKeypad.xaml` vs `SwitchKeypad.xaml`；`BigNumericKeypad.xaml` vs `BigStringKeypad.xaml` |
| TD-030 | 键盘交互协议 .cs 面：功能键 Tag 编号跨键盘不一致（0~3 / 0~4 / 字母面 0~5+数字面 6~10 / Big* 用 Content=Tag）；SwitchKeypad 双面板切换、Shift 大小写联动、Big* 无内建显示框的值回显、模板硬编码画刷可覆盖性 | `{source_root}/SDC/Style/NumericKeypad.xaml`、`StringNumericKeypad.xaml`、`SwitchKeypad.xaml`、`BigNumericKeypad.xaml`、`BigStringKeypad.xaml` |
| TD-031 | `ButtonAttach.IconGeometory` 附加属性拼写（"Geometory" 疑为 Geometry 笔误）与参数类型/行为 | `{source_root}/SDC/Style/BigNumericKeypad.xaml`、`BigStringKeypad.xaml`；消费处 `{source_root}/SDC/Style/Button.xaml:35/102` |
| TD-032 | `NumericKeypadAttach.IsEnabled` 在 SDC 全库 grep 零定义（README 曾记 FrameworkGeneric.xaml）——定义在哪？被 NumberBox 系列 Trigger 消费、键盘自身模板零引用是为何？ | `{source_root}/SDC/Style/IntNumberBox.xaml:121`、`NumberBox.xaml:179`、`StringNumberBox.xaml:105`、`SwitchBox.xaml:103` |
| TD-033 | Big* 键盘 Tag="DwArrow" 拼写疑点（疑似 DownArrow 笔误）；Content="Back&#x0a;Tab" 换行文本解析行为 | `{source_root}/SDC/Style/BigNumericKeypad.xaml`、`BigStringKeypad.xaml` |
| TD-034 | NumberBox/IntNumberBox 的 Value/Minimum/Maximum 类型与钳制语义、ShowUpDownButton/UseTriangleGeometry 默认值、ControlCommands.Prev/Next 增减映射 | `{source_root}/SDC/Style/NumberBox.xaml`、`IntNumberBox.xaml`；联动证据 `Slider.xaml:305`、`IOListBox.xaml:130`、`DateTimeSelector.xaml:35-43`、`Pagination.xaml:65-73` |
| TD-035 | 键垫弹出机制：`NumericKeypadAttach.IsEnabled` 触发后 Pop_keyBoard 内容注入与 PART_TextBox Focusable=False 联动；PasswordBox 模板无此 Trigger 却具 Pop_keyBoard（关联 TD-032） | 输入框家族各模板 |
| TD-036 | IsWaitingAccept 语义与 oldValueBorder 历史值来源（oldValueBlock 无绑定，.cs 注入）；三件套裸 oldValueBlock 无触发器是否死元素；IntNumberBox 左右变体无此能力 | `{source_root}/SDC/Style/NumberBox.xaml:149-162/252-254`、`StringNumberBox.xaml:95` |
| TD-037 | SwitchBox/SwitchPasswordBox 的「Switch」语义——与 StringNumberBox 模板逐行同构仅宿主类型（TextBox/PasswordBox）不同，真实差异是什么？ | 三文件模板逐行对比 |
| TD-038 | PasswordBoxAttach.IsMonitoring/PasswordLength 行为、controls:PasswordBox 与原生 PasswordBox 关系；LoginPasswordBox（PasswordBox.xaml）与 LoginPasswordBoxStyle（FrameworkGeneric.xaml）双定义合并语义 | `{source_root}/SDC/Style/PasswordBox.xaml:23/72/127`；`{source_root}/SDC/FrameworkGeneric.xaml:501-561` |
| TD-039 | ErrorStr 属性语义与错误画刷家族差异（红画刷 vs WarningBrush）；重复 IsReadOnly Trigger 死代码；IntNumberBox 开 Poptip.IsOpen 但模板无 Poptip.Instance；CornerRadius=3 硬编码未走 BorderElement | `{source_root}/SDC/Style/IntNumberBox.xaml:182-198/295-303`、`StringNumberBox.xaml:134-145` |
| TD-040 | SearchBox 的 SearchContent 绑定行为（单向/双向、更新时机）与搜索触发协议（搜索按钮无 Command 绑定，.cs 行为面） | `{source_root}/SDC/Style/SearchBox.xaml:86-87` |
| TD-041 | DataGrid 家族：PagableDataGrid/RowFreezableDataGrid 是否独立控件类型（模板 TargetType 均为原生 DataGrid）；PagableDataGrid 无具名样式键；FrozenRowSource/SelectedIndex 运行时语义；基版 Storyboard 无 EventTrigger 挂载、SortArrow 无触发器（滚动条淡入淡出/排序箭头疑似失效） | `{source_root}/SDC/Style/DataGrid.xaml`（RowFreezableDataGridStyle 490、隐式 PagableDataGrid 686、PART_DataGrid 608、Storyboard1 356/529/726、SortArrow 250） |
| TD-042 | Pagination 属性语义与 .cs 机制（DataCount/Index/PageCount/CanGo*）、按钮 Tag 0/1/3/5/6 分段（2、4 未占用）、S_ComboB 注入、StringFormat=/{0} | `{source_root}/SDC/Style/Pagination.xaml` |
| TD-043 | TreeViewEx 与原生 TreeView 真实差异、LineConverter/T2BConverter/K2BConverter 计算规则、Icon 绑定源约定、ShowBackground 运行时行为、TreeViewListNoBdStyle 默认 IsExpanded=True | `{source_root}/SDC/Style/TreeView.xaml`（LineConverter 11、T2BConverter 13、Binding Icon 165/322、ShowBackground 528） |
| TD-044 | MultiComboBox 搜索/全选联动/勾选项汇总规则；SingleComboBox 空 PopupEx 的弹层注入与回写；LoggerViewInputQueryKeyword 跨业务键引用 | `{source_root}/SDC/Style/ComboBox.xaml`（PART_ListBoxSearch 367/461、PART_SelectAllBox 353/442、隐式 SingleComboBox 686） |
| TD-045 | CalendarExtend 的 PART_CalendarPresenter 注入与 ShowConfirmButton 运行时语义；"Calender" 键名拼写（CalenderHeaderButtonBaseStyle/CalenderSelectorButtonBase）；MonthNameConverter 规则 | `{source_root}/SDC/Style/Calendar.xaml`、`CalendarExtend.xaml`（PART_CalendarPresenter 62、ShowConfirmButton 52、CalenderSelectorButtonBase 10） |
| TD-046 | 日期联动回写（TextOfTextBlock）；DateTimePicker PART_Now/Clear/Confirm 行为 + PART_ButtonsBorder 残留 Grid.Row=1；DatePickerExtend PART_Popup 模板为空；键名 DateTimePickerBaseStyle 与 DateTimePicker 控件同名但 TargetType 为 DatePickerExtend（遮蔽风险）；硬编码色值与水印"请输入时间" | `{source_root}/SDC/Style/DateTimePicker.xaml`（PART_Popup 67）、`DateTimeSelector.xaml`（TextOfTextBlock 24）、`DatePickerExtend.xaml`（DateTimePickerBaseStyle 32、PART_Popup 52） |

## 六、图表 / 附加属性 / 原生控件（TD-047~064）

（TD-056~058 预留未启用。）

| TD | 一句话问题 | 指向文件 |
|---|---|---|
| TD-047 | Dashboard 数据源协议：ShortTicks/LongTicks/NumberList 数据格式、当前值弧更新换算、Value 类型与单位（仅见 {0:N1}KW 格式证据） | `{source_root}/SDC/Style/Dashboard.xaml:14/25/36/48/60` |
| TD-048 | Dashboard Skin 取值全集与 Flow 模板激活机制；Flow 键零引用、WordAngleConverter 全库零引用（疑似死资源）、ArcThickness 绑 Height（疑似遗留） | `{source_root}/SDC/Style/Dashboard.xaml:9/33/82/142-160` |
| TD-049 | WaferLine 绘制与数据协议（ellipse/canvasLines/canvasCheckFlag 注入）；WordColor 悬空绑定（ElementName=waferLineControl 模板内不存在）；硬编码 CH1 替换方式 | `{source_root}/SDC/Style/WaferLine.xaml:44-53` |
| TD-050 | WaferMapping/WaferMappingCoat 双控件 .cs 绘制协议（myCanvas 注入、Die 图元约定、Mapping vs Coat 真实差异）；XAML 模板零属性证据 | `{source_root}/SDC/Style/WaferMapping.xaml:12`、`WaferMappingCoat.xaml:12` |
| TD-051 | ScatterPlotControl 散点绘制协议（数据源/坐标/图元注入，模板仅空 Border）；类型名与文件对应；除 Background 外是否有坐标/着色属性 | `{source_root}/SDC/Style/ScatterPlot.xaml:6-14` |
| TD-052 | ControlCommands 命令族全集（Prev/Next 之外）、命令类型与 CanExecute 行为 | `{source_root}/SDC/Style/NumberBox.xaml:123/132`、`DataGrid.xaml:849/864` |
| TD-053 | RangeTrack 五附加属性类型、注入协议、三段点击区步长语义 | `{source_root}/SDC/Style/Slider.xaml:204-220` |
| TD-054 | SimplePanel 布局语义、Grid.Row/Column 路由机制 | `{source_root}/SDC/FrameworkGeneric.xaml:21/36` 等 7 处 |
| TD-055 | Poptip.Instance/IsOpen 注入与打开机制、Offset/PlacementType/HitMode 语义 | `{source_root}/SDC/Style/StringNumberBox.xaml:39-48/140` |
| TD-059 | HitTextBox 独立控件类型——IsError/ResultType/Poptip 错误气泡协议；TextBoxAttach.SelectAll 注释挂点是否被取代 | `{source_root}/SDC/Style/TextBox.xaml:26` |
| TD-060 | Progress 家族：controls:ProgressBar↔IOProgressBar 同构差异面；ProgressBarStyle1/2 的 {Binding Source={StaticResource …}} 非常规写法；ProgressBoxFillBrush 单停点渐变实为纯色 | `{source_root}/SDC/Style/ProgressBar.xaml`、`Progress.xaml` |
| TD-061 | ScrollViewer 双版并存：v1 Storyboard1/2 死资源、v15 DefaultScrollViewerStyle 零引用、25/35px 选型 | `{source_root}/SDC/Style/ScrollViewer.xaml`、`ScrollViewer15.xaml` |
| TD-062 | LazyToggleButton 三态语义（{x:Null}=Loading 旋转）与 ToggleIconButton 状态标记协议 | `{source_root}/SDC/Style/ToggleButton.xaml` |
| TD-063 | MaterialBox 用途与 LayerList 数据源（五字段绑定契约、#AFB9C3 硬编码） | `{source_root}/SDC/Style/MaterialBox.xaml` |
| TD-064 | 零使用实例用途类：HeaderedListBox 家族（"Headerd" 拼写疑点）、Loading Light 变体冗余、SimpleItemsControl PART_Panel 协议 | `{source_root}/SDC/Style/ListBox.xaml`、`Loading.xaml`、`SimpleItemControl.xaml` |

## 建议确认顺序

1. **TD-001/002/003**（协议语义）——所有页面开发的前提；
2. **TD-022/023**（IO 家族定位）——IO 系列控件怎么用取决于此；
3. **TD-008**（加载顺序）——决定 TD-011/026/028/029/046 的键冲突与双定义生效方；
4. **TD-029/032/035/041**（键盘键覆盖、键垫弹出机制、DataGrid 家族分型）——阶段 4 条目语义依赖此；
5. **TD-047~051**（图表绘制协议）——图表类无任何 XAML 使用证据，用到必问；
6. 其余按开发中实际用到哪个控件再问哪个。
