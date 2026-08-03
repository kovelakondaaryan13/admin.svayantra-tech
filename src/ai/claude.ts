/** Anthropic client + model config. Guide: .claude/skills/prompts/prompt-engineering.md */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const claude = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY() });

/** Default model for the orchestrator (see .claude/knowledge/architecture). */
export const MODEL = "claude-sonnet-5";
