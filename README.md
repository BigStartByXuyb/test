# BigStart Plugins

团队插件市场。各插件位于 `plugins/`，根目录 `.claude-plugin/marketplace.json` 是唯一的市场目录。

## 插件

- `mastergo-wpf-transcoder` — MasterGo 设计到 MW WPF 与 MTSLG IOContorl 的转换流程。
- `agent-plugin-publisher` — 按团队统一格式打包、校验和发布插件。

## 发版

版本号在插件自己的 `.claude-plugin/plugin.json`，tag 名 = `v` + 该版本号；什么时候发、版本位怎么选见 `docs/plugin-release.md`。
