<!-- evidence=已确认(属性/样式族/触发器均为模板源码 P1 直接证据; 无 P2 使用实例); pending=[TD-011];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/CommonWindow.xaml, {source_root}/ManualView.xaml] -->

# CommonWindow（框架主窗口）

## 1. 用途

框架对原生 Window 的封装：**自定义标题栏（图标 + 标题）+ 最小化/关闭按钮 + 内容区**，内建 `IsFullScreen` / `HideAllButton` / `HideMinMaxButton` 三个窗口行为触发器。标题栏高度由 `NonClientAreaHeight` 统一控制，按钮区为固定 40 宽、高度随标题栏。

典型场景：框架所有顶层窗口的基类（参考 `01-resources/resource-loading.md` 的窗口/资源体系）；注意 **ManualView.xaml 中无使用实例**（grep 无 `<controls:CommonWindow` 出现），以下使用面由模板证据构造。

## 2. 声明

```xml
<controls:CommonWindow … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:CommonWindow`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。样式键 `x:Key="CommonWindowStyle"`——**有键无隐式默认样式**（模板证据中仅此一份定义），使用时须显式 `Style="{StaticResource CommonWindowStyle}"`。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 窗口背景；默认 `PrimaryDefaultBrush`（内容区与边框均 TemplateBinding） | Setter + `TemplateBinding Background`（WindowBorder/内容 Border） | ✅ |
| ResizeMode | NoResize | 样式默认禁止缩放 | Setter Property="ResizeMode" | ✅ |
| Title | string | 标题栏文字（左，SubHeaderFontSize 14、#505050 硬编码、Microsoft YaHei UI） | `Text="{TemplateBinding Title}"` | ✅ |
| Icon | ImageSource | 标题栏左侧图标，MaxHeight/MaxWidth 20 | `Source="{TemplateBinding Icon}"` | ✅ |
| BorderBrush / BorderThickness | Brush / Thickness | 窗口边框；header 的 BorderThickness 继承同一来源 | `TemplateBinding BorderBrush/BorderThickness` + RelativeSource TemplatedParent 绑定 | ✅ |
| Padding | Thickness | 模板内 root Grid 的 Margin | `Margin="{TemplateBinding Padding}"` | ✅ |
| NonClientAreaHeight | double | 标题栏高度；header 与 btnMin/btnClose 三处同源绑定 | `Path=NonClientAreaHeight`（header/btnMin/btnClose 的 RelativeSource 绑定） | ✅ |
| IsFullScreen | bool | True 时 WindowState 置为 Maximized | `Trigger Property="IsFullScreen" Value="True"` | ✅ |
| HideAllButton | bool | True 时隐藏最小化与关闭按钮（模板命名部件） | `Trigger Property="HideAllButton"` + TargetName="btnMin"/"btnClose" | ✅ |
| HideMinMaxButton | bool | True 时仅隐藏最小化按钮（**本窗口无最大化按钮**，见区块 4 差异） | `Trigger Property="HideMinMaxButton"` + TargetName="btnMin" | ✅ |
| WindowStyle / AllowsTransparency | — | 样式未设置（与 CornerRadiusWindow 的 None+True 形成对照）；窗口 chrome 行为 .cs 不可见 | 无 Setter（反证） | 🟡 [建议 TD-011] |

## 4. 样式族表（SDC\Style\CommonWindow.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| CommonWindowStyle | 无（独立模板） | 标题栏 `WindowTitleBrush` + 图标 20×20 + 标题；右按钮组 最小化（WindowBaseButton）+ 关闭（WindowClosedButton），宽 40、高=NonClientAreaHeight，`WindowChrome.IsHitTestVisibleInChrome="True"`；内容区 `AdornerDecorator` 包裹 ContentPresenter；IsFullScreen/HideAllButton/HideMinMaxButton 触发器 | 框架顶层主窗口 |
| WindowBaseButton | 无 | Button；透明底、BorderThickness 0；Hover `SecondaryBrush` / Pressed `SecondaryDeepBrush` | 标题栏最小化按钮基样式 |
| WindowClosedButton | 无 | Button；`WindowsCloseGeometry` 15×15（`WindowsCloseGeometry`，Geometries.xaml）；Hover `WarningToolBrush` + Path Fill `PrimaryDefaultBrush` / Pressed `WarningBrush` + 同 Fill | 标题栏关闭按钮；**被 MessageBox.xaml 复用** |
| （窗口标题栏资源）WindowTitleBrush | — | Brushes.xaml LinearGradientBrush（标题栏底） | 两窗口 + MessageBox 共用 |

## 5. 框架写法示例

**无使用实例**（ManualView.xaml 与 Demo 均未引用 CommonWindow）。以下为模板证据构造：

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

- **必须显式指定样式**：`CommonWindowStyle` 是有键样式，无隐式默认样式证据；不指定则退化为控件内部默认（.cs 不可见）。
- 标题栏行为全部由属性驱动：`NonClientAreaHeight` 统一定高；`HideAllButton="True"` 隐藏 最小化+关闭，`HideMinMaxButton="True"` 隐藏最小化；`IsFullScreen="True"` 全屏化。
- 无最大化按钮（CommonWindow 与 CornerRadiusWindow 的关键差异，见 [corner-radius-window](corner-radius-window.md)）。
- 标题/图标引用本地化文本键与图标资源，勿硬编码（见 [03-writing-paradigm](../../00-guide/03-writing-paradigm.md) 总则 4/5）。

## 6. 禁止写法对照

### ❌ 禁止：原生 Window + 手拼标题栏（常规 WPF 写法）

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

### ✅ 推荐：CommonWindow 一行属性化

```xml
<controls:CommonWindow Style="{StaticResource CommonWindowStyle}"
                       Title="{DynamicResource …}"
                       NonClientAreaHeight="40">
    <!-- 内容 -->
</controls:CommonWindow>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写按钮没有 WindowClosedButton 的 Hover（WarningToolBrush + PrimaryDefaultBrush 图标）/ Pressed（WarningBrush）全套画刷触发器与 15×15 WindowsCloseGeometry 规范；
2. **② 丢失协议挂点**：HideAllButton/HideMinMaxButton/IsFullScreen/NonClientAreaHeight 四个窗口协议属性与模板命名部件（btnMin/btnClose）挂点全无——整窗行为无从属性化；
3. **③ 无法样式族切换**：不能经 CommonWindowStyle→CornerRadiusWindowStyle 一键切换窗口形态（普通/圆角阴影），手拼版本永远定死；
4. **⑤ 脱离视觉规范**：`WindowChrome.IsHitTestVisibleInChrome="True"`（模板证据）保证标题栏按钮区在 chrome 区域可命中，手写 WindowStyle=None 后标题栏拖拽/系统命令（SystemCommands.Minimize/CloseWindowCommand）均需自行实现，且 40px 按钮宽、SubHeaderFontSize 等 Token 全部失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/CommonWindow.xaml`（锚点 `x:Key="CommonWindowStyle"`、`x:Key="WindowBaseButton"`、`x:Key="WindowClosedButton"`、`x:Name="PART_NonClientArea"`、`Trigger Property="IsFullScreen"`）
- 窗口资源：`{source_root}/SDC/Brushes.xaml`（`x:Key="WindowTitleBrush"`）；`{source_root}/SDC/Fonts.xaml`（`x:Key="SubHeaderFontSize"`）；`{source_root}/SDC/Geometries.xaml`（`x:Key="WindowsMinGeometry"`、`x:Key="WindowsCloseGeometry"`）
- 交叉核实：`{source_root}/SDC/FrameworkGeneric.xaml` 的 `x:Key="ExitButtonStyle"`（ExitGeometry 退出按钮）**未被本窗口模板引用**——窗口关闭按钮专用样式是 `WindowClosedButton`；
- 真实使用：**无**（`{source_root}/ManualView.xaml` grep 无 `<controls:CommonWindow`；Demo 亦无）
- 索引交叉：`{index_root}/files/refence_SDC_Style_CommonWindow.xaml.json`（resource_references 存在性核对，P4 仅导航）；`{index_root}/capabilities/` 无对应 JSON

## 8. 待确认项

- **建议新 TD-011**：窗口语义属性族（IsFullScreen / HideAllButton / HideMinMaxButton / NonClientAreaHeight / 相关 DP）的 .cs 定义与默认值；`WindowStyle`/`AllowsTransparency` 未在样式设置时的实际 chrome 行为；`WindowBaseButton` 键在 CommonWindow.xaml（Button 版）与 CornerRadiusWindow.xaml（IconButton 版）重复定义时合并顺序生效语义（关联 TD-008）。
- 本控件无 IOEnable/s:Action/PageName 协议证据，不涉及 TD-001/002/003。
- 已登记待回填总表：`../../05-best-practices/pending-confirmations.md`。
