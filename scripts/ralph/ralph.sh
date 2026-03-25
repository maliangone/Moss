#!/bin/bash
set -e

# Kill entire process group on Ctrl+C, TERM, or terminal close (HUP)
_ralph_cleanup() {
    echo ""
    echo "$(date '+%Y-%m-%d %H:%M:%S') Ralph interrupted — killing child processes..."
    # kill 0 = kill all processes in this process group (claude, sleep, powershell, etc.)
    kill 0 2>/dev/null
    exit 130
}
trap '_ralph_cleanup' INT TERM HUP

MODEL=${MODEL:-claude-sonnet-4-6}
MAX_TASKS=${1:-0}  # 0 = infinite loop
MAX_RETRIES=5
SIMPLIFY_INTERVAL=5
RATE_LIMIT_SLEEP=180  # 3 minutes
TASK_TIMEOUT=86400    # 24 hours hard timeout per claude invocation
STALL_THRESHOLD=120    # 120 * 15s = 1800s (30 min) of no new streaming output = stalled
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
TASKS_DIR="$PROJECT_DIR/.claude/tasks"

TOTAL_TASKS=0
COMPLETED_TASKS=0
TASKS_SINCE_SIMPLIFY=0
START_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")

ts() { date '+%Y-%m-%d %H:%M:%S'; }

# Find task slug directory by task ID prefix
find_slug_dir() {
    local tid="$1"
    local dir
    dir=$(ls -d "$TASKS_DIR/task-${tid}-"* 2>/dev/null | head -1)
    if [ -n "$dir" ] && [ -d "$dir" ]; then
        echo "$dir"
    fi
}

cd "$PROJECT_DIR"

# Ensure tasks dir exists (but do NOT wipe — artifacts persist across runs)
mkdir -p "$TASKS_DIR"

# Append run separator to progress log
echo "" >> "$PROGRESS_FILE"
echo "# Ralph run — $(ts)" >> "$PROGRESS_FILE"

# Outer loop: iterate through tasks
while [ $MAX_TASKS -eq 0 ] || [ $TOTAL_TASKS -lt $MAX_TASKS ]; do
    if [ $MAX_TASKS -eq 0 ]; then
        echo "============================================"
        echo "Task $((TOTAL_TASKS + 1))/∞ — Fetching next task..."
        echo "============================================"
    else
        echo "============================================"
        echo "Task $((TOTAL_TASKS + 1))/$MAX_TASKS — Fetching next task..."
        echo "============================================"
    fi

    # Lightweight claude call to get next task
    TASK_INFO=$(claude -p --model "$MODEL" --dangerously-skip-permissions \
        "Call next_task via Task Master MCP. Return ONLY:
         TASK_ID=<id>
         TASK_DESC=<one-line description>
         If no tasks remain, return: ALL_COMPLETE" 2>&1) || true

    # Rate/network error — sleep and retry
    if echo "$TASK_INFO" | grep -qiE "rate.?limit|usage.?limit|too many requests|over(load|capacity)|429|quota.?exceeded|token.?limit|hit.*(your|the)?.?limit|resets? [0-9]+(am|pm)|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network|socket hang up|fetch failed|authentication.?error|OAuth.*expired|401.*unauthorized|token.*expired"; then
        echo "$(ts) ⏳ Rate limit or network error on task fetch. Sleeping ${RATE_LIMIT_SLEEP}s..."
        echo "$(ts) — Rate/network error on task fetch, sleeping ${RATE_LIMIT_SLEEP}s" >> "$PROGRESS_FILE"
        sleep "$RATE_LIMIT_SLEEP"
        continue
    fi

    # Check if all tasks are done
    if echo "$TASK_INFO" | grep -q "ALL_COMPLETE"; then
        echo "$(ts) All tasks complete!"
        echo "" >> "$PROGRESS_FILE"
        echo "$(ts) — ALL TASKS COMPLETE" >> "$PROGRESS_FILE"
        break
    fi

    # Extract task info
    TASK_ID=$(echo "$TASK_INFO" | grep -oP 'TASK_ID=\K.*' | head -1 | tr -d '[:space:]')
    TASK_DESC=$(echo "$TASK_INFO" | grep -oP 'TASK_DESC=\K.*' | head -1)

    if [ -z "$TASK_ID" ]; then
        echo "$(ts) WARNING: Could not parse task info. Skipping..."
        echo "Raw output: $TASK_INFO"
        TOTAL_TASKS=$((TOTAL_TASKS + 1))
        continue
    fi

    echo "$(ts) Task: $TASK_ID — $TASK_DESC"

    TASK_DONE=false
    STUCK_HINT=""
    RATE_LIMIT_RETRIES=0
    MAX_RATE_LIMIT_RETRIES=5  # give up after 5 consecutive rate-limit sleeps

    # Inner loop: retry single task up to MAX_RETRIES
    attempt=0
    while [ $attempt -lt $MAX_RETRIES ]; do
        attempt=$((attempt + 1))
        echo "--------------------------------------------"
        echo "$(ts) Attempt $attempt/$MAX_RETRIES for task $TASK_ID"
        echo "--------------------------------------------"

        # Trigger simplification if interval reached
        EXTRA_INSTRUCTION=""
        if [ $TASKS_SINCE_SIMPLIFY -ge $SIMPLIFY_INTERVAL ]; then
            EXTRA_INSTRUCTION="IMPORTANT: Before starting, run the code-simplifier agent. Check 'git log --oneline -20' to find files changed by recent tasks."
            TASKS_SINCE_SIMPLIFY=0
        fi

        # Check if this is a retry with existing artifacts
        RETRY_HINT=""
        if [ $attempt -gt 1 ]; then
            SLUG_DIR=$(find_slug_dir "$TASK_ID")
            if [ -n "$SLUG_DIR" ]; then
                EXISTING=""
                [ -f "$SLUG_DIR/research.md" ] && EXISTING="$EXISTING research.md"
                [ -f "$SLUG_DIR/plan.md" ] && EXISTING="$EXISTING plan.md"
                [ -f "$SLUG_DIR/verification.md" ] && EXISTING="$EXISTING verification.md"
                RETRY_HINT="RETRY: Previous artifacts at .claude/tasks/$(basename "$SLUG_DIR")/ (has:$EXISTING). Reuse existing files, only produce what's missing."
            fi
        fi

        # Task message (-p): what to do
        TASK_MSG="Task: $TASK_ID — $TASK_DESC
Slug directory: .claude/tasks/task-${TASK_ID}-<your-slug>/
Attempt: $attempt/$MAX_RETRIES
$EXTRA_INSTRUCTION
$RETRY_HINT
$STUCK_HINT"

        # System prompt addition: ralph protocol + progress context
        RALPH_CONTEXT="$(cat "$SCRIPT_DIR/PROMPT.md")

## Previous Iterations Context
$(tail -20 "$PROGRESS_FILE" 2>/dev/null || echo 'No previous context.')"

        TMPOUT=$(mktemp)
        TMPERR=$(mktemp)
        TIMED_OUT=false

        # Run claude in background with streaming output for stall detection
        # stream-json writes JSON lines as claude works, so file grows continuously
        # stderr separated so verbose logs don't trigger false rate-limit detection
        claude -p "$TASK_MSG" --model "$MODEL" --dangerously-skip-permissions \
            --append-system-prompt "$RALPH_CONTEXT" \
            --output-format stream-json --verbose \
            > "$TMPOUT" 2>"$TMPERR" &
        CLAUDE_PID=$!

        ELAPSED=0
        LAST_SIZE=0
        STALL_COUNT=0

        while kill -0 $CLAUDE_PID 2>/dev/null; do
            sleep 15
            ELAPSED=$((ELAPSED + 15))

            # Check if output files are still growing (stdout + stderr)
            CURRENT_SIZE=$(( $(wc -c < "$TMPOUT" 2>/dev/null || echo 0) + $(wc -c < "$TMPERR" 2>/dev/null || echo 0) ))
            if [ "$CURRENT_SIZE" -eq "$LAST_SIZE" ]; then
                STALL_COUNT=$((STALL_COUNT + 1))
            else
                STALL_COUNT=0
                LAST_SIZE=$CURRENT_SIZE
            fi

            # Hard timeout
            if [ $ELAPSED -ge $TASK_TIMEOUT ]; then
                echo "$(ts) TIMEOUT: Task $TASK_ID exceeded ${TASK_TIMEOUT}s"
                kill $CLAUDE_PID 2>/dev/null; wait $CLAUDE_PID 2>/dev/null || true
                TIMED_OUT=true
                break
            fi

            # Stall detection (no new output for 30 min)
            if [ $STALL_COUNT -ge $STALL_THRESHOLD ]; then
                echo "$(ts) STALLED: Task $TASK_ID no output for $((STALL_COUNT * 15))s"
                kill $CLAUDE_PID 2>/dev/null; wait $CLAUDE_PID 2>/dev/null || true
                TIMED_OUT=true
                break
            fi
        done
        wait $CLAUDE_PID 2>/dev/null || true

        # Extract text from stream-json output (JSON lines format)
        # stderr has verbose logs + real errors; stdout has stream-json
        STDERR_OUTPUT=$(cat "$TMPERR" 2>/dev/null)
        RAW_OUTPUT=$(cat "$TMPOUT")

        if [ -z "$RAW_OUTPUT" ]; then
            # No stdout — check stderr for the error
            echo "$(ts) WARNING: Empty stdout from claude"
            OUTPUT="$STDERR_OUTPUT"
        elif echo "$RAW_OUTPUT" | head -1 | grep -q '^{'; then
            # Looks like JSON — parse with node
            if command -v node &>/dev/null; then
                OUTPUT=$(node -e "
                    const fs = require('fs');
                    const lines = fs.readFileSync('$TMPOUT', 'utf8').split('\n').filter(Boolean);
                    let text = '';
                    for (const line of lines) {
                        try {
                            const obj = JSON.parse(line);
                            if (obj.type === 'result' && obj.result) text = obj.result;
                            else if (obj.type === 'assistant' && obj.message?.content) {
                                for (const block of obj.message.content) {
                                    if (block.type === 'text') text += block.text;
                                }
                            }
                        } catch {}
                    }
                    process.stdout.write(text || fs.readFileSync('$TMPOUT', 'utf8'));
                " 2>/dev/null || echo "$RAW_OUTPUT")
            else
                OUTPUT="$RAW_OUTPUT"
            fi
        else
            # Plain text on stdout (shouldn't happen with stream-json, but handle it)
            OUTPUT="$RAW_OUTPUT"
            echo "$(ts) Non-JSON output: $(head -3 <<< "$OUTPUT")"
        fi
        rm -f "$TMPOUT" "$TMPERR"

        # On stuck: clean up orphan processes and build recovery hint for next attempt
        if [ "$TIMED_OUT" = true ]; then
            echo "$(ts) -- Task $TASK_ID attempt $attempt STUCK (timeout after ${ELAPSED}s)" >> "$PROGRESS_FILE"

            LAST_OUTPUT=$(tail -30 <<< "$OUTPUT")
            STUCK_HINT="STUCK RECOVERY: The previous attempt on this task timed out (ran for ${ELAPSED}s with no progress).
Last output before timeout:
---
$LAST_OUTPUT
---
Before continuing, investigate and fix potential causes:
1. Check for stale Docker containers — docker compose down if needed
2. Check git status for partial/uncommitted work from the previous attempt
3. Check .claude/tasks/task-${TASK_ID}-*/ for any partial artifacts
Then continue the task from where it left off."
            continue
        fi

        # Clear stuck hint on successful run (no timeout)
        STUCK_HINT=""

        # Check for rate limit / network error — sleep and retry without burning an attempt
        # Only check stderr (real errors), not stdout (task output that may mention "token" etc.)
        if echo "$STDERR_OUTPUT" | grep -qiE "rate.?limit|usage.?limit|too many requests|over(load|capacity)|429|quota.?exceeded|token.?limit|hit.*(your|the)?.?limit|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up|fetch failed"; then
            RATE_LIMIT_RETRIES=$((RATE_LIMIT_RETRIES + 1))
            if [ $RATE_LIMIT_RETRIES -ge $MAX_RATE_LIMIT_RETRIES ]; then
                echo "$(ts) Too many consecutive rate limit errors ($RATE_LIMIT_RETRIES). Moving on."
                echo "$(ts) — Task $TASK_ID: $RATE_LIMIT_RETRIES consecutive rate limit errors, giving up" >> "$PROGRESS_FILE"
                break
            fi
            echo "$(ts) ⏳ Rate limit or network error ($RATE_LIMIT_RETRIES/$MAX_RATE_LIMIT_RETRIES). Sleeping ${RATE_LIMIT_SLEEP}s..."
            echo "$(ts) — Rate/network error on task $TASK_ID attempt $attempt, sleeping ${RATE_LIMIT_SLEEP}s" >> "$PROGRESS_FILE"
            sleep "$RATE_LIMIT_SLEEP"
            attempt=$((attempt - 1))  # don't count this as a retry (works with while loop)
            continue
        fi

        # Not a rate limit error — reset counter
        RATE_LIMIT_RETRIES=0

        # Check for success signal
        if echo "$OUTPUT" | grep -q "<ralph>DONE</ralph>"; then
            # Validate artifacts by task ID prefix
            SLUG_DIR=$(find_slug_dir "$TASK_ID")

            MISSING=""
            if [ -n "$SLUG_DIR" ]; then
                [ ! -f "$SLUG_DIR/research.md" ] && MISSING="$MISSING research.md"
                [ ! -f "$SLUG_DIR/plan.md" ] && MISSING="$MISSING plan.md"
                [ ! -f "$SLUG_DIR/verification.md" ] && MISSING="$MISSING verification.md"
            else
                MISSING="task-slug-directory(task-${TASK_ID}-*)"
            fi

            if [ -n "$MISSING" ]; then
                echo "$(ts) ⚠ Task $TASK_ID claims DONE but missing:$MISSING"
                echo "$(ts) — Task $TASK_ID attempt $attempt: DONE but missing$MISSING — retrying" >> "$PROGRESS_FILE"
                continue
            fi

            echo "$(ts) Task $TASK_ID completed! Artifacts at: $(basename "$SLUG_DIR")"
            TASK_DONE=true
            TASKS_SINCE_SIMPLIFY=$((TASKS_SINCE_SIMPLIFY + 1))
            break
        fi

        # Check for explicit retry signal
        if echo "$OUTPUT" | grep -q "<ralph>RETRY</ralph>"; then
            echo "$(ts) Task $TASK_ID needs retry (attempt $attempt/$MAX_RETRIES)..."
            echo "" >> "$PROGRESS_FILE"
            echo "$(ts) — Task $TASK_ID attempt $attempt FAILED (explicit RETRY)" >> "$PROGRESS_FILE"
        else
            # No recognized signal — log for debugging
            OUTPUT_LEN=${#OUTPUT}
            echo "$(ts) No signal detected (output: ${OUTPUT_LEN} chars). First 200 chars:"
            echo "${OUTPUT:0:200}"
        fi

        sleep 3
    done

    [ "$TASK_DONE" = true ] && COMPLETED_TASKS=$((COMPLETED_TASKS + 1))

    # If all retries exhausted, mark as blocked — but only if it wasn't already done
    if [ "$TASK_DONE" = false ]; then
        echo "$(ts) Task $TASK_ID BLOCKED after $MAX_RETRIES attempts."
        echo "" >> "$PROGRESS_FILE"
        echo "$(ts) — Task $TASK_ID BLOCKED ($MAX_RETRIES retries exhausted)" >> "$PROGRESS_FILE"

        # Check current task status before downgrading — never block a done task
        CURRENT_STATUS=$(claude -p --model "$MODEL" --dangerously-skip-permissions \
            "Call get_task for task $TASK_ID. Return ONLY: STATUS=<status>" 2>/dev/null || echo "")
        if echo "$CURRENT_STATUS" | grep -qiE "STATUS=done|STATUS=completed"; then
            echo "$(ts) Task $TASK_ID is already done — NOT marking as blocked."
        else
            claude -p --model "$MODEL" --dangerously-skip-permissions \
                "Call set_task_status for task $TASK_ID with status 'blocked'. Reason: exhausted $MAX_RETRIES retries." 2>/dev/null || true
        fi
    fi

    TOTAL_TASKS=$((TOTAL_TASKS + 1))
done

# Final simplification pass — only if work was actually done this run
NEW_COMMITS=""
if [ -n "$START_COMMIT" ]; then
    NEW_COMMITS=$(git log --oneline "${START_COMMIT}..HEAD" 2>/dev/null || true)
fi

if [ "$COMPLETED_TASKS" -gt 0 ] || [ -n "$NEW_COMMITS" ]; then
    NEW_COMMIT_COUNT=$(echo "$NEW_COMMITS" | grep -c . || true)
    echo "$(ts) Running final simplification pass (completed=$COMPLETED_TASKS, new commits=$NEW_COMMIT_COUNT)..."
    echo "$(ts) — Final simplification pass (completed=$COMPLETED_TASKS, new commits=$NEW_COMMIT_COUNT)" >> "$PROGRESS_FILE"

    SIMPLIFY_PROMPT="Run the code-simplifier agent on recent changes. Check 'git log --oneline -30' to find all files changed since this session started (from commit ${START_COMMIT:0:8}). Apply the simplification rules from CLAUDE.md. Commit as: refactor: simplify recent changes"

    claude -p "$SIMPLIFY_PROMPT" --model "$MODEL" --dangerously-skip-permissions \
        --append-system-prompt "$(cat "$SCRIPT_DIR/PROMPT.md")" \
        2>&1 || true
else
    echo "$(ts) No completed tasks or new commits — skipping final simplification."
fi

echo "" >> "$PROGRESS_FILE"
echo "$(ts) — Ralph finished ($TOTAL_TASKS tasks processed)" >> "$PROGRESS_FILE"

echo "$(ts) Ralph done. Checking for user activity before hibernating..."

# Wait up to 3*60s, checking every 10s for keyboard/mouse activity
# Wrapped in subshell so set -e can't abort the script here
{
IDLE_CHECKS=18
USER_ACTIVE=false
for i in $(seq 1 $IDLE_CHECKS); do
    sleep 10
    # GetLastInputInfo returns ms since last input; if < 15s, user is active
    IDLE_MS=$(powershell.exe -NoProfile -Command '
Add-Type @"
using System; using System.Runtime.InteropServices;
public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
public class IdleCheck {
    [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    public static uint GetIdleMs() {
        LASTINPUTINFO lii = new LASTINPUTINFO(); lii.cbSize = (uint)Marshal.SizeOf(lii);
        GetLastInputInfo(ref lii);
        return (uint)Environment.TickCount - lii.dwTime;
    }
}
"@
[IdleCheck]::GetIdleMs()
' 2>/dev/null | tr -d '[:space:]')

    if [ -n "$IDLE_MS" ] && [ "$IDLE_MS" -lt 15000 ] 2>/dev/null; then
        echo "$(ts) User activity detected (idle ${IDLE_MS}ms). Skipping hibernate."
        USER_ACTIVE=true
        break
    fi
    echo "$(ts) Idle check $i/$IDLE_CHECKS (idle ${IDLE_MS:-?}ms)..."
done

if [ "$USER_ACTIVE" = false ]; then
    # Check if another ralph.sh is running in a different project (exclude current PID)
    OTHER_RALPH=$(ps -ef 2>/dev/null | grep '[r]alph.sh' | awk -v pid=$$ '$2 != pid' | head -1)
    if [ -n "$OTHER_RALPH" ]; then
        echo "$(ts) Another ralph.sh is running — skipping hibernate."
    else
        echo "$(ts) No user activity for 180s. Hibernating..."
        powershell.exe -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Hibernate', \$false, \$false)" 2>/dev/null || \
            rundll32.exe powrprof.dll,SetSuspendState Hibernate 2>/dev/null || \
            echo "$(ts) Could not hibernate — please hibernate manually."
    fi
fi
} || true
