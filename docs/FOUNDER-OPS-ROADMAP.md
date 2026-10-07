# The Founder-Ops Wave

**Status: roadmap.** The `payroll` ranking (Payroll & HR Ops) is the opener of a wave of rankings
covering the operational stack every startup runs on: money, people, customers, and paperwork.
The thesis is the same one that drives the whole site — in the AI era the deciding question for
ops software is no longer just "does it have the feature?" but *"can my agent drive it?"* —
and founder-ops tools vary wildly on that axis today. Some (Stripe, HubSpot, PostHog, Cal.com)
publish MCP servers and OpenAPI specs; others (most PEOs, most insurance brokers) have no
public API at all. That spread makes for decisive, non-degenerate rankings.

Each proposed ranking below lists: the ranking id we'd register in `data/categories.json`, the
product slate, three decisive stories (the cells most likely to split the field), and
agent-access notes (who has real APIs/MCP/webhooks **today**, as of early September 2026 —
re-verify with the probe stage before building; this table goes stale fast).

Conventions carried over from existing rankings: every category gets the 29 canonical
agenticness/openness/automation/privacy stories injected by `pipeline/agentic-stories.ts`;
personas should include `founder`, `ops`, and `ai-native`; weights 3 = core daily need.

## Priority order (proposed)

1. **accounting** — highest demand-side overlap with payroll and banking rankings already live;
   QuickBooks/Xero API depth vs AI-native bookkeepers is the single most contested founder-ops
   question.
2. **crm** — biggest product spread (Attio's modern API + MCP vs Salesforce's enterprise
   surface), huge search volume.
3. **support** — Plain and Intercom are racing on AI agents (Fin) vs API-first workflows;
   extremely AI-era-relevant.

The rest follow in rough order of agent-access signal density.

---

## 1. Accounting — `accounting`

**Products:** QuickBooks Online (Intuit), Xero, Puzzle, Pilot (service+software), FreshBooks
(optional 5th), Wave (optional).

**Three decisive stories:**
- As an ops user, I can close my books monthly with automated categorization and
  reconciliation suggestions.
- As an ai-native user, I can have an agent draft journal entries via API and leave them in a
  review queue for my accountant.
- As a developer, I can pull a full general ledger and trial balance through a documented API
  in open formats.

**Agent-access notes:** Intuit has a mature OAuth REST API + webhooks and has been shipping
GenAI features; Xero has a strong public API + OpenAPI specs on GitHub + webhooks. Puzzle is
AI-native and API-forward (built for startups, integrates with Mercury/Brex/Ramp/Gusto).
Pilot is largely a human-service wrapper — thin public API, good contrast product (the
"Justworks of accounting"). Check for official MCP servers at probe time: Intuit and Xero have
both been piloting them.

## 2. Cap table — `cap-table`

**Products:** Carta, Pulley, AngelList (Equity/Stack), Ledgy (intl option).

**Three decisive stories:**
- As a founder, I can issue options to a new hire with board approval flow and 409A-compliant
  strike price in one flow.
- As an ops user, I can run a funding-round scenario model (dilution, waterfalls) and share it
  with counsel.
- As an ai-native user, I can have an agent pull my current cap table via API and reconcile it
  against my data room before a financing.

**Agent-access notes:** Carta has a partner/developer API (restricted access — good test of the
"public vs partner-gated API" distinction our canon stories draw). Pulley and AngelList expose
less; expect low agentReady scores across the board — that's the story of this ranking, and worth
publishing precisely because nobody has planted the agent-access flag yet.

## 3. Incorporation & legal — `incorporation`

**Products:** Stripe Atlas, Clerky, Firstbase, doola (optional).

**Three decisive stories:**
- As a founder, I can incorporate a Delaware C-corp with standard docs (charter, bylaws, IP
  assignment, 83(b)) without a lawyer.
- As a founder, I can get my EIN, bank account, and post-incorporation resolutions handled in
  the same flow.
- As an ai-native user, I can have an agent retrieve my formation documents and entity status
  programmatically for downstream KYC forms.

**Agent-access notes:** Stripe Atlas rides on Stripe's world-class API + MCP + llms.txt docs
surface (though Atlas itself is mostly a flow, not an API). Clerky and Firstbase are
form-driven SaaS with no public APIs. One-shot product category (low recurring usage) — rank
it once, refresh rarely.

## 4. Expense management — `expense-management`

**Products:** Ramp, Brex, Airbase, Expensify, Navan (optional).

Note: Ramp and Brex already compete in `startup-banking`. This ranking judges the *expense
workflow* axis (receipts, policies, reimbursements, travel) — same products, different story
set; precedent for products appearing in two rankings.

**Three decisive stories:**
- As an ops user, I can enforce expense policy at swipe time with per-category limits rather
  than chasing violations after the fact.
- As an ai-native user, I can have receipts auto-captured, coded, and matched with zero manual
  entry.
- As an ai-native user, I can have an agent flag out-of-policy spend via API/webhooks before
  the monthly close.

**Agent-access notes:** Ramp (API + MCP + CLI — already verified in startup-banking) and Brex
(API + MCP) are the strongest agent-access stories in all of founder-ops. Expensify has a
public API (expensify-api, older ergonomics). Airbase/Navan are weaker. Expect Ramp/Brex 1-2.

## 5. CRM — `crm`

**Products:** HubSpot, Attio, Salesforce, Pipedrive (optional), Twenty (OSS option — gives the
openness lens a real contender).

**Three decisive stories:**
- As a founder, I can go from spreadsheet to working pipeline with enriched company records in
  under an hour.
- As an ai-native user, I can connect an agent through an official MCP server to query and
  update records conversationally.
- As a developer, I can model custom objects and sync them bidirectionally via API without
  fighting rate limits.

**Agent-access notes:** HubSpot ships an official MCP server and deep API + webhooks. Attio is
API-first with a modern REST API, webhooks, and MCP. Salesforce has the deepest enterprise API
surface (REST/SOAP/Bulk/GraphQL, Agentforce) but the worst time-to-first-call. Twenty is
open-source (self-host + full export = openness sweep). This ranking has the richest evidence
base of the whole wave.

## 6. Support — `support`

**Products:** Intercom, Plain, Zendesk, Front (optional), Chatwoot (OSS option).

**Three decisive stories:**
- As an ops user, I can deflect common questions with an AI agent grounded in my docs, with
  human handoff.
- As a developer, I can drive the entire inbox (create, reply, snooze, tag) through a typed
  API — everything the UI can do.
- As an ai-native user, I can subscribe to conversation events via webhooks so my own agent
  can triage before a human sees the ticket.

**Agent-access notes:** Plain is API-first (GraphQL, built for programmatic support) — the
Attio of this ranking. Intercom has a strong REST API + webhooks + Fin AI agent (agenticApp
heavyweight). Zendesk has a mature API but legacy ergonomics. Chatwoot is open-source
(self-host). Strong spread on both agentReady and agenticApp axes.

## 7. Scheduling — `scheduling`

**Products:** Cal.com, Calendly, SavvyCal (optional), Zcal (optional).

**Three decisive stories:**
- As a founder, I can share a booking link that handles time zones, buffers, and round-robin
  across my team.
- As an ai-native user, I can have an agent book, reschedule, and cancel meetings through a
  documented public API.
- As an ai-native user, I can self-host my scheduling stack and export every booking.

**Agent-access notes:** Cal.com is the canonical AI-era scheduling product: open source, public
API v2, official MCP server, llms.txt-friendly docs — likely ranking winner and a great
"openness sweeps" showcase. Calendly has a solid API + webhooks but closed source. Small,
cheap ranking to build (2-4 products); good fast-follow after payroll.

## 8. E-signature — `e-signature`

**Products:** DocuSign, Dropbox Sign (HelloSign), Documenso (OSS), SignWell (optional).

**Three decisive stories:**
- As an ops user, I can send an envelope with fields, signing order, and reminders in one
  flow.
- As a developer, I can trigger signature requests from templates via API and get completion
  webhooks.
- As an ai-native user, I can self-host my signature infrastructure and keep every signed
  artifact in open formats.

**Agent-access notes:** Dropbox Sign's API is famously developer-friendly; DocuSign's is
enterprise-deep with an official OpenAPI spec on GitHub; Documenso is open-source (openness
lens contender). All three have real APIs — this ranking differentiates on api-quality, not
existence.

## 9. Product analytics — `product-analytics`

**Products:** PostHog, Amplitude, Mixpanel, Plausible (optional, adjacent), Statsig (optional).

**Three decisive stories:**
- As a founder, I can answer "which activation step loses users?" with funnels and session
  replays without an analyst.
- As an ai-native user, I can point an agent at a documented query API (HogQL/JQL-equivalent)
  and get raw event data back.
- As an ai-native user, I can connect an agent via an official MCP server to run analyses
  conversationally.

**Agent-access notes:** PostHog is the AI-era benchmark: open source, llms.txt, official MCP
server, full API, self-host. Amplitude and Mixpanel have strong APIs and shipping AI
assistants but are closed. Probably the *easiest* ranking in the wave to score well (dense docs,
heavy dev audience) — a strong candidate to build second.

## 10. Business insurance — `startup-insurance`

**Products:** Vouch, Embroker, Coalition (cyber, optional), Next Insurance (optional).

**Three decisive stories:**
- As a founder, I can get D&O/E&O/cyber quotes online in minutes and share certificates of
  insurance from a dashboard.
- As an ops user, I can add a certificate holder or update coverage at fundraise time without
  a broker phone call.
- As an ai-native user, I can have an agent retrieve my current policies and COIs via API for
  vendor-onboarding paperwork.

**Agent-access notes:** Weakest agent-access category in the wave — Vouch and Embroker are
digital-first brokers but publish no public APIs. Expect near-zero agentReady across the
board; publish anyway as the baseline "pre-AI-era" contrast ranking, and to pressure the
category. Evidence will lean on marketing + community tiers; keep expectations (and refresh
cadence) low.

## 11. Mobile payments / POS — `mobile-payments`

**Products:** Stripe Terminal, Square, SumUp, Adyen (POS/Terminal API), PayPal Zettle
(optional).

**Three decisive stories:**
- As a founder, I can start taking in-person card payments the same week, with hardware
  ordered from the dashboard.
- As a developer, I can build a custom checkout on the terminal via a documented SDK/API
  (server-driven integration).
- As an ai-native user, I can subscribe to payment events via webhooks and reconcile payouts
  into my ledger automatically.

**Agent-access notes:** Stripe has the strongest agent surface in all of software (API, MCP,
llms.txt, agent toolkits); Adyen and Square both publish OpenAPI specs and webhooks; SumUp has
a public API (thinner). This is also the beachhead for the broader `payments` ranking already in
the queue — consider building `payments` first and splitting POS out later if the story sets
diverge (precedent: the planned mobile-dev split).

---

## Cross-cutting notes

- **Shared-product policy:** Ramp/Brex (banking + expense), Stripe (payments + POS +
  incorporation) will appear in multiple rankings. Stories must be ranking-scoped so verdicts
  don't leak across rankings; ids stay globally unique per category directory, so no code
  changes needed.
- **Probe-first triage:** before committing to any ranking, run the keyless probes (llms.txt,
  OpenAPI conventions, MCP/CLI links) across the slate. If fewer than 2 products have any
  positive probe, the ranking will be degenerate on the agent axes — publish only with a strong
  editorial reason (see startup-insurance).
- **Vertical AI-native stories:** every ranking above needs ≥3 domain ai-native stories (the
  payroll ranking's pattern: agent previews the run / agent onboards the hire / agent reconciles
  the ledger). Write them at authoring time; they're the cells readers quote.
- **Refresh cadence:** MCP server availability is changing monthly across these vendors.
  Agent-access notes in this doc are point-in-time (2026-09) — the probe + judge pipeline, not
  this doc, is the source of truth once a ranking ships.
