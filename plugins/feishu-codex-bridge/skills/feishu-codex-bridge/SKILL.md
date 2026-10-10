---
name: feishu-codex-bridge
description: 把本机 Codex 接到飞书，用飞书消息驱动 Codex 执行任务并把结果回贴到原消息。用户说“对接到飞书”“用飞书控制 Codex”“飞书远程跑 Codex”“装飞书桥接”“飞书遥控”时使用；只讨论可行性、或只做飞书文档读写时不适用。
---

# 飞书驱动本机 Codex

装好之后：飞书里给机器人发消息 → 本机起一个无头 Codex 会话执行 → 结果自动回贴到那条消息。

## 执行前要定下来的三项口径

| 口径 | 含义 | 取值 |
| --- | --- | --- |
| 谁能触发 | 白名单里的 open_id 或 chat_id | 必须问用户；`doctor.mjs` 会给出当前登录用户的 open_id 作候选 |
| 在哪个目录执行 | Codex 的工作根目录，必须是已存在的绝对路径 | 必须问用户 |
| 开放哪些入口 | `ask`（只读问答）/ `run`（可改文件）/ 两者 | 默认两者都开、默认入口 `ask`；用户没提就用默认 |

前两项必须由用户给出，不要替他决定。

## 步骤

全部命令里的 `<skill>` 指本 skill 目录。

1. 体检：

   ```text
   node "<skill>/scripts/doctor.mjs"
   ```

   它逐项报告 lark-cli 入口、机器人身份、codex 入口、现有配置、常驻状态与事件通道，并给出建议白名单。除事件通道那一项会短暂订阅一次 `im.message.receive_v1` 验证连通性以外，只做检查：不写配置、不发消息、不注册计划任务。任一项 FAIL 就先修：缺 lark-cli 或身份不是 `ready` 时先让用户跑 `lark-cli auth login`。

2. 拿到三项口径后写配置：

   ```text
   node "<skill>/scripts/configure.mjs" --workdir "<绝对路径>" --allow-open-id <ou_xxx> [--modes ask,run] [--default-mode ask]
   ```

   白名单可重复传 `--allow-open-id` / `--allow-chat-id`；一旦传了任一白名单参数，就整体替换旧名单，否则沿用旧名单。命令会打印最终配置；校验不通过会以非零码退出并列出原因。

3. 前台跑一次，端到端验证：

   ```text
   node "<skill>/scripts/bridge.mjs"
   ```

   让用户在飞书里给机器人发 `/status`，收到回复即通。收到后 Ctrl+C 结束前台进程。

4. 注册登录自启（必须用 `-File` 跑 .ps1）：

   ```text
   pwsh -NoProfile -File "<skill>/scripts/Register-FeishuBridgeTask.ps1" -Action install
   ```

   `-Action status` 查询、`-Action uninstall` 注销。

5. 报告：配置路径、白名单、工作目录、开放入口、前台验证结果、常驻状态。

## 飞书侧命令

| 消息 | 行为 |
| --- | --- |
| `/status` | 本地即时回答：运行时长、入口、工作目录、队列、最近任务。不调 Codex |
| `/ask <文本>` | 调 Codex，沙箱 `read-only`，不改文件 |
| `/run <文本>` | 调 Codex，沙箱 `workspace-write`，可改工作目录下的文件 |
| `/help` | 回一条用法说明，内容就是 `bridge.mjs` 里的 `HELP_TEXT` |
| 裸文本 | 按 `defaultMode` 处理 |
| 其它 `/xxx` | 回未知命令，不执行 |

群聊里只认 `/` 开头的消息，不带命令的（含图片、文件）静默丢弃；单聊里裸文本也接，非文本回一条提示。每单任务先回一条「已受理」，跑完再回结果。

## 配置与运行期产物

位置：`%USERPROFILE%\.feishu-codex-bridge\config.json`。

两个 CLI 的入口默认按全局安装布局从 `PATH` 解析（`node_modules/@larksuite/cli/scripts/run.js`、`node_modules/@openai/codex/bin/codex.js`）。装法非标准时用 `FEISHU_BRIDGE_LARK_CLI`、`FEISHU_BRIDGE_CODEX` 指向入口文件；`doctor.mjs` 会打印实际解析到的路径。

| 字段 | 含义 |
| --- | --- |
| `workdir` | Codex 执行根目录 |
| `modes` | 开放入口，`ask` / `run` 的子集 |
| `defaultMode` | 裸文本按哪个入口走，必须在 `modes` 内 |
| `allowOpenIds` | 允许触发的发送者 open_id |
| `allowChatIds` | 允许触发的会话 chat_id；命中即该会话内任何人都能触发 |
| `taskTimeoutMinutes` | 单任务超时，超时结束该次 Codex 进程 |
| `queueLimit` | 排队上限，满了回「队列已满」 |

运行期产物同在这个根目录：`logs/bridge.log`（桥接日志）、`logs/tasks/<message_id>.md`（每个任务的完整 Codex 输出）、`state/`（单实例锁与去重记录）。

## 边界

- 桥接无人应答审批，所以 Codex 固定以 `approval_policy=never` 运行；需要审批的命令会直接失败，不会挂住任务。
- 一次只跑一个任务，其余排队。
- 结果回贴超过 3000 字截断，末尾给出完整输出的落盘路径；任务失败且没有输出文件时，改回 stderr 摘录（上限 1500 字）。
- 自启那一步只支持 Windows：`Register-FeishuBridgeTask.ps1` 依赖 Windows 计划任务与 `pwsh`。其余脚本不依赖平台，非 Windows 上可以直接常驻 `bridge.mjs`。
- 图片、文件、飞书卡片按钮不执行任务。
- 白名单外的发送者、重复投递的同一 `message_id` 静默丢弃，不回消息。

## 脚本职责

| 文件 | 职责 |
| --- | --- |
| `scripts/bridge.mjs` | 常驻入口：监听 → 白名单/去重 → 排队 → 执行 → 回贴 |
| `scripts/configure.mjs` | 写配置，校验失败即退出 |
| `scripts/doctor.mjs` | 只读体检 |
| `scripts/Register-FeishuBridgeTask.ps1` | 登录自启计划任务的注册/注销/查询 |
| `scripts/lib/config.mjs` | 配置根目录、路径口径、配置判据 |
| `scripts/lib/cli.mjs` | 命令名 → 入口文件，以及跑一次命令的公共口径 |
| `scripts/lib/lark.mjs` | 飞书侧：事件监听、回贴消息 |
| `scripts/lib/codex.mjs` | Codex 侧：无头执行一次任务 |

飞书事件字段取自 `lark-cli event schema im.message.receive_v1`：`jq_root_path` 为 `.`，`message_id`、`sender_id`、`sender_type`、`chat_id`、`chat_type`、`message_type`、`content` 都在事件顶层。其中 `content` 是该 schema 定义的预渲染可读文本（text、post、图片等类型都是这个口径），命令前缀判定直接读它。
