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
CloudCLI Web UI (port 3001)  ← Internalized + customized for Moss
    ├── moss-toolbox plugin (skill toolbox, smart suggestions)
    └── moss-admin plugin (user/skill management, admin dashboard)
    ↕ PTY
Claude Code CLI (agent kernel)
    ↕ Agent loop (plan → code → execute → iterate)
Skills + MCP + Sub-agents
    ↕
Python Environment (pandas, AutoGluon Tabular, scikit-learn, matplotlib...)
    ↕
Docker Container (sandboxed, firewalled, non-root)
```

## Quick Start

```bash
# 1. Clone and configure
git clone <repo-url> && cd Moss
cp .env.example .env
# Edit .env — set your ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL

# 2. Generate TLS certs and Nginx auth credentials
./scripts/generate-certs.sh
# Install htpasswd: apt install apache2-utils (or use Docker)
htpasswd -c nginx/htpasswd admin

# 3. Build and start
docker compose build        # ~15-30 min (AutoGluon Tabular is large)
docker compose up -d

# 4. Access
# Direct:  http://localhost:3001
# HTTPS:   https://localhost (self-signed cert warning expected)
# Login:   admin / moss2026 (change via CLOUDCLI_ADMIN_PASS in .env)
```

On first boot the container automatically:
- Creates the admin account (bypasses CloudCLI onboarding wizard)
- Installs Moss plugins into the correct CloudCLI plugin directory
- Copies default AI behavior config and permission lockdown settings

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
- **Enterprise UI** — Welcome page with quick-start cards (Analyze / Predict / Report / Documents); Chat + Files tabs only; no developer tooling exposed
- **Multi-Language** — UI available in English, Simplified Chinese (zh-CN), Traditional Chinese (zh-TW), Thai, German, Japanese, Korean, Russian
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

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | — | LLM API key (required) |
| `ANTHROPIC_BASE_URL` | — | LLM endpoint (blank = Anthropic direct) |
| `CLOUDCLI_ADMIN_USER` | `admin` | Initial admin username |
| `CLOUDCLI_ADMIN_PASS` | `moss2026` | Initial admin password |
| `DATABASE_PATH` | `/app/cloudcli/data/auth.db` | CloudCLI auth DB path (on persistent volume) |
| `SERVER_PORT` | `3001` | CloudCLI port |
| `CONTEXT_WINDOW` | `160000` | Token context limit |
| `MEMORY_LIMIT` | `8g` | Container memory cap |
| `CPU_LIMIT` | `4` | CPU core limit |

## Project Structure

```
Moss/
├── Dockerfile                  # Multi-stage build (Python data science + CloudCLI + runtime)
├── docker-compose.yml          # Orchestration (moss + nginx), 4 named volumes
├── .env.example                # API key and resource config template
├── config/
│   ├── CLAUDE.md               # AI behavior instructions for end users (data analyst role)
│   ├── settings.json           # Claude Code permission lockdown (production)
│   ├── toolbox-config.yaml     # Skill → UI mapping (categories, suggestions)
│   └── skill-policy.yaml       # User skill creation policies (no shell, no curl)
├── scripts/
│   ├── entrypoint.sh           # Container init (firewall, admin seed, plugin sync, privilege drop)
│   ├── create-user.sh          # User workspace provisioning with dept context
│   ├── start-user-session.sh   # Per-user session launcher
│   ├── init-firewall.sh        # Outbound iptables firewall
│   ├── cleanup-sessions.sh     # Stale session cleanup (runs hourly)
│   └── generate-certs.sh       # Self-signed TLS cert generation
├── nginx/
│   ├── nginx.conf              # Reverse proxy (TLS, auth, WebSocket)
│   └── htpasswd.example        # Auth credentials template
├── plugins/
│   ├── moss-toolbox/           # Skill toolbox, smart suggestions, welcome page
│   │   ├── manifest.json       # CloudCLI plugin manifest (name, slot, entry, server)
│   │   ├── src/index.jsx       # React UI
│   │   └── src/server.js       # Express API
│   └── moss-admin/             # Admin dashboard, user/skill management
│       ├── manifest.json
│       ├── src/index.jsx
│       └── src/server.js
├── cloudcli/                   # Internalized CloudCLI source (v1.26.3, fully customized)
│   ├── package.json
│   ├── src/
│   │   ├── components/         # React UI components (auth, chat, sidebar, settings, plugins)
│   │   ├── i18n/locales/       # 8 locales: en, zh-CN, zh-TW, th, de, ja, ko, ru
│   │   ├── stores/             # Zustand state management
│   │   ├── hooks/              # Custom React hooks
│   │   └── utils/              # Utility functions
│   └── vite.config.js
└── docs/                       # Technical strategy and UI design documentation
```

## Management

```bash
docker compose logs -f moss         # Watch runtime logs
docker compose restart moss         # Restart AI service
docker compose down                 # Stop all services
docker compose down -v              # Stop and wipe all data (destructive)
docker compose exec moss bash       # Shell into running container

# TypeScript / build checks (local dev)
cd cloudcli && npx tsc --noEmit     # Type check
cd cloudcli && npm run build        # Production build
```

## Documentation

| Document | Description |
|----------|-------------|
| [Enterprise AI Agent Platform Report](docs/Enterprise_AI_Agent_Platform_Report.md) | Technical strategy (architecture, security, cost, roadmap) |
| [企业AI Agent平台 技术探索与策略报告](docs/企业AI_Agent平台_技术探索与策略报告.md) | Detailed exploration report (中文) |
| [UI Design Recommendation](docs/UI_Design_Recommendation_工具箱与交互设计.md) | UI/UX design for non-technical users (中文) |

---

*March 2026*
