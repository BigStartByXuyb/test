---
name: mastergo-to-wpf
description: 当前将明确要求的 MasterGo 设计稿转换为 MTSLG IOContorl XML，并按正式组件库实例和目标项目规范生成完整页面；MW WPF 作业 A 资料暂不启用。仅在同时包含 MasterGo 设计来源与 MTSLG 转换/生成意图时触发，不用于单独修改 XML、排查 Ctrl+R、普通 WPF 调试或单独讨论 MTSLG/IOContorl/API/代码索引。
---

# MasterGo 转 MW 代码

本 Skill 文档保留 `mw-wpf` 和 `mtslg-iocontrol` 两套适配器资料，但当前版本只启用 `mtslg-iocontrol` 路线。作业 A（MW WPF）暂不进入触发、分流或生成流程；除非后续明确重新启用作业 A，否则任何当前任务都只按作业 B 处理。当前启用路线没有目标项目时创建 MTSLG IOContorl 项目脚手架；有真实目标项目时直接读取其 `framework.config.json`、`.csproj`、现有页面、资源、Layout 和项目本地索引，完成正式接入和运行时交付。缺少目标项目事实时可以继续静态映射和脚手架生成，但必须停止运行时交付验证并明确标记未完成。

## 触发边界

必须同时满足：

1. 有 MasterGo 设计来源：链接、`fileId + layerId`、设计稿截图或结构化节点；
2. 用户明确要求转换/生成 MTSLG IOContorl XML 或完整 MTSLG 页面。

仅出现以下内容时不要触发：单独修改已有 XML、单独排查 `Ctrl+R`、普通 WPF 调试、单独讨论 MTSLG/IOContorl API、单独维护组件库或代码索引。

## 开始前门禁

### MasterGo MCP 一次性读取门禁（强制）

凡触发本 Skill 的 MasterGo 转换任务，第一步必须检查当前会话已暴露的工具和已配置的 MCP，并强制使用 MasterGo MCP 的一次性 `getDsl` 读取当前 `layerId` 下的完整页面或容器。如果Mcp不存在，则需要强制去优先安装MasterGo对应Mcp，随后读取优先级固定如下：

1. 首选 MasterGo MCP 的 `getDsl`，传入当前任务的 `fileId`、`layerId` 和 `format=json`，一次返回完整 DSL；不同客户端可能为工具增加服务前缀，必须按当前会话实际暴露的完整工具名调用。
2. 完整页面或容器转换只允许使用这一次 `getDsl` 响应作为设计数据源；不得调用分段总览接口，不得拆分请求，不得用多个局部响应拼接页面。
3. 只要 MasterGo MCP 可调用，DSL、图标路径、字体、样式、元数据和节点层级都必须从这次完整响应中读取；不得先用浏览器页面、截图、网页搜索、Accessibility Tree 或视觉猜测替代 MCP。
4. 如果当前会话没有可调用的 `getDsl`，只检查已配置的官方 MasterGo MCP 服务（包括 `@mastergo/magic-mcp`）是否暴露该接口；仍不可调用时停止本次转换并报告原因。
5. 如果一次性 `getDsl` 返回错误，停止本次转换并报告原因；不得改用其他设计数据接口、浏览器或截图继续生成。
6. `extractSvg` 只能作为一次 `getDsl` 成功后的独立图标资源解析步骤，用于生成页面 Icon；它不得读取、替代或补充页面结构。页面生成必须继续走本 Skill 的单响应 DSL capture 和适配器 Bundle 流程。
7. **调用方式固定（防止整页 DSL 进入上下文）**：必须通过 `scripts/call-mastergo-mcp.js` 调用 `getDsl`、`extractSvg` 及其他 MasterGo MCP 工具，响应**只落盘**（约定 `<runDir>/getDsl.json`、`<runDir>/extractSvg.json`），脚本 stdout 只保留一行摘要（工具名、路径、字节数）。**禁止**把整页 DSL/SVG 原文放进模型上下文、回复正文或日志；引用设计数据时只允许给条数、字节数、哈希等摘要信息。在会话里直接调用 MCP 工具导致整页 DSL 进入上下文，视为违反本门禁。

先判断交付目标：

- **结构映射稿**：当前只接受 MTSLG IOContorl 结构映射；用户要求 WPF/XAML 时，作业 A 尚未启用，必须先报告当前版本不执行该路线。当前 MTSLG 结构映射未提供目标项目时，按正式映射表生成结构、节点、槽位、来源和坐标；运行时绑定与资源键写入待确认清单，不得用猜测值补齐。
- **项目运行时交付**：用户要求替换/部署/加载页面，或要求报告可运行、Ctrl+R、视觉一致时，才执行以下目标项目门禁：
  1. 读取并确认目标项目 `framework.config.json`、`.csproj`、项目本地索引和已确认的路径绑定/框架 Profile；不得依赖某个未安装的专用扫描工具。
   2. 当前版本固定选择 `mtslg-iocontrol`；作业 A `mw-wpf` 暂不触发。目标项目 `framework.config.json` 若声明 `mw-wpf`，停止并报告当前路线未启用，不得改执行 WPF，也不得生成混合产物。
  3. 确认框架源码、索引、组件库、真实页面样例和输出目录。
   4. 按 MTSLG 页面宿主确认公共外壳边界。顶部栏/底部栏默认不写入页面 XML；设计稿包含页面壳层且目标项目需要页面注册或菜单时，已有 `Layout.xml` 按其真实结构增量注册；目标项目声明了 `layout_file` 但文件不存在时，按 `feishu-layout-mapping.md` 的正式模板新建该文件。不得因缺少既有 Layout 阻塞已确认页面生成，也不得从其他项目复制 Layout 结构或运行时字段。

当前 MTSLG 交付中，组件只要命中正式映射，就必须按映射生成。未命中的组件不得降级为通用控件或近似控件；应将该组件的真实 DSL、坐标和 provenance 保留在待绑定清单中，并继续生成其他已命中映射的页面节点、Icon 文件和 Layout 注册。只要存在未映射组件，就不得宣称完整可运行页面；交付报告必须明确列出未映射组件和运行时未完成项。

## 映射表优先级与适配层级

正式组件映射表是“组件结构”的最高优先级。匹配键优先为“独立组件集名称 + MasterGo 公开变体/属性名 + 真实属性值”；只有设计明确存在父子组合关系时才使用“父节点语义 + 公开属性名 + 真实属性值”。组件集 ID、实例 ID、图层名称和截图外观只用于追踪或辅助读取，不能替代匹配键。

按以下层级执行：

1. **正式映射表**决定 `ControlType`、`Style` 槽位/语义类别、节点数量、父子关系、槽位顺序和固定属性；不据此虚构具体资源键。
2. **目标项目源码/真实页面/键索引**决定已登记的 `Style`/`Icon` 资源键和其他运行时字段；固定模板中存在的 `IOName`、`IOCommand`、`LangName`、`IOEnable`、`IOState`、`PageName` 等字段没有可靠来源时保留对应 XML 属性并输出空字符串值；不在固定模板中的属性不新增，不填猜测值。
3. **MasterGo DSL**为映射槽位提供真实文本、实例属性、图标来源、尺寸和逐级坐标。
4. 图层名称、组件名称和视觉外观不得触发额外推断；没有映射的组件不得静默改成 `Button`、`Border`、无类型容器或其他近似控件。

当前 MTSLG 结构映射稿与运行时交付使用同一条生成链路：目标项目缺失时仍必须创建完整 IOContorl 脚手架，并生成与正式运行结构一致的 `.csproj`、`framework.config.json`、页面 XML、页面 Icon、Layout 壳层和 mapping/provenance。固定模板中已经声明的可选运行时属性，映射清单缺少来源时必须显式写成空字符串值，并在 mapping/manifest 中标记待配置；不在当前固定模板中的属性不新增，尤其是没有 Icon 槽位的变体不得写 `Icon=""`。只有项目引用、真实运行时资源、可编译宿主和加载验证都通过后，才能称为“完整可运行页面”。

### 空项目脚手架模式

没有目标项目时，当前只创建 MTSLG IOContorl 项目脚手架，沿用 DSL、可见性、组件映射、文本审计、XML、Icon、Layout 和 provenance 生成链路；必须创建 `.csproj`、`framework.config.json`、页面 XML、页面 Icon、Layout 和 mapping/provenance 目录。脚手架中的运行时程序集、业务字段、资源键和目标绑定只能留空或标记待配置，不得猜写。该模式生成完整文件结构，但不执行编译、宿主加载或真实运行时验证；有真实目标项目后再复用同一结构补齐运行时资料并验证。

## 适配器选择门禁（必须先完成）

在读取任一适配器专用参考、样例或脚本前，必须确认当前版本只执行作业 B；作业 A 资料仅保留供未来启用，不得进入当前任务。当前分流固定为：

1. 当前任务统一记录 `Adapter: mtslg-iocontrol`；用户要求 `mw-wpf` 或目标配置声明 `mw-wpf` 时，停止并报告作业 A 尚未启用，不得改执行其他路线。
2. 当前 MTSLG 任务不根据“WPF”、图层名称、目录名、截图或控件外观改写适配器；不得同时执行两条作业或生成混合产物。
3. 目标项目配置路径无效、模式不明或运行时事实不足时，按 MTSLG 静态映射规则标记待确认；不得借用 WPF 规则补齐。

当前启用的 `mtslg-iocontrol` 是完整项目路线：页面 XML、Icon、Layout、mapping/provenance、项目配置、正式输出目录和该项目要求的宿主壳共同构成完整交付；不得把它描述成“只生成 XML”或“依赖未来 WPF 路线的附属产物”。

## 作业 A：MW 框架 WPF（`Adapter: mw-wpf`，当前暂不启用）

本节保留未来 MW WPF 路线的参考内容，但当前版本的全局门禁不会进入本节，也不会因为用户提供 WPF 目标而自动启用本节。重新启用作业 A 前，必须单独完成适配器分流、输出目录、页面壳、Icon 和验证流程的全篇复核。

新增独立 MW WPF 页面时，先按本作业读取项目适配与 MW WPF 参考文档，形成页面清单，再使用 scripts/gen-mw-wpf-page.js 生成固定的 View、View.xaml.cs、ViewModel 和 csproj 注册。清单可显式提供 `viewPath`、`codeBehindPath`、`viewModelPath`；未提供时按 `.csproj` 同区域 View/ViewModel 声明、项目目录证据、最后的 `Pages/` 兜底顺序解析，绝不为同一页面生成两套目录。若 MaxWell SSD 页面需要一个负责加载 MTSLG 页面 XML 的 WPF 宿主壳，必须改用作业 B 的 bundle 入口；作业 A 单独生成的 WPF 页面不得猜写 IOContorl 控件。页面控件、文本、坐标、Style、协议绑定、页面 XML 和 Icon 仍必须分别依据项目事实源、MasterGo DSL 与对应生成器完成。

1. 核对真实 MW 控件源码、现有 WPF 页面、Style/Resource 键、Geometry 资源和页面宿主。
2. 先读 `references/adapters/mw-wpf/mw-wpf-framework.md`；再按命中的控件、资源或协议按需读 `references/adapters/mw-wpf/framework-manual/` 下对应的 controls、resources、protocols 或 scenarios 文档。不得预读 MTSLG 映射或 XML 文档。
3. 生成目标项目约定的 XAML、C# UserControl/ViewModel 与资源；直接使用项目真实的 MW 控件和协议，例如 `s:IconButton`、`MainButtonStyle`、`PageName`、`s:Action`、`IOEnable`。
4. 验证命名空间、资源键、绑定、编译和 WPF 页面加载。禁止以普通 WPF 控件替代已有 MW 能力；先用 `scripts/discover-mtslg-page-icon-map.js` 从当前页真实 PATH/SVG 生成页面级候选及未映射审计，再由 `scripts/gen-mtslg-page-icons.js` 发射已确认或页面内唯一的临时 Geometry 键，页面只引用自己的 Geometry 键。

本作业不得生成 MTSLG `IOContorl` XML、MTSLG `Layout.xml` 注册或调用 MTSLG provenance 校验器。

## 作业 B：MTSLG IOContorl（`Adapter: mtslg-iocontrol`）

`mtslg-iocontrol` 路线需要生成完整页面项目时，使用 `scripts/gen-mastergo-page-bundle.js` 作为总入口；适配器仍记录为 `mtslg-iocontrol`。Bundle 生成的项目文件、页面 XML、Icon、Layout、mapping/provenance 和目标项目要求的 WPF 宿主壳共同组成这条完整路线的交付物。宿主壳只负责加载 MTSLG 页面 XML，不是第二套 WPF 业务页面适配器，也不得在其中猜写 WPF 业务控件或把 WPF 私有协议写入 IOContorl XML。

### MTSLG 页面入口分流（必须先判断）

- **修改现有页面**：读取目标项目实际生效的 XML，使用 `gen-iocontrol-xml.js --merge <existing.xml> <mapping.json> --out <confirmed-output.xml>`；保留工程师已有的 IOName、IOCommand、IOEnable 等业务属性，并处理 merge 报告中的冲突。映射节点 `valueSource=dsl.text` 时 `Value` 属设计文本，merge 会强制按映射覆盖（否则 provenance 校验必然失败），这类覆盖单独列在“设计文本覆盖（dsl.text）”报告里，需逐条确认。不得对现有页面使用 `--fresh`。
- **新建页面**：使用 `gen-iocontrol-xml.js --fresh <mapping.json> --out <new-page.xml>`，随后按已确认的 Layout、语言键、Icon 和宿主路径完成注册。不得把不存在的页面伪装成 merge。
- `gen-mastergo-page-bundle.js` 是页面项目生成的唯一正常入口；它的页面 XML 步骤是 `--fresh`，新建页面目标文件已存在时默认停止并报告冲突。只有用户明确要求替换已有页面、manifest 设置 `operation=replace-existing` 且显式传入 `--overwrite` 时，才允许整套替换并备份。现有页面的业务修改仍必须优先走 `--merge` 主路径；只有 Bundle 被错误或环境阻塞时，才可按阻塞步骤单独调用子脚本。
- Bundle manifest 必须提供 `svgPath`，并指向 `getDsl` 成功后按需执行 `extractSvg` 保存的 JSON；没有运行时 Icon 时也提供合法的 `{ "svgs": [] }` 文件。
- 新建页面的 mapping 必须由当前 DSL 在本次生成中创建，并带有中文 Tag `新页面完整DSL映射`；该 mapping 是当前页面的专属产物，不作为跨页面共享参考。修改已有页面仍按 `merge` 流程保留运行时业务属性。

1. 先读 `references/adapters/mtslg-iocontrol/mtslg-mode.md`；再读取 `feishu-component-library-mapping.md` 和 `mtslg-iocontrol-map.json`，核对正式组件映射、XML 属性白名单、现有 IOContorl 页面、Layout 与页面宿主。设计稿包含顶部栏、底部栏或快捷键，或本次需要创建/修改 Layout 注册时，必须再读 `feishu-layout-mapping.md`；未触发页面壳层或 Layout 注册时不读取该文件。不得读取 MW WPF 控件协议作为 XML 事实源。
2. 生成真实 `IOContorl` XML、逐节点 mapping/provenance 和必要的 Layout 注册；`ControlType`、固定组件层级和槽位首先使用正式映射表。目标项目已确认的字段按事实填写；固定模板中存在但缺少可靠来源的 `IOName`、`IOCommand`、`LangName`、`IOEnable`、`IOState`、`PageName`、`UserRightId` 等保留属性并输出空字符串值，不删除整个节点；不在模板中的属性不新增。使用 `scripts/gen-iocontrol-xml.js` 发射 XML；先发现当前页面 PATH/SVG 候选，再由 `scripts/gen-mtslg-page-icons.js` 生成当前页面的 Icon 文件。Icon 资源名优先使用中文语义对应的英文键；无法形成可靠语义名时才使用当前页面内唯一的临时键。临时键必须写入 mapping/manifest，不能使用 `MGIcon_<layer-id>`，并必须保持页面内唯一。Layout 只引用该页面 Icon 文件中已生成的键。
   - 新页面默认禁止覆盖页面 XML、Icon、View、ViewModel 或审计文件；同名目标存在时停止并要求确认。用户明确要求替换时，必须使用 `operation=replace-existing` + `--overwrite`，并为所有被替换文件保留备份。Layout 仍由 `gen-mtslg-layout.js` 负责增量追加；已有同名 `Page Target` 默认停止，用户明确要求替换并传入 `--overwrite` 时才定点更新并备份。
   - 页面可以没有任何运行时 Icon。PATH/SVG 候选只是来源审计；只有 IOContorl 节点或 Layout 菜单实际引用的 Icon，才必须在当前页面 Icon 文件中存在对应 Geometry 资源键。
   - **Layout 必须先完成映射清单，再生成 XML。** 读取完全部 MasterGo DSL 后，按 `feishu-layout-mapping.md` 生成 Layout manifest；已命中的底部栏组件必须生成对应的 `menuItems`。当前固定模板声明的运行时字段缺失时写入空字符串并标记待配置；没有声明的字段不新增，不能因此把整个 `Menu` 留空。`layoutStatus`、`layoutEvidence` 和数量一致性由 `gen-mtslg-layout.js` 强制校验；校验失败表示“清单不完整”，不是拒绝生成页面，补齐清单后重新运行即可。
   - 顶部栏 `HeaderItem` 的运行时 `Id/Target` 仍须来自目标项目事实源；无法确认时单独标记待确认，不得用顶部文字或图标名称猜写。页面中间的 `主菜单button` 也不因存在 F 键就自动写入 Layout，只有正式 Layout 映射命中时才写入。
3. 在 XML 结构检查前运行 `scripts/validate-iocontrol-provenance.js`；需要独立坐标检查时以节点数组调用 `scripts/check-iocontrol-coords.js`，有 Geometry 时调用 `scripts/scan-icon-coords.js`，再执行宿主加载与视觉核对。

本作业不得写入 WPF 私有协议，例如 `s:Action`、WPF `PageName` 或 WPF ResourceDictionary/绑定语法；没有正式映射时不得降级为普通 Button、无类型容器或静态占位结构。未映射组件仅进入静态来源清单，不进入伪造的 IOContorl 节点。

## 页面 Icon 文件（当前 MTSLG 路线）

每个页面使用自己的 Icon 文件，文件名固定由页面 `name` 派生为 `Resources/Pages/{name}/{name}Icons.xaml`，与页面 XML 同处该页专属目录；View 只能引用本页面的该文件。新页面不得复用或覆盖其他页面的 Icon 文件。`gen-mtslg-page-icons.js` 只负责创建当前页面的新 ResourceDictionary，目标文件已存在时失败，不执行 Icon 合并。

`extractSvg` 只返回 PATH 自身的 `d` + `transform`，**几何完全相同的复用实例会被去重**（典型场景：同一个方向图标被旋转/翻转复用，例如「向上/向下」只差组级 `flipV`、「向左/向右」只差组级 `rotate`），因此某些方向按钮拿不到条目，页面就会出现「有图标槽位但无 Icon」的节点。补救方式：给 `gen-mtslg-page-icons.js` 传入第 4 个参数（DSL 快照路径 `dsl.snapshot.json`），并在页面图标映射里把这类条目写成 `"fromDsl": true`：

- 默认只合成「PATH 原始 `d` + PATH 自身 `matrix`」并平移到原点，与 `extractSvg` 的输出等价；
- `"bakeAncestorTransform": true` 时额外把祖先节点的 `rotate` / `flipH` / `flipV`（绕各自盒子中心）烘焙进坐标，用于区分只靠组级变换区分的方向图标；
- 该模式属于几何推断，交付前必须做一次视觉核对；如果同一组图标在 DSL 里几何完全相同（例如「向左」与「向右」完全一致），说明设计侧缺少独立图形，应标记待确认并要求设计补图，不得自行镜像或猜测朝向。

每个页面必须单独维护一个 Icon 文件。转换时先从当前页 MasterGo PATH/SVG 自动发现候选；图标映射输入逐项提供目标项目已确认或页面内生成的英文资源名、中文注释名和 DSL 来源，禁止从图层 ID、坐标或几何外观直接拼出 `MGIcon_<layer-id>` 形式的资源名。资源名必须是英文标识符且在当前页面唯一；重复名称由生成器按稳定数字后缀处理。没有目标项目键时，允许使用页面内唯一的临时 Geometry 键，状态标记为 `provisional` 并保留 sourceId/sourceRef。只有未被任何实际 Icon 槽位引用的 PATH 候选才进入 `candidates/unmapped` 而不进入 XAML。XAML 注释只写中文名称，溯源和 `keyStatus` 写入 mapping/manifest。`mw-wpf` 的页面以 `StaticResource` 引用该页 Geometry；`mtslg-iocontrol` 的 Layout 仅引用该页 Icon 文件中已生成的键。

## 页面多语言文件（当前 MTSLG 路线）

每个页面一套语言字典，落在该页自己的目录：`Resources/Pages/{name}/{name}_{LOCALE}.xaml`（默认 `CN`、`EN`，与页面 XML、页面 Icon 同目录）。由 `gen-mtslg-page-lang.js` 发射，Bundle 通过 manifest 的 `languages` 字段驱动；**多语言是默认能力，不是可选项**：manifest 未提供 `languages` 时 Bundle 自动按 `languages.auto=true` + CN/EN 生成字典、派生语言键并强制 `LangName` 引用闭环（审计记 `languagesDefaulted=true`）；只有显式声明 `languages=false` 或 `languages:{disabled:true, reason:"…"}` 才会关闭，关闭原因写入审计 `languageDisabled`/`languageDisabledReason`，不得在未声明原因的情况下生成没有 LangName 的页面。

```json
"languages": {
  "auto": true,
  "locales": ["CN", "EN"],
  "translations": "Generated/Home.lang-translations.json",
  "bindByText": true,
  "requireLangName": true,
  "noLangRefs": ["1:42"],
  "keys": []
}
```

**页面语言字典默认自包含**：每个页面的 key 全部由本页机械派生（页面标题 / MenuItem / 页面内容），不读、不复制、不引用目标项目的框架语言字典。因此默认 manifest **不要**写 `keyCatalog`。

`keyCatalog` 是**可选的复用开关**，只有显式配置时才会去读目标项目已登记语言文件（同文案的既有 key 直接复用）。开启前必须确认这三件事，否则默认关闭：

1. 复用的键会把目标字典里的文案**复制进本页字典**，运行时会遮蔽框架字典里的同名键；
2. 目标字典里的既有译文（含笔误）会被原样带进页面，页面不再只反映设计稿；
3. 复用键通常不带页面名前缀，与“一页一套自包含字典”的约定并存时需要额外说明。

只有确实需要跨页面/框架共用同一句文案、并接受上述代价时，才配置 `keyCatalog`（可写顶层 `keyCatalog` 或 `languages.keyCatalog`）；`MaxwellFramework_*` 这类框架级字典默认不纳入复用范围。

### 语言键自动派生（新建页面默认路径）

`languages.auto=true` 时，Bundle 在 XML/Layout 生成前调用 `gen-mtslg-lang-keys-from-dsl.js`，从当前页 DSL/mapping/Layout 菜单项**机械派生** LanguageKey，不再要求调用方逐条登记。派生规则固定、可复现：

1. 页面标题 → `{页面名}PageTitle`，文案取值链固定为：`manifest.pageTitleText`（**可选**的显式覆盖）→ `mapping.textAudit` 里 `role=page-title` 的 `sourceText`（**默认来源**，DSL 机械产物）→ DSL 根节点名 → 页面名。Bundle 与单脚本 CLI 走同一条链，不允许两边不一致；本次实际用到的来源写入审计 `languages.titleSource`（`manifest.pageTitleText` / `mapping.textAudit` / `dslRoot`），不得静默回退后无人知晓。
2. Layout 菜单项 → `MenuItem{名称}`，语义名优先取菜单 `Icon` 资源名去掉 `Geometry` 后缀。
3. 页面内容节点（`valueSource=dsl.text`）→ `{页面名}{名称}`。**同一页面内文案完全相同的节点共用一个 key**（第一个节点派生键名，其余节点登记进该 key 的 `sourceRefs`），不再产生 `Xxx2` / `XxxText02` 这类重复键——同一页面里重复文案直接复用同一个 LanguageKey；只有“不同文案撞出相同语义名”时才用稳定数字后缀。语义名按以下优先级回退：
   1. （**仅当显式配置 `keyCatalog` 时**）目标项目已登记语言字典里**同文案**的既有 key → 直接复用并记为 `scope=shared`；`MenuItem*` 命名空间的键不给页面内容节点复用。默认不配置，页面 key 全部页面内自产。
   2. 节点 `Icon` 资源名去掉 `Geometry` 后缀（IconButton / 带图标按钮天然带英文语义名）。
   3. `langGlossary` 术语表（`{ "中文文案": "EnglishIdentifier" }`，可内联或给 JSON 文件路径）。
   4. 纯 ASCII 文案（`AUX.` → `AUX`）。
   5. DSL 图层英文名（过滤 `Dir`/`F1`/`CH1` 之类的结构噪音）。
   6. 兜底 `{页面名}Text{NN}`：页面内唯一、稳定，标记 `provisional`，必须列入待改名清单。
4. 名称冲突由生成器按稳定数字后缀处理（`HomeStart`、`HomeStart2`），不静默覆盖。
5. **中英文一致的文本不编造语言键**：不含中文且不含英文字母的文本 —— 纯数字、符号、正负步进标签（`+5`/`-1`/`±0.5`）、百分比、版本号、序列号、IP、日期时间、功能键 `F1` —— 在 CN 与 EN 里写法完全相同，一律自动进入 `noLangRefs`，并在审计里逐条给出豁免原因；这类节点只写 `Value`，不挂 `LangName`。例外两条：Layout `MenuItem` 必须挂 `LangName`（菜单名仍会派生 key）；**按钮族（`IconButton`/`Button`/`StatusButton`）带文案的节点一律必须挂 `LangName`，因此 `+5`/`-1` 这类数值按钮也要产键**（CN/EN 文案一致），派生结果记入审计 `buttonFamilyKeys`，不进入 `noLangRefs`。

自动派生结果的交付要求：

- **英文文案由 AI 翻译产出，并以 `languages.translations` 显式落盘**：AI 读取派生出清单里的中文 CN 文案，逐条给出英文译文，写成 `{ "中文文案": "English Text" }`（内联对象或 JSON 文件路径都可）。脚本不做翻译、也不调用机翻服务，只机械套用这份清单，保证译文可追溯、可复核、可回滚。
- **译文清单与术语表是「页面级生成产物」，不是插件固定资产**：每次生成按当前页面的 DSL/mapping 产出，并由 Bundle 同步落盘到该页审计目录 `Generated/{页面名}.lang-translations.json` 与 `Generated/{页面名}.lang-glossary.json`（未提供对应输入时不生成）。禁止把它们做成跨页面共享的固定文件；不同页面的译文与术语各自独立、可逐页复核与回滚。
- 英文取值优先级：**目标项目已登记字典同 key 的英文（工程已确认）> `translations` 译文 > 中文占位**。前两者命中数分别记在 `languages.derivation.translatedFromCatalog` 与 `translatedFromInput`。
- **页面标题文案来源必须逐页核对**：审计 `languages.titleSource` = `mapping.textAudit` 表示标题取自设计稿原文（默认、可信）；= `manifest.pageTitleText` 表示工程师显式覆盖值，交付前必须与 `textAudit` 的 `sourceText` 逐字比对（含空格与标点，不得自行归一化）；= `dslRoot` 表示既没有覆盖值也没有 textAudit 标题，退回的是**设计画板框名**（可能带前缀点、空格差异、版本后缀），交付说明必须单列并要求人工确认。
- 确实没能翻译的条目会保留中文占位并逐条记入 `languages.derivation.pendingTranslations`；交付说明必须单列这份“待翻译清单”，不得把中文占位当已完成翻译交付。
- 数字、符号、编号等中英文一致的文本已在第 5 条豁免，不出现在待翻译清单里。
- `provisionalKeys`（临时键）与 `autoNoLangRefs`（自动豁免）必须在交付说明里列全，供工程师改名与确认；不得因为门禁通过就隐去。
- `languages.keys[]` 显式提供的条目优先级最高：按 `key`、`sourceRef`/`sourceRefs`、`menuIndex` 覆盖机械派生结果。
- 需要人工指定语义名时，优先补 `langGlossary`（文案级复用）或显式 `keys[]`，不要靠改生成器。

```json
"languages": {
  "locales": ["CN", "EN"],
  "bindByText": true,
  "requireLangName": true,
  "noLangRefs": ["1:42"],
  "keys": [
    { "key": "DemoRecipePageTitle", "text": { "CN": "配方管理", "EN": "Recipe" } },
    { "key": "MenuItemRecipe", "text": { "CN": "配方", "EN": "Recipe" } },
    { "key": "DemoRecipeName", "text": { "CN": "配方名称", "EN": "Recipe Name" } }
  ]
}
```

- **LanguageKey 命名约定（强制，与目标项目现有语言文件一致）**：
  - 页面标题 `{页面名}PageTitle`（如 `HomeContentPageTitle`），由 Layout 的 `<Page Target="HomeContent" LangName="HomeContentPageTitle">` 引用；缺少这个 key 直接失败。
  - 菜单项 `MenuItem{名称}`（如 `MenuItemLaserSetting`），由 Layout 的 `<MenuItem LangName="...">` 引用。
  - 页面内容 `{页面名}{名称}`（如 `HomeContentFullAutoOperation`），由页面 XML 内的控件引用。
  - 跨页面共享字典的 key 必须显式写 `"scope": "shared"`，否则按页面内 key 校验前缀。
  - `group` 不写时按上述三类自动推导；XAML 输出顺序固定为 页面标题 → 页面底部菜单名称 → 页面内容。
- `languages.keys[]` 是 `LangName` 的**唯一真值源**：key 必须是英文标识符且页面内唯一；每个 locale 都必须为每个 key 提供文案，缺一个直接失败；生成后逐文件回读校验，保证**各语言文件的 `x:Key` 集合与顺序完全一致**。
- **新生成页面必须挂全 `LangName`**（`requireLangName` 默认 `true`）：设计稿里有文案的控件（`valueSource=dsl.text` 的节点）和带 `Name` 的 `MenuItem` 都必须引用到一个已登记的 key，否则整套生成失败并回滚。错误信息会逐条列出缺 key 的节点/菜单项。
- **按文案自动匹配**（`bindByText` 默认 `true`）：设计稿是中文，LanguageKey 的 `CN` 文案与控件设计文本**逐字相等**时自动绑定并写入 `LangName`，不需要为每个按钮手写 `sourceRef`。同一文案对应多个 key 属于歧义，脚本不猜，直接失败并要求用 `sourceRef` 显式指定。
- 显式引用优先于自动匹配：`sourceRef` 绑定页面节点、`menuIndex` 绑定 Layout `MenuItem`；页面标题由 `{页面名}PageTitle` 直接决定，不需要在 key 上写 `role`。节点或菜单项已有不同的 `LangName` 时直接失败，不静默覆盖。
- 动态值/数量/序列号等**不需要翻译**的文本，必须在 `noLangRefs` 里按 DSL ref 显式豁免，并在交付说明中列出；不得为了让门禁通过而给这类文本编造 key。开启自动派生后这类节点由生成器机械识别并写入 `noLangRefs`，`noLangRefs` 里的显式条目仍会合并保留。
- **引用闭环硬门禁**：页面 XML、Layout `MenuItem`、`<Page LangName>` 中出现的每个 `LangName` 都必须存在于本页语言字典，否则整套生成失败并回滚。没有目标项目键目录时，禁止用未登记的 key 充当占位。
- `LangName` 是附加属性：`TextBlock` 必须**同时**发射 `Value` 和 `LangName`（`Value` 仍按设计文本发射，provenance 要求 `Value == sourceText`），运行时以 `LangName` 为准。**按钮族同样必须有 `LangName`**：带文案的 `IconButton` / `Button` / `StatusButton` 一律挂 `LangName`，不得只发 `Value` 或只发 `Icon`。
- 语言字典里的**英文等非设计语言文案**只能来自设计稿、目标项目已登记字典或 AI/工程师产出的 `languages.translations` 译文清单；生成脚本本身不得做翻译或调用机翻服务，译文必须是可追溯的显式输入。AI 翻译是允许且默认要求的步骤：派生完成后必须为待翻译清单补齐译文，再重新生成页面。

## 页面输出目录

> **全局固定常量：`contentOriginY = 192px`。** 所有 MasterGo 业务页面都必须按 `normalizedY = pageAbsY - 192` 计算；192 不是页面参数、不是可选配置，也不能由单个项目、页面或控件改写。只在页面根级扣除一次，嵌套控件不得重复扣除。

- MW WPF 页面优先写入目标项目 .csproj 已声明的 View/ViewModel 路径，例如 `UI/<区域>/View` 和 `UI/<区域>/ViewModel`；只有项目没有路径证据时，才使用目标项目根目录下的 `Pages/` 作为通用兜底。不得为同一页面同时生成两套 View。
- MTSLG IOContorl 页面必须写入目标项目的实际运行目录，不能默认写入 `Generated/`。输出路径按以下优先级解析：
  1. 有效的 `framework.config.json.pages_root`；
  2. 目标项目 `.csproj` 中已声明的 `Content Include` 页面目录、`Page Include` 图标目录和 `Content Include` 的 `Layout.xml` 路径；
  3. 项目源码、宿主配置和已确认的运行目录共同给出的唯一路径；
  4. 仅在无法唯一确定运行目录，或用户明确要求静态产物时，才使用 `Generated/`。
- **一页一目录（MTSLG 固定约定）**：页面产物按页写入 `Resources/Pages/{name}/`——页面 XML 为 `Resources/Pages/{name}/{name}Page.xml`，页面 Icon 为 `Resources/Pages/{name}/{name}Icons.xaml`；Layout 写入 `Resources/Layout/Layout.xml`。View/ViewModel 仍写入目标项目声明的 `UI/<区域>/View` 与 `UI/<区域>/ViewModel`。目标 `.csproj`/`framework.config.json` 已声明的真实路径优先于本约定。
- 对没有 `framework.config.json` 的新项目，`.csproj` 的路径声明是运行路径证据，不得因为缺少 `framework.config.json` 或既有 `Layout.xml` 就把整套页面降级到 `Generated/`。例如项目声明 `Resources\\Pages\\<页面名>\\*Page.xml`、`Resources\\Pages\\<页面名>\\*Icons.xaml` 和 `Resources\\Layout\\Layout.xml` 时，正式产物必须分别写入这些路径。
- `Generated/` 只保存 mapping/provenance、MCP manifest、图标提取清单、验证脚本和验证结果等溯源/审计文件，不作为 MTSLG 运行时默认加载目录。
- 正式页面或图标文件已经存在时，生成器必须先备份；只有用户明确要求“重新生成/覆盖”时才替换，禁止静默覆盖。新建的 `Layout.xml` 也必须写入项目声明的正式路径。
- 所有输出模式的 MasterGo 业务页面根级 Y 坐标都固定向上归一化 192px，且只扣除一次；顶部栏、底部栏和 Layout Header 不参与该偏移。对 MTSLG，这个归一化值进入 IOContorl 的根级 `Top`；对 MW WPF，它只是页面内容坐标的输入基准，最终 `Canvas/Grid` 等布局属性仍必须由目标 WPF 容器和项目事实确定，不能把 IOContorl XML 的 `Top` 属性直接当成 WPF 布局实现。

## 组件和映射原则

- 使用一份组件语义映射，并按组件登记 `targets.mw-wpf` 与 `targets.mtslg-iocontrol`；正式映射存在时严格按映射表，不得凭外观、Group 名称或截图猜控件。
- WPF 控件、Style、资源和协议以源码/真实页面为事实源；IOContorl 的组件结构和 `ControlType` 以正式映射表为事实源，目标项目运行时资料用于核对属性、资源键和绑定。
- 组件实例优先于原始图层；未登记的业务组合必须标记待确认。
- 未确认的运行时字段只能写入 mapping manifest 或 XML 注释，禁止把“待人工绑定”作为可见 `Value`、伪造 `IOName` 或伪造 `IOCommand`。
- 每个 ControlType 按 `mtslg-iocontrol-map.json` 的 `controlTypeRequiredAttrs` 发射固定必写字段：**属性恒写，取不到来源时写空字符串占位**（`ID`/`ControlType` 恒由节点身份发射，`Left`/`Top`/`Width`/`Height` 恒由 DSL bbox 发射，TextBlock 为 `Width=NaN`、`Height=40`）。按钮族（`IconButton` / `Button` / `StatusButton`）在此基础上恒写 `PageName`、`IOVisible`、`IOCommand`、`IOEnable`；`IconButton` 的 `Icon`/`IconWidth`/`IconHeight` 恒写，有图标槽位时取**图标图形节点自身 bbox**（不是控件宽高）并四舍五入取整，无图标槽位时写空字符串；`Button`/`StatusButton` 不含图标字段，不发射这三项；映射带 `Icon` 却没有图标尺寸来源时生成器直接失败。`LangName` 是唯一例外：只在多语言绑定层给出真实 key 时发射，动态值等 `noLangRefs` 豁免节点不写空占位。组件族匹配使用“组件集名 + 公开属性名 + 真实属性值”，图层名称只作核对、不参与匹配。
- **属性顺序固定（页面 XML 与 Layout 统一）**：`ID` → `ControlType` → `Style` → `Icon` → 文本（`TopLeftContent` / `Value` / `Header`）→ `LangName` → 运行时字段（`PageName` / `IOName` / `IOCommand` / `IOVisible` / `IOEnable` / 其余 `IO*`）→ 控件尺寸（`Width` / `Height`）→ 图标尺寸（`IconWidth` / `IconHeight`）→ 位置（`Left` / `Top`）。Layout 的 `MenuItem` 按同一约定排列：`Name` → `Icon` → `TopLeftContent` → `Index` → `LangName` → `PageName` / `IO*` → `UserRightId` → `IconWidth` / `IconHeight`。`gen-iocontrol-xml.js` 的 `ATTR_ORDER` 与 `gen-mtslg-layout.js` 的 `ATTR_FIELDS` 是唯一真值源，不得按单个页面另排顺序。
- **节点发射顺序按设计稿上下布局（仅页面 XML）**：同一父节点下的子节点按设计坐标 **Top（Y）主序 → Left（X）次序** 发射（坐标完全相同时保持 `mapping.nodes` 原顺序）。作用域是**所有父节点**，不区分横向/纵向容器——理由是 DSL 图层树顺序与画面位置无关，而上下布局容器的子节点顺序决定运行时显示顺序。只改变排列顺序，`ID` / 坐标 / 属性 / 层级关系都不变。排序的唯一真值源是 `gen-iocontrol-xml.js` 的 `sortNodesByDesignOrder()`。
  - **fresh 与 merge 的差异**：排序在读取 mapping 时统一生效，但 merge 只为**新节点**计算插入点、既有节点按原 XML 顺序原样保留，因此 **merge 不会纠正既有节点的排列顺序**；需要整页设计顺序时用 `--fresh` 重建。
  - **不覆盖 Layout**：Layout 的 MenuItem 顺序真值源是 `manifest.menuItems` 数组与 `Index`（`gen-mtslg-layout.js`），不使用本排序。
  - **与"模板槽位顺序"的关系**：正式映射表决定的是模板的**槽位语义**（节点数量、父子关系、哪个槽位对应哪个字段），本排序只决定同一父节点下**节点的发射次序**；两者不冲突——语义由模板与 mapping 固定，次序按设计坐标。出现分歧时以"模板决定语义、坐标决定次序"为准。
- 设计稿中顶部栏、底部栏和其他公共外壳按宿主边界剥离；保留节点统一换算到内容区坐标，并记录被剥离节点。

### 组件内部内容与来源

- 所有适配器都必须读取组件实例的完整 DSL 父子链；组件内部的 TEXT、PATH/SVG、FRAME 只能按已选适配器的正式映射解释，不能因视觉外观提升为独立业务控件。
- 输入框、选择框的 MTSLG 控件类型、40/36/32 变体、内部 padding、TEXT/PATH 归属和 XML 输出模板只在作业 B 读取 `references/adapters/mtslg-iocontrol/feishu-component-library-mapping.md`；总 Skill 不重复维护这些映射事实。


### 文本来源与 Value 绑定硬门禁

- 每个生成的 XML/XAML 文本控件必须绑定到唯一的 MasterGo `layerId`/DSL `ref`，并记录其真实 `sourceParent`、原始文本、文本槽位和最终输出属性；组件实例的 `ID`、语义名称、坐标方向或业务推测不能作为文本来源。
- `Value` 只能使用对应 DSL 文本节点的真实文本或已确认的运行时绑定字段。禁止因为 XML `ID` 含有 `X`、`Y`、`Label`、`Value` 等词，或因为控件位于某个视觉位置，就推断、替换或重命名文本；例如 `RelativePositionXLabel` 不得自动生成 `Value="X"`。
- MTSLG `TextBlock` 的 `Height` 固定为 `40`、`Width` 固定为 `NaN`（宽度自适应，不写文本 bbox 宽度；文本 bbox 宽度只作为 `dslWidth` 记入 mapping 溯源）；`FontSize` 独立取字体事实，不能用文字 bbox、外层组件高度或行高改写这两个固定值。输入框、选择框等非 TextBlock 控件仍按其正式变体模板取自身宽高。
- 同一模板的每个实例必须分别读取文本覆盖和父子层级；相同 `componentId`、相同结构、相邻排列或截图文字不能互相借用。设计稿中的 `3:56338 → 镜头倍率` 与兄弟节点 `3:56367 → Y` 必须保持独立。
- 生成前执行“XML 节点 → 唯一 layerId/ref → 父节点链 → 原始文本 → Value/绑定字段”反向核对；任一项缺失、重复或冲突时，停止生成并标记待确认，不得用语义名称或坐标补齐。

### 坐标转换硬门禁（实例与全部子组件）

- 每个 MasterGo 实例、子实例、Frame、Group 和文本/控件节点都必须绑定唯一的来源 `layerId`（或 DSL `ref`），并单独记录 `sourceParent`、`pageAbsX/pageAbsY`、`relativeX/relativeY`、`Width/Height` 和最终发射的 `Left/Top`；没有来源绑定的节点不得进入最终 XML。
- 页面根级和嵌套节点都必须先解析为各自的 MasterGo 页面绝对 bbox。`pageAbsX/pageAbsY` 是不可变的来源事实；`relativeX/relativeY` 仅用于验证真实父子链，不能在未确认最终输出父子关系前直接复制为 XML/WPF 坐标。
- 即使多个实例拥有相同 `componentId`、相同结构、相同文本或相同变体，也必须分别读取并计算各自实例及其全部子节点坐标；固定模板只决定结构和语义槽位，不决定实例位置。
- 禁止根据文字语义、截图观感、相邻排列、组件模板、其他实例或“应该在这里”的布局习惯推断任何 `Left/Top`。设计稿数据与视觉观感冲突时，暂停并报告冲突。
- 生成前必须逐项核对“XML 节点 ↔ 唯一 MasterGo layerId/ref ↔ 父节点链 ↔ 页面绝对坐标”；语义名称或 `ControlType + 坐标` 只能用于诊断，不能作为最终绑定。

### 绝对坐标输出规则

- 每个最终输出的 IOContorl/WPF 控件都必须由自身 MasterGo bbox 定位；`Left/Top` 不能由父容器尺寸、相邻控件、字体或视觉间距推算。
- 根级节点，或正式映射确认可展平的节点，先按统一页面坐标归一化：`normalizedX = pageAbsX - contentOriginX`、`normalizedY = pageAbsY - 192`，公共外壳偏移只扣一次。MTSLG 将归一化结果发射为 IOContorl 坐标；MW WPF 只能把它作为页面内容坐标输入，再按真实 WPF 容器完成布局。
- MTSLG 中正式映射要求保留父容器的子节点，按该已保留父容器发射相对坐标；根级扣除内容区偏移后，子节点不重复扣除。具体公式、裁剪边界与 XML 示例只读取 `references/adapters/mtslg-iocontrol/mtslg-mode.md`。
- WPF 的最终坐标/布局属性必须由目标页面的真实布局容器决定；不得把 MTSLG 的 XML 坐标规则照搬到 WPF。
- 输出前必须保留“输出节点 ↔ 唯一 layerId/ref ↔ 自身 pageAbs bbox ↔ 输出父节点 ↔ 最终 Left/Top”清单；任一控件缺少自身 bbox 或输出父节点依据时不得交付。

### 来源清单与不可交付门禁

- 生成 IOContorl XML 前必须建立逐节点 mapping manifest；manifest 必须同时包含从原始 DSL 机械提取的 sourceNodes。每条 sourceNodes 记录至少包含 ref、parentRef、pageAbsX/pageAbsY、relativeX/relativeY、width/height 和真实 text（文本节点）；每条输出节点记录至少包含 xmlId、唯一 sourceRef、sourceParent、sourceText（文本节点）、输出父节点依据、expectedLeft/expectedTop/expectedWidth/expectedHeight。当前校验器仅支持输出父节点与真实 `sourceParent` 一致；映射若需改变输出父节点，必须先扩展校验器，不得静默发射。
- 文本节点的 Value 必须机械复制 sourceText；valueSource 必须为 dsl.text。禁止用 XML ID、组件属性名、字段名、坐标方向、视觉位置、模板槽位或业务语义生成 Value。RelativePositionXLabel 不得生成 Value="X"。
- 坐标必须机械计算：MTSLG 根级/展平节点以 `pageAbsX - contentOriginX`、`pageAbsY - 192` 发射；保留父容器的子节点以 `pageAbs - parent.pageAbs` 发射，并且内容区偏移只在根级扣一次；`Width/Height` 必须来自同一 sourceRef 的 bbox。禁止用 ID、相邻节点、截图观感、固定模板或“应该在这里”补坐标。MW WPF 复用同一份已归一化页面来源，但最终布局仍须由目标 WPF 容器确定。
- 坐标空间必须明确：`sourceNodes` 永远保存 MasterGo 原始页面绝对坐标；输出节点的 `expectedLeft/expectedTop` 记录实际发射坐标，而不是替代来源事实。校验器必须用 `sourceNodes`、真实父子链和根级内容区偏移独立重算。
- 生成器必须在写文件前执行 scripts/validate-iocontrol-provenance.js；校验器不得把 nodes 中的 expected 值当作 DSL 事实，必须用 sourceNodes 独立重算。任何 sourceNodes 缺失、UNTRACKED、Value != sourceText、缺少来源字段、父节点缺失或几何不匹配都必须以非零状态失败。验证失败时禁止输出、覆盖或交付 XML。
- 禁止仅凭 XML 可解析、控件数量正确或肉眼看起来接近就宣称完成；必须保留 manifest 和校验输出作为交付证据。无法建立来源链的已映射节点必须停止并标记待确认；未映射组件则保留其来源记录，不得伪造 XML 节点。

## MasterGo DSL 单响应采集流水线（强制）

当任务需要读取完整 MasterGo 页面或容器时，必须先调用一次 `getDsl`，再使用 `scripts/mastergo-dsl-pipeline.ps1` 固化完整响应；禁止把单次响应重新拆成 section，也禁止继续使用分段总览、分段写入、分段合并或失败 section 重试：

1. 从 MasterGo 链接解析 `fileId` 和 `layerId`，调用 `getDsl(fileId, layerId, format=json)` 一次读取完整 DSL，并将 MCP 文本响应保存为一个 JSON 输入文件。
2. 执行 `mastergo-dsl-pipeline.ps1 -Action Capture -InputFile <getDsl.json> -Out <runDir> -FileId <fileId> -LayerId <layerId> -Ui <ui>`。脚本验证根节点、全部递归节点、唯一 ref 和父子链，并生成唯一的 `dsl.snapshot.json`、`manifest.json`、`coverage-report.json` 和 `timing.json`。
3. 只有 `coverage-report.json.status=complete` 且 `duplicateNodeRefs=[]`、`unknownParentRefs=[]` 时，才允许进入组件映射、Icon 发现和 `gen-mastergo-page-bundle.js`。一次性 `getDsl` 没有独立的远端节点总数，`capturedNodeCount` 只表示本地递归解析到的节点数，不得把它当成远端完整性证明。
   - 完全相同的同 ID、同父节点节点允许在 Capture 阶段折叠为一个，并写入 `collapsedDuplicateRefs` 审计；同 ID 但父节点、类型、内容或几何不同仍写入 `duplicateNodeRefs` 并阻断生成。
4. 覆盖校验失败时，停止本次转换并报告重复 ref、缺失 id 或断裂父子链；不得改为分段读取或凭不完整数据生成 XML、Icon、Layout 或 WPF 宿主。
5. 该流水线只负责一次性 DSL 快照的结构完整性和来源保留。当前 MTSLG 页面转换还必须在 `getDsl` 成功后按需调用 `extractSvg`，将响应保存为 `<runDir>/extractSvg.json`；Bundle 清单的 `svgPath` 必须指向该文件。没有可用运行时 Icon 时也必须提供合法的 `{ "svgs": [] }` 输入，不能省略 `svgPath`。随后再执行正式映射、`gen-iocontrol-xml.js`、`gen-mtslg-page-icons.js`、`gen-mtslg-layout.js` 和 `gen-mastergo-page-bundle.js`。

### 可见性事实提取与 AI 映射边界

在组件映射前，对唯一的完整快照运行 `scripts/resolve-mastergo-visibility.js --input <runDir>/dsl.snapshot.json --out <runDir>/visibility.json`。该脚本只机械输出节点的 `explicitVisible`、`effectiveVisible`、`visibilityProperty`、`visibilitySourceRef` 以及 `texts`/`paths` 索引；它不决定组件类型、不命名 Icon、不生成 IOContorl XML，也不替代 AI mapping。

AI 必须同时读取原始 DSL、`visibility.json` 和正式组件映射，按有效可见状态决定每个普通 TEXT、F 文本和 Icon 是否进入 mapping：可见的当前页面文本必须生成，明确 hidden 文本删除；只有页面根级/工件级大标题标记为 `page-title` 时永远删除，组件内部标题、GroupBox Header、表格列标题以及组件库占位文案都按自身可见属性生成。宿主公共栏由结构边界剥离，不作为组件文本删除理由。最终 mapping 必须用 `textAudit` 记录每个 TEXT 的 `sourceRef`、真实文本、可见性、角色、输出决定和 `outputRefs`，再交给 Bundle 生成页面文件。

- `_placeholder=true` 只是 MasterGo 组件库来源提示，不是删除条件。即使正式组件映射把文本标记为 placeholder，只要它属于当前页面或当前组件的可见内容，也必须生成。文本只有在明确属于页面根级 `page-title`、明确 hidden，或已被宿主结构边界剥离为 `host-shell` 时才允许 `decision=omit`。

### 辅助脚本触发矩阵

以下脚本不是每次都由 Bundle 自动调用，而是按场景触发：

- `resolve-mastergo-visibility.js`：组件映射前强制运行；输出所有节点的有效可见性，供 AI 生成 mapping/textAudit。
- 显隐事实只读取当前组件实例的 `componentInfo.properties`；仅当明确的显示槽位属性（如“显示文案”“显示icon”“显示主标题”“显示F”）为布尔 `false` 时隐藏对应槽位。节点自身的 `visible/visibility` 及其他泛化属性不参与当前页面显隐判定。
- `scan-mtslg-keys.ps1`：只有存在目标 MTSLG 运行时目录、需要确认 Style/Icon/LangName/IOName/IOCommand 等键时运行；静态映射没有目标目录时不运行。
- `gen-mtslg-lang-keys-from-dsl.js`：`languages.auto=true` 时由 Bundle 在 XML 生成前自动调用；也可单独运行以预先审阅派生键（`--report` 输出待翻译/临时键/自动豁免清单）。不负责翻译，只做机械派生。
- `classify-mastergo-groups.js`：DSL 中存在未明确语义的 GROUP、容器或组合层级时运行；已由正式组件模板命中的实例不重复运行。
- `scan-icon-coords.js`：Icon XAML 已生成且包含 Geometry 时运行；页面没有 Geometry 时跳过。
- `audit-mtslg-feishu-map.js`：组件映射文档或模板 JSON 修改后运行，用于检查文档覆盖，不是页面生成步骤。
- `cap-window.ps1` / `cap-window2.ps1`：运行时宿主加载成功后做视觉截图验证；不能替代 XML/provenance 校验。
- `sync-to-mt.ps1`：静态 XML、来源、坐标、键和运行时加载验证完成，并且用户要求部署到运行目录后运行；不能作为生成步骤自动调用。
主 Bundle 的固定调用顺序是：模板解析 → 语言键派生（`languages.auto`）→ LangName 绑定 → XML 生成 → provenance/坐标校验 → Icon discovery/生成 → Layout → WPF 宿主 → 最终校验。辅助脚本不得被误认为已自动包含在 Bundle 中。

## 交付和验证

默认交付完整页面，不是截图、占位控件或近似原型。生成后必须按目标模式验证：

- WPF：检查项目引用、Style/Resource 键、命名空间、绑定和原有代码风格，并执行可用的编译/加载验证；
- IOContorl：在 XML 结构检查前，使用 node scripts/validate-iocontrol-provenance.js --xml <page.xml> --mapping <mapping.json> 做 Value/来源/坐标硬校验；非零退出码即停止交付；
- IOContorl：检查 XML 结构、`ControlType`、属性白名单、父子坐标，执行 Ctrl+R 或等价加载验证；
- 两种模式都要做设计稿与运行结果的视觉核对。

## 公共参考（仅在对应条件满足时读取）

- 框架发现、路径绑定和索引：当前 MTSLG 路线直接读取目标项目的 `framework.config.json`、`.csproj`、项目本地 `docs/ai-index/`、源码和现有页面。缺少目标项目事实时只能完成静态映射/脚手架，不能宣称运行时交付验证通过。
- 项目首次适配：`references/project-adapter-initialization.md`；仅在有效 `framework.config.json`、组件目录或资源目录尚未确认时使用。它不选择适配器。
- 跨适配器组件语义：`references/mastergo-component-mapping-rules.md`；仅用于两条作业共用的设计来源、组件身份与来源链规则。

不得默认加载全部 references；适配器专用参考和脚本只按各自作业链读取与执行。
