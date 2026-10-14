// One-shot backfill of open-rankings/{cat}/score-history.jsonl from git history: walks every commit on
// this repo's main branch that touched a category's rankings.json, extracts each product's
// headline scores (aiEra + agentReady) from that commit's snapshot, dedupes consecutive
// identical values, and (re)writes the whole file — one line per product per CHANGE, in commit
// order. Safe to re-run (it regenerates from history, then the derive stage's
// appendScoreHistoryOnChange grows the file forward — see lib/scoreHistory.ts).
//
//   pnpm tsx pipeline/scripts/build-score-history.ts [--category <id>] [--ref <git-ref>]
//
// Snapshots that predate the Overall score era (no aiEra/agentReady fields on leaderboard
// entries at all — e.g. the old `agenticness`-only shape) are skipped entirely: a missing field
// is "not measured yet", which is different from the schema's explicit null ("measured, not
// applicable"), and recording it would fake a longer history than we honestly have.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { SCORE_HISTORY_FILE } from '../../lib/scoreHistory'
import { roundScore } from '../../lib/scoreTrend'
import type { ScoreHistoryEntry } from '../../lib/schemas'
import { ROOT, categoryDir, resolveCategories } from '../paths'

export interface SnapshotEntry {
  productId: string
  aiEra: number | null
  agentReady: number | null
}

export interface Snapshot {
  date: string
  entries: SnapshotEntry[]
}

// Lenient parser over one historical rankings.json's already-JSON.parse'd value — old commits
// predate the current RankingsSchema, so this reads only what it needs and never zod-rejects a
// snapshot for being old-shaped. Returns [] for anything unrecognizable.
export function snapshotEntries(raw: unknown): SnapshotEntry[] {
  if (typeof raw !== 'object' || raw === null) return []
  const leaderboard = (raw as { leaderboard?: unknown }).leaderboard
  if (!Array.isArray(leaderboard)) return []
  const out: SnapshotEntry[] = []
  for (const item of leaderboard) {
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.productId !== 'string' || rec.productId === '') continue
    const hasAiEra = typeof rec.aiEra === 'number' || rec.aiEra === null
    const hasAgentReady = typeof rec.agentReady === 'number' || rec.agentReady === null
    // Pre-Arena-Score era (neither field exists) → not measured yet; skip, don't fake nulls.
    if (!hasAiEra && !hasAgentReady) continue
    out.push({
      productId: rec.productId,
      aiEra: hasAiEra ? roundScore(rec.aiEra as number | null) : null,
      agentReady: hasAgentReady ? roundScore(rec.agentReady as number | null) : null,
    })
  }
  return out
}

// Snapshots (chronological, oldest first) → change-only history lines: a product's line is
// emitted for its first appearance and then only when its rounded (aiEra, agentReady) pair
// differs from its previous line.
export function buildHistoryLines(snapshots: Snapshot[]): ScoreHistoryEntry[] {
  const lines: ScoreHistoryEntry[] = []
  const last = new Map<string, SnapshotEntry>()
  for (const snap of snapshots) {
    for (const entry of snap.entries) {
      const prev = last.get(entry.productId)
      if (prev && prev.aiEra === entry.aiEra && prev.agentReady === entry.agentReady) continue
      lines.push({ productId: entry.productId, date: snap.date, aiEra: entry.aiEra, agentReady: entry.agentReady })
      last.set(entry.productId, entry)
    }
  }
  return lines
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

// Commits on `ref` that touched `file` (repo-relative), oldest first, as {sha, date} where date
// is the committer date ('%cI', strict ISO with TZ offset).
function commitsFor(ref: string, file: string): Array<{ sha: string; date: string }> {
  const log = git(['log', ref, '--format=%H %cI', '--', file]).trim()
  if (log === '') return []
  return log
    .split('\n')
    .map((line) => {
      const [sha, date] = line.split(' ')
      return { sha, date }
    })
    .reverse()
}

function main(): void {
  const argv = process.argv.slice(2)
  const categoryFlag = argv.indexOf('--category')
  const category = categoryFlag >= 0 ? argv[categoryFlag + 1] : undefined
  const refFlag = argv.indexOf('--ref')
  const ref = refFlag >= 0 ? argv[refFlag + 1] : 'main'

  let totalLines = 0
  for (const cat of resolveCategories(category)) {
    const gitPath = `open-rankings/${cat.id}/rankings.json`
    const snapshots: Snapshot[] = []
    for (const { sha, date } of commitsFor(ref, gitPath)) {
      let raw: unknown
      try {
        raw = JSON.parse(git(['show', `${sha}:${gitPath}`]))
      } catch {
        continue // file deleted/absent at this commit, or unparsable — nothing to record
      }
      const entries = snapshotEntries(raw)
      if (entries.length > 0) snapshots.push({ date, entries })
    }
    const lines = buildHistoryLines(snapshots)
    const file = path.join(categoryDir(cat.id), SCORE_HISTORY_FILE)
    if (lines.length === 0) {
      console.log(`build-score-history: ${cat.id} — no Overall score era snapshots on ${ref}; skipped`)
      continue
    }
    fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
    totalLines += lines.length
    console.log(
      `build-score-history: ${cat.id} — ${snapshots.length} snapshots → ${lines.length} lines (${new Set(lines.map((l) => l.productId)).size} products)`,
    )
  }
  console.log(`build-score-history: TOTAL ${totalLines} lines`)
}

if (require.main === module) {
  main()
}
