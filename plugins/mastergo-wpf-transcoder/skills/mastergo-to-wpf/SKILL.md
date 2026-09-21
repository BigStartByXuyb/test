---
name: mastergo-to-wpf
description: 当前将明确要求的 MasterGo 设计稿转换为 MTSLG IOContorl XML，并按正式组件库实例和目标项目规范生成完整页面；MW WPF 作业 A 资料暂不启用。仅在同时包含 MasterGo 设计来源与 MTSLG 转换/生成意图时触发，不用于单独修改 XML、排查 Ctrl+R、普通 WPF 调试或单独讨论 MTSLG/IOContorl/API/代码索引。
---

# MasterGo 转 MW 代码

当前版本只启用 `mtslg-iocontrol`（作业 B）：把 MasterGo 设计稿转成 MTSLG IOContorl 页面，并按目标项目规范生成完整页面。作业 A（`mw-wpf`）资料保留在 `references/adapters/mw-wpf/` 但**停用**——不进入触发、分流或生成流程；用户要求 WPF 或目标配置声明 `mw-wpf` 时停止并报告，不得改走其他路线、不得生成混合产物。

本文件只写**模型必须做的判断**和**每条规则的唯一入口**。脚本已 fail-closed 强制的规则不在这里复述（复述只会与脚本漂移），完整口径一律在 reference 与脚本里。

### 读取纪律（避免把"照步骤执行"变成"通读实现"）

- 整页转换**一条命令跑完**（`run-all.ps1`，默认第 1→12 步）；步骤、输入、产物、失败处理看 `references/adapters/mtslg-iocontrol/pipeline-contract.md`。**不需要**读 `scripts/*.js`、`scripts/*.ps1` 源码来复述规则。
- 只在下面三种情况读 reference：① 本文件明确写「读 X」；② 脚本报错，按 `pipeline-contract.md` 的「怎么修」定位到该 reference 的对应小节；③ 要写/改 Bundle 清单、图标命名表、译文清单，需要字段口径。
- 未在「参考文件读取条件」里点名、且当前任务没触发的文件不要读；`references/adapters/mw-wpf/**` 属停用资料，不读。

## 触发边界

必须同时满足：

1. 有 MasterGo 设计来源：链接、`fileId + layerId` 或结构化节点；
2. 用户明确要求转换/生成 MTSLG IOContorl XML 或完整 MTSLG 页面。

仅出现以下内容时不触发：单独修改已有 XML、单独排查 `Ctrl+R`、普通 WPF 调试、单独讨论 MTSLG/IOContorl API、单独维护组件库或代码索引。

## 开始前门禁

1. **只认一次 `getDsl`**：用 `scripts/call-mastergo-mcp.js` 调 `getDsl(fileId, layerId, format=json)` 读当前图层完整 DSL，**响应只落盘**（`<runDir>/getDsl.json`）不进上下文；不得分段读取，不得用浏览器、截图或视觉猜测替代。MCP 不可调用或 `getDsl` 报错时**停止本次转换并报告原因**，不得换成其他设计数据来源继续。`extractSvg` 是 `getDsl` 成功后的独立图标步骤（`<runDir>/extractSvg.json`），不参与页面结构。
2. **不读图**：不得打开、渲染或裁剪设计稿截图/图标位图做判断题；图形形状与朝向一律由 DSL 的 `rotate` / `flipH` / `flipV` 机械烘焙得出。宿主运行截图只属「项目运行时交付」门禁，与设计稿判断无关。
3. **不降级、不伪造**：没有正式映射的组件只进来源清单与待确认，不得改成 `Button`、`Border`、无类型容器或近似控件；存在未映射组件时不得宣称「完整可运行页面」。

## 入口分流（先判断）

| 场景 | 入口 | 口径 |
|---|---|---|
| 修改现有页面 | 单独调 `gen-iocontrol-xml.js --merge <现有XML> <mapping.json> --out <输出>`（**不经 Bundle**） | 保留工程师已有的 `IOName`、`IOCommand`、`IOEnable` 等业务属性；**禁止对现有页面用 `--fresh`**；merge 逐条语义与「设计文本覆盖（dsl.text）」报告见 `mtslg-mode.md` 第 5 节 |
| 新建页面 / 整套替换 | `gen-mastergo-page-bundle.js --manifest <bundle.json>`（唯一正常入口） | Bundle 的页面 XML 步骤恒为 `--fresh`，**没有合并语义**；同名目标存在时默认停止；只有用户明确要求替换 + 清单 `operation=replace-existing` + `--overwrite` 才整套替换并逐个备份。清单字段见 `references/adapters/mtslg-iocontrol/bundle-manifest.md` |
| Bundle 被环境阻塞 | 按阻塞步骤单独调子脚本 | 只补该步，不改变上游输入口径 |

- Bundle 清单的字段、必填、缺省见 `references/adapters/mtslg-iocontrol/bundle-manifest.md`；不要照抄上一页的清单反推字段。
- `mapping` 由 Bundle 内部调用 `gen-mtslg-mapping-from-dsl.js` **机械生成**（Tag `新页面完整DSL映射`），不是人手写的中间稿；要偏离机械结果就改**输入清单**（隔离实例、标题文案、术语表、译文），不改 mapping 产物。
- 匹配键是「独立组件集名 + 公开属性名 + 真实属性值」（或映射表登记的结构签名）；**「完整父节点语义」不作为匹配键**。图层名、组件 ID 与截图外观只用于追踪和核对。

## 一键流水线（12 步）

**一次调用跑完全部 12 步**（默认区间第 1 → 12）；下表是这条命令**内部**的阶段划分，用来定位失败与断点续跑，**不要为每一步单独起一次 `run-all`**。参数只有三类：

- **目标信息** `-Target` / `-LayerId` / `-FileId` / `-Ui`：登记表 `docs/page-registry.json` 里能命中本次页面时可省；**登记表有多页时必须用 `-Target` 或 `-LayerId` 选中本次页面**（脚本按命中选页，没命中就报错，不会取第一页顶上）；
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

- **每一步的输入 / 产物 / 失败语义 / 怎么修：`references/adapters/mtslg-iocontrol/pipeline-contract.md`**。该文件由 `run-all.ps1` 的步骤定义生成（`node scripts/gen-pipeline-contract.mjs`），**真值源是脚本**；要改契约就改脚本再重新生成，手改文档会挂测试。
- 运行登记表：`<项目>/Generated/runs/<Target>/run.json`，规则是「**产出即登记、消费只按登记取、未登记的旧同名文件一律拒绝**」；清单里的采集输入（`dslPath` / `visibilityPath` / `svgPath`）都从登记表解析并校验 `sha256`。断点续跑用 `-Progress <步骤名>`，只沿用同一项目、Target 与已登记的来源及运行配置值，不得把旧产物重新标成另一页。`ui` 是冻结的区域配置；因取值链变化而失败时，可显式传 `-Ui <原值>` 续跑，不要求参数来源相同。确实改变配置或缺少登记表时，按 `references/adapters/mtslg-iocontrol/bundle-manifest.md` 第 7 节归档并新开运行；可变语义输入与显式 `check --key` 的口径也见该节。
- 区域前缀（`ui`）：取值链的唯一实现在 `run-all.ps1`（`-Ui` → 项目登记表 `pages[].ui` / `derivation` → Target 编号前缀 → Target 首词 → **报错**）；取不到就报错，不静默默认。`fileId` / `layerId` 同样按「命令行 → 项目登记表 → 报错」解析，插件不内置任何项目的设计来源。

```powershell
pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -ProjectRoot <项目> -Target <Target>                       # 一次跑完 12 步
pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -ProjectRoot <项目> -Target <Target> -Progress <步骤名>     # 失败后从该步继续
pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -ProjectRoot <项目> -Target <Target> -Overwrite            # 仅用户明确要求替换时
pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -List -Format json                                        # 12 步契约（机器可读）
```

### 模型必须提供的三类页面级输入（语义判断不进脚本）

| 输入 | 位置 | 内容 |
|---|---|---|
| 图标命名表 | `Generated/_inputs/<Target>.icon-naming.json` | 候选下标 → 英文资源名（`…Geometry`）+ 中文注释（可选 `fromDsl`） |
| 译文清单 | `Generated/_inputs/<Target>.lang-translations.json` | 中文 → 英文译文；脚本不做翻译、不调机翻服务 |
| 术语表 | `Generated/_inputs/<Target>.lang-glossary.json` | 无英文语义或单字符文案的稳定标识符 |

## 硬门禁索引

每条都是「不改就会失败」的规则；细则与真值源见对应 reference，本节不复述细节。

- **Value / 坐标 / provenance**：一律由设计事实机械推导，不得语义猜测 → `mtslg-mode.md` 第 3 节 + `scripts/validate-iocontrol-provenance.js`
- **内容区原点 `contentOriginY = 192px`**：全局固定常量，只在页面根级扣一次 → `mtslg-mode.md` 第 3 节
- **容器 `GroupBox` 的 `Style` 恒为空串**，原点查表键是 `contentInsetStyle` → `feishu-component-library-mapping.md` 的「组件父子相对坐标」小节
- **多语言全量产键**：设计稿给出的每个文本 `Value` 都产键挂 `LangName`；唯一不产键的是映射表在值槽位登记 `langRefPolicy: "none"` 的节点（当前只有选择框 `Value`），槽位豁免记入 `valueLangExempt` → `references/adapters/mtslg-iocontrol/page-build-rules.md` 第 3 节
- **可见性 omit 有两条路径**：明确 hidden，以及角色驱动 omit；角色集合 `OMIT_ROLES` 与 `OMIT_REASONS` 的真值源是 `scripts/validate-iocontrol-provenance.js`，新增角色必须同时登记该集合 → `references/adapters/mtslg-iocontrol/page-build-rules.md` 第 5 节
- **页面节点 ID**：`MX_` + `sha256(页面键 + 节点 ref)` 前 32 位；禁止用遍历序号当节点身份，人工维护约定随属性一起写在 mapping → `mtslg-mode.md` 第 2 节
- **图标是页面级资源**：本页 `Icons.xaml` 的键必须页面内唯一、并被本页（含 Layout 菜单项）引用；禁止由图层 ID / 坐标 / 外观拼名（如 `MGIcon_<layer-id>`）→ `references/adapters/mtslg-iocontrol/page-build-rules.md` 第 2 节
- **页面输出目录**：一页一目录（页面 XML / Icon / 语言字典同页目录，Layout 项目级共享）+ 运行目录解析优先级 → `references/adapters/mtslg-iocontrol/page-build-rules.md` 第 1 节
- **组件族细则**：表格族 `tableTemplates` 按结构签名命中并发射 `DataGrid`（列定义来自 `columnTemplate`，行是数据不发射控件）；相机族 `cameraTemplates` 内部文本整体 omit；`TextBlock` 的 `FontWeight` 与换行（`&#x0a;`、`U+2028`）都有确定口径 → `feishu-component-library-mapping.md` + 映射表 `mtslg-iocontrol-map.json`
- **页面级 / 项目级边界**：页面 XML、本页 Icon、本页语言字典、本页 View/ViewModel、本页 mapping 与审计是页面级（跨页不得同名、不得互相引用）；`Resources/Layout/Layout.xml`、`.csproj`、`framework.config.json` 是项目级，本页只增量写自己的注册
- **不得把 WPF 私有协议写进 IOContorl**：如 `s:Action`、WPF `PageName`、ResourceDictionary 或绑定语法

## 交付与验收

- 交付物：页面 XML、本页 `Icons.xaml`、`CN`/`EN` 语言字典、Layout 注册、`View.xaml` + `View.xaml.cs` + `ViewModel.cs`、目标项目要求的宿主壳、mapping/审计与交付说明。
- 静态验收顺序：`validate-iocontrol-provenance.js`（Value/来源/坐标）→ 坐标检查 → Icon 引用闭环 → 页面结构校验；`run-all.ps1` 第 11、12 步就是这套门禁。
- 只有项目引用、真实运行时资源、可编译宿主与加载验证都通过，才能称「完整可运行页面」；**运行时交付门禁**（部署、宿主加载、`Ctrl+R`、截图核对）只在用户明确要求时执行。
- 交付说明必须列出：待翻译条目与临时键、槽位豁免 `valueLangExempt`、中英文写法相同的键 `identicalTextKeys`、未映射组件与待配置的运行时字段。

## 参考文件读取条件

- 本路线必读：`references/adapters/mtslg-iocontrol/mtslg-mode.md`（页面格式、坐标、ID、merge、验证）。
- 触发才读：`references/adapters/mtslg-iocontrol/pipeline-contract.md`（跑流水线时）；`references/adapters/mtslg-iocontrol/page-build-rules.md`（处理图标命名/几何来源、多语言译文与词典、输出目录、可见性 omit 角色、辅助脚本触发时）；设计稿含顶部栏/底部栏或快捷键，或本次要创建/修改 Layout 注册 → `references/adapters/mtslg-iocontrol/feishu-layout-mapping.md`；要写或改 Bundle 清单 → `references/adapters/mtslg-iocontrol/bundle-manifest.md`。
- **默认不预读**：`references/adapters/mtslg-iocontrol/feishu-component-library-mapping.md` 与 `references/adapters/mtslg-iocontrol/mtslg-iocontrol-map.json`——组件匹配、`ControlType`、槽位与属性白名单由 `resolve-mtslg-template-mapping.js` / `gen-mtslg-mapping-from-dsl.js` 在生成期按映射表执行。只有脚本报出 `pending` / `unmappedComponents` / `templateConflicts` 时，才按关键词定点查（不通读）。
- 按需：`references/project-adapter-initialization.md`（项目首次适配）、`references/mastergo-component-mapping-rules.md`（两条作业共用的来源链规则）、`references/style-library-profiles.md`（多套样式/主题/图标库并存时）。
- 停用：`references/adapters/mw-wpf/**`（作业 A 资料）不读，也不作为 XML 事实源。
