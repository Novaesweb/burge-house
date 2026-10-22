param(
  [string]$EvolutionKeyFile = (Join-Path $env:USERPROFILE 'NovaesWeb-WhatsApp-Bridge/.evolution-key')
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $EvolutionKeyFile)) { throw 'Arquivo privado da Evolution não encontrado. Informe EvolutionKeyFile.' }
$taskPreviousKeyFile = $env:EVOLUTION_KEY_FILE
try {
  $env:EVOLUTION_KEY_FILE = [IO.Path]::GetFullPath($EvolutionKeyFile)
  Push-Location -LiteralPath (Join-Path $PSScriptRoot '../..')
  try {
    & node --env-file-if-exists=.env --env-file-if-exists=.env.local backend/whatsapp/connectionServer.mjs
    if ($LASTEXITCODE -ne 0) { throw 'O serviço de conexão não iniciou. Confira a configuração local e a porta 3012.' }
  } finally { Pop-Location }
} finally { $env:EVOLUTION_KEY_FILE = $taskPreviousKeyFile }
