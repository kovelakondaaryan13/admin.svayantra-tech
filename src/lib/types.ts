/** Shared domain types. Collections documented in .claude/knowledge/database/. */
import type { ObjectId } from "mongodb";

/** Role key — a system role key (see lib/iam/roles) or a custom role key. */
export type Role = string;

export interface User {
  id: string; // Better Auth user id (string)
  email: string;
  name?: string;
  role: Role;
  orgId: string; // tenant scope
  /** Resolved effective permissions ("*" = owner/all). Attached by getUser. */
  permissions: string[];
  isOwner: boolean;
  departmentId?: string;
  teamId?: string;
  managerUserId?: string;
}

export type LeadStage =
  | "new"
  | "qualified"
  | "meeting"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export const LEAD_STAGES: LeadStage[] = [
  "new",
  "qualified",
  "meeting",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

/** Stages a deal is still active in (not yet won/lost) — shared by every metrics/scoring
 *  rollup so "open pipeline" means the same set of stages everywhere. */
export const OPEN_LEAD_STAGES: LeadStage[] = ["new", "qualified", "meeting", "proposal", "negotiation"];

export interface StageChange {
  from: LeadStage;
  to: LeadStage;
  at: Date;
  actorId: string;
}

export type LeadHealth = "green" | "yellow" | "red";

export type LeadSource =
  | "apollo"
  | "linkedin"
  | "website"
  | "referral"
  | "email"
  | "whatsapp"
  | "conference"
  | "manual"
  | "other";

export const LEAD_SOURCES: LeadSource[] = [
  "apollo", "linkedin", "website", "referral", "email", "whatsapp", "conference", "manual", "other",
];

/** Outbound touch channels — feed engagement scoring + the activity timeline. */
export type TouchChannel = "call" | "email" | "linkedin" | "whatsapp" | "meeting" | "other";

/**
 * Sales execution model:
 *  - individual: one rep owns the full customer journey (autonomy). Only the owner
 *    and managers may modify.
 *  - conveyor: the lead moves between specialists on a team; every team member has
 *    access, with per-stage ownership + SLAs.
 */
export type ExecutionModel = "individual" | "conveyor";

export interface OwnerHistoryEntry {
  ownerId: string;
  stage: LeadStage;
  at: Date;
}

export interface Lead {
  _id: ObjectId;
  orgId: string; // tenant scope — on every collection
  ownerId: string; // assigned rep (User.id)
  name: string;
  email?: string;
  company?: string;
  companyId?: string; // optional link to a Company record
  source?: LeadSource; // where the lead came from (attribution)
  campaign?: string; // campaign attribution
  touchCount?: number; // outbound engagement — number of touches logged
  lastTouchAt?: Date; // last time we reached out
  // --- Sales execution model (Sprint 10) ---
  executionModel?: ExecutionModel; // default "individual"
  conveyorTeamId?: string; // set when executionModel === "conveyor"
  playbookKey?: string; // the operating playbook this lead runs on
  currentStageOwnerId?: string; // who owns the CURRENT stage (conveyor)
  stageDeadline?: Date; // SLA deadline for the current stage
  ownerHistory?: OwnerHistoryEntry[]; // full ownership/handoff history
  workspace?: "demo" | "production"; // data-isolation workspace (see lib/workspace.ts)
  value?: { amountMinor: number; currency: "INR" | "USD" };
  stage: LeadStage;
  stageHistory: StageChange[]; // bounded; source of cycle-time analytics
  notes?: string;
  // --- Lead intelligence (Sprint 3) ---
  score?: number; // 0–100 ICP fit score
  intentScore?: number; // 0–100 buying-intent score (engagement/signals)
  health?: LeadHealth; // deal health at a glance
  probability?: number; // 0–100 win probability
  estimatedCloseAt?: Date;
  nextAction?: string;
  painPoints?: string[];
  competitors?: string[];
  buyingCommittee?: string[]; // decision-makers on the client side
  aiSummary?: string; // AI-generated narrative (cached)
  aiSummaryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/** Lead shape returned to clients (ObjectId serialized to string). */
export interface LeadDTO extends Omit<Lead, "_id"> {
  id: string;
}

export interface AuditEntry {
  _id: ObjectId;
  orgId: string;
  actorId: string; // user id, or "ai:<userId>" when the AI acted on a user's behalf
  action: string; // e.g. "lead.create", "lead.stage_changed"
  entity: string; // affected document id
  meta?: Record<string, unknown>;
  at: Date;
}
