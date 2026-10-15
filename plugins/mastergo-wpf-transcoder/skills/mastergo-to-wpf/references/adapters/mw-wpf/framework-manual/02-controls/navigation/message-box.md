<!-- evidence=已确认(属性/样式族/触发器均为模板源码 P1 直接证据; 无 P2 使用实例; 画刷族与图标几何为定义级证据); pending=[TD-010];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/MessageBox.xaml, {source_root}/ManualView.xaml] -->

# MessageBox（框架消息框）

## 1. 用途

框架消息框：**40px 标题栏（标题 + 关闭钮）+ 图标区（50×50）+ 主内容（PrimaryContent）+ 次要内容（SecondContent）+ 按钮区（PART_Panel）** 的固定结构，`ShowImage` / `ShowPrimaryContent` / `ShowSecondContent` 三开关经触发器矩阵自动调整各区块的显隐与边距。典型场景：确认/提示/错误对话框。

注意：**ManualView.xaml 中无使用实例**（grep 无 `controls:MessageBox` 出现），使用面由模板证据构造；按钮区与弹出方式依赖 .cs（不可见），见区块 8。

## 2. 声明

```xml
<controls:MessageBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:MessageBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。样式为 **`<Style TargetType="controls:MessageBox">` 无 x:Key 的隐式默认样式**——全局兜底，无需也不应显式指定样式。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Title | string | 标题栏文字（PART_NonClientArea 内 TextBlock，默认 "MessageBox"） | Setter + `Text="{TemplateBinding Title}"` | ✅ |
| PrimaryContent | string | 主内容文本；FontSize 14、MaxWidth 500、Wrap + CharacterEllipsis；默认 Collapsed，由 Show* 触发器显隐 | `Text="{TemplateBinding PrimaryContent}"` + TargetName="PrimaryContent" | ✅ |
| SecondContent | string | 次要内容文本；FontSize 12、MaxWidth 500 | `Text="{TemplateBinding SecondContent}"` | ✅ |
| ShowPrimaryContent | bool | True 显示 PrimaryContent；与 ShowSecondContent 组合时调整 SecondContent/PrimaryContent 的 Margin 与 Visibility | `MultiTrigger Condition Property="ShowPrimaryContent"` | ✅ |
| ShowSecondContent | bool | True 显示 SecondContent | `MultiTrigger Condition Property="ShowSecondContent"` | ✅ |
| ShowImage | bool | True 显示 PART_Path 图标（50×50）并联动 SecondContent/PART_Panel 边距 | `Trigger Property="ShowImage" Value="True"` + TargetName="PART_Path" | ✅ |
| Image | Geometry | 图标几何（PART_Path.Data，Stretch=Uniform） | `Data="{TemplateBinding Image}"` | ✅ |
| ImageBrush | Brush | 图标填充色 | `Fill="{TemplateBinding ImageBrush}"` | ✅ |
| CloseButtonVisible | Visibility | 右上角关闭钮显隐（PART_ButtonClose，复用 WindowClosedButton 样式） | `Visibility="{TemplateBinding CloseButtonVisible}"` | ✅ |
| 尺寸约束 | MinHeight 100 / MinWidth 225 / MaxHeight 400 / MaxWidth 900 | 窗口尺寸上下限 | Setter Property="MinHeight" 等 | ✅ |
| ResizeMode / SizeToContent | NoResize / WidthAndHeight | 不可缩放、随内容自适应 | Setter Property="ResizeMode"/"SizeToContent" | ✅ |
| FontFamily / FontSize / Foreground | Microsoft YaHei UI / 14 / #505050 | 全局文字规范 | Setter Property="FontFamily" 等 | ✅ |
| WindowChrome | CornerRadius 0、GlassFrameThickness 1、UseAeroCaptionButtons False、NonClientFrameEdges None | 无系统按钮的标题栏区域定义 | `Setter Property="WindowChrome.WindowChrome"` | ✅ |
| 按钮区 PART_Panel | StackPanel（Horizontal，右对齐） | 模板命名部件，按钮由 .cs 侧注入（机制不可见） | `Name="PART_Panel"` | 🟡 [建议 TD-010] |
| MessageBox 画刷族 | MessageBoxSuccessBrush / DangerBrush / AccentBrush / WarningBrush（#f39700）/ InfoBrush | Brushes.xaml 定义（NormalColor/WarningColor/PrimaryLightColor 派生），**模板内未引用**——推断供代码侧设置 ImageBrush/按钮画刷配对使用 | `{source_root}/SDC/Brushes.xaml` x:Key 定义（锚点） | 🟡 [建议 TD-010] |
| MessageBox 图标几何 | MessageBoxInfoGeometry / MessageBoxAskGeometry（50×50） | Geometries.xaml 定义，**模板内未引用**——推断与 Image 属性配对 | `{source_root}/SDC/Geometries.xaml` x:Key 定义（锚点） | 🟡 [建议 TD-010] |

## 4. 样式族表（SDC\Style\MessageBox.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （隐式默认样式，无 x:Key）`TargetType="controls:MessageBox"` | 无（MergedDictionaries：BaseStyle.xaml + CommonWindow.xaml） | 标题栏 40px（`MessageBoxHeaderHeight`）+ `WindowTitleBrush`；关闭钮复用 `WindowClosedButton`（40×40，`MessageBoxHeaderCloseButtonWidth`）；内容区 图标 PART_Path 50×50 + PrimaryContent/SecondaryContent ScrollViewer + PART_Panel 按钮区；Show* 触发器矩阵（MultiTrigger 组合显隐与 Margin）；尺寸 100~400 / 225~900、SizeToContent | 框架消息框，全局默认即生效 |
| 外部复用：WindowClosedButton | — | CommonWindow.xaml 定义（Hover WarningToolBrush / Pressed WarningBrush） | 消息框右上角关闭钮 |
| 尺寸 Token：MessageBoxHeaderHeight / MessageBoxHeaderCloseButtonWidth | — | Sizes.xaml 各 40 | 标题栏高 / 关闭钮宽 |

## 5. 框架写法示例

**无使用实例**（ManualView.xaml 与 Demo 均未引用 MessageBox）。以下为模板证据构造：

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

- 样式为隐式默认样式，**无需也不应**写 `Style=`。
- 内容组合由三开关驱动，模板自动处理边距/显隐（如 ShowImage=True + ShowSecondContent=True 时 SecondContent 下边距 24；ShowPrimaryContent=True + ShowSecondContent=False 时 SecondContent 折叠）——页面无需手工 Margin。
- 按钮（确认/取消等）经 `PART_Panel` 命名部件注入（.cs 侧机制不可见，见区块 8）；弹出方式（Show/ShowDialog）同理推断。
- 图标建议配对 `MessageBoxInfo/AskGeometry`（Geometries.xaml 50×50 键）+ `MessageBox*Brush` 画刷（Brushes.xaml 五色语义：Success/Danger/Accent/Warning/Info）——定义级证据存在，配对语义待确认。

## 6. 禁止写法对照

### ❌ 禁止：手写 Window + TextBlock + Button 拼消息框（常规 WPF 写法）

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

### ✅ 推荐：MessageBox 属性化

```xml
<controls:MessageBox Title="{DynamicResource …}"
                     PrimaryContent="{DynamicResource …}"
                     ShowPrimaryContent="True"
                     Image="{StaticResource MessageBoxInfoGeometry}"
                     ImageBrush="{StaticResource MessageBoxInfoBrush}"
                     ShowImage="True"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态/组合逻辑**：ShowImage/ShowPrimaryContent/ShowSecondContent 的 MultiTrigger 矩阵（边距 24/0、Visibility 联动，模板 Trigger 证据）手写需逐条维护，组合一多必出错；
2. **② 丢失模板部件协议**：PART_ButtonClose（CloseButtonVisible）、PART_Panel（按钮注入）、PART_SecondContent 命名部件与 WindowChrome 配置（UseAeroCaptionButtons=False）无挂点，消息框行为无法框架化驱动；
3. **④ 绕过本地化**：硬编码"提示/确定要执行此操作吗？"绕过 DynamicResource 文本键体系（总则 4）；
4. **⑤ 脱离视觉规范**：尺寸约束（100~400/225~900）、SizeToContent、Microsoft YaHei UI 14px/#505050、40px 标题栏 Token（`MessageBoxHeaderHeight`）全部失控；且 MessageBox 五色画刷族（Success/Danger/Accent/Warning/Info）与 50×50 图标几何的语义配对无处安放；
5. **③ 无法全局统一**：手写消息框无法享受隐式默认样式的全局兜底——样式族升级时全站消息框同步生效，手拼版本则被排除。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/MessageBox.xaml`（锚点 `TargetType="controls:MessageBox"` 隐式样式、`Name="PART_NonClientArea"`、`Name="PART_ButtonClose"`、`Name="PART_Path"`、`Name="PART_SecondContent"`、`Name="PART_Panel"`、`Trigger Property="ShowImage"`、`MultiTrigger Condition Property="ShowPrimaryContent"`）
- 尺寸 Token：`{source_root}/SDC/Sizes.xaml`（`x:Key="MessageBoxHeaderHeight"` 40、`x:Key="MessageBoxHeaderCloseButtonWidth"` 40）
- 画刷：`{source_root}/SDC/Brushes.xaml`（`x:Key="WindowTitleBrush"`、`x:Key="MessageBoxSuccessBrush"`、`x:Key="MessageBoxDangerBrush"`、`x:Key="MessageBoxAccentBrush"`、`x:Key="MessageBoxWarningBrush"`、`x:Key="MessageBoxInfoBrush"`）
- 图标几何：`{source_root}/SDC/Geometries.xaml`（`x:Key="MessageBoxInfoGeometry"`、`x:Key="MessageBoxAskGeometry"`）
- 交叉核实：复用关闭钮 `x:Key="WindowClosedButton"`（`{source_root}/SDC/Style/CommonWindow.xaml`）；`{source_root}/SDC/FrameworkGeneric.xaml` 的 `x:Key="ExitButtonStyle"` **未被 MessageBox 模板引用**
- 真实使用：**无**（`{source_root}/ManualView.xaml` grep 无 `MessageBox`；Demo 亦无）
- 索引交叉：`{index_root}/files/refence_SDC_Style_MessageBox.xaml.json`、`{index_root}/files/refence_SDC_Brushes.xaml.json`（P4 仅导航）；`{index_root}/capabilities/` 无对应 JSON

## 8. 待确认项

- **建议新 TD-010**：MessageBox 使用协议——`PART_Panel` 按钮注入方式与 `MessageBox.Show/ShowDialog` 调用面（.cs 不可见）；`CloseButtonVisible` 默认值；`Image`/`ImageBrush` 与 MessageBox 五画刷族（Success/Danger/Accent/Warning/Info）及 MessageBoxInfo/AskGeometry 的配对语义（画刷族与图标几何仅有定义级证据，模板未引用，禁止按事实书写）。
- 本控件无 IOEnable/s:Action/PageName 协议证据，不涉及 TD-001/002/003。
- 已登记待回填总表：`../../05-best-practices/pending-confirmations.md`。
