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
## 组件集下的结构/父节点类别
### 具体组件实例、固定模板或匹配规则
```

典型路径：

```text
# MasterGo 控件类型：IconButton → MTSLG 映射规则（按父节点分流）
## 父节点=右侧栏：IconButton 按钮族映射关系
### 父节点=右侧栏-左右结构：IconButton 实例
### 父节点=右侧栏-上下结构：IconButton 实例
```

组件规则必须归入正确的组件集/控件类型主标题；不要把组件映射写到通用转码规则或专项规则下。凡是能生成 IOContorl 的 MasterGo 组件，都必须具备同样的映射链：组件集/父节点 → 匹配规则 → 固定模板 → 固定节点 → XML → 字段来源。

## 匹配键

优先使用：

```text
独立组件集名称 + MasterGo 公开变体/属性名 + 真实属性值
```

只有设计稿明确存在组合父子关系时，才使用：

```text
完整父节点语义 + 公开属性名 + 真实属性值
```

组件集 ID、实例 ID、图层 ID 和设计师自定义名称只用于内部来源追踪，不参与唯一匹配。来源追踪信息用于读取证据、审计和回溯，默认不要作为“来源：MasterGo 文件……”等独立正文行写入飞书映射文档；只有全文已有同类来源字段或用户明确要求时才写入。必须保留真实父节点语义；不能只写“左右结构”“上下结构”等缩写。

## 每个映射条目的固定格式（所有组件集统一）

每个组件集、父节点分支和具体变体都必须独立写成：

1. 组件集主标题使用现有文档的 `#` 标题；父节点分支可使用 `##` 标题；
2. `### 匹配规则`，明确独立组件集、完整父节点语义、公开属性名和真实属性值；
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
例外：按钮族（IconButton / Button / StatusButton）的 `PageName`、`IOVisible`、`IOCommand`、`IOEnable`，以及模板含图标字段的 `IconButton` 的 `Icon`、`IconWidth`、`IconHeight`，都属于固定字段：无论固定模板是否逐条声明、无论能否取到来源都必须发射，取不到时写空字符串值（`IconWidth`/`IconHeight` 有图标槽位时改取图标图形节点自身 bbox，四舍五入取整）。模板不含图标字段的 `Button`、`StatusButton` 不发射 `Icon`/`IconWidth`/`IconHeight`。该口径以映射表 `buttonFamily` 与 `controlTypeRequiredAttrs` 为准（映射表位置：以插件根为基准的 `skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/mtslg-iocontrol-map.json`），冲突时以映射表为准。
```

如果多个真实属性值的输出结构完全相同，可以在一个固定模板中明确列出这些真实值；如果结构、Style、节点数量或槽位有任何差异，必须拆成独立固定模板。Table、信息分组、输入框等组件集与 IconButton 使用完全相同的文档结构，不得另起“表格专用”或“组件说明”格式。

### 固定模板标题命名

- 只有一个明确组件集模板时，标题写成 `### 固定模板：组件集=Table`、`### 固定模板：父节点=主菜单` 等，必须指出模板的匹配对象。
- 同一父节点下存在多个结构分支时，每个分支单独命名，例如 `### 固定模板：父节点=右侧栏-左右结构`、`### 固定模板：父节点=右侧栏-上下结构`。
- 同一组件集存在多个公开变体/属性值且输出结构不同，每个真实值单独命名，例如 `### 固定模板：属性 1=真实值`；结构完全相同时才允许合并，并在标题或正文列出全部真实值。
- 禁止使用无法判断命中范围的裸标题 `### 固定模板`；若历史文档存在，新增或修改时应补充组件集、父节点或变体限定词。

## XML 书写规则

- `ControlType`、节点数量、父子关系和槽位顺序由固定模板决定。
- `Value`、`IOName`、`IOCommand`、`IOEnable`、`IOState`、`LangName`、`Left`、`Top`、`Width`、`Height`、`FontSize` 等由对应 MasterGo 节点或已确认配置填充。
- XML 字段顺序沿用文档中相邻模板，不要无理由重新排序。
- 固定模板中已声明的可选字段，MasterGo 未提供时保留对应 XML 属性并输出空字符串值；不在固定模板中的字段不得新增。不得猜值或把缺失字段扩展成新的节点。
- 没有可靠映射时标记“待确认/未映射”，不得静默降级为普通 Button、Border、Canvas 或近似控件。

## 组件与参数分离

文档必须明确：

- 模板固定“生成什么”：ControlType、Style、节点结构、槽位顺序；
- MasterGo 数据决定“填什么”：真实文本、图标、状态、位置、尺寸、字号；
- 每个实例分别读取自己的 layerId/ref、父节点链和 bbox；不得借用相邻实例或同 componentId 实例的参数。

## 特殊规则

- 图标字段随 `ControlType` 的固定模板决定：模板含图标字段的 `IconButton` 恒写 `Icon`、`IconWidth`、`IconHeight`，无图标槽位时写空字符串值；有图标槽位时 `IconWidth`/`IconHeight` 取值是图标图形节点自身的 bbox（不是控件宽高、也不是图标容器尺寸），`Icon` 取已登记的资源键。模板不含图标字段的 `Button`、`StatusButton` 以及其余无图标控件不得出现 `Icon`、`IconWidth`、`IconHeight`。
- `FontSize`、`Height`、`Width` 始终分开表达；`TextBlock` 的 `Height` 固定 `40`、`Width` 固定 `NaN`，不得用字号、行高、文本 bbox 高度或文本 bbox 宽度替代；非 TextBlock 控件的宽高必须来自对应 MasterGo bbox。
- 坐标必须来自对应 MasterGo bbox，并按项目统一内容区坐标规则计算；模板不能决定实例坐标。
- 根级示例标题/工件示教标题按 `design-artifact-title` 规则处理，不得混入业务 XML；保留或剥离都要记录原因。
- Style 或 ControlType 必须有目标框架源码、真实页面或正式映射证据；用户指定但尚未找到运行时键时，明确标记待核对，不得伪造。

## 新增/修改映射的同步清单（必须整批完成）

新增、修改或删除**任意一条映射**时，下列位置必须在同一批改动里保持一致；只改其中一处就等于制造漂移，而漂移不会立刻报错，只会在后续页面生成时才暴露：

1. **机器真值源**：`skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/mtslg-iocontrol-map.json`（以插件根为基准）——模板族结构、`match.property`、`variants` 真实属性值、`controlTypeRequiredAttrs` 必写字段、按钮族 `iconSize` 等。同一个「匹配属性名 + 属性值」只能登记在一个模板族。
2. **人读口径**：本规范约束的映射文档 `skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/feishu-component-library-mapping.md`——按上面的层级、匹配规则、固定模板和 XML 格式补齐同一条映射。
3. **新增模板族时的审计登记**：映射表里新出现 `*Templates` 族时，同步登记到 `skills/mastergo-to-wpf/scripts/audit-mtslg-feishu-map.js` 的家族清单。反向检查（`undocumented`）已能从映射表反查"表登记了、文档没写"，所以漏登记只会让"文档声明了、表里没有"这个方向对该族失效；为保持双向覆盖，新族仍必须登记。
4. **回归用例**：在 `skills/mastergo-to-wpf/scripts/tests/` 下按需补断言（文档覆盖、模板匹配、按钮族图标字段口径、TextBlock 尺寸、坐标等）。
5. **版本号**：`.claude-plugin/plugin.json` 递增；不要在上一轮 CI 未结束时连续推送。
6. **在线同步副本**：发版前把映射文档同步到对应的飞书在线文档（按标题检索定位、不写死地址、整篇重建并记录 revision）。同步工具是可选项、不是交付链路的运行依赖：本机没有该工具时，在交付说明里标注"在线文档未同步"即可，不阻塞本次改动。

改完后按顺序自检，任何一步非零退出都必须修完再提交：

```text
node skills/mastergo-to-wpf/scripts/audit-mtslg-feishu-map.js \
     skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/feishu-component-library-mapping.md \
     skills/mastergo-to-wpf/references/adapters/mtslg-iocontrol/mtslg-iocontrol-map.json
node --test "skills/mastergo-to-wpf/scripts/tests/*.test.js"
pwsh -NoProfile -File skills/mastergo-to-wpf/scripts/tests/mastergo-dsl-pipeline.tests.ps1
```

- 覆盖审计报告里 `missing`（文档声明了但映射表没有）、`undocumented`（映射表登记了但文档正文没提）、`duplicateMatchKeys`（跨模板族重复匹配键）任一非空，都表示这次改动不完整；三者非空时脚本以退出码 2 结束。
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
