<!-- evidence=已确认(全部为 P1 模板源码直接证据——单隐式样式，无键式样式无触发器); pending=[TD-063];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/MaterialBox.xaml, {source_root}/ManualView.xaml] -->

# MaterialBox（物料盒·框架样式）

## 1. 用途

`controls:MaterialBox`（MaxwellControl.Controls 自定义控件）的**隐式默认样式（唯一样式）**：物料清单展示盒——外层 ScrollViewer（双向 Auto 滚动）+ `GroupBox` 标题框（`Header` 直绑控件属性）+ **ItemsControl 逐行清单**（`LayerList` 数据源）。

每行（ItemTemplate）：25px 高白边行 → **序号**（`Index`）+ **状态圆点**（`EllipseSize`/`EllipseColor`，最大 20）+ **状态名**（`StatusName`），行底色 `BackgroundColor`。五字段全部来自数据项绑定（`LayerList` 项类型在 .cs，不可见）。

典型场景（推断，无 P2 实例）：物料/批次/层次列表展示（图层状态一览）。ManualView.xaml 未使用本控件。

## 2. 声明

```xml
<controls:MaterialBox … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:MaterialBox`（MaxwellControl.Controls）。本文件**仅 1 个隐式默认样式（无 x:Key）**；无键式样式、无样式族、无触发器。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| Header | object | GroupBox 标题（TemplateBinding 直绑 MaterialBox.Header） | 隐式样式模板 groupBox `Header="{TemplateBinding Header}"`（:15） | ✅ |
| LayerList | IEnumerable | ItemsControl 数据源（TemplateBinding 直绑） | 模板 ItemsControl `ItemsSource="{TemplateBinding LayerList}"`（:16） | ✅ |
| VerticalAlignment / HorizontalAlignment | Stretch | 控件默认占满容器 | 隐式样式 Setter（:8-9） | ✅ |
| 行数据字段（ItemTemplate 绑定） | — | `BackgroundColor`（行底）、`Index`（序号）、`EllipseSize`/`EllipseColor`（状态圆点）、`StatusName`（状态文本） | 模板 DataTemplate（:19-31） | ✅ |
| 边框 / 分隔 | — | 行：白 1px 边框 + MinHeight 25；GroupBox 边框 **#AFB9C3 硬编码**（无画刷键）；圆点描边 Gray 硬编码 | 模板（:15/:19/:29） | ✅ |

## 4. 样式族表（SDC\Style\MaterialBox.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （隐式默认样式） | 无 | Stretch 占满 + ScrollViewer(Auto/Auto) + GroupBox(#AFB9C3 边框、Header 直绑) + ItemsControl(LayerList 五行绑定)（:7-45） | 未显式指定 Style 时（唯一形态） |

无键式样式/变体。模板命名部件（P1 锚点）：`groupBox`。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 未出现本控件。

```xml
<controls:MaterialBox Header="{DynamicResource …物料标题文本键}"
                      LayerList="{Binding 物料层次集合}" />
```

- 仅隐式样式，页面无需指定 Style；数据契约（Index/EllipseSize/EllipseColor/StatusName/BackgroundColor）由 LayerList 项类型提供（.cs，TD-063）；
- 标题走 DynamicResource 文本键。

## 6. 禁止写法对照

### ❌ 禁止：手写 ScrollViewer + 自绘行拼等效物料清单（常规 WPF 写法）

```xml
<ScrollViewer>
    <Border BorderBrush="#AFB9C3" BorderThickness="1">
        <StackPanel>
            <!-- 每行手写：序号 TextBlock + Ellipse 状态点 + 状态名 + 行底色 -->
            <Border BorderBrush="White" BorderThickness="1" MinHeight="25" Background="{Binding 行底色}">
                <Grid>
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width="20"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/>
                    </Grid.ColumnDefinitions>
                    <TextBlock Text="{Binding 序号}" …/>
                    <Ellipse Fill="{Binding 点色}" Width="{Binding 点径}" …/>
                    <TextBlock Text="{Binding 状态}" …/>
                </Grid>
            </Border>
            <!-- 行 2、行 3… -->
        </StackPanel>
    </Border>
</ScrollViewer>
```

### ✅ 推荐：MaterialBox + LayerList 数据绑定

```xml
<controls:MaterialBox Header="{DynamicResource …标题文本键}" LayerList="{Binding 物料层次集合}" />
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **② 丢失协议挂点**：手写版绕过 `LayerList` 数据协议与内建行模板（五字段绑定契约）——数据项结构变化时手写行逐一失联，且滚动（双向 Auto）与行规整（MinHeight 25/三列布局）需自行重造；
2. **③ 无法样式族切换**：行模板/圆点规格（EllipseSize 上限 20）/边框策略无法经样式族统一调整；
3. **④ 绕过资源体系**：硬编码边框色（#AFB9C3、白）绕过 Brushes 键体系；
4. **⑤ 脱离视觉规范**：序号/状态点/状态名三列视觉规范与 GroupBox 标题形态（框架分组框规范）脱离统一控制。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/MaterialBox.xaml`（锚点 隐式默认 `Style TargetType="{x:Type controls:MaterialBox}"`（:7）、模板 `ItemsControl ItemsSource="{TemplateBinding LayerList}"`（:16）、DataTemplate 五字段绑定（:19-31）、`x:Name="groupBox"`）
- 真实使用：无（ManualView.xaml 不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_MaterialBox.xaml.json`

## 8. 待确认项

- TD-063：`MaterialBox` 用途与 `LayerList` 数据源——① LayerList 项类型（Index/EllipseSize/EllipseColor/StatusName/BackgroundColor 字段）与控件 .cs 行为不可见；② GroupBox 边框 #AFB9C3、圆点描边 Gray、行白边框硬编码（无键）；③ 控件命名的「物料（Material）」语义与半导体业务映射待确认。
