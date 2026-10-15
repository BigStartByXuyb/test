# 图标 Geometry（Geometries.xaml + IconGeometry.xaml）

<!-- evidence=已确认; verified=2026-08-13; sources=[{source_root}/SDC/Geometries.xaml, {source_root}/SDC/IconGeometry.xaml, {source_root}/Geometries.xaml, {source_root}/ManualView.xaml] -->

## 1. 图标库构成 ✅

| 文件 | 键数 | 说明 |
|---|---|---|
| `SDC\Geometries.xaml` | 588 | 主图标 Geometry 库 |
| `SDC\IconGeometry.xaml` | 238 | 图标 Geometry 补充库 |
| `refence\Geometries.xaml`（根目录副本） | — | 顶层副本 |

命名规律：**业务名 + `Geometry` 后缀**，如 `ManualOperationF1Geometry`（ManualView.xaml ✅）、`CleanCoatingGeometry`、`EXITGeometry`、`BaseLineCalibrateF5Geometry`。

## 2. 引用方式 ✅

```xml
Icon="{StaticResource ManualOperationF1Geometry}"
```

- 控件属性收 `Geometry`（IconButton 的 `Icon`、Path 的 `Data` 等），`StaticResource` 加载期解析（ManualView.xaml 等 15 处 ✅）。
- `FrameworkGeneric.xaml` 的 ExitButtonStyle 中为 `Data="{DynamicResource ExitGeometry}"` ✅——模板内为动态引用，页面级一律 `StaticResource`。
- 键名注意：`EXITGeometry`（ManualView:112）与 `ExitGeometry`（FrameworkGeneric:24）两种大小写并存，引用时以目标文件实际键为准（用 ai-index `files/*.json` 的 `resource_references` 交叉核对）。

## 3. 写法对照

### ❌ 禁止：手写 Path Data / 位图资源
```xml
<Path Data="M0,0 L9,11 18,0 z" Fill="#bbc2cc"/>
<Image Source="pack://application:,,,/Assets/icon.png"/>
```

### ✅ 推荐：引用 Geometry 键
```xml
<s:IconButton Icon="{StaticResource ManualOperationF1Geometry}" …/>
```
禁止原因：① 826 键图标库统一维护，手写 Data 是重复造资源且无法全局换装；② 位图不随尺寸缩放不失真，Geometry 矢量无此问题；③ 图标键是设计稿→实现的一致性锚点（mastergo-to-wpf 转换也以 Geometry 键为契约）。

## 4. 新增图标

1. 在 `SDC\Geometries.xaml`（或 `IconGeometry.xaml`）加 `Geometry` 键，命名 `{业务}{用途}Geometry`。
2. 页面用 `StaticResource` 引用。
3. 同步跑 `tools/generate-ai-index.py` 刷新 ai-index（framework-guide.md 推荐流程第 7 步）。
