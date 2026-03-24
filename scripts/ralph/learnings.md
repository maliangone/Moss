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
- i18n: 8 locales in `cloudcli/src/i18n/locales/` (en, zh-CN, ko, ja, ru, de, zh-TW, th) — all 7 namespaces (auth, chat, codeEditor, common, settings, sidebar, tasks) should exist per locale; missing ones fall back to en
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

### Task 1 — 2026-03-24
- **[auth]**: `logout()` was implemented in AuthContext but never wired to a UI button — always check that implemented functions are actually called from UI
- **[auth]**: After container restart, JWT secret regenerates (stored in app_config DB) — old tokens become invalid; this is expected behavior for testing
- **[auth]**: `POST /auth/logout` returns 401 after sign-out because `clearSession()` runs before the API call, so token is gone by then — non-critical (fire-and-forget, JWT is stateless)
- **[auth]**: Admin pre-seeding in entrypoint.sh correctly sets `has_completed_onboarding=1` — onboarding wizard is never shown on first login
- **[testing]**: `npx tsc --noEmit` fails in Git Bash on Windows because npm's npx intercepts it — use `./node_modules/.bin/tsc` or verify via Docker build instead
- **[testing]**: node_modules not available locally (Windows Git Bash path issues) — TypeScript verification must be done via Docker build (`docker compose build moss`)

### Task 5 — 2026-03-24
- **[docker]**: Dockerfile was missing HEALTHCHECK — docker-compose healthcheck alone doesn't satisfy `docker inspect` health status; always add HEALTHCHECK to Dockerfile too
- **[docker]**: DATABASE_PATH was pointing to `/home/agent/.cloudcli/auth.db` (not on any named volume) while the `cloudcli-data` volume mounts at `/app/cloudcli/data` — DB was lost on container removal. Fix: DATABASE_PATH must point to a path covered by a named volume
- **[firewall]**: On Docker Desktop (iptables-nft backend), `iptables -L | head -N` exits non-zero with "iptables-legacy tables present" warning even when rules are applied; add `|| true` to display-only iptables commands to avoid false "Firewall setup failed" messages
- **[testing]**: `docker exec moss-agent whoami` returns `root` because docker-compose sets `user: "0:0"` — the actual CloudCLI process runs as agent (UID 1000); verify via `/proc/*/exe` uid check or `cat /proc/<pid>/status`
- **[testing]**: Git Bash on Windows converts `/app/cloudcli/data/` paths in docker exec commands to Windows paths — always wrap in `bash -c "..."` to prevent path mangling

### Task 11 — 2026-03-24
- **[i18n]**: `cloudcli/.gitignore` ignores `tasks.json` globally — adding a new locale's tasks.json requires an explicit exception line like `!src/i18n/locales/<locale>/tasks.json` (see lines 134-139 of cloudcli/.gitignore)
- **[i18n]**: Adding a locale requires 3 changes: (1) create locale JSON files, (2) add imports + resources in config.js, (3) add entry in languages.js — all three are required for the language to appear in the UI
- **[i18n]**: Language selector is in Settings → Appearance (外觀), not in the Account tab
- **[i18n]**: zh-TW (Traditional Chinese) uses significantly different vocabulary than zh-CN: 設定 vs 设置, 儲存 vs 保存, 檔案 vs 文件, 資料夾 vs 文件夹, 登出 vs 退出登录, 搜尋 vs 搜索

### Task 12 — 2026-03-24
- **[ui-hide]**: `QuickSettingsPanel` in `ChatInterface.tsx` is a standalone component rendered outside the main flex div — remove the JSX element + import to hide it entirely
- **[ui-hide]**: `ChatInputControls` in `ChatComposer.tsx` is conditionally rendered with `!hasQuestionPanel` guard — remove the block and import; the props (permissionMode, thinkingMode, etc.) are still needed by the parent and remain in the interface
- **[ui-hide]**: `MobileNav.tsx` `baseCoreItems` hardcoded Shell/Git as strings, not using i18n — when simplifying to Chat+Files, use `t('tabs.chat')` and `t('tabs.files')` from the common namespace for consistency
- **[ui-hide]**: `ProtectedRoute.tsx` already defaults `hasCompletedOnboarding=true` in AuthContext — the onboarding guard was effectively dead code for the Moss use case (admin pre-seeded with has_completed_onboarding=1); safe to remove
- **[settings]**: Settings default tab is `initialTab = 'agents'` in `Settings.tsx` — must change to `'appearance'` when hiding all other tabs, otherwise Settings opens showing agents content with only Appearance in the sidebar
- **[testing]**: After hiding tabs, `ps` is not available in the moss container — use `/proc/<pid>/status` to check process UIDs instead

### Task 2 — 2026-03-24
- **[settings]**: `Settings.tsx` default prop `initialTab='appearance'` is overridden by `useProjectsState.ts` which initializes `settingsInitialTab` to `'agents'` and `openSettings` defaults to `'tools'` — both must be changed to `'appearance'` for the tab fix to take effect
- **[i18n]**: When adding new i18n keys to `en/chat.json`, always update `zh-CN/chat.json` in the same commit — the `claudeStatus.*` section was left in English in zh-CN while EN was complete
- **[testing]**: Browser localStorage persists language preference across container restarts — a previous Thai locale test will show Thai on next page load; test in EN first, then switch to verify zh-CN strings
- **[chat-flow]**: Claude provider auto-selection in `ProviderSelectionEmptyState.tsx` calls `selectProvider("claude")` on render if `provider !== 'claude'` — this is a render-time side-effect that may trigger a re-render; no bug found but worth noting

### Task 3 — 2026-03-24
- **[ui-hide]**: `SidebarCollapsed.tsx` has its own Discord link — task-12 removed it from `SidebarFooter.tsx` (expanded sidebar) but missed `SidebarCollapsed.tsx` (icon-only collapsed view); always check both sidebar states when removing links
- **[plugin-system]**: Plugin `entry` in `manifest.json` points to `src/index.jsx` (raw JSX); CloudCLI fetches it and `import()`s it as an ES module — browsers cannot parse JSX, causing `SyntaxError: Unexpected token '<'`. Plugins need a Vite build step producing a compiled `dist/index.js`
- **[plugin-system]**: CloudCLI plugin API expects `export function mount(container, api)` from plugin modules, NOT a React default export — plugins must wrap their React component in a `mount()` function that calls `ReactDOM.createRoot(container).render(<Component />)`
- **[plugin-system]**: Plugin `icon` field in manifest.json should NOT use emoji (e.g. `"icon": "🧰"`) — CloudCLI tries to fetch the emoji as a static asset file, causing 404s; use a named Lucide icon string instead
