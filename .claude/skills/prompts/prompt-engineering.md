# Skill — Prompt Engineering (Claude)

## Purpose
Write and evolve the prompts that drive RevenueOS's AI — orchestrator system prompt, tool
descriptions, and task prompts (proposal drafting, meeting prep) — for reliability, safety,
and cost.

## When to use
Creating or changing any prompt sent to the Claude API. Every prompt change is tracked (see
Checklist) so prompt evolution is auditable.

## Best practices
- **Structure the system prompt:** role, capabilities, the tool contract, safety rules,
  output format. Keep it stable; put volatile context in the message, not the system prompt
  (protects prompt caching).
- **Tool descriptions are prompts.** Precise, action-oriented, with when-to-use guidance.
- **Ground, don't guess:** give the model retrieved context (RAG) rather than relying on
  memory; instruct it to say "I don't know / need X" instead of fabricating.
- **Safety rules explicit:** never mutate revenue data without approval; never invent numbers
  in proposals/quotations; cite the source doc for knowledge answers.
- **Deterministic where possible:** if software can produce the answer (totals, dates,
  pipeline math), compute it and give it to the model — don't ask the model to do arithmetic.
- **Model selection by task** (see `../../knowledge/architecture/ai-orchestration.md`): cheaper/
  faster model for classification/extraction, stronger model for reasoning/drafting.
- **Optimize tokens/cost:** trim context to what's needed, use prompt caching for stable
  prefixes, cap tool-output size, set sensible `max_tokens`.

## Common mistakes
- Stuffing volatile data into the system prompt (breaks caching, bloats tokens).
- Vague tool descriptions → wrong tool calls.
- Asking the model to do math/enforce rules that software should own.
- No safety rail on writes or on fabricated figures.

## Code conventions
- Prompts versioned in `ai/prompts/` (not inline string literals scattered in code).
- Each prompt file notes its purpose, model, and a changelog line on edit.

## Checklist
- [ ] System prompt: role / tools / safety / output format; stable prefix for caching
- [ ] Tool descriptions precise + when-to-use
- [ ] RAG-grounded; "don't fabricate" instruction present
- [ ] Safety rules: approval for writes, no invented numbers, cite sources
- [ ] Deterministic work moved out of the prompt
- [ ] Model chosen per task; tokens/caching/`max_tokens` considered
- [ ] Change logged (prompt evolution) in the prompt file + `memory/` if significant
