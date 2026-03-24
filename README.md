# Moss 🌿

Enterprise AI Agent Platform — Claude Code + CloudCLI + Docker

## Overview

Moss is an internal AI agent platform that enables 50–100 non-technical employees to perform professional-grade data analysis, statistical modeling, and document generation through natural language — powered by Claude Code CLI + CloudCLI web interface + Docker sandbox.

## Architecture

```
Browser (HTTPS)
    ↕
Nginx Reverse Proxy (TLS + Basic Auth)
    ↕
CloudCLI Web UI (port 3001)
    ├── moss-toolbox plugin (skill toolbox, smart suggestions)
    └── moss-admin plugin (user/skill management, admin dashboard)
    ↕ PTY
Claude Code CLI (agent kernel)
    ↕ Agent loop (plan → code → execute → iterate)
Skills + MCP + Sub-agents
    ↕
Python Environment (pandas, AutoGluon, scikit-learn, matplotlib...)
    ↕
Docker Container (sandboxed, firewalled, non-root)
```

## Quick Start

```bash
# 1. Clone and configure
git clone <repo-url> && cd Moss
cp .env.example .env
# Edit .env — set your ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL

# 2. Generate TLS certs and auth credentials
./scripts/generate-certs.sh
# Install htpasswd: apt install apache2-utils (or use Docker)
htpasswd -c nginx/htpasswd admin

# 3. Build and start
docker compose build        # ~15-30 min (AutoGluon is large)
docker compose up -d

# 4. Access
# Direct:  http://localhost:3001
# HTTPS:   https://localhost (self-signed cert warning expected)
```

## Supported LLM Providers

All providers use the same env vars (`ANTHROPIC_API_KEY` + `ANTHROPIC_BASE_URL`):

| Provider | Base URL | Cost (50 users) |
|----------|----------|-----------------|
| **Anthropic** (direct) | *(default)* | ~$2,500–3,750/mo |
| **DeepSeek** | `https://api.deepseek.com` | ~$52/mo |
| **Alibaba Bailian** | `https://coding.dashscope.aliyuncs.com/anthropic` | ~$50–200/mo |
| **Z.AI (GLM)** | `https://api.z.ai/api/anthropic` | $3–30/mo |
| **Moonshot (Kimi)** | `https://api.moonshot.ai/anthropic` | Pay-as-you-go |
| **MiniMax** | `https://api.minimax.chat/anthropic` | $10–50/mo |

## Key Features

- **Centralized** — One server, one deployment, all users via browser
- **Admin-Controlled** — 7-layer control stack (model, tools, behavior, environment, network, users, skills)
- **Low-Barrier** — Users type natural language, never see code
- **Multi-Model** — Swap providers via env vars, no code changes
- **User-Extensible** — Users create personal skills via natural language; best skills promoted to shared
- **Cost-Efficient** — ~$2–6/user/month vs $20–200 for commercial alternatives

## Security

- Non-root container (`gosu` privilege drop after firewall init)
- `cap_drop: ALL` with minimal cap_add
- Outbound firewall (iptables default-deny, HTTPS whitelist with logging)
- `settings.json` tool-level deny list (curl, wget, ssh, sudo, docker, etc.)
- Per-user workspace isolation (`chmod 700`, unique session IDs)
- Nginx basic auth + TLS

## Project Structure

```
Moss/
├── Dockerfile                  # Multi-stage build (Python + CloudCLI + runtime)
├── docker-compose.yml          # Orchestration (moss + nginx)
├── .env.example                # API key and resource config template
├── config/
│   ├── CLAUDE.md               # Global AI behavior instructions
│   ├── settings.json           # Claude Code permission lockdown
│   ├── toolbox-config.yaml     # Skill → UI mapping (categories, suggestions)
│   └── skill-policy.yaml       # User skill creation policies
├── scripts/
│   ├── entrypoint.sh           # Container init (firewall, config, privilege drop)
│   ├── create-user.sh          # User workspace provisioning
│   ├── start-user-session.sh   # Per-user session launcher
│   ├── init-firewall.sh        # Outbound firewall whitelist
│   ├── cleanup-sessions.sh     # Stale session cleanup
│   └── generate-certs.sh       # Self-signed TLS cert generation
├── nginx/
│   ├── nginx.conf              # Reverse proxy (TLS, auth, WebSocket)
│   └── htpasswd.example        # Auth credentials template
├── plugins/
│   ├── moss-toolbox/           # Skill toolbox, smart suggestions, welcome page
│   └── moss-admin/             # Admin dashboard, user/skill management
└── docs/                       # Technical strategy and UI design docs
```

## Management

```bash
docker compose logs -f moss     # Watch logs
docker compose restart           # Restart services
docker compose down              # Stop
docker compose down -v           # Stop and remove data
```

## Documentation

| Document | Description |
|----------|-------------|
| [Enterprise AI Agent Platform Report](docs/Enterprise_AI_Agent_Platform_Report.md) | Technical strategy (architecture, security, cost, roadmap) |
| [企业AI Agent平台 技术探索与策略报告](docs/企业AI_Agent平台_技术探索与策略报告.md) | Detailed exploration report (中文) |
| [UI Design Recommendation](docs/UI_Design_Recommendation_工具箱与交互设计.md) | UI/UX design for non-technical users (中文) |

---

*March 2026*
