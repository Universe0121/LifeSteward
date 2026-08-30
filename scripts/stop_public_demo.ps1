[CmdletBinding()]
param([switch]$StopDocker)

. (Join-Path $PSScriptRoot "public_demo_common.ps1")
Initialize-DemoRuntime
Set-Content -LiteralPath (Join-Path $script:RuntimeRoot "stop.requested") -Value "1" -Encoding ascii
Stop-DemoWatchers
Stop-ManagedProcess -Name "watcher"
Stop-ManagedProcess -Name "tunnel"
Stop-ManagedProcess -Name "backend"
Remove-Item -LiteralPath (Join-Path $script:RuntimeRoot "public-url.txt") -Force -ErrorAction SilentlyContinue

if ($StopDocker) {
    & docker compose -p lifesteward -f $script:ComposeFile stop
}

Write-Output "LifeSteward demo processes stopped. PostgreSQL/Redis volumes were preserved."
