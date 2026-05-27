param(
  [string]$DbPath = "server/data/chessorganizers.db",
  [string]$BackupDir = "backups",
  [switch]$Docker
)

if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force }
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "chessorganizers_$timestamp.db"

if ($Docker.IsPresent) {
  $container = docker compose ps -q app 2>$null
  if (-not $container) { Write-Error "Container not running"; exit 1 }
  docker cp "${container}:/data/chessorganizers.db" $backupFile
  Write-Host "✓ Backup (Docker): $backupFile"
} else {
  if (-not (Test-Path $DbPath)) { Write-Error "DB not found: $DbPath"; exit 1 }
  Copy-Item $DbPath $backupFile
  Write-Host "✓ Backup: $backupFile"
}

Get-ChildItem $BackupDir -Filter "chessorganizers_*.db" | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item
