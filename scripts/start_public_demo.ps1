[CmdletBinding()]
param(
    [switch]$Watch,
    [switch]$NoTunnel,
    [string]$Subdomain = ""
)

. (Join-Path $PSScriptRoot "public_demo_common.ps1")

function Wait-DockerDependencies {
    param([int]$TimeoutSeconds = 90)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $postgres_state = (& docker inspect --format '{{.State.Status}}' lifesteward-postgres 2>$null).Trim()
        $redis_state = (& docker inspect --format '{{.State.Status}}' lifesteward-redis 2>$null).Trim()
        # Existing team containers may predate this compose file and have no
        # Docker healthcheck metadata. Verify readiness inside each container.
        $postgres_ready = $false
        $redis_ready = $false
        if ($postgres_state -eq "running") {
            & docker exec lifesteward-postgres pg_isready -U postgres -d lifesteward 2>$null | Out-Null
            $postgres_ready = $LASTEXITCODE -eq 0
        }
        if ($redis_state -eq "running") {
            $redis_probe = (& docker exec lifesteward-redis redis-cli ping 2>$null).Trim()
            $redis_ready = $LASTEXITCODE -eq 0 -and $redis_probe -eq "PONG"
        }
        if ($postgres_ready -and $redis_ready) { return $true }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Ensure-DockerServices {
    $docker_info = & docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        $desktop = @(
            "C:\Program Files\Docker\Docker\Docker Desktop.exe",
            "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
        ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if ($desktop) { Start-Process -FilePath $desktop -WindowStyle Hidden | Out-Null }
        $deadline = (Get-Date).AddSeconds(120)
        do {
            Start-Sleep -Seconds 3
            & docker info 2>$null | Out-Null
        } while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $deadline)
        if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not ready." }
    }

    $postgres_exists = (& docker container inspect lifesteward-postgres 2>$null) -ne $null
    $redis_exists = (& docker container inspect lifesteward-redis 2>$null) -ne $null
    if ($postgres_exists) {
        $postgres_state = (& docker inspect --format '{{.State.Status}}' lifesteward-postgres 2>$null).Trim()
        if ($postgres_state -ne "running") { & docker start lifesteward-postgres 2>$null | Out-Null }
    }
    if ($redis_exists) {
        $redis_state = (& docker inspect --format '{{.State.Status}}' lifesteward-redis 2>$null).Trim()
        if ($redis_state -ne "running") { & docker start lifesteward-redis 2>$null | Out-Null }
    }

    # Only ask Compose to create services that do not already exist. This
    # reuses a team's pre-existing fixed-name containers and their data volumes.
    $missing_services = @()
    if (-not $postgres_exists) { $missing_services += "postgres" }
    if (-not $redis_exists) { $missing_services += "redis" }
    if ($missing_services.Count -gt 0) {
        & docker compose -p lifesteward -f $script:ComposeFile up -d $missing_services
        if ($LASTEXITCODE -ne 0) { throw "Docker Compose could not start the database services." }
    }
    if (-not (Wait-DockerDependencies)) { throw "PostgreSQL or Redis did not become healthy in time." }
}

function Apply-DatabaseMigrations {
    $python = Get-PythonExecutable
    Push-Location $script:BackendRoot
    try {
        & $python -u "scripts/run_migrations.py"
        if ($LASTEXITCODE -ne 0) { throw "Database migrations failed." }
    } finally {
        Pop-Location
    }
}

function Start-BackendProcess {
    $existing_pid = Get-ManagedPid -Name "backend"
    if ($existing_pid -and (Test-ProcessAlive -ProcessId $existing_pid)) {
        if ((Get-HttpStatus -Url "http://127.0.0.1:8000/health/live") -eq 200) {
            return $existing_pid
        }
        # A live PID is not sufficient when uvicorn is hung or its socket is
        # gone. Reclaim only the process tracked by this demo runner.
        Stop-ManagedProcess -Name "backend"
    }

    $live_status = Get-HttpStatus -Url "http://127.0.0.1:8000/health/live"
    if ($live_status -eq 200) { return $null }

    $python = Get-PythonExecutable
    $stdout = Join-Path $script:RuntimeRoot "backend.stdout.log"
    $stderr = Join-Path $script:RuntimeRoot "backend.stderr.log"
    $process = Start-Process -FilePath $python -ArgumentList @(
        "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"
    ) -WorkingDirectory $script:BackendRoot -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
    Set-ManagedPid -Name "backend" -ProcessId $process.Id
    return $process.Id
}

function Wait-BackendReady {
    param([int]$TimeoutSeconds = 45)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if ((Get-HttpStatus -Url "http://127.0.0.1:8000/health/live") -eq 200) {
            if ((Get-HttpStatus -Url "http://127.0.0.1:8000/health/ready") -eq 200) { return $true }
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Read-TunnelUrl {
    param(
        [Parameter(Mandatory = $true)][string]$StdoutPath,
        [Parameter(Mandatory = $true)][string]$StderrPath,
        [Parameter(Mandatory = $true)][datetime]$Deadline,
        [Parameter(Mandatory = $true)][int]$ProcessId,
        [Parameter(Mandatory = $true)][string]$Pattern
    )
    do {
        Start-Sleep -Seconds 2
        $text = ""
        if (Test-Path -LiteralPath $StdoutPath) { $text += Get-Content -LiteralPath $StdoutPath -Raw -ErrorAction SilentlyContinue }
        if (Test-Path -LiteralPath $StderrPath) { $text += Get-Content -LiteralPath $StderrPath -Raw -ErrorAction SilentlyContinue }
        $matches = [regex]::Matches($text, $Pattern)
        if ($matches.Count -gt 0) {
            return $matches[$matches.Count - 1].Value.TrimEnd('.')
        }
    } while ((Get-Date) -lt $Deadline -and (Test-ProcessAlive -ProcessId $ProcessId))
    return ""
}

function Get-CloudflaredExecutable {
    $configured_path = Get-DotEnvValue -Name "LIFESTEWARD_CLOUDFLARED_PATH"
    if ($configured_path -and (Test-Path -LiteralPath $configured_path -PathType Leaf)) {
        return (Resolve-Path -LiteralPath $configured_path).Path
    }

    $on_path = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
    if (-not $on_path) { $on_path = Get-Command cloudflared -ErrorAction SilentlyContinue }
    if ($on_path) { return $on_path.Source }

    Initialize-DemoRuntime
    $download_path = Join-Path $script:RuntimeRoot "cloudflared-windows-amd64.exe"
    if (-not (Test-Path -LiteralPath $download_path -PathType Leaf) -or ((Get-Item -LiteralPath $download_path).Length -lt 1000000)) {
        Remove-Item -LiteralPath $download_path -Force -ErrorAction SilentlyContinue
        $download_url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        try {
            $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
            if ($curl) {
                & $curl.Source --fail --location --silent --show-error --output $download_path $download_url 2>$null
            } else {
                Invoke-WebRequest -Uri $download_url -OutFile $download_path -UseBasicParsing -ErrorAction Stop
            }
        } catch {
            Remove-Item -LiteralPath $download_path -Force -ErrorAction SilentlyContinue
            return ""
        }
    }
    if ((Test-Path -LiteralPath $download_path -PathType Leaf) -and ((Get-Item -LiteralPath $download_path).Length -ge 1000000)) {
        return $download_path
    }
    return ""
}

function Start-CloudflareQuickTunnelProcess {
    Stop-ManagedProcess -Name "tunnel"
    $cloudflared = Get-CloudflaredExecutable
    if (-not $cloudflared) { return "" }

    $stdout = Join-Path $script:RuntimeRoot "cloudflare.stdout.log"
    $stderr = Join-Path $script:RuntimeRoot "cloudflare.stderr.log"
    Remove-Item -LiteralPath $stdout,$stderr -Force -ErrorAction SilentlyContinue
    $arguments = @(
        "tunnel",
        "--protocol", "http2",
        "--url", "http://127.0.0.1:8000",
        "--no-autoupdate"
    )
    try {
        $process = Start-Process -FilePath $cloudflared -ArgumentList $arguments -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
    } catch {
        return ""
    }
    Set-ManagedPid -Name "tunnel" -ProcessId $process.Id
    $url = Read-TunnelUrl -StdoutPath $stdout -StderrPath $stderr -Deadline (Get-Date).AddSeconds(45) -ProcessId $process.Id -Pattern "https://[A-Za-z0-9-]+\.trycloudflare\.com"
    if ($url) {
        Set-Content -LiteralPath (Join-Path $script:RuntimeRoot "public-url.txt") -Value $url -Encoding ascii
        return $url
    }
    Stop-ManagedProcess -Name "tunnel"
    return ""
}

function Start-LocalhostRunProcess {
    Stop-ManagedProcess -Name "tunnel"
    $ssh = Get-Command ssh.exe -ErrorAction SilentlyContinue
    if (-not $ssh) { return "" }

    $stdout = Join-Path $script:RuntimeRoot "localhost-run.stdout.log"
    $stderr = Join-Path $script:RuntimeRoot "localhost-run.stderr.log"
    Remove-Item -LiteralPath $stdout,$stderr -Force -ErrorAction SilentlyContinue
    $arguments = @(
        "-o", "StrictHostKeyChecking=no",
        "-o", "ServerAliveInterval=30",
        "-o", "ServerAliveCountMax=3",
        "-o", "ExitOnForwardFailure=yes",
        "-R", "80:127.0.0.1:8000",
        "nokey@localhost.run"
    )
    $process = Start-Process -FilePath $ssh.Source -ArgumentList $arguments -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
    Set-ManagedPid -Name "tunnel" -ProcessId $process.Id
    $url = Read-TunnelUrl -StdoutPath $stdout -StderrPath $stderr -Deadline (Get-Date).AddSeconds(35) -ProcessId $process.Id -Pattern "https://[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.lhr\.life"
    if ($url) {
        Set-Content -LiteralPath (Join-Path $script:RuntimeRoot "public-url.txt") -Value $url -Encoding ascii
        return $url
    }
    Stop-ManagedProcess -Name "tunnel"
    return ""
}

function Start-LocaltunnelProcess {
    param([string]$RequestedSubdomain)
    Stop-ManagedProcess -Name "tunnel"
    $npx = Get-NpxExecutable
    $stdout = Join-Path $script:RuntimeRoot "localtunnel.stdout.log"
    $stderr = Join-Path $script:RuntimeRoot "localtunnel.stderr.log"
    Remove-Item -LiteralPath $stdout,$stderr -Force -ErrorAction SilentlyContinue
    $arguments = @("--yes", "localtunnel", "--port", "8000", "--local-host", "127.0.0.1")
    if ($RequestedSubdomain) { $arguments += @("--subdomain", $RequestedSubdomain) }
    $process = Start-Process -FilePath $npx -ArgumentList $arguments -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
    Set-ManagedPid -Name "tunnel" -ProcessId $process.Id
    $url = Read-TunnelUrl -StdoutPath $stdout -StderrPath $stderr -Deadline (Get-Date).AddSeconds(45) -ProcessId $process.Id -Pattern "https://[A-Za-z0-9-]+\.loca\.lt"
    if ($url) {
        Set-Content -LiteralPath (Join-Path $script:RuntimeRoot "public-url.txt") -Value $url -Encoding ascii
        return $url
    }
    Stop-ManagedProcess -Name "tunnel"
    return ""
}

function Start-TunnelProcess {
    param([string]$RequestedSubdomain)
    # Cloudflare Quick Tunnel is the default because its HTTPS edge is more
    # stable for a phone demo. It still has a random hostname, so the runtime
    # address remains deliberately replaceable.
    $url = Start-CloudflareQuickTunnelProcess
    if ($url) { return $url }

    # SSH-based localhost.run is the first fallback when cloudflared cannot be
    # downloaded or started.
    $url = Start-LocalhostRunProcess
    if ($url) { return $url }
    return Start-LocaltunnelProcess -RequestedSubdomain $RequestedSubdomain
}

function Ensure-Tunnel {
    param([string]$RequestedSubdomain)
    $current = Get-PublicTunnelUrl
    $managed_tunnel_pid = Get-ManagedPid -Name "tunnel"
    if ($current -and $managed_tunnel_pid -and (Test-ProcessAlive -ProcessId $managed_tunnel_pid) -and (Test-PublicTunnelHealthy -Url $current)) { return $current }

    $url = Start-TunnelProcess -RequestedSubdomain $RequestedSubdomain
    if ($url) {
        Set-DemoEnvironment -TunnelOrigin $url
        # Quick Tunnel DNS/edge propagation can take longer than process
        # startup. Keep the process alive while the public health endpoint
        # becomes reachable instead of prematurely falling back.
        $deadline = (Get-Date).AddSeconds(90)
        do {
            if (Test-PublicTunnelHealthy -Url $url) { return $url }
            Start-Sleep -Seconds 2
        } while ((Get-Date) -lt $deadline)
        Stop-ManagedProcess -Name "tunnel"
        $url = ""
    }
    if (-not $url -and $RequestedSubdomain) {
        # A fixed free subdomain can be occupied or unhealthy; recover with a
        # random one and accept it only after its health endpoint responds.
        $url = Start-TunnelProcess -RequestedSubdomain ""
        if ($url) {
            Set-DemoEnvironment -TunnelOrigin $url
            $deadline = (Get-Date).AddSeconds(90)
            do {
                if (Test-PublicTunnelHealthy -Url $url) { return $url }
                Start-Sleep -Seconds 2
            } while ((Get-Date) -lt $deadline)
            Stop-ManagedProcess -Name "tunnel"
        }
    }
    return $url
}

function Invoke-DemoWatch {
    param(
        [string]$RequestedSubdomain,
        [switch]$NoTunnel
    )
    $stop_marker = Join-Path $script:RuntimeRoot "stop.requested"
    $tunnel_failure_cycles = 0
    while (-not (Test-Path -LiteralPath $stop_marker)) {
        Set-DemoEnvironment
        $live = Get-HttpStatus -Url "http://127.0.0.1:8000/health/live"
        if ($live -ne 200) {
            Start-BackendProcess | Out-Null
            $backend_ready = Wait-BackendReady -TimeoutSeconds 45
            if (-not $backend_ready) { Start-Sleep -Seconds 2 }
        }

        if (-not $NoTunnel) {
            $url = Get-PublicTunnelUrl
            if (-not $url) {
                $tunnel_failure_cycles = 0
                $url = Ensure-Tunnel -RequestedSubdomain $RequestedSubdomain
            } elseif (Test-PublicTunnelHealthy -Url $url) {
                $tunnel_failure_cycles = 0
            } else {
                $tunnel_failure_cycles += 1
                # Temporary tunnel providers can emit a short TLS/edge error.
                # Require several consecutive unhealthy cycles before changing
                # the address, so clients do not chase transient failures.
                if ($tunnel_failure_cycles -ge 3) {
                    $url = Ensure-Tunnel -RequestedSubdomain $RequestedSubdomain
                    $tunnel_failure_cycles = 0
                }
            }
        }
        Start-Sleep -Seconds 10
    }
}

Initialize-DemoRuntime
$requested_subdomain = $Subdomain.Trim()
if (-not $requested_subdomain) {
    $requested_subdomain = (Get-DotEnvValue -Name "LIFESTEWARD_TUNNEL_SUBDOMAIN").Trim()
}
if (-not $requested_subdomain) { $requested_subdomain = "all-cloths-hang" }
Set-DemoEnvironment

if ($Watch) {
    Invoke-DemoWatch -RequestedSubdomain $requested_subdomain -NoTunnel:$NoTunnel
    exit 0
}

# Stop stale watchers before clearing the marker; otherwise an older watcher
# can race the new provider selection and terminate the fresh tunnel.
Set-Content -LiteralPath (Join-Path $script:RuntimeRoot "stop.requested") -Value "1" -Encoding ascii
Stop-DemoWatchers
Stop-ManagedProcess -Name "watcher"
Start-Sleep -Milliseconds 750
Remove-Item -LiteralPath (Join-Path $script:RuntimeRoot "stop.requested") -Force -ErrorAction SilentlyContinue
Ensure-DockerServices
Apply-DatabaseMigrations
# Re-launch an existing project backend so the current tunnel CORS pattern is
# present in its process environment, rather than silently reusing yesterday's
# manually started process.
Stop-ExistingBackendForDemo
$backend_pid = Start-BackendProcess
if (-not (Wait-BackendReady)) {
    Write-Error "Backend did not become ready. Inspect .lifesteward-runtime/backend.stderr.log without sharing secrets."
    exit 1
}

$public_url = ""
if (-not $NoTunnel) {
    # A full runner start is an intentional provider refresh. Do not reuse a
    # healthy tunnel from an older runner version when Cloudflare is now the
    # preferred provider.
    Stop-ManagedProcess -Name "tunnel"
    Remove-Item -LiteralPath (Join-Path $script:RuntimeRoot "public-url.txt") -Force -ErrorAction SilentlyContinue
    $public_url = Ensure-Tunnel -RequestedSubdomain $requested_subdomain
}

$watch_arguments = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath,
    "-Watch", "-Subdomain", $requested_subdomain
)
if ($NoTunnel) { $watch_arguments += "-NoTunnel" }
$watcher = Start-Process -FilePath "powershell.exe" -ArgumentList $watch_arguments -WindowStyle Hidden -PassThru
Set-ManagedPid -Name "watcher" -ProcessId $watcher.Id

# The watcher can replace an unhealthy tunnel while this process is finishing
# startup. Read the shared file once more so the address printed to the user
# is the same address the mobile app should test.
Start-Sleep -Milliseconds 750
$reported_public_url = Get-PublicTunnelUrl
if ($reported_public_url) { $public_url = $reported_public_url }

Write-Output "LifeSteward local demo is ready."
Write-Output "Backend: http://127.0.0.1:8000"
if ($public_url) { Write-Output "Public HTTPS: $public_url" } else { Write-Output "Public HTTPS: unavailable; backend remains local." }
Write-Output "Runtime status: $script:RuntimeRoot"
Write-Output "The watcher will recover backend/tunnel process failures. Use scripts\check_public_demo.ps1 to inspect status."
