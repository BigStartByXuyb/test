# MTSLG 页面构建规则（输出目录 / 页面 Icon / 多语言 / 辅助脚本）

读取条件：处理**图标命名与几何来源**、**多语言译文与词典**、**页面输出目录解析**、**辅助脚本触发**时读本文。
一键流水线本身的步骤、输入、产物与失败处理不在这里——见 `pipeline-contract.md`。

## 1. 页面输出目录

- **一页一目录**：页面 XML 为 `Resources/Pages/{name}/{name}Page.xml`，页面 Icon 为 `Resources/Pages/{name}/{name}Icons.xaml`，语言字典为 `Resources/Pages/{name}/{name}_{LOCALE}.xaml`；Layout 写入 `Resources/Layout/Layout.xml`；View/ViewModel 写入目标项目声明的 `UI/<区域>/View` 与 `UI/<区域>/ViewModel`。
- 页面名（Target）按 `mtslg-mode.md` 第 1 节的「页面名（Target）的确定口径」确定：先查项目登记表/Layout，未登记时按 `{区域前缀}{英文语义名}` 推导并人工确认一次后写入登记表；推导不出或冲突则落 `pending` 并拒绝生成。
- MTSLG 页面必须写入目标项目的实际运行目录，不能默认写进 `Generated/`。输出路径按以下优先级解析：
  1. 有效的 `framework.config.json.pages_root`；
  2. 目标项目 `.csproj` 已声明的 `Content Include` 页面目录、`Page Include` 图标目录和 `Content Include` 的 `Layout.xml` 路径；
  3. 项目源码、宿主配置与已确认运行目录共同给出的唯一路径；
  4. 只有无法唯一确定运行目录，或用户明确要求静态产物时，才使用 `Generated/`。
- `Generated/` 只保存 mapping/provenance、MCP manifest、图标提取清单、验证脚本与验证结果等溯源/审计文件，不是 MTSLG 运行时的加载目录。
- 正式页面或图标文件已存在时，Bundle 先备份再替换，且必须由用户明确要求 + `operation=replace-existing` + `--overwrite`；不得静默覆盖。
- **全局固定常量：`contentOriginY = 192px`。** 按 `normalizedY = pageAbsY - 192` 计算，只在页面根级扣一次；它不是页面参数、不可被项目/页面/控件改写（细则见 `mtslg-mode.md` 第 3 节）。

## 2. 页面 Icon 文件

每个页面一个 Icon 文件（路径见第 1 节），不得复用或覆盖其他页面的 Icon 文件。`gen-mtslg-page-icons.js` 只创建当前页面的新 ResourceDictionary，目标文件已存在时失败，不做 Icon 合并。

**View 不合并本页 Icon 资源字典**：`mtslg-iocontrol` 路线的宿主壳只输出 `UserControl` 头 + `PageDesign`，不写 `<UserControl.Resources><ResourceDictionary Source="…/<页面名>Icons.xaml" /></UserControl.Resources>`；页面 Icon 文件仍照常生成并按 Icon Page 注册进 `.csproj`。页面 XML 与 Layout 只引用**本页** Icon 文件中已生成的键。

### 2.1 页面级资源命名

- 图标是**页面级资源**：approved 指该名称**已登记在本页图标台账（icon-map 的 `icons[]`）**中。本页自建的语义英文键（优先中文语义对应名）与页面内唯一临时键（`status: "provisional"`）同样算 approved；不要求跨页复用，也不依赖外部键清单。
- 键只要求在本页 `Icons.xaml` 内唯一，并被本页（含 Layout 菜单项）引用。禁止由图层 ID、坐标或几何外观**自动拼名**（如 `MGIcon_<layer-id>`）；按语义为图形起名是允许且要求的。
- 没有目标项目键时，允许使用页面内唯一的临时 Geometry 键，状态标记 `provisional` 并保留 `sourceId` / `sourceRef`；临时键必须写入 mapping/manifest。
- 只有未被任何实际 Icon 槽位引用的 PATH 候选才进入 `candidates` / `unmapped`，不进入 XAML。XAML 注释只写中文名称，溯源与 `keyStatus` 写入 mapping/manifest。

**哪些图形要进本页台账（结论由脚本给出，本表只解释依据）**：判据是「该图形是否被本页某个 Icon 槽位引用」。这条结论由 `discover-mtslg-page-icon-map.js` **机械给出**：每条候选带 `registration.register`（要不要登记）、`registration.basis`（判据名）、`registration.source`（真值源里的具体登记项），输出的 `mustName` 就是命名表**必须恰好覆盖**的候选下标；`build-icon-ledger.mjs` 按它双向门禁——漏定名（槽位引用了却没登记）与多定名（没有任何槽位引用却登记，变成 `Icons.xaml` 里的死资源）都直接失败。判据的唯一实现在 `scripts/adapters/mtslg-iocontrol/lib/icon-registration-policy.js`，取值全部读 `mtslg-iocontrol-map.json`（各变体的 `iconPolicy`、`layoutRules.bottomBar` 下的变体名 / 常驻分组模式 / 装饰名模式）与 `scripts/lib/mastergo-rules.js` 的宿主壳标记词：**本表不复制这些清单，也不要求人工再推一遍**。

结论只有两条依据（"谁会把图形写进产物"），理解这两条即可：

1. **组件模板族**（登记在 map **顶层**的各族）：命中实例的变体登记了图标槽位时，该控件的 `Icon=` 取本页台账条目 → **要登记**。两种"不登记"的语义**互不相同，别合并**：① 该策略声明这个槽位**没有图标** → 没有图形可登记；② 该策略声明图标**由目标项目提供** → 本页不出图，台账里也不该有该条目，多出来的会被剔除并记进审计 `runtimeIcons`。一个按钮挂多个图形时要各自成条、不合并。
2. **布局族**（登记在 map 的 `layoutRules` 下、按**组件名**匹配的那一族，**不是**顶层模板族。该族 `match` 块登记的键 **判定时照 `mtslg-iocontrol-map.json` 读，本表不复制**）：会生成 MenuItem 的按钮，其 `Icon=` 由 layout 脚本从本页台账取 → 其子树里的图形**要登记**；`layoutRules.bottomBar` 登记的**常驻分组**不生成 MenuItem、不占 Index（框架单独处理），其中的按钮**不登记**；变体子树内的背景 / 分割按装饰名模式判，**不登记**。
3. **相机视口内部的绘制**（相机组件族）与**宿主公共栏的图形**：相机视口是整体、宿主栏由宿主提供，两处内部图形**不登记**。其它 omit `role` 的图形同样不登记，角色清单与含义见第 5 节 omit 角色表（该表与 `validate-iocontrol-provenance.js` 的 `OMIT_ROLES` 之间有门禁同步，本表不复制）。

**MenuItem 的图标从哪来**（决定了"要不要登记"为什么重要）：`gen-mtslg-layout-manifest.js` 的 `iconEntryOf()` 拿菜单项实例的 DSL 节点，在**本页图标台账**里按 `ref` → `sourceId` → 几何键查条目，查到就用台账条目的 `name` 写进 `Icon="..."`——**台账里没有就没有 Icon**。

**不要自己判、也不要靠图层名猜**：候选清单里的归属标记（`ownerControlType` 仅覆盖 IconButton / Camera 这类）**只是提示**，底部栏菜单图标不带归属标记——它们的结论由 `registration.basis` 给出（例如布局族菜单项那条写着 `layoutRules.bottomBar.variants`）。看到 `registration.register=false` 就不要登记。两种"判据缺依据"按 `registration.source` 分别修，**都不要当成"不用登记"蒙过去**：`unregistered-variant` = 该变体在映射表里没登记（补变体）；`variant-without-icon-policy` = 变体已登记但漏登记 `iconPolicy`（补字段）。变体归属的取法：mapping 里有 `resolvedTemplates` 就用它，否则从 `componentInstances` 按与 `resolve-mtslg-template-mapping.js` **同一份**判据取（run-all 第 6 步给 discover 的正是这份草稿 mapping）。

**与第 5 节 `host-shell` 的分工（易混，明确写清）**：`host-shell` 是**文本** omit 角色，管的是顶部宿主公共栏的文本，以及**底部栏菜单的文案**（后者由 Layout `MenuItem` 的 Name 承载，不产页面内容节点）。本表管的是**图形**：底部栏 MenuItem 的图标属于页面级资源，照常登记进台账与 `Icons.xaml`。两处说的是同一条底部栏的不同侧面，不是互相排斥——不要因为文案被 omit 就认为其图标也不用登记。

### 2.2 几何来源核对（`verify-icon-source.mjs`，台账生成后必跑；须传 `--naming` 才判失败）

台账条目的几何来源必须能**确定地代表该图标自己的图形**。出现下列任一情形，必须改成 `fromDsl: true` + 该图标 PATH 节点的 ref（否则会把别的图形当成本图标，且静态校验不会报错）：

1. `sourceId` 指向页面根（该条目是整页几何）；
2. `extractSvg` 没有该条目，且命名表未声明 `fromDsl`。

**同一个 `sourceId` 被多条台账条目共用是允许的**（用户已确认）：设计侧多个控件复用同一图形时，`extractSvg` 会把它们归到同一个图形节点，几何仍然是确定的，这类条目照常登记，核对输出只登记共用事实、不判失败。判据是「这条来源是否确定地代表该图标自己的图形」，不是「有没有别的条目用同一条来源」，也不是「图形是否相同」。

**两条支路的机械分界**：该图形在 `extractSvg` 里有条目 → 允许多条台账条目共用（只登记共用事实）；同一几何被去重、本节点在 `extractSvg` 里没有条目 → 判 `sourceId` 不可用，必须走 `fromDsl`（见 2.3）。`discover` 已按「有无条目」自动把候选写成 `fromDsl: true`，因此第 2 条「缺 `extractSvg` 条目且未声明 `fromDsl`」只在手工改过候选清单时才会触发，属冗余校核。

### 2.3 几何取自 DSL（`fromDsl`）

`extractSvg` 只返回 PATH 自身的 `d` + `transform`，几何完全相同的复用实例会被去重（同一个方向图标被旋转/翻转复用：只差组级 `flipV` 或组级 `rotate`），这类方向按钮拿不到条目（即 2.2 里 `sourceId` 不可用那一支）。处理方式：

- 给 `gen-mtslg-page-icons.js` 传入第 4 个参数（DSL 快照 `dsl.snapshot.json`），并在页面图标映射里把这类条目写成 `"fromDsl": true`；
- 默认只合成「PATH 原始 `d` + PATH 自身 `matrix`」并平移到原点；`"bakeAncestorTransform": true` 时额外把祖先节点的 `rotate` / `flipH` / `flipV`（绕各自盒子中心）烘焙进坐标；
- **祖先朝向由脚本自动判定并烘焙**：图标节点的 PATH 祖先链上出现 `rotate` / `flipH` / `flipV` 时，脚本自动改用「DSL + 烘焙」（包括 `extractSvg` 也有条目的情况），并在 stdout 逐条报告供交付说明引用；
- 该模式是机械计算，计算结果即产物：不做视觉判断、不读图、不以「看起来像不像」修改或否决结果；
- 同一组图标几何完全一致（把祖先变换一并算进去后逐字段相同，如「向左」与「向右」）说明设计侧缺少独立图形：照常按槽位语义命名并出图，同时在 mapping 与交付说明中标记待确认、要求设计补图；不得自行镜像、旋转或猜测朝向。

## 3. 页面多语言文件与语言键

每个页面一套语言字典（路径见第 1 节，默认 `CN`、`EN`），由 `gen-mtslg-page-lang.js` 发射，Bundle 通过 manifest 的 `languages` 字段驱动。**多语言是默认能力**：manifest 未提供 `languages` 时按 `languages.auto=true` + CN/EN 生成、派生语言键并强制 `LangName` 引用闭环（审计记 `languagesDefaulted=true`）；只有显式 `languages=false` 或 `languages:{disabled:true, reason:"…"}` 才关闭，关闭原因写入审计 `languageDisabled` / `languageDisabledReason`。

```json
"languages": {
  "auto": true,
  "locales": ["CN", "EN"],
  "translations": "Generated/_inputs/<Target>.lang-translations.json",
  "bindByText": true,
  "requireLangName": true,
  "noLangRefs": ["1:42"],
  "keys": []
}
```

**页面语言字典自包含**：每个页面的 key 全部由本页机械派生（页面标题 / MenuItem / 页面内容），不读、不复制、不引用目标项目的框架字典，因此默认 manifest 不写 `keyCatalog`。`keyCatalog` 是可选的复用开关：只有显式配置时才会读目标项目已登记语言文件并复用同文案的既有 key；开启会把目标字典的文案（含笔误）复制进本页字典并遮蔽框架同名键，只有确实需要跨页面共用同一句文案时才开。

### 3.1 语言键自动派生

`languages.auto=true` 时，Bundle 在 XML/Layout 生成前调用 `gen-mtslg-lang-keys-from-dsl.js`，从当前页 DSL/mapping/Layout 菜单项机械派生 LanguageKey。规则固定、可复现：

1. 页面标题 → `{页面名}PageTitle`，文案取值链：`manifest.pageTitleText`（显式覆盖）→ `mapping.textAudit` 里 `role=page-title` 的 `sourceText`（默认来源）→ DSL 根节点名 → 页面名。实际用到的来源写入审计 `languages.titleSource`。
2. Layout 菜单项 → `MenuItem{名称}`；语义名取值顺序：菜单 `Icon` 资源名去掉 `Geometry` 后缀 → `langGlossary` 术语表 → 该菜单文案的英文译文转 PascalCase → 符号+数字（`+5` → `Plus5`）→ 纯 ASCII 文案 → 值字面编码（`0.000` → `Num0Dot000`）→ DSL 图层英文名 → 兜底 `MenuItemIndex{Index}`（provisional，列入待改名清单）。
3. 页面内容节点（`valueSource=dsl.text`）→ `{页面名}{名称}`；同页文案完全相同的节点共用一个 key（其余节点登记进该 key 的 `sourceRefs`）。语义名按以下优先级回退：
   1. 显式配置 `keyCatalog` 时，目标字典里同文案的既有 key（`scope=shared`）；`MenuItem*` 命名空间不复用给页面内容节点；
   2. 节点 `Icon` 资源名去掉 `Geometry` 后缀；
   3. `langGlossary` 术语表（`{ "中文文案": "EnglishIdentifier" }`，可内联或给 JSON 路径）；
   4. 该文案的英文译文转 PascalCase（按非字母数字切词 → 每个词首字母大写 → 连接；结果必须是 `^[A-Za-z_][A-Za-z0-9_]*$` 且长度 ≥ 3，否则继续往下）；
   5. 正负步进标签（`+5` → `Plus5`、`-1` → `Minus1`）；
   6. 纯 ASCII 文案（`AUX.` → `AUX`）；
   7. 值字面编码（`0.000` → `Num0Dot000`、`9.0%` → `Num9Dot0Pct`、`～` → `SymWave`）；
   8. DSL 图层英文名（过滤 `Dir` / `F1` / `CH1` 之类的结构噪音）；
   9. 兜底 `{页面名}Text{NN}`（页面内唯一、稳定，标记 `provisional`，列入待改名清单）。
4. 名称冲突按稳定数字后缀处理（`HomeStart`、`HomeStart2`），不静默覆盖。
5. **全量多语言**：设计稿给出的每个 `Value` 都产键挂 `LangName`，不按文本形态豁免——纯数字、符号、正负步进标签、百分比、版本号、序列号、IP、日期时间、功能键 `F1`、型号编号照样产键；中英文写法完全相同的文本只是 EN 值等于原文（不记 `pendingTranslations`），逐条留档在审计 `languages.derivation.identicalTextKeys`。**不产键的内容值只有两类**：① 映射表在值槽位登记 `langRefPolicy: "none"` 的节点（当前只有选择框 `Value`），记入 `languages.derivation.valueLangExempt`；② 空文本节点（`Value=""`），照常发射 `Value=""`、不挂 `LangName`、不进任何豁免清单。Layout `MenuItem` 与按钮族带文案的节点同样必须挂 `LangName`。

**槽位级例外（`langRefPolicy: "none"`）**：只允许登记在充当控件 `Value` 的那个槽位（`slots[0]`），且按钮族不开放（按钮文案一律产键）。取值只允许 `"none"`。命中的值不产键、不挂 `LangName`，记入 `valueLangExempt`（不进入 `noLangRefs`）。显式 `languages.keys[]` 指向槽位豁免节点时生成直接失败——该豁免优先于任何显式键。当前登记该策略的只有选择框：它的 `Value` 是运行时由 `IOName` 绑定的默认选中名称，不是要翻译的固定文案；需要多语言的是选项文字，设计稿只画关闭态时选项数据属运行时待绑定，不得编造。

### 3.2 译文输入与交付

- 英文文案由 AI/工程师产出，并以 `languages.translations` 显式落盘（`{ "中文文案": "English Text" }`，可内联或给 JSON 文件路径）。脚本不做翻译、不调用机翻服务，只机械套用这份清单。
- 同一份译文清单同时用于两处：**键名语义名**（第 3.1 节第 3 条第 4 级来源）与**字典 EN 值**（`translatedFromInput` 计数）。译文清单与术语表是页面级输入，写在 `Generated/_inputs/<Target>.lang-translations.json` / `.lang-glossary.json`（人工/AI 产出，`run-all` 的 init 会把它们的指纹记进运行登记表 `inputs`）；Bundle 再把**读入的 JSON 重新序列化（两空格缩进 + 行尾换行）**后写到 `Generated/<Target>.lang-translations.json` / `.lang-glossary.json`，作为随产物归档的副本——内容等价，但**不保证与输入文件逐字节相同**（输入会被重新格式化）。两处用途不同（前者是输入，后者是归档），都不做跨页面共享。
- 英文取值优先级：目标项目已登记字典同 key 的英文 > `translations` 译文 > 中文占位；前两者分别记入 `translatedFromCatalog` 与 `translatedFromInput`。
- 页面标题来源必须逐页核对：`languages.titleSource=mapping.textAudit` 表示取自设计稿原文；`=manifest.pageTitleText` 表示工程师显式覆盖（交付前与 `sourceText` 逐字比对）；`=dslRoot` 表示退回设计画板框名（交付说明单列并要求人工确认）。
- 未翻译条目保留中文占位并记入 `languages.derivation.pendingTranslations`，交付说明必须单列，不得当已完成翻译交付。

### 3.3 LanguageKey 命名约定与引用闭环

- 页面标题 `{页面名}PageTitle`（由 Layout 的 `<Page Target="…" LangName="…PageTitle">` 引用，缺少该 key 直接失败）；菜单项 `MenuItem{名称}`；页面内容 `{页面名}{名称}`。跨页面共享字典的 key 必须显式写 `"scope": "shared"`。
- `group` 不写时按上述三类自动推导；XAML 输出顺序固定为 页面标题 → 页面底部菜单名称 → 页面内容。
- `languages.keys[]` 是 `LangName` 的**唯一真值源**：key 必须是英文标识符且页面内唯一；每个 locale 都必须为每个 key 提供文案，缺一个直接失败；生成后逐文件回读校验各语言文件的 `x:Key` 集合与顺序完全一致。`languages.keys[]` 显式提供的条目优先级最高（按 `key`、`sourceRef`/`sourceRefs`、`menuIndex` 覆盖机械派生结果），**唯一例外**是目标节点所在槽位登记了 `langRefPolicy: "none"`——该情形下属矛盾输入，生成直接失败（不静默忽略、也不静默挂 `LangName`）。
- **引用闭环硬门禁**：页面 XML、Layout `MenuItem`、`<Page LangName>` 中出现的每个 `LangName` 都必须存在于本页语言字典，否则整套生成失败并回滚。
- `LangName` 是附加属性：`TextBlock` 必须同时发射 `Value` 与 `LangName`（`Value` 仍等于设计文本）；带文案的 `IconButton` / `Button` / `StatusButton` 一律挂 `LangName`。
- `bindByText` 默认 `true`：设计文案与 key 的 `CN` 文案逐字相等时自动绑定；同一文案对应多个 key 属于歧义，脚本不猜，直接失败并要求用 `sourceRef` 显式指定。显式引用优先于自动匹配：`sourceRef` 绑定页面节点、`menuIndex` 绑定 Layout `MenuItem`（判据是「数值等于 MenuItem Index」，Index 重排后历史 `menuIndex` 必须同步重排）。
- `noLangRefs` 是显式放行通道：确有节点确认不参与多语言时，由调用方按 DSL ref 写入，生成器只合并保留、不自动写入；交付说明必须列出这些条目。

## 4. 辅助脚本触发矩阵

除 `apply-container-containment.js`（Bundle 默认自动调用）外，以下脚本按场景触发，不被 Bundle 自动包含：

- `resolve-mastergo-visibility.js`：组件映射前强制运行；输出所有节点的有效可见性，是 `gen-mtslg-mapping-from-dsl.js` 生成 mapping/`textAudit` 的事实输入。显隐事实只读当前组件实例的 `componentInfo.properties`：仅当明确的显示槽位属性（如「显示文案」「显示icon」「显示主标题」「显示F」）为布尔 `false` 时隐藏对应槽位；节点自身的 `visible`/`visibility` 与泛化属性不参与判定。
- `scan-mtslg-keys.ps1`：只有存在目标 MTSLG 运行时目录、需要确认 Style/Icon/LangName/IOName/IOCommand 键时运行。
- `gen-mtslg-lang-keys-from-dsl.js`：`languages.auto=true` 时由 Bundle 在 XML 生成前自动调用；也可单独运行以预先审阅派生结果（`--report` 输出待翻译清单、临时键 `provisionalKeys`、中英文写法相同的键 `identicalTextKeys` 与槽位豁免 `valueLangExempt`）。不负责翻译。
- `scan-icon-coords.js`：Icon XAML 已生成且包含 Geometry 时运行。
- `audit-mtslg-feishu-map.js`：组件映射文档或模板 JSON 修改后运行，检查文档覆盖（`unregisteredFamilies` / `unregisteredVariants` / `undocumented` / `duplicateMatchKeys` 必须全为空；`unresolvedSections` 为孤儿章节、`labels` 为文档里当标签用的章节名/尺寸片段，都只是报告项）；文档侧的期望值由脚本**解析文档**得到，不依赖任何手写变体清单。整批同步清单见 `skills/mastergo-iocontrol-document-format/SKILL.md` 的「新增/修改映射的同步清单」。
- `audit-script-duplication.js`：改任何脚本后由 `tests/script-duplication.test.js` 自动运行——同一功能只允许一份实现：复制体（函数体完全相同）直接失败；同名函数必须复用 `scripts/lib/` 或 `scripts/adapters/<适配器>/lib/` 的共享实现，或在 `scripts/lib/script-reuse-registry.json` 登记 reason。
- `cap-window.ps1`：运行时宿主加载成功后做视觉截图验证（默认 `-Method printwindow`，`-Method screen` 为兜底），不能替代 XML/provenance 校验。
- `sync-to-mt.ps1`：静态 XML、来源、坐标与键查证全部通过且用户要求部署到运行目录时运行（属「项目运行时交付」门禁）；同步前强制备份，宿主加载验证在同步之后执行。

Bundle 的固定调用顺序：模板解析 → **容器嵌套重挂（`apply-container-containment.js`，默认开启，可用 `manifest.nesting.enabled=false` 关闭）** → 语言键派生（`languages.auto`）→ LangName 绑定 → XML 生成 → provenance/坐标校验 → Icon discovery/生成 → Layout → 宿主壳 → 最终校验。嵌套重挂把命中 `childPolicy=nested-page-templates` 的容器（信息分组 / 手动控制弹层）按「坐标完全包含」重挂子控件，改写 `parent`/`layoutParent` 并重算 `expectedLeft`/`expectedTop`；报告落 `Generated/<页面名>.nesting-report.json`，审计写入 `nesting: { enabled, containers, reparented, conflicts }`。

## 5. 可见性 omit 角色

`decision=omit` 有两条路径，真值源都是 `scripts/adapters/mtslg-iocontrol/validate-iocontrol-provenance.js`：

- **明确 hidden**：`visibility=false` 的文本按可见性 omit，`omitReason='hidden'`（登记在 `OMIT_REASONS`）。
- **角色驱动 omit**：可见文本按 `role` 省略，`role` 必须落在 `OMIT_ROLES` 集合内；不在集合内时校验直接拒绝。新增任何一种 omit 角色都必须同时登记进该集合，并在本节同步说明。

`OMIT_ROLES` 当前包含：

| 角色 | 含义 |
|---|---|
| `page-title` | 设计稿里的页面大标题：文本或图层名等于设计页名，且落在顶部标题区（`pageAbsY < 192`）。**不限于页面根的直接子节点**——整页被「容器 N」包住时标题同样按本角色 omit（宿主负责渲染标题栏）|
| `host-shell` | 宿主公共栏的**文本**：顶部宿主栏的区域文本，以及**底部栏的菜单文案**（底部栏文案由 Layout `MenuItem` 的 Name 承载，不产页面内容节点）。**只管文本**——底部栏 MenuItem 的**图标**是页面级资源，要登记进本页台账与 `Icons.xaml`，见第 2 节。判定方式：标记词清单登记在 `scripts/lib/mastergo-rules.js` 的 `HOST_SHELL_NAME_MARKERS`（清单以该常量为准，本表不复制），由 `isInHostShell` **沿祖先链逐级取名字**，**任一祖先的名字包含标记词即命中**——不是比对某个固定图层名，所以"名字里带某个词"本身就是命中条件。调用点有 `gen-mtslg-mapping-from-dsl.js`（写文本 role）、`apply-container-containment.js`（容器归属）与登记判据 `scripts/adapters/mtslg-iocontrol/lib/icon-registration-policy.js`（宿主公共栏的**图形**不登记）。**顺序是关键**：登记判据先判模板族与布局族的变体命中，宿主壳标记只在**不属于模板族也不属于布局族**时才生效——所以"祖先名命中标记 → 文本 omit"不会连带把底部栏菜单图标排除（右下角常驻分组另由 `layoutRules.bottomBar.residentGroupPattern` 判成不登记） |
| `excluded-component` | 被 `manifest.excludeInstances` 隔离的组件内部文本 |
| `unmapped-component` | 未命中正式模板的**组件实例**（`INSTANCE`/`COMPONENT`）内部文本，以及命中模板族但结构部分命中（如表格表头可见文本不足）而登记 `pending` 的节点内部文本；纯布局包裹层（`FRAME`/`GROUP`/`LAYER`，未命中模板族且未登记 `pending`）不隔离——按 `mtslg-mode.md` 第 9 节展平，内部控件与文本照常发射 |
| `camera-viewport-internal` | 相机视口内部整体渲染内容（映射表 `cameraTemplates.innerTextPolicy`） |
| `table-data-cell` | 表格行数据（行标题、单位、单元格文本，含输入框实例内部固定文本；映射表 `tableTemplates.innerTextPolicy`） |

组件库来源提示 `_placeholder=true` 不是删除条件：只要文本属于当前页面或当前组件的可见内容，就必须生成。
