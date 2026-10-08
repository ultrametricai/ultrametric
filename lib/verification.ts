import { evidenceById, verdictFor, type CategoryData } from './data-helpers'
import type { Evidence, Verdict } from './schemas'

export type VerificationLevel = 'unverified' | 'vendor-claim' | 'corroborated' | 'tested' | 'disputed'

// Derived, non-LLM signal for how a verdict was substantiated: purely a function of the
// verdict's own tier plus the tiers of the evidence it cites. Never changes verdicts/scores —
// it's a read of the same data the judge already produced.
export function verificationLevel(verdict: Verdict, evidence: Map<string, Evidence>): VerificationLevel {
  if (verdict.verdict === 'disputed') return 'disputed'
  if (verdict.verdict === 'na' || verdict.verdict === 'none' || verdict.evidenceIds.length === 0) {
    return 'unverified'
  }

  const tiers = verdict.evidenceIds.map((id) => evidence.get(id)?.tier)
  if (tiers.includes('probe')) return 'tested'
  if (tiers.includes('community')) return 'corroborated'
  return 'vendor-claim'
}

// Evidence-strength ladder, strongest first: a direct hands-on probe outranks a github
// README, which outranks independent community commentary, which outranks the vendor's own
// claimed docs. Used to pick the single best "proof ↗" link for a verdict (product-page
// story rows, StoryMatrix cells, and BattleView cards) — distinct from verificationLevel's
// coarser tiering (which lumps github in with claimed-docs).
const EVIDENCE_LADDER: Array<Evidence['tier']> = ['probe', 'github', 'community', 'claimed-docs']

// Highest-tier cited evidence for a verdict, or null if the verdict cites nothing resolvable.
// Within a tier, the first citation (in the verdict's own evidenceIds order) wins.
export function strongestEvidence(verdict: Verdict, evidence: Map<string, Evidence>): Evidence | null {
  const cited = verdict.evidenceIds
    .map((id) => evidence.get(id))
    .filter((e): e is Evidence => e !== undefined)
  for (const tier of EVIDENCE_LADDER) {
    const match = cited.find((e) => e.tier === tier)
    if (match) return match
  }
  return null
}

// --- Auth-gated probes -------------------------------------------------------------------
// Some of our strongest probe evidence is an auth WALL, not a session: the runtime probe
// reached the vendor's live endpoint and got an explicit 401/403 sign-in challenge (OAuth /
// WWW-Authenticate / API-key demand). That is proof of life — "verified reachable, auth-gated,
// untestable keylessly" — and must never read like absence. Evidence records are prose
// (lib/schemas.ts has no httpStatus field), so detection matches the probe excerpts'
// established wording (e.g. "returned HTTP 401 with an OAuth challenge", "HTTP 401 with a
// `WWW-Authenticate: Bearer` OAuth challenge", "HTTP 401 with a JSON auth challenge").
// Display-only, exactly like verificationLevel: never changes a verdict or score — a partial
// substantiated by auth-gated evidence stays partial.
const AUTH_WALL_STATUS_RE = /\b40[13]\b/
const AUTH_WALL_CONTEXT_RE = /oauth|www-authenticate|unauthorized|auth(?:orization|entication)? (?:required|challenge)|auth challenge|api key|bearer|sign[- ]?in/i

export function isAuthGatedEvidence(e: Evidence): boolean {
  return e.tier === 'probe' && AUTH_WALL_STATUS_RE.test(e.excerpt) && AUTH_WALL_CONTEXT_RE.test(e.excerpt)
}

// True when this verdict cites at least one auth-wall probe — the story-cell marker.
export function cellAuthGated(verdict: Verdict, evidence: Map<string, Evidence>): boolean {
  return verdict.evidenceIds.some((id) => {
    const e = evidence.get(id)
    return e !== undefined && isAuthGatedEvidence(e)
  })
}

export type VerificationMix = Record<Exclude<VerificationLevel, 'unverified'>, number>

// Counts, across every story in a category, how many of a product's verdicts land at each
// verified level (claimed/corroborated/tested/disputed) — `unverified` cells (na/none/uncited)
// are intentionally excluded from the mix since there's nothing to summarize about them. Feeds
// the ArenaTable's "verification mix" mini-chip: a glance at how much of a product's coverage
// is vendor-claim vs independently corroborated/tested vs actively disputed.
export function verificationMix(data: CategoryData, productId: string): VerificationMix {
  const evidence = evidenceById(data)
  const mix: VerificationMix = { 'vendor-claim': 0, corroborated: 0, tested: 0, disputed: 0 }
  for (const story of data.stories) {
    const verdict = verdictFor(data, productId, story.id)
    const level = verificationLevel(verdict, evidence)
    if (level === 'unverified') continue
    mix[level] += 1
  }
  return mix
}
