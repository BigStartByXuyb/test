<!-- evidence=场景对照(组装层,无新证据;正确写法原样摘自已写条目); pending=[TD-013]; verified=2026-08-14; sources=[{source_root}/SDC/Geometries.xaml, {source_root}/SDC/Style/IconControl.xaml, {source_root}/SDC/Brushes.xaml, {source_root}/ManualView.xaml]
     反例有效性(2026-08-14 grep 验证): ManualView.xaml 无 `<Path`/`<Image`/`pack://`/位图引用(零命中),全部图标走 {StaticResource …Geometry} 键(15 个 Geometry 键); SDC\Style\ 中 Path 仅存在于框架自身模板内部(IconButton 模板 PathMain、各按钮模板等),页面层手写 Path Data/位图的结构未出现在真实页面 -->

# 场景：图标与资源

## 场景⑫：图标引用（按钮图标 / 纯显示图标）

> **关键规则**：图标一律引用 Geometry 键（826 键图标库，`{StaticResource …Geometry}`），禁止手写 Path Data 或位图资源；图标着色由样式族状态画刷代管，页面禁止直接引用状态画刷。

### 场景描述

页面上放图标功能按钮（左上角 F 键 + 中央图标 + 底部文字）或纯显示小图标（只读标记），图标与配色统一可维护、可换装。

### 推荐控件

| 需求要点 | 框架控件/协议 | 对应条目 |
|---|---|---|
| 图标按钮（图标+文字+角标） | IconButton（Icon 属性收 Geometry） | ../02-controls/navigation/icon-button.md |
| 纯显示图标 | IconControl（Icon/IconWidth/IconHeight） | ../02-controls/navigation/icon-control.md |
| 图标库 | `{StaticResource …Geometry}`（SDC\Geometries.xaml 588 键 + IconGeometry.xaml 238 键） | ../01-resources/geometries-icons.md |
| 着色与状态画刷 | 样式族状态画刷（页面不直接引用） | ../01-resources/brushes.md |

### 对照 A：图标引用

#### ❌ 禁止：常规 WPF 写法（手写 Path Data / 位图资源）

```xml
<Path Data="M0,0 L9,11 18,0 z" Fill="#bbc2cc"/>
<Image Source="pack://application:,,,/Assets/icon.png"/>
```

（纯显示场景的等效手写：`<Path Data="M…（手写几何）…" Fill="Black" Stretch="Fill" Width="20" Height="20"/>`——同样禁止。）

#### ✅ 推荐：框架写法（引用 Geometry 键，原样摘自 02-controls/navigation/icon-control.md §5，模板证据构造）

```xml
<s:IconControl Icon="{StaticResource ManualOperationF1Geometry}"
               IconWidth="20" IconHeight="20" />
```

按钮场景（原样摘自 ManualView.xaml:25-29）：

```xml
<s:IconButton TopLeftContent="F1"
              Content="{DynamicResource ManualOperationLoad}"
              Icon="{StaticResource ManualOperationF1Geometry}"
              IOEnable="CTC.RUN==0 &amp;&amp; CTC.Transfer==0"
              Click="{s:Action LoadWaferToCutStage}" />
```

- 键名注意：`EXITGeometry`（ManualView:112）与 `ExitGeometry`（FrameworkGeneric:24）两种大小写并存，引用时以目标文件实际键为准；
- 新增图标：在 `SDC\Geometries.xaml`（或 `IconGeometry.xaml`）加 `{业务}{用途}Geometry` 键，页面用 StaticResource 引用，再同步跑 `tools/generate-ai-index.py`。

### 对照 B：图标着色（状态画刷）

#### ❌ 禁止：常规 WPF 写法（页面直接切换状态画刷 / 散写画刷值）

```xml
<Button x:Name="Btn">
    <Button.Style>…触发器手写 Background={StaticResource DefaultButton_HoverBackBrush}…</Button.Style>
</Button>
```

#### ✅ 推荐：框架写法（用样式族，状态画刷由模板 Trigger 自动切换，原样摘自 01-resources/brushes.md §3）

```xml
<s:IconButton Style="{StaticResource MainButtonStyle}" …/>
```

### 禁止原因（对照 A/B 合并）

1. **⑤ 脱离视觉规范（总则 5）**：手写 `Path.Data` 绕过 826 键 Geometry 图标库，图标无法统一替换与维护；位图（Image）缩放失真且不随主题换装，Geometry 矢量无损；图标键是设计稿→实现的一致性锚点（mastergo-to-wpf 转换也以 Geometry 键为契约）；
2. **③ 无法样式族切换/统一控制**：散写 Path 的尺寸/Stretch/画刷不可由样式统一控制，改 IconControl 的 IconWidth/IconHeight 一处生效；状态画刷族是给 ControlTemplate.Triggers 用的，页面手写触发器 = 手写状态机，与框架重复，绕过样式族后新增/调整状态（如 Hover→Select）不可传导；
3. **① 丢失状态/行为面**：各页面散写 Path 时 `Stretch="Fill"` 等比例填充行为无法保证一致，图标缩放呈现失控；图标按钮（IconButton）的 Hover/Pressed/Disabled 全套触发器与 Disabled 透明度（0.56）、IsNeedRedMark 红字删除线随之丢失；
4. **④ 键耦合断裂**：页面代码直接引用状态画刷键后，键更名即全页面断裂（状态画刷由样式的 Trigger 代管，页面不直接引用）；文本/图标键均从资源字典取，硬编码值无法随资源体系更新（总则 4/5 关联）。

## 证据来源

- 模板证据（P1）：`{source_root}/SDC/Style/IconControl.xaml`（锚点：隐式默认样式 `TargetType controls:IconControl`、模板 `Path Data/Height/Width TemplateBinding`）；`{source_root}/SDC/Style/IconButton.xaml`（`x:Key="IconButtonBaseStyle"`/`x:Key="MainButtonStyle"`，PathMain 模板绑定 Icon/IconWidth/IconHeight）
- 资源证据：`{source_root}/SDC/Geometries.xaml`（588 键）、`{source_root}/SDC/IconGeometry.xaml`（238 键）、`{source_root}/SDC/Brushes/ButtonBrushes.xaml` 等 12 文件（状态画刷族命名 `{控件前缀}_{状态}_{用途}`）
- 真实使用（P2）：`{source_root}/ManualView.xaml`——15 个 Geometry 键（ManualOperationF1/2/3/4/5/6/8/9/10Geometry、CleanCoatingGeometry、ManualCoatingGeometry、ManualCleaningGeometry、MoveToManualFeedingGeometry、BaseLineCalibrateF5Geometry、EXITGeometry）+ `Content="{DynamicResource …}"` 文本键
- 反例有效性：见文件头注释（grep 验证结论，2026-08-14）
- 待确认项：TD-013（IconControl 着色机制——模板 Fill=Black 硬编码，是否存在着色属性/约定）；关联 TD-002（s:Action）、TD-004（文本键）——见 `../05-best-practices/pending-confirmations.md`
