# 交付验证记录：把独立校验的输出落到 Generated/_work/verification/*.log，
# 与 Bundle 自带的硬校验（provenance / coords）分开留存，便于复核。
param(
    [string] $ProjectRoot,
    [string] $SkillRoot,
    [string] $Page
)

$ErrorActionPreference = 'Stop'
# 两种布局都要能跑：插件布局（脚本在 <plugin>/skills/mastergo-to-wpf/scripts/）与项目布局（<project>/_tool/）。
$pluginLayout = -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'mastergo-to-wpf'))
if (-not $SkillRoot) {
    $SkillRoot = if ($pluginLayout) { Split-Path -Parent $PSScriptRoot } else { Join-Path $ProjectRoot '_tool\mastergo-to-wpf' }
}
if (-not $ProjectRoot) {
    $ProjectRoot = if ($pluginLayout) { (Get-Location).Path } else { Split-Path -Parent $PSScriptRoot }
}
if (-not $Page) {
    $registry = Join-Path $ProjectRoot 'docs\page-registry.json'
    if (-not (Test-Path -LiteralPath $registry)) { throw "缺少 $registry，无法确定页面名；请用 -Page 指定" }
    $Page = (@(Get-Content -LiteralPath $registry -Raw -Encoding UTF8 | ConvertFrom-Json).pages)[0].target
}
if (-not $Page) { throw "页面登记表里没有 target" }
$page = $Page
$pageXml = Join-Path $ProjectRoot "Resources\Pages\$page\${page}Page.xml"
$iconXaml = Join-Path $ProjectRoot "Resources\Pages\$page\${page}Icons.xaml"
$mapping = Join-Path $ProjectRoot "Generated\$page.mapping.json"
$templateMap = Join-Path $SkillRoot 'references\adapters\mtslg-iocontrol\mtslg-iocontrol-map.json'
# 验证日志按页分目录：一个项目里可以有多张页面，共享目录会互相覆盖。
$logDir = Join-Path $ProjectRoot ("Generated\_work\verification\" + $page)
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$results = [ordered]@{}

function Invoke-Step {
    param([string] $Name, [string] $File, [scriptblock] $Body)
    $output = & $Body 2>&1 | Out-String
    Set-Content -LiteralPath (Join-Path $logDir $File) -Value $output -Encoding UTF8
    $script:results[$Name] = if ($LASTEXITCODE -eq 0) { 'passed' } else { "failed(exit=$LASTEXITCODE)" }
    Write-Output "--- $Name [$($script:results[$Name])] ---"
    Write-Output $output.Trim()
}

Invoke-Step -Name 'provenance' -File '1-provenance.log' -Body {
    node (Join-Path $SkillRoot 'scripts\validate-iocontrol-provenance.js') --xml $pageXml --mapping $mapping --map $templateMap
}

Invoke-Step -Name 'coords' -File '2-coords.log' -Body {
    $coords = Join-Path $ProjectRoot "Generated/_work/verification/$page/coords.json"
    # 外层辅助脚本与 run-verifications.ps1 同目录（插件布局在 scripts/、项目布局在 _tool/）
    node (Join-Path $PSScriptRoot 'check-coords.mjs') $mapping $coords | Out-Null
    if ($LASTEXITCODE -ne 0) { return }
    node (Join-Path $SkillRoot 'scripts\check-iocontrol-coords.js') --xml $pageXml --nodes $coords
}

Invoke-Step -Name 'icon-coords' -File '3-icon-coords.log' -Body {
    node (Join-Path $SkillRoot 'scripts\scan-icon-coords.js') $iconXaml
}

Invoke-Step -Name 'structure' -File '4-structure.log' -Body {
    pwsh -NoProfile -File (Join-Path $PSScriptRoot 'verify-page.ps1') -ProjectRoot $ProjectRoot -Page $page
}

Write-Output '--- summary ---'
$results.GetEnumerator() | ForEach-Object { Write-Output ("{0}: {1}" -f $_.Key, $_.Value) }
if ($results.Values -contains 'failed(exit=1)' -or ($results.Values | Where-Object { $_ -like 'failed*' })) { exit 1 }
