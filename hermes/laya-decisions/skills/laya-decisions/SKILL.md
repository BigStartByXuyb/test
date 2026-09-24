---
name: laya-decisions
description: 用本地 laya 决策模型（choice/score/noul 三类带校准概率的定型问答）为评审门、分流与打分提供低成本建议信号。当需要「要不要先出方案」「这条工单归谁」「这事多急」这类定型判断，或需要 jev_check / jev_route / jev_score / jev_evaluate 工具时使用。不用于生成文本、闲聊或替代最终决策。
---

# laya 决策信号

本地 System One 决策模型的四个 `jev_*` 工具。它一次前向传播给出定型答案和校准概率，
不写散文、不联网、不计费。工具名与社区托管的 Jev 插件一致，后端可无痛切换。

## 工具

| 工具 | 问法 | 返回 |
| --- | --- | --- |
| `jev_check` | 一个是非问 | `noul`（P(true)）+ `confidence` |
| `jev_route` | 多选一 | 各选项 `probabilities` + 选中项 `choice` |
| `jev_score` | 有序档位打分 | 期望档位 `score` + 各档 `probabilities` + `confidence` |
| `jev_evaluate` | 一次多问 | 每个任务一条上述结果，**串行**执行 |
| `jev_health` | 服务是否可达 | 就绪状态与常驻 checkpoint；用于区分「没信号」和「服务挂了」 |

## 先看置信度再决定怎么用

实测 `confidence` 落在 0.07–0.30 之间。这意味着：

- **可以当建议信号**：把答案和概率附在决策旁边，由人或有上下文的 LLM 定夺。
- **不能当硬门**：`0.0679` 的置信度挡不住任何东西，用它自动否决会随机拦掉正确的工作。
  任何「laya 说不行就不做」的写法都是误用。

## 提问文案是接口的一部分，不是注释

同一份输入，逐字重复调用，概率极差是 **0.000000**；把问题换一种说法，极差能到 **0.32** —
比任何在用的阈值都大。所以：

1. 需要复用时，用 `question_id` 引用 `prompts/frozen-questions.v1.json` 里逐字冻结的文案，
   不要在现场重新措辞。改文案必须升 `registry_version` 并重跑稳定性表。
2. 每次返回都带 `wording.sha256`。把它和结果一起记下来，措辞被悄悄改掉时能发现，
   而不是被吸收进分数里。
3. `question` 和 `question_id` 只能给一个：同时给会报错，避免「到底按哪句算的」说不清。

## 用法

```jsonc
// 是非判断，用冻结文案
{"state": "<任务描述>", "question_id": "review.architect_first"}

// 多选一，选项标签和顺序一并冻结
{"state": "<任务描述>", "options": ["implementation", "design", "research", "operations"],
 "question": "Which workstream should own this task?"}

// 打分，档位从低到高
{"state": "<任务描述>", "levels": ["no deadline pressure", "soon", "blocking someone now"],
 "question": "How urgent is this task?"}

// 一次多问（串行，避免并发加载第三个 checkpoint）
{"state": "<任务描述>", "tasks": [
  {"id": "arch", "type": "noul", "question_id": "review.architect_first"},
  {"id": "risk", "type": "noul", "question_id": "review.risk_high"}]}
```

`model` 可选 `english` / `multilingual` / `typed-decisions`；省略时按 state 的语言自动路由
（中文或非拉丁文字会落到 `multilingual`，英文落到 `english`）。中英混排的 state 建议显式指定
`multilingual`，路由是按字母脚本判的。

`repeat`（1–5）会把同一次调用原样重跑 N 次并返回 `stability.range`。用来确认某个判断
不是踩在噪声上，而不是用来取平均。

## 出错时

`/predict` 不可达、超时、或问题定义不合法时，工具会报错并说明原因，**不会返回空值**。
「服务挂了」和「答案是 low」必须能区分开——把前者读成后者，会让门在依赖的服务掉线时
静默放行或静默拦截。
