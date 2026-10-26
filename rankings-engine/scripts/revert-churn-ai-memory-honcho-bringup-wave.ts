// Surgical, auditable settle of judge re-roll churn from the Honcho bring-up (issue #480):
// rostering honcho forced the first ai-memory pass under judge prompt v5 (commit 214d5d3489
// bumped PROMPT_VERSION after the arena's last judging, so every cached cell missed and the
// six existing products were re-rolled wholesale). Their evidence packs did not change, so per
// the re-judge stability policy (docs/ACCURACY.md "Human review points" §1) and the committed
// refresh-wave precedents, every existing-product flip that cites no changed evidence converges
// back to the committed verdicts. Honcho is the debut product: it has no baseline and every one
// of its cells ships as the engine produced it.
//
// Baseline is the committed state (BASELINE_REF); the re-roll state is the working tree, so the
// script compares current files against the baseline directly. Changed ids are computed the
// content-aware way (added, removed, or same-id-different-excerpt) for audit honesty even
// though this wave changed no existing pack.
//
// Usage: pnpm exec tsx rankings-engine/scripts/revert-churn-ai-memory-honcho-bringup-wave.ts [--write]

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
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

type EvidenceItem = { id: string; excerpt?: string }

const CAT = 'ai-memory'
const BASELINE_REF = '17bd17ce01' // committed main state before the bring-up re-roll

// Cells re-rolled through the live judge after review; their fresh verdicts stand as produced.
// The debut product: no baseline, every cell ships as judged.
const DEBUT = 'honcho'

function gitShowJson<T>(ref: string, file: string): T | null {
  try {
    const raw = execSync(`git show ${ref}:${file}`, { cwd: ROOT, maxBuffer: 1024 * 1024 * 64, stdio: ['ignore', 'pipe', 'ignore'] })
    return JSON.parse(raw.toString('utf8')) as T
  } catch {
    return null
  }
}

// Ids whose evidence actually changed: added, removed, or same-id excerpt replaced, comparing
// the committed baseline against the working tree.
function changedIdsFor(productId: string): Set<string> {
  const file = `open-rankings/${CAT}/evidence/${productId}.json`
  const base = new Map((gitShowJson<EvidenceItem[]>(BASELINE_REF, file) ?? []).map((i) => [i.id, i.excerpt ?? '']))
  const freshItems: EvidenceItem[] = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))
  const fresh = new Map(freshItems.map((i) => [i.id, i.excerpt ?? '']))
  const changed = new Set<string>()
  for (const [id, excerpt] of fresh) if (!base.has(id) || base.get(id) !== excerpt) changed.add(id)
  for (const id of base.keys()) if (!fresh.has(id)) changed.add(id)
  return changed
}

function main(): void {
  const baselineRows = gitShowJson<VerdictRow[]>(BASELINE_REF, `open-rankings/${CAT}/verdicts.json`)
  if (!baselineRows) throw new Error(`missing verdicts at ${BASELINE_REF}`)
  const baseline = new Map(baselineRows.map((r) => [`${r.productId}:${r.storyId}`, r]))
  const current: VerdictRow[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', CAT, 'verdicts.json'), 'utf8'))
  const changedByProduct = new Map<string, Set<string>>()
  let reverted = 0
  let stood = 0

  for (let i = 0; i < current.length; i++) {
    const key = `${current[i].productId}:${current[i].storyId}`
    if (current[i].productId === DEBUT) continue
    const base = baseline.get(key)
    if (!base) continue
    const roll = current[i]
    if (base.verdict === roll.verdict && base.quality === roll.quality && base.rationale === roll.rationale) continue
    const pid = current[i].productId
    if (!changedByProduct.has(pid)) changedByProduct.set(pid, changedIdsFor(pid))
    const changed = changedByProduct.get(pid)!
    const flipRestsOnChange = roll.evidenceIds.some((id) => changed.has(id)) || base.evidenceIds.some((id) => changed.has(id))
    const target = flipRestsOnChange ? roll : base
    if (flipRestsOnChange) stood++
    else {
      reverted++
      if (base.verdict !== roll.verdict || base.quality !== roll.quality) {
        console.log(`${CAT}/${key}  ${roll.verdict}(q${roll.quality}) -> baseline ${base.verdict}(q${base.quality})`)
      }
    }
    if (WRITE && (current[i].verdict !== target.verdict || current[i].quality !== target.quality || current[i].rationale !== target.rationale)) {
      current[i] = { ...target }
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CAT, pid, `${current[i].storyId}.json`)
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion: string; verdict: VerdictRow }
      cache.verdict = { ...target }
      fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
    }
  }

  if (WRITE) {
    fs.writeFileSync(path.join(ROOT, 'open-rankings', CAT, 'verdicts.json'), `${JSON.stringify(current, null, 2)}\n`)
  }
  console.log(`${CAT}: ${reverted} re-rolled cell(s) ${WRITE ? 'settled to baseline (label flips logged above; the rest are rationale-only)' : 'would settle to baseline (label flips logged above; the rest are rationale-only)'}, ${stood} flip(s) stand on changed evidence (baseline ${BASELINE_REF})`)
  console.log(WRITE ? 'Applied.' : 'Dry run only — pass --write to apply.')
}

main()
