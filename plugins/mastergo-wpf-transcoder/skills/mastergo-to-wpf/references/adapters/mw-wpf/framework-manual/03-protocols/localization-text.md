# 文本与本地化键

<!-- evidence=部分确认(键引用形式确认,键定义位置待确认); pending=[TD-004]; verified=2026-08-13;
     sources=[{source_root}/ManualView.xaml] -->

## 1. 引用形式 ✅（调用面）

```xml
Content="{DynamicResource ManualOperationLoad}"
```

ManualView.xaml 观察到的文本键（`DynamicResource` 引用，`Content`/`IconText` 属性）：

| 键 | 证据位置 |
|---|---|
| `ManualOperationLoad` | :26 |
| `ManualOperationTeach` | :32 |
| `ManualOperationAlignment` | :38 |
| `ManualOperationCuttingAuto` | :43 |
| `ManualOperationCuttingSemiAuto` | :48 |
| `ManualOperationMoveWorkpiece` | :54 |
| `ManualOperationCleanCoating` | :60 |
| `ManualOperationUnload` | :63 |
| `ManualOperationUnloadAllWorkpiece` | :68 |
| `ManualOperationTargetRecognitionVerification` | :75 |
| `ManualOperationCoatingManual` | :78 |
| `ManualOperationCleaningManual` | :83 |
| `ManualOperationMoveWorkpieceManualLoad` | :89 |
| `ManualOperationHairlineAdjust` | :94 |
| `ManualOperationEXIT` | :113 |

## 2. 已确认与待确认 ✅/❓

- ✅ 页面文本一律 `DynamicResource` 文本键——ManualView 中**没有硬编码中文**（全部走键）。
- ✅ 文本键命名 `{页面或模块}{语义}` 模式（`ManualOperation*`）。
- ❓ TD-004：这些键在 refence 内**找不到定义**（语义笔记同结论）——键定义位置（宿主语言资源字典）与语言切换机制待确认。

## 3. 写法对照

### ❌ 禁止：硬编码文案
```xml
<TextBlock Text="装片到切割台"/>
<Button Content="返回"/>
```

### ✅ 推荐：DynamicResource 文本键
```xml
<s:IconButton Content="{DynamicResource ManualOperationLoad}" …/>
```
禁止原因：① 硬编码文案无法随语言切换（工控设备多语言是常态）；② 文案集中在资源字典可统一审校，散落在 XAML 不可维护；③ 框架全页面已按此执行，硬编码破坏一致性（总则 4）。

## 4. 待确认项

- TD-004：文本键定义位置与语言切换机制。
