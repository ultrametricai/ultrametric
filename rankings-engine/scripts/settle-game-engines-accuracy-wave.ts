// Wave-level churn settlement for the 2026-09-23 game-engines accuracy wave. Applies
// spike-engine's exact churnDecision rule to EVERY product in the arena at once, with the
// pre-wave baseline read from git HEAD (the wave ran in a clean worktree, so HEAD is exactly
// the state before any evidence was appended): a verdict flip survives only when it cites at
// least one evidence id that did not exist before the wave; a revert is only valid while the
// old verdict's citations still resolve in the CURRENT evidence file (probe-tier ids are
// regenerated wholesale, so some old citations can't be restored — then the fresh judgment
// stands). Reverted cells get the standard cache patch (current hash, old verdict) so the next
// judge run doesn't resurrect the churn.
//
// Usage: pnpm exec tsx pipeline/scripts/settle-game-engines-accuracy-wave.ts [--write]
// Without --write it reports what it WOULD do.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { EvidenceSchema, type Verdict } from '../../lib/schemas'
import { DATA_DIR, ROOT, writeJson } from '../paths'
import { churnDecision } from './spike-engine'

const ARENA = 'game-engines'
const WRITE = process.argv.includes('--write')

function gitShowHead(relPath: string): string {
  return execFileSync('git', ['show', `HEAD:${relPath}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function main(): void {
  const arenaDir = path.join(DATA_DIR, ARENA)
  const verdictsFile = path.join(arenaDir, 'verdicts.json')
  const relArena = path.relative(ROOT, arenaDir)

  const oldVerdicts = JSON.parse(gitShowHead(`${relArena}/verdicts.json`)) as Verdict[]
  const newVerdicts = JSON.parse(fs.readFileSync(verdictsFile, 'utf8')) as Verdict[]
  const oldByCell = new Map(oldVerdicts.map((v) => [`${v.productId}/${v.storyId}`, v]))

  const productIds = [...new Set(newVerdicts.map((v) => v.productId))]
  const oldEvidenceIds = new Map<string, Set<string>>()
  const currentEvidenceIds = new Map<string, Set<string>>()
  for (const pid of productIds) {
    const rel = `${relArena}/evidence/${pid}.json`
    const oldEv = EvidenceSchema.array().parse(JSON.parse(gitShowHead(rel)))
    const newEv = EvidenceSchema.array().parse(JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')))
    oldEvidenceIds.set(pid, new Set(oldEv.map((e) => e.id)))
    currentEvidenceIds.set(pid, new Set(newEv.map((e) => e.id)))
  }

  const perProduct = new Map<string, { kept: number; reverted: number; newCells: number }>()
  const settled = newVerdicts.map((v) => {
    const old = oldByCell.get(`${v.productId}/${v.storyId}`)
    const stats = perProduct.get(v.productId) ?? { kept: 0, reverted: 0, newCells: 0 }
    perProduct.set(v.productId, stats)
    const decision = churnDecision(old, v, oldEvidenceIds.get(v.productId)!, currentEvidenceIds.get(v.productId)!)
    if (decision === 'unchanged') return v
    if (decision === 'keep') {
      if (!old) stats.newCells++
      else {
        stats.kept++
        console.log(
          `KEEP   ${v.productId}:${v.storyId} ${old.verdict}/q${old.quality} -> ${v.verdict}/q${v.quality} (cites new evidence)`,
        )
      }
      return v
    }
    stats.reverted++
    console.log(`REVERT ${v.productId}:${v.storyId} ${v.verdict}/q${v.quality} -> ${old!.verdict}/q${old!.quality} (no new citation)`)
    if (WRITE) {
      const cacheFile = path.join(ROOT, 'pipeline', 'cache', 'judge', ARENA, v.productId, `${v.storyId}.json`)
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string }
        writeJson(cacheFile, { hash: cached.hash, verdict: old })
      }
    }
    return old!
  })

  if (WRITE) writeJson(verdictsFile, settled)
  for (const [pid, s] of perProduct) {
    console.log(`settle: ${pid} — ${s.kept} flips kept, ${s.reverted} reverted, ${s.newCells} new cells`)
  }
  console.log(WRITE ? 'settle: WRITTEN' : 'settle: dry run (--write to apply)')
}

main()
