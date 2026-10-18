param([switch]$Check,[switch]$Synchronize)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$privateEnv = Join-Path $PSScriptRoot '.env'
if (!(Test-Path -LiteralPath $privateEnv)) { throw 'Execute primeiro a preparação segura do marketing.' }
foreach ($line in Get-Content -LiteralPath $privateEnv) {
  if ($line -match '^([A-Z_]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
  }
}
if (!$env:EVOLUTION_KEY_FILE -or !(Test-Path -LiteralPath $env:EVOLUTION_KEY_FILE)) { throw 'Arquivo privado da Evolution não encontrado.' }
$env:EVOLUTION_API_KEY = (Get-Content -LiteralPath $env:EVOLUTION_KEY_FILE -Raw).Trim()
try {
  $workerFile = Join-Path $PSScriptRoot 'worker.mjs'
  if ($Check -and $Synchronize) { throw 'Escolha somente uma verificação por execução.' }
  if ($Check) { & node $workerFile --check } elseif ($Synchronize) { & node $workerFile --sync-only } else {
    # Keep the supervisor alive through temporary network/provider failures.
    # The Node worker preserves its claim journal; restarting never resets it.
    $PSNativeCommandUseErrorActionPreference = $false
    $logPath = Join-Path $PSScriptRoot 'worker.log'
    while ($true) {
      & node $workerFile 2>&1 | Tee-Object -FilePath $logPath -Append
      Write-Output ('Marketing interrompido em ' + (Get-Date).ToString('o') + '; nova tentativa em 30 segundos.') | Tee-Object -FilePath $logPath -Append
      Start-Sleep -Seconds 30
    }
  }
  if ($LASTEXITCODE -ne 0) { throw 'Marketing interrompido. Verifique a configuração e o diário antes de reiniciar.' }
} finally {
  Remove-Item Env:EVOLUTION_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:MARKETING_WORKER_TOKEN -ErrorAction SilentlyContinue
}
