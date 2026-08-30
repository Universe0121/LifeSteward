# Shared helpers for the local Docker, backend, and temporary tunnel demo.

$script:ProjectRoot = Split-Path -Parent $PSScriptRoot
$script:BackendRoot = Join-Path $script:ProjectRoot "backend"
$script:ComposeFile = Join-Path $script:ProjectRoot "docker-compose.yml"
$script:RuntimeRoot = Join-Path $script:ProjectRoot ".lifesteward-runtime"

function Initialize-DemoRuntime {
    if (-not (Test-Path -LiteralPath $script:RuntimeRoot)) {
        New-Item -ItemType Directory -Path $script:RuntimeRoot -Force | Out-Null
    }
}

function Get-DotEnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Path = (Join-Path $script:BackendRoot ".env")
    )

    if (-not (Test-Path -LiteralPath $Path)) { return "" }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.*)$") {
            $value = $Matches[1].Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            return $value.Trim()
        }
    }
    return ""
}

function Set-DemoEnvironment {
    param([string]$TunnelOrigin = "")

    $dsn = Get-DotEnvValue -Name "POSTGRES_DSN"
    if ($dsn -match "^[^:]+://[^:]+:([^@]+)@") {
        try {
            $env:LIFESTEWARD_POSTGRES_PASSWORD = [Uri]::UnescapeDataString($Matches[1])
        } catch {
            $env:LIFESTEWARD_POSTGRES_PASSWORD = $Matches[1]
        }
    }

    $configured_origins = Get-DotEnvValue -Name "LIFESTEWARD_CORS_ORIGINS"
    if ($configured_origins) {
        $env:LIFESTEWARD_CORS_ORIGINS = $configured_origins
    }
    if ($TunnelOrigin) {
        $existing = @($env:LIFESTEWARD_CORS_ORIGINS -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        if ($TunnelOrigin -notin $existing) { $existing += $TunnelOrigin }
        $env:LIFESTEWARD_CORS_ORIGINS = $existing -join ','
    }

    # This regex is deliberately limited to the HTTPS hostnames emitted by
    # the supported temporary tunnel providers. It is only enabled by this
    # local demo runner, never by the application default and never with an
    # unrestricted wildcard origin.
    $env:LIFESTEWARD_CORS_ORIGIN_REGEX = 'https?://(localhost|127\.0\.0\.1)(:\d+)?$|https://[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:trycloudflare\.com|loca\.lt|lhr\.life)$'
}

function Get-ManagedPid {
    param([Parameter(Mandatory = $true)][string]$Name)
    $path = Join-Path $script:RuntimeRoot "$Name.pid"
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    $raw = (Get-Content -LiteralPath $path -Raw).Trim()
    $process_id = 0
    if ([int]::TryParse($raw, [ref]$process_id) -and $process_id -gt 0) { return $process_id }
    return $null
}

function Set-ManagedPid {
    param([Parameter(Mandatory = $true)][string]$Name, [Parameter(Mandatory = $true)][int]$ProcessId)
    Set-Content -LiteralPath (Join-Path $script:RuntimeRoot "$Name.pid") -Value ([string]$ProcessId) -Encoding ascii
}

function Remove-ManagedPid {
    param([Parameter(Mandatory = $true)][string]$Name)
    Remove-Item -LiteralPath (Join-Path $script:RuntimeRoot "$Name.pid") -Force -ErrorAction SilentlyContinue
}

function Test-ProcessAlive {
    param([int]$ProcessId)
    if (-not $ProcessId) { return $false }
    return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Stop-ManagedProcess {
    param([Parameter(Mandatory = $true)][string]$Name)
    $process_id = Get-ManagedPid -Name $Name
    if ($process_id -and (Test-ProcessAlive -ProcessId $process_id)) {
        # The PID comes only from our runtime file; terminate its child tree.
        & taskkill.exe /PID $process_id /T /F *> $null
    }
    Remove-ManagedPid -Name $Name
}

function Stop-DemoWatchers {
    # A previous runner version could leave an untracked watcher behind. Only
    # terminate PowerShell processes whose command line names this exact demo
    # script and its watch mode; unrelated PowerShell sessions are untouched.
    $watchers = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.ProcessId -ne $PID -and
            $_.CommandLine -match 'start_public_demo\.ps1' -and
            $_.CommandLine -match '\-Watch'
        })
    foreach ($watcher in $watchers) {
        & taskkill.exe /PID ([int]$watcher.ProcessId) /T /F *> $null
    }
}

function Get-PythonExecutable {
    $command = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $command) { $command = Get-Command python -ErrorAction SilentlyContinue }
    if (-not $command) { throw "Python was not found in PATH." }
    return $command.Source
}

function Get-NpxExecutable {
    $command = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $command) { $command = Get-Command npx -ErrorAction SilentlyContinue }
    if (-not $command) { throw "npx was not found in PATH. Install Node.js LTS first." }
    return $command.Source
}

function Get-HttpStatus {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 15
    )
    # PowerShell's Schannel client can reject the TLS renegotiation used by
    # localhost.run even when browsers and Android clients receive 200. Use
    # the Windows curl client for HTTPS probes so the watcher measures the
    # tunnel itself instead of a PowerShell-specific TLS quirk.
    if ($Url -match '^https://') {
        $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
        if ($curl) {
            $raw_status = (& $curl.Source --silent --show-error --output NUL --write-out '%{http_code}' --max-time $TimeoutSeconds $Url 2>$null)
            $status_text = ($raw_status -join '').Trim()
            $status = 0
            if ([int]::TryParse($status_text, [ref]$status)) { return $status }
        }
    }
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds -MaximumRedirection 0 -ErrorAction Stop
        return [int]$response.StatusCode
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            return [int]$_.Exception.Response.StatusCode
        }
        return 0
    }
}

function Test-HttpOk {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 15
    )
    $status = Get-HttpStatus -Url $Url -TimeoutSeconds $TimeoutSeconds
    return $status -ge 200 -and $status -lt 300
}

function Test-PublicTunnelHealthy {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$Attempts = 4
    )
    $safe_attempts = [Math]::Max(1, $Attempts)
    for ($attempt = 1; $attempt -le $safe_attempts; $attempt += 1) {
        if (Test-HttpOk -Url "$Url/health/live" -TimeoutSeconds 15) { return $true }
        if ($attempt -lt $safe_attempts) { Start-Sleep -Seconds 1 }
    }
    return $false
}

function Get-ListeningProcessId {
    param([Parameter(Mandatory = $true)][int]$Port)
    try {
        $connection = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop |
            Select-Object -First 1
        if ($connection) { return [int]$connection.OwningProcess }
    } catch {
        # Older Windows builds may not have the NetTCPIP cmdlets installed.
    }
    return $null
}

function Stop-ExistingBackendForDemo {
    # A backend started manually before this script has no PID file and would
    # retain its old CORS environment. Reclaim it only when it is recognizably
    # this project's uvicorn process; never kill an unrelated port owner.
    $process_id = Get-ListeningProcessId -Port 8000
    if (-not $process_id) { return }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$process_id" -ErrorAction SilentlyContinue
    $command_line = [string]$process.CommandLine
    if ($command_line -notmatch "uvicorn\s+main:app" -and $command_line -notmatch "backend") {
        throw "Port 8000 is already used by another process. Stop it manually before starting the LifeSteward demo."
    }
    & taskkill.exe /PID $process_id /T /F *> $null
    Start-Sleep -Milliseconds 500
}

function Get-PublicTunnelUrl {
    $path = Join-Path $script:RuntimeRoot "public-url.txt"
    if (-not (Test-Path -LiteralPath $path)) { return "" }
    return (Get-Content -LiteralPath $path -Raw).Trim()
}
