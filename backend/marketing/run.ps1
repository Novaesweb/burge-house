param([switch]$Check)
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
  if ($Check) { & node $workerFile --check } else { & node $workerFile }
  if ($LASTEXITCODE -ne 0) { throw 'Marketing interrompido. Verifique a configuração e o diário antes de reiniciar.' }
} finally {
  Remove-Item Env:EVOLUTION_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:MARKETING_WORKER_TOKEN -ErrorAction SilentlyContinue
}
