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
    [string] $ConfigPath = ''
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

# 步骤表：Id / 名称 / 说明。前置依赖由下方 switch（按步骤名硬编码）表达，这里不重复声明。
$Steps = @(
    [pscustomobject]@{ Id = 1;  Name = 'fetch';      Title = '取数 getDsl（只落盘，不进上下文）' },
    [pscustomobject]@{ Id = 2;  Name = 'capture';    Title = 'DSL 结构化快照 + 覆盖校验' },
    [pscustomobject]@{ Id = 3;  Name = 'svg';        Title = 'extractSvg 图标几何' },
    [pscustomobject]@{ Id = 4;  Name = 'visibility'; Title = '显隐事实提取' },
    [pscustomobject]@{ Id = 5;  Name = 'mapping';    Title = 'mapping 草稿（按当前台账）' },
    [pscustomobject]@{ Id = 6;  Name = 'discover';   Title = '图标候选发现 + 打印待命名清单' },
    [pscustomobject]@{ Id = 7;  Name = 'ledger';     Title = '由命名表生成图标台账 + 图标几何来源核对' },
    [pscustomobject]@{ Id = 8;  Name = 'layout';     Title = 'Layout 清单机械推导（底部栏 MenuItem）' },
    [pscustomobject]@{ Id = 9;  Name = 'inputs';     Title = '校验译文并生成 Bundle 清单' },
    [pscustomobject]@{ Id = 10; Name = 'bundle';     Title = 'Bundle 生成页面 XML / Icon / Layout / 宿主壳' },
    [pscustomobject]@{ Id = 11; Name = 'gates';      Title = '严格门禁（审计逐条断言）' },
    [pscustomobject]@{ Id = 12; Name = 'verify';     Title = '四项独立验证（provenance / 坐标 / Icon / 结构）' }
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
        # 页面标题的人工确认值：机械流水线必须带上它，否则标题会退回设计页名原文（带 (x.y) 编号）。
        # 该字段是可选登记项：老登记表没有它时不能因为 Set-StrictMode 直接抛错。
        PageTitleText = if ($page.PSObject.Properties['pageTitleText']) { $page.pageTitleText } else { $null }
    }
}

function Get-MastergoToken {
    if ($env:MASTERGO_MCP_TOKEN) { return $env:MASTERGO_MCP_TOKEN }
    # 配置路径不写死某台机器：优先 -ConfigPath，其次 CODEX_CONFIG，最后 ~/.codex/config.toml
    $configPath = if ($ConfigPath) { $ConfigPath }
        elseif ($env:CODEX_CONFIG) { $env:CODEX_CONFIG }
        else { Join-Path $env:USERPROFILE '.codex\config.toml' }
    if (Test-Path -LiteralPath $configPath) {
        $cfg = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8
        if ($cfg -match '--token=(mg_[0-9a-fA-F]+)') { return $Matches[1] }
    }
    throw "缺少 MasterGo token：设置环境变量 MASTERGO_MCP_TOKEN，或用 -ConfigPath / CODEX_CONFIG 指向含 mastergo 配置的 config.toml（当前尝试: $configPath；token 不会写入任何产物）"
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

# ---------- 运行登记表（run registry，scripts/lib/run-registry.js 的唯一实现经 CLI 调用）----------
# 目的：每一步产出的文件在**产出它的那一步**就登记（路径 + sha256 + size + mtime），
# 后续步骤只按登记表取路径并校 hash；磁盘上未登记的旧同名文件（legacy shadow）一律拒绝。
function Invoke-Registry {
    param([string[]] $Arguments)
    $output = & node (Join-Path $PSScriptRoot 'run-registry.mjs') @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw ("运行登记表操作失败: " + ($Arguments -join ' ') + "`n" + ($output.Trim() -split "`n" | Select-Object -Last 6 | Out-String))
    }
    return $output
}

# 本步产出的文件 → 登记表键（键名是消费端唯一认的入口，见 lib/run-registry.js 的 ARTIFACT_KEYS）
function Register-StepArtifacts {
    param([string] $StepName, [int] $StepId)
    $pairs = @()
    switch ($StepName) {
        'fetch'      { $pairs += , @('getDsl', $GetDslJson) }
        'capture'    {
            $pairs += , @('snapshot', $SnapshotJson)
            $pairs += , @('coverage', $CoverageJson)
            $pairs += , @('dslManifest', (Join-Path $RunDir 'manifest.json'))
            $pairs += , @('timing', (Join-Path $RunDir 'timing.json'))
        }
        'svg'        { $pairs += , @('extractSvg', $SvgJson) }
        'visibility' { $pairs += , @('visibility', $VisibilityJson) }
        'mapping'    { $pairs += , @('mappingDraft', $DraftMappingJson) }
        'discover'   { $pairs += , @('iconCandidates', $CandidateJson) }
        'ledger'     { if (Test-Path -LiteralPath $LedgerJson) { $pairs += , @('iconMap', $LedgerJson) } }
        'layout'     { $pairs += , @('layoutManifest', $LayoutManifestJson) }
        'inputs'     { $pairs += , @('bundleManifest', $BundleJson) }
    }
    foreach ($pair in $pairs) {
        if (Test-Path -LiteralPath $pair[1]) {
            Invoke-Registry @('artifact', '--run', $RunJson, '--key', $pair[0], '--path', $pair[1], '--step', "$StepId") | Out-Null
        }
    }
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
# 采集产物按页归档：一个项目里可以有多张页面，共用一个目录会互相覆盖（旧页重跑时会拿到别的页的
# extractSvg/snapshot，导致核对基于错误数据）。所有 DSL 采集产物一律落在 runs\<Target>\ 下。
$RunDir = Join-Path $Generated "runs\$Target"
# 运行登记表：本次运行的唯一"产物清单"（每一步产出后登记，后续步骤只按它取路径并校 hash）。
$RunJson = Join-Path $RunDir 'run.json'
$GetDslJson = Join-Path $RunDir 'getDsl.json'
$SnapshotJson = Join-Path $RunDir 'dsl.snapshot.json'
$CoverageJson = Join-Path $RunDir 'coverage-report.json'
$SvgJson = Join-Path $RunDir 'extractSvg.json'
$VisibilityJson = Join-Path $RunDir 'visibility.json'
$LedgerJson = Join-Path $Inputs "$Target.icon-map.json"
$CandidateJson = Join-Path $Inputs "$Target.icon-candidates.json"
$NamingJson = Join-Path $Inputs "$Target.icon-naming.json"
$TranslationsJson = Join-Path $Inputs "$Target.lang-translations.json"
$LayoutManifestJson = Join-Path $Inputs "$Target.layout-manifest.json"
$BundleJson = Join-Path $Inputs "$Target.bundle.json"
$DraftMappingJson = Join-Path $Work "$Target.mapping.draft.json"
$MappingAuditJson = Join-Path $Generated "$Target.mapping.json"
$BundleAuditJson = Join-Path $Generated "$Target.bundle.manifest.json"
$PageXml = Join-Path $ProjectRoot "Resources\Pages\$Target\${Target}Page.xml"

# 页面标题的人工确认值：登记表里有就带上（否则标题会退回设计页名原文，带 (x.y) 编号）。
$PageTitleText = if ($Registry -and $Registry.PageTitleText) { $Registry.PageTitleText } else { '' }

$StartStep = Get-Step $Progress
$EndStep = if ($StopAfter) { Get-Step $StopAfter } else { $Steps[-1] }
if ($EndStep.Id -lt $StartStep.Id) { throw "-StopAfter 不能早于 -Progress" }

Write-Output ("项目: {0}" -f $ProjectRoot)
Write-Output ("Target: {0}   LayerId: {1}   Ui: {2}" -f $Target, $LayerId, $Ui)
Write-Output ("区间: {0}({1}) → {2}({3})" -f $StartStep.Id, $StartStep.Name, $EndStep.Id, $EndStep.Name)
Write-Output ''

$results = New-Object System.Collections.Generic.List[object]
$warnings = New-Object System.Collections.Generic.List[string]

# 初始化运行登记表：整段运行的第一个动作。断点续跑（-Progress > 1）时沿用已有登记表（--keep），
# 否则新开一次运行（新 runId、清空产物登记）——避免把上一次运行登记过的产物当成本次的。
$registryInit = @('init', '--project-root', $ProjectRoot, '--target', $Target,
    '--file-id', $FileId, '--layer-id', $LayerId, '--ui', $Ui)
if ($DesignPageName) { $registryInit += @('--design-page', $DesignPageName) }
if ($PageTitleText) { $registryInit += @('--page-title', $PageTitleText) }
if (Test-Path -LiteralPath $TranslationsJson) { $registryInit += @('--translations', "Generated/_inputs/$Target.lang-translations.json") }
if (Test-Path -LiteralPath (Join-Path $Inputs "$Target.lang-glossary.json")) { $registryInit += @('--glossary', "Generated/_inputs/$Target.lang-glossary.json") }
if (Test-Path -LiteralPath $NamingJson) { $registryInit += @('--icon-naming', "Generated/_inputs/$Target.icon-naming.json") }
if ($StartStep.Id -gt 1) { $registryInit += '--keep' }
$initSummary = Invoke-Registry $registryInit
Write-Output ("运行登记表: {0}" -f $RunJson)
Write-Output ("  {0}" -f (($initSummary.Trim() -split "`n") -join ' '))
Write-Output ''

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
                    '-Action', 'Capture', '-InputFile', $GetDslJson, '-Out', $RunDir,
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
                # 台账由「候选清单 + 命名表」机械生成（命名表是人在 discover 之后产出的语义输入）。
                if (Test-Path -LiteralPath $NamingJson) {
                    Invoke-StepCommand -Label 'build icon ledger' -LogFile $log -File 'node' -Arguments @(
                        (Join-Path $PSScriptRoot 'build-icon-ledger.mjs'), $CandidateJson, $LedgerJson, $NamingJson) | Out-Null
                    # 生成后立刻核对几何来源：sourceId 指向页面根 / 被多条共用 / 缺 extractSvg 条目且未声明 fromDsl
                    Invoke-StepCommand -Label 'verify icon source' -LogFile (Join-Path $StepLogs '07-ledger-verify-icon-source.log') -File 'node' -Arguments @(
                        (Join-Path $PSScriptRoot 'verify-icon-source.mjs'), $CandidateJson, $SnapshotJson, $SvgJson, '--naming', $NamingJson) | Out-Null
                }
                elseif (-not (Test-Path -LiteralPath $LedgerJson)) {
                    if (-not $AllowEmptyLedger) {
                        throw "缺少命名表 $NamingJson：请把候选清单里被 Icon 槽位引用的图形定名写进命名表（格式见 SKILL.md 一键流水线小节；若本页确实没有图标槽位，加 -AllowEmptyLedger）"
                    }
                    New-Item -ItemType Directory -Force -Path $Inputs | Out-Null
                    '{ "icons": [], "candidates": [], "unmapped": [] }' | Set-Content -LiteralPath $LedgerJson -Encoding UTF8
                }
                $ledger = Get-Content -LiteralPath $LedgerJson -Raw -Encoding UTF8 | ConvertFrom-Json
                $icons = @($ledger.icons)
                if ($icons.Count -eq 0 -and -not $AllowEmptyLedger) {
                    throw "图标台账 $LedgerJson 的 icons[] 为空。若本页确实没有任何 Icon 槽位，加 -AllowEmptyLedger；否则请先在命名表 $NamingJson 里定名。"
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
                # build-bundle-manifest.mjs 是 run-all 的同级辅助脚本（插件布局在 scripts/、项目布局在 _tool/），
                # 因此这里用 $PSScriptRoot；skill 自带脚本一律用 $ScriptsFolder。
                $args = @((Join-Path $PSScriptRoot 'build-bundle-manifest.mjs'), $LayoutManifestJson, $BundleJson, $ProjectRoot, $Ui)
                # 采集输入只从运行登记表取（并写进清单让 Bundle 复校），不再让清单自己拼顶层路径。
                $args += @('--run-json', $RunJson)
                if ($PageTitleText) { $args += @('--page-title', $PageTitleText) }
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
        # 产出登记：本步产出的文件立刻登记（path + sha256），后续步骤只按登记表取。
        Register-StepArtifacts -StepName $step.Name -StepId $step.Id
        if ($step.Name -eq 'bundle' -and (Test-Path -LiteralPath $BundleAuditJson)) {
            # 输入登记与输出登记共用同一个 runId：把 Bundle 审计的 files[] 并回登记表。
            Invoke-Registry @('outputs', '--run', $RunJson, '--manifest', $BundleAuditJson) | Out-Null
        }
        Invoke-Registry @('step', '--run', $RunJson, '--id', "$($step.Id)", '--name', $step.Name,
            '--status', 'ok', '--seconds', "$seconds", '--note', $note,
            '--log', (Join-Path $Work ('steps\{0:D2}-{1}.log' -f $step.Id, $step.Name))) | Out-Null
        $results.Add([pscustomobject]@{ Id = $step.Id; Name = $step.Name; Status = 'ok'; Seconds = $seconds; Note = $note })
        Write-Output ("      ok  {0}s  {1}" -f $seconds, $note)
    }
    catch {
        $watch.Stop()
        try {
            Invoke-Registry @('step', '--run', $RunJson, '--id', "$($step.Id)", '--name', $step.Name,
                '--status', 'failed', '--seconds', "$([math]::Round($watch.Elapsed.TotalSeconds, 1))",
                '--note', ($_.Exception.Message -split "`n")[0]) | Out-Null
        }
        catch { }   # 登记表写失败不能掩盖原始错误
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
    Write-Output ("  1) 读候选清单：$CandidateJson（含每个候选的归属控件、同级 PATH 数、图标层名与尺寸）")
    Write-Output ("  2) 把被 Icon 槽位引用的图形定名，写进命名表：$NamingJson")
    Write-Output ("     格式：[{ `"index`": <候选下标>, `"name`": `"<英文资源名>Geometry`", `"comment`": `"<中文注释>`", `"fromDsl`": <bool，可选> }, ...]")
    Write-Output ("  3) 枚举本页需要翻译的文案：node `"$PSScriptRoot\list-lang-sources.mjs`" `"$MappingAuditJson`" `"$LayoutManifestJson`"")
    Write-Output ("     据此把中文→英文译文写进：$TranslationsJson")
    Write-Output '  4) 然后继续（台账由命名表生成、并自动做图标几何来源核对）：pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -ProjectRoot <项目> -Progress ledger'
}
