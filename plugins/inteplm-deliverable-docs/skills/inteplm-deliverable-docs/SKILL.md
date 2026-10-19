---
name: inteplm-deliverable-docs
description: 仅在 IntePLM 链接指向 MEL6611 V100R001 项目，或用户明确指定 MEL6611 V100R001，并要求创建、更新、编号、填写或上传交付物文档时触发。
---

# IntePLM 交付物文档创建与上传

## 触发条件

1. 用户提供指向 `MEL6611 V100R001` 项目的 IntePLM 链接，并要求创建或更新交付物文档。
2. 用户明确指定 `MEL6611 V100R001`，并要求填写交付物、生成编号或上传文件。
3. 链接指向其他项目时，告知用户本 Skill 仅支持 `MEL6611 V100R001`，并建议使用对应 Skill 或人工流程。
4. 单独出现“交付物”“新建文档”“上传文件”等通用词，不触发本 Skill。

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

新建文档表单在内嵌 frame 里，操作表单必须加 `--frame=documentLayout/create`；`取消/确定` 在外层页面。

## 命令

| 命令 | 参数 | 用途 |
| --- | --- | --- |
| pages | | 列出标签页索引和 URL |
| snap | 名称 | 截图 + 页面文本 |
| frames | | 列出 frame |
| evalFile | JS 函数文件 | 在当前页面或 frame 中执行函数 |
| jsClick | 选择器 | 点击元素 |
| jsText | 选择器 文本 | 聚焦后真实键盘输入(下拉筛选只能用这个) |
| numberGen | 搜索词 选项前缀 | 生成编号 |
| setName | 名称 | 写名称 |
| setLocation | 位置节点名 | 选存储位置 |
| upload | 本地文件路径 | 添加文件 |
| removeRows | 行号 | 勾选行并移除文件 |
| submit | 可选截图标签 | 点确定 |

首次操作先运行 `pages`。脚本只选择 IntePLM 地址 `http://192.168.0.218:7002` 下的标签页；存在多个匹配标签页时，用 `--page=<pages 输出的索引>` 指定目标。没有匹配页或未指定歧义目标时，脚本停止。所有其他命令都支持该参数。

`evalFile` 文件只包含一个 JavaScript 函数表达式，例如 `() => document.title`；函数体在当前页面或 frame 中执行。文件路径从终端当前目录解析。

## 流程

1. 进入项目 → 顶部 `项目计划` 页签 → 左侧计划树点开对应节点(例:`TR4A评审`) → 右侧切到 `交付物(已交/总数)` 子页签 → 找到该交付物行 → 点 `交付物链接` 列的第一个按钮(`+`),打开新建文档表单(表单 frame 变为 `documentLayout/create`)。
2. 核对 `类型`,与 `交付物类型` 列一致。
3. `numberGen --frame=documentLayout/create 6611 MEL6611` → 编号自动生成。
4. `setName --frame=documentLayout/create <按对照表生成的名称>`。
5. `setLocation --frame=documentLayout/create <位置节点名>`。
6. 电子文件自带一行模板 → `removeRows --frame=documentLayout/create 0`。
7. `upload --frame=documentLayout/create <本地文件路径>`,一次一个。
8. 用户确认后 `submit`。

批量:每份交付件重复 1-8。

## 规则

- 编号按对照表同一行读取，格式为项目号 + 一级码 + 二级码 + 流水码。例如系统工程类“测试报告-（机）”一行是 `MEL6611` + `08` + `13` + `01` = `MEL6611081301`；流水码必须使用系统生成值并与该行一致，表内 `02`、`03` 是对应行规定的流水码。
- 名称逐字按对照表「优化后交付件名称」生成：仅当表格行包含 `XXX项目` 时才替换为项目中文名；`XXX` / `xxx` 替换为该交付物对应的模块名；`**` 替换为明确的过程材料名称。模板已有“模块”后缀时，模块名不重复包含该后缀。缺少模块名或材料名时先询问，不保留占位符或自行删除。括号及后缀按该行原样保留。
  例：`XXX项目XXX测试报告(机械）-硬件类测试报告` → `皮秒大台面钻孔机开发项目<模块名>测试报告(机械）-硬件类测试报告`；缺少模块名时先询问，不提交占位符。
- 编号自检：按生成编号中的一级码、二级码和系统流水码反查同一对照表行，确认交付物类型相符。
- 位置 = `/<项目号 版本>/<位置节点名>`,例 `/MEL6611 V100R001/需求`。
- 文件匹配 = 本地文件名归一化(去扩展名、空格、括号差异、项目名前缀)后对「优化后交付件名称」。

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
