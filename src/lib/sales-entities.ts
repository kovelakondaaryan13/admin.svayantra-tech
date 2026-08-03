/**
 * Sales execution primitives: Operating Playbooks and Conveyor Teams. A playbook is a
 * reusable, configurable pipeline definition (stages + SLAs + criteria + AI prompts) that
 * either an individual seller or a conveyor team executes consistently. This is what makes
 * the sales pipeline a configurable operating system rather than a hardcoded workflow.
 */
import type { BaseDoc } from "@/lib/entities";
import type { ExecutionModel } from "@/lib/types";

export interface PlaybookStage {
  key: string; // maps to a LeadStage or a finer sub-stage
  label: string;
  slaHours?: number; // time budget for this stage
  ownerRole?: string; // roleKey that owns this stage (conveyor)
  entryCriteria?: string;
  exitCriteria?: string;
  aiPrompt?: string; // next-best-action guidance for the AI
  artifacts?: string[]; // required outputs before handoff
}

export interface Playbook extends BaseDoc {
  key: string;
  label: string;
  model: ExecutionModel;
  description?: string;
  stages: PlaybookStage[];
  kpis?: string[]; // headline KPIs this playbook is measured on
  enabled: boolean;
}

/** A conveyor team shares access to every conveyor lead assigned to it. */
export interface ConveyorTeam extends BaseDoc {
  name: string;
  memberUserIds: string[];
  playbookKey?: string;
}
