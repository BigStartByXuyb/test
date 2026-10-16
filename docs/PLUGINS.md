# 插件清单

Marketplace 安装 ID 和源路径以仓库根目录 `.claude-plugin/marketplace.json` 为准。新增、改名或移除插件时，先更新该清单，再同步更新本表。

| 插件 ID | 用途 | 技能入口 | 安装要求 |
| --- | --- | --- | --- |
| `agent-plugin-publisher` | 将用户指定的本地目录打包为团队 marketplace 插件。 | `plugins/agent-plugin-publisher/skills/agent-plugin-publisher/SKILL.md` | 市场维护人员必装并启用。 |
| `mastergo-wpf-transcoder` | MasterGo 设计稿转换为 MW WPF 与 MTSLG IOContorl 页面。 | `plugins/mastergo-wpf-transcoder/skills/mastergo-to-wpf/SKILL.md`；`plugins/mastergo-wpf-transcoder/skills/mastergo-iocontrol-document-format/SKILL.md` | 按 MasterGo 转换或映射文档任务安装。 |
| `feishu-codex-bridge` | 将本机 Codex 接入飞书消息，执行请求并回贴结果。 | `plugins/feishu-codex-bridge/skills/feishu-codex-bridge/SKILL.md` | 按飞书与 Codex 协作任务安装。 |
