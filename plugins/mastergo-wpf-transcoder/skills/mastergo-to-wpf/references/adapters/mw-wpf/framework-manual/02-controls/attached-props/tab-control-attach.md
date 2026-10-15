<!-- evidence=已确认(消费处为模板源码直接证据；宿主 .cs 不可见); pending=[TD-006]; verified=2026-08-14;
     sources=[{source_root}/SDC/Style/TabControl.xaml, {source_root}/SDC/Style/IOTabControl.xaml, {source_root}/ManualView.xaml] -->

# TabControlAttach（页签头部附加属性）

## 1. 用途

框架页签头部外观协议：宿主类 `controls:TabControlAttach` 提供**头部外观附加属性族**（Background/HeaderHeight/HeaderWidth/FontSize），挂在 TabControl 上，由 TabItem 模板消费（TemplateBinding）——头部高度/宽度/底色/字号统一由 TabControl 侧配置，TabItem 模板零硬编码。

消费家族：TabControl.xaml 六样式族（TabControlBaseStyle + 次/三级/垂直/异形变体）与 IOTabControl 家族。

## 2. 声明

```xml
<controls:TabControl …/>
<!-- 族级默认由 TabControlBaseStyle Setter 群提供，页面通常不直接写 -->
```

- `controls` = `clr-namespace:MaxwellControl.Controls`；
- **双向消费结构**（模板源码证据）：TabControl 侧样式 Setter 设值（TabControl.xaml:123-126）→ TabItem 模板内 TemplateBinding 取值（:77-79/83/87）；HeaderHeight/HeaderWidth 在垂直头部样式中**交换消费**（:489-491：Width=HeaderHeight、Height=HeaderWidth）。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 头部/标签底色（族默认 `TabItem_DefaultBackBrush` / `SecondTabItem_DefaultBackBrush`） | TabControl.xaml:123（TabControlBaseStyle Setter）+ :77（TabItem 模板 TemplateBinding） | 🟡 [TD-006] |
| HeaderHeight | double | 标签最小高度（族默认 `TabControlHeaderHeight` Token；次/三级变体覆盖；垂直样式反用为宽度） | TabControl.xaml:124 + :78（模板）+ :244-246/:359-362（变体）+ :489-491（垂直交换） | 🟡 [TD-006] |
| HeaderWidth | double | 标签最小宽度（族默认 `TabControlHeaderWidth`；次/三级变体 = Auto） | TabControl.xaml:125 + :79 + :489-491 | 🟡 [TD-006] |
| FontSize | double | 头部字号（族默认 `HeadFontSize` / `SubHeaderFontSize`） | TabControl.xaml:126 + :87（模板）；:594-597（二级族） | 🟡 [TD-006] |
| 其余成员 | — | 全库 grep 命中集中于上述四属性 | grep 统计 | ❓ TD-006 |

跨家族分布（模板源码证据）：TabControlBaseStyle :123-126；TabControlSecondary* :244-246（HeaderWidth=Auto）；TabControlThirdly* :359-362；垂直头部 :489-491（宽高交换）；二级 Token :594-597；:708-710/:735 另有消费；IOTabControlBaseStyle :116-119 + IOTabItem 模板 :74/78。

## 4. 样式族表

无（本条目为附加属性；消费样式族见 [tab-control](../native/tab-control.md)、[io-tab-control](../io/io-tab-control.md) 条目）。

## 5. 框架写法示例

**无使用实例**——ManualView.xaml 零附加属性引用。以下为 P1 模板证据构造。

```xml
<controls:TabControl Style="{StaticResource TabControlSecondaryStyle}">
    <TabItem Header="{DynamicResource …}">
        <…/>
    </TabItem>
</controls:TabControl>
```

- 页面只写 Header 与内容，头部外观由 TabControlAttach 族级默认统一；
- 换族即换头部形态（高度/宽度/底色/字号随样式族 Setter 群切换）。

## 6. 禁止写法对照

### ❌ 禁止：手写 TabItem 模板 + 标签样式散写（等效替代）

```xml
<TabControl>
    <TabControl.Resources>
        <Style TargetType="TabItem">
            <Setter Property="Height" Value="35"/>
            <Setter Property="FontSize" Value="14"/>
            <Setter Property="Background" Value="#FF…"/>
        </Style>
    </TabControl.Resources>
    <TabItem Header="…"/>
</TabControl>
```

### ✅ 推荐：TabControlAttach 族级配置

```xml
<controls:TabControl Style="{StaticResource TabControlBaseStyle}">
    <TabItem Header="{DynamicResource …}"/>
</controls:TabControl>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **③ 无法样式族切换**：头部外观被钉死在页面 Style.Triggers/Setter，一键换族（Base→Secondary→Thirdly→垂直）完全失效；
2. **② 丢失协议挂点**：HeaderHeight/HeaderWidth 垂直交换协议（:489-491 宽高互换算例）无从表达——手写版垂直样式必须另写一套；
3. **① 丢失状态**：Hover/Pressed/Selected 头部状态画刷联动（TabItem_DefaultBackBrush 族默认）脱离，手写版状态视觉不统一；
4. **⑤ 脱离视觉规范**：头部高度/字号/底色 Token（TabControlHeaderHeight 等 Sizes/Fonts 键）散写页面失控；
5. **④ 绕过统一配置**：IOTabControl 与 TabControl 家族统一配置通道失效，两族视觉基线分叉。

## 7. 参考锚点

- 消费模板：`{source_root}/SDC/Style/TabControl.xaml`（锚点 `x:Key="TabControlBaseStyle"` Setter 群 :123-126、`x:Key="TabItemHorizontalStyle"` 模板 :77-79/83/87、次/三级 :244-246/:359-362、垂直交换 :489-491、二级 Token :594-597、:708-710/:735）
- IO 家族：`{source_root}/SDC/Style/IOTabControl.xaml`（IOTabItemHorizontalStyle 模板 :74/78、IOTabControlBaseStyle :116-119）
- 真实使用：无（ManualView.xaml 不含附加属性引用）
- 索引交叉：`{index_root}/files/refence_SDC_Style_TabControl.xaml.json`

## 8. 待确认项

- **TD-006**（复用）：TabControlAttach 宿主类成员全集与类型确认；**附加属性继承机制疑点**——TabControl 侧 Setter 的附加属性值如何到达 TabItem 模板（WPF 附加属性继承需 Inherits 元数据，或 TabItem 侧亦有同键绑定；.cs 不可见，机制待回填）。
