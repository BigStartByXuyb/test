<!-- evidence=已确认(模板/绑定均为 P1 直接证据；属性语义与 .cs 行为待确认); pending=[TD-042,TD-004];
     verified=2026-08-14; sources=[{source_root}/SDC/Style/Pagination.xaml, {source_root}/ManualView.xaml] -->

# Pagination（分页条）

## 1. 用途

框架分页条控件：**数据量显示 + 每页条数下拉（ComboBox）+ 首页/上一页 + 页码跳转（IntNumberBox 输入 + /共页数）+ 下一页/末页**，整条高 56、按钮高 30，各按钮可用性由模板内绑定驱动（`CanGoCombo`/`CanGoFirstOrPrev`/`CanGoJump`/`CanGoLastOrNext`）。

典型场景（推断，无 P2 实例）：大数据量列表/表格分页条。模板**只声明属性绑定与部件名，无任何命令/事件**——按钮 Tag="0/1/3/5/6" 分段、`S_ComboB`（无 ItemsSource）等交互语义全部在 .cs 面（登记 TD-042）。注意与 `PagableDataGrid` 内置翻页按钮（`ControlCommands.Prev/Next`）为两套并列机制，本控件未引用 `ControlCommands`。

## 2. 声明

```xml
<s:Pagination … />，s = http://www.maxwell-gp.com/
```

TargetType = `controls:Pagination`（MaxwellControl.Controls，私有程序集，.cs 本地不可见）。样式为**隐式默认（无 x:Key）**。模板内部件复用 `controls:IntNumberBox`（`S_TextB`，无显式样式）；合并字典仅 BaseStyle.xaml。

## 3. 关键属性表

| 属性 | 类型/取值 | 说明 | 证据（锚点） | 状态 |
|---|---|---|---|---|
| DataCount | int | 左侧数据总量文本（TextBlock 直接绑定，无格式） | 模板 `TextBlock Text="{Binding DataCount, RelativeSource={RelativeSource TemplatedParent}}"` | 🟡 [待确认 TD-042] |
| CanGoCombo | bool | 每页条数下拉（`S_ComboB`，宽 90×高 30、SelectedIndex=0、**无 ItemsSource**——项由 .cs 注入）的 IsEnabled | 模板 `S_ComboB IsEnabled="{Binding CanGoCombo, …}"` | 🟡 [待确认 TD-042] |
| CanGoFirstOrPrev | bool | 首页（Tag=0）与上一页（Tag=1）按钮 IsEnabled | 模板 FirstPageButton/PrevButton `IsEnabled="{Binding CanGoFirstOrPrev, …}"` | 🟡 [待确认 TD-042] |
| CanGoJump | bool | 跳转按钮（Tag=3）IsEnabled | 模板 JumpButton `IsEnabled="{Binding CanGoJump, …}"` | 🟡 [待确认 TD-042] |
| CanGoLastOrNext | bool | 下一页（Tag=5）与末页（Tag=6）按钮 IsEnabled | 模板 NextButton/LastPageButton `IsEnabled="{Binding CanGoLastOrNext, …}"` | 🟡 [待确认 TD-042] |
| Index | int | 当前页码；绑定到 `S_TextB`（IntNumberBox）`Value`，UpdateSourceTrigger=PropertyChanged | 模板 `Value="{Binding Index, …}"` | 🟡 [待确认 TD-042] |
| PageCount | int | 总页数；作 `S_TextB` `Maximum`（Minimum=1）+ 右侧 `/N` 文本（StringFormat=/{0}） | 模板 `Maximum="{Binding PageCount, …}"` + `Text="{Binding PageCount, StringFormat=/{0}, …}"` | 🟡 [待确认 TD-042] |
| 按钮 Tag 分段 | int | Tag=0 首页 / 1 上一页 / 3 跳转 / 5 下一页 / 6 末页（2、4 未占用）——页面内 Click 路由到 .cs 的分段标识 | 模板各 Button `Tag="0|1|3|5|6"` | 🟡 [待确认 TD-042] |
| 文本键 | string | `ControlHome`（首页）/`ControlPrePage`（上一页）/`ControlGoTo`（跳转）/`ControlNextPage`（下一页）/`ControlLastPage`（末页），DynamicResource | 模板各 Button Content | ✅（键定义位置见 TD-004） |
| 几何 | Geometry | 上/下一页箭头 `PreviousButtonGeometry`/`NextButtonGeometry`（Fill=#b4b4b4 硬编码） | 模板 PrevButton/NextButton Path | ✅ |

模板常量（P1）：整条 `Height="56"`（Border 内 `BorderThickness="0,0,0,0"`、BorderBrush #b4b4b4）；全部按钮 `Height="30"`、`Padding="3 0"`、Margin 5,0；`S_TextB` 宽 60×高 30（`InputMethod.IsInputMethodEnabled=False`）；`S_ComboB` 宽 90×高 30。模板命名部件：`S_Grid`、`S_ComboB`、`S_TextB`、`FirstPageButton`、`PrevButton`、`JumpButton`、`NextButton`、`LastPageButton`。

## 4. 样式族表（SDC\Style\Pagination.xaml）

| 样式键 | BasedOn | 关键特征 | 适用场景 |
|---|---|---|---|
| （无键默认样式） | 无 | TargetType=`controls:Pagination` 隐式默认：Width=Auto、BorderBrush=`PrimaryDefaultBrush`、BorderThickness=3（模板内再置 0）、Background=`ThirdlyLightToolBrush` | 全场景唯一样式，无具名键 |

## 5. 框架写法示例

**无使用实例（以下为模板证据构造）**——ManualView.xaml 与 Demo 均未出现 `s:Pagination`。

```xml
<s:Pagination DataCount="{Binding …总条数}"
              Index="{Binding …当前页, UpdateSourceTrigger=PropertyChanged}"
              PageCount="{Binding …总页数}"/>
```

- 分页条 56 高、按钮 30 高、页码输入框（IntNumberBox 1~PageCount）全部由模板承担；
- 按钮可用性绑定 `CanGo*` 四个属性由 .cs 计算，页面只提供数据；
- 文本键全部走 DynamicResource（`ControlHome` 等），本地化键体系（TD-004 待确认定义位置）。

## 6. 禁止写法对照

### ❌ 禁止：手写 StackPanel + Button×5 + TextBox 拼装等效分页条（常规 WPF 写法）

```xml
<StackPanel Orientation="Horizontal" VerticalAlignment="Center">
    <Button Content="首页" Click="FirstPage_Click"/>
    <Button Content="上一页" Click="Prev_Click"/>
    <TextBox Width="60" x:Name="PageIndexBox"/>
    <TextBlock Text="{Binding PageCount, StringFormat=/ {0}}"/>
    <Button Content="跳转" Click="Jump_Click"/>
    <Button Content="下一页" Click="Next_Click"/>
    <Button Content="末页" Click="LastPage_Click"/>
</StackPanel>
```

### ✅ 推荐：Pagination 属性化

```xml
<s:Pagination DataCount="{Binding …}" Index="{Binding …}" PageCount="{Binding …}"/>
```

### 禁止原因（对照 00-guide/03-writing-paradigm.md 五类依据）

1. **① 丢失状态**：手写版没有 `CanGo*` 四组可用性联动（首页/上一页、下一页/末页各自成对、跳转独立），边界翻页的禁用逻辑散写在五个 Click 里；
2. **② 丢失协议挂点**：`DataCount/Index/PageCount` 数据绑定协议与按钮 Tag 分段路由机制无从谈起；
3. **④ 绕过本地化**：硬编码"首页/上一页/跳转"绕过 `ControlHome`/`ControlPrePage`/`ControlGoTo` 等 DynamicResource 文本键体系；
4. **⑤ 脱离视觉规范**：56 高整条、按钮 30 高、页码输入 IntNumberBox（Min=1/Max=PageCount）、`ThirdlyLightToolBrush` 底色等规范失控。

## 7. 参考锚点

- 模板源码：`{source_root}/SDC/Style/Pagination.xaml`（锚点：隐式 `Style TargetType="controls:Pagination"`、`S_ComboB`、`S_TextB`、`Tag="0"`/`Tag="1"`/`Tag="3"`/`Tag="5"`/`Tag="6"`、`Binding DataCount`、`Binding CanGoCombo`、`Binding CanGoFirstOrPrev`、`Binding CanGoJump`、`Binding CanGoLastOrNext`、`Binding PageCount, StringFormat=/{0}`）
- 几何：`{source_root}/SDC/Geometries.xaml`（PreviousButtonGeometry/NextButtonGeometry）；复用：`{source_root}/SDC/Style/IntNumberBox.xaml`（IntNumberBox 控件）
- 真实使用：无（ManualView.xaml 与 Demo 均不含本控件）
- 对照：`PagableDataGrid` 内置翻页按钮（`ControlCommands.Prev/Next`，DataGrid.xaml）见 [pagable-data-grid](pagable-data-grid.md)；`ControlCommands` 定义位置待核实（README 附加属性节）
- 索引交叉：`{index_root}/files/refence_SDC_Style_Pagination.xaml.json`

## 8. 待确认项

- TD-042（Pagination 属性语义）：DataCount/Index/PageCount/CanGo* 四属性与 Tag 分段（0/1/3/5/6）的 .cs 处理机制；`S_ComboB` 无 ItemsSource 的注入方式与每页条数语义；`ControlCommands` 是否与分页交互相关；`/{0}` 页码文本格式确认
- TD-004（`ControlHome`/`ControlPrePage`/`ControlGoTo`/`ControlNextPage`/`ControlLastPage` 文本键定义位置——框架文本键体系统一待确认项）
