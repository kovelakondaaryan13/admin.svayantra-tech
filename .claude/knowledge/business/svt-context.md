# knowledge/business — Svayantra Tech context (`[REAL]`)

> Extracted from Svayantra Tech's internal documents (BMC, research/analysis reports, deal
> briefs, company overview). Tagged `[REAL]` = sourced from those docs. This grounds product
> and positioning decisions and flags tensions with the RevenueOS brief. Keep updated as the
> company's strategy evolves.

## Company
- **[REAL]** Svayantra Tech (SVT, svayantra.tech) — early-stage, founder-led AI-automation
  company in India (~$5K MRR). Positioned in internal docs as "The Automation Production House
  for Indian Businesses." Vision: **ABOS = Autonomous Business Operating System** —
  "remove the founder as the operating system," layer on top of existing tools, WhatsApp-native.

## Important tensions with the RevenueOS brief
- **[REAL] "RevenueOS" and "conveyor-belt" appear in none of the internal docs.** The described
  first wedge is an **Invoice→Payment (accounts-receivable) follow-up agent**; go-to-market is
  **WhatsApp-native automation for Indian MSMEs**, not a seat-based sales CRM.
  → *Open decision (see `../../DECISIONS.md`): follow the brief's sales-OS framing vs reconcile
  with the AR-follow-up/WhatsApp wedge.* Current default: follow the brief, flag the tension.
- **[REAL] Do NOT sell it as an "operating system"** ("nobody buys those" — lead with one
  painful workflow). Adopted resolution: **internal architecture = OS, external pitch = one
  workflow.**
- **[REAL] ABOS is defined two ways** across docs: "Autonomous Business Operating System"
  (strategic) vs "AI Business Optimization Solutions" (factory services). We use the former.

## ICP / customers (`[REAL]`)
- Primary: 30–150-person Indian **digital agencies, SaaS startups, accounting/staffing/legal-
  ops** firms. Buyer = COO / Ops Manager / Founder.
- Anchor pilots mentioned: textile factories (Kolhapur/Surat), private clinics.
- Fast-close verticals flagged internally: used-car dealers, wedding planners, bridal
  boutiques, catering. Slow/committee buyers to avoid: architects, coaching centres, labs.

## Business model (`[REAL]`)
- Custom builds ₹80K–₹3L per engagement; productized modules ₹8–50K/mo (Pulse/clinics,
  Yantra/factories, Helm/agencies). Flywheel: "orders fund products, products fund platform."
- Recommended SaaS tiers in research docs: Starter ~₹8K/$99, Growth ~₹20K/$249, Scale ~₹50K/
  $599 per month; later add success fee on AR recovered.

## Competition / moat (`[REAL]`)
- Threats: Zoho "Zia" (most dangerous India threat), Microsoft Copilot (long-term
  existential), Salesforce Agentforce, HubSpot/Pipedrive AI, Zapier/Make, Relay/Lindy.
- **No durable technical moat in Year 1.** Moat must come from workflow-data lock-in, verified
  outcome data, guardrail depth, India integrations (Tally, GST, Indian banks, WhatsApp), and
  referral density. Window before incumbents catch up: **~18–36 months.**

## Delivery stack seen in a live deal (`[REAL]`)
- Maurice deal (US Mobile Phones / TikTok lead capture): n8n + Supabase + Groq + WhatsApp
  Business API — a capture → WhatsApp nurture → analytics pipeline. (Note: differs from the
  RevenueOS target stack; relevant as evidence of the real revenue-ops thesis in practice.)

## Also in this folder
- `README.md` (below) describes what business knowledge to keep here going forward.
