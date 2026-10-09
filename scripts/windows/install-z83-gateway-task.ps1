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
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  $nodeCommand = Get-Command node -ErrorAction Stop
}
$node = $nodeCommand.Source
if (-not $node -or -not (Test-Path $node)) {
  throw "node.exe was not found on PATH. Install Node.js LTS, reopen PowerShell, then rerun this script."
}

Write-Host "Installing dependencies in $repoRoot"
Push-Location $repoRoot
& npm install
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

$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
& schtasks.exe /Create /TN $TaskName /TR $taskCommand /SC ONLOGON /F | Out-Host
$taskExit = $LASTEXITCODE

$startupDir = [Environment]::GetFolderPath("Startup")
$startupPath = Join-Path $startupDir "LaundroDesk Gateway.cmd"
Set-Content -Path $startupPath -Value "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"`r`n" -Encoding ASCII

if ($taskExit -eq 0) {
  Write-Host "Installed scheduled task: $TaskName" -ForegroundColor Green
} else {
  Write-Host "Scheduled task install failed with exit code $taskExit; installed Startup launcher instead." -ForegroundColor Yellow
}
Write-Host "Startup launcher: $startupPath" -ForegroundColor Green
Write-Host "Starting gateway task now..."
if ($taskExit -eq 0) {
  & schtasks.exe /Run /TN $TaskName | Out-Host
} else {
  Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$scriptPath`""
}
Write-Host "Check health with: Invoke-RestMethod http://localhost:$GatewayPort/health"
