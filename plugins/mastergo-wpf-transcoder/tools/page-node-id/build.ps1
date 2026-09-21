# 用 Windows 自带的 csc（.NET Framework 4.x）编译 MasterGoPageNodeId.exe，无需安装任何工具链。
# 用法： pwsh -NoProfile -File build.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$csc = @(
  "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
  "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $csc) { throw '找不到 csc.exe（Windows 自带 .NET Framework 4.x）' }

& $csc /nologo /target:exe /optimize+ /r:System.Web.Extensions.dll `
  ("/out:" + (Join-Path $here 'MasterGoPageNodeId.exe')) (Join-Path $here 'PageNodeId.cs')
if ($LASTEXITCODE -ne 0) { throw "csc 编译失败，exit=$LASTEXITCODE" }
"OK -> " + (Join-Path $here 'MasterGoPageNodeId.exe')
