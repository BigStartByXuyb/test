---
name: inteplm-deliverable-docs
description: 在 IntePLM(http://192.168.0.218:7002)上传交付件、新建文档、填写交付物数据时触发。
---

# IntePLM 交付件上传

## 触发条件

1. 用户给出 PLM 链接并要求填写或上传数据。
2. 用户要求上传交付件、新建文档、生成编号、选存储位置。
3. 出现:交付物、交付件、新建文档、编号生成、存储位置、上传文件。

## 前置

1. 用户已登录。密码由用户在浏览器里自己输入。
2. 启动专用 Edge:

```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' --remote-debugging-port=9222 "--user-data-dir=$env:USERPROFILE\.codex\browser-profiles\inteplm" --no-first-run --no-default-browser-check 'http://192.168.0.218:7002/'
```

3. 设 Playwright 路径并调用脚本。先解析当前 `SKILL.md` 的绝对路径；`<skill-dir>` 是包含该文件的目录。脚本路径相对于 `<skill-dir>`，不依赖终端当前目录。

```powershell
$env:NODE_PATH='C:\Users\Maxwell\AppData\Roaming\npm\node_modules\@playwright\mcp\node_modules'
node "<skill-dir>/scripts/plm.cjs" [--frame=documentLayout/create] <命令> [参数]
```

新建文档表单在内嵌 frame 里,操作表单必须加 `--frame=documentLayout/create`;`取消/确定` 在外层页面。

## 命令

| 命令 | 参数 | 用途 |
| --- | --- | --- |
| snap | 名称 | 截图 + 页面文本 |
| pages / frames | | 列标签页 / frame |
| evalFile | js 文件 | 页面内执行 JS |
| jsClick | 选择器 | 点击元素 |
| jsText | 选择器 文本 | 聚焦后真实键盘输入(下拉筛选只能用这个) |
| numberGen | 搜索词 选项前缀 | 生成编号 |
| setName | 名称 | 写名称 |
| setLocation | 分类节点名 | 选存储位置 |
| upload | 本地文件路径 | 添加文件 |
| removeRows | 行号 | 勾选行并移除文件 |
| submit | 名称 | 点确定 |

## 流程

1. 进入项目 → 顶部 `项目计划` 页签 → 左侧计划树点开对应节点(例:`TR4A评审`) → 右侧切到 `交付物(已交/总数)` 子页签 → 找到该交付物行 → 点 `交付物链接` 列的第一个按钮(`+`),打开新建文档表单(表单 frame 变为 `documentLayout/create`)。
2. 核对 `类型`,与 `交付物类型` 列一致。
3. `numberGen 6611 MEL6611` → 编号自动生成。
4. `setName <项目中文名 + 交付件名>`。
5. `setLocation <一级分类简称>`。
6. 电子文件自带一行模板 → `removeRows 0`。
7. `upload <本地文件路径>`,一次一个。
8. 用户确认后 `submit`。

批量:每份交付件重复 1-8。

## 规则

- 编号 = 项目号 + 一级码 + 二级码 + 流水码,例 `MEL6611`+`03`+`01`+`04` = `MEL6611030104`。流水码取系统生成值。
- 名称 = 对照表「优化后交付件名称」:把开头的 `XXX项目` 换成项目中文名,**并删掉名称中间遗留的 `XXX` 占位**,其余字符原样保留(含 `(机械）` 这类学科标记和 `-TR4A` 后缀)。
  例:`XXX项目XXX测试报告(机械）-TR4A` → `皮秒大台面钻孔机开发项目测试报告(机械）-TR4A`。
- 编号自检:生成的编号末段 = 一级码 + 二级码(如 系统工程类 `08` + 测试报告-（机）`13` → `MEL6611081301`),用它反查匹配的交付物类型对不对。
- 位置 = `/<项目号 版本>/<一级分类>`,例 `/MEL6611 V100R001/需求`。
- 文件匹配 = 本地文件名归一化(去扩展名、空格、括号差异、项目名前缀)后对「优化后交付件名称」。

对照表与分类简称见 [references/deliverable-rules.md](references/deliverable-rules.md)。

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

## 项目

- `MEL6611 V100R001`,中文名 `皮秒大台面钻孔机开发项目`。
- 配置目录 `~/.codex/browser-profiles/inteplm`,截图 `~/.codex/browser-profiles/inteplm-shots`。
