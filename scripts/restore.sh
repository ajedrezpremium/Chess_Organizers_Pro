#!/bin/sh
BACKUP_FILE="$1"
DB_PATH="${2:-server/data/chessorganizers.db}"
if [ -z "$BACKUP_FILE" ]; then echo "Usage: $0 <backup-file> [db-path]"; exit 1; fi
if [ ! -f "$BACKUP_FILE" ]; then echo "Not found: $BACKUP_FILE"; exit 1; fi
echo "Restore $BACKUP_FILE -> $DB_PATH ? (y/N)"
read -r confirm
[ "$confirm" != "y" ] && echo "Cancelled" && exit
cp "$BACKUP_FILE" "$DB_PATH"
echo "✓ Restored: $DB_PATH"
