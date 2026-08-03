# PROJECT.md — RevenueOS

> Product summary and single source of truth for "what are we building and why."
> Full detail lives in `../REVENUEOS_BLUEPRINT.md` (Phase-0 blueprint, Parts 1–8) once
> generated. This file stays short and current.

## One-liner

**RevenueOS** is an AI-native operating system for sales organizations — the first module of
Svayantra Tech's **ABOS (Autonomous Business Operating System)** vision.

## The thesis

Traditional CRMs help humans manage work. RevenueOS lets **AI orchestrate the work** while
**humans make high-value decisions** and **deterministic software executes**. Employees rarely
navigate complex software; they ask the AI: *"What should I work on?"*, *"Generate a
proposal."*, *"Show pipeline health."*, *"Prepare me for today's meeting."*, *"Why are deals
slowing down?"*

## Core modules (target scope)

Lead Management · Companies · Contacts · Task Management · Conveyor-Belt Sales Workflow ·
Meeting Preparation · Proposal Generation · Quotation Generation · AI Chat · Executive /
Sales / Manager Dashboards · Knowledge Search · Activity Timeline · Audit Logs ·
Notifications · Settings · Authentication.

## Two data categories (Knowledge Layer)

- **Operational data → MongoDB.** Leads, tasks, companies, meetings, activities, assignments,
  proposals, quotations, notifications.
- **Knowledge → Notion.** SOPs, playbooks, case studies, meeting notes, architecture docs,
  research, product & client documentation.

The AI searches **both** sources seamlessly.

## User roles

Founder · Head of Sales · Sales Representative · Operations. *(Future: Clients, Admins,
Managers.)*

## AI philosophy

Never use AI where deterministic software is better. For every feature decide whether it is:
traditional software · workflow · AI agent · tool · background job · scheduled job · human
approval · RAG · memory · search.

## Design bar

Feels like Linear · Notion · Cursor · Arc · Stripe Dashboard. Clean, fast, minimal, AI-first,
modern.

## Real-company context (from internal SVT docs — `[REAL]`)

Svayantra Tech is a real early-stage, founder-led AI-automation company in India. Notes that
shape (and challenge) this brief are recorded in `knowledge/business/`. Notably: the internal
docs describe the first wedge as an **AR / invoice→payment follow-up agent, WhatsApp-native
for Indian MSMEs** — and warn *against* selling the product as an "operating system." The
resolution adopted here: **internal architecture = OS, external pitch = one painful
workflow.** See `knowledge/business/svt-context.md`.

## Status

**Phase 0 — Product Discovery & Master Planning.** No application code yet. This `.claude/`
environment (Part 9) is the first deliverable in place.
