<!-- evidence=已确认(属性/样式族/触发器均为模板源码 P1 直接证据; 无 P2 使用实例; 圆角为模板硬编码); pending=[TD-011];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/CornerRadiusWindow.xaml, {source_root}/ManualView.xaml] -->

# CornerRadiusWindow（圆角阴影弹窗）

## 1. 用途

CommonWindow 的**圆角 + 阴影变体**：`WindowStyle=None` + `AllowsTransparency=True`，模板自带圆角边框与 `ShadowBorder` 阴影，标题栏含 **最小化 / 最大化（还原）/ 关闭** 三个按钮，并随 `WindowState` 自动切换 最大化↔还原 的图标与命令。典型场景：带圆角阴影的独立对话框/弹窗。

注意：**ManualView.xaml 中无使用实例**（grep 无 `<controls:CornerRadiusWindow` 出现）；且**圆角为模板硬编码**（`CornerRadius="6 6 0 0"` / header `"5 5 0 0"`），模板证据中不存在圆角附加属性——「圆角可属性化」为待确认推断（见区块 8）。

## 2. 声明

```xml
<controls:CornerRadiusWindow … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:CornerRadiusWindow`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。样式键 `x:Key="CornerRadiusWindowStyle"`——有键样式，使用时须显式指定（无隐式默认样式证据）。

**文件结构注意**：CornerRadiusWindow.xaml 内含两代实现——前一份 Button 版 `CornerRadiusWindowStyle`（白底、Padding 10、Button 型窗口按钮）已**整体注释**（`<!-- … -->`），生效的是后一份 **IconButton 版**（透明底、Padding 5、IconButton 型窗口按钮）。文内同时注释保留了 Button 版 `WindowBaseButton`/`WindowClosedCornerRadiusButton`。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 默认 `CornerRadiusWindow_DefaultBackBrush`（WindowBrushes.xaml，PrimaryDefaultColor） | Setter Property="Background" | ✅ |
| WindowStyle | None | 无系统 chrome | Setter Property="WindowStyle" | ✅ |
| AllowsTransparency | True | 透明窗口（阴影与圆角前提） | Setter Property="AllowsTransparency" | ✅ |
| Title | string | 标题栏文字（SubHeaderFontSize 14、#505050、Microsoft YaHei UI） | `Text="{TemplateBinding Title}"` | ✅ |
| Icon | ImageSource | 标题栏左侧图标 20×20 | `Source="{TemplateBinding Icon}"` | ✅ |
| NonClientAreaHeight | double | 标题栏高；header 与 btnMin/btnMax/btnClose 四处同源绑定 | `Path=NonClientAreaHeight`（RelativeSource TemplatedParent） | ✅ |
| WindowState | Maximized/Normal | 模板触发器：Maximized→btnMax 图标换 `WindowsRestoreGeometry` + 命令换 `SystemCommands.RestoreWindowCommand` + Back_Boder Padding=0；Normal→反向 | `Trigger Property="WindowState"` + TargetName="btnMax"/"Back_Boder" | ✅ |
| IsFullScreen | bool | True 时 WindowState=Maximized | `Trigger Property="IsFullScreen"` | ✅ |
| HideAllButton | bool | True 隐藏 最小化/最大化/关闭 全部三钮 | `Trigger Property="HideAllButton"` + TargetName="btnMin"/"btnMax"/"btnClose" | ✅ |
| HideMinMaxButton | bool | True 隐藏 最小化+最大化（**保留关闭**，与 CommonWindow 仅隐藏最小化不同） | `Trigger Property="HideMinMaxButton"` + TargetName="btnMin"/"btnMax" | ✅ |
| 圆角 | — | **模板硬编码**：外/内框 `CornerRadius="6 6 0 0"`、标题栏 `"5 5 0 0"`、关闭钮 `"0 5 0 0"`；无圆角附加属性证据 | 模板 Border CornerRadius 字面量 | 🟡 [建议 TD-011] |
| 阴影 | — | `ShadowBorder` 样式：DropShadowEffect `#b4b4b4`、Direction -70、BlurRadius 5、ShadowDepth 10、Opacity 0.8 | `x:Key="ShadowBorder"` + Setter Property="Border.Effect" | ✅（固定值） |

## 4. 样式族表（SDC\Style\CornerRadiusWindow.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| CornerRadiusWindowStyle | 无（独立模板） | WindowStyle=None + AllowsTransparency=True；Back_Boder Padding 5（最大化时 0）；圆角 6 6 0 0 硬编码；ShadowBorder 阴影；标题栏 `MainMenuGradientBrush`；btnMin/btnMax/btnClose 为 `IconButton`（宽 35、高=NonClientAreaHeight、`WindowChrome.IsHitTestVisibleInChrome="True"`）；WindowState 触发器切换 最大化/还原 图标与命令 | 圆角阴影弹窗/对话框 |
| WindowBaseButton（IconButton 版） | 无 | 13×13 图标 Path（Stroke=Foreground）；Hover `PrimaryControlToolBrush` / Pressed `PrimaryBrush`+前景 `PrimaryDefaultBrush`；**键名与 CommonWindow.xaml 的 Button 版重复定义，合并顺序决定生效版本（关联 TD-008）** | 最小化/最大化按钮 |
| WindowClosedCornerRadiusButton | 无 | IconButton；右上圆角 `0 5 0 0`；`WindowsCloseGeometry` 15×15；Hover `WarningToolBrush`+Fill `PrimaryDefaultBrush` / Pressed `WarningBrush`+同 Fill | 关闭按钮 |
| ShadowBorder | 无 | Border.Effect = DropShadowEffect（固定参数） | 窗口阴影边框 |

## 5. 框架写法示例

**无使用实例**（ManualView.xaml 与 Demo 均未引用 CornerRadiusWindow）。以下为模板证据构造：

```xml
<controls:CornerRadiusWindow x:Class="…"
                             Style="{StaticResource CornerRadiusWindowStyle}"
                             Title="{DynamicResource …}"
                             Width="600" Height="400"
                             NonClientAreaHeight="40">
    <Grid>
        <!-- 弹窗内容；圆角与阴影由模板承担 -->
    </Grid>
</controls:CornerRadiusWindow>
```

- 与 CommonWindow 的差异全在样式：同一窗口类用法，`CornerRadiusWindowStyle` 即获得圆角 + 阴影 + 最大化按钮；`CommonWindowStyle` 则无圆角、无最大化。
- 最大化状态由模板自动处理（图标/命令/内边距联动），页面无需写 WindowState 逻辑。
- `HideAllButton="True"` 隐藏三钮（含关闭）；`HideMinMaxButton="True"` 只隐藏 最小化/最大化。
- 圆角值当前无法经属性覆盖（硬编码 6 6 0 0）——如需可配圆角，属框架扩展，按 `01-resources/README.md`「新增组件步骤」与用户确认后实施，禁止页面内自行叠 Border 模拟（总则 6）。

## 6. 禁止写法对照

### ❌ 禁止：原生 Window 手拼圆角 + 阴影 + 最大化还原（常规 WPF 写法）

```xml
<Window x:Class="…" WindowStyle="None" AllowsTransparency="True">
    <Border Padding="5" CornerRadius="6">
        <Border CornerRadius="6" Background="{StaticResource PrimaryDefaultBrush}">
            <Border.Effect>
                <DropShadowEffect Color="#b4b4b4" BlurRadius="5" ShadowDepth="10" Opacity="0.8"/>
            </Border.Effect>
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height="40"/><RowDefinition Height="*"/>
                </Grid.RowDefinitions>
                <Grid>
                    <TextBlock Text="标题" VerticalAlignment="Center"/>
                    <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
                        <Button Content="—" Click="Min_Click"/>
                        <Button x:Name="MaxBtn" Content="□" Click="Max_Click"/>
                        <Button Content="×" Click="Close_Click"/>
                    </StackPanel>
                </Grid>
                <Grid Grid.Row="1"><!-- 内容 --></Grid>
            </Grid>
        </Border>
    </Border>
</Window>
```

### ✅ 推荐：CornerRadiusWindow 一行属性化

```xml
<controls:CornerRadiusWindow Style="{StaticResource CornerRadiusWindowStyle}"
                             Title="{DynamicResource …}"
                             NonClientAreaHeight="40">
    <!-- 内容 -->
</controls:CornerRadiusWindow>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写按钮没有 WindowBaseButton（IconButton 版）的 Hover/Pressed 画刷触发器，关闭钮没有 WindowClosedCornerRadiusButton 的 WarningToolBrush/WarningBrush 视觉规范；
2. **② 丢失协议挂点**：最大化/还原的状态联动（WindowState Trigger 切换 `WindowsRestoreGeometry` 图标与 `SystemCommands.RestoreWindowCommand`、Back_Boder Padding=0）手写需在代码里逐项维护；IsFullScreen/HideAllButton/HideMinMaxButton 属性挂点全无；
3. **③ 无法样式族切换**：手拼版本无法经 CornerRadiusWindowStyle↔CommonWindowStyle 一键切换圆角/直角形态；且阴影参数（#b4b4b4/-70/5/10/0.8）脱离 ShadowBorder 键后全站无法统一调整；
4. **⑤ 脱离视觉规范**：圆角 6 6 0 0、35px 窗口按钮宽、MainMenuGradientBrush 标题栏、Microsoft YaHei UI/SubHeaderFontSize 字号体系全部散落手写，与框架窗口规范脱离；AllowsTransparency 下无 `WindowChrome.IsHitTestVisibleInChrome`（模板证据）则按钮区无法命中。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/CornerRadiusWindow.xaml`（锚点 `x:Key="CornerRadiusWindowStyle"`（IconButton 版生效）、`x:Key="WindowBaseButton"`（IconButton 版）、`x:Key="WindowClosedCornerRadiusButton"`、`x:Key="ShadowBorder"`、`x:Name="PART_NonClientArea"`、`Trigger Property="WindowState"`）
- 窗口资源：`{source_root}/SDC/Brushes/WindowBrushes.xaml`（`x:Key="CornerRadiusWindow_DefaultBackBrush"`）；`{source_root}/SDC/Brushes.xaml`（`x:Key="MainMenuGradientBrush"`、`x:Key="WindowTitleBrush"`）；`{source_root}/SDC/Geometries.xaml`（`x:Key="WindowsMinGeometry"`、`x:Key="WindowsMaxGeometry"`、`x:Key="WindowsRestoreGeometry"`、`x:Key="WindowsCloseGeometry"`）
- 交叉核实：`{source_root}/SDC/FrameworkGeneric.xaml` 的 `x:Key="ExitButtonStyle"`（ExitGeometry）**未被本窗口模板引用**；`WindowBaseButton` 键与 `{source_root}/SDC/Style/CommonWindow.xaml` 同名（Button 版）——合并顺序决定生效版本（关联 TD-008）
- 真实使用：**无**（`{source_root}/ManualView.xaml` grep 无 `<controls:CornerRadiusWindow`；Demo 亦无）
- 索引交叉：`{index_root}/files/refence_SDC_Style_CornerRadiusWindow.xaml.json`（P4 仅导航）；`{index_root}/capabilities/` 无对应 JSON

## 8. 待确认项

- **建议新 TD-011**：窗口语义属性族（IsFullScreen / HideAllButton / HideMinMaxButton / NonClientAreaHeight）的 .cs 定义与默认值；**圆角是否为可配置属性**（模板证据仅见硬编码 6 6 0 0，无附加属性）——若需配置化属框架扩展；WindowBaseButton 键冲突的合并语义（关联 TD-008）。
- 本控件无 IOEnable/s:Action/PageName 协议证据，不涉及 TD-001/002/003。
- 已登记待回填总表：`../../05-best-practices/pending-confirmations.md`。
