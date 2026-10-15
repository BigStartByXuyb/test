<!-- evidence=部分确认(属性/样式族/触发器均为模板源码直接证据；无真实页面使用，区块 5 为模板证据构造); pending=[TD-001,TD-002,TD-003,TD-004]; verified=2026-08-13; sources=[{source_root}/SDC/Style/StepFrame.xaml, {source_root}/ManualView.xaml] -->

# StepFrame（步骤框架）

## 1. 用途

向导式步骤容器：**顶部横向步骤条（StepPolygon 三段箭头项）+ 中部内容区（SelectedContent）+ 底部操作区（65 高：上一步 / 下一步 / 返回）**。步骤项三态 Status（Complete/UnderWay/Waiting）驱动画刷族；`StepFrameItemStyleSelector` 按位置自动分配 First/Default/Last 箭头样式；CanNextStep / CanRebackStep / IsStepButtonEnabled 构成步骤闸门。

典型场景：多步骤工艺向导（装片→对位→切割…）——**无真实页面使用**（ManualView.xaml / FrameworkGeneric.xaml / Demo 均未引用，见区块 5，以下均为模板证据构造）。

## 2. 声明

```xml
<s:StepFrame … />
<s:StepFrameItem … />
<s:StepPolygon … />   <!-- 模板内部使用，使用方一般不需要 -->
```

`s` = http://www.maxwell-gp.com/；TargetType = `controls:StepFrame` / `controls:StepFrameItem` / `controls:StepPolygon`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。本文件同时声明 MaxwellControl.Tools 三件套：`StepFrameItemStyleSelector`、`MultiBooleanConverter`（x:Key="multiBooleanConverter"）、`IndexConverter`。

## 3. 关键属性表

### StepFrame 级

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| SelectedContent | object | 当前步骤内容，由模板部件 PART_SelectedContentHost 呈现；「步骤项内容→SelectedContent」的流动机制在 .cs（本地不可见） | `ContentPresenter x:Name="PART_SelectedContentHost" ContentSource="SelectedContent"` | 🟡 |
| CanNextStep | bool | 「下一步」按钮可用性（PART_ButtonNext.IsEnabled 直接模板绑定） | `IsEnabled="{TemplateBinding CanNextStep}"` | ✅ |
| CanRebackStep | 类型待定 | 「返回」按钮显隐（PART_ButtonReback.Visibility 直接模板绑定——属性类型为 Visibility 或 .cs 内置转换，本地无法确认） | `Visibility="{TemplateBinding CanRebackStep}"` | 🟡 |
| IsStepButtonEnabled | bool | 底部操作区总闸（DockPanel.IsEnabled）；「上一步」另以 MultiBooleanConverter 绑定**同一属性两次**（疑似遗留写法） | `IsEnabled="{TemplateBinding IsStepButtonEnabled}"` + `MultiBinding`（multiBooleanConverter） | 🟡 |
| ItemContainerStyleSelector | StyleSelector | 固定挂 `StepFrameItemStyleSelector`（按 First/Default/Last 自动分配项样式） | `Setter Property="ItemContainerStyleSelector"` | ✅ |
| ItemsPanel | Panel | 横向 `StepFrameHorizontalItemsPanelTemplate`（WrapPanel）；竖向 UniformGrid 模板已定义但无活动样式引用 | `Setter Property="ItemsPanel"` | ✅ |

### StepFrameItem 级

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Status | enum | 步骤三态：`Complete` / `UnderWay` / `Waiting`，各驱动一组画刷（StepFrameItemBaseStyle Style.Triggers） | `Trigger Property="Status" Value="Complete"/"UnderWay"/"Waiting"` | ✅ |
| Header | object | 步骤标题文本（ContentSource） | `ContentPresenter ContentSource="Header"`（三种项模板） | ✅ |
| Background / BorderBrush / Foreground | Brush | 三态画刷由 StepFrameItemBaseStyle 注入，模板 TemplateBinding 到 StepPolygon / 标题文本 | `Background="{TemplateBinding Background}"` 等 | ✅ |
| Width / Margin | double | 样式族固定 120 宽；首/中项 Margin 0,0,-21,0（负边距实现箭头重叠），末项 0 | FirstStepItemStyle / DefaultStepItemStyle / LastStepItemStyle Setter | ✅ |
| 内容区 | — | 活动项模板只呈现 Header，**不呈现 Content**——步骤内容应经容器 SelectedContent 呈现（机制待确认，见区块 8） | 项模板无 ContentPresenter(Content) | 🟡 |

### StepPolygon 级（模板内部控件）

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| ItemMode | enum | 三段箭头几何：`FirstItem` / `DefaultItem` / `LastItem` | `ItemMode="FirstItem"/"DefaultItem"/"LastItem"` | ✅ |
| Width / Height / Background / BorderBrush | — | 全部模板绑定直通 StepFrameItem（30 高） | TemplateBinding | ✅ |

## 4. 样式族表（SDC\Style\StepFrame.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| StepFrameBaseStyle | 无 | ItemContainerStyleSelector=StepFrameItemStyleSelector；模板=`StepFrameHorizontalScrollableTopControlTemplate`（中部内容区 ScrollViewer）；ItemsPanel=WrapPanel | 基类，不直接用 |
| （无键默认样式） | StepFrameBaseStyle | 全局兜底 | 默认 StepFrame |
| StepFrameNonscrollableStyle | 无 | 同三 Setter，模板=`StepFrameHorizontalTopControlTemplate`（中部内容区 Border，无滚动）；「返回」按钮文本键为 `Back`（与滚动版 `ControlBack` 不同） | 内容区不滚动的变体 |
| StepFrameItemBaseStyle | 无 | 仅 Status 三态画刷 Trigger（Complete→PrimaryDefaultBrush/ThirdlyDeepBrush/ThirdlyDeepGradientBrush；UnderWay→TextBrush/HoverBrush；Waiting→DisableTextBrush/PrimaryBorderBrush/ThirdlyLightGradientBrush） | 步骤项基类，不直接用 |
| FirstStepItemStyle | StepFrameItemBaseStyle | 120 宽；Margin 0,0,-21,0；StepPolygon `FirstItem`；Header Margin 0,0,20,0 | 首项（左侧箭头起点） |
| DefaultStepItemStyle | StepFrameItemBaseStyle | 120 宽；Margin 0,0,-21,0；StepPolygon `DefaultItem` | 中间项（箭头相互重叠） |
| LastStepItemStyle | StepFrameItemBaseStyle | 120 宽；Margin 0；StepPolygon `LastItem`；Header Margin 20,0,0,0 | 末项 |

- **模板部件**（两个 ControlTemplate 共用，均由 .cs 按约定查找）：`PART_SelectedContentHost`、`PART_ButtonPrev`、`PART_ButtonNext`、`PART_ButtonReback`。
- **面板模板**：`StepFrameHorizontalItemsPanelTemplate`（WrapPanel，活动中）；`StepFrameVerticalItemsPanelTemplate`（UniformGrid Columns=1，已定义无活动样式引用——疑似预留）。
- **画刷家族**：`{source_root}/SDC/Brushes/StepFrameBrushes.xaml` 共 9 键（StepFrame_DefaultBackBrush/DefaultTextBrush/HoverBackBrush/HoverBorderBrush/HoverTextBrush/SelectBackBrush/SelectBorderBrush/SelectIconBrush/SelectTextBrush），命名段见 `../../01-resources/brushes.md`。
- **文本键**（TD-004 域）：ControlPreStep / ControlNextStep / ControlBack（滚动版）；Back（非滚动版「返回」）——两模板键不一致。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**：ManualView.xaml、FrameworkGeneric.xaml、Demo（P3）均未引用 StepFrame/StepFrameItem/StepPolygon。

构造示例（用法由模板证据推导）：

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

逐项说明（均为模板证据推导）：
- 项样式由 `StepFrameItemStyleSelector` 按位置自动分配（首→FirstStepItemStyle、中→DefaultStepItemStyle、末→LastStepItemStyle），使用方**不手工指定**项样式；
- Header 走 DynamicResource 文本键（本地化体系，TD-004 域）；步骤内容经容器 `SelectedContent` 呈现在中部（PART_SelectedContentHost）——「内容如何流动到 SelectedContent」见区块 8 建议新 TD；
- 底部按钮文本（ControlPreStep/ControlNextStep/ControlBack）与可用性/显隐由模板固化，使用方不散写；
- 需内容区滚动用默认样式，不滚动用 `Style="{StaticResource StepFrameNonscrollableStyle}"`。

## 6. 禁止写法对照

### ❌ 禁止：手写 ItemsControl 步骤条 + 自管索引 + 上/下一步 Button（常规 WPF 写法）

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

### ✅ 推荐：StepFrame 三行声明式向导

```xml
<s:StepFrame>
    <s:StepFrameItem Header="{DynamicResource …步骤1文本键}"><!-- 内容 --></s:StepFrameItem>
    <s:StepFrameItem Header="{DynamicResource …步骤2文本键}"><!-- 内容 --></s:StepFrameItem>
</s:StepFrame>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写没有 StepPolygon 三段箭头几何（First/Default/LastItemMode）与 Status 三态画刷触发器族（Complete/UnderWay/Waiting，StepFrameItemBaseStyle）——「当前/已完成/未开始」视觉无法表达；
2. **② 丢失协议挂点**：CanNextStep/CanRebackStep/IsStepButtonEnabled 步骤闸门是向导流程与设备联锁（TD-001 家族，见 03-protocols/device-condition-protocol.md）的接缝；手写 Button 的 IsEnabled 靠 ViewModel 自管，挂不上框架协议；
3. **③ 无法样式族切换**：StepFrameItemStyleSelector 自动分配首/中/末样式、滚动/非滚动模板一键切换（StepFrameNonscrollableStyle），手写结构每个步骤条都要重画；
4. **④ 绕过本地化**：硬编码「上一步/下一步」绕过 ControlPreStep/ControlNextStep/ControlBack 文本键（TD-004）；
5. **⑤ 脱离视觉规范**：120 宽 −21 负边距箭头重叠、30 高步骤条、65 高按钮区、2px PrimaryBorderBrush 边框、KeyboardNavigation 焦点顺序（TabIndex 1/2）全部失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/StepFrame.xaml`（锚点 `x:Key="StepFrameBaseStyle"`、`x:Key="StepFrameNonscrollableStyle"`、`x:Key="StepFrameItemBaseStyle"`、`x:Key="FirstStepItemStyle"`、`x:Key="DefaultStepItemStyle"`、`x:Key="LastStepItemStyle"`、`x:Key="StepFrameHorizontalScrollableTopControlTemplate"`、`x:Key="StepFrameHorizontalTopControlTemplate"`、`x:Key="StepFrameHorizontalItemsPanelTemplate"`、`x:Key="StepFrameVerticalItemsPanelTemplate"`、`x:Key="StepFrameItemStyleSelector"`、`x:Key="multiBooleanConverter"`、`x:Key="IndexConverter"`、`x:Name="PART_SelectedContentHost"/"PART_ButtonPrev"/"PART_ButtonNext"/"PART_ButtonReback"`、`Trigger Property="Status"`、`ItemMode="FirstItem"/"DefaultItem"/"LastItem"`、`TemplateBinding SelectedContent/CanNextStep/CanRebackStep/IsStepButtonEnabled`）
- 画刷家族：`{source_root}/SDC/Brushes/StepFrameBrushes.xaml`（9 键，见区块 4）
- 真实使用：**无**（ManualView.xaml / FrameworkGeneric.xaml / Demo 均未引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_StepFrame.xaml.json`、`{index_root}/files/refence_SDC_Brushes_StepFrameBrushes.xaml.json`；capabilities/ 下无 step-frame.json
- 相关文档：`../README.md`（控件索引）、`../../01-resources/brushes.md`（StepFrame_ 命名段）、`../../01-resources/effects-converters.md`（转换器索引）、`../../03-protocols/device-condition-protocol.md`（TD-001）、`../../03-protocols/localization-text.md`（TD-004）、`../../00-guide/03-writing-paradigm.md`

## 8. 待确认项

- TD-001 / TD-002 / TD-003：StepFrame 模板按钮为普通 Button（无 IOEnable/s:Action/PageName 挂点）；向导步骤与设备联锁的接合方式待框架作者说明。
- TD-004：ControlPreStep / ControlNextStep / ControlBack / Back 文本键定义位置（两模板「返回」键不一致：ControlBack vs Back）。
- 建议新 TD（未登记，待维护者写入 `../../05-best-practices/pending-confirmations.md`）：
  - StepFrame.SelectedContent 来源与 StepFrameItem 内容→SelectedContent 的流动机制（.cs 不可见，仅 PART_SelectedContentHost 模板证据）；
  - StepFrame.CanRebackStep 属性类型与 bool→Visibility 转换机制（模板直接绑定 Visibility）；
  - StepFrame.multiBooleanConverter 行为与 PART_ButtonPrev 同一属性双绑（两个活动模板一致如此，疑似遗留）；
  - StepFrame.IndexConverter 行为（活动声明 x:Key="IndexConverter"，但仅被注释旧模板引用，活动模板未使用）；
  - StepFrameVerticalItemsPanelTemplate 已定义但无活动样式引用（疑似预留）；
  - StepFrame.Status 的置位驱动机制（由谁、何时切换，.cs 不可见）。
