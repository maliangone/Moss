# Ralph Learnings

Append-only log of discoveries from autonomous task runs. Read this before starting work — it saves time.

## Consolidated

### Docker & Build
- Multi-stage build: python-base → cloudcli-build → runtime. Python packages are huge (~2GB) — layer caching is critical
- `entrypoint.sh` runs as root initially for iptables, then drops to agent (UID 1000) via gosu
- CloudCLI `npm run build` runs in cloudcli-build stage — changes to `cloudcli/src/` invalidate this layer
- Volumes (persistent-data, cloudcli-data, claude-data, cloudcli-plugins) persist across restarts — configs only copied on first boot
- `docker compose down -v` destroys ALL persistent data — never use in production

### CloudCLI Frontend
- React 18 + TypeScript + Tailwind CSS + Vite
- i18n: en + zh-CN in `cloudcli/src/i18n/locales/` — all keys must exist in both
- Plugin system loads from `plugins/` directory — each plugin has manifest.json, React entry (index.jsx), Express backend (server.js)
- State management via custom stores in `cloudcli/src/stores/`

### Security
- Container runs as non-root user `agent` (UID 1000) after gosu privilege drop
- iptables default-deny outbound, whitelist LLM APIs + registries
- Production `config/settings.json` restricts Claude to python/pip/Read/Write/Grep only
- `skill-policy.yaml` blocks shell scripts and curl/wget in user-created skills
- `no-new-privileges: true` in docker-compose.yml prevents privilege escalation

### Scripts
- All scripts use LF line endings — Windows CRLF causes `\r` errors in container
- `entrypoint.sh` handles CRLF→LF conversion at startup via sed
- `create-user.sh` creates per-user workspaces with dept-specific CLAUDE.md context injection
- `init-firewall.sh` needs NET_ADMIN capability — only used at startup, then effectively unused

### Environment
- 6 LLM providers supported via Anthropic-compatible API format
- `.env` variables: ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, SERVER_PORT, CONTEXT_WINDOW, etc.
- Default admin: admin/moss2026 (set via CLOUDCLI_ADMIN_USER/CLOUDCLI_ADMIN_PASS env vars)
