[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot "public_demo_common.ps1")
Initialize-DemoRuntime

$backend_status = Get-HttpStatus -Url "http://127.0.0.1:8000/health/live"
$ready_status = Get-HttpStatus -Url "http://127.0.0.1:8000/health/ready"
$public_url = Get-PublicTunnelUrl
$public_status = if ($public_url) { Get-HttpStatus -Url "$public_url/health/live" } else { 0 }
$public_ready_status = if ($public_url) { Get-HttpStatus -Url "$public_url/health/ready" } else { 0 }

Write-Output "backend_live_status=$backend_status"
Write-Output "backend_ready_status=$ready_status"
Write-Output "public_url=$public_url"
Write-Output "public_live_status=$public_status"
Write-Output "public_ready_status=$public_ready_status"
foreach ($name in @("backend", "tunnel", "watcher")) {
    $process_id = Get-ManagedPid -Name $name
    Write-Output "$name`_pid=$process_id"
    Write-Output "$name`_running=$(Test-ProcessAlive -ProcessId $process_id)"
}

& docker ps --filter "name=lifesteward-postgres" --filter "name=lifesteward-redis" --format "container={{.Names}} status={{.Status}}"
