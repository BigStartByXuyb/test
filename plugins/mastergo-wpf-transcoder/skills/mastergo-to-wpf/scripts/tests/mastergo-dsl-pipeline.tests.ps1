$ErrorActionPreference = 'Stop'
$pipeline = Join-Path $PSScriptRoot '..\mastergo-dsl-pipeline.ps1'
$skill = Join-Path $PSScriptRoot '..\..\SKILL.md'
$root = Join-Path ([IO.Path]::GetTempPath()) "mastergo-dsl-capture-$([guid]::NewGuid().ToString('N'))"

function Assert-True {
    param([bool] $Condition, [string] $Message)
    if (-not $Condition) { throw "断言失败: $Message" }
}

function Invoke-Capture {
    param([string[]] $Arguments)
    & pwsh -NoProfile -File $pipeline @Arguments | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "capture action failed: $($Arguments -join ' ')" }
}

try {
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    $inputPath = Join-Path $root 'getDsl.json'
    $runDir = Join-Path $root 'run'
    [pscustomobject]@{
        dsl = [pscustomobject]@{
            styles = [pscustomobject]@{}
            nodes = @(
                [pscustomobject]@{
                    type = 'INSTANCE'
                    id = 'layer-1'
                    name = '整页'
                    layoutStyle = [pscustomobject]@{ width = 1280; height = 1024; relativeX = 0; relativeY = 0 }
                    children = @(
                        [pscustomobject]@{ type = 'TEXT'; id = 'node-1'; name = '标题'; text = @([pscustomobject]@{ text = '整页' }) }
                    )
                }
            )
            components = @()
        }
        componentDocumentLinks = @()
        rules = @('rule-1')
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $inputPath -Encoding UTF8

    Invoke-Capture @(
        '-Action', 'Capture',
        '-InputFile', $inputPath,
        '-Out', $runDir,
        '-FileId', 'file-1',
        '-LayerId', 'layer-1',
        '-Ui', 'F2',
        '-RunId', 'test-run',
        '-Egress', 'test-direct'
    )

    $snapshotPath = Join-Path $runDir 'dsl.snapshot.json'
    $snapshot = Get-Content -LiteralPath $snapshotPath -Raw | ConvertFrom-Json -Depth 100
    Assert-True ($snapshot.captureMode -eq 'mcp.getDsl') '快照必须记录一次性 getDsl 来源'
    Assert-True ($snapshot.layerId -eq 'layer-1') '快照必须保留根 layerId'
    Assert-True ($snapshot.nodeCount -eq 2) '快照节点数量必须完整'
    Assert-True (@($snapshot.dsl.nodes).Count -eq 1) '快照必须保留完整 DSL 根节点'
    Assert-True (@($snapshot.rules) -contains 'rule-1') '快照必须保留 MCP rules'

    # provenance：manifest 与快照都要记录原始 capture 的字节哈希/字节数/出网链路，
    # 且快照必须能回指到本次输入文件——哈希由测试独立复算，不信任脚本写出来的值。
    $inputSha256 = (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $inputBytes = (Get-Item -LiteralPath $inputPath).Length
    $manifestPath = Join-Path $runDir 'manifest.json'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -Depth 100
    Assert-True ($manifest.captureSha256 -eq $inputSha256) "manifest 必须记录原始 capture 的 sha256（小写十六进制），实际 $($manifest.captureSha256)"
    Assert-True ($manifest.captureBytes -eq $inputBytes) 'manifest 必须记录原始 capture 的字节数'
    Assert-True ($manifest.egress -eq 'test-direct') 'manifest 必须记录调用方声明的出网链路'
    Assert-True ($snapshot.captureSha256 -eq $inputSha256) '快照必须回指原始 capture 的 sha256'
    Assert-True ($snapshot.captureBytes -eq $inputBytes) '快照必须记录原始 capture 的字节数'
    Assert-True ($snapshot.egress -eq 'test-direct') '快照必须记录调用方声明的出网链路'
    Assert-True ($manifest.captureSha256 -eq $snapshot.captureSha256) 'manifest 与快照必须指向同一次 capture'

    $coverage = Get-Content -LiteralPath (Join-Path $runDir 'coverage-report.json') -Raw | ConvertFrom-Json -Depth 100
    Assert-True ($coverage.status -eq 'complete') '完整 DSL 覆盖校验必须通过'
    Assert-True ($null -eq $coverage.expectedNodeCount -and $coverage.capturedNodeCount -eq 2) '单响应覆盖必须记录实际节点数，不得伪造远端 expectedNodeCount'
    Assert-True ($coverage.validationBasis -eq 'single-response-structural-validation') '覆盖报告必须声明校验口径'
    Assert-True (@(Get-ChildItem -LiteralPath $runDir -File).Count -eq 4) '一次性捕获只应生成四份审计文件'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $runDir 'sections'))) '不得生成 section 目录'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $runDir 'status'))) '不得生成 section status 目录'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $runDir 'retry-manifest.json'))) '不得生成 section 重试清单'

    # 冻结守卫（放行侧）：同一份 capture 重跑同一 run 目录必须照常通过（幂等，不是「一把锁死」）。
    Invoke-Capture @(
        '-Action', 'Capture',
        '-InputFile', $inputPath,
        '-Out', $runDir,
        '-FileId', 'file-1',
        '-LayerId', 'layer-1',
        '-Ui', 'F2',
        '-RunId', 'test-run-rerun',
        '-Egress', 'test-direct'
    )
    $rerunManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -Depth 100
    Assert-True ($rerunManifest.runId -eq 'test-run-rerun') '同一 capture 重跑必须放行'
    Assert-True ($rerunManifest.captureSha256 -eq $inputSha256) '重跑后 capture 哈希必须保持不变'

    # 冻结守卫（拒绝侧）：换一份字节不同的 capture 落进已冻结目录，必须拒绝，
    # 且拒绝发生在任何写入之前——旧 manifest / 旧快照必须逐字节原样不动。
    $driftedInput = Join-Path $root 'getDsl-drifted.json'
    [pscustomobject]@{
        dsl = [pscustomobject]@{
            styles = [pscustomobject]@{}
            nodes = @(
                [pscustomobject]@{
                    type = 'INSTANCE'
                    id = 'layer-1'
                    name = '整页（第二次抓取）'
                    layoutStyle = [pscustomobject]@{ width = 1280; height = 1024; relativeX = 0; relativeY = 0 }
                    children = @(
                        [pscustomobject]@{ type = 'TEXT'; id = 'node-1'; name = '标题'; text = @([pscustomobject]@{ text = '整页' }) }
                    )
                }
            )
            components = @()
        }
        componentDocumentLinks = @()
        rules = @('rule-1')
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $driftedInput -Encoding UTF8
    $frozenManifestBefore = Get-Content -LiteralPath $manifestPath -Raw
    $frozenSnapshotBefore = Get-Content -LiteralPath $snapshotPath -Raw
    $refreezeFailed = $false
    try {
        Invoke-Capture @(
            '-Action', 'Capture',
            '-InputFile', $driftedInput,
            '-Out', $runDir,
            '-FileId', 'file-1',
            '-LayerId', 'layer-1',
            '-Ui', 'F2',
            '-RunId', 'test-run-drifted',
            '-Egress', 'test-direct'
        )
    }
    catch {
        $refreezeFailed = $true
    }
    Assert-True $refreezeFailed 'capture 哈希与已冻结基准不一致时必须拒绝执行'
    Assert-True ((Get-Content -LiteralPath $manifestPath -Raw) -eq $frozenManifestBefore) '被拒绝时不得改写已冻结的 manifest'
    Assert-True ((Get-Content -LiteralPath $snapshotPath -Raw) -eq $frozenSnapshotBefore) '被拒绝时不得改写已冻结的快照'

    # 冻结守卫（旧产物侧）：没有 captureSha256 的旧 manifest 无法核对来源，同样必须拒绝。
    $legacyRun = Join-Path $root 'legacy-run'
    New-Item -ItemType Directory -Force -Path $legacyRun | Out-Null
    [pscustomobject]@{ schemaVersion = 'mastergo-dsl-run/1'; runId = 'legacy'; fileId = 'file-1'; layerId = 'layer-1' } |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $legacyRun 'manifest.json') -Encoding UTF8
    $legacyFailed = $false
    try {
        Invoke-Capture @(
            '-Action', 'Capture',
            '-InputFile', $inputPath,
            '-Out', $legacyRun,
            '-FileId', 'file-1',
            '-LayerId', 'layer-1',
            '-Ui', 'F2',
            '-RunId', 'test-run-legacy',
            '-Egress', 'test-direct'
        )
    }
    catch {
        $legacyFailed = $true
    }
    Assert-True $legacyFailed '旧 manifest 缺少 captureSha256 时必须拒绝（无法核对它冻结的是哪次 capture）'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $legacyRun 'dsl.snapshot.json'))) '被拒绝时不得写入新的快照'

    $duplicateNode = [pscustomobject]@{
        type = 'GROUP'
        id = 'duplicate-node'
        name = '相同图标'
        layoutStyle = [pscustomobject]@{ width = 24; height = 24; relativeX = 0; relativeY = 0 }
        path = @([pscustomobject]@{ data = 'M0,0L1,1' })
    }
    $duplicateInput = Join-Path $root 'exact-duplicate.json'
    $duplicateRun = Join-Path $root 'exact-duplicate-run'
    [pscustomobject]@{
        dsl = [pscustomobject]@{
            styles = [pscustomobject]@{}
            nodes = @([pscustomobject]@{
                type = 'INSTANCE'
                id = 'duplicate-root'
                layoutStyle = [pscustomobject]@{ width = 1280; height = 1024; relativeX = 0; relativeY = 0 }
                children = @($duplicateNode, $duplicateNode)
            })
            components = @()
        }
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $duplicateInput -Encoding UTF8
    Invoke-Capture @('-Action', 'Capture', '-InputFile', $duplicateInput, '-Out', $duplicateRun, '-FileId', 'file-duplicate', '-LayerId', 'duplicate-root', '-Ui', 'F2', '-RunId', 'duplicate-run', '-Egress', 'test-direct')
    $duplicateSnapshot = Get-Content -LiteralPath (Join-Path $duplicateRun 'dsl.snapshot.json') -Raw | ConvertFrom-Json -Depth 100
    $duplicateCoverage = Get-Content -LiteralPath (Join-Path $duplicateRun 'coverage-report.json') -Raw | ConvertFrom-Json -Depth 100
    Assert-True (@($duplicateSnapshot.dsl.nodes[0].children).Count -eq 1) '完全相同的重复节点必须折叠为一个'
    Assert-True ($duplicateCoverage.status -eq 'complete') '完全相同的重复节点不应阻断捕获'
    Assert-True (@($duplicateCoverage.collapsedDuplicateRefs).Count -eq 1) '完全相同的重复节点必须写入折叠审计'
    Assert-True (@($duplicateCoverage.duplicateNodeRefs).Count -eq 0) '折叠重复节点不得进入冲突列表'

    $conflictNode = [pscustomobject]@{
        type = 'GROUP'
        id = 'duplicate-node'
        name = '不同内容'
        layoutStyle = [pscustomobject]@{ width = 30; height = 24; relativeX = 0; relativeY = 0 }
        path = @([pscustomobject]@{ data = 'M0,0L2,2' })
    }
    $conflictInput = Join-Path $root 'conflicting-duplicate.json'
    $conflictRun = Join-Path $root 'conflicting-duplicate-run'
    [pscustomobject]@{
        dsl = [pscustomobject]@{
            styles = [pscustomobject]@{}
            nodes = @([pscustomobject]@{
                type = 'INSTANCE'
                id = 'conflict-root'
                layoutStyle = [pscustomobject]@{ width = 1280; height = 1024; relativeX = 0; relativeY = 0 }
                children = @($duplicateNode, $conflictNode)
            })
            components = @()
        }
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $conflictInput -Encoding UTF8
    $conflictFailed = $false
    try {
        Invoke-Capture @('-Action', 'Capture', '-InputFile', $conflictInput, '-Out', $conflictRun, '-FileId', 'file-conflict', '-LayerId', 'conflict-root', '-Ui', 'F2', '-RunId', 'conflict-run', '-Egress', 'test-direct')
    }
    catch {
        $conflictFailed = $true
    }
    Assert-True $conflictFailed '内容不同的同 ID 节点必须阻断捕获'
    $conflictCoverage = Get-Content -LiteralPath (Join-Path $conflictRun 'coverage-report.json') -Raw | ConvertFrom-Json -Depth 100
    Assert-True (@($conflictCoverage.duplicateNodeRefs) -contains 'duplicate-node') '真正冲突的 ref 必须进入冲突列表'

    $skillText = Get-Content -LiteralPath $skill -Raw
    Assert-True ($skillText -match 'getDsl') 'Skill 必须强制使用一次性 getDsl'
    Assert-True ($skillText -match 'Capture') 'Skill 必须引用单次捕获流程'
    Assert-True ($skillText -notmatch 'getDesignSections') 'Skill 不得继续引用分段总览接口'
    Assert-True ($skillText -notmatch 'sectionIndex|retry-manifest|Init.*Write.*Merge') 'Skill 不得保留分段采集语义'
    Write-Output 'PASS MasterGo single-response DSL capture pipeline test'
}
finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
