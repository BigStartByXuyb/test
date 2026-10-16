# MW Agent 插件市场

MW 团队统一维护的 Agent 插件源。插件包遵循 Claude Code 兼容的插件协议和目录格式，供 Claude Code、Codex 以及支持兼容清单与 `SKILL.md` 的 Agent 使用。市场安装项和插件 ID 以 `.claude-plugin/marketplace.json` 为准；各 Agent 的源登记、插件启用和 MCP 授权方式由客户端决定。

GitLab 市场源：

`http://14.29.174.209:20001/data_ai/plugins.git`

## 文档索引

- [插件清单](docs/PLUGINS.md)：插件用途、技能入口和安装要求。
- [维护指南](PLUGIN_MAINTAINER_GUIDE.md)：安装、开发、校验、提交和发版流程。
- [发版规范](docs/plugin-release.md)：版本号和 tag 规则。

## 安装市场并启用基础插件

`agent-plugin-publisher` 是维护 MW 插件市场的必需基础插件。所有需要新增、打包、发布或维护市场插件的人员和 Agent 都必须安装并启用它。普通插件使用者按需安装其他插件。

### Claude Code

```sh
claude plugin marketplace add http://14.29.174.209:20001/data_ai/plugins.git
claude plugin install agent-plugin-publisher --marketplace http://14.29.174.209:20001/data_ai/plugins.git
```

### Codex

```sh
codex plugin marketplace add http://14.29.174.209:20001/data_ai/plugins.git
codex plugin add agent-plugin-publisher
```

如果其他已登记市场里也有同名插件，先用 `codex plugin list` 查看来源，再按客户端支持的 `插件 ID@市场 ID` 形式指定来源。安装后用 `codex plugin list` 确认状态。

### 其他兼容 Agent

在客户端中登记上面的 GitLab 源，安装 `docs/PLUGINS.md` 列出的插件 ID，并按客户端提示授权 MCP。市场格式兼容不代表客户端的安装命令或 MCP 权限流程相同。

## 插件包结构

```text
.claude-plugin/
└── marketplace.json
plugins/
└── <plugin-id>/
    ├── .claude-plugin/plugin.json
    ├── skills/<skill-id>/SKILL.md
    ├── .mcp.json        # 可选
    └── agents/          # 可选
```

新增技能放在 `plugins/<plugin-id>/skills/<skill-id>/`，并提供 `SKILL.md`。Marketplace 条目、插件元数据和源目录必须使用一致的 ID 与路径。用户可见的插件用途、技能入口和必装要求维护在 `docs/PLUGINS.md`。

## 本地校验

在仓库根目录运行：

```sh
claude plugin validate --strict .
```

PowerShell 7 中运行插件自带测试和差异检查：

```powershell
$nodeTests = Get-ChildItem plugins -Recurse -File -Filter '*.test.js' |
  Where-Object { $_.FullName -match '[\\/]scripts[\\/]tests[\\/]' } |
  ForEach-Object FullName
if ($nodeTests.Count -eq 0) { throw '没有找到插件 Node 测试' }
node --test $nodeTests

$psTests = Get-ChildItem plugins -Recurse -File -Filter '*.tests.ps1' |
  Where-Object { $_.FullName -match '[\\/]skills[\\/].*[\\/]scripts[\\/]tests[\\/]' }
foreach ($test in $psTests) {
  pwsh -NoProfile -File $test.FullName
  if ($LASTEXITCODE -ne 0) { throw "PowerShell 测试失败: $($test.Name)" }
}

git diff --check
```

## 提交与发版

所有日常更新提交到 GitLab 的 `plugin-migration` 分支，检查通过后通过 Merge Request 合入受保护的 `main`。首次创建共享分支的步骤见上文；后续更新按以下流程执行：

```sh
git switch plugin-migration
git pull --rebase origin plugin-migration
git add README.md docs/PLUGINS.md PLUGIN_MAINTAINER_GUIDE.md .claude-plugin/marketplace.json plugins/
git commit -m "更新 <plugin-id> 插件内容"
git push origin plugin-migration
```

向 `main` 提交 Merge Request，并等待流水线完成后合并。MR 流水线使用 `data_ai/cicd` 中固定版本的模板，运行需要 Linux Docker Runner。`data_ai/cicd` 的 Job Token allowlist 必须允许 `data_ai/plugins` 读取共享模板。

在本项目 Settings → CI/CD → Variables 中配置 `plugin-cicd` 作用域的 masked 变量：`ANTHROPIC_API_KEY`、`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_DEFAULT_CHAT_ID`、`FEISHU_RECIPIENT_MAP_JSON` 和 `GITLAB_API_TOKEN`。密钥值不提交到仓库。

插件版本记录在各自的 `.claude-plugin/plugin.json`。发版时按 [`docs/plugin-release.md`](docs/plugin-release.md) 更新版本并推送 `v<version>` tag。提交前确认没有密钥、临时文件或本机绝对路径。
