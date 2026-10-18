param(
 [Parameter(Mandatory)][ValidatePattern('^https://mabkzkawziqlmgfikwmh\.supabase\.co$')][string]$SupabaseUrl,
 [Parameter(Mandatory)][ValidatePattern('^sb_publishable_[A-Za-z0-9_-]+$')][string]$PublishableKey,
 [Parameter(Mandatory)][ValidatePattern('^55[0-9]{10,11}$')][string]$WhatsAppPhone,
 [string]$EvolutionKeyFile = 'C:/Users/camil/NovaesWeb-WhatsApp-Bridge/.evolution-key',
 [ValidatePattern('^[\w-]+$')][string]$Instance = 'novaesweb_teste',
 [string]$ServiceDirectory = (Join-Path $env:USERPROFILE 'Documents/Codex/Services/BurgeHouseMarketing')
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$storeId = 'e2ba2dff-0b92-497d-9b08-926c235c2934'
if (!(Test-Path -LiteralPath $EvolutionKeyFile)) { throw 'A chave privada da Evolution precisa existir em arquivo protegido.' }
$resolvedService = [IO.Path]::GetFullPath($ServiceDirectory)
if (Test-Path -LiteralPath $resolvedService) { throw 'Pasta já existe. Preserve o token e o diário existentes; não reinstale por cima.' }
# Read-only check. No message is sent, no instance is created or disconnected.
$apiKey = (Get-Content -LiteralPath $EvolutionKeyFile -Raw).Trim()
try {
 $instances = Invoke-RestMethod -Uri ('http://127.0.0.1:8080/instance/fetchInstances?instanceName=' + $Instance) -Headers @{apikey=$apiKey} -TimeoutSec 10
 $matching = @($instances | Where-Object { $_.name -eq $Instance -and $_.connectionStatus -eq 'open' -and $_.ownerJid -eq ($WhatsAppPhone + '@s.whatsapp.net') })
 if ($matching.Count -ne 1) { throw 'A conexão não corresponde ao telefone informado para esta loja.' }
} finally { $apiKey=$null; $instances=$null }
New-Item -ItemType Directory -Path $resolvedService | Out-Null
# Fail closed: ACL is established before any secret is written.
$acl = Get-Acl -LiteralPath $resolvedService
$acl.SetAccessRuleProtection($true,$false)
foreach ($rule in @($acl.Access)) { $acl.RemoveAccessRuleSpecific($rule) }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$rights = [Security.AccessControl.FileSystemRights]::FullControl
$inherit = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
$propagation = [Security.AccessControl.PropagationFlags]::None
$allow = [Security.AccessControl.AccessControlType]::Allow
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,$rights,$inherit,$propagation,$allow))
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-18'),$rights,$inherit,$propagation,$allow))
Set-Acl -LiteralPath $resolvedService -AclObject $acl
$marketingDir = New-Item -ItemType Directory -Path (Join-Path $resolvedService 'backend/marketing') -Force
$statusDir = New-Item -ItemType Directory -Path (Join-Path $resolvedService 'backend/whatsapp') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'worker.mjs'),(Join-Path $PSScriptRoot 'run.ps1') -Destination $marketingDir.FullName
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../whatsapp/worker.mjs') -Destination $statusDir.FullName
$token = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
$hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($token))).ToLowerInvariant()
$configuration = @(
 "SUPABASE_URL=$SupabaseUrl", "SUPABASE_PUBLISHABLE_KEY=$PublishableKey", "MARKETING_STORE_ID=$storeId",
 "MARKETING_WORKER_TOKEN=$token", 'EVOLUTION_URL=http://127.0.0.1:8080', "EVOLUTION_INSTANCE=$Instance",
 "EVOLUTION_KEY_FILE=$EvolutionKeyFile", 'MARKETING_SEND_ENABLED=false', 'MARKETING_ACTIVATION_CONFIRMED='
)
Set-Content -LiteralPath (Join-Path $marketingDir.FullName '.env') -Value $configuration -Encoding utf8
# This file contains a one-way hash, never the worker token or Evolution key.
$provision = @"
-- Review and apply only after approval, following the marketing migration.
-- Only Burger House. Sending remains disabled.
insert into marketing_private.settings(store_id,worker_hash,whatsapp_phone,enabled,consent_enabled)
select '$storeId'::uuid,'$hash','$WhatsAppPhone',false,true
where exists(select 1 from public.managed_sites where id='$storeId'::uuid and status='active');
"@
Set-Content -LiteralPath (Join-Path $resolvedService 'provision-after-approval.sql') -Value $provision -Encoding utf8
$token=$null; $configuration=$null
Write-Output 'Preparação local concluída. Nada aplicado no Supabase; nenhum serviço iniciado; envio permanece bloqueado.'
Write-Output ('Pasta protegida: ' + $resolvedService)
