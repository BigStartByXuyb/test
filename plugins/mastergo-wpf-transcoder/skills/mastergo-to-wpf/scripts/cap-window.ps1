# DPI 感知窗口截图（高缩放机器必备：先调 SetProcessDPIAware，否则 150% DPI 下只能截到窗口的 2/3）
# 用法:
#   powershell -NoProfile -File cap-window.ps1 -ProcName SsdMainMenu -Out shot.png
#   powershell -NoProfile -File cap-window.ps1 -ProcName SsdMainMenu -Out shot.png -Crop "540,1390,260,140" -CropOut card.png
#   pwsh -NoProfile -File cap-window.ps1 -ProcName SsdMainMenu -Out shot.png -Method screen   # 窗口被遮挡时改屏幕抓取
param(
  [Parameter(Mandatory=$true)][string]$ProcName,
  [Parameter(Mandatory=$true)][string]$Out,
  [string]$Crop = "",
  [string]$CropOut = "",
  # printwindow（默认）：即使窗口被其他窗口遮挡也能截全（PW_RENDERFULLCONTENT，WPF/DirectComposition 内容完整渲染）；
  # screen：直接抓屏幕像素，只在 printwindow 出不来内容时用（要求窗口可见且在最前）。
  [ValidateSet('printwindow', 'screen')][string]$Method = 'printwindow',
  [int]$MoveX = 30,
  [int]$MoveY = 4,
  [int]$MaxHeight = 1540   # 压低窗口避免被任务栏遮挡，同时顺带验证 resize 自适应
)

$src = @"
using System;
using System.Runtime.InteropServices;
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public static class U32 {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool repaint);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
}
"@

Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition $src
[void][U32]::SetProcessDPIAware()   # 必须在取坐标之前调用

$p = Get-Process -Name $ProcName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output "process not found"; exit 1 }

$h = $p.MainWindowHandle
[void][U32]::ShowWindow($h, 9)   # SW_RESTORE
[void][U32]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 300

$r = New-Object RECT
[void][U32]::GetWindowRect($h, [ref]$r)
$w = $r.Right - $r.Left
$ht = $r.Bottom - $r.Top
[void][U32]::MoveWindow($h, $MoveX, $MoveY, $w, [Math]::Min($ht, $MaxHeight), $true)
[void][U32]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 600

[void][U32]::GetWindowRect($h, [ref]$r)
$w = $r.Right - $r.Left
$ht = $r.Bottom - $r.Top
if ($w -le 0 -or $ht -le 0) { Write-Output "bad rect ${w}x${ht}"; exit 1 }

$b = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($b)
if ($Method -eq 'printwindow') {
    $hdc = $g.GetHdc()
    [void][U32]::PrintWindow($h, $hdc, 2)   # PW_RENDERFULLCONTENT = 0x2
    $g.ReleaseHdc($hdc)
} else {
    $g.CopyFromScreen($r.Left, $r.Top, 0, 0, $b.Size)
}
$b.Save($Out)
Write-Output "captured ${w}x${ht} ($Method) -> $Out"
# 注意: printwindow 截图中窗口边框/不可见缩放边框区域是黑色属正常；分析内容前先确定客户区原点
# （标题栏 + 边框偏移），别把边框黑带当成内容缺陷。

if ($Crop -and $CropOut) {
  $parts = $Crop.Split(',') | ForEach-Object { [int]$_ }
  $rect = New-Object System.Drawing.Rectangle $parts[0], $parts[1], $parts[2], $parts[3]
  $bmp = New-Object System.Drawing.Bitmap $rect.Width, $rect.Height
  $g2 = [System.Drawing.Graphics]::FromImage($bmp)
  $g2.DrawImage($b, (New-Object System.Drawing.Rectangle 0, 0, $rect.Width, $rect.Height), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save($CropOut)
  $g2.Dispose(); $bmp.Dispose()
  Write-Output "cropped -> $CropOut"
}
$g.Dispose(); $b.Dispose()
