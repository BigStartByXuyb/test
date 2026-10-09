# 作业A（Mw WPF）页面格式

本文是作业A 的页面格式口径：页面骨架、布局规则与 ViewModel 契约。**类型判定不在本文**——设计稿组件集/变体 → `ControlType` + 槽位由共享表 `references/component-types.json` 唯一决定；同一类型在 WPF 这一侧怎么写由 `mw-wpf-map.json` 唯一决定。

## 1. 页面骨架

页面是 `<UserControl>`，产物落在 `UI/<区域>/View/<Target>View.xaml`，同名 code-behind（`.xaml.cs`）以 `<DependentUpon>` 挂在 View 下，ViewModel 在 `UI/<区域>/ViewModel/<Target>ViewModel.cs`。

固定头（与真实页面 `ManualView.xaml` / `AutoCutView.xaml` 同形）：

```xml
<UserControl x:Class="<RootNamespace>.<区域>.View.<Target>View"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
             xmlns:s="http://www.maxwell-gp.com/"
             mc:Ignorable="d"
             FocusVisualStyle="{x:Null}"
             d:DesignHeight="<设计稿高>" d:DesignWidth="<设计稿宽>">
```

`<UserControl.Resources>` 承担两件事：合并本页 Icon 字典（见 `page-build-rules.md`），以及把页级默认外观写成 `BasedOn`（例如 `<Style TargetType="{x:Type s:IconButton}" BasedOn="{StaticResource MainButtonStyle}" />`、`<Style TargetType="{x:Type TextBlock}" BasedOn="{StaticResource TextBlockStyle}" />`）。命中具名样式族的控件写 `Style="{StaticResource <样式键>}"`；命中页级默认或框架隐式默认的控件**不写** `Style`。

## 2. 布局规则

**读图口径（本路线专属）**：允许读**设计稿位图**，用途只有一项——判断 DSL 里没有真值的**空间关系与分组意图**：哪几个条目同属一栏、哪个没有 auto-layout 的包裹层是一组。**留白只是判断分组时的观察输入**：间距本身由口径 A 从 DSL 实测几何得出，分组表里不写留白、也不写任何间距值。结论必须落成**结构化标注**，形状就是下条的**分组表 schema**（`kind` 只取 `column` / `row`，成员字段是 `members`）；它由 `wpfLayout` 消费，校验在 `wpfLayout` 入口做（引用的 ref 不存在、或标注与设计稿几何矛盾即失败）。**读图不得用于**：图形外观、图标含义与朝向（由 DSL 的 `rotate` / `flipH` / `flipV` 机械烘焙得出）、控件坐标与尺寸（一律取自 DSL）、组件匹配（仍按共享类型表与写法表）。
**图→分组表这一步就是"看图"**：由执行本 skill 的模型完成（与 `ledger` / `inputs` 的"人工/AI 语义输入"同类），产物落盘成分组表；`wpfLayout` 本身不调用模型，只读「处理后的 DSL + 分组表」。
**开关与路径**：图由用户/上游导出后放到 `Generated/_inputs/<Target>.design.png`（`.jpg` / `.jpeg` 同口径）——本流水线不产出图；**按设计稿原始尺寸导出**，位图尺寸必须等于 DSL 的画板尺寸，否则图上的框与 DSL 的 bbox 会整体错一个倍数。表放 `Generated/_inputs/<Target>.layout-groups.json`。
**读图只补关系，不增删控件**：分组表只能引用处理后的 DSL 里**已有的节点 ref**（未知 ref 直接失败），它表达不了"加一个控件"或"这个控件不要"。产物里有什么控件，只由 DSL、可见性与写法表决定：设计稿里画了的就照常发射（哪怕看着像标注、像调试残留），设计稿里没有的绝不新增。要增减控件是设计侧的事，只能改设计稿。
- 有图：先看图产出分组表，再跑 `wpfLayout`（每次都给模型看一遍，不看有没有 unresolved——机械判据可能"自信地判错"，图正好纠这个）。
- 有图但没表：流程漏步，`wpfLayout` 停下报告，不静默退化成纯机械推导。
- 没有图：按纯机械判据推导，不因缺图失败。

坐标载体是 Grid，不是绝对定位：

1. **分区**：只有「框架固定区（`emit=false`）」与**一个内容区**（`emit=true`）。框架固定区只有**顶部栏**与**底部栏**两类（框架的实际加载壳只有这两条常驻带）；它们不进页面，所以**页面外层只有唯一一个 Grid —— 内容网格本身**（不再另套一层带 `Grid.Row` 的根 Grid）；设计稿的业务内容全部落在内容区里，内部按下面的规则分层。
    **层级照设计稿**：成层容器各自发射一层 `<Grid>`（格子产物里是 `container: true`，没有控件类型，内层网格挂在 `children`），它的条目进该层格子。成层容器的判据有两条：设计稿声明的 flex 容器（节点带 `flexContainerInfo.flexDirection`；内层按主轴拆带），或**带尺寸约束的容器**（约束必须有承载物，内层按 bbox 聚类）。**展平是三条收口规则**：① 只有**一个条目**的容器展平（没有主轴关系可表达，内容提到上一层）；② **同轴叶堆展平**——子容器与父容器主轴方向相同、子容器没有声明交叉轴（`alignItems` / `justifyContent`）、且子容器的条目**全是叶子**时，这些条目直接进父层（同轴套一层 Grid 只多一层壳，间距并进父层后由口径 A 统一成带；条目里还有容器时不展平，那一层是子结构的承载物）；③ 区域根网格不做 1×1 空壳（顶层是"单容器链"时把最内层条目提上来）。带尺寸约束的容器是这三条收口规则的例外，不展平。没有 flex 声明、也没有尺寸约束的包裹层同样展平到最近一层。
2. **框架固定区以框架为准**：顶部栏、底部栏由框架渲染，**不发射进页面**；它们的高度用框架 Token（`MaxwellFramework_HeaderHeight` / `MaxwellFramework_BottomHeight`）登记在布局产物的 `source` 里，只用于布局产物登记与 Layout 注册。设计稿的**右下角常驻分组**（`右侧底部-常驻button`）与 `mtslg-iocontrol` 同口径：整组不发射进页面、不参与布局计格、其中的图形不登记图标（框架单独处理），A 路线不另立口径。
3. **成带只有一条口径（口径 A）**：一条带 = 条目 + 它后面的间距（= 到下一带起始边的距离），尺寸取设计稿实测（`source: "design"`）。
   哪一段间距落成**星号带**由两条判据决定（**不写死像素阈值**）：① **结构**——相邻条目分属不同子组时，那一段是设计稿声明的"组间空档"（容器的 `flexContainerInfo.gap` 就体现在这里）；② **相对**——散条目（读不到结构）时，最大的一段间距 ≥ 同层其余间距中位数 ×2 才算空档，只有一段间距时要求它 ≥ 相邻条目较小者的一半；
   每层最多一条星号带：出现星号带时最后一条按条目自身尺寸写死，没有大空档时最后一条带吃剩余（星号）。
   **产物里不发射任何间距元素**——间距要么并进前一带，要么就是那段星号带。声明了 flex 主轴的容器按条目独占一条带（同一起点合并）；
   没有声明的层级、以及声明层级的交叉轴按 bbox 聚类（列＝x 区间重叠、行＝y 起始边邻近），同样按口径 A 成带。
    - **列宽**（主轴 `row` 且这一层没有大空档）：固定项照设计稿像素——固定项 = 子树里只有相机控件的条目（相机所在的 Grid），或区域根网格里贴主轴末端的最末条目（页面常驻右栏）；其余**容器**条目自适应（`<ColumnDefinition />`；出现多个自适应条目时按设计稿比例写加权星号 `1016*`），叶子控件照设计稿像素；
    - **行高**（主轴 `column`）：一律按上面这条口径 A 成带。没有 flex 声明的层级两轴同样按口径 A。
   **没打组的地方由代码补组**：区域根网格里的散条目按两步成栏——**先看分组表**（`Generated/_inputs/<Target>.layout-groups.json`，见下条），表里声明的按表落成 `declared:<id>` 容器；表没覆盖到的，再由机械判据兜底：同一条列带（x 区间重叠，条目竖直排）里 ≥2 个条目（容器与叶子同等参与）→ 收进一个**栏容器**（格子登记 `synth: true`、`synthAxis` 记排列方向 `y`）。两处都没落到的条目保持扁平（它自己就是一条带），并登记进该分区的 `unresolved`——这是**给人抽查的清单**（哪些条目没被任何分组收走），`wpfLayout` 的步骤摘要把它的条数报出来。栏内照常按口径 A 成行；已经成层的层级（`grid.owner` 非空）不再补组。栏容器不是第 1 条要避免的那个「1×1 空壳」（它只包一个条目、没有主轴关系）：补组是设计稿没打组时才有的结构，那一层的条目本来就全在同一条列带里，收成一格是正常形态。
   **机械判据只按栏补、不按行补**：行方向合并会把本该撑满主轴的容器钉死在自己的设计稿高度上，也会把页面两端互不相干的条目并进同一格（回归网：② 见 `scripts/tests/gen-mw-wpf-layout.test.js` 用例 4，① 见 `scripts/tests/design-box.test.js` 的布局推导块）。分组表要行就显式写 `kind="row"`——那是判断，不由几何猜。
   **分组表**（`--groups`，可选）：形状 `{ "schemaVersion": "mw-wpf-layout-groups/1", "pageTarget": "<Target>", "groups": [ { "id": "<组名>", "kind": "column" | "row", "members": ["<DSL ref>", ...] } ] }`——**只写"哪些条目同属一组"，不写坐标与尺寸**，事实一律来自处理后的 DSL；只支持一层，`members` 只能是本层条目的 ref，不嵌分组。校验在推导入口 fail-closed：`pageTarget` 写了就必须等于本次页面（防把另一页的表套上来）、成员 ref 必须在本层条目里、一个 ref 只能出现在一个分组里、`kind` 只能是 column/row、每组 ≥2 个成员；**组的地盘里不得有"组外、且没被任何分组收走"的条目**（例如声明把互相隔着别人的两块并成一组 → 停下报告）。产物里登记分组表来源与指纹：`layoutGroups = { path, sha256 }`（没有分组表时为 `null`），同一份（DSL + 分组表）出同一份布局；**没有设计稿位图时**整条链按机械判据照常走，不因缺表失败（有图必须有表，见上面的开关三条）。
   **首段空档也成带**：第一个条目与网格原点之间的那段（容器内缩 / 分区顶边到内容的空白）是第一条带 —— 承载物落在带里、格子偏移为 0，不必用 `Margin` 顶到设计稿位置。
   **格子起点的唯一口径**：格子起点 = 网格原点 + 前面各带尺寸之和（**不是**"带起点"——带起点是设计稿里条目的位置，首条带前面还有首段空档）。用带起点会把首段空档整段丢掉（容器被贴到分区顶边、控件被贴到容器左边）。
   **容器撑满主轴**：容器格子**主轴那一维不写尺寸与对齐** —— 容器撑满格子，那一维的变化由星号带吸收：顶部内容贴顶、底部内容贴底、中间（或末尾）那段空档随高度 / 宽度变长；位置偏移改用 `Margin` 表达。交叉轴照设计稿写尺寸与对齐；设计稿本身让容器越过格子末端（`end < 0`）时，锚点按上边 / 左边写成 start + `Margin`（否则窗口一变容器就跟着末端漂）。唯一实现在 `scripts/lib/design-box.js` 的 `containerBoxAttrs`，发射器与门禁都调它。
    **格子尺寸 − 控件尺寸 = 间距**：格子尺寸由推导登记在格子上（跨格按 `rowSpan` / `columnSpan` 累加；内层网格的可用尺寸是承载物自身设计尺寸），控件写自身设计稿尺寸（`Width` / `Height`），差值落在哪一侧由格上的设计稿偏移（`offsetX` / `offsetY`）决定：贴起始边（最常见）／贴末端／两侧相等居中／非对称内缩＝贴起始边 + `Margin` 补偏移。唯一实现在 `scripts/lib/design-box.js`；格子尺寸与控件尺寸相等时不写尺寸也不写对齐；推导为避让撞格而下移的格子（`cell.shifted`）没有偏移真值，只写控件自身尺寸、不表达间距 / 对齐；算不出正数格子尺寸的那一维（`cell.unsized = {width?,height?}`：自适应带（星号带）被前面的固定带 / 间隙带吃光，内容溢出了承载物）什么都不写，另一维照写。这两类格子的格子尺寸与承载物设计尺寸照常登记与核对（`unsized` 的那一维只有在重算确实非正数时才放行）。格子放不下时是设计问题，不改写成"凑得下"的值。
4. **行列来源**：设计稿声明的 `flexContainerInfo.flexDirection`（`row`/`column`）优先——`flexDirection` 沿父链读取（不限节点类型），条目＝声明容器到该控件这条路径上容器的直接子节点；主轴按第 3 条成带。没有声明的层级、以及声明层级的交叉轴按 bbox 聚类（列＝x 区间重叠、行＝y 起始边邻近），成带口径与主轴相同。容器内的条目、以及内容区这一层，都走同一套规则。
   落格按**起始边**判定归属（横跨多行的控件不吞掉后面的行），控件 bbox 覆盖到的带全部算跨度：格子的 `rowSpan` / `columnSpan` 由覆盖带数得出，发射器照写 `Grid.RowSpan` / `Grid.ColumnSpan`；占格只按起始格判定，跨格控件与设计稿一样允许压住邻格。
5. **落格**：控件写 `Grid.Row` / `Grid.Column`，跨格再写 `Grid.RowSpan` / `Grid.ColumnSpan`。**同一锚点（起始）格只放一个控件**：推导用占用表 + 撞格下移保证锚点格唯一，门禁 R5 也按锚点判重，出现重复即产物被改坏。覆盖邻格见第 4 条。
6. **单行/单列**：只有一行或一列时不写 `Grid.RowDefinitions` / `Grid.ColumnDefinitions`，也不写 `Grid.Row` / `Grid.Column`。
7. **星号写法**：像素尺寸写 `Height="<值>"` / `Width="<值>"`，星号带写 `<RowDefinition />` / `<ColumnDefinition />`。自适应部分分两种：
    - **没有大空档的层**：最后一条带落成**裸星号**（`<RowDefinition />` / `<ColumnDefinition />`，吃掉剩余空间，门禁 R4 按这条放行）；有大空档那一段的星号带同样写成裸星号，其余带一律照设计稿像素；
    - **主轴 `row` 的列方向**：单个自适应条目写成裸 `<ColumnDefinition />`；出现多个自适应条目时按设计稿比例写**加权星号**（`Width="1016*"`，见第 3 条）。
8. **尺寸约束**：设计稿用「宽度 / 高度」栏设置的最小/最大宽高走 DSL 节点的 `constraints` 字段（来源、合并与官方支持后的切换点见 `page-build-rules.md` 第 5 节）。`wpfLayout` 只把它透传进格子，发射器在控件与容器 Grid 上写 `MinWidth / MaxWidth / MinHeight / MaxHeight`；`TextBlock` 在设了最大宽时补 `TextWrapping="Wrap"`。

## 3. 外观与协议

- **外观只走样式族**：`Style`、`Background`、边框与状态模板一律取 `mw-wpf-map.json` 的样式族键；设计稿的配色/边框与样式族冲突时**停下报告**，不散写属性凑。
- **样式族选择键是 `(ControlType, 设计稿变体名)`**：命中 `styleRules.byVariant` 用具名键；未命中则用该类型的 `pageDefault`（`"implicit"` 表示走框架隐式默认样式），并记入发射报告供人工评审。两者都取不到即 fail-closed。
- **文本**：一律走 `{DynamicResource <LangName>}`，挂载属性由 `textBinding` 决定（按钮默认 `Content`，`RightButtonStyle` / `UpDownRightButtonStyle` 这类"图标上+文字下"的样式族改挂 `IconText`，`TextBlock` 挂 `Text`，`GroupBox` 挂 `Header`）。没有语言键的文本不写字面量，进发射报告的待办（值槽位登记 `langRefPolicy: "none"` 的值不在此列：它不参与多语言，门禁按同一条登记放行）。
- **图形**：`Icon="{StaticResource <图形名>}"`，图形名取自本页 Icon 台账。
- **协议**（`Click="{s:Action …}"`、`PageName="Jump:…"`、`IOEnable`、`IOVisible`、`IOName`）：只在有来源时发射，A 侧不写空串占位（与作业B 的"恒写空串"口径不同，因为 A 侧没有宿主恒写字段）。

## 4. ViewModel 契约

ViewModel 与作业B 共用同一套生成器（`scripts/host/gen-mw-wpf-page.js`）：构造函数、`pageDesign` 之外恒含 `OnViewLoaded` / `HandleButtonEvent` 等固定成员，底部栏菜单项（`menuItems[].langName`）派生出按钮处理方法并在 `switch (message.ButtonName)` 里落 case。A 侧页面**不加载** IOContorl 页面 XML（控件在 `View.xaml` 里），因此 `.csproj` 不注册 `<Content>` 的页面 XML 项；其余注册项（View / code-behind / ViewModel / 本页 Icon / 本页语言字典）与作业B 相同。

## 5. 验证

静态门禁 = `scripts/adapters/mw-wpf/check-wpf-layout.js`（越界 / 锚点格冲突 / 禁止写法 / 协议属性名 / 资源键闭环 / 硬编码文本 / 尺寸来源 / 推导待确认 / 尺寸约束一致性、落格与发射 / 格子尺寸与尺寸·对齐发射；各条目的入参前提见该脚本头部 CLI 注释，失败与提示的逐条清单见 `page-build-rules.md` 第 4 节，此处不复述），`run-all.ps1 -Mode mw-wpf` 的 `gates` / `verify` 就是它。尺寸约束来源经 `run-all.ps1 -Constraints <约束.json>` 传入（见 `page-build-rules.md` 第 5 节）。

编译与加载验证属「项目运行时交付」门禁，只在目标项目接入且用户明确要求时执行；没有目标项目时只出静态脚手架。
