#!/bin/sh
DB_PATH="${1:-server/data/chessorganizers.db}"
BACKUP_DIR="${2:-backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp "$DB_PATH" "$BACKUP_DIR/chessorganizers_$TIMESTAMP.db"
echo "✓ Backup: $BACKUP_DIR/chessorganizers_$TIMESTAMP.db"
ls -t "$BACKUP_DIR"/chessorganizers_*.db | tail -n +31 | xargs -r rm
