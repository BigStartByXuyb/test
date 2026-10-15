<#
注册、注销或查询「飞书桥接 Codex」的登录自启计划任务。
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('install', 'uninstall', 'status')]
    [string]$Action,

    [string]$BridgeScript = (Join-Path $PSScriptRoot 'bridge.mjs')
)

$ErrorActionPreference = 'Stop'
$taskName = 'FeishuCodexBridge'

switch ($Action) {
    'install' {
        if (-not (Test-Path -LiteralPath $BridgeScript)) { throw "找不到桥接入口：$BridgeScript" }
        $node = (Get-Command node -ErrorAction Stop).Source

        $action = New-ScheduledTaskAction -Execute $node -Argument ('"{0}"' -f $BridgeScript) -WorkingDirectory $env:USERPROFILE
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
            -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) `
            -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
            -Description '飞书消息驱动的本机 Codex 桥接常驻进程' -Force | Out-Null

        "已注册计划任务 $taskName：登录自启，执行 $node $BridgeScript"
    }
    'uninstall' {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if (-not $task) { "计划任务 $taskName 本来就不存在"; return }
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        "已注销计划任务 $taskName"
    }
    'status' {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        # 这一行是机器读取的：保持纯 ASCII，避免父进程按代码页解码出乱码。
        if (-not $task) { "$taskName absent"; return }
        $info = Get-ScheduledTaskInfo -TaskName $taskName
        $lastRun = if ($info.LastRunTime) { $info.LastRunTime.ToString('s') } else { 'never' }
        "$taskName registered state=$($task.State) lastRun=$lastRun lastResult=$($info.LastTaskResult)"
    }
}
