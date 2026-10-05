# Controlled live ESP activation test. Use only with the owner physically present
# at an empty machine and with a clear stop/power-off plan.
#
# Example:
#   .\test-z83-esp-activate.ps1 -MachineName "Washer 1" -MachineKind washer -EspIp 192.168.210.6 -ProductId wash-35 -ProductName "Wash 35 min" -Pulse 1 -PushDelayMs 500 -DurationMinutes 35

param(
  [Parameter(Mandatory = $true)]
  [string] $MachineName,
  [Parameter(Mandatory = $true)]
  [ValidateSet("washer", "dryer")]
  [string] $MachineKind,
  [Parameter(Mandatory = $true)]
  [string] $EspIp,
  [Parameter(Mandatory = $true)]
  [string] $ProductId,
  [Parameter(Mandatory = $true)]
  [string] $ProductName,
  [Parameter(Mandatory = $true)]
  [int] $Pulse,
  [Parameter(Mandatory = $true)]
  [int] $PushDelayMs,
  [Parameter(Mandatory = $true)]
  [int] $DurationMinutes,
  [int] $GatewayPort = 8787
)

$ErrorActionPreference = "Stop"

Write-Host "LIVE MACHINE TEST" -ForegroundColor Yellow
Write-Host "Machine: $MachineName ($MachineKind) $EspIp"
Write-Host "Product: $ProductName pulse=$Pulse pushDelayMs=$PushDelayMs"
Write-Host ""
$confirmation = Read-Host "Type ACTIVATE to send this command"
if ($confirmation -ne "ACTIVATE") {
  Write-Host "Cancelled. No command sent." -ForegroundColor Green
  exit 0
}

$body = @{
  commandId = "manual-z83-test-$(Get-Date -Format yyyyMMddHHmmss)"
  machine = @{
    id = $MachineName.ToLower().Replace(" ", "-")
    name = $MachineName
    espIp = $EspIp
    kind = $MachineKind
  }
  product = @{
    id = $ProductId
    name = $ProductName
    pulse = $Pulse
    pushDelayMs = $PushDelayMs
    durationMinutes = $DurationMinutes
  }
  mode = "real"
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri "http://localhost:$GatewayPort/commands/activate" -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 8
