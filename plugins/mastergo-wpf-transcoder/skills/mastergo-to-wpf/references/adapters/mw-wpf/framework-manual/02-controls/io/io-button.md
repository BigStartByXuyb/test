<!-- evidence=已确认(隐式默认样式 Setter/触发器为模板源码直接证据；无 P2 页面使用实例); pending=[TD-001, 待确认 TD-xxx];
     verified=2026-08-13; sources=[{source_root}/SDC/Style/Button.xaml, {source_root}/ManualView.xaml] -->

# IOButton（IO 按钮）

## 1. 用途

设备条件绑定按钮：复用 `ButtonBaseStyle` 的图标+文字模板（SimplePanel 双层 Border + Icon Path + ContentPresenter），隐式默认样式仅追加 Hover/Pressed 触发器组（`DefaultButton_*` 画刷）。典型场景（推断，无 P2 实例）：需要设备联锁的单发动作按钮（与 IconButton 并存的手写替代定位见区块 6）。按 IO 系列定位（见 [device-condition-protocol](../../03-protocols/device-condition-protocol.md)），应挂 IOEnable 设备联锁通道，但模板无 IOEnable 引用证据（见区块 3/8）。

## 2. 声明

```xml
<s:IOButton … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:IOButton`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。样式证据：`{source_root}/SDC/Style/Button.xaml` 中**隐式默认样式**（无 x:Key，TargetType 直接匹配），非命名样式；无独立 ControlTemplate（继承 ButtonBaseStyle 模板）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background / BorderBrush / Foreground | Brush | 默认 `DefaultButton_DefaultBackBrush` / `DefaultButton_DefaultBorderBrush` / `DefaultButton_DefaultTextBrush`；Hover → `DefaultButton_HoverBackBrush`/`HoverBorderBrush`/`HoverTextBrush`；Pressed → `DefaultButton_SelectBackBrush`/`SelectBorderBrush`/`SelectTextBrush` + BorderThickness 1 | `Style TargetType="controls:IOButton"` Setter + `Style.Triggers` 内 `Trigger Property="IsMouseOver"` / `Trigger Property="IsPressed"`（继承自 ButtonBaseStyle 的 Setter） | ✅ |
| FontSize / FontWeight | double / FontWeight | 默认 SubHeaderFontSize（14）/ Bold | ButtonBaseStyle Setter（BasedOn 链） | ✅ |
| Width / Height | double | 默认 100×35（`ButtonWidth`/`ButtonHeight`，Sizes.xaml） | ButtonBaseStyle Setter | ✅ |
| BorderThickness | Thickness | 默认 1；Pressed 时 1（触发器覆盖） | ButtonBaseStyle Setter + IsPressed Trigger | ✅ |
| controls:BorderElement.CornerRadius | CornerRadius | 默认 3 | ButtonBaseStyle Setter | ✅ |
| Content | object | 主文字；为 Null 时隐藏 | ButtonBaseStyle 模板 `Trigger Property="Content" Value="{x:Null}"`（TargetName="ContentPresenterMain"） | ✅ |
| controls:ButtonAttach.IconGeometory | Geometry | 图标几何（附加属性，Path.Data 绑定）；为 Null 时隐藏图标、文字占满 | ButtonBaseStyle 模板 `Trigger Property="Data" SourceName="Icon"` | ✅ |
| IOEnable | string/bool | 设备条件表达式或 `true`；**本模板无任何引用**，IO 系列走 IOEnable 通道为协议文档声明（SDC 全库 XAML 无 IOEnable 字样） | 无锚点 + [device-condition-protocol](../../03-protocols/device-condition-protocol.md) | 🟡 [待确认 TD-001] |

## 4. 样式族表（SDC\Style\Button.xaml，IOButton 相关）

| 样式键 | BasedOn | 关键特征（尺寸/字号/画刷/模板差异） | 适用场景 |
|---|---|---|---|
| （隐式默认样式，TargetType=controls:IOButton） | ButtonBaseStyle | 100×35、Bold、BorderElement.CornerRadius 3、Icon（ButtonAttach.IconGeometory，20×20）+ 文字模板；Style.Triggers 追加 Hover/Pressed（DefaultButton_* 画刷，Pressed 边 1）；Disabled Opacity 0.5 | IOButton 全局兜底 |

样式链：隐式默认 → `ButtonBaseStyle`（Button.xaml）→ `ButtonBaseBaseStyle`（ButtonBase）→ `BaseStyle`。无命名变体样式键（IOButton 暂无 Main/Gray 等形态族）。**与原生 Button 的隐式默认样式（Button.xaml 同文件，TargetType=Button）触发器逐行相同**——IO 差异仅在控件类型（.cs 属性面不可见）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 项目均未出现 `s:IOButton`。

```xml
<s:IOButton Content="{DynamicResource …按钮文本键}"
            controls:ButtonAttach.IconGeometory="{StaticResource …Geometry 键}" />
```

- Content 走 DynamicResource 文本键（本地化，见 [localization-text](../../03-protocols/localization-text.md)）；图标走 Geometry 键（见 [geometries-icons](../../01-resources/geometries-icons.md)）；
- IOEnable 是否挂载待确认（见区块 8），确认前页面侧不自行设置；
- 动作绑定（s:Action）、页面跳转（PageName）在 IconButton 上已确认（见 [icon-button](../navigation/icon-button.md)），IOButton 是否具备同协议待确认。

## 6. 禁止写法对照

### ❌ 禁止：原生 Button + 手工 IsEnabled 联锁 + 手写状态画刷触发器拼装等效视觉（常规 WPF 写法）

```xml
<Button IsEnabled="{Binding RunStopped}"
        Width="100" Height="35" FontSize="14" FontWeight="Bold">
    <Button.Resources>
        <SolidColorBrush x:Key="DefaultButton_HoverBackBrush" Color="#…"/>
        <!-- 手写 DefaultButton_* 画刷与 Hover/Pressed 触发器… -->
    </Button.Resources>
    <StackPanel Orientation="Horizontal">
        <Path Data="M…" Fill="{Binding Foreground, RelativeSource={RelativeSource AncestorType=Button}}"/>
        <TextBlock Text="启动" Margin="10,0,0,0"/>
    </StackPanel>
</Button>
```

（`IsEnabled="{Binding RunStopped}"` 手工联锁反例对照 [device-condition-protocol](../../03-protocols/device-condition-protocol.md) 第 3 节。）

### ✅ 推荐：IOButton 一行属性化（模板证据构造）

```xml
<s:IOButton Content="{DynamicResource …文本键}"
            controls:ButtonAttach.IconGeometory="{StaticResource …Geometry 键}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 ButtonBaseStyle 模板的 Content=Null/Icon=Null 隐藏触发器、Disabled 双 Opacity 0.5，以及 IOButton 隐式样式的 DefaultButton_* Hover/Pressed 触发器组；
2. **② 丢失协议挂点**：IO 系列控件走 IOEnable 设备联锁通道（协议文档声明，见 [device-condition-protocol](../../03-protocols/device-condition-protocol.md)）；`IsEnabled="{Binding …}"` 手工联锁是框架协议（总则 3）明令禁止的等价机制重复发明；
3. **③ 无法样式族切换**：100×35、CornerRadius 3、20×20 图标、画刷组全部散写，不能由样式链（隐式默认 → ButtonBaseStyle）一处调整；
4. **④ 绕过本地化与图标体系**：硬编码"启动"文案绕过 DynamicResource 文本键；手写 Path Data 绕过 Geometry 键体系（总则 4/5）；
5. **⑤ 脱离视觉规范**：Bold 14、双 Border 圆角模板、焦点策略（BaseStyle FocusVisualStyle=Null）脱离框架控制，与框架按钮族视觉无法统一。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Button.xaml`（锚点 `Style TargetType="controls:IOButton"`、`Style BasedOn="{StaticResource ButtonBaseStyle}" TargetType="Button"`、`x:Key="ButtonBaseStyle"`、`x:Key="ButtonBaseBaseStyle"`、`Trigger Property="IsMouseOver"`、`Trigger Property="IsPressed"`、`controls:ButtonAttach.IconGeometory`）
- 配套资源：`{source_root}/SDC/Sizes.xaml`（`ButtonWidth`/`ButtonHeight`/`Button_IconWidth`/`Button_IconHeight`）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件；ManualView 同屏按钮均用 `s:IconButton`，见 [icon-button](../navigation/icon-button.md)）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Button.xaml.json`

## 8. 待确认项

- TD-001：IOEnable 表达式语义（[device-condition-protocol](../../03-protocols/device-condition-protocol.md)）——IO 系列是否实际挂载 IOEnable 及条件失败行为，模板无证据。
- [待确认 TD-xxx]：IOButton 隐式默认样式与原生 Button 隐式默认样式触发器逐行相同——IO 差异仅在控件类型（.cs 属性面不可见，如 IOEnable/动作协议挂载情况），待框架作者回填（已建议编号，见 [pending-confirmations](../../05-best-practices/pending-confirmations.md)）。
- [待确认 TD-xxx]：IOButton 无独立模板与命名样式键、无页面使用实例——控件实际使用定位（相对 IconButton/ControlButton 的取舍）待确认。
