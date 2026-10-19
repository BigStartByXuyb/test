# 插件维护指南

## 适用范围

本指南适用于维护仓库根目录 `.claude-plugin/marketplace.json` 和 `plugins/` 下的插件。

## 安装基础插件

所有需要新增、打包、发布或维护市场插件的人员和 Agent 必须先登记 README 中的 GitLab marketplace 源，再安装并启用 `agent-plugin-publisher`。其他插件按 [插件清单](docs/PLUGINS.md) 的用途和技能入口选装。

## 新增或更新插件

插件包的新增、结构调整、打包和发布统一使用 `agent-plugin-publisher` Skill。必须完成该 Skill 的冲突与相似度检查，并在用户确认后发布到正式仓库；不得另行手工复制候选包或维护第二套打包步骤。

插件发布后，只在本仓库同步维护 `docs/PLUGINS.md` 中的用途、技能入口和安装条件。Marketplace 源、插件元数据和正式目录由 Skill 按同一插件 ID 更新。

## 本地校验

从仓库根目录执行 Claude Code marketplace 严格校验：

```powershell
claude plugin validate --strict .
if ($LASTEXITCODE -ne 0) { throw 'Marketplace 校验失败' }
```

PowerShell 7 中运行与 GitLab CI 相同范围的插件 JavaScript 和 PowerShell 用例：

```powershell
$nodeTests = Get-ChildItem plugins -Recurse -File -Filter '*.test.js' |
  Where-Object { $_.FullName -match '[\\/]scripts[\\/]tests[\\/]' } |
  ForEach-Object FullName
if ($nodeTests.Count -eq 0) { throw '没有找到插件 Node 测试' }
node --test $nodeTests
if ($LASTEXITCODE -ne 0) { throw 'Node 测试失败' }

$psTests = Get-ChildItem plugins -Recurse -File -Filter '*.tests.ps1' |
  Where-Object { $_.FullName -match '[\\/]skills[\\/].*[\\/]scripts[\\/]tests[\\/]' }
if ($psTests.Count -eq 0) { throw '没有找到插件 PowerShell 测试' }
foreach ($test in $psTests) {
  pwsh -NoProfile -File $test.FullName
  if ($LASTEXITCODE -ne 0) { throw "PowerShell 测试失败: $($test.Name)" }
}

git diff --check
```

MasterGo 页面坐标与来源校验是页面级检查，不是无参数的市场校验。坐标检查器的 `--xml` / `--nodes` 参数见 `plugins/mastergo-wpf-transcoder/skills/mastergo-to-wpf/scripts/adapters/mtslg-iocontrol/check-iocontrol-coords.js`；provenance 输入见同目录的 `validate-iocontrol-provenance.js`。映射覆盖审计见下方命令。

## 提交和合并

`plugin-migration` 是日常维护分支。首次由 Maintainer 从 GitLab `main` 创建并推送该分支；维护者 checkout 后，提交前执行 `git pull --rebase origin plugin-migration`。完成本地校验后推送，并创建目标为 `main` 的 Merge Request。不要直接推送受保护的 `main`。

GitLab MR 的 `data_ai/cicd` `main` 流水线是本仓库唯一权威合并门禁；GitHub 上的 `.github/workflows/plugin-cicd.yml` 仅提供辅助市场审计，不替代 GitLab MR 结果；`.github/workflows/plugin-release.yml` 是独立的发布工作流。GitLab `main` 是合并目标，GitHub 不作为本仓库的第二个合并入口。调用项目的 Job Token allowlist、Linux Docker Runner 和 masked CI/CD 变量由 Maintainer 配置；密钥不保存在仓库中。

### 共享流水线测试范围

共享测试作业定义在外部 `data_ai/cicd`。核对时使用 GitLab 子流水线记录的中央配置提交；本地已验证的中央配置提交为 `157b4bc3c055791567ad6e370ba7c4f4a9b91306`，其中插件作业名为 `plugin:runtime-js` 和 `plugin:runtime-pwsh`，分别按 `plugins -path '*/scripts/tests/*.test.js'` 与 `plugins -path '*/skills/*/scripts/tests/*.tests.ps1'` 发现用例。中央 `main` 可前进；共享作业或用例发现范围变化时同步更新本段和本地校验清单。

对映射文档、映射表或变体规则的改动，还必须按页面规则执行映射覆盖审计。先进入插件目录，再运行：

```powershell
node skills/mastergo-to-wpf/scripts/adapters/mtslg-iocontrol/audit-mtslg-feishu-map.js <doc> <map>
```

该命令需要本次变更对应的映射文档和映射表路径。

## 发版

版本写入插件自身的 `.claude-plugin/plugin.json`。当前 GitHub Release 工作流仅为 `mastergo-wpf-transcoder` 生成发布件；GitLab MR 合并且 GitHub 主线同步到同一提交后，按 [`docs/plugin-release.md`](docs/plugin-release.md) 推送 `v<version>` tag 到 GitHub。GitLab tag 不触发该发布工作流。其他插件通过 marketplace 源分发，不使用该 tag 工作流。所有已推送 tag 保持不变；错误发布需递增版本并为新提交创建新 tag。
