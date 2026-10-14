// Surgical, auditable revert of judge re-roll churn introduced by the probe-wave re-judge
// (commit ed4879d, prior state 115318e). See .superpowers/probe1-fix-report.md for the ruling.
//
// Applies four revert rules (R1-R4) documented below, writes the resulting verdicts.json
// per category, patches the matching judge cache files in place (same hash, reverted verdict
// object) so a future `pnpm pipeline judge` run doesn't resurrect the churn, and prints a full
// audit trail of every reverted cell.
//
// Usage: pnpm exec tsx pipeline/scripts/revert-churn.ts [--write]
//   (no --write: dry run, prints the plan only; --write: applies changes to disk)

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const OLD_REF = '115318e'
const WRITE = process.argv.includes('--write')

type VerdictRow = {
  productId: string
  storyId: string
  verdict: 'full' | 'partial' | 'none' | 'disputed' | 'na'
  quality: number
  confidence: 'high' | 'medium' | 'low'
  rationale: string
  evidenceIds: string[]
}

type EvidenceItem = { id: string; tier: string }

type Revert = {
  category: string
  productId: string
  storyId: string
  rule: 'R1' | 'R2' | 'R3' | 'R4'
  oldVerdict: VerdictRow
  newVerdict: VerdictRow
}

const CATEGORIES = [
  'ai-coding',
  'code-hosting',
  'desktop-os',
  'mobile-dev',
  'project-management',
  'startup-banking',
  'web-scraping',
]

function readCurrentVerdicts(cat: string): VerdictRow[] {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', cat, 'verdicts.json'), 'utf8'))
}

function readOldVerdicts(cat: string): VerdictRow[] {
  const raw = execSync(`git show ${OLD_REF}:data/${cat}/verdicts.json`, { cwd: ROOT, maxBuffer: 1024 * 1024 * 64 })
  return JSON.parse(raw.toString('utf8'))
}

function evidenceTierMap(cat: string, product: string): Map<string, string> {
  const file = path.join(ROOT, 'open-rankings', cat, 'evidence', `${product}.json`)
  if (!fs.existsSync(file)) return new Map()
  const items: EvidenceItem[] = JSON.parse(fs.readFileSync(file, 'utf8'))
  return new Map(items.map((i) => [i.id, i.tier]))
}

function setEq(a: string[], b: string[]): boolean {
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size !== sb.size) return false
  for (const x of sa) if (!sb.has(x)) return false
  return true
}

function key(productId: string, storyId: string): string {
  return `${productId}:${storyId}`
}

async function main() {
  const reverts: Revert[] = []
  const finalByCat = new Map<string, VerdictRow[]>()

  // Load old + new for every category up front.
  const oldByCat = new Map<string, Map<string, VerdictRow>>()
  const newByCat = new Map<string, Map<string, VerdictRow>>()
  const orderByCat = new Map<string, string[]>()

  for (const cat of CATEGORIES) {
    const oldRows = readOldVerdicts(cat)
    const newRows = readCurrentVerdicts(cat)
    const oldMap = new Map(oldRows.map((r) => [key(r.productId, r.storyId), r]))
    const newMap = new Map(newRows.map((r) => [key(r.productId, r.storyId), r]))
    oldByCat.set(cat, oldMap)
    newByCat.set(cat, newMap)
    orderByCat.set(
      cat,
      newRows.map((r) => key(r.productId, r.storyId)),
    )
    // Start from the current (new) state; we'll overwrite reverted cells below.
    finalByCat.set(cat, newRows.map((r) => ({ ...r })))
  }

  // handled[cat] = set of cell keys already reverted, to avoid double-processing.
  const handled = new Map<string, Set<string>>()
  for (const cat of CATEGORIES) handled.set(cat, new Set())

  function applyRevert(cat: string, k: string, rule: Revert['rule'], oldRow: VerdictRow, newRow: VerdictRow, overrideVerdict?: VerdictRow) {
    const order = orderByCat.get(cat)!
    const idx = order.indexOf(k)
    const final = finalByCat.get(cat)!
    final[idx] = overrideVerdict ?? { ...oldRow }
    handled.get(cat)!.add(k)
    reverts.push({ category: cat, productId: oldRow.productId, storyId: oldRow.storyId, rule, oldVerdict: oldRow, newVerdict: newRow })
  }

  // --- R1: na<->none applicability churn, across ALL categories ---
  for (const cat of CATEGORIES) {
    const oldMap = oldByCat.get(cat)!
    const newMap = newByCat.get(cat)!
    for (const [k, oldRow] of oldMap) {
      const newRow = newMap.get(k)
      if (!newRow) continue
      const pair = new Set([oldRow.verdict, newRow.verdict])
      const isNaNonePair = oldRow.verdict !== newRow.verdict && pair.size === 2 && pair.has('na') && pair.has('none')
      if (!isNaNonePair) continue
      if (!setEq(oldRow.evidenceIds, newRow.evidenceIds)) continue
      applyRevert(cat, k, 'R1', oldRow, newRow)
    }
  }

  // --- R3: named off-axis / no-new-evidence cells (exact revert to old) ---
  const R3_CELLS: Array<{ cat: string; productId: string; storyId: string }> = [
    { cat: 'web-scraping', productId: 'browserbase', storyId: 'single-call-html-extraction' },
    { cat: 'mobile-dev', productId: 'working-copy', storyId: 'agentic-nl-commands' },
    { cat: 'mobile-dev', productId: 'tailscale', storyId: 'mesh-vpn-access' },
  ]
  for (const { cat, productId, storyId } of R3_CELLS) {
    const k = key(productId, storyId)
    const oldRow = oldByCat.get(cat)!.get(k)
    const newRow = newByCat.get(cat)!.get(k)
    if (!oldRow || !newRow) throw new Error(`R3: missing cell ${cat}/${k}`)
    if (handled.get(cat)!.has(k)) throw new Error(`R3: cell ${cat}/${k} already handled by another rule — investigate`)
    applyRevert(cat, k, 'R3', oldRow, newRow)
  }

  // --- R4: openapi consistency on web-scraping agentic-public-api ---
  const R4_NOTE = ' (Note: no machine-readable OpenAPI spec was found by automated probing; the documented API itself is verified.)'
  const R4_CELLS = ['scrapingbee', 'crawl4ai']
  for (const productId of R4_CELLS) {
    const cat = 'web-scraping'
    const k = key(productId, 'agentic-public-api')
    const oldRow = oldByCat.get(cat)!.get(k)
    const newRow = newByCat.get(cat)!.get(k)
    if (!oldRow || !newRow) throw new Error(`R4: missing cell ${cat}/${k}`)
    if (handled.get(cat)!.has(k)) throw new Error(`R4: cell ${cat}/${k} already handled by another rule — investigate`)
    const restored: VerdictRow = { ...oldRow, rationale: oldRow.rationale + R4_NOTE }
    applyRevert(cat, k, 'R4', oldRow, newRow, restored)
  }

  // --- R2: web-scraping non-probe churn (verdict or quality changed, new evidence cites no probe ids) ---
  {
    const cat = 'web-scraping'
    const oldMap = oldByCat.get(cat)!
    const newMap = newByCat.get(cat)!
    const tierCache = new Map<string, Map<string, string>>()
    for (const [k, oldRow] of oldMap) {
      if (handled.get(cat)!.has(k)) continue // R1/R3/R4 already claimed this cell
      const newRow = newMap.get(k)
      if (!newRow) continue
      const changed = oldRow.verdict !== newRow.verdict || oldRow.quality !== newRow.quality
      if (!changed) continue
      if (!tierCache.has(newRow.productId)) tierCache.set(newRow.productId, evidenceTierMap(cat, newRow.productId))
      const tiers = tierCache.get(newRow.productId)!
      const hasProbeEvidence = newRow.evidenceIds.some((id) => tiers.get(id) === 'probe')
      if (hasProbeEvidence) continue
      applyRevert(cat, k, 'R2', oldRow, newRow)
    }
  }

  // --- Report ---
  const byRule: Record<string, Revert[]> = { R1: [], R2: [], R3: [], R4: [] }
  for (const r of reverts) byRule[r.rule].push(r)

  console.log(`\n=== Revert plan (${WRITE ? 'WRITE' : 'DRY RUN'}) ===\n`)
  for (const rule of ['R1', 'R2', 'R3', 'R4'] as const) {
    console.log(`${rule}: ${byRule[rule].length} cell(s)`)
    for (const r of byRule[rule]) {
      console.log(
        `  ${r.category}/${r.productId}:${r.storyId}  old=${r.oldVerdict.verdict}(q${r.oldVerdict.quality}) <- new=${r.newVerdict.verdict}(q${r.newVerdict.quality})`,
      )
    }
  }
  console.log(`\nTotal reverts: ${reverts.length}\n`)

  if (!WRITE) {
    console.log('Dry run only — pass --write to apply.')
    return
  }

  // --- Write verdicts.json per category ---
  for (const cat of CATEGORIES) {
    const rows = finalByCat.get(cat)!
    fs.writeFileSync(path.join(ROOT, 'open-rankings', cat, 'verdicts.json'), JSON.stringify(rows, null, 2) + '\n')
  }

  // --- Patch judge cache files: keep hash, replace verdict object ---
  let patchedCaches = 0
  let missingCaches = 0
  for (const r of reverts) {
    const cacheFile = path.join(ROOT, 'pipeline', 'cache', 'judge', r.category, r.productId, `${r.storyId}.json`)
    if (!fs.existsSync(cacheFile)) {
      console.warn(`WARN: cache file missing, skipping: ${cacheFile}`)
      missingCaches++
      continue
    }
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; verdict: Record<string, unknown> }
    const idx = orderByCat.get(r.category)!.indexOf(key(r.productId, r.storyId))
    const finalRow = finalByCat.get(r.category)![idx]
    cached.verdict = { ...finalRow }
    fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 2) + '\n')
    patchedCaches++
  }
  console.log(`Patched ${patchedCaches} judge cache file(s) (${missingCaches} missing).`)

  // Dump the full revert list as JSON for the report.
  fs.writeFileSync(
    path.join(ROOT, '.superpowers', 'probe1-fix-reverts.json'),
    JSON.stringify(reverts, null, 2) + '\n',
  )
  console.log('Wrote .superpowers/probe1-fix-reverts.json (full audit list).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
