# 插件发版规范

当前 `.github/workflows/plugin-release.yml` 只为 `mastergo-wpf-transcoder` 生成 GitHub Release 发布件。GitLab MR 是合并门禁；合并后先把对应提交同步到 GitHub，再将发布 tag 推送到 GitHub。GitLab tag 不触发发布作业。其他 marketplace 插件通过市场源分发，不使用该工作流的版本 tag。扩展其他插件的 Release 发布时，必须同步扩展工作流并更新本文。

## 版本号与 tag

- 版本号写在插件自己的 `.claude-plugin/plugin.json` 的 `version`，格式 `X.Y.Z`。
- 当前 Release 工作流使用 `v` + `mastergo-wpf-transcoder` 的 `version` 作为 tag，指向包含该版本号的提交。`v<version>` tag 命名空间专供此工作流目标插件使用，其他插件不得创建相同格式的 tag。
- 客户端按 tag 打包，并核对该 tag 里的插件版本与包内容；两者不一致时打包失败。所以 tag 与 `plugin.json` 的版本必须同一次提交到位。
- 一个 `v<version>` tag 对应 `mastergo-wpf-transcoder` 的一个发布版本。其他插件若增加 Release 工作流，必须为其单独定义不冲突的 tag 格式。
- 不使用 `backup-*` 这类非版本 tag；需要留备份点用分支。

## 什么时候发版

- 发版不是每次提交，而是一批要交付给客户端的功能或修复做完之后：`main` 上的提交可以先积累，等这批做完、CI 全绿再发。
- 发版动作三步：改 `mastergo-wpf-transcoder/.claude-plugin/plugin.json` 的 `version` → 提交、等 CI 通过 → 打 `v<version>` 并推送。
- 紧急修复单独发一版，不与不相关的改动混在同一个发版提交里。

## 版本号怎么选

按「同一份设计稿重新生成会得到什么」判定，不看改动行数：

| 变更效果 | 版本位 | 例 |
|---|---|---|
| 同一份设计稿重新生成的产物变了，且已经交付的页面需要重新生成 | **X**（大版本） | 成带口径换代、容器撑满主轴、补组判据变化、写法表或映射的破坏性变更、门禁新增失败项导致旧产物不合规 |
| 只新增能力，旧产物仍然合规 | **Y**（小版本） | 新增控件类型或样式族映射、新增可选字段、新增提示级门禁、新增页面级支持 |
| 产物不变 | **Z**（补丁） | 文档与实现对齐、注释、测试补强、报错文案、性能与内部重构 |

判不准时按大一级取：宁可进 X，也不悄悄改变已交付页面的生成结果。

## tag 的维护

- 推送 `v<version>` 发布 tag 后，工作流校验目标提交已合并到 GitHub `main`；校验失败时不生成 Release，已推送 tag 保持原样，需递增版本并为修复提交创建新 tag。历史 tag 即使指向 `main` 外的提交也保持原样。
- 已推送的 tag 不移动、不覆盖、不删除重打。发布错误时修复并递增插件版本，为新提交创建新 tag。
