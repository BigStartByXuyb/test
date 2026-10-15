<#
.SYNOPSIS
  按目标项目 framework.config.json 将 IOContorl 页面 XML 安全同步到已确认的运行目录。

安全保证（强制）：
  1. 目标文件已存在 → 覆盖前先备份到 BackupDir（带时间戳），备份成功才覆盖；
  2. 任何一步失败 → 自动回滚（用刚做的备份还原，新文件直接删除）；
  3. 默认拒绝配置明确标记为重复副本的目标路径；
     显式 -AllowDuplicate 才放行；
  4. MT 目录是 SVN 工作树：同步前打印 svn status 摘要，绝不自动 commit/update。

.PARAMETER FromDir
  源目录。省略时从 framework.config.json 读取 output_root/pages_root，或 output_root + /Pages。

.PARAMETER ToDir
  目标目录。省略时从 framework.config.json 读取 runtime_pages_root，或 runtime_root + page_dir。

.PARAMETER BackupDir
  备份目录。省略时用 framework.config.json 的 sync_backup_dir
  （相对 output_root，默认 .backup）。

.PARAMETER DryRun
  只打印同步计划，不实际复制。

.PARAMETER AllowDuplicate
  允许同步到配置标记的重复运行副本路径（默认拒绝）。

.EXAMPLE
  pwsh -File scripts/sync-to-mt.ps1 -DryRun
  pwsh -File scripts/sync-to-mt.ps1 -DryRun
#>
param(
    [string]$FromDir = "",
    [string]$ToDir = "",
    [string]$BackupDir = "",
    [switch]$DryRun,
    [switch]$AllowDuplicate
)

$ErrorActionPreference = "Stop"

# ---------- 从项目 framework.config.json 读取缺省 ----------
$configPath = Join-Path (Get-Location) "framework.config.json"
$cfg = $null
$projectRoot = (Get-Location).Path
if (Test-Path $configPath) {
    try { $cfg = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json; $projectRoot = Split-Path -LiteralPath $configPath -Parent } catch {
        Write-Warning "framework.config.json 解析失败，忽略: $_"
    }
}

function Resolve-ProjectPath([string]$value) {
    if (-not $value) { return $null }
    if ([System.IO.Path]::IsPathRooted($value)) { return [System.IO.Path]::GetFullPath($value) }
    return [System.IO.Path]::GetFullPath((Join-Path $projectRoot $value))
}

$outputRoot = Resolve-ProjectPath ([string]$cfg.output_root)
$pagesRoot = Resolve-ProjectPath ([string]$cfg.pages_root)
$runtimeRoot = Resolve-ProjectPath ([string]$cfg.runtime_root)
$runtimePagesRoot = Resolve-ProjectPath ([string]$cfg.runtime_pages_root)

if (-not $FromDir) {
    if ($pagesRoot) { $FromDir = $pagesRoot }
    elseif ($outputRoot) { $FromDir = Join-Path $outputRoot "Pages" }
    else { throw "缺少 -FromDir，且当前目录无 framework.config.json" }
}
if (-not $ToDir) {
    if ($runtimePagesRoot) { $ToDir = $runtimePagesRoot }
    elseif ($cfg -and $cfg.page_dir -and $runtimeRoot) { $ToDir = Join-Path $runtimeRoot $cfg.page_dir }
    elseif ($cfg -and $cfg.page_dir -and $cfg.runtime_drive) { $ToDir = Join-Path ([string]$cfg.runtime_drive) ([string]$cfg.page_dir) }
    elseif ($cfg -and $cfg.page_dir -and $cfg.mt_root) { $ToDir = Join-Path (Resolve-ProjectPath ([string]$cfg.mt_root)) ([string]$cfg.page_dir) }
    if (-not $ToDir) { throw "缺少 -ToDir，且 framework.config.json 未提供 runtime_drive/mt_root + page_dir" }
}
if (-not $BackupDir) {
    if ($cfg -and $cfg.sync_backup_dir) {
        $BackupDir = if ([System.IO.Path]::IsPathRooted($cfg.sync_backup_dir)) { $cfg.sync_backup_dir }
                     elseif ($cfg.output_root) { Join-Path $cfg.output_root $cfg.sync_backup_dir }
                     else { $cfg.sync_backup_dir }
    } else {
        $BackupDir = Join-Path (Split-Path $FromDir -Parent) ".backup"
    }
}

# ---------- 校验 ----------
if (-not (Test-Path $FromDir)) { throw "FromDir 不存在: $FromDir" }
if (-not (Test-Path $ToDir)) { throw "ToDir 不存在: $ToDir（请确认 framework.config.json 中的运行目录）" }

$normToDir = [System.IO.Path]::GetFullPath($ToDir).Replace('/', '\')
$duplicatePatterns = @($cfg.duplicate_runtime_patterns)
foreach ($pattern in $duplicatePatterns) {
    if ($pattern -and $normToDir -like "*$pattern*" -and -not $AllowDuplicate) {
        throw "拒绝同步到配置标记的重复运行副本: $pattern；如确要同步请加 -AllowDuplicate。"
    }
}
if ($normToDir -notmatch '\\Config\\') {
    Write-Warning "ToDir 不在 Config 目录下，请确认: $ToDir"
}

if (-not (Test-Path $BackupDir)) {
    if ($DryRun) { Write-Output "[DryRun] 将创建备份目录: $BackupDir" }
    else { New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null }
}

# 页面按「一页一目录」存放（Resources/Pages/<页面名>/<页面名>Page.xml），
# 运行时页面目录是平面的，所以递归枚举后按文件名平铺同步。
$files = Get-ChildItem -Path $FromDir -Filter *.xml -File -Recurse
if ($files.Count -eq 0) { Write-Output "FromDir 下无 .xml 文件，无需同步"; exit 0 }

$duplicateNames = $files | Group-Object Name | Where-Object { $_.Count -gt 1 }
if ($duplicateNames) {
    throw "FromDir 下存在同名页面文件，平铺同步会互相覆盖: " + (($duplicateNames | ForEach-Object { $_.Name }) -join ", ")
}

# ---------- SVN 状态摘要（不自动 commit） ----------
function Find-SvnRoot($dir) {
    $d = $dir
    while ($d) {
        if (Test-Path (Join-Path $d ".svn")) { return $d }
        $parent = Split-Path $d -Parent
        if ($parent -eq $d) { return $null }
        $d = $parent
    }
    return $null
}
$svnRoot = Find-SvnRoot $ToDir
if ($svnRoot) {
    try {
        $status = & svn status $ToDir 2>$null
        if ($status) {
            Write-Output "--- svn status 摘要（不自动提交，请自行 svn commit）---"
            $status | ForEach-Object { Write-Output $_ }
            Write-Output "--- 结束 ---"
        }
    } catch {
        Write-Warning "svn status 执行失败（无影响，仅提示）: $_"
    }
}

# ---------- 同步计划 ----------
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$plan = @()
foreach ($f in $files) {
    $target = Join-Path $ToDir $f.Name
    $existed = Test-Path $target
    $backup = if ($existed) { Join-Path $BackupDir "$($f.Name).$stamp.bak" } else { $null }
    $plan += [pscustomobject]@{
        Source = $f.FullName
        Target = $target
        Existed = $existed
        Backup = $backup
    }
}

Write-Output "同步计划:"
$plan | ForEach-Object {
    $act = if ($_.Existed) { "覆盖(备份到 $($_.Backup))" } else { "新建" }
    Write-Output "  $($_.Source)  ->  $($_.Target)  [$act]"
}

if ($DryRun) { Write-Output "[DryRun] 未执行任何复制"; exit 0 }

# ---------- 执行（带备份 + 失败回滚） ----------
$done = @()   # @{Target, Backup, Existed}
try {
    foreach ($p in $plan) {
        if ($p.Existed) {
            Copy-Item -Path $p.Target -Destination $p.Backup -Force
            if (-not (Test-Path $p.Backup)) { throw "备份失败: $($p.Backup)" }
        }
        Copy-Item -Path $p.Source -Destination $p.Target -Force
        $done += $p
        Write-Output "OK  $($p.Target)"
    }
} catch {
    Write-Error "同步失败: $_，开始回滚..."
    foreach ($d in ($done | Sort-Object { $done.IndexOf($_) } -Descending)) {
        if ($d.Existed -and $d.Backup -and (Test-Path $d.Backup)) {
            Copy-Item -Path $d.Backup -Destination $d.Target -Force
            Write-Output "回滚还原: $($d.Target)"
        } elseif (-not $d.Existed) {
            Remove-Item -Path $d.Target -Force -ErrorAction SilentlyContinue
            Write-Output "回滚删除: $($d.Target)"
        }
    }
    throw "同步已回滚，未留下部分改动。"
}

Write-Output "同步完成。运行中的 MaxwellFramework 切到目标页后按 Ctrl+R 刷新预览。"
Write-Output "SVN 提交请自行执行（本脚本不自动 commit）。"
