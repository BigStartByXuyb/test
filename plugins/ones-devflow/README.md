# ones-devflow

ONES 研发流程协作插件：通过 ONES MCP 读需求与缺陷、按验收标准生成测试用例写入用例库、回写评论并推进工作流状态。

## 组件

| 组件 | 位置 | 作用 |
| --- | --- | --- |
| MCP | `.mcp.json` | 注册 `ones` server |
| Skill | `skills/ones-devflow/SKILL.md` | 连接、硬约束、标准动作与边界的唯一契约 |

## 使用

安装后按 `skills/ones-devflow/SKILL.md` 完成首次授权与后续操作。连接地址、团队限定、scope 数量、默认用例库、操作边界与不覆盖范围都以该文件为准，本文件不复述。
