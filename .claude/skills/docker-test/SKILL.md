Docker container build + integration testing skill for Moss platform.

Thorough, not shallow. Test the full lifecycle end-to-end: build → start → health check → UI verification → API verification → cleanup.

---

# Prerequisites

Self-service setup — handle everything autonomously:
- Docker Desktop must be running
- `.env` file must exist with valid LLM provider config
- `nginx/certs/` must contain TLS certs (generate with `./scripts/generate-certs.sh` if missing)
- `nginx/htpasswd` must exist (create with `htpasswd -c nginx/htpasswd <user>` if missing)

# Test Methodology

## Phase 1: Build Verification

```bash
# Clean build (no cache) to catch all issues
docker compose build --no-cache

# Check image size
docker images moss-agent --format "{{.Size}}"

# Verify multi-stage build layers
docker history moss-agent:latest --no-trunc
```

Expected: Build completes without errors. Image size is reasonable (< 5GB).

## Phase 2: Startup & Health

```bash
# Start services
docker compose up -d

# Wait for health check
docker compose ps  # Both services should show "healthy"

# Check logs for errors
docker compose logs moss 2>&1 | grep -iE "error|fatal|panic|exception"
docker compose logs nginx 2>&1 | grep -iE "error|fatal"

# Verify container internals
docker compose exec moss bash -c "whoami"          # Should be "agent" (not root)
docker compose exec moss bash -c "id"              # UID 1000
docker compose exec moss bash -c "iptables -L -n"  # Should show firewall rules (or permission denied if already dropped)
docker compose exec moss bash -c "ls -la /persistent/"  # Storage structure
docker compose exec moss bash -c "ls -la /home/agent/.claude/"  # Claude data
```

## Phase 3: UI Verification (via Playwright MCP)

Navigate to the CloudCLI web interface and verify:

1. **Login page**: Navigate to `https://localhost/` (or `http://localhost:3001/` if testing without nginx)
   - Login form renders
   - Can authenticate with admin credentials
   - Error handling for wrong credentials

2. **Main interface**: After login:
   - Sidebar renders with project list
   - Chat area renders with provider selection
   - Tab switcher works (if present)
   - i18n toggle works (en ↔ zh-CN)

3. **Plugin system**: Verify both plugins load:
   - moss-toolbox: ToolboxPanel renders, skill categories display, suggestions appear
   - moss-admin: Admin panel renders (if admin user), user list displays

4. **Terminal/Shell**: If shell component is available:
   - Terminal renders
   - Can type commands
   - Output displays correctly

## Phase 4: API Verification

```bash
# Health endpoint
curl -sf http://localhost:3001/ && echo "OK" || echo "FAIL"

# Plugin API (if exposed)
curl -sf http://localhost:3001/api/plugins && echo "OK" || echo "FAIL"

# Nginx proxy
curl -sfk https://localhost/health && echo "OK" || echo "FAIL"
```

## Phase 5: Security Verification

```bash
# Non-root user
docker compose exec moss bash -c "whoami"  # Must be "agent"

# Firewall (run as root if possible)
docker compose exec -u 0 moss bash -c "iptables -L OUTPUT -n" 2>/dev/null

# No secrets in environment
docker compose exec moss bash -c "env" | grep -iE "key|token|secret|password" | head -5
# Verify API keys are present but not leaked to stdout/logs

# Permission lockdown
docker compose exec moss bash -c "cat /home/agent/.claude/settings.json" 2>/dev/null
```

## Phase 6: Cleanup

```bash
docker compose down
docker compose down -v  # Only if full cleanup needed (destroys volumes!)
```

---

# Report Format

Append results to `.claude/tasks/<task-slug>/verification.md`:

```markdown
## Docker Integration Test — [date]

### Environment
- Docker Desktop version: [version]
- OS: Windows 11
- Branch: [branch]

### Build
- [ ] Multi-stage build completes without errors
- [ ] Image size: [size]
- [ ] No COPY failures or missing dependencies

### Startup & Health
- [ ] Both services start and reach "healthy"
- [ ] No errors in logs
- [ ] Container runs as non-root user (agent, UID 1000)
- [ ] /persistent structure initialized correctly

### UI (Playwright)
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Login page renders | Form visible | ... | PASS/FAIL |
| Authentication works | Redirect to main | ... | PASS/FAIL |
| Sidebar renders | Project list visible | ... | PASS/FAIL |
| Chat area renders | Provider selection | ... | PASS/FAIL |
| Toolbox plugin loads | Categories visible | ... | PASS/FAIL |
| Admin plugin loads | User list visible | ... | PASS/FAIL |
| i18n toggle | Language switches | ... | PASS/FAIL |

### API
- [ ] Health endpoint responds 200
- [ ] Nginx proxy forwards correctly
- [ ] WebSocket connections work

### Security
- [ ] Non-root user confirmed
- [ ] Firewall rules applied
- [ ] No secrets in logs
- [ ] Permission lockdown in settings.json

### Bugs Found
| # | Description | Severity | Status |
|---|-------------|----------|--------|
| 1 | ... | critical/major/minor | fixed/open |

### Summary
- Total checks: [N]
- Passed: [N]
- Failed: [N]
- Bugs found: [N]
```

---

# Loop

Fix → rebuild → retest until all checks pass + zero critical/major bugs.
