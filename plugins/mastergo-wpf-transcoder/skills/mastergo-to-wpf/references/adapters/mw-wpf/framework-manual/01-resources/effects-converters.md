# 转换器 / 效果 / 对齐资源

<!-- evidence=已确认; verified=2026-08-13; sources=[{source_root}/SDC/Converters.xaml, {source_root}/SDC/Effects.xaml, {source_root}/SDC/RightAlignment.xaml] -->

## 1. Converters.xaml ✅

```xml
<ResourceDictionary … xmlns:tools="clr-namespace:MaxwellControl.Tools"
                    xmlns:controls="clr-namespace:MaxwellControl.Controls">
    <controls:TreeViewLineConverter x:Key="LineConverter"/>
</ResourceDictionary>
```

- 现成键：`LineConverter`（`controls:TreeViewLineConverter`，Converters.xaml ✅）——注意实例化前缀是 `controls:` 而非 `tools:`（文件原样）。
- 语义笔记所列的 `BoolToVisibilityConverter`、`MultiBooleanConverter`、`IndexConverter` 等转换器**未在本文件实例化**，只有 `LineConverter` 一个公开键 🟡（其余转换器如何获取待确认，归入 TD-006）。
- 页面使用：`Converter="{StaticResource LineConverter}"`。

## 2. Effects.xaml ✅

```xml
<DropShadowEffect x:Key="EffectShadow0" BlurRadius="2" ShadowDepth="0"
                  Direction="-90" Opacity=".25"
                  RenderingBias="Performance" o:Freeze="True" />
```
（Effects.xaml ✅）

- 现成键：`EffectShadow0`（上投影，性能偏向）。
- 页面使用：`Effect="{StaticResource EffectShadow0}"`。

## 3. RightAlignment.xaml ✅

```xml
<HorizontalAlignment x:Key="TextHorizontalAlignment">Right</HorizontalAlignment>
```
（RightAlignment.xaml ✅）

- 现成键：`TextHorizontalAlignment` = `Right`。文本右对齐的共享枚举资源。

## 4. 写法对照

### ❌ 禁止：页面内重复定义等效资源
```xml
<UserControl.Resources>
    <DropShadowEffect x:Key="MyShadow" BlurRadius="2" …/>
</UserControl.Resources>
```

### ✅ 推荐：引用框架键
```xml
<Border Effect="{StaticResource EffectShadow0}" …/>
```
禁止原因：① 框架已提供阴影/转换器/对齐键，页面内重复定义违反"不重新发明已有框架能力"（framework.config.json 规则 4）；② 分散定义后调参无法全局生效；③ 资源职责归属混乱（公共资源应只在 SDC，见 05-best-practices/resource-usage.md）。

## 5. 待确认项

- TD-006（部分）：语义笔记所列其余转换器（BoolToVisibilityConverter 等）的实例获取方式。
