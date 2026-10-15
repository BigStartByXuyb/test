<!-- evidence=部分确认(①③ 调用面为 ManualView.xaml P2 直接证据 + IconButton.xaml P1 模板证据；s:Action/IOEnable/PageName 解析语义待确认);
     pending=[TD-001,TD-002,TD-003]; verified=2026-08-14;
     sources=[{source_root}/ManualView.xaml, {source_root}/SDC/Style/IconButton.xaml]
     反例有效性（grep 验证）：ManualView.xaml 零原生 <Button>/<TextBlock> 页面拼装（14 个主按钮 + 1 个退出按钮全部为 <s:IconButton>；9 处 Click 全部为 {s:Action …}，0 处代码后置 Click）；SDC/Style 72 文件 0 处代码后置 Click。本文件反例结构（Button+Grid 拼装 / Click 代码后置 / 手工联锁）不出现在真实页面。 -->

# 场景：① 图标功能按钮 ② 返回退出按钮 ③ 点击事件

---

# 场景① 图标功能按钮

> **关键规则**：主功能按钮一律用 `s:IconButton` + 页面级 `MainButtonStyle`（`<Style TargetType="{x:Type s:IconButton}" BasedOn="{StaticResource MainButtonStyle}"/>`）——带快捷键标记（F1~F14）、图标、文字、设备联锁（IOEnable）、动作（s:Action）的工控主按钮，框架没有对应手写替代。

## 场景描述

页面上放一排带快捷键标记、图标、文字、设备联锁的功能按钮（ManualView 左侧 F1~F14 主功能区为权威实例）。

## 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 图标+文字+快捷键角标+状态角标 | IconButton（MainButtonStyle） | [icon-button](../02-controls/navigation/icon-button.md) |
| 页面统一主按钮样式 | 页面级 `BasedOn` 隐式样式 | icon-button.md §5 |
| 设备联锁 | IOEnable | [device-condition-protocol](../03-protocols/device-condition-protocol.md) |
| 点击动作 | `Click="{s:Action …}"` | [action-protocol](../03-protocols/action-protocol.md) |
| 文本本地化 | `{DynamicResource 文本键}` | [localization-text](../03-protocols/localization-text.md) |
| 图标几何键 | `{StaticResource Geometry 键}` | [geometries-icons](../01-resources/geometries-icons.md) |

## 对照

### ❌ 禁止：常规 WPF 写法（手写 Button + Grid 拼装等效视觉）

```xml
<Button Width="160" Height="150" Click="OnLoadWaferClicked"
        IsEnabled="{Binding RunStopped}">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <TextBlock Text="F1" FontSize="12" Foreground="Gray"
                   HorizontalAlignment="Left"/>
        <Path Grid.Row="1" Width="55" Height="70" Stretch="Uniform"
              Data="{StaticResource …}" Fill="Gray"/>
        <TextBlock Grid.Row="2" Text="装片" HorizontalAlignment="Center"/>
    </Grid>
</Button>
```

```csharp
private void OnLoadWaferClicked(object sender, RoutedEventArgs e) { … }
```

### ✅ 推荐：框架写法（原样摘 ManualView.xaml:25-29 主按钮）

```xml
<s:IconButton TopLeftContent="F1"
              Content="{DynamicResource ManualOperationLoad}"
              Icon="{StaticResource ManualOperationF1Geometry}"
              IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0"
              Click="{s:Action LoadWaferToCutStage}" />
```

页面级统一样式（原样摘 ManualView.xaml:13 / icon-button.md §5）——页内所有 IconButton 默认即主按钮样式，变体再显式 `Style="…"` 覆盖：

```xml
<Style TargetType="{x:Type s:IconButton}" BasedOn="{StaticResource MainButtonStyle}"/>
```

## 禁止原因（≥3 条）

1. **① 丢失状态**：手写 Button 没有 Hover/Pressed/Selected/Disabled 全套触发器、Disabled 透明度（0.56）、IsNeedRedMark 红字删除线角标（IconButton.xaml `ControlTemplate.Triggers` 锚点）；
2. **② 丢失协议挂点**：IOEnable 设备联锁、`Click="{s:Action …}"`、PageName 三个协议挂点全无——手工 `IsEnabled="{Binding RunStopped}"` 属等价机制重复发明（总则 3，device-condition-protocol.md §3 禁止写法即此式）；
3. **③ 无法样式族切换**：不能一键 MainButtonStyle→RightButtonStyle→BottomButtonStyle 换形态（icon-button.md §4 样式族表）；
4. **④ 绕过本地化**：硬编码「装片」绕过 `ManualOperationLoad` 文本键体系（localization-text.md）；
5. **⑤ 脱离视觉规范**：160×150 / 圆角 3 / 焦点策略（Focusable=False）/ 图标 55×70 等规范散写失控（MainButtonStyle Setter 证据）。

## 证据来源

- 真实页面：{source_root}/ManualView.xaml:13（页面级 BasedOn）、:25-29（F1 按钮原样）、14 个主按钮共 15 处 IOEnable
- 模板证据：{source_root}/SDC/Style/IconButton.xaml（锚点 `x:Key="IconButtonBaseStyle"`、`x:Key="MainButtonStyle"`）
- 协议条目：[action-protocol](../03-protocols/action-protocol.md)、[device-condition-protocol](../03-protocols/device-condition-protocol.md)

---

# 场景② 返回退出按钮

> **关键规则**：返回/退出按钮一律用 `s:IconButton` + `Style="{StaticResource RightButtonStyle}"` 变体（图标左 + IconText 右、白边白字），跳转主页用 `PageName="Jump:Home"`，返回动作与跳转共存时加 `Click="{s:Action GoBackCommand}"`。

## 场景描述

页面右下角放退出/返回按钮：图标 + 文字，点击回主页（ManualView 右侧退出按钮为权威实例）。

## 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 图标左+文字右变体 | IconButton + `Style="{StaticResource RightButtonStyle}"` | [icon-button](../02-controls/navigation/icon-button.md) §4/§5 |
| 页面跳转 | `PageName="Jump:Home"` | [page-navigation-protocol](../03-protocols/page-navigation-protocol.md) |
| 返回动作（与跳转共存） | `Click="{s:Action GoBackCommand}"` | [action-protocol](../03-protocols/action-protocol.md) §2 |
| 特殊底色 | `Background="{StaticResource ExitBackground}"` | icon-button.md §5 |

## 对照

### ❌ 禁止：常规 WPF 写法（手写 Button + StackPanel 拼装 + 代码后置切页）

```xml
<Button Width="140" Height="75" Click="OnExitClicked"
        Background="#FF4A4A" Foreground="White">
    <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
        <Path Width="30" Height="30" Fill="White"
              Data="{StaticResource …退出图标}"/>
        <TextBlock Text="退出" Margin="8,0,0,0" VerticalAlignment="Center"/>
    </StackPanel>
</Button>
```

```csharp
private void OnExitClicked(object sender, RoutedEventArgs e)
{
    // 手写窗口/内容切换
    ((MainWindow)Application.Current.MainWindow).Content = new HomeView();
}
```

### ✅ 推荐：框架写法（原样摘 ManualView.xaml:108-116 退出按钮）

```xml
<s:IconButton Grid.Row="1"
              PageName="Jump:Home"
              IOEnable="true"
              Style="{StaticResource RightButtonStyle}"
              Icon="{StaticResource EXITGeometry}"
              IconText="{DynamicResource ManualOperationEXIT}"
              Click="{s:Action GoBackCommand}"
              Background="{StaticResource ExitBackground}"
             />
```

## 禁止原因（≥3 条）

1. **② 丢失协议挂点**：PageName 跳转协议（`Jump:` 前缀 + 视图名与页面注册机制联动）与 `Click="{s:Action GoBackCommand}"` 共存形式（action-protocol.md §2 已确认）全无——代码后置 `new HomeView()` 绕过页面注册与参数传递（page-navigation-protocol.md §3）；
2. **③ 无法样式族切换**：RightButtonStyle 为独立模板（图标左 30×30 + IconText 右、白边白字、圆角 10、按压 Opacity 0.56、Focusable=True），页面拼装无法复刻，也不能一键切换其他变体（icon-button.md §4）；
3. **④ 绕过本地化**：硬编码「退出」绕过 `ManualOperationEXIT` 文本键（localization-text.md 键表 :113）；
4. **⑤ 脱离视觉规范**：140×75 / 圆角 10 / `ExitBackground` 画刷族规范散写失控；
5. **① 丢失状态**：手写按钮无按压 Opacity 0.56 与焦点策略行为（RightButtonStyle 模板触发器）。

## 证据来源

- 真实页面：{source_root}/ManualView.xaml:108-116（退出按钮原样；PageName 与 Click 共存唯一实例）
- 模板证据：{source_root}/SDC/Style/IconButton.xaml（锚点 `x:Key="RightButtonStyle"`）
- 协议条目：[page-navigation-protocol](../03-protocols/page-navigation-protocol.md)、[action-protocol](../03-protocols/action-protocol.md)

---

# 场景③ 点击事件

> **关键规则**：按钮点击一律走 `Click="{s:Action 动作名}"` 动作协议，**禁止代码后置 Click 事件**；动作名按已确认字面量书写（不带 `()`、不带引号），可与 `PageName` 共存于同一按钮（ManualView 退出按钮证据）。

## 场景描述

按钮点击触发业务动作（装片、清洗、返回等），动作名写在 XAML 上而非代码后置。

## 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 动作绑定 | `Click="{s:Action 动作名}"` | [action-protocol](../03-protocols/action-protocol.md) |
| 与跳转共存 | `PageName="Jump:…"` 同按钮 | action-protocol.md §2 |
| 已确认动作名清单 | LoadWaferToCutStage / TargetMatchClick / GoBackCommand 等 9 个 | action-protocol.md §1 |

## 对照

### ❌ 禁止：常规 WPF 写法（代码后置事件 + 手写联锁）

```xml
<Button Content="装片" Click="OnLoadWaferClicked"/>
```

```csharp
private void OnLoadWaferClicked(object sender, RoutedEventArgs e)
{
    if (Cts.Run != 0 || Cts.Transfer != 0) return;   // 手写联锁
    _waferService.LoadWaferToCutStage();
}
```

### ✅ 推荐：框架写法（原样摘 action-protocol.md §3 / ManualView.xaml:29）

```xml
<s:IconButton Click="{s:Action LoadWaferToCutStage}" …/>
```

（其余属性（Content/Icon/IOEnable）见场景①；动作名不带 `()` 与引号语义，按已确认形式书写）

## 禁止原因（≥3 条）

1. **② 丢失协议挂点**：动作走 `s:Action` 通道（框架代理/命令，解析机制 🟡 [待确认 TD-002]），代码后置绕过该通道——动作审计、设备联锁联动失效（action-protocol.md §3 ①）；
2. **① 丢失状态/联锁一致性**：动作与 IOEnable 设备联锁的联动（条件不满足时按钮禁用策略统一）在代码后置中必须手写 `if (Cts.Run != 0) return;`，行为分叉且与 IO 系列控件不一致；
3. **④ 代码分散**：全页面动作集中在 XAML 可检索（ai-index 可索引），代码后置把业务逻辑倒退回页面，与框架 MVVM/协议风格冲突（action-protocol.md §3 ②③）；
4. **协议一致性**：s:Action 与 PageName/IOEnable 同属框架协议（总则 3），混用原生事件破坏写法一致性。

## 证据来源

- 真实页面：{source_root}/ManualView.xaml（9 处 `Click="{s:Action …}"`，动作名全表见 action-protocol.md §1）
- 协议条目：[action-protocol](../03-protocols/action-protocol.md)（TD-002）
