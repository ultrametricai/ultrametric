// Confidence layer over the published scores — scoring v2's honesty pass. The Overall score and
// coverage score are UNTOUCHED (lib/scoring.ts is never imported here); this is a derived,
// display-only read of how much of a product's verdict matrix actually rests on evidence, and
// how much of that evidence is *tested* (probe/github tiers — see lib/verification.ts's
// EVIDENCE_LADDER) rather than merely claimed by the vendor. Pure and `node:fs`-free (same
// contract as lib/data-helpers.ts) so client components (ArenaTable) can import it directly.
import { evidenceById, verdictFor, type CategoryData } from './data-helpers'
import { strongestEvidence } from './verification'
import type { Evidence, Story, Verdict } from './schemas'

export type ConfidenceGrade = 'A' | 'B' | 'C' | 'D'

export interface ProductConfidence {
  // Fraction of applicable (non-na) cells whose verdict cites ANY evidence at all. The
  // complement is the "we found nothing either way" share — cells that already score 0 but
  // whose real status is unknown, not failed.
  coverage: number
  // Fraction of applicable cells whose STRONGEST cited evidence is tested (probe or github) —
  // hands-on probes and inspectable source, as opposed to vendor docs or community commentary.
  testedShare: number
  // How many applicable cells the two fractions are over (0 ⇒ both fractions are 0, grade D).
  applicable: number
  grade: ConfidenceGrade
}

// Grade thresholds, calibrated against the live dataset (139 products: coverage p50 ≈ 0.77,
// testedShare p50 ≈ 0.29) so the letters discriminate rather than clump:
//   A — nearly every applicable cell is evidenced and a large share is tested.
//   B — solidly evidenced, meaningful tested share.
//   C — majority evidenced but leaning on claimed/community evidence.
//   D — a substantial share of the score rests on nothing at all.
export const CONFIDENCE_THRESHOLDS = {
  A: { coverage: 0.85, testedShare: 0.4 },
  B: { coverage: 0.7, testedShare: 0.25 },
  C: { coverage: 0.55 },
} as const

export function confidenceGrade(coverage: number, testedShare: number): ConfidenceGrade {
  if (coverage >= CONFIDENCE_THRESHOLDS.A.coverage && testedShare >= CONFIDENCE_THRESHOLDS.A.testedShare) return 'A'
  if (coverage >= CONFIDENCE_THRESHOLDS.B.coverage && testedShare >= CONFIDENCE_THRESHOLDS.B.testedShare) return 'B'
  if (coverage >= CONFIDENCE_THRESHOLDS.C.coverage) return 'C'
  return 'D'
}

// True when a verdict's strongest cited evidence is a tested tier (probe or github).
function isTested(verdict: Verdict, evidence: Map<string, Evidence>): boolean {
  const strongest = strongestEvidence(verdict, evidence)
  return strongest !== null && (strongest.tier === 'probe' || strongest.tier === 'github')
}

// Core computation, decoupled from CategoryData so tests (and future callers with pre-joined
// cells) don't need a full fixture. `stories` is only used to enumerate the cells.
export function computeConfidence(
  cells: Array<{ verdict: Verdict; story: Story }>,
  evidence: Map<string, Evidence>,
): ProductConfidence {
  const applicable = cells.filter((c) => c.verdict.verdict !== 'na')
  if (applicable.length === 0) {
    return { coverage: 0, testedShare: 0, applicable: 0, grade: 'D' }
  }
  const evidenced = applicable.filter((c) => c.verdict.evidenceIds.length > 0).length
  const tested = applicable.filter((c) => isTested(c.verdict, evidence)).length
  const coverage = evidenced / applicable.length
  const testedShare = tested / applicable.length
  return { coverage, testedShare, applicable: applicable.length, grade: confidenceGrade(coverage, testedShare) }
}

export function confidenceFor(data: CategoryData, productId: string): ProductConfidence {
  const evidence = evidenceById(data)
  const cells = data.stories.map((s) => ({ verdict: verdictFor(data, productId, s.id), story: s }))
  return computeConfidence(cells, evidence)
}

// Shared tooltip copy for the grade chip (MegaTable + ArenaTable render the same chip).
// One sentence (founder tooltip sweep 2026-10-02) — keeps the load-bearing evidence-footing
// facts (coverage + tested share + "score unchanged"); the full explainer lives at the link's
// /methodology#confidence destination.
export function confidenceTitle(c: ProductConfidence): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`
  return (
    `Confidence ${c.grade} — ${pct(c.coverage)} of ${c.applicable} applicable cells cite evidence, ` +
    `${pct(c.testedShare)} tested by us; the published score is unchanged.`
  )
}
