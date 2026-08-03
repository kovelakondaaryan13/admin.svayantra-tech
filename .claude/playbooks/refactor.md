# Playbook — Refactor

> Change the shape of the code without changing its behavior. Safety comes from tests and
> small steps, not from courage.

## 1. Justify
- State the goal: reduce duplication, clarify a boundary, improve performance, pay down a
  named debt (`memory/technical-debt.md`). "It feels cleaner" is not enough — tie it to a
  concrete benefit.
- If the refactor is because a pattern now appears 2+ times, plan to promote it to
  `patterns/` (Knowledge-evolution rule).

## 2. Protect
- Ensure behavior is covered by tests **before** changing anything. Add characterization tests
  for the current behavior if coverage is thin.

## 3. Refactor in small, reversible steps
- One transformation at a time; keep the suite green after each step.
- Preserve public contracts (API shapes, service signatures) unless the refactor's purpose is
  to change them — in which case update all call sites and record it in `DECISIONS.md`.
- Don't mix behavior changes into a refactor PR. Refactor and feature work stay separate.

## 4. Verify
- Full test suite green; exercise affected flows end-to-end; check bundle/query performance
  didn't regress.

## 5. Document
- Promote the extracted pattern to `patterns/*`; update affected `skills/*`.
- Update `memory/technical-debt.md` (close the debt) and `memory/project-state.md` if the
  architecture shifted. Record boundary changes in `DECISIONS.md`.
