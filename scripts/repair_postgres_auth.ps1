$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot "..\backend\.env"
$dsnLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^POSTGRES_DSN=' } | Select-Object -First 1
if (-not $dsnLine) { throw "POSTGRES_DSN was not found in backend/.env" }

$dsn = $dsnLine.Substring(13)
$uri = [Uri]$dsn
$userInfo = $uri.UserInfo.Split(':', 2)
if ($userInfo.Count -ne 2) { throw "POSTGRES_DSN must include a username and password" }
$dbUser = [Uri]::UnescapeDataString($userInfo[0])
$dbPassword = [Uri]::UnescapeDataString($userInfo[1])
$dbName = $uri.AbsolutePath.TrimStart('/')
$dbPort = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }

Write-Host "Updating PostgreSQL password in lifesteward-postgres..."
$escapedPassword = $dbPassword.Replace("'", "''")
$sql = "ALTER USER `"$dbUser`" WITH PASSWORD '$escapedPassword';"
docker exec -u postgres lifesteward-postgres psql -d $dbName -c $sql
if ($LASTEXITCODE -ne 0) { throw "Could not update the PostgreSQL password." }

Write-Host "Testing host authentication on port $dbPort..."
$env:PGPASSWORD = $dbPassword
docker run --rm -e "PGPASSWORD=$dbPassword" pgvector/pgvector:pg16 `
  psql -h host.docker.internal -p $dbPort -U $dbUser -d $dbName -c "SELECT 1;"
if ($LASTEXITCODE -ne 0) { throw "Password update completed, but host authentication test failed." }

Write-Host "PostgreSQL authentication repaired. Refresh the weekly report page."
