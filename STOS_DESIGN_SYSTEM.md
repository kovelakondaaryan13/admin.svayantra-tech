# STOS Design System v2 — Catalogue

> **Milestone, not a skin.** This is the single source of truth for how STOS looks and behaves.
> Sequence (deliberate): **finalize this system → then update every page to consume it.** Do not
> polish individual pages/tables/dialogs before the system is ratified — that's how visual drift
> happens.
>
> **Recognizability test:** crop any screen and it should still read as STOS — same header, same
> card language, same KPI presentation, same timeline, same activity feed, same AI callouts, same
> object-detail layout.
>
> **Implemented in code:** tokens in `tailwind.config.ts` + `globals.css`; primitives in
> `src/components/ds/`; a live showcase at `/design` (owner-only).

---

## 0. Principles (the non-negotiables)

**0.0 — The two questions (the doctrine above all others).** Every object answers exactly two
questions, and nothing on the page is allowed to compete with them:

- **"What is happening?" → the Context tab.** Context is the *home* of every object — always the
  default, always first. It aggregates the AI summary, documents, conversations, activity, and the
  object's key facts. There is no "Overview"; Overview was the symptom of not knowing what the home
  should be. Its sections now live inside Context. Specialized tabs (Work, Knowledge, Forecast,
  Insights) are the *exceptions*, not the baseline.
- **"What can I do?" → the Action Bar.** In the ObjectPage header: exactly **one primary** action,
  a few **secondary** actions, the rest behind **⋯ More**, plus an always-present **✦ Ask AI**.
  Read-only tabs with no verb are a bug — the verb belongs in the Action Bar. Action verbs that
  don't have a dedicated screen route to the Assistant as a pre-scoped *intent* (the orchestrator
  has the tools to execute them), so no journey dead-ends on a list.

**The failure test (permanent constraint):** *if a user has to ask "where do I do X?", the design
has failed.* Every common action must satisfy one of two rules — it is **visible in the Action
Bar**, or it is **discoverable via ⌘K**. Never buried inside a tab. Duplicated destinations (the
same documents / activity reachable from two tabs) are likewise a bug: one home per thing.

**0.1 — What / Why / Next (how an operational page is composed).** Three layers, each answering a
different question, in this fixed order down the page:

1. **Metrics answer "what is happening?"** — a few decision-relevant numbers (`StatTile`/`KpiRow`):
   open pipeline, open deals, win rate. Show **movement** where a real time basis exists (▲/▼ vs a
   prior period) — never a fabricated delta; if there's no prior snapshot, show the number alone.
2. **Charts answer "why is it happening?"** — decision-driven only (pipeline value by stage → *why*
   revenue is where it is; deals by stage → *where* it's stuck; workload by person → *why* projects
   slow). Every chart answers one business question; a page with no question deserves no chart.
3. **AI answers "what should happen next?"** — a data-derived recommendation (`AIInsight`), e.g. "9
   deals in proposal 14+ days → follow up with these three." Numbers → visualization →
   recommendation. Only surface it when there's a real, actionable finding.

The page order is **Summary → Decision Metrics → Decision Charts → Action Bar → Underlying Objects**
— orient before drilling in. **This is an operating system, not a BI tool:** the dashboard answers
"what do I need to pay attention to today?", not "here are 47 metrics." A number that doesn't
influence a decision is not surfaced prominently.

1. **Signature identity through repeated patterns**, not one-off screens. Seven canonical
   patterns (PageHeader, Section/Zone, KpiRow, Timeline, ActivityFeed, AICallout, ObjectPage)
   appear everywhere.
2. **One object language.** Every first-class object (Company, Person, Deal, Department, Project)
   uses the *same* ObjectPage template. Users never relearn the interface.
3. **Workspaces, not floating cards.** Pages are composed of labeled **zones** with rhythm, not a
   scatter of glass rectangles.
4. **Module personality within one system.** Work = focused/execution; Companies =
   relationship/timeline-rich; People = profile/performance; Knowledge = calm reading; AI =
   premium/animated. Same tokens, different density + hero treatment.
5. **Design for scanning.** Every screen answers in <5s: *what changed · what's blocked · what's
   urgent · what's improving · where do I click next.* Hierarchy serves the scan.
6. **⌘K is the primary interaction layer**, not a hidden shortcut. Search / create / navigate /
   ask AI / switch workspace — reinforced visually everywhere.
7. **Living feel.** The OS feels active at rest: live activity, AI status, work animating into
   history, sync indicators. Subtle, never noisy.
8. **This catalogue is law.** New UI composes from documented primitives + tokens only. A bespoke
   variant of an existing primitive is a bug.

---

## 1. Design tokens (`tailwind.config.ts` + `globals.css`)

### Color
| Role | Token | Value |
|---|---|---|
| Brand gradient | `bg-brand` | cyan `#22D3EE` → indigo `#6366F1` → violet `#A855F7` |
| Brand soft | `bg-brand-soft` | 16% cyan→violet (active states, chips) |
| AI | `bg-ai` / `.ai-surface` | violet→cyan wash + glow |
| Accent | `accent` | `#22D3EE` |
| Positive | `teal` / `success` | `#2DD4BF` / `#34D399` |
| Urgent/action | `action` / `danger` | `#FB7185` |
| Warning | `warning` | `#FBBF24` |
| Info | `info` | `#38BDF8` |
| **Surface ladder** | `bg` → `surface` → `panel` → `elevated` → `floating` | `#05070E`→`#080C16`→`#0E1424`→`#141C31`→`#1A2340` |
| Hairline / strong | `border` / `border-strong` | `#20293F` / `#31405E` |
| Text | white / `muted` / `faint` | `#FFF` / `#94A3C4` / `#64708C` |

> **Rule:** never use raw hex or `text-green-400`-style utilities. Use role tokens. To rebrand,
> change values here only.

### Typography (`.t-*` utilities)
`t-display` 24/600 · `t-title` 18/600 · `t-section` 15/600 · body 14 · `t-meta` 12/muted ·
`t-micro` 11/faint. Global tracking `-0.011em`. Executive metrics use `text-2xl+/600` or
`.text-gradient` for hero numbers.

### Spacing (4-pt base)
Page gutter `32` · zone gap `20–24` · card padding `16–20` · inline gap `8–12` · dense list row
`6–8` vertical.

### Radii
`md 10` (controls) · `lg 14` · `xl 20` · `2xl 26` (cards/surfaces).

### Elevation (shadow ladder)
`e1` cards · `e2` raised/hover · `e3` floating/modal · `glow` brand focus · `glow-ai` AI.
Depth comes from **elevation + translucency**, not heavy borders.

### Motion
Durations `--dur-fast 120ms` / `--dur 220ms` / slow 360ms. Curve `--ease
cubic-bezier(.22,1,.36,1)` (`ease-emphasized`). Entrances `.animate-in` / `animate-scale-in`;
skeletons `.shimmer`; AI `animate-pulse-glow`. **Respect `prefers-reduced-motion`.**

### Iconography
Single set, `16/20/24` sizes. Icons live in **rounded tiles** (`h-7 w-7 rounded-lg`) in nav +
object headers. Emoji placeholders today → swap for a single line-icon set (Lucide) during
rollout; sizes/tiles stay.

### Borders
Hairline `border` on separation; `border-strong` on emphasis; brand-tinted borders
(`border-accent/20`) signal interactive/active/AI. No full-contrast 1px boxes.

---

## 2. Component library

Each primitive lives in `src/components/ds/` and is showcased at `/design`.
Format: **Purpose · Variants · States · A11y · Tokens · Usage.**

### 2.1 `PageHeader`
- **Purpose:** the signature top of *every* page — eyebrow, title, subtitle, actions, optional AI bar.
- **Variants:** `default`, `hero` (larger, gradient accent — Home/Command).
- **States:** with/without actions; with/without AI bar.
- **A11y:** `<h1>` per page; actions are real buttons; AI bar keyboard-reachable.
- **Tokens:** `t-display`/`t-title`, spacing gutter, `text-gradient` for hero.
- **Usage:** first element on a page. Never hand-roll a header.

### 2.2 `Section` (Zone)
- **Purpose:** a labeled workspace zone — the card language. Replaces floating glass rectangles.
- **Variants:** `default` (glass), `plain` (no chrome, for grouping), `ai` (`.ai-surface`).
- **States:** with title + optional action link; empty (renders `EmptyState`).
- **A11y:** `<section>` + `<h2>`; action is a link/button.
- **Tokens:** `.glass`, `e1`, radii `2xl`, zone gap.
- **Usage:** compose pages from Sections, not raw `div.glass`.

### 2.3 `StatTile` + `KpiRow`
- **Purpose:** the standard KPI presentation (executive metrics).
- **Variants:** tone `neutral|good|bad|brand`; with `delta` (▲/▼ + %), with icon, `hero` (large).
- **States:** loading (shimmer), empty ("—"), interactive (links to source).
- **A11y:** value has an accessible label; delta conveys direction by icon + color (not color alone).
- **Tokens:** elevation `e1`, `text-gradient`/tone colors, `t-micro` label.
- **Usage:** `KpiRow` lays 2–4 tiles responsively; never bespoke metric cards.

### 2.4 `AICallout`
- **Purpose:** the one consistent way AI appears — special, branded, alive.
- **Variants:** `briefing` (full narrative), `insight` (inline tip), `chip` (tiny AI tag).
- **States:** idle (CTA), thinking (typing dots + pulse), streamed, error; optional citations + confidence.
- **A11y:** `aria-live="polite"` on streaming region; buttons labeled.
- **Tokens:** `.ai-surface`, `.ai-chip`, `glow-ai`, `animate-pulse-glow`, `badge-brand`.
- **Usage:** all AI (briefings, recommendations, per-object actions) uses this — never a plain card.

### 2.5 `Timeline`
- **Purpose:** the single timeline style across every object + activity history.
- **Variants:** `default`, `compact`.
- **States:** empty; tone per item (`won`/`lost`/`note`/`neutral`).
- **A11y:** ordered list; time as `<time>`.
- **Tokens:** dot tones, `t-meta` for time, hairline connector.

### 2.6 `ActivityFeed`
- **Purpose:** one activity-feed design (org-wide + per-object).
- **Variants:** `default`, `dense`.
- **States:** empty; live (new items animate in — "living" feel).
- **A11y:** list semantics; actor + action + object are links.
- **Tokens:** `Avatar`, relative-time `t-micro`, hairline rows.

### 2.7 `ObjectHeader` + `ObjectPage` (the object-detail template)
- **Purpose:** the canonical layout for **every** first-class object. Learn once, use everywhere.
- **Structure (fixed):**
  ```
  ObjectHeader:  Avatar/Logo · Name · Status badges · AI summary line · Quick actions
  Tabs:          Overview · Timeline · Work · Meetings · Knowledge · Relationships · Analytics
  Content:       the selected facet (each a Section composition)
  ```
- **Variants:** tab set is configurable per object type (hide tabs that don't apply) but order + look are fixed.
- **States:** loading (skeleton header + tabs), empty facets (EmptyState), AI-summary streaming.
- **A11y:** tabs are ARIA `tablist`/`tab`/`tabpanel`; arrow-key navigation; deep-linkable via URL.
- **Tokens:** ObjectHeader uses hero PageHeader language + `.ai-surface` summary; facets are Sections.
- **Usage:** Company 360, Person 360, Deal 360, Department all instantiate this. **Do not build a
  bespoke detail page.**

### 2.8 Supporting primitives (already token-based)
`Badge` (variants brand/success/warning/danger/info/neutral) · `Avatar` (initials → photo) ·
`Button` (`btn-accent`/primary, `btn-action`, `btn-ghost` — three tiers only) · `Field/.inp` ·
`EmptyState` (icon + hint + action) · `Skeleton`/`.shimmer` · `CommandPalette` · `WorkspaceToggle`.

---

## 3. Page templates

Two archetypes; everything is one of them:

**A. Collection page** = `PageHeader` + toolbar (search/filters/saved views/bulk) + one of
{Table, Board, Grid} + pagination. (Work pipeline, Companies book, People directory.)

**B. Object page** = `ObjectPage` template (§2.7). (Every 360.)

Plus **C. Workspace/Home** = `PageHeader(hero)` + **zones** (see §4), not a collection.

---

## 4. Home / workspace zones (rhythm, not noise)

Home is composed of ordered zones, each a `Section`, each answering one scan question:

```
1. Focus            what needs you now (overdue, approvals, at-risk)     → scan: what's urgent
2. AI Briefing      Chief-of-Staff narrative (AICallout: briefing)       → scan: what changed / do-first
3. Company Pulse    KpiRow (booked / forecast / pipeline / win rate)     → scan: what's improving
4. Today's Schedule agenda strip (Timeline compact)                      → scan: where I need to be
5. Team Activity    ActivityFeed (live)                                  → scan: what the team did
```

Role-aware: reps see Focus + Schedule + their work; owner sees all five.

---

## 5. Module personalities (same system, different feel)

| Module | Density | Hero | Signature |
|---|---|---|---|
| **Work** | Compact, execution-first | small header | Board/pipeline, statuses, SLA chips |
| **Companies** | Spacious, relational | ObjectPage hero | rich Timeline + relationship graph |
| **People** | Profile-forward | Avatar hero | workload bars + KPI tiles |
| **Knowledge** | Calm reading | minimal | wide measure, generous line-height, few colors |
| **AI / Command** | Premium, animated | `.ai-surface` hero | glow, pulse, streaming, confidence |
| **Organization/Admin** | Structured | plain header | tables, matrices, audit |

---

## 6. Data visualization standards

- **Palette:** categorical = brand ramp (cyan, indigo, violet, teal, coral) in fixed order;
  sequential = single-hue cyan; diverging = teal↔coral. Never rainbow.
- **Rules:** value labels over axes where possible; one legend style; consistent bar radius
  (`md`) + track (`bg-white/[0.06]`); animate on mount (grow/count-up), not on every render.
- **Executive quality:** big number + sparkline/bar + delta. No chartjunk, no 3D, no gradients on
  data marks (gradients are brand chrome, not data encoding).
- Reuse the existing `metricsService`/`conveyorMetricsService` outputs — viz is presentation only.

---

## 7. Motion guidelines

- **Purpose > decoration.** Motion communicates responsiveness + causality.
- Page/content: `.animate-in` (fade+rise, 340ms). Overlays: `animate-scale-in` (200ms).
- Hover: cards lift (`hover-lift` / `.glass-hover`, −2px + `e2`). Buttons brighten + glow.
- AI: pulse-glow while thinking; typing dots; stream text.
- Lists: new items fade in from top; completed work animates into history.
- Numbers: count-up on first paint for KPIs.
- **Budget:** ≤ 1 attention-grabbing motion per zone; everything else ambient. Honor
  `prefers-reduced-motion`.

---

## 8. Accessibility rules (never traded for aesthetics)

- **Contrast:** body text ≥ 4.5:1, large/UI ≥ 3:1 on its surface. (Muted/faint validated against
  panel/elevated.)
- **Keyboard:** everything operable; visible `:focus-visible` ring (cyan). ⌘K + arrow-key nav in
  palette/tabs/menus.
- **Semantics:** one `<h1>`/page, ordered headings, `tablist`/`tab`/`tabpanel`, `aria-live` for AI
  + toasts, real buttons/links (no click-divs).
- **Color independence:** status conveyed by icon/label + color, never color alone.
- **Motion:** reduced-motion disables non-essential animation.

---

## 9. Command Palette as the primary layer

- Always one keystroke (⌘/Ctrl+K) + a visible sidebar trigger.
- Verbs: **Search** anything · **Create** anything · **Navigate** anywhere · **Ask AI** ·
  **Trigger workflow** · **Switch workspace**.
- Results grouped (Go to · Actions · Results); keyboard-first; object results deep-link to 360s.
- Roadmap: inline create (task/meeting) without leaving the palette; recent + suggested actions.

---

## 10. Rollout sequence (after this is ratified)

1. Land primitives (`src/components/ds/`) + `/design` showcase. ← **this milestone**
2. Convert **Home** to zones (§4).
3. Build **Company 360** + **Person 360** on `ObjectPage`.
4. Convert Work/People/Knowledge collection pages to the Collection template + module personality.
5. Migrate all ad-hoc `div.glass`/headers/metrics to `Section`/`PageHeader`/`KpiRow`.
6. Swap emoji → Lucide icon set; add data-viz components; light-mode token pass.
7. Delete superseded bespoke layouts.

**Definition of done:** every screen composes only from this catalogue; the crop test passes.
