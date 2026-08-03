# Playbook — Build a Feature

> The end-to-end procedure for adding a feature to RevenueOS. Follow it top to bottom. The
> final section (Documentation Rules) is **mandatory** — a feature isn't done until the repo
> is smarter for it.

## 0. Before you start
- Read `memory/project-state.md`, `memory/active-features.md`, and `../ROADMAP.md`.
- Check `skills/` and `patterns/` for existing guidance you should reuse.
- Add the feature to `memory/active-features.md` (status: in progress).

## 1. Clarify
- For every part of the feature, apply the SVT lens: *Can it be simpler? Can it wait? Does it
  move revenue? Does the customer care? Does AI improve it? Should it be deterministic?*
- Decide per capability: traditional software / workflow / AI agent / tool / background job /
  scheduled job / human approval / RAG / memory / search.

## 2. Design
- Data: which collection(s)? Update/define schema per `skills/database/design-schema.md`.
- API: which endpoints? Follow `patterns/api-pattern.md`.
- Logic: service functions per `patterns/service-pattern.md`.
- UI: screens/states per `patterns/ui-pattern.md`.
- AI: any tools? Follow `skills/ai/write-ai-tool.md` (permission + approval gating).
- Record any non-obvious decision in `DECISIONS.md`.

## 3. Build (thin vertical slice first)
Data layer → service → route handler → UI → wire up. Get one end-to-end path working before
breadth. Keep TypeScript strict-clean throughout.

## 4. Verify
- Unit-test services and guards (`skills/testing/write-tests.md`).
- Exercise the real flow end-to-end (drive the app, not just tests).
- Check the four UI states (loading/empty/error/data) and the failure states.

## 5. Documentation Rules (mandatory — do all seven)
1. Update project docs (`PROJECT.md` / relevant `knowledge/*`).
2. Update repo memory: move the feature to `memory/completed-features.md`; update
   `memory/project-state.md`.
3. Record architectural decisions in `DECISIONS.md`.
4. If any code shape repeated, promote it to `patterns/`.
5. Update or create the relevant `skills/*`.
6. Record lessons learned in `memory/known-issues.md`; log any shortcut in
   `memory/technical-debt.md`.
7. Confirm docs match the implementation.

## 6. Ship
Open a PR, run `review-pr.md`, then `release.md`.
