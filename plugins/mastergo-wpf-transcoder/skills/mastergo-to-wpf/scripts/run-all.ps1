<#
    run-all.ps1 —— 一条命令跑完整条 MasterGo → MTSLG IOContorl 链路（带断点续跑）

    流程本身不变：与手工逐条执行的是同一批脚本、同一顺序、同一套硬门禁。
    变的是「谁来一条条敲」：这里由脚本在单次调用内串起来跑，中间不经过模型往返。

    断点续跑：
        -Progress <步骤号或步骤名>   从该步开始（默认 1）
        -StopAfter <步骤号或步骤名>  跑到该步后停止（用于「先出待命名清单，再回来跑后半段」）
        每一步的 stdout/stderr 都写进 Generated\_work\steps\<NN>-<名字>.log；
        某步失败时脚本打印该步日志路径并停止，修好输入后从该步继续即可。

    例：
        pwsh -NoProfile -File _tool\run-all.ps1 -List
        pwsh -NoProfile -File _tool\run-all.ps1 -LayerId <图层id> -Target <页面Target> -StopAfter discover
        pwsh -NoProfile -File _tool\run-all.ps1 -Progress layout          # 图标台账/译文改好之后
        pwsh -NoProfile -File _tool\run-all.ps1 -Progress bundle -Overwrite
        pwsh -NoProfile -File _tool\run-all.ps1 -Progress verify
#>
[CmdletBinding()]
param(
    [string] $ProjectRoot,
    [string] $SkillRoot,
    [string] $FileId = '181586559903927',
    [string] $LayerId,
    [string] $Ui = 'F2',
    [string] $Target,
    [string] $DesignPageName = '',
    [string] $Progress = '1',
    [string] $StopAfter = '',
    [switch] $Overwrite,
    [switch] $AllowEmptyLedger,
    [switch] $List,
    [string] $ConfigPath = 'C:\Users\xuyb\.codex\config.toml'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 两种布局都要能跑：
#   插件布局   <plugin>/skills/mastergo-to-wpf/scripts/run-all.ps1  → 脚本目录的父目录就是 skill 根
#   项目布局   <project>/_tool/run-all.ps1                          → skill 在 _tool\mastergo-to-wpf
$pluginLayout = -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'mastergo-to-wpf'))
if (-not $SkillRoot) {
    $SkillRoot = if ($pluginLayout) { Split-Path -Parent $PSScriptRoot } else { Join-Path $PSScriptRoot 'mastergo-to-wpf' }
}
if (-not $ProjectRoot) {
    # 插件布局下工作目录就是目标项目；项目布局下是脚本目录的父目录。
    $ProjectRoot = if ($pluginLayout) { (Get-Location).Path } else { Split-Path -Parent $PSScriptRoot }
}
if (-not (Test-Path -LiteralPath $ProjectRoot)) { New-Item -ItemType Directory -Force -Path $ProjectRoot | Out-Null }
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$ScriptsFolder = Join-Path $SkillRoot 'scripts'
$TemplateMap = Join-Path $SkillRoot 'references\adapters\mtslg-iocontrol\mtslg-iocontrol-map.json'

# 步骤表：Id / 名称 / 说明 / 依赖（用于断点续跑时的前置检查）
$Steps = @(
    [pscustomobject]@{ Id = 1;  Name = 'fetch';      Title = '取数 getDsl（只落盘，不进上下文）';                 Needs = @() },
    [pscustomobject]@{ Id = 2;  Name = 'capture';    Title = 'DSL 结构化快照 + 覆盖校验';                        Needs = @('fetch') },
    [pscustomobject]@{ Id = 3;  Name = 'svg';        Title = 'extractSvg 图标几何';                              Needs = @() },
    [pscustomobject]@{ Id = 4;  Name = 'visibility'; Title = '显隐事实提取';                                     Needs = @('capture') },
    [pscustomobject]@{ Id = 5;  Name = 'mapping';    Title = 'mapping 草稿（按当前台账）';                        Needs = @('capture', 'visibility') },
    [pscustomobject]@{ Id = 6;  Name = 'discover';   Title = '图标候选发现 + 打印待命名清单';                     Needs = @('svg', 'mapping') },
    [pscustomobject]@{ Id = 7;  Name = 'ledger';     Title = '校验图标台账（人工/AI 定名后的输入）';              Needs = @() },
    [pscustomobject]@{ Id = 8;  Name = 'layout';     Title = 'Layout 清单机械推导（底部栏 MenuItem）';            Needs = @('ledger') },
    [pscustomobject]@{ Id = 9;  Name = 'inputs';     Title = '校验译文并生成 Bundle 清单';                        Needs = @('layout') },
    [pscustomobject]@{ Id = 10; Name = 'bundle';     Title = 'Bundle 生成页面 XML / Icon / Layout / 宿主壳';      Needs = @('inputs', 'svg', 'capture', 'visibility') },
    [pscustomobject]@{ Id = 11; Name = 'gates';      Title = '严格门禁（审计逐条断言）';                          Needs = @('bundle') },
    [pscustomobject]@{ Id = 12; Name = 'verify';     Title = '四项独立验证（provenance / 坐标 / Icon / 结构）';   Needs = @() }
)

if ($List) {
    $Steps | ForEach-Object { '{0,2}  {1,-10} {2}' -f $_.Id, $_.Name, $_.Title }
    Write-Output ''
    Write-Output '用法: -Progress <步骤> / -StopAfter <步骤>，可写步骤号或步骤名。'
    exit 0
}

# ---------- 基础工具 ----------
function Get-Step {
    param([string] $Spec)
    $step = $Steps | Where-Object { $_.Name -eq $Spec -or ([string]$_.Id) -eq $Spec } | Select-Object -First 1
    if (-not $step) { throw "未知步骤: $Spec（可用: $($Steps.Name -join ', ')）" }
    return $step
}

function Get-ProjectTarget {
    param([string] $Root)
    $registry = Join-Path $Root 'docs\page-registry.json'
    if (-not (Test-Path -LiteralPath $registry)) { return $null }
    $doc = Get-Content -LiteralPath $registry -Raw -Encoding UTF8 | ConvertFrom-Json
    $page = @($doc.pages)[0]
    return [pscustomobject]@{
        Target  = $page.target
        LayerId = $page.designSource.layerId
        FileId  = $page.designSource.fileId
        Ui      = if ($page.derivation -match '\bF\d+\b') { $Matches[0] } else { $null }
        Design  = $page.designSource.designPageName
    }
}

function Get-MastergoToken {
    if ($env:MASTERGO_MCP_TOKEN) { return $env:MASTERGO_MCP_TOKEN }
    if (Test-Path -LiteralPath $ConfigPath) {
        $cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8
        if ($cfg -match '--token=(mg_[0-9a-fA-F]+)') { return $Matches[1] }
    }
    throw "缺少 MasterGo token：设置环境变量 MASTERGO_MCP_TOKEN 或确认 $ConfigPath 里的 mastergo 配置（token 不会写入任何产物）"
}

function Invoke-StepCommand {
    param([string] $Label, [string] $LogFile, [string] $File, [string[]] $Arguments)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogFile) | Out-Null
    # 子进程固定以项目根为工作目录：脚本内部若出现相对路径，解析结果与手工在项目根执行一致。
    Push-Location $ProjectRoot
    try { $output = & $File @Arguments 2>&1 | Out-String }
    finally { Pop-Location }
    Set-Content -LiteralPath $LogFile -Value $output -Encoding UTF8
    if ($LASTEXITCODE -ne 0) {
        throw "$Label 失败（exit=$LASTEXITCODE）。日志: $LogFile`n" + (($output.Trim() -split "`n" | Select-Object -Last 12) -join "`n")
    }
    return $output
}

function Assert-File {
    param([string] $Path, [string] $Message)
    if (-not (Test-Path -LiteralPath $Path)) { throw $Message }
}

# JSON 审计里缺字段是常态（ConvertFrom-Json 不会补 null 属性），
# Set-StrictMode 下直接取不存在的属性会抛异常，所以统一走这个取值函数。
function Get-Prop {
    param($Object, [string] $Name, $Default = $null)
    if ($null -eq $Object) { return $Default }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $Default }
    return $property.Value
}

$Token = Get-MastergoToken
$env:MASTERGO_MCP_TOKEN = $Token

$Registry = Get-ProjectTarget -Root $ProjectRoot
if ($Registry) {
    if (-not $Target) { $Target = $Registry.Target }
    if (-not $LayerId) { $LayerId = $Registry.LayerId }
    if (-not $FileId -or $FileId -eq '181586559903927') { $FileId = $Registry.FileId }
    if (-not $DesignPageName) { $DesignPageName = $Registry.Design }
}

foreach ($required in @('Target', 'LayerId')) {
    $value = Get-Variable -Name $required -ValueOnly
    if (-not $value) { throw "缺少 -$required（或在 docs/page-registry.json 里登记后省略）" }
}

$Generated = Join-Path $ProjectRoot 'Generated'
$Inputs = Join-Path $Generated '_inputs'
$Work = Join-Path $Generated '_work'
$StepLogs = Join-Path $Work 'steps'
$GetDslJson = Join-Path $Generated 'getDsl.json'
$SnapshotJson = Join-Path $Generated 'dsl.snapshot.json'
$CoverageJson = Join-Path $Generated 'coverage-report.json'
$SvgJson = Join-Path $Generated 'extractSvg.json'
$VisibilityJson = Join-Path $Generated 'visibility.json'
$LedgerJson = Join-Path $Inputs "$Target.icon-map.json"
$CandidateJson = Join-Path $Inputs "$Target.icon-candidates.json"
$TranslationsJson = Join-Path $Inputs "$Target.lang-translations.json"
$LayoutManifestJson = Join-Path $Inputs "$Target.layout-manifest.json"
$BundleJson = Join-Path $Inputs "$Target.bundle.json"
$DraftMappingJson = Join-Path $Work "$Target.mapping.draft.json"
$MappingAuditJson = Join-Path $Generated "$Target.mapping.json"
$BundleAuditJson = Join-Path $Generated "$Target.bundle.manifest.json"
$PageXml = Join-Path $ProjectRoot "Resources\Pages\$Target\${Target}Page.xml"

$StartStep = Get-Step $Progress
$EndStep = if ($StopAfter) { Get-Step $StopAfter } else { $Steps[-1] }
if ($EndStep.Id -lt $StartStep.Id) { throw "-StopAfter 不能早于 -Progress" }

Write-Output ("项目: {0}" -f $ProjectRoot)
Write-Output ("Target: {0}   LayerId: {1}   Ui: {2}" -f $Target, $LayerId, $Ui)
Write-Output ("区间: {0}({1}) → {2}({3})" -f $StartStep.Id, $StartStep.Name, $EndStep.Id, $EndStep.Name)
Write-Output ''

$results = New-Object System.Collections.Generic.List[object]
$warnings = New-Object System.Collections.Generic.List[string]

foreach ($step in $Steps) {
    if ($step.Id -lt $StartStep.Id -or $step.Id -gt $EndStep.Id) { continue }

    # 前置检查：断点续跑时，前面跳过但仍需存在的产物在这里兜底
    switch ($step.Name) {
        'capture'    { Assert-File $GetDslJson   "缺少 $GetDslJson：请先跑 -Progress fetch" }
        'visibility' { Assert-File $SnapshotJson "缺少 $SnapshotJson：请先跑 -Progress capture" }
        'mapping'    { Assert-File $SnapshotJson "缺少 $SnapshotJson：请先跑 -Progress capture"
                       Assert-File $VisibilityJson "缺少 $VisibilityJson：请先跑 -Progress visibility" }
        'discover'   { Assert-File $SvgJson "缺少 $SvgJson：请先跑 -Progress svg"
                       $mappingForDiscover = if (Test-Path -LiteralPath $DraftMappingJson) { $DraftMappingJson } else { $MappingAuditJson }
                       Assert-File $mappingForDiscover "缺少 mapping（$DraftMappingJson 或 $MappingAuditJson）：请先跑 -Progress mapping" }
        'layout'     { if (-not $AllowEmptyLedger) { Assert-File $LedgerJson "缺少图标台账 $LedgerJson（人工/AI 定名后的输入）" } }
        'inputs'     { if (-not $AllowEmptyLedger) { Assert-File $LedgerJson "缺少图标台账 $LedgerJson" }
                       Assert-File $TranslationsJson "缺少译文清单 $TranslationsJson（页面文案的英文译文必须显式落盘）" }
        'bundle'     { Assert-File $BundleJson "缺少 Bundle 清单 $BundleJson：请先跑 -Progress inputs"
                       Assert-File $SvgJson "缺少 $SvgJson：请先跑 -Progress svg" }
        'gates'      { Assert-File $BundleAuditJson "缺少 Bundle 审计 $BundleAuditJson：请先跑 -Progress bundle" }
        'verify'     { Assert-File $PageXml "缺少页面 XML $PageXml：请先跑 -Progress bundle" }
    }

    $log = Join-Path $StepLogs ('{0:D2}-{1}.log' -f $step.Id, $step.Name)
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    $note = ''
    Write-Output ("[{0:D2}] {1} …" -f $step.Id, $step.Title)

    try {
        switch ($step.Name) {
            'fetch' {
                Invoke-StepCommand -Label 'getDsl' -LogFile $log -File 'node' -Arguments @(
                    (Join-Path $ScriptsFolder 'call-mastergo-mcp.js'), '--tool', 'getDsl',
                    '--fileId', $FileId, '--layerId', $LayerId, '--format', 'json', '--out', $GetDslJson) | Out-Null
            }
            'capture' {
                Invoke-StepCommand -Label 'Capture' -LogFile $log -File 'pwsh' -Arguments @(
                    '-NoProfile', '-File', (Join-Path $ScriptsFolder 'mastergo-dsl-pipeline.ps1'),
                    '-Action', 'Capture', '-InputFile', $GetDslJson, '-Out', $Generated,
                    '-FileId', $FileId, '-LayerId', $LayerId, '-Ui', $Ui, '-PageName', $DesignPageName) | Out-Null
                $coverage = Get-Content -LiteralPath $CoverageJson -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($coverage.status -ne 'complete') { throw "覆盖校验未通过: status=$($coverage.status)（日志: $log）" }
                $note = "节点 $($coverage.capturedNodeCount)"
            }
            'svg' {
                Invoke-StepCommand -Label 'extractSvg' -LogFile $log -File 'node' -Arguments @(
                    (Join-Path $ScriptsFolder 'call-mastergo-mcp.js'), '--tool', 'extractSvg',
                    '--fileId', $FileId, '--layerId', $LayerId, '--page', '0', '--pageSize', '100',
                    '--out', $SvgJson) | Out-Null
            }
            'visibility' {
                Invoke-StepCommand -Label 'visibility' -LogFile $log -File 'node' -Arguments @(
                    (Join-Path $ScriptsFolder 'resolve-mastergo-visibility.js'), '--input', $SnapshotJson,
                    '--out', $VisibilityJson) | Out-Null
            }
            'mapping' {
                $ledgerForDraft = if (Test-Path -LiteralPath $LedgerJson) { $LedgerJson } else { $CandidateJson }
                if (-not (Test-Path -LiteralPath $ledgerForDraft)) {
                    New-Item -ItemType Directory -Force -Path $Inputs | Out-Null
                    '{ "icons": [], "candidates": [], "unmapped": [] }' | Set-Content -LiteralPath $CandidateJson -Encoding UTF8
                    $ledgerForDraft = $CandidateJson
                }
                Invoke-StepCommand -Label 'mapping draft' -LogFile $log -File 'node' -Arguments @(
                    (Join-Path $ScriptsFolder 'gen-mtslg-mapping-from-dsl.js'), '--dsl', $SnapshotJson,
                    '--visibility', $VisibilityJson, '--template-map', $TemplateMap,
                    '--icon-map', $ledgerForDraft, '--out', $DraftMappingJson) | Out-Null
            }
            'discover' {
                $mappingForDiscover = if (Test-Path -LiteralPath $DraftMappingJson) { $DraftMappingJson } else { $MappingAuditJson }
                $confirmed = if (Test-Path -LiteralPath $LedgerJson) { $LedgerJson } else { $CandidateJson }
                Invoke-StepCommand -Label 'discover' -LogFile $log -File 'node' -Arguments @(
                    (Join-Path $ScriptsFolder 'discover-mtslg-page-icon-map.js'), '--svg', $SvgJson,
                    '--mapping', $mappingForDiscover, '--confirmed', $confirmed,
                    '--dsl', $SnapshotJson, '--out', $CandidateJson) | Out-Null
                $note = "待命名清单: $CandidateJson（候选数见日志 $log）"
            }
            'ledger' {
                if (-not (Test-Path -LiteralPath $LedgerJson)) {
                    if (-not $AllowEmptyLedger) {
                        throw "缺少图标台账 $LedgerJson：请先把候选清单里被 Icon 槽位引用的图形定名写进 icons[]（若本页确实没有图标槽位，加 -AllowEmptyLedger）"
                    }
                    New-Item -ItemType Directory -Force -Path $Inputs | Out-Null
                    '{ "icons": [], "candidates": [], "unmapped": [] }' | Set-Content -LiteralPath $LedgerJson -Encoding UTF8
                    $note = '已写入空台账占位（-AllowEmptyLedger）'
                }
                $ledger = Get-Content -LiteralPath $LedgerJson -Raw -Encoding UTF8 | ConvertFrom-Json
                $icons = @($ledger.icons)
                if ($icons.Count -eq 0 -and -not $AllowEmptyLedger) {
                    throw "图标台账 $LedgerJson 的 icons[] 为空。若本页确实没有任何 Icon 槽位，加 -AllowEmptyLedger；否则请先把候选清单里的图标定名写进台账。"
                }
                if ($icons.Count) { $note = "已登记图标 $($icons.Count) 个" }
            }
            'layout' {
                Invoke-StepCommand -Label 'layout manifest' -LogFile $log -File 'node' -Arguments @(
                    (Join-Path $ScriptsFolder 'gen-mtslg-layout-manifest.js'), '--dsl', $SnapshotJson,
                    '--icon-map', $LedgerJson, '--map', $TemplateMap,
                    '--page-target', $Target, '--page-lang-name', "${Target}PageTitle",
                    '--layout-path', 'Resources/Layout/Layout.xml',
                    '--out', $LayoutManifestJson,
                    '--report', (Join-Path $Inputs "$Target.layout-manifest.report.json")) | Out-Null
                $layout = Get-Content -LiteralPath $LayoutManifestJson -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($layout.layoutStatus -ne 'complete') { throw "Layout 清单不完整: layoutStatus=$($layout.layoutStatus)（日志: $log）" }
                if ($layout.layoutEvidence.unresolvedBottomBarItems -ne 0) { throw "底部栏有 $($layout.layoutEvidence.unresolvedBottomBarItems) 个未命中变体的实例（日志: $log）" }
                $note = "菜单项 $(@($layout.menuItems).Count) 个"
            }
            'inputs' {
                $args = @((Join-Path $PSScriptRoot 'build-bundle-manifest.mjs'), $LayoutManifestJson, $BundleJson, $ProjectRoot, $Ui)
                if ($Overwrite) { $args += '--replace-existing' }
                Invoke-StepCommand -Label 'bundle manifest' -LogFile $log -File 'node' -Arguments $args | Out-Null
            }
            'bundle' {
                $args = @((Join-Path $ScriptsFolder 'gen-mastergo-page-bundle.js'), '--manifest', $BundleJson)
                if ($Overwrite) { $args += '--overwrite' }
                Invoke-StepCommand -Label 'bundle' -LogFile $log -File 'node' -Arguments $args | Out-Null
            }
            'gates' {
                $coverage = Get-Content -LiteralPath $CoverageJson -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($coverage.status -ne 'complete') { throw "覆盖校验 status=$($coverage.status)" }
                if (@($coverage.duplicateNodeRefs).Count) { throw "存在重复 ref: $($coverage.duplicateNodeRefs -join ', ')" }
                if (@($coverage.unknownParentRefs).Count) { throw "存在断裂父子链: $($coverage.unknownParentRefs -join ', ')" }

                $audit = Get-Content -LiteralPath $BundleAuditJson -Raw -Encoding UTF8 | ConvertFrom-Json
                $derivation = Get-Prop (Get-Prop $audit 'languages') 'derivation'
                $provisional = @(Get-Prop $derivation 'provisionalKeys' @())
                $pending = @(Get-Prop $derivation 'pendingTranslations' @())
                # 未映射组件的真值源是 mapping 审计（Bundle 审计不保证带该字段）。
                $mappingAudit = if (Test-Path -LiteralPath $MappingAuditJson) { Get-Content -LiteralPath $MappingAuditJson -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null }
                $unmapped = @(Get-Prop $mappingAudit 'unmappedComponents' @() | Where-Object { $_ })
                $mappingPending = @(Get-Prop $mappingAudit 'pending' @() | Where-Object { $_ })
                $conflicts = [int](Get-Prop (Get-Prop $audit 'nesting') 'conflicts' 0)
                $layoutEvidence = Get-Prop (Get-Prop $audit 'layout') 'evidence'
                $unresolved = [int](Get-Prop $layoutEvidence 'unresolvedBottomBarItems' 0)

                if ($provisional.Count) { throw "存在临时语言键（需改名）: $($provisional.key -join ', ')" }
                if ($pending.Count)    { throw "存在待翻译条目: $($pending.key -join ', ')" }
                if ($unmapped.Count -or $mappingPending.Count) {
                    $details = @()
                    if ($unmapped.Count) { $details += "unmappedComponents: $($unmapped -join ', ')" }
                    if ($mappingPending.Count) { $details += "pending: " + (($mappingPending | ForEach-Object { "$($_.sourceRef)（$($_.reason)）" }) -join '; ') }
                    $warnings.Add("存在未命中正式模板的组件（保留 DSL 来源、未伪造节点）：$($details -join ' | ')；该页不得宣称「完整可运行页面」")
                }
                if ($conflicts -ne 0)  { throw "容器嵌套冲突 $conflicts 个" }
                if ($unresolved -ne 0) { throw "底部栏未命中变体实例 $unresolved 个" }
                $staticStatus = Get-Prop (Get-Prop $audit 'verification') 'static' 'unknown'
                if ($staticStatus -ne 'passed') { throw "Bundle 静态校验未通过: $staticStatus" }

                $tables = @(Get-Prop $audit 'tables' @() | Where-Object { $_ })
                foreach ($table in $tables) {
                    if ((Get-Prop $table 'valuePending' $false) -eq $true) { $warnings.Add("表格 $(Get-Prop $table 'name' '') 的数据源待绑定（Value 固定空串，valuePending=true）") }
                    if ((Get-Prop $table 'declaredBoxCoversContent' $true) -eq $false) { $warnings.Add("表格 $(Get-Prop $table 'name' '') 的图层声明尺寸覆盖不了内容范围，需交设计侧修正") }
                }
                $note = "门禁全部通过（警告 $($warnings.Count) 条）"
            }
            'verify' {
                Invoke-StepCommand -Label 'verifications' -LogFile $log -File 'pwsh' -Arguments @(
                    '-NoProfile', '-File', (Join-Path $PSScriptRoot 'run-verifications.ps1'),
                    '-ProjectRoot', $ProjectRoot, '-SkillRoot', $SkillRoot, '-Page', $Target) | Out-Null
                $note = 'provenance / 坐标 / Icon / 结构 全部通过'
            }
        }
        $watch.Stop()
        $seconds = [math]::Round($watch.Elapsed.TotalSeconds, 1)
        $results.Add([pscustomobject]@{ Id = $step.Id; Name = $step.Name; Status = 'ok'; Seconds = $seconds; Note = $note })
        Write-Output ("      ok  {0}s  {1}" -f $seconds, $note)
    }
    catch {
        $watch.Stop()
        $results.Add([pscustomobject]@{ Id = $step.Id; Name = $step.Name; Status = 'failed'; Seconds = [math]::Round($watch.Elapsed.TotalSeconds, 1); Note = '' })
        $where = ''
        if ($_.InvocationInfo) { $where = "（第 $($_.InvocationInfo.ScriptLineNumber) 行: $($_.InvocationInfo.Line.Trim())）" }
        Write-Output ''
        Write-Output ("!! 步骤 {0}({1}) 失败：{2}{3}" -f $step.Id, $step.Name, $_.Exception.Message, $where)
        if ($_.ScriptStackTrace) { Write-Output ("   调用链: " + (($_.ScriptStackTrace -split "`n" | Select-Object -First 4) -join ' <- ')) }
        Write-Output ("   修好后从这一步继续：pwsh -NoProfile -File _tool\run-all.ps1 -Progress {0}{1}" -f $step.Name, $(if ($Overwrite) { ' -Overwrite' } else { '' }))
        Write-Output ''
        Write-Output '--- 本区间进度 ---'
        $results | ForEach-Object { '{0,2} {1,-10} {2,-7} {3,6}s' -f $_.Id, $_.Name, $_.Status, $_.Seconds }
        exit 1
    }
}

Write-Output ''
Write-Output '--- 步骤耗时 ---'
$results | ForEach-Object { '{0,2} {1,-10} {2,-7} {3,6}s  {4}' -f $_.Id, $_.Name, $_.Status, $_.Seconds, $_.Note }
Write-Output ("合计 {0}s" -f ([math]::Round(($results | Measure-Object -Property Seconds -Sum).Sum, 1)))

if ($warnings.Count) {
    Write-Output ''
    Write-Output '--- 需写进交付说明的警告（不是失败） ---'
    $warnings | ForEach-Object { Write-Output ("- " + $_) }
}

if ($EndStep.Id -eq 6) {
    Write-Output ''
    Write-Output '下一步（语义判断，必须人工/AI 做）：'
    Write-Output ("  1) 读 $CandidateJson 的 candidates，把真正被 Icon 槽位引用的图形定名，写进 $LedgerJson 的 icons[]")
    Write-Output ("  2) 把页面文案的英文译文写进 $TranslationsJson")
    Write-Output '  3) 然后：pwsh -NoProfile -File _tool\run-all.ps1 -Progress layout'
}
