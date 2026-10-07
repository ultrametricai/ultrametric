// Control surfaces (founder 2026-09-23: "add 'Technologies' and cover things like API, CLI, MCP
// as abstract technologies in their pros and cons"): the /technologies page ranks ABSTRACT ways
// of driving software — API, MCP, CLI, webhooks, built-in assistant… — not vendors. The site's
// doctrine is evidence-first, so every number here is AGGREGATED from committed judged data
// (data/*/verdicts.json + rankings.json via loadAll()); nothing is hand-scored. Only the
// pros/cons prose and the story-id curation per surface are editorial, the same contract as
// arena descriptions.
//
// Two tiers, honestly separated:
//   'canonical'  — surfaces mapped to the canonical agent-access lens stories that every arena
//                  carries (see lib/accessGlyphs.ts's ACCESS_COLUMNS for the MCP best-of
//                  precedent), so all 573 products are judged and the ranking is fair.
//   'emerging'   — surfaces (desktop app, mobile app, voice, browser extension) whose judged
//                  stories exist only in a handful of arenas. Their adoption counts are real but
//                  their coverage is thin, so they render below the line and NEVER enter the
//                  ranked list; the readiness-lift stat is suppressed (null) below
//                  LIFT_MIN_ARENAS judged arenas rather than shown on a tiny sample.
//
// Pure and `node:fs`-free (the lib/data-helpers.ts contract): callers pass CategoryData[]
// (usually loadAll()), tests pass fixtures. Determinism: computeControlSurfaces on the same
// input always yields byte-identical output (see lib/__tests__/controlSurfaces.test.ts).
import type { CategoryData } from './data-helpers'
import type { Verdict } from './schemas'

// Same ladder as lib/accessGlyphs.ts's VERDICT_RANK — "ships" means full or partial, mirroring
// /global's adoption semantics (lib/diffusion.ts): we found evidence it works, maybe with caveats.
const VERDICT_RANK: Record<Verdict['verdict'], number> = { full: 3, partial: 2, disputed: 1, none: 0, na: 0 }

// Below this many judged arenas the with/without agent-ready comparison is a small-sample
// anecdote, not a statistic — the lift renders as null (—) instead.
export const LIFT_MIN_ARENAS = 10

export interface SurfaceDef {
  id: string
  name: string
  /** Emoji concept mark, same convention as data/arena-icons.json (mcp/cli/voice reuse the
      matching arena's icon so the same concept always wears the same mark). */
  icon: string
  /** One-line editorial definition of the surface (what kind of control it is). */
  blurb: string
  /** Judged story ids that answer "does this product ship this surface" — best verdict wins
      (the ACCESS_COLUMNS best-of precedent: MCP is server + client). */
  storyIds: string[]
  tier: 'canonical' | 'emerging'
  /** Editorial pros/cons — clearly opinion, displayed alongside the computed fleet stats that
      back them (adoption, lift, breadth are all recomputable numbers, never part of this text). */
  pros: string[]
  cons: string[]
}

// The curated surface list. Canonical ids map 1:1 onto the agent-access lens stories injected
// into every arena (pipeline/agentic-stories.ts); emerging ids are arena-authored stories that
// clearly answer "official <surface> exists" — curation is editorial, verdicts are not.
export const SURFACE_DEFS: SurfaceDef[] = [
  {
    id: 'api',
    icon: '🔌',
    name: 'Public API',
    blurb: 'A documented HTTP API an agent can drive programmatically — the base layer every other machine surface builds on.',
    storyIds: ['agentic-public-api'],
    tier: 'canonical',
    pros: [
      'The most adopted machine surface in the fleet — the closest thing to a universal contract.',
      'Composable: SDKs, MCP servers, and CLIs are almost always wrappers over the same API.',
      'Versionable and testable — the only surface with sandboxes, specs, and deprecation policies as norms.',
    ],
    cons: [
      'Highest integration cost per task: an agent must read docs, mint keys, and hand-roll calls.',
      'API-to-UI parity is routinely incomplete — what the API can reach often lags the product.',
    ],
  },
  {
    id: 'mcp',
    icon: '🧩',
    name: 'MCP',
    blurb: 'A Model Context Protocol server (or client) — the surface purpose-built for agents to discover and call tools.',
    storyIds: ['agentic-mcp-server', 'agentic-mcp-client'],
    tier: 'canonical',
    pros: [
      'Self-describing: tools, schemas, and auth arrive in one handshake — no docs-scraping step.',
      'The strongest agent-readiness signal after the API itself in this fleet’s judged data.',
    ],
    cons: [
      'Young protocol: server quality varies widely and many entries are thin wrappers over few endpoints.',
      'Still absent from about a third of judged products — adoption is broad but far from universal.',
    ],
  },
  {
    id: 'agent-docs',
    icon: '📖',
    name: 'Agent-readable docs',
    blurb: 'llms.txt or agent-oriented docs — the surface an agent reads before it can drive any other surface.',
    storyIds: ['agentic-agent-docs'],
    tier: 'canonical',
    pros: [
      'Cheapest surface to ship and the fleet’s highest count of FULL verdicts — evidence is easy to verify.',
      'Multiplies every other surface: an agent that can read the docs uses the API/CLI far better.',
    ],
    cons: [
      'Read-only — documentation alone gives an agent zero ability to act.',
      'Freshness rot: published llms.txt files drift from the real API faster than SDKs do.',
    ],
  },
  {
    id: 'headless',
    icon: '⚙️',
    name: 'Headless / CI',
    blurb: 'Runs headlessly in scripts and CI — the terminal-automation surface, no window and no human required.',
    storyIds: ['agentic-headless'],
    tier: 'canonical',
    pros: [
      'The second-most adopted surface and one of the largest readiness lifts — headless products are built to be driven.',
      'Zero-UI operation is exactly the agent contract: deterministic invocation, exit codes, logs.',
    ],
    cons: [
      'FULL verdicts are rare relative to adoption — most products run headless only partially, with interactive escape hatches.',
      'No discoverability: an agent must already know the invocation, unlike MCP’s self-description.',
    ],
  },
  {
    id: 'nl-commands',
    icon: '💬',
    name: 'Natural-language commands',
    blurb: 'Operating the product through natural-language commands — the human-language control surface.',
    storyIds: ['agentic-nl-commands'],
    tier: 'canonical',
    pros: [
      'Lowest floor of any surface: no keys, no schema — a sentence is the integration.',
      'Widely adopted across nearly every ranking in the fleet.',
    ],
    cons: [
      'Non-deterministic: the same sentence can do different things, which agents (and audits) hate.',
      'Mostly PARTIAL verdicts — command coverage is usually a subset of what the UI can do.',
    ],
  },
  {
    id: 'sdk',
    icon: '📦',
    name: 'Official SDKs',
    blurb: 'Typed first-party client libraries — the developer-ergonomics surface over the raw API.',
    storyIds: ['agentic-sdks'],
    tier: 'canonical',
    pros: [
      'Types and pagination handled for you — the cheapest correct integration for code-writing agents.',
      'Shipped by roughly two thirds of the fleet, across nearly every arena.',
    ],
    cons: [
      'Language lottery: FULL verdicts are barely half of adoption because coverage is uneven across languages.',
      'Lags the API: new endpoints routinely appear in the API before any SDK exposes them.',
    ],
  },
  {
    id: 'assistant',
    icon: '💡',
    name: 'Built-in assistant',
    blurb: 'A chat assistant embedded in the product — delegation inside the vendor’s own walls.',
    storyIds: ['agentic-builtin-assistant'],
    tier: 'canonical',
    pros: [
      'Zero setup for humans: the assistant already has the product’s context and permissions.',
    ],
    cons: [
      'The one canonical surface with NO agent-readiness lift in this fleet’s data — products bolt on chat without opening machine access.',
      'A walled surface: your own agent usually cannot drive the vendor’s assistant.',
    ],
  },
  {
    id: 'cli',
    icon: '⌨️',
    name: 'CLI',
    blurb: 'An official command-line tool — the terminal surface humans and agents share.',
    storyIds: ['agentic-official-cli'],
    tier: 'canonical',
    pros: [
      'Agents already live in the shell — a documented CLI is immediately drivable with no client code.',
      'High FULL-to-adoption ratio: when a CLI exists, it usually genuinely works.',
    ],
    cons: [
      'Only half the fleet ships one — the thinnest adoption of the big programmatic surfaces.',
      'Output parsing is fragile where there is no --json flag; screen-oriented CLIs resist automation.',
    ],
  },
  {
    id: 'webhooks',
    icon: '🪝',
    name: 'Webhooks',
    blurb: 'Event push over HTTP — the only surface where the product calls the agent instead of being polled.',
    storyIds: ['agentic-webhooks'],
    tier: 'canonical',
    pros: [
      'The reactive half of agency: without events, agents burn tokens polling.',
      'Shippers rank clearly higher on agent-readiness than non-shippers in the judged data.',
    ],
    cons: [
      'The least adopted canonical surface — most of the fleet still makes agents poll.',
      'Operationally demanding: the agent must run a reachable, verified endpoint.',
    ],
  },
  // ---- emerging: judged in only a few arenas; listed below the line, never ranked ----
  {
    id: 'mobile-app',
    icon: '📱',
    name: 'Mobile app',
    blurb: 'A full-featured official iOS/Android app — the human-in-the-pocket surface (approvals, capture, on-call).',
    storyIds: [
      'mobile-apps',
      'mobile-apps-parity',
      'mobile-app-parity',
      'mobile-oncall-app',
      'mobile-task-management',
      'mobile-code-review-with-agent',
      'mobile-approval-of-decisions',
      'mobile-in-person-capture',
    ],
    tier: 'emerging',
    pros: [
      'Where agentic workflows meet humans: mobile approval of agent decisions is already a judged story in this fleet.',
    ],
    cons: [
      'Judged in only a handful of rankings so far — too thin to rank against the canonical surfaces.',
      'Feature parity with desktop is the recurring caveat in the judged evidence.',
    ],
  },
  {
    id: 'desktop-app',
    icon: '🖥️',
    name: 'Desktop app',
    blurb: 'An official desktop app with OS-level shortcuts and access to what is on screen.',
    storyIds: ['desktop-app'],
    tier: 'emerging',
    pros: [
      'OS-level access (screen, shortcuts, local files) that no web surface can reach.',
    ],
    cons: [
      'Judged in only two rankings so far — coverage is far too thin to rank.',
      'Hardest surface for an agent to drive without accessibility APIs or computer use.',
    ],
  },
  {
    id: 'voice',
    icon: '🎙️',
    name: 'Voice',
    blurb: 'Real-time voice conversation or voice-note interaction as a first-class control surface.',
    storyIds: ['voice-interaction', 'voice-conversation'],
    tier: 'emerging',
    pros: [
      'The fastest human input channel — and adoption inside the rankings that judge it is high.',
    ],
    cons: [
      'Judged in only two rankings so far — too thin to rank.',
      'Transcription ambiguity makes voice the least auditable surface for consequential actions.',
    ],
  },
  {
    id: 'browser-extension',
    icon: '🌐',
    name: 'Browser extension',
    blurb: 'An official extension living inside the browser session — autofill-style, in-page control.',
    storyIds: ['browser-extension-autofill'],
    tier: 'emerging',
    pros: [
      'Acts inside the authenticated session where pure APIs cannot reach.',
    ],
    cons: [
      'Judged in a single ranking so far — a data point, too thin to rank.',
      'Bound to one browser profile; invisible to headless agents.',
    ],
  },
]

/** One example shipper for a surface — links to /arena/[category]/product/[id]. */
export interface SurfaceExampleProduct {
  productId: string
  productName: string
  categoryId: string
  categoryName: string
  verdict: Verdict['verdict']
  quality: number
  agentReady: number | null
}

export interface SurfaceRow {
  id: string
  name: string
  icon: string
  blurb: string
  tier: 'canonical' | 'emerging'
  pros: string[]
  cons: string[]
  storyIds: string[]
  /** Products judged on ≥1 of the surface's stories (the denominator). */
  judged: number
  fullCount: number
  partialCount: number
  /** full + partial — the /global adoption semantics. */
  shipped: number
  /** shipped / judged as a % rounded to 1dp; 0 when nothing judged. */
  shipRate: number
  /** full / judged as a % rounded to 1dp — the strict variant. */
  fullRate: number
  arenasJudged: number
  /** Arenas where ≥1 product ships the surface — adoption breadth. */
  arenasWithShipper: number
  /** Mean agentReady of shippers / non-shippers (null when no data or below LIFT_MIN_ARENAS). */
  avgReadyWith: number | null
  avgReadyWithout: number | null
  /** avgReadyWith − avgReadyWithout, the "does shipping this correlate with agent-readiness"
      stat. Correlation, not causation — the page says so. */
  readinessLift: number | null
  /** Top FULL-verdict shippers by verdict quality, then agentReady, then id. */
  topProducts: SurfaceExampleProduct[]
}

export interface ControlSurfacesResult {
  totalArenas: number
  totalProducts: number
  /** Canonical surfaces in the default (Most adopted) order. */
  surfaces: SurfaceRow[]
  /** Emerging surfaces, shipRate order — below the line, unranked. */
  emerging: SurfaceRow[]
}

const round1 = (n: number) => Math.round(n * 10) / 10
const mean1 = (xs: number[]): number | null => (xs.length === 0 ? null : round1(xs.reduce((a, b) => a + b, 0) / xs.length))

/** Strongest verdict across the surface's stories present in this arena; null when the arena
    carries none of them (the product is then simply not judged for this surface). */
export function bestSurfaceVerdict(data: CategoryData, productId: string, storyIds: string[]): Verdict | null {
  let best: Verdict | null = null
  for (const storyId of storyIds) {
    if (!data.stories.some((s) => s.id === storyId)) continue
    const v = data.verdicts.find((x) => x.productId === productId && x.storyId === storyId)
    if (!v) continue
    if (!best || VERDICT_RANK[v.verdict] > VERDICT_RANK[best.verdict]) best = v
  }
  return best
}

const TOP_PRODUCTS = 3

function computeSurface(def: SurfaceDef, categories: CategoryData[]): SurfaceRow {
  let judged = 0
  let fullCount = 0
  let partialCount = 0
  let arenasJudged = 0
  let arenasWithShipper = 0
  const withReady: number[] = []
  const withoutReady: number[] = []
  const shippers: SurfaceExampleProduct[] = []

  for (const data of categories) {
    if (!def.storyIds.some((id) => data.stories.some((s) => s.id === id))) continue
    arenasJudged++
    let anyShipper = false
    const readyByProduct = new Map(data.rankings.leaderboard.map((e) => [e.productId, e.agentReady]))
    for (const p of data.products) {
      const best = bestSurfaceVerdict(data, p.id, def.storyIds)
      if (!best) continue
      judged++
      const ships = best.verdict === 'full' || best.verdict === 'partial'
      if (best.verdict === 'full') fullCount++
      if (best.verdict === 'partial') partialCount++
      const ready = readyByProduct.get(p.id) ?? null
      if (ships) {
        anyShipper = true
        if (ready !== null) withReady.push(ready)
        shippers.push({
          productId: p.id,
          productName: p.name,
          categoryId: data.category.id,
          categoryName: data.category.name,
          verdict: best.verdict,
          quality: best.quality,
          agentReady: ready,
        })
      } else if (ready !== null) {
        withoutReady.push(ready)
      }
    }
    if (anyShipper) arenasWithShipper++
  }

  const shipped = fullCount + partialCount
  // Small-sample honesty: below LIFT_MIN_ARENAS judged arenas the comparison means are noise,
  // so all three comparison stats are suppressed together.
  const enoughForLift = arenasJudged >= LIFT_MIN_ARENAS
  const avgReadyWith = enoughForLift ? mean1(withReady) : null
  const avgReadyWithout = enoughForLift ? mean1(withoutReady) : null
  const readinessLift = avgReadyWith !== null && avgReadyWithout !== null ? round1(avgReadyWith - avgReadyWithout) : null

  const topProducts = shippers
    .sort(
      (a, b) =>
        VERDICT_RANK[b.verdict] - VERDICT_RANK[a.verdict] ||
        b.quality - a.quality ||
        (b.agentReady ?? -1) - (a.agentReady ?? -1) ||
        a.productId.localeCompare(b.productId) ||
        a.categoryId.localeCompare(b.categoryId),
    )
    .slice(0, TOP_PRODUCTS)

  return {
    id: def.id,
    name: def.name,
    icon: def.icon,
    blurb: def.blurb,
    tier: def.tier,
    pros: def.pros,
    cons: def.cons,
    storyIds: def.storyIds,
    judged,
    fullCount,
    partialCount,
    shipped,
    shipRate: judged === 0 ? 0 : round1((shipped / judged) * 100),
    fullRate: judged === 0 ? 0 : round1((fullCount / judged) * 100),
    arenasJudged,
    arenasWithShipper,
    avgReadyWith,
    avgReadyWithout,
    readinessLift,
    topProducts,
  }
}

// The ranking toggles the judged data honestly supports (?rank= on /technologies via
// lib/urlState.ts). Deliberately absent, with reasons the page also states:
//   - "Most mobile" / "Most visual": mobile/desktop/voice surfaces are judged in ≤7 arenas via
//     arena-authored stories, and no judged story measures "visual" at all — a fleet ranking on
//     either would be invented, not derived.
//   - "Fastest growing": data/*/score-history.jsonl tracks scores over time but per-story
//     verdict history is not committed, so surface growth is not recomputable from this repo.
export const SURFACE_RANKS = [
  { id: 'adoption', name: 'Most adopted', title: 'Share of all judged products shipping the surface (full or partial verdict)' },
  { id: 'lift', name: 'Highest agent-readiness lift', title: 'Mean AGENT-READY of shippers minus non-shippers — correlation, not causation' },
  { id: 'breadth', name: 'Broadest ranking coverage', title: 'Number of rankings where at least one product ships the surface' },
  { id: 'strict', name: 'Strictest evidence', title: 'Share of judged products with a FULL verdict only — no partials' },
] as const

export type SurfaceRankId = (typeof SURFACE_RANKS)[number]['id']

export function isSurfaceRankId(x: string | null): x is SurfaceRankId {
  return SURFACE_RANKS.some((r) => r.id === x)
}

/** Pure, stable sort for the toggle pills — nulls last, ties by shipRate then id. */
export function sortSurfaces(rows: SurfaceRow[], rank: SurfaceRankId): SurfaceRow[] {
  const key = (r: SurfaceRow): number | null =>
    rank === 'adoption' ? r.shipRate : rank === 'lift' ? r.readinessLift : rank === 'breadth' ? r.arenasWithShipper : r.fullRate
  return [...rows].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    if (ka === null && kb === null) return b.shipRate - a.shipRate || a.id.localeCompare(b.id)
    if (ka === null) return 1
    if (kb === null) return -1
    return kb - ka || b.shipRate - a.shipRate || a.id.localeCompare(b.id)
  })
}

export function computeControlSurfaces(categories: CategoryData[]): ControlSurfacesResult {
  const rows = SURFACE_DEFS.map((def) => computeSurface(def, categories))
  return {
    totalArenas: categories.length,
    totalProducts: categories.reduce((n, c) => n + c.products.length, 0),
    surfaces: sortSurfaces(rows.filter((r) => r.tier === 'canonical'), 'adoption'),
    emerging: sortSurfaces(rows.filter((r) => r.tier === 'emerging'), 'adoption'),
  }
}
