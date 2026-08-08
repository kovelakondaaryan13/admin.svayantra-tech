/** Anthropic client + model config. Guide: .claude/skills/prompts/prompt-engineering.md */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const claude = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY() });

/**
 * Default model for every Claude call in the app (orchestrator, proposal drafting,
 * lead-import mapping, summaries, knowledge Q&A, etc.) — see .claude/knowledge/architecture.
 * Haiku 4.5: Anthropic's current cost-efficient model, built for agentic/tool-use work at
 * a fraction of Sonnet's per-token cost while retaining strong tool-calling and instruction-
 * following quality. Bump back to `claude-sonnet-5` here (one line) if answer quality on a
 * specific feature ever needs it.
 */
export const MODEL = "claude-haiku-4-5-20251001";
