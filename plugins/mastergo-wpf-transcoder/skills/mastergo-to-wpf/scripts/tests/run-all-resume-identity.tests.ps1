$ErrorActionPreference = 'Stop'
$runAll = Join-Path $PSScriptRoot '..\run-all.ps1'
$root = Join-Path ([IO.Path]::GetTempPath()) "mastergo-resume-identity-$([guid]::NewGuid().ToString('N'))"

function Assert-True {
    param([bool] $Condition, [string] $Message)
    if (-not $Condition) { throw "断言失败: $Message" }
}

# 桩 token：本用例只校验续跑身份解析，全部从 gates 步进入，不会调用 MasterGo MCP（无网络、无真实凭证）。
$env:MASTERGO_MCP_TOKEN = 'mg_' + ('0' * 32)

# 造一个最小项目：项目登记表（人维护）+ 运行登记表（首次运行冻结的身份）。
function New-Fixture {
    param(
        [string] $Name,
        [string] $FrozenUi = 'F8',
        [string] $RegistryUi = 'F8',
        [string] $FrozenDesignPageName = '设计页 A',
        [string] $RegistryDesignPageName = '设计页 A',
        [switch] $DropRegistryPage
    )
    $project = Join-Path $root $Name
    New-Item -ItemType Directory -Force -Path (Join-Path $project 'docs') | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $project 'Generated\runs\Demo') | Out-Null
    $page = [ordered]@{
        target = 'Demo'
        ui = $RegistryUi
        designSource = [ordered]@{
            fileId = 'file-A'
            layerId = 'layer-A'
            designPageName = $RegistryDesignPageName
        }
    }
    $registry = [ordered]@{
        schemaVersion = 'mastergo-page-registry/1'
        pages = if ($DropRegistryPage) { @() } else { @($page) }
    }
    ($registry | ConvertTo-Json -Depth 10) |
        Set-Content -LiteralPath (Join-Path $project 'docs\page-registry.json') -Encoding UTF8
    $run = [ordered]@{
        schemaVersion = 'mastergo-run-registry/1'
        runId = '20260101-000000-stub'
        target = 'Demo'
        projectRoot = $project
        identity = [ordered]@{
            fileId = 'file-A'
            layerId = 'layer-A'
            ui = $FrozenUi
            designPageName = $FrozenDesignPageName
        }
        inputs = [ordered]@{}
        artifacts = [ordered]@{}
        outputs = [ordered]@{}
        steps = @()
    }
    ($run | ConvertTo-Json -Depth 10) |
        Set-Content -LiteralPath (Join-Path $project 'Generated\runs\Demo\run.json') -Encoding UTF8
    return $project
}

# 续跑：-Progress gates（步骤 11 > 1 → --keep）。身份解析通过后会在第 11 步因缺少 Bundle 审计失败，
# 以此区分"身份被接受"与"被身份守卫拒绝"两类结果。
function Invoke-Resume {
    param([string] $Project, [string[]] $Extra = @())
    $arguments = @('-ProjectRoot', $Project, '-Target', 'Demo', '-Progress', 'gates') + $Extra
    $output = & pwsh -NoProfile -File $runAll @arguments 2>&1 | Out-String
    return $output
}

try {
    New-Item -ItemType Directory -Force -Path $root | Out-Null

    # 1) 省略身份 → 回放冻结值（身份解析通过，落到第 11 步的缺失检查）。
    $case1 = New-Fixture -Name 'omitted'
    $out1 = Invoke-Resume -Project $case1
    Assert-True ($out1 -match '缺少 Bundle 审计') '省略身份时应回放冻结身份并继续到第 11 步'
    Assert-True ($out1 -notmatch '续跑不能') '省略身份时不应触发身份守卫'
    $after1 = Get-Content -LiteralPath (Join-Path $case1 'Generated\runs\Demo\run.json') -Raw | ConvertFrom-Json
    Assert-True ($after1.identity.ui -eq 'F8') '续跑不得改写冻结的 identity.ui'
    Assert-True ($after1.identity.designPageName -eq '设计页 A') '续跑不得改写冻结的 identity.designPageName'

    # 2) 显式传入不同的值 → fail-closed。
    $case2 = New-Fixture -Name 'explicit-different'
    $out2 = Invoke-Resume -Project $case2 -Extra @('-Ui', 'F9')
    Assert-True ($out2 -match '续跑不能更改 identity.ui') '显式传入不同 ui 必须被拒绝'
    Assert-True ($out2 -match '新开一次运行') '拒绝时必须给出"新开一次运行"的处置'

    # 3) 显式传入与冻结值相同的值 → 允许，不误报。
    $case3 = New-Fixture -Name 'explicit-same'
    $out3 = Invoke-Resume -Project $case3 -Extra @('-Ui', 'F8', '-DesignPageName', '设计页 A')
    Assert-True ($out3 -match '缺少 Bundle 审计') '显式传回原值时应允许续跑'
    Assert-True ($out3 -notmatch '续跑不能') '显式传回原值不应触发身份守卫'

    # 4) 首次运行缺失的身份不得在续跑里补写。
    $case4 = New-Fixture -Name 'backfill' -FrozenDesignPageName ''
    $out4 = Invoke-Resume -Project $case4
    Assert-True ($out4 -match 'identity.designPageName') '补写首次缺失的身份必须被拒绝'
    Assert-True ($out4 -match '补值') '拒绝文案必须点明"补值"'

    # 5) 续跑回放：项目登记表被改动（ui F8 → F9）也不影响正在续跑的这一次。
    $case5 = New-Fixture -Name 'registry-edited' -FrozenUi 'F8' -RegistryUi 'F9'
    $out5 = Invoke-Resume -Project $case5
    Assert-True ($out5 -match 'Ui: F8') '续跑必须回放冻结的 ui，而不是重新读项目登记表'
    Assert-True ($out5 -match 'LayerId: layer-A') '续跑必须回放冻结的 layerId'
    Assert-True ($out5 -notmatch '续跑不能') '改动项目登记表不应再打断续跑'

    # 6) 边界（与 §7 文档同口径）：删掉项目登记表条目后身份取不到值 → 先报「缺少…」，不静默续跑。
    $case6 = New-Fixture -Name 'entry-removed' -DropRegistryPage
    $out6 = Invoke-Resume -Project $case6
    Assert-True ($out6 -match '缺少 MasterGo 文件 id') '删除登记表条目后应先报缺少身份，而不是静默继续'
    Assert-True ($out6 -notmatch '缺少 Bundle 审计') '删除登记表条目后不应走到第 11 步'

    # 7) 同一情形下显式传回身份 → 可以续跑（这是 §7 给出的处置）。
    $out7 = Invoke-Resume -Project $case6 -Extra @('-FileId', 'file-A', '-LayerId', 'layer-A', '-Ui', 'F8', '-DesignPageName', '设计页 A')
    Assert-True ($out7 -match '缺少 Bundle 审计') '显式传回身份后应能续跑'

    Write-Output 'PASS MasterGo run-all 续跑身份回放测试'
}
finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
