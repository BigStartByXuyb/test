<!-- evidence=场景对照(组装层,无新证据;正确写法原样摘自已写条目或 ManualView,拼写/转义一致); pending=[TD-001,TD-002,TD-003,TD-004,TD-020,TD-021,TD-022]; verified=2026-08-14; sources=[{source_root}/ManualView.xaml, {source_root}/SDC/Style/IconButton.xaml, {source_root}/SDC/Style/StepFrame.xaml, {source_root}/SDC/Style/SideMenu.xaml]
     反例有效性(2026-08-14 grep 验证): ManualView.xaml 中无 IsEnabled="{Binding…}" 手工联锁、无 Click="handler" 代码后置、无 Window/Ellipse/ItemsControl/Expander/StackPanel/Path 手拼结构、无硬编码中文(仅注释「右边功能按钮区」); SDC\Style\ 中 IsEnabled="{Binding" 仅 Pagination.xaml 模板内部(TemplatedParent 绑定,非页面联锁写法),页面级反例结构均未出现在真实页面 -->

# 场景：页面跳转 / 设备联锁 / 步骤导航

## 场景⑦：页面跳转（PageName vs new Window）

> **关键规则**：页面跳转一律用 PageName 协议（`PageName="Jump:…"`），禁止代码后置 `new Window()` 或手工切换 Content。

### 场景描述

主功能页点按钮切到另一个页面（Manual 主功能区 F3/F4/F10/F14 跳对位/切割/校准，退出按钮跳回 Home）。

### 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 页面跳转 | `PageName="Jump:…"`（7 种形式已确认，分段语义待 TD-003） | ../03-protocols/page-navigation-protocol.md |
| 动作（与跳转共存） | `Click="{s:Action …}"` | ../03-protocols/action-protocol.md |
| 承载控件 | IconButton | ../02-controls/navigation/icon-button.md |
| 跳转按钮的设备联锁 | IOEnable | ../03-protocols/device-condition-protocol.md |

### 对照

#### ❌ 禁止：常规 WPF 写法（代码后置手动切页）

```xml
<Button Click="JumpToManual"/>
```

```csharp
private void JumpToManual(object sender, RoutedEventArgs e)
{
    new ManualCutAutoView().Show();   // 或 MainWindow 手动切换 Content
}
```

#### ✅ 推荐：框架写法（PageName 协议，原样摘自 ManualView.xaml:42-46）

```xml
<s:IconButton TopLeftContent="F4"
              Content="{DynamicResource ManualOperationCuttingAuto}"
              PageName="Jump:ManualCutAuto:ini"
              Icon="{StaticResource ManualOperationF4Geometry}"
              IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0" />
```

与动作共存形式（ManualView.xaml:108-116 退出按钮，PageName 与 `Click="{s:Action GoBackCommand}"` 同现）：

```xml
<s:IconButton Grid.Row="1"
              PageName="Jump:Home"
              IOEnable="true"
              Style="{StaticResource RightButtonStyle}"
              Icon="{StaticResource EXITGeometry}"
              IconText="{DynamicResource ManualOperationEXIT}"
              Click="{s:Action GoBackCommand}"
              Background="{StaticResource ExitBackground}" />
```

### 禁止原因

1. **② 丢失协议挂点**：页面跳转是框架协议（`Jump:` 前缀 + 视图名 + 参数段，与页面注册机制联动），代码后置 `new Window()` 绕过注册与参数传递（总则 3，仅调用形式已确认，分段语义待 [TD-003](../03-protocols/page-navigation-protocol.md)）；
2. **③ 无法样式族切换/统一审计**：跳转目标集中在 XAML 属性中可审计、可索引（ai-index 可索引 PageName），散在 C# 代码里无法全局检索；
3. **② 联锁失效**：与 s:Action/IOEnable 同通道——跳转按钮的设备联锁（IOEnable）失效时禁用策略才能统一，`new Window()` 完全绕开；
4. **⑤ 脱离视觉规范**：`new Window()` 跳过框架窗口体系（CommonWindow 样式族/统一标题栏），窗口行为与视觉失控。

## 场景⑧：设备联锁（IOEnable vs IsEnabled+转换器）

> **关键规则**：设备联锁一律走 IOEnable 协议（设备条件表达式或布尔字面量），禁止手工 `IsEnabled`+自定义转换器模拟。

### 场景描述

设备运行中（`CTC.RUN==0 && CTC.Transfer==0`）才允许操作按钮；未满足条件时按钮必须不可用/拦截。

### 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 设备联锁 | `IOEnable="…"`（表达式或 `true`；语义待 TD-001） | ../03-protocols/device-condition-protocol.md |
| 承载控件 | IconButton（IOEnable 挂点**目前仅 IconButton 有 P2 证据**，IO 家族挂载方式待 TD-022） | ../02-controls/navigation/icon-button.md |
| 动作/跳转联动 | Click / PageName（与 IOEnable 同通道） | ../03-protocols/action-protocol.md |

### 对照

#### ❌ 禁止：常规 WPF 写法（手工联锁 / 自定义转换器）

```xml
<Button IsEnabled="{Binding RunStopped}"/>
```

```csharp
public bool RunStopped => Cts.Run == 0 && Cts.Transfer == 0;  // 手写转换
```

（或用 `IsEnabled="{Binding …, Converter={StaticResource …}}"` 自定义 IValueConverter 模拟同效果——同样禁止。）

#### ✅ 推荐：框架写法（IOEnable 协议，原样摘自 ManualView.xaml:25-29）

```xml
<s:IconButton TopLeftContent="F1"
              Content="{DynamicResource ManualOperationLoad}"
              Icon="{StaticResource ManualOperationF1Geometry}"
              IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0"
              Click="{s:Action LoadWaferToCutStage}" />
```

注意 XML 转义：`&&` 必须写作 `&amp;&amp;`（ManualView.xaml 14 处 ✅）；退出按钮取布尔字面量 `IOEnable="true"`（ManualView.xaml:110）。

### 禁止原因

1. **② 重复发明等价机制**：设备联锁是框架协议，手工 `IsEnabled`+转换器/手写属性是等价机制的重复发明（总则 3；表达式完整语义待 [TD-001](../03-protocols/device-condition-protocol.md)）；
2. **③ 与 IO 控件不一致**：IO 系列控件（IOCheckBox/IODataGrid/…）均走框架状态通道，按钮手工联锁与 IO 控件割裂（IOEnable 在 IO 家族模板的挂载范围待 [TD-022](../05-best-practices/pending-confirmations.md)）；
3. **④ 无法审计**：表达式集中在 XAML 中可审计，设备联调时可全局检索 `IOEnable=`；C#/转换器版本散落不可检索；
4. **① 丢失状态联动**：手写 IsEnabled 与 IconButton 的 Disabled 触发器族（0.56 透明度等）无自动联动，视觉与逻辑脱节。

## 场景⑨：步骤导航（向导步骤条 / 侧边导航）

> **关键规则**：向导式多步骤流程用 StepFrame（步骤闸门 CanNextStep/CanRebackStep/IsStepButtonEnabled 挂接），左侧功能导航树用 SideMenu（`ExpandMode="Accordion"` 切换手风琴形态）。

### 场景描述

工艺向导「装片→对位→切割…」多步流程（StepFrame）；主界面左侧两级功能导航树（SideMenu）。

### 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 步骤条 + 步骤闸门 | StepFrame / StepFrameItem（Status 三态） | ../02-controls/navigation/step-frame.md |
| 侧边导航树 | SideMenu / SideMenuItem（ExpandMode） | ../02-controls/navigation/side-menu.md |
| 标题/按钮文案 | DynamicResource 文本键 | ../03-protocols/localization-text.md |

### 对照 A：步骤条

#### ❌ 禁止：常规 WPF 写法（手写 ItemsControl 步骤条 + 自管索引 + 上/下一步 Button）

```xml
<StackPanel>
    <ItemsControl ItemsSource="{Binding Steps}">
        <ItemsControl.ItemTemplate>
            <DataTemplate>
                <Grid Width="120">
                    <Border x:Name="Dot" CornerRadius="40" Width="30" Height="30"
                            Background="Gray">
                        <TextBlock Text="{Binding Index}" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                    </Border>
                    <TextBlock Text="{Binding Title}" Margin="0,30,0,0" HorizontalAlignment="Center"/>
                </Grid>
            </DataTemplate>
        </ItemsControl.ItemTemplate>
    </ItemsControl>
    <Grid>
        <Button Content="上一步" IsEnabled="{Binding CanPrev}" HorizontalAlignment="Left"/>
        <Button Content="下一步" IsEnabled="{Binding CanNext}" HorizontalAlignment="Right"/>
        <Button Content="返回" HorizontalAlignment="Right" Margin="0,0,80,0"/>
    </Grid>
</StackPanel>
```

#### ✅ 推荐：框架写法（StepFrame 声明式向导，原样摘自 02-controls/navigation/step-frame.md §5，模板证据构造）

```xml
<s:StepFrame>
    <s:StepFrameItem Header="{DynamicResource StepHeader1}">
        <!-- 步骤 1 内容 -->
    </s:StepFrameItem>
    <s:StepFrameItem Header="{DynamicResource StepHeader2}">
        <!-- 步骤 2 内容 -->
    </s:StepFrameItem>
    <s:StepFrameItem Header="{DynamicResource StepHeader3}"/>
</s:StepFrame>
```

- 项样式由 `StepFrameItemStyleSelector` 按位置自动分配（首→FirstStepItemStyle、中→DefaultStepItemStyle、末→LastStepItemStyle），使用方**不手工指定**项样式；
- 需内容区滚动用默认样式，不滚动用 `Style="{StaticResource StepFrameNonscrollableStyle}"`；
- 底部按钮文本（ControlPreStep/ControlNextStep/ControlBack）由模板固化，使用方不散写。

### 禁止原因（对照 A）

1. **① 丢失状态**：手写没有 StepPolygon 三段箭头几何（First/Default/Last ItemMode）与 Status 三态画刷触发器族（Complete/UnderWay/Waiting，StepFrameItemBaseStyle）——「当前/已完成/未开始」视觉无法表达；
2. **② 丢失协议挂点**：CanNextStep/CanRebackStep/IsStepButtonEnabled 步骤闸门是向导流程与设备联锁的接缝（TD-001 家族）；手写 Button 的 IsEnabled 靠 ViewModel 自管，挂不上框架协议；
3. **③ 无法样式族切换**：StepFrameItemStyleSelector 自动分配首/中/末样式、滚动/非滚动模板一键切换，手写结构每个步骤条都要重画；
4. **④ 绕过本地化**：硬编码「上一步/下一步」绕过 ControlPreStep/ControlNextStep/ControlBack 文本键（TD-004 域；滚动/非滚动版「返回」键不一致 ControlBack vs Back，见 [TD-021](../02-controls/navigation/step-frame.md)）。

### 对照 B：侧边导航

#### ❌ 禁止：常规 WPF 写法（手写 Expander + StackPanel + Button 拼装）

```xml
<StackPanel Width="180">
    <Expander Header="工序" IsExpanded="True">
        <StackPanel>
            <Button Content="步骤1" HorizontalContentAlignment="Left"/>
            <Button Content="步骤2" HorizontalContentAlignment="Left"/>
        </StackPanel>
    </Expander>
    <Button Content="参数设置" HorizontalContentAlignment="Left"/>
</StackPanel>
```

#### ✅ 推荐：框架写法（SideMenu 两级声明式导航，原样摘自 02-controls/navigation/side-menu.md §5，模板证据构造）

```xml
<s:SideMenu Style="{StaticResource SideMenuAccordion}"
            Width="{DynamicResource SideMenuBoxWidth}"
            Height="{DynamicResource SideMenuBoxHeight}">
    <s:SideMenuItem Header="{DynamicResource MenuStep}">
        <s:SideMenuItem Header="{DynamicResource MenuStep1}" Icon="{StaticResource …Geometry}"/>
        <s:SideMenuItem Header="{DynamicResource MenuStep2}"/>
    </s:SideMenuItem>
    <s:SideMenuItem Header="{DynamicResource MenuParam}" Icon="{StaticResource …Geometry}"/>
</s:SideMenu>
```

- 不写 Style 时由无键默认样式兜底；`ExpandMode="Accordion"` 属性或显式 `Style="{StaticResource SideMenuAccordion}"` → 手风琴形态（无滚动、折叠区 200）；
- 分组头无子项时（HasItems=False）模板自动隐藏三角并强制 Role=Item——纯叶子头自动降级，无需使用方干预。

### 禁止原因（对照 B）

1. **① 丢失状态**：手写没有 IsSelected/IsMouseOver/IsExpanded/HasItems/IsEnabled(Opacity .5) 触发器族与 SideMenu_* 画刷三态，更没有 0.1s 三角旋转折叠动画（StoryboardVisable/StoryboardCollapsed）；
2. **② 丢失协议挂点**：框架导航容器是导航/联锁协议的承载面；注意 SideMenu 模板**无** IOEnable/s:Action/PageName 挂点（与 IconButton 不同，见 ../02-controls/navigation/icon-button.md），页面跳转需使用方自行接续（TD-001/002/003）；
3. **③ 无法样式族切换**：不能一键 SideMenuBaseStyle→SideMenuAccordion（ExpandMode 驱动换模板、换项容器、换折叠区高度 200）；
4. **④ 绕过本地化**：硬编码「工序/步骤1」绕过 DynamicResource 文本键体系（TD-004）；
5. **⑤ 脱离视觉规范**：180×855 尺寸、45px 行高、16px 分组头、2px 渐变悬停边框、折叠区 200 等规范全部失控。

## 证据来源

- 真实页面（P2）：`{source_root}/ManualView.xaml`——F1 联锁按钮 :25-29；F3 跳转带参数 :36-41；F4 跳转 :42-46；F10 :72-76；F14 :92-96；退出按钮（PageName+Click 共存）:108-116；`&amp;&amp;` 转义 14 处
- 协议证据：`../03-protocols/page-navigation-protocol.md`（7 种 Jump 形式表）、`../03-protocols/device-condition-protocol.md`、`../03-protocols/action-protocol.md`、`../03-protocols/localization-text.md`
- 模板证据（P1）：`{source_root}/SDC/Style/IconButton.xaml`（锚点 `x:Key="MainButtonStyle"`、`x:Key="RightButtonStyle"`）；`{source_root}/SDC/Style/StepFrame.xaml`（`x:Key="StepFrameBaseStyle"`、`x:Key="StepFrameItemBaseStyle"`、`x:Key="StepFrameItemStyleSelector"`、`Trigger Property="Status"`）；`{source_root}/SDC/Style/SideMenu.xaml`（`x:Key="SideMenuAccordion"`、`Trigger Property="ExpandMode" Value="Accordion"`、`x:Key="StoryboardVisable"`/`StoryboardCollapsed`）
- 反例有效性：见文件头注释（grep 验证结论，2026-08-14）
- 待确认项：TD-001（IOEnable 语义）、TD-002（s:Action 机制）、TD-003（PageName 分段/与 Click 共存优先级）、TD-020/021（StepFrame 语义与转换器疑点）、TD-022（IOEnable 挂载范围）——均见 `../05-best-practices/pending-confirmations.md`
