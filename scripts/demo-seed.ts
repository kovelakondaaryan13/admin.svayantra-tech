/**
 * Rich demo data for STOS — populates the "default" org so every persona's Home,
 * Work, People, finance, approvals, and activity feed look alive.
 *
 * Idempotent: wipes demo content collections for org "default" (leaves accounts,
 * org structure, custom objects, and workflow *definitions* intact), then reseeds
 * through the real services so audit + activity + events all fire.
 *
 * Run: npm run demo-seed   (loads .env.local)
 */
import { db } from "@/lib/mongo";
import { companyService } from "@/services/company-service";
import { contactService } from "@/services/contact-service";
import { leadService } from "@/services/lead-service";
import { taskService } from "@/services/task-service";
import { meetingService } from "@/services/meeting-service";
import { proposalService } from "@/services/proposal-service";
import { workflowService } from "@/services/workflow-service";
import { activityService } from "@/services/activity-service";
import type { User } from "@/lib/types";
import type { LeadStage } from "@/lib/types";

const ORG = "default";
const lakh = (n: number) => Math.round(n * 100000 * 100); // ₹ lakh -> minor units (paise)
const inr = (n: number) => ({ amountMinor: lakh(n), currency: "INR" as const });

// ISO datetime helpers (no Date.now sugar needed here — this is a script, not a workflow)
const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const hours = (n: number) => new Date(Date.now() + n * 3600000).toISOString();

/** Build a seed "User" for a real employee — full perms so seeding bypasses authz. */
function seedUser(userId: string, email: string, name: string, role: string): User {
  return { id: userId, email, name, role, orgId: ORG, permissions: ["*"], isOwner: true };
}

async function advanceTo(id: string, target: LeadStage, actor: User) {
  const path: LeadStage[] = ["qualified", "meeting", "proposal", "negotiation", "won"];
  for (const stage of path) {
    await leadService.advance(id, stage, { user: actor });
    if (stage === target) return;
  }
}

async function main() {
  const d = await db();

  // --- Resolve demo employees -> seed users ---
  const emps = await d
    .collection<{ email: string; name: string; roleKey: string; userId: string }>("employees")
    .find({ orgId: ORG })
    .toArray();
  const by = (email: string) => {
    const e = emps.find((x) => x.email === email);
    if (!e) throw new Error(`missing employee ${email} — run bootstrap/QA account setup first`);
    return seedUser(e.userId, e.email, e.name, e.roleKey);
  };
  const owner = by("ownertest1@svayantra.tech");
  const priya = by("priya.sharma@svayantra.tech"); // sales_rep
  const rahul = by("rahul.verma@svayantra.tech"); // sales_head
  const anita = by("anita.desai@svayantra.tech"); // finance_head
  const vikram = by("vikram.rao@svayantra.tech"); // ops_manager

  // --- Wipe demo content (keep accounts, org tree, object defs, workflow DEFS) ---
  const wipe = [
    "leads", "companies", "contacts", "tasks", "meetings",
    "proposals", "quotations", "activities", "workflowInstances", "notifications",
  ];
  for (const c of wipe) await d.collection(c).deleteMany({ orgId: ORG });
  console.log("wiped:", wipe.join(", "));

  // --- Companies (ICP: Indian agencies / SaaS / clinics / factories / staffing) ---
  const companyDefs: Array<[User, { name: string; industry: string; size: string; domain: string }]> = [
    [priya, { name: "Kolhapur Textiles", industry: "Manufacturing", size: "120", domain: "ktex.in" }],
    [priya, { name: "Lyndoc Clinics", industry: "Healthcare", size: "45", domain: "lyndoc.in" }],
    [rahul, { name: "NCR Digital Agency", industry: "Marketing Agency", size: "60", domain: "ncrdigital.in" }],
    [priya, { name: "Zappstack", industry: "SaaS", size: "30", domain: "zappstack.io" }],
    [rahul, { name: "Meridian Staffing", industry: "Staffing", size: "90", domain: "meridianstaff.in" }],
    [priya, { name: "Ledgerly Accounting", industry: "Accounting", size: "40", domain: "ledgerly.in" }],
    [rahul, { name: "Suvidha Logistics", industry: "Logistics", size: "150", domain: "suvidhalog.in" }],
    [priya, { name: "BluePeak Interiors", industry: "Design", size: "25", domain: "bluepeak.in" }],
  ];
  const companies: Record<string, string> = {};
  for (const [u, c] of companyDefs) {
    const doc = await companyService.create(u, c);
    companies[c.name] = doc.id;
  }
  console.log("companies:", Object.keys(companies).length);

  // --- Contacts ---
  const contactDefs: Array<[User, { name: string; title: string; email: string; company: string }]> = [
    [priya, { name: "Aarav Sharma", title: "COO", email: "aarav@ktex.in", company: "Kolhapur Textiles" }],
    [priya, { name: "Dr. Priya Menon", title: "Director", email: "priya@lyndoc.in", company: "Lyndoc Clinics" }],
    [rahul, { name: "Rohit Nair", title: "Founder", email: "rohit@ncrdigital.in", company: "NCR Digital Agency" }],
    [priya, { name: "Sneha Iyer", title: "Head of Ops", email: "sneha@zappstack.io", company: "Zappstack" }],
    [rahul, { name: "Karan Malhotra", title: "MD", email: "karan@meridianstaff.in", company: "Meridian Staffing" }],
    [priya, { name: "Anjali Rao", title: "Partner", email: "anjali@ledgerly.in", company: "Ledgerly Accounting" }],
    [rahul, { name: "Vivek Deshmukh", title: "CEO", email: "vivek@suvidhalog.in", company: "Suvidha Logistics" }],
  ];
  for (const [u, c] of contactDefs) {
    await contactService.create(u, {
      name: c.name, title: c.title, email: c.email, companyId: companies[c.company],
    });
  }
  console.log("contacts:", contactDefs.length);

  // --- Leads across the full conveyor belt ---
  type LeadSpec = { owner: User; name: string; company: string; email: string; valueLakh: number; stage: LeadStage; notes?: string };
  const leadSpecs: LeadSpec[] = [
    { owner: rahul, name: "Suvidha Logistics", company: "Suvidha Logistics", email: "vivek@suvidhalog.in", valueLakh: 8.0, stage: "won", notes: "Fleet dispatch automation. Signed annual." },
    { owner: priya, name: "Kolhapur Textiles", company: "Kolhapur Textiles", email: "aarav@ktex.in", valueLakh: 4.5, stage: "won", notes: "Invoice→payment follow-up agent." },
    { owner: priya, name: "Ledgerly Accounting", company: "Ledgerly Accounting", email: "anjali@ledgerly.in", valueLakh: 2.4, stage: "won", notes: "GST filing reminders." },
    { owner: rahul, name: "NCR Digital Agency", company: "NCR Digital Agency", email: "rohit@ncrdigital.in", valueLakh: 6.5, stage: "negotiation", notes: "Client reporting automation. Discount pending." },
    { owner: priya, name: "Zappstack", company: "Zappstack", email: "sneha@zappstack.io", valueLakh: 3.6, stage: "negotiation", notes: "Onboarding workflows." },
    { owner: priya, name: "Lyndoc Clinics", company: "Lyndoc Clinics", email: "priya@lyndoc.in", valueLakh: 2.8, stage: "proposal", notes: "Appointment reminders + no-show follow-up." },
    { owner: rahul, name: "Meridian Staffing", company: "Meridian Staffing", email: "karan@meridianstaff.in", valueLakh: 5.2, stage: "proposal", notes: "Candidate pipeline automation." },
    { owner: priya, name: "BluePeak Interiors", company: "BluePeak Interiors", email: "hello@bluepeak.in", valueLakh: 1.8, stage: "meeting", notes: "Quote-to-proposal automation." },
    { owner: priya, name: "Grandeur Events", company: "", email: "info@grandeurevents.in", valueLakh: 1.2, stage: "meeting", notes: "Inbound from referral." },
    { owner: rahul, name: "Ashwin Foods", company: "", email: "sales@ashwinfoods.in", valueLakh: 3.0, stage: "qualified", notes: "Distributor order automation." },
    { owner: priya, name: "Verde Skincare (D2C)", company: "", email: "ops@verdeskincare.in", valueLakh: 2.1, stage: "qualified" },
    { owner: priya, name: "Pinnacle Realty", company: "", email: "contact@pinnaclerealty.in", valueLakh: 4.0, stage: "new", notes: "Website form. Not yet contacted." },
    { owner: priya, name: "TechnoServe IT", company: "", email: "hi@technoserve.in", valueLakh: 2.6, stage: "new" },
    { owner: rahul, name: "Orbit Media", company: "", email: "team@orbitmedia.in", valueLakh: 1.5, stage: "lost", notes: "Chose a competitor on price." },
  ];
  const leadIds: Record<string, string> = {};
  for (const s of leadSpecs) {
    const lead = await leadService.create(
      { name: s.name, email: s.email, company: s.company || undefined, value: inr(s.valueLakh), notes: s.notes },
      { user: s.owner },
    );
    leadIds[s.name] = lead.id;
    if (s.stage === "lost") {
      await leadService.advance(lead.id, "lost", { user: s.owner });
    } else if (s.stage !== "new") {
      await advanceTo(lead.id, s.stage, s.owner);
    }
    // Human-readable activity for closed-won so the feed tells a story
    if (s.stage === "won") {
      await activityService.log(s.owner, "lead", lead.id, "won", `Deal won — ${s.name} (₹${s.valueLakh}L)`);
    }
  }
  console.log("leads:", leadSpecs.length);

  // --- Tasks (assigned per persona -> each Home's "Today's priorities") ---
  type T = { u: User; assignee: User; title: string; priority: "low" | "medium" | "high"; dueAt: string; lead?: string };
  const taskDefs: T[] = [
    { u: priya, assignee: priya, title: "Call Rohit at NCR Digital about discount", priority: "high", dueAt: hours(3), lead: "NCR Digital Agency" },
    { u: priya, assignee: priya, title: "Send revised proposal to Lyndoc Clinics", priority: "high", dueAt: days(1), lead: "Lyndoc Clinics" },
    { u: priya, assignee: priya, title: "Qualify Verde Skincare inbound", priority: "medium", dueAt: days(1), lead: "Verde Skincare (D2C)" },
    { u: priya, assignee: priya, title: "First contact — Pinnacle Realty", priority: "medium", dueAt: days(2), lead: "Pinnacle Realty" },
    { u: priya, assignee: priya, title: "Follow up Zappstack negotiation", priority: "low", dueAt: days(3), lead: "Zappstack" },
    { u: rahul, assignee: rahul, title: "Approve Meridian Staffing proposal terms", priority: "high", dueAt: hours(6), lead: "Meridian Staffing" },
    { u: rahul, assignee: rahul, title: "Review team pipeline for the week", priority: "medium", dueAt: days(1) },
    { u: rahul, assignee: rahul, title: "Coach Priya on Ashwin Foods deal", priority: "low", dueAt: days(2), lead: "Ashwin Foods" },
    { u: anita, assignee: anita, title: "Reconcile Suvidha Logistics invoice", priority: "high", dueAt: hours(5) },
    { u: anita, assignee: anita, title: "Check margin on NCR Digital discount request", priority: "medium", dueAt: days(1) },
    { u: vikram, assignee: vikram, title: "Provision automation for Kolhapur Textiles", priority: "high", dueAt: hours(8) },
    { u: vikram, assignee: vikram, title: "QA the Ledgerly GST reminder workflow", priority: "medium", dueAt: days(1) },
    { u: vikram, assignee: vikram, title: "Onboard Suvidha Logistics dispatch bot", priority: "medium", dueAt: days(2) },
    { u: owner, assignee: owner, title: "Sign off Q3 revenue targets", priority: "high", dueAt: days(1) },
    { u: owner, assignee: owner, title: "Review two quotes awaiting approval", priority: "high", dueAt: hours(4) },
    { u: owner, assignee: owner, title: "1:1 with Rahul on sales hiring", priority: "medium", dueAt: days(2) },
  ];
  for (const t of taskDefs) {
    await taskService.create(t.u, {
      title: t.title, priority: t.priority, dueAt: t.dueAt, assigneeId: t.assignee.id,
      leadId: t.lead ? leadIds[t.lead] : undefined,
    });
  }
  console.log("tasks:", taskDefs.length);

  // --- Meetings (future -> "Upcoming meetings") ---
  const meetingDefs: Array<[User, { title: string; at: string; lead?: string; notes?: string }]> = [
    [rahul, { title: "NCR Digital — negotiation call", at: hours(20), lead: "NCR Digital Agency", notes: "Finalize discount." }],
    [priya, { title: "Lyndoc Clinics — proposal walkthrough", at: days(1), lead: "Lyndoc Clinics" }],
    [priya, { title: "BluePeak Interiors — discovery", at: days(2), lead: "BluePeak Interiors" }],
    [rahul, { title: "Meridian Staffing — scope review", at: days(3), lead: "Meridian Staffing" }],
    [owner, { title: "Weekly leadership sync", at: days(2) }],
  ];
  for (const [u, m] of meetingDefs) {
    await meetingService.create(u, { title: m.title, at: m.at, notes: m.notes, leadId: m.lead ? leadIds[m.lead] : undefined });
  }
  console.log("meetings:", meetingDefs.length);

  // --- Proposals (with sections; no AI call) ---
  const proposalDefs: Array<[User, { lead: string; title: string; valueLakh: number }]> = [
    [priya, { lead: "Lyndoc Clinics", title: "Appointment Reminder Automation", valueLakh: 2.8 }],
    [rahul, { lead: "Meridian Staffing", title: "Candidate Pipeline Automation", valueLakh: 5.2 }],
    [rahul, { lead: "NCR Digital Agency", title: "Client Reporting Automation", valueLakh: 6.5 }],
  ];
  for (const [u, p] of proposalDefs) {
    await proposalService.create(u, {
      leadId: leadIds[p.lead],
      title: p.title,
      amount: inr(p.valueLakh),
      sections: [
        { heading: "Overview", body: `Automating the highest-friction workflow for ${p.lead}.` },
        { heading: "Scope", body: "Discovery, build, integration, and a 2-week supervised rollout." },
        { heading: "Investment", body: `₹${p.valueLakh}L for the initial build + first quarter of managed operation.` },
      ],
    });
  }
  console.log("proposals:", proposalDefs.length);

  // --- Live approval instances (quote_approval) -> Home "Waiting on your approval" ---
  // amount > 500000 in context triggers the sales_head -> owner approval chain.
  const q1 = await workflowService.start(rahul, "quote_approval", { amount: 800000 }, { type: "quotation", id: "Suvidha Logistics — ₹8.0L" });
  const q2 = await workflowService.start(rahul, "quote_approval", { amount: 650000 }, { type: "quotation", id: "NCR Digital — ₹6.5L" });
  await workflowService.act(rahul, q2.id, "approved", "Terms look good, sending up."); // now waits on owner (a2)
  const q3 = await workflowService.start(priya, "quote_approval", { amount: 520000 }, { type: "quotation", id: "Meridian Staffing — ₹5.2L" });
  await workflowService.act(rahul, q3.id, "approved");
  await workflowService.act(owner, q3.id, "approved"); // fully approved (history)
  const q4 = await workflowService.start(priya, "quote_approval", { amount: 700000 }, { type: "quotation", id: "Orbit Media — ₹7.0L" });
  await workflowService.act(rahul, q4.id, "rejected", "Margin too thin."); // rejected (history)
  console.log("workflow instances: 4 (q1 waits sales_head, q2 waits owner, q3 approved, q4 rejected)");

  console.log("\n✅ Demo data seeded for org 'default'.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
