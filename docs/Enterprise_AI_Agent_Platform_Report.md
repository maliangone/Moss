# Enterprise AI Agent Platform: Technical Strategy Report

**IT Center of Excellence** | March 2026 | Status: Ready for Prototyping

---

## 1. Executive Summary

This report evaluates how to deploy AI coding agents as an internal analytical platform for 50–100 employees across IT, marketing, legal, finance, and operations. The goal: enable any employee to perform professional-grade data analysis, statistical modeling, and document generation by describing tasks in natural language — without writing code.

**Recommended architecture:** Claude Code CLI (agent kernel) + CloudCLI web interface + unified Python environment + Docker sandbox with network firewall. Cost: ~$100–170/month total for 50 users via Chinese model API providers, compared to $20–200/user/month for commercial alternatives.

**Key differentiator:** No existing product combines centralized deployment, seven-layer admin control, multi-model flexibility, user-extensible skills, and zero-code access in a single package. Claude Cowork lacks audit logging and centralized management. Tencent WorkBuddy has no admin dashboard. Microsoft Copilot Cowork cannot execute arbitrary code. Our architecture fills this gap at a fraction of the per-user cost.

---

## 2. Problem Statement

### Requirements

Build a Code Interpreter-like tool for internal use, capable of autonomous code execution (write → run → debug → iterate), professional ML libraries (AutoGluon, scikit-learn, statsmodels), statistical analysis and visualization for all departments, integration with DingTalk and existing infrastructure, and centralized admin control over security, models, packages, and permissions.

### Why Existing Tools Fail

| Tool | Core Limitation |
|------|----------------|
| **ChatGPT / Claude.ai** | No admin control, no custom packages, no persistent workspaces. $20–200/user/month. |
| **Dify** | Sandbox blocks scientific computing (no pandas/sklearn by default). Pipeline-based, not iterative. |
| **JupyterHub** | Users must write code. No autonomous agent loop. |
| **BI Tools (Tableau, Power BI)** | Only pre-built dashboards. No ad-hoc analysis or predictive modeling. |
| **OpenClaw** | Per-user installation, no centralized admin, high security risk. |
| **Claude Cowork** | Per-user desktop app. Cowork activity not captured in audit logs even on Enterprise tier. |
| **Tencent WorkBuddy** | Per-user desktop app. No centralized admin console (announced but unreleased). |

---

## 3. Architecture

### Technology Stack

```
┌───────────────────────────────────────────────────────────┐
│  Browser / DingTalk                                        │
│       ↕ HTTPS                                             │
│  CloudCLI (Web UI)        ← Thin presentation layer       │
│       ↕ PTY (pseudo-terminal)                              │
│  Claude Code CLI          ← Complete agent kernel          │
│       ↕ Agent loop (plan → code → execute → iterate)      │
│  Skills + MCP + Sub-agents ← Domain expertise              │
│       ↕                                                    │
│  Unified Python Environment (pandas, AutoGluon, etc.)      │
│       ↕                                                    │
│  Docker Container (sandboxed, firewalled)                  │
└───────────────────────────────────────────────────────────┘
```

CloudCLI (siteboon/claudecodeui, GPL-3.0, 6.2K stars) manages the Claude Code CLI process via PTY. It is the real CLI with a browser frontend — all Claude Code features (skills, MCP, CLAUDE.md, agents, hooks) work unchanged.

### Why Claude Code CLI

The fundamental difference between a chatbot and a coding agent is the autonomous execution loop. A user types "Analyze sales.csv and predict next quarter revenue." The agent autonomously reads the file, detects missing values, cleans data, selects AutoGluon, trains a prediction model, generates visualizations, and delivers a complete analysis with interpretation. Five to ten decisions, multiple code blocks, error handling — all without user intervention.

Other options evaluated and rejected: Dify (sandbox too restricted, pipeline-based not iterative), self-built agent loop (viable but high effort — ~500–1000 lines to write from scratch), and Copilot CLI SDK (still in technical preview, good future fallback).

### Four-Layer Capability Architecture

Claude Code's capabilities exist in four layers with distinct controllability:

| Layer | What | Examples | Admin Control |
|-------|------|---------|---------------|
| **Built-in Tools** | Always present; Claude decides when to use | Read, Write, Bash, Agent (spawn sub-agents) | `settings.json` allow/deny |
| **Built-in Sub-Agents** | Autonomously spawned for complex tasks | Explore (read-only search, Haiku), Plan (architecture), general-purpose (full tools) | Influence via CLAUDE.md, `--max-turns` |
| **Bundled Skills** | Pre-installed slash commands | `/pptx`, `/docx`, `/xlsx`, `/pdf`, `/frontend-design` | Cannot uninstall; can hide in UI |
| **Custom Skills** | Admin-installed or user-created | Data analysis, ML forecast, AOI inspection | Full control |

When users observe "deep research" behavior (multiple parallel investigations), this is Claude autonomously using the Agent tool to spawn sub-agents — not a skill or command. Token consumption in multi-agent workflows is approximately 4–7x single-agent sessions.

### Skills Ecosystem

Skills are SKILL.md instruction packages using progressive disclosure (~100 tokens for metadata scan, <5K when activated). Key sources:

| Repository | Content |
|-----------|---------|
| anthropics/skills (37.5K stars) | Document processing, frontend design, skill creator |
| K-Dense-AI/claude-scientific-skills | 170+ skills: biology, chemistry, ML, 250+ databases, 60+ packages |
| alirezarezvani/claude-skills (5.2K stars) | 192 skills across engineering, marketing, compliance — 11 platforms |
| Antigravity awesome-skills | 1,234+ skills with curated role-based bundles |

---

## 4. Multi-User Design

### Workspace Isolation

Per-user Docker containers were rejected: 50 containers is an operations nightmare, OAuth cannot be automated, non-technical users cannot manage environments, and 95% idle resource waste. Instead, all users share one environment with three isolation layers:

**File Isolation:** Each user gets `/persistent/users/{user}/` with `chmod 700`. Claude Code's working directory is set per-user.

**Session Isolation:** `--session-id` per user ensures conversation history does not leak across users.

**Behavior Isolation:** Layered CLAUDE.md — global instructions (analysis methodology, output format) plus per-user department context (marketing ROI focus, legal compliance focus).

### Skill Persistence

Each session launches with `HOME=/persistent/users/{user}`. Claude Code's `~/.claude/skills/` resolves to a Docker Volume path that survives container restarts.

| Scope | Path | Persistent | Manager |
|-------|------|-----------|---------|
| Enterprise (shared) | `/persistent/shared/.claude/skills/` (read-only mount) | ✅ | Admin |
| Personal | `$HOME/.claude/skills/` → `/persistent/users/{user}/.claude/skills/` | ✅ | User |
| Session | `{work_dir}/.claude/skills/` | ❌ | Temporary |

Priority: enterprise > personal > project. Users create personal skills via natural language ("turn this analysis into a reusable tool"). Claude's built-in `/skill-creator` generates the SKILL.md. Good personal skills can be submitted for admin review and promoted to enterprise-wide.

### Authentication

API Key only — no OAuth. One company key, shared across all users. No browser redirects, no token expiration. Isolation happens at workspace/session level.

### Unified Python Environment

One pre-built environment covering all departments: pandas, numpy, matplotlib, seaborn, plotly, autogluon, scikit-learn, xgboost, scipy, statsmodels, jieba, pdfplumber, python-docx, python-pptx. If a user needs a missing package, Claude Code runs `pip install` automatically — the environment enriches over time.

---

## 5. Security

### Deployment Model

Single Docker container on an internal Singapore server. No host filesystem access, no corporate network access, no MCP to company resources. Disposable — destroy and rebuild from base image in minutes.

### Threat Model

| # | Threat | Key Mitigation |
|---|--------|---------------|
| 1 | **Prompt injection via files** | iptables outbound whitelist blocks exfiltration. API key via proxy — never in container environment. |
| 2 | **Container escape** | Non-root (`--user 1000:1000`), `--cap-drop=ALL`, read-only rootfs, no Docker socket, `--security-opt=no-new-privileges`. Optional gVisor. |
| 3 | **Network exfiltration** | Default-deny iptables. Whitelist: LLM APIs + PyPI + npm. All HTTPS logged. HTTP/SSH blocked. |
| 4 | **Cross-user data leakage** | chmod 700 workspaces, unique session IDs, CLAUDE.md hygiene. |
| 5 | **Malicious packages** | Network whitelist blocks phone-home. Packages ephemeral (lost on restart). Optional pip whitelist. |
| 6 | **Resource exhaustion** | `--memory=8g --cpus=4`, `--max-turns`, disk quotas. |
| 7 | **API key theft** | Proxy-based injection or Docker secrets. CLAUDE.md: never output env vars. |

### Permission Lockdown

```json
{
  "permissions": {
    "allow": ["Bash(python *)", "Bash(pip install *)", "Read",
              "Write(*.py)", "Write(*.csv)", "Write(*.png)", "Write(*.xlsx)", "Grep"],
    "deny":  ["mcp__*", "Bash(rm -rf *)", "Bash(curl *)", "Bash(wget *)",
              "Bash(ssh *)", "Bash(sudo *)", "Bash(apt *)"]
  }
}
```

Defense in depth: even if the firewall allows HTTPS, `Bash(curl *)` is denied at tool level. Both layers must be breached.

### Firewall Script

```bash
iptables -P OUTPUT DROP
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# LLM APIs
iptables -A OUTPUT -p tcp --dport 443 -d api.anthropic.com -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d coding.dashscope.aliyuncs.com -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d api.deepseek.com -j ACCEPT
# Package registries
iptables -A OUTPUT -p tcp --dport 443 -d pypi.org -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d files.pythonhosted.org -j ACCEPT
# All HTTPS with logging (for web research)
iptables -A OUTPUT -p tcp --dport 443 -j LOG --log-prefix "HTTPS-OUT: "
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
# Block everything else
iptables -A OUTPUT -j REJECT
```

### Unmitigated Risks

Claude sees all data it processes (inherent to cloud LLM). Agent may produce incorrect analysis (require human review). Users may upload sensitive data inappropriately (policy problem, not technical).

---

## 6. Cost Analysis

### Model Providers

Chinese AI companies offer Anthropic-compatible API endpoints usable inside Claude Code with two environment variables — no code changes.

| Provider | Price (50 users) | Models | Compliance |
|----------|-----------------|--------|------------|
| **Alibaba Bailian (pay-as-you-go)** | ~$50–200/mo | Qwen3.5 + GLM-5 + Kimi K2.5 + MiniMax | ✅ Clean |
| **DeepSeek API** | ~$52/mo (¥375) | DeepSeek-V3.2 | ✅ Clean |
| **Z.AI GLM** | $3–30/mo | GLM-4.7 / GLM-5 | ⚠️ Check ToS |
| **MiniMax** | $10–50/mo | MiniMax-M2.5 | ⚠️ Check ToS |
| **Kimi (Moonshot)** | Pay-as-you-go | Kimi K2.5 (1T params, 256K context) | ✅ |
| **Claude API (Sonnet)** | $2,500–3,750/mo | Sonnet / Opus | ✅ Best quality |

Server cost: ¥500–800/mo (~$70–110) for 8C32G on Alibaba/Tencent Cloud.

**Total platform cost: ~$120–310/month** (server + API) for 50 users, or **$2–6 per user/month**.

### Cost Comparison

| Approach | Per User/Month |
|----------|---------------|
| **Our platform** | **$2–6** |
| Claude Cowork (Pro) | $20 |
| Claude Cowork (Max) | $100–200 |
| ChatGPT per seat | $20–200 |
| Copilot Cowork + M365 | $66–87 |
| Tableau | $70–150 |
| Hiring analysts (3–5 people) | $400–1,000 equivalent |

---

## 7. Competitive Analysis

### Platform Comparison

| Dimension | Our Platform | Claude Cowork | Tencent WorkBuddy | MS Copilot Cowork |
|-----------|-------------|--------------|-------------------|------------------|
| **Deployment** | Centralized server | Per-user desktop | Per-user desktop | Cloud (M365) |
| **Admin control** | ✅ 7-layer stack | ⚠️ Org toggle; **no Cowork audit logs** | ⚠️ Sandbox; no admin console | ✅ Full M365 governance |
| **Code execution** | ✅ Full Python | ✅ Local VM | ✅ Docker/E2B | ⚠️ M365 workflows only |
| **Custom packages** | ✅ Admin control | Users install freely | Limited | ❌ |
| **Multi-model** | ✅ Any via API Key | ❌ Claude only | ✅ Chinese models | ❌ Claude via Azure |
| **Skills** | ✅ 40K+ community | Plugins (curated) | 20+ built-in + OpenClaw | N/A |
| **User skill creation** | ✅ Via natural language | ✅ | ❌ | ❌ |
| **IM integration** | Via browser | Mobile remote | ✅ WeCom/DingTalk native | Teams native |
| **Cost (50 users)** | **$120–310/mo** | $1K–10K/mo | Free (credits) | $3.3K–4.4K/mo |
| **Audit trail** | ✅ Server-side logging | ❌ Not in audit/compliance API | ⚠️ Claimed, unverifiable | ✅ M365 audit |

**Claude Cowork** is the closest competitor. Its critical gap: Cowork activity is excluded from audit logs, Compliance API, and data exports — even on Enterprise tier. For a manufacturing company needing centralized control and cost efficiency, our platform is superior. If Anthropic closes this gap, Cowork on Enterprise becomes a viable alternative at $20–200/user/month.

**Tencent WorkBuddy** has valuable DingTalk integration but no centralized admin management. Tencent announced "Enterprise Lobster" but it does not exist yet. Worth monitoring.

**MS Copilot Cowork** has the strongest enterprise governance (M365 stack) but is a workflow automation tool, not a data science platform — it cannot train models or execute arbitrary Python. Also 20–30x more expensive per user, with uncertain China availability.

### Seven-Layer Admin Control Stack

1. **Model** — Provider, API key rotation, budget caps, routing (cheap model for simple tasks, strong for complex)
2. **Tool** — `settings.json` allow/deny per command
3. **Behavior** — CLAUDE.md global + per-department instructions
4. **Environment** — Base image packages, pip policy, resource limits
5. **Network** — iptables whitelist, egress logging
6. **User** — Workspace provisioning, session management, quotas, monitoring
7. **Skills** — Shared skill installation, personal skill policy, community whitelist

### Adjacent Tool Positioning

**Dify:** Keep for fixed workflows (invoice OCR → ERP), knowledge base Q&A, chatbots. Do not use for data analysis or code execution.

**OpenClaw** (247K GitHub stars): Complementary personal automation agent (email, calendar, messaging via DingTalk/WeChat). Can share the same API key. Security concern: Cisco found data exfiltration in third-party skills; China restricted state agency use (March 2026). Evaluate in non-sensitive context only.

---

## 8. UI/UX Design

Full design in separate document (`UI_Design_Recommendation_工具箱与交互设计.md`). Summary:

**Trigger architecture:** (1) Auto-trigger — skills load on description match, transparent to user; (2) Smart suggestions — floating cards after agent responses; (3) Toolbox panel — browsable capabilities organized by business scenario.

**Design principle:** Expose "what you can get" (PPT, Excel, reports) and "what it can analyze" (data exploration, prediction). Never expose "how it works" (sub-agents, multi-agent, deep research) as buttons. What determines analysis depth is how specifically the user describes their problem — not which button they click.

**User skill creation:** Describe repetitive workflows in natural language → Claude creates personal skill → persists in `$HOME/.claude/skills/` → "⭐ My Skills" in toolbox → submit for admin review to promote to shared.

**Admin backend:** Separate from user UI. Manages skill visibility/triggers, department access, usage stats, community whitelist, sharing approval queue.

---

## 9. Implementation Roadmap

| Phase | Timeline | Activities | Success Criteria |
|-------|----------|-----------|-----------------|
| **1. Solo PoC** | Week 1 | Install Claude Code + scientific skills + CloudCLI. Test with real CSV. | Upload → analysis → chart → report works end-to-end |
| **2. IT Pilot** | Week 2–3 | Shared server, nginx + basic auth. 3–5 IT team members. | 3+ real analyses per tester. Friction points identified. |
| **3. Seed Users** | Week 3–4 | 2–3 users from marketing/finance/ops. Real-world feedback. | Seed users independently complete department-specific analyses. |
| **4. Decision** | Month 1 end | Choose model provider, finalize security, write CLAUDE.md files. | Documented decision on model, security, scaling plan. |
| **5. Rollout** | Month 2+ | Full security stack. Onboard departments in waves. Custom skills. | 20+ active users across 3+ departments. |

---

## 10. Compliance: The OpenClaw Incident

In late 2025, OpenClaw extracted OAuth tokens from Claude subscriptions for autonomous agents — flat-rate subscribers consumed $1,000+ worth of API compute. Anthropic responded with silent server-side blocks (Jan 9, 2026), then a formal ban on subscription OAuth in any third-party tool (Feb 17–18, 2026). Detection method: usage pattern analysis.

**Implications:** Using Claude Code CLI (official binary) is compliant. Web UI wrappers calling the real CLI are gray area but not targeted. **API Key for multi-user deployments is the only fully safe approach** — hence our recommendation. Sharing one subscription across users carries risk if patterns are anomalous.

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Anthropic tightens CLI policies | Low-Med | High | Maintain custom agent + DeepSeek fallback |
| Incorrect analysis output | Medium | Medium | Human review required; CLAUDE.md validation rules |
| CloudCLI abandoned | Low | Low | MIT-licensed alternatives; architecture is simple |
| Environment drift (pip installs) | Medium | Low | Weekly snapshots; package whitelist |
| Prompt injection | Medium | High | Firewall blocks exfiltration; tool-level deny rules |
| Container escape | Very Low | Critical | Non-root; drop caps; no Docker socket; patch runc |
| Cross-user data leakage | Low | High | chmod 700; session isolation; process restart |
| API key theft | Low | High | Proxy injection or Docker secrets |
| Sensitive data to LLM API | Medium | High | User training; zero-retention API; self-hosted option |

---

## 12. References

### Repositories

| Repository | Purpose |
|-----------|---------|
| siteboon/claudecodeui | CloudCLI web UI — Claude Code + Cursor CLI + Codex |
| K-Dense-AI/claude-scientific-skills | 170+ scientific skills |
| alirezarezvani/claude-skills | 192 cross-platform skills |
| anthropics/skills | Official skills including skill-creator |

### Documentation

- Claude Code devcontainer (security reference): code.claude.com/docs/en/devcontainer
- Claude Code skills: code.claude.com/docs/en/skills
- Claude Code sub-agents: code.claude.com/docs/en/sub-agents
- Docker container security: docs.docker.com/engine/security/
- Agent Skills specification: agentskills.io/specification
- OpenClaw model providers: docs.openclaw.ai/concepts/model-providers

---

## Glossary

| Term | Definition |
|------|-----------|
| **Agent Loop** | Autonomous cycle: plan → code → execute → read output → iterate |
| **Claude Code** | Anthropic's CLI tool running an AI agent in the terminal |
| **CloudCLI** | Open-source web UI wrapping CLI agents in a browser (siteboon/claudecodeui) |
| **Skills** | SKILL.md instruction packages providing domain expertise |
| **MCP** | Model Context Protocol — connects agents to external tools/data |
| **Sub-Agent** | Independent Claude instance spawned via Agent tool for parallel work |
| **CLAUDE.md** | Project-level instruction file customizing agent behavior |
| **iptables** | Linux kernel firewall controlling container network traffic |
| **Prompt Injection** | Attack where malicious data content tricks AI into unintended actions |

---

*March 2026. The AI agent ecosystem is evolving rapidly — validate assumptions before major investment decisions.*
