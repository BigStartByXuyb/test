<!-- evidence=已确认(属性 Setter/模板/触发器均为模板源码直接证据；PasswordBoxAttach 行为与控件基类 .cs 不可见); pending=[TD-035,TD-038];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/PasswordBox.xaml, {source_root}/SDC/FrameworkGeneric.xaml, {source_root}/ManualView.xaml] -->

# PasswordBox（密码输入框）

## 1. 用途

框架版密码输入框：模板内组合**原生 PasswordBox**（PART_Password），通过 `LoginPasswordBox` 样式注入——左侧锁形图标（PasswordIconGeo）+ 占位水印（`PleaseEnterPassword` 文本键，密码长度 0 时显示）+ 弹出键盘挂点（Pop_keyBoard）。Hover/聚焦边框 `PrimaryToolBrush`、禁用半透明 0.56。

典型场景（推断，无 P2 实例）：登录页密码、权限验证密码输入。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<s:PasswordBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:PasswordBox`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。模板根为 ContentControl、内部嵌套原生 PasswordBox（`x:Name="PART_Password"`，套用 `LoginPasswordBox` 样式）——组合控件而非 PasswordBox 子类（模板证据；基类与 Password 属性转发待 .cs 确认）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| controls:PasswordBoxAttach.IsMonitoring | bool | 原生 PasswordBox 上开启密码长度监测（登录样式内 Setter）；行为语义 .cs 不可见 | LoginPasswordBox `Setter Property="controls:PasswordBoxAttach.IsMonitoring" Value="True"` | 🟡 [待确认 TD-038] |
| controls:PasswordBoxAttach.PasswordLength | int | 密码长度；=0 时显示占位水印（模板 Trigger） | LoginPasswordBox 模板 `Trigger Property="controls:PasswordBoxAttach.PasswordLength" Value="0"` → placeholder Visible | 🟡 [待确认 TD-038] |
| Height / Width | 30 / 150（默认样式） | 默认尺寸硬编码（非 Token） | 隐式默认样式 Setter | ✅ |
| BorderThickness / controls:BorderElement.CornerRadius | 1 / 3 | 边框与圆角 | 隐式默认样式 Setter | ✅ |
| Background / BorderBrush / Foreground | PrimaryDefaultBrush / ButtonBorderGradientBrush / TextBrush | 默认画刷；Hover/聚焦切 PrimaryToolBrush | 样式 Setter + 模板 Trigger | ✅ |
| VerticalContentAlignment / IsTabStop / FocusVisualStyle | Center / False / {x:Null} | 对齐与焦点策略 | 样式 Setter | ✅ |
| IsEnabled | bool | 禁用：Opacity 0.56 | PasswordBoxDefaultTemplate `Trigger Property="IsEnabled"` | ✅ |
| （无 IsError / Poptip / NumericKeypadAttach 证据） | — | 默认模板仅 3 组触发器，无错误态、无键垫附加属性触发（区别于 SwitchPasswordBox/StringNumberBox） | PasswordBoxDefaultTemplate 全文 | ✅（阴性证据） |
| （无 IOEnable / s:Action / PageName 证据） | — | 模板无协议挂点 | 模板全文 + `{source_root}/ManualView.xaml` | ✅（阴性证据） |

## 4. 样式族表（SDC\Style\PasswordBox.xaml）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| PasswordIconGeo | —（Geometry 资源） | 锁形 PathGeometry，`o:Freeze="True"` 预冻结（注释：解决 Freezable 无法冻结异常） | 登录样式锁图标 |
| LoginPasswordBox | 无（TargetType 原生 PasswordBox） | 400×50、BorderThickness 2、FontSize 16 Bold、锁图标 + 占位水印（PasswordLength=0 显示）+ PART_ContentHost；IsMonitoring=True | 登录/大尺寸密码框（也作 controls:PasswordBox 模板内部宿主） |
| PasswordBoxDefaultTemplate | —（ControlTemplate） | 默认模板：PART_Password（套 LoginPasswordBox）+ Pop_keyBoard；3 组触发器（Hover/聚焦 PrimaryToolBrush、禁用 0.56） | 内部模板键（隐式默认样式.Template 引用） |
| （隐式默认样式，无 x:Key） | 无（独立；合并 BaseStyle.xaml） | 30×150 紧凑尺寸 + 默认模板 | 未显式指定 Style 时 |
| LoginPasswordBoxStyle（外部文件） | — | FrameworkGeneric.xaml 同名同构样式（键名差一个 Style 后缀，模板与 LoginPasswordBox 逐行同构但无 Hover/聚焦触发器）——**双定义疑点** | 待合并顺序确认（关联 TD-008/TD-026 模式） |

**注释遗留**：本文件隐式默认样式前注释为「数字输入框」（`PasswordBox.xaml` 样式定义处），与实际 PasswordBox 不符，疑似从数字输入框文件复制遗留（TD-038）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 与组合模板均未使用 controls:PasswordBox（grep 全库仅定义处命中）。以下为模板证据构造。

```xml
<s:PasswordBox Width="300" Height="30" />
```

- 占位水印自动生效：密码长度为 0 时显示 `PleaseEnterPassword` 文本键（本地化键，定义位置见 TD-004），输入后自动隐藏；
- 锁形图标内建于 LoginPasswordBox 模板，无需页面侧附加任何图标；
- 密码原文属性面（Password/PasswordChar 转发）依赖 controls:PasswordBox 基类 .cs，待确认（TD-038）；在此之前密码框内容由内部 PART_Password 承载。

## 6. 禁止写法对照

### ❌ 禁止：手写 PasswordBox + 锁图标 + 占位水印 + 触发态（常规 WPF 写法）

```xml
<Border BorderBrush="#b0b9c4" BorderThickness="2" CornerRadius="3">
    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="50"/>
            <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>
        <Path Margin="15" Width="20" Height="20" Fill="#b0b9c4"
              Data="M-0.000,18.000 …锁几何路径…"/>
        <Grid Grid.Column="1">
            <TextBlock x:Name="ph" Text="请输入密码" Foreground="Gray" Margin="8,6"/>
            <PasswordBox x:Name="pwd" BorderThickness="0" Margin="12,2,2,2"/>
        </Grid>
    </Grid>
</Border>
<!-- 再手写：空密码显示水印、聚焦换边框、禁用半透明、软键盘 Popup… -->
```

### ✅ 推荐：PasswordBox 一行（模板证据构造）

```xml
<s:PasswordBox Width="300" Height="30" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版缺失 Hover/聚焦 PrimaryToolBrush 边框、禁用三部件 Opacity 0.4（登录样式）/0.56（默认模板）触发态；
2. **② 丢失协议挂点**：PasswordBoxAttach.IsMonitoring / PasswordLength（水印显隐协议）、Pop_keyBoard 弹出键盘挂点全无，水印只能硬编码 + 手工事件维护；
3. **③ 无法样式族切换**：不能一键切换 30×150 紧凑型 → LoginPasswordBox 登录型（400×50 大字号）；
4. **④ 绕过本地化**：水印"请输入密码"硬编码绕过 `PleaseEnterPassword` DynamicResource 文本键体系（TD-004）；
5. **⑤ 脱离视觉规范**：锁图标几何（PasswordIconGeo）、FontSize 16 Bold、焦点策略（IsTabStop=False）等规范脱离框架控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/PasswordBox.xaml`（锚点 `x:Key="PasswordIconGeo"`、`x:Key="LoginPasswordBox"`、`x:Key="PasswordBoxDefaultTemplate"`、`x:Name="PART_Password"`、`Trigger Property="controls:PasswordBoxAttach.PasswordLength"`）
- 双定义对照：`{source_root}/SDC/FrameworkGeneric.xaml`（`x:Key="LoginPasswordBoxStyle"`，锚点 `Setter Property="controls:PasswordBoxAttach.IsMonitoring"`、`Trigger Property="controls:PasswordBoxAttach.PasswordLength"`）
- 本地化键：`PleaseEnterPassword`（DynamicResource 使用证据 PasswordBox.xaml + FrameworkGeneric.xaml，定义位置见 03-protocols/localization-text.md / TD-004）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_PasswordBox.xaml.json`

## 8. 待确认项

- **TD-035**：Pop_keyBoard 弹出键盘挂点的内容注入机制（本模板键垫挂点存在但无 NumericKeypadAttach 触发器——与家族其它控件不同）。
- **TD-038**：PasswordBoxAttach.IsMonitoring / PasswordLength 行为语义；controls:PasswordBox 与原生 PasswordBox 的关系（Password 属性转发面）；`LoginPasswordBox`（PasswordBox.xaml）与 `LoginPasswordBoxStyle`（FrameworkGeneric.xaml）双定义的合并顺序生效语义（关联 TD-008/TD-026）；「数字输入框」注释复制遗留确认。
