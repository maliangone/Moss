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
│   ├── entrypoint.sh               # Container init: firewall→admin seed→plugin sync→privilege drop→start
│   ├── create-user.sh              # User workspace provisioning with dept context
│   ├── start-user-session.sh       # Per-user session launcher
│   ├── init-firewall.sh            # iptables default-deny HTTPS whitelist
│   ├── cleanup-sessions.sh         # Stale session cleanup (runs hourly in background)
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
│   ├── moss-toolbox/               # Skill toolbox + smart suggestions
│   │   ├── manifest.json           # CloudCLI plugin manifest (required filename — NOT plugin.json)
│   │   ├── src/index.jsx           # React UI
│   │   └── src/server.js           # Express API
│   └── moss-admin/                 # Admin dashboard: user/skill management
│       ├── manifest.json
│       ├── src/index.jsx
│       └── src/server.js
│
├── cloudcli/                       # Internalized CloudCLI source (v1.26.3, fully customized)
│   ├── package.json                # @siteboon/claude-code-ui base
│   ├── src/
│   │   ├── components/             # React components (auth, chat, sidebar, plugins, etc.)
│   │   ├── i18n/locales/           # 8 locales: en, zh-CN, zh-TW, th, de, ja, ko, ru
│   │   ├── stores/                 # Zustand state management
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
- `cloudcli/src/components/` — React components: auth/, chat/, sidebar/, plugins/, main-content/, settings/
- `cloudcli/src/i18n/locales/` — 8 locale directories, each with: auth, chat, codeEditor, common, settings, sidebar, tasks
- `plugins/moss-toolbox/` — Skill toolbox plugin
- `plugins/moss-admin/` — Admin dashboard plugin

## Common Commands

```bash
# Docker
docker compose build                          # Build multi-stage image (~15-30 min)
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

1. **python-base** (python:3.11-slim-bookworm) — Data science stack (pandas, numpy, scikit-learn, `autogluon.tabular[all]`, matplotlib, etc.)
2. **cloudcli-build** (node:20-slim) — Build CloudCLI frontend from internalized source (`COPY cloudcli/ .` — no external git dependency)
3. **runtime** — Combines Python packages + CloudCLI build + Node.js runtime + Claude Code CLI + `sqlite3` CLI

### Container Startup Flow

`tini` → `entrypoint.sh`:
1. `init-firewall.sh` — iptables default-deny, whitelist LLM APIs + registries
2. Initialize `/persistent` storage structure
3. Copy default configs if not present (`CLAUDE.md`, `settings.json`, `toolbox-config.yaml`, `skill-policy.yaml`)
4. Verify environment (Claude Code CLI, Python, Node.js, API key)
5. Fix permissions on `/persistent` and `/home/agent`
6. **Step 5b**: Pre-seed CloudCLI admin account using `sqlite3` + Node.js bcrypt hash (`NODE_PATH=/app/cloudcli/node_modules`). Sets `has_completed_onboarding=1` to skip the onboarding wizard. Only runs when `$DATABASE_PATH` does not exist yet.
7. **Step 5c**: Install/sync Moss plugins from `/app/cloudcli/plugins/moss-*/` → `~/.claude-code-ui/plugins/` (CloudCLI's plugin discovery directory). Fresh copy on first boot; file-level sync (excluding `node_modules`) on subsequent boots to pick up updates from new image.
8. Start hourly session cleanup background job
9. `gosu agent` — Drop from root to non-root user (UID 1000)
10. Start CloudCLI server (`node server/index.js`)

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
| cloudcli-plugins | /home/agent/.claude-code-ui | Plugin data (CloudCLI discovery directory) |

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | — | LLM API key |
| `ANTHROPIC_BASE_URL` | — | LLM endpoint (supports 6 providers) |
| `DATABASE_PATH` | `/app/cloudcli/data/auth.db` | CloudCLI auth DB path — must point to cloudcli-data volume |
| `CLOUDCLI_ADMIN_USER` | `admin` | Admin username (first-boot seeding only) |
| `CLOUDCLI_ADMIN_PASS` | `moss2026` | Admin password (first-boot seeding only) |
| `SERVER_PORT` | `3001` | CloudCLI port |
| `CONTEXT_WINDOW` | `160000` | Token limit |
| `MEMORY_LIMIT` | `8g` | Container memory |
| `CPU_LIMIT` | `4` | CPU cores |

### Plugin Architecture

Plugins live in `plugins/` and are synced to `~/.claude-code-ui/plugins/` at container startup.

Required files:
- `manifest.json` — metadata (name, displayName, icon, type, slot, entry, server, permissions). **Must be `manifest.json`** — CloudCLI does not load `plugin.json`.
- `package.json` — dependencies (express, js-yaml)
- `src/index.jsx` — React component (UI)
- `src/server.js` — Express backend (API)

Plugins are built during Docker image build (`npm install && npm run build && npm prune --production`). The sync in entrypoint.sh updates plugin files on running containers without a full rebuild.

### CloudCLI Customizations

The `cloudcli/` directory is a fully internalized fork of `@siteboon/claude-code-ui` v1.26.3. Key Moss-specific changes:

**UI simplifications (enterprise-only exposure):**
- `src/components/chat/view/subcomponents/ProviderSelectionEmptyState.tsx` — Single provider (Claude / "Moss AI"), welcome page with 4 quick-start cards (Analyze Data, Predict Trends, Generate Report, Process Documents); cards inject prompt text into input on click
- `src/components/main-content/view/subcomponents/MainContentTabSwitcher.tsx` — Chat + Files tabs only (Shell and Git/Source Control removed)
- `src/components/app/MobileNav.tsx` — Chat + Files only
- `src/components/sidebar/view/subcomponents/SidebarFooter.tsx` — Discord link removed

**Branding:**
- `src/components/auth/view/LoginForm.tsx` — footer: "Moss AI Enterprise Platform"
- `src/components/auth/view/SetupForm.tsx` — title: "Welcome to Moss AI"
- `src/components/sidebar/view/subcomponents/SidebarProjectList.tsx` — `document.title` → "Moss AI"

**i18n locales** (`src/i18n/locales/`):
- 8 locales: `en`, `zh-CN`, `zh-TW`, `th`, `de`, `ja`, `ko`, `ru`
- Each locale has 7 JSON files: `auth`, `chat`, `codeEditor`, `common`, `settings`, `sidebar`, `tasks`
- Key Moss strings: `chat.welcome.*` (welcome page), `chat.input.placeholder`, `sidebar.app.title/subtitle`
- Locale registration: `src/i18n/config.js`; language list: `src/i18n/languages.js`

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
