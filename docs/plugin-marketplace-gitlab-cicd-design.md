# Plugin Marketplace GitLab CI/CD 设计

## 1. 目标

在 GitLab 中为插件 marketplace 建立一套独立、完整的质量与发布流水线：

```text
Merge Request 触发
  -> 结构和配置脚本检查
  -> 失败：回写 MR 评论并停止
  -> 成功：读取本次提交插件的完整内容
  -> Claude Code CLI 全文语义审计
  -> 解析结构化 Markdown
  -> 回写 MR 评论并保存报告
```

语义审计规则、分类、报告格式由 [plugin-semantic-audit.md](./plugin-semantic-audit.md) 定义。本文件只描述 GitLab 项目中的流水线、权限、变量、Merge Request 评论和发布流程。

## 2. GitLab 文件和变量

新增文件：

- `.gitlab-ci.yml`：主流水线入口。
- `scripts/ci/collect-changed-plugins.mjs`：识别本次 MR 影响的插件。
- `scripts/ci/validate-marketplace.mjs`：结构、配置、引用和版本检查。
- `scripts/ci/build-plugin-audit-bundle.mjs`：读取提交插件的完整内容并生成审计输入。
- `scripts/ci/parse-plugin-audit-report.mjs`：解析 Claude 的 Markdown 报告。
- `scripts/ci/post-gitlab-mr-comment.mjs`：创建或更新固定标记的 MR Note。

在 GitLab 项目的 **Settings → CI/CD → Variables** 中配置：

| 变量 | 类型 | 作用 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Masked、Protected | DeepSeek Anthropic 兼容接口的团队 CI 密钥 |
| `GITLAB_COMMENT_TOKEN` | Masked、Protected | 可选；用于跨项目或更细粒度的 MR Note 权限 |

如果使用当前项目的 `CI_JOB_TOKEN` 创建 MR Note，则不需要额外的评论 Token，但必须确认项目 Job Token 权限允许访问 Merge Request Notes API。

## 3. 阶段和依赖

`.gitlab-ci.yml` 定义四个 stage：

```yaml
stages:
  - deterministic
  - semantic
  - comment
  - publish
```

实际 job 依赖如下：

```text
deterministic-validation
        |
        +--> semantic-audit
                    |
                    +--> publish-mr-report

deterministic-validation + semantic-audit
        |
        +--> publish-gate   # 仅默认分支或受保护 tag
```

`semantic-audit` 必须声明 `needs: [deterministic-validation]`。结构检查失败时，Claude 不得运行。

## 4. Merge Request 触发规则

主配置必须显式使用 `CI_PIPELINE_SOURCE == "merge_request_event"`，避免只创建普通 branch pipeline：

```yaml
workflow:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_TAG'
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
    - when: never
```

MR pipeline 运行时：

1. 使用 `CI_MERGE_REQUEST_TARGET_BRANCH_SHA` 和 `CI_MERGE_REQUEST_SOURCE_BRANCH_SHA` 确定审计范围。
2. 结构 job 可以 checkout MR source 内容，但不读取任何秘密。
3. 语义 job 只读取 Git 对象和文本，不执行 MR 中的脚本、Hook、MCP、Agent、Monitor、LSP 或 `bin/`。
4. 结果统一写入当前 MR 的 Note，并保存为 job artifact。

## 5. Deterministic validation

job 名称：`deterministic-validation`。

执行顺序：

1. 安装固定版本 Node.js 和 Claude Code CLI。
2. 找出 marketplace 和变更插件。
3. 对根 marketplace 以及受影响插件执行：

   ```text
   claude plugin validate --strict --json <path>
   ```

4. 执行仓库脚本检查：

   - `plugin.json`、marketplace JSON 和 Markdown frontmatter；
   - 插件目录与 marketplace source 是否一致；
   - Skill、references、scripts、assets 等路径是否存在；
   - 文件是否放在团队协议规定的目录；
   - 公开 Skill 是否严格位于 `skills/<skill-name>/SKILL.md`；
   - `references/`、`adapters/`、`examples/` 等内部目录是否意外包含 `SKILL.md`；
   - 版本是否在内容变更时递增；
   - 是否出现 Token、私钥、凭据或机器专属路径；
   - 是否存在明显的空引用、重复入口和不可达文件。

5. 发现嵌套 `SKILL.md` 时报告 `UNEXPECTED_SKILL_FILE`，列出完整路径并要求维护者确认；不自动移动、重命名或注册该文件。
6. 失败时生成确定性错误报告，并调用 `post-gitlab-mr-comment` 写入 MR；job 失败，后续 semantic job 因 `needs` 不运行。

## 6. Semantic audit

job 名称：`semantic-audit`。

Claude 输入必须包含：

- 本次 MR 的完整 diff；
- 本次提交的每个插件完整目录内容，而不是只提供改动行；
- `plugin.json`、所有 `SKILL.md`、references、scripts、assets、commands、agents、hooks、MCP/LSP/settings 等已提交文件；
- marketplace 注册信息和其他插件的公开入口摘要；
- deterministic job 产生的路径和引用证据；
- `docs/plugin-semantic-audit.md` 中的固定契约和提示词。

Claude 必须检查：

- 语义冲突；
- 内容冗余；
- 上下文矛盾；
- 空文档引用、断开引用和占位引用；
- 不需要的兼容写法；
- 冗余介绍；
- 上下文依赖关系不明确；
- 标题不明确；
- Skill、Agent、Command、MCP、Hook、Reference 之间分流不清。

CLI 使用只读参数：

```text
claude -p <fixed prompt + audit bundle> \
  --bare \
  --no-session-persistence \
  --output-format text \
  --permission-prompts none \
  --max-budget-usd <limit>
```

GitLab job 固定使用 DeepSeek 的 Anthropic 兼容接口和 `deepseek-v4-flash`：

```text
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_API_KEY=<GitLab Masked/Protected Variable>
claude --model deepseek-v4-flash ...
```

`ANTHROPIC_API_KEY` 只能通过 GitLab CI/CD Variable 注入环境，不能出现在 YAML、bundle、日志、Note 或 artifact 中。

## 7. 报告和 MR Note

Claude 必须返回固定 Markdown。解析器检查 front matter、结果枚举、finding 数量、分类、严重度、置信度、证据路径和章节顺序。

结果解释：

| 结果 | Pipeline | MR 合并 |
| --- | --- | --- |
| `PASS` | 成功 | 允许 |
| `REVIEW` | 成功 | 允许，但列出建议 |
| `BLOCK` | 失败 | 阻断 |
| `INVALID` | 失败 | 阻断 |

每次运行都要创建或更新一条 MR Note，包括 `PASS`。使用固定标记避免重复评论：

```text
<!-- bigstart-plugin-semantic-audit -->
...
<!-- /bigstart-plugin-semantic-audit -->
```

Note 内容包括：

- 结构校验状态；
- Claude 审计状态；
- BLOCK 和 REVIEW 数量；
- 每个 finding 的文件、行号、证据和建议；
- artifact 链接；
- Claude CLI 版本、审计契约版本、commit SHA。

## 8. Fork MR 和 Secret 安全

GitLab fork MR 默认在 fork 项目中运行，不能使用上游项目的 CI/CD Variables。上游维护者如果要在父项目中手动运行 pipeline，必须先审查 fork 的 `.gitlab-ci.yml` 和所有涉及 CI 的修改，因为父项目 pipeline 可能获得父项目变量。

安全策略：

1. fork MR 自动执行无密钥的 `deterministic-validation`。
2. fork MR 默认不执行带 `ANTHROPIC_API_KEY` 的 semantic job。
3. 维护者审查 MR 后，在父项目手动运行 MR pipeline。
4. 手动运行仍使用固定的、受保护的 CI 配置，并禁止执行 MR 中的脚本。
5. protected variable 只允许受保护分支/标签及符合项目权限要求的可信 MR 使用。
6. 任何 Secret 都不能通过手动 pipeline 表单输入。

## 9. 发布门禁

`publish-gate` 只在默认分支或受保护 tag 运行：

1. 重新执行 deterministic validation。
2. 重新执行 semantic audit。
3. 只有 `PASS` 或仅含 `REVIEW` 时生成插件包。
4. 上传 GitLab Job Artifact，并在 tag pipeline 中创建 GitLab Release。
5. v1 不自动推送代码、修改版本、创建 tag 或调用未定义的第三方 marketplace 上传接口。

未来接入外部 marketplace 时，单独增加受保护的 `publisher` job，验证 checksum 后再上传，并记录远端版本与 URL。

## 10. 失败、重试和并发

- 结构检查失败：直接失败，不调用 Claude。
- Claude 超时、认证失败、非零退出或输出格式错误：`INVALID`，阻断并允许维护者重试。
- 同一 MR 新提交到达时，取消旧 pipeline，避免重复消耗 API 预算。
- 设置 Claude 单次预算、超时和最大轮次。
- 保留脱敏后的报告、退出码、输入 commit SHA、CLI 版本和契约版本。
- 不上传包含完整 prompt bundle 或环境变量的公开 artifact。

## 11. 验收标准

1. MR 触发后 deterministic job 先运行，失败时 semantic job 不启动。
2. 结构通过后，Claude 收到提交插件完整目录，而不只是 diff。
3. Claude 检查所有规定的语义问题并按固定 Markdown 返回。
4. PASS、REVIEW、BLOCK、INVALID 都能被解析并正确决定 MR 状态。
5. 每次 MR 都只有一条可更新的审计 Note。
6. fork MR 默认拿不到上游 `ANTHROPIC_API_KEY`。
7. 手动批准的可信 pipeline 可以完成完整审计。
8. Secret 不出现在日志、Note、artifact 或仓库文件中。
9. 默认分支和受保护 tag 只有通过所有 required checks 才能生成发布包。

## 12. GitLab 项目配置清单

启用本方案前，GitLab 项目管理员需要完成以下配置：

1. 将默认分支设置为 Protected Branch，并要求通过 Merge Request 合并。
2. 将 `ANTHROPIC_API_KEY` 设置为 Masked 和 Protected CI/CD Variable。
3. 为执行语义审计的 Runner 设置受保护标签，并禁止不可信 MR 使用该 Runner。
4. 配置 Merge Request Pipeline，使 `CI_PIPELINE_SOURCE == "merge_request_event"` 的规则生效。
5. 将 `deterministic-validation`、`semantic-audit` 和 `publish-gate` 设置为 Required Checks 或等效的合并门禁。
6. 为创建或更新 MR Note 配置 `CI_JOB_TOKEN` 权限，必要时使用受保护的 `GITLAB_COMMENT_TOKEN`。
7. 为默认分支和发布 tag 配置 concurrency，新的提交到达时取消同一 MR 的旧运行。
