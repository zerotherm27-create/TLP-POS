# Installs LaundroDesk Gateway as a Windows scheduled task on the Z83.
# Run from the repo root in PowerShell.
#
# Example:
#   .\scripts\windows\install-z83-gateway-task.ps1 -ApiBase "https://desk.thelaundryproject.app" -GatewayApiToken "<token>"

param(
  [string] $TaskName = "LaundroDesk Gateway",
  [string] $GatewayId = "z83-local",
  [int] $GatewayPort = 8787,
  [Parameter(Mandatory = $true)]
  [string] $ApiBase,
  [Parameter(Mandatory = $true)]
  [string] $GatewayApiToken,
  [string] $EspActivationPath = "/commands/activate"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path ".").Path
$node = (Get-Command node -ErrorAction Stop).Source
$npm = (Get-Command npm -ErrorAction Stop).Source

Write-Host "Installing dependencies in $repoRoot"
Push-Location $repoRoot
npm install
Pop-Location

$command = @"
`$env:GATEWAY_ID = "$GatewayId"
`$env:GATEWAY_PORT = "$GatewayPort"
`$env:LAUNDRODESK_API_BASE = "$ApiBase"
`$env:GATEWAY_API_TOKEN = "$GatewayApiToken"
`$env:ESP_ACTIVATION_PATH = "$EspActivationPath"
Set-Location "$repoRoot"
& "$node" "apps/gateway/src/server.js"
"@

$scriptPath = Join-Path $repoRoot "scripts\windows\run-z83-gateway.generated.ps1"
Set-Content -Path $scriptPath -Value $command -Encoding UTF8

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host "Installed task: $TaskName" -ForegroundColor Green
Write-Host "Starting gateway task now..."
Start-ScheduledTask -TaskName $TaskName
Write-Host "Check health with: Invoke-RestMethod http://localhost:$GatewayPort/health"
