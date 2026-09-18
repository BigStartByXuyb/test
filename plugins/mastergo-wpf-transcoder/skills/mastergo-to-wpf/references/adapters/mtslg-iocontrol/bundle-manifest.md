# Bundle 清单字段契约（作业 B）

本文规定 `scripts/gen-mastergo-page-bundle.js --manifest <bundle.json>` 的输入契约。**真值源是脚本本身**（`normalizePageManifest` / `ensureScaffold` / `validateBundleOutputs` / `main`）；本文只登记可核验的部分，脚本变更后必须同步本文。

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
| `replace-existing` | 替换已有页面 | 需配 `--overwrite`，覆盖前逐个备份 |

## 2. 必填字段

| 字段 | 约束 | 脚本位置 |
|---|---|---|
| `name`（或兼容 `pageName`） | 合法标识符 `^[A-Za-z_][A-Za-z0-9_]*$`；两者同时出现必须一致 | `:71` `:74` |
| `area` | 非空字符串（新建页面必须）；决定 View/ViewModel 路径 `UI/<area>/…` | `:77` |
| `projectRoot` | 必须存在（脚手架模式也要明确给出要创建的目标目录） | `:184` `:188` |

**新建页面另需**：`dslPath` + `visibilityPath` 同时提供且文件存在（mapping 由本次生成创建，并必须带 Tag `新页面完整DSL映射`）——`:907` `:913` `:916` `:926`。

## 3. 常用可选字段（缺省即有默认值）

| 字段 | 缺省 | 说明 |
|---|---|---|
| `pageXmlPath` | `Resources/Pages/{name}/{name}Page.xml` | 新建页面**必须**用这个约定路径，写别的值直接失败（`:91`） |
| `iconPath` | `Resources/Pages/{name}/{name}Icons.xaml` | 同上 |
| `viewPath` | `UI/{area}/View/{name}View.xaml` | 同上 |
| `codeBehindPath` | `UI/{area}/View/{name}View.xaml.cs` | 同上 |
| `viewModelPath` | `UI/{area}/ViewModel/{name}ViewModel.cs` | 同上 |
| `layoutPath` | `Resources/Layout/Layout.xml` | `:105` |
| `contentOriginY` | `192` | 只允许 192，写别的直接失败（`:999`） |
| `dslPath` / `visibilityPath` / `svgPath` / `iconMapPath` / `mappingPath` / `templateMapPath` | 无 | 输入文件；`templateMapPath` 缺省用插件内映射表 |
| `csproj` / `rootNamespace` / `projectName` / `projectMode` / `scaffold` / `frameworkConfigPath` | 见脚本 | 目标项目定位与脚手架模式 |
| `languages` | 见下 | `{ "auto", "locales", "bindByText", "requireLangName", "translations" }` |
| `languages.translations` | 无 | `{ 中文文案: 译文 }` 对象或 JSON 文件路径；给了就必须存在（`:393` `:396`） |
| `langGlossary` / `keyCatalog` | 无 | 术语表 / 键目录；给了就必须存在（`:371` `:380` `:382`） |
| `menuItems` / `layoutStatus` / `layoutEvidence` | 无 | Layout 菜单与证据；与 `layoutRules` 联动校验（`:340` `:349`） |
| `nesting` | 默认开启 | `{ "enabled": false }` 可关掉容器嵌套重挂 |
| `excludeInstances` | 无 | 逗号/空白分隔的实例 ref，排除出映射 |
| `generatedRoot` / `pagesRoot` / `iconsRoot` / `indexRoot` / `sourceRoot` / `resourceRoots` | 见脚本 | 目录约定覆盖 |

`viewName` / `viewModelName` / `xmlPageName` / `pageTarget` / `pageLangName` / `pageTitleText` / `comment` 缺省由 `name` 派生（`{name}View` / `{name}ViewModel` / `{name}Page` / `{name}` / `{name}PageTitle`）。

## 4. 前置条件：**csproj 登记必须人工先做好**

Bundle **不会**把新页面的文件写进 `.csproj`（实测 `csprojChanged=False`），它只做两件事：

1. **校验**：`pageXmlPath`、`iconPath`、View / View.xaml.cs / ViewModel、`layoutPath`、各语言文件若**未在 csproj 登记 → 直接失败**（`:773`–`:782`，报 `csproj 未注册生成文件: …`）。
2. **唯一自动补写**：`Resources\Layout\Layout.xml` 的 `<Content Include>` 行缺失时自动补（`ensureLayoutContent` `:808`）。

因此新建页面的顺序固定为：

```
① 先在 .csproj 登记 7 条（2 Compile + 4 Page + 1 Content）
② 再跑 bundle（Layout.xml 的新 <Page> 注册由 bundle 自动增量写入，写入前备份）
③ bundle 自己跑完后的硬校验（见第 5 节）
```

## 5. bundle 自带的后置硬校验（失败即整次生成失败）

| 校验 | 位置 |
|---|---|
| 页面 XML 根节点是 IOContorl 格式 | `:632` |
| Icon 是完整 ResourceDictionary，只用内联 `Geometry`，带 `o:Freeze=True` + `x:Key`，无重复键 | `:636`–`:649` |
| 页面引用的每个 Geometry 都已生成 | `:656` |
| icon-map 审计含 `icons` / `candidates` / `unmapped` | `:660` |
| **Layout.xml 缺少当前页面注册即失败** | `:668` |
| View XAML 含 MaxWell `PageDesign` 宿主 | `:672` |
| 各语言 key 完全一致（含顺序）；`LangName` 必须命中本页字典 | `:596` `:603` `:619` |
| provenance 与坐标核对（`validate-iocontrol-provenance.js` / `check-iocontrol-coords.js`） | `:682` `:760` |

## 6. 与本文的关系

字段的**取值口径**（而不是字段本身）由各专属章节规定：页面名见 `mtslg-mode.md` 第 1 节；图标台账见总 Skill「页面 Icon 文件」；语言键见总 Skill「语言键自动派生」。本文只回答"清单能写哪些字段、必填是哪几个、缺省会怎样"。
