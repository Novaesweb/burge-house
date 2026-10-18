$ErrorActionPreference = 'Stop'
$taskDirectory = $PSScriptRoot
$taskMutex = New-Object System.Threading.Mutex($false, 'Local\NovaesWebBurgeHouseWhatsApp')
if (-not $taskMutex.WaitOne(0)) { exit 0 }
try {
  Set-Location -LiteralPath $taskDirectory
  while (-not (Test-Path -LiteralPath "$taskDirectory/paused.flag")) {
    $taskLog = Join-Path $taskDirectory 'worker.log'
    if ((Test-Path -LiteralPath $taskLog) -and (Get-Item -LiteralPath $taskLog).Length -gt 5242880) {
      Move-Item -LiteralPath $taskLog -Destination "$taskDirectory/worker.previous.log" -Force
    }
    ('START ' + [DateTime]::UtcNow.ToString('o')) | Out-File -LiteralPath $taskLog -Append -Encoding utf8
    # Node prints only fixed error codes and queue IDs. Never print environment values.
    $ErrorActionPreference = 'Continue'
    & 'C:/Program Files/nodejs/node.exe' "--env-file=$taskDirectory/.env" "$taskDirectory/worker.mjs" 2>&1 |
      Out-File -LiteralPath $taskLog -Append -Encoding utf8
    $ErrorActionPreference = 'Stop'
    Start-Sleep -Seconds 30
  }
} finally { $taskMutex.ReleaseMutex(); $taskMutex.Dispose() }
