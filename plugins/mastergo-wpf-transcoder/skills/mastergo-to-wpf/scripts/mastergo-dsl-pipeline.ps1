param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Capture')]
    [string] $Action,

    [Parameter(Mandatory = $true)]
    [string] $InputFile,

    [Parameter(Mandatory = $true)]
    [string] $Out,

    [Parameter(Mandatory = $true)]
    [string] $FileId,

    [Parameter(Mandatory = $true)]
    [string] $LayerId,

    [string] $PageName,
    [string] $Ui = 'F2',
    [string] $RunId,

    # 出网链路标签：与 call-mastergo-mcp.js 的 --egress 是同一个值（同一次抓取的同一份声明）。
    # 本次请求实际走哪条链路在脚本内不可知（代理/环境变量都可能被外层改写），因此只能由调用方
    # 传入；脚本不探测、不设默认值。缺省即拒绝执行，避免落一份来源不明的 provenance 基准。
    [Parameter(Mandatory = $true)]
    [string] $Egress
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-AtomicJson {
    param([string] $Path, [object] $Value)
    $parent = Split-Path -Parent $Path
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $temp = "$Path.tmp-$PID-$([DateTime]::UtcNow.Ticks)"
    $Value | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $temp -Encoding UTF8
    Move-Item -LiteralPath $temp -Destination $Path -Force
}

function Read-JsonFile {
    param([string] $Path, [string] $Label = 'JSON')
    try {
        return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json -Depth 100)
    }
    catch {
        throw "$Label 读取失败: $($_.Exception.Message)"
    }
}

function Get-RunId {
    return "$(Get-Date -Format 'yyyyMMddHHmmss')-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
}

function Normalize-ExactDuplicateNodes {
    param(
        [object[]] $Nodes,
        [string] $ParentRef,
        [string] $ContainerPath,
        [hashtable] $SeenByRef,
        [System.Collections.Generic.List[object]] $Collapsed,
        [System.Collections.Generic.HashSet[string]] $Conflicts
    )

    $normalized = [System.Collections.Generic.List[object]]::new()
    $index = 0
    foreach ($node in @($Nodes)) {
        if ($null -eq $node) { $index++; continue }
        if (-not ($node.PSObject.Properties.Name -contains 'id') -or -not [string] $node.id) {
            throw '完整 DSL 存在缺少 id 的节点，拒绝生成快照'
        }
        $ref = [string] $node.id
        $path = "$ContainerPath[$index]"
        $signature = $node | ConvertTo-Json -Depth 100 -Compress
        if ($SeenByRef.ContainsKey($ref)) {
            $previous = $SeenByRef[$ref]
            if ($previous.parentRef -eq $ParentRef -and $previous.signature -eq $signature) {
                $Collapsed.Add([pscustomobject]@{
                    ref = $ref
                    parentRef = $ParentRef
                    keptPath = $previous.path
                    duplicatePath = $path
                    reason = 'identical-node-duplicate'
                }) | Out-Null
                $index++
                continue
            }
            $Conflicts.Add($ref) | Out-Null
        }
        else {
            $SeenByRef[$ref] = [pscustomobject]@{
                parentRef = $ParentRef
                signature = $signature
                path = $path
            }
        }
        if ($node.PSObject.Properties.Name -contains 'children' -and $null -ne $node.children) {
            $children = Normalize-ExactDuplicateNodes `
                -Nodes @($node.children) `
                -ParentRef $ref `
                -ContainerPath "$path.children" `
                -SeenByRef $SeenByRef `
                -Collapsed $Collapsed `
                -Conflicts $Conflicts
            $node.children = @($children)
        }
        $normalized.Add($node) | Out-Null
        $index++
    }
    return @($normalized)
}

function Get-NodeRecords {
    param(
        [object[]] $Nodes,
        [System.Collections.Generic.List[object]] $Records,
        [System.Collections.Generic.HashSet[string]] $Seen,
        [System.Collections.Generic.HashSet[string]] $Duplicates,
        [string] $ParentRef
    )

    foreach ($node in @($Nodes)) {
        if ($null -eq $node) { continue }
        if (-not ($node.PSObject.Properties.Name -contains 'id') -or -not [string] $node.id) {
            throw '完整 DSL 存在缺少 id 的节点，拒绝生成快照'
        }
        $ref = [string] $node.id
        if (-not $Seen.Add($ref)) { $Duplicates.Add($ref) | Out-Null }
        $Records.Add([pscustomobject]@{
            ref = $ref
            parentRef = $ParentRef
            type = if ($node.PSObject.Properties.Name -contains 'type') { [string] $node.type } else { $null }
        })
        $children = if ($node.PSObject.Properties.Name -contains 'children') { @($node.children) } else { @() }
        Get-NodeRecords -Nodes $children -Records $Records -Seen $Seen -Duplicates $Duplicates -ParentRef $ref
    }
}

# 冻结守卫：一个 run 目录一旦冻结到某次 capture，就不允许静默换挂到另一次 capture 上。
# 同一 layerId 的 getDsl 响应逐次不一致（合并态/展开态两种下发形态），重新固化会让已冻结的
# provenance 基准失效，因此以 manifest.json 记录的 captureSha256（原始响应文件的字节哈希）判定：
#   无 manifest.json（首次冻结）        → 放行；
#   有 manifest.json 且哈希一致（重跑） → 放行；
#   哈希不一致，或记录里没有 captureSha256（守卫上线前的旧产物，无法核对来源）→ 拒绝执行。
# 有意重新冻结时，必须显式归档或删除旧 manifest.json 才能继续——这是预期行为，不是故障。
function Assert-CaptureFreeze {
    param(
        [string] $Out,
        [string] $InputPath,
        [string] $CaptureSha256
    )

    if (-not (Test-Path -LiteralPath $Out)) { return }
    $runDir = (Resolve-Path -LiteralPath $Out).Path
    $manifestPath = Join-Path $runDir 'manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath)) { return }

    $existing = Read-JsonFile -Path $manifestPath -Label '既存 manifest.json'
    $recorded = if ($existing.PSObject.Properties.Name -contains 'captureSha256' -and $existing.captureSha256) {
        ([string] $existing.captureSha256).Trim().ToLowerInvariant()
    }
    else { '' }
    if (-not $recorded) {
        throw "冻结守卫：$runDir 已存在 manifest.json，但没有 captureSha256（冻结守卫上线前的产物），无法核对它冻结的是哪次 capture。拒绝执行，避免把本次 capture 静默挂到旧产物上；确实要重新冻结时，先归档或删除 $manifestPath 再重跑。"
    }
    if ($recorded -ne $CaptureSha256) {
        throw "冻结守卫：$runDir 已冻结到另一次 capture（manifest.json 记录 $recorded，本次输入 $InputPath 为 $CaptureSha256），拒绝把快照重挂到新 capture 上；确实要重新冻结时，先归档或删除 $manifestPath（并一并处理同目录的 dsl.snapshot.json 等旧产物）再重跑。"
    }
}

function Capture-Run {
    $inputPath = (Resolve-Path -LiteralPath $InputFile).Path
    # provenance 基准：原始 capture 的字节哈希 + 字节数。守卫与产物记录共用这一次计算，
    # 保证「守的」与「记的」是同一份字节（哈希口径：SHA256、十六进制小写，与 Node 侧一致）。
    $inputHash = (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $inputBytes = [long] (Get-Item -LiteralPath $inputPath).Length
    Assert-CaptureFreeze -Out $Out -InputPath $inputPath -CaptureSha256 $inputHash

    $payload = Read-JsonFile -Path $inputPath -Label 'MasterGo getDsl 响应'
    if (-not ($payload.PSObject.Properties.Name -contains 'dsl') -or
        $null -eq $payload.dsl -or
        -not ($payload.dsl.PSObject.Properties.Name -contains 'nodes') -or
        $null -eq $payload.dsl.nodes) {
        throw 'MasterGo getDsl 响应缺少 dsl.nodes[]，拒绝生成快照'
    }

    $nodes = @($payload.dsl.nodes)
    if ($nodes.Count -eq 0) { throw 'MasterGo getDsl 响应的 dsl.nodes[] 为空' }
    $root = $nodes[0]
    $rootId = if ($root.PSObject.Properties.Name -contains 'id') { [string] $root.id } else { '' }
    if (-not $rootId -or $rootId -ne $LayerId) {
        throw "根节点 layerId 不匹配：期望 $LayerId，实际 $rootId"
    }

    $seenByRef = @{}
    $collapsed = [System.Collections.Generic.List[object]]::new()
    $duplicates = [System.Collections.Generic.HashSet[string]]::new()
    $nodes = @(Normalize-ExactDuplicateNodes `
        -Nodes $nodes `
        -ParentRef $null `
        -ContainerPath '$root[0]' `
        -SeenByRef $seenByRef `
        -Collapsed $collapsed `
        -Conflicts $duplicates)
    $payload.dsl.nodes = @($nodes)

    $records = [System.Collections.Generic.List[object]]::new()
    $seen = [System.Collections.Generic.HashSet[string]]::new()
    $recordDuplicates = [System.Collections.Generic.HashSet[string]]::new()
    Get-NodeRecords -Nodes $nodes -Records $records -Seen $seen -Duplicates $recordDuplicates -ParentRef $null
    $unknownParents = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($record in $records) {
        if ($record.parentRef -and -not $seen.Contains($record.parentRef)) {
            $unknownParents.Add($record.parentRef) | Out-Null
        }
    }

    $runIdValue = if ($RunId) { $RunId } else { Get-RunId }
    $startedAt = [DateTime]::UtcNow
    $resolvedPageName = if ($PageName) { $PageName }
        elseif ($root.PSObject.Properties.Name -contains 'name' -and $root.name) { [string] $root.name }
        else { $LayerId }
    $nodeCount = $records.Count
    $status = if ($duplicates.Count -eq 0 -and $unknownParents.Count -eq 0) { 'complete' } else { 'incomplete' }
    $completedAt = [DateTime]::UtcNow

    New-Item -ItemType Directory -Force -Path $Out | Out-Null
    $runDir = (Resolve-Path -LiteralPath $Out).Path

    $manifest = [pscustomobject]@{
        schemaVersion = 'mastergo-dsl-run/2'
        runId = $runIdValue
        captureMode = 'mcp.getDsl'
        # provenance：本次冻结消费的原始 capture（getDsl.json）字节哈希/字节数与出网链路标签。
        captureSha256 = $inputHash
        captureBytes = $inputBytes
        egress = $Egress
        fileId = $FileId
        layerId = $LayerId
        pageName = $resolvedPageName
        ui = $Ui
        format = 'json'
        startedAt = $startedAt.ToString('o')
        completedAt = $completedAt.ToString('o')
        nodeCount = $nodeCount
    }
    $snapshot = [pscustomobject]@{
        schemaVersion = 'mastergo-dsl-snapshot/2'
        runId = $runIdValue
        captureMode = 'mcp.getDsl'
        # 快照回指原始 capture：生成链路读的是本快照，靠这三个字段才能回答
        # 「这份快照源自哪一次 getDsl 响应、走了哪条链路」。
        captureSha256 = $inputHash
        captureBytes = $inputBytes
        egress = $Egress
        fileId = $FileId
        layerId = $LayerId
        pageName = $resolvedPageName
        ui = $Ui
        nodeCount = $nodeCount
        dsl = $payload.dsl
        componentDocumentLinks = if ($payload.PSObject.Properties.Name -contains 'componentDocumentLinks') { @($payload.componentDocumentLinks) } else { @() }
        rules = if ($payload.PSObject.Properties.Name -contains 'rules') { @($payload.rules) } else { @() }
    }
    $coverage = [pscustomobject]@{
        schemaVersion = 'mastergo-dsl-coverage/2'
        runId = $runIdValue
        captureMode = 'mcp.getDsl'
        status = $status
        expectedNodeCount = $null
        capturedNodeCount = $nodeCount
        validationBasis = 'single-response-structural-validation'
        duplicateNodeRefs = @($duplicates | Sort-Object)
        collapsedDuplicateRefs = @($collapsed)
        unknownParentRefs = @($unknownParents | Sort-Object)
        checkedAt = $completedAt.ToString('o')
    }
    $timing = [pscustomobject]@{
        schemaVersion = 'mastergo-dsl-timing/2'
        runId = $runIdValue
        captureMode = 'mcp.getDsl'
        totalWallClockMs = [int]($completedAt - $startedAt).TotalMilliseconds
        completedAt = $completedAt.ToString('o')
    }

    Write-AtomicJson -Path (Join-Path $runDir 'manifest.json') -Value $manifest
    Write-AtomicJson -Path (Join-Path $runDir 'dsl.snapshot.json') -Value $snapshot
    Write-AtomicJson -Path (Join-Path $runDir 'coverage-report.json') -Value $coverage
    Write-AtomicJson -Path (Join-Path $runDir 'timing.json') -Value $timing

    if ($status -ne 'complete') {
        throw "完整 DSL 覆盖校验未通过: $((@{ duplicateNodeRefs = @($duplicates); unknownParentRefs = @($unknownParents) } | ConvertTo-Json -Compress))"
    }
    [pscustomobject]@{
        status = $status
        snapshot = (Join-Path $runDir 'dsl.snapshot.json')
        coverage = (Join-Path $runDir 'coverage-report.json')
        nodeCount = $nodeCount
    } | ConvertTo-Json
}

try {
    switch ($Action) {
        'Capture' { Capture-Run }
    }
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
