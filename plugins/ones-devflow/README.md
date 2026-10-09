# ones-devflow

ONES 研发流程协作插件。给 agent 装上 ONES MCP 连接和一套实测过的操作约束，用来读需求与缺陷、按验收标准生成测试用例、回写评论与推进工作流状态。

## 组件

| 组件 | 位置 | 作用 |
| --- | --- | --- |
| MCP | `.mcp.json` | 注册 `ones` server，走 `npx -y mcp-remote https://sz.ones.cn/mcp` |
| Skill | `skills/ones-devflow/SKILL.md` | 操作约束与标准动作 |

## 使用

1. 安装插件后首次调用 ONES 工具会打开浏览器，登录 ONES 并首次勾选全部九类 scope。
2. 授权凭证缓存在本机 `~/.mcp-auth`，后续会话直接复用。
3. 需要指定目标用例库时，在任务里给出库 ID；默认用例库为 `SYn8WKFx`。

## 不覆盖什么

- 不包含 ONES 平台本身的管理配置，如工作流定义、字段结构、权限。
- 不包含 Webhook 或事件订阅，入站同步不属于本插件。

## 已知限制

MCP 地址按团队分配，`.mcp.json` 中的 `https://sz.ones.cn/mcp` 只对团队 `4nbVNB2Z` 有效；其他团队使用时需要替换该地址。
