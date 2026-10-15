<!-- evidence=场景对照(组装层,无新证据;正确写法原样摘自已写条目,拼写/转义一致); pending=[TD-004,TD-010,TD-011]; verified=2026-08-14; sources=[{source_root}/SDC/Style/MessageBox.xaml, {source_root}/SDC/Style/CommonWindow.xaml, {source_root}/ManualView.xaml]
     反例有效性(2026-08-14 grep 验证): ManualView.xaml 无 `<Window`、无原生 Window 元素、无硬编码中文文案(仅注释); SDC\Style\ 无原生 `<Window ` 用法(CommonWindow.xaml 自身为 controls:CommonWindow 样式),手写 Window+Grid+TextBlock+Button 消息框结构未出现在真实页面 -->

# 场景：弹窗与本地化

## 场景⑩：确认/提示/错误对话框与顶层窗口（文本走本地化键）

> **关键规则**：弹窗一律用框架 MessageBox（确认/提示/错误），顶层窗口一律用 CommonWindow；标题与文案全部走 DynamicResource 文本键，禁止硬编码中文。

### 场景描述

弹一个确认/提示/错误对话框（标题 + 主/次内容 + 图标 + 按钮区），或开一个带统一标题栏的顶层窗口；文案要求可随语言切换。

### 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 消息框（三开关组合显隐/边距） | MessageBox（隐式默认样式，无需写 Style） | ../02-controls/navigation/message-box.md |
| 顶层窗口（标题栏/关闭钮/全屏） | CommonWindow（必须显式 `Style="{StaticResource CommonWindowStyle}"`） | ../02-controls/navigation/common-window.md |
| 文本键（标题/主次内容/按钮） | `DynamicResource` 文本键（命名 `{页面或模块}{语义}`） | ../03-protocols/localization-text.md |

### 对照 A：消息框

#### ❌ 禁止：常规 WPF 写法（手写 Window + TextBlock + Button 拼消息框）

```xml
<Window x:Class="…" WindowStyle="None" WindowStartupLocation="CenterScreen"
        SizeToContent="WidthAndHeight" ResizeMode="NoResize">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="40"/><RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <Border Grid.Row="0" Background="{StaticResource WindowTitleBrush}">
            <Grid>
                <TextBlock Text="提示" VerticalAlignment="Center" Margin="20,0,0,0"/>
                <Button HorizontalAlignment="Right" Width="40" Content="×" Click="Close_Click"/>
            </Grid>
        </Border>
        <StackPanel Grid.Row="1" Margin="20">
            <Path Data="{StaticResource …}" Width="50" Height="50" Fill="…"/>
            <TextBlock Text="确定要执行此操作吗？" MaxWidth="500" TextWrapping="Wrap" TextTrimming="CharacterEllipsis"/>
            <TextBlock Text="详情…" FontSize="12" MaxWidth="500" TextWrapping="Wrap"/>
            <StackPanel Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,20,0,0">
                <Button Content="确定" Click="OK_Click"/>
                <Button Content="取消" Click="Cancel_Click"/>
            </StackPanel>
        </StackPanel>
    </Grid>
</Window>
```

#### ✅ 推荐：框架写法（MessageBox 属性化，原样摘自 02-controls/navigation/message-box.md §5，模板证据构造）

```xml
<controls:MessageBox x:Key="ConfirmDlg"
                     Title="{DynamicResource …标题文本键}"
                     PrimaryContent="{DynamicResource …主文本键}"
                     SecondContent="{DynamicResource …次文本键}"
                     ShowPrimaryContent="True"
                     ShowSecondContent="True"
                     Image="{StaticResource MessageBoxInfoGeometry}"
                     ImageBrush="{StaticResource MessageBoxInfoBrush}"
                     ShowImage="True"
                     CloseButtonVisible="Visible"/>
```

- 样式为隐式默认样式，**无需也不应**写 `Style=`；
- 内容组合由三开关（ShowImage/ShowPrimaryContent/ShowSecondContent）驱动，模板自动处理边距/显隐——页面无需手工 Margin；
- 图标建议配对 `MessageBoxInfo/AskGeometry`（Geometries.xaml 50×50 键）+ `MessageBox*Brush` 画刷（Brushes.xaml 五色语义：Success/Danger/Accent/Warning/Info）——定义级证据存在，配对语义待确认（TD-010）；
- 按钮（确认/取消等）经 `PART_Panel` 命名部件注入、弹出方式（Show/ShowDialog）依赖 .cs（不可见，待 TD-010）。

### 对照 B：本地化（弹窗与全站通用）

#### ❌ 禁止：硬编码文案

```xml
<TextBlock Text="装片到切割台"/>
<Button Content="返回"/>
```

#### ✅ 推荐：DynamicResource 文本键（原样摘自 03-protocols/localization-text.md）

```xml
<s:IconButton Content="{DynamicResource ManualOperationLoad}" …/>
```

### 对照 C：顶层窗口

#### ❌ 禁止：常规 WPF 写法（原生 Window + 手拼标题栏）

```xml
<Window x:Class="…" WindowStyle="None" ResizeMode="NoResize">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="40"/><RowDefinition Height="*"/>
        </Grid.RowDefinitions>
        <DockPanel Grid.Row="0" Background="{StaticResource WindowTitleBrush}">
            <StackPanel Orientation="Horizontal">
                <Image Source="…" Width="20" Height="20"/>
                <TextBlock Text="标题" FontFamily="Microsoft YaHei UI" FontSize="14" Foreground="#505050"/>
            </StackPanel>
            <Button DockPanel.Dock="Right" Width="40" Content="×" Click="Close_Click"/>
            <Button DockPanel.Dock="Right" Width="40" Content="—" Click="Min_Click"/>
        </DockPanel>
        <Grid Grid.Row="1"><!-- 内容 --></Grid>
    </Grid>
</Window>
```

#### ✅ 推荐：框架写法（CommonWindow 一行属性化，原样摘自 02-controls/navigation/common-window.md §5，模板证据构造）

```xml
<controls:CommonWindow x:Class="…"
                       Style="{StaticResource CommonWindowStyle}"
                       Title="{DynamicResource …标题文本键}"
                       Icon="{StaticResource …}"
                       Width="1200" Height="800"
                       NonClientAreaHeight="40"
                       ResizeMode="NoResize">
    <Grid>
        <!-- 页面内容；自动位于标题栏下方（模板 Row 1） -->
    </Grid>
</controls:CommonWindow>
```

- **必须显式指定样式**：`CommonWindowStyle` 是有键样式，无隐式默认样式证据；
- 标题栏行为全部由属性驱动：`NonClientAreaHeight` 统一定高；`HideAllButton="True"` 隐藏最小化+关闭，`HideMinMaxButton="True"` 隐藏最小化；`IsFullScreen="True"` 全屏化；
- 无最大化按钮（与 CornerRadiusWindow 的关键差异，见 [corner-radius-window](../02-controls/navigation/corner-radius-window.md)）。

### 禁止原因（对照 A/B/C 合并）

1. **① 丢失状态/组合逻辑**（A）：ShowImage/ShowPrimaryContent/ShowSecondContent 的 MultiTrigger 矩阵（边距 24/0、Visibility 联动，MessageBox.xaml 模板 Trigger 证据）手写需逐条维护，组合一多必出错；
2. **② 丢失模板部件协议**（A/C）：PART_ButtonClose（CloseButtonVisible）、PART_Panel（按钮注入）、PART_SecondContent 命名部件与 WindowChrome 配置（UseAeroCaptionButtons=False）无挂点；CommonWindow 的 HideAllButton/HideMinMaxButton/IsFullScreen/NonClientAreaHeight 与模板命名部件（btnMin/btnClose）挂点全无——整窗行为无从属性化；
3. **④ 绕过本地化**（A/B/C）：硬编码「提示/确定要执行此操作吗？/装片到切割台/标题」绕过 DynamicResource 文本键体系（总则 4；键定义位置待 [TD-004](../03-protocols/localization-text.md)）；ManualView 全页面无硬编码中文（grep 验证 2026-08-14）；
4. **⑤ 脱离视觉规范**（A/C）：尺寸约束（100~400/225~900）、SizeToContent、Microsoft YaHei UI 14px/#505050、40px 标题栏 Token（MessageBoxHeaderHeight）、WindowClosedButton 的 Hover（WarningToolBrush）/Pressed（WarningBrush）画刷触发器与 15×15 WindowsCloseGeometry、`WindowChrome.IsHitTestVisibleInChrome="True"` 全部失控；手写 WindowStyle=None 后标题栏拖拽/系统命令（SystemCommands.Minimize/CloseWindowCommand）均需自行实现；
5. **③ 无法全局统一/样式族切换**（A/C）：手写消息框无法享受隐式默认样式的全局兜底（样式族升级全站同步生效）；不能经 CommonWindowStyle→CornerRadiusWindowStyle 一键切换窗口形态（普通/圆角阴影）。

## 证据来源

- 模板证据（P1）：`{source_root}/SDC/Style/MessageBox.xaml`（锚点：隐式默认样式 `TargetType="controls:MessageBox"`、`Name="PART_NonClientArea"`/`PART_ButtonClose`/`PART_Path`/`PART_Panel`、`Trigger Property="ShowImage"`、`MultiTrigger Condition Property="ShowPrimaryContent"`）；`{source_root}/SDC/Style/CommonWindow.xaml`（锚点 `x:Key="CommonWindowStyle"`、`x:Key="WindowBaseButton"`、`x:Key="WindowClosedButton"`、`Trigger Property="IsFullScreen"`）
- 资源证据：`{source_root}/SDC/Brushes.xaml`（`x:Key="WindowTitleBrush"`、MessageBox 五画刷键）；`{source_root}/SDC/Geometries.xaml`（`x:Key="MessageBoxInfoGeometry"`/`MessageBoxAskGeometry`、`WindowsCloseGeometry`）；`{source_root}/SDC/Sizes.xaml`（`MessageBoxHeaderHeight` 40）
- 真实使用：**无 P2 实例**（ManualView.xaml grep 无 `MessageBox`/`CommonWindow`）；正确写法为模板证据构造，使用时需注意 TD-010/TD-011 待回填项
- 文本键证据（P2）：`{source_root}/ManualView.xaml`（ManualOperationLoad 等 15 键，`:26`/`:113` 等；refence 内找不到键定义，待 TD-004）
- 反例有效性：见文件头注释（grep 验证结论，2026-08-14）
- 待确认项：TD-010（MessageBox 使用协议：PART_Panel 按钮注入、Show/ShowDialog 调用面、Image/ImageBrush 配对语义）、TD-011（窗口语义属性族 .cs 定义与默认值）——见 `../05-best-practices/pending-confirmations.md`
