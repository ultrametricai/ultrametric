// Virtual Startup (founder ask 2026-09-23): a synthetic company run through the REAL process
// corpus. The reader picks a handful of starting decisions; each decision selects which real
// processes/chains (processes/corpus.json + journeys/chains.json) make up the journey, and the
// timeline replays them with clearly-labeled synthetic artifacts ("what each step produces").
//
// Client-safe and pure (no node builtins) — same split convention as lib/processSim.ts: the
// server page (app/startup-sim/page.tsx) resolves the corpus + judged rankings and hands
// serializable payloads to components/VirtualStartup.tsx, which calls the pure functions here.
//
// Honesty rules (the site's whole brand):
//   - the journey is COMPOSED of real corpus processes — every task id here must exist in
//     processes/corpus.json (lib/__tests__/virtualStartup.test.ts enforces it against the live
//     corpus; journeyPhases throws on an unknown chain rather than inventing one);
//   - vendor picks are the judged rankings (lib/processRankings.ts stepRanking), resolved
//     server-side — nothing here fabricates a score;
//   - every synthetic artifact is born labeled: SyntheticArtifact.simulated is the literal
//     `true`, stamped centrally by buildJourneyArtifacts so no generator can forget it, and the
//     UI renders a visible SIMULATED chip off that flag (component tests enforce the rendering);
//   - artifacts are deterministic from the decision combo (seeded PRNG, no LLM calls, no server
//     state) — the same choices replay identically;
//   - fake identifiers are constructed to be impossible-real: EIN "00-0000000" (no real EIN
//     starts 00), domains on the RFC 2606-reserved .example TLD, all-zero file/routing numbers.

import { GEO_PREF_META, type GeoAnalogNote, type GeoCountry } from './geoPreference'
import type { Cadence, SimStep } from './processSim'

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

// Country-aware entity options (founder round 5, item 1). Codec rule: 'c-corp'/'llc' keep their
// original indices 0/1; every non-US entity value is APPENDED so old digit permalinks replay
// unchanged. HONESTY: the step corpus is US-shaped — a non-US entity keeps the EXACT corpus
// incorporation composition of the C-Corp path (never a fake corpus branch) and frames it with
// the committed geoNotes country analog (terminal line + entity label).
export type EntityChoice =
  | 'c-corp' | 'llc' | 'ltd' | 'gmbh' | 'ug' | 'sas' | 'sarl' | 'pvt-ltd' | 'lda' | 'ca-corp'
export type FundingChoice = 'bootstrap' | 'seed'
// Business models (founder round 5, item 2). Codec rule: 'subscriptions'/'invoices' keep indices
// 0/1; 'marketplace'/'usage'/'ecommerce' append. Only compositions the corpus honestly supports:
// usage runs the SAME subscription-billing task (usage is a billing mode — venue-noted);
// marketplace and e-commerce run the get-paid spine (processor + first close) with the model
// named — no take-rate or storefront corpus steps exist, so none are invented.
export type ProductChoice = 'subscriptions' | 'invoices' | 'marketplace' | 'usage' | 'ecommerce'
export type TeamChoice = 'solo' | 'cofounders'
// Founder iteration 2026-09-25 — five more corpus-real branches:
export type OrderingChoice = 'name-first' | 'build-first'
export type HireChoice = 'yes' | 'no'
// Compliance gets specific (founder round 5, item 3). Codec rule: 'now'/'later' keep indices 0/1
// (old links replay their placement semantics as SOC 2 early/deferred); 'none'/'hipaa'/'iso'
// append. HIPAA and ISO 27001 run the SAME real set-up-compliance chain with the framework named
// in lines/artifacts (no dedicated corpus chains exist — steps are never fabricated); 'none'
// genuinely skips the chain. 'basics' (founder batch 2026-09-30, item 8) appends as the NEW
// default-asserted value: the same composition 'none' maps to (no dedicated compliance playbook
// runs), honestly named — every company still does basic compliance hygiene without a formal
// framework. 'none' keeps its codec slot so old links replay, but it leaves the DISPLAY roster
// (HIDDEN_OPTION_VALUES) as redundant with 'basics' — our call, said out loud.
export type ComplianceChoice = 'now' | 'later' | 'none' | 'hipaa' | 'iso' | 'basics'
// The ICP selector (founder batch 2026-09-30, item 4: "'Enterprise: not yet' is confusing").
// The decision KEY stays 'enterprise' and the 'yes'/'no' value tokens keep their codec indices
// 0/1 AND their exact strings (comboKey — and with it every seeded name/artifact/event stream of
// a shared link — never moves): old digit 0 now reads as the default ICP (Developers, composing
// the identical default journey the old 'Not yet' composed) and old digit 1 as Enterprises (the
// old enterprise 'yes' behaviors — the NDA/enterprise-deal chain — attach here). 'smb' and
// 'consumer' APPEND; both compose the default path with the audience named in the revenue phase
// note (venue-noted — the launch-venue precedent; no SMB/consumer corpus steps exist, none are
// invented).
export type EnterpriseChoice = 'yes' | 'no' | 'smb' | 'consumer'
// 'Remote vs In-office' (founder batch 2026-09-30, item 5). A NEW appended decision: 'remote'
// (default, index 0) composes nothing extra; 'office' adds the real "Lease an office" corpus
// process (ops_014 — the insurance/lease work) as its own journey phase. Codec: the decision
// APPENDS to DECISIONS, so old (shorter) digit strings decode with this slot defaulted — see
// lib/virtualStartupRun.ts decodeCombo/decodeAssertedCombo padding.
export type RemoteChoice = 'remote' | 'office'
// Launch options (founder batch 2026-09-29, round 4, item 7). Codec compat rules the values:
// 'yes' (Product Hunt) and 'no' (Stealth mode — the old Quiet launch, relabeled) keep their
// original tokens and option indices so every shared digit-codec permalink replays unchanged;
// 'show-hn' and 'waitlist' are APPENDED. 'x' (founder batch 2026-10-01, item 5: "X launch")
// APPENDS after them — launching on X is the SAME real launch playbook with the venue noted as
// X, exactly the Show HN precedent (honest composition: NO invented X-corpus steps), and it is
// the new DEFAULT-ASSERTED launch for fresh visits (see DEFAULT_ASSERTED — never the composed
// default, so elided legacy links keep their PH-venue era). Honesty: the venue options share the
// SAME real launch-on-product-hunt corpus playbook with the venue named (no invented steps);
// stealth genuinely skips the launch chain — ongoing operations continue.
export type PhLaunchChoice = 'yes' | 'no' | 'show-hn' | 'waitlist' | 'x'

export interface Choices {
  entity: EntityChoice
  funding: FundingChoice
  product: ProductChoice
  team: TeamChoice
  ordering: OrderingChoice
  hire: HireChoice
  compliance: ComplianceChoice
  enterprise: EnterpriseChoice
  ph: PhLaunchChoice
  remote: RemoteChoice
}

// ─── ERA HANDLING (the DEFAULT_ASSERTED_URL_NEUTRAL pattern, extended 2026-10-01) ───────────
// DEFAULT_CHOICES is the FROZEN composition era: what an UNASSERTED ('Not set' / '.'-elided)
// decision composes. It never moves — every shared link that elided a decision replays exactly
// the branch it was shared with (PH-venue launch, remote-first, SOC 2-early compliance, …), and
// comboKey-seeded artifacts/events stay byte-identical. New house defaults land in
// DEFAULT_ASSERTED below instead: a FRESH visit starts with those decisions asserted, decoded
// legacy ?run= links are underlaid ONLY with the composition-neutral subset
// (DEFAULT_ASSERTED_URL_NEUTRAL) — so a new non-neutral default (X launch, Office) can never
// rewrite an old link's journey. Committed judged numbers never move either way.
export const DEFAULT_CHOICES: Choices = {
  entity: 'c-corp',
  funding: 'seed',
  product: 'subscriptions',
  team: 'cofounders',
  ordering: 'name-first',
  hire: 'yes',
  // 'Not set' still composes the SOC 2-early branch — old links that elide compliance replay the
  // exact journey they always did.
  compliance: 'now',
  enterprise: 'no',
  // 'Not set' composes the PH-venue launch — the pre-2026-10-01 default. The X-launch demo
  // default lives in DEFAULT_ASSERTED, never here.
  ph: 'yes',
  // 'Not set' composes remote-first (nothing extra) — the Office demo default lives in
  // DEFAULT_ASSERTED, never here.
  remote: 'remote',
}

// DEFAULT-ASSERTED decisions (founder batch 2026-09-29, round 4, item 5; demo composition
// refresh 2026-10-01, sim round 7 item 5): decisions that start ASSERTED at their listed value
// instead of 'Not set' — the dropdown shows the value, semi-auto never asks them, and the ?run=
// codec simply serializes them like any assertion. The founder's chosen demo composition:
// Raise a seed · Cofounders · X launch · Office · SOC 2 (early) · Delaware C-Corp — with the
// ai-assistant pin defaulting to ChatGPT (DEFAULT_VS_ASSISTANT below).
// ERA NOTE: team/funding/compliance equal their DEFAULT_CHOICES values (composition-NEUTRAL —
// they join the URL-neutral underlay; an elided legacy slot composes identically either way);
// ph 'x' and remote 'office' are NON-neutral (they change the default composition: Office
// composes the ops_014 lease phase, X names the launch venue) — they are EXCLUDED from the
// decoded-link underlay by construction, so legacy links keep their own era. Round-6's
// compliance 'basics' default is superseded by 'now' (SOC 2) per the founder's round-7 pick;
// 'basics' keeps its codec slot and roster row, and old links asserting it replay unchanged.
export const DEFAULT_ASSERTED: Partial<Choices> = {
  entity: 'c-corp',
  team: 'cofounders',
  funding: 'seed',
  compliance: 'now',
  ph: 'x',
  remote: 'office',
}

// The DEFAULT_ASSERTED subset that is composition-NEUTRAL (value === DEFAULT_CHOICES value) —
// the only safe underlay for a decoded ?run= link: an old link that elided a decision keeps
// composing exactly the default branch it always did, while the neutral slots still replay
// asserted (so semi-auto never asks them — the underlay's whole purpose). Derived, not listed:
// a non-neutral default (ph 'x', remote 'office') can never leak in by construction.
export const DEFAULT_ASSERTED_URL_NEUTRAL: Partial<Choices> = Object.fromEntries(
  Object.entries(DEFAULT_ASSERTED).filter(
    ([k, v]) => DEFAULT_CHOICES[k as keyof Choices] === v,
  ),
) as Partial<Choices>

// Option values removed from DISPLAY (dropdown roster + the semi-auto ask) while keeping their
// DECISIONS slot so old permalinks replay: compliance 'None' is redundant with the honestly-named
// 'Basic minimums' (identical composition) — our call, stated here.
export const HIDDEN_OPTION_VALUES: Partial<Record<keyof Choices, readonly string[]>> = {
  compliance: ['none'],
}

// ---------------------------------------------------------------------------
// Country-aware entity metadata (founder round 5, item 1)
// ---------------------------------------------------------------------------
// Each entity value names its country, display suffix, and the impossible-real formation filing
// its artifact prints (all-zero identifiers — the module-header convention). The corpus
// COMPOSITION never varies by country: only 'llc' swaps form_001 → form_011; every other value
// runs the C-Corp path framed with the committed country analog (processes/corpus.json geoNotes).

export interface EntityMeta {
  label: string
  suffix: string
  country: GeoCountry
  // The register named in the SIMULATED formation artifact — mirrors the committed geoNotes
  // analog's counterparty (Companies House / Handelsregister / RCS-greffe / MCA), never a claim
  // of real corpus steps for that register.
  filing: { label: string; register: string }
}

export const ENTITY_META: Record<EntityChoice, EntityMeta> = {
  'c-corp': {
    label: 'Delaware C-Corp', suffix: ', Inc.', country: 'US',
    filing: { label: 'Certificate of Incorporation', register: 'DE file no. 0000000' },
  },
  llc: {
    label: 'LLC', suffix: ' LLC', country: 'US',
    filing: { label: 'Certificate of Formation', register: 'DE file no. 0000000' },
  },
  ltd: {
    label: 'Ltd (Companies House)', suffix: ' Ltd', country: 'UK',
    filing: { label: 'Certificate of Incorporation', register: 'Companies House no. 00000000 (placeholder)' },
  },
  gmbh: {
    label: 'GmbH', suffix: ' GmbH', country: 'DE',
    filing: { label: 'Formation filing', register: 'Handelsregister HRB 00000 (placeholder)' },
  },
  ug: {
    label: 'UG (haftungsbeschränkt)', suffix: ' UG (haftungsbeschränkt)', country: 'DE',
    filing: { label: 'Formation filing', register: 'Handelsregister HRB 00000 (placeholder)' },
  },
  sas: {
    label: 'SAS', suffix: ' SAS', country: 'FR',
    filing: { label: 'Formation filing', register: 'RCS no. 000 000 000 (placeholder)' },
  },
  sarl: {
    label: 'SARL', suffix: ' SARL', country: 'FR',
    filing: { label: 'Formation filing', register: 'RCS no. 000 000 000 (placeholder)' },
  },
  'pvt-ltd': {
    label: 'Pvt Ltd', suffix: ' Pvt Ltd', country: 'IN',
    filing: { label: 'Certificate of Incorporation', register: 'MCA CIN U00000-DL-0000-PTC-000000 (placeholder)' },
  },
  lda: {
    label: 'Lda', suffix: ', Lda.', country: 'PT',
    filing: { label: 'Formation filing', register: 'Registo Comercial NIPC 000000000 (placeholder)' },
  },
  'ca-corp': {
    label: 'Federal corporation (CBCA)', suffix: ' Inc.', country: 'CA',
    filing: { label: 'Certificate of Incorporation', register: 'Corporations Canada no. 0000000 (placeholder)' },
  },
}

// The Entity dropdown's roster follows the geo selection; the FIRST option per country is the
// country's default-asserted value (a geo switch with an incompatible asserted entity resets to
// it — the component owns that rule).
export const ENTITY_OPTIONS_BY_COUNTRY: Record<GeoCountry, EntityChoice[]> = {
  US: ['c-corp', 'llc'],
  UK: ['ltd'],
  DE: ['gmbh', 'ug'],
  FR: ['sas', 'sarl'],
  IN: ['pvt-ltd'],
  PT: ['lda'],
  CA: ['ca-corp'],
}

export function defaultEntityFor(country: GeoCountry): EntityChoice {
  return ENTITY_OPTIONS_BY_COUNTRY[country][0]
}

export interface DecisionOption {
  value: string
  label: string
  // Names the REAL corpus process/chain the option maps to — the mapping is visible, not vibes.
  detail: string
}

export interface DecisionDef {
  id: keyof Choices
  title: string
  options: DecisionOption[]
}

// The decision tree, derived from what the corpus actually contains:
//   entity     — form_001 "Incorporate C-Corp" vs form_011 "Set up an LLC"; non-US entities
//                (Ltd / GmbH / UG / SAS / SARL / Pvt Ltd / Lda / CBCA corp) keep the form_001
//                composition framed
//                with the committed geoNotes country analog — never a fake corpus branch
//   team       — startup_002 "Founder agreement & equity split" included only with cofounders
//   funding    — the raise-a-seed-round chain (fund_005, fund_001, qs_052) included only on raise
//   product    — the get-paid chain forked: growth_001 "Set up subscription billing" (SaaS and
//                usage-based — usage is a billing mode, venue-noted) vs sales_002 "Send an
//                invoice" (invoice-billed services); marketplace/e-commerce run the spine only
//                (qs_021 + fin_002) — no take-rate/storefront corpus steps exist to run
//   ordering   — name-first (classic) vs build-first: the ship-v1 chain runs before naming —
//                pure reordering of committed chains, nothing added or dropped (the control
//                left the panel 2026-09-30 — HIDDEN_DECISION_IDS; old links still replay it)
//   hire       — the first-hire chain (hr_001, legal_003, opp_007, hr_002) included on yes
//   compliance — the set-up-compliance chain runs early (SOC 2 early / HIPAA / ISO 27001 —
//                framework named, same corpus steps) or deferred (SOC 2 deferred); 'None' and
//                'Basic minimums' (the honestly-named default posture) skip it entirely
//   enterprise — the ICP selector (2026-09-30, item 4): Enterprises ('yes') appends the
//                land-the-enterprise-deal chain as the final phase; every other ICP composes
//                the default path with the audience named in the revenue note (venue-noted)
//   ph         — the launch-on-product-hunt chain included for every public launch (Product
//                Hunt / Show HN / Waitlist — same corpus playbook, venue named in the phase
//                note); Stealth mode ('no') skips the chain entirely
//   remote     — 'office' adds the real "Lease an office" corpus process (ops_014) as its own
//                phase; remote-first (the default) composes nothing extra
export const DECISIONS: DecisionDef[] = [
  {
    id: 'entity',
    title: 'Entity',
    // Option ORDER is codec (c-corp/llc keep indices 0/1; non-US entities appended — see
    // EntityChoice). The dropdown shows only the selected country's options
    // (ENTITY_OPTIONS_BY_COUNTRY); every non-US value keeps the C-Corp corpus composition,
    // framed with the committed geoNotes country analog — no fake corpus branches.
    options: [
      { value: 'c-corp', label: 'Delaware C-Corp', detail: 'runs the real "Incorporate C-Corp" process (form_001)' },
      { value: 'llc', label: 'LLC', detail: 'runs the real "Set up an LLC" process (form_011)' },
      { value: 'ltd', label: 'Ltd (Companies House)', detail: 'the same corpus incorporation composition as the C-Corp path (form_001), framed for the UK with the committed Companies House analog — the corpus is US-shaped; no steps invented' },
      { value: 'gmbh', label: 'GmbH', detail: 'the same corpus incorporation composition as the C-Corp path (form_001), framed for Germany with the committed Handelsregister analog — the corpus is US-shaped; no steps invented' },
      { value: 'ug', label: 'UG (haftungsbeschränkt)', detail: 'the same corpus incorporation composition as the C-Corp path (form_001), framed for Germany with the committed Handelsregister analog — the corpus is US-shaped; no steps invented' },
      { value: 'sas', label: 'SAS', detail: 'the same corpus incorporation composition as the C-Corp path (form_001), framed for France with the committed formalités/RCS analog — the corpus is US-shaped; no steps invented' },
      { value: 'sarl', label: 'SARL', detail: 'the same corpus incorporation composition as the C-Corp path (form_001), framed for France with the committed formalités/RCS analog — the corpus is US-shaped; no steps invented' },
      { value: 'pvt-ltd', label: 'Pvt Ltd', detail: 'the same corpus incorporation composition as the C-Corp path (form_001), framed for India with the committed MCA analog — the corpus is US-shaped; no steps invented' },
      { value: 'lda', label: 'Lda', detail: 'the same corpus incorporation composition as the C-Corp path (form_001), framed for Portugal with the committed Empresa Online analog — the corpus is US-shaped; no steps invented' },
      { value: 'ca-corp', label: 'Federal corporation (CBCA)', detail: 'the same corpus incorporation composition as the C-Corp path (form_001), framed for Canada with the committed Corporations Canada analog — the corpus is US-shaped; no steps invented' },
    ],
  },
  {
    id: 'team',
    title: 'Team',
    options: [
      { value: 'cofounders', label: 'Cofounders', detail: 'adds "Founder agreement & equity split" (startup_002)' },
      { value: 'solo', label: 'Solo founder', detail: 'no founder equity split to paper — startup_002 is skipped' },
    ],
  },
  {
    id: 'funding',
    title: 'Funding',
    options: [
      { value: 'seed', label: 'Raise a seed', detail: 'adds the real "Raise a seed round" playbook (data room, SAFEs, cap table)' },
      { value: 'bootstrap', label: 'Bootstrap', detail: 'no fundraise phase — straight from formation to shipping' },
    ],
  },
  {
    id: 'product',
    title: 'Business model',
    // Option ORDER is codec (subscriptions/invoices keep indices 0/1; new models appended — see
    // ProductChoice). Only compositions the corpus honestly supports; shared chains are
    // venue-noted in the journey.
    options: [
      { value: 'subscriptions', label: 'SaaS subscriptions', detail: 'turns on revenue via "Set up subscription billing" (growth_001)' },
      { value: 'invoices', label: 'Invoice-billed services', detail: 'turns on revenue via "Send an invoice" (sales_002)' },
      { value: 'marketplace', label: 'Marketplace (take-rate)', detail: 'the same get-paid playbook spine — payment processor (qs_021) + first close (fin_002), take-rate named; the corpus has no dedicated take-rate billing steps, so neither billing fork runs and nothing is invented' },
      { value: 'usage', label: 'Usage-based', detail: 'the same subscription-billing chain (growth_001) — usage is a billing mode, named in the journey; identical corpus steps to SaaS subscriptions' },
      { value: 'ecommerce', label: 'E-commerce (DTC)', detail: 'the same get-paid playbook spine — checkout via the payment processor (qs_021) + first close (fin_002); the corpus has no storefront step yet, so none is invented' },
    ],
  },
  {
    id: 'ordering',
    title: 'What comes first',
    options: [
      { value: 'name-first', label: 'Name first', detail: 'the classic order — the name-the-company playbook leads, ship-v1 follows the raise' },
      { value: 'build-first', label: 'Build first', detail: 'the ship-v1 playbook runs before the company even has a name — same processes, reordered' },
    ],
  },
  {
    id: 'hire',
    title: 'First hire',
    options: [
      { value: 'yes', label: 'Make the first hire', detail: 'adds the first-hire playbook (offer hr_001, IP assignment, provisioning, payroll hr_002)' },
      { value: 'no', label: 'Stay founders-only', detail: 'no hire yet — the first-hire playbook is skipped' },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance posture',
    // Option ORDER is codec (now/later keep indices 0/1 — old links replay their placement
    // semantics as SOC 2 early/deferred; none/hipaa/iso appended — see ComplianceChoice).
    // HIPAA/ISO run the SAME chain with the framework named — no dedicated corpus chains exist
    // and no steps are fabricated; 'None' genuinely skips the chain.
    options: [
      { value: 'now', label: 'SOC 2 (early)', detail: 'the set-up-compliance playbook (SOC 2-lite) runs right after formation' },
      { value: 'later', label: 'SOC 2 (deferred)', detail: 'the same set-up-compliance playbook, deferred to after launch' },
      { value: 'none', label: 'None', detail: 'no compliance posture — the set-up-compliance playbook is skipped entirely (hidden from the roster: Basic minimums names the same composition honestly)' },
      { value: 'hipaa', label: 'HIPAA', detail: 'the same set-up-compliance playbook (SOC 2-lite corpus steps) run early for a HIPAA posture — the framework is named honestly; no dedicated HIPAA corpus chain exists and no steps are fabricated' },
      { value: 'iso', label: 'ISO 27001', detail: 'the same set-up-compliance playbook (SOC 2-lite corpus steps) run early for an ISO 27001 posture — the framework is named honestly; no dedicated ISO corpus chain exists and no steps are fabricated' },
      { value: 'basics', label: 'Basic minimums', detail: 'basic compliance hygiene without a formal framework — the dedicated set-up-compliance playbook does not run (the same composition None mapped to, honestly named); SOC 2 / HIPAA / ISO 27001 stay one pick away' },
    ],
  },
  {
    // The ICP selector (2026-09-30, item 4). Option ORDER is codec: 'no'/'yes' keep indices 0/1
    // AND their value tokens (comboKey stability — old seeded runs replay byte-identically);
    // 'smb'/'consumer' append. Labels map old digit 0 → the default ICP (Developers) and old
    // digit 1 → Enterprises, which carries the old enterprise-'yes' composition.
    id: 'enterprise',
    title: 'ICP',
    options: [
      { value: 'no', label: 'Developers', detail: 'selling to developers — the default journey composes unchanged (no enterprise-deal motion); the audience is a name, never new corpus steps (the developer buyer lenses — solo technical founder, AI-native startup — live at /icp)' },
      { value: 'yes', label: 'Enterprises', detail: 'selling to enterprises — appends the land-the-enterprise-deal playbook (Type II, pen test, status page, NDA, the close); the enterprise-platform-team ICP lens at /icp is the buyer' },
      { value: 'smb', label: 'SMBs', detail: 'selling to SMBs — the same default journey with the audience named in the revenue phase (venue-noted); no SMB-specific corpus steps exist, so none are invented' },
      { value: 'consumer', label: 'Consumers', detail: 'selling to consumers — the same default journey with the audience named in the revenue phase (venue-noted); no consumer-specific corpus steps exist, so none are invented' },
    ],
  },
  {
    id: 'ph',
    title: 'Launch',
    // Option ORDER is codec ('yes'/'no' keep indices 0/1; new venues appended — see
    // PhLaunchChoice). Show HN and Waitlist run the SAME real launch playbook with the venue
    // named in the journey (venue-flavored, never new corpus steps); Stealth skips it.
    options: [
      { value: 'yes', label: 'Product Hunt', detail: 'includes the launch-on-product-hunt playbook (email capture, assets, submission)' },
      { value: 'no', label: 'Stealth mode', detail: 'no public launch — the launch playbook is skipped; ongoing operations continue' },
      { value: 'show-hn', label: 'Show HN', detail: 'the same real launch-on-product-hunt playbook, aimed at a Show HN post — venue only, identical corpus steps' },
      { value: 'waitlist', label: 'Waitlist launch', detail: 'the same real launch-on-product-hunt playbook — its email-capture step opens the waitlist; venue only, identical corpus steps' },
      // Appended 2026-10-01 (item 5) — the new DEFAULT-ASSERTED launch; the Show HN precedent:
      // venue named, zero invented corpus steps.
      { value: 'x', label: 'X launch', detail: 'the same real launch-on-product-hunt playbook, aimed at a launch post on X — venue only, identical corpus steps' },
    ],
  },
  {
    // Remote vs In-office (2026-09-30, item 5) — APPENDED decision: older (shorter) digit
    // strings decode with this slot at its default (see the run codec's padding rule).
    id: 'remote',
    title: 'Workplace',
    options: [
      { value: 'remote', label: 'Remote-first', detail: 'no office — nothing extra composes; the journey is byte-identical to before this decision existed' },
      { value: 'office', label: 'Office', detail: 'adds the real "Lease an office" corpus process (ops_014) as its own phase — LOI, lease review, signature, deposit, COI; a single committed process, not a curated chain' },
    ],
  },
]

export function comboKey(c: Choices): string {
  // Legacy-stable seeds: the remote slot appends ONLY when non-default, so every combo that
  // existed before the decision keeps its exact key — the seeded names/artifacts/event streams
  // of every shared link replay byte-identically.
  const base = `${c.entity}|${c.funding}|${c.product}|${c.team}|${c.ordering}|${c.hire}|${c.compliance}|${c.enterprise}|${c.ph}`
  return c.remote === 'remote' ? base : `${base}|${c.remote}`
}

// Every decision combo, derived straight from DECISIONS so new options can never drift out of
// the enumeration (unionTaskIds, the codec round-trip tests, and the honesty suites all sweep it).
export function allChoiceCombos(): Choices[] {
  let combos: Array<Partial<Record<keyof Choices, string>>> = [{}]
  for (const d of DECISIONS) {
    combos = combos.flatMap((c) => d.options.map((o) => ({ ...c, [d.id]: o.value })))
  }
  return combos as Choices[]
}

// Decisions removed from the control panel (founder round 5, item 4: 'Start with' leaves the
// UI). The DECISIONS entry — and with it the ?run= digit slot — stays, so old links asserting
// these values still replay; composition keeps the default; presets/YC keep asserting them
// internally. The component hides the dropdown, the state panel row, and the semi-auto ask.
export const HIDDEN_DECISION_IDS: ReadonlyArray<keyof Choices> = ['ordering']

// ---------------------------------------------------------------------------
// Preset example companies (founder ask 2026-09-25: "prefill the simulator with real-feeling
// example companies") — one tap sets a full decision combo plus a fixed, clearly-fictional
// themed identity. HONESTY LINE: the journey is always the same real software-company process
// corpus; the hardware and biotech presets carry a visible disclosure saying exactly that —
// domain-specific steps (regulatory, manufacturing, trials) are NOT modeled and never implied.
// ---------------------------------------------------------------------------

export type PresetId = 'software' | 'hardware' | 'biotech'

// A preset's fixed synthetic identity — overrides the combo-seeded company name
// deterministically (a constant is trivially deterministic; tests still assert it).
export interface SynthIdentity {
  name: string
  descriptor: string
}

export interface VsPreset {
  id: PresetId
  label: string
  // What the example company makes — flavor via strings only, no new artifact types.
  product: string
  company: SynthIdentity
  choices: Choices
  // The visible one-line honesty disclosure — null only for the pure-software preset, whose
  // journey the corpus actually models end to end.
  disclosure: string | null
}

// Functional-type labels (founder batch 2026-09-30, item 11): the pills name WHAT KIND of
// startup each example is — the fictional company identities (Agentloop / Holofield / Demovax)
// stay as the run's synthetic identity but leave the option labels. Ids and the ?preset= tokens
// never move (codec/URL compat — labels only).
export const VS_PRESETS: VsPreset[] = [
  {
    id: 'software',
    label: 'Typical software',
    product: 'Agentic company control',
    company: { name: 'Agentloop', descriptor: 'an agentic company-control platform' },
    choices: {
      entity: 'c-corp', team: 'cofounders', funding: 'seed', product: 'subscriptions',
      ordering: 'name-first', hire: 'yes', compliance: 'later', enterprise: 'yes', ph: 'yes',
      remote: 'remote',
    },
    disclosure: null,
  },
  {
    id: 'hardware',
    label: 'Frontier hardware',
    product: 'Headsetless VR',
    company: { name: 'Holofield', descriptor: 'a headsetless VR display' },
    choices: {
      entity: 'c-corp', team: 'cofounders', funding: 'seed', product: 'invoices',
      ordering: 'build-first', hire: 'yes', compliance: 'later', enterprise: 'yes', ph: 'no',
      remote: 'remote',
    },
    disclosure:
      'Runs the same real software-company process corpus — hardware-specific steps (regulatory, manufacturing) aren’t modeled yet.',
  },
  {
    id: 'biotech',
    label: 'Biotech',
    product: 'Oncology vaccine co',
    company: { name: 'Demovax', descriptor: 'oncology vaccine programs' },
    // Compliance-specific combo update (founder round 5, item 3): the biotech example asserts
    // the HIPAA framing — the SAME set-up-compliance corpus chain, framework named, run early.
    choices: {
      entity: 'c-corp', team: 'cofounders', funding: 'seed', product: 'invoices',
      ordering: 'name-first', hire: 'yes', compliance: 'hipaa', enterprise: 'yes', ph: 'no',
      remote: 'remote',
    },
    disclosure:
      'Runs the same real software-company process corpus — biotech-specific steps (regulatory, trials, manufacturing) aren’t modeled yet.',
  },
]

export function presetById(id: string | null): VsPreset | null {
  return VS_PRESETS.find((p) => p.id === id) ?? null
}

// ---------------------------------------------------------------------------
// Funding scenarios (founder batch 2026-09-29, round 3, item 1: "'VC backed' vs 'Bootstrapped'")
// — one-tap pills on the setup band's Scenario row, preset-pill mechanics: exclusive highlight,
// the SAME ?preset= param (the codec extends compatibly — company preset ids and scenario ids
// share one namespace and never collide), deselected by any manual decision change. Unlike a
// company preset a scenario asserts only its OWN keys (a partial combo — the funding decision
// plus the calibrations that sensibly follow it) and carries no fixed identity: every other
// decision keeps whatever the reader (or a company preset) already set. Every asserted value is
// an existing DECISIONS option — a scenario invents nothing; the pill tooltip documents the
// exact key → option mapping (the founder's "document the mapping in the pill tooltips").
// ---------------------------------------------------------------------------

export type ScenarioId = 'vc-backed' | 'bootstrapped'

export interface VsScenario {
  id: ScenarioId
  label: string
  // The decisions this scenario asserts — a partial combo over existing DECISIONS options only.
  asserts: Partial<Choices>
  // The visible mapping documentation (rides in the pill's title/tooltip).
  tooltip: string
}

export const VS_SCENARIOS: VsScenario[] = [
  {
    id: 'vc-backed',
    label: 'VC backed',
    asserts: { funding: 'seed', entity: 'c-corp', hire: 'yes' },
    tooltip:
      'VC backed — asserts Funding: Raise a seed (the real raise-a-seed-round playbook), plus the calibrations that follow institutional money — Entity: Delaware C-Corp (the standard vehicle investors fund, form_001) and First hire: Make the first hire (the seed pays for it, the first-hire playbook). Every other decision keeps its current setting.',
  },
  {
    id: 'bootstrapped',
    label: 'Bootstrapped',
    asserts: { funding: 'bootstrap', product: 'invoices', hire: 'no' },
    tooltip:
      'Bootstrapped — asserts Funding: Bootstrap (no fundraise phase), plus the calibrations that follow self-funding — Business model: Invoice-billed services (revenue from day one, sales_002) and First hire: Stay founders-only (until revenue supports one). Every other decision keeps its current setting.',
  },
]

export function scenarioById(id: string | null): VsScenario | null {
  return VS_SCENARIOS.find((s) => s.id === id) ?? null
}

// ---------------------------------------------------------------------------
// YC batch mode (founder ask 2026-09-25) — calibrates the SAME real corpus journey to the
// publicly known YC batch shape. Honesty rules: only real corpus processes, rearranged; the
// standard PUBLISHED deal replaces the generic seed numbers in the SYNTHETIC artifacts (still
// SIMULATED-chipped); the weekly group-partner update is synthetic (the corpus has no such
// process — it is rendered SIMULATED and never added to the corpus); and the mode carries a
// visible non-affiliation disclosure.
// ---------------------------------------------------------------------------

// The launch-early calibration YC mode forces onto any combo: raise (Demo Day), PH launch ON,
// ship-v1 pulled forward. Manually flipping one of these away turns the mode off.
export const YC_CALIBRATION = { funding: 'seed', ph: 'yes', ordering: 'build-first' } as const satisfies Partial<Choices>

export function applyYcCalibration(c: Choices): Choices {
  return { ...c, ...YC_CALIBRATION }
}

// The standard published YC deal — replaces the generic fund_001 SAFE numbers in YC mode.
export const YC_DEAL = {
  label: 'SAFE round',
  value: '$500,000 YC standard deal — $125,000 for 7% + $375,000 on an uncapped MFN SAFE',
} as const

export const YC_BATCH = {
  // The publicly known batch shape: ~3 months, kickoff → weekly group office hours → Demo Day.
  weeks: 12,
  calendar: 'kickoff week 1 · weekly group office hours · Demo Day ~week 12',
  disclosure:
    'Calibrated to the publicly known YC batch shape — synthetic, not affiliated with or endorsed by Y Combinator.',
  // The synthetic recurring row for the rhythm views. NOT a corpus process; rendered with the
  // SIMULATED chip, never linked to a process page, and excluded from corpus-derived stats.
  officeHours: {
    title: 'Weekly update to your group partner',
    cadenceLabel: 'Weekly (batch)',
    intervalDays: 7,
    runsPerBatch: 12,
    months: [1, 2, 3] as number[],
  },
} as const

// ---------------------------------------------------------------------------
// Decision gates — shared shape for the cadence-sweep and event-driven example rows
// ---------------------------------------------------------------------------

// null choice = every operating company runs it; otherwise on only when the named decision has
// the named value. `why` names the reasoning so the gating is visible, not vibes.
export type VsGate =
  | { choice: null; why: string }
  | { choice: keyof Choices; value: string; why: string }

export function gateActive(gate: VsGate, choices: Choices): boolean {
  return gate.choice === null || choices[gate.choice] === gate.value
}

// ---------------------------------------------------------------------------
// Decision → journey mapping (real chains from journeys/chains.json only)
// ---------------------------------------------------------------------------

// The chains the journey is composed from — each id must exist in journeys/chains.json
// (journeyPhases throws otherwise; the test suite checks against the committed file).
export const VS_CHAIN_IDS = [
  'name-the-company',
  'company-launch',
  'raise-a-seed-round',
  'set-up-compliance',
  'ship-v1',
  'launch-website',
  'get-paid',
  'first-hire',
  'launch-on-product-hunt',
  'land-the-enterprise-deal',
] as const

export interface VsChain {
  id: string
  name: string
  taskIds: string[]
}

export interface JourneyPhase {
  id: string
  title: string
  chainId: string
  chainName: string
  taskIds: string[]
  // Names the decision effect applied to this phase's chain, when one applies.
  note: string | null
}

function chainOrThrow(chains: VsChain[], id: string): VsChain {
  const hit = chains.find((c) => c.id === id)
  if (!hit) throw new Error(`virtual-startup journey references unknown chain "${id}"`)
  return hit
}

// 'Apply to YC' (founder batch 2026-10-01, item 6): the setup-band checkbox composes the REAL
// "Apply to Y Combinator" corpus process (fund_007 — added 2026-10-01 from YC's own published
// application guidance, https-cited per step; no YC-application process existed in the corpus
// and the agent-skills arena holds no judged YC-application skill, checked 2026-10-01) as its
// own single-process phase — the ops_014 office/lease pattern exactly: committed corpus work,
// NOT a curated chain, so the phase carries no chainId and the UI renders no playbook link.
// Distinct from YC batch mode (`yc` — a calibration of the journey's shape); the two compose.
// Codec: the ?run= state carries it as the APPENDED 'q' token (lib/virtualStartupRun.ts) —
// legacy links lack it and replay without the phase, their era.
export const YC_APPLY_TASK_ID = 'fund_007'

export interface JourneyOpts {
  // YC batch calibration: the raise phase compresses to Demo-Day timing (batch end) — same real
  // raise-a-seed-round chain, relocated, never altered.
  yc?: boolean
  // 'Apply to YC' (item 6, 2026-10-01): compose the real YC-application process (fund_007,
  // YC_APPLY_TASK_ID above) as its own phase right after formation.
  ycApply?: boolean
}

// The whole journey for one decision combo: time-ordered phases, each seeded by a REAL curated
// chain's taskIds with the decision transforms applied — a task id is only ever swapped for
// another real corpus task (form_001 → form_011) or dropped, never invented. Tasks appearing in
// several chains (domain_002, prod_005) run once: first occurrence wins, later phases lose them.
export function journeyPhases(choices: Choices, chains: VsChain[], opts: JourneyOpts = {}): JourneyPhase[] {
  const yc = opts.yc === true
  const ycApply = opts.ycApply === true
  const phases: JourneyPhase[] = []
  const push = (id: string, title: string, chainId: string, transform?: (ids: string[]) => string[], note?: string | null) => {
    const chain = chainOrThrow(chains, chainId)
    const taskIds = transform ? transform([...chain.taskIds]) : [...chain.taskIds]
    phases.push({ id, title, chainId, chainName: chain.name, taskIds, note: note ?? null })
  }

  const buildPhase = () =>
    push(
      'build',
      'Build & ship v1',
      'ship-v1',
      undefined,
      choices.ordering === 'build-first' ? 'build-first — the prototype ships before the company has a name' : null,
    )
  const compliancePhase = () =>
    push(
      'compliance',
      'Stand up compliance',
      'set-up-compliance',
      undefined,
      choices.compliance === 'now'
        ? 'SOC 2 early — the SOC 2-lite posture stands before the product ships'
        : choices.compliance === 'hipaa'
          ? 'HIPAA — the same set-up-compliance corpus playbook (SOC 2-lite steps) run early for a HIPAA posture; no dedicated HIPAA corpus chain exists, so the framework is named, never fabricated'
          : choices.compliance === 'iso'
            ? 'ISO 27001 — the same set-up-compliance corpus playbook (SOC 2-lite steps) run early for an ISO 27001 posture; no dedicated ISO corpus chain exists, so the framework is named, never fabricated'
            : 'SOC 2 deferred — the same playbook, after launch',
    )
  // Early placement covers every framework option; only 'later' defers; 'none' and 'basics'
  // (item 8 — the honestly-named default posture) skip the dedicated playbook entirely.
  const complianceEarly = choices.compliance === 'now' || choices.compliance === 'hipaa' || choices.compliance === 'iso'

  const raisePhase = () =>
    push(
      'raise',
      'Raise the seed',
      'raise-a-seed-round',
      undefined,
      yc
        ? 'YC calibration — the raise compresses to Demo-Day timing (batch end); the SAFE artifact carries the standard published YC deal'
        : null,
    )

  // Non-US entities: the C-Corp corpus composition, framed with the committed country analog.
  const entityMeta = ENTITY_META[choices.entity]
  const entityNote =
    choices.entity === 'llc'
      ? 'LLC path — "Set up an LLC" (form_011) replaces the C-Corp filing'
      : entityMeta.country !== 'US'
        ? `${entityMeta.label} — the same corpus incorporation composition as the C-Corp path, framed for ${GEO_PREF_META[entityMeta.country].prose} with the committed country analog (the corpus is US-shaped; no steps invented)`
        : null
  const soloNote = choices.team === 'solo' ? 'solo founder — the founder equity split (startup_002) is skipped' : null

  if (choices.ordering === 'build-first') buildPhase()
  push('name', 'Name & brand', 'name-the-company')
  push(
    'form',
    'Form the company',
    'company-launch',
    (ids) =>
      ids
        .map((id) => (id === 'form_001' && choices.entity === 'llc' ? 'form_011' : id))
        .filter((id) => id !== 'startup_002' || choices.team === 'cofounders'),
    [entityNote, soloNote].filter((n): n is string => n !== null).join(' · ') || null,
  )
  // 'Apply to YC' (item 6, 2026-10-01): the real YC-application corpus process, right after the
  // company exists (the application asks for company, founders, and equity). The ops_014
  // pattern: a single committed process, not a curated chain — chainId '' and no playbook link.
  if (ycApply) {
    phases.push({
      id: 'yc-apply',
      title: 'Apply to YC',
      chainId: '',
      chainName: '',
      taskIds: [YC_APPLY_TASK_ID],
      note: 'Apply to YC — the real "Apply to Y Combinator" corpus process (fund_007, per YC’s published application guidance) joins the journey; a single committed process, not a curated chain. Synthetic run; not affiliated with or endorsed by Y Combinator.',
    })
  }
  if (choices.funding === 'seed' && !yc) raisePhase()
  if (complianceEarly) compliancePhase()
  if (choices.ordering === 'name-first') buildPhase()
  push('website', 'Launch the website', 'launch-website')
  // Non-enterprise non-default ICPs (item 4) are venue-noted on the revenue phase — the audience
  // is a name on the same corpus steps, exactly the launch-venue precedent.
  const icpNote =
    choices.enterprise === 'smb'
      ? ' · ICP: SMBs — the audience is named only (no SMB-specific corpus steps exist; identical composition)'
      : choices.enterprise === 'consumer'
        ? ' · ICP: consumers — the audience is named only (no consumer-specific corpus steps exist; identical composition)'
        : ''
  push(
    'revenue',
    'Turn on revenue',
    'get-paid',
    (ids) =>
      ids.filter((id) =>
        id === 'growth_001' ? choices.product === 'subscriptions' || choices.product === 'usage'
        : id === 'sales_002' ? choices.product === 'invoices'
        : true,
      ),
    (choices.product === 'subscriptions'
      ? 'SaaS — subscription billing (growth_001); the invoice path (sales_002) is skipped'
      : choices.product === 'usage'
        ? 'usage-based — the same subscription-billing playbook (growth_001); usage is a billing mode (model named only; identical corpus steps); the invoice path (sales_002) is skipped'
        : choices.product === 'marketplace'
          ? 'marketplace (take-rate) — the get-paid spine only: payment processor (qs_021) + first close (fin_002); the corpus has no take-rate billing steps, so neither billing fork runs'
          : choices.product === 'ecommerce'
            ? 'e-commerce (DTC) — the get-paid spine: checkout via the payment processor (qs_021) + first close (fin_002); the corpus has no storefront step yet, so none is invented'
            : 'services — invoicing (sales_002); subscription billing (growth_001) is skipped') + icpNote,
  )
  if (choices.hire === 'yes') push('hire', 'First hire', 'first-hire')
  // Remote vs In-office (item 5): 'office' composes the real "Lease an office" corpus process
  // (ops_014) as its own single-process phase. It is committed corpus work but NOT a curated
  // chain, so the phase carries no chainId and the UI renders no playbook link — an honest
  // presentation, never a fake chain. Remote-first composes nothing extra (the pre-decision
  // journey, byte for byte).
  if (choices.remote === 'office') {
    phases.push({
      id: 'office',
      title: 'Move into an office',
      chainId: '',
      chainName: '',
      taskIds: ['ops_014'],
      note: 'in-office — the real "Lease an office" corpus process (ops_014) joins the journey; a single committed process, not a curated chain',
    })
  }
  // Any PUBLIC launch runs the same real launch playbook — the venue options only name where
  // it aims (honesty: no invented corpus steps); Stealth mode ('no') skips the chain.
  if (choices.ph !== 'no')
    push(
      'launch',
      'Launch day',
      'launch-on-product-hunt',
      undefined,
      choices.ph === 'show-hn'
        ? 'Show HN — the same launch playbook, aimed at a Show HN post (venue only; identical corpus steps)'
        : choices.ph === 'waitlist'
          ? 'waitlist launch — the same launch playbook; the email-capture step opens the waitlist (venue only; identical corpus steps)'
          : choices.ph === 'x'
            ? 'X launch — the same launch playbook, aimed at a launch post on X (venue only; identical corpus steps)'
            : null,
    )
  if (choices.compliance === 'later') compliancePhase()
  // compliance 'none': the chain honestly never runs — neither branch above fires.
  // YC calibration: the same raise chain, at Demo-Day timing — the end of the batch.
  if (choices.funding === 'seed' && yc) raisePhase()
  // Always last: the enterprise close leans on the compliance playbook's posture either way.
  if (choices.enterprise === 'yes') push('enterprise', 'Enterprise motion', 'land-the-enterprise-deal')

  // Dedupe across phases — first occurrence wins.
  const seen = new Set<string>()
  return phases
    .map((p) => ({
      ...p,
      taskIds: p.taskIds.filter((id) => {
        if (seen.has(id)) return false
        seen.add(id)
        return true
      }),
    }))
    .filter((p) => p.taskIds.length > 0)
}

export function journeyTaskIds(choices: Choices, chains: VsChain[]): string[] {
  return journeyPhases(choices, chains).flatMap((p) => p.taskIds)
}

// Every task id any decision combo can reach — the server page precomputes payloads for exactly
// this set (order-stable: first combo that reaches a task places it).
export function unionTaskIds(chains: VsChain[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const combo of allChoiceCombos()) {
    for (const id of journeyTaskIds(combo, chains)) {
      if (!seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
  }
  // The 'Apply to YC' checkbox (item 6, 2026-10-01) is run state, not a decision — its phase is
  // reachable from ANY combo, so its task joins the union explicitly (the server page
  // precomputes payloads for exactly this set).
  if (!seen.has(YC_APPLY_TASK_ID)) out.push(YC_APPLY_TASK_ID)
  return out
}

// ---------------------------------------------------------------------------
// 'Which AI firm are you using' (founder batch 2026-09-30, item 7)
// ---------------------------------------------------------------------------
// The setup band's "I'm using" selector: REAL judged ai-assistants products only (the roster is
// pinned against data/ai-assistants/products.json by tests). The selection is a DISPLAY PIN on the
// ai-assistants-mapped steps (the LLM-venue curation: steps whose judged step ranking lives in
// the ai-assistants arena): the chosen assistant renders as 'your assistant' while the judged
// top keeps its '(recommended · judged)' chip and score — no judged number ever moves, and the
// pin never touches the outcome clock. Persisted in ?run= as the appended 'a' token
// (lib/virtualStartupRun.ts — old links simply lack it).

// APPEND-ONLY (the 'a' codec token stores the id string and validates membership — appending
// keeps every legacy link decoding; removals would reject shared links). dots, grok-bot, kimi,
// and perplexity-computer joined with the 2026-10-01 roster expansion, judged first.
export const VS_AI_FIRM_IDS = ['chatgpt', 'claude', 'gemini', 'grok', 'muse', 'dots', 'grok-bot', 'kimi', 'perplexity-computer'] as const
export type VsAiFirmId = (typeof VS_AI_FIRM_IDS)[number]

// The assistant a FRESH visit starts pinned to (founder batch 2026-10-01, item 5: ChatGPT is
// simply pre-selected — no 'judged pick' wording labels this default; the '(recommended ·
// judged)' chip on step vendors is a different surface, the honesty label on rankings, and
// stays). ERA: decoded ?run= links override this — an old link without the 'a' token replays
// with no pin, exactly as it was shared. Display pin only; no judged number moves.
export const DEFAULT_VS_ASSISTANT: VsAiFirmId = 'chatgpt'

// The arena the pin applies to — a step is "an AI-conversation step" exactly when its judged
// top pick was ranked in this arena (committed step-story mappings, resolved server-side).
export const VS_AI_FIRM_ARENA = 'ai-assistants'

// Serialized server-side (lib/virtualStartupData.ts buildVsAssistants): the judged product's
// display name + whether a committed logo file exists.
export interface VsAssistant {
  id: string
  name: string
  hasLogo: boolean
}

// ---------------------------------------------------------------------------
// Serializable payload shapes (built server-side by app/startup-sim/page.tsx)
// ---------------------------------------------------------------------------

// The top JUDGED vendor for one step — lib/processRankings.ts stepRanking()'s #1, carried with
// its arena so the UI can link the judged product page. null when the step has no committed
// story mapping / judged ranking (the UI then shows nothing rather than a guess).
export interface TopVendorPick {
  productId: string
  name: string
  score: number
  arenaId: string
  arenaName: string
  // Whether a committed logo file exists (lib/logos.ts, resolved server-side — node:fs), so the
  // client state panel can render the real logo chip (components/ProductLogoView.tsx). Optional
  // additive field (2026-09-29): absent = initial-letter fallback, nothing else changes.
  hasLogo?: boolean
  // The step ranking's next 1–2 vendors after the top pick (lib/processRankings.ts stepRanking,
  // serialized server-side), so the terminal can show the recommended pick's runners-up. Optional
  // additive field (2026-09-29): absent = no runners-up fragment renders.
  runnersUp?: Array<{ productId: string; name: string; score: number }>
}

// A registry artifact (processes/artifacts.json) a corpus step brings into existence — id for
// the /artifacts/{id} link, label for display. Committed registry data, serialized server-side.
export interface VsProducedArtifact {
  id: string
  label: string
}

export interface VirtualTaskPayload {
  id: string
  title: string
  slug: string
  phase: string
  description: string
  steps: SimStep[]
  // Parallel to steps: the step's top judged vendor, or null.
  tops: (TopVendorPick | null)[]
  // Corpus DAG node ids, parallel to steps (app/startup-sim/page.tsx serializes task.dag.nodes in
  // the same order buildSimSteps flattens them), so each rendered step can deep-link the process
  // page's #step-{taskId}-{nodeId} anchor (the pinned anchor contract,
  // lib/__tests__/process-anchor-contract.test.ts). Optional additive field (2026-10-07): absent
  // = the step renders unlinked, nothing else changes.
  nodeIds?: string[]
  // Parallel to steps: the registry artifact the corpus step's producesArtifact tag names, with
  // its committed label (processes/artifacts.json), or null for the many steps without one.
  // Optional additive field (2026-10-07): absent = no document line ever renders for the task.
  produces?: (VsProducedArtifact | null)[]
  // The task's internal corpus DAG fork, when its edges genuinely diverge: the forking step's
  // label and the labels of the parallel branches' first steps (committed dag.edges only —
  // app/startup-sim/page.tsx derives it; a linear DAG carries nothing). Optional additive field
  // (2026-10-07): read by components/VsJourneyDag.tsx's branch/join treatment.
  fork?: { at: string; branches: string[] }
  // The corpus GEO dimension (lib/processes.ts geoScope) + curated per-country analogs, passed
  // through for the in-sim geo annotations (founder batch 2026-09-29). Optional additive fields:
  // absent = no geo annotation ever renders for the task (honest degrade, never a guess).
  geoScope?: 'global' | 'us' | 'us-state'
  geoNotes?: GeoAnalogNote[]
}

// ---------------------------------------------------------------------------
// Deterministic synthetic artifacts — the "virtual data" each step produces
// ---------------------------------------------------------------------------

export interface SyntheticArtifact {
  taskId: string
  label: string
  value: string
  // Literal true — a synthetic artifact cannot exist unlabeled. buildJourneyArtifacts stamps
  // it centrally; the UI renders the visible SIMULATED chip off this flag; tests enforce both.
  simulated: true
}

// fnv-1a string hash → 32-bit seed.
function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32 — tiny deterministic PRNG, plenty for demo data.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]
}

const NAME_ROOTS = ['Quant', 'Vanta', 'Lume', 'Arc', 'Drift', 'Fathom', 'Nova', 'Tan', 'Hex', 'Onset', 'Mica', 'Bram', 'Cinder', 'Sable', 'Perch', 'Ostra'] as const
const NAME_TAILS = ['leaf', 'forge', 'grid', 'flow', 'stack', 'port', 'byte', 'loop', 'works', 'base', 'line', 'harbor'] as const

export interface SynthCompany {
  name: string // "Quantforge"
  display: string // "Quantforge, Inc." / "Quantforge LLC" — follows the entity decision
  slug: string // "quantforge"
  // What the company makes — only set by a preset identity (null for combo-seeded names).
  descriptor: string | null
}

// The virtual company's identity, deterministic from the decision combo. Its own seed stream so
// the name never shifts when the artifact set changes. A preset identity overrides the seeded
// name deterministically (a fixed constant) — entity suffix and slug still derive the same way.
// `seedCombo` (additive, 2026-09-29) pins the NAME seed to a different combo than the live one —
// semi-auto drive mode uses it so mid-run decision assertions never rewrite an already-printed
// name; the entity suffix still follows the live choices.
export function synthCompany(choices: Choices, identity?: SynthIdentity | null, seedCombo?: Choices): SynthCompany {
  const name = identity
    ? identity.name
    : (() => {
        const rng = mulberry32(hashSeed(`vs:name:${comboKey(seedCombo ?? choices)}`))
        return `${pick(rng, NAME_ROOTS)}${pick(rng, NAME_TAILS)}`
      })()
  return {
    name,
    // The entity label follows the decision — non-US entities wear their real-world suffix
    // (Ltd / GmbH / …), the country-frame half of founder round 5 item 1.
    display: `${name}${ENTITY_META[choices.entity].suffix}`,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    descriptor: identity?.descriptor ?? null,
  }
}

interface ArtifactCtx {
  rng: () => number
  choices: Choices
  co: SynthCompany
}

type Draft = { label: string; value: string }

// One generator per corpus task id that produces a visible artifact. Values are constructed to
// be impossible-real (see module header) — the SIMULATED chip is belt, these are braces.
const ARTIFACT_GENERATORS: Record<string, (ctx: ArtifactCtx) => Draft[]> = {
  brand_001: ({ co }) => [{ label: 'Company name', value: co.display }],
  domain_002: ({ co }) => [{ label: 'Domain', value: `${co.slug}.example (reserved demo TLD)` }],
  brand_002: ({ co }) => [{ label: 'Logo', value: `wordmark "${co.name}" generated` }],
  brand_003: ({ rng }) => {
    const hex = () => `#${Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0')}`
    return [{ label: 'Brand palette', value: `${hex()} / ${hex()}` }]
  },
  legal_002: ({ co }) => [{ label: 'Trademark filing', value: `"${co.name}" — USPTO serial 00000000 (placeholder)` }],
  // Entity-aware (founder round 5, item 1): the filing artifact names the entity's register
  // (mirroring the committed country analog) — still impossible-real all-zero identifiers.
  form_001: ({ co, choices }) => [{
    label: ENTITY_META[choices.entity].filing.label,
    value: `${co.display} — ${ENTITY_META[choices.entity].filing.register}`,
  }],
  form_011: ({ co }) => [{ label: 'Certificate of Formation', value: `${co.display} — DE file no. 0000000` }],
  // No real EIN starts 00 — the canonical impossible-real placeholder.
  form_002: () => [{ label: 'EIN', value: '00-0000000' }],
  startup_002: () => [{ label: 'Founder equity', value: '50 / 50 split · 4-year vest, 1-year cliff' }],
  qs_051: ({ choices }) => [{
    label: 'Cap table',
    value: `10,000,000 authorized · ${choices.team === 'cofounders' ? '2 founder holders' : '1 founder holder'}`,
  }],
  qs_023: () => [{ label: 'Bank account', value: 'checking ····0000 · routing 000000000' }],
  qs_063: () => [{ label: 'Payroll', value: 'first run $0.00 — no employees yet' }],
  qs_073: () => [{ label: 'Books', value: 'chart of accounts seeded · 0 transactions' }],
  fund_005: ({ rng }) => [{ label: 'Data room', value: `${8 + Math.floor(rng() * 13)} documents indexed` }],
  fund_001: ({ rng }) => [{
    label: 'SAFE round',
    value: `$${pick(rng, ['250,000', '500,000', '750,000', '1,000,000'])} on a $${pick(rng, ['4M', '5M', '6M', '8M', '10M'])} post-money cap`,
  }],
  qs_052: () => [{ label: 'Cap table update', value: 'SAFEs recorded · fully-diluted view refreshed' }],
  prod_006: ({ co }) => [{ label: 'Repo', value: `code.example/${co.slug}/app` }],
  sw_010: () => [{ label: 'Agent readiness', value: 'AGENTS.md + CI checks committed' }],
  prod_001: ({ co }) => [{ label: 'Cloud', value: `project ${co.slug}-prod provisioned` }],
  prod_002: () => [{ label: 'CI/CD', value: 'pipeline #1 green · deploy on merge' }],
  prod_004: () => [{ label: 'Error tracking', value: 'DSN wired · 0 open issues' }],
  prod_005: () => [{ label: 'Analytics', value: 'first event captured: $pageview' }],
  site_001: ({ co }) => [{ label: 'Website', value: `https://${co.slug}.example live` }],
  prod_003: ({ co }) => [{ label: 'DNS', value: `${co.slug}.example → apex A record set` }],
  // Model-flavored (round 5, item 2): same corpus step, the business model named; the rng
  // stream is consumed identically across models so every other artifact stays byte-stable.
  qs_021: ({ choices }) => [{
    label: 'Payments',
    value:
      choices.product === 'marketplace'
        ? 'account acct_SIM0000000 activated (test mode) · take-rate routing configured'
        : choices.product === 'ecommerce'
          ? 'account acct_SIM0000000 activated (test mode) · checkout live on the site'
          : 'account acct_SIM0000000 activated (test mode)',
  }],
  growth_001: ({ rng, choices }) => {
    const price = pick(rng, ['19', '29', '49', '99'])
    return [{
      label: 'First subscription',
      value:
        choices.product === 'usage'
          ? `Pro — $${price}/mo base + metered usage · sub_SIM0001 active`
          : `Pro — $${price}/mo · sub_SIM0001 active`,
    }]
  },
  sales_002: ({ rng }) => [{
    label: 'First invoice',
    value: `INV-0001 — $${pick(rng, ['900.00', '1,200.00', '2,400.00', '4,800.00'])} · net 30`,
  }],
  fin_002: () => [{ label: 'First close', value: 'month 1 reconciled · payout matched' }],
  growth_003: ({ co }) => [{ label: 'Email list', value: `1 subscriber — founder@${co.slug}.example` }],
  // Venue-flavored (2026-09-29 launch options): the same corpus step, the chosen venue named.
  growth_010: ({ co, choices }) => [{
    label: 'Launch day',
    value:
      choices.ph === 'show-hn'
        ? `"${co.name}" queued as a Show HN post · assets uploaded`
        : choices.ph === 'waitlist'
          ? `waitlist for "${co.name}" opened · assets uploaded`
          : choices.ph === 'x'
            ? `launch post for "${co.name}" drafted on X · assets uploaded`
            : `"${co.name}" queued on the directories · assets uploaded`,
  }],
  // First-hire playbook (2026-09-25 toggle wave).
  hr_001: () => [{ label: 'Offer', value: 'offer #001 signed — Engineer 1 joins' }],
  legal_003: () => [{ label: 'IP assignment', value: 'PIIA signed · 1 employee, all founders on file' }],
  opp_007: ({ co }) => [{ label: 'Workspace user', value: `engineer1@${co.slug}.example provisioned` }],
  hr_002: ({ rng }) => [{
    label: 'Payroll run',
    value: `run #1 — $${pick(rng, ['8,000.00', '10,000.00', '12,500.00'])} gross · 1 employee`,
  }],
  // Set-up-compliance playbook.
  ops_005: () => [{ label: 'Password vault', value: 'team vault created · 2 shared items' }],
  scale_007: () => [{ label: 'SSO', value: 'SSO enforced · MFA on for every seat' }],
  ops_013: () => [{ label: 'Device management', value: '1 laptop enrolled · disk encryption verified' }],
  comp_010: ({ co }) => [{ label: 'Privacy policy', value: `https://${co.slug}.example/privacy live · DPA template ready` }],
  // Framework-aware (round 5, item 3): HIPAA/ISO name the framework honestly — the steps are the
  // SOC 2-lite corpus playbook's, and the artifact says so rather than implying dedicated steps.
  comp_001: ({ choices }) => [
    choices.compliance === 'hipaa'
      ? { label: 'HIPAA readiness', value: 'controls stood up on the SOC 2-lite corpus playbook · framework named: HIPAA (no dedicated HIPAA corpus steps)' }
      : choices.compliance === 'iso'
        ? { label: 'ISO 27001 readiness', value: 'controls stood up on the SOC 2-lite corpus playbook · framework named: ISO 27001 (no dedicated ISO corpus steps)' }
        : { label: 'SOC 2 Type I', value: 'observation window opened · 0 failing controls' },
  ],
  // Lease-an-office process (2026-09-30, item 5 — the 'office' workplace branch). No rng: a
  // constant draft, so no other artifact's seeded stream ever shifts.
  ops_014: ({ co }) => [{
    label: 'Office lease',
    value: `LOI → lease executed for ${co.name} HQ · deposit wired $0.00 (placeholder) · COI delivered`,
  }],
  // Apply-to-YC process (2026-10-01, item 6 — the setup-band checkbox). No rng (the ops_014
  // convention), impossible-real batch tag — and never a claim of acceptance: the process ends
  // at the submitted application and the modeled decision wait.
  fund_007: ({ co }) => [{
    label: 'YC application',
    value: `application for ${co.name} submitted · 1-minute founder video uploaded · batch X00 (placeholder)`,
  }],
  // Land-the-enterprise-deal playbook.
  comp_002: () => [{ label: 'SOC 2 Type II', value: 'report issued — observation window closed' }],
  comp_013: () => [{ label: 'Pen test', value: 'report delivered · 0 critical findings' }],
  prod_011: ({ co }) => [{ label: 'Status page', value: `status.${co.slug}.example live · SLA 99.9%` }],
  legal_001: () => [{ label: 'NDA', value: 'mutual NDA NDA-0001 sent for signature' }],
  comp_014: () => [{ label: 'Security questionnaire', value: '300 rows answered from the policy base' }],
  legal_004: ({ rng, co }) => [{
    label: 'Enterprise contract',
    value: `order form executed — $${pick(rng, ['12,000', '24,000', '48,000'])}/yr · ${co.name} MSA v1`,
  }],
}

// The task ids that produce artifacts — exported so tests can enforce that every generator key
// is a real corpus task reachable by some decision combo (no dead or invented demo data).
export const ARTIFACT_TASK_IDS: readonly string[] = Object.keys(ARTIFACT_GENERATORS)

export interface ArtifactOpts {
  // Preset identity — themes every name-carrying artifact string via the existing generators.
  identity?: SynthIdentity | null
  // YC mode: the standard PUBLISHED YC deal replaces the generic fund_001 SAFE numbers. The rng
  // stream is still consumed identically, so every OTHER artifact stays byte-identical.
  yc?: boolean
  // Additive (2026-09-29, semi-auto drive mode): pin the rng/name seed to this combo instead of
  // the live one. Semi-auto passes DEFAULT_CHOICES so a mid-run decision assertion never
  // rewrites an already-printed seeded value (the stream is consumed in journey order, and the
  // journey only changes AFTER the paused row) — the generators still read the LIVE choices for
  // choice-driven content (entity suffix, cap-table holder count), which the pause schedule
  // accounts for. Omitted = today's behavior, byte for byte.
  seedCombo?: Choices
}

// Every artifact for one journey, keyed by task id. Deterministic: the rng stream is seeded by
// the decision combo and consumed in journey (taskIds) order — the same choices replay the same
// artifacts, byte for byte. The `simulated: true` stamp happens HERE, once, for every artifact.
export function buildJourneyArtifacts(
  choices: Choices,
  taskIds: string[],
  opts: ArtifactOpts = {},
): Record<string, SyntheticArtifact[]> {
  const co = synthCompany(choices, opts.identity ?? null, opts.seedCombo)
  const rng = mulberry32(hashSeed(`vs:artifacts:${comboKey(opts.seedCombo ?? choices)}`))
  const out: Record<string, SyntheticArtifact[]> = {}
  for (const taskId of taskIds) {
    const gen = ARTIFACT_GENERATORS[taskId]
    if (!gen) continue
    const drafts = gen({ rng, choices, co })
    const flavored = opts.yc === true && taskId === 'fund_001' ? [{ ...YC_DEAL }] : drafts
    out[taskId] = flavored.map((d) => ({ taskId, ...d, simulated: true as const }))
  }
  return out
}

// ---------------------------------------------------------------------------
// Journey stats & elapsed time (all from corpus estimatedMinutes — no invented durations)
// ---------------------------------------------------------------------------

export interface JourneyStats {
  totalSteps: number
  agentSteps: number
  formSteps: number
  personSteps: number
  legalSignatures: number
  approvals: number
  asyncSteps: number
  totalMinutes: number
}

export function journeyStats(steps: SimStep[]): JourneyStats {
  const s: JourneyStats = {
    totalSteps: steps.length,
    agentSteps: 0,
    formSteps: 0,
    personSteps: 0,
    legalSignatures: 0,
    approvals: 0,
    asyncSteps: 0,
    totalMinutes: 0,
  }
  for (const step of steps) {
    if (step.route === 'agent') s.agentSteps += 1
    else if (step.route === 'form') s.formSteps += 1
    else s.personSteps += 1
    if (step.legalSignature) s.legalSignatures += 1
    if (step.approvalRequired) s.approvals += 1
    if (step.async) s.asyncSteps += 1
    s.totalMinutes += step.estimatedMinutes
  }
  return s
}

// 1-based simulation day for a cumulative elapsed-minutes reading (corpus estimates summed).
export function dayOf(cumulativeMinutes: number): number {
  return Math.floor(cumulativeMinutes / (60 * 24)) + 1
}

// ---------------------------------------------------------------------------
// Year one — the operating rhythm ("cron jobs") the virtual company now runs
// ---------------------------------------------------------------------------
// Founder iteration 2026-09-25: after the launch journey, show the RECURRING processes the
// company owns for the year, derived from the corpus cadence axis (processes/corpus.json
// `cadence`, the same field /processes/operating-rhythm slices by). The row set is mechanical:
//   - the month-end-close and tax-season chains (committed corpus playbooks any operating
//     company runs) are ALWAYS in;
//   - plus every journey task whose cadence recurs on the calendar (payroll hr_002 with the
//     hire, monthly invoicing sales_002 on the invoices fork, the annual SOC 2 Type II /
//     pen test with the enterprise motion…).
// Calendar honesty: monthly/quarterly slots are pure cadence math; an annual process gets a
// real month ONLY where the corpus carries it (CORPUS_ANNUAL_MONTHS below); every other annual
// row gets a decision-combo-seeded month that renders with the SIMULATED chip — no invented
// deadlines presented as fact.

export const YEAR_CHAIN_IDS = ['month-end-close', 'tax-season'] as const

// Runs per year for each calendar cadence; null = not calendar-recurring (once / event-driven
// work never shows in the year view — a trigger is not a cron job).
export const RUNS_PER_YEAR: Record<Cadence, number | null> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
  'event-driven': null,
  once: null,
}

// Annual processes whose calendar month the CORPUS itself carries — the tax-season chain's
// tagline: "1099s out in January, Delaware franchise tax by March 1, …". Only these render as
// real calendar slots; lib/__tests__/virtualStartup.test.ts asserts the tagline still names
// them so this mapping can't silently drift from the data.
export const CORPUS_ANNUAL_MONTHS: Record<string, { month: number; note: string }> = {
  tax_003: { month: 1, note: 'January — 1099s go out (tax-season playbook)' },
  tax_001: { month: 3, note: 'by March 1 (tax-season playbook)' },
}

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export interface RouteMix {
  agent: number
  form: number
  person: number
  legalSignature: number
}

// One corpus task reshaped for the year view — built server-side (title/slug/cadence label from
// lib/processes.ts CADENCE_META, route mix + ceiling from the DAG) so this module stays pure.
export interface YearTaskSource {
  taskId: string
  title: string
  slug: string
  cadence: Cadence
  cadenceLabel: string
  totalSteps: number
  routes: RouteMix
  ceilingPct: number
}

// Founder iteration 2026-09-25 (richer year view): sweep processes/corpus.json for EVERY
// calendar-recurring process the journey plausibly activates — not just the tasks the journey
// chains happen to carry. Each swept task names its gate: null = every operating company runs
// it; a choice gate turns it on only when the decision that plausibly activates it is set.
// Deliberately excluded: vc_003 (Run the fund back office) — that is the launch-a-vc-fund
// playbook's process, not something a startup's journey activates. Keys must be disjoint from
// unionTaskIds (journey tasks stay journey-gated); tests enforce both.
export const YEAR_SWEEP_GATES: Record<string, VsGate> = {
  // Daily loops — the operating baseline once the company runs.
  opp_008: { choice: null, why: 'operating baseline — email goes out every day' },
  opp_009: { choice: null, why: 'operating baseline — tasks become tracked issues daily' },
  sw_001: { choice: null, why: 'the product keeps shipping after v1' },
  // Weekly.
  sw_002: { choice: null, why: 'a shipping team cuts releases weekly' },
  growth_011: { choice: null, why: 'the launched website needs the content engine' },
  growth_012: { choice: null, why: 'the first-10-customers motion — outbound runs weekly' },
  // Monthly.
  opp_012: { choice: null, why: 'the name-the-company playbook filed the mark (legal_002) — monitoring follows' },
  // Quarterly.
  comp_011: { choice: 'funding', value: 'seed', why: 'a financed board keeps a minutes cadence' },
  scale_005: { choice: 'funding', value: 'seed', why: 'a financed board meets quarterly' },
  scale_001: { choice: 'hire', value: 'yes', why: 'reviews start once there is an employee' },
  scale_012: { choice: 'hire', value: 'yes', why: 'OKRs start once there is a team' },
  growth_015: { choice: 'product', value: 'subscriptions', why: 'win-backs are a subscription motion' },
  // Annual.
  fin_010: { choice: null, why: 'every operating company budgets annually' },
  ins_001: { choice: null, why: 'insurance quotes renew annually' },
  qs_045: { choice: null, why: 'state registration review is an annual chore' },
  qs_047: { choice: null, why: 'the state annual report is due yearly' },
  fund_003: { choice: 'funding', value: 'seed', why: 'the 409A follows the raise and its option pool' },
  qs_053: { choice: 'funding', value: 'seed', why: 'the audited cap table follows the raise' },
}

export interface YearCandidate extends YearTaskSource {
  runsPerYear: number
  // From a YEAR_CHAIN_IDS chain — in every company's year regardless of decisions. Non-always
  // candidates appear when the selected journey includes their task, or when their sweep gate
  // (below) is active for the combo.
  always: boolean
  // The cadence-sweep gate, for candidates that enter via YEAR_SWEEP_GATES; null for candidates
  // the journey chains carry (those stay gated on journey inclusion).
  gate: VsGate | null
}

const YEAR_CADENCE_ORDER: readonly Cadence[] = ['daily', 'weekly', 'monthly', 'quarterly', 'annual']

// All year-view candidates, decision-independent (pure — callers pass the WHOLE corpus mapped
// to YearTaskSource plus the full chain list): the always chains' recurring tasks, every
// calendar-recurring task any decision combo can reach, plus the cadence sweep
// (YEAR_SWEEP_GATES). Sorted tightest loop first, mirroring /processes/operating-rhythm's
// CADENCE_ORDER convention.
export function buildYearCandidates(chains: VsChain[], tasks: YearTaskSource[]): YearCandidate[] {
  const byId = new Map(tasks.map((t) => [t.taskId, t]))
  const alwaysIds = new Set(YEAR_CHAIN_IDS.flatMap((id) => chainOrThrow(chains, id).taskIds))
  const candidateIds: string[] = []
  const seen = new Set<string>()
  for (const id of [...alwaysIds, ...unionTaskIds(chains), ...Object.keys(YEAR_SWEEP_GATES)]) {
    if (!seen.has(id)) {
      seen.add(id)
      candidateIds.push(id)
    }
  }
  const out: YearCandidate[] = []
  for (const taskId of candidateIds) {
    const t = byId.get(taskId)
    if (!t) throw new Error(`year view references unknown task "${taskId}"`)
    const runsPerYear = RUNS_PER_YEAR[t.cadence]
    if (runsPerYear === null) continue
    out.push({ ...t, runsPerYear, always: alwaysIds.has(taskId), gate: YEAR_SWEEP_GATES[taskId] ?? null })
  }
  return out.sort(
    (a, b) =>
      YEAR_CADENCE_ORDER.indexOf(a.cadence) - YEAR_CADENCE_ORDER.indexOf(b.cadence)
      || a.title.localeCompare(b.title),
  )
}

export type MonthSource = 'cadence' | 'corpus' | 'seeded'

export interface YearRow extends YearCandidate {
  // 1-based months (1 = Jan) this process runs in.
  months: number[]
  monthSource: MonthSource
  monthNote: string | null
}

// Calendar slots for one candidate. Monthly-and-tighter cadences cover every month and
// quarterlies land on quarter ends (pure cadence math); annuals get the corpus month where the
// corpus carries one, else a seeded month that the UI must label SIMULATED.
export function resolveYearMonths(
  candidate: Pick<YearCandidate, 'taskId' | 'cadence'>,
  choices: Choices,
): { months: number[]; monthSource: MonthSource; monthNote: string | null } {
  const { cadence, taskId } = candidate
  if (cadence === 'daily' || cadence === 'weekly' || cadence === 'monthly') {
    return { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], monthSource: 'cadence', monthNote: null }
  }
  if (cadence === 'quarterly') {
    return { months: [3, 6, 9, 12], monthSource: 'cadence', monthNote: null }
  }
  const corpus = CORPUS_ANNUAL_MONTHS[taskId]
  if (corpus) return { months: [corpus.month], monthSource: 'corpus', monthNote: corpus.note }
  const rng = mulberry32(hashSeed(`vs:month:${comboKey(choices)}:${taskId}`))
  return {
    months: [1 + Math.floor(rng() * 12)],
    monthSource: 'seeded',
    monthNote: 'annual — scheduled month is seeded (the corpus dates this annually, not to a month)',
  }
}

// The virtual company's year: always-on chain rows, journey-gated recurring rows, plus the
// cadence-sweep rows whose gate the combo activates — each with its calendar slots.
// Deterministic from the decision combo, like every artifact.
export function yearRows(choices: Choices, journeyIds: string[], candidates: YearCandidate[]): YearRow[] {
  const inJourney = new Set(journeyIds)
  return candidates
    .filter((c) => c.always || inJourney.has(c.taskId) || (c.gate !== null && gateActive(c.gate, choices)))
    .map((c) => ({ ...c, ...resolveYearMonths(c, choices) }))
}

export interface YearStats {
  rows: number
  // Σ runs/year across every rhythm row — "N recurring runs".
  totalRuns: number
  // Σ runs × steps — how many step-executions the year actually contains…
  stepRuns: number
  // …and how many of those an agent can run today (runs × the row's agent-routed steps).
  agentStepRuns: number
}

export function yearStats(rows: YearRow[]): YearStats {
  const s: YearStats = { rows: rows.length, totalRuns: 0, stepRuns: 0, agentStepRuns: 0 }
  for (const r of rows) {
    s.totalRuns += r.runsPerYear
    s.stepRuns += r.runsPerYear * r.totalSteps
    s.agentStepRuns += r.runsPerYear * r.routes.agent
  }
  return s
}

// ---------------------------------------------------------------------------
// Event-driven examples — real corpus processes that run when triggered, not on a calendar.
// A trigger is not a cron job: these rows carry NO months, NO runs/yr, and never enter
// yearStats — they name their trigger instead. Curated with the same gate shape as the
// cadence sweep; tests enforce every key is a real event-driven corpus task.
// ---------------------------------------------------------------------------

export const EVENT_EXAMPLES: Record<string, { gate: VsGate; trigger: string }> = {
  opp_001: { gate: { choice: null, why: 'every company pays vendors' }, trigger: 'a vendor bill needs paying' },
  opp_004: { gate: { choice: null, why: 'every company with revenue refunds sometimes' }, trigger: 'a customer asks for their money back' },
  growth_002: { gate: { choice: 'product', value: 'subscriptions', why: 'churn saves are a subscription motion' }, trigger: 'a subscriber hits cancel' },
  hr_005: { gate: { choice: 'hire', value: 'yes', why: 'offboarding exists once there is an employee' }, trigger: 'an employee leaves' },
  opp_007: { gate: { choice: 'hire', value: 'yes', why: 'provisioning rides the first-hire playbook' }, trigger: 'a new teammate needs accounts' },
  legal_001: { gate: { choice: 'enterprise', value: 'yes', why: 'enterprise conversations start under NDA' }, trigger: 'an enterprise conversation starts' },
  comp_014: { gate: { choice: 'enterprise', value: 'yes', why: 'enterprise buyers send questionnaires' }, trigger: 'a buyer sends the security questionnaire' },
  qs_052: { gate: { choice: 'funding', value: 'seed', why: 'SAFEs keep the cap table moving' }, trigger: 'a SAFE or option grant changes the cap table' },
}

export interface EventExample {
  taskId: string
  title: string
  slug: string
  totalSteps: number
  routes: RouteMix
  ceilingPct: number
  trigger: string
  gate: VsGate
}

// Decision-independent event-example candidates (pure — callers pass the corpus mapped to
// YearTaskSource); throws on an unknown or non-event-driven key rather than inventing a row.
export function buildEventExamples(tasks: YearTaskSource[]): EventExample[] {
  const byId = new Map(tasks.map((t) => [t.taskId, t]))
  return Object.entries(EVENT_EXAMPLES)
    .map(([taskId, meta]) => {
      const t = byId.get(taskId)
      if (!t) throw new Error(`event example references unknown task "${taskId}"`)
      if (t.cadence !== 'event-driven') throw new Error(`event example "${taskId}" is not event-driven in the corpus`)
      return {
        taskId,
        title: t.title,
        slug: t.slug,
        totalSteps: t.totalSteps,
        routes: t.routes,
        ceilingPct: t.ceilingPct,
        trigger: meta.trigger,
        gate: meta.gate,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

export function eventRows(choices: Choices, examples: EventExample[]): EventExample[] {
  return examples.filter((e) => gateActive(e.gate, choices))
}

// ---------------------------------------------------------------------------
// First 30 / first 90 days — the launch journey's day math plus the first occurrences of the
// recurring runs, sliced onto a day-granularity window. Honesty: journey days come from corpus
// estimatedMinutes (dayOf above); recurring first-run days are pure cadence math on the
// standard day intervals below (a month ≈ day 30, a quarter ≈ day 90 — conventions, not
// corpus dates); annuals and event-driven work carry no day at all (annuals live on the year
// view — the sim's day 1 is not anchored to a calendar date; triggers are sequenced undated).
// ---------------------------------------------------------------------------

export const WINDOW_INTERVAL_DAYS: Record<Cadence, number | null> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  annual: null,
  'event-driven': null,
  once: null,
}

export interface WindowRow extends YearRow {
  // Cadence-math day of the first run inside the window (daily work starts day 1).
  firstRunDay: number
  runsInWindow: number
}

// The recurring rows that land inside the first `windowDays` days, from the combo's year rows.
// A row appears only when at least one cadence-math run fits the window (a quarterly process
// misses the first 30 days; an annual never has a day here).
// ---------------------------------------------------------------------------
// 'Likely choice' vendor ordering (founder round 5, item 7) — the committed adoption/popularity
// signal as an ORDERING, never a new number. NO rank fabrication: every input is committed data —
//   curated  — data/popular-products.json membership ("clearly popular", an UNRANKED editorial
//              set; within it, measured counters then name order — presentation of an unranked
//              set, labeled as such, never a popularity rank claim);
//   stars    — data/{arena}/popularity.json GitHub stars (open-source products only);
//   installs — npm+PyPI weekly installs from the same popularity stage;
//   rest     — no committed signal: the judged input order is kept.
// The judged rankings stay untouched — this reorders PRESENTATION (Vendors-tab pickers, terminal
// runners-up) while the judged top keeps its '(recommended · judged)' label.
// ---------------------------------------------------------------------------

export interface VsPopularityProduct {
  id: string
  name: string
  curated: boolean
  stars?: number
  installs?: number
}

// Products best-first by the likely-choice tiers; ties inside the signal-less tail keep the
// caller's (judged) order. Pure and client-safe — the server resolves the signals.
export function likelyChoiceOrder(products: VsPopularityProduct[]): string[] {
  const tier = (p: VsPopularityProduct) =>
    p.curated ? 0 : p.stars !== undefined ? 1 : p.installs !== undefined ? 2 : 3
  return products
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        tier(a.p) - tier(b.p) ||
        (b.p.stars ?? -1) - (a.p.stars ?? -1) ||
        (b.p.installs ?? -1) - (a.p.installs ?? -1) ||
        (tier(a.p) === 3 ? a.i - b.i : a.p.name.localeCompare(b.p.name)),
    )
    .map((x) => x.p.id)
}

// One arena's likely-choice presentation payload: the best-first product order plus a per-product
// signal label (for tooltips — the receipt behind the position). Serialized server-side
// (lib/virtualStartupData.ts buildVsPopularity).
export interface VsLikelyInfo {
  order: string[]
  signals: Record<string, string>
}

// arenaId → likely-choice info. Optional everywhere it flows: absent arena = judged order kept.
export type VsPopularityMap = Record<string, VsLikelyInfo>

// Reorders a judged vendor list by an arena's likely-choice order — scores and membership stay
// exactly the judged ranking's; products the order doesn't know keep their judged order at the
// tail (Infinity rank, stable sort).
export function orderByLikelyChoice<T extends { productId: string }>(
  vendors: T[],
  order: string[] | undefined,
): T[] {
  if (!order || order.length === 0) return vendors
  const rank = new Map(order.map((id, i) => [id, i]))
  return vendors
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const ra = rank.get(a.v.productId) ?? Number.POSITIVE_INFINITY
      const rb = rank.get(b.v.productId) ?? Number.POSITIVE_INFINITY
      return ra - rb || a.i - b.i
    })
    .map((x) => x.v)
}

export function windowRows(rows: YearRow[], windowDays: number): WindowRow[] {
  const out: WindowRow[] = []
  for (const r of rows) {
    const interval = WINDOW_INTERVAL_DAYS[r.cadence]
    if (interval === null) continue
    const runs = Math.floor(windowDays / interval)
    if (runs <= 0) continue
    out.push({ ...r, firstRunDay: interval, runsInWindow: runs })
  }
  return out.sort((a, b) => a.firstRunDay - b.firstRunDay || a.title.localeCompare(b.title))
}
