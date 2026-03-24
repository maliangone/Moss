#!/bin/bash
# =============================================================================
# Moss AI Agent Platform — Outbound Firewall Whitelist
# Based on Anthropic's devcontainer firewall pattern
#
# Policy: Default-deny outbound. Whitelist LLM APIs, package registries,
#         and all HTTPS (with logging) for web research.
# =============================================================================

set -euo pipefail

echo "[firewall] Configuring outbound firewall rules..."

# Check if iptables is available
if ! command -v iptables &> /dev/null; then
    echo "[firewall] WARNING: iptables not found. Skipping firewall setup."
    exit 0
fi

# Check if we have permission (NET_ADMIN capability required)
if ! iptables -L -n &> /dev/null; then
    echo "[firewall] WARNING: No permission to set iptables rules. Skipping."
    exit 0
fi

# ===== Default policy: DROP all outbound =====
iptables -P OUTPUT DROP

# ===== Allow loopback (localhost communication) =====
iptables -A OUTPUT -o lo -j ACCEPT

# ===== Allow established connections =====
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# ===== Allow DNS resolution =====
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# ===== LLM API Endpoints =====
# Anthropic
iptables -A OUTPUT -p tcp --dport 443 -d api.anthropic.com -j ACCEPT

# DeepSeek
iptables -A OUTPUT -p tcp --dport 443 -d api.deepseek.com -j ACCEPT

# Alibaba Bailian (Qwen / multi-model)
iptables -A OUTPUT -p tcp --dport 443 -d coding.dashscope.aliyuncs.com -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d dashscope.aliyuncs.com -j ACCEPT

# Z.AI (GLM)
iptables -A OUTPUT -p tcp --dport 443 -d api.z.ai -j ACCEPT

# MiniMax
iptables -A OUTPUT -p tcp --dport 443 -d api.minimax.chat -j ACCEPT

# Moonshot (Kimi)
iptables -A OUTPUT -p tcp --dport 443 -d api.moonshot.ai -j ACCEPT

# OpenRouter
iptables -A OUTPUT -p tcp --dport 443 -d openrouter.ai -j ACCEPT

# ===== Package Registries =====
# Python (PyPI)
iptables -A OUTPUT -p tcp --dport 443 -d pypi.org -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d files.pythonhosted.org -j ACCEPT

# Node.js (npm)
iptables -A OUTPUT -p tcp --dport 443 -d registry.npmjs.org -j ACCEPT

# ===== All HTTPS with Logging (for web research) =====
# Claude Code needs web_search and web_fetch for research tasks.
# We allow all HTTPS but log every connection for audit.
iptables -A OUTPUT -p tcp --dport 443 -j LOG --log-prefix "MOSS-HTTPS-OUT: " --log-level 4
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

# ===== Block everything else =====
# Plaintext HTTP — reject (potential data leak vector)
iptables -A OUTPUT -p tcp --dport 80 -j LOG --log-prefix "MOSS-HTTP-BLOCKED: " --log-level 4
iptables -A OUTPUT -p tcp --dport 80 -j REJECT

# SSH outbound — reject
iptables -A OUTPUT -p tcp --dport 22 -j REJECT

# FTP — reject
iptables -A OUTPUT -p tcp --dport 21 -j REJECT

# Catch-all: reject everything else
iptables -A OUTPUT -j LOG --log-prefix "MOSS-BLOCKED: " --log-level 4
iptables -A OUTPUT -j REJECT

echo "[firewall] Outbound firewall configured successfully."
echo "[firewall] Policy: default-deny, HTTPS allowed with logging."
iptables -L OUTPUT -n --line-numbers 2>/dev/null | head -30 || true
