import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { isPopulated, loadCategory } from './data'
import { resolveGapStep } from './gapClosers'
import { GEO_NOTE_KINDS } from './geoPreference'
import { JURISDICTIONS, type Jurisdiction, type JurisdictionStepView } from './jurisdictions'
import { hasLogo } from './logos'
import { isShutdown } from './shutdown'
import type { Cadence, GapResolution, ProcessKind, Reversibility, SimStep, StepRoute, SwapOption, Urgency, VendorRole } from './processSim'
import { DECISION_STEP_RE, formatMinutes, gapWhy, PROCESS_KINDS, REVERSIBILITY_TIERS, URGENCY_TIERS } from './processSim'

// Client-safe prop shapes + display helpers live in lib/processSim.ts (no node:fs) so the
// simulator client component can import them; re-exported here for server-side callers.
export { formatMinutes, gapWhy, PROCESS_KINDS, REVERSIBILITY_TIERS, URGENCY_TIERS }
export type { Cadence, GapResolution, ProcessKind, Reversibility, SimStep, StepRoute, SwapOption, Urgency, VendorRole }

// The founder-process corpus (processes/corpus.json): 146 real startup operating records — 124
// timeline processes plus 22 reactive SITUATIONS (kind 'situation', founder ask 2026-10-01;
// wave 3 boost 2026-10-02) —
// each mapped as a DAG whose nodes are routed 'agent' (an agent can drive the step via a
// recorded API/tool call), 'form' (manual form/portal work — no public API path), or 'person'
// (a human or a computer-use agent does it: meetings, judgment, waiting on a third party — with
// legally required signature acts flagged legalSignature, the true human floor). The feature's
// thesis lives in that routing: the per-process **agent ceiling** (share of steps an agent can
// run today) and the **gaps** (the non-agent steps) are first-class findings, not footnotes.
//
// Distinct from lib/aiStacks.ts (composes products across arenas) — this maps *processes* onto
// arenas: a DAG vendor that has an arena here resolves to that arena's live leaderboard, so a
// process page can show the canonical vendor, the market alternatives ranked by agent-readiness,
// and let the simulator swap them.

export const FunctionCallSchema = z.object({
  method: z.string().min(1),
  type: z.enum(['rest', 'sdk', 'graphql', 'manual']).optional(),
  description: z.string().optional(),
})

// One explicit cross-arena vendor for a step: a judged product in an arena OTHER than the
// step's covering arena that genuinely performs this move ("generate a website" is served by
// ChatGPT from ai-assistants and Framer from design-tools, not just the vibe-coding roster).
// Display-only, and evidence-gated downstream: lib/processRankings.ts surfaces a ref only when
// the committed (step, extra-arena) story mapping exists and the product has at least one
// judged full/partial verdict on the mapped stories — a ref is a candidate, never a claim.
export const ExtraOptionRefSchema = z.object({
  arenaId: z.string().min(1),
  productId: z.string().min(1),
})

export type ExtraOptionRef = z.infer<typeof ExtraOptionRefSchema>

// Declared ahead of the node schema so method contexts can reference it — see the GEO dimension
// block below (founder ask 2026-09-28) for the full story of these countries (PT and CA joined
// in the new-countries wave, founder 2026-10-03).
export const GEO_NOTE_COUNTRIES = ['IN', 'UK', 'DE', 'FR', 'PT', 'CA'] as const
export type GeoNoteCountry = (typeof GEO_NOTE_COUNTRIES)[number]

export const DagNodeBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  route: z.enum(['agent', 'form', 'person']),
  vendor: z.string().min(1).optional(),
  // Companies that can perform this step — the market for a "choose/sign up" step. Tracked
  // vendors render as chips linking to their judged product page; untracked ones (e.g. doola)
  // render as honest unlinked chips. Distinct from `vendor` (the canonical call target).
  vendorOptions: z.string().min(1).array().optional(),
  // The arena (categories.json id) covering this step's GENERAL FUNCTION — "run payroll" →
  // payroll, "choose a bank" → startup-banking. Display-only: stepVendorOptions() DERIVES the
  // step's supplier list from this arena's live leaderboard at build time (top products by
  // Overall score, capped), so roster changes flow through automatically instead of freezing
  // product lists here. vendorOptions stays the hand-curated set; entries not in the arena
  // are appended after the derived roster. Steps whose function is narrower than any arena
  // (formation services inside legal-ops) or has no arena yet (SEO tools, cloud file storage,
  // launch platforms) omit this and keep their curated options frozen.
  optionsArenaId: z.string().min(1).optional(),
  // ADDITIONAL covering arenas whose whole market genuinely performs this move — "install SDK
  // in codebase" is served by every ai-coding agent, not just the step's own arena. Like
  // optionsArenaId these are display-only, but stricter: cross-arena vendors surface ONLY via
  // the story-derived ranking (lib/processRankings.ts crossArenaStepRankings) — the committed
  // (step, extra-arena) mapping plus a judged full/partial verdict — never as an ungated roster.
  extraOptionArenas: z.string().min(1).array().optional(),
  // Explicit cross-arena vendor candidates (see ExtraOptionRefSchema) for steps where only
  // SPECIFIC products of another arena do the move (Framer/Figma/Canva build sites; the rest of
  // design-tools doesn't). Same evidence gate as extraOptionArenas.
  extraOptionRefs: ExtraOptionRefSchema.array().optional(),
  toolCall: z.string().min(1).optional(),
  // The canonical external page a HUMAN uses to do this step themselves (the IRS EIN
  // application, Delaware's filing portal, USPTO search…) — rendered as a small
  // "do it yourself ↗" link on the step block, distinct from the evidence-y vendor chips
  // (which link to OUR judged product pages). Only ever populated with a verified-live
  // canonical URL; steps with no canonical page simply have no link.
  actionUrl: z.string().url().optional(),
  // Short human label for actionUrl, e.g. "IRS EIN application". Falls back to the hostname.
  actionLabel: z.string().min(1).optional(),
  functionCalls: FunctionCallSchema.array().optional(),
  // Vendor signup page for manifest consumers (lib/processManifest.ts) — actionUrl/actionLabel
  // above are the canonical declarations; this is the remaining forward-compat field.
  signupUrl: z.string().min(1).optional(),
  approvalRequired: z.boolean().optional(),
  // The founder's "true human floor" (2026-09-21): this step IS a legally required human
  // signature/attestation act — a statute or counterparty genuinely requires a human to sign
  // or swear (board/stockholder consents, 83(b) elections, notarized USPS 1583, I-9/W-4
  // attestations, tax-return jurats). Only meaningful on route 'person'. Judgment calls that
  // merely FEEL human (go/no-go decisions, reviews, meetings) are NOT legalSignature — they
  // present as "human or computer use". Combined prep+signature steps are split in the corpus
  // so this flag marks only the signature act itself.
  legalSignature: z.boolean().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  estimatedMinutes: z.number().min(0),
  async: z.boolean().optional(),
  // Jurisdiction-conditional step (founder 2026-09-25: "allow more options for the processes —
  // ie multi-state situations or California included"): this step only applies when the reader
  // turns the named jurisdiction option on (['CA'] = operating in California, ['MULTI'] =
  // operating in multiple states). Absence = the step applies everywhere (the Delaware-only
  // default). loadProcesses() STRIPS conditional nodes at load time, so every static surface —
  // ceilings, rankings, the simulator, the manifest, the DAG, derived/generated step data —
  // keeps the byte-identical default view and no judged number moves; the steps only render
  // client-side via components/JurisdictionToggle.tsx (jurisdictionStepViews below). Task-level
  // totals (activeMinutes/totalEstimatedMinutes/hasAsyncSteps) describe the DEFAULT flow and
  // deliberately exclude conditional nodes. Client-safe half in lib/jurisdictions.ts.
  jurisdictions: z.enum(JURISDICTIONS).array().min(1).optional(),
  // Internal pointer for a conditional step whose work already lives in its OWN corpus process
  // (the sales-tax-nexus case — link it, never duplicate it): the canonical slug of that
  // process. Display-only; integrity (resolves to a real process) is corpus-tested.
  processRef: z.string().min(1).optional(),
})

// ---------------------------------------------------------------------------
// Depth wave part 1 (founder 2026-10-01): two per-step cited fields — verification checks and
// real costs. Both OPTIONAL and ADDITIVE; no judged number reads either, so every committed
// surface is unchanged. Declared ahead of the method-variant schemas so a variant can carry its
// own published cost (founder spike 2026-10-02 — method sub-steps stay display-level).
// ---------------------------------------------------------------------------

// "How do I know it worked?" — a concrete, externally checkable test for the step, with the
// primary-source URL of the checking tool where one exists (the DE entity search, TSDR, EDGAR
// full-text search, RDAP lookup…). Curation honesty (processes/README.md "Verification
// checks"): a verify that merely restates the step is worse than absence — drafting steps and
// internal decisions carry none; URLs are https, primary sources (government portals, registrar
// tools) preferred, and every one is curl-verified live before it ships.
export const StepVerifySchema = z.object({
  how: z.string().min(1),
  url: z.string().url().optional(),
})

export type StepVerify = z.infer<typeof StepVerifySchema>

export const COST_KINDS = ['government-fee', 'typical-vendor-price', 'free'] as const
export type CostKind = (typeof COST_KINDS)[number]

// The real, KNOWABLE cost of a step. Honesty contract (processes/README.md "Cost honesty"):
// every number carries the source URL of a published fee schedule or sticker-price page plus
// the asOf date it was read — fees change, the asOf date is the contract, currentness is never
// claimed. `usd: null` is the honest spelling of "a real cost exists but no published number
// does" (attorney fees vary) — the source then explains the variability; nothing is estimated
// or averaged. `note` carries the required caveat (minimums, per-class fees, what's bundled).
export const StepCostSchema = z.object({
  usd: z.number().min(0).nullable(),
  kind: z.enum(COST_KINDS),
  source: z.string().url(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'asOf must be an ISO date (YYYY-MM-DD)'),
  note: z.string().min(1).optional(),
})

export type StepCost = z.infer<typeof StepCostSchema>

// ---------------------------------------------------------------------------
// Method variants (founder 2026-09-30: "certain processes have steps that are just ONE way to
// do it when there are multiple methods depending on context — get multiple options selectable
// by context … sub-DAGs for all DAG choices that have multiple paths").
// ---------------------------------------------------------------------------

export const METHOD_CONTEXT_KINDS = ['situational', 'geo', 'vendor'] as const

// When a method variant is the right one. Honesty contract: `when` is a short PREDICATE
// description ("B2B/enterprise — demand signal comes from conversations, not clicks",
// "incorporating in the UK"), never marketing. Geo methods carry the committed country codes
// they apply to — the same GEO_NOTE_COUNTRIES set the geo switcher and geoNotes use, so the
// client geo selection can auto-preselect a matching method. `countries` is REQUIRED for kind
// 'geo' and forbidden otherwise — enforced at load time (loadProcesses) rather than as a zod
// refinement, so the published JSON schema stays a plain object shape() can check.
export const StepMethodContextSchema = z.object({
  kind: z.enum(METHOD_CONTEXT_KINDS),
  when: z.string().min(1),
  countries: z.enum(GEO_NOTE_COUNTRIES).array().min(1).optional(),
})

// One alternative way to run a step — the node's own fields stay the DEFAULT method (so every
// committed number — ceilings, rankings, simulator, manifest — keeps describing the default
// flow byte-identically; a variant is a display-level choice). A variant may override the
// step's route/vendors/calls/action/time, and may decompose into a small sub-DAG (subSteps:
// 2–5 nodes, same node schema minus further nesting — sub-steps never carry methods).
// Vendor/arena refs obey the corpus house rules: only REAL judged arenas/products (or the
// deliberate untracked-chip allowlist), every actionUrl verified live, estimatedMinutes only
// where honest (derived from subSteps or omitted — never invented).
export const StepMethodSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'method id must be kebab-case'),
  label: z.string().min(1),
  summary: z.string().min(1),
  context: StepMethodContextSchema,
  route: z.enum(['agent', 'form', 'person']).optional(),
  vendor: z.string().min(1).optional(),
  vendorOptions: z.string().min(1).array().optional(),
  optionsArenaId: z.string().min(1).optional(),
  actionUrl: z.string().url().optional(),
  actionLabel: z.string().min(1).optional(),
  functionCalls: FunctionCallSchema.array().optional(),
  estimatedMinutes: z.number().min(0).optional(),
  subSteps: DagNodeBaseSchema.array().min(2).max(5).optional(),
  // The variant's own real, sourced cost (founder spike 2026-10-02, form_001 reference depth):
  // same StepCostSchema honesty contract as the full node — published stickers and fee
  // schedules only, `usd: null` where the real cost has no single published USD number (the
  // £100 Companies House fee, Germany's value-based GNotKG notary fees). Variant costs are
  // never averaged into anything: knownCostUsd() and every judged number keep reading the
  // DEFAULT node only; this field is data-truth for the variant panel (display follow-up is a
  // later pass — the summary prose carries the figure honestly meanwhile).
  cost: StepCostSchema.optional(),
})

export type StepMethodContext = z.infer<typeof StepMethodContextSchema>
export type StepMethod = z.infer<typeof StepMethodSchema>

// Failure modes (founder spike 2026-10-02, form_001 reference depth): what actually goes wrong
// at this step and what the honest recovery is. Curated ONLY where the failure is sourced or
// structurally certain (a name conflict, a defective-certificate rejection, a lost stamped
// certificate, the missed 83(b) window) — never speculative, never a generic "be careful".
// `what` names the failure, `then` the recovery — or the honest "no recovery; this is a
// conversation with counsel" where that is the truth (needs_review posture). `source` is the
// primary page/statute/fee schedule backing the entry (curl-verified live, like every corpus
// URL); legal claims additionally cite a dated rule card in rules/ by id inside the prose, the
// situations-house precedent. 3–6 QUALITY entries per deep process, not coverage — see
// processes/README.md "Failure modes". Display: none since founder 2026-10-05 (the collapsed
// '⚠ if it goes wrong' step line was removed) — the field stays corpus data, carried by the
// manifests; no judged number reads it.
export const StepFailureModeSchema = z.object({
  what: z.string().min(1),
  then: z.string().min(1),
  source: z.string().url().optional(),
})

export type StepFailureMode = z.infer<typeof StepFailureModeSchema>

// The full node schema: the base fields (the DEFAULT method) plus optional method variants.
// COMPAT-ADDITIVE: a node without methods is exactly the pre-variant schema, and no default
// surface reads methods — computeCeiling, buildSimSteps, the manifest, the rankings and the
// derived generators all keep consuming the base fields only.
export const DagNodeSchema = DagNodeBaseSchema.extend({
  methods: StepMethodSchema.array().min(1).optional(),
  // The artifact layer, node half (founder depth wave part 2, 2026-10-01: typed inputs/outputs
  // between steps): the registry artifact (processes/artifacts.json) that comes into existence
  // at THIS step — the certificate received, the account opened, the paper signed. OPTIONAL per
  // node, but corpus-tested as the exact node-level image of the task's `produces` list (set
  // equality per task, lib/__tests__/processArtifacts.test.ts), and never on a
  // jurisdiction-conditional node (those are stripped from the default view). Full-node only —
  // method-variant subSteps stay display-level.
  producesArtifact: z.string().min(1).optional(),
  // Reversibility of THIS step's own act (founder 2026-09-30: "map what is irreversible and
  // what is reversible — for ALL processes and process steps"). REQUIRED with no zod default —
  // every node is explicitly curated (an unclassified node fails the corpus parse; totality and
  // distribution are corpus-tested). Tier definitions + curation rules live on
  // REVERSIBILITY_TIERS in lib/processSim.ts and in processes/README.md. The tier attaches to
  // the step's own act (a "wait/receive" step commits nothing → reversible; the filing before
  // it carried the commitment). Method-variant subSteps (DagNodeBaseSchema) deliberately do NOT
  // carry the field this phase — variants are display-level; the default flow is the judged
  // surface.
  reversibility: z.enum(REVERSIBILITY_TIERS),
  // "How do I know it worked?" — see StepVerifySchema above. Optional: absence means the step
  // has no meaningful external check (drafting, internal decisions), never that one was missed.
  verify: StepVerifySchema.optional(),
  // The step's real, sourced cost — see StepCostSchema above. Optional: absence means no
  // knowable published number, never $0 (that's kind 'free' with usd 0).
  cost: StepCostSchema.optional(),
  // What actually goes wrong here and the honest recovery — see StepFailureModeSchema above.
  // Optional and deliberately sparse: absence means no sourced/structurally-certain failure
  // mode is curated yet, never that the step can't fail.
  failureModes: StepFailureModeSchema.array().min(1).optional(),
  // Canonical open documents for THIS step — ids into open-documents/registry.json (the Cooley GO
  // incorporation package for the bylaws-drafting step, IRS Form 15620 for the 83(b) steps).
  // Added by the founder spike 2026-10-02 after confirming NO prior mechanism linked corpus
  // steps to the documents registry; extended across the corpus and RENDERED the same day
  // (founder batch 2026-10-02): components/ProcessDag.tsx shows each id as an external-link
  // chip (registry title as label, canonical URL as target). Referential integrity is
  // corpus-tested both ways (lib/__tests__/processDocuments.test.ts — every id must resolve in
  // the registry, and the render lookup throws on an unknown id).
  documents: z.string().min(1).array().min(1).optional(),
})

// An old URL slug that must keep working after a rename (founder rule: processes are named
// vendor-neutral — "Send an invoice", not "Send Stripe invoice" — but old vendor-flavored
// slugs are indexed and shared). Static export means no server redirects, so each alias
// prerenders the full page with a canonical link + a pointer line naming the old flavor
// (`label` = the old title).
export const SlugAliasSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'alias slug must be kebab-case'),
  label: z.string().min(1),
})

export type SlugAlias = z.infer<typeof SlugAliasSchema>

// The GEO dimension (founder ask 2026-09-28: "a GEO dimension for our analysis — e.g.
// USA-centric processes vs global processes; choosing a name is global"). One curated note per
// country DOCUMENTING the real non-US analog of a US-scoped process — what a founder in that
// country does instead ("incorporate C-Corp" → UK Companies House, India MCA SPICe+, Germany
// notary + Handelsregister, France INPI guichet unique) — and, since the mapping expansion
// (founder ask 2026-09-29: "map the processes in the countries we tried to spike"), the real
// per-country FLAVOR of a global process where it is jurisdictionally flavored (founder
// agreement stamp duty in India, invoice e-invoicing mandates, offboarding law, GDPR/DPDP).
// Editorial and honest: every actionUrl is curl-verified live before listing (the
// VENDOR_SIGNUP_URL house rule — no unverifiable URL is fabricated; official-host blocks get
// the mca.gov.in→NSWS substitution, never a fabricated link), and a country with no true
// analog simply carries no note. Display-only for every judged number; since the country-view
// filter (founder ask 2026-10-02: "?geo=in should hide the processes that are not used in that
// country") each note also carries a required `kind` — analog / absorbed / not-applicable, the
// vocabulary lives client-safe in lib/geoPreference.ts GEO_NOTE_KINDS — which drives ONLY which
// rows the /processes table shows inside a country view; the default and Global views keep the
// full corpus and no judged number reads it. Rendered as the "Outside the US" block on
// /processes/[slug]. (GEO_NOTE_COUNTRIES itself is declared above the node schema so method
// contexts can share the same country codes.)
export const GeoNoteSchema = z.object({
  country: z.enum(GEO_NOTE_COUNTRIES),
  // What the committed summary SAYS the need becomes in this country (explicitly curated on
  // every note — no default, so an uncurated note fails the corpus parse):
  //   'analog'         — the need exists there as its own doable process;
  //   'absorbed'       — handled automatically inside another process there (EIN → IN: PAN/TAN
  //                      arrive with the SPICe+ incorporation filing);
  //   'not-applicable' — the need genuinely doesn't exist there (the UK has no 1099 regime).
  kind: z.enum(GEO_NOTE_KINDS),
  // What the analog IS and how it differs — one or two honest sentences, not marketing.
  summary: z.string().min(1),
  // The canonical page a founder in that country starts from — verified live before listing.
  actionUrl: z.string().url(),
  actionLabel: z.string().min(1),
})

export type GeoNote = z.infer<typeof GeoNoteSchema>

export const GEO_COUNTRY_META: Record<GeoNoteCountry, { label: string; flag: string }> = {
  IN: { label: 'India', flag: '🇮🇳' },
  UK: { label: 'United Kingdom', flag: '🇬🇧' },
  DE: { label: 'Germany', flag: '🇩🇪' },
  FR: { label: 'France', flag: '🇫🇷' },
  PT: { label: 'Portugal', flag: '🇵🇹' },
  CA: { label: 'Canada', flag: '🇨🇦' },
}

// Proven runs (founder spike 2026-10-02 — EXECUTED-PROOF SLOT, design only): a dated record
// that a named operator actually ran this process end to end, with the real wall clock and the
// real fees paid per step. The shape ships schema-ready and EMPTY — no run is fabricated; the
// first records will be Ultrametric Inc.'s own receipts, supplied by the founder. Disclosure
// rules (load-enforced): a run by the corpus's own operator/company sets `ownerRun: true` and
// MUST carry a `disclosure` sentence saying so — reader trust comes from the disclosure, not
// from pretending independence. Display-only when records exist; no judged number will read it.
export const ProvenRunStepSchema = z.object({
  nodeId: z.string().min(1),
  // The real elapsed wall clock for the step, as run — honest, not the corpus estimate.
  wallClockMinutes: z.number().min(0).optional(),
  // The real fees paid at this step, in USD as settled.
  feesPaidUsd: z.number().min(0).optional(),
  note: z.string().min(1).optional(),
})

export const ProvenRunSchema = z.object({
  // When the run happened (ISO date).
  ranOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ranOn must be an ISO date (YYYY-MM-DD)'),
  // Who ran it — a named person/company, never "a user".
  operator: z.string().min(1),
  // True when the operator is Ultrametric (or the corpus's maintainer) itself.
  ownerRun: z.boolean(),
  // REQUIRED when ownerRun (load-enforced): the honest one-sentence disclosure.
  disclosure: z.string().min(1).optional(),
  steps: ProvenRunStepSchema.array().min(1),
})

export type ProvenRunStep = z.infer<typeof ProvenRunStepSchema>
export type ProvenRun = z.infer<typeof ProvenRunSchema>

export const ProcessTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slugAliases: SlugAliasSchema.array().optional(),
  description: z.string().min(1),
  phase: z.string().min(1),
  // Record kind (founder ask 2026-10-01: "Situations — reactive, trigger-driven founder
  // processes — e.g. your company has a C&D, or you want to get a visa and come to Silicon
  // Valley but the visa is held up"). A situation is the same machinery as a process — a
  // routed DAG with ceilings, vendors, reversibility, geo — classified REACTIVE: `trigger`
  // names the event that puts a founder here, `urgency` is the honest clock on the first step,
  // and there is NO timeOrder slot (a situation is not a stop on the founder timeline).
  // ZOD-DEFAULTED to 'process' so every pre-existing record parses byte-identically and the
  // corpus diff stays additive-only. The kind-conditional invariants (trigger/urgency required
  // on situations and forbidden on processes; timeOrder the other way around) are enforced at
  // load time in loadProcesses() — not as zod refinements — so the published JSON schema stays
  // a plain object shape() can check.
  kind: z.enum(PROCESS_KINDS).default('process'),
  // The event that puts a founder in this situation — ONE honest sentence ("A cease-and-desist
  // letter claiming trademark infringement arrives."). Situations only.
  trigger: z.string().min(1).optional(),
  // How fast the first step must honestly happen once the trigger fires — tiers and curation
  // rules on URGENCY_TIERS/URGENCY_META in lib/processSim.ts. Situations only.
  urgency: z.enum(URGENCY_TIERS).optional(),
  // How often this process actually recurs in a running company — the operating-rhythm axis
  // (/processes/operating-rhythm). Curated per process, honestly: setup/formation work is
  // 'once', trigger-driven work (a hire, a cancellation, a new vendor) is 'event-driven',
  // and the rest is the real calendar (payroll runs monthly per the corpus DAG, books close
  // monthly, boards meet quarterly, franchise tax is annual).
  cadence: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'event-driven', 'once']),
  // Display-only jurisdiction marker (founder 2026-09-18): 'us' renders a 🇺🇸 flag on the
  // processes index + detail page for flows written around US law/agencies (DE franchise tax,
  // 409A, 1099s, EIN prerequisites, IRS/83(b) references). Absent = jurisdiction-neutral.
  region: z.enum(['us']).optional(),
  // The GEO dimension proper (founder 2026-09-28) — REQUIRED, so tagging is total by
  // construction (an untagged process fails the corpus parse; the corpus test re-asserts it):
  //   'global'   — the work is the same everywhere: choosing a name/logo/website, shipping
  //                code, running payroll once it's set up, closing the books.
  //   'us'       — written around US FEDERAL law/agencies: IRS (EIN, returns, 1099s, 83(b),
  //                R&D credit), USPTO, SEC/Reg D, I-9/W-4, H-1B, 401(k)/ERISA.
  //   'us-state' — the counterparty is a US STATE: DE franchise tax, state tax registrations,
  //                foreign qualifications, state annual reports, registered agents, sales-tax
  //                nexus. Only where the step's obligation is truly state-level.
  // Consistency with `region` (the 🇺🇸 display flag) is corpus-tested both ways: geoScope
  // 'us'/'us-state' ⇔ region 'us'.
  geoScope: z.enum(['global', 'us', 'us-state']),
  // Per-country analogs of a US-scoped process, or the honest per-country flavor of a
  // jurisdictionally-flavored global one — see GeoNoteSchema above. At most one note per
  // country per process (corpus-tested); unflavored global processes carry none.
  geoNotes: GeoNoteSchema.array().optional(),
  // The five founder orderings (founder ask 2026-09-18) — curated, display-only rank axes for
  // the /processes table. The three 1–5 scores are REQUIRED on every record so coverage is
  // total by construction; timeOrder is REQUIRED on kind 'process' and FORBIDDEN on kind
  // 'situation' (load-enforced): a situation is reactive — pretending it has a slot in the
  // founder timeline would be a lie, so situation rows sort after the timeline instead.
  //   timeOrder   — unique position in the sequence a founder actually hits these processes
  //                 (incorporation first, then banking, payroll, … — the founder timeline).
  //   annoyance   — 1–5 drudgery score: how much of a toil this is to do by hand.
  //   risk        — 1–5 cost of getting it wrong: legal / tax / security exposure
  //                 (DE franchise tax and the federal return sit at 5; naming a brand at 1).
  //   growthImpact— 1–5 how directly the process drives revenue/user growth (daily feature
  //                 shipping and outbound at 5; compliance filings at 1).
  // The regularity ordering reuses `cadence` (daily → once) — no extra field needed.
  timeOrder: z.number().int().min(1).optional(),
  annoyance: z.number().int().min(1).max(5),
  risk: z.number().int().min(1).max(5),
  growthImpact: z.number().int().min(1).max(5),
  complexity: z.enum(['simple', 'moderate', 'complex', 'very_complex']),
  // Task-level reversibility (founder 2026-09-30): what undoing the COMPLETED process actually
  // takes — dissolving a wrongly-formed entity is painful, a closed round or a filed dissolution
  // cannot be undone, abandoning a draft costs nothing. REQUIRED, explicitly curated, no zod
  // default (totality is corpus-tested; irreversible is deliberately rare). Independent of the
  // per-step tiers: a painful process can contain one truly irreversible filing step, and an
  // irreversible process is mostly reversible steps until the wire goes out. Definitions:
  // REVERSIBILITY_TIERS in lib/processSim.ts and processes/README.md.
  reversibility: z.enum(REVERSIBILITY_TIERS),
  category: z.string().min(1),
  supportLevel: z.enum(['full', 'partial', 'manual_guide']),
  supportReason: z.string(),
  vendors: z.string().array(),
  dag: z.object({
    nodes: DagNodeSchema.array().min(1),
    edges: z.object({ from: z.string(), to: z.string() }).array().optional(),
  }),
  contextNeeded: z.object({
    tool: z.string().min(1),
    query: z.string().optional(),
    tier: z.string().min(1),
    required: z.boolean(),
  }).array(),
  // The artifact layer, task half (founder depth wave part 2, 2026-10-01): typed inputs/outputs
  // between processes, as registry artifact ids (processes/artifacts.json — loadArtifacts below).
  // `contextNeeded` prose stays the human context; this is the machine truth the cross-process
  // dependency graph (lib/processDeps.ts) builds from. Both REQUIRED with no zod default — the
  // whole corpus is explicitly curated (an empty array is an honest "this process produces/needs
  // no registry artifact", an absent field fails the parse). Integrity is corpus-tested
  // (lib/__tests__/processArtifacts.test.ts): every id resolves in the registry, no
  // self-requires, produces matches the node-level producesArtifact tags exactly, and a process
  // producing an artifact it isn't the canonical producer of must be a documented
  // alsoProducedBy exception.
  produces: z.string().min(1).array(),
  requires: z.string().min(1).array(),
  // The executed-proof slot — see ProvenRunSchema above. Optional and currently empty
  // corpus-wide (design shipped ahead of the first real run; nothing is fabricated).
  provenRuns: ProvenRunSchema.array().min(1).optional(),
  tags: z.string().array(),
  activeMinutes: z.number().min(0),
  totalEstimatedMinutes: z.number().min(0),
  hasAsyncSteps: z.boolean(),
})

export const ProcessChainSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'chain id must be kebab-case'),
  name: z.string().min(1),
  tagline: z.string().min(1),
  taskIds: z.string().min(1).array().min(2),
})

export type ProcessTask = z.infer<typeof ProcessTaskSchema>
export type DagNode = z.infer<typeof DagNodeSchema>
// A method-variant sub-step: the base node shape WITHOUT the full-node extensions (no nested
// methods, and no reversibility — variants are display-level this phase; the default flow is
// the curated, judged surface).
export type DagSubStep = z.infer<typeof DagNodeBaseSchema>
export type ProcessChain = z.infer<typeof ProcessChainSchema>

// Display order for the corpus's phases — grouping on the index page follows the life of the
// company, not the alphabet. Unknown phases (future corpus additions) sort last, alphabetically.
export const PHASE_ORDER = [
  'startup', 'formation', 'fundraising', 'vc', 'legal', 'compliance', 'finance', 'hr',
  'operations', 'product', 'software', 'sales', 'growth',
] as const

export function phaseRank(phase: string): number {
  const i = (PHASE_ORDER as readonly string[]).indexOf(phase)
  return i === -1 ? PHASE_ORDER.length : i
}

// Display order for the operating-rhythm board: tightest loop first, then the trigger-driven
// work, then the one-time setup tail. This is the "what really happens in a company" axis.
export const CADENCE_ORDER = ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'event-driven', 'once'] as const

export const CADENCE_META: Record<Cadence, { label: string; blurb: string }> = {
  daily: { label: 'Daily', blurb: 'The loop that never stops — code ships, issues move, email goes out.' },
  weekly: { label: 'Weekly', blurb: 'The week-shaped rituals: releases, content, outbound, goal check-ins.' },
  monthly: { label: 'Monthly', blurb: 'The money drumbeat: payroll runs, books close, invoices go out, runway gets read.' },
  quarterly: { label: 'Quarterly', blurb: 'Governance season: board meetings, minutes, OKRs, review cycles.' },
  annual: { label: 'Annual', blurb: 'The filing calendar: franchise tax, returns, 1099s, insurance, 409A.' },
  'event-driven': { label: 'As needed', blurb: 'No calendar — a hire, a cancellation, a new vendor, a round sets these off.' },
  once: { label: 'Once', blurb: 'Setup and formation — done once, then the company runs on everything above.' },
}

export function cadenceRank(cadence: Cadence): number {
  return (CADENCE_ORDER as readonly string[]).indexOf(cadence)
}

// The rhythm board: every process grouped by cadence, in CADENCE_ORDER, phases preserved
// within each bucket so the groups read in company-lifecycle order.
export function processesByCadence(tasks: ProcessTask[]): Array<{ cadence: Cadence; tasks: ProcessTask[] }> {
  return CADENCE_ORDER.map((cadence) => ({
    cadence,
    tasks: tasks
      .filter((t) => t.cadence === cadence)
      .sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.title.localeCompare(b.title)),
  })).filter((g) => g.tasks.length > 0)
}

const DEFAULT_DIR = () => path.join(process.cwd(), 'data')

// Stage 2 of the corpus lift (docs/FOUNDER-OPS.md): the operational corpus and the chains moved
// out of data/ into the founder-ops tree — processes/corpus.json and journeys/chains.json.
// `dir` stays the ARENA-DATA dir (it keys the caches and resolves the live markets via
// loadCategory); the corpus files resolve as siblings of it, so every existing call site
// (DEFAULT_DIR, tests' DATA_DIR, pipeline/paths.ts DATA_DIR — all `<root>/data`) keeps working
// unchanged. Content is byte-identical to the pre-move files; paths only.
const corpusFile = (dir: string) => path.join(dir, '..', 'processes', 'corpus.json')
const chainsFile = (dir: string) => path.join(dir, '..', 'journeys', 'chains.json')

// URL slug for a process — kebab-case of the title, same convention as arena/product ids
// elsewhere on the site (lowercase, hyphen-separated). Uniqueness across the corpus is enforced
// at load time, so /processes/[slug] routing is collision-free by construction.
export function processSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const processesCache = new Map<string, ProcessTask[]>()
// Jurisdiction-conditional nodes stripped out of the default view at load time, keyed
// taskId → nodes (in corpus order) — the raw material for jurisdictionStepViews below.
const jurisdictionNodesCache = new Map<string, Map<string, DagNode[]>>()

export function loadProcesses(dir: string = DEFAULT_DIR()): ProcessTask[] {
  const hit = processesCache.get(dir)
  if (hit) return hit
  const raw = JSON.parse(fs.readFileSync(corpusFile(dir), 'utf8'))
  const parsed = ProcessTaskSchema.array().parse(raw)
  // Kind-conditional invariants that zod deliberately doesn't encode (the published JSON schema
  // stays a plain shape): a situation is reactive — it MUST name its trigger and urgency and
  // must NOT claim a founder-timeline slot; a process is the exact pre-situation contract —
  // timeOrder required, trigger/urgency forbidden. Enforced here so an uncurated record fails
  // the parse loudly instead of rendering a half-classified row.
  for (const t of parsed) {
    if (t.kind === 'situation') {
      if (!t.trigger) throw new Error(`${t.id}: a situation must name its trigger (one sentence)`)
      if (!t.urgency) throw new Error(`${t.id}: a situation must carry an honest urgency tier`)
      if (t.timeOrder !== undefined) {
        throw new Error(`${t.id}: situations are reactive — they carry no founder-timeline timeOrder slot`)
      }
    } else {
      if (t.timeOrder === undefined) throw new Error(`${t.id}: a process must carry its founder-timeline timeOrder`)
      if (t.trigger !== undefined || t.urgency !== undefined) {
        throw new Error(`${t.id}: trigger/urgency are situation-only fields`)
      }
    }
  }
  // Proven-run disclosure rule (founder spike 2026-10-02) that zod deliberately doesn't encode
  // (the published JSON schema stays a plain shape): an owner-run record must say so.
  for (const t of parsed) {
    for (const r of t.provenRuns ?? []) {
      if (r.ownerRun && !r.disclosure) {
        throw new Error(`${t.id}: an ownerRun proven-run record must carry its disclosure sentence`)
      }
      const nodeIds = new Set(t.dag.nodes.map((n) => n.id))
      for (const s of r.steps) {
        if (!nodeIds.has(s.nodeId)) throw new Error(`${t.id}: proven run references unknown step ${s.nodeId}`)
      }
    }
  }
  // Method-variant invariants that zod deliberately doesn't encode (the published JSON schema
  // stays a plain shape): unique method ids per node, geo⇔countries consistency, unique
  // sub-step ids per method, and a derived (never invented) method time where subSteps exist.
  for (const t of parsed) {
    for (const n of t.dag.nodes) {
      const methodIds = new Set<string>()
      for (const m of n.methods ?? []) {
        const at = `${t.id}/${n.id} method ${m.id}`
        if (methodIds.has(m.id)) throw new Error(`${at}: duplicate method id`)
        methodIds.add(m.id)
        if (m.context.kind === 'geo' && !m.context.countries?.length) {
          throw new Error(`${at}: geo method must carry country codes`)
        }
        if (m.context.kind !== 'geo' && m.context.countries) {
          throw new Error(`${at}: only geo methods carry country codes`)
        }
        const subIds = new Set<string>()
        for (const s of m.subSteps ?? []) {
          if (subIds.has(s.id)) throw new Error(`${at}: duplicate sub-step id ${s.id}`)
          subIds.add(s.id)
        }
        if (m.subSteps && m.estimatedMinutes !== undefined) {
          const sum = m.subSteps.reduce((acc, s) => acc + s.estimatedMinutes, 0)
          if (sum !== m.estimatedMinutes) {
            throw new Error(`${at}: estimatedMinutes ${m.estimatedMinutes} must equal sub-step sum ${sum}`)
          }
        }
      }
    }
  }
  // Split jurisdiction-conditional nodes OUT of the default corpus here, so every downstream
  // consumer (ceilings, rankings, simulator, manifest, generators, tests) sees exactly the
  // Delaware-only flow it always saw — conditional steps can never move a judged number. Edges
  // never reference conditional nodes (corpus-tested in lib/__tests__/jurisdictions.test.ts),
  // so the default DAG is untouched; the edge filter below is defense in depth.
  const conditional = new Map<string, DagNode[]>()
  const tasks = parsed.map((t) => {
    const condNodes = t.dag.nodes.filter((n) => n.jurisdictions && n.jurisdictions.length > 0)
    if (condNodes.length === 0) return t
    conditional.set(t.id, condNodes)
    const keep = new Set(t.dag.nodes.filter((n) => !condNodes.includes(n)).map((n) => n.id))
    return {
      ...t,
      dag: {
        nodes: t.dag.nodes.filter((n) => keep.has(n.id)),
        edges: t.dag.edges?.filter((e) => keep.has(e.from) && keep.has(e.to)),
      },
    }
  })
  const seen = new Map<string, string>()
  for (const t of tasks) {
    // Canonical slug and every alias share one namespace — /processes/[slug] routing stays
    // collision-free by construction across renames.
    for (const slug of [processSlug(t.title), ...(t.slugAliases ?? []).map((a) => a.slug)]) {
      const clash = seen.get(slug)
      if (clash) throw new Error(`process slug collision: ${clash} and ${t.id} both slug to "${slug}"`)
      seen.set(slug, t.id)
    }
  }
  processesCache.set(dir, tasks)
  jurisdictionNodesCache.set(dir, conditional)
  return tasks
}

// The jurisdiction-conditional nodes of one task (stripped from the default view by
// loadProcesses), in corpus order — [] for the many tasks that have none.
export function jurisdictionNodes(taskId: string, dir: string = DEFAULT_DIR()): DagNode[] {
  loadProcesses(dir)
  return jurisdictionNodesCache.get(dir)?.get(taskId) ?? []
}

// The serializable client props for one task's conditional steps — what /processes/[slug]
// hands components/JurisdictionToggle.tsx. A processRef resolves to the referenced process's
// live href + title (the link-it-never-duplicate-it rule for work that is its own process).
export function jurisdictionStepViews(taskId: string, dir: string = DEFAULT_DIR()): JurisdictionStepView[] {
  return jurisdictionNodes(taskId, dir).map((n) => {
    const ref = n.processRef ? findProcessBySlug(n.processRef, dir) : null
    return {
      label: n.label,
      route: n.route,
      jurisdictions: (n.jurisdictions ?? []) as Jurisdiction[],
      actionUrl: n.actionUrl ?? null,
      actionLabel: n.actionLabel ?? null,
      estimatedMinutes: n.estimatedMinutes,
      async: n.async ?? false,
      processHref: ref ? `/processes/${processSlug(ref.title)}` : null,
      processTitle: ref?.title ?? null,
    }
  })
}

export function findProcessBySlug(slug: string, dir: string = DEFAULT_DIR()): ProcessTask | null {
  return loadProcesses(dir).find(
    (t) => processSlug(t.title) === slug || (t.slugAliases ?? []).some((a) => a.slug === slug),
  ) ?? null
}

// The alias entry a given (task, slug) pair landed on, or null when slug is the canonical one —
// lets /processes/[slug] render alias pages with a pointer to the canonical page.
export function slugAliasFor(task: ProcessTask, slug: string): SlugAlias | null {
  return (task.slugAliases ?? []).find((a) => a.slug === slug) ?? null
}

const chainsCache = new Map<string, ProcessChain[]>()

// Curated chained stories (journeys/chains.json): ordered runs of real corpus task ids.
// Integrity-checked at load: every taskId must exist in the corpus, chain ids must be unique.
export function loadChains(dir: string = DEFAULT_DIR()): ProcessChain[] {
  const hit = chainsCache.get(dir)
  if (hit) return hit
  const raw = JSON.parse(fs.readFileSync(chainsFile(dir), 'utf8'))
  const chains = ProcessChainSchema.array().parse(raw)
  const byId = new Map(loadProcesses(dir).map((t) => [t.id, t]))
  const chainIds = new Set<string>()
  for (const chain of chains) {
    if (chainIds.has(chain.id)) throw new Error(`duplicate chain id ${chain.id}`)
    chainIds.add(chain.id)
    for (const tid of chain.taskIds) {
      const task = byId.get(tid)
      if (!task) throw new Error(`chain ${chain.id} references unknown task ${tid}`)
      // A chain is a timeline journey: it folds into the grouped table at its FIRST
      // constituent's timeOrder (lib/processRows.ts). A reactive situation has no slot to fold
      // into, so chains may only compose kind 'process' tasks — this guarantee is what lets
      // buildPlaybookRows read tasks[0].timeOrder as present.
      if (task.kind === 'situation') {
        throw new Error(`chain ${chain.id} composes situation ${tid} — chains are timeline journeys of processes only`)
      }
    }
  }
  chainsCache.set(dir, chains)
  return chains
}

export function chainTasks(chain: ProcessChain, dir: string = DEFAULT_DIR()): ProcessTask[] {
  const byId = new Map(loadProcesses(dir).map((t) => [t.id, t]))
  return chain.taskIds.map((tid) => byId.get(tid)!)
}

// ---------------------------------------------------------------------------
// Agent ceiling & gaps
// ---------------------------------------------------------------------------

export interface ProcessGap {
  label: string
  route: 'form' | 'person'
  why: string
}

export interface ProcessCeiling {
  agentSteps: number
  totalSteps: number
  // % of steps an agent can run today, rounded to a whole number.
  pct: number
  agentMinutes: number
  totalMinutes: number
  // Agent-runnable steps that are human-gated (approvalRequired) — counted inside agentSteps
  // (the agent CAN run them), surfaced separately because a human still has to say yes.
  approvalGates: number
  gaps: ProcessGap[]
}

// Structural param (the fields the math actually reads) so the display-only method-variant
// ceilings (lib/stepMethodData.ts) can substitute sub-steps — which don't carry the full-node
// extensions — without casts. DagNode[] remains assignable unchanged.
export function computeCeiling(
  nodes: Array<Pick<DagNode, 'label' | 'route' | 'estimatedMinutes' | 'approvalRequired'>>,
): ProcessCeiling {
  let agentSteps = 0
  let agentMinutes = 0
  let totalMinutes = 0
  let approvalGates = 0
  const gaps: ProcessGap[] = []
  for (const n of nodes) {
    totalMinutes += n.estimatedMinutes
    if (n.route === 'agent') {
      agentSteps += 1
      agentMinutes += n.estimatedMinutes
      if (n.approvalRequired) approvalGates += 1
    } else {
      gaps.push({ label: n.label, route: n.route, why: gapWhy(n.route) })
    }
  }
  const totalSteps = nodes.length
  return {
    agentSteps,
    totalSteps,
    pct: totalSteps === 0 ? 0 : Math.round((agentSteps / totalSteps) * 100),
    agentMinutes,
    totalMinutes,
    approvalGates,
    gaps,
  }
}

export function taskCeiling(task: ProcessTask): ProcessCeiling {
  return computeCeiling(task.dag.nodes)
}

// The process's known government fees (depth wave pt 1): the sum of the DATED per-step
// government fees ONLY — kind 'government-fee' with a published usd number. Derived here, never
// hand-stored. Vendor prices are deliberately excluded from the headline (a partial vendor sum
// would imply a completeness the curation doesn't claim), and `usd: null` entries contribute
// nothing. Computed over the DEFAULT flow (loadProcesses strips jurisdiction-conditional nodes),
// so the number describes the same Delaware-default view every other committed number does.
export function knownCostUsd(nodes: Array<Pick<DagNode, 'cost'>>): number {
  let total = 0
  for (const n of nodes) {
    if (n.cost && n.cost.kind === 'government-fee' && n.cost.usd !== null) total += n.cost.usd
  }
  return total
}

// The site-wide headline: the agent ceiling across every step of every process in the corpus.
export function siteCeiling(tasks: ProcessTask[]): ProcessCeiling {
  return computeCeiling(tasks.flatMap((t) => t.dag.nodes))
}

export interface GapTheme {
  id: string
  label: string
  count: number
  examples: string[]
}

// Recurring kinds of non-agent step across the whole corpus — "still human/manual across the
// market". Individual gap labels are mostly unique, so we bucket them into honest themes by
// keyword; the first matching rule wins. Buckets are reported with real example labels so a
// reader can audit the grouping.
const GAP_THEME_RULES: Array<{ id: string; label: string; test: (label: string, node: DagNode) => boolean }> = [
  {
    // Before 'signatures': "sign up" is account creation, not a signature.
    id: 'account-signup',
    label: 'Account signup & identity verification (KYC, portals)',
    test: (l) => /sign ?up|create account|kyc|verify identity|onboard/.test(l),
  },
  {
    id: 'signatures',
    label: 'Signatures & notarization',
    test: (l) => /\bsign\b|signature|notar|counter-?sign|docusign/.test(l),
  },
  {
    id: 'government-filings',
    label: 'Government filings & registrations (IRS, SEC, state portals)',
    test: (l) => /\bfile\b|filing|\birs\b|\bsec\b|uspto|register|registration|\btax\b|annual report/.test(l),
  },
  {
    id: 'waiting',
    label: 'Waiting on a third party (approvals, certificates, review turnaround)',
    test: (l, n) => Boolean(n.async) || /receive|wait|approval from|confirmation|processing/.test(l),
  },
  {
    id: 'meetings',
    label: 'Meetings, interviews & negotiations',
    test: (l) => /meeting|interview|negotiat|conduct|discuss|onboarding call|1:1/.test(l),
  },
]

export function gapThemes(tasks: ProcessTask[]): GapTheme[] {
  const themes = new Map<string, GapTheme>()
  const add = (id: string, label: string, example: string) => {
    const t = themes.get(id) ?? { id, label, count: 0, examples: [] }
    t.count += 1
    if (t.examples.length < 3 && !t.examples.includes(example)) t.examples.push(example)
    themes.set(id, t)
  }
  for (const task of tasks) {
    for (const n of task.dag.nodes) {
      if (n.route === 'agent') continue
      const l = n.label.toLowerCase()
      const rule = GAP_THEME_RULES.find((r) => r.test(l, n))
      if (rule) add(rule.id, rule.label, n.label)
      else if (n.route === 'form') add('manual-portals', 'Manual portal & form work (no API path)', n.label)
      else add('human-judgment', 'Human decisions & hands-on work', n.label)
    }
  }
  return [...themes.values()].sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Vendor registry (processes/vendor-registry.json) — arena links, labels, product ids, signup URLs
// ---------------------------------------------------------------------------

// Single source of truth for vendor FACTS (SSOT migration, founder audit 2026-09-30: "verify
// everything rendered on /processes is driven from the open repo corpus"): which arena judges a
// corpus vendor, its display label where title-casing the key misfires, its judged product id
// where it differs from the key, and its verified-live start-here page all live in the open
// corpus file processes/vendor-registry.json — keyed by corpus vendor key (snake_case, the same
// keys corpus.json uses in vendor/vendorOptions) — not in TypeScript. The exports below are
// READ BACK from that file with their historic shapes, so every consumer (processRows,
// vendorProcesses, tryit, everything, opsCoverage, operating-rhythm, pipeline scripts) is
// unchanged, and the honesty invariants are now data-testable: a mapped vendor resolves (via
// vendorProductId) to a real product in its arena (lib/__tests__/processes.test.ts), every
// signupUrl was verified reachable before listing, and a vendor deliberately without one is
// simply absent with the reason carried in `note` — no link fabricated. Published schema:
// schemas/process-vendor-registry.schema.json (generated, drift-tested).
export const VendorRegistryEntrySchema = z
  .object({
    // Display name, only where title-casing the key misfires (GitHub, IRS, incident.io, …).
    label: z.string().min(1).optional(),
    // The live arena that judges this vendor; absent = an honest unlinked chip.
    arenaId: z.string().min(1).optional(),
    // The judged product id where it differs beyond snake_case → kebab-case normalization.
    productId: z.string().min(1).optional(),
    // The vendor's own start-here page — verified reachable before listing, never fabricated.
    signupUrl: z.string().url().optional(),
    // Honest curation context (e.g. why a vendor deliberately carries no signupUrl).
    note: z.string().min(1).optional(),
  })
  .strict()
export type VendorRegistryEntry = z.infer<typeof VendorRegistryEntrySchema>

export const VendorRegistrySchema = z
  .object({
    $comment: z.string().optional(),
    vendors: z.record(z.string().regex(/^[a-z0-9]+(_[a-z0-9]+)*$/), VendorRegistryEntrySchema),
  })
  .strict()

const vendorRegistryFile = () => path.join(process.cwd(), 'processes', 'vendor-registry.json')
let vendorRegistryCache: Record<string, VendorRegistryEntry> | null = null
export function loadVendorRegistry(): Record<string, VendorRegistryEntry> {
  if (!vendorRegistryCache) {
    vendorRegistryCache = VendorRegistrySchema.parse(
      JSON.parse(fs.readFileSync(vendorRegistryFile(), 'utf8')),
    ).vendors
  }
  return vendorRegistryCache
}

function registryField(field: 'label' | 'arenaId' | 'productId' | 'signupUrl'): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [vendor, entry] of Object.entries(loadVendorRegistry())) {
    const value = entry[field]
    if (value) out[vendor] = value
  }
  return out
}

// Corpus vendor key -> categories.json arena id, for vendors we actually rank. A mapped vendor's
// product id is vendorProductId(key) — usually the key itself, snake_case normalized to the
// site's kebab-case product ids (stripe_atlas → stripe-atlas), verified against real product ids
// by lib/__tests__/processes tests — so the DAG's canonical vendor resolves to a product page.
export const VENDOR_ARENA: Record<string, string> = registryField('arenaId')

// Vendor keys whose judged product id differs beyond snake_case → kebab-case normalization.
const VENDOR_PRODUCT_ID: Record<string, string> = registryField('productId')

// The judged product id for a corpus vendor key: explicit override, else the key with
// snake_case normalized to the site's kebab-case product-id convention.
export function vendorProductId(vendor: string): string {
  return VENDOR_PRODUCT_ID[vendor] ?? vendor.replace(/_/g, '-')
}

// ---------------------------------------------------------------------------
// Government-services applicability (founder 2026-10-08)
// ---------------------------------------------------------------------------

export const GOVERNMENT_ARENA_ID = 'government-services'

// The government-services arena rosters national monopolies, tagged by the Phase-2 rollup
// work's committed `country`/`area` fields (data/government-services/products.json,
// lib/rollups.ts). Unlike a competitive arena, those products are not substitutes for each
// other across the tags: USPTO cannot take a federal tax return and Portugal's IRN cannot
// incorporate a Delaware company, yet all of them score on the arena's generic stories, so an
// unfiltered covering-arena → roster expansion listed them as candidates on every step the
// arena covers (the Phase-2 substitutability flag).
//
// THE RULE (a filter over committed tags, never a hand-curated list): when a step's covering
// arena is government-services, candidates are constrained to the products whose committed
// `country` AND `area` tags both match the step's canonical agency — the product the corpus
// wired the step to (node.vendor → vendorProductId → its product record in the arena). That
// wiring is the committed statement of which country's which service area the step belongs
// to: vendor 'irs' → US/tax, so tax steps admit US tax-area agencies (IRS, EFTPS);
// 'uspto' → US/ip-office, so IP steps admit US IP offices. Geo variants are covered by
// construction: a step wired to a foreign agency inherits that agency's own country. The
// process-level jurisdiction context was checked and corroborates (every government-covered
// step today sits on a geoScope-'us' process whose wired agency carries country 'US'; the
// node-level `jurisdictions` field only marks CA/MULTI conditional steps), but the wired
// agency is the finer committed signal — geoScope cannot tell a tax step from an IP step.
//
// Returns null — UNFILTERED — for every other arena, and for a government-covered step that
// is not wired to a tagged product of the arena (no canonical vendor, or an untagged
// product): there the area cannot be honestly derived from committed data, so the pull is
// left alone rather than guessed. The arena page itself never passes through this path and
// keeps its full roster.
export function governmentStepEligibility(
  node: Pick<DagNode, 'vendor'>,
  arenaId: string,
  dir?: string,
): Set<string> | null {
  if (arenaId !== GOVERNMENT_ARENA_ID) return null
  if (!node.vendor || VENDOR_ARENA[node.vendor] !== GOVERNMENT_ARENA_ID) return null
  const products = loadCategory(arenaId, dir).products
  const anchor = products.find((p) => p.id === vendorProductId(node.vendor!))
  if (!anchor?.country || !anchor.area) return null
  return new Set(
    products.filter((p) => p.country === anchor.country && p.area === anchor.area).map((p) => p.id),
  )
}

// Pretty display names for corpus vendor keys (snake_case, lowercase). Fallback title-cases.
const VENDOR_LABELS: Record<string, string> = registryField('label')

// The vendor's own start-here page (signup / product start), for steps whose action lives
// inside a chosen vendor — "run payroll" happens in Gusto, so the Gusto OPTION carries the
// start URL rather than the step carrying an actionUrl. Rendered as a small ↗ beside the
// vendor chip; the chip itself keeps linking to OUR judged product page. Every URL verified
// reachable before listing; vendors without a verified canonical start page aren't listed
// (no link fabricated — the registry `note` says why where that's deliberate).
export const VENDOR_SIGNUP_URL: Record<string, string> = registryField('signupUrl')

export function vendorLabel(vendor: string): string {
  const hit = VENDOR_LABELS[vendor]
  if (hit) return hit
  return vendor
    .split(/[_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ---------------------------------------------------------------------------
// Artifact registry (processes/artifacts.json) — the canonical business artifacts that flow
// between processes (founder depth wave part 2, 2026-10-01)
// ---------------------------------------------------------------------------

// The artifact-level GEO entry (founder geo-coverage ask 2026-10-07: "the registry is
// US-centric — add per-country analogs for the six covered countries"). Same vocabulary as the
// process GeoNoteSchema (country set, kind, verified actionUrl), plus a `label` naming the
// artifact-level analog OBJECT (the EIN's UK analog is the UTR; the certificate of
// incorporation's is the Companies House certificate). Source of truth: the committed process
// geoNotes — every entry is derived from (and stays consistent with) the producing process's
// country note where one exists, and every actionUrl is REUSED from a committed corpus geoNote
// (never fresh; corpus-tested in lib/__tests__/processArtifacts.test.ts). Kind reads at the
// ARTIFACT level, which can differ from the process note's kind: the UK "Get EIN" process is
// absorbed (the UTR arrives with no application), but the UTR itself exists as the analog
// object, so the artifact entry says analog. US-centric artifacts carry entries; artifacts of
// global-scope producers (team chat, CRM) carry none — the object is the same everywhere.
export const ArtifactGeoNoteSchema = z.object({
  country: z.enum(GEO_NOTE_COUNTRIES),
  kind: z.enum(GEO_NOTE_KINDS),
  // The analog object's name in that country — what the artifact IS there.
  label: z.string().min(1),
  summary: z.string().min(1),
  // The canonical official page — always one of the committed corpus geoNote actionUrls.
  actionUrl: z.string().url(),
  actionLabel: z.string().min(1),
})
export type ArtifactGeoNote = z.infer<typeof ArtifactGeoNoteSchema>

// One canonical business artifact: a thing a committed process step genuinely brings into
// existence (the EIN, the signed bylaws, the opened bank account, the 409A report) that at
// least one OTHER process consumes via `requires` — or, flagged `terminal`, that nothing
// downstream consumes (the filed 83(b), the dissolution certificate). ONE canonical producer
// per artifact (`producedBy`); the documented exceptions (the LLC route's EIN, the LLC→C-Corp
// conversion's re-issued charter paper, the exec hire's offer) live in `alsoProducedBy` — any
// process listing the artifact in `produces` must be one of these. The registry is sized from
// the corpus itself; no invented artifacts (all integrity rules are corpus-tested in
// lib/__tests__/processArtifacts.test.ts). Consumed by lib/processDeps.ts to build the
// cross-process dependency DAG. Published schema: schemas/process-artifacts.schema.json
// (generated, drift-tested).
export const ArtifactSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'artifact id must be kebab-case'),
    label: z.string().min(1),
    description: z.string().min(1),
    // The one canonical producer process (corpus task id).
    producedBy: z.string().min(1),
    // Documented exception producers — other committed processes that genuinely also bring this
    // artifact into existence. Deliberately rare; every entry is corpus-tested to really tag it.
    alsoProducedBy: z.string().min(1).array().min(1).optional(),
    // No committed process consumes this artifact — it leaves the graph here (filed elections,
    // published reports, the dissolution certificate). Mutually exclusive with having consumers;
    // both directions corpus-tested.
    terminal: z.literal(true).optional(),
    // Registered open templates (open-documents/registry.json ids) a document genuinely IS this
    // artifact's form — the filed 83(b)'s IRS Form 15620, the executed SAFE's YC forms, the
    // bylaws' incorporation packages (founder 2026-10-06: classic document objects; the
    // deliberate flip of the 2026-10-05 absence pin in app/artifacts/__tests__/page.test.tsx).
    // Deliberately sparse: an artifact with no registered template carries no field — honest
    // absence, never an invented mapping. Referential integrity against the document registry
    // is tested in lib/__tests__/processArtifacts.test.ts; the render path
    // (lib/artifactPages.ts → lib/documents.ts openDocumentById) throws on an unknown id.
    documents: z.string().min(1).array().min(1).optional(),
    // Per-country analogs of a US-centric artifact (founder 2026-10-07) — at most one entry
    // per covered country, derived from the producing process's committed geoNotes (see
    // ArtifactGeoNoteSchema above). Absent on artifacts that are the same object everywhere.
    geo: ArtifactGeoNoteSchema.array().min(1).optional(),
  })
  .strict()
export type Artifact = z.infer<typeof ArtifactSchema>

export const ArtifactRegistrySchema = z
  .object({
    $comment: z.string().optional(),
    artifacts: ArtifactSchema.array().min(1),
  })
  .strict()

const artifactsFile = () => path.join(process.cwd(), 'processes', 'artifacts.json')
let artifactsCache: Artifact[] | null = null
export function loadArtifacts(): Artifact[] {
  if (!artifactsCache) {
    const parsed = ArtifactRegistrySchema.parse(
      JSON.parse(fs.readFileSync(artifactsFile(), 'utf8')),
    ).artifacts
    const seen = new Set<string>()
    for (const a of parsed) {
      if (seen.has(a.id)) throw new Error(`duplicate artifact id ${a.id}`)
      seen.add(a.id)
    }
    artifactsCache = parsed
  }
  return artifactsCache
}

function arenaSwapOptions(arenaId: string, dir?: string): SwapOption[] {
  const data = loadCategory(arenaId, dir)
  const nameOf = (pid: string) => data.products.find((p) => p.id === pid)?.name ?? pid
  return [...data.rankings.leaderboard]
    .sort((a, b) => (b.agentReady ?? -1) - (a.agentReady ?? -1))
    .map((e) => ({
      id: e.productId,
      name: nameOf(e.productId),
      agentReady: e.agentReady,
      // Resolved here (build time, node:fs) so the client-side role picker can show logo chips.
      hasLogo: hasLogo(e.productId),
    }))
}

// Product ids of one arena whose vendor announced a shutdown (lib/shutdown.ts founder rule):
// excluded from every OFFER surface below (derived rosters, alternatives, swap options) while
// the canonical vendor chip (vendorChipInfo) keeps resolving — a process that names the vendor
// still shows it, we just never suggest it.
function shutdownIdsFor(arenaId: string, dir?: string): Set<string> {
  return new Set(loadCategory(arenaId, dir).products.filter((p) => isShutdown(p)).map((p) => p.id))
}

// Top arena alternatives for one mapped vendor — the same live leaderboard the swap options
// use, minus the canonical vendor itself. Powers the "or:" row on DAG vendor blocks. Unmapped
// vendors (irs, clerky, docusign…) have no arena, so they yield [] and the block shows only
// the canonical chip.
export interface VendorAlternative extends SwapOption {
  arenaId: string
}

export function vendorAlternatives(vendor: string, limit = 2, dir?: string): VendorAlternative[] {
  const arenaId = VENDOR_ARENA[vendor]
  if (!arenaId || !isPopulated(arenaId, dir)) return []
  const productId = vendorProductId(vendor)
  const shutdown = shutdownIdsFor(arenaId, dir)
  // A government agency's "or:" row obeys the same applicability rule as the step rankings
  // (governmentStepEligibility): only agencies sharing the canonical agency's committed
  // country+area tags are genuine alternatives — IRS never suggests "or: Companies House".
  const eligible = governmentStepEligibility({ vendor }, arenaId, dir)
  return arenaSwapOptions(arenaId, dir)
    .filter((o) => o.id !== productId && !shutdown.has(o.id) && (!eligible || eligible.has(o.id)))
    .slice(0, limit)
    .map((o) => ({ ...o, arenaId }))
}

// One vendor rendered as a DAG chip, resolved against the live market. Tracked vendors carry
// their judged product id, arena, agent-readiness and 1-based rank on the arena's
// agent-readiness ladder (the same ordering the "or:" row and swap options use); untracked
// vendors resolve with productId null and render as honest unlinked chips.
export interface VendorChipInfo {
  vendor: string
  label: string
  productId: string | null
  arenaId: string | null
  arenaName: string | null
  agentReady: number | null
  rank: number | null
  // The vendor's own start-here page (VENDOR_SIGNUP_URL) — a small external ↗ beside the chip.
  signupUrl: string | null
}

export function vendorChipInfo(vendor: string, dir?: string): VendorChipInfo {
  const signupUrl = VENDOR_SIGNUP_URL[vendor] ?? null
  const untracked: VendorChipInfo = {
    vendor, label: vendorLabel(vendor),
    productId: null, arenaId: null, arenaName: null, agentReady: null, rank: null, signupUrl,
  }
  const arenaId = VENDOR_ARENA[vendor]
  if (!arenaId || !isPopulated(arenaId, dir)) return untracked
  const productId = vendorProductId(vendor)
  const options = arenaSwapOptions(arenaId, dir)
  const i = options.findIndex((o) => o.id === productId)
  if (i === -1) return untracked
  return {
    vendor,
    label: options[i].name,
    productId,
    arenaId,
    arenaName: loadCategory(arenaId, dir).category.name,
    agentReady: options[i].agentReady,
    rank: i + 1,
    signupUrl,
  }
}

// Cap on arena-derived supplier chips per step — the roster's top-N by Overall score. Keeps a
// "via:" row readable even for deep arenas (ai-coding judges 13 products); curated extras
// appended by stepVendorOptions can push a step slightly past this, which is fine.
export const STEP_OPTIONS_CAP = 8

// Every product of one arena as a VendorChipInfo, in LEADERBOARD ORDER (the arena's Overall-score
// rank — rankings.json is already sorted). Chip rank/agentReady keep vendorChipInfo semantics
// (position on the agent-readiness ladder) so derived and curated chips read identically.
function arenaOptionChips(arenaId: string, dir?: string): VendorChipInfo[] {
  const data = loadCategory(arenaId, dir)
  const ladder = arenaSwapOptions(arenaId, dir)
  const rankOf = new Map(ladder.map((o, i) => [o.id, i + 1]))
  // A derived roster is an OFFER — shutdown products drop out and the rest keep their ladder
  // ranks (positions are identity, not a re-count).
  const shutdown = shutdownIdsFor(arenaId, dir)
  return data.rankings.leaderboard.filter((e) => !shutdown.has(e.productId)).map((e) => ({
    vendor: e.productId,
    label: data.products.find((p) => p.id === e.productId)?.name ?? e.productId,
    productId: e.productId,
    arenaId,
    arenaName: data.category.name,
    agentReady: e.agentReady ?? null,
    rank: rankOf.get(e.productId) ?? null,
    // Product ids are the kebab-case of the snake_case vendor keys VENDOR_SIGNUP_URL uses.
    signupUrl: VENDOR_SIGNUP_URL[e.productId.replace(/-/g, '_')] ?? VENDOR_SIGNUP_URL[e.productId] ?? null,
  }))
}

// The full supplier list for one step, resolved against the live market — every key supplier a
// founder could genuinely pick for the step's general function. Cross-arena vendors
// (extraOptionArenas / extraOptionRefs) are deliberately NOT appended here: they only surface
// through lib/processRankings.ts crossArenaStepRankings, which gates each one on the committed
// step→story mapping and a judged full/partial verdict. When the step declares
// optionsArenaId, the list is DERIVED from that arena's current leaderboard (top
// STEP_OPTIONS_CAP by Overall score, in arena-rank order) so roster changes flow through on the
// next build; hand-curated vendorOptions not already in the derived roster are appended after
// it — tracked-elsewhere vendors keep their own arena chip, untracked ones render as honest
// unlinked "not yet judged" chips. Steps without an optionsArenaId keep their curated options.
export function stepVendorOptions(
  node: Pick<DagNode, 'vendorOptions' | 'optionsArenaId'>,
  dir?: string,
): VendorChipInfo[] {
  // A supplier roster is an OFFER (lib/shutdown.ts founder rule): tracked curated vendors whose
  // product announced a shutdown are dropped alongside the derived-roster filter in
  // arenaOptionChips. Untracked chips (no judged product) can't be checked and stay.
  const curated = (node.vendorOptions ?? [])
    .map((v) => vendorChipInfo(v, dir))
    .filter((c) => !c.productId || !c.arenaId || !shutdownIdsFor(c.arenaId, dir).has(c.productId))
  const arenaId = node.optionsArenaId
  if (!arenaId || !isPopulated(arenaId, dir)) return curated
  const derived = arenaOptionChips(arenaId, dir).slice(0, STEP_OPTIONS_CAP)
  const derivedIds = new Set(derived.map((c) => c.productId))
  return [...derived, ...curated.filter((c) => !c.productId || !derivedIds.has(c.productId))]
}

// The swappable market roles of one or more tasks: every mapped vendor (from DAG nodes first —
// the canonical call targets — then the task's own vendors list) collapsed per arena. The
// default pick is the DAG's canonical vendor; alternatives are the arena's live leaderboard.
// An unmapped vendor (irs, clerky, docusign…) is not a role — there's no arena to swap within.
export function vendorRoles(tasks: ProcessTask[], dir?: string): VendorRole[] {
  const byArena = new Map<string, { canonical: string | null; stepCount: number }>()
  const claimArena = (arenaId: string, canonical: string | null, steps: number) => {
    if (!isPopulated(arenaId, dir)) return
    const existing = byArena.get(arenaId)
    if (existing) existing.stepCount += steps
    else byArena.set(arenaId, { canonical, stepCount: steps })
  }
  const claim = (vendor: string, steps: number) => {
    const arenaId = VENDOR_ARENA[vendor]
    if (arenaId) claimArena(arenaId, vendor, steps)
  }
  for (const task of tasks) {
    for (const n of task.dag.nodes) {
      if (n.vendor) claim(n.vendor, 1)
      for (const v of n.vendorOptions ?? []) claim(v, 1)
      // Derived-market steps make their covering arena a role even when no curated vendor maps
      // there (corporate cards → expense-management). No canonical vendor: the role defaults to
      // the arena's agent-readiness leader below.
      if (n.optionsArenaId) claimArena(n.optionsArenaId, null, 1)
    }
  }
  for (const task of tasks) {
    for (const v of task.vendors) claim(v, 0)
  }

  const roles: VendorRole[] = []
  for (const [arenaId, { canonical, stepCount }] of byArena) {
    const data = loadCategory(arenaId, dir)
    // Swap options are OFFERS — shutdown products drop out; a canonical vendor that announced
    // a shutdown falls through to the arena's agent-readiness leader as the default pick.
    const shutdown = shutdownIdsFor(arenaId, dir)
    const alternatives = arenaSwapOptions(arenaId, dir).filter((o) => !shutdown.has(o.id))
    const canonicalId = canonical ? vendorProductId(canonical) : null
    const def = (canonicalId && alternatives.find((o) => o.id === canonicalId)) || alternatives[0]
    if (!def) continue
    roles.push({
      arenaId,
      arenaName: data.category.name,
      // Arena-only claims (optionsArenaId with no mapped curated vendor) treat the default —
      // the agent-readiness leader — as canonical.
      canonicalVendor: canonicalId ?? def.id,
      defaultProductId: def.id,
      defaultProductName: def.name,
      stepCount,
      alternatives,
    })
  }
  return roles.sort((a, b) => b.stepCount - a.stepCount || a.arenaName.localeCompare(b.arenaName))
}

// ---------------------------------------------------------------------------
// Simulator flattening (client-component props — keep these minimal and serializable)
// ---------------------------------------------------------------------------

export function buildSimSteps(tasks: ProcessTask[], dir?: string): SimStep[] {
  return tasks.flatMap((task) =>
    task.dag.nodes.map((n) => ({
      taskId: task.id,
      taskTitle: task.title,
      label: n.label,
      route: n.route,
      vendor: n.vendor ?? null,
      vendorLabel: n.vendor ? vendorLabel(n.vendor) : null,
      arenaId: (n.vendor && VENDOR_ARENA[n.vendor]) || null,
      // A "Choose/Select/Pick …" step over a derived market IS the vendor decision the simulator
      // asks for up front — carrying the arena lets the transcript mark it decided instead of
      // declaring a human gap for a choice the user already made (the Mercury bank case).
      choiceArenaId: n.optionsArenaId && DECISION_STEP_RE.test(n.label) ? n.optionsArenaId : null,
      calls: (n.functionCalls ?? []).map((fc) => fc.method),
      toolCall: n.toolCall ?? null,
      approvalRequired: n.approvalRequired ?? false,
      legalSignature: n.legalSignature ?? false,
      riskLevel: n.riskLevel ?? null,
      estimatedMinutes: n.estimatedMinutes,
      async: n.async ?? false,
      // Pre-resolved server-side so the client simulator never touches the rule engine or disk.
      gap: resolveGapStep(n, dir),
    })),
  )
}
