#!/bin/bash
# =============================================================================
# Moss AI Agent Platform — Container Entrypoint
#
# This script runs at container startup and:
# 1. Sets up the outbound firewall (requires NET_ADMIN, then drops it)
# 2. Initializes persistent directory structure
# 3. Copies default configs if not already present
# 4. Starts the CloudCLI web server
# =============================================================================

set -euo pipefail

PERSISTENT_DIR="/persistent"
SHARED_DIR="${PERSISTENT_DIR}/shared"
CONFIG_SRC="/app/config"
SCRIPTS_DIR="/app/scripts"

echo "============================================"
echo "  Moss AI Agent Platform"
echo "  Starting up..."
echo "============================================"

# ----- Step 1: Firewall Setup -----
echo "[init] Setting up outbound firewall..."
if [ -f "${SCRIPTS_DIR}/init-firewall.sh" ]; then
    bash "${SCRIPTS_DIR}/init-firewall.sh" || echo "[init] WARNING: Firewall setup failed. Continuing without firewall."
fi

# ----- Step 2: Initialize Persistent Storage -----
echo "[init] Initializing persistent storage..."

# Shared directories
mkdir -p "${SHARED_DIR}/.claude/skills"
mkdir -p "${SHARED_DIR}/config"
mkdir -p "${PERSISTENT_DIR}/users"
mkdir -p "${PERSISTENT_DIR}/temp"

# ----- Step 3: Copy Default Configs (if not already present) -----
echo "[init] Checking configuration files..."

# Global CLAUDE.md
if [ ! -f "${SHARED_DIR}/CLAUDE.md" ] && [ -f "${CONFIG_SRC}/CLAUDE.md" ]; then
    cp "${CONFIG_SRC}/CLAUDE.md" "${SHARED_DIR}/CLAUDE.md"
    echo "[init] Installed global CLAUDE.md"
fi

# Claude Code settings.json (permission lockdown)
if [ ! -f "${SHARED_DIR}/.claude/settings.json" ] && [ -f "${CONFIG_SRC}/settings.json" ]; then
    cp "${CONFIG_SRC}/settings.json" "${SHARED_DIR}/.claude/settings.json"
    echo "[init] Installed Claude Code settings.json (permission lockdown)"
fi

# Toolbox config
if [ ! -f "${SHARED_DIR}/config/toolbox-config.yaml" ] && [ -f "${CONFIG_SRC}/toolbox-config.yaml" ]; then
    cp "${CONFIG_SRC}/toolbox-config.yaml" "${SHARED_DIR}/config/toolbox-config.yaml"
    echo "[init] Installed toolbox-config.yaml"
fi

# Skill creation policy
if [ ! -f "${SHARED_DIR}/config/skill-policy.yaml" ] && [ -f "${CONFIG_SRC}/skill-policy.yaml" ]; then
    cp "${CONFIG_SRC}/skill-policy.yaml" "${SHARED_DIR}/config/skill-policy.yaml"
    echo "[init] Installed skill-policy.yaml"
fi

# ----- Step 4: Verify Environment -----
echo "[init] Verifying environment..."

# Check Claude Code CLI
if command -v claude &> /dev/null; then
    echo "[init] Claude Code CLI: $(claude --version 2>/dev/null || echo 'installed')"
else
    echo "[init] WARNING: Claude Code CLI not found in PATH"
fi

# Check Python
if command -v python3 &> /dev/null; then
    echo "[init] Python: $(python3 --version)"
else
    echo "[init] WARNING: Python not found"
fi

# Check Node.js
if command -v node &> /dev/null; then
    echo "[init] Node.js: $(node --version)"
else
    echo "[init] WARNING: Node.js not found"
fi

# Check API key (existence only, never print value)
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    echo "[init] API Key: configured (${#ANTHROPIC_API_KEY} chars)"
else
    echo "[init] WARNING: ANTHROPIC_API_KEY not set. Claude Code will not function."
fi

if [ -n "${ANTHROPIC_BASE_URL:-}" ]; then
    echo "[init] API Base URL: ${ANTHROPIC_BASE_URL}"
fi

# ----- Step 5: Start CloudCLI Server -----
echo "[init] Starting CloudCLI web server..."
echo "============================================"

# Graceful shutdown handler
cleanup() {
    echo ""
    echo "[shutdown] Received shutdown signal. Cleaning up..."
    # Kill child processes
    kill -- -$$ 2>/dev/null || true
    echo "[shutdown] Goodbye."
    exit 0
}
trap cleanup SIGTERM SIGINT SIGQUIT

# Start CloudCLI
# The server serves the React frontend and manages Claude Code CLI via PTY
cd /app/cloudcli

exec node server.js
