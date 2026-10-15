<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-031]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/Button.xaml, {source_root}/SDC/Style/BigNumericKeypad.xaml, {source_root}/SDC/Style/BigStringKeypad.xaml, {source_root}/SDC/Style/RadioButtonBaseStyle.xaml, {source_root}/ManualView.xaml] -->

# ButtonAttach（按钮图标附加属性）

## 1. 用途

框架按钮图标协议：宿主类 `controls:ButtonAttach` 暴露 **IconGeometory** 附加属性（注意：**拼写为 "Geometory" 而非 "Geometry"**——既有 TD-031 已登记此拼写）——挂在按钮上，由按钮样式模板内 Path 消费（`Data` 绑定 + `Data=Null → Path Collapsed` 触发器）。用于**纯图标按钮**（按钮自身无 Content，图标即按钮视觉）。

消费面：Button.xaml 两个基样式（ControlButtonBaseStyle 18×18 / ButtonBaseStyle）、BigNumericKeypad / BigStringKeypad 功能键（Enter/方向键）、RadioButtonBaseStyle 主菜单样式（38×38）。

## 2. 声明

```xml
<Button Style="{StaticResource ControlButtonBaseStyle}"
        controls:ButtonAttach.IconGeometory="{StaticResource …Geometry}"
        Tag="…"/>
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- 模板消费：`Path Data="{TemplateBinding controls:ButtonAttach.IconGeometory}"` + `Data=Null → Visibility=Collapsed` 触发器（Button.xaml:41-44/108-111）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| IconGeometory | Geometry | 图标几何（Path.Data）；**Null → 图标 Path Collapsed** | Button.xaml:35（ControlButtonBaseStyle 模板 Path）+ :41-44（Data=Null Trigger）；Button.xaml:102 + :108-111（ButtonBaseStyle） | 🟡 [TD-031] |
| （命名拼写）| "Geometory" | 非 "Geometry"——全库唯一拼写，模板绑定原文 | BigNumericKeypad.xaml:128 等（`controls:ButtonAttach.IconGeometory=` 原样） | ✅（拼写即证据） |
| 其余成员 | — | 全库 grep 仅 IconGeometory 一属性命中 | grep 统计 | ❓ TD-031 |

模板细节（模板源码证据）：

- ControlButtonBaseStyle：Path 18×18、`Fill="{StaticResource ControlButton_DefaultIconBrush}"`（Button.xaml:35）；
- ButtonBaseStyle：Path `Fill="{Binding Foreground,…}"` 随按钮前景走（Button.xaml:102）；
- BigNumericKeypad.xaml:128/131/136/138/143（NumberEnterGeometry/UpArrowGeometry/LeftArrowGeometry/RightArrowGeometry/DownArrowGeometry，配合 `Tag="Enter"/"UpArrow"/…` 按键协议——键垫批条目）；BigStringKeypad.xaml:162/166/171/173/178 同构；
- RadioButtonBaseStyle.xaml:30：38×38 主菜单图标按钮；
- 与 IconElement（几何+尺寸+Source 三参，正写 Geometry）并存，两协议按消费模板区分——本属性为「仅几何、无尺寸协议」简版。

## 4. 样式族表

无（本条目为附加属性；消费样式族见 [io-button](../io/io-button.md)、[big-numeric-keypad](../keypad-input/big-numeric-keypad.md) 条目；普通 Button 的具体样式证据仍以 `Button.xaml` 为准）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<Button Style="{StaticResource ControlButtonBaseStyle}"
        controls:ButtonAttach.IconGeometory="{StaticResource EnterGeometry}"/>
```

- 几何键从几何资源库取（01-resources/geometries-icons.md）；
- 键垫功能键需同时给 `Tag`（键垫命令协议，见 big-numeric-keypad 条目）。

## 6. 禁止写法对照

### ❌ 禁止：手写 `<Button><Path …/></Button>`（等效替代）

```xml
<Button Width="18" Height="18" Background="Transparent" BorderThickness="0">
    <Path Data="{StaticResource …Geometry}" Fill="#FF…" Stretch="Uniform"/>
</Button>
```

### ✅ 推荐：ButtonAttach 属性化

```xml
<Button Style="{StaticResource ControlButtonBaseStyle}"
        controls:ButtonAttach.IconGeometory="{StaticResource …Geometry}"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：图标协议丢失——Data=Null 自动隐藏、前景继承（ButtonBaseStyle 版 Fill 随 Foreground）失效，空图标时留下空白按钮；
2. **① 丢失状态**：Hover/Pressed/Disabled 状态画刷（ControlButton_DefaultIconBrush 组、禁用 Opacity 0.4）无法作用于手写 Path；
3. **③ 无法样式族切换**：18×18→38×38 尺寸族切换（RadioButton 主菜单）失效，尺寸钉死在页面；
4. **⑤ 脱离视觉规范**：图标尺寸/着色/隐现策略散写页面，与按钮家族视觉基线脱节；
5. **④ 键垫协议断裂**：Big*Keypad 功能键的 Tag+图标组合协议（TD-031 关联）无从表达。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/Button.xaml`（锚点 `x:Key="ControlButtonBaseStyle"` :35 + :41-44、`x:Key="ButtonBaseStyle"` :102 + :108-111）
- 键垫消费：`{source_root}/SDC/Style/BigNumericKeypad.xaml`（:128/131/136/138/143）、`{source_root}/SDC/Style/BigStringKeypad.xaml`（:162/166/171/173/178）
- 其他消费：`{source_root}/SDC/Style/RadioButtonBaseStyle.xaml`（:30，38×38）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Button.xaml.json`

## 8. 待确认项

- **TD-031**（复用）：IconGeometory 拼写（"Geometory"）是否为框架原文设计（类成员名即此拼写）——模板绑定与 .cs 成员名必须一致，若框架确如此拼写则页面照抄；对照 IconElement.Geometry 正写成员，两协议合并/废弃计划待确认。
