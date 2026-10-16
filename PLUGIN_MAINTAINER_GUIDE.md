# 插件维护指南

## 适用范围

本指南适用于维护仓库根目录 `.claude-plugin/marketplace.json` 和 `plugins/` 下的插件。

## 安装基础插件

市场维护人员先登记 README 中的 GitLab marketplace 源，再安装并启用 `agent-plugin-publisher`。其他插件按 [插件清单](docs/PLUGINS.md) 的用途和技能入口选装。

## 新增或更新插件

1. 首次由 Maintainer 从 GitLab `main` 创建并推送共享的 `plugin-migration` 分支。
2. 每位维护者 checkout `plugin-migration`，提交前执行 `git pull --rebase origin plugin-migration`。
3. 新插件放在 `plugins/<plugin-id>/`，并建立 `.claude-plugin/plugin.json`。
4. 每项技能放在 `skills/<skill-id>/SKILL.md`；MCP 配置和 Subagent 按需要放入插件目录。
5. 在根 `.claude-plugin/marketplace.json` 中新增或更新唯一的 `source` 条目。
6. 在 `docs/PLUGINS.md` 中同步维护用途、技能入口和安装要求。
7. ID、目录和清单路径保持一致，不能新增重复的插件 ID。

## 本地校验

从仓库根目录执行 Claude Code marketplace 严格校验：

```sh
claude plugin validate --strict .
```

PowerShell 7 中运行 CI 使用的插件 JavaScript 和 PowerShell 用例：

```powershell
$nodeTests = Get-ChildItem plugins -Recurse -File -Filter '*.test.js' |
  Where-Object { $_.FullName -match '[\\/]scripts[\\/]tests[\\/]' } |
  ForEach-Object FullName
if ($nodeTests.Count -eq 0) { throw '没有找到插件 Node 测试' }
node --test $nodeTests

$psTests = Get-ChildItem plugins -Recurse -File -Filter '*.tests.ps1' |
  Where-Object { $_.FullName -match '[\\/]skills[\\/].*[\\/]scripts[\\/]tests[\\/]' }
foreach ($test in $psTests) {
  pwsh -NoProfile -File $test.FullName
  if ($LASTEXITCODE -ne 0) { throw "PowerShell 测试失败: $($test.Name)" }
}

git diff --check
```

MasterGo 页面坐标与来源校验是页面级检查，不是无参数的市场校验。坐标检查器需要 `--xml` 和 `--nodes` 输入；provenance 检查器按页面流水线生成的 mapping 输入执行。对应契约见 `plugins/mastergo-wpf-transcoder/skills/mastergo-to-wpf/SKILL.md`。

## 提交和合并

`plugin-migration` 是日常维护分支。首次使用时从 GitLab `main` 创建该分支并推送到 GitLab；后续更新先拉取远端分支，完成本地校验后推送，并创建目标为 `main` 的 Merge Request。不要直接推送受保护的 `main`。

GitLab CI 使用 `data_ai/cicd` 的共享模板。调用项目的 Job Token allowlist、Linux Docker Runner 和 masked CI/CD 变量由 Maintainer 配置；密钥不保存在仓库中。

## 发版

版本写入插件自身的 `.claude-plugin/plugin.json`。按 [`docs/plugin-release.md`](docs/plugin-release.md) 选择版本位，并为包含该版本的提交推送 `v<version>` tag。已推送 tag 不移动或覆盖。
