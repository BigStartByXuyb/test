# 常见错误清单

<!-- evidence=组装汇总(内容全部源自 00-guide/03-writing-paradigm、03-protocols 三篇与各控件条目区块 6,无新证据、无新 TD); pending=[TD-001,TD-002,TD-003,TD-004,TD-011,TD-023,TD-025,TD-026,TD-027,TD-029,TD-031,TD-033,TD-037,TD-038,TD-045,TD-046,TD-047,TD-064]; verified=2026-08-14; sources=[{source_root}/ManualView.xaml, {source_root}/SDC/Style/IconButton.xaml, {source_root}/SDC/Style/BigNumericKeypad.xaml, {source_root}/SDC/Style/DatePickerExtend.xaml, {source_root}/SDC/Style/ListBox.xaml, {source_root}/SDC/Style/Dashboard.xaml] -->

> 本篇为**组装层**文档：错误清单汇总。每条 = 错误写法 + 正确写法 + 依据（条目相对链接或 TD 编号）。各待确认项统一登记于 [pending-confirmations.md](pending-confirmations.md)，回填后本篇对应条目自动更新。适用边界：仅 MW 框架页面；非框架项目（如 mastergo-to-wpf 无框架产物）不适用（写法总则例外边界）。

## M1 手写 Button+Grid 拼装等效按钮

❌ 错误：手写 `Button` + 多层 `Grid`/`TextBlock`/`ContentControl` 拼出图标按钮视觉（常规 WPF 写法）

```xml
<!-- 反例摘自已废弃历史页面：MenuCardButtonStyle/FKeyTextStyle/CardLabelTextStyle/Icon_Laser 在 SDC 中未定义，仅作结构反例展示 -->
<Button Grid.Row="0" Grid.Column="6" x:Name="BtnLaserMaint" Style="{StaticResource MenuCardButtonStyle}">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="14*"/><RowDefinition Height="22*"/><RowDefinition Height="18*"/>
            <RowDefinition Height="66*"/><RowDefinition Height="40*"/><RowDefinition Height="20*"/>
        </Grid.RowDefinitions>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="14*"/><ColumnDefinition Width="24*"/><ColumnDefinition Width="2*"/>
            <ColumnDefinition Width="100*"/><ColumnDefinition Width="40*"/>
        </Grid.ColumnDefinitions>
        <TextBlock Grid.Row="1" Grid.Column="1" Style="{StaticResource FKeyTextStyle}" FontWeight="Medium">
            <Run Text="F"/><Run FontFamily="{StaticResource DINFont}" FontWeight="Bold" Text="4"/>
        </TextBlock>
        <ContentControl Grid.Row="3" Grid.Column="3" Content="{StaticResource Icon_Laser}"/>
        <TextBlock Grid.Row="4" Grid.Column="3" Style="{StaticResource CardLabelTextStyle}" Text="激光维护"/>
    </Grid>
</Button>
```

✅ 正确：框架封装控件一行属性化（[icon-button](../02-controls/navigation/icon-button.md) 区块 6）

```xml
<s:IconButton TopLeftContent="F10"
              Content="{DynamicResource …激光维护文本键}"
              Icon="{StaticResource LaserMaintain9F10Geometry}"
              IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0"
              Click="{s:Action …}" />
```

依据：[icon-button](../02-controls/navigation/icon-button.md) 区块 6（五类禁止原因逐条：① 丢失状态——手写 Button 无 Hover/Pressed/Selected/Disabled 触发器与 Disabled 透明度 0.56；② 丢失协议挂点——IOEnable/PageName/s:Action 全无；③ 无法样式族切换；④ 硬编码"激光维护"绕过本地化；⑤ 星号比例/圆角/焦点策略脱离视觉规范）；写法总则 1「框架存在对应封装控件，手写等效结构即违规」。

## M2 用 IsEnabled+转换器替代 IOEnable 协议

❌ 错误：手工联锁（绑定 + 代码后置属性/转换器模拟设备条件）

```xml
<Button IsEnabled="{Binding RunStopped}"/>
```

```csharp
public bool RunStopped => Cts.Run == 0 && Cts.Transfer == 0;  // 手写转换
```

✅ 正确：IOEnable 协议（[device-condition-protocol](../03-protocols/device-condition-protocol.md) 区块 1/3）

```xml
<s:IconButton IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0" …/>
```

注意 XML 转义：`&&` 必须写作 `&amp;&amp;`（ManualView.xaml 14 处）；布尔字面量形式 `IOEnable="true"` 已确认。

依据：① 设备联锁是框架协议，手工 IsEnabled+转换器是等价机制的重复发明（写法总则 3）；② IO 系列控件（IOCheckBox/IODataGrid/…）全部走 IOEnable 通道，按钮手工联锁与 IO 控件不一致；③ 表达式集中在 XAML 可审计、设备联调时可全局检索。表达式语义（CTC 来源/失败行为）待回填：TD-001。

## M3 new Window 替代 PageName 跳转协议

❌ 错误：代码后置手动切页

```xml
<Button Click="JumpToManual"/>
```

```csharp
private void JumpToManual(object sender, RoutedEventArgs e)
{
    new ManualCutAutoView().Show();   // 或 MainWindow 手动切换 Content
}
```

✅ 正确：PageName 协议（[page-navigation-protocol](../03-protocols/page-navigation-protocol.md) 区块 1/3）

```xml
<s:IconButton PageName="Jump:ManualCutAuto:ini" …/>
```

依据：① 页面跳转是框架协议（与页面注册机制联动），代码后置 new Window() 绕过注册与参数传递；② 跳转目标集中在 XAML 中可审计、可索引；③ 与 s:Action/IOEnable 同通道，设备联锁失效时跳转按钮的禁用策略才能统一（写法总则 3）。分段语义（`ini`/`Manual`/`True` 各段含义）待回填：TD-003。

## M4 代码后置 Click 替代 s:Action 动作协议

❌ 错误：事件处理器 + 代码后置

```xml
<Button Click="OnLoadButtonClicked"/>
```

```csharp
private void OnLoadButtonClicked(object sender, RoutedEventArgs e) { … }
```

✅ 正确：动作协议（[action-protocol](../03-protocols/action-protocol.md) 区块 1/3）

```xml
<s:IconButton Click="{s:Action LoadWaferToCutStage}" …/>
```

参数为动作名称字面量（不带 `()`）；与 PageName 可共存（`Click="{s:Action GoBackCommand}"` + `PageName="Jump:Home"` 同现于退出按钮，ManualView.xaml）。

依据：① 框架动作走 `s:Action` 通道（框架代理/命令），代码后置绕过该通道，动作审计、设备联锁联动失效；② 全页面动作集中可检索（ai-index 可索引）；③ 与 IOEnable/PageName 同属框架协议，混用原生事件破坏一致性（写法总则 3）。解析机制（委托/命令/框架代理）待回填：TD-002。

## M5 框架拼写陷阱表（拼写即证据，照抄勿改）

框架源码存在多处**拼写即证据**的键名/属性名/命名部件——引用时必须**原样照抄**，禁止"顺手改正"；核对用 grep 或 `{index_root}/files/*.json` 的 `resource_references`。

| 陷阱拼写 | 正确意图 | 位置证据（源文件原样） | 依据 |
|---|---|---|---|
| `controls:ButtonAttach.IconGeometory` | Geometry | Button.xaml:35/102 模板消费；BigNumericKeypad.xaml:128-143、BigStringKeypad.xaml:162-178 使用 | TD-031；[button-attach](../02-controls/attached-props/button-attach.md)「(命名拼写) 非 Geometry——全库唯一拼写，模板绑定原文」 |
| `HeaderdListBoxBaseStyle`（"Headerd"） | Headered | ListBox.xaml:140/188/200/211（TargetType=controls:HeaderedListBox） | TD-064；[list-box](../02-controls/native/list-box.md) 区块 4 |
| `Tag="DwArrow"` | 疑为 DownArrow | BigNumericKeypad.xaml:143、BigStringKeypad.xaml:178（与 UpArrow 不对称） | TD-033；[big-numeric-keypad](../02-controls/keypad-input/big-numeric-keypad.md) 区块 1/3「注意 Tag 拼写」 |
| `IOToggleButtonBaeControlTemplate`（"Bae"） | 疑为 Base | IOToggleButton.xaml:11/166；ToggleButton.xaml 同型 `ToggleButtonBaeControlTemplate` | TD-027；[io-toggle-button](../02-controls/io/io-toggle-button.md) 区块 2/3 |
| `CalenderHeaderButtonBaseStyle` / `CalenderSelectorButtonBase` / `CalenderButtonGradientBrush` / `PART_Calender`（"Calender"） | Calendar | Calendar.xaml:178、CalendarExtend.xaml:10、Brushes.xaml:96、DateTimeSelector.xaml:19 | TD-045；[calendar](../02-controls/grid-tree/calendar.md) 区块 4「键名拼写"Calender"」；[date-time-picker](../02-controls/grid-tree/date-time-picker.md) 区块 3 |
| Dashboard 命名部件 `ShoartTick`（源拼写如此） | ShortTick | Dashboard.xaml:36/91 | TD-047（Dashboard 数据源协议）；[dashboard](../02-controls/charts/dashboard.md) 区块 3 命名部件 |

用法规则：① 拼写以源文件为准（"拼写即证据"），`{StaticResource …}`/附加属性引用一律照抄原拼写；② 需要核对时 grep 源文件或查 ai-index `resource_references`（「查不靠记」，见 [resource-usage](resource-usage.md) 区块 4）；③ 全部已登记 TD，回填确认前按现有拼写书写。

## M6 硬编码色值/尺寸替代 Token 与画刷键

❌ 错误：散写字面量

```xml
<Button Width="140" Height="75" FontSize="16" Background="#1f2e54"/>
<TextBlock Foreground="#5f5f5f"/>
```

✅ 正确：Token + 画刷键 + 样式族

```xml
<s:IconButton Style="{StaticResource MainButtonStyle}" …/>
```

依据：① 颜色/尺寸 Token 是主题唯一事实源，散写字面量后主题切换与视觉统一失效（[colors-fonts-sizes](../01-resources/colors-fonts-sizes.md) 区块 4）；② 控件尺寸有专用 Token（`Button_IconButtonWidth` 140/75），散写绕过 Token 体系；③ 样式族内含全套状态触发器，散写属性无法复现（写法总则 2）。

框架模板内已知硬编码（页面侧禁止硬编码；**模板侧不改**，已登记待回填，回填后再处理）：TD-025（IORadioButton 13×13/7×7 无 Token、IOStatusLight 模板硬编码 20×20 vs StatusLight Token 13×13、IOTabControl 60×60/#E1E1E1、IODataGrid 30/28）；TD-046（DatePickerExtend #b4b4b4/#2561a9/#5f5f5f 与水印"请输入时间"未走文本键）；TD-064（HeaderedListBox 二级/三级标题字 #5b81a0/#5f5f5f 硬编码）；TD-013（IconControl 模板 Fill="Black"）。

## M7 同键多定义不注明文件

❌ 错误：只写键名，无文件定位

```xml
<Button Style="{StaticResource KeyButtonStyle}"/>
```

✅ 正确：文件+键双定位（注释或文档标注定义文件）

```xml
<!-- SwitchKeypad.xaml:15 的 KeyButtonStyle（区别于 NumericKeypad.xaml:13 同名键，TD-029） -->
<Button Style="{StaticResource KeyButtonStyle}"/>
```

依据：① 同名键多文件定义时，WPF 合并顺序决定生效方，单方修改即分叉（TD-029 原文「凡引用该键必须写『文件+键』双定位」）；② 同名不同 TargetType 的键（`WindowBaseButton`，TD-011）存在遮蔽风险；③ 已登记双定义键全集见 [style-selection](style-selection.md) 区块 3 案例表（TD-029/011/026/038/046）。

## M8 手写 Path Data / 位图替代 Geometry 键

❌ 错误：手画路径或位图资源

```xml
<Path Data="M0,0 L9,11 18,0 z" Fill="#bbc2cc"/>
<Image Source="pack://application:,,,/Assets/icon.png"/>
```

✅ 正确：引用 826 键图标库

```xml
<s:IconButton Icon="{StaticResource ManualOperationF1Geometry}" …/>
```

依据：[geometries-icons](../01-resources/geometries-icons.md) 区块 3：① 图标库统一维护，手写 Data 是重复造资源且无法全局换装；② 位图不随尺寸缩放不失真，Geometry 矢量无此问题；③ 图标键是设计稿→实现的一致性锚点（写法总则 5）。
