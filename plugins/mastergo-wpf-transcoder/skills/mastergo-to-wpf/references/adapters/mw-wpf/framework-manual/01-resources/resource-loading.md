# 资源加载与合并

<!-- evidence=部分确认(加载顺序仅 Demo 证据,refence 本体无 App.xaml); verified=2026-08-13;
     sources=[{demo_root}/App.xaml, {source_root}/SDC/FrameworkGeneric.xaml, docs/ai-index/semantic/sdc-resource-and-style-system.md] -->

## 1. 加载顺序（P3 证据 ✅，仅 Demo）

`{demo_root}/App.xaml` 按职责合并资源字典，注释明确"资源职责分离(对齐 refence/SDC 框架结构)"：

```xml
<ResourceDictionary Source="SDC/Colors.xaml"/>
<ResourceDictionary Source="SDC/Fonts.xaml"/>
<ResourceDictionary Source="SDC/Sizes.xaml"/>
<ResourceDictionary Source="SDC/Brushes.xaml"/>
<ResourceDictionary Source="SDC/Icons.xaml"/>
<ResourceDictionary Source="SDC/Style/MenuButtons.xaml"/>
```

顺序：**Colors → Fonts → Sizes → Brushes → Icons → Style**（底层 Token 在前，样式在后，保证样式能解析到画刷/图标）。

注意：Demo 的 `SDC/Icons.xaml`、`SDC/Style/MenuButtons.xaml` 是 **Demo 本地文件**，refence SDC 中不存在同名文件；refence 本体**没有 App.xaml**（不是独立可编译工程）。完整宿主合并顺序与外部程序集来源 → **[待确认 TD-008]**。

## 2. FrameworkGeneric.xaml 的定位 ✅

框架级默认模板与附加属性模板的入口（`FrameworkGeneric.xaml`，`xmlns:controls="clr-namespace:MaxwellControl.Controls"`）：

- `ExitButtonStyle`：Button 通用退出按钮样式，模板第一层容器为 `controls:SimplePanel`，图标 `Data="{DynamicResource ExitGeometry}"`。
- `UserComboBoxEditableTextBox` / `UserComboBoxToggleButton` / `UserComboBoxItemStyle`（:52 起）：自研 ComboBox 三件套默认样式。
- 后续段含 `controls:BorderElement` / `DropDownElement` / `PasswordBoxAttach` 等附加属性模板（见 02-controls/attached-props/）。

## 3. StaticResource vs DynamicResource 选用规则 ✅（ManualView 使用面归纳）

| 引用对象 | 用 | 证据 |
|---|---|---|
| 样式键 | `StaticResource` | `Style="{StaticResource MainButtonStyle}"`（ManualView.xaml） |
| 图标 Geometry | `StaticResource` | `Icon="{StaticResource ManualOperationF1Geometry}"` |
| 画刷 | `StaticResource` | `Background="{StaticResource ExitBackground}"`；`Fill="{StaticResource BorderBrush}"` |
| 文本键 | `DynamicResource` | `Content="{DynamicResource ManualOperationLoad}"`——运行时语言切换 |
| 模板内资源 | `DynamicResource` | `Data="{DynamicResource ExitGeometry}"`（FrameworkGeneric.xaml） |

经验规则：**样式/图标/画刷用 StaticResource（加载期解析、性能）；文本用 DynamicResource（支持运行时换语言）**。

## 4. 写法对照

### ❌ 禁止：页面内摊平公共资源
```xml
<UserControl.Resources>
    <Color x:Key="MyPrimary">#1f2e54</Color>   <!-- 与 Colors.xaml 重复 -->
    <Style x:Key="MyButton">…</Style>          <!-- 与样式族重复 -->
</UserControl.Resources>
```

### ✅ 推荐：页面只写"页面级"资源（如目标类型默认样式），公共资源全部引框架键
```xml
<UserControl.Resources>
    <Style TargetType="{x:Type s:IconButton}" BasedOn="{StaticResource MainButtonStyle}"/>
</UserControl.Resources>
```
（ManualView.xaml ✅ 页面级 BasedOn 统一样式的正确示范）

禁止原因：① 公共资源重复定义后两处漂移，主题失配；② 违反"按照 refence 原目录职责组织代码"（framework.config.json 规则 2）；③ 页面级只允许做"基于样式族的局部统一样式"，不允许造新视觉。

## 5. 待确认项

- TD-008：宿主完整合并顺序（含 `Brushes/`、`Geometries.xaml`、`IconGeometry.xaml`、`FrameworkGeneric.xaml`、`Style/*` 的加入位置）与 MaxwellControl 程序集来源。
