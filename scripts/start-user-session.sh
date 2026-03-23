#!/bin/bash
# =============================================================================
# Moss AI Agent Platform — User Session Launcher
#
# Called by CloudCLI (or a wrapper) when a user starts a session.
# Sets up per-user isolation: HOME redirect, session ID, workspace.
#
# Usage: start-user-session.sh <username> [session_id]
# =============================================================================

set -euo pipefail

PERSISTENT_DIR="/persistent"
SCRIPTS_DIR="/app/scripts"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <username> [session_id]"
    exit 1
fi

USERNAME="$1"
SESSION_ID="${2:-${USERNAME}-$(date +%Y%m%d%H%M%S)}"

# Validate username
if ! [[ "$USERNAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: Invalid username"
    exit 1
fi

USER_DIR="${PERSISTENT_DIR}/users/${USERNAME}"

# ===== Auto-provision user if first login =====
if [ ! -d "$USER_DIR" ]; then
    echo "[session] First login for '${USERNAME}'. Creating workspace..."
    bash "${SCRIPTS_DIR}/create-user.sh" "$USERNAME" "general"
fi

# ===== Set HOME to user's persistent directory =====
# This is the key isolation mechanism:
# Claude Code's ~/.claude/ resolves to /persistent/users/{username}/.claude/
export HOME="${USER_DIR}"

# ===== Create session work directory =====
WORK_DIR="${PERSISTENT_DIR}/temp/session-${SESSION_ID}"
mkdir -p "${WORK_DIR}"

# ===== Link global CLAUDE.md into workspace (if not already there) =====
GLOBAL_CLAUDE_MD="${PERSISTENT_DIR}/shared/CLAUDE.md"
if [ -f "$GLOBAL_CLAUDE_MD" ] && [ ! -f "${WORK_DIR}/CLAUDE.md" ]; then
    cp "$GLOBAL_CLAUDE_MD" "${WORK_DIR}/CLAUDE.md"
fi

# ===== Ensure Claude Code settings are in place =====
GLOBAL_SETTINGS="${PERSISTENT_DIR}/shared/.claude/settings.json"
USER_SETTINGS="${HOME}/.claude/settings.json"
if [ -f "$GLOBAL_SETTINGS" ] && [ ! -f "$USER_SETTINGS" ]; then
    mkdir -p "${HOME}/.claude"
    cp "$GLOBAL_SETTINGS" "$USER_SETTINGS"
fi

echo "[session] Starting session for '${USERNAME}'"
echo "[session] HOME=${HOME}"
echo "[session] Session ID: ${SESSION_ID}"
echo "[session] Work dir: ${WORK_DIR}"

# ===== Launch Claude Code =====
exec claude \
    --session-id "${SESSION_ID}" \
    --cwd "${WORK_DIR}" \
    "$@"
