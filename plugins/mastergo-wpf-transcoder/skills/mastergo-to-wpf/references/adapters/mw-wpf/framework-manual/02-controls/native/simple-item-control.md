<!-- evidence=已确认(全部为 P1 模板源码直接证据——单隐式样式，无键式样式无触发器); pending=[TD-064];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/SimpleItemControl.xaml, {source_root}/ManualView.xaml] -->

# SimpleItemsControl（简单项容器·框架样式）

## 1. 用途

`controls:SimpleItemsControl`（MaxwellControl.Controls 自定义控件）的**隐式默认样式（唯一样式）**：极简项容器——`Border`（Background/BorderBrush/BorderThickness 三属性直绑）+ **`PART_Panel`（StackPanel 命名部件）**。项承载协议：StackPanel 为 IsItemsHost 类部件挂点，实际 Items 布局与行为由 .cs 控制（不可见）。

与 `controls:SimplePanel`（ScrollViewer/TabControl 等模板内大量使用的自定义面板）不同：SimpleItemsControl 是**带 Items 协议的控件**（控件级），SimplePanel 是面板（Panel 级）——注意区分。

典型场景（推断，无 P2 实例）：需要纯容器包裹 + 可承载项的自定义容器。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<controls:SimpleItemsControl … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:SimpleItemsControl`（MaxwellControl.Controls）。本文件**仅 1 个隐式默认样式（无 x:Key）**；无键式样式、无样式族、无触发器。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Background | Brush | 容器底色（TemplateBinding 直绑） | 隐式样式模板 Border（:9） | ✅ |
| BorderBrush | Brush | 容器边框色（TemplateBinding 直绑） | 同上 | ✅ |
| BorderThickness | Thickness | 容器边框粗细（TemplateBinding 直绑） | 同上 | ✅ |
| PART_Panel | StackPanel | 命名部件（Items 承载挂点，控件协议部件） | 模板 `x:Name="PART_Panel"`（:10） | ✅ |

## 4. 样式族表（SDC\Style\SimpleItemControl.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （隐式默认样式） | 无 | Border 三直绑 + StackPanel PART_Panel（:5-15） | 未显式指定 Style 时（唯一形态） |

无键式样式/变体。模板命名部件（P1 锚点）：`PART_Panel`。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<controls:SimpleItemsControl Background="{DynamicResource …画刷键}">
    <!-- 项内容（由 .cs 承载协议管理）… -->
</controls:SimpleItemsControl>
```

- 仅隐式样式，页面无需指定 Style；
- 项承载方式（ItemsSource/Children 语义）取决于 .cs 协议（TD-064）。

## 6. 禁止写法对照

### ❌ 禁止：手写 Border + StackPanel 平替（常规 WPF 写法）

```xml
<Border Background="{DynamicResource PrimaryDefaultBrush}" BorderBrush="Gray" BorderThickness="1">
    <StackPanel>
        <!-- 手写项… -->
    </StackPanel>
</Border>
```

### ✅ 推荐：SimpleItemsControl 控件化

```xml
<controls:SimpleItemsControl>
    <!-- 项内容… -->
</controls:SimpleItemsControl>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：手写版绕过 `PART_Panel` 命名部件协议与 SimpleItemsControl 控件（.cs）的项承载行为——Items 布局/数据协议无法接入；
2. **③ 无法样式族切换**：边框/底色策略散写，无法经框架样式一处统一调整（框架调整时手写页不跟随）；
3. **④ 绕过资源体系**：硬编码边框色绕过 Brushes 键体系。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/SimpleItemControl.xaml`（锚点 隐式默认 `Style TargetType="controls:SimpleItemsControl"`（:5）、模板 `x:Name="PART_Panel"`（:10））
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_SimpleItemControl.xaml.json`

## 8. 待确认项

- TD-064：SimpleItemsControl 并入零使用实例用途类——① 控件 .cs 行为（PART_Panel 承载协议、Items 语义）不可见；② 与 SimplePanel（面板级）的关系与分工待确认；③ 真实消费场景待确认。
