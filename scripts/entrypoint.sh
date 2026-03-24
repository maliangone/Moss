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

# ----- Step 5: Fix permissions and initialize Claude Code data -----
echo "[init] Setting ownership on persistent directories..."
chown -R agent:agent /persistent 2>/dev/null || true
chown -R agent:agent /home/agent 2>/dev/null || true

# Initialize .claude directory structure (volume may be empty on first boot)
mkdir -p /home/agent/.claude/skills
mkdir -p /home/agent/.claude/projects
chown -R agent:agent /home/agent/.claude

# Deploy Claude Code settings into the persistent .claude directory
if [ ! -f /home/agent/.claude/settings.json ] && [ -f "${CONFIG_SRC}/settings.json" ]; then
    cp "${CONFIG_SRC}/settings.json" /home/agent/.claude/settings.json
    echo "[init] Installed Claude Code settings.json to ~/.claude/"
fi

# ----- Step 5b: Pre-seed CloudCLI admin account (skip onboarding wizard) -----
# DB lives inside the cloudcli-data volume (/app/cloudcli/data) for persistence
CLOUDCLI_DB_DIR="/app/cloudcli/data"
CLOUDCLI_DB="${CLOUDCLI_DB_DIR}/auth.db"
mkdir -p "${CLOUDCLI_DB_DIR}"

if [ ! -f "${CLOUDCLI_DB}" ]; then
    echo "[init] Creating CloudCLI database and admin account..."
    ADMIN_USER="${CLOUDCLI_ADMIN_USER:-admin}"
    ADMIN_PASS="${CLOUDCLI_ADMIN_PASS:-moss2026}"
    # Hash the password using Node.js bcrypt (from CloudCLI's node_modules)
    PASS_HASH=$(NODE_PATH=/app/cloudcli/node_modules node -e "const bcrypt=require('bcrypt');bcrypt.hash('${ADMIN_PASS}',12).then(h=>console.log(h))")
    # Initialize DB schema
    sqlite3 "${CLOUDCLI_DB}" < /app/cloudcli/server/database/init.sql
    # Insert admin user with onboarding completed
    sqlite3 "${CLOUDCLI_DB}" "INSERT INTO users (username, password_hash, git_name, git_email, has_completed_onboarding) VALUES ('${ADMIN_USER}', '${PASS_HASH}', 'Moss Admin', 'admin@moss.local', 1);"
    echo "[init] Admin account created (user: ${ADMIN_USER})"
    echo "[init] Onboarding wizard: skipped"
else
    echo "[init] CloudCLI database already exists, skipping account setup"
fi
chown -R agent:agent "${CLOUDCLI_DB_DIR}"

# ----- Step 5c: Install Moss plugins into CloudCLI plugin directory -----
CLOUDCLI_PLUGINS_DIR="/home/agent/.claude-code-ui/plugins"
mkdir -p "${CLOUDCLI_PLUGINS_DIR}"
for plugin_dir in /app/cloudcli/plugins/moss-*/; do
    plugin_name="$(basename "$plugin_dir")"
    target="${CLOUDCLI_PLUGINS_DIR}/${plugin_name}"
    if [ ! -d "$target" ]; then
        cp -r "$plugin_dir" "$target"
        echo "[init] Installed plugin: ${plugin_name}"
    fi
done
chown -R agent:agent /home/agent/.claude-code-ui

# ----- Step 6: Schedule session cleanup (runs hourly in background) -----
if command -v find &> /dev/null; then
    echo "[init] Starting session cleanup background job (hourly)..."
    (while true; do sleep 3600; bash /app/scripts/cleanup-sessions.sh 24 2>/dev/null; done) &
fi

# ----- Step 7: Start CloudCLI Server (drop privileges) -----
echo "[init] Starting CloudCLI web server as 'agent' user..."
echo "============================================"

# Drop from root to agent user using gosu, then exec CloudCLI
# This ensures the CloudCLI process (and all Claude Code CLI children)
# run as non-root, while iptables rules set above persist.
cd /app/cloudcli

exec gosu agent node server/index.js
