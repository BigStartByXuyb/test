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
    [string] $RunId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# 输出编码：本脚本会往 stdout/stderr 写中文（失败原因、审计结论）。不显式设成 UTF-8 时，
# 被父进程按 UTF-8 解码就是乱码（表现为 "MasterGo getDsl ��Ӧ�� dsl.nodes[] Ϊ��"）。
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }

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

function Capture-Run {
    $inputPath = (Resolve-Path -LiteralPath $InputFile).Path
    $payload = Read-JsonFile -Path $inputPath -Label 'MasterGo getDsl 响应'
    if (-not ($payload.PSObject.Properties.Name -contains 'dsl') -or
        $null -eq $payload.dsl -or
        -not ($payload.dsl.PSObject.Properties.Name -contains 'nodes') -or
        $null -eq $payload.dsl.nodes) {
        throw 'MasterGo getDsl 响应缺少 dsl.nodes[]，拒绝生成快照'
    }

    $nodes = @($payload.dsl.nodes)
    if ($nodes.Count -eq 0) {
        throw ("MasterGo getDsl 响应的 dsl.nodes[] 为空（layerId=$LayerId）：" +
            '常见原因：① 传的是「页面」链接（page_id）而不是具体容器/控件；' +
            '② 该页画布在 MasterGo 里尚未加载完（先在 MasterGo 打开该文件、切到该页面，等画布加载完成后重试）；' +
            '③ token 无该文件权限')
    }
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
