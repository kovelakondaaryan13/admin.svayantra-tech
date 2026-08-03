/** Multi-tenant org structure: Organization → Departments → Teams → Employees, plus
 *  custom roles and per-user permission overrides. All scoped by orgId (tenant isolation). */
import type { BaseDoc } from "@/lib/entities";

export type OrgPlan = "startup" | "growth" | "scale" | "enterprise";

export interface Organization extends BaseDoc {
  name: string;
  slug: string;
  ownerUserId: string;
  plan: OrgPlan;
  status: "active" | "suspended";
}

export interface Department extends BaseDoc {
  name: string;
  leadUserId?: string;
}

export interface Team extends BaseDoc {
  name: string;
  departmentId: string;
  leadUserId?: string;
}

export type EmployeeStatus = "active" | "invited" | "suspended";

export type EmployeeAvailability = "available" | "busy" | "away";

export interface Employee extends BaseDoc {
  userId: string; // Better Auth user id
  name: string;
  email: string;
  roleKey: string; // system role key or custom role key
  title?: string; // job title (distinct from role)
  departmentId?: string;
  teamId?: string;
  managerUserId?: string;
  phone?: string;
  status: EmployeeStatus;
  // --- Work Execution Engine (Sprint 10) ---
  skills?: string[];
  capacity?: number; // max concurrent open work items before "overloaded"
  availability?: EmployeeAvailability;
  /** Default sales execution model this person works in (used as the default for leads
   *  they create; the actual model still lives on each Lead). "individual" ≈ full-cycle. */
  defaultExecutionModel?: "individual" | "conveyor";
  avatarUrl?: string;
  kpis?: { label: string; value: string }[]; // current performance snapshot (display)
  joinedAt: Date;
  googleConnected?: boolean;
}

/** Organization-defined custom role. `key` is unique within the org. */
export interface CustomRole extends BaseDoc {
  key: string;
  label: string;
  permissions: string[];
}

/** Per-user permission overrides layered on top of the role. */
export interface UserPermissionOverride extends BaseDoc {
  userId: string;
  grants: string[];
  denies: string[];
}
