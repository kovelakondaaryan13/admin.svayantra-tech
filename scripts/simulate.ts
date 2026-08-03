/**
 * STOS Simulation Engine — Sprint 12.
 *
 * Not a seed: a *simulation*. Running this makes STOS look like Svayantra Tech has been
 * operating on it for ~3 months — real org + departments, playbooks, conveyor teams,
 * companies across industries, a pipeline at every stage with BACKDATED 60–90 day history,
 * per-person work, past + upcoming meetings, knowledge the AI can retrieve, and a real
 * activity timeline. Every dashboard, AI briefing, and the Owner Command Center light up.
 *
 * Guarded by operating mode: refuses to run in Production mode (see src/lib/mode.ts).
 * Idempotent: wipes synthetic CONTENT for org "default" (keeps accounts + structure keys),
 * then rebuilds. NEVER touches the protected real owner account (aryangoud0913).
 *
 * Run: npm run simulate
 */
import { db } from "@/lib/mongo";
import { ObjectId } from "mongodb";
import { assertDemoMode, setOrgMode } from "@/lib/mode";
import { orgUnitService } from "@/services/org-unit-service";
import { playbookService } from "@/services/playbook-service";
import { conveyorTeamService } from "@/services/conveyor-team-service";
import { companyService } from "@/services/company-service";
import { contactService } from "@/services/contact-service";
import { leadService } from "@/services/lead-service";
import { taskService } from "@/services/task-service";
import { meetingService } from "@/services/meeting-service";
import { proposalService } from "@/services/proposal-service";
import { workflowService } from "@/services/workflow-service";
import { documentService } from "@/services/document-service";
import type { User, LeadStage } from "@/lib/types";

const ORG = "default";
const NOW = Date.now();
const DAY = 86_400_000;

const lakh = (n: number) => Math.round(n * 100000 * 100); // ₹ lakh -> paise
const inr = (n: number) => ({ amountMinor: lakh(n), currency: "INR" as const });
const daysAgo = (n: number) => new Date(NOW - n * DAY);
const daysAhead = (n: number) => new Date(NOW + n * DAY).toISOString();
const hoursAhead = (n: number) => new Date(NOW + n * 3600000).toISOString();
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
/** i-th of n points spread strictly between start and end. */
const spread = (start: number, end: number, i: number, n: number) =>
  new Date(start + ((end - start) * (i + 1)) / (n + 1));

function seedUser(userId: string, email: string, name: string, role: string): User {
  return { id: userId, email, name, role, orgId: ORG, permissions: ["*"], isOwner: true };
}

const STAGE_PATH: LeadStage[] = ["qualified", "meeting", "proposal", "negotiation", "won"];
async function advanceTo(id: string, target: LeadStage, actor: User) {
  if (target === "new") return;
  if (target === "lost") {
    await leadService.advance(id, "lost", { user: actor });
    return;
  }
  for (const stage of STAGE_PATH) {
    await leadService.advance(id, stage, { user: actor });
    if (stage === target) return;
  }
}

async function main() {
  const d = await db();

  // --- Mode guard: this is a demo operation. Default a fresh org to demo mode. ---
  await setOrgMode(ORG, "demo"); // no-op if already demo; makes intent explicit
  await assertDemoMode(ORG);

  // --- Resolve employees -> seed users ---
  const emps = await d
    .collection<{ email: string; name: string; roleKey: string; userId: string }>("employees")
    .find({ orgId: ORG })
    .toArray();
  const find = (email: string) => emps.find((x) => x.email === email);
  const by = (email: string) => {
    const e = find(email);
    if (!e) throw new Error(`missing employee ${email} — run: npm run add-people first`);
    return seedUser(e.userId, e.email, e.name, e.roleKey);
  };
  const owner = by("ownertest1@svayantra.tech");
  const rahul = by("rahul.verma@svayantra.tech"); // sales_head
  const priya = by("priya.sharma@svayantra.tech"); // sales_rep
  const anita = by("anita.desai@svayantra.tech"); // finance_head
  const vikram = by("vikram.rao@svayantra.tech"); // ops_manager
  const deblina = find("deblina@svayantra.tech"); // marketing (may be undefined pre-add-people)

  // --- Wipe synthetic CONTENT (keep accounts, workflow DEFS; rebuild structure idempotently) ---
  const wipe = [
    "leads", "companies", "contacts", "tasks", "meetings",
    "proposals", "quotations", "activities", "workflowInstances", "notifications", "documents",
  ];
  for (const c of wipe) await d.collection(c).deleteMany({ orgId: ORG });
  console.log("wiped content:", wipe.join(", "));

  // ============================ 1. ORGANIZATION ============================
  const deptDefs: { name: string; manager?: string; cap: number }[] = [
    { name: "Founder's Office", manager: owner.id, cap: 3 },
    { name: "Sales", manager: rahul.id, cap: 8 },
    { name: "Marketing", manager: deblina?.userId, cap: 4 },
    { name: "Operations", manager: vikram.id, cap: 6 },
    { name: "Finance", manager: anita.id, cap: 4 },
    { name: "Product", cap: 5 },
    { name: "Engineering", cap: 8 },
    { name: "HR", cap: 3 },
  ];
  const existingUnits = await orgUnitService.list(owner);
  const deptId: Record<string, string> = {};
  for (const dept of deptDefs) {
    const found = existingUnits.find((u) => u.name === dept.name);
    if (found) { deptId[dept.name] = found.id; continue; }
    const u = await orgUnitService.create(owner, {
      name: dept.name, type: "department", managerUserId: dept.manager ?? null, headcountCapacity: dept.cap,
    });
    deptId[dept.name] = u.id;
  }
  // Assign each employee to a department (role -> dept).
  const roleDept: Record<string, string> = {
    owner: "Founder's Office", super_admin: "Founder's Office",
    sales_head: "Sales", sales_rep: "Sales",
    marketing: "Marketing", ops_manager: "Operations",
    finance_head: "Finance", finance_exec: "Finance",
  };
  for (const e of emps) {
    const dn = roleDept[e.roleKey];
    if (dn && deptId[dn]) {
      await d.collection("employees").updateOne({ userId: e.userId, orgId: ORG }, { $set: { departmentId: deptId[dn] } });
    }
  }
  // Department KPIs + shared resources (stored in orgUnit metadata; shown on the org page).
  const deptMeta: Record<string, { kpis: { label: string; value: string }[]; resources: string[] }> = {
    "Founder's Office": { kpis: [{ label: "Revenue / qtr", value: "₹48L" }, { label: "Runway", value: "14 mo" }, { label: "Win rate", value: "31%" }], resources: ["Board deck", "Company OKRs", "Investor updates"] },
    Sales: { kpis: [{ label: "Quota attainment", value: "92%" }, { label: "Win rate", value: "31%" }, { label: "Avg cycle", value: "41d" }], resources: ["Sales playbooks", "Call scripts", "Pricing sheet", "Apollo seats"] },
    Marketing: { kpis: [{ label: "MQLs / mo", value: "120" }, { label: "Reply rate", value: "14%" }], resources: ["Brand kit", "Content calendar", "LinkedIn"] },
    Operations: { kpis: [{ label: "On-time delivery", value: "96%" }, { label: "CSAT", value: "4.6/5" }], resources: ["Runbooks", "QA suite", "Provisioning"] },
    Finance: { kpis: [{ label: "DSO", value: "38d" }, { label: "Gross margin", value: "64%" }], resources: ["Invoicing", "GST filings", "Payroll"] },
  };
  for (const [name, meta] of Object.entries(deptMeta)) {
    await d.collection("orgUnits").updateOne({ orgId: ORG, name, type: "department" }, { $set: { metadata: meta } });
  }

  // Employee KPI snapshots (shown on People).
  const empKpis: Record<string, { label: string; value: string }[]> = {
    owner: [{ label: "Revenue / qtr", value: "₹48L" }, { label: "Win rate", value: "31%" }],
    sales_head: [{ label: "Team quota", value: "104%" }, { label: "Forecast", value: "₹22L" }],
    sales_rep: [{ label: "Pipeline", value: "₹14L" }, { label: "Meetings / wk", value: "6" }, { label: "Reply rate", value: "12%" }],
    finance_head: [{ label: "DSO", value: "38d" }, { label: "Collected", value: "₹18L" }],
    ops_manager: [{ label: "On-time", value: "96%" }, { label: "Open tickets", value: "3" }],
    marketing: [{ label: "MQLs", value: "120" }, { label: "Posts / wk", value: "4" }],
  };
  for (const e of emps) {
    const k = empKpis[e.roleKey];
    if (k) await d.collection("employees").updateOne({ userId: e.userId, orgId: ORG }, { $set: { kpis: k } });
  }
  console.log("departments:", Object.keys(deptId).length, "(+ KPIs/resources, employee KPIs)");

  // ============================ 2. PLAYBOOKS ============================
  type PB = Parameters<typeof playbookService.create>[1];
  const conveyorStages = (roles: [string, string, string]) => [
    { key: "new", label: "Lead Sourcing", ownerRole: roles[0], slaHours: 24, exitCriteria: "Verified contact + reason to reach out", aiPrompt: "Draft a first-touch opener." },
    { key: "qualified", label: "Qualification", ownerRole: roles[0], slaHours: 24, exitCriteria: "ICP + budget + intent confirmed" },
    { key: "meeting", label: "Meeting Booking", ownerRole: roles[1], slaHours: 48, exitCriteria: "Discovery scheduled" },
    { key: "proposal", label: "Proposal", ownerRole: roles[2], slaHours: 72, artifacts: ["proposal"], aiPrompt: "Draft the proposal narrative from discovery notes." },
    { key: "negotiation", label: "Closing", ownerRole: roles[2], slaHours: 72 },
    { key: "won", label: "Client Handover", ownerRole: "ops_manager", artifacts: ["handover-checklist"] },
  ];
  const playbookDefs: PB[] = [
    { key: "founder-outbound", label: "Founder Outbound", model: "individual", description: "Founder-led, full-cycle enterprise outbound.", stages: [
      { key: "new", label: "Research & Target", slaHours: 24, exitCriteria: "Account + champion identified" },
      { key: "qualified", label: "Qualification", slaHours: 48, exitCriteria: "Strategic fit confirmed" },
      { key: "meeting", label: "Exec Meeting", slaHours: 72 },
      { key: "proposal", label: "Proposal", slaHours: 72, artifacts: ["proposal"] },
      { key: "negotiation", label: "Negotiation", slaHours: 120 },
      { key: "won", label: "Won / Handover", artifacts: ["handover-note"] },
    ] },
    { key: "enterprise-outbound", label: "Enterprise Outbound", model: "conveyor", description: "Specialist conveyor for large, multi-stakeholder deals.", stages: conveyorStages(["sales_rep", "sales_rep", "sales_head"]) },
    { key: "smb-outbound", label: "SMB Outbound", model: "conveyor", description: "High-velocity conveyor for SMB volume.", stages: conveyorStages(["sales_rep", "sales_rep", "sales_head"]) },
    { key: "inbound-qualification", label: "Inbound Lead Qualification", model: "conveyor", description: "Qualify and route inbound leads fast.", stages: [
      { key: "new", label: "Triage", ownerRole: "sales_rep", slaHours: 4, exitCriteria: "Spam filtered, intent read" },
      { key: "qualified", label: "Qualify", ownerRole: "sales_rep", slaHours: 12, exitCriteria: "ICP + intent confirmed" },
      { key: "meeting", label: "Route to AE", ownerRole: "sales_head", slaHours: 24 },
    ] },
    { key: "client-onboarding", label: "Client Onboarding", model: "individual", description: "Post-won onboarding to first value.", stages: [
      { key: "won", label: "Kickoff", slaHours: 48, artifacts: ["kickoff-deck"], exitCriteria: "Scope + timeline agreed" },
    ] },
    { key: "proposal-followup", label: "Proposal Follow-up", model: "individual", description: "Systematic follow-up after a proposal is sent.", stages: [
      { key: "proposal", label: "Proposal Sent", slaHours: 24, exitCriteria: "Receipt confirmed" },
      { key: "negotiation", label: "Follow-up & Negotiate", slaHours: 72 },
    ] },
    { key: "renewal-pipeline", label: "Renewal Pipeline", model: "individual", description: "Drive renewals before contract end.", stages: [
      { key: "qualified", label: "Renewal Review", slaHours: 168, exitCriteria: "Usage + health reviewed" },
      { key: "negotiation", label: "Renewal Negotiation", slaHours: 168 },
      { key: "won", label: "Renewed", artifacts: ["renewal-order"] },
    ] },
    { key: "referral-pipeline", label: "Referral Pipeline", model: "individual", description: "Convert warm referrals with a light-touch flow.", stages: [
      { key: "new", label: "Intro Received", slaHours: 24 },
      { key: "meeting", label: "Intro Call", slaHours: 48 },
      { key: "proposal", label: "Proposal", slaHours: 72 },
      { key: "won", label: "Won", artifacts: ["thank-referrer"] },
    ] },
  ];
  const havePb = new Set((await playbookService.list(owner)).map((p) => p.key));
  for (const pb of playbookDefs) {
    if (havePb.has(pb.key)) continue;
    const kpis = pb.model === "conveyor"
      ? ["SLA compliance %", "Stage conversion %", "Avg handoff time"]
      : ["Win rate %", "Sales cycle (days)", "Response rate %"];
    await playbookService.create(owner, { ...pb, kpis });
  }
  // Ensure KPIs on ALL playbooks (idempotent create skips existing ones, so backfill here).
  await d.collection("playbooks").updateMany(
    { orgId: ORG, model: "conveyor" },
    { $set: { kpis: ["SLA compliance %", "Stage conversion %", "Avg handoff time"] } },
  );
  await d.collection("playbooks").updateMany(
    { orgId: ORG, model: "individual" },
    { $set: { kpis: ["Win rate %", "Sales cycle (days)", "Response rate %"] } },
  );
  console.log("playbooks:", playbookDefs.length);

  // ============================ 3. CONVEYOR TEAMS ============================
  const uid = (email: string) => find(email)?.userId;
  const teamDefs: { name: string; members: (string | undefined)[]; playbookKey: string }[] = [
    { name: "Outbound Alpha", members: [uid("rahul.verma@svayantra.tech"), uid("priya.sharma@svayantra.tech"), uid("deblina@svayantra.tech")], playbookKey: "smb-outbound" },
    { name: "Enterprise Accounts", members: [uid("rahul.verma@svayantra.tech"), uid("vikram.rao@svayantra.tech")], playbookKey: "enterprise-outbound" },
    { name: "Founder Sales", members: [uid("ownertest1@svayantra.tech")], playbookKey: "founder-outbound" },
  ];
  const existingTeams = await conveyorTeamService.list(owner);
  const teamId: Record<string, string> = {};
  for (const t of existingTeams) teamId[t.name] = t.id;
  for (const t of teamDefs) {
    if (teamId[t.name]) continue;
    const members = t.members.filter((x): x is string => Boolean(x));
    const created = await conveyorTeamService.create(owner, { name: t.name, memberUserIds: members, playbookKey: t.playbookKey });
    teamId[t.name] = created.id;
  }
  console.log("conveyor teams:", Object.keys(teamId).length);

  // ============================ 4. COMPANIES + CONTACTS ============================
  const companyDefs: Array<[User, { name: string; industry: string; size: string; domain: string }]> = [
    [priya, { name: "Kolhapur Textiles", industry: "Manufacturing", size: "120", domain: "ktex.in" }],
    [rahul, { name: "Rajkot Auto Components", industry: "Manufacturing", size: "300", domain: "rajkotauto.in" }],
    [priya, { name: "Lyndoc Clinics", industry: "Healthcare", size: "45", domain: "lyndoc.in" }],
    [priya, { name: "MediCore Diagnostics", industry: "Healthcare", size: "200", domain: "medicore.in" }],
    [rahul, { name: "Suvidha Logistics", industry: "Logistics", size: "150", domain: "suvidhalog.in" }],
    [rahul, { name: "TransBharat Freight", industry: "Logistics", size: "500", domain: "transbharat.in" }],
    [priya, { name: "Zappstack", industry: "SaaS", size: "30", domain: "zappstack.io" }],
    [priya, { name: "Cloudwave Analytics", industry: "SaaS", size: "80", domain: "cloudwave.io" }],
    [rahul, { name: "Deccan Infra Builders", industry: "Construction", size: "250", domain: "deccaninfra.in" }],
    [rahul, { name: "UrbanNest Construction", industry: "Construction", size: "90", domain: "urbannest.in" }],
    [priya, { name: "Verde Skincare", industry: "D2C", size: "35", domain: "verdeskincare.in" }],
    [priya, { name: "Nimbu Foods", industry: "D2C", size: "50", domain: "nimbufoods.in" }],
    [priya, { name: "Ledgerly Accounting", industry: "Professional Services", size: "40", domain: "ledgerly.in" }],
    [rahul, { name: "Meridian Staffing", industry: "Professional Services", size: "90", domain: "meridianstaff.in" }],
    [rahul, { name: "Lex & Associates", industry: "Professional Services", size: "60", domain: "lexassoc.in" }],
    [rahul, { name: "NCR Digital Agency", industry: "Marketing Agency", size: "60", domain: "ncrdigital.in" }],
  ];
  const companyId: Record<string, string> = {};
  for (const [u, c] of companyDefs) {
    // Believable annual revenue estimate scaled from headcount (~₹0.18Cr/employee).
    const revenueEstimate = `₹${Math.max(1, Math.round(Number(c.size) * 0.18))}Cr`;
    companyId[c.name] = (await companyService.create(u, { ...c, revenueEstimate })).id;
  }
  console.log("companies:", Object.keys(companyId).length);

  const contactDefs: Array<[User, { name: string; title: string; email: string; company: string }]> = [
    [priya, { name: "Aarav Sharma", title: "COO", email: "aarav@ktex.in", company: "Kolhapur Textiles" }],
    [rahul, { name: "Nikhil Patel", title: "VP Ops", email: "nikhil@rajkotauto.in", company: "Rajkot Auto Components" }],
    [priya, { name: "Dr. Priya Menon", title: "Director", email: "priya@lyndoc.in", company: "Lyndoc Clinics" }],
    [priya, { name: "Dr. Sameer Roy", title: "CEO", email: "sameer@medicore.in", company: "MediCore Diagnostics" }],
    [rahul, { name: "Vivek Deshmukh", title: "CEO", email: "vivek@suvidhalog.in", company: "Suvidha Logistics" }],
    [rahul, { name: "Farhan Qureshi", title: "COO", email: "farhan@transbharat.in", company: "TransBharat Freight" }],
    [priya, { name: "Sneha Iyer", title: "Head of Ops", email: "sneha@zappstack.io", company: "Zappstack" }],
    [priya, { name: "Arjun Rao", title: "CTO", email: "arjun@cloudwave.io", company: "Cloudwave Analytics" }],
    [rahul, { name: "Karan Malhotra", title: "MD", email: "karan@meridianstaff.in", company: "Meridian Staffing" }],
    [rahul, { name: "Rohit Nair", title: "Founder", email: "rohit@ncrdigital.in", company: "NCR Digital Agency" }],
  ];
  for (const [u, c] of contactDefs) {
    await contactService.create(u, { name: c.name, title: c.title, email: c.email, companyId: companyId[c.company] });
  }
  console.log("contacts:", contactDefs.length);

  // ============================ 5. PIPELINE (all stages, backdated) ============================
  type LeadSpec = {
    owner: User; name: string; company: string; email: string; valueLakh: number; stage: LeadStage;
    source: string; ageDays: number; closeDaysAgo?: number; notes?: string;
    model?: { team: string; playbookKey: string }; // present => conveyor
  };
  const L: LeadSpec[] = [
    { owner: rahul, name: "Suvidha Logistics", company: "Suvidha Logistics", email: "vivek@suvidhalog.in", valueLakh: 8.0, stage: "won", source: "referral", ageDays: 82, closeDaysAgo: 18, notes: "Fleet dispatch automation. Signed annual.", model: { team: "Enterprise Accounts", playbookKey: "enterprise-outbound" } },
    { owner: priya, name: "Kolhapur Textiles", company: "Kolhapur Textiles", email: "aarav@ktex.in", valueLakh: 4.5, stage: "won", source: "apollo", ageDays: 76, closeDaysAgo: 12, notes: "Invoice→payment follow-up agent." },
    { owner: priya, name: "Ledgerly Accounting", company: "Ledgerly Accounting", email: "anjali@ledgerly.in", valueLakh: 2.4, stage: "won", source: "linkedin", ageDays: 61, closeDaysAgo: 8, notes: "GST filing reminders." },
    { owner: rahul, name: "Rajkot Auto Components", company: "Rajkot Auto Components", email: "nikhil@rajkotauto.in", valueLakh: 9.5, stage: "won", source: "conference", ageDays: 70, closeDaysAgo: 5, notes: "Shop-floor QA reporting.", model: { team: "Enterprise Accounts", playbookKey: "enterprise-outbound" } },
    { owner: rahul, name: "NCR Digital Agency", company: "NCR Digital Agency", email: "rohit@ncrdigital.in", valueLakh: 6.5, stage: "negotiation", source: "referral", ageDays: 44, notes: "Client reporting automation. Discount pending." },
    { owner: priya, name: "Zappstack", company: "Zappstack", email: "sneha@zappstack.io", valueLakh: 3.6, stage: "negotiation", source: "website", ageDays: 38, notes: "Onboarding workflows.", model: { team: "Outbound Alpha", playbookKey: "smb-outbound" } },
    { owner: priya, name: "Lyndoc Clinics", company: "Lyndoc Clinics", email: "priya@lyndoc.in", valueLakh: 2.8, stage: "proposal", source: "linkedin", ageDays: 33, notes: "Appointment reminders + no-show follow-up." },
    { owner: rahul, name: "Meridian Staffing", company: "Meridian Staffing", email: "karan@meridianstaff.in", valueLakh: 5.2, stage: "proposal", source: "apollo", ageDays: 29, notes: "Candidate pipeline automation.", model: { team: "Outbound Alpha", playbookKey: "smb-outbound" } },
    { owner: priya, name: "MediCore Diagnostics", company: "MediCore Diagnostics", email: "sameer@medicore.in", valueLakh: 7.0, stage: "proposal", source: "conference", ageDays: 26, notes: "Lab report delivery automation.", model: { team: "Enterprise Accounts", playbookKey: "enterprise-outbound" } },
    { owner: rahul, name: "Deccan Infra Builders", company: "Deccan Infra Builders", email: "ops@deccaninfra.in", valueLakh: 6.0, stage: "meeting", source: "apollo", ageDays: 19, notes: "Site progress + vendor payment tracking.", model: { team: "Enterprise Accounts", playbookKey: "enterprise-outbound" } },
    { owner: priya, name: "Cloudwave Analytics", company: "Cloudwave Analytics", email: "arjun@cloudwave.io", valueLakh: 3.2, stage: "meeting", source: "linkedin", ageDays: 15, notes: "Churn-risk alerts." },
    { owner: rahul, name: "TransBharat Freight", company: "TransBharat Freight", email: "farhan@transbharat.in", valueLakh: 8.5, stage: "qualified", source: "referral", ageDays: 12, notes: "Nationwide dispatch + ePOD.", model: { team: "Enterprise Accounts", playbookKey: "enterprise-outbound" } },
    { owner: priya, name: "Verde Skincare", company: "Verde Skincare", email: "ops@verdeskincare.in", valueLakh: 2.1, stage: "qualified", source: "website", ageDays: 10, notes: "D2C order + returns automation." },
    { owner: priya, name: "Nimbu Foods", company: "Nimbu Foods", email: "hello@nimbufoods.in", valueLakh: 1.9, stage: "qualified", source: "whatsapp", ageDays: 9, model: { team: "Outbound Alpha", playbookKey: "smb-outbound" } },
    { owner: priya, name: "UrbanNest Construction", company: "UrbanNest Construction", email: "contact@urbannest.in", valueLakh: 4.0, stage: "new", source: "website", ageDays: 4, notes: "Inbound form. Not yet contacted." },
    { owner: rahul, name: "Grandeur Events", company: "", email: "info@grandeurevents.in", valueLakh: 1.2, stage: "new", source: "referral", ageDays: 2 },
    { owner: rahul, name: "Lex & Associates", company: "Lex & Associates", email: "partner@lexassoc.in", valueLakh: 3.0, stage: "lost", source: "apollo", ageDays: 55, closeDaysAgo: 20, notes: "Chose a competitor on price." },
    { owner: priya, name: "Orbit Media", company: "", email: "team@orbitmedia.in", valueLakh: 1.5, stage: "lost", source: "linkedin", ageDays: 40, closeDaysAgo: 14, notes: "No budget this quarter." },
  ];
  const PROB: Record<LeadStage, number> = { new: 10, qualified: 25, meeting: 45, proposal: 65, negotiation: 82, won: 100, lost: 0 };
  const NEXT: Record<LeadStage, string> = {
    new: "Make first contact and confirm the pain.",
    qualified: "Book a discovery call this week.",
    meeting: "Run discovery, confirm scope + success metric.",
    proposal: "Follow up on the proposal; address objections.",
    negotiation: "Close the discount and get sign-off.",
    won: "Kick off onboarding within 48h.",
    lost: "Log the lost reason; revisit next quarter.",
  };
  const leadId: Record<string, string> = {};
  const leadSpec: Record<string, LeadSpec> = {};
  for (const s of L) {
    const lead = await leadService.create(
      { name: s.name, email: s.email, company: s.company || undefined, source: s.source as never, value: inr(s.valueLakh), notes: s.notes },
      { user: s.owner },
    );
    leadId[s.name] = lead.id;
    leadSpec[s.name] = s;
    await advanceTo(lead.id, s.stage, s.owner);
    if (s.model) {
      await leadService.setExecutionModel(s.owner, lead.id, {
        model: "conveyor", conveyorTeamId: teamId[s.model.team], playbookKey: s.model.playbookKey,
      });
    }
    // --- Intelligence: ICP + intent scores, health, probability, AI summary, next action ---
    const icp = rand(62, 96);
    const intent = s.stage === "won" ? rand(88, 98) : s.stage === "lost" ? rand(10, 28) : rand(38, 88);
    const health: "green" | "yellow" | "red" =
      s.stage === "lost" ? "red" : s.stage === "won" ? "green" : intent >= 60 ? "green" : "yellow";
    await leadService.update(s.owner, lead.id, {
      score: icp,
      intentScore: intent,
      painPoints: ["Manual, error-prone workflow", "Slow turnaround time"],
      competitors: s.stage === "lost" ? ["In-house build", "Lower-cost vendor"] : [],
    });
    await leadService.saveSummary(s.owner, lead.id, {
      summary: `${s.name} — ${s.stage} stage, ₹${s.valueLakh}L via ${s.source}. ${s.notes ?? "Active opportunity."} ICP fit ${icp}/100, buying intent ${intent}/100.${s.model ? ` Conveyor team: ${s.model.team}.` : " Individual full-cycle ownership."}`,
      health,
      probability: PROB[s.stage],
      nextAction: NEXT[s.stage],
    });
  }
  console.log("leads:", L.length, "(with ICP/intent scores + AI summaries)");

  // ============================ 6. KNOWLEDGE ============================
  const knowledge: { title: string; documentType: "note" | "sop" | "proposal" | "meeting_transcript"; text: string }[] = [
    { title: "Svayantra Tech — Company Overview", documentType: "note", text: "Svayantra Tech builds AI automation agents for Indian SMBs and enterprises. Flagship: STOS, an AI-native revenue operating system. ICP: 30–500 employee firms in manufacturing, healthcare, logistics, SaaS, construction, D2C, and professional services. We sell via founder-led outbound, specialist conveyor teams, and inbound referrals. HQ: Hyderabad." },
    { title: "STOS Pricing", documentType: "note", text: "Pricing tiers (INR/year): Starter ₹2.4L (1 workflow, 3 seats), Growth ₹4.5L (5 workflows, 10 seats), Enterprise ₹8L+ (unlimited workflows, SSO, dedicated onboarding). Standard payment terms: net 30. Annual contracts. Discounts above 15% require Finance approval." },
    { title: "Discovery Call SOP", documentType: "sop", text: "1) Confirm role and the workflow causing the most manual effort. 2) Quantify time/cost of that workflow today. 3) Map current tools. 4) Agree success metric. 5) Book a proposal walkthrough within 5 business days. Required artifact: discovery notes attached to the lead." },
    { title: "Proposal Template", documentType: "proposal", text: "Sections: Overview (the workflow we automate), Scope (discovery, build, integration, 2-week supervised rollout), Investment (build + first quarter managed operation), Timeline, Success Metrics, Terms (net 30, annual). Numbers are computed by Finance, never drafted by AI." },
    { title: "Client Onboarding Playbook", documentType: "sop", text: "On won: kickoff within 48h, confirm scope + timeline, provision the automation, QA against the success metric, 2-week supervised rollout, then handover to Operations with a signed handover checklist." },
    { title: "Sales FAQ", documentType: "note", text: "Q: Do we integrate with Tally/Zoho? Yes, via connectors. Q: Data residency? India region. Q: Typical time to first value? 2–3 weeks. Q: Who owns a conveyor lead? The whole assigned conveyor team; each stage has a specialist owner and an SLA." },
    { title: "Client Notes — Suvidha Logistics", documentType: "note", text: "Suvidha Logistics (Vivek Deshmukh, CEO) signed ₹8L/year for fleet dispatch automation. Day-to-day contact: dispatch head Ramesh. Renewal due in ~10 months. Highly sensitive to downtime — wants a dedicated success contact and a monthly ops review." },
    { title: "Meeting Notes — NCR Digital negotiation", documentType: "meeting_transcript", text: "NCR Digital (Rohit Nair, Founder) negotiation call. Asked for an 8% discount; we agreed pending Finance sign-off. Decision expected by month-end. They are also evaluating an in-house build. Next steps: send revised proposal, book the sign-off call, loop in Anita for margin approval." },
  ];
  let knowledgeOk = 0;
  for (const k of knowledge) {
    try { await documentService.upload(owner, k); knowledgeOk += 1; }
    catch (e) { console.warn(`  knowledge "${k.title}" skipped:`, (e as Error).message); }
  }
  console.log("knowledge documents:", knowledgeOk);

  // ============================ 7. WORK (today's tasks per person) ============================
  type T = { assignee: User; title: string; priority: "low" | "medium" | "high"; dueAt: string; lead?: string; done?: boolean };
  const tasks: T[] = [
    // Priya (sales_rep) — full plate
    { assignee: priya, title: "Follow up NCR Digital on discount", priority: "high", dueAt: hoursAhead(3), lead: "NCR Digital Agency" },
    { assignee: priya, title: "Send revised proposal to Lyndoc Clinics", priority: "high", dueAt: daysAhead(1), lead: "Lyndoc Clinics" },
    { assignee: priya, title: "Discovery meeting prep — Cloudwave Analytics", priority: "medium", dueAt: daysAhead(1), lead: "Cloudwave Analytics" },
    { assignee: priya, title: "Qualify Verde Skincare inbound", priority: "medium", dueAt: daysAhead(1), lead: "Verde Skincare" },
    { assignee: priya, title: "First contact — UrbanNest Construction", priority: "medium", dueAt: daysAhead(2), lead: "UrbanNest Construction" },
    { assignee: priya, title: "LinkedIn outreach — 10 D2C founders", priority: "low", dueAt: daysAhead(2) },
    { assignee: priya, title: "Respond to 3 LinkedIn replies", priority: "high", dueAt: hoursAhead(-6) /* overdue */ },
    // Rahul (sales_head) — management
    { assignee: rahul, title: "Review team pipeline for the week", priority: "medium", dueAt: daysAhead(1) },
    { assignee: rahul, title: "Approve Meridian Staffing proposal terms", priority: "high", dueAt: hoursAhead(6), lead: "Meridian Staffing" },
    { assignee: rahul, title: "Coach Priya on Cloudwave discovery", priority: "low", dueAt: daysAhead(2), lead: "Cloudwave Analytics" },
    { assignee: rahul, title: "Assign new Apollo imports to SDRs", priority: "medium", dueAt: daysAhead(1) },
    // Deblina (marketing)
    ...(deblina ? [
      { assignee: seedUser(deblina.userId, deblina.email, deblina.name, deblina.roleKey), title: "Review LinkedIn post for founder", priority: "medium" as const, dueAt: hoursAhead(5) },
      { assignee: seedUser(deblina.userId, deblina.email, deblina.name, deblina.roleKey), title: "Website copy update — case studies", priority: "low" as const, dueAt: daysAhead(2) },
    ] : []),
    // Anita (finance)
    { assignee: anita, title: "Check margin on NCR Digital discount", priority: "high", dueAt: hoursAhead(4) },
    { assignee: anita, title: "Reconcile Suvidha Logistics invoice", priority: "medium", dueAt: daysAhead(1) },
    // Vikram (operations)
    { assignee: vikram, title: "Provision automation — Kolhapur Textiles", priority: "high", dueAt: hoursAhead(8) },
    { assignee: vikram, title: "Onboard Rajkot Auto shop-floor bot", priority: "medium", dueAt: daysAhead(2) },
    // Owner
    { assignee: owner, title: "Review two quotes awaiting approval", priority: "high", dueAt: hoursAhead(4) },
    { assignee: owner, title: "Weekly revenue review", priority: "high", dueAt: daysAhead(1) },
    { assignee: owner, title: "1:1 with Rahul on sales hiring", priority: "medium", dueAt: daysAhead(2) },
    // A few COMPLETED (history) — backdated below
    { assignee: priya, title: "Kolhapur Textiles — send contract", priority: "high", dueAt: daysAhead(0), lead: "Kolhapur Textiles", done: true },
    { assignee: rahul, title: "Rajkot Auto — final negotiation call", priority: "high", dueAt: daysAhead(0), lead: "Rajkot Auto Components", done: true },
    { assignee: priya, title: "Ledgerly — onboarding kickoff", priority: "medium", dueAt: daysAhead(0), lead: "Ledgerly Accounting", done: true },
  ];
  const doneTaskIds: string[] = [];
  for (const t of tasks) {
    const created = await taskService.create(t.assignee, {
      title: t.title, priority: t.priority, dueAt: t.dueAt, assigneeId: t.assignee.id, leadId: t.lead ? leadId[t.lead] : undefined,
    });
    if (t.done) { await taskService.update(t.assignee, created.id, { status: "done" }); doneTaskIds.push(created.id); }
  }
  console.log("tasks:", tasks.length, `(${doneTaskIds.length} completed)`);

  // ============================ 8. MEETINGS (past + upcoming) ============================
  const meetingDefs: Array<[User, { title: string; at: string; lead?: string; notes?: string }]> = [
    // past (completed)
    [rahul, { title: "Rajkot Auto — negotiation call", at: daysAhead(-6), lead: "Rajkot Auto Components", notes: "Agreed terms." }],
    [priya, { title: "Kolhapur Textiles — proposal walkthrough", at: daysAhead(-14), lead: "Kolhapur Textiles" }],
    [rahul, { title: "Suvidha Logistics — discovery", at: daysAhead(-40), lead: "Suvidha Logistics" }],
    [owner, { title: "Weekly leadership sync", at: daysAhead(-3) }],
    // upcoming
    [rahul, { title: "NCR Digital — negotiation call", at: hoursAhead(20), lead: "NCR Digital Agency", notes: "Finalize discount." }],
    [priya, { title: "Lyndoc Clinics — proposal walkthrough", at: daysAhead(1), lead: "Lyndoc Clinics" }],
    [priya, { title: "Cloudwave Analytics — discovery", at: daysAhead(2), lead: "Cloudwave Analytics" }],
    [rahul, { title: "MediCore — scope review", at: daysAhead(3), lead: "MediCore Diagnostics" }],
    [owner, { title: "Weekly pipeline review", at: daysAhead(2) }],
    [owner, { title: "Founder sync — Q3 strategy", at: daysAhead(4) }],
  ];
  for (const [u, m] of meetingDefs) {
    await meetingService.create(u, { title: m.title, at: m.at, notes: m.notes, leadId: m.lead ? leadId[m.lead] : undefined });
  }
  console.log("meetings:", meetingDefs.length);

  // ============================ 9. PROPOSALS ============================
  const proposalDefs: Array<[User, { lead: string; title: string; valueLakh: number }]> = [
    [priya, { lead: "Lyndoc Clinics", title: "Appointment Reminder Automation", valueLakh: 2.8 }],
    [rahul, { lead: "Meridian Staffing", title: "Candidate Pipeline Automation", valueLakh: 5.2 }],
    [priya, { lead: "MediCore Diagnostics", title: "Lab Report Delivery Automation", valueLakh: 7.0 }],
    [rahul, { lead: "NCR Digital Agency", title: "Client Reporting Automation", valueLakh: 6.5 }],
  ];
  for (const [u, p] of proposalDefs) {
    await proposalService.create(u, {
      leadId: leadId[p.lead], title: p.title, amount: inr(p.valueLakh),
      sections: [
        { heading: "Overview", body: `Automating the highest-friction workflow for ${p.lead}.` },
        { heading: "Scope", body: "Discovery, build, integration, and a 2-week supervised rollout." },
        { heading: "Investment", body: `₹${p.valueLakh}L for the initial build + first quarter of managed operation.` },
      ],
    });
  }
  console.log("proposals:", proposalDefs.length);

  // ============================ 10. APPROVALS (quote_approval) ============================
  try {
    const q1 = await workflowService.start(rahul, "quote_approval", { amount: 950000 }, { type: "quotation", id: "Rajkot Auto — ₹9.5L" });
    void q1;
    const q2 = await workflowService.start(rahul, "quote_approval", { amount: 650000 }, { type: "quotation", id: "NCR Digital — ₹6.5L" });
    await workflowService.act(rahul, q2.id, "approved", "Terms look good, sending up."); // waits on owner
    const q3 = await workflowService.start(priya, "quote_approval", { amount: 700000 }, { type: "quotation", id: "MediCore — ₹7.0L" });
    await workflowService.act(rahul, q3.id, "approved");
    await workflowService.act(owner, q3.id, "approved"); // fully approved (history)
    console.log("workflow approvals: 3 (1 waits sales_head, 1 waits owner, 1 approved)");
  } catch (e) {
    console.warn("  approvals skipped (no quote_approval workflow def?):", (e as Error).message);
  }

  // ============================ 11. TIME MACHINE — backdate history ============================
  const leadsCol = d.collection("leads");
  const actsCol = d.collection("activities");
  for (const [name, id] of Object.entries(leadId)) {
    const s = leadSpec[name];
    const created = daysAgo(s.ageDays).getTime();
    const end = s.closeDaysAgo != null ? daysAgo(s.closeDaysAgo).getTime() : NOW - rand(1, 4) * DAY;
    const doc = await leadsCol.findOne({ _id: new ObjectId(id) });
    if (!doc) continue;

    // stageHistory + ownerHistory spread across [created, end]
    const sh = Array.isArray(doc.stageHistory) ? doc.stageHistory : [];
    sh.forEach((h: Record<string, unknown>, i: number) => { h.at = spread(created, end, i, sh.length); });
    const oh = Array.isArray(doc.ownerHistory) ? doc.ownerHistory : [];
    oh.forEach((h: Record<string, unknown>, i: number) => { h.at = spread(created, end, i, oh.length); });

    await leadsCol.updateOne({ _id: new ObjectId(id) }, {
      $set: { createdAt: new Date(created), updatedAt: new Date(end), stageHistory: sh, ownerHistory: oh },
    });

    // Backdate this lead's activities across the same window (chronological).
    const acts = await actsCol.find({ orgId: ORG, entityType: "lead", entityId: id }).sort({ createdAt: 1 }).toArray();
    for (let i = 0; i < acts.length; i++) {
      const at = spread(created, end, i, acts.length);
      await actsCol.updateOne({ _id: acts[i]._id }, { $set: { createdAt: at, updatedAt: at } });
    }
  }

  // Backdate completed tasks + their activities to the last ~3 weeks.
  const tasksCol = d.collection("tasks");
  for (const tid of doneTaskIds) {
    const at = daysAgo(rand(3, 20));
    await tasksCol.updateOne({ _id: new ObjectId(tid) }, { $set: { createdAt: at, updatedAt: at } });
    await actsCol.updateMany({ orgId: ORG, entityType: "task", entityId: tid }, { $set: { createdAt: at, updatedAt: at } });
  }

  // A few explicit narrative timeline beats (dated), so the feed reads like a real quarter.
  const beats: { name: string; kind: string; summary: string; daysAgo: number }[] = [
    { name: "Rajkot Auto Components", kind: "won", summary: "Deal won — Rajkot Auto Components (₹9.5L annual)", daysAgo: 5 },
    { name: "Suvidha Logistics", kind: "won", summary: "Deal won — Suvidha Logistics (₹8.0L annual)", daysAgo: 18 },
    { name: "Lex & Associates", kind: "lost", summary: "Lost — Lex & Associates. Reason: competitor on price.", daysAgo: 20 },
    { name: "NCR Digital Agency", kind: "note", summary: "Proposal revised — dropped price 8% pending Finance sign-off.", daysAgo: 3 },
    { name: "MediCore Diagnostics", kind: "note", summary: "Proposal sent — awaiting scope review.", daysAgo: 6 },
  ];
  for (const b of beats) {
    const id = leadId[b.name];
    if (!id) continue;
    const at = daysAgo(b.daysAgo);
    await actsCol.insertOne({
      orgId: ORG, entityType: "lead", entityId: id, kind: b.kind, summary: b.summary,
      actorId: leadSpec[b.name].owner.id, workspace: "demo", createdAt: at, updatedAt: at,
    });
  }
  console.log("time machine: backdated leads, activities, completed tasks + narrative beats");

  // Workspace isolation: ensure every content row in this org is tagged demo (covers any
  // stragglers created before the workspace column existed). Production stays a clean slate.
  const contentCollections = [
    "leads", "companies", "contacts", "tasks", "meetings", "proposals", "quotations",
    "activities", "workflowInstances", "notifications", "documents", "customRecords",
  ];
  for (const c of contentCollections) {
    await d.collection(c).updateMany(
      { orgId: ORG, workspace: { $exists: false } },
      { $set: { workspace: "demo" } },
    );
  }
  console.log("workspace: all content tagged demo");

  const counts = {
    companies: await d.collection("companies").countDocuments({ orgId: ORG }),
    leads: await leadsCol.countDocuments({ orgId: ORG }),
    tasks: await tasksCol.countDocuments({ orgId: ORG }),
    meetings: await d.collection("meetings").countDocuments({ orgId: ORG }),
    activities: await actsCol.countDocuments({ orgId: ORG }),
    documents: await d.collection("documents").countDocuments({ orgId: ORG }),
  };
  console.log("\n✅ Simulation complete for org 'default' (Demo mode).", JSON.stringify(counts));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
