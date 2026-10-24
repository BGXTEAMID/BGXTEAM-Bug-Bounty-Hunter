#!/bin/sh
set -eu
DEST=${1:-"bgxteam-backup-$(date +%Y%m%d-%H%M%S).tar.gz"}
# Archive only app data; do not include .env or source-control secrets.
tar -czf "$DEST" data reports 2>/dev/null || { echo 'No data/reports yet or backup failed.' >&2; exit 1; }
chmod 600 "$DEST"
echo "Backup created: $DEST"
