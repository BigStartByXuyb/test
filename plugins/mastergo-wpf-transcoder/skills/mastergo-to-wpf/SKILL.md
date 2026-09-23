---
name: mastergo-to-wpf
description: 将明确要求的 MasterGo 设计稿转换为 MTSLG IOContorl XML（作业 B）或 MW WPF XAML 页面（作业 A），并按正式组件库实例和目标项目规范生成完整页面。仅在同时包含 MasterGo 设计来源与转换/生成意图时触发，不用于单独修改 XML/XAML、排查 Ctrl+R、普通 WPF 调试或单独讨论 MTSLG/IOContorl/API/代码索引。
---

# MasterGo 转 MW 代码

两条路线都启用，产物形态不同、**判定与采集链路共用**：

- 作业 B `mtslg-iocontrol`（缺省）：栅格绝对坐标 + 控件属性的页面 XML；
- 作业 A `mw-wpf`：真 WPF XAML 页面（框架 `s:` 控件 + Grid 布局），`-Mode mw-wpf` 选择。

路线只决定**同一份类型判定结果怎么写**、以及步骤 5/8/10/11/12 用哪个脚本；用哪些脚本、读哪张表、产物落在哪，由 `references/adapters/<路线>/adapter.json` 描述符给出，`run-all.ps1 -Mode <路线>` 按它派发。**一次运行只走一条路线**：续跑不能换路线（换路线要从 `fetch` 新开运行），也不得生成混合产物。

本文件只写**模型必须做的判断**和**每条规则的唯一入口**。脚本已 fail-closed 强制的规则不在这里复述（复述只会与脚本漂移），完整口径一律在 reference 与脚本里。

### 读取纪律（避免把"照步骤执行"变成"通读实现"）

- 整页转换**一条命令跑完**（`run-all.ps1`，默认第 1→12 步）；步骤、输入、产物、失败处理看 `references/adapters/mtslg-iocontrol/pipeline-contract.md`。**不需要**读 `scripts/` 下分桶目录里的源码来复述规则。
- 只在下面三种情况读 reference：① 本文件明确写「读 X」；② 脚本报错，按 `pipeline-contract.md` 的「怎么修」定位到该 reference 的对应小节；③ 要写/改 Bundle 清单、图标命名表、译文清单，需要字段口径。
- 未在「参考文件读取条件」里点名、且当前任务没触发的文件不要读；作业 A 的 `references/adapters/mw-wpf/framework-manual/**` 是一次本地框架快照的参考，只在写/改 A 写法表或人工评审 A 样式族时定点查。

## 触发边界

必须同时满足：

1. 有 MasterGo 设计来源：链接、`fileId + layerId` 或结构化节点；
2. 用户明确要求转换/生成 MTSLG IOContorl XML、MTSLG 完整页面，或 MW WPF（XAML）页面。

仅出现以下内容时不触发：单独修改已有 XML、单独排查 `Ctrl+R`、普通 WPF 调试、单独讨论 MTSLG/IOContorl API、单独维护组件库或代码索引。

## 开始前门禁

1. **只认一次 `getDsl`**：用 `scripts/core/call-mastergo-mcp.js` 调 `getDsl(fileId, layerId, format=json)` 读当前图层完整 DSL，**响应只落盘**（`<runDir>/getDsl.json`）不进上下文；不得分段读取，不得用浏览器、截图或视觉猜测替代。MCP 不可调用或 `getDsl` 报错时**停止本次转换并报告原因**，不得换成其他设计数据来源继续。`extractSvg` 是 `getDsl` 成功后的独立图标步骤（`<runDir>/extractSvg.json`），不参与页面结构。
2. **不读图**：不得打开、渲染或裁剪设计稿截图/图标位图做判断题；图形形状与朝向一律由 DSL 的 `rotate` / `flipH` / `flipV` 机械烘焙得出。宿主运行截图只属「项目运行时交付」门禁，与设计稿判断无关。
3. **不降级、不伪造**：没有正式映射的组件只进来源清单与待确认，不得改成 `Button`、`Border`、无类型容器或近似控件；存在未映射组件时不得宣称「完整可运行页面」。
   **纯布局包裹层不属于未映射组件**：未命中模板族、也未登记 `pending` 的 `FRAME`/`GROUP`/`LAYER` 按 `mtslg-mode.md` 第 9 节展平到最近有效父容器（容器本身不发射控件），内部控件与文本照常映射。进入待确认并隔离内部文本的有三类：未命中模板的**组件实例**（`INSTANCE`/`COMPONENT`）、命中模板族但结构部分命中（如表格表头可见文本不足）的节点，以及被 `manifest.excludeInstances` 清单隔离的组件。

## 入口分流（先判断）

| 场景 | 入口 | 口径 |
|---|---|---|
| 选路线 | `run-all.ps1 -Mode mtslg-iocontrol`（缺省）/ `-Mode mw-wpf` | 用户要 IOContorl 页面 XML 走 B；要 WPF 页面（真控件 + Grid 布局）走 A。没明确说、也没说 WPF 时按 B，不要自选 A |
| 修改现有页面 | 单独调 `gen-iocontrol-xml.js --merge <现有XML> <mapping.json> --out <输出>`（**不经 Bundle**） | 保留工程师已有的 `IOName`、`IOCommand`、`IOEnable` 等业务属性；**禁止对现有页面用 `--fresh`**；merge 逐条语义与「设计文本覆盖（dsl.text）」报告见 `mtslg-mode.md` 第 5 节 |
| 新建页面 / 整套替换 | `gen-mastergo-page-bundle.js --manifest <bundle.json>`（唯一正常入口） | Bundle 的页面 XML 步骤恒为 `--fresh`，**没有合并语义**；同名目标存在时默认停止；只有用户明确要求替换 + 清单 `operation=replace-existing` + `--overwrite` 才整套替换并逐个备份。清单字段见 `references/adapters/mtslg-iocontrol/bundle-manifest.md` |
| Bundle 被环境阻塞 | 按阻塞步骤单独调子脚本 | 只补该步，不改变上游输入口径 |

- Bundle 清单的字段、必填、缺省见 `references/adapters/mtslg-iocontrol/bundle-manifest.md`；不要照抄上一页的清单反推字段。
- `mapping` 由 Bundle 内部调用 `gen-mtslg-mapping-from-dsl.js` **机械生成**（Tag `新页面完整DSL映射`），不是人手写的中间稿；要偏离机械结果就改**输入清单**（隔离实例、标题文案、术语表、译文），不改 mapping 产物。
- 匹配键是「独立组件集名 + 公开属性名 + 真实属性值」（或映射表登记的结构签名）；**「完整父节点语义」不作为匹配键**。图层名、组件 ID 与截图外观只用于追踪和核对。

## 一键流水线（12 步）

**一次调用跑完全部 12 步**（默认区间第 1 → 12）；下表是这条命令**内部**的阶段划分，用来定位失败与断点续跑，**不要为每一步单独起一次 `run-all`**。常用参数只有三类（完整清单见 `scripts/entry/run-all.ps1` 的 `param` 块）：

- **目标信息** `-Target` / `-LayerId` / `-FileId` / `-Ui` / `-DesignPageName`：登记表 `docs/page-registry.json` 里能命中本次页面时可省；**登记表有多页时必须用 `-Target` 或 `-LayerId` 选中本次页面**（脚本按命中选页，没命中就报错，不会取第一页顶上）；
- **区间控制** `-Progress <步骤名>`（失败后从该步继续）/ `-StopAfter <步骤名>`（需要人工补语义输入时先跑到 `discover`）；
- **`-Overwrite`**：只在用户明确要求替换已有产物时加；此时 Bundle 清单须为 `operation=replace-existing`。

正常路径不需要手工调用子脚本；只有 Bundle 被环境阻塞时，才按阻塞步骤单独调用子脚本（见「入口分流」）。

| 步骤 | 名称 | 内容 |
|---|---|---|
| 1 | `fetch` | 取数 `getDsl`（响应只落盘） |
| 2 | `capture` | DSL 结构化快照 + 覆盖校验 |
| 3 | `svg` | `extractSvg` 图标几何 |
| 4 | `visibility` | 显隐事实提取 |
| 5 | `mapping` | mapping 草稿（按当前台账） |
| 6 | `discover` | 图标候选发现 + 打印待命名清单 |
| 7 | `ledger` | 由命名表生成图标台账 + 图标几何来源核对 |
| 8 | `layout` | Layout 清单机械推导（底部栏 MenuItem） |
| 9 | `inputs` | 校验译文并生成 Bundle 清单 |
| 10 | `bundle` | 生成页面 XML / Icon / Layout / 宿主壳 |
| 11 | `gates` | 严格门禁（审计逐条断言） |
| 12 | `verify` | 四项独立验证（provenance / 坐标 / Icon / 结构） |

- **作业 A 的差异**（步骤号与名称不变，步内命令与产物不同）：第 5 步 = 共享类型判定（只读共享类型表，产出 `Generated/<Target>.component-types.json`）；第 8 步 = 共用 Layout 清单推导 **+** 布局产物推导 `Generated/<Target>.wpf-layout.json`（分区 → 行列 → 格子）；第 10 步 = 真控件 `View.xaml`（含本页 Icon 字典合并点）+ 宿主壳 + 本页 Icon/语言字典 + Layout 注册，**不发射 IOContorl 页面 XML**；第 11/12 步 = 布局门禁（越界 / 锚点格冲突 / 禁止类型 / 尺寸来源 / 协议 / 资源键 / 硬编码文本；空行空列只作提示）。第 1–4、6、7、9 步两条路线沿用同一套。

- **每一步的输入 / 产物 / 失败语义 / 怎么修：`references/adapters/mtslg-iocontrol/pipeline-contract.md`**。该文件由 `run-all.ps1` 的步骤定义生成（`node scripts/core/gen-pipeline-contract.mjs`），**真值源是脚本**；要改契约就改脚本再重新生成，手改文档会挂测试。
- 运行登记表：`<项目>/Generated/runs/<Target>/run.json`，规则是「**产出即登记、消费只按登记取、未登记的旧同名文件一律拒绝**」；清单里的采集输入（`dslPath` / `visibilityPath` / `svgPath`）都从登记表解析并校验 `sha256`。断点续跑用 `-Progress <步骤名>`（续跑的身份与登记表口径、可改语义输入见 `references/adapters/mtslg-iocontrol/bundle-manifest.md` 第 7 节）。
- 区域前缀（`ui`）：取值链的唯一实现在 `run-all.ps1`（`-Ui` → 项目登记表 `pages[].ui` / `derivation` → Target 编号前缀 → Target 首词 → **报错**）；取不到就报错，不静默默认。`fileId` / `layerId` 同样按「命令行 → 项目登记表 → 报错」解析，插件不内置任何项目的设计来源。

```powershell
pwsh -NoProfile -File <skill>\scripts\entry\run-all.ps1 -ProjectRoot <项目> -Target <Target>                       # 一次跑完 12 步
pwsh -NoProfile -File <skill>\scripts\entry\run-all.ps1 -ProjectRoot <项目> -Target <Target> -Progress <步骤名>     # 失败后从该步继续
pwsh -NoProfile -File <skill>\scripts\entry\run-all.ps1 -ProjectRoot <项目> -Target <Target> -Overwrite            # 仅用户明确要求替换时
pwsh -NoProfile -File <skill>\scripts\entry\run-all.ps1 -List -Format json -OutFile <文件>                         # 12 步契约（机器可读：写文件，UTF-8）
```

### 模型必须提供的三类页面级输入（语义判断不进脚本）

| 输入 | 位置 | 内容 |
|---|---|---|
| 图标命名表 | `Generated/_inputs/<Target>.icon-naming.json` | 候选下标 → 英文资源名（`…Geometry`）+ 中文注释（可选 `fromDsl`）；下标**只能**取候选清单的 `mustName`（= `discover` 判定的要登记项，多一个少一个都失败） |
| 译文清单 | `Generated/_inputs/<Target>.lang-translations.json` | 中文 → 英文译文；脚本不做翻译、不调机翻服务 |
| 术语表 | `Generated/_inputs/<Target>.lang-glossary.json` | 无英文语义或单字符文案的稳定标识符 |

## 硬门禁索引

每条都是「不改就会失败」的规则；细则与真值源见对应 reference，本节不复述细节。

- **Value / 坐标 / provenance**：一律由设计事实机械推导，不得语义猜测 → `mtslg-mode.md` 第 3 节 + `scripts/adapters/mtslg-iocontrol/validate-iocontrol-provenance.js`
- **内容区原点 `contentOriginY = 192px`**：全局固定常量，只在页面根级扣一次 → `mtslg-mode.md` 第 3 节
- **容器 `GroupBox` 的 `Style` 恒为空串**，原点查表键是 `contentInsetStyle` → `feishu-component-library-mapping.md` 的「组件父子相对坐标」小节
- **多语言全量产键**：设计稿给出的每个文本 `Value` 都产键挂 `LangName`；唯一不产键的是映射表在值槽位登记 `langRefPolicy: "none"` 的节点（当前只有选择框 `Value`），槽位豁免记入 `valueLangExempt` → `references/adapters/mtslg-iocontrol/page-build-rules.md` 第 3 节
- **可见性 omit 有两条路径**：明确 hidden，以及角色驱动 omit；角色集合 `OMIT_ROLES` 与 `OMIT_REASONS` 的真值源是 `scripts/adapters/mtslg-iocontrol/validate-iocontrol-provenance.js`，新增角色必须同时登记该集合 → `references/adapters/mtslg-iocontrol/page-build-rules.md` 第 5 节
- **页面节点 ID**：`MX_` + `sha256(页面键 + 节点 ref)` 前 32 位；禁止用遍历序号当节点身份，人工维护约定随属性一起写在 mapping → `mtslg-mode.md` 第 2 节
- **图标是页面级资源**：本页 `Icons.xaml` 的键必须页面内唯一、并被本页（含 Layout 菜单项）引用；禁止由图层 ID / 坐标 / 外观拼名（如 `MGIcon_<layer-id>`）。**哪些图形要登记由 `discover` 步骤机械给出**（候选的 `registration.register` / `mustName`，判据实现 `scripts/adapters/mtslg-iocontrol/lib/icon-registration-policy.js`），命名表与它**必须一一对应**（漏定名 / 多定名都失败，`build-icon-ledger.mjs` 双向门禁）→ `references/adapters/mtslg-iocontrol/page-build-rules.md` 第 2 节
- **页面输出目录**：一页一目录（页面 XML / Icon / 语言字典同页目录，Layout 项目级共享）+ 运行目录解析优先级 → `references/adapters/mtslg-iocontrol/page-build-rules.md` 第 1 节
- **组件族细则**：表格族 `tableTemplates` 按结构签名命中并发射 `DataGrid`（列定义来自 `columnTemplate`，行是数据不发射控件）；相机族 `cameraTemplates` 内部文本整体 omit；`TextBlock` 的 `FontWeight`、`Align`（恒写且只有 `TextBlock` 有：设计稿 `textAlign=right` → `Right`，其余含缺失 → `Left` 默认左对齐；`Align=Right` 时 `Left` 的口径变成"以控件右上角为原点量到父容器外框右边缘的距离"）与换行（`&#x0a;`、`U+2028`）都有确定口径 → `feishu-component-library-mapping.md` + 共享类型表 `references/component-types.json`（各模板族的 `match` / `variants`）
- **页面级 / 项目级边界**：页面 XML、本页 Icon、本页语言字典、本页 View/ViewModel、本页 mapping 与审计是页面级（跨页不得同名、不得互相引用）；`Resources/Layout/Layout.xml`、`.csproj`、`framework.config.json` 是项目级，本页只增量写自己的注册
- **不得把 WPF 私有协议写进 IOContorl**：如 `s:Action`、WPF `PageName`、ResourceDictionary 或绑定语法

作业 A（`-Mode mw-wpf`）另有这些硬门禁，细则见对应 reference：

- **尺寸照设计稿，外观只走样式族**：Grid 行列 / `Margin` / 对齐取设计稿值；配色、边框、状态、模板一律用样式族键，设计稿与样式族冲突时停下报告，不得散写属性凑 → `references/adapters/mw-wpf/mw-wpf-mode.md`
- **框架固定区不进页面**：顶部栏 / 底部栏由框架渲染（尺寸用框架 Token），设计稿里的对应区域只用于生成 Layout 注册与菜单项；设计稿的右下角常驻分组与 IOContorl 同口径（不发射 / 不计格 / 不登记图标）→ `references/adapters/mw-wpf/mw-wpf-mode.md`
- **页面必须合并本页 Icon 字典**：A 页面用 `{StaticResource …Geometry}` 引用图形，缺合并点会在加载期抛 `XamlParseException` → `references/adapters/mw-wpf/page-build-rules.md`
- **无对应条目的类型 fail-closed**：写法表把 `Border` / `Camera` 登记为待确认，遇到即挂待确认、不发射 → `references/adapters/mw-wpf/mw-wpf-map.json`
- **布局门禁**：`scripts/adapters/mw-wpf/check-wpf-layout.js`（越界 / 同格冲突 / 禁止写法 / 协议 / 资源键 / 硬编码文本 / 尺寸来源；空行空列只作提示，不失败——框架允许空行列）

## 交付与验收

- 交付物：页面 XML、本页 `Icons.xaml`、`CN`/`EN` 语言字典、Layout 注册、`View.xaml` + `View.xaml.cs` + `ViewModel.cs`、目标项目要求的宿主壳、mapping/审计与交付说明。
- 作业 A 的交付物：真控件 `View.xaml`（+ 本页 Icon 字典合并点）、`View.xaml.cs`、`ViewModel.cs`、本页 `Icons.xaml`、`CN`/`EN` 语言字典、Layout 注册、类型判定与布局产物（`Generated/<Target>.component-types.json`、`Generated/<Target>.wpf-layout.json`）与门禁报告；**不含 IOContorl 页面 XML**。
- 静态验收顺序：`validate-iocontrol-provenance.js`（Value/来源/坐标）→ 坐标检查 → Icon 引用闭环 → 页面结构校验；`run-all.ps1` 第 11、12 步就是这套门禁。
- 只有项目引用、真实运行时资源、可编译宿主与加载验证都通过，才能称「完整可运行页面」；**运行时交付门禁**（部署、宿主加载、`Ctrl+R`、截图核对）只在用户明确要求时执行。
- 交付说明必须列出：待翻译条目与临时键、槽位豁免 `valueLangExempt`、中英文写法相同的键 `identicalTextKeys`、未映射组件与待配置的运行时字段。
- **项目内不放工具链副本**：脚本真源是本插件，页面项目只留产物与证据（页面 XML / Icon / 语言字典 / Layout / 宿主壳 / `Generated/`），不留 `_tool/` 之类的脚本拷贝。

## 参考文件读取条件

- 本路线必读：`references/adapters/mtslg-iocontrol/mtslg-mode.md`（页面格式、坐标、ID、merge、验证）。
- 作业 A 必读：`references/adapters/mw-wpf/mw-wpf-mode.md`（页面格式、骨架、布局规则、ViewModel 契约）。
- 触发才读：`references/adapters/mtslg-iocontrol/pipeline-contract.md`（跑流水线时）；`references/adapters/mtslg-iocontrol/page-build-rules.md`（处理图标命名/几何来源、多语言译文与词典、输出目录、可见性 omit 角色、辅助脚本触发时）；设计稿含顶部栏/底部栏或快捷键，或本次要创建/修改 Layout 注册 → `references/adapters/mtslg-iocontrol/feishu-layout-mapping.md`；要写或改 Bundle 清单 → `references/adapters/mtslg-iocontrol/bundle-manifest.md`。
- 作业 A 触发才读：`references/adapters/mw-wpf/page-build-rules.md`（产物布局、本页 Icon 字典与合并点、多语言键、写入门禁）；要改 A 的写法或样式族 → `references/adapters/mw-wpf/mw-wpf-map.json` + `references/adapters/mw-wpf/framework-manual/`（定点查，不通读）。
- **默认不预读**：`references/adapters/mtslg-iocontrol/feishu-component-library-mapping.md`、共享类型表 `references/component-types.json` 与路线映射表 `references/adapters/mtslg-iocontrol/mtslg-iocontrol-map.json`——组件匹配、`ControlType`、槽位与属性白名单由 `resolve-mtslg-template-mapping.js` / `gen-mtslg-mapping-from-dsl.js` 在生成期按映射表执行；两个 JSON 都只经 `scripts/lib/load-template-map.js` 读取。只有脚本报出 `pending` / `unmappedComponents` / `templateConflicts` 时，才按关键词定点查（不通读）。
- 按需：`references/project-adapter-initialization.md`（项目首次适配）、`references/mastergo-component-mapping-rules.md`（两条作业共用的来源链规则）、`references/style-library-profiles.md`（多套样式/主题/图标库并存时）。
- 作业 A 资料里的框架手册快照（`references/adapters/mw-wpf/framework-manual/**`）不作为作业 B（页面 XML）的运行期口径依据：B 的 `GroupBox` 是空 `Style` + `IOGroupBoxSecondary` 原点，两者冲突时以 B 的口径为准。
