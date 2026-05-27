param(
  [string]$BackupFile,
  [string]$DbPath = "server/data/chessorganizers.db"
)

if (-not $BackupFile) { Write-Error "Usage: .\restore.ps1 -BackupFile backups\chessorganizers_20250101_120000.db"; exit 1 }
if (-not (Test-Path $BackupFile)) { Write-Error "Backup not found: $BackupFile"; exit 1 }

$confirm = Read-Host "Restore $BackupFile -> $DbPath ? (y/N)"
if ($confirm -ne 'y') { Write-Host "Cancelled"; exit }

Copy-Item $BackupFile $DbPath -Force
Write-Host "✓ Restored: $DbPath"
