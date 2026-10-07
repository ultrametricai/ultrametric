// Corpus lift stage 2 (docs/FOUNDER-OPS.md): emit the evidence layer in the founder-ops
// vendor-review interchange shape (schemas/vendor-review.schema.json) — one
// vendors/reviews/generated/<arena>--<productId>.json per judged product, so external consumers
// get the same dated, evidence-graded record the site renders without scraping it.
//
// DERIVED, NEVER JUDGED HERE: every field is a deterministic projection of committed data —
// rankings.json (tested_on = the arena's generatedAt date; the dimension scores), the evidence
// packs (up to 5 cited URIs with observed_on dates, strongest tiers first), lib/pricing.ts's
// committed facts (the same deterministic headline pick the leaderboard column uses),
// jurisdictions/vendor-geo.json (region availability as `CC:status` rows, honest negatives
// included), and products.json (affiliation disclosures — owner products ALWAYS carry theirs;
// shutdown notices become limitations). No Date.now in content, no LLM, no network: recompute
// is byte-identical until the inputs change, and the drift test
// (pipeline/__tests__/vendorReviews.test.ts) enforces exactly that.
//
// Usage: tsx pipeline/scripts/generate-vendor-reviews.ts
import fs from 'node:fs'
import path from 'node:path'
import { confidenceFor } from '../../lib/confidence'
import { loadAll } from '../../lib/data'
import type { CategoryData } from '../../lib/data-helpers'
import {
  isPricingUnavailable, loadPricing, PRICING_ARENAS, type PricingFact,
} from '../../lib/pricing'
import type { Evidence } from '../../lib/schemas'
import { VENDOR_GEO_COUNTRY_META, vendorGeoFor, type VendorGeoEntry } from '../../lib/vendorGeo'

const ROOT = path.resolve(__dirname, '..', '..')
export const REVIEWS_DIR = path.join(ROOT, 'vendors', 'reviews', 'generated')

export const REVIEWER = 'Ultrametric pipeline (automated, evidence-graded)'

// Evidence tier preference for the review's citations: hands-on probes and inspectable source
// first (lib/verification.ts's ladder), then vendor docs, then community — within a tier the
// stable evidence-pack id order. Capped at 5 entries per review.
const TIER_ORDER = ['probe', 'github', 'claimed-docs', 'community'] as const
const MAX_EVIDENCE = 5

// tested_on + 90 days — the interchange format's recheck cadence. Pure date arithmetic on the
// committed generatedAt instant (no clock reads), so regeneration stays byte-identical.
export function recheckDue(generatedAt: string): string {
  const due = new Date(new Date(generatedAt).getTime() + 90 * 24 * 60 * 60 * 1000)
  return due.toISOString().slice(0, 10)
}

function pickEvidence(pack: Evidence[]): Array<{ kind: string; uri: string; observed_on: string }> {
  const rank = (e: Evidence) => (TIER_ORDER as readonly string[]).indexOf(e.tier)
  return [...pack]
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
    .slice(0, MAX_EVIDENCE)
    .map((e) => ({ kind: e.tier, uri: e.url, observed_on: e.fetchedAt.slice(0, 10) }))
}

// The same deterministic headline pick lib/pricing.ts's pricingCellFor makes — cheapest usage
// fact in the arena's primary unit, else cheapest usage fact, else cheapest entry plan, else the
// free-tier note — but returning the underlying fact so the review can cite its date + source.
function pickPricingFact(facts: PricingFact[], arenaId: string): PricingFact | null {
  const primary = PRICING_ARENAS[arenaId]?.primary
  const cost = (f: PricingFact) => f.amountUsd + (f.percent ?? 0)
  const byCost = (a: PricingFact, b: PricingFact) => cost(a) - cost(b)
  const usage = facts.filter((f) => f.tier === 'usage').sort(byCost)
  return (
    usage.find((f) => f.unit === primary) ??
    usage[0] ??
    facts.filter((f) => f.tier === 'entry-paid').sort(byCost)[0] ??
    facts.find((f) => f.tier === 'free') ??
    null
  )
}

// The schema's pricing object requires amount/currency/observed_on/source and permits extra
// keys; `unit` and `percent` ride along so a percent-fee fact ("2.9% + $0.30", or a pure-rate
// "0.8% per transaction" whose printed amount is $0) is never flattened into a misleading bare
// amount — the same never-derive-a-figure honesty rule lib/pricing.ts lives by.
const NULL_PRICING = { amount: null, currency: null, observed_on: null, source: null, unit: null }

interface VendorReview {
  id: string
  vendor: string
  category: string
  status: 'tested'
  jurisdictions: string[]
  tested_use_case: string
  tested_on: string
  reviewer: string
  affiliations: string[]
  evidence: Array<{ kind: string; uri: string; observed_on: string }>
  pricing: {
    amount: number | null
    currency: string | null
    observed_on: string | null
    source: string | null
    unit: string | null
    percent?: number
  }
  dimensions: { aiEra: number | null; agentReady: number | null; agentic: number | null; coverageGrade: string }
  limitations: string[]
  recheck_due: string
}

function reviewFor(data: CategoryData, productId: string, geo: VendorGeoEntry[], dir: string): VendorReview {
  const product = data.products.find((p) => p.id === productId)!
  const entry = data.rankings.leaderboard.find((e) => e.productId === productId)!
  const themes = new Set(data.stories.map((s) => s.theme))

  // Honest ceilings the arena/product records: a vendor-announced shutdown, arena-level
  // not-applicable dimensions, and the geo spike's judged negatives/partials (the vendor's OWN
  // pages saying where it does not work), in canonical country order.
  const limitations: string[] = []
  if (product.shutdown) limitations.push(`Vendor-announced shutdown: ${product.shutdown}`)
  if (data.category.naDimensions?.length) {
    limitations.push(
      `Arena marks ${data.category.naDimensions.join(', ')} not applicable for this product class.`,
    )
  }
  for (const row of geo) {
    if (row.status === 'available') continue
    const country = VENDOR_GEO_COUNTRY_META[row.country].label
    limitations.push(`${country} (${row.status}): ${row.note}`)
  }

  const pricingMap = loadPricing(data.category.id, dir)
  const pricingEntry = pricingMap[productId]
  const fact = pricingEntry && !isPricingUnavailable(pricingEntry)
    ? pickPricingFact(pricingEntry.facts, data.category.id)
    : null
  const pricing = fact
    ? {
        amount: fact.amountUsd,
        currency: 'USD',
        observed_on: fact.fetchedAt.slice(0, 10),
        source: fact.sourceUrl,
        unit: fact.unit,
        ...(fact.percent !== undefined ? { percent: fact.percent } : {}),
      }
    : NULL_PRICING

  return {
    id: `${data.category.id}--${productId}`,
    vendor: product.name,
    category: data.category.id,
    status: 'tested',
    jurisdictions: geo.map((row) => `${row.country}:${row.status}`),
    tested_use_case:
      `${data.category.name} — ${data.category.description} ` +
      `Judged against the ranking's evidence-graded story taxonomy: ` +
      `${data.stories.length} user stories across ${themes.size} themes.`,
    tested_on: data.rankings.generatedAt.slice(0, 10),
    reviewer: REVIEWER,
    // The committed disclosure travels with the record verbatim: owner products (Foreloop, AFK —
    // the Ultrametric self-entries) always carry theirs; the few non-owner disclosures on file
    // (the Anthropic judge-bias notes, Cloudflare's registrar scoping) are disclosures too and
    // are carried rather than blanked. Products with no recorded affiliation get [].
    affiliations: product.affiliation ? [product.affiliation] : [],
    evidence: pickEvidence(data.evidence[productId] ?? []),
    pricing,
    dimensions: {
      aiEra: entry.aiEra,
      agentReady: entry.agentReady,
      agentic: entry.agenticApp,
      coverageGrade: confidenceFor(data, productId).grade,
    },
    limitations,
    recheck_due: recheckDue(data.rankings.generatedAt),
  }
}

// filename -> file content for EVERY judged product (every leaderboard entry of every populated
// arena), in categories.json × leaderboard order. Pure projection of the committed data under
// `dir` — see the header.
export function buildVendorReviews(dir: string = path.join(ROOT, 'data')): Map<string, string> {
  const out = new Map<string, string>()
  for (const data of loadAll(dir)) {
    for (const entry of data.rankings.leaderboard) {
      const geo = vendorGeoFor(entry.productId, dir)
      const review = reviewFor(data, entry.productId, geo, dir)
      out.set(`${review.id}.json`, `${JSON.stringify(review, null, 2)}\n`)
    }
  }
  return out
}

function main(): void {
  const reviews = buildVendorReviews()
  fs.rmSync(REVIEWS_DIR, { recursive: true, force: true })
  fs.mkdirSync(REVIEWS_DIR, { recursive: true })
  for (const [file, content] of reviews) fs.writeFileSync(path.join(REVIEWS_DIR, file), content)
  console.log(`wrote ${reviews.size} vendor reviews to ${path.relative(ROOT, REVIEWS_DIR)}`)
}

if (require.main === module) main()
