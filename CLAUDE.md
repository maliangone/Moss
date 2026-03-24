# CLAUDE.md — Moss AI Agent Platform (Development)

This file provides guidance to Claude Code when working on the Moss platform itself — the Docker-based enterprise AI agent platform. This is NOT the `config/CLAUDE.md` which governs AI behavior inside the container for end users.

## Project Overview

Moss is an enterprise AI agent platform that provides non-technical employees (marketing, finance, legal, operations, production) with autonomous data analysis capabilities via a web-based Claude Code interface. It packages Claude Code CLI + CloudCLI web UI + a full Python data science stack into a hardened Docker container, fronted by Nginx with TLS + basic auth.

**Tech stack:** Docker, Python 3.11 (data science), Node.js 20 (CloudCLI), React 18 + TypeScript + Tailwind CSS + Vite (frontend), Express.js (backend), SQLite3 (auth), Nginx (reverse proxy), Playwright (browser testing)

## Project Structure

```
Moss/
├── CLAUDE.md                       # THIS FILE — dev guidance for Claude Code
├── Dockerfile                      # Multi-stage: python-base → cloudcli-build → runtime
├── docker-compose.yml              # moss + nginx services, 4 named volumes
├── .env / .env.example             # LLM provider config (6 providers supported)
│
├── config/                         # Container-internal configs (copied at first boot)
│   ├── CLAUDE.md                   # AI instructions for end users (data analyst role)
│   ├── settings.json               # Claude Code permission lockdown (production)
│   ├── skill-policy.yaml           # User skill creation policies
│   └── toolbox-config.yaml         # Skill→UI mapping, suggestions, categories
│
├── scripts/                        # Container lifecycle scripts
│   ├── entrypoint.sh               # Container init (firewall→config→privilege drop→start)
│   ├── create-user.sh              # User workspace provisioning with dept context
│   ├── start-user-session.sh       # Per-user session launcher
│   ├── init-firewall.sh            # iptables default-deny HTTPS whitelist
│   ├── cleanup-sessions.sh         # Stale session cleanup
│   └── generate-certs.sh           # Self-signed TLS cert generation
│
├── scripts/ralph/                  # Autonomous task runner (dev tooling)
│   ├── ralph.sh                    # Headless task loop
│   ├── PROMPT.md                   # Six-phase protocol for ralph-invoked Claude
│   ├── learnings.md                # Append-only knowledge log
│   └── progress.txt                # Task execution log (auto-created)
│
├── nginx/                          # Reverse proxy config
│   ├── nginx.conf                  # TLS, basic auth, WebSocket proxy
│   ├── htpasswd                    # Auth credentials (generated at setup)
│   └── certs/                      # TLS certificates (generated at setup)
│
├── plugins/                        # CloudCLI plugins (React + Express)
│   ├── moss-toolbox/               # Skill toolbox + smart suggestions + welcome
│   └── moss-admin/                 # Admin dashboard: user/skill management
│
├── cloudcli/                       # Internalized CloudCLI web UI
│   ├── package.json                # v1.26.3 (@siteboon/claude-code-ui)
│   ├── src/
│   │   ├── components/             # React components (auth, chat, sidebar, plugins, etc.)
│   │   ├── i18n/locales/           # en + zh-CN translations
│   │   ├── stores/                 # State management
│   │   ├── hooks/                  # Custom React hooks
│   │   └── utils/                  # Utility functions
│   └── vite.config.js
│
├── docs/                           # Strategy & design documentation
│   ├── Enterprise_AI_Agent_Platform_Report.md
│   ├── 企业AI_Agent平台_技术探索与策略报告.md
│   └── UI_Design_Recommendation_工具箱与交互设计.md
│
└── README.md                       # Quick start guide
```

### Key Directories

- `config/` — Container-internal configs copied to `/persistent/config/` on first boot
- `scripts/` — Shell scripts for container lifecycle (entrypoint, user management, firewall)
- `cloudcli/src/components/` — React components: auth/, chat/, sidebar/, plugins/, main-content/, shell/, settings/
- `cloudcli/src/i18n/locales/` — Internationalization: en/ and zh-CN/ for auth, chat, common, sidebar
- `plugins/moss-toolbox/` — Skill toolbox plugin (ToolboxPanel, SuggestionBar, WelcomePage, CreateSkillDialog)
- `plugins/moss-admin/` — Admin dashboard plugin (user management, skill management, security policies)

## Common Commands

```bash
# Docker
docker compose build                          # Build multi-stage image
docker compose up -d                          # Start services (moss + nginx)
docker compose down                           # Stop services
docker compose logs -f moss                   # Watch moss logs
docker compose exec moss bash                 # Shell into running container

# CloudCLI frontend (local dev)
cd cloudcli && npm install                    # Install dependencies
cd cloudcli && npm run dev                    # Dev server (Vite + Express)
cd cloudcli && npm run build                  # Production build

# Plugin development
cd plugins/moss-toolbox && npm install        # Install plugin deps
cd plugins/moss-admin && npm install

# Nginx setup
./scripts/generate-certs.sh                   # Generate self-signed TLS certs
# htpasswd created manually or via setup

# TypeScript checks
cd cloudcli && npx tsc --noEmit               # Type check without build

# Linting (if configured)
cd cloudcli && npm run lint                   # ESLint

# Shell scripts
shellcheck scripts/*.sh                       # Lint shell scripts (if shellcheck installed)
```

## Architecture

### Docker Multi-Stage Build

1. **python-base** (python:3.11-slim-bookworm) — Data science stack (pandas, numpy, scikit-learn, AutoGluon, matplotlib, etc.)
2. **cloudcli-build** (node:20-slim) — Build CloudCLI frontend (npm install + vite build)
3. **runtime** — Combines Python packages + CloudCLI build + Node.js runtime + Claude Code CLI

### Container Startup Flow

`tini` → `entrypoint.sh`:
1. `init-firewall.sh` — iptables default-deny, whitelist LLM APIs + registries
2. Initialize `/persistent` storage structure
3. Copy default configs if not present
4. Initialize CloudCLI database (first boot)
5. Fix line endings (CRLF→LF) and permissions
6. `gosu agent` — Drop from root to non-root user (UID 1000)
7. Start CloudCLI server

### Security Model

- Non-root user (gosu privilege drop)
- `cap_drop: ALL` + minimal `cap_add`
- `no-new-privileges: true`
- iptables firewall (default-deny outbound, whitelist LLM APIs)
- Per-user workspace isolation (chmod 700)
- Production `settings.json` restricts Claude to: python, pip, Read, Write (data formats), Grep only
- `skill-policy.yaml` restricts user skill creation (no shell, no curl/wget)

### Services

| Service | Port | Purpose |
|---------|------|---------|
| moss (CloudCLI) | 127.0.0.1:3001 | Web UI + API (localhost only) |
| nginx | 443 (HTTPS), 80 (HTTP) | Reverse proxy with TLS + basic auth |

### Volumes (docker-compose.yml)

| Volume | Mount | Purpose |
|--------|-------|---------|
| persistent-data | /persistent | User workspaces, shared skills, config |
| cloudcli-data | /app/cloudcli/data | CloudCLI database (auth.db) |
| claude-data | /home/agent/.claude | Claude Code sessions, skills, projects |
| cloudcli-plugins | /home/agent/.claude-code-ui | Plugin data |

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| ANTHROPIC_API_KEY | — | LLM API key |
| ANTHROPIC_BASE_URL | — | LLM endpoint (supports 6 providers) |
| SERVER_PORT | 3001 | CloudCLI port |
| CONTEXT_WINDOW | 160000 | Token limit |
| MEMORY_LIMIT | 8g | Container memory |
| CPU_LIMIT | 4 | CPU cores |
| CLOUDCLI_ADMIN_USER | admin | Default admin username |
| CLOUDCLI_ADMIN_PASS | moss2026 | Default admin password |

### Plugin Architecture

Plugins live in `plugins/` with:
- `manifest.json` — metadata (name, displayName, icon, type, slot, entry, server, permissions)
- `package.json` — dependencies (express, js-yaml)
- `src/index.jsx` — React component (UI)
- `src/server.js` — Express backend (API)

Plugins are loaded by CloudCLI at startup. They occupy tab slots in the UI.

## Development Environment

- **OS**: Windows 11, Git Bash shell
- **Docker**: Docker Desktop for Windows
- **Node.js**: v20+ (for CloudCLI local dev)
- **Python**: 3.11 (inside container only)
- **Browser testing**: Playwright MCP (`.playwright-mcp/`)

### Supported LLM Providers

Anthropic (direct), DeepSeek, Alibaba Bailian, Z.AI, MiniMax, Moonshot, OpenRouter — all via Anthropic-compatible API format.

---

## Auto-Development Workflow

### Verification (before every commit)

```bash
# CloudCLI frontend
cd cloudcli && npx tsc --noEmit               # TypeScript type check
cd cloudcli && npm run build                   # Vite production build

# Docker
docker compose build                           # Full image build
docker compose up -d && docker compose logs -f moss  # Startup + logs

# Shell scripts
bash -n scripts/*.sh                           # Syntax check
```

UI changes: use Playwright MCP for browser verification. Navigate to the CloudCLI UI, capture screenshots, inspect elements, verify interactions.

### Code Simplification Rules

(Read by code-simplifier Agent automatically)

- Remove unnecessary wrappers and dead code
- Flatten deeply nested structures
- Extract components/functions over 60 lines
- Early return instead of deep nesting (> 3 levels)
- Delete unused imports/functions/variables
- Use TypeScript strict types (no `any` unless justified)
- Prefer named exports over default exports
- Use `const` over `let` where possible

### Git Discipline

- `wip: <slug> — <what>` per subtask
- `feat: <area> — <what>` for features
- `fix: <area> — <what>` for bug fixes
- `refactor: simplify <area>` for simplification
- `docs: <what>` for documentation
- `chore: <what>` for infrastructure/config
- Never batch multiple features in one commit

### Task Management

- Tasks via Task Master MCP (`.taskmaster/tasks/tasks.json`)
- `next_task` → work → `set_task_status` → repeat
- Never skip dependency order

### Task Documents

```
.claude/tasks/task-<id>-<slug>/  ← research.md, plan.md, verification.md, screenshots/
```

### Context Management (1M context)

- Context window is 1M tokens — aggressive compaction is no longer needed.
- `/compact` only if context genuinely approaches limit (very rare for single tasks).
- One task per session. `/clear` when switching.

### Agents + Tools

| Tool | Type | Purpose |
|---|---|---|
| `/triage` | Skill | Turn loose ideas into Task Master tasks |
| `/simplify` | Skill | Code simplification |
| `/docker-test` | Command | Docker container build + integration test |
| ui-review | Skill | CloudCLI UI review via Playwright |
| Playwright MCP | MCP | Browser interaction & UI verification |
| Task Master | MCP | Task management |
