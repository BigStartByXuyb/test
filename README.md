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
codex plugin add agent-plugin-publisher@mw-plugins
```

如果其他已登记市场里也有同名插件，先用 `codex plugin list` 查看来源，再按客户端支持的 `插件 ID@市场 ID` 形式指定来源。安装后用 `codex plugin list` 确认状态。

### 从旧市场迁移

在对应客户端中查看并移除旧市场登记，再添加上面的 GitLab 源：

```sh
claude plugin marketplace list
claude plugin marketplace remove <旧市场 ID>
codex plugin marketplace list
codex plugin marketplace remove <旧市场 ID>
```

新市场 ID 为 `mw-plugins`。重新登记后再安装 `agent-plugin-publisher@mw-plugins`。

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

## 插件维护

日常维护分支、插件校验、提交、MR 和发版流程统一见[维护指南](PLUGIN_MAINTAINER_GUIDE.md)。
