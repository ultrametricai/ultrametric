// Recompute committed judge-cache hashes for the terminals products whose evidence packs
// were corrected after their verdicts were judged (PR #542 round-2 review: "Restored
// evidence leaves stale hashes" / "Restored grades keep stale hashes").
//
// cellHash covers every evidence row in a product's pack, not just cited rows, so restoring
// the four recorded runtime probes (kitty-, wezterm-, ghostty-, alacritty-probe-rt-1) left
// every cached cell for those products keyed to the pre-restore packs: a product-scoped
// judge run would fail while assembling the matrix, and a full run would re-judge the
// settled cells instead of keeping their reviewed answers. This script re-keys the reviewed
// verdicts to the corrected packs; it changes no verdict content.
//
// Safety: before writing anything it verifies hash parity on every product whose pack is
// NOT listed below (recomputed hash must equal the committed hash), proving the computation
// here matches the engine's, then rewrites `hash` for every cell of the listed products.
//
// Usage: pnpm exec tsx rankings-engine/scripts/recompute-judge-hashes-terminals-542.ts [--write]
//   (default: dry run, prints the plan only)

import fs from 'node:fs'
import path from 'node:path'
import { EvidenceSchema, StorySchema } from '../../lib/schemas'
import { CACHE_DIR, categoryDir, readJson } from '../paths'
import { CELL_HASH_VERSION, PROMPT_VERSION, cellHash } from '../stages/judge'

const WRITE = process.argv.includes('--write')
const CAT = 'terminals'
const CORRECTED_PACKS = ['kitty', 'wezterm', 'ghostty', 'alacritty']
const PARITY_PACKS = ['iterm2', 'warp']

function main(): void {
  const dataDir = categoryDir(CAT)
  const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))

  // Parity proof on untouched packs: our hash must reproduce the committed one.
  for (const pid of PARITY_PACKS) {
    const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${pid}.json`))
    for (const story of stories) {
      const cacheFile = path.join(CACHE_DIR, 'judge', CAT, pid, `${story.id}.json`)
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion?: string }
      const expected = cellHash(story, evidence, PROMPT_VERSION)
      if (cached.keyVersion !== CELL_HASH_VERSION || cached.hash !== expected) {
        throw new Error(`parity check failed for ${pid}:${story.id} — refusing to rewrite hashes`)
      }
    }
    console.log(`parity OK: ${pid} (${stories.length} cells reproduce their committed hashes)`)
  }

  let rekeyed = 0
  let already = 0
  for (const pid of CORRECTED_PACKS) {
    const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${pid}.json`))
    for (const story of stories) {
      const cacheFile = path.join(CACHE_DIR, 'judge', CAT, pid, `${story.id}.json`)
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as {
        hash: string
        keyVersion?: string
        verdict: unknown
      }
      const expected = cellHash(story, evidence, PROMPT_VERSION)
      if (cached.keyVersion === CELL_HASH_VERSION && cached.hash === expected) {
        already++
        continue
      }
      rekeyed++
      console.log(`REKEY ${CAT}/${pid}:${story.id}`)
      if (WRITE) {
        fs.writeFileSync(
          cacheFile,
          `${JSON.stringify({ hash: expected, keyVersion: CELL_HASH_VERSION, verdict: cached.verdict }, null, 2)}\n`,
        )
      }
    }
  }
  console.log(
    `${CAT}: ${rekeyed} cell(s) ${WRITE ? 'rekeyed' : 'would be rekeyed'} to the corrected packs, ${already} already current`,
  )
  console.log(WRITE ? 'Applied.' : 'Dry run only — pass --write to apply.')
}

main()
