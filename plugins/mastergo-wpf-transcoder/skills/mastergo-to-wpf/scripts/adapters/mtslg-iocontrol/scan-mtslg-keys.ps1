<#
.SYNOPSIS
  扫描 MTSLG Config 生成 IOContorl 键白名单 JSON。

  背景：MTSLG 框架闭源，Style/Icon(Geometry)/IOCommand 等键在 Config 文本中无定义源头（定义在
  编译进 DLL 的资源里）。现有页面 XML 与 Layout.xml 的"使用先例"是键是否存在的唯一证据。
  生成的页面 XML 中 Style/Icon/LangName/PageName 必须命中本白名单，查不到的键禁止使用。

.DESCRIPTION
  扫描范围（均在 $MtRoot\Config 下）：
  - 所有 *\Pages\*.xml 页面：Style / Icon / LangName / IOCommand / IOName / PageName / ControlType
  - 所有 *\Configuration\Layout.xml 注册表：Page Target、MenuItem 的 Icon/LangName/PageName
  - Common\Language\*.xaml 语言文件：x:Key 集合，LangName 引用须 CN 与 EN 成对存在

.PARAMETER MtRoot
  框架根目录。应由目标项目 framework.config.json 或 mw-framework-index 提供；默认不绑定任何机器路径。
  注意：只扫描 $MtRoot\Config，不会误扫 MTSLG\MTSLG 重复副本。

.PARAMETER Out
  输出 JSON 路径（默认 mtslg-keys.json）。

.EXAMPLE
  pwsh -File scripts/scan-mtslg-keys.ps1 -MtRoot D:/MTSLG -Out docs/mtslg-keys.json
#>
param(
    [Parameter(Mandatory=$true)][string]$MtRoot,
    [string]$Out = "mtslg-keys.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $MtRoot)) {
    throw "MtRoot 不存在: $MtRoot。请先确认目标项目路径或通过 mw-framework-index 重新绑定。"
}
$configRoot = Join-Path $MtRoot "Config"
if (-not (Test-Path $configRoot)) {
    throw "未找到 Config 目录: $configRoot"
}

# 注意：不能包成函数——空 List 经函数管道输出会被展开成 $null
$styles      = [System.Collections.Generic.List[string]]::new()
$icons       = [System.Collections.Generic.List[string]]::new()
$langRefs    = [System.Collections.Generic.List[string]]::new()
$ioCmds      = [System.Collections.Generic.List[string]]::new()
$ioNames     = [System.Collections.Generic.List[string]]::new()
$jumpRefs    = [System.Collections.Generic.List[string]]::new()
$ctrlTypes   = [System.Collections.Generic.List[string]]::new()
$pageTargets = [System.Collections.Generic.List[string]]::new()

function Add-IfValue($set, $value) {
    if ($null -ne $value -and "$value".Trim() -ne "") {
        $v = "$value".Trim()
        if (-not $set.Contains($v)) { $set.Add($v) }
    }
}

# ---------- 1. 页面 XML ----------
$pageFiles = Get-ChildItem -Path $configRoot -Recurse -Filter *.xml |
    Where-Object { $_.FullName -match '\\Pages\\' -and $_.Name -ne 'Layout.xml' }

foreach ($f in $pageFiles) {
    try {
        $x = [xml](Get-Content -Raw -Encoding UTF8 $f.FullName)
    } catch {
        Write-Warning "跳过无法解析的页面: $($f.FullName)"
        continue
    }
    $nodes = $x.SelectNodes('//IOContorl')
    if (-not $nodes) { continue }
    foreach ($n in $nodes) {
        Add-IfValue $styles    $n.Style
        Add-IfValue $icons     $n.Icon
        Add-IfValue $langRefs  $n.LangName
        Add-IfValue $ioCmds    $n.IOCommand
        Add-IfValue $ioNames   $n.IOName
        Add-IfValue $ctrlTypes $n.ControlType
        if ("$($n.PageName)" -match '^Jump:(.+)$') {
            Add-IfValue $jumpRefs $Matches[1]
        }
    }
}

# ---------- 2. Layout.xml 注册表 ----------
$layoutFiles = Get-ChildItem -Path $configRoot -Recurse -Filter Layout.xml |
    Where-Object { $_.FullName -match '\\Configuration\\' }

foreach ($f in $layoutFiles) {
    try {
        $x = [xml](Get-Content -Raw -Encoding UTF8 $f.FullName)
    } catch {
        Write-Warning "跳过无法解析的 Layout: $($f.FullName)"
        continue
    }
    foreach ($p in $x.SelectNodes('//Page')) {
        Add-IfValue $pageTargets $p.Target
        Add-IfValue $langRefs    $p.LangName
        foreach ($m in $p.SelectNodes('./Menu/MenuItem')) {
            Add-IfValue $icons    $m.Icon
            Add-IfValue $langRefs $m.LangName
            if ("$($m.PageName)" -match '^Jump:(.+)$') {
                Add-IfValue $jumpRefs $Matches[1]
            }
        }
    }
}

# ---------- 3. 语言文件（CN/EN 成对校验，扫描所有 Language 目录） ----------
$cnKeys = [System.Collections.Generic.List[string]]::new()
$enKeys = [System.Collections.Generic.List[string]]::new()

$langDirs = Get-ChildItem -Path $configRoot -Recurse -Directory -Filter 'Language'
foreach ($langDir in $langDirs) {
    foreach ($f in (Get-ChildItem -Path $langDir.FullName -Filter *.xaml)) {
        try {
            $x = [xml](Get-Content -Raw -Encoding UTF8 $f.FullName)
        } catch {
            Write-Warning "跳过无法解析的语言文件: $($f.FullName)"
            continue
        }
        $nsm = New-Object System.Xml.XmlNamespaceManager($x.NameTable)
        $nsm.AddNamespace('x', 'http://schemas.microsoft.com/winfx/2006/xaml')
        $isCn = $f.BaseName -match '_CN$'
        $isEn = $f.BaseName -match '_EN$'
        foreach ($k in $x.SelectNodes('//@x:Key', $nsm)) {
            $kv = "$($k.Value)"
            if ($isCn -and -not $cnKeys.Contains($kv)) { $cnKeys.Add($kv) }
            if ($isEn -and -not $enKeys.Contains($kv)) { $enKeys.Add($kv) }
        }
    }
}

$langVerified = [System.Collections.Generic.List[string]]::new()  # 引用且在 CN 与 EN 成对存在
$langCnOnly   = [System.Collections.Generic.List[string]]::new()  # 只在 CN
$langMissing  = [System.Collections.Generic.List[string]]::new()  # 两边都没有
foreach ($k in $langRefs) {
    if ($cnKeys.Contains($k) -and $enKeys.Contains($k)) { $langVerified.Add($k) }
    elseif ($cnKeys.Contains($k)) { $langCnOnly.Add($k) }
    else { $langMissing.Add($k) }
}

# ---------- 4. 输出 ----------
function To-Sorted($set) { @($set) | Sort-Object -Unique }

$result = [ordered]@{
    generatedAt  = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    mtRoot       = $MtRoot
    styles       = To-Sorted $styles
    icons        = To-Sorted $icons
    langNames    = [ordered]@{
        verified = To-Sorted $langVerified
        cnOnly   = To-Sorted $langCnOnly
        missing  = To-Sorted $langMissing
    }
    pageTargets  = To-Sorted $pageTargets
    jumpTargets  = To-Sorted $jumpRefs
    ioCommands   = To-Sorted $ioCmds
    ioNames      = To-Sorted $ioNames
    controlTypes = To-Sorted $ctrlTypes
}

$json = $result | ConvertTo-Json -Depth 4
Set-Content -Path $Out -Value $json -Encoding UTF8

Write-Output "OK -> $Out"
Write-Output ("styles={0} icons={1} pageTargets={2} jumpTargets={3} ioCommands={4} ioNames={5} controlTypes={6}" -f `
    $styles.Count, $icons.Count, $pageTargets.Count, $jumpRefs.Count, $ioCmds.Count, $ioNames.Count, $ctrlTypes.Count)
Write-Output ("langNames: verified={0} cnOnly={1} missing={2}" -f $langVerified.Count, $langCnOnly.Count, $langMissing.Count)
if ($langMissing.Count -gt 0) {
    Write-Warning ("以下 LangName 引用在语言文件中找不到（页面可能缺键）：{0}" -f (@($langMissing) -join ', '))
}
if ($langCnOnly.Count -gt 0) {
    Write-Warning ("以下 LangName 只在 CN 存在、缺 EN 成对：{0}" -f (@($langCnOnly) -join ', '))
}
