# 插件清单

Marketplace 安装 ID 和源路径以仓库根目录 `.claude-plugin/marketplace.json` 为准。`agent-plugin-publisher` Skill 负责按确认内容更新该清单；Skill 发布后，维护者同步更新本表。

| 插件 ID | 用途 | 技能入口 | 安装条件 |
| --- | --- | --- | --- |
| `agent-plugin-publisher` | 将用户指定的本地目录打包为团队 marketplace 插件。 | `plugins/agent-plugin-publisher/skills/agent-plugin-publisher/SKILL.md` | 所有需要新增、打包、发布或维护市场插件的人员和 Agent 必装并启用。 |
| `mastergo-wpf-transcoder` | MasterGo 设计稿转换为 MW WPF 与 MTSLG IOContorl 页面。 | `plugins/mastergo-wpf-transcoder/skills/mastergo-to-wpf/SKILL.md`；`plugins/mastergo-wpf-transcoder/skills/mastergo-iocontrol-document-format/SKILL.md` | 按 MasterGo 转换或映射文档任务安装。 |
| `feishu-codex-bridge` | 将本机 Codex 接入飞书消息，执行请求并回贴结果。 | `plugins/feishu-codex-bridge/skills/feishu-codex-bridge/SKILL.md` | 按飞书与 Codex 协作任务安装。 |
| `sip-methodology-classifier` | 按 SIP 方法论（9 个主顺序 + 1–12 级子顺序）归类成品检验指导书 Excel。 | `plugins/sip-methodology-classifier/skills/sip-methodology-classifier/SKILL.md` | 按 SIP 检验指导书归类任务安装。 |
| `inteplm-deliverable-docs` | 仅适用于 MEL6611 V100R001：在 IntePLM 新建交付物文档并上传文件。 | `plugins/inteplm-deliverable-docs/skills/inteplm-deliverable-docs/SKILL.md` | 按 MEL6611 V100R001 交付物文档任务安装。 |
