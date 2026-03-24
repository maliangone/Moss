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
- **[plugin-system]**: Plugin `entry` in `manifest.json` points to `src/index.jsx` (raw JSX); CloudCLI fetches it and `import()`s it as an ES module — browsers cannot parse JSX, causing `SyntaxError: Unexpected token '<'`. Plugins need a Vite build step producing a compiled `dist/index.mjs` (see Task 4)
- **[plugin-system]**: CloudCLI plugin API expects `export function mount(container, api)` from plugin modules, NOT a React default export — plugins must wrap their React component in a `mount()` function that calls `ReactDOM.createRoot(container).render(<Component />)`
- **[plugin-system]**: Plugin `icon` field in manifest.json should NOT use emoji (e.g. `"icon": "🧰"`) — CloudCLI tries to fetch the emoji as a static asset file, causing 404s; use a named Lucide icon string instead

### Task 6 — 2026-03-24
- **[security]**: entrypoint.sh ADMIN_PASS interpolated into `node -e "...bcrypt.hash('${ADMIN_PASS}',...)"` — single quotes in password break JS syntax; fix: pass via env var `_MOSS_ADMIN_PASS="${ADMIN_PASS}" node -e "...process.env._MOSS_ADMIN_PASS..."`
- **[security]**: ADMIN_USER interpolated in sqlite3 SQL string — fix: `SAFE_USER="${ADMIN_USER//\'/\'\'}"` (bash double-quote escaping for SQLite)
- **[security]**: MCP route uses `spawn(shell:false)` so no bash injection, but name/scope/projectPath/headers need validation to prevent passing CLI flag-like values to `claude` process
- **[security]**: nginx security headers (HSTS/X-Content-Type-Options/X-Frame-Options/Referrer-Policy/CSP) must be added manually — nginx:alpine has no defaults
- **[testing]**: node processes in container are PID 7 and 82 (tini spawns via gosu) — check `/proc/7/status` Uid to verify UID 1000; `pgrep` not available in slim image
- **[testing]**: Git Bash on Windows mangles `/tmp/` paths in `docker cp` and `docker exec` — write scripts to `/app/` inside container (writable) or use Python `-c` for inline tests

### Task 14 — 2026-03-24
- **[plugin-i18n]**: Plugins are plain JSX (no build step) — can't import npm packages at runtime. Use a custom `useTranslation` hook that embeds locale dicts inline and reads `localStorage.getItem('userLanguage')` (same key as CloudCLI). Reactive via `window.addEventListener('storage', ...)`.
- **[plugin-i18n]**: Locale source-of-truth JSON files belong in `plugins/{plugin}/i18n/{locale}.json`. The `i18n.js` helper embeds them as inline JS objects (for runtime use without build); when a Vite build is added, migrate to `import en from '../i18n/en.json'` + react-i18next.
- **[entrypoint]**: Plugin copy logic used `if [ ! -d "$target" ]` — new source files (i18n.js, i18n/*.json) added to existing plugins NEVER reached the volume on subsequent restarts. Fix: sync non-node_modules files via `find ... | while read; do cp -f ...; done` on every boot.
- **[i18n]**: zh-TW uses different vocabulary: 建立 vs 创建, 儲存 vs 保存, 使用者 vs 用户, 封存 vs 归档, 行銷 vs 市场, 營運 vs 运营

### Task 4 — 2026-03-24
- **[plugin-system]**: Vite library build (`formats: ['es']`) outputs `dist/index.mjs` NOT `dist/index.js` — manifest `"entry"` must be `"dist/index.mjs"`, not `"dist/index.js"`
- **[plugin-system]**: Vite library mode does NOT externalize React by default when `rollupOptions: { external: [] }` — React is bundled inline into the .mjs. This is required for blob URL imports (no importmaps available in CloudCLI's iframe)
- **[plugin-system]**: `process.env.NODE_ENV` is undefined in browser bundle — React calls it for dev/prod switching. Fix: add `define: { 'process.env.NODE_ENV': JSON.stringify('production') }` to vite.config.js
- **[plugin-system]**: Plugin API calls return 401 because CloudCLI routes require `Authorization: Bearer <token>`. Token is stored in `localStorage.getItem('auth-token')`. Create a plugin-local `apiFetch.js` helper that reads this key and injects the header
- **[plugin-system]**: Dockerfile must build plugins at image build time: `npm install && npm run build && npm prune --production`. The entrypoint syncs the entire plugin directory (incl. `dist/`) to the cloudcli-plugins volume on boot
- **[plugin-system]**: `npm prune --production` after build removes Vite + @vitejs/plugin-react from the image layer — these devDeps are large (~30MB); always prune after plugin builds

### Task 13 — 2026-03-24
- **[welcome-page]**: `ProviderSelectionEmptyState.tsx` new-session branch is the correct place to implement the welcome/empty state — it already receives `setInput` and `textareaRef` props for card click injection
- **[welcome-page]**: Card click pattern: `setInput(prompt)` then `setTimeout(() => textareaRef.current?.focus(), 100)` — the timeout is needed because React state update + focus races otherwise
- **[i18n]**: Welcome page keys added under `welcome.*` namespace in all 8 locale chat.json files; falls back to en for any missing locale

### Task 8 — 2026-03-24
- **[settings]**: Task descriptions may be stale — "Code Scan Findings" in task 8 were already fixed by tasks 2 and 12; always check current code state before implementing
- **[i18n]**: `SettingsSidebar.tsx` Sign Out button had hardcoded "Sign Out" — fix: `t('navigation.logout', { ns: 'common' })` reads from `common.navigation.logout` key (shows "退出登录" in zh-CN)
- **[settings]**: Settings.tsx still imports/renders dead tabs (agents/git/api/tasks/notifications/plugins) that the sidebar no longer exposes — inert dead code, not a bug; left in place per YAGNI

### Task 9 — 2026-03-24
- **[testing]**: Playwright right-click context menu: use `button: 'right'` on the row element; file download verified via Playwright Events log ("Downloading file X... Downloaded to .playwright-mcp/")
- **[testing]**: To test ImageViewer, create a minimal valid PNG in the container via `python3 -c "import struct,zlib; ..."` — Python3 is always available in the moss container; simpler than copying a file
- **[file-tree]**: File tree does NOT auto-refresh on external filesystem changes — requires clicking Refresh button. It only auto-refreshes after its own operations (create/rename/delete)

### Task 15 — 2026-03-24
- **[branding]**: `cloudcli/public/sw.js` and `cloudcli/public/api-docs.html` contain hardcoded "Claude Code UI" — these are source files copied verbatim to `dist/` by Vite; always grep `dist/` after a build to catch public/ files that escape i18n
- **[branding]**: `cloudcli/public/manifest.json` PWA name/short_name/description are not i18n'd — hardcoded strings, must be edited directly
- **[branding]**: ko/de/ja/ru locales still had "Claude Code UI" in `sidebar.json app.title`, `common.json mainContent.loading`, `common.json selectProjectDescription`, and `auth.json login.description` — en/zh-CN/zh-TW/th were already correct; always diff all 8 locales when doing branding sweeps
- **[branding]**: `AuthLoadingScreen.tsx` has a hardcoded "Claude Code UI" h1 — not i18n'd, must be changed directly in the component
- **[testing]**: After branding changes, verify with `grep -r "OldName" dist/` (not just `src/`) — public/ files bypass the React build pipeline entirely

### Task 7 — 2026-03-24
- **[i18n]**: `cloudcli/.gitignore` globally ignores `tasks.json` — any new locale needs an explicit `!src/i18n/locales/<locale>/tasks.json` exception or the file won't be committed
- **[i18n]**: en/chat.json has a `gemini` section that zh-CN was missing; always diff new top-level keys in en/chat.json against zh-CN when en gets new provider support
- **[i18n]**: zh-CN/codeEditor.json was missing `previewMarkdown` and `editMarkdown` in the `actions` object — check all nested keys, not just top-level sections
- **[i18n]**: ko locale had all 6 files except tasks.json; de/ja/ru were complete (task description was written before those were added); always glob locale dirs fresh rather than trusting stale task notes
