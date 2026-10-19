# MW Agent 插件市场

MW 团队统一维护的 Agent 插件源。插件包遵循 Claude Code 兼容的插件协议和目录格式，供 Claude Code、Codex 以及支持兼容清单与 `SKILL.md` 的 Agent 使用。市场安装项和插件 ID 以 `.claude-plugin/marketplace.json` 为准；各 Agent 的源登记、插件启用和 MCP 授权方式由客户端决定。

GitLab 市场源：

`http://14.29.174.209:20001/data_ai/plugins.git`

## 文档索引

- [插件清单](docs/PLUGINS.md)：插件用途、技能入口和安装要求。
- [维护指南](PLUGIN_MAINTAINER_GUIDE.md)：安装、开发、校验、提交和发版流程。
- [发版规范](docs/plugin-release.md)：版本号和 tag 规则。

## 安装市场并启用基础插件

维护者和普通使用者的插件安装条件统一见[插件清单](docs/PLUGINS.md)。

### Claude Code

```sh
claude plugin marketplace add http://14.29.174.209:20001/data_ai/plugins.git
claude plugin install agent-plugin-publisher@mw-plugins
```

在 Claude Code 会话中也可以执行：

```text
/plugin marketplace add http://14.29.174.209:20001/data_ai/plugins.git
/plugin install agent-plugin-publisher@mw-plugins
```

### Codex

```sh
codex plugin marketplace add http://14.29.174.209:20001/data_ai/plugins.git
```

随后在 Codex 的 Plugins Directory 中选择 `mw-plugins`，安装 `agent-plugin-publisher`；其他插件按[插件清单](docs/PLUGINS.md)中的使用条件按需安装。

### 从旧市场迁移

旧市场 ID 为 `bigstart-plugins`。先记录旧市场中已安装且仍需使用的插件，再移除旧市场登记并添加上面的 GitLab 源。Claude Code 移除市场时会卸载从该市场安装的插件，因此需从新市场重新安装需保留的插件；[Claude Code 插件管理说明](https://code.claude.com/docs/en/plugins/install)。

```sh
claude plugin list
claude plugin marketplace list
claude plugin marketplace remove bigstart-plugins
claude plugin marketplace add http://14.29.174.209:20001/data_ai/plugins.git
codex plugin marketplace list
codex plugin marketplace remove bigstart-plugins
codex plugin marketplace add http://14.29.174.209:20001/data_ai/plugins.git
```

新市场 ID 为 `mw-plugins`。对 `agent-plugin-publisher`、`mastergo-wpf-transcoder`、`feishu-codex-bridge` 中原来已安装且仍需使用的插件，从新市场重新安装，并再次检查来源和启用状态。Claude Code 使用 `claude plugin install <plugin-id>@mw-plugins` 或会话中的 `/plugin install <plugin-id>@mw-plugins`。Codex 用户在 Plugins Directory 中选择 `mw-plugins` 并安装所需插件。维护者必须启用 `agent-plugin-publisher`，普通使用者按需选择其他插件。

### 其他兼容 Agent

在客户端中登记上面的 GitLab 源，按任务选择 `docs/PLUGINS.md` 中适用的插件 ID，并按客户端提示授权 MCP。市场格式兼容不代表客户端的安装命令或 MCP 权限流程相同。

## 插件包最小结构示例

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

插件还可包含 `commands/`、`agents/`、`hooks/`、`.mcp.json`、`.lsp.json`、`output-styles/`、`themes/`、`monitors/`、`bin/` 和 `settings.json` 等公开组件；`references/`、`scripts/`、`assets/` 和 `examples/` 是组件使用的支撑资源。完整目录规则见 `agent-plugin-publisher` Skill。

新增技能放在 `plugins/<plugin-id>/skills/<skill-id>/`，并提供 `SKILL.md`。Marketplace 条目、插件元数据和源目录必须使用一致的 ID 与路径。用户可见的插件用途、技能入口和安装条件维护在 `docs/PLUGINS.md`。

## 插件维护

日常维护分支、插件校验、提交、MR 和发版流程统一见[维护指南](PLUGIN_MAINTAINER_GUIDE.md)。
