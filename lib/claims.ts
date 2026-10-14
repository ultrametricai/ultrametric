// Pure helpers reconciling a product's vendor CLAIMS (lib/schemas.ts's ClaimSchema, extracted by
// rankings-engine/stages/claims.ts from claimed-docs/github evidence) against our judge's own VERDICTS
// for the same story. A claim is what the vendor says; a verdict is what we independently found —
// this module is the diff between the two.
import { evidenceById, verdictFor, type CategoryData } from './data-helpers'
import type { Claim } from './schemas'
import { verificationLevel } from './verification'

export type ClaimStatus =
  | 'claimed-verified' // claim maps to this story AND the verdict is full/partial with corroborated/tested verification
  | 'claimed-unverified' // claim maps to this story, verdict is full/partial but only vendor-claim evidence backs it
  | 'claimed-contradicted' // claim maps to this story, but the verdict is disputed/none/na
  | 'delivered-unclaimed' // no claim covers this story, but the verdict is full/partial anyway ("undersold")
  | 'unclaimed-none' // no claim, and nothing delivered either

// Every claim-status bucket, in the order the product page renders them.
export const CLAIM_STATUSES: ClaimStatus[] = [
  'claimed-verified', 'claimed-unverified', 'claimed-contradicted', 'delivered-unclaimed', 'unclaimed-none',
]

// Whether any claim for `productId` maps onto `storyId` — a story can be covered by more than
// one claim (rare but legal), so this only needs to know "covered or not", not by which one.
function isClaimed(claims: Claim[], storyId: string): boolean {
  return claims.some((c) => c.storyIds.includes(storyId))
}

export function claimStatus(data: CategoryData, productId: string, storyId: string): ClaimStatus {
  const claims = data.claims[productId] ?? []
  const verdict = verdictFor(data, productId, storyId)
  const delivering = verdict.verdict === 'full' || verdict.verdict === 'partial'

  if (!isClaimed(claims, storyId)) {
    return delivering ? 'delivered-unclaimed' : 'unclaimed-none'
  }
  if (!delivering) return 'claimed-contradicted'

  const level = verificationLevel(verdict, evidenceById(data))
  return level === 'corroborated' || level === 'tested' ? 'claimed-verified' : 'claimed-unverified'
}

export type ClaimBucketCounts = Record<ClaimStatus, number>

// Counts every story's claimStatus for one product — backs the product page's four-bucket
// summary and the arena scoreboard chip's "{verified}/{claimed} claims verified" figure.
export function claimBucketCounts(data: CategoryData, productId: string): ClaimBucketCounts {
  const counts: ClaimBucketCounts = {
    'claimed-verified': 0, 'claimed-unverified': 0, 'claimed-contradicted': 0,
    'delivered-unclaimed': 0, 'unclaimed-none': 0,
  }
  for (const story of data.stories) {
    counts[claimStatus(data, productId, story.id)] += 1
  }
  return counts
}

// Total claims that map to at least one story, for a product — the denominator half of
// "{verified}/{claimed} claims verified".
export function claimedStoryCount(counts: ClaimBucketCounts): number {
  return counts['claimed-verified'] + counts['claimed-unverified'] + counts['claimed-contradicted']
}

// Claims that don't map onto any story in the current taxonomy — surfaced as "claims outside our
// story set" on the product page: real feedback that the taxonomy is missing an axis, not noise.
export function unmappedClaims(data: CategoryData, productId: string): Claim[] {
  return (data.claims[productId] ?? []).filter((c) => c.storyIds.length === 0)
}

// Percentage of a product's mapped claims (claimed-verified + claimed-unverified +
// claimed-contradicted) that land at claimed-verified. Null when nothing is claimed at all, so
// it never looks like a (misleadingly perfect or zero) score. The ArenaTable scoreboard now
// shows lib/claimsIntegrity.ts's contradiction-penalizing score instead of this raw percentage;
// this stays as the simple "share verified" figure for anyone consuming the data directly.
export function claimsVerifiedPercent(data: CategoryData, productId: string): number | null {
  const counts = claimBucketCounts(data, productId)
  const claimed = claimedStoryCount(counts)
  if (claimed === 0) return null
  return Math.round((counts['claimed-verified'] / claimed) * 100)
}

// One (claim, storyId) pairing rendered in a product page's claim-status bucket list. `claim` is
// null for the delivered-unclaimed bucket — by definition, there's no claim to show, only the
// story that quietly over-delivered.
export interface ClaimEntry {
  claim: Claim | null
  storyId: string
}

// Every (claim, story) pairing whose claimStatus is exactly `status` — backs each expandable
// bucket list on the product page (see components/ClaimsSection.tsx). A claim with multiple
// storyIds can appear more than once here (once per mapped story), which is correct: each
// mapping is independently verified/unverified/contradicted against that specific story's own
// verdict.
export function claimEntriesByStatus(data: CategoryData, productId: string, status: ClaimStatus): ClaimEntry[] {
  if (status === 'delivered-unclaimed' || status === 'unclaimed-none') {
    return data.stories
      .filter((s) => claimStatus(data, productId, s.id) === status)
      .map((s) => ({ claim: null, storyId: s.id }))
  }
  const claims = data.claims[productId] ?? []
  const entries: ClaimEntry[] = []
  for (const c of claims) {
    for (const storyId of c.storyIds) {
      if (claimStatus(data, productId, storyId) === status) entries.push({ claim: c, storyId })
    }
  }
  return entries
}
