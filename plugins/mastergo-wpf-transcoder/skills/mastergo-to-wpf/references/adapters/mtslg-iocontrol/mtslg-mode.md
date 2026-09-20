# MTSLG IOContorl 完整手册

## 1. 项目适配信息（开工前确认）

本手册只规定可复用的 XML 结构、映射门禁与验证流程。运行程序、部署目录、页面注册文件、语言字典、重载动作和资源目录必须由目标项目的配置、源码或运行现场确认；不得将具体盘符、文件名、行数、进程名或页面样例写成通用规则。
开工前建立项目适配记录：

- 运行宿主：实际启动程序、日志位置与页面重载动作。
- 部署根目录：唯一生效的配置树；存在多个副本时逐一确认加载关系。
- 页面目录：`{PageName}Page.xml` 的实际输出目录与命名规则。
- 页面注册：页面 Target、菜单项与目标页面文件的关联方式。
- **页面名（Target）的确定口径（先查表、再推导、必须确认）**：形状固定为 `{区域前缀}{英文语义名}`——**区域前缀直接取 DSL 的 `ui` 字段本身**（该字段已含前缀，值形如 `F2`；**不要再补一个 `F`**，否则会得到 `FF2Xxx`），主页类如 `Home` 不带前缀，设计页名里的 `（x.y）` 编号一律去掉；英文语义名取设计页名的英文语义名并转 PascalCase（`手动对准` → `ManualAlign`）；结果必须匹配 `^[A-Za-z_][A-Za-z0-9_]*$`。取值优先级：① **项目内已登记**（`Layout.xml` 已有该 Target，或项目登记表命中）→ 直接沿用，**不新建页面**；② **未登记** → 按上式推导，**必须人工确认一次**，确认后写入项目登记表（如 `docs/page-registry.json`；登记表是**项目**事实，不是插件固定资产，与术语表/译文表同口径）；③ **推导不出或与既有名冲突** → 落 `pending`，拒绝生成。**同一设计页名可以对应多个 Target**（例：「目标示教 （2.2.1）」同时是 `F2Teach` 与 `F2TargetTeach`），因此**禁止只靠页名推导而不查表**；也禁止从其他项目复制 Target。前缀、编号清理与格式校验是可机械化的部分，英文语义名由人确认。
- 多语言目录：每种语言的资源文件、键命名规则与重载/重启要求。MTSLG 页面默认按页维护一套 `Resources/Pages/{name}/{name}_{LOCALE}.xaml`（默认 CN/EN），各语言 key 必须完全一致；运行时控件/菜单通过 `LangName` 引用这些 key。
- 资源键来源：Style、Icon、LangName、IOName 与 IOCommand 的可核验来源。
- 页面文件骨架：见第 2 节；组件固定模板、节点结构与字段来源以同目录的飞书组件库映射规范为唯一来源。
- 内容区坐标：`contentOriginX`、固定 `contentOriginY=192`、设计稿标题处理与目标画布尺寸。
- Target 映射：新建页面首次必须以运行时加载验证页面 Target 与文件的实际关联（属「项目运行时交付」门禁；只做静态结构映射时不执行，改为在待确认清单里登记该验证项）。

## 1.1 MasterGo 组件库映射入口

本手册负责 IOContorl 页面格式、运行时约束、坐标和验证流程；MasterGo 组件集如何匹配固定 IOContorl 模板，统一读取同目录的本地工作副本 [飞书组件库映射规范](./feishu-component-library-mapping.md)。页面顶部栏、底部栏和键盘提示如何写入 Layout.xml，统一读取 [页面壳层 Layout 映射规范](./feishu-layout-mapping.md)。后续规则更新直接修改本地工作副本，不把线上飞书文档作为运行时依赖。

- 先按飞书规范匹配独立组件集名称 / 公开属性名和真实属性值（右栏这类聚合组件族只按公开属性值命中，不存在“父节点语义”这一层）；
- 再按本手册核对 `ControlType`、允许属性、坐标、资源键和运行时先例；
- 两份规则冲突或某个组件无法唯一命中时，只隔离该组件：标记待确认并保留其 DSL 来源、坐标和 provenance；不得自行套用相似模板，也不得阻塞其他已唯一命中组件的 XML 生成。

### 1.2 Layout 文件处理

- 目标项目已有 `layout_file` 且文件存在：读取其真实节点结构、字段和运行时键，按现有结构增量注册。
- 目标项目声明了 `layout_file` 但文件不存在，且用户要求生成新页面：按 [页面壳层 Layout 映射规范](./feishu-layout-mapping.md) 的正式模板新建 Layout 文件，并写入已由 DSL 和正式映射确认的 `Page`、`Menu`、`MenuItem` 字段。
- 新建 Layout 时，未从目标项目或 MasterGo 确认的 `PageName`、`IOEnable`、`UserRightId`、运行时 Target 关联等字段不得猜写；缺少这些字段不阻塞静态页面和 Layout 模板生成，但必须在交付清单中标记运行时待确认。
- 不得从其他项目复制 Layout 结构、菜单字段、页面 Target 或运行时键。

页面和图标的正式输出路径必须由项目脚手架或真实目标项目确认：有效配置优先，其次读取目标 `.csproj` 的页面、图标和 Layout 声明。没有目标项目时先创建完整脚手架及其声明路径，再把页面 XML、页面 Icon 和 Layout 写入脚手架的正式目录；`Generated/` 只用于 provenance、manifest 和验证产物。脚手架阶段不编译、不加载运行时程序集。Icon 映射必须提供目标项目已确认或页面内唯一的英文资源名和中文注释名；XAML 注释只写中文名称，重复资源名由生成器按稳定数字后缀解析，禁止使用图层 ID 拼接 `MGIcon_*` 键。

## 2. 页面文件骨架

### 页面根节点骨架

固定节点：一个根 `IOContorl`；根节点使用 `NaN` 表示页面自适应骨架，业务控件作为其子节点。 `{page_children}` 仅由已确认的组件固定模板发射。

```xml
<?xml version="1.0" encoding="utf-8"?>
<IOContorl
    ID="{page_root_id}"
    Left="NaN"
    Top="NaN"
    Width="NaN"
    Height="NaN">
    {page_children}
</IOContorl>
```

页面根 ID 由页面标识或目标项目约定填写；位置与尺寸固定为 `NaN`。根节点不得承担业务控件的 `ControlType`、Style、Icon 或业务绑定。

## 3. 坐标规则（核心）

> **固定规则：`contentOriginY = 192px`。** 业务页面根级坐标一律使用 `PageY = MasterGoY - 192`；192 不是待推断、待配置或按页面变化的参数。

- **先识别公共栏，再归一**：从宿主页面、Layout 配置和**公共栏边界表**（即第 7.1 节第 4 步建立的同一份表，不另建第二张表）建立 `ContentRect`。公共栏边界（公共栏范围、客户区尺寸与缩放）是目标项目**一次性适配事实**，取自已有适配记录；确需建立或复核时才由运行时门禁取宿主运行截图，该截图只用于确定宿主边界，**不是**每页转换的固定步骤。顶部/底部公共栏默认由宿主负责、页面不生成；左右区域必须按目标框架职责逐侧判断，不能把左右节点一律当公共栏或一律当页面内容。**宿主运行截图不得用于判断设计稿图形、图标含义或朝向**（见第 8 节看图禁令）。
- **页面坐标不是完整窗口坐标**：根级保留业务节点统一计算 `PageX = MasterGoX − contentOriginX`、`PageY = MasterGoY − 192`。业务页面固定使用 `contentOriginY=192`，公共栏和 `design-artifact-title` 的偏移只能在根级归一化时扣除一次，嵌套控件不重复扣除。不得按单个控件手调偏移。
- **公共栏节点不重复生成**：顶部/底部公共背景、标题栏、状态栏、底部快捷键区和宿主已有控件必须在映射表标记“框架负责、页面不生成”；页面标题只有在 MasterGo 业务区确有独立标题节点且宿主不提供时才生成。
- **组件文本尺寸与字号分开处理**：所有 MTSLG `TextBlock`（标签、数值、单位和独立文本）的 `Height` 固定为 `40`、`Width` 固定为 `NaN`；不得使用外层组件高度、内部文字 bbox、独立文本 bbox、文本 bbox 宽度或 `FontSize` 改写这两个值（文本 bbox 宽度只作为 `dslWidth` 记入 mapping 溯源）。`FontSize` 仍从对应 MasterGo DSL 的字体属性读取并写入。
- **`FontWeight` 命中才写（判定顺序：样式名优先）**：`TextBlock` 的 `FontWeight` 只在设计稿字重**不是 normal** 时发射，**值取设计稿自己的字体样式名**（`dsl.styles[<text[0].font>].value.style` 里的 `fontStyle`，例如 `Bold`、`SemiBold`）——不是把数值翻译成名字。带字体族档位数字的前缀要去掉（`75 SemiBold` → `SemiBold`、`55 Regular` → `Regular`）。判定顺序固定为两步：① 先看样式名——命中 `normalStyleNames` 即 normal、**不写该属性**；② 只有**样式名取不到**（`style` 缺失/非法 JSON/没有 `fontStyle` 字段）时才回退看 `weight` 数值，命中 `normalValues` 即 normal、不写，否则写该数值。normal 一律**不写该属性**（不写空串，也不参与 `controlTypeRequiredAttrs` 恒写集合）。规则真值源是映射表 `textBlockFontWeight`（`normalStyleNames` + `normalValues` + `fallbackValueSource`，**完整清单以映射表为准**；正文不另立枚举，避免与真值源漂移），`FontSize` 的恒写规则不受影响。输入框、选择框等非 TextBlock 控件按正式变体模板取自身宽高；非 TextBlock 控件的文本不发射 `FontWeight`。
- **文本来源与 `Value` 硬门禁**：每个 `TextBlock` 的 `Value` 必须回溯到唯一 MasterGo `layerId`/DSL `ref` 及其真实文本节点；不得依据 XML `ID`、控件名称、坐标方向、页面语义或相邻实例推断文本。生成前必须逐项核对“XML 节点 → layerId/ref → 父节点链 → 原始文本 → Value”；不一致即停止生成并标记待确认。
- **必写字段（所有 ControlType）**：每个 ControlType 的固定必写字段集登记在 `mtslg-iocontrol-map.json` 的 `controlTypeRequiredAttrs`；生成器必须发射这些属性，取不到来源时写**空字符串占位**（个别字段在 `controlTypeAttrDefaults` 里登记了默认值，如 `Border.Value` 线宽默认 `1`）。**变体登记 `omitRequiredAttrs` 时该变体做减法：登记的属性不发射，生成器与校验器共用 `omittedAttrs()` 判据（见飞书组件库映射规范「组件级固定变体的公共口径」）**。`LangName` 是另一个例外：只在多语言绑定层给出真实 key 时发射——`noLangRefs` 豁免的运行时动态值、以及槽位登记 `langRefPolicy=none` 的值（选择框 `Value`）都不写空占位。
- **多语言默认开启**：Bundle 在 manifest 缺少 `languages` 时自动按 `languages.auto=true` + CN/EN 生成页面字典并强制 `LangName` 闭环；只有显式 `languages=false` / `{disabled:true, reason:"…"}` 才关闭，关闭原因写入审计。多语言是默认能力，不是可选项。**槽位级例外**：映射表在**值槽位**登记 `langRefPolicy: "none"` 时（当前只有选择框 `Value` —— 默认选中的名称，运行时由 `IOName` 数据决定），该值不产语言键、不挂 `LangName`，只记入审计 `languages.derivation.valueLangExempt`，且不占用 `noLangRefs`；显式 `keys[]` 指向该节点会直接失败。登记点只允许值槽位，且**按钮族不开放**（值槽位控件类型是 `IconButton`/`Button`/`StatusButton` 时直接失败——按钮文案一律产键挂 `LangName`）；其它位置或其它族的登记同样由 `gen-mtslg-mapping-from-dsl.js` 直接失败。
- **按钮族固定参数（IconButton / Button / StatusButton）**：`PageName`、`IOVisible`、`IOCommand`、`IOEnable` 四个运行时参数无论能否取到来源都恒写，取不到时写空字符串值（merge 时保留工程师已有真实值；**变体登记 `omitRequiredAttrs` 时该变体做减法：登记的属性不发射，生成器与校验器共用 `omittedAttrs()` 判据（见飞书组件库映射规范「组件级固定变体的公共口径」）**）；`IconButton` 的 `Icon`/`IconWidth`/`IconHeight` 同样恒写：有图标槽位时取**台账命中条目节点**的 bbox（该条目 `sourceRef` 指向的节点，映射字段 `iconSize`，四舍五入取整，不是控件宽高；台账条目必须登记在只包住该图标图形的节点上），无图标槽位时写空字符串（**例外：变体登记 `iconPolicy=runtime` 时本页台账没有也不该有该条目，尺寸取该实例子树里唯一 PATH 的 bbox，多个 PATH 直接失败并要求设计侧消歧（登记台账对该变体无效，Bundle 会剔除命中该 owner 的条目）**）；`Button`/`StatusButton` 模板不含图标字段，不发射 `Icon`、`IconWidth`、`IconHeight`。映射带 `Icon` 却没有 `iconSize` 时生成器直接失败，禁止猜图标尺寸。
- **模板匹配键**：组件族匹配使用“组件集名 + 公开属性名 + 真实属性值”，或在映射表里登记 `structural`（结构签名）的族按结构签名匹配。设计稿里的图层名称只用于核对，不参与匹配，**例外只有两条**：① 底部栏实例的属性里没有变体信息，按 `layoutRules.bottomBar.match` 登记的组件名匹配（见《页面壳层 Layout 映射规范》）；② 表格族（`tableTemplates`）在设计稿里没有组件集，按 `match.structural` 登记的**结构签名 + 图层名后缀**匹配（见 4.1）。两条例外都登记在映射表里，不是“按图层名兜底”。历史上按“父节点语义”分流的表已作废（映射表里没有这类字段；右栏可直接放置的独立组件由 `rightSidebarComponentTemplates` 按组件集名匹配，如 `右侧栏-左右结构-icon+文案`）。变体登记 `componentSet` 时，解析先用公开属性值命中变体，再用变体内部实例的组件名交叉核对；两者不一致**直接失败并要求重新核对**，不静默选边（`resolve-mtslg-template-mapping.js` 按此实现）。
- **图标台账与按钮的归属匹配（树判据优先）**：台账条目与按钮的归属按 **DSL 树包含**判定——条目 `sourceRef` 节点的 PATH 子树与按钮子树的 PATH 有交集即命中；`id` 字符串前缀（相等/包含）**只在没有任何树命中时**才作为兼容回退（前缀不是并列条件）；**多条命中时取树深度最深（最专属）的条目**，避免外层容器抢走内层按钮的图标。这条判据是必需的：部分设计稿里「图标组 / 按钮组」的 `id` **不是**其子 PATH `id` 的字符串前缀（同一实例内的节点 id 只共享外层实例前缀），只按前缀匹配会静默匹配不到——按钮 `Icon` 留空却不报错（`discover` 里表现为大量 `no-exact-extractSvg-entry` 候选）。这条判据的**唯一实现**在 `scripts/lib/icon-ownership.js`（`isPrefixOf` / `subtreePathIds` / `depthOf` / `subtreeContainsAny` / `selectOwningEntries`）；`gen-mtslg-mapping-from-dsl.js` 与 `discover-mtslg-page-icon-map.js` 必须 `require` 复用同一份，禁止各写一份（两脚本的树索引适配器各自组装，但判据与排序规则完全相同）。
- **图标尺寸来源（`IconWidth`/`IconHeight`）**：取**台账命中条目节点**的 bbox——即该条目 `sourceRef` 指向的节点（缺失时回退 `sourceId`），四舍五入取整；`validate-iocontrol-provenance.js` 用同一个 `sourceRef` 独立重算比对，生成器与校验器不可能自相矛盾。**因此台账条目必须登记在「只包住该图标图形」的节点上**（图标组 / 图标实例 / 图标 PATH），不要登记在按钮级容器上——登记在按钮级容器上会取到按钮尺寸（实测 `exit` 的图标实例覆盖整个按钮：取到 170×80，而图标区 PATH 是 35×32）。右栏这类带图标槽位的按钮，图标来自 `实例` 属性指向的图标节点；空占位虚线框视为没有图标。**例外：变体登记 `iconPolicy=runtime`（图标由目标项目提供，如右栏 `enter`/`exit`）时本页台账没有也不该有该条目，尺寸改取该实例子树里唯一 PATH 的 bbox；多个 PATH 直接失败，要求设计侧消歧（登记台账对该变体无效）。**该例外只在映射表登记的 runtime 变体上生效，其余按钮族一律按台账口径。
- **图标几何补充来源（extractSvg 去重 + 祖先朝向自动烘焙）**：`extractSvg` 只输出 PATH 自身的 `d` + `transform`，几何完全相同的复用实例会被去重（同一方向图标经组级 `rotate`/`flipV` 复用时只返回一条），因此会出现「按钮有图标槽位却没有 `Icon`」。补齐办法：`gen-mtslg-page-icons.js` 追加第 4 个参数（`dsl.snapshot.json`），图标映射条目加 `"fromDsl": true`（按 PATH 原始 `d` + 自身 matrix 合成，与 extractSvg 等价并平移到原点）。**祖先朝向由脚本自动判定并烘焙**：只要图标节点的 PATH 祖先链上出现 `rotate`/`flipH`/`flipV`，脚本就自动走「DSL + 烘焙」（即使 `extractSvg` 恰好也有该条目——它只给 PATH 自身变换，表达不了祖先朝向），不需要台账手写 `bakeAncestorTransform`；自动烘焙的图标在 stdout 逐条报告。台账显式写 `"bakeAncestorTransform": true` 时结果与自动一致。该烘焙是机械计算：按树序把祖先变换烘进坐标，计算结果即产物，不做视觉复核、不读图、不识别图形外观。同一组图标在 DSL 里几何完全一致（如「向左」与「向右」，把祖先变换一并算进去后逐字段相同）时属于设计侧缺图：照常按槽位语义命名并出图，同时标记待确认并要求设计补图，不得自行镜像猜测。
- **设计稿最上方示例标题默认剥离**：位于根节点或展示外壳、仅用于说明组件或工件示教的标题标记为 `design-artifact-title`，不写入页面 XML。业务内容容器内部且运行时需要的标题才保留。
- **设计稿像素直传（归一后）**：`Left = pageAbsX − parentPageAbsX`，`Top = pageAbsY − parentPageAbsY`，Width/Height 原样；`TextBlock` 例外：`Height` 固定 `40`、`Width` 固定 `NaN`。目标画布尺寸必须与第 1 节适配记录一致；不允许从固定分辨率、截图缩放或其他页面推断。
- 允许小数与负数；`NaN` 表示自适应（根节点四属性均为 `NaN`；叶子无宽高时省略属性）。具体数值必须来自当前实例的 MasterGo bbox。
- 子控件坐标相对**父容器的内容区原点**；父容器与子控件的坐标关系必须由唯一 MasterGo 父子链和 bbox 计算。普通容器（无内容区内边距）的内容区原点 = 父容器左上角；**容器类控件（`ControlType="GroupBox"`）不是**——框架模板是"标题条 + 内容区"两段式，内容区原点 = 容器左上角 + 内容区边框 + 标题条高度，登记在 `mtslg-iocontrol-map.json` 的 `infoGroupTemplates.styleInsets`（按容器变体的**内容区原点键** `contentInsetStyle` 取值：`IOGroupBoxBaseStyle` = `{left:2, top:40}`、`IOGroupBoxSecondary` = `{left:1, top:35}`、`IOGroupBoxThirdly` = `{left:1, top:25}`、`IOGroupBoxFour` = `{left:1, top:35}`）。换算：`Left = 子控件绝对X − 容器绝对X − inset.left`、`Top = 子控件绝对Y − 容器绝对Y − inset.top`；漏扣会让容器内所有子控件整体下移一个标题条高度。容器变体必须登记两个**互相独立**的字段：`style` 是发射到 XML 的 `Style` 值（当前项目框架口径下 GroupBox 恒为空串，即 `Style=""`，由框架落默认样式）；`contentInsetStyle` 是**仅用于查本表**的内部键（本族 `IOGroupBoxSecondary`），**不发射**到 XML。`contentInsetStyle` 缺失或在本表查不到原点时，生成脚本 fail-closed 直接失败（不猜原点）。**该口径是项目框架侧的确定口径，按既定事实执行**：GroupBox 的 `Style` 写死为空串（`Style=""`）；空 `Style` 时内容区原点**就是** `IOGroupBoxSecondary` 的 `{left:1, top:35}`——不是待确认事项，也不设待确认编号，生成时直接按此机械换算。**适用范围声明**：`references/adapters/mw-wpf/framework-manual/` 是**作业 A（MW WPF / XAML 侧）**的参考资料，其中 `ContentGroupBoxStyle`「未显式指定 Style 即落到内容分组框形态」等记载来自某次本地框架快照（版本可能过期），**不作为作业 B（MTSLG IOContorl 页面 XML）运行期口径的依据**；两者冲突时以本节口径为准。`gen-mtslg-mapping-from-dsl.js`、`apply-container-containment.js`、`gen-iocontrol-xml.js`、`check-iocontrol-coords.js` 与 `validate-iocontrol-provenance.js` 必须使用同一公式。
- 当完整 DSL 的根节点或对应容器节点的 `overflow` 属性为 `hidden` 时，必须保留外层布局容器及其 `Width/Height` 裁剪边界，内部子控件继续使用相对父容器坐标。该规则优先于模板中“平级节点”的展开形式。只有 DSL 明确没有裁剪需求时才允许展开为同级节点，且必须保留等价裁剪边界。
- 无 Viewbox、无缩放、无星号数学、无"三类固定不缩放"——`gen-iocontrol-xml.js` 全自动完成，禁止手工重写坐标。
- 取数后先核对完整 DSL 根节点 `dsl.nodes[0].layoutStyle.width/height` 与已确认目标画布尺寸一致。不一致或根节点尺寸缺失时先与用户确认页面区域，不能继续生成。

## 4. ControlType 摘要（完整表见 mtslg-iocontrol-map.json）

| 类别 | ControlType |
|---|---|
| 容器 | View（页签，Value=标题/Index/Icon）、GroupBox（Header）、Border（Value=线宽）、ButtonGroup（内放 RadioButton 共用 IOName）、TabControl+TabItem |
| 文本/输入 | TextBlock、TextBox（Keypad）、NumberBox（DecimalPlaces 默认 3）、IntNumberBox、CheckBox |
| 按钮 | Button（PageName="Jump:X"/IOName/IOStyle）、IconButton（Icon=Geometry 键/TopLeftContent=F1..F12）、StatusButton（IOState 状态色）、Togglebutton、RadioButton |

按钮族（IconButton / Button / StatusButton）另有固定参数：`PageName`/`IOVisible`/`IOCommand`/`IOEnable` 恒写（取不到写空字符串值；**变体登记 `omitRequiredAttrs` 时该变体做减法：登记的属性不发射，生成器与校验器共用 `omittedAttrs()` 判据（见飞书组件库映射规范「组件级固定变体的公共口径」）**）；`IconButton` 的 `Icon`/`IconWidth`/`IconHeight` 同样恒写——有图标槽位时按台账命中条目节点 bbox 四舍五入发射（**例外：变体登记 `iconPolicy=runtime` 时本页台账没有也不该有该条目，尺寸取该实例子树里唯一 PATH 的 bbox，多个 PATH 直接失败并要求设计侧消歧（登记台账对该变体无效，Bundle 会剔除命中该 owner 的条目）**），无图标槽位时写空字符串，`Button`/`StatusButton` 不含图标字段、不发射这三项；详见飞书组件库映射规范的“固定字段与可选字段规则”。
| 选择 | ComboBox（选项=子 TextBlock；ItemsSourceFile/DisplayMemberPath/SelectedValuePath） |
| 数据 | DataGrid（Value=当前阶段固定空串 `Value=""`，见 4.1；列=**列定义子节点**，默认 TextBlock，可按该列单元格类型为 NumberBox / IntNumberBox / TextBox，命中与列口径见 4.1；这里的“列定义”不是页面控件，不套 `controlTypeRequiredAttrs`）、ProgressBar、RangeProgressBar、PowerControl（实时功率曲线） |
| 视觉/设备 | Image（Value=绝对路径）、Camera（DesignPanelID）、AutoCutCamera、HighAngleCamera、LowAngleCamera、EMTCamera |

控件属性允许集与每类控件的固定必写字段集分别在同目录 `mtslg-iocontrol-map.json` 的 `controlTypes` 与 `controlTypeRequiredAttrs`；生成器不得把白名单外属性当作合法字段，也不得漏发必写字段（取不到来源写空字符串）。Style、Icon、LangName 与 PageName 还必须通过第 6 节键查证。资源字典是否共享、资源键来自何处，均由项目适配记录确认。

### 4.0 文本换行口径（所有文案属性与语言字典通用）

设计换行码点（`U+2028` 行分隔符 / `U+2029` 段分隔符 / `CR`(U+000D) / `LF`(U+000A) / `CRLF`）一律归一成 **LF（U+000A）**，并按框架写法发射为字符引用 **`&#x0a;`**：

- 页面 XML 的所有文案属性（`Value` / `Header` / `MenuItem Name` / `TopLeftContent` …）写 `&#x0a;`——属性里**不能出现字面换行**（XML 解析器会把它归一成空格）。
- 页面语言字典值（`{页面名}_{LOCALE}.xaml`）同样写 `&#x0a;`：运行时按 `LangName` 取字典值，字典里把换行压成空格会让两行文案退化成一行。
- 同一行内不同字体的多个 text run 是 `text` 数组多项、按空串拼接，**不是换行**；只有单个 run 内部的换行码点才算换行。
- **空白处理分三条用途**：① 页面 XML 属性文案只归一换行、其余空白原样保留；② 字典值额外做「行内空白折叠成单个空格 → 换行两侧空白去掉 → 行首行尾 trim」（设计稿左右留白是排版产物；实现是 `scripts/lib/script-helpers.js` 的 `langValueText`：`A␠␠\n␠␠B` → `A\nB`）；③ 键派生 / 译文查找 / 术语表匹配用全量「压平值」。三者用途不同，不是同一份字符串。
- **实现真值源**是 `scripts/lib/script-helpers.js`（`normalizeNewlines` / `langValueText` / `xmlAttr` / `xmlElementText` / `normalizeForCompare`），生成器、校验器、Bundle、字典发射器共用，不允许各写一份；映射表 `textNewlinePolicy` 只登记同一口径供人读与回归断言比对，不是脚本的运行期输入。

### 4.1 DataGrid 的命中口径与 Value 现阶段口径

**命中口径（表格族 `tableTemplates`）**：表格在团队组件库里通常没有组件集（设计稿里只是一个 `GROUP`），因此本族**只登记一条命中路径**（映射表里没有 `match.property` / `componentSet`），按**结构签名**命中——节点类型 `GROUP` + 图层名以「表格」结尾 + 孩子里含名为「表头」的群组 + 至少一个名为 `item` 的行群组 + 表头至少有 `signature.minHeaderTexts` 条可见文本，**五项同时成立**；**部分命中**（后缀或签名之一成立）时登记 `pending`（写明哪一半不成立），两项都不成立的普通 `GROUP` 不属于候选。命中后发射一个 `DataGrid` 根节点 + 由表头可见文本从左到右展开的**列定义子节点**：列节点是列结构不是页面控件，几何按映射表 `tableTemplates.columnTemplate` 固定发射（`Left=0` / `Top=0` / `Height=45`、不写 `Width`），属性只发射 `Value`（列标题）+ `alwaysWrittenAttrs` 空占位，不套 `controlTypeRequiredAttrs`；列数 = 表头可见文本数（没有额外隐藏列），列 `ControlType` 由该列单元格类型严格多数判定（没有多数退化为 `TextBlock`）。表格的**行是 PageData 数据不是控件**：行内文本一律 `omit` + `role=table-data-cell`，行内容按行登记进 `mapping.tableAudits[].rows`，单元格实例不再按 `inputTemplates` 单独发射。表格图层声明尺寸覆盖不了内容范围时记 `tableAudits[].geometry.declaredBoxCoversContent=false`。

- **本插件可自证的产物要求**：`ControlType="DataGrid"` 必须声明并**恒写** `Value`，且当前阶段**固定写空串 `Value=""`**（唯一必写字段集登记点是 `controlTypeRequiredAttrs.DataGrid`——`Value` / `IOName` / `IOEnable` / `IOVisible`，生成器与校验器都只读那一处）。本阶段不要求去找数据文件名，也不得因为空串把该控件判成未完成：`Value=""` 就是当前阶段的正式产物形态。
- **待绑定提示**：空串必须同时带映射 `tableAudits[].valuePending=true` 与 Bundle 审计 `tables[].valuePending=true`，让工程师接手时一眼看到哪张表还没绑数据源。该标记是**提示性审计字段**，不是交付门禁，也不影响 provenance / 坐标门禁的通过；工程师绑定真实数据文件名后把 `valuePending` 置 `false`。禁止编造文件名。
- **运行时刻画一律归目标项目契约**：`Value` 指向哪个文件、子列结构与数据源字段、以及「省略 `Value`（属性缺失）」「`Value=""` 指向不存在的数据文件」这些情形下究竟如何表现，都必须由目标项目的 DataGrid 控件契约、源码或实际验证确认，不能从其他项目的页面、异常信息或本插件的推测推导；未确认前不得以规则口气落笔，也不得作为已验证结论写进交付说明。
- 本阶段**不再有「必须先确认数据源」的门禁**：AI 直接发 `Value=""` 并带 `valuePending=true` 提示交付，工程师接手后绑定真实数据文件名、把 `valuePending` 置 `false`。任何人不得到此为止把「已绑定数据源」当成已完成项写进交付说明；本插件也不去猜数据文件名。

```xml
<IOContorl
    ID="MX_ExampleGrid"
    ControlType="DataGrid"
    Value=""
    Left="0"
    Top="0"
    Width="600"
    Height="320">
    <!-- 列节点 -->
</IOContorl>
```

## 5. merge 语义（改现有页面的强制模式）

`gen-iocontrol-xml.js --merge <现有XML> <mapping.json>` 的行为：

1. **匹配**：映射节点 ↔ 现有节点，ID 优先；无 ID 时按 ControlType + Left/Top（容差 0.5）位置匹配。
2. **几何更新**：Left/Top/Width/Height 按映射更新（这就是设计稿改动的落点）。
3. **ControlType**：按映射更新，变化写冲突报告。
4. **业务属性保护**：现有 XML 同名的属性一律保留现有值（值不同 → 冲突报告，不覆盖）；映射多出来的属性 → 追加（新增报告）。工程师手写的 IOName/IOCommand/IOState 等永远不会被设计稿冲掉。**例外**：映射节点的 `valueSource=dsl.text` 时，**文案承载属性**是设计文本，merge 强制按映射覆盖并写“设计文本覆盖（dsl.text）”报告——否则 provenance 校验会失败。文案承载属性与 `validate-iocontrol-provenance.js` 同口径：有 `Value` 比 `Value`；容器类控件（如 `GroupBox`）没有 `Value`，标题文案由 `Header` 承载，此时比 `Header`。
5. **节点增删**：映射里的新节点渲染插入父容器闭合标签前；现有但映射未涉及的节点原样保留（报告列出）。
6. **格式最小扰动**：未触及的节点与注释逐字节保留；被替换节点跟随原样式（单行/多行）。

**为什么禁止整文件重写**：设计稿没有 IO 绑定信息，`--fresh` 重写会丢掉工程师手写的 IOName/IOCommand/IOEnable 等业务属性。改现有页面一律 `--merge`。

## 6. 键查证门禁（禁止捏造）

目标项目必须提供或生成可追溯的键目录；目录记录每个可用键的来源文件、加载范围与验证状态。没有项目键目录时，先从目标项目配置、资源字典、语言字典、页面注册与已运行页面建立目录，不能套用其他项目的键。

1. **Style / Icon**：在目标项目实际加载的资源字典或正式资源清单中查证；记录资源键与来源。
2. **LangName**：在目标项目要求的全部语言字典中查证；新增键必须在每种必需语言中成对提供，并按目标项目要求执行重载或重启验证。
3. **PageName**：`Jump:{target}` 中的 `{target}` 必须存在于目标项目实际加载的页面注册集合；新 Target 必须先完成注册与首次加载验证。
4. **IOName / IOCommand / IOState**：仅可使用目标项目业务配置、接口定义或已运行页面中可核验的字段；未确认时留空并标记“待人工绑定”。

任一键未通过查证时，禁止将其写入最终 XML。可选处理只有三种：由用户提供已确认键、在目标项目中完成正式登记，或留空并标注待人工处理。
## 7. 工作流

### 7.0 最终交付门禁

用户要求项目部署、运行时重载或可运行页面时，目标是完整的 IOContorl 项目交付，不是临时稿或“先能显示再补组件”的中间结果。用户只要求独立结构映射 XML 时，也使用同一条正式映射链；没有目标项目则先创建完整 IOContorl 项目脚手架，再按映射生成真实控件结构。有真实目标项目时，页面 XML、Icon、Layout、项目配置、mapping/provenance 和目标项目要求的宿主壳共同完成正式接入；不能因为运行时配置缺失而退化为无类型容器。

- “按钮”“相机”“下拉框”“输入框”“容器”等名称只能作为线索；必须结合组件实例、变体、父子布局、位置和目标项目先例选择 `IconButton`、`Camera`、`ComboBox`、`NumberBox`、`GroupBox` 等真实组件。
- 组件库没有明确匹配项时，保留该组件的真实 DSL 来源、坐标和 provenance，并在待绑定清单中标记“正式组件映射缺失”；不得用图片、SVG 背景、普通 `Button`、空 `Border` 或自绘结构替代。其他已映射组件继续生成。
- 不得把包含待绑定组件的静态页面报告为完整可运行页面；交付报告必须分别列出“静态页面和 Layout 已生成”“未映射组件待绑定”“运行宿主加载验证状态”。

### 7.1 公共前置

1. 确认模式：项目运行时交付时读取目标项目提供的适配配置；独立结构映射稿由用户明确的 IOContorl 输出目标选择 `mtslg-iocontrol`，没有目标项目时创建 `mtslg-iocontrol` 脚手架，不因缺少配置而改变正式组件映射。
2. 取数：MasterGo 链接 → `getDsl(fileId, layerId, format=json)` 一次读取完整页面 DSL；以 `dsl.nodes[0]` 作为根节点，核对其 `layoutStyle.width/height` 与适配记录的画布尺寸一致。不得拆分请求或用局部响应拼接页面。
3. 首次（或键有变动时）运行 `scan-mtslg-keys.ps1` 生成/刷新 `docs/mtslg-keys.json`。
4. **建立公共栏边界表**：记录顶部/底部公共区域、左右区域职责、`ContentOriginX/Y`、内容区尺寸，以及每个被剥离节点的 node id；未完成前不得写 XML。
5. 如果目标项目存在多份样式/主题资源库，先按 `references/style-library-profiles.md` 确认 Profile ID、版本和加载优先级；结构映射稿只能写入已有映射表或已提供本地资源库中可核验的 Style/Icon，未确认的运行时键写入注释或 manifest，不得伪造。

### 7.2 路径 A：修改现有页面（当前主路径）

1. 读目标项目实际加载的现有页面 XML；由适配记录确认唯一生效版本，不能按目录名或历史副本猜测。
2. 建映射：先套用公共栏边界表并归一 bbox，再写 DSL 节点 → 映射 JSON（`ref`/`id`/`controlType`/`parent`/pageAbsX/pageAbsY/w/h/attrs）；公共栏节点保留审计记录但不进入页面映射。
3. Group 语义用 `classify-mastergo-groups.js` 的 role，再经 `mtslg-iocontrol-map.json` roleMap 定 ControlType；不得用相机/按钮实例在有效相机组件外重复搭建内部控件。
4. `gen-iocontrol-xml.js --merge <现有XML> <mapping.json> --out <已确认页面输出路径>` → 读 merge 报告，逐条裁决冲突。
5. `check-iocontrol-coords.js --xml <产出> --nodes <节点表>`：0 MISMATCH / 0 EXTRA。
6. 执行第 6 节键查证门禁，处理全部未核验键。
7. 【仅运行时交付门禁】`sync-to-mt.ps1` 按适配记录同步到唯一已确认的运行配置目录，前置条件是静态 XML、来源、坐标与键查证全部通过**且用户要求部署到运行目录**（与 `SKILL.md`「辅助脚本触发矩阵」的 `sync-to-mt.ps1` 条目同口径）；同步前强制备份。同步是部署动作，宿主加载验证发生在同步之后的第 8 步。用户未要求运行时交付/部署时**只跳过第 7、8 这两步**：纯静态交付在第 6 步之后直接执行第 9 步留档，留档、待确认清单与未完成运行时项在静态交付下同样必须产出（见 `SKILL.md` 对结构映射稿的交付要求）。
8. 【仅运行时交付门禁】在目标运行宿主中切到目标页，执行已确认的页面重载动作，再截图核对（第 8 节）；用户未要求运行时交付时跳过本步，并在待确认清单登记“未做宿主加载验证”。
9. 通过后留档：记录页面源文件、设计链接、边界表、映射、验证证据与待人工项；版本控制提交由用户决定。

### 7.3 路径 B：新建页面（可选）

1. `gen-iocontrol-xml.js --fresh <mapping.json> --out <Name>Page.xml`（根节点自动生成 NaN 骨架）。
2. **页面注册固定模板**：目标项目存在 Layout 时，按其已确认注册结构添加页面 Target 与菜单入口；目标项目缺少 Layout 时，按 `feishu-layout-mapping.md` 的正式模板创建 Layout 文件，并仅写入已确认字段。示例模板：`<Page Target="{target}" LangName="{page_title_key}"/>`；菜单项只有在 `PageName="Jump:{target}"` 等字段已有项目证据时才填入。改写已有文件前备份；新建文件记录为新产物。
3. **语言键**：在目标项目要求的每种语言资源中成对添加 `{page_title_key}`；语言文件的编码、重载与重启要求以适配记录为准。
4. 坐标核对 → 【仅运行时交付门禁】同步 → 执行目标项目已确认的重载动作；用户未要求运行时交付时只跳过同步与重载两步，留档与待确认登记照常执行（口径同 7.2 第 7、8、9 步）。
5. **风险闸**：Target→文件名映射部分在闭源代码，首次加载验证属「项目运行时交付」门禁（只在用户明确要求运行时交付时执行，口径同第 1 节 Target 映射条）；纯静态结构映射交付时登记为待确认项、不执行加载。验证失败则回退「改现有页面」路径并报告。

## 8. 验证方法

**看图禁令（强制）**：页面生成阶段（DSL → mapping → XML / Icon / Layout）**不读图**——不得打开或裁剪**设计稿图片/截图/图标位图**，不得做像素采样、ASCII/字符画粗渲染、栅格化预览，也不得用图像识别或“看起来像不像”判断任何图形外观、含义或朝向。本条约束的是**人与模型读图做判断**；`gen-mtslg-page-icons.js` 内部用于比较 EvenOdd 与 Nonzero 渲染差异的机械栅格化属于算法步骤，不受此限，照常运行。图标朝向由 DSL 的 `rotate` / `flipH` / `flipV` 机械烘焙得出，**计算结果即产物**。下面「运行时」小节属于「项目运行时交付」门禁：只在用户明确要求替换/部署/加载页面或报告可运行、Ctrl+R、视觉一致时执行，不是每次转换的固定步骤；其中的**宿主运行截图**只用于确认页面能加载、关键控件位置与页面稳定性（以及第 3 节建立宿主边界，见该节对 `ContentRect` 的说明），**不得**用来判断设计稿图形、图标朝向，也不得修改已生成的 Geometry 或否决机械产物。

静态（生成后立即）：
- `check-iocontrol-coords.js`：0 MISMATCH、0 EXTRA（容差 0.5px）。
- 键白名单校验（手动/生成器报告交叉核对）。
- XML 可解析、无重复 ID、根节点 NaN 正确。

运行时（目标项目重载动作 + 截图）：
1. 切到目标页，执行适配记录中的重载动作，并等待目标项目完成加载。
2. 使用 `cap-window.ps1` 或目标项目认可的截图方式，传入已确认的运行宿主与输出路径。
3. 坐标换算：以适配记录中的目标客户区尺寸为基准；若运行时存在缩放，记录客户区原点与缩放系数后再逐区比对。
4. 按 DSL bbox 裁剪关键区逐区对照；没有可视化通道时，可用像素采样、UI Automation 或间隔截图像素差异确认页面**稳定性与关键控件位置**（仅限本运行时门禁；不得据此判断图标朝向、改 Geometry 或推断设计侧缺失）。
5. 检查目标项目要求的语言环境中 LangName 生效，且 IOEnable/IOVisible 无缺键报错。

## 9. 风险与实测待办

- **首次项目验证项**：确认客户区尺寸与缩放、页面重载的焦点与时机、同名页面文件的加载优先级；结果写入项目适配记录，不回填为本手册规则。
- 版本控制：改动前备份；提交、合并和推送由用户确认后执行。
- 如果存在重复部署副本，必须由适配配置和运行宿主确认唯一生效目录。
- 布局分组（无控件语义的 Group）：可以在 mapping manifest 中保留原始层级，但最终可加载的 IOContorl XML 不得输出运行时不识别的无 `ControlType` 容器；应展平到最近有效父容器并重算子坐标，或使用映射表中已确认的容器 ControlType。完整 DSL 的对应根节点/容器节点 `overflow=hidden` 时必须保留等价外层裁剪边界。
- 新产出不得新增缺少必需语言翻译或未通过键查证的 LangName。

## 10. 脚本索引（scripts/）

| 脚本 | 用途 | 模式 |
|---|---|---|
| `call-mastergo-mcp.js` | 通过 stdio 调用 MasterGo MCP（getDsl / extractSvg / …）并把响应**只落盘**，stdout 仅一行摘要，避免整页 DSL 进入上下文 | 双模式共用 |
| `gen-mastergo-page-bundle.js` | 一次编排页面 XML、页面 Icon、Layout、WPF 宿主壳和审计产物 | MTSLG 页面 + MaxWell WPF 宿主 |
| `gen-mtslg-layout.js` | 创建或增量更新 Layout.xml，只发射已确认字段 | MTSLG |
| `gen-mw-wpf-page.js` | 生成 View、View.xaml.cs、ViewModel 和 csproj 注册 | MaxWell WPF 宿主 |
| `gen-iocontrol-xml.js` | IOContorl XML 发射器（--fresh / --merge） | 新 |
| `check-iocontrol-coords.js` | 页面坐标逐控件核对（0 MISMATCH 硬门） | 新 |
| `scan-mtslg-keys.ps1` | 键白名单生成（styles/icons/langNames 成对/pageTargets/ioCommands/ioNames） | 新 |
| `sync-to-mt.ps1` | 安全同步：备份+回滚+拒绝副本路径+svn 摘要 | 新 |
| `classify-mastergo-groups.js` | Group 名称→语义 role 分类 | 双模式共用 |
| `cap-window.ps1` / `cap-window2.ps1` | 截图验证（运行宿主与输出路径由适配记录提供） | 双模式共用 |
| `discover-mtslg-page-icon-map.js` | 从当前页面 mapping 的真实 PATH/SVG 发现候选，保留已确认资源键并输出 `candidates/unmapped` 审计 | 双模式共用 |
| `gen-mtslg-page-icons.js` | 从发现结果和逐项确认的图标映射生成当前页面 Icon 文件；未确认候选不发射 | 双模式共用 |
| `gen-mtslg-page-lang.js` | 从语言清单发射当前页面的 `{name}_{LOCALE}.xaml` 多语言字典，强制各语言 key 完全一致 | MTSLG |
