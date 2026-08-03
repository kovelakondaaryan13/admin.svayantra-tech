"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/* ---------- Shared card shell ---------- */

function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`glass max-w-sm rounded-xl border border-overlay/[0.09] px-4 py-3 transition-all duration-200 ease-emphasized hover:-translate-y-0.5 hover:border-overlay/[0.16] hover:shadow-e2 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-xs">
      <span className="text-faint">{label}</span>
      <span className="truncate text-fg/80">{value}</span>
    </div>
  );
}

function CardActions({ actions }: { actions: { label: string; href: string }[] }) {
  return (
    <div className="mt-2.5 flex items-center gap-2 border-t border-overlay/[0.07] pt-2">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="rounded-lg bg-overlay/[0.06] px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-overlay/[0.12] hover:text-fg"
        >
          {a.label}
        </Link>
      ))}
    </div>
  );
}

/* ---------- Stage badge helper ---------- */

const STAGE_COLORS: Record<string, string> = {
  new: "badge-info",
  qualified: "badge-brand",
  proposal: "badge-warning",
  negotiation: "badge-warning",
  "closed-won": "badge-success",
  "closed-lost": "badge-danger",
  won: "badge-success",
  lost: "badge-danger",
};

function StageBadge({ stage }: { stage: string }) {
  const cls = STAGE_COLORS[stage.toLowerCase()] ?? "badge-neutral";
  return <span className={`badge ${cls}`}>{stage}</span>;
}

/* ---------- Priority badge helper ---------- */

const PRIORITY_COLORS: Record<string, string> = {
  critical: "badge-danger",
  high: "badge-danger",
  medium: "badge-warning",
  low: "badge-info",
  none: "badge-neutral",
};

function PriorityBadge({ priority }: { priority: string }) {
  const cls = PRIORITY_COLORS[priority.toLowerCase()] ?? "badge-neutral";
  return <span className={`badge ${cls}`}>{priority}</span>;
}

/* ---------- Status badge helper ---------- */

const STATUS_COLORS: Record<string, string> = {
  todo: "badge-neutral",
  "in-progress": "badge-brand",
  "in progress": "badge-brand",
  done: "badge-success",
  completed: "badge-success",
  blocked: "badge-danger",
  cancelled: "badge-danger",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status.toLowerCase()] ?? "badge-neutral";
  return <span className={`badge ${cls}`}>{status}</span>;
}

/* ====================================================================
   Public card components
   ==================================================================== */

export interface LeadCardProps {
  name: string;
  company?: string;
  stage?: string;
  owner?: string;
  value?: string;
  id?: string;
}

export function LeadCard({ name, company, stage, owner, value, id }: LeadCardProps) {
  return (
    <CardShell>
      <CardHeader icon="💼" title={name} subtitle={company} />
      <div className="space-y-0.5">
        {stage && (
          <div className="flex items-center justify-between py-0.5 text-xs">
            <span className="text-faint">Stage</span>
            <StageBadge stage={stage} />
          </div>
        )}
        <DetailRow label="Owner" value={owner} />
        <DetailRow label="Value" value={value} />
      </div>
      {id && <CardActions actions={[{ label: "Open lead", href: `/work/${id}` }]} />}
    </CardShell>
  );
}

export interface CompanyCardProps {
  name: string;
  industry?: string;
  website?: string;
  dealCount?: number;
  id?: string;
}

export function CompanyCard({ name, industry, website, dealCount, id }: CompanyCardProps) {
  return (
    <CardShell>
      <CardHeader icon="🏢" title={name} subtitle={industry} />
      <div className="space-y-0.5">
        {website && (
          <DetailRow
            label="Website"
            value={
              <a href={website} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {website.replace(/^https?:\/\//, "")}
              </a>
            }
          />
        )}
        {dealCount != null && <DetailRow label="Deals" value={dealCount} />}
      </div>
      {id && <CardActions actions={[{ label: "Open company", href: `/companies/${id}` }]} />}
    </CardShell>
  );
}

export interface TaskCardProps {
  title: string;
  assignee?: string;
  priority?: string;
  dueDate?: string;
  status?: string;
  id?: string;
}

export function TaskCard({ title, assignee, priority, dueDate, status, id }: TaskCardProps) {
  return (
    <CardShell>
      <CardHeader icon="✅" title={title} />
      <div className="space-y-0.5">
        <DetailRow label="Assignee" value={assignee} />
        {priority && (
          <div className="flex items-center justify-between py-0.5 text-xs">
            <span className="text-faint">Priority</span>
            <PriorityBadge priority={priority} />
          </div>
        )}
        <DetailRow label="Due" value={dueDate} />
        {status && (
          <div className="flex items-center justify-between py-0.5 text-xs">
            <span className="text-faint">Status</span>
            <StatusBadge status={status} />
          </div>
        )}
      </div>
      {id && <CardActions actions={[{ label: "Open task", href: `/tasks/${id}` }]} />}
    </CardShell>
  );
}

export interface MeetingCardProps {
  title: string;
  date?: string;
  attendees?: string[];
  location?: string;
}

export function MeetingCard({ title, date, attendees, location }: MeetingCardProps) {
  return (
    <CardShell>
      <CardHeader icon="📅" title={title} subtitle={date} />
      <div className="space-y-0.5">
        <DetailRow label="Location" value={location} />
        {attendees && attendees.length > 0 && (
          <div className="py-0.5 text-xs">
            <span className="text-faint">Attendees</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {attendees.map((a) => (
                <span key={a} className="badge badge-neutral">{a}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </CardShell>
  );
}

export interface EmployeeCardProps {
  name: string;
  email?: string;
  role?: string;
  department?: string;
  id?: string;
}

export function EmployeeCard({ name, email, role, department, id }: EmployeeCardProps) {
  return (
    <CardShell>
      <CardHeader icon="👤" title={name} subtitle={email} />
      <div className="space-y-0.5">
        {role && (
          <div className="flex items-center justify-between py-0.5 text-xs">
            <span className="text-faint">Role</span>
            <span className="badge badge-brand">{role}</span>
          </div>
        )}
        <DetailRow label="Department" value={department} />
      </div>
      {id && <CardActions actions={[{ label: "Open profile", href: `/people/${id}` }]} />}
    </CardShell>
  );
}

export interface SuccessCardProps {
  title: string;
  message?: string;
  objectType?: string;
  objectId?: string;
  actions?: { label: string; href: string }[];
}

export function SuccessCard({ title, message, objectType, objectId, actions }: SuccessCardProps) {
  const defaultActions: { label: string; href: string }[] = [];
  if (objectType && objectId) {
    const hrefMap: Record<string, string> = {
      lead: `/work/${objectId}`,
      company: `/companies/${objectId}`,
      person: `/people/${objectId}`,
      task: `/tasks/${objectId}`,
      employee: `/people/${objectId}`,
    };
    const href = hrefMap[objectType.toLowerCase()];
    if (href) defaultActions.push({ label: `Open ${objectType}`, href });
  }
  const allActions = actions ?? defaultActions;

  return (
    <CardShell className="border-teal/20">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-teal/15 text-sm text-teal">
          ✓
        </span>
        <p className="text-sm font-semibold text-teal">{title}</p>
      </div>
      {message && <p className="text-xs leading-relaxed text-muted">{message}</p>}
      {allActions.length > 0 && <CardActions actions={allActions} />}
    </CardShell>
  );
}
