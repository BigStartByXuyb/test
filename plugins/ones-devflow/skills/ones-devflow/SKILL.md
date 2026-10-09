---
name: ones-devflow
description: 通过 ONES MCP 在 ONES 平台上读需求与缺陷、按验收标准生成测试用例写入用例库、回写评论并推进工作流状态。当任务涉及 ONES 工作项、测试用例库或状态流转时必须使用本 Skill。
---

# ONES 研发流程协作

## 连接

插件携带 `ones` MCP server，地址为 `https://sz.ones.cn/mcp`。首次连接会打开浏览器走 OAuth，勾选全部九类 scope；授权后 token 缓存在 `~/.mcp-auth`，之后免登录。

MCP 地址按团队分配，当前地址只对团队 `4nbVNB2Z`（work）有效。换团队时修改 `.mcp.json` 中的地址。

## 硬约束

以下约束来自实测，违反会直接失败。

1. 状态只能走工作流。改状态前必须调 `get_issue_executable_workflows` 取当前状态下合法的目标，只能选它返回的、业务确认过的 workflow id；直接写状态字段无效。
2. 工作项 ID 是 UUID。`MASTERGO-28` 这类展示号不能直接传入，先用 `query_issues_by_onesql` 解析成 UUID。
3. 查询先用 ONESQL 帮助。调 `query_issues_by_onesql` 前必须先调 `get_onesql_grammar_help`，且 SELECT 必须包含 `field001`（标题）。
4. 建用例先查库字段。`get_testcase_library_fields` 返回优先级与用例类型的选项 ID，创建时必须传 ID。下面这组 ID 只适用于默认用例库 `SYn8WKFx`（名称 test）：优先级 `9sqx41sR`(P0)、`PcoQvbh9`(P1)、`FKhyHELM`(P2)、`MTcn282p`(P3)、`Y5Mx8vTM`(P4)；用例类型「功能测试」为 `35meTuAu`。目标库不是 `SYn8WKFx` 时，以 `get_testcase_library_fields` 的返回值为准。

## 读工作项

1. `search_for_projects` 定位项目，记下项目 ID。
2. `get_onesql_grammar_help` 后调 `query_issues_by_onesql` 取目标工作项列表。
3. `get_issue_details` 取单条详情；`get_list_of_issue_comments` 取工作项描述与验收标准，评论正文优先读 `markdown` 字段。

## 生成测试用例

1. `search_for_testcase_libraries` 找到目标库，默认用例库为 `SYn8WKFx`（名称 test）。
2. `create_module_in_testcase_library` 建模块，模块名带来源标识，例如「<需求标题>（自动生成）」。
3. 每条用例用 `create_new_testcase_in_library` 写入，必传 `libraryID`、`moduleID`、`name`、`priority`、`type`、`condition`、`steps[{desc,result}]`。
4. 一条验收标准至少对应一条用例；边界条件与幂等要求单独成条，不合并进主流程用例。
5. 写完后在需求上用 `post_issue_comment` 回贴汇总评论，逐条列出用例名与优先级。

## 回写状态

1. `get_issue_executable_workflows` 取当前合法流转。
2. `execute_issue_workflow` 执行流转，目标必须是 `get_issue_executable_workflows` 返回的、业务确认过的 workflow id。
3. `post_issue_comment` 记录做了什么、依据是什么。

## 边界

- 不新建工作项类型，不改字段结构，不改工作流定义。
- 不删除工作项或用例，除非用户明确要求并逐条确认。
- 写操作只做四件事：评论、合法流转、建模块、创建用例。
