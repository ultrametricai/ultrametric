// Targeted correction of two over-credited cells from the issue #489/#490 bring-ups (PR #563
// review findings), applying the prompt-v5 judge rule that partial credit requires the
// product's OWN capability for the story (commit 214d5d3489) — related or adjacent features
// earn none:
//
//   - speech-to-text/zoom-scribe:api-machine-spec — the cell earned partial while its own
//     rationale concedes nothing in the pack shows a machine-readable spec covering the Scribe
//     API itself: the citations are the Zoom-wide developer-portal API catalog (an llms.txt
//     probe at the portal root) and prose endpoint listings. A portal-wide catalog is a related
//     surface, not the product's own machine spec.
//   - vector-databases/turbopuffer:openness-self-host — the cell earned partial while its own
//     rationale concedes BYOC/single-tenant deployment is "a glancing approximation of
//     self-hosting, not true self-hosting" and that the product is source-unavailable, so
//     "users cannot run it themselves". Vendor-operated BYOC is a related deployment mode, not
//     self-hosting.
//
// Per the churn policy (policies/REVIEW_POLICY.md): a current-input judgment may lower partial
// credit toward none with no quality increase; this script only downgrades, never upgrades.
// The citations are dropped with the credit — an uncited none remains untested, not a verified
// failure. The judge cache is patched in place (current hash kept, corrected verdict stored)
// so the next judge run does not resurrect the over-credit, the same mechanism as the
// settle-churn waves.
//
// Usage: pnpm exec tsx rankings-engine/scripts/fix-related-feature-credit-2026-11-01.ts [--write]

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')

type VerdictRow = {
  productId: string
  storyId: string
  verdict: string
  quality: number
  confidence: string
  rationale: string
  evidenceIds: string[]
}

const CORRECTIONS: Array<{ cat: string; productId: string; storyId: string; rationale: string }> = [
  {
    cat: 'speech-to-text',
    productId: 'zoom-scribe',
    storyId: 'api-machine-spec',
    rationale:
      'A machine-readable API spec is a fair ask for a developer API, so the axis applies. The pack shows a Zoom-wide developer-portal llms.txt linking a portal-level API catalog, and the Scribe docs list REST endpoints only as prose; nothing evidences a downloadable OpenAPI (or equivalent) spec covering the Scribe API itself. A portal-wide catalog is a related surface, not the product’s own machine spec, so no credit attaches (corrected 2026-11-01 per the prompt-v5 own-capability rule; PR #563 review).',
  },
  {
    cat: 'vector-databases',
    productId: 'turbopuffer',
    storyId: 'openness-self-host',
    rationale:
      'Self-hosting is a fair ask for a database product, so the axis applies. The docs list single-tenant and BYOC deployment alongside the default multi-tenant service, but the evidence describes no install path and a community commenter notes the product is source-unavailable, so users cannot run it themselves. Vendor-operated BYOC is a related deployment mode, not self-hosting, so no credit attaches (corrected 2026-11-01 per the prompt-v5 own-capability rule; PR #563 review).',
  },
]

function main(): void {
  for (const fix of CORRECTIONS) {
    const verdictsPath = path.join(ROOT, 'open-rankings', fix.cat, 'verdicts.json')
    const rows: VerdictRow[] = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'))
    const row = rows.find((r) => r.productId === fix.productId && r.storyId === fix.storyId)
    if (!row) throw new Error(`missing cell ${fix.cat}/${fix.productId}:${fix.storyId}`)
    if (row.verdict === 'none' && row.quality === 0) {
      console.log(`${fix.cat}/${fix.productId}:${fix.storyId} already none/q0 — nothing to do`)
      continue
    }
    if (row.verdict !== 'partial') {
      throw new Error(
        `${fix.cat}/${fix.productId}:${fix.storyId} is ${row.verdict}/q${row.quality}, not the reviewed partial — refusing to apply a stale correction`,
      )
    }
    console.log(`${fix.cat}/${fix.productId}:${fix.storyId}  ${row.verdict}(q${row.quality}) -> none(q0)`)
    if (!WRITE) continue
    row.verdict = 'none'
    row.quality = 0
    row.rationale = fix.rationale
    row.evidenceIds = []
    fs.writeFileSync(verdictsPath, `${JSON.stringify(rows, null, 2)}\n`)
    const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', fix.cat, fix.productId, `${fix.storyId}.json`)
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion: string; verdict: VerdictRow }
    cache.verdict = { ...row }
    fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
  }
  console.log(WRITE ? 'Applied.' : 'Dry run only — pass --write to apply.')
}

main()
