$ErrorActionPreference = 'Stop'
$runAll = Join-Path $PSScriptRoot '..\entry\run-all.ps1'
$registry = Join-Path $PSScriptRoot '..\core\run-registry.mjs'
$failureCodes = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\lib\failure-codes.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$missingCode = [string] $failureCodes.layoutGroups.missing
$rejectedCode = [string] $failureCodes.layoutGroups.rejected
$root = Join-Path ([IO.Path]::GetTempPath()) "mastergo-failure-summary-$([guid]::NewGuid().ToString('N'))"

function Assert-True {
    param([bool] $Condition, [string] $Message)
    if (-not $Condition) { throw "断言失败: $Message" }
}

# 本用例从 layout 进入，不联网；给 run-all 一个格式合法的桩 token，避免它去读本机配置。
$env:MASTERGO_MCP_TOKEN = 'mg_' + ('0' * 32)

try {
    $generated = Join-Path $root 'Generated'
    $runDir = Join-Path (Join-Path $generated 'runs') 'Demo'
    $inputs = Join-Path $generated '_inputs'
    New-Item -ItemType Directory -Force -Path $runDir, $inputs, $generated | Out-Null

    $dsl = [ordered]@{
        dsl = [ordered]@{
            nodes = @(
                [ordered]@{
                    type = 'INSTANCE'; id = '1:1'; name = 'Page'
                    layoutStyle = [ordered]@{ width = 100; height = 100; relativeX = 0; relativeY = 0 }
                    children = @(
                        [ordered]@{
                            type = 'FRAME'; id = '1:1/bar'; name = '底部button'
                            layoutStyle = [ordered]@{ width = 100; height = 20; relativeX = 0; relativeY = 80 }
                            children = @(
                                [ordered]@{
                                    type = 'INSTANCE'; id = '1:1/bar/resident'; name = '右侧底部-常驻button'
                                    layoutStyle = [ordered]@{ width = 50; height = 20; relativeX = 50; relativeY = 0 }
                                    children = @()
                                }
                            )
                        }
                    )
                }
            )
            styles = [ordered]@{}
            components = @()
        }
    }
    $snapshot = Join-Path $runDir 'dsl.snapshot.json'
    $iconMap = Join-Path $inputs 'Demo.icon-map.json'
    ($dsl | ConvertTo-Json -Depth 20) | Set-Content -LiteralPath $snapshot -Encoding UTF8
    '{"icons":[]}' | Set-Content -LiteralPath $iconMap -Encoding UTF8
    '{"nodes":[]}' | Set-Content -LiteralPath (Join-Path $generated 'Demo.component-types.json') -Encoding UTF8
    '{"nodes":[]}' | Set-Content -LiteralPath (Join-Path $runDir 'visibility.json') -Encoding UTF8
    '{"schemaVersion":"wrong","groups":[]}' |
        Set-Content -LiteralPath (Join-Path $inputs 'Demo.layout-groups.json') -Encoding UTF8

    & node $registry init --project-root $root --target Demo --file-id file-A --layer-id layer-A `
        --ui F8 --mode mw-wpf --design-page '设计页 A' | Out-Null
    & node $registry artifact --run (Join-Path $runDir 'run.json') --key snapshot --path $snapshot --step 2 | Out-Null
    & node $registry artifact --run (Join-Path $runDir 'run.json') --key iconMap --path $iconMap --step 7 | Out-Null

    $output = & pwsh -NoProfile -File $runAll -ProjectRoot $root -Target Demo -Mode mw-wpf `
        -FileId file-A -LayerId layer-A -Ui F8 -DesignPageName '设计页 A' -Progress layout 2>&1 | Out-String

    $rejectedPattern = '(?m)^!! 步骤 8\(layout\) 失败：\[' + [regex]::Escape($rejectedCode) + '\] 分组表 schemaVersion'
    Assert-True ($output -match $rejectedPattern) `
        "机器码必须进入失败摘要首行，GUI 才能识别恢复入口。实际输出：`n$output"
    Assert-True ($output -notmatch '(?m)^!! 步骤 8\(layout\) 失败：wpf layout 失败') `
        "失败摘要首行不能只剩命令摘要"

    $run = Get-Content -LiteralPath (Join-Path $runDir 'run.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $step = @($run.steps) | Where-Object { $_.id -eq 8 } | Select-Object -First 1
    Assert-True ($step.note -match ('^\[' + [regex]::Escape($rejectedCode) + '\]')) `
        "运行登记表失败摘要同样必须以机器码开头"

    Remove-Item -LiteralPath (Join-Path $inputs 'Demo.layout-groups.json') -Force
    [IO.File]::WriteAllBytes(
        (Join-Path $inputs 'Demo.design.png'),
        [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=')
    )
    $missingOutput = & pwsh -NoProfile -File $runAll -ProjectRoot $root -Target Demo -Mode mw-wpf `
        -FileId file-A -LayerId layer-A -Ui F8 -DesignPageName '设计页 A' -Progress layout 2>&1 | Out-String
    $missingPattern = '(?m)^!! 步骤 8\(layout\) 失败：\[' + [regex]::Escape($missingCode) + '\] 有页面位图'
    Assert-True ($missingOutput -match $missingPattern) `
        "缺表机器码必须进入失败摘要首行。实际输出：`n$missingOutput"

    Write-Output 'PASS run-all 分组缺失与拒收机器码进入摘要首行'
}
finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
