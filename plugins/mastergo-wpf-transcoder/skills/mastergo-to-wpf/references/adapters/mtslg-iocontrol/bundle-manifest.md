# Bundle 清单字段契约（作业 B）

本文规定 `scripts/gen-mastergo-page-bundle.js --manifest <bundle.json>` 的输入契约。**真值源是脚本本身**（`normalizePageManifest` / `ensureScaffold` / `validateBundleOutputs` / `validateLangOutputs` / `main`）；本文只登记可核验的部分，脚本变更后必须同步本文。

**脚本锚点写法（强制）**：本文各处只写「函数名 + `fail(...)` 文案 / 关键表达式」，**不写绝对行号**——行号会随脚本增删漂移，锚点可直接在脚本里检索核对。

调用方式：

```
node scripts/gen-mastergo-page-bundle.js --manifest <bundle.json> [--overwrite]
```

`--overwrite` 仅允许用于 `operation=modify-existing` / `replace-existing`；新建页面传了会被拒绝。

## 1. 模式

| `operation` | 含义 | 已有文件处理 |
|---|---|---|
| 不填 | **新建页面** | 目标文件已存在即失败（`页面目标文件已存在，未覆盖`） |
| `modify-existing` | 修改已有页面（merge） | 允许合并，不整文件覆盖 |
| `replace-existing` | 替换已有页面 | 需配 `--overwrite`，覆盖前逐个备份；同一目标文件只保留最近 2 份 `.bak-<时间戳>` |

## 2. 必填字段

| 字段 | 约束 | 脚本锚点（函数 + fail 文案） |
|---|---|---|
| `name`（或兼容 `pageName`） | 合法标识符 `^[A-Za-z_][A-Za-z0-9_]*$`；两者同时出现必须一致 | `normalizePageManifest()` → `fail("manifest 必须提供合法页面 name（或兼容字段 pageName）")`、`fail("manifest.name 与 manifest.pageName 必须一致")` |
| `area` | 非空字符串（新建页面必须）；决定 View/ViewModel 路径 `UI/<area>/…` | `normalizePageManifest()` → `fail("新页面必须提供 area")` |
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
| `contentOriginY` | `192` | 只允许 192，写别的直接失败（`main()` → `fail("contentOriginY 必须固定为 192")`） |
| `csproj` / `rootNamespace` / `projectName` / `projectMode` / `scaffold` / `frameworkConfigPath` | 见脚本 | 目标项目定位与脚手架模式 |
| `languages` | 见下 | `{ "auto", "locales", "bindByText", "requireLangName", "translations" }` |
| `languages.translations` | 无 | `{ 中文文案: 译文 }` 对象或 JSON 文件路径；给了就必须存在（`resolveLangTranslations()` → `fail("languages.translations 必须是 { 中文文案: 译文 } 对象或 JSON 文件路径")`、`fail("languages.translations 文件不存在: ")`） |
| `langGlossary` / `keyCatalog` | 无 | 术语表 / 键目录；给了就必须存在（`resolveLangCatalogPaths()` → `fail("keyCatalog 文件不存在: ")`；`resolveLangGlossary()` → `fail("langGlossary 必须是术语表对象或 JSON 文件路径")`、`fail("langGlossary 文件不存在: ")`） |
| `nesting` | 默认开启 | `{ "enabled": false }` 可关掉容器嵌套重挂 |
| `excludeInstances` | 无 | 逗号/空白分隔的实例 ref，排除出映射 |
| `generatedRoot` / `pagesRoot` / `iconsRoot` / `indexRoot` / `sourceRoot` / `resourceRoots` | 见脚本 | 目录约定覆盖 |

`viewName` / `viewModelName` / `xmlPageName` / `pageTarget` / `pageLangName` / `pageTitleText` / `comment` 缺省由 `name` 派生（`{name}View` / `{name}ViewModel` / `{name}Page` / `{name}` / `{name}PageTitle`）。

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

## 6. 与本文的关系

字段的**取值口径**（而不是字段本身）由各专属章节规定：页面名见 `mtslg-mode.md` 第 1 节；图标台账见总 Skill「页面 Icon 文件」；语言键见总 Skill「语言键自动派生」。本文只回答"清单能写哪些字段、必填是哪几个、缺省会怎样"。
