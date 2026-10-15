<!-- evidence=已确认(模板/触发器均为模板源码直接证据；TreeViewEx 与转换器语义待确认); pending=[TD-043];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/TreeView.xaml, {source_root}/ManualView.xaml] -->

# TreeView 家族（树形视图）

## 1. 用途

TreeView/TreeViewItem 的框架样式族：**四套风格完全独立的树**——连接线树（`LinesTreeViewItem`，行高 35 圆角）、侧边错位树（`StepAlignedTreeItemIconStyle`，行高 45 错位对齐 + 三角形展开钮）、无边框列表树（`TreeViewListNoBdStyle`）、键合列表树（`TreeViewListStyle`，40 行高 + 展开收缩钮），外加**隐式 TreeViewItem 默认样式**（连接线 + 30 行高，全局兜底）。树级样式按 `TreeViewEx`（MaxwellControl 子类）与原生 `TreeView` 各配一份（Lines/StepAligned 两组），模板带连接线（`LineConverter` 算竖线高度）与虚化图标缩放（`IsRootNodeConverter`）。

典型场景（推断，无 P2 实例）：层级目录/设备树/键合步骤树。

## 2. 声明

```xml
<TreeView … />（原生类型 + 具名样式）
<s:TreeViewEx … />，s = http://www.maxwell-gp.com/
```

TargetType = 原生 `TreeView`/`TreeViewItem` 或 `controls:TreeViewEx`（MaxwellControl.Controls，私有程序集）。**无 TreeView/TreeViewEx 隐式默认样式**（必须显式指定 Style）；TreeViewItem 有 `x:Key="{x:Type TreeViewItem}"` 的隐式默认样式（合并字典即全局生效，含原生容器内）。转换器均在文件内声明：`controls:TreeViewLineConverter`（x:Key="LineConverter"）、`tools:BoolToVisibilityConverter`（B2VConverter）、`tools:IsRootNodeConverter`（T2BConverter）、`tools:KeyToResourceConverter`（K2BConverter，当前未引用）。

## 3. 关键属性表

| 属性/项 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| （隐式 TreeViewItem 默认样式） | Style | `x:Key="{x:Type TreeViewItem}"`：连接线 HorLn/VerLn（#DCDCDC 硬编码，VerLn 高度由 LineConverter 五参数 MultiBinding 计算）、`ExpandLineToggleStyle` 18×18 展开钮（+ 号横竖线）、行高 30（`Bd Height="30"`）、Header FontSize=14 居中、IsSelected → SystemColors.Highlight 系统高亮、HasItems=False 隐藏展开钮 | `Style x:Key="{x:Type TreeViewItem}"` | ✅ |
| LineConverter | IMultiValueConverter | VerLn 竖线高度：TreeView ActualHeight/ActualWidth + TemplatedParent + Self + Expander.IsChecked 五参 | `controls:TreeViewLineConverter x:Key="LineConverter"` + MultiBinding | 🟡 [待确认 TD-043] |
| T2BConverter | IValueConverter | `tools:IsRootNodeConverter`：根/子节点判定 → Icon 尺寸切换（15×15⇄13×13，StepAligned 为 15×15⇄7×7）+ 子节点画刷/字号降级（FontSize 16→14） | `tools:IsRootNodeConverter x:Key="T2BConverter"` + DataTrigger | 🟡 [待确认 TD-043] |
| Icon | Geometry | 项图标（TreeViewItem 侧附加属性或 DataTemplate 数据绑定 `Data="{Binding Icon}"`，Path Data 直绑）；Null → 图标隐藏且 Header 回位 | LinesTreeViewItem/StepAligned 模板 `Data="{Binding Icon}"` + `Trigger Property="Data" SourceName="Icon" Value="{x:Null}"` | 🟡 [待确认 TD-043] |
| IsSelected（双向） | bool | 样式内 `IsSelected="{Binding IsSelected, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}"`（绑定到项数据源） | LinesTreeViewItem/StepAlignedTreeItemIconStyle Setter | ✅ |
| TreeViewEx.ShowBackground | bool | 附加属性：TreeViewListStyle 内 `HasItems=True` 时置 True（项背景显隐约定） | TreeViewListStyle `Trigger Property="HasItems" Value="True"` | 🟡 [待确认 TD-043] |
| 虚拟化 | — | 四个树级样式均 `VirtualizingStackPanel IsItemsHost=True IsVirtualizing=True VirtualizationMode=Recycling` | 各树级样式 ItemsPanel | ✅ |

四套项样式族特征（P1）：

| 样式键 | 行高 | 展开钮 | 画刷族 | 关键差异 |
|---|---|---|---|---|
| （隐式）TreeViewItem | 30 | ExpandLineToggleStyle（18×18，横竖线 ±） | 无（系统高亮 + #DCDCDC） | 连接线 #DCDCDC 硬编码 |
| LinesTreeViewItem | 35（圆角 3） | ExpandLineToggleStyle | `TreeViewItem_*`（Default/Select 渐变/Hover 描边） | 图标 15×15、FontSize 16 Bold、`Treeview_ConnectedLinesBrush` 连接线、Bd 圆角 |
| StepAlignedTreeItemIconStyle | 45 | TreeToggleButton（8×15 三角旋转，StoryboardVisable/Collapsed 动画） | `SideTreeViewItem_*`（Root/Child/Select/Expanded） | BorderBack Margin=-180 错位对齐、三角钮居右（Margin 0,0,25,0） |
| TreeViewListNoBdStyle | ListBoxItemHeight | ExpandCollapseToggleStyle（25×25 白底黑框 + Add/SubGeometry） | 无（PrimaryLightBrush/PrimaryDefaultBrush） | 无背景条（Bd Margin=-100 横贯）、IsExpanded=True 默认 |
| TreeViewListStyle | 40（FatherNode） | ExpandCollapseToggleStyle | `ListTreeViewItem_*`（Select 渐变/Hover 双描边） | Bd 圆角 3 + Margin 5、双 MultiTrigger（Bd 悬停/Header 悬停）、ShowBackground 挂点 |

树级样式（TargetType 配对）：`LinesControlTreeView`（TreeViewEx）/`LinesOriginTreeView`（原生 TreeView）——差异仅 TargetType 与 ItemContainerStyle 引用；`StepAlignedControlTreeStyle`（TreeViewEx）/`StepAlignedOriginTreeStyle`（原生 TreeView）同理。每套含：`Treeview_DefaultBackBrush`/`Treeview_DefaultBorderBrush` 背景边框、FontSize 16 Bold、ScrollViewer 双滚动条 Auto、ItemContainerStyle + 虚拟化 ItemsPanel。

## 4. 样式族表（SDC\Style\TreeView.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （隐式）TreeViewItem | 无 | 连接线 + 30 行高 + 系统高亮（全局兜底） | 未显式指定 ItemContainerStyle 的任意 TreeView |
| LinesTreeViewItem | 无 | 35 行高圆角、TreeViewItem_* 四态画刷、图标 | `LinesControlTreeView`/`LinesOriginTreeView` 的项 |
| StepAlignedTreeItemIconStyle | 无 | 45 行高错位对齐、SideTreeViewItem_* 画刷、右置三角 | `StepAlignedControlTreeStyle`/`StepAlignedOriginTreeStyle` 的项 |
| TreeViewListNoBdStyle | 无 | 无背景条列表树、IsExpanded 默认展开 | 子节点列表展开（无边框） |
| TreeViewListStyle | 无 | 40 行高键合列表树、ListTreeViewItem_* 画刷、ShowBackground | 键合子节点列表 |
| LinesControlTreeView | 无 | TreeViewEx 版连接线树（虚化 + ItemContainerStyle=LinesTreeViewItem） | 设备/层级树（框架子类） |
| LinesOriginTreeView | 无 | 原生 TreeView 版连接线树（同上） | 设备/层级树（原生类型） |
| StepAlignedControlTreeStyle | 无 | TreeViewEx 版错位树（ItemContainerStyle=StepAlignedTreeItemIconStyle） | 侧边导航式层级树 |
| StepAlignedOriginTreeStyle | 无 | 原生 TreeView 版错位树 | 同上（原生类型） |
| ExpandLineToggleStyle / TreeToggleButton / ExpandCollapseToggleStyle | 无 | 展开钮内部件（18×18 线型 / 8×15 三角 / 25×25 加号） | 模板内部件 |

配套画刷：`{source_root}/SDC/Brushes/TreeBrushes.xaml`（`Treeview_DefaultBackBrush`/`Treeview_DefaultBorderBrush`/`Treeview_ConnectedLinesBrush`；`TreeViewItem_Default*/Hover*/Select*`；`SideTreeViewItem_Root*/Child*/Select*/Expanded*`；`ListTreeViewItem_Default*/Hover*/Select*`）。几何：`{source_root}/SDC/Geometries.xaml`（AddGeometry/SubGeometry）；动画：`{source_root}/SDC/Style/SideMenu.xaml`（StoryboardVisable/StoryboardCollapsed，跨文件引用）。

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 均未出现 TreeView/TreeViewEx。

```xml
<TreeView Style="{StaticResource LinesOriginTreeView}"
          ItemsSource="{Binding …层级数据}">
    <TreeView.ItemTemplate>
        <HierarchicalDataTemplate ItemsSource="{Binding …子级}">
            <StackPanel Orientation="Horizontal">
                <Path Data="{Binding Icon}" Width="15" Height="15"
                      Fill="{Binding Foreground, RelativeSource={RelativeSource AncestorType=TreeViewItem}}"/>
                <TextBlock Text="{Binding …名称}"/>
            </StackPanel>
        </HierarchicalDataTemplate>
    </TreeView.ItemTemplate>
</TreeView>
```

- 项样式由树级样式指定：`LinesControlTreeView` 连 `LinesTreeViewItem`，`StepAlignedOriginTreeStyle` 连 `StepAlignedTreeItemIconStyle`——页面只选树级样式，项样式自动装配；
- 项图标 `Icon` 绑定 + 根/子节点自动缩放（T2BConverter：根 15×15、子 13×13）与画刷降级由模板承担；
- 原生 `TreeView` 与框架子类 `TreeViewEx` 各有配对样式（Origin/Control 后缀），混用 TreeViewEx 时须用 Control 版。

## 6. 禁止写法对照

### ❌ 禁止：手写 ItemsControl 递归 + 自绘连接线/展开钮拼装等效树（常规 WPF 写法）

```xml
<ItemsControl ItemsSource="{Binding …}">
    <ItemsControl.ItemTemplate>
        <HierarchicalDataTemplate ItemsSource="{Binding …子级}">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="18"/><ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>
                <ToggleButton x:Name="exp" IsChecked="{Binding IsExpanded, RelativeSource={RelativeSource AncestorType=TreeViewItem}}">
                    <Path Data="M0,0 L12,6 0,12 z"/>
                </ToggleButton>
                <TextBlock Grid.Column="1" Text="{Binding …}"/>
                <!-- 自绘连接线 Rectangle + 高度计算… -->
            </Grid>
        </HierarchicalDataTemplate>
    </ItemsControl.ItemTemplate>
</ItemsControl>
```

### ✅ 推荐：TreeView 树级样式 + HierarchicalDataTemplate

```xml
<TreeView Style="{StaticResource LinesOriginTreeView}" ItemsSource="{Binding …}">
    <TreeView.ItemTemplate>
        <HierarchicalDataTemplate ItemsSource="{Binding …子级}">
            <TextBlock Text="{Binding …名称}"/>
        </HierarchicalDataTemplate>
    </TreeView.ItemTemplate>
</TreeView>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有项四态画刷（Default/Select 渐变/Hover 1px 描边/Expanded 底）与展开动画（Triangle 旋转 + StoryboardVisable/Collapsed）；
2. **② 丢失协议挂点**：`Icon` 属性绑定、根/子节点 T2BConverter 尺寸与画刷自动降级、`TreeViewEx.ShowBackground` 附加属性、LineConverter 连接线高度协议全无；
3. **③ 无法样式族切换**：连接线/错位/无边框列表/键合列表四套风格无法一键切换（Lines→StepAligned→List 各配树级+项样式两处）；
4. **⑤ 脱离视觉规范**：行高 30/35/45 分层、`Treeview_ConnectedLinesBrush` 连接线、虚化虚拟化（Recycling）、圆角 3 等规范失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/TreeView.xaml`（锚点 `x:Key="{x:Type TreeViewItem}"`、`x:Key="LinesTreeViewItem"`、`x:Key="LinesControlTreeView"`、`x:Key="LinesOriginTreeView"`、`x:Key="StepAlignedTreeItemIconStyle"`、`x:Key="StepAlignedControlTreeStyle"`、`x:Key="StepAlignedOriginTreeStyle"`、`x:Key="TreeViewListNoBdStyle"`、`x:Key="TreeViewListStyle"`、`x:Key="ExpandLineToggleStyle"`、`x:Key="TreeToggleButton"`、`x:Key="ExpandCollapseToggleStyle"`、`x:Key="LineConverter"`、`x:Key="T2BConverter"`、`x:Key="B2VConverter"`、`x:Key="K2BConverter"`、`controls:TreeViewEx.ShowBackground`、`PART_Header`/`ItemsHost`）
- 画刷：`{source_root}/SDC/Brushes/TreeBrushes.xaml`；几何：`{source_root}/SDC/Geometries.xaml`（AddGeometry/SubGeometry）；动画：`{source_root}/SDC/Style/SideMenu.xaml`（StoryboardVisable/StoryboardCollapsed）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 索引交叉：`{index_root}/files/refence_SDC_Style_TreeView.xaml.json`

## 8. 待确认项

- TD-043（TreeView 家族语义）：
  - `TreeViewEx` 与原生 `TreeView` 的真实差异（样式层仅 TargetType 与容器样式不同，.cs 行为面不可见——Origin/Control 双份样式是否为同一视觉的双类型版本）；
  - `LineConverter`/`T2BConverter`/`K2BConverter` 的转换规则细节（LineConverter 五参数计算式、根/子节点判定依据）；
  - `Icon` 属性定义面（Path `Data="{Binding Icon}"` 的 Icon 是 TreeViewItem 附加属性还是 DataTemplate 数据字段约定）；
  - `TreeViewEx.ShowBackground` 附加属性的运行时行为；
  - `TreeViewListNoBdStyle` 默认 IsExpanded=True（列表树常开）与 `ListBoxItemHeight` 尺寸 Token 引用。
