/** Domain entities for the full v1 surface. Collections: .claude/knowledge/database/ */
import type { ObjectId } from "mongodb";

export interface BaseDoc {
  _id: ObjectId;
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  /** Data-isolation workspace for CONTENT collections (leads, tasks, deals, …). Identity
   *  and config collections leave this unset. See src/lib/workspace.ts. */
  workspace?: "demo" | "production";
}

export type Money = { amountMinor: number; currency: "INR" | "USD" };

export interface Company extends BaseDoc {
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  revenueEstimate?: string; // e.g. "₹40Cr" — annual revenue estimate
  ownerId: string;
  notes?: string;
}

export interface Contact extends BaseDoc {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  companyId?: string;
  ownerId: string;
}

export type TaskStatus = "open" | "done";
export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly";
export interface TaskComment {
  authorId: string;
  authorName: string;
  text: string;
  at: Date;
}
export interface Task extends BaseDoc {
  title: string;
  status: TaskStatus;
  priority?: "low" | "medium" | "high";
  dueAt?: Date;
  assigneeId: string;
  createdById?: string; // who created/assigned it
  leadId?: string;
  companyId?: string;
  followers?: string[]; // userIds watching this task
  comments?: TaskComment[];
  dependsOn?: string[]; // task ids that must finish first
  recurrence?: TaskRecurrence;
  /** Set once best-effort-synced to the assignee's connected Google Calendar. */
  googleEventId?: string;
}

export interface Meeting extends BaseDoc {
  title: string;
  at: Date;
  ownerId: string;
  leadId?: string;
  contactId?: string;
  companyId?: string; // links a meeting to a company even before/without a deal
  notes?: string;
  videoUrl?: string; // join link, e.g. Google Meet
  videoProvider?: "google_meet";
  /** Populated by a future transcription/notes integration — optional today. */
  transcript?: string;
  summary?: string;
  attendees?: string[];
  actionItems?: string[];
  /** Set once best-effort-synced to the owner's connected Google Calendar. */
  googleEventId?: string;
}

/** Append-only activity timeline entry. */
export interface Activity extends BaseDoc {
  entityType: "lead" | "company" | "contact" | "task" | "meeting" | "proposal" | "quotation" | "document" | "employee" | "workflow" | "conveyor_team" | "issue";
  entityId: string;
  kind: string; // e.g. "created", "stage_changed", "note"
  summary: string;
  actorId: string;
}

export interface Notification extends BaseDoc {
  userId: string;
  type: string;
  message: string;
  read: boolean;
  link?: string;
}

export type IssueStatus = "open" | "investigating" | "resolved" | "closed";

/** A "Raise Issue" report from the profile page. The AI attempts to resolve it first
 *  (see ai/classify-issue.ts); if it can't, the issue is auto-assigned to the Owner. */
export interface Issue extends BaseDoc {
  title: string;
  description: string;
  reporterId: string;
  status: IssueStatus;
  assigneeId?: string;
  aiResponse?: string; // the AI's attempted answer, shown to the reporter immediately
  aiResolved: boolean; // true when the AI's own answer closed it without a human
  resolvedAt?: Date;
}

export type ProposalStatus = "draft" | "pending_approval" | "approved" | "sent";
export interface Proposal extends BaseDoc {
  leadId: string;
  title: string;
  status: ProposalStatus;
  /** AI-drafted narrative sections; numbers are NOT model-authored. */
  sections: { heading: string; body: string }[];
  amount: Money;
  ownerId: string;
}

export type QuotationStatus = "draft" | "pending_approval" | "approved";
export interface QuotationLineItem {
  description: string;
  quantity: number;
  unitMinor: number; // integer minor units
}
export interface Quotation extends BaseDoc {
  leadId: string;
  currency: "INR" | "USD";
  lineItems: QuotationLineItem[];
  subtotalMinor: number; // computed by software, never by the model
  taxMinor: number;
  totalMinor: number;
  status: QuotationStatus;
  ownerId: string;
}

export type DTO<T extends BaseDoc> = Omit<T, "_id"> & { id: string };
