# Remote-safe bootstrap for installing the LaundroDesk Gateway on the Z83.
# It prompts for the gateway token so the token never needs to be typed into a command line.

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function ConvertFrom-SecureStringPlainText {
  param(
    [Parameter(Mandatory = $true)]
    [securestring] $SecureString
  )

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$repoRoot = "C:\LaundroDesk"
$repoUrl = "https://github.com/zerotherm27-create/TLP-POS.git"
$apiBase = "https://desk.thelaundryproject.app"
$gatewayId = "z83-local"

Write-Host "== LaundroDesk Z83 gateway installer ==" -ForegroundColor Cyan
$secureToken = Read-Host -AsSecureString "Gateway token"
$gatewayToken = ConvertFrom-SecureStringPlainText -SecureString $secureToken

try {
  if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
    throw "Git is not installed or is not on PATH."
  }

  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    throw "Node.js is not installed or is not on PATH."
  }

  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm is not installed or is not on PATH."
  }

  if (Test-Path (Join-Path $repoRoot ".git")) {
    Set-Location $repoRoot
    git fetch origin main
    git reset --hard origin/main
  } else {
    if (Test-Path $repoRoot) {
      $backup = "$repoRoot.backup.$(Get-Date -Format yyyyMMddHHmmss)"
      Rename-Item $repoRoot $backup
      Write-Host "Moved old folder to $backup"
    }

    git clone $repoUrl $repoRoot
    Set-Location $repoRoot
  }

  .\scripts\windows\install-z83-gateway-task.ps1 `
    -ApiBase $apiBase `
    -GatewayApiToken $gatewayToken `
    -GatewayId $gatewayId

  Start-Sleep -Seconds 5
  Clear-Host

  Write-Host "=== LOCAL GATEWAY HEALTH ===" -ForegroundColor Cyan
  Invoke-RestMethod "http://localhost:8787/health" | ConvertTo-Json -Depth 8

  Write-Host "=== CLOUD POLL CHECK ===" -ForegroundColor Cyan
  try {
    Invoke-RestMethod `
      -Method Post `
      -Uri "$apiBase/api/gateway/commands/next" `
      -Headers @{ Authorization = "Bearer $gatewayToken"; "x-gateway-id" = $gatewayId } |
      ConvertTo-Json -Depth 8
  } catch {
    Write-Host "Cloud poll failed; Supabase migration is likely still pending." -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
  }
} finally {
  $gatewayToken = $null
  if ($secureToken) {
    $secureToken.Dispose()
  }
}
