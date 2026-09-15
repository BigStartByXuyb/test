# MTSLG IOContorl 完整手册

## 1. 项目适配信息（开工前确认）

本手册只规定可复用的 XML 结构、映射门禁与验证流程。运行程序、部署目录、页面注册文件、语言字典、重载动作和资源目录必须由目标项目的配置、源码或运行现场确认；不得将具体盘符、文件名、行数、进程名或页面样例写成通用规则。
开工前建立项目适配记录：

- 运行宿主：实际启动程序、日志位置与页面重载动作。
- 部署根目录：唯一生效的配置树；存在多个副本时逐一确认加载关系。
- 页面目录：`{PageName}Page.xml` 的实际输出目录与命名规则。
- 页面注册：页面 Target、菜单项与目标页面文件的关联方式。
- 多语言目录：每种语言的资源文件、键命名规则与重载/重启要求。MTSLG 页面默认按页维护一套 `Resources/Pages/{name}/{name}_{LOCALE}.xaml`（默认 CN/EN），各语言 key 必须完全一致；运行时控件/菜单通过 `LangName` 引用这些 key。
- 资源键来源：Style、Icon、LangName、IOName 与 IOCommand 的可核验来源。
- 页面文件骨架：见第 2 节；组件固定模板、节点结构与字段来源以同目录的飞书组件库映射规范为唯一来源。
- 内容区坐标：`contentOriginX`、固定 `contentOriginY=192`、设计稿标题处理与目标画布尺寸。
- Target 映射：新建页面首次必须以运行时加载验证页面 Target 与文件的实际关联。

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

- **先识别公共栏，再归一**：从宿主页面、Layout 配置和运行截图建立 `ContentRect`。顶部/底部公共栏默认由宿主负责、页面不生成；左右区域必须按目标框架职责逐侧判断，不能把左右节点一律当公共栏或一律当页面内容。
- **页面坐标不是完整窗口坐标**：根级保留业务节点统一计算 `PageX = MasterGoX − contentOriginX`、`PageY = MasterGoY − 192`。业务页面固定使用 `contentOriginY=192`，公共栏和 `design-artifact-title` 的偏移只能在根级归一化时扣除一次，嵌套控件不重复扣除。不得按单个控件手调偏移。
- **公共栏节点不重复生成**：顶部/底部公共背景、标题栏、状态栏、底部快捷键区和宿主已有控件必须在映射表标记“框架负责、页面不生成”；页面标题只有在 MasterGo 业务区确有独立标题节点且宿主不提供时才生成。
- **组件文本尺寸与字号分开处理**：所有 MTSLG `TextBlock`（标签、数值、单位和独立文本）的 `Height` 固定为 `40`、`Width` 固定为 `NaN`；不得使用外层组件高度、内部文字 bbox、独立文本 bbox、文本 bbox 宽度或 `FontSize` 改写这两个值（文本 bbox 宽度只作为 `dslWidth` 记入 mapping 溯源）。`FontSize` 仍从对应 MasterGo DSL 的字体属性读取并写入。输入框、选择框等非 TextBlock 控件按正式变体模板取自身宽高。
- **文本来源与 `Value` 硬门禁**：每个 `TextBlock` 的 `Value` 必须回溯到唯一 MasterGo `layerId`/DSL `ref` 及其真实文本节点；不得依据 XML `ID`、控件名称、坐标方向、页面语义或相邻实例推断文本。生成前必须逐项核对“XML 节点 → layerId/ref → 父节点链 → 原始文本 → Value”；不一致即停止生成并标记待确认。
- **必写字段（所有 ControlType）**：每个 ControlType 的固定必写字段集登记在 `mtslg-iocontrol-map.json` 的 `controlTypeRequiredAttrs`；生成器必须发射这些属性，取不到来源时写**空字符串占位**（个别字段在 `controlTypeAttrDefaults` 里登记了默认值，如 `Border.Value` 线宽默认 `1`）。`LangName` 是唯一例外：只在多语言绑定层给出真实 key 时发射，动态值等 `noLangRefs` 豁免节点不写空占位。
- **多语言默认开启**：Bundle 在 manifest 缺少 `languages` 时自动按 `languages.auto=true` + CN/EN 生成页面字典并强制 `LangName` 闭环；只有显式 `languages=false` / `{disabled:true, reason:"…"}` 才关闭，关闭原因写入审计。多语言是默认能力，不是可选项。
- **按钮族固定参数（IconButton / Button / StatusButton）**：`PageName`、`IOVisible`、`IOCommand`、`IOEnable` 四个运行时参数无论能否取到来源都恒写，取不到时写空字符串值（merge 时保留工程师已有真实值）；`IconButton` 的 `Icon`/`IconWidth`/`IconHeight` 同样恒写：有图标槽位时取**图标图形节点自身 bbox**（映射字段 `iconSize`，四舍五入取整，不是控件宽高），无图标槽位时写空字符串；`Button`/`StatusButton` 模板不含图标字段，不发射 `Icon`、`IconWidth`、`IconHeight`。映射带 `Icon` 却没有 `iconSize` 时生成器直接失败，禁止猜图标尺寸。
- **模板匹配键**：组件族匹配使用“组件集名 + 公开属性名 + 真实属性值”。设计稿里的图层名称只用于核对，不参与匹配（**底部栏除外**：底部栏实例的属性里没有变体信息，按 `layoutRules.bottomBar.match` 登记的组件名匹配，见《页面壳层 Layout 映射规范》）；历史上按“父节点语义”分流的表已作废（映射表里没有这类字段；右栏可直接放置的独立组件由 `rightSidebarComponentTemplates` 按组件集名匹配，如 `右侧栏-左右结构-icon+文案`）。变体登记 `componentSet` 时，解析先用公开属性值命中变体，再用变体内部实例的组件名交叉核对；两者不一致**直接失败并要求重新核对**，不静默选边（`resolve-mtslg-template-mapping.js` 按此实现）。
- **图标尺寸来源**：`IconWidth`/`IconHeight` 取页面图标映射中几何来源节点（`sourceRef`，缺失时回退 `sourceId`）的 bbox；右栏这类带图标槽位的按钮，图标来自 `实例` 属性指向的图标节点；空占位虚线框视为没有图标。
- **图标几何补充来源（extractSvg 去重）**：`extractSvg` 只输出 PATH 自身的 `d` + `transform`，几何完全相同的复用实例会被去重（同一方向图标经组级 `rotate`/`flipV` 复用时只返回一条），因此会出现「按钮有图标槽位却没有 `Icon`」。补齐办法：`gen-mtslg-page-icons.js` 追加第 4 个参数（`dsl.snapshot.json`），图标映射条目加 `"fromDsl": true`（按 PATH 原始 `d` + 自身 matrix 合成，与 extractSvg 等价并平移到原点）；需要区分方向时再加 `"bakeAncestorTransform": true`，把祖先 `rotate`/`flipH`/`flipV` 烘焙进坐标。烘焙结果必须视觉复核；同一组图标在 DSL 里几何完全相同（如「向左」与「向右」）时属于设计侧缺图，标记待确认，不得自行镜像猜测。
- **设计稿最上方示例标题默认剥离**：位于根节点或展示外壳、仅用于说明组件或工件示教的标题标记为 `design-artifact-title`，不写入页面 XML。业务内容容器内部且运行时需要的标题才保留。
- **设计稿像素直传（归一后）**：`Left = pageAbsX − parentPageAbsX`，`Top = pageAbsY − parentPageAbsY`，Width/Height 原样；`TextBlock` 例外：`Height` 固定 `40`、`Width` 固定 `NaN`。目标画布尺寸必须与第 1 节适配记录一致；不允许从固定分辨率、截图缩放或其他页面推断。
- 允许小数与负数；`NaN` 表示自适应（根节点四属性均为 `NaN`；叶子无宽高时省略属性）。具体数值必须来自当前实例的 MasterGo bbox。
- 子控件坐标相对**父容器左上角**；父容器与子控件的坐标关系必须由唯一 MasterGo 父子链和 bbox 计算。
- 当完整 DSL 的根节点或对应容器节点的 `overflow` 属性为 `hidden` 时，必须保留外层布局容器及其 `Width/Height` 裁剪边界，内部子控件继续使用相对父容器坐标。该规则优先于模板中“平级节点”的展开形式。只有 DSL 明确没有裁剪需求时才允许展开为同级节点，且必须保留等价裁剪边界。
- 无 Viewbox、无缩放、无星号数学、无"三类固定不缩放"——`gen-iocontrol-xml.js` 全自动完成，禁止手工重写坐标。
- 取数后先核对完整 DSL 根节点 `dsl.nodes[0].layoutStyle.width/height` 与已确认目标画布尺寸一致。不一致或根节点尺寸缺失时先与用户确认页面区域，不能继续生成。

## 4. ControlType 摘要（完整表见 mtslg-iocontrol-map.json）

| 类别 | ControlType |
|---|---|
| 容器 | View（页签，Value=标题/Index/Icon）、GroupBox（Header）、Border（Value=线宽）、ButtonGroup（内放 RadioButton 共用 IOName）、TabControl+TabItem |
| 文本/输入 | TextBlock、TextBox（Keypad）、NumberBox（DecimalPlaces 默认 3）、IntNumberBox、CheckBox |
| 按钮 | Button（PageName="Jump:X"/IOName/IOStyle）、IconButton（Icon=Geometry 键/TopLeftContent=F1..F12）、StatusButton（IOState 状态色）、Togglebutton、RadioButton |

按钮族（IconButton / Button / StatusButton）另有固定参数：`PageName`/`IOVisible`/`IOCommand`/`IOEnable` 恒写（取不到写空字符串值）；`IconButton` 的 `Icon`/`IconWidth`/`IconHeight` 同样恒写——有图标槽位时按图标图形节点 bbox 四舍五入发射，无图标槽位时写空字符串，`Button`/`StatusButton` 不含图标字段、不发射这三项；详见飞书组件库映射规范的“固定字段与可选字段规则”。
| 选择 | ComboBox（选项=子 TextBlock；ItemsSourceFile/DisplayMemberPath/SelectedValuePath） |
| 数据 | DataGrid（Value=数据文件名；列=子 TextBlock/ComboBox）、ProgressBar、RangeProgressBar、PowerControl（实时功率曲线） |
| 视觉/设备 | Image（Value=绝对路径）、Camera（DesignPanelID）、AutoCutCamera、HighAngleCamera、LowAngleCamera、EMTCamera |

控件属性允许集与每类控件的固定必写字段集分别在同目录 `mtslg-iocontrol-map.json` 的 `controlTypes` 与 `controlTypeRequiredAttrs`；生成器不得把白名单外属性当作合法字段，也不得漏发必写字段（取不到来源写空字符串）。Style、Icon、LangName 与 PageName 还必须通过第 6 节键查证。资源字典是否共享、资源键来自何处，均由项目适配记录确认。

### 4.1 DataGrid 的 Value 数据源门禁

- `ControlType="DataGrid"` 必须声明 `Value`；该值用于定位 PageData 数据文件。
- 最终页面中的 `Value` 必须是非空、可由当前运行配置解析的数据文件名。若真实数据源尚未确认，应将该控件标记为“待绑定/未完成”并向用户确认，不能把空值当作最终配置。
- 缺少 `Value` 时的运行时行为必须通过目标项目的控件契约或实际验证确认；若目标运行时要求该字段，缺失即视为未完成，不能作为最终交付。
- `Value=""` 仅可作为经用户确认的诊断中间态；最终交付必须填入可解析的数据源，或明确标记待绑定。
- 子列结构、数据源字段和错误表现均以目标项目 DataGrid 契约为准；不能从其他项目的页面或异常信息推导。

```xml
<IOContorl
    ID="MX_ExampleGrid"
    ControlType="DataGrid"
    Value="ExampleData.xml"
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

   匹配结果（ID 或位置）**同时**作为新节点的插入锚点：经位置匹配的既有容器可以直接承接新增子级，不需要先给现有 XML 补 ID。
2. **几何更新**：Left/Top/Width/Height 按映射更新（这就是设计稿改动的落点）。
3. **ControlType**：按映射更新，变化写冲突报告。
4. **业务属性保护**：现有 XML 同名的属性一律保留现有值（值不同 → 冲突报告，不覆盖）；映射多出来的属性 → 追加（新增报告）。工程师手写的 IOName/IOCommand/IOState 等永远不会被设计稿冲掉。**例外**：映射节点的 `valueSource=dsl.text` 时，`Value` 是设计文本，merge 强制按映射覆盖并写“设计文本覆盖（dsl.text）”报告——否则 provenance 校验（`Value` 必须等于 `sourceText`）会失败。
5. **节点增删**：映射里的新节点渲染插入父容器闭合标签前。插入锚点取**本次匹配命中的既有父节点**（ID 命中或 ControlType+坐标位置命中都算），因此无 ID 的既有容器也能承接新增子级；**例外**：父节点在现有 XML 里是自闭合标签（`<IOContorl ... />`，没有成对闭合标签）时直接失败——先在现有 XML 里把该节点改成容器形式再 merge，不得把按父节点相对的 `Left/Top` 静默落到页面根级；页面根没有 `</IOContorl>` 闭合标签（自闭合根/空文件）时同样失败。现有但映射未涉及的节点原样保留（报告列出）。
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
2. 建映射：先套用公共栏边界表并归一 bbox，再写 DSL 节点 → 映射 JSON（`ref`/`id`/`controlType`/`parent`/`layoutParent`/pageAbsX/pageAbsY/w/h/attrs）；公共栏节点保留审计记录但不进入页面映射。`parent` 与 `layoutParent` 都是**输出父节点**的登记位，取值优先级为 `layoutParent` → `parent` → DSL `sourceParent`，发射器与坐标门禁按同一优先级取原点。该 ref 必须是**已发射的输出节点**（同时是 `mapping.nodes` 的 ref 且 `sourceNodes` 里有同名 bbox 记录）或页面根（`null`/`rootRef`）：这条条件由发射器 `gen-iocontrol-xml.js` 在发射时强制（指向未发射节点即直接失败），并由 `validate-iocontrol-provenance.js` 对既有 XML+mapping 独立复检；bundle 坐标门禁不重复实现该条件，只按同一优先级取原点。新增子树只以「子树根」为单位插入页面，输出父节点自身也是本次新增节点时，其子节点随父块递归发射，不再单独插入。
3. Group 语义用 `classify-mastergo-groups.js` 的 role，再经 `mtslg-iocontrol-map.json` roleMap 定 ControlType；不得用相机/按钮实例在有效相机组件外重复搭建内部控件。
4. `gen-iocontrol-xml.js --merge <现有XML> <mapping.json> --out <已确认页面输出路径>` → 读 merge 报告，逐条裁决冲突。报告固定输出到 **stderr**（`--- merge 报告 ---`，含冲突/设计文本覆盖/新增属性/几何更新/新增节点/未涉及节点六类清单，逐条点名节点 ref）；stdout 只输出产物路径（带 `--out`）或 XML 本体（不带 `--out`，便于管道）。
5. `check-iocontrol-coords.js --xml <产出> --nodes <节点表>`：0 MISMATCH / 0 EXTRA。
6. 执行第 6 节键查证门禁，处理全部未核验键。
7. `sync-to-mt.ps1` 按适配记录同步到唯一已确认的运行配置目录；同步前强制备份。
8. 在目标运行宿主中切到目标页，执行已确认的页面重载动作，再截图核对（第 8 节）。
9. 通过后留档：记录页面源文件、设计链接、边界表、映射、验证证据与待人工项；版本控制提交由用户决定。

### 7.3 路径 B：新建页面（可选）

1. `gen-iocontrol-xml.js --fresh <mapping.json> --out <Name>Page.xml`（根节点自动生成 NaN 骨架）。
2. **页面注册固定模板**：目标项目存在 Layout 时，按其已确认注册结构添加页面 Target 与菜单入口；目标项目缺少 Layout 时，按 `feishu-layout-mapping.md` 的正式模板创建 Layout 文件，并仅写入已确认字段。示例模板：`<Page Target="{target}" LangName="{page_title_key}"/>`；菜单项只有在 `PageName="Jump:{target}"` 等字段已有项目证据时才填入。改写已有文件前备份；新建文件记录为新产物。
3. **语言键**：在目标项目要求的每种语言资源中成对添加 `{page_title_key}`；语言文件的编码、重载与重启要求以适配记录为准。
4. 坐标核对 → 同步 → 执行目标项目已确认的重载动作。
5. **风险闸**：Target→文件名映射部分在闭源代码，首次必须人工验证加载；失败则回退「改现有页面」路径并报告。

## 8. 验证方法

静态（生成后立即）：
- `check-iocontrol-coords.js`：0 MISMATCH、0 EXTRA（容差 0.5px）。
- 键白名单校验（手动/生成器报告交叉核对）。
- XML 可解析、无重复 ID、根节点 NaN 正确。

运行时（目标项目重载动作 + 截图）：
1. 切到目标页，执行适配记录中的重载动作，并等待目标项目完成加载。
2. 使用 `cap-window.ps1` 或目标项目认可的截图方式，传入已确认的运行宿主与输出路径。
3. 坐标换算：以适配记录中的目标客户区尺寸为基准；若运行时存在缩放，记录客户区原点与缩放系数后再逐区比对。
4. 按 DSL bbox 裁剪关键区逐区对照；没有可视化通道时，可用像素采样、ASCII 粗渲染、UI Automation 或间隔截图像素差异确认页面稳定性与关键控件位置。
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
