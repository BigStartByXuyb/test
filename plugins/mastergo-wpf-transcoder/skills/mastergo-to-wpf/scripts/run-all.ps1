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
        pwsh -NoProfile -File _tool\run-all.ps1 -List -Format json   # 12 步清单（人读；中文经 stdout 可能被控制台代码页损坏）
        pwsh -NoProfile -File _tool\run-all.ps1 -List -Format json -OutFile <临时json>   # 同上，但写文件（UTF-8），Node 侧只读文件、不读 stdout
        pwsh -NoProfile -File _tool\run-all.ps1 -ProjectRoot <项目> -Target <页面Target> -LayerId <图层id> -StopAfter discover
        pwsh -NoProfile -File _tool\run-all.ps1 -ProjectRoot <项目> -Target <页面Target> -Progress layout          # 图标台账/译文改好之后
        pwsh -NoProfile -File _tool\run-all.ps1 -ProjectRoot <项目> -Target <页面Target> -Progress bundle -Overwrite
        pwsh -NoProfile -File _tool\run-all.ps1 -ProjectRoot <项目> -Target <页面Target> -Progress verify
#>
[CmdletBinding()]
param(
    [string] $ProjectRoot,
    [string] $SkillRoot,
    # MasterGo 文件 id 没有内置默认值：只能显式传，或由项目登记表 docs/page-registry.json 提供。
    # 缺失就报错（fail-closed）——插件里写死某个项目的文件 id，会让别的项目在没传参数时静默取到
    # 另一个项目的设计稿；把某个项目的 id 当"哨兵值"还会让显式传入的同名 id 被登记表覆盖。
    [string] $FileId,
    [string] $LayerId,
    [string] $Ui,
    [string] $Target,
    [string] $DesignPageName = '',
    [string] $Progress = '1',
    [string] $StopAfter = '',
    [switch] $Overwrite,
    [switch] $AllowEmptyLedger,
    [switch] $List,
    [ValidateSet('text', 'json')]
    [string] $Format = 'text',
    [string] $ConfigPath = '',
    # 只与 -List -Format json 配用：把步骤契约 JSON 写进文件（UTF-8，PS7 下无 BOM）再退出。
    # 为什么要有它：stdout 走控制台代码页（本机 GBK），中文会被替换成 U+FFFD，Node 侧解析只能靠猜；
    # 文件是确定编码。目标目录不存在直接失败（不替调用方建目录）。
    [string] $OutFile = ''
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

# 步骤表：Id / 名称 / 说明 / 契约（输入 → 产物 → 失败 → 怎么修）。
# 前置依赖由下方 switch（按步骤名硬编码）表达，这里不重复声明。
# 契约字段是「一键流水线」文档的唯一真值源：`-List -Format json -OutFile <文件>` 输出它们，
# references/adapters/mtslg-iocontrol/pipeline-contract.md 由 scripts/gen-pipeline-contract.mjs 生成，
# 回归测试重新生成并比对——文档里的步骤表不再手写，避免"文档说一套、脚本做一套"。
$Steps = @(
    [pscustomobject]@{
        Id = 1; Name = 'fetch'; Title = '取数 getDsl（只落盘，不进上下文）'
        Inputs   = @('MasterGo 文件 id 与图层 id（命令行 -FileId/-LayerId，或项目登记表 docs/page-registry.json 里能命中本次页面的那一条）', 'MasterGo MCP token（MASTERGO_MCP_TOKEN 或 -ConfigPath 指向的配置）')
        Outputs  = @('Generated/runs/<Target>/getDsl.json', '运行登记表 Generated/runs/<Target>/run.json（产出即登记）')
        Failures = @('缺 fileId 或 layerId', '登记表有多条页面，但没用 -Target/-LayerId 命中本次页面（脚本不取第一页顶上）', 'MasterGo MCP token 缺失或失效', 'MCP 调用失败/超时', 'MCP 返回业务错误码（如 code=20001「获取文件key异常」，说明 fileId/layerId 不存在或无权限）')
        Recovery = @('显式传 -FileId/-LayerId，或在登记表里登记本次页面；多页登记表必须先用 -Target 或 -LayerId 选中本次页面', '补 token 后重跑：-Progress fetch', '业务错误码：核对该 fileId/layerId（或登记表设计来源）后重跑：-Progress fetch')
    },
    [pscustomobject]@{
        Id = 2; Name = 'capture'; Title = 'DSL 结构化快照 + 覆盖校验'
        Inputs   = @('第 1 步的 getDsl.json', '区域前缀 -Ui（缺失时按 run-all 取值链解析）', '设计页名 -DesignPageName（命令行或项目登记表；为空时 capture 用 DSL 根节点名兜底，再取不到用 layerId）')
        Outputs  = @('Generated/runs/<Target>/dsl.snapshot.json', 'coverage-report.json（节点覆盖/重复 ref/断裂父子链）')
        Failures = @('覆盖校验 status≠complete', '存在重复 ref 或断裂父子链', '区域前缀取值链取不到')
        Recovery = @('改 fileId / layerId 后必须重取数：从第 1 步 -Progress fetch 重跑（capture 只消费第 1 步的 getDsl.json，本身不取数）；来源不变而捕获失败时才重跑：-Progress capture', '区域前缀显式传 -Ui')
    },
    [pscustomobject]@{
        Id = 3; Name = 'svg'; Title = 'extractSvg 图标几何'
        Inputs   = @('fileId / layerId', 'MasterGo MCP token')
        Outputs  = @('Generated/runs/<Target>/extractSvg.json（PATH 自身几何，按分页取全）')
        Failures = @('MCP 调用失败或分页中断')
        Recovery = @('重跑：-Progress svg（响应只落盘，不进上下文）')
    },
    [pscustomobject]@{
        Id = 4; Name = 'visibility'; Title = '显隐事实提取'
        Inputs   = @('第 2 步的 dsl.snapshot.json')
        Outputs  = @('Generated/runs/<Target>/visibility.json（每个节点的 visible/hidden 事实与 omit 角色）')
        Failures = @('快照缺字段（旧版快照或手工删改）')
        Recovery = @('重跑第 2 步后重跑：-Progress visibility')
    },
    [pscustomobject]@{
        Id = 5; Name = 'mapping'; Title = 'mapping 草稿（按当前台账）'
        Inputs   = @('dsl.snapshot.json + visibility.json', '正式映射表 mtslg-iocontrol-map.json', '图标台账（尚无台账时用空 candidates 占位）')
        Outputs  = @('Generated/runs/<Target>/mapping 草稿与映射审计（unmappedComponents / pending / templateConflicts）')
        Failures = @('组件与固定模板冲突', '结构签名部分命中')
        Recovery = @('只补输入（用 manifest.excludeInstances 隔离该实例、把偏差写进待确认），不改 mapping 产物；重跑：-Progress mapping')
    },
    [pscustomobject]@{
        Id = 6; Name = 'discover'; Title = '图标候选发现 + 登记结论 + 打印待命名清单'
        Inputs   = @('extractSvg.json + mapping 草稿 + dsl.snapshot.json + 正式映射表（登记判据的取值来源）')
        # 草稿 mapping 只有 componentInstances（没有 resolvedTemplates），登记判据按与解析器同一份
        # 判据从中取变体；两种形状都要支持，否则第 6 步的结论会全落到位置兜底。
        Outputs  = @('Generated/_inputs/<Target>.icon-candidates.json（待命名清单：候选下标/归属控件/层名/尺寸/registration 登记结论）', 'mustName：命名表必须恰好覆盖的候选下标（= registration.register=true）')
        Failures = @('缺 svg / mapping / 映射表（前置步骤未跑）', '登记判据缺依据（registration.basis 的取值以判据实现 scripts/lib/icon-registration-policy.js 为准：变体未登记，或变体已登记但漏登记 iconPolicy）')
        Recovery = @('先补跑前置步骤，再重跑：-Progress discover；登记结论由 discover 机械判定（判据实现 scripts/lib/icon-registration-policy.js），不要回文档自行推断。遇"登记判据缺依据"按 registration.source 分头修——缺变体补变体、缺 iconPolicy 补字段（整批同步清单见 skills/mastergo-iocontrol-document-format/SKILL.md 的「新增/修改映射的同步清单」），改完重跑 -Progress mapping')
    },
    [pscustomobject]@{
        Id = 7; Name = 'ledger'; Title = '由命名表生成图标台账 + 图标几何来源核对'
        Inputs   = @('候选清单', '命名表 Generated/_inputs/<Target>.icon-naming.json（人工/AI 语义输入）')
        Outputs  = @('图标台账 Generated/_inputs/<Target>.icon-map.json', 'verify-icon-source 的几何来源核对结果')
        Failures = @('缺命名表（未加 -AllowEmptyLedger）', 'icons[] 为空', '命名表漏定名（mustName 里的候选没定名）', '命名表多定名（登记了 registration.register=false 的候选）', 'sourceId 指向页面根或被多条共用', '缺 extractSvg 条目且未声明 fromDsl')
        Recovery = @('按候选清单的 mustName 补齐或删掉多余条目，重跑：-Progress ledger；本页确实无图标槽位时加 -AllowEmptyLedger（登记与命名表一一对应，门禁会点名具体下标与判据）')
    },
    [pscustomobject]@{
        Id = 8; Name = 'layout'; Title = 'Layout 清单机械推导（底部栏 MenuItem）'
        Inputs   = @('dsl.snapshot.json + 图标台账 + 正式映射表')
        Outputs  = @('Layout 清单与推导报告 Generated/_inputs/<Target>.layout-manifest.json(.report.json)')
        # layoutStatus 的合法终态有两个：complete 与 none。none 的触发条件是推导脚本的
        # 「menuItems + residentGroupItems === 0」（本页既没有菜单项、也没有右下角常驻分组）；
        # 此时 Layout.xml 仍以空 <Menu> 注册本页——Bundle 与 verify 都要求本页有 <Page> 注册。
        Failures = @('layoutStatus 不属于 complete/none', 'layoutEvidence.unresolvedBottomBarItems≠0')
        Recovery = @('补齐底部栏变体命中后重跑：-Progress layout（校验失败表示清单不完整，不是拒绝生成页面）；本页确实没有菜单项与常驻分组时 none 是合法终态（此时 menuItems 与两个计数必须全为 0）')
    },
    [pscustomobject]@{
        Id = 9; Name = 'inputs'; Title = '校验译文并生成 Bundle 清单'
        Inputs   = @('Layout 清单', '运行登记表 run.json（采集输入只按它取）', '译文清单 Generated/_inputs/<Target>.lang-translations.json（术语表可选）')
        Outputs  = @('Bundle 清单 Generated/_inputs/<Target>.bundle.json（含 runRegistry 指纹）')
        Failures = @('缺区域前缀 area', '缺 --run-json 或译文清单', '发现未登记的旧同名采集文件', '登记表 sha256 与文件不符')
        Recovery = @('补齐输入后重跑：-Progress inputs（采集输入只按登记表取，未登记的旧同名文件一律拒绝）')
    },
    [pscustomobject]@{
        Id = 10; Name = 'bundle'; Title = 'Bundle 生成页面 XML / Icon / Layout / 宿主壳'
        Inputs   = @('Bundle 清单', '复校通过的采集输入（getDsl/snapshot/extractSvg，按登记表取）')
        Outputs  = @('页面 XML、本页 Icons.xaml、CN/EN 语言字典、Layout 增量注册、View + code-behind + ViewModel、宿主壳', 'Bundle 审计与其 files[] 统一登记')
        Failures = @('同名目标文件已存在且未 -Overwrite', 'area/路径不合法', '语言键引用闭环失败', '清单指纹与登记表不符')
        Recovery = @('确认要替换时用 operation=replace-existing + -Overwrite（覆盖前逐个备份，保留最近 2 份），否则改名或先确认；重跑：-Progress bundle')
    },
    [pscustomobject]@{
        Id = 11; Name = 'gates'; Title = '严格门禁（审计逐条断言）'
        Inputs   = @('Bundle 审计 + mapping 审计 + coverage-report.json')
        Outputs  = @('门禁结论（失败即停；通过时列出必须写进交付说明的警告）')
        Failures = @('临时语言键', '待翻译条目', '容器嵌套冲突', '底部栏未命中变体', 'Bundle 静态校验未通过')
        Recovery = @('回到产出该字段的步骤补输入（译文/命名表/隔离清单），重跑：-Progress gates')
    },
    [pscustomobject]@{
        Id = 12; Name = 'verify'; Title = '四项独立验证（provenance / 坐标 / Icon / 结构）'
        Inputs   = @('页面 XML + 本页 Icon/语言字典 + 项目 Layout + 审计文件')
        Outputs  = @('Generated/_work/verification/<页面>/ 的 provenance/坐标/Icon/结构报告')
        Failures = @('provenance 与设计文本不符', '坐标与 DSL bbox 不符', 'Icon 引用闭环缺失', '页面结构校验失败')
        Recovery = @('修输入或生成器后重跑：-Progress verify（不要改报告）')
    }
)

if ($OutFile -and (-not $List -or $Format -ne 'json')) {
    throw '-OutFile 只与 -List -Format json 配用（它写的是步骤契约 JSON）'
}

if ($List) {
    if ($Format -eq 'json') {
        $json = ConvertTo-Json -InputObject @($Steps) -Depth 6
        if ($OutFile) {
            $outDir = Split-Path -Parent $OutFile
            if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
                throw "-OutFile 的目标目录不存在: $outDir"
            }
            Set-Content -LiteralPath $OutFile -Value $json -Encoding UTF8
            Write-Output "已写入步骤契约: $OutFile"
        }
        else {
            $json
        }
    }
    else {
        $Steps | ForEach-Object { '{0,2}  {1,-10} {2}' -f $_.Id, $_.Name, $_.Title }
        Write-Output ''
        Write-Output '用法: -Progress <步骤> / -StopAfter <步骤>，可写步骤号或步骤名。'
        Write-Output '契约（输入/产物/失败/怎么修）：-List -Format json -OutFile <文件>（写文件、UTF-8；stdout 会被控制台代码页损坏），或看 references/adapters/mtslg-iocontrol/pipeline-contract.md'
    }
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
    param([string] $Root, [string] $Target, [string] $LayerId)
    $registry = Join-Path $Root 'docs\page-registry.json'
    if (-not (Test-Path -LiteralPath $registry)) { return $null }
    $doc = Get-Content -LiteralPath $registry -Raw -Encoding UTF8 | ConvertFrom-Json
    $pages = @(@($doc.pages) | Where-Object { $_ })
    if (-not $pages.Count) { return $null }
    # 选页：-Target 命中优先 → -LayerId 命中 → 登记表只有一页时用它。
    # 多页登记表且都没命中时返回 $null（本次页面不在登记表里，目标信息必须由命令行显式给出），
    # 绝不静默取第一页——那会把别的页面的 fileId/layerId/ui 当成这一页的来源。
    $pageTarget = {
        param($item)
        if ($item.PSObject.Properties['target']) { return [string] $item.target } else { return '' }
    }
    $pageLayerId = {
        param($item)
        if (-not $item.PSObject.Properties['designSource']) { return '' }
        $design = $item.designSource
        if ($design -and $design.PSObject.Properties['layerId']) { return [string] $design.layerId } else { return '' }
    }
    $page = $null
    if ($Target) { $page = $pages | Where-Object { (& $pageTarget $_) -eq $Target } | Select-Object -First 1 }
    if (-not $page -and $LayerId) { $page = $pages | Where-Object { (& $pageLayerId $_) -eq $LayerId } | Select-Object -First 1 }
    if (-not $page -and $pages.Count -eq 1) { $page = $pages[0] }
    if (-not $page) { return $null }
    # 逐字段读 designSource：不能直写 `$page.designSource.fileId`——登记表缺该字段时
    # Set-StrictMode 会抛出"property cannot be found"，掩盖真正的原因（登记表缺 fileId/layerId）。
    # 这里取成 $null，由下面的显式门禁给出可执行的报错。
    $design = if ($page.PSObject.Properties['designSource']) { $page.designSource } else { $null }
    $layerId = if ($design -and $design.PSObject.Properties['layerId']) { $design.layerId } else { $null }
    $fileId = if ($design -and $design.PSObject.Properties['fileId']) { $design.fileId } else { $null }
    $designPageName = if ($design -and $design.PSObject.Properties['designPageName']) { $design.designPageName } else { $null }
    return [pscustomobject]@{
        Target  = (& $pageTarget $page)
        LayerId = $layerId
        FileId  = $fileId
        # 区域前缀（area）：① 登记表显式 `pages[].ui`；② `derivation` 里第一个 `F<数字>`。
        # 两者都是可选字段（老登记表可能没有），缺失时留空——由下面的取值链继续解析
        # （Target 编号前缀 → Target 首词），仍然取不到才报错要求显式传 -Ui。
        # 任何情况下都不静默退回 F2（否则非 F2 页面的 UI/<区域>/View 输出目录会被悄悄写错）。
        # 匹配不用 `\b`：Target 形状是 `{区域前缀}{英文语义名}`，`F3ManualAlign`、`F3区域`
        # 这类连写里 F3 后面紧跟单词字符，词边界匹配不到。
        # 空串/空白等同"没登记"：显式空值要能继续走向 `derivation`（与文档的取值链读法一致）。
        Ui      = if ($page.PSObject.Properties['ui'] -and -not [string]::IsNullOrWhiteSpace($page.ui)) { $page.ui }
                  elseif ($page.PSObject.Properties['derivation'] -and ($page.derivation -match 'F\d+')) { $Matches[0] }
                  else { $null }
        Design  = $designPageName
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

# 本页现状摘要（build-run-summary.mjs）：每步成功后刷新一次，替代消费方手写探针去数一遍产物。
# 它只读登记表里已登记的条目并复校 sha256；失败即说明本次摘要取不到可信数据，
# 必须当场失败（失败原因见输出，不在这里替它断言是哪一种）。
function Update-RunSummary {
    $output = & node (Join-Path $PSScriptRoot 'build-run-summary.mjs') `
        '--project-root' $ProjectRoot '--target' $Target '--quiet' 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw ("本页现状摘要生成失败`n" + (($output.Trim() -split "`n" | Select-Object -Last 8) -join "`n"))
    }
}

# 逐阶段输入复校：每一步在消费前，把它**实际消费的、且本次运行已登记的**产物按登记表复校 sha256。
# 只在"已登记"时校验——新开运行的早期步骤尚未登记，不受影响；而手工改过中间产物再续跑会被当场拒掉
# （与"消费只按登记取"是同一条契约，见 bundle-manifest.md 第 7 节）。
function Assert-RegisteredInput {
    param([string] $Key)
    if (-not (Test-Path -LiteralPath $RunJson)) { return }
    $doc = Get-Content -LiteralPath $RunJson -Raw -Encoding UTF8 | ConvertFrom-Json
    $artifacts = Get-Prop $doc 'artifacts'
    if ($artifacts -and $artifacts.PSObject.Properties[$Key]) {
        Invoke-Registry @('check', '--run', $RunJson, '--key', $Key, '--quiet') | Out-Null
        return
    }
    # 未登记：新开运行里属正常（上游步骤在本区间之前刚产出、尚未登记的情况不会走到这里）。
    # 但续跑路径上，"产物存在却没登记"正是 §7 明令拒绝的旧同名文件——不能静默消费。
    if ($StartStep.Id -gt 1) {
        throw "输入 $Key 未登记在本次运行的 $RunJson 里（消费只按登记取、未登记的旧同名文件一律拒绝）：请从 fetch 新开一次运行（不带 -Progress），或先跑产出该产物的那一步。"
    }
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

# 区域前缀的来源（只用于回显，便于复核"这个 ui 是谁给的"）；取值链见下方注释。
$UiSource = $null
# 命令行显式给的取值：与"从项目登记表解析出来的值"区分开——续跑回放冻结身份要用它判断
# 调用方是否在要求改身份（显式给不同值 = 要改，省略 = 沿用）。
$cliTarget = $Target
$cliFileId = $FileId
$cliLayerId = $LayerId
$cliUi = $Ui
$cliDesignPageName = $DesignPageName
$Registry = Get-ProjectTarget -Root $ProjectRoot -Target $Target -LayerId $LayerId
if ($Registry) {
    if (-not $Target) { $Target = $Registry.Target }
    if (-not $LayerId) { $LayerId = $Registry.LayerId }
    # fileId 与 layerId 同口径：命令行没给才读登记表；命令行给了就以命令行为准（不设"哨兵值"，
    # 否则显式传入与"没传"无法区分，登记表会静默覆盖调用方的输入）。
    if (-not $FileId) { $FileId = $Registry.FileId }
    if (-not $DesignPageName) { $DesignPageName = $Registry.Design }
    # 区域前缀：命令行没给就先看项目登记表（docs/page-registry.json）里的 pages[].ui / derivation 的 F<n>。
    if (-not $Ui -and $Registry.Ui) { $Ui = $Registry.Ui; $UiSource = '项目登记表 docs/page-registry.json' }
}

# 身份混搭守卫：-Target 与 -LayerId 同时显式给出时，它们必须落在项目登记表的同一页。
# 否则会出现"Target 取自 A 页、layerId 取自 B 页"的混合身份，登记表一落盘就自相矛盾
# （后续续跑还会把它当成冻结身份回放）。
if ($Registry -and $cliTarget -and $cliLayerId) {
    $registryTarget = Get-Prop $Registry 'Target'
    $registryLayerId = Get-Prop $Registry 'LayerId'
    if ($registryTarget -and $registryLayerId -and
        ($registryTarget -ne $cliTarget -or $registryLayerId -ne $cliLayerId)) {
        throw "命令行同时给了 -Target '$cliTarget' 与 -LayerId '$cliLayerId'，但项目登记表里两者不属于同一页（-Target '$cliTarget' 对应 layerId '$registryLayerId'）：请确认要转换的页面——只给 -Target（让登记表补 layerId），或先按登记表登记本次页面的 designSource。"
    }
}
# 区域前缀（`ui`）决定两件事：① capture 快照里的 `ui` 字段；② 宿主壳输出目录 `UI/<区域>/View|ViewModel`。
# 取值顺序固定（不再写死 F2、也不静默兜底）：
#   ① 命令行 -Ui
#   ② 项目登记表 pages[].ui（最权威的人工登记）
#   ③ 项目登记表 derivation 里的 F<n>
#   ④ Target 的编号前缀（`F2ManualAlign` → `F2`）
#   ⑤ 没有编号时取 Target 的首个英文词（CamelCase 首段：`HomeContent` → `Home`、`Home` → `Home`、
#      全大写 `HOME` → `HOME`）——即"外层的语义英文"
#   ⑥ 都取不到 → 报错，要求显式给出
if (-not $Ui -and $Target) {
    # 必须用 -cmatch（大小写敏感）：PowerShell 的 -match 默认大小写不敏感，
    # 会让 `[A-Z]+(?![a-z])` 把 `HomeContent` 整串吃掉（`[A-Z]` 也会匹配小写字母）。
    if ($Target -cmatch '^([A-Za-z]+\d+)') { $Ui = $Matches[1]; $UiSource = "Target 编号前缀（$Target）" }
    elseif ($Target -cmatch '^([A-Z]+(?![a-z])|[A-Z][a-z0-9]*)') { $Ui = $Matches[1]; $UiSource = "Target 首词（$Target）" }
}
if (-not $Ui) {
    throw "缺少区域前缀：命令行 -Ui、项目登记表 pages[].ui / derivation、Target（$Target）都取不到。它会写进快照 ui 字段并决定 UI/<区域>/View 输出目录，必须显式给出。"
}
# MasterGo 文件 id：命令行 → 项目登记表 → 报错。
# 这里 fail-closed 而不是给默认值：插件是通用发布物，内置任何项目的文件 id 都会让别的项目
# 在没传参数时静默取到另一个项目的设计稿（取数看着"成功"，产物却来自别的页面）。
if (-not $FileId) {
    throw "缺少 MasterGo 文件 id：请显式传 -FileId，或在项目登记表 docs/page-registry.json 里登记本次页面（-Target/-LayerId 命中该页）的 pages[].designSource.fileId。登记表有多页时必须先选中本次页面；脚本不内置任何项目的文件 id"
}
if (-not $LayerId) {
    throw "缺少 MasterGo 图层 id：请显式传 -LayerId，或在项目登记表 docs/page-registry.json 里登记本次页面（-Target/-LayerId 命中该页）的 pages[].designSource.layerId。登记表有多页时必须先选中本次页面。"
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
$GlossaryJson = Join-Path $Inputs "$Target.lang-glossary.json"
$LayoutManifestJson = Join-Path $Inputs "$Target.layout-manifest.json"
$BundleJson = Join-Path $Inputs "$Target.bundle.json"
$DraftMappingJson = Join-Path $Work "$Target.mapping.draft.json"
$MappingAuditJson = Join-Path $Generated "$Target.mapping.json"
$BundleAuditJson = Join-Path $Generated "$Target.bundle.manifest.json"
$SummaryJson = Join-Path $Generated "$Target.summary.json"
$PageXml = Join-Path $ProjectRoot "Resources\Pages\$Target\${Target}Page.xml"

# 页面标题的人工确认值：登记表里有就带上（否则标题会退回设计页名原文，带 (x.y) 编号）。
$PageTitleText = if ($Registry -and $Registry.PageTitleText) { $Registry.PageTitleText } else { '' }

$StartStep = Get-Step $Progress
$EndStep = if ($StopAfter) { Get-Step $StopAfter } else { $Steps[-1] }
if ($EndStep.Id -lt $StartStep.Id) { throw "-StopAfter 不能早于 -Progress" }

# 断点续跑：身份四项一律回放首次运行冻结在 run.json 里的值——续跑是"沿用同一次运行的身份"，
# 不是"重新做一次身份判定"。这样 capture 拿到的一定是首次那份身份（不会退回 DSL 根节点名），
# 项目登记表 `docs/page-registry.json` 之后的增删改也不会再影响正在续跑的这一次。
# 省略 → 用冻结值；显式传不同的值、或给首次运行时缺失的身份补值 → fail-closed，改身份只能新开运行。
if ($StartStep.Id -gt 1) {
    if (-not (Test-Path -LiteralPath $RunJson)) {
        throw "缺少运行登记表 $RunJson：续跑只能沿用同一次运行的身份，请改从 fetch 新开一次运行（不带 -Progress）"
    }
    try {
        $frozenRegistry = Get-Content -LiteralPath $RunJson -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "运行登记表 $RunJson 不是合法 JSON：$($_.Exception.Message)"
    }
    $frozen = Get-Prop $frozenRegistry 'identity'
    if ($null -eq $frozen) {
        throw "运行登记表 $RunJson 缺少 identity：请从 fetch 新开一次运行（不带 -Progress）"
    }
    $replayFields = @(
        [pscustomobject]@{ Field = 'fileId'; Frozen = (Get-Prop $frozen 'fileId'); Explicit = $cliFileId; Resolved = $FileId }
        [pscustomobject]@{ Field = 'layerId'; Frozen = (Get-Prop $frozen 'layerId'); Explicit = $cliLayerId; Resolved = $LayerId }
        [pscustomobject]@{ Field = 'ui'; Frozen = (Get-Prop $frozen 'ui'); Explicit = $cliUi; Resolved = $Ui }
        [pscustomobject]@{ Field = 'designPageName'; Frozen = (Get-Prop $frozen 'designPageName'); Explicit = $cliDesignPageName; Resolved = $DesignPageName }
    )
    foreach ($item in $replayFields) {
        $frozenValue = if ($item.Frozen) { [string]$item.Frozen } else { '' }
        $explicitValue = if ($item.Explicit) { [string]$item.Explicit } else { '' }
        $resolvedValue = if ($item.Resolved) { [string]$item.Resolved } else { '' }
        if (-not $frozenValue) {
            # 首次运行时这一项没有身份（例如当时还没登记设计页名）：不得在续跑里补写。
            if ($resolvedValue) {
                throw "续跑不能为首次运行缺失的身份 identity.$($item.Field) 补值（本次解析出 '$resolvedValue'）：请从 fetch 新开一次运行（不带 -Progress）"
            }
            continue
        }
        if ($explicitValue -and $explicitValue -ne $frozenValue) {
            throw "续跑不能更改 identity.$($item.Field)（首次运行 = '$frozenValue'，本次显式传入 = '$explicitValue'）：请从 fetch 新开一次运行（不带 -Progress）"
        }
        switch ($item.Field) {
            'fileId' { $FileId = $frozenValue }
            'layerId' { $LayerId = $frozenValue }
            'ui' { $Ui = $frozenValue; $UiSource = '运行登记表 run.json（续跑回放）' }
            'designPageName' { $DesignPageName = $frozenValue }
        }
    }
}

Write-Output ("项目: {0}" -f $ProjectRoot)
Write-Output ("Target: {0}   LayerId: {1}   Ui: {2}{3}" -f $Target, $LayerId, $Ui,
    $(if ($UiSource) { "（来源: $UiSource）" } else { "" }))
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
        'capture'    { Assert-File $GetDslJson   "缺少 $GetDslJson：请先跑 -Progress fetch"
                       Assert-RegisteredInput 'getDsl' }
        'visibility' { Assert-File $SnapshotJson "缺少 $SnapshotJson：请先跑 -Progress capture"
                       Assert-RegisteredInput 'snapshot' }
        'mapping'    { Assert-File $SnapshotJson "缺少 $SnapshotJson：请先跑 -Progress capture"
                       Assert-File $VisibilityJson "缺少 $VisibilityJson：请先跑 -Progress visibility"
                       Assert-RegisteredInput 'snapshot'
                       Assert-RegisteredInput 'visibility' }
        'discover'   { Assert-File $SvgJson "缺少 $SvgJson：请先跑 -Progress svg"
                       $mappingForDiscover = if (Test-Path -LiteralPath $DraftMappingJson) { $DraftMappingJson } else { $MappingAuditJson }
                       Assert-File $mappingForDiscover "缺少 mapping（$DraftMappingJson 或 $MappingAuditJson）：请先跑 -Progress mapping"
                       Assert-RegisteredInput 'extractSvg'
                       Assert-RegisteredInput 'mappingDraft' }
        'ledger'     { Assert-RegisteredInput 'iconCandidates' }
        'layout'     { if (-not $AllowEmptyLedger) { Assert-File $LedgerJson "缺少图标台账 $LedgerJson（人工/AI 定名后的输入）" }
                       Assert-RegisteredInput 'snapshot'
                       Assert-RegisteredInput 'iconMap' }
        'inputs'     { if (-not $AllowEmptyLedger) { Assert-File $LedgerJson "缺少图标台账 $LedgerJson" }
                       Assert-File $TranslationsJson "缺少译文清单 $TranslationsJson（页面文案的英文译文必须显式落盘）"
                       Assert-RegisteredInput 'layoutManifest' }
        'bundle'     { Assert-File $BundleJson "缺少 Bundle 清单 $BundleJson：请先跑 -Progress inputs"
                       Assert-File $SvgJson "缺少 $SvgJson：请先跑 -Progress svg"
                       Assert-RegisteredInput 'bundleManifest'
                       Assert-RegisteredInput 'extractSvg' }
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
                    '--template-map', $TemplateMap, '--dsl', $SnapshotJson, '--out', $CandidateJson) | Out-Null
                # 登记结论由 discover 机械判定：这里把结论摘要带进步骤 note，模型不必再去翻文档判定表。
                $candidateDoc = Get-Content -LiteralPath $CandidateJson -Raw -Encoding UTF8 | ConvertFrom-Json
                $registerCount = @($candidateDoc.mustName).Count
                $note = "待命名清单: $CandidateJson（需登记 $registerCount 条，候选 $(@($candidateDoc.candidates).Count) 条；下标 $((@($candidateDoc.mustName) -join ','))）"
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
                        throw "缺少命名表 $NamingJson：请按候选清单 $CandidateJson 的 registration.register=true（mustName 下标）逐条定名写进命名表（格式见 references/adapters/mtslg-iocontrol/pipeline-contract.md 第 7 步；若本页确实没有图标槽位，加 -AllowEmptyLedger）"
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
                # complete 与 none 都是合法终态。none 的触发条件是推导脚本的
                # 「menuItems + residentGroupItems === 0」（本页既无菜单项、也无右下角常驻分组）；
                # Layout.xml 仍以空 <Menu> 注册本页，后续 Bundle 与 verify 都按"必须有本页注册"检查。
                if ($layout.layoutStatus -notin @('complete', 'none')) { throw "Layout 清单不完整: layoutStatus=$($layout.layoutStatus)（应为 complete 或 none；日志: $log）" }
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
        # 本页现状摘要随每步刷新：必须在本步登记之后，否则摘要里的步骤列表会永远少一步。
        Update-RunSummary
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
        # 续跑命令回填本次调用的全部输入：只写 -Progress 会取不到来源；-Ui / -AllowEmptyLedger /
        # -ConfigPath 这些命令行专属输入若不复现，续跑会在不同区域前缀或不同前置条件下静默继续。
        $resumeArgs = @("-ProjectRoot `"$ProjectRoot`"", "-Target $Target")
        if ($LayerId) { $resumeArgs += "-LayerId $LayerId" }
        if ($FileId) { $resumeArgs += "-FileId $FileId" }
        if ($Ui) { $resumeArgs += "-Ui $Ui" }
        if ($DesignPageName) { $resumeArgs += "-DesignPageName `"$DesignPageName`"" }
        if ($Overwrite) { $resumeArgs += '-Overwrite' }
        if ($AllowEmptyLedger) { $resumeArgs += '-AllowEmptyLedger' }
        if ($ConfigPath) { $resumeArgs += "-ConfigPath `"$ConfigPath`"" }
        Write-Output ("   修好后从这一步继续：pwsh -NoProfile -File _tool\run-all.ps1 {0} -Progress {1}" -f ($resumeArgs -join ' '), $step.Name)
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
    Write-Output '本页现状摘要（每步成功后刷新；先读它，不要为了盘点现状再手写探针）：'
    Write-Output ("  $SummaryJson（身份 / 控件构成 / 待办 todos / 状态说明 notices / 图标候选 / 布局 / 产出清单，每条都写明来源）")
    Write-Output ''
    Write-Output '下一步（语义判断，必须人工/AI 做）：'
    Write-Output ("  1) 读候选清单：$CandidateJson（含每个候选的归属控件、同级 PATH 数、图标层名与尺寸）")
    Write-Output ("  2) 把要登记的图形定名，写进命名表：$NamingJson")
    Write-Output ("     哪些要登记已由 discover 机械判定：照候选的 registration.register=true / mustName 下标定名即可")
    Write-Output ("     （registration.basis 写明判据、registration.source 写明真值源；判据说明见 references/adapters/mtslg-iocontrol/page-build-rules.md 第 2 节——只解释依据，不要自己再推一遍）")
    Write-Output ("     格式：[{ `"index`": <候选下标>, `"name`": `"<英文资源名>Geometry`", `"comment`": `"<中文注释>`", `"fromDsl`": <bool，可选> }, ...]")
    # 这一步只能读已存在的草稿：产物化的 Generated\<Target>.mapping.json 与 layout-manifest 分别到第 10 / 8 步才有。
    # 带 --page-name 时该脚本会用生成器的同一套派生链，列出「派生不出语义键、必须补术语表」的文案——
    # 漏掉它们只会到第 11 步门禁才失败，整段返工。
    $LangCmd = "node `"$PSScriptRoot\list-lang-sources.mjs`" `"$DraftMappingJson`" --page-name $Target"
    if (Test-Path -LiteralPath $TranslationsJson) { $LangCmd += " --translations `"$TranslationsJson`"" }
    if (Test-Path -LiteralPath $GlossaryJson) { $LangCmd += " --glossary `"$GlossaryJson`"" }
    Write-Output ("  3) 枚举本页文案，并同一次列出「必须补术语表」的文案：")
    Write-Output ("     $LangCmd")
    Write-Output ("     顺序：先写译文 → 加上 --translations 再跑一次这条命令。它会分两组报：")
    Write-Output ("       「必须补术语表」= 派生不出语义键（单字符之类，与有没有译文无关），漏了会到第 11 步才失败；")
    Write-Output ("       「还缺译文」= 补上合格英文译文即可，不必进术语表。")
    Write-Output ("     Layout 菜单名要等第 8 步产出，届时把 $LayoutManifestJson 作为第二个位置参数。")
    Write-Output ("     据此把中文→英文译文写进：$TranslationsJson")
    Write-Output ("  4) 然后继续（台账由命名表生成、并自动做图标几何来源核对）：pwsh -NoProfile -File <skill>\scripts\run-all.ps1 -ProjectRoot `"$ProjectRoot`" -Target $Target -Progress ledger")
}
