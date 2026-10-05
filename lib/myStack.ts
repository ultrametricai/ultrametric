// Pure, client-safe engine for /my-stack (components/MyStackBuilder.tsx): the reader enters
// the stack they already run and gets typed, evidence-cited recommendations — upgrades,
// adjacent additions, possible overlaps, vendor consolidations, and break-outs. Same split as
// lib/stackBuilder.ts vs lib/aiStacks.ts: this file must stay free of node builtins (the
// browser computes recommendations from a server-serialized catalog — the selection lives in
// `?s=` and localStorage, so no server ever sees it); the catalog builder that DOES read
// CategoryData lives in lib/myStackData.ts.
//
// Honesty contract:
//   - Every recommendation is one sentence WITH the numbers it rests on, plus links to the
//     product pages where the evidence lives. No number here is ever invented — every score is
//     the same leaderboard value the arenas publish.
//   - Overlap recs never say "remove X": same-arena co-picks read neutrally as "you run N
//     vendors here" (a deliberate choice — regions, teams, migration in flight — is common),
//     and cross-arena coverage stays a "possible overlap" question.
//   - A score gap where either side's confidence grade is D (lib/confidence.ts: a substantial
//     share of the score rests on no evidence) is NOT actionable — upgrade/break-out recs are
//     suppressed rather than recommending on footing we've said is thin.
import { isShutdown } from './shutdown'
import { stackPairKey } from './stackBuilder'

// One catalog row — the lean serialized shape both /my-stack and /stacks/battle receive as a
// prop (built server-side by lib/myStackData.ts). A product ranked in two arenas (e.g. square
// in payments AND mobile-payments) has one row per arena; pick resolution takes the first row
// (categories order), the same canonical-arena convention as lib/alternatives.ts.
export interface MyStackProduct {
  id: string
  name: string
  vendor: string
  arenaId: string
  arenaName: string
  type: 'oss' | 'commercial' | 'government'
  /** Overall score from the arena leaderboard (null = not scored yet). */
  aiEra: number | null
  agentReady: number | null
  /** Evidence-confidence grade for the score's footing — see lib/confidence.ts. */
  confidence: 'A' | 'B' | 'C' | 'D'
  /** 1-based position in the arena leaderboard (its canonical order) and the field size. */
  rank: number
  fieldSize: number
  hasLogo: boolean
  /** The verified shutdown note (lib/schemas.ts ProductSchema) when the vendor announced it is
   *  closing — never offered as an upgrade/leader/add (lib/shutdown.ts founder rule); a reader
   *  who RUNS one gets MIGRATE advice on top. */
  shutdown?: string
}

// Everything the engine needs besides the reader's picks. adjacency/curatedStackArenas carry
// the arena-id vocabulary of data/adjacent-arenas.json clusters and data/ai-stacks.json slot
// patterns; verifiedPairs is lib/integrations.ts's verifiedPairKeys output ('a|b' sorted keys).
export interface MyStackInputs {
  products: MyStackProduct[]
  adjacency: string[][]
  curatedStackArenas: string[][]
  verifiedPairs: ReadonlyArray<string>
}

export type RecommendationKind = 'upgrade' | 'add' | 'overlap' | 'group' | 'breakout' | 'migrate'

export const RECOMMENDATION_KIND_LABELS: Record<RecommendationKind, string> = {
  upgrade: 'UPGRADE',
  add: 'ADD',
  overlap: 'OVERLAP',
  group: 'GROUP',
  breakout: 'BREAK OUT',
  migrate: 'MIGRATE',
}

export interface EvidenceLink {
  label: string
  /** Product page URL — where the cited scores' evidence actually lives. */
  href: string
}

export interface Recommendation {
  kind: RecommendationKind
  /** One honest sentence carrying the numbers the recommendation rests on. */
  reason: string
  links: EvidenceLink[]
  /** Ordering score (see impact formulas below) — never displayed, only sorted on. */
  impact: number
}

export interface RecommendationResult {
  recommendations: Recommendation[]
  /** How many recs beyond MAX_RECOMMENDATIONS were dropped — the UI must say so, not hide it. */
  truncated: number
}

// Overall score gap below which a same-arena alternative is noise, not an upgrade. Aligned with the
// spirit of lib/aiStacks.ts's CLOSE_CALL_DELTA (Δ3 = too close to call): Δ8 is far enough
// outside the close-call band to be a material, defensible difference.
export const UPGRADE_DELTA = 8
// The "specialists lead by a wide margin" bar for break-out recs — roughly two upgrade deltas.
export const BREAKOUT_DELTA = 15
export const MAX_RECOMMENDATIONS = 10

const round1 = (n: number) => Math.round(n * 10) / 10

// Arena weight for impact ordering: log2(1 + fieldSize). A Δ10 lead over 12 rivals says more
// than a Δ10 lead over 2 — bigger fields are more contested, so the same delta carries more
// signal. Logarithmic so a huge arena doesn't drown every other recommendation.
export function arenaWeight(fieldSize: number): number {
  return Math.log2(1 + Math.max(0, fieldSize))
}

const productHref = (p: MyStackProduct) => `/arena/${p.arenaId}/product/${p.id}`
const linkTo = (p: MyStackProduct): EvidenceLink => ({ label: p.name, href: productHref(p) })
const score = (n: number) => `${n.toFixed(0)}/100`

// Resolve pick ids against the catalog: first row per id (canonical arena), unknown ids
// dropped silently (stale share links degrade, same contract as lib/compare.ts).
export function resolvePicks(ids: string[], products: MyStackProduct[]): MyStackProduct[] {
  const byId = new Map<string, MyStackProduct>()
  for (const p of products) {
    if (!byId.has(p.id)) byId.set(p.id, p)
  }
  return ids.flatMap((id) => {
    const p = byId.get(id)
    return p ? [p] : []
  })
}

// A same-arena score gap is only actionable when NEITHER side's score rests on D-grade
// footing: a D challenger's lead may be inflated by unevidenced cells, and a D incumbent's
// deficit may be understated the same way. Either way the gap itself is the thin part.
function gapIsConfident(a: MyStackProduct, b: MyStackProduct): boolean {
  return a.confidence !== 'D' && b.confidence !== 'D'
}

const agentReadyClause = (challenger: MyStackProduct, pick: MyStackProduct): string =>
  challenger.agentReady !== null && pick.agentReady !== null
    ? `; agent-ready ${score(challenger.agentReady)} vs ${score(pick.agentReady)}`
    : ''

// ---- rule 0: MIGRATE (a pick's vendor announced it is shutting down) ----

// Sorts above every score-gap rec by construction: upgrade/breakout impact is delta ×
// arenaWeight, bounded by 100 × log2(1 + fieldSize) — far below this for any real field size.
// A shutdown pick is not a ranking nuance, it's a deadline.
export const MIGRATE_IMPACT = 1000

function migrateRecs(picks: MyStackProduct[], byArena: Map<string, MyStackProduct[]>): Recommendation[] {
  const out: Recommendation[] = []
  for (const pick of picks) {
    if (!isShutdown(pick)) continue
    // The honest migration target: the arena's best-ranked non-shutdown scored product, when
    // one exists. Confidence gating deliberately does NOT suppress this rec — the reason to
    // move is the vendor's own announcement, not a score gap.
    const target = (byArena.get(pick.arenaId) ?? [])
      .filter((c) => c.id !== pick.id && !isShutdown(c) && c.aiEra !== null)
      .sort((a, b) => a.rank - b.rank)[0]
    out.push({
      kind: 'migrate',
      reason: target
        ? `${pick.name} is shutting down — migrate: ${pick.shutdown} The ${pick.arenaName} leader among remaining products is ${target.name} at ${score(target.aiEra as number)} (confidence ${target.confidence}).`
        : `${pick.name} is shutting down — migrate: ${pick.shutdown}`,
      links: target ? [linkTo(pick), linkTo(target)] : [linkTo(pick)],
      impact: MIGRATE_IMPACT,
    })
  }
  return out
}

// ---- rule 1 + 5: UPGRADE / BREAK OUT (one rec per pick, break-out wins when both apply) ----

function upgradeAndBreakoutRecs(picks: MyStackProduct[], byArena: Map<string, MyStackProduct[]>): Recommendation[] {
  const out: Recommendation[] = []
  const pickIds = new Set(picks.map((p) => p.id))
  for (const pick of picks) {
    if (pick.aiEra === null) continue
    // A shutdown pick's advice is rule 0's MIGRATE (see migrateRecs) — a score-gap upgrade
    // beside it would bury the lede.
    if (isShutdown(pick)) continue
    const field = byArena.get(pick.arenaId) ?? []
    // Best confident challenger: highest Overall score, must clear UPGRADE_DELTA, must not be
    // another of the reader's own picks (that pair is rule 3's overlap, not an upgrade) —
    // and never a shutdown product (lib/shutdown.ts: not an offer).
    const challenger = field
      .filter(
        (c) =>
          c.id !== pick.id &&
          !pickIds.has(c.id) &&
          !isShutdown(c) &&
          c.aiEra !== null &&
          c.aiEra - (pick.aiEra as number) >= UPGRADE_DELTA &&
          gapIsConfident(c, pick),
      )
      .sort((a, b) => (b.aiEra as number) - (a.aiEra as number) || a.rank - b.rank)[0]
    if (!challenger) continue
    const delta = (challenger.aiEra as number) - pick.aiEra
    const impact = round1(delta * arenaWeight(pick.fieldSize))
    const bottomThird = pick.fieldSize >= 3 && pick.rank > (2 * pick.fieldSize) / 3
    if (bottomThird && delta >= BREAKOUT_DELTA) {
      out.push({
        kind: 'breakout',
        reason:
          `${pick.name} sits #${pick.rank} of ${pick.fieldSize} in ${pick.arenaName} at ${score(pick.aiEra)} while the specialist ${challenger.name} leads at ${score(challenger.aiEra as number)} (Δ${delta.toFixed(0)}${agentReadyClause(challenger, pick)}; confidence ${challenger.confidence} vs ${pick.confidence}) — worth splitting this job out to the specialist.`,
        links: [linkTo(pick), linkTo(challenger)],
        impact,
      })
    } else {
      out.push({
        kind: 'upgrade',
        reason:
          `${challenger.name} scores ${score(challenger.aiEra as number)} vs ${pick.name}'s ${score(pick.aiEra)} in ${pick.arenaName} (Δ${delta.toFixed(0)}${agentReadyClause(challenger, pick)}; confidence ${challenger.confidence} vs ${pick.confidence}).`,
        links: [linkTo(challenger), linkTo(pick)],
        impact,
      })
    }
  }
  return out
}

// ---- rule 2: ADD (adjacent arenas with nothing in the stack → suggest the arena leader) ----

// Impact bases — deliberately below a solid upgrade's delta so speculative additions rank
// under concrete same-arena evidence gaps.
const ADD_BASE = 5
const CURATED_ADD_BONUS = 2
const OVERLAP_BASE = 4
const GROUP_BASE = 4

// A well-connected stack borders MANY arenas (against the live adjacency data a 4-product
// stack can border 20+), and a wall of "you could also add…" would drown the concrete
// same-arena findings — so ADD keeps only its strongest few, and the overflow is counted in
// the result's truncated total rather than silently dropped.
export const MAX_ADD_RECS = 4

function addRecs(picks: MyStackProduct[], inputs: MyStackInputs, byArena: Map<string, MyStackProduct[]>): Recommendation[] {
  const covered = new Set(picks.map((p) => p.arenaId))
  if (covered.size === 0) return []
  // Candidate arenas: every uncovered arena sharing an adjacency cluster with a covered one,
  // plus uncovered slots of any curated stack pattern the reader already half-runs (≥2 of its
  // arenas covered — one shared arena is coincidence, two is a pattern).
  const candidates = new Map<string, { via: Set<string>; curated: boolean }>()
  const noteCandidate = (arenaId: string, via: string[], curated: boolean) => {
    if (covered.has(arenaId)) return
    const entry = candidates.get(arenaId) ?? { via: new Set<string>(), curated: false }
    for (const v of via) entry.via.add(v)
    entry.curated ||= curated
    candidates.set(arenaId, entry)
  }
  for (const cluster of inputs.adjacency) {
    const overlap = cluster.filter((id) => covered.has(id))
    if (overlap.length === 0) continue
    for (const id of cluster) noteCandidate(id, overlap, false)
  }
  for (const pattern of inputs.curatedStackArenas) {
    const overlap = pattern.filter((id) => covered.has(id))
    if (overlap.length < 2) continue
    for (const id of pattern) noteCandidate(id, overlap, true)
  }

  const arenaNameOf = (arenaId: string) =>
    byArena.get(arenaId)?.[0]?.arenaName ?? arenaId
  const pickNamesIn = (arenaIds: Set<string>) =>
    picks.filter((p) => arenaIds.has(p.arenaId)).map((p) => p.name)

  const out: Recommendation[] = []
  for (const [arenaId, { via, curated }] of [...candidates.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const field = byArena.get(arenaId)
    if (!field) continue // adjacency names an arena that isn't live — nothing honest to suggest
    // Never suggest adding a shutdown product (lib/shutdown.ts) — the next-ranked leader stands.
    const leader = field.filter((p) => p.aiEra !== null && !isShutdown(p)).sort((a, b) => a.rank - b.rank)[0]
    if (!leader) continue
    const neighbors = pickNamesIn(via)
    const viaClause = neighbors.length > 0 ? `sits next to your ${neighbors.slice(0, 3).join(', ')} pick${neighbors.length === 1 ? '' : 's'}` : 'is adjacent to your stack'
    out.push({
      kind: 'add',
      reason:
        `You have nothing in ${arenaNameOf(arenaId)}, which ${viaClause}${curated ? ' (and fills a slot in a curated stack pattern you already half-run)' : ''} — the arena leader is ${leader.name} at ${score(leader.aiEra as number)} (confidence ${leader.confidence}).`,
      links: [linkTo(leader)],
      // Base × arena weight, scaled by how strong the arena's leader actually is (leader/50):
      // an adjacent arena whose best option scores 30/100 is a weaker suggestion than one led
      // at 60/100, and the ordering should say so.
      impact: round1(
        (ADD_BASE + (curated ? CURATED_ADD_BONUS : 0)) * arenaWeight(leader.fieldSize) * ((leader.aiEra as number) / 50),
      ),
    })
  }
  return out.sort((a, b) => b.impact - a.impact || a.reason.localeCompare(b.reason))
}

// ---- rule 3: OVERLAP (possible redundancy — phrased as a question, never a command) ----

function overlapRecs(picks: MyStackProduct[], products: MyStackProduct[]): Recommendation[] {
  const out: Recommendation[] = []
  // (a) Two or more picks in the same arena.
  const byPickArena = new Map<string, MyStackProduct[]>()
  for (const p of picks) {
    const list = byPickArena.get(p.arenaId) ?? []
    list.push(p)
    byPickArena.set(p.arenaId, list)
  }
  // 2+ picks in one arena is a real signal — a deliberate multi-vendor setup (regions, teams,
  // migration in flight) — so it reads neutrally as "you run N vendors here", never as an error.
  for (const [, group] of [...byPickArena.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (group.length < 2) continue
    const names = group.map((p) => `${p.name} (${p.aiEra !== null ? score(p.aiEra) : 'unscored'})`)
    out.push({
      kind: 'overlap',
      reason:
        `You run ${group.length} vendors in the ${group[0].arenaName} arena — ${names.join(' and ')}; often deliberate (regions, teams, a migration in flight), worth a look only if the split isn't intentional.`,
      links: group.map(linkTo),
      impact: round1(OVERLAP_BASE * arenaWeight(group[0].fieldSize)),
    })
  }
  // (b) Cross-arena coverage: pick Y is ALSO ranked in pick X's arena at or above X — the
  // catalog itself says Y already covers X's job. (Chosen over integration-neighbor heuristics
  // deliberately: a verified integration edge means "connects to", not "replaces" — inferring
  // redundancy from it would overclaim what the evidence says.)
  for (const x of picks) {
    if (x.aiEra === null) continue
    for (const y of picks) {
      if (y.id === x.id || y.arenaId === x.arenaId) continue
      const yInXArena = products.find((r) => r.id === y.id && r.arenaId === x.arenaId && r.aiEra !== null)
      if (!yInXArena || (yInXArena.aiEra as number) < x.aiEra) continue
      out.push({
        kind: 'overlap',
        reason:
          `${y.name} is also ranked in ${x.arenaName} at ${score(yInXArena.aiEra as number)} — at or above ${x.name}'s ${score(x.aiEra)} — possible overlap between the two.`,
        links: [linkTo(y), linkTo(x)],
        impact: round1((OVERLAP_BASE + ((yInXArena.aiEra as number) - x.aiEra) / 4) * arenaWeight(x.fieldSize)),
      })
    }
  }
  return out
}

// ---- rule 4: GROUP (one vendor family could cover two slots, evidence permitting) ----

function groupRecs(picks: MyStackProduct[], products: MyStackProduct[], verifiedPairs: ReadonlyArray<string>): Recommendation[] {
  const verified = new Set(verifiedPairs)
  const byVendorArena = new Map<string, MyStackProduct[]>()
  for (const p of products) {
    const key = `${p.vendor}::${p.arenaId}`
    const list = byVendorArena.get(key) ?? []
    list.push(p)
    byVendorArena.set(key, list)
  }
  const vendors = [...new Set(products.map((p) => p.vendor))].sort()

  const out: Recommendation[] = []
  const seen = new Set<string>()
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      const p = picks[i]
      const q = picks[j]
      if (p.arenaId === q.arenaId || p.aiEra === null || q.aiEra === null) continue
      for (const vendor of vendors) {
        if (vendor === p.vendor && vendor === q.vendor) continue // already one family
        const bestIn = (arenaId: string, floor: number) =>
          (byVendorArena.get(`${vendor}::${arenaId}`) ?? [])
            // A consolidation is an offer — never onto a product that announced a shutdown.
            .filter((r) => r.aiEra !== null && r.aiEra >= floor && !isShutdown(r))
            .sort((a, b) => (b.aiEra as number) - (a.aiEra as number))[0]
        const rp = bestIn(p.arenaId, p.aiEra)
        const rq = bestIn(q.arenaId, q.aiEra)
        if (!rp || !rq) continue
        const samePick = rp.id === p.id && rq.id === q.id
        if (samePick) continue // that "consolidation" is the stack the reader already has
        const oneProduct = rp.id === rq.id
        // Consolidation only makes sense when the family actually interconnects: one product
        // covering both arenas, or a verified integration edge between the two family members.
        if (!oneProduct && !verified.has(stackPairKey(rp.id, rq.id))) continue
        const dedupeKey = `${vendor}::${[p.arenaId, q.arenaId].sort().join('|')}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        const meanDelta = ((rp.aiEra as number) - p.aiEra + ((rq.aiEra as number) - q.aiEra)) / 2
        const meanWeight = (arenaWeight(p.fieldSize) + arenaWeight(q.fieldSize)) / 2
        const reason = oneProduct
          ? `${vendor}'s ${rp.name} is ranked in both ${p.arenaName} (${score(rp.aiEra as number)}) and ${q.arenaName} (${score(rq.aiEra as number)}), at or above your ${p.name} (${score(p.aiEra)}) and ${q.name} (${score(q.aiEra)}) — one product could cover both slots.`
          : `${vendor} covers both slots: ${rp.name} (${score(rp.aiEra as number)} in ${p.arenaName}) and ${rq.name} (${score(rq.aiEra as number)} in ${q.arenaName}) score at or above your ${p.name} (${score(p.aiEra)}) and ${q.name} (${score(q.aiEra)}), with a verified integration between them.`
        out.push({
          kind: 'group',
          reason,
          links: oneProduct ? [linkTo(rp), linkTo(p), linkTo(q)] : [linkTo(rp), linkTo(rq), linkTo(p), linkTo(q)],
          impact: round1((GROUP_BASE + meanDelta) * meanWeight),
        })
      }
    }
  }
  return out
}

// ---- the engine ----

export function recommend(pickIds: string[], inputs: MyStackInputs): RecommendationResult {
  const picks = resolvePicks(pickIds, inputs.products)
  if (picks.length === 0) return { recommendations: [], truncated: 0 }

  const byArena = new Map<string, MyStackProduct[]>()
  for (const p of inputs.products) {
    const list = byArena.get(p.arenaId) ?? []
    list.push(p)
    byArena.set(p.arenaId, list)
  }

  const adds = addRecs(picks, inputs, byArena)
  const addOverflow = Math.max(0, adds.length - MAX_ADD_RECS)
  const all = [
    ...migrateRecs(picks, byArena),
    ...upgradeAndBreakoutRecs(picks, byArena),
    ...adds.slice(0, MAX_ADD_RECS),
    ...overlapRecs(picks, inputs.products),
    ...groupRecs(picks, inputs.products, inputs.verifiedPairs),
  ].sort((a, b) => b.impact - a.impact || a.kind.localeCompare(b.kind) || a.reason.localeCompare(b.reason))

  return {
    recommendations: all.slice(0, MAX_RECOMMENDATIONS),
    truncated: Math.max(0, all.length - MAX_RECOMMENDATIONS) + addOverflow,
  }
}

// ---- share-URL state (?s=id1,id2) + device-local persistence ----

// Same silent-degrade contract as lib/compare.ts's parseCompareParam: unknown ids (stale
// links, typos) are dropped, dupes collapse, and the list caps at MAX_MY_STACK.
export const MAX_MY_STACK = 24

export function parseMyStackParam(raw: string | null | undefined, validIds: ReadonlySet<string>): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const piece of raw.split(',')) {
    const id = piece.trim()
    if (id === '' || !validIds.has(id) || out.includes(id)) continue
    out.push(id)
    if (out.length === MAX_MY_STACK) break
  }
  return out
}

export function encodeMyStackParam(ids: string[]): string {
  return ids.join(',')
}

// localStorage persistence — same device-local, tolerant-parse contract as lib/watchlist.ts
// (the UI must carry the same "stored in this browser only" honesty note).
export const MY_STACK_KEY = 'pa-my-stack'

export function parseStoredStack(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id !== ''))].slice(0, MAX_MY_STACK)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// The ACCOUNT stack — the reader's picks per arena, synced to the logged-in account
// ---------------------------------------------------------------------------
//
// Founder ask: "in signed-in mode, allow the user to define their stack and get upgraded stack
// advice" — and run process pages against it; plus (2026-09-22) "allow multiple vendors for
// functions": readers really run several products in one arena (Mercury AND Brex, Slack AND
// Discord). Distinct from the free-form tool above (a flat id list in ?s=/localStorage): this
// is a MAP { arenaId: productId[] } — an ORDERED list of picks per arena, first = primary —
// only ids the catalog actually judges in that arena. It follows lib/watchlist.ts verbatim:
// localStorage is the source the UI reads (instant, offline-safe); for logged-in readers it
// syncs to the worker's session-gated GET/PUT /api/my-stack
// (infra/cloudflare-proxy/worker.js "My Stack API", KV key stack:<user id>). Anonymous
// readers, worker-less origins, and any network failure just leave the stack device-local.
//
// v1 → v2: the store used to hold exactly ONE pick per arena ({ arenaId: productId }).
// parseStackMap accepts BOTH shapes — from localStorage AND from the KV payload — migrating a
// bare string to a one-element array losslessly; serialization always writes v2 arrays.

export type StackMap = Record<string, string[]>

export const STACK_KEY = 'pa-account-stack'
export const STACK_API = '/api/my-stack'
// Same-tab change event — localStorage's 'storage' event only fires in OTHER tabs.
export const STACK_EVENT = 'pa-account-stack-change'
export const MAX_STACK_ARENAS = 100
// Picks per arena cap — mirrored by the worker's normalizeStackMap (same posture as its caps).
export const MAX_PICKS_PER_ARENA = 8

// Tolerant parse over BOTH shapes: a v1 string value migrates to [string]; a v2 array keeps
// its order (dupes/junk members dropped, capped at MAX_PICKS_PER_ARENA; an emptied arena is
// dropped). Anything else degrades entry-wise (junk values dropped) or wholesale (not an
// object → {}), never a crash.
export function parseStackMap(raw: string | null): StackMap {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  const out: StackMap = {}
  for (const [arenaId, value] of Object.entries(parsed)) {
    if (arenaId === '') continue
    const list = typeof value === 'string' ? [value] : Array.isArray(value) ? value : null
    if (list === null) continue
    const picks: string[] = []
    for (const id of list) {
      if (typeof id !== 'string' || id === '' || picks.includes(id)) continue
      picks.push(id)
      if (picks.length >= MAX_PICKS_PER_ARENA) break
    }
    if (picks.length === 0) continue
    out[arenaId] = picks
    if (Object.keys(out).length >= MAX_STACK_ARENAS) break
  }
  return out
}

// Canonical serialization (sorted keys, always v2 array values) so equality checks and
// useSyncExternalStore snapshots are stable regardless of insertion order. Pick ORDER within
// an arena is meaningful (first = primary) and preserved.
export function serializeStackMap(stack: StackMap): string {
  return JSON.stringify(Object.fromEntries(Object.entries(stack).sort(([a], [b]) => a.localeCompare(b))))
}

// ---- pick helpers (client-safe, pure) ----

/** The ordered picks for one arena — [] when the arena has none. */
export function stackPicks(stack: StackMap, arenaId: string): string[] {
  return stack[arenaId] ?? []
}

/** "Is this A pick" — the v2 replacement for every stack[arenaId] === productId equality. */
export function isPicked(stack: StackMap, arenaId: string, productId: string): boolean {
  return stackPicks(stack, arenaId).includes(productId)
}

/** Toggle membership: adds to the END of the arena's picks (or removes; removing the last pick
 *  deletes the key). Returns a NEW map — the input is never mutated. Adding beyond
 *  MAX_PICKS_PER_ARENA is a no-op (returns the input map unchanged). */
export function togglePick(stack: StackMap, arenaId: string, productId: string): StackMap {
  const picks = stackPicks(stack, arenaId)
  if (picks.includes(productId)) {
    const remaining = picks.filter((id) => id !== productId)
    const next = { ...stack }
    if (remaining.length === 0) delete next[arenaId]
    else next[arenaId] = remaining
    return next
  }
  if (picks.length >= MAX_PICKS_PER_ARENA) return stack
  return { ...stack, [arenaId]: [...picks, productId] }
}

/** The arena's primary (first) pick — null when the arena has none. */
export function primaryPick(stack: StackMap, arenaId: string): string | null {
  return stackPicks(stack, arenaId)[0] ?? null
}

// First-sync merge. Unlike the watchlist's union (a set can keep both sides), the map merges
// per ARENA: the ACCOUNT's pick list wins a conflict wholesale (it is the cross-device source
// of truth — order within an arena is meaningful, so lists are never unioned), and arenas only
// the device knows about are kept. Nothing is ever dropped outright — clearing a pick only
// propagates through an explicit write while synced, so a stale device can't silently erase
// the account stack.
export function mergeStackMaps(server: StackMap, local: StackMap): StackMap {
  return { ...local, ...server }
}

// Raw snapshot for useSyncExternalStore — the STRING is the snapshot (stable identity between
// writes), parsed by the consumer. '{}' on the server and where localStorage throws.
export function readStackRaw(): string {
  if (typeof window === 'undefined') return '{}'
  try {
    return window.localStorage.getItem(STACK_KEY) ?? '{}'
  } catch {
    return '{}'
  }
}

export function writeStack(stack: StackMap): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STACK_KEY, serializeStackMap(stack))
  } catch {
    return // storage unavailable — the edit is a silent no-op, same as reads
  }
  window.dispatchEvent(new Event(STACK_EVENT))
  if (stackServerSync) pushStack(stack)
}

// True once syncStackFromServer has confirmed the account store answers — only then do local
// writes also PUT (an anonymous reader's stack never leaves the device).
let stackServerSync = false

export function resetStackSyncForTests(): void {
  stackServerSync = false
}

// Fire-and-forget PUT of the full map. Local state is already right; a lost write (offline,
// rate limit) is repaired by the next sync's merge.
function pushStack(stack: StackMap): void {
  void fetch(STACK_API, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stack }),
  }).catch(() => {})
}

// One-shot account sync, called by lib/session.ts when /auth/me answers 'authenticated' — the
// exact syncWatchlistFromServer flow: GET the account stack, merge with local (account wins
// per-arena, see mergeStackMaps), write the result both ways as needed, switch writeStack into
// push-through mode. Any non-200 or thrown fetch leaves everything device-local, silently.
export async function syncStackFromServer(): Promise<void> {
  let server: StackMap
  try {
    const res = await fetch(STACK_API, { credentials: 'include' })
    if (!res.ok) return
    const payload: unknown = await res.json()
    const stack = (payload as { stack?: unknown } | null)?.stack
    if (typeof stack !== 'object' || stack === null || Array.isArray(stack)) return
    server = parseStackMap(JSON.stringify(stack))
  } catch {
    return
  }
  stackServerSync = true
  const local = parseStackMap(readStackRaw())
  const merged = mergeStackMaps(server, local)
  if (serializeStackMap(merged) !== serializeStackMap(local)) {
    writeStack(merged) // updates the UI everywhere and (stackServerSync) pushes the merge up
  } else if (serializeStackMap(merged) !== serializeStackMap(server)) {
    pushStack(merged) // local already complete but the account is missing picks — upload
  }
}

export function subscribeStack(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  window.addEventListener(STACK_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(STACK_EVENT, callback)
  }
}

// ---------------------------------------------------------------------------
// Upgraded stack advice — every number the arena leaderboard's published score
// ---------------------------------------------------------------------------

// How many same-arena products ranked above a pick to surface as upgrade candidates.
export const STACK_UPGRADE_CANDIDATES = 2

export interface StackUpgradeCandidate {
  product: MyStackProduct
  /** Overall score gap over the pick (candidate − pick), one decimal. Null when either side is unscored. */
  overallDelta: number | null
  agentReadyDelta: number | null
}

export interface StackPickAdvice {
  arenaId: string
  arenaName: string
  /** The BEST of the reader's picks in this arena (highest Overall score; unscored last) — upgrade
   *  advice compares THIS pick vs the leader; the others are coPicks. */
  pick: MyStackProduct
  /** The reader's OTHER picks in this arena, stack order preserved. 1+ entries means a
   *  deliberate multi-vendor setup ("you run N vendors here") — a signal, not an error. */
  coPicks: MyStackProduct[]
  /** Every pick in this arena whose vendor announced a shutdown (best pick included) — each
   *  needs MIGRATE advice regardless of any score gap. */
  shutdownPicks: MyStackProduct[]
  /** The arena's Overall-score leader (rank 1 among scored rows) — the pick itself when it leads. */
  leader: MyStackProduct
  /** Leader − pick on each score, one decimal; null when either side is unscored. */
  overallDelta: number | null
  agentReadyDelta: number | null
  /** Up to STACK_UPGRADE_CANDIDATES products scoring strictly above the pick, best first —
   *  never another of the reader's own picks (running it already isn't an upgrade). */
  upgrades: StackUpgradeCandidate[]
}

export interface StackAdvice {
  picks: StackPickAdvice[]
  /** Mean Overall score of the scored picks — the honest "stack score". Null with no scored pick. */
  stackScore: number | null
  /** Mean Overall score of those same arenas' leaders — "best possible" with the same coverage. */
  bestPossible: number | null
}

const round1Adv = (n: number) => Math.round(n * 10) / 10

const delta = (a: number | null, b: number | null): number | null =>
  a === null || b === null ? null : round1Adv(a - b)

// Resolve the account stack against the catalog and compare each arena's picks with its
// leaderboard. Invalid entries (unknown arena, product not judged in that arena) are dropped
// silently — the store only ever holds judged picks, but a stale device may lag the catalog.
// Advice order follows the catalog's arena order (the site's canonical ordering). With multiple
// picks in one arena, the picks are a SET: upgrade advice compares the BEST pick vs the leader
// (2+ picks = deliberate multi-vendor — reported neutrally via coPicks, never as an error),
// and every shutdown pick surfaces in shutdownPicks for migrate-first advice.
export function stackAdvice(stack: StackMap, products: MyStackProduct[]): StackAdvice {
  const byArena = new Map<string, MyStackProduct[]>()
  for (const p of products) {
    const list = byArena.get(p.arenaId) ?? []
    list.push(p)
    byArena.set(p.arenaId, list)
  }

  const picks: StackPickAdvice[] = []
  for (const [arenaId, field] of byArena) {
    const pickIds = stackPicks(stack, arenaId)
    if (pickIds.length === 0) continue
    const resolved = pickIds.flatMap((id) => {
      const p = field.find((row) => row.id === id)
      return p ? [p] : [] // not judged in this arena (stale pick) — nothing honest to say
    })
    if (resolved.length === 0) continue
    // Best pick: highest Overall score (unscored sort last), rank breaking ties — the one the
    // upgrade math runs against; the rest are coPicks in stack order.
    const pick = [...resolved].sort(
      (a, b) => (b.aiEra ?? -1) - (a.aiEra ?? -1) || a.rank - b.rank,
    )[0]
    const coPicks = resolved.filter((p) => p.id !== pick.id)
    const pickIdSet = new Set(resolved.map((p) => p.id))
    // Leader and upgrade candidates are OFFERS — shutdown products never appear
    // (lib/shutdown.ts); a shutdown PICK still resolves, and the UI surfaces its
    // "shutting down — migrate" line off shutdownPicks.
    const scored = field.filter((p) => p.aiEra !== null && !isShutdown(p)).sort((a, b) => a.rank - b.rank)
    const leader = scored[0] ?? pick
    const upgrades: StackUpgradeCandidate[] =
      pick.aiEra === null
        ? []
        : scored
            .filter((p) => !pickIdSet.has(p.id) && (p.aiEra as number) > (pick.aiEra as number))
            .sort((a, b) => (b.aiEra as number) - (a.aiEra as number) || a.rank - b.rank)
            .slice(0, STACK_UPGRADE_CANDIDATES)
            .map((product) => ({
              product,
              overallDelta: delta(product.aiEra, pick.aiEra),
              agentReadyDelta: delta(product.agentReady, pick.agentReady),
            }))
    picks.push({
      arenaId,
      arenaName: pick.arenaName,
      pick,
      coPicks,
      shutdownPicks: resolved.filter((p) => isShutdown(p)),
      leader,
      overallDelta: delta(leader.aiEra, pick.aiEra),
      agentReadyDelta: delta(leader.agentReady, pick.agentReady),
      upgrades,
    })
  }

  const scoredPicks = picks.filter((p) => p.pick.aiEra !== null)
  const mean = (values: number[]) =>
    values.length === 0 ? null : round1Adv(values.reduce((a, b) => a + b, 0) / values.length)
  return {
    picks,
    stackScore: mean(scoredPicks.map((p) => p.pick.aiEra as number)),
    bestPossible: mean(scoredPicks.map((p) => p.leader.aiEra ?? (p.pick.aiEra as number))),
  }
}

// Seed the account stack from the free-form tool's device-local list (the "prefilled from any
// existing device-local state" contract): each list id resolves to its canonical arena row and
// joins that arena's pick list in list order (first = primary), capped per arena.
export function stackMapFromList(ids: string[], products: MyStackProduct[]): StackMap {
  const out: StackMap = {}
  for (const pick of resolvePicks(ids, products)) {
    const picks = out[pick.arenaId] ?? []
    if (picks.includes(pick.id) || picks.length >= MAX_PICKS_PER_ARENA) continue
    out[pick.arenaId] = [...picks, pick.id]
  }
  return out
}
