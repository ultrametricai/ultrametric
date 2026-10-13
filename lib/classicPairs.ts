// "Classic interconnects": curated product pairings the industry expects to work together
// (rankings/classic-pairs.json) — Stripe↔QuickBooks, Slack↔Linear, GitHub↔Vercel… The curation
// asserts only the EXPECTATION; whether the pairing is real is computed here against the
// verified integration graph (lib/integrations.ts) and rendered on /integrations as either
// "verified" (an evidence-backed edge exists, with its verbatim quotes) or the honest
// "no evidence found yet" — never asserted without evidence. The unverified half doubles as the
// evidence-coverage to-do list. Zod-validated at load; structural invariants (both ids tracked,
// no dupes, no self-pairs) live in lib/__tests__/classicPairs.test.ts.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { neighborsOf, pairKey, type IntegrationGraph, type IntegrationSource } from './integrations'

export const ClassicPairSchema = z.object({
  a: z.string().min(1),
  b: z.string().min(1),
  // Why people expect this pairing — rendered as the tooltip/subtitle, so it must say something.
  expectation: z.string().min(30),
})

export const ClassicPairsFileSchema = z.object({
  pairs: ClassicPairSchema.array().min(1),
})

export type ClassicPair = z.infer<typeof ClassicPairSchema>

const DEFAULT_FILE = () => path.join(process.cwd(), 'rankings', 'classic-pairs.json')
let cache: { file: string; pairs: ClassicPair[] } | null = null

export function loadClassicPairs(file: string = DEFAULT_FILE()): ClassicPair[] {
  if (cache && cache.file === file) return cache.pairs
  const pairs = ClassicPairsFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).pairs
  cache = { file, pairs }
  return pairs
}

// One classic pair with its live status against the verified graph. `sources` carries the
// evidence-backed mentions when verified (for the quote tooltip), [] otherwise.
export interface ClassicPairStatus extends ClassicPair {
  key: string
  verified: boolean
  sources: IntegrationSource[]
}

// Statuses in file order plus the headline split — the /integrations section renders both.
// Pure over its inputs (tests drive it with a fixture graph).
export function classifyClassicPairs(
  pairs: ClassicPair[],
  graph: IntegrationGraph,
): { statuses: ClassicPairStatus[]; verified: number; unverified: number } {
  const statuses = pairs.map((pair) => {
    const neighbor = neighborsOf(graph, pair.a).find((n) => n.productId === pair.b)
    return {
      ...pair,
      key: pairKey(pair.a, pair.b),
      verified: neighbor !== undefined,
      sources: neighbor?.sources ?? [],
    }
  })
  const verified = statuses.filter((s) => s.verified).length
  return { statuses, verified, unverified: statuses.length - verified }
}
