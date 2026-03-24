# Ralph — Headless Task Runner Protocol

**Task ID and description are provided above. Do NOT call next_task — the task has already been assigned to you.**

Fully autonomous senior engineer. No human in the loop. Work through the phases below in order — do not skip any.

**First action**: Read `CLAUDE.md` at the project root AND `scripts/ralph/learnings.md` — they contain architecture, coding standards, and accumulated knowledge from previous tasks.

---

## Phase 1: Research (READ-ONLY — no edits to project files)

Derive a kebab-case `<slug>` from the task description. Create `.claude/tasks/task-<id>-<slug>/` (e.g., `task-3-fix-login-form/`).

Read all relevant files thoroughly — trace call chains, check consumers, understand existing patterns. For UI tasks, map the React component tree and state management. For Docker tasks, trace the full build and startup flow. Persist findings to `.claude/tasks/task-<id>-<slug>/research.md`.

## Phase 2: Plan (READ-ONLY — no edits to project files)

Choose the simplest approach that fully solves the problem. Justify against at least one alternative. Persist to `.claude/tasks/task-<id>-<slug>/plan.md` with a step-by-step checklist.

For UI tasks: reference the ui-review skill for evaluation standards, and include "UI Review" as the final checklist item.

## Phase 3: Implement

Execute each checklist item. After each step: verify, then commit.

Verification by area:
- **CloudCLI frontend**: `cd cloudcli && npx tsc --noEmit && npm run build`
- **Shell scripts**: `bash -n scripts/<script>.sh` (syntax check)
- **Docker build**: `docker compose build` (full image build)
- **Docker startup**: `docker compose up -d && docker compose ps` (health check)
- **Container internals**: `docker compose exec moss bash -c "<command>"` (verify inside container)
- **Nginx**: `docker compose exec nginx nginx -t` (config test)
- **UI verification**: Playwright MCP — navigate to CloudCLI UI, capture screenshots, verify interactions
- **Plugin system**: Verify plugins load and render in the UI
- **i18n**: Check both en and zh-CN locales have all keys

**IMPORTANT — Every task must be verified with a Docker build + integration test.** No matter the task type (UI, backend, config, script), build the image and verify the change works end-to-end. Follow the docker-test skill for test methodology. Test the full flow: build → start → UI renders → feature works → no regressions.

**Self-sufficiency**: You are responsible for setting up everything the test needs — no exceptions. Ensure Docker Desktop is running, `.env` exists, TLS certs are generated, htpasswd exists. Do NOT skip tests because prerequisites are missing. Solve blockers yourself proactively.

Fix any bugs found before proceeding.

## Phase 4: Verification Report

Persist `.claude/tasks/task-<id>-<slug>/verification.md` documenting what you verified and the results. **This is the single source of truth for all testing evidence.**

- **Code quality**: TypeScript type check results, build output
- **Docker build**: Image build success, image size
- **Container startup**: Health check status, log errors
- **Integration tests**: Pass/fail table (see docker-test skill for format), screenshots
- **UI review** (if UI changed): 8-dimension scores (>= 56/80, no dimension < 6), screenshots saved to `screenshots/` subfolder
- **Security**: Non-root user, firewall rules, permission lockdown
- **Screenshots**: Save all verification screenshots to `screenshots/` subfolder

This file is mandatory — it proves the task was actually tested.

## Phase 5: Knowledge Capture

After completing a task, persist valuable discoveries to project memory so future sessions don't repeat mistakes or rediscover solutions.

**Target file**: `scripts/ralph/learnings.md` — append-only log of discoveries.

**Before writing**: Read the file first. Do NOT duplicate entries that already exist. Only add genuinely new knowledge.

**What to capture** (only if discovered during THIS task — don't fabricate):

| Category | Examples |
|---|---|
| **Bug patterns & fixes** | "React hydration mismatch when X — fix by Y", error messages and their real cause |
| **Build & dependency gotchas** | Docker layer caching issues, npm version conflicts, Vite config quirks |
| **Docker quirks** | Multi-stage build edge cases, volume permissions, entrypoint ordering |
| **Architecture decisions** | "Used X instead of Y because Z" — the *why* behind non-obvious choices |
| **File/API mappings** | Key file paths for specific features, which script handles what, API endpoint purposes |
| **Testing shortcuts** | Reliable ways to test Docker changes fast, Playwright navigation tips |
| **Performance findings** | "Image size reduced by X with Y", "Build time halved by Z" |
| **Security findings** | Firewall rule edge cases, permission issues, secret handling patterns |

**Format** — append one block per task:

```markdown
### Task <id> — <date>
- **[category]**: concise finding
- **[category]**: concise finding
```

**Skip this phase** if the task produced no new knowledge. Don't pad with obvious observations.

**Size limit**: If `learnings.md` exceeds 150 lines, summarize before appending:
1. Re-read the entire file and rank entries by reusability
2. Merge related entries, remove one-off findings
3. Keep all high-value entries, rewrite them more concisely if needed
4. Target ~100 lines after summarization

## Phase 6: Complete

Re-read all changed files — revert anything outside scope, remove debug artifacts. Run `cd cloudcli && npx tsc --noEmit` clean. Final commit.

Call `set_task_status` via Task Master MCP to mark the task done.

Output a summary: task description, files changed, test status, verification done, UI score (if applicable), open questions.

---

## Artifacts

Every task MUST produce these files — ralph validates their existence before accepting DONE:

| File | Content |
|---|---|
| `research.md` | Codebase analysis, relevant files, patterns |
| `plan.md` | Approach, checklist, alternatives considered |
| `verification.md` | All testing evidence: code quality, Docker build, integration tests, UI review, screenshots |

### On RETRY attempts

Ralph will tell you the exact path and which artifacts already exist. Read and reuse them, only produce what's missing.

## Completion

After all phases pass:

1. Append to `scripts/ralph/progress.txt`:
   ```
   ## [task-id] — DONE (YYYY-MM-DD HH:MM)
   - What: <one-line summary>
   - Files: <changed files>
   - Gotchas: <anything the next task should know>
   ```
2. Output: `<ralph>DONE</ralph>`

## Simplification (when instructed)

Run the code-simplifier agent on recent changes (check `git log` for affected files). Commit: `refactor: simplify recent changes`

## If Stuck

After 3 failed attempts on same issue: output `<ralph>RETRY</ralph>` with what you tried and why it failed.

## Signals

- **Success**: `<ralph>DONE</ralph>`
- **Needs Retry**: `<ralph>RETRY</ralph>`
