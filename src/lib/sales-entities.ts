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

/** One employee's stage assignment(s) within a conveyor team — an employee is never
 *  limited to a single stage/role. */
export interface ConveyorMemberRole {
  userId: string;
  stageKeys: string[];
}

/** Lightweight, flexible ideal-customer-profile criteria attached to a system. */
export interface IcpCriteria {
  industries?: string[];
  minCompanySize?: number;
  minBudgetMinor?: number;
  notes?: string;
}

/**
 * A "sales system" — either a Conveyor Belt (multi-employee, ownership moves stage to
 * stage per `memberRoles`) or an Individual Funnel (each member runs their own leads
 * end to end; `memberRoles`/`playbookKey` stage-mapping doesn't apply). Existing rows
 * predate `model` and are treated as `"conveyor"` when absent.
 */
export interface ConveyorTeam extends BaseDoc {
  name: string;
  model?: ExecutionModel;
  memberUserIds: string[];
  memberRoles?: ConveyorMemberRole[];
  playbookKey?: string;
  icp?: IcpCriteria;
}
