---
name: mastergo-iocontrol-document-format
description: 强制规范 MasterGo → MTSLG IOContorl 映射文档的写法，并约束新增/修改映射后必须整批完成的同步与验证。只要用户要求新增、修改、整理或审查 IOContorl 映射规则、组件库映射文档或飞书映射文档，就必须使用本 Skill，严格沿用既有标题层级、固定模板、固定节点和 XML 风格，不得自行改成表格主导或另起格式。
---

# MasterGo → MTSLG IOContorl 映射文档规范

本 Skill 定义所有 MasterGo 组件集和控件类型映射文档的唯一书写风格。它约束文档结构和表达方式，不替代具体组件映射，也不允许凭外观或语义发明运行时控件、Style 或属性。

## 触发与门禁

- 用户要求写入、修改、整理、审查 IOContorl 映射文档时，必须先读取并遵守本 Skill。
- 先查看目标文档的现有标题和相邻映射条目；新内容必须放入对应的组件集/控件类型主标题下。
- 本规范适用于全部组件集：输入框、选择/单选/多选、信息分组、IconButton、Table、导航、状态控件以及后续新增组件，不得只对某一个组件族执行。
- 不得在文档末尾随意追加新的顶层风格、临时标题或独立表格体系。
- 若用户要求撤回，只撤回本次新增/修改的目标块，不改动无关组件映射。

## 文档层级

严格使用既有层级。当前映射文档以 `#` 作为组件集主标题；组件分支和具体模板在其下使用 `##`/`###`，新增或整理条目必须保持以下映射链：

```text
# 组件集或大的规则分类
## 组件集下的结构分支（文档组织维度，不是匹配键）
### 具体组件实例、固定模板或匹配规则
```

典型路径：

```text
# MasterGo 控件类型：IconButton → MTSLG 映射规则
## 组件集：右侧栏（按公开属性“按钮类型”匹配）
### 固定模板：按钮类型=enter
### 固定模板：按钮类型=exit
```

组件规则必须归入正确的组件集/控件类型主标题；不要把组件映射写到通用转码规则或专项规则下。凡是能生成 IOContorl 的 MasterGo 组件，都必须具备同样的映射链：组件集/结构分支 → 匹配规则 → 固定模板 → 固定节点 → XML → 字段来源。

## 匹配键

优先使用：

```text
独立组件集名称 + MasterGo 公开变体/属性名 + 真实属性值
```

“完整父节点语义”不作为匹配键：映射表的模板族里没有按父节点分流的字段。右栏按公开属性“按钮类型”匹配（`rightSidebarTemplates.match.property` = `按钮类型`，变体值包含 `enter`、`exit`、`上下结构-icon+文案` 等）；团队组件库里可直接放置的独立组件则由 `rightSidebarComponentTemplates` 按组件集名匹配（`match.componentSet: true`，当前登记 `右侧栏-左右结构-icon+文案`、`右侧栏-上下结构-icon+文案`、`start` 三个组件；完整清单以映射表 `rightSidebarComponentTemplates.variants` 为准）。父节点链用于定位实例、读取证据与回溯，也用于确认真实结构、裁剪边界与来源，但不参与变体匹配。

组件集 ID、实例 ID、图层 ID 和设计师自定义名称只用于内部来源追踪，不参与唯一匹配。来源追踪信息用于读取证据、审计和回溯，默认不要作为“来源：MasterGo 文件……”等独立正文行写入飞书映射文档；只有全文已有同类来源字段或用户明确要求时才写入。文档里需要写明组件集的真实名称；不能只写“左右结构”“上下结构”这类缩写。

**一个族一个键**：模板族实际用哪个键，登记在 `mtslg-iocontrol-map.json` 的 `match` 字段里，**一个模板族只登记一个键、解析时也只用一个**——键的种类/属性名一律以映射表各族的 `match` 为准，本规范不另立清单；本规范里出现的具体键取值/属性名（如 `componentTemplates.match.property` = `属性 1`）只为例示、须与映射表同步。映射文档里每个族的“匹配规则”必须写明它用的是哪一种，并与映射表登记一致；不要写成“多个键任选其一”或“先按属性、取不到再按名字”这类多候选兜底。另一种键 `componentName: true`（按被引用组件的名字命中）只用于 Layout 层的底部栏，**不是组件模板族可用的键**。

**底部栏不属于本规范范围**：底部栏（`layoutRules.bottomBar`）是 Layout 层规则，按页面壳层 Layout 规范 `skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/feishu-layout-mapping.md` 里登记的 `layoutRules.bottomBar.match` 匹配（当前为 `componentName: true`——底部栏实例的属性里没有变体信息，变体值就是被引用组件的名字）。本规范只约束组件库映射文档，不得把底部栏按公开属性“属性 1”登记进组件库映射文档。

## 每个映射条目的固定格式（所有组件集统一）

每个组件集、结构分支和具体变体都必须独立写成：

1. 组件集主标题使用现有文档的 `#` 标题；结构分支可使用 `##` 标题；
2. `### 匹配规则`，明确独立组件集、公开属性名和真实属性值（父节点/结构分支只是文档组织维度，不作匹配键）；
3. `### 固定模板：...`，说明每个命中分支的模板身份；
4. `固定节点：...`，说明 ControlType、Style、节点数量、父子关系、槽位顺序；
5. 紧随其后的 XML 模板；
6. XML 后写字段来源和可选字段处理。

模板决定固定结构；MasterGo 节点或已确认业务配置只负责填充花括号字段。不要把多个模板合并成一个共享 XML 块，也不要只写说明而不提供对应模板。即使某组件只有一个变体，也必须写出匹配规则和固定模板；不能因为结构简单而省略其中一层。

推荐形式：

```text
### 固定模板：属性 1=真实值

固定节点：一个/多个 IOContorl；ControlType 固定为 ...，Style 固定为 ...；槽位和父子关系固定。

<IOContorl ... />

文案→Value；业务字段/动作→IOName/IOCommand；位置尺寸→Left/Top/Width/Height。
固定模板中已声明但 MasterGo 或目标项目没有可靠来源的可选属性，保留属性并输出空字符串值；不在固定模板中的属性不新增。节点本身只有在可见性规则、页面根级大标题规则或宿主结构边界明确剥离时才省略；组件库 placeholder 标记不构成省略理由。
例外：按钮族（IconButton / Button / StatusButton）的 `PageName`、`IOVisible`、`IOCommand`、`IOEnable`，以及模板含图标字段的 `IconButton` 的 `Icon`、`IconWidth`、`IconHeight`，都属于固定字段：无论固定模板是否逐条声明、无论能否取到来源都必须发射，取不到时写空字符串值（**变体登记 `omitRequiredAttrs` 时该变体做减法：登记的属性不发射，生成器与校验器共用 `omittedAttrs()` 判据（见飞书组件库映射规范「组件级固定变体的公共口径」）**；`IconWidth`/`IconHeight` 有图标槽位时改取**台账命中条目节点**的 bbox —— 该条目 `sourceRef` 指向的节点，四舍五入取整；因此台账条目必须登记在只包住该图标图形的节点上）。模板不含图标字段的 `Button`、`StatusButton` 不发射 `Icon`/`IconWidth`/`IconHeight`。该口径以映射表 `buttonFamily` 与 `controlTypeRequiredAttrs` 为准（映射表位置：以插件根为基准的 `skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/mtslg-iocontrol-map.json`），冲突时以映射表为准。
```

如果多个真实属性值的输出结构完全相同，可以在一个固定模板中明确列出这些真实值；如果结构、Style、节点数量或槽位有任何差异，必须拆成独立固定模板。Table、信息分组、输入框等组件集与 IconButton 使用完全相同的文档结构，不得另起“表格专用”或“组件说明”格式。

例外：表格族（`tableTemplates`）的命中与列定义另有固定口径，文档仍按 `### 固定模板：组件集=Table` 命名。**匹配**只有一条路径：结构签名（节点类型 `GROUP` + 孩子里含「表头」群组 + 至少一个 `item` 行群组 + 表头至少有 `signature.minHeaderTexts` 条可见文本，**四项同时成立**），因为表格在组件库里通常没有组件集，映射表里也没有 `match.property` / `componentSet`；**图层名不参与匹配**（图层怎么命名、是否带序号都不改变命中结果）。**列子节点是列结构不是页面控件**：几何按 `tableTemplates.columnTemplate` 固定发射（`Left=0` / `Top=0` / `Height=45`、不写 `Width`），属性只发射 `Value`（列标题 = 表头文本，`valueSource=dsl.text`）加 `alwaysWrittenAttrs` 空占位，**不套** `controlTypeRequiredAttrs`；列数 = 表头可见文本数，没有「隐藏主键列」这类额外列；列 `ControlType` 由该列单元格类型严格多数判定（没有多数退化为 `TextBlock`）。表格的**行是数据不是控件**：行内文本一律 `omit` 且 `role=table-data-cell`，行内容按行登记进映射的 `tableAudits[].rows`；根节点 `Value` 恒写、**当前阶段固定写空串**（数据源由工程师或运行时后续绑定，禁止编造文件名）并置 `valuePending=true` 作为待绑定提示（登记在映射 `tableAudits[].valuePending` 与 Bundle 审计 `tables[].valuePending` 两处；提示性审计字段，不是交付门禁）。

### 固定模板标题命名

- 只有一个明确组件集模板时，标题写成 `### 固定模板：组件集=Table`、`### 固定模板：组件集=主菜单button` 等，必须指出模板的匹配对象。
- 同一组件集下存在多个结构分支时，每个分支单独命名，例如 `### 固定模板：结构分支=右栏图标+文案`；分支名用组件集/结构分支本身命名，不得用“父节点语义”充当匹配键。
- 同一组件集存在多个公开变体/属性值且输出结构不同，每个真实值单独命名，例如 `### 固定模板：属性 1=真实值`、`### 固定模板：按钮类型=enter`；结构完全相同时才允许合并，并在标题或正文列出全部真实值。
- 禁止使用无法判断命中范围的裸标题 `### 固定模板`，也不使用 `### 固定模板：父节点=…` 这类"父节点语义"标题（映射表的模板族里没有按父节点分流的字段；父节点链只用于定位实例、读取证据与回溯）。**历史文档里若存在这类标题，必须在本次改动里改掉**——覆盖审计会把它的取值报进阻断字段 `unregisteredVariants`（脚本以退出码 2 结束），不会容忍"留着下次再说"。改写目标分两种，别混用：优先改成**真实变体值标题**（`属性 1=` / `按钮类型=`）；要按组件集组织章节时用**章节名** `组件集=`，它必须与同一章节里**至少一个能解析成变体的标题或 `MasterGo 变体：` 行**成组出现（章节名本身不是变体值，要靠同组变体作锚点），否则会被当成孤儿章节。该族的匹配键仍按映射表的 `match` 登记执行。

## XML 书写规则

- `ControlType`、节点数量、父子关系和槽位顺序由固定模板决定。
- `Value`、`IOName`、`IOCommand`、`IOEnable`、`IOState`、`LangName`、`Left`、`Top`、`Width`、`Height`、`FontSize`、`Align`（文本对齐，恒写）等由对应 MasterGo 节点或已确认配置填充；其中 **`Align=Right` 时 `Left` 的口径不同**（以控件右上角为原点量到父容器外框右边缘的距离，口径见组件库映射文档与映射表 `textBlockAlign.distance*`）。
- XML 字段顺序沿用文档中相邻模板，不要无理由重新排序。
- 固定模板中已声明的可选字段，MasterGo 未提供时保留对应 XML 属性并输出空字符串值；不在固定模板中的字段不得新增。不得猜值或把缺失字段扩展成新的节点。
- 没有可靠映射时标记“待确认/未映射”，不得静默降级为普通 Button、Border、Canvas 或近似控件。

## 组件与参数分离

文档必须明确：

- 模板固定“生成什么”：ControlType、Style、节点结构、槽位顺序；
- MasterGo 数据决定“填什么”：真实文本、图标、状态、位置、尺寸、字号；
- 每个实例分别读取自己的 layerId/ref、父节点链和 bbox；不得借用相邻实例或同 componentId 实例的参数。

## 特殊规则

- 图标字段随 `ControlType` 的固定模板决定：模板含图标字段的 `IconButton` 恒写 `Icon`、`IconWidth`、`IconHeight`，无图标槽位时写空字符串值；有图标槽位时 `IconWidth`/`IconHeight` 取值是**台账命中条目节点**的 bbox（`sourceRef`，缺失回退 `sourceId`；**不是控件宽高**），`Icon` 取已登记的资源键。台账条目因此必须登记在**只包住该图标图形**的节点上（图标组 / 图标实例 / 图标 PATH）；登记在按钮级容器上会取到按钮尺寸。模板不含图标字段的 `Button`、`StatusButton` 以及其余无图标控件不得出现 `Icon`、`IconWidth`、`IconHeight`。
- `FontSize`、`Height`、`Width` 始终分开表达；`TextBlock` 的 `Height` 固定 `40`、`Width` 固定 `NaN`，不得用字号、行高、文本 bbox 高度或文本 bbox 宽度替代；非 TextBlock 控件的宽高必须来自对应 MasterGo bbox。
- 表格（`tableTemplates`）：命中后发射一个 `DataGrid` 根节点 + 由表头可见文本从左到右派生的列定义子节点；根节点几何取表格图层 bbox（原样直传，图层声明尺寸覆盖不了内容范围时记入审计交设计侧修正），列节点几何取 `columnTemplate` 固定值。行数据只登记不发射控件；表头文本承载列 `Value`（`valueSource=dsl.text`），其余行内文本走 `omit` 角色 `table-data-cell`。
- 坐标必须来自对应 MasterGo bbox，并按项目统一内容区坐标规则计算；模板不能决定实例坐标。
- 根级示例标题/工件示教标题按 `design-artifact-title` 规则处理，不得混入业务 XML；保留或剥离都要记录原因。
- Style 或 ControlType 必须有目标框架源码、真实页面或正式映射证据；用户指定但尚未找到运行时键时，明确标记待核对，不得伪造。

## 新增/修改映射的同步清单

新增、修改或删除**任意一条映射**时，下列位置要在同一批改动里保持一致；只改其中一处就等于制造漂移，而漂移不会立刻报错，只会在后续页面生成时才暴露。第 1~5 项是硬性要求；第 6 项按发版节奏处理，不阻塞本次改动：

1. **机器真值源**：`skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/mtslg-iocontrol-map.json`（以插件根为基准）——模板族结构、`match`（一族一键，键的种类以各族 `match` 为准；`componentName` 只用于 Layout 层的底部栏）、`variants` 真实属性值、`controlTypeRequiredAttrs` 必写字段、按钮族 `iconSize` 等。同一个「匹配属性名 + 属性值」只能登记在一个模板族。**新增的是"族"（带 `variants` 的新 `*Templates`）时，下面两项一并完成，缺一项就不算同步完成**：① 在 `skills/mastergo-to-wpf/scripts/adapters/mtslg-iocontrol/gen-mtslg-mapping-from-dsl.js` 写出该族的发射分支（`match.family === …`），并把族名登记进该文件的 `SUPPORTED_TEMPLATE_FAMILIES`；② 跑 `skills/mastergo-to-wpf/scripts/tests/template-family-coverage.test.js`——它与映射表**双向**比对族集合，并逐个确认非兜底族真有发射分支（只登记不写分支同样失败）。覆盖审计看不到生成器这一层，所以它不能替代这两项。
2. **人读口径**：本规范约束的映射文档 `skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/feishu-component-library-mapping.md`——按上面的层级、匹配规则、固定模板和 XML 格式补齐同一条映射。
3. **覆盖审计对文档的写法要求**：审计脚本 `skills/mastergo-to-wpf/scripts/adapters/mtslg-iocontrol/audit-mtslg-feishu-map.js` 的文档侧期望值**全部从映射文档解析**，不再有手写清单（因此新增/改名/删除族或变体时**不需要**去改审计脚本）。它认这些结构化写法：`MasterGo 变体：A、B、C` 行、`### 固定模板：<键>=<值>` 与 `### 待确认变体：…` 标题（值里用 `、，,/` 列举）。标题键分四类：`变体=` / `属性 1=` / `按钮类型=` 段是**变体值**（解析不到映射表就是文档凭空多写，报 `unregisteredVariants`）；`组件集=` / `聚合集合=` / `独立组件=` 段是**章节名**（解析不到时看同组有没有别的变体锚定，整组都没有才报孤儿章节）；`结构分支=` 段是**结构分支名**，一律算标签、不参与变体判定（映射表的每个变体仍必须出现在文档正文，`undocumented` 方向照查，所以它不是绕过路径）；**其余未登记的键（如 `父节点=`）一律把取值报进 `unregisteredVariants`**，提示改成合规标题。因此**新增组件集/变体时必须在这份文档里用上述形式写明**，否则该变体在"文档 → 映射表"方向不可见；只写在散文里会被当成标签，解析不到就被 `unregisteredVariants` 报出。凡本 Skill、映射文档或其他脚本里**逐个列举变体/组件名**的地方（含本节与「匹配键」一节的举例），都按同一批改动同步；能改成"以映射表 `variants` / `match` 为准"的表述就不要复制清单。
4. **回归用例**：在 `skills/mastergo-to-wpf/scripts/tests/` 下按需补断言（文档覆盖、模板匹配、按钮族图标字段口径、TextBlock 尺寸、坐标等）。
5. **版本号**：`.claude-plugin/plugin.json` 递增；不要在上一轮 CI 未结束时连续推送。
6. **在线同步副本**：发版前把映射文档同步到对应的飞书在线文档（按标题检索定位、不写死地址、整篇重建并记录 revision）。同步工具是可选项、不是交付链路的运行依赖：本机没有该工具时，在交付说明里标注"在线文档未同步"即可，不阻塞本次改动。

新增模板族时不必先判断它属于哪类写法：直接跑下面的覆盖审计，报告里的阻断字段 `unregisteredFamilies`、`unregisteredVariants`、`undocumented`、`duplicateMatchKeys` 会指出该族还差哪一项（映射表条目、映射文档条目，或文档里没用结构化写法写明），按报告补齐后再重跑，直到这四项全部为空；`unresolvedSections` 是同一问题的定位视图（孤儿章节），`labels` / `unconfirmed` 只是提示，都不单独阻断。这四项全空**不代表**新增族已完工——生成器侧按第 1 项另跑族分支门禁。

改完后按顺序自检，任何一步非零退出都必须修完再提交：

```text
node skills/mastergo-to-wpf/scripts/adapters/mtslg-iocontrol/audit-mtslg-feishu-map.js \
     skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/feishu-component-library-mapping.md \
     skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/mtslg-iocontrol-map.json
node --test "skills/mastergo-to-wpf/scripts/tests/*.test.js"
Get-ChildItem "skills/mastergo-to-wpf/scripts/tests/*.tests.ps1" | ForEach-Object { pwsh -NoProfile -File $_.FullName }
```

- 覆盖审计报告里 `unregisteredVariants`（文档结构化写出的变体值/组件集名在映射表里找不到归属）、`unregisteredFamilies`（映射表里有该模板族，但它的变体在文档正文里一个都没出现）、`undocumented`（映射表登记了但文档正文没提）、`duplicateMatchKeys`（跨模板族重复匹配键）任一非空，都表示这次改动不完整；**这四项**任一非空时脚本以退出码 2 结束。报告里的 `unresolvedSections`（孤儿章节）、`labels`（文档当标签用的章节名/尺寸片段，如《单选+多选》《输入框》《晶圆图》）与 `unconfirmed`（映射表自己登记为待确认的变体）只是定位/提示项，不单独阻断（孤儿章节的失败已由同一章节的 `unregisteredVariants` 条目体现）。
- `undocumented` 是关键词级覆盖检查（文档正文里是否提到该变体，HTML 注释不算），不证明模板已经写全；模板是否成体系仍按本 Skill 的层级、匹配规则和固定模板规则人工审查。
- 只改映射表或只改映射文档都不算完成；必须文档 + 映射表 + 审计 + 回归同时通过。
- 新 ControlType 的必写字段只需登记进 `controlTypeRequiredAttrs`，生成器与 provenance 校验会自动读取；若改的是固定字段口径（按钮族、图标字段、TextBlock 尺寸等），还要同步 `doc-rule-consistency.test.js` 覆盖的口径文本。
- 改动涉及页面产物行为时，另按 `skills/mastergo-to-wpf/SKILL.md` 的交付链路在真实页面上复跑一次，不在本清单内自动执行。

## 修改前后检查清单（格式自检）

写入或修改映射文档后，逐项检查：

- 是否归入正确的 `#`/`##`/`###` 层级；
- 是否所有组件集都使用同一条“匹配规则 → 固定模板 → 固定节点 → XML → 字段来源”映射链；
- 是否使用完整匹配键和真实属性值；
- 每个变体是否都有自己的“固定模板 + 固定节点 + XML”；
- XML 是否紧随对应模板，而不是集中到段落末尾；
- 固定字段与动态字段是否分开；
- 是否只对固定模板中声明的字段输出空字符串，并且没有因为 placeholder 标记删除当前页面文本；
- 是否误改了无关组件或把兼容别名当成新正式名称；
- 若全文已有来源字段或用户明确要求，是否保留了来源、待确认项和验证边界；否则不要额外新增来源行。
