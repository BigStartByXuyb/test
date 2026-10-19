---
name: inteplm-deliverable-docs
description: 仅在 IntePLM 链接指向 MEL6611 V100R001 项目，或用户明确指定该项目，并要求新建交付物文档（包括生成编号、填写表单或上传文件）时触发。
---

# IntePLM 交付物文档创建与上传

## 触发条件

1. 用户提供指向 `MEL6611 V100R001` 项目的 IntePLM 链接，并要求新建交付物文档（包括生成编号、填写表单或上传文件）。
2. 用户明确指定 `MEL6611 V100R001`，并要求新建交付物文档（包括生成编号、填写表单或上传文件）。
3. 单独出现“交付物”“新建文档”“上传文件”等通用词，不触发本 Skill。

## 前置

1. 用户已登录。密码由用户在浏览器里自己输入。
2. Windows 主机已安装 Edge、Node.js、npm 和全局 `@playwright/mcp`。Edge 必须支持远程调试；设置 `INTEPLM_EDGE_PATH`，或将 `msedge.exe` 加入 `PATH`。

3. 启动专用 Edge:

```powershell
$edgePath = $env:INTEPLM_EDGE_PATH
if (-not $edgePath) { $edgePath = (Get-Command msedge.exe -ErrorAction Stop).Source }
$profileDir = Join-Path $env:USERPROFILE '.codex\browser-profiles\inteplm'
& $edgePath --remote-debugging-port=9222 "--user-data-dir=$profileDir" --no-first-run --no-default-browser-check 'http://192.168.0.218:7002/'
```

4. 配置 Playwright 模块并调用脚本。`<skill-dir>` 是当前 `SKILL.md` 所在目录的绝对路径，由调用方的 Skill 安装路径解析；脚本路径不依赖终端当前目录。

```powershell
$npmGlobalRoot = (npm root -g).Trim()
$playwrightNodeModules = Join-Path $npmGlobalRoot '@playwright\mcp\node_modules'
if (-not (Test-Path (Join-Path $playwrightNodeModules 'playwright'))) { throw '请先安装全局 @playwright/mcp 包' }
$env:NODE_PATH = $playwrightNodeModules
node "<skill-dir>/scripts/plm.cjs" [--frame=documentLayout/create] [--page=<索引>] <命令> [参数]
```

新建文档表单在内嵌 frame 里，操作表单必须加 `--frame=documentLayout/create`；表单底部的“取消/确定”在外层页面，位置选择弹窗的“确定”由 `setLocation` 自动处理。

## 命令

| 命令 | 参数 | 用途 |
| --- | --- | --- |
| pages | | 列出标签页索引和 URL |
| snap | 名称 | 截图 + 页面文本 |
| frames | | 列出 frame |
| numberOptions | 项目号和版本 | 列出编号候选项 |
| evalFile | JS 函数文件 | 在当前页面或 frame 中执行函数 |
| jsClick | 选择器 | 点击元素 |
| jsText | 选择器 文本 | 聚焦后真实键盘输入(下拉筛选只能用这个) |
| numberGen | 项目号和版本 精确选项文本 | 精确选择唯一候选项并生成编号 |
| setName | 名称 | 写名称 |
| setLocation | 位置节点名 | 选存储位置 |
| upload | 本地文件路径 | 添加文件 |
| previewRows | 从 0 开始的行索引 | 预览待移除行 |
| removeRows | `--confirm` 从 0 开始的行索引 | 确认后移除指定行 |
| submit | 可选截图标签 | 点确定 |

首次操作先运行 `pages`。脚本只选择 IntePLM 地址 `http://192.168.0.218:7002` 下的标签页；存在多个匹配标签页时，用 `--page=<pages 输出的索引>` 指定目标。没有匹配页或未指定歧义目标时，脚本停止。除 `pages` 外的命令都支持该参数。

`evalFile` 文件只包含一个 JavaScript 函数表达式，例如 `() => document.title`；函数体在当前页面或 frame 中执行。文件路径从终端当前目录解析。

页面选择、编号候选与行索引解析的回归测试：

```powershell
node --test "<skill-dir>/scripts/tests/page-selection.test.js" "<skill-dir>/scripts/tests/number-selection.test.js" "<skill-dir>/scripts/tests/row-selection.test.js"
```

## 流程

1. 进入 `MEL6611 V100R001` 项目 → 顶部 `项目计划` 页签 → 左侧计划树点开对应节点（例：`TR4A评审`）→ 右侧切到 `交付物(已交/总数)` 子页签。
   行选择以「计划树节点路径 + `交付物类型`」为唯一键，三步判断：
   ① 先确定节点路径（从项目根到当前节点，例：`项目计划/TR4A评审`），只在当前节点的子页签表格里选行；
   ② 在该表格中按 `交付物类型` 精确匹配；
   ③ 同一类型有多行时，用 `交付物链接` 列显示的真实名称做二次区分；仍不唯一时先询问用户，不默认取第一行。
   选定后点该行 `交付物链接` 列的第一个按钮（`+`），打开新建文档表单（表单 frame 为 `documentLayout/create`）。
2. 核对 `类型`,与 `交付物类型` 列一致。
3. `numberOptions --frame=documentLayout/create "MEL6611 V100R001"` → 查看编号候选项；依据同一对照表行确认完整选项文本后，运行 `numberGen --frame=documentLayout/create "MEL6611 V100R001" "<精确选项文本>"`。候选项没有唯一匹配时停止。
4. `setName --frame=documentLayout/create <按对照表生成的名称>`。
5. `setLocation --frame=documentLayout/create <位置节点名>`。
6. 电子文件自带一行模板 → `previewRows --frame=documentLayout/create 0`；检查预览仅包含模板行并取得用户确认后，运行 `removeRows --frame=documentLayout/create --confirm 0`。
7. `upload --frame=documentLayout/create <本地文件路径>`:一次一个**本地文件**(不是一份交付件)。同一份交付件含多个文件时,重复本步逐个上传,直到全部上传完。
8. 用户确认后 `submit`。

批量:按**交付件**重复 1-8;一份交付件内的多个文件在第 7 步内部循环。

## 规则

- 编号按对照表同一行读取，格式为项目号 + 一级码 + 二级码 + 流水码。例如系统工程类“测试报告-（机）”一行是 `MEL6611` + `08` + `13` + `01` = `MEL6611081301`。流水码不符合该行规定值时停止并向用户说明，不继续提交；表内 `02`、`03` 是对应行规定的流水码。
- 名称逐字按对照表「优化后交付件名称」生成：先将 `XXX项目` 替换为项目中文名，再将剩余 `XXX` / `xxx` 替换为模块名，最后将 `**` 替换为明确的过程材料名称。模板已有“模块”后缀时，模块名不重复包含该后缀。缺少模块名或材料名时先询问，不保留占位符或自行删除。括号及后缀按该行原样保留。
  例：`XXX项目XXX模块与联合仿真测试方案` → `皮秒大台面钻孔机开发项目<模块名>模块与联合仿真测试方案`。
- 编号自检：按生成编号中的一级码、二级码和系统流水码反查同一对照表行，确认交付物类型相符；任一字段不一致时停止并向用户说明，不修改编号或继续提交。
- `setLocation` 接收一个位置节点名（叶子节点名）；完整存储路径由项目号、版本和节点名组成，例如 `setLocation 需求` 对应 `/MEL6611 V100R001/需求`。
- 对照表名称中的 `/` 分隔候选交付件名称。一次新建只选择与当前需求和本地文件匹配的一个名称；没有唯一匹配时先询问，不把候选名称拼成一个名称。
- 文件匹配时，对本地文件名和「优化后交付件名称」候选应用完全相同的归一化步骤，顺序固定为：去扩展名 → 去空格 → 括号归一（`（）` 与 `()` 视为等价）→ 去掉**开头**出现的项目中文名前缀。项目名固定为本 Skill 支持的项目中文名 `皮秒大台面钻孔机开发项目`；前缀只去开头，出现在名称中间的不去。两侧归一化后若任一侧为空，视为不匹配。表格名称含 `/` 时先拆成候选，再逐个比较；只有一个候选匹配时才使用，无匹配或多匹配时先询问用户。

对照表与分类简称见 [references/deliverable-rules.md](references/deliverable-rules.md)。

Codex 的展示名称、简介和默认提示由 `agents/openai.yaml` 提供；修改 Skill 的适用范围时同步更新该文件。

## 坑

- `交付物`/`子任务`/`工时` 这些是**计划树节点下的子页签**,不是项目顶层页签。不先在 `项目计划` 里点开节点(如 `TR4A评审`),就找不到交付物列表。
- 交付物列表是 vxe 拆表:按表头含 `交付物类型` 定位 grid;`body[0]` 是滚动列、`body[1]` 是名称列,两块**按行号对齐**。`交付物链接` 的 `+` = 该行第 3 个 `td` 里的第一个 `button`。
- 名称输入框不能用"值以 `XXX项目` 开头"定位 —— 改过一次名就失效。按字段特征定位:非 disabled、无 placeholder、值不以 `/` 开头。
- 新建文档的 iframe 会随重渲染换 name,只按 URL 里的 `documentLayout/create` 匹配,不要记 frame name。
- 交付物列表的「名称」列是**只读**的:它来自项目计划模板(立项时生成,`XXX项目…` 是模板占位符),在列表和「设置配置项」弹窗里都不能编辑(弹窗只有删除和 `+ 配置项`)。**不要试图改它** —— 要统一命名只能改计划模板(只影响以后新建的项目),或者在弹窗里删掉配置项再重建(会丢掉已挂的文档链接,已交付的行禁止这么干)。真实交付件名称看「交付物链接」列。

## 确认点

1. 点「确定」前。
2. 删除非模板内容前。
3. 文件匹配不到或有多个候选时。

## 支持项目

- 本 Skill 仅覆盖 `MEL6611 V100R001`，中文名 `皮秒大台面钻孔机开发项目`。其他项目需先补充并验证对应的交付件对照表和配置。
- 配置目录 `~/.codex/browser-profiles/inteplm`,截图 `~/.codex/browser-profiles/inteplm-shots`。
