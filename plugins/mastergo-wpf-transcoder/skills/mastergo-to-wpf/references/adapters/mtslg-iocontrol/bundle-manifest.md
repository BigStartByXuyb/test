# Bundle 清单字段契约（作业 B）

本文规定 `scripts/gen-mastergo-page-bundle.js --manifest <bundle.json>` 的输入契约。**真值源是脚本本身**（`normalizePageManifest` / `ensureScaffold` / `validateBundleOutputs` / `validateLangOutputs` / `main`）；本文只登记可核验的部分，脚本变更后必须同步本文。

**脚本锚点写法（强制）**：本文各处只写「函数名 + `fail(...)` 文案 / 关键表达式」，**不写绝对行号**——行号会随脚本增删漂移，锚点可直接在脚本里检索核对。

调用方式：

```
node scripts/gen-mastergo-page-bundle.js --manifest <bundle.json> [--overwrite]
```

`--overwrite` 仅允许用于 `operation=replace-existing`；新建页面传了会被拒绝。

## 1. 模式

| `operation` | 含义 | 已有文件处理 |
|---|---|---|
| 不填 | **新建页面** | 目标文件已存在即失败（`页面目标文件已存在，未覆盖`） |
| `replace-existing` | 替换已有页面 | 需配 `--overwrite`，覆盖前逐个备份；同一目标文件只保留最近 2 份 `.bak-<时间戳>` |

Bundle 的页面 XML 步骤恒为 `--fresh`，因此**没有合并语义**：`operation` 只接受上表两种取值，其他值（如 `modify-existing`）直接失败。
**修改已有页面的业务属性**（保留工程师手写的 `IOName`、`IOCommand`、`IOEnable` 等）必须走 `gen-iocontrol-xml.js --merge <现有XML> <mapping.json>`，不经 Bundle——细节见 `mtslg-mode.md` 第 5 节。

## 2. 必填字段

| 字段 | 约束 | 脚本锚点（函数 + fail 文案） |
|---|---|---|
| `name` | 合法标识符 `^[A-Za-z_][A-Za-z0-9_]*$`。页面名只有这一个字段：清单里出现 `pageName` 直接失败 | `normalizePageManifest()` → `fail("manifest 必须提供合法页面 name")`、`fail("manifest 不接受 pageName 字段：页面名统一写在 name")` |
| `area` | 非空字符串（**无条件必填**：新建与 `replace-existing` 都要，它同时给宿主壳命名空间用）；决定 View/ViewModel 路径 `UI/<area>/…`。由 `run-all.ps1` 按「-Ui → 项目登记表 pages[].ui → derivation 的 F<n> → Target 编号前缀 → Target 首词」解析后传入；`build-bundle-manifest.mjs` 自身不做推导，缺参数即报错（避免两处口径不一致） | `normalizePageManifest()` → `fail("必须提供 area（新建与 replace-existing 都需要：它同时决定 UI/<area>/… 路径与宿主壳命名空间）")` |
| `projectRoot` | 必须存在（脚手架模式也要明确给出要创建的目标目录） | `ensureScaffold()` → `fail("projectRoot 必须提供；脚手架模式也必须明确指定要创建的目标目录")`、`fail("projectRoot 不存在: ")` |

**新建页面另需**：`dslPath` + `visibilityPath` 同时提供且文件存在（mapping 由本次生成创建，并必须带 Tag `新页面完整DSL映射`）——`main()` → `fail("新建页面必须提供当前页面的 dslPath 和 visibilityPath；mapping 将在本次生成中创建")`、`fail("dslPath/visibilityPath 输入文件不存在")`、`fail("本次生成的 mapping 缺少算法 Tag：…")`。

**另有必填输入文件**（第 3 节的可选字段不包含它们，见 §3.1）：`svgPath` 与 `iconMapPath`——两者的**文件始终必填**（脚本无条件做存在性检查），页面没有图标槽位时 `iconMapPath` 给一份合法的空 `icons[]` 即可；`mappingPath`（**所有模式**必填，mapping 的工作落盘路径）；新建页面还要 `dslPath` + `visibilityPath`。

**Layout 清单字段（所有页面必填，无缺省）**：`menuItems`（数组）、`layoutStatus`（`complete` / `none` / `pending`）、`layoutEvidence`（含整数 `matchedBottomBarItems` 与 `unresolvedBottomBarItems`）。Bundle 对每个页面都调 `gen-mtslg-layout.js`，该脚本对这三者的要求与页面有没有底部栏无关，因此**没有底部栏的页面也必须显式给出** `menuItems: []` + `layoutStatus: "none"` + 两个计数为 0（`layoutStatus="none"` 时其余字段必须全为 0）。有底部栏时按 `gen-mtslg-layout-manifest.js` 的机械推导结果填写，且必须满足 `menuItems.length + residentGroupItems === matchedBottomBarItems`；常驻分组的实例数由 `validateResidentGroupEvidence()` 校验（`fail("layoutEvidence.residentGroupItems=" + declared + …)`），MenuItem 不得包含常驻分组实例（`fail("MenuItems 不得包含右下角常驻分组内的实例：…")`）。

## 3. 常用可选字段（缺省即有默认值）

| 字段 | 缺省 | 说明 |
|---|---|---|
| `pageXmlPath` | `Resources/Pages/{name}/{name}Page.xml` | 新建页面**必须**用这个约定路径，写别的值直接失败（`normalizePageManifest()` → `fail("新建页面的 " + field + " 必须使用约定路径: " + expected[field])`） |
| `iconPath` | `Resources/Pages/{name}/{name}Icons.xaml` | 同上 |
| `viewPath` | `UI/{area}/View/{name}View.xaml` | 同上 |
| `codeBehindPath` | `UI/{area}/View/{name}View.xaml.cs` | 同上 |
| `viewModelPath` | `UI/{area}/ViewModel/{name}ViewModel.cs` | 同上 |
| `layoutPath` | `Resources/Layout/Layout.xml` | `normalizePageManifest()` → `manifest.layoutPath = manifest.layoutPath || DEFAULT_LAYOUT_PATH` |
| `csproj` / `rootNamespace` / `projectName` / `projectMode` / `scaffold` / `frameworkConfigPath` | 见脚本 | 目标项目定位与脚手架模式 |
| `languages` | 见下 | `{ "auto", "locales", "bindByText", "requireLangName", "translations" }` |
| `languages.translations` | 无 | `{ 中文文案: 译文 }` 对象或 JSON 文件路径；给了就必须存在（`resolveLangTranslations()` → `fail("languages.translations 必须是 { 中文文案: 译文 } 对象或 JSON 文件路径")`、`fail("languages.translations 文件不存在: ")`） |
| `langGlossary` / `keyCatalog` | 无 | 术语表 / 键目录；给了就必须存在（`resolveLangCatalogPaths()` → `fail("keyCatalog 文件不存在: ")`；`resolveLangGlossary()` → `fail("langGlossary 必须是术语表对象或 JSON 文件路径")`、`fail("langGlossary 文件不存在: ")`） |
| `nesting` | 默认开启 | `{ "enabled": false }` 可关掉容器嵌套重挂 |
| `excludeInstances` | 无 | 逗号/空白分隔的实例 ref，排除出映射 |
| `runRegistry` | 无 | **运行登记表绑定**（推荐由 `run-all.ps1` 写入）：`{ path, runId, digests }`。给了就**只按登记表解析采集输入**（DSL 快照 / 可见性 / extractSvg）、逐项复校 sha256，并拒绝"未登记的旧同名文件"；详见 §7 |
| `generatedRoot` / `pagesRoot` / `iconsRoot` / `indexRoot` / `sourceRoot` / `resourceRoots` | 见脚本 | 目录约定覆盖 |

`viewName` / `viewModelName` / `xmlPageName` / `pageTarget` / `pageLangName` / `pageTitleText` / `comment` 缺省由 `name` 派生（`{name}View` / `{name}ViewModel` / `{name}Page` / `{name}` / `{name}PageTitle`）。

> `contentOriginY` **不是清单字段**：清单里写它不会被读取。`192` 的规则作用在 **mapping** 上——`gen-mtslg-mapping-from-dsl.js` 恒写 `contentOriginY: 192`，`gen-mastergo-page-bundle.js` 与 `validate-iocontrol-provenance.js` 对非 192 的 mapping 直接失败（坐标细则见 `mtslg-mode.md` 第 3 节）。

## 3.1 输入文件（必填 / 条件必填，**不属于**第 3 节的可选字段）

| 字段 | 必填性 | 说明 |
|---|---|---|
| `svgPath` | **必填** | `extractSvg` 落盘的 JSON；没有运行时 Icon 时也必须给合法的 `{ "svgs": [] }` 文件（`main()` → `[svgPath, iconMapPath, templateMapPath]` 逐个做存在性检查，`fail("输入文件不存在: ")`） |
| `dslPath` + `visibilityPath` | **新建页面必填** | 同时提供且文件存在；mapping 由本次生成创建（`main()` → `fail("新建页面必须提供当前页面的 dslPath 和 visibilityPath；mapping 将在本次生成中创建")`、`fail("dslPath/visibilityPath 输入文件不存在")`） |
| `mappingPath` | **必填（所有模式）** | mapping 的**工作落盘路径**：新建页面时由本次生成写入（随后会被重新生成覆盖，不是输入真值）；已有页面在未提供 `dslPath`/`visibilityPath` 时作为已有 mapping 读入。**不要指向 `Generated/<页面名>.mapping.json`（审计产物）**——新建模式下会因"目标文件已存在"失败（`main()` → `fail("必须提供 mappingPath：…")`、`fail("mappingPath 不能与审计产物同路径: ")`）。 |
| `iconMapPath` | **必填（文件始终必填）** | 图标台账输入；脚本无条件做存在性检查，**没有图标槽位的页面也必须给一份合法的空 `icons[]` 文件** |
| `templateMapPath` | 可选 | 缺省 = 插件内 `mtslg-iocontrol-map.json`（脚本常量 `DEFAULT_TEMPLATE_MAP`）；它是**脚本在生成期读取**的运行期输入，只是不需要模型预读进上下文 |

## 4. 前置条件：**csproj 登记必须人工先做好**

Bundle **不会**把新页面的文件写进 `.csproj`（实测 `csprojChanged=False`），它只做两件事：

1. **校验**：`pageXmlPath`、`iconPath`、View / View.xaml.cs / ViewModel、`layoutPath`、各语言文件若**未在 csproj 登记 → 直接失败**（`validateBundleOutputs()` → `fail("csproj 未注册生成文件: ")`）。
2. **唯一自动补写**：`Resources\Layout\Layout.xml` 的 `<Content Include>` 行缺失时自动补（`ensureLayoutContent()`）。

因此新建页面的顺序固定为：

```
① 先在 .csproj 登记 7 条（2 Compile + 4 Page + 1 Content）
② 再跑 bundle（Layout.xml 的新 <Page> 注册由 bundle 自动增量写入，写入前备份）
③ bundle 自己跑完后的硬校验（见第 5 节）
```

## 5. bundle 自带的后置硬校验（失败即整次生成失败）

| 校验 | 脚本锚点（函数 + fail 文案） |
|---|---|
| 页面 XML 根节点是 IOContorl 格式 | `validateBundleOutputs()` → `fail("页面 XML 根节点不符合 IOContorl 格式: ")` |
| Icon 是完整 ResourceDictionary，只用内联 `Geometry`，带 `o:Freeze=True` + `x:Key`，无重复键 | `validateBundleOutputs()` → `fail("页面 Icon 不是完整 ResourceDictionary: ")`、`fail("页面 Icon 使用了不兼容的几何结构；必须只使用 Geometry 内联路径: ")`、`fail("页面 Icon 的 Geometry 缺少 o:Freeze=True 或 x:Key: ")`、`fail("页面 Icon 存在重复 Geometry 资源键: ")` |
| 页面引用的每个 Geometry 都已生成 | `validateBundleOutputs()` → `fail("页面实际引用了未生成的 Geometry: ")` |
| icon-map 审计含 `icons` / `candidates` / `unmapped` | `validateBundleOutputs()` → `fail("页面 Icon mapping 审计缺少 icons/candidates/unmapped 数组: ")` |
| **Layout.xml 缺少当前页面注册即失败** | `validateBundleOutputs()` → `fail("Layout.xml 缺少当前页面注册: ")` |
| View XAML 含 MaxWell `PageDesign` 宿主 | `validateBundleOutputs()` → `fail("View XAML 缺少 MaxWell PageDesign 宿主: ")` |
| 各语言 key 完全一致（含顺序）；`LangName` 必须命中本页字典 | `validateLangOutputs()` → `fail("多语言文件 key 数量与语言清单不一致: ")`、`fail("各语言 key 必须完全一致（含顺序）: ")`、`fail("LangName 引用了本页多语言文件中不存在的 key：")` |
| provenance 硬校验（`validate-iocontrol-provenance.js`） | `main()` → `run(PROVENANCE_SCRIPT, ["--xml", tempXml, "--mapping", tempMapping])` |
| 坐标逐控件核对（`check-iocontrol-coords.js`） | `validateBundleOutputs()` → `run(COORDS_SCRIPT, ["--xml", info.pageXmlPath, "--nodes", <coords.json>])` |

## 5.1 统一文件登记与收尾清理

每次生成结束，bundle 在自己写的审计 `Generated/<页面>.bundle.manifest.json` 里落一份**统一文件登记**，回答"这次到底碰了哪些文件、哪些是项目文件、哪些是副本"。`files[]` 是**唯一**文件清单——不再另设 `generated[]` 之类的重叠字段（两份清单必然漂移）。

| 字段 | 含义 |
|---|---|
| `files[]` | **本次运行**涉及的全部文件，每条 `{ path, kind, dependsOn?, removed? }`；`path` 是项目相对路径（`/` 分隔） |
| `files[].kind` | `project` = 项目产物（页面 XML / 页面 Icon / View 三件套 / Layout / 语言文件 / `.csproj` / `framework.config.json`），**永不清理**；`audit` = 交付与来源证据（mapping / icon-map / nesting-report / 译文与术语表 / 本审计文件，以及 DSL 采集产物 `dsl.snapshot.json`、`visibility.json`、`extractSvg.json`、`getDsl.json`、`coverage-report.json`、`manifest.json`、`timing.json` 等生成目录顶层文件），**保留**；`work` = 中间工作文件（`<generatedRoot>/_work/**` 下的输入清单、派生清单、校验脚本与日志），**收尾删除**；`backup` = **本次运行新产生**的 `.bak-<时间戳>` 副本（含 Bundle 自身的，以及子脚本 `gen-mtslg-layout.js` / `gen-mw-wpf-page.js` 备份的那些），**每个目标文件只保留最近 2 份** |
| `files[].dependsOn` | 归属关系。当前用于 View 的 code-behind：它登记为 `project`，并标出主文件 `…View.xaml`——`.csproj` 里的 `<DependentUpon>` 与这里同源 |
| `inputs` | 本次运行的输入清单快照。`_work/` 被收尾删除后，本次输入仍可从审计复原 |
| `cleanup.work` | `{ enabled, removed[] }`：本次是否执行 work 清理、实际删掉了哪些文件 |

**登记边界（避免误判"漏项"）**：登记表的范围是**本次运行**，不是"项目当前状态"——同一项目后续会有多个页面，把非本次的东西全登记进来只会让表失去意义。因此只登记本次运行涉及的项目内文件：清单里指向项目外的输入（如放在别处的 DSL 快照）不登记；`README.md`、`docs/*.md`、`docs/page-registry.json` 这类**人工维护**的项目文档不登记；**历史 `.bak-<时间戳>` 副本也不登记**（只有本次运行新产生的那些才入表）。据此，"登记表 vs 磁盘"核对时，允许的差异只有这几类：人工文档、项目外输入、历史备份、本次已删除的 `work`。

`work` 清理**默认开启**（重跑本来就要重新走一遍），`manifest.cleanup = { "work": false }` 可关闭；关闭时中间文件全部保留，审计写 `cleanup.work.enabled=false`、`removed=[]`。清理只删"登记为 `work`、路径含 `_work/` 段、且解析后仍在项目内"的文件，任何一步校验不过一律跳过——**清理失败不中断生成**。审计文件已存在且未加 `--overwrite` 时，bundle 在**删除任何 work 文件之前**失败，避免"先删后报错"。

## 6. 与本文的关系

字段的**取值口径**（而不是字段本身）由各专属章节规定：页面名见 `mtslg-mode.md` 第 1 节；图标台账见 `page-build-rules.md` 第 2 节；语言键见 `page-build-rules.md` 第 3 节。本文只回答"清单能写哪些字段、必填是哪几个、缺省会怎样"。

## 7. 运行登记表（run registry，`Generated/runs/<Target>/run.json`）

采集产物按页归档在 `Generated/runs/<Target>/`。登记表是**本次运行的唯一事实源**：产出即登记、消费只按登记取、
未登记的旧同名文件一律拒绝——避免把上一次运行留下的同名采集文件当成本次输入。

| 字段 | 含义 |
|---|---|
| `runId` | 本次运行的身份；清单 `runRegistry.runId` 与它不一致直接失败 |
| `identity` | `{ fileId, layerId, ui, designPageName }`（来自命令行或 `docs/page-registry.json`） |
| `inputs` | 页面级语义输入 + 指纹：`pageTitleText`、`translations{path,sha256,size}`、`glossary`、`iconNaming` |
| `artifacts` | 本次运行产出的中间产物：`getDsl / snapshot / coverage / dslManifest / timing / visibility / extractSvg / mappingDraft / iconCandidates / iconMap / layoutManifest / bundleManifest`，每条 `{path, sha256, size, mtime, step}` |
| `steps` | 每一步 `{id, name, status, seconds, note, log, at}`（失败步骤也登记） |
| `outputs` | Bundle 审计的 `files[]` 并回：每条 `{kind, dependsOn, exists, sha256}`——输入登记与输出登记共用同一个 `runId` |

**硬规则**

1. **产出即登记**：`run-all.ps1` 每一步成功后就登记该步产物（`run-registry.mjs artifact`）；中途失败也把该步状态写进 `steps`。
2. **消费只按登记**：`build-bundle-manifest.mjs <…> <area> --run-json <run.json>` 从登记表取 `snapshot` / `visibility` / `extractSvg`，并把 `sha256` 写进清单 `runRegistry.digests`；Bundle 读清单时**复校**：路径按登记表解析、`sha256` 与 `digests` 一致、`runId` 一致。**`--run-json` 是必填**——缺了直接报错，不再回落到顶层 `Generated/*.json`（`area` 同理必填，推导只在 run-all.ps1 里做一次）。
3. **未登记的旧同名文件一律拒绝**：Bundle 直接失败并点名它**实际消费的三个采集输入**——`Generated/dsl.snapshot.json`、`Generated/visibility.json`、`Generated/extractSvg.json`（内容与本次登记恰好一致时只提示可清理）。其余同层文件（`Generated/coverage-report.json`、`Generated/manifest.json`、`Generated/timing.json`、`Generated/getDsl.json`）不参与输入解析，由 `run-registry.mjs check` 按同一张 `LEGACY_SHADOWS` 表列出。
4. **断点续跑**：`run-all.ps1 -Progress <步骤>` 用 `run-registry.mjs init --keep` 沿用同一份登记表。登记表必须存在且 schema 受支持；`target`、归一化后的 `projectRoot` 与 `identity{fileId, layerId, ui, designPageName}` 不得改变，也不得为已登记产物补写原先缺失的身份。CLI 省略的 identity 字段保留原值；显式传入的非空值必须相同。守卫失败发生在保存之前，原登记表逐字节不变。标题、译文、术语表与图标命名仍是可修改的语义输入。
   - `identity` 保存的是**来源与运行配置**，不是全都来自设计侧；`ui` 是已冻结的区域配置，决定快照元数据与宿主目录。续跑要求解析后的**值**一致，不要求它仍来自同一参数来源。
   - **守卫失败但仍想继续**：失败说明解析后的值确实与登记表不同（不是误报）。`run-all.ps1` 每次调用都按「命令行 → 项目登记表」重新解析这四项，因此补登记或改动项目登记表同样会命中守卫；按同一方式显式传回原值即可续跑（`-Ui` / `-DesignPageName` / `-FileId` / `-LayerId`）。守卫只比对**显式传入的非空值**：`fileId` / `layerId` 缺值在守卫之前就报错，`ui` / `designPageName` 省略则不触发守卫——其中省略 `designPageName` 会让本次 snapshot 的 `pageName` 退回 DSL 根节点名、与冻结身份不一致，而复校项（路径 / `sha256` / `runId`）不含 `pageName`，因此不会报错；要保持冻结身份就必须显式传回该值。
   - **确实要改（或无可续跑）**：要改来源或运行配置时，先归档原运行目录与原始 capture，再从 `fetch` 新开运行（新 `runId`，产物登记清空）；登记表缺失时无物可归档，直接从 `fetch` 新开运行。两种情形都不得通过编辑 `run.json` 绕过守卫。
5. **手工调用**：`node scripts/run-registry.mjs init|artifact|step|path|check|outputs|show`。不带 `--key` 的 `check` 只检查本次已登记的产物，允许未完成的运行；显式 `check --key <产物键>` 必须命中 `ARTIFACT_KEYS` 且该产物已登记，否则非零退出，不能静默跳过。两种方式都复算所检查文件的 sha256，并核对旧同名文件；`--quiet` 只关闭成功摘要，不豁免任何失败。
