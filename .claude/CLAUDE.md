# CLAUDE.md — RevenueOS Development Guide

This file is the entry point for any human or AI (Claude Code) working in this repository.
Read it first. It explains how the repo's knowledge base works and the conventions every
change must follow.

> **The core idea:** this repository is an *evolving engineering knowledge base*. Every
> important change should leave the repo smarter than it found it. Over time, Claude should
> spend **less** effort rediscovering context and **more** effort building new capability.

---

## What this project is

**RevenueOS** — the first module of Svayantra Tech's long-term **ABOS (Autonomous Business
Operating System)** vision. RevenueOS is an **AI-native operating system for sales orgs**:
AI orchestrates the work, humans make high-value decisions, deterministic software executes.

See `PROJECT.md` for the product summary and `../REVENUEOS_BLUEPRINT.md` for the full Phase-0
blueprint (Parts 1–8) once generated.

## Tech stack (authoritative)

| Layer        | Choice                                             |
|--------------|----------------------------------------------------|
| Frontend     | Next.js (App Router), React, TailwindCSS, shadcn/ui|
| Backend      | Next.js Route Handlers                             |
| Database     | MongoDB Atlas + official `mongodb` driver          |
| Auth         | Better Auth                                        |
| AI           | Claude API (Anthropic)                             |
| Knowledge    | Notion API                                         |
| Email        | Resend                                             |
| Storage      | Cloudinary                                         |
| Deploy       | Vercel                                             |
| Monitoring   | Sentry                                             |
| Analytics    | PostHog                                            |

Do not introduce alternatives without recording a decision in `DECISIONS.md`.

---

## How the knowledge base is organized

```text
.claude/
    CLAUDE.md        ← you are here: dev guide + conventions
    PROJECT.md       ← what RevenueOS is (product summary)
    ROADMAP.md       ← milestones (mirrors blueprint Part 8)
    DECISIONS.md     ← append-only architectural decision log (ADR)

    skills/          ← reusable "how to do task X" guides, by domain
    knowledge/       ← extracted, durable knowledge (product/eng/business/…)
    playbooks/       ← step-by-step procedures for recurring workflows
    patterns/        ← canonical implementation patterns to copy
    prompts/         ← role prompts to spin up focused Claude modes
    memory/          ← structured, always-current self-description of the repo
```

- **skills/** — reusable across *all* future SVT products, not just RevenueOS. Template:
  Purpose · When to use · Best practices · Common mistakes · Code conventions · Examples ·
  Checklist.
- **knowledge/** — the durable "why/what" that outlives any one PR.
- **playbooks/** — the procedure to run for a class of task (build a feature, fix a bug…).
- **patterns/** — the canonical shape new code copies. A pattern seen more than once in the
  codebase gets promoted here.
- **prompts/** — focused working modes (planner, architect, reviewer, debugger, refactor,
  product-manager).
- **memory/** — current state of the project; always kept in sync with reality.

---

## The one rule that keeps this alive — Documentation Rules

Whenever a **major feature** is completed, before it is considered done you MUST:

1. Update the project documentation (`PROJECT.md` / relevant `knowledge/`).
2. Update repository memory (`memory/*`).
3. Record any architectural decisions (`DECISIONS.md`).
4. Add reusable implementation patterns (`patterns/`).
5. Update or create relevant skills (`skills/`).
6. Record lessons learned (`memory/known-issues.md` / knowledge notes).
7. Keep the documentation synchronized with the implementation.

Documentation is part of the deliverable — not an afterthought. See
`playbooks/build-feature.md` for the exact end-of-feature checklist.

## Knowledge-evolution rule

If a pattern or piece of reasoning appears **more than once**, convert it into reusable
documentation: a `patterns/*` file, a `skills/*` guide, or a `playbooks/*` procedure. The
goal is to reduce duplicated reasoning over time.

---

## Conventions (summary — full detail in `patterns/` and `knowledge/engineering/`)

- **Language:** TypeScript everywhere. `strict` on.
- **API:** thin route handlers → service layer → data layer. See `patterns/api-pattern.md`.
- **Data:** all Mongo access goes through a typed data-access layer, never inline in a route.
  See `patterns/database-pattern.md`.
- **AI:** every AI tool is declared, typed, and permission-gated. Writes to revenue data
  require human approval in v1. See `skills/ai/write-ai-tool.md`.
- **Naming:** `camelCase` variables/functions, `PascalCase` components/types,
  `kebab-case` files, plural `camelCase` Mongo collections (`leads`, `auditLogs`).
- **Every feature updates `memory/` and `DECISIONS.md` before merge.**

## For AI agents specifically

Before starting a task: (1) read `memory/project-state.md` and `memory/active-features.md`;
(2) check `skills/` and `playbooks/` for an existing guide; (3) check `patterns/` for the
canonical shape. After finishing: run the Documentation Rules above. Prefer the accumulated
knowledge over re-deriving it.
