# Moss 🌿

Enterprise AI Agent Platform — Technical Strategy & Design Documentation

## Overview

Moss is an internal AI agent platform project that enables 50–100 non-technical employees to perform professional-grade data analysis, statistical modeling, and document generation through natural language — powered by Claude Code CLI + CloudCLI web interface + Docker sandbox.

## Documents

| Document | Language | Description |
|----------|----------|-------------|
| [Enterprise AI Agent Platform Report](docs/Enterprise_AI_Agent_Platform_Report.md) | English | Compact technical strategy report (architecture, security, cost, competitive analysis, roadmap) |
| [企业AI Agent平台 技术探索与策略报告](docs/企业AI_Agent平台_技术探索与策略报告.md) | 中文 | Detailed exploration report following the full research journey |
| [UI Design Recommendation](docs/UI_Design_Recommendation_工具箱与交互设计.md) | 中文 | UI/UX design for non-technical users (toolbox, smart suggestions, skill creation, admin backend) |

## Architecture at a Glance

```
Browser / DingTalk
    ↕ HTTPS
CloudCLI (Web UI)         ← Thin presentation layer
    ↕ PTY
Claude Code CLI           ← Complete agent kernel
    ↕ Agent loop
Skills + MCP + Sub-agents ← Domain expertise
    ↕
Python Environment        ← pandas, AutoGluon, sklearn...
    ↕
Docker Container          ← Sandboxed, firewalled
```

## Key Differentiators

- **Centralized** — One server, one deployment, all users via browser
- **Admin-Controlled** — 7-layer control stack (model, tools, behavior, environment, network, users, skills)
- **Low-Barrier** — Users type natural language, never see code
- **Multi-Model** — Swap between Claude, DeepSeek, Kimi, GLM, MiniMax via API key
- **User-Extensible** — Users create personal skills via natural language; best skills promoted to shared
- **Cost-Efficient** — ~$2–6/user/month vs $20–200 for commercial alternatives

## Status

📋 Research & design complete → Ready for Phase 1 prototyping

---

*March 2026*
