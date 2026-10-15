<!-- evidence=已确认(属性/样式族/触发器均为模板源码直接证据); pending=[TD-001,TD-002,TD-003];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/IconButton.xaml, {source_root}/ManualView.xaml] -->

# IconButton（图标业务按钮）

## 1. 用途

工控主功能按钮：**左上角快捷键标记 + 中央图标 + 底部文字**，内建四大能力——状态画刷全套触发器、设备条件（IOEnable）、动作绑定（s:Action）、页面跳转（PageName）。

典型场景：ManualView.xaml 左侧 F1~F14 主功能区（页面级 `MainButtonStyle` 统一样式）、右侧退出按钮（`RightButtonStyle` 变体）。

## 2. 声明

```xml
<s:IconButton … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IconButton`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| TopLeftContent | string | 左上角功能键标记（F1~F14）；为 Null 时模板隐藏（Trigger） | PART_MarkContent + `Trigger Property="TopLeftContent" Value="{x:Null}"` | ✅ |
| Content | object | 主文字；Viewbox(DownOnly) 包裹、Wrap 居中、经 RelativeSource 继承按钮前景/字号/字重；为 Null 时隐藏 | PART_ViewboxMain / DataTemplate / Content=Null Trigger | ✅ |
| Icon | Geometry | 图标几何（PathMain.Data）；为 Null 时隐藏图标且文字占满（Row 0 + RowSpan 2） | PathMain + Icon=Null Trigger | ✅ |
| IconWidth / IconHeight | double | 图标尺寸；基样式默认取 `Button_IconWidth`/`Button_IconHeight`（Sizes.xaml，20×20）；样式族覆盖：Main 55×70、Bottom 55×25、Gray 80×30 | 基样式 Setter + MainButtonStyle Setter | ✅ |
| IconColor | Brush | 仅 ButtonIconStyle 模板使用（Path.Fill） | ButtonIconStyle 模板 | ✅ |
| IconText | string | 文字按钮族专用（RightButtonStyle 图标左+文字右；UpDownRightButtonStyle 图标上+文字下） | MainText TextBlock | ✅ |
| IsShowStatus | bool | 右上角 15×15 状态矩形显隐（B2CConverter 转 Visibility） | PART_MarkIcon + B2CConverter | ✅ |
| StatusBrush | Brush | 状态矩形填充色 | PART_MarkIcon Fill | ✅ |
| IsNeedRedMark | bool | True 时角标红色 + 下划线删除线（Pen Red 2px） | IsNeedRedMark Trigger | ✅ |
| IsSelected | bool | 选中态（Select 画刷组，同按下态视觉） | IsSelected Trigger | ✅ |
| IOEnable | string/bool | 设备条件表达式或 `true`；语义待确认 | ManualView.xaml 14+1 处 | 🟡 [待确认 TD-001] |
| Click | `{s:Action Name}` | 动作标记扩展；解析机制待确认 | ManualView.xaml | 🟡 [待确认 TD-002] |
| PageName | `"Jump:…"` | 页面跳转协议；分段语义待确认 | ManualView.xaml | 🟡 [待确认 TD-003] |
| Background / BorderBrush / Foreground | Brush | 可覆盖默认画刷（如退出按钮 `Background="{StaticResource ExitBackground}"`） | ManualView.xaml + 各样式 Setter | ✅ |
| controls:BorderElement.CornerRadius | CornerRadius | 附加属性圆角（基样式 0；Main 3；Right/Gray 10） | 样式 Setter | ✅ |

## 4. 样式族表（SDC\Style\IconButton.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| IconButtonBaseStyle | BaseStyle | 默认模板；尺寸/图标尺寸取 DynamicResource（Button_IconButtonWidth 140×75、Button_IconWidth/Height 20×20）；BorderThickness=2；Focusable=False；Hover/Pressed/Selected/Disabled/IsNeedRedMark 全套触发器 | 基类，不直接用 |
| MainButtonStyle | IconButtonBaseStyle | 160×150；FontSize 16；Icon 55×70；圆角 3；BorderThickness 1；DefaultButton_* 画刷组 | ManualView 主功能按钮（页面级 BasedOn） |
| BottomButtonSmallStyle | IconButtonBaseStyle | 80×75；FontSize 14 | 底部小按钮 |
| BottomButtonStyle | IconButtonBaseStyle | 140×75；Focusable=True；Icon 55×25；FontSize 14 | 底部操作区 |
| GrayIconButtonStyle | IconButtonBaseStyle | 140×75；右对齐（Margin 0,0,-7.5,0）；圆角 10；arial；Icon 80×30；FontSize 18 | 灰底/右贴边变体 |
| RightButtonStyle | IconButtonBaseStyle | 140×75；**独立模板**：图标左（30×30）+ IconText 右；白边白字；Focusable=True；圆角 10；按压 Opacity 0.56 | 右侧退出/返回按钮（ManualView 退出按钮） |
| UpDownRightButtonStyle | IconButtonBaseStyle | 140×75；独立模板：图标上 + IconText 下 | 上下排列按钮 |
| NormalRightButtonStyle | IconButtonBaseStyle | 140×75；属性式变体（Style.Triggers 实现 Hover/Pressed，无独立模板） | 普通右贴边按钮 |
| ButtonIconStyle | 无（独立） | 30×30 纯图标小按钮；透明底；用 **IconColor** 属性着色；Disabled Opacity 0.4 | 内嵌图标按钮 |
| （无键默认样式） | IconButtonBaseStyle | TargetType 默认样式，全局兜底 | 未显式指定 Style 时 |

## 5. 框架写法示例（原样摘自 ManualView.xaml）

```xml
<s:IconButton TopLeftContent="F1"
              Content="{DynamicResource ManualOperationLoad}"
              Icon="{StaticResource ManualOperationF1Geometry}"
              IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0"
              Click="{s:Action LoadWaferToCutStage}" />
```

- **页面级统一样式**（推荐）：`<Style TargetType="{x:Type s:IconButton}" BasedOn="{StaticResource MainButtonStyle}"/>`（ManualView.xaml UserControl.Resources）——页内所有 IconButton 默认就是主按钮样式，个别变体再显式 `Style="…"` 覆盖。
- **返回/退出按钮变体**（ManualView.xaml 右侧）：`Style="{StaticResource RightButtonStyle}"` + `IconText="{DynamicResource ManualOperationEXIT}"` + `Icon="{StaticResource EXITGeometry}"` + `PageName="Jump:Home"` + `IOEnable="true"` + `Background="{StaticResource ExitBackground}"`。
- Content 用 DynamicResource 文本键（本地化，见 03-protocols/localization-text.md）；Icon 用 StaticResource Geometry 键（见 01-resources/geometries-icons.md）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Button + Grid 拼装等效视觉（常规 WPF 写法）

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

### ✅ 推荐：IconButton 一行属性化

```xml
<s:IconButton TopLeftContent="F10"
              Content="{DynamicResource …激光维护文本键}"
              Icon="{StaticResource LaserMaintain9F10Geometry}"
              IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0"
              Click="{s:Action …}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写 Button 没有 Hover/Pressed/Selected/Disabled 全套触发器与 Disabled 透明度 0.56、IsNeedRedMark 红字删除线（IconButton.xaml ControlTemplate.Triggers）；
2. **② 丢失协议挂点**：IOEnable 设备联锁、PageName 跳转、s:Action 动作三个协议挂点全无——设备联锁与页面跳转无从谈起；
3. **③ 无法样式族切换**：不能一键 MainButtonStyle→RightButtonStyle→BottomButtonStyle 换形态；
4. **④ 绕过本地化**：硬编码"激光维护"绕过 DynamicResource 文本键体系；
5. **⑤ 脱离视觉规范**：手写 Grid 的星号比例、Run 拼接角标与框架 160×150/圆角/焦点策略（Focusable=False）规范脱离，视觉与交互无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/IconButton.xaml`（锚点 `x:Key="IconButtonBaseStyle"`、`x:Key="MainButtonStyle"`、`x:Key="RightButtonStyle"`、`x:Key="ButtonIconStyle"`）
- 真实使用：`{source_root}/ManualView.xaml`（14 个主按钮 + 退出按钮）
- 索引交叉：`{index_root}/files/refence_ManualView.xaml.json`（resource_references 含 MainButtonStyle/RightButtonStyle/15 个 Geometry 键）；`{index_root}/capabilities/icon-button.json`

## 8. 待确认项

- TD-001（IOEnable 表达式语义）、TD-002（s:Action 解析机制）、TD-003（PageName 分段协议）——调用形式均已确认，语义待框架作者回填。
