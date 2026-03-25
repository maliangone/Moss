#!/bin/bash
# =============================================================================
# Moss AI Agent Platform — Session Cleanup
#
# Cleans up stale temporary session directories.
# Run as a cron job: 0 * * * * /app/scripts/cleanup-sessions.sh
#
# Default: removes temp sessions older than 24 hours.
# =============================================================================

set -euo pipefail

PERSISTENT_DIR="/persistent"
TEMP_DIR="${PERSISTENT_DIR}/temp"
MAX_AGE_HOURS="${1:-24}"

if [ ! -d "$TEMP_DIR" ]; then
    echo "[cleanup] No temp directory found. Nothing to clean."
    exit 0
fi

echo "[cleanup] Cleaning sessions older than ${MAX_AGE_HOURS} hours..."

count=0
find "$TEMP_DIR" -maxdepth 1 -type d -name "session-*" -mmin "+$((MAX_AGE_HOURS * 60))" | while read -r dir; do
    echo "[cleanup] Removing: $(basename "$dir")"
    rm -rf "$dir"
    count=$((count + 1))
done

echo "[cleanup] Done. Cleaned up old sessions."
