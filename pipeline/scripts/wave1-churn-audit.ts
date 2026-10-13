// Accuracy Program wave 1 churn audit: after deepening evidence packs for codex, claude-code,
// cursor, and github-copilot (new urls.extra pointing at MCP-client docs) and re-running
// `pnpm pipeline judge --category ai-coding`, every cell for a product whose evidence array
// changed gets re-judged by the LLM — not just the cells that plausibly needed it. This script
// diffs every (product, story) cell old (git HEAD, pre-wave) vs new (current disk) and reverts
// any verdict/quality change that cites no newly-added evidence id, per the published
// re-judge-stability policy (METHODOLOGY.md: "verdicts citing nothing new don't move").
//
// Excluded from the audit entirely (handled deliberately, not re-judge noise):
//   - `agentic-mcp-server` for the 5 ai-coding products — a documented applicability
//     correction (na), not an LLM re-judge.
//   - `agentic-mcp-client` — a brand-new canonical story with no "old" cell to diff against.
//
// Usage: pnpm exec tsx pipeline/scripts/wave1-churn-audit.ts [--write]
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const CATEGORY = 'ai-coding'
const WRITE = process.argv.includes('--write')
const EXCLUDED_STORIES = new Set(['agentic-mcp-server', 'agentic-mcp-client'])

type VerdictRow = {
  productId: string
  storyId: string
  verdict: 'full' | 'partial' | 'none' | 'disputed' | 'na'
  quality: number
  confidence: 'high' | 'medium' | 'low'
  rationale: string
  evidenceIds: string[]
}

type EvidenceItem = { id: string }

function key(productId: string, storyId: string): string {
  return `${productId}:${storyId}`
}

function readOldVerdicts(): VerdictRow[] {
  const raw = execSync(`git show HEAD:data/${CATEGORY}/verdicts.json`, { cwd: ROOT, maxBuffer: 1024 * 1024 * 64 })
  return JSON.parse(raw.toString('utf8'))
}

function readNewVerdicts(): VerdictRow[] {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'rankings', CATEGORY, 'verdicts.json'), 'utf8'))
}

function readOldEvidenceIds(productId: string): Set<string> {
  try {
    const raw = execSync(`git show HEAD:data/${CATEGORY}/evidence/${productId}.json`, {
      cwd: ROOT,
      maxBuffer: 1024 * 1024 * 64,
    })
    const items: EvidenceItem[] = JSON.parse(raw.toString('utf8'))
    return new Set(items.map((i) => i.id))
  } catch {
    return new Set()
  }
}

function main(): void {
  const oldRows = readOldVerdicts()
  const newRows = readNewVerdicts()
  const oldMap = new Map(oldRows.map((r) => [key(r.productId, r.storyId), r]))
  const newMap = new Map(newRows.map((r) => [key(r.productId, r.storyId), r]))
  const order = newRows.map((r) => key(r.productId, r.storyId))

  const oldEvidenceCache = new Map<string, Set<string>>()
  const final: VerdictRow[] = newRows.map((r) => ({ ...r }))

  const reverts: Array<{ productId: string; storyId: string; old: VerdictRow; new: VerdictRow }> = []
  const justified: Array<{ productId: string; storyId: string; old: VerdictRow; new: VerdictRow; newEvidence: string[] }> = []

  for (const [k, oldRow] of oldMap) {
    if (EXCLUDED_STORIES.has(oldRow.storyId)) continue
    const newRow = newMap.get(k)
    if (!newRow) continue // shouldn't happen — every old cell should still exist
    const changed = oldRow.verdict !== newRow.verdict || oldRow.quality !== newRow.quality
    if (!changed) continue

    if (!oldEvidenceCache.has(newRow.productId)) {
      oldEvidenceCache.set(newRow.productId, readOldEvidenceIds(newRow.productId))
    }
    const oldEvidenceIds = oldEvidenceCache.get(newRow.productId)!
    const citedNewEvidence = newRow.evidenceIds.filter((id) => !oldEvidenceIds.has(id))

    if (citedNewEvidence.length === 0) {
      const idx = order.indexOf(k)
      final[idx] = { ...oldRow }
      reverts.push({ productId: oldRow.productId, storyId: oldRow.storyId, old: oldRow, new: newRow })
    } else {
      justified.push({ productId: newRow.productId, storyId: newRow.storyId, old: oldRow, new: newRow, newEvidence: citedNewEvidence })
    }
  }

  console.log(`\n=== Wave 1 churn audit: ${CATEGORY} (${WRITE ? 'WRITE' : 'DRY RUN'}) ===\n`)
  console.log(`Justified changes (cite new evidence): ${justified.length}`)
  for (const j of justified) {
    console.log(
      `  KEEP  ${j.productId}:${j.storyId}  ${j.old.verdict}(q${j.old.quality}) -> ${j.new.verdict}(q${j.new.quality})  [new: ${j.newEvidence.join(', ')}]`,
    )
  }
  console.log(`\nUnjustified churn (reverted): ${reverts.length}`)
  for (const r of reverts) {
    console.log(`  REVERT  ${r.productId}:${r.storyId}  ${r.new.verdict}(q${r.new.quality}) -> back to ${r.old.verdict}(q${r.old.quality})`)
  }
  console.log(`\nTotal cells diffed: ${oldMap.size - [...oldMap.keys()].filter((k) => EXCLUDED_STORIES.has(oldMap.get(k)!.storyId)).length}`)
  console.log(`Total reverts: ${reverts.length}\n`)

  if (!WRITE) {
    console.log('Dry run only — pass --write to apply.')
    return
  }

  fs.writeFileSync(path.join(ROOT, 'rankings', CATEGORY, 'verdicts.json'), JSON.stringify(final, null, 2) + '\n')

  let patched = 0
  let missing = 0
  for (const r of reverts) {
    const cacheFile = path.join(ROOT, 'pipeline', 'cache', 'judge', CATEGORY, r.productId, `${r.storyId}.json`)
    if (!fs.existsSync(cacheFile)) {
      console.warn(`WARN: cache file missing, skipping: ${cacheFile}`)
      missing++
      continue
    }
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; verdict: Record<string, unknown> }
    cached.verdict = { ...r.old }
    fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 2) + '\n')
    patched++
  }
  console.log(`Patched ${patched} judge cache file(s) (${missing} missing).`)

  fs.writeFileSync(
    path.join(ROOT, '.superpowers', 'wave1-churn-audit-reverts.json'),
    JSON.stringify(reverts, null, 2) + '\n',
  )
  console.log('Wrote .superpowers/wave1-churn-audit-reverts.json (full audit list).')
}

main()
