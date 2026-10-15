# Marketplace CI/CD 调用说明

本仓库不保存完整 CI 实现。当前公共实现位于个人账号的
`BigStartByXuyb/cicd` 仓库，并由根目录的 `.github/workflows/plugin-cicd.yml` 通过固定的已审核 commit SHA 调用。

当前个人账号试运行时，不要求创建 GitHub Organization。插件贡献者只需要提交
`plugins/<plugin-name>/` 下的插件内容，不需要复制 CI 脚本、Claude CLI 或任何 API key。

仓库维护者在本仓库 `BigStartByXuyb/test` 的 Settings → Secrets and variables → Actions
→ Repository secrets 中配置以下五个 Secret：

```text
ANTHROPIC_API_KEY
FEISHU_APP_ID
FEISHU_APP_SECRET
FEISHU_DEFAULT_CHAT_ID
FEISHU_RECIPIENT_MAP_JSON
```

根目录调用工作流必须把这五个 Secret 显式映射给可复用 workflow；不要使用
`secrets: inherit`。Secret 值不得写入本仓库、PR、日志或 artifact。

当前仓库尚在个人账号下时，工作流中的 owner 仍可暂时写为 `BigStartByXuyb`；完成
Organization 迁移后，可以将这些同名 Secret 改为 Organization Secrets，并按仓库
allow-list 授权；同时把 `uses:` 中的 owner 改为最终 Organization slug，再重新审核和锁定 commit SHA。
