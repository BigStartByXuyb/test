# Plugin Marketplace CI/CD 总体设计

## 1. 目标

为 `Plugins` 建立一套 PR/MR CI/CD 流程，保证插件在提交变更后先通过确定性检查，再接受 Claude Code 的完整语义审计，并把最终结果回写到 PR/MR 评论。

核心顺序固定为：

```text
PR/MR 触发
  -> 脚本检查目录结构和配置
  -> 检查失败：直接失败并评论，不调用 Claude
  -> 检查通过：读取本次提交插件的完整内容
  -> Claude Code CLI 语义审计
  -> 解析结构化 Markdown
  -> 回写 PR/MR 评论并发布 artifact
```

1. **确定性检查**：验证 marketplace、`plugin.json`、目录结构、引用关系、版本和文件格式。
2. **Claude Code 语义审计**：检测插件之间或插件内部的上下文冲突、职责重复、规则矛盾、表述不清、结构分流不清、无消费者的兼容分支以及不可达资源。

Claude 的审计结果必须是可解析的结构化 Markdown。高置信度且有明确证据的严重问题阻断合并；措辞优化、一般冗余和低置信度问题只作为 PR 评论。

本设计的语义规则和报告格式由 [plugin-semantic-audit.md](./plugin-semantic-audit.md) 定义，本文件负责整个 CI/CD 生命周期和组件协作。

## 2. 当前仓库事实和边界

- 代码托管平台：GitHub，远端为 `data_ai/plugins`。
- marketplace 清单：`.claude-plugin/marketplace.json`。
- 插件目录：`plugins/<plugin-name>/`。
- 插件清单：`plugins/<plugin-name>/.claude-plugin/plugin.json`。
- 当前已有 Claude Code 严格校验命令：`claude plugin validate --strict --json`。
- Claude Code CLI 通过 DeepSeek 的 Anthropic 兼容接口运行，模型固定为 `deepseek-v4-flash`；API key 只存储在 CI Secret 中。
- 当前没有已确认的第三方 marketplace 上传 API；v1 的“发布”定义为通过门禁后生成版本化插件包和 GitHub artifact/release。真正的外部上传适配器另行接入。

## 3. 总体架构

```text
PR / push / tag
      |
      +--> deterministic-validation  --失败--> required check failed + PR/MR comment
      |
      +--> semantic-audit (needs: deterministic-validation, trusted/read-only)
      |          |
      |          +--> build audit bundle
      |          +--> claude -p with fixed prompt
      |          +--> parse Markdown report
      |          +--> PR/MR comment + artifact
      |          +--> BLOCK / INVALID --> required check failed
      |
      +--> publish-gate (only after required checks pass)
                 |
                 +--> package marketplace and plugins
                 +--> validate package again
                 +--> upload artifact / create release
```

CI 由三个职责隔离的单元组成：

- `deterministic-validation`：不需要秘密，可对所有 PR（包括外部 fork）运行。
- `semantic-audit`：只运行可信工作流；Claude 只能读取审计 bundle，不执行插件代码、不调用网络、不写文件。
- `publish-gate`：只对默认分支或受保护 tag 执行，负责生成发布物，不自动修改源代码。

## 4. 工作流和触发条件

### 4.1 PR/MR 结构和配置校验

工作流建议：`.github/workflows/plugin-ci.yml`。

触发事件：

- `pull_request`：`opened`、`synchronize`、`reopened`、`ready_for_review`。
- `workflow_dispatch`：允许维护者对指定 PR 手动重跑。

执行内容（必须先于 Claude 语义审计）：

1. checkout PR 合并提交或 PR head。
2. 找出变更的插件和 marketplace 文件。
3. 对根 marketplace 及所有受影响插件运行 `claude plugin validate --strict --json`。
4. 运行仓库自己的确定性检查器，检查版本、路径、引用、重复公开入口和不可达文件。
5. 上传 JSON 校验报告和文件清单 artifact。
6. 校验失败时直接回写失败原因到 PR/MR，并结束流水线；不得调用 Claude。

该工作流绝不读取 `ANTHROPIC_API_KEY`。

### 4.2 PR/MR Claude 完整语义审计

语义审计必须声明 `needs: deterministic-validation`。只有结构和配置检查成功后，才启动 Claude CLI。建议仍放在 `.github/workflows/plugin-ci.yml` 中，但作为独立 job；也可以拆成 `.github/workflows/plugin-semantic-audit.yml`。

自动触发：

- 同仓库分支的 `pull_request_target`：`opened`、`synchronize`、`reopened`、`ready_for_review`。

手动触发：

- `workflow_dispatch`，输入 `pr_number`。
- 用于外部 fork PR；维护者确认 PR 内容安全后手动启动。

安全要求：

- 工作流文件来自默认分支，不使用 PR 分支中的 workflow 或脚本。
- 不 checkout 或执行 PR 分支代码；只通过 Git 对象读取 diff 和文件内容。
- PR 内容只作为文本数据放入 audit bundle。
- Claude 使用 `--bare`、`--no-session-persistence`、`--output-format text`、`--permission-prompts none`，不开放写入、Shell、MCP、Hook、LSP 或网络工具。
- Secret 仅作为 Claude 进程的环境变量存在，不能写入 bundle、日志、评论或 artifact。
- Job 权限最小化：读取代码和写 PR/MR 评论；不授予 push、tag、release 或仓库管理权限。

审计输入必须包含本次 PR/MR 提交的插件完整目录内容，而不是只提供 diff 片段。范围至少包括 `plugin.json`、所有 `SKILL.md`、references、scripts、assets、commands、agents、hooks、MCP/LSP/settings 以及其他随插件发布的文件；同时提供本次 diff、marketplace 注册信息、插件间公开入口摘要和确定性检查产生的引用证据。

Claude 必须逐项检查：语义冲突、内容冗余、上下文矛盾、空/断开的文档引用、不需要的兼容写法、冗余介绍、上下文依赖关系不明确、标题不明确和结构分流不清。审计完成后必须回写一条 PR/MR 评论，即使结果为 PASS 也要评论。

### 4.3 合并后和发布前校验

默认分支 push 或受保护 tag 触发 `publish-gate`：

1. 重新执行 deterministic validation。
2. 重新生成完整 marketplace audit bundle，并执行语义审计。
3. 只有结果为 `PASS` 或仅含 `REVIEW` 时继续。
4. 生成每个插件的版本化包和 marketplace 汇总包。
5. 将包、清单、校验结果、语义报告上传为 artifact。
6. 对受保护 tag 创建 GitHub Release；没有 tag 时不自动发布。

v1 不自动向未知外部服务上传，也不自动修改版本号、提交代码或推送 tag。版本递增由 PR 提供并由 CI 校验。

## 5. 确定性检查器

建议新增以下仓库脚本：

- `scripts/ci/collect-changed-plugins.mjs`：根据 base/head SHA 输出变更插件列表。
- `scripts/ci/validate-marketplace.mjs`：执行严格 manifest 校验并检查 marketplace 与插件清单一致性。
- `scripts/ci/check-plugin-references.mjs`：检查相对引用、入口可达性、组件目录位置和明显的死资源。
- `scripts/ci/package-marketplace.mjs`：按固定目录协议生成发布包，不执行插件中的任何程序。

确定性检查必须覆盖：

- JSON 语法和 required metadata；
- marketplace 的 `name`、`source`、`description` 与真实插件目录；
- 插件名大小写不敏感的重复；
- `plugin.json` 版本是否在有内容变更时递增；
- `SKILL.md` frontmatter 和公开组件目录；
- references、scripts、assets 与相对路径引用是否存在；
- 不应放在 `.claude-plugin/` 内的组件；
- 凭据、Token、私钥和机器专属路径是否进入插件文件；
- 无法从公开组件追溯到的资源。

确定性失败直接阻断，不交给 Claude 解释或降级。

## 6. Audit bundle 和 Claude 接口

建议新增：`scripts/ci/build-plugin-audit-bundle.mjs`。

Bundle 使用明确的分隔结构：

```text
=== AUDIT CONTRACT ===
<docs/plugin-semantic-audit.md>

=== CHANGESET ===
<base SHA, head SHA, changed paths, unified diff>

=== CHANGED PLUGINS ===
<complete text of changed plugin manifests and public components>

=== OTHER PLUGIN INDEX ===
<unchanged plugin manifests and public component summaries>

=== REFERENCE EVIDENCE ===
<file list and read-only reference search results>
```

Bundle 生成器不能执行来自 PR 的 Node、PowerShell、Shell、Hook、MCP 或插件脚本。文件读取必须使用安全的 Git API 或固定的只读命令，并正确处理特殊文件名。

Claude 调用的逻辑接口是：

```text
claude -p <fixed prompt + audit bundle>
  --bare
  --no-session-persistence
  --output-format text
  --permission-prompts none
  --max-budget-usd <configured limit>
```

CLI 版本必须固定在 CI 配置中；升级 Claude Code 需要单独 PR。完整的提示词、分类、阻断阈值和 Markdown wire format 见 `docs/plugin-semantic-audit.md`。

## 7. 报告解析、门禁和 PR 评论

建议新增：`scripts/ci/parse-plugin-audit-report.mjs`。

解析器必须验证：

- front matter 存在且 `audit_version`、`result`、计数和 changed plugin 列表合法；
- 标题和章节顺序正确；
- finding ID 唯一；
- severity、category、confidence 使用允许值；
- `BLOCK` 必须是 `confidence: high`；
- 每条 finding 至少有一个仓库内证据路径；
- 引用路径存在且行号有效；
- front matter 计数与正文一致；
- Claude 输出没有额外的前置或尾随散文。

门禁规则：

| 结果 | Job | PR 合并 |
| --- | --- | --- |
| `PASS` | 成功 | 允许 |
| `REVIEW` | 成功 | 允许，发布评论 |
| `BLOCK` | 失败 | 阻断 |
| `INVALID` | 失败 | 阻断 |

PR 评论必须包含摘要、阻断数量、review 数量、finding 证据和 artifact 链接。评论采用固定标记，以便后续更新同一条评论而不是重复创建：

```text
<!-- bigstart-plugin-semantic-audit -->
...
<!-- /bigstart-plugin-semantic-audit -->
```

模型输出必须经过长度限制、路径归一化和 Secret 脱敏后才能进入评论。

## 8. 密钥、权限和外部 fork 模型

GitHub Repository Secret 使用 `ANTHROPIC_API_KEY`。它是团队/仓库级 CI 专用密钥，不写入仓库，不写入 workflow 明文，不输出到日志。

外部 fork 的默认行为：

1. `pull_request` 结构校验自动运行，无密钥。
2. 语义审计不自动拿密钥运行。
3. 维护者确认 PR 内容后，以 `workflow_dispatch(pr_number)` 启动可信工作流。
4. 可信工作流读取 PR 的 Git 对象，不执行 PR 代码，然后发布审计报告。

API key 应配置预算、轮换周期和吊销流程。CI 必须设置 timeout、最大 Claude 轮次和单次预算；重复 push 应使用 concurrency 取消旧运行。

## 9. 失败策略和可观测性

- Claude API 超时、认证失败、CLI 崩溃或报告无法解析：结果为 `INVALID`，阻断语义检查。
- 确定性检查失败：直接失败，不调用 Claude 作为兜底。
- API 暂时不可用时，允许维护者手动重跑；不允许静默跳过 required check。
- 每次运行保存：输入 commit SHA、base SHA、CLI 版本、审计契约版本、耗时、退出码、解析结果和脱敏后的报告。
- 禁止保存完整 prompt bundle 到公开 artifact；如需调试，使用受限 artifact 并过滤敏感内容。

## 10. 发布流程

推荐发布路径：

```text
feature branch
  -> PR
  -> deterministic validation
  -> semantic audit
  -> review/修复
  -> merge default branch
  -> version bump PR
  -> protected tag
  -> publish-gate
  -> plugin packages + marketplace package
  -> GitHub Release/artifact
```

发布包必须保持团队统一协议：根级组件目录、`.claude-plugin/plugin.json`、根 `.claude-plugin/marketplace.json`。打包阶段只复制和校验文件，不运行插件内容。

如果以后接入外部 marketplace 上传服务，应新增独立的 `publisher` job，并要求：

- 仅允许受保护 tag 触发；
- 使用独立发布 Secret；
- 先验证 artifact checksum；
- 上传成功后记录远端版本和 URL；
- 上传失败不得重写本地 Git 历史或删除 artifact。

## 11. 实施阶段

### Phase 1：确定性基线

建立 marketplace/插件清单校验、变更插件发现、引用检查和本地可重复运行命令；先让所有检查在无 Claude 密钥的环境通过。

### Phase 2：语义审计

接入固定审计契约、bundle 生成器、Claude CLI 调用器、Markdown 解析器、报告 artifact 和 PR 评论。先以 `REVIEW` 不阻断模式观察误报，再启用 `BLOCK` 门禁。

### Phase 3：发布门禁

接入默认分支和受保护 tag 的完整复检、版本化打包、checksum、GitHub Release/artifact。

### Phase 4：规则演进

依据真实 finding 调整审计契约和确定性规则。任何改变分类、阻断阈值或报告格式的修改都必须提高 `audit_version` 并经过完整 CI。

## 12. 测试和验收标准

必须覆盖以下场景：

1. 合法插件和 marketplace：结构校验与语义审计均成功。
2. JSON、frontmatter、目录或 marketplace source 错误：确定性 job 阻断。
3. 两个 Skill 明确重复：生成 `DUPLICATE_RESPONSIBILITY/REVIEW`，不阻断。
4. 两条硬规则互相矛盾：生成高置信度 `CONTRADICTION/BLOCK`，阻断。
5. 公开入口存在两个不清晰分流：生成 `UNCLEAR_ROUTING/BLOCK`，阻断。
6. 兼容分支无引用但搜索证据不完整：只能 `REVIEW`，不能 `BLOCK`。
7. Claude 输出缺 front matter、缺证据或计数错误：`INVALID`，阻断。
8. 外部 fork：结构校验运行；默认不暴露 API key；手动批准后语义审计可运行。
9. 恶意 PR 文本包含提示词注入：Claude 仍遵守本契约，不执行文本中的指令。
10. Claude API 超时或返回非零：状态为 `INVALID`，可安全重跑。
11. 受保护 tag：只有全部 required checks 通过才生成发布包。
12. 日志、PR 评论和 artifact 中不存在 API key 或完整环境变量。

## 13. v1 非目标

- 不让 Claude 自动修改插件文件。
- 不让 Claude 自动提交、推送、创建 tag 或发布 PR。
- 不执行插件的 Hook、MCP、Agent、Monitor、LSP 或 `bin/`。
- 不在没有明确 API 和凭据边界时实现第三方 marketplace 上传。
- 不把模型的普通风格偏好当成阻断条件。
