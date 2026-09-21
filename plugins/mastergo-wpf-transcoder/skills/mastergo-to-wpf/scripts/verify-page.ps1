# 独立校验（不依赖生成器内部结论）：XML 可解析、ID 唯一、根骨架、Icon 引用闭环、
# LangName 在 CN/EN 字典中成对存在、字典 key 集合一致。
param(
    [string] $ProjectRoot,
    [string] $Page
)

$ErrorActionPreference = 'Stop'
# 默认目标项目 = 脚本目录的父目录（项目布局）或当前工作目录（插件布局）。
if (-not $ProjectRoot) {
    $candidate = Split-Path -Parent $PSScriptRoot
    $ProjectRoot = if (Test-Path -LiteralPath (Join-Path $candidate 'docs\page-registry.json')) { $candidate } else { (Get-Location).Path }
}
# 页面名从项目登记表取（脚本不写死某个页面的名字）。
if (-not $Page) {
    $registry = Join-Path $ProjectRoot 'docs\page-registry.json'
    if (-not (Test-Path -LiteralPath $registry)) { throw "缺少 $registry，无法确定页面名；请用 -Page 指定" }
    $Page = (@(Get-Content -LiteralPath $registry -Raw -Encoding UTF8 | ConvertFrom-Json).pages)[0].target
}
if (-not $Page) { throw "页面登记表里没有 target" }
$page = $Page
$pageXml = Join-Path $ProjectRoot "Resources\Pages\$page\${page}Page.xml"
$iconXaml = Join-Path $ProjectRoot "Resources\Pages\$page\${page}Icons.xaml"
$cn = Join-Path $ProjectRoot "Resources\Pages\$page\${page}_CN.xaml"
$en = Join-Path $ProjectRoot "Resources\Pages\$page\${page}_EN.xaml"
$layout = Join-Path $ProjectRoot "Resources\Layout\Layout.xml"

$fail = New-Object System.Collections.Generic.List[string]
$warn = New-Object System.Collections.Generic.List[string]

$doc = [xml](Get-Content -LiteralPath $pageXml -Raw -Encoding UTF8)
$root = $doc.DocumentElement
if ($root.Name -ne 'IOContorl') { $fail.Add("页面根节点不是 IOContorl: $($root.Name)") }
foreach ($attr in @('Left', 'Top', 'Width', 'Height')) {
    if ($root.$attr -ne 'NaN') { $fail.Add("页面根节点 $attr 不是 NaN: $($root.$attr)") }
}

$allNodes = $root.SelectNodes('.//IOContorl')
$ids = @($allNodes | ForEach-Object { $_.ID })
$dupIds = $ids | Group-Object | Where-Object { $_.Count -gt 1 }
if ($dupIds) { $fail.Add("重复 ID: " + (($dupIds | ForEach-Object { $_.Name }) -join ', ')) }
if ($ids -contains '') { $fail.Add("存在空 ID 的业务节点") }

$iconKeys = @()
$iconText = Get-Content -LiteralPath $iconXaml -Raw -Encoding UTF8
$iconKeys = @([regex]::Matches($iconText, '<Geometry\s[^>]*\bx:Key="([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
foreach ($key in $iconKeys) {
    $block = [regex]::Match($iconText, '<Geometry\s[^>]*\bx:Key="' + [regex]::Escape($key) + '"[^>]*>(.*?)</Geometry>', 'Singleline')
    if ($block -notmatch 'o:Freeze="True"') { $fail.Add("Geometry $key 缺少 o:Freeze=True") }
    if ($block.Groups[1].Value -notmatch '[Mm]') { $fail.Add("Geometry $key 的路径数据为空") }
}

$usedIcons = @($root.SelectNodes('.//IOContorl[@Icon]') | ForEach-Object { $_.Icon } | Where-Object { $_ } | Sort-Object -Unique)
$layoutIcons = @()
$ownPageNode = $null
if (Test-Path -LiteralPath $layout) {
    $layoutDoc = [xml](Get-Content -LiteralPath $layout -Raw -Encoding UTF8)
    # Layout.xml 是项目级共享文件（可登记多张页面）：只校验本页自己的 <Page> 节点。
    # 其他页面的 MenuItem（含其 Icon/LangName）属于各自页面，不能拿来跟本页比对。
    $ownPageNode = $layoutDoc.SelectSingleNode("//Page[@Target='$page']")
    if (-not $ownPageNode) {
        $fail.Add("Layout.xml 里没有本页注册 <Page Target=`"$page`">")
    } else {
        $layoutIcons = @($ownPageNode.SelectNodes('.//MenuItem[@Icon]') | ForEach-Object { $_.Icon } | Where-Object { $_ } | Sort-Object -Unique)
    }
}
# 映射表登记 iconPolicy=runtime 的变体：Icon 资源由目标项目提供，本页 Icons.xaml 里不该有该键。
$runtimeIcons = @()
$mappingAudit = Join-Path $ProjectRoot "Generated\${page}.mapping.json"
if (Test-Path -LiteralPath $mappingAudit) {
    $mappingDoc = Get-Content -LiteralPath $mappingAudit -Raw -Encoding UTF8 | ConvertFrom-Json -Depth 60
    $runtimeIcons = @($mappingDoc.nodes | Where-Object { $_.runtimeIcon } | ForEach-Object { $_.runtimeIcon } | Sort-Object -Unique)
}
foreach ($icon in ($usedIcons + $layoutIcons | Sort-Object -Unique)) {
    if ($runtimeIcons -contains $icon) { continue }
    if ($iconKeys -notcontains $icon) { $fail.Add("引用了未生成的 Geometry: $icon") }
}
# Icon 文件为空的判定：只有"页面确实需要本页 Geometry"时才算失败。
# 运行图标（映射表 iconPolicy=runtime，如 enter/exit）由框架/目标项目提供，本页 Icons.xaml 本来就该是空字典。
$expectedPageIcons = @(($usedIcons + $layoutIcons | Sort-Object -Unique) | Where-Object { $_ -and ($runtimeIcons -notcontains $_) })
if (-not $iconKeys.Count) {
    if ($expectedPageIcons.Count) {
        $fail.Add("Icon 文件没有 Geometry 资源键，但页面引用了本页 Geometry: " + ($expectedPageIcons -join ', '))
    } else {
        $referenced = @($usedIcons + $layoutIcons | Sort-Object -Unique | Where-Object { $_ })
        $warn.Add("本页没有页面级 Geometry（Icon 文件是空字典）：页面/Layout 引用的图标全部由框架提供" +
            $(if ($referenced.Count) { "（" + ($referenced -join ', ') + "）" } else { "" }))
    }
}

$pageLangNames = @($root.SelectNodes('.//IOContorl[@LangName]') | ForEach-Object { $_.LangName } | Where-Object { $_ })
$menuLangNames = @()
if ($ownPageNode) {
    $menuLangNames = @($ownPageNode.SelectNodes('.//MenuItem[@LangName]') | ForEach-Object { $_.LangName } | Where-Object { $_ })
}
$cnKeys = @([regex]::Matches((Get-Content -LiteralPath $cn -Raw -Encoding UTF8), '<sys:String\s+x:Key="([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
$enKeys = @([regex]::Matches((Get-Content -LiteralPath $en -Raw -Encoding UTF8), '<sys:String\s+x:Key="([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
if (($cnKeys -join '|') -ne ($enKeys -join '|')) { $fail.Add("CN/EN 字典 key 集合或顺序不一致") }
$dupLang = $cnKeys | Group-Object | Where-Object { $_.Count -gt 1 }
if ($dupLang) { $fail.Add("语言字典重复 key: " + (($dupLang | ForEach-Object { $_.Name }) -join ', ')) }
foreach ($langName in ($pageLangNames + $menuLangNames | Sort-Object -Unique)) {
    if ($cnKeys -notcontains $langName) { $fail.Add("LangName 未在语言字典中登记: $langName") }
}

Write-Output ("页面节点数: " + $allNodes.Count)
Write-Output ("Geometry 键: " + $iconKeys.Count + "  页面/Layout 引用: " + (($usedIcons + $layoutIcons | Sort-Object -Unique).Count))
Write-Output ("语言 key: " + $cnKeys.Count + "  CN=EN 一致: " + (($cnKeys -join '|') -eq ($enKeys -join '|')))
Write-Output ("Layout: 全文件登记页面 " + (@($layoutDoc.SelectNodes('//Page')).Count) + " 张；本页菜单项 " + (@($ownPageNode.SelectNodes('.//MenuItem')).Count) + " 个")

if ($fail.Count) {
    Write-Output "---- FAIL ----"
    $fail | ForEach-Object { Write-Output ("- " + $_) }
    exit 1
}
if ($warn.Count) {
    Write-Output "---- WARN（不是失败，按需写进交付说明） ----"
    $warn | ForEach-Object { Write-Output ("- " + $_) }
}
Write-Output "PASS: 静态结构与引用闭环校验通过"
