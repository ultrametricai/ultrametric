// Legacy same-source transitions audit (docs/ACCURACY.md: "Review legacy same-source
// transitions and the rubric migration before resuming scheduled runs"). This is the
// second half of that review; the first half is reports/rubric-migration/2026-11-04-v6-preview.md.
//
// Read-only over git history: reconstructs every published verdict transition along the
// first-parent lineage of HEAD for every arena's verdicts.json (through the data/ ->
// rankings/ -> open-rankings/ renames), classifies each transition with the repo's own
// evidence-source rules (rankings-engine/evidence-source.mjs, the same functions the CI
// stability gate uses), and reports which published verdicts currently rest on a
// transition that neither new evidence nor a labeled rubric/judge wave justifies.
//
// Classes per transition:
//   labeled-migration  — a labeled judge/rubric wave (2026-09-30 judge migration,
//                        wave-1 v5 settlement PR #456, registered-agents v6 PR #564,
//                        prompt-v3 pilot re-judge)
//   evidence-driven    — cites a new evidence id with newSourceSupport, or is a
//                        downgrade after cited support disappeared
//   settlement-restore — a settle/revert commit returning the cell to a prior verdict
//   rubric-rollout     — no new cited support, but the cell's committed judge cache moved
//                        onto a newer prompt version at this step (the designed rollout of
//                        PR #388: stale arenas re-judge fully on their next judge touch)
//   unsupported-churn  — none of the above; rollout and churn are subdivided by lineage into
//                        settled (a later transition returned the cell to the pre-churn
//                        verdict), superseded (a later transition moved the cell again),
//                        standing (the cell's current published verdict IS this transition's
//                        result — the class docs/ACCURACY.md asks about); a standing churn
//                        cell whose verdict a later labeled wave re-judged and kept moves to
//                        standing-wave-reconfirmed (the wave's judge reproduced the verdict)
//
// Also computes v5 cache currency per standing-churn cell (committed judge caches +
// cellHash with prompt v5) to size the correction each migration option would deliver.
//
// Usage: pnpm exec tsx rankings-engine/scripts/legacy-transitions-audit.ts [--out <file>] [--full] [--ref <commit>]
// --ref pins the audited revision (default HEAD). Git history is read at that ref; the
// v5 cache-currency pass reads the working tree, so reproduce a committed report from a
// checkout whose open-rankings/ and rankings-engine/cache/ match the ref.
// Writes JSON to --out (default: stdout). Default output carries aggregates plus the per-cell
// rows for the unsupported-churn and rubric-rollout classes (the report payload); --full adds
// every transition including the labeled-migration and evidence-driven ones.
// Reads git and tracked files only; writes nothing else.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { newSourceSupport, supportDisappeared } from '../evidence-source.mjs'
import { cellHash, CELL_HASH_VERSION } from '../stages/judge'

const ROOT = path.resolve(__dirname, '..', '..')
const outArg = process.argv.indexOf('--out')
const OUT = outArg >= 0 ? process.argv[outArg + 1] : undefined
const FULL = process.argv.includes('--full')
// The revision to audit. Committing the output moves HEAD, so reproducing a committed
// report means naming the revision it audited, e.g. --ref bc778d69b9.
const refArg = process.argv.indexOf('--ref')
const REF = refArg >= 0 ? process.argv[refArg + 1] : 'HEAD'
// The model whose caches the audit validates. Pinned so a UM_JUDGE_MODEL/PA_MODEL override
// in the shell cannot silently stop historical opus caches from matching.
const AUDIT_JUDGE_MODEL = 'claude-opus-5-5'

type Verdict = 'full' | 'partial' | 'none' | 'disputed' | 'na'
type Row = { productId: string; storyId: string; verdict: Verdict; quality: number; rationale?: string; evidenceIds?: string[] }
type EvidenceItem = { id: string; tier: string; url: string; excerpt: string; sourceHash?: string }

const RANK: Record<Verdict, number> = { na: 0, none: 0, disputed: 1, partial: 2, full: 3 }

// Labeled waves: README §7 / docs/JUDGE-MIGRATION-2026-09-30.md exempt these from the
// no-new-evidence revert rule, so their flips are rubric/judge-driven by construction.
const MIGRATION_RES: Array<[string, RegExp]> = [
  ['judge-migration-2026-09-30', /^judge migration:/i],
  ['wave1-v5-settlement', /settlement wave 1|pre-v5 arenas under judge prompt v5/i],
  ['registered-agents-v6', /registered-agents to judge prompt v6|registered-agents v6 re-roll/i],
  ['prompt-v3-pilot', /^judge prompt v3:/i],
  ['prompt-v3-fleet', /fleet re-judge under judge prompt v3/i],
  ['prompt-v5-five-arena-regrade', /re-judge all \d+ cells under prompt v5/i],
  // Score-history notes "gpus-refresh-2026-10-23" and "judge-refresh-2026-10-23" label these
  // two as first-prompt-v5 re-judges (evidence-cited flips still classify evidence-driven first).
  ['gpus-v5-refresh-2026-10-23', /refresh the gpus arena: new evidence, prompt-v5 re-judge/i],
  ['agent-sandboxes-v5-2026-10-23', /bring up sandbox0 in agent-sandboxes/i],
]
const SETTLE_RE = /((settle|revert)[^\n]*?(churn|re-?roll|baseline))|(churn[^\n]*?(settle|revert))|stability policy applied/i

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 256 }).toString('utf8')
}

const PATH_ERAS = ['open-rankings', 'rankings', 'data']
function showAt<T>(ref: string, arena: string, rel: string): T | undefined {
  for (const era of PATH_ERAS) {
    try {
      return JSON.parse(git(['show', `${ref}:${era}/${arena}/${rel}`])) as T
    } catch {
      /* try the previous path era */
    }
  }
  return undefined
}

const evidenceCache = new Map<string, EvidenceItem[]>()
function evidenceAt(ref: string, arena: string, productId: string): EvidenceItem[] {
  const key = `${ref}:${arena}:${productId}`
  if (!evidenceCache.has(key)) {
    evidenceCache.set(key, showAt<EvidenceItem[]>(ref, arena, `evidence/${productId}.json`) ?? [])
  }
  return evidenceCache.get(key)!
}

const storiesCache = new Map<string, Map<string, { id: string; title: string }>>()
function storiesAt(ref: string, arena: string): Map<string, { id: string; title: string }> {
  const key = `${ref}:${arena}`
  if (!storiesCache.has(key)) {
    const list = showAt<Array<{ id: string; title: string }>>(ref, arena, 'stories.json') ?? []
    storiesCache.set(key, new Map(list.map((s) => [s.id, s])))
  }
  return storiesCache.get(key)!
}

// Which prompt version the committed judge cache at `ref` validates under for this cell.
// Reliable from 2026-10-19 (CELL_HASH_VERSION v2, 1e129d0f1a): the hash payload has been
// byte-identical since. Pre-v2 caches return 'mismatch'/'missing', which is what the
// rollout test needs (they were not v5).
const CACHE_ERAS = ['rankings-engine/cache/judge', 'pipeline/cache/judge']
function promptAt(ref: string, arena: string, productId: string, storyId: string): string {
  let cached: { hash: string; keyVersion?: string } | undefined
  for (const era of CACHE_ERAS) {
    try {
      cached = JSON.parse(git(['show', `${ref}:${era}/${arena}/${productId}/${storyId}.json`]))
      break
    } catch {
      /* try the previous cache location */
    }
  }
  if (!cached) return 'missing'
  if (cached.keyVersion !== CELL_HASH_VERSION) return 'pre-v2-key'
  const story = storiesAt(ref, arena).get(storyId)
  if (!story) return 'missing'
  const pack = evidenceAt(ref, arena, productId)
  for (const v of ['v5', 'v6', 'v4']) {
    if (cached.hash === cellHash(story as never, pack as never, v, AUDIT_JUDGE_MODEL)) return v
  }
  return 'mismatch'
}

// The CI stability gate's support tests (check-refresh-stability.mjs), applied historically.
function newEvidenceSupport(row: Row, oldPack: EvidenceItem[], newPack: EvidenceItem[]): boolean {
  const oldIds = new Set(oldPack.map((e) => e.id))
  const newItems = new Map(newPack.map((e) => [e.id, e]))
  return (row.evidenceIds ?? []).some(
    (id) => !oldIds.has(id) && newItems.has(id) && newSourceSupport(newItems.get(id), oldPack),
  )
}
function downgradeAfterSupportLoss(old: Row, next: Row, before: EvidenceItem[], after: EvidenceItem[]): boolean {
  const rank: Record<string, number> = { none: 0, partial: 1, full: 2 }
  if (!(old.verdict in rank) || !(next.verdict in rank)) return false
  if (rank[next.verdict] > rank[old.verdict] || next.quality > old.quality) return false
  const previous = new Map(before.map((e) => [e.id, e]))
  const current = new Map(after.map((e) => [e.id, e]))
  const nextIds = next.evidenceIds ?? []
  if (nextIds.some((id) => !current.has(id)) || (next.verdict !== 'none' && nextIds.length === 0)) return false
  return (old.evidenceIds ?? []).some((id) => previous.has(id) && supportDisappeared(previous.get(id), after))
}

type Transition = {
  arena: string
  productId: string
  storyId: string
  from: Verdict
  to: Verdict
  fromQuality: number
  toQuality: number
  direction: 'up' | 'down' | 'lateral'
  commit: string
  prevCommit: string
  date: string
  subject: string
  support: 'new-evidence' | 'support-loss' | 'none'
  wave: string | null
  settleStep: boolean
  // filled by the classification pass
  oldPrompt?: string
  newPrompt?: string
  class?: string
}

const arenas = fs
  .readdirSync(path.join(ROOT, 'open-rankings'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, 'open-rankings', d.name, 'verdicts.json')))
  .map((d) => d.name)
  .sort()

const transitions: Transition[] = []
const qualityOnly = { total: 0, supported: 0, labeled: 0, unsupported: 0 }
// Cells a labeled wave re-judged (new rationale) while keeping the verdict: the wave's judge
// independently reproduced the published verdict. Wave steps re-judge every cell and rewrite
// every rationale (verified on the 2026-09-30 wave: zero byte-identical rows).
const waveReconfirmedAt = new Map<string, string[]>()

for (const arena of arenas) {
  const pathspecs = PATH_ERAS.map((era) => `${era}/${arena}/verdicts.json`)
  const log = git(['log', '--first-parent', '--reverse', '--format=%H|%ct|%s', REF, '--', ...pathspecs])
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, ct, ...rest] = line.split('|')
      return { hash, date: new Date(Number(ct) * 1000).toISOString().slice(0, 10), subject: rest.join('|') }
    })
  if (log.length < 2) continue

  let prev = showAt<Row[]>(log[0].hash, arena, 'verdicts.json')
  for (let i = 1; i < log.length; i++) {
    const cur = showAt<Row[]>(log[i].hash, arena, 'verdicts.json')
    if (!prev || !cur) {
      prev = cur ?? prev
      continue
    }
    const prevMap = new Map(prev.map((r) => [`${r.productId}:${r.storyId}`, r]))
    const changed = cur.filter((r) => {
      const old = prevMap.get(`${r.productId}:${r.storyId}`)
      return old && (old.verdict !== r.verdict || old.quality !== r.quality)
    })
    // underlying commits of this first-parent step that touched this arena's verdicts
    const subjects = git(['log', '--format=%s', `${log[i - 1].hash}..${log[i].hash}`, '--', ...pathspecs])
      .trim()
      .split('\n')
      .filter(Boolean)
    const wave = MIGRATION_RES.find(([, re]) => subjects.some((s) => re.test(s)))?.[0] ?? null
    const settleStep = subjects.some((s) => SETTLE_RE.test(s))
    if (wave) {
      for (const row of cur) {
        const old = prevMap.get(`${row.productId}:${row.storyId}`)
        // Same verdict with a rewritten rationale: the wave re-judged the cell and kept the
        // verdict (a quality move alongside is a labeled wave quality move). A byte-identical
        // row is a cache hit, not a re-judgment, and does not reconfirm.
        if (old && old.verdict === row.verdict && old.rationale !== row.rationale) {
          const key = `${arena}:${row.productId}:${row.storyId}`
          waveReconfirmedAt.set(key, [...(waveReconfirmedAt.get(key) ?? []), log[i].date])
        }
      }
    }
    if (changed.length) {
      for (const row of changed) {
        const old = prevMap.get(`${row.productId}:${row.storyId}`)!
        const before = evidenceAt(log[i - 1].hash, arena, row.productId)
        const after = evidenceAt(log[i].hash, arena, row.productId)
        const support = newEvidenceSupport(row, before, after)
          ? 'new-evidence'
          : downgradeAfterSupportLoss(old, row, before, after)
            ? 'support-loss'
            : 'none'
        if (old.verdict === row.verdict) {
          qualityOnly.total++
          if (support !== 'none') qualityOnly.supported++
          else if (wave) qualityOnly.labeled++
          else qualityOnly.unsupported++
          continue
        }
        const dir = RANK[row.verdict] > RANK[old.verdict] ? 'up' : RANK[row.verdict] < RANK[old.verdict] ? 'down' : 'lateral'
        transitions.push({
          arena,
          productId: row.productId,
          storyId: row.storyId,
          from: old.verdict,
          to: row.verdict,
          fromQuality: old.quality,
          toQuality: row.quality,
          direction: dir,
          commit: log[i].hash.slice(0, 10),
          prevCommit: log[i - 1].hash.slice(0, 10),
          date: log[i].date,
          subject: log[i].subject,
          support,
          wave,
          settleStep,
        })
      }
    }
    prev = cur
  }
}

// Lineage pass: classify each transition within its cell's chronological sequence.
const byCell = new Map<string, Transition[]>()
for (const t of transitions) {
  const key = `${t.arena}:${t.productId}:${t.storyId}`
  if (!byCell.has(key)) byCell.set(key, [])
  byCell.get(key)!.push(t)
}
for (const seq of byCell.values()) {
  seq.forEach((t, i) => {
    if (t.support !== 'none') {
      t.class = `evidence-driven:${t.support}`
      return
    }
    if (t.wave) {
      t.class = `labeled-migration:${t.wave}`
      return
    }
    const returnsToPrior = seq.slice(0, i).some((e) => e.from === t.to)
    if (t.settleStep && returnsToPrior) {
      t.class = 'settlement-restore'
      return
    }
    // Unlabeled rubric rollout: the cell's committed judge cache moved onto a newer prompt
    // version at this step (the "designed rollout" of PR #388: stale arenas re-judge fully
    // under the new rubric on their next judge touch). Reliable from the v2 cache key
    // (2026-10-19), which is also when prompt v5 landed.
    let base = 'unsupported-churn'
    if (t.date >= '2026-10-19') {
      t.newPrompt = promptAt(t.commit, t.arena, t.productId, t.storyId)
      t.oldPrompt = promptAt(t.prevCommit, t.arena, t.productId, t.storyId)
      if (t.newPrompt === 'v5' && t.oldPrompt !== 'v5') base = 'rubric-rollout:v5'
      else if (t.newPrompt === 'v6' && t.oldPrompt !== 'v6') base = 'rubric-rollout:v6'
    }
    const later = seq.slice(i + 1)
    if (later.some((l) => l.to === t.from)) t.class = `${base}:settled`
    else if (later.length) t.class = `${base}:superseded`
    else t.class = `${base}:standing`
    // A later labeled wave that re-judged the cell to the same value independently
    // reproduced the judgment; keep those out of the actionable standing set.
    if (t.class === 'unsupported-churn:standing') {
      const rec = waveReconfirmedAt.get(`${t.arena}:${t.productId}:${t.storyId}`) ?? []
      if (rec.some((d) => d > t.date)) t.class = 'unsupported-churn:standing-wave-reconfirmed'
    }
  })
}

// v5 cache currency for standing-churn cells and the fleet (preview cross-check).
const stories = new Map<string, Map<string, { id: string; title: string }>>()
const fleet = { cells: 0, v5Current: 0, v5Stale: 0 }
const v5CurrentByCell = new Map<string, boolean>()
for (const arena of arenas) {
  const storyList = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', arena, 'stories.json'), 'utf8')) as Array<{ id: string; title: string }>
  stories.set(arena, new Map(storyList.map((s) => [s.id, s])))
  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', arena, 'products.json'), 'utf8')) as Array<{ id: string }>
  for (const p of products) {
    const evPath = path.join(ROOT, 'open-rankings', arena, 'evidence', `${p.id}.json`)
    const pack = fs.existsSync(evPath) ? (JSON.parse(fs.readFileSync(evPath, 'utf8')) as EvidenceItem[]) : []
    for (const s of storyList) {
      fleet.cells++
      let current = false
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', arena, p.id, `${s.id}.json`)
      if (fs.existsSync(cacheFile)) {
        try {
          const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion?: string }
          current = cached.keyVersion === CELL_HASH_VERSION && cached.hash === cellHash(s as never, pack as never, 'v5', AUDIT_JUDGE_MODEL)
        } catch {
          current = false
        }
      }
      if (current) fleet.v5Current++
      else fleet.v5Stale++
      v5CurrentByCell.set(`${arena}:${p.id}:${s.id}`, current)
    }
  }
}

const count = (pred: (t: Transition) => boolean) => transitions.filter(pred).length
const classes = [...new Set(transitions.map((t) => t.class!))].sort()
const standing = transitions
  .filter((t) => t.class === 'unsupported-churn:standing')
  .map((t) => ({ ...t, v5Current: v5CurrentByCell.get(`${t.arena}:${t.productId}:${t.storyId}`) ?? false }))
const rolloutStanding = transitions.filter((t) => t.class?.startsWith('rubric-rollout:') && t.class.endsWith(':standing'))
const reconfirmed = transitions.filter((t) => t.class === 'unsupported-churn:standing-wave-reconfirmed')
standing.sort((a, b) => {
  const up = (x: Transition) => (x.direction === 'up' ? 1 : 0)
  return up(b) - up(a) || Math.abs(b.toQuality - b.fromQuality) - Math.abs(a.toQuality - a.fromQuality)
})

const perArena: Record<string, Record<string, number>> = {}
for (const t of transitions) {
  perArena[t.arena] ??= {}
  perArena[t.arena][t.class!] = (perArena[t.arena][t.class!] ?? 0) + 1
}

const ERAS: Array<[string, (d: string) => boolean]> = [
  ['v3-era-pre-2026-09-30', (d) => d < '2026-09-30'],
  ['v4-era-2026-10-01..18', (d) => d >= '2026-09-30' && d < '2026-10-19'],
  ['v5-era-pre-gate-2026-10-19..29', (d) => d >= '2026-10-19' && d < '2026-10-30'],
  ['post-gate-2026-10-30-on', (d) => d >= '2026-10-30'],
]

const report = {
  // The audited HEAD's commit time, not wall-clock time: identical inputs give identical output.
  generatedAt: git(['show', '-s', '--format=%cI', REF]).trim(),
  headCommit: git(['rev-parse', REF]).trim(),
  method:
    'first-parent lineage of HEAD per arena verdicts.json across the data/ -> rankings/ -> open-rankings/ renames; ' +
    'support classified with rankings-engine/evidence-source.mjs (newSourceSupport / supportDisappeared), ' +
    'waves and settles matched on underlying commit subjects per step; ' +
    'rubric rollout detected from committed judge caches (cellHash validation per prompt version)',
  arenasAudited: arenas.length,
  verdictTransitions: {
    total: transitions.length,
    byClass: Object.fromEntries(classes.map((c) => [c, count((t) => t.class === c)])),
    byDirection: {
      up: count((t) => t.direction === 'up'),
      down: count((t) => t.direction === 'down'),
      lateral: count((t) => t.direction === 'lateral'),
    },
  },
  qualityOnlyMoves: qualityOnly,
  fleetV5Currency: fleet,
  standingChurn: {
    total: standing.length,
    upgrades: standing.filter((t) => t.direction === 'up').length,
    downgrades: standing.filter((t) => t.direction === 'down').length,
    lateral: standing.filter((t) => t.direction === 'lateral').length,
    v5CurrentCells: standing.filter((t) => t.v5Current).length,
    v5StaleCells: standing.filter((t) => !t.v5Current).length,
    byEra: Object.fromEntries(ERAS.map(([name, test]) => [name, standing.filter((t) => test(t.date)).length])),
    byDate: Object.fromEntries(
      [...new Set(standing.map((t) => t.date))].sort().map((d) => [d, standing.filter((t) => t.date === d).length]),
    ),
    byArena: Object.fromEntries(
      [...new Set(standing.map((t) => t.arena))].sort().map((a) => [a, standing.filter((t) => t.arena === a).length]),
    ),
    cells: standing,
  },
  standingWaveReconfirmed: {
    total: reconfirmed.length,
    up: reconfirmed.filter((t) => t.direction === 'up').length,
    down: reconfirmed.filter((t) => t.direction === 'down').length,
    lateral: reconfirmed.filter((t) => t.direction === 'lateral').length,
  },
  rubricRolloutStanding: {
    total: rolloutStanding.length,
    up: rolloutStanding.filter((t) => t.direction === 'up').length,
    down: rolloutStanding.filter((t) => t.direction === 'down').length,
    lateral: rolloutStanding.filter((t) => t.direction === 'lateral').length,
    byArena: Object.fromEntries(
      [...new Set(rolloutStanding.map((t) => t.arena))].sort().map((a) => [a, rolloutStanding.filter((t) => t.arena === a).length]),
    ),
  },
  perArena,
  // The report payload carries the churn/rollout/settlement rows (the cells a settlement
  // script or review would act on); --full adds the labeled-migration and evidence-driven
  // rows too. Either set regenerates deterministically from git with this script.
  transitions: FULL
    ? transitions
    : transitions.filter((t) => /^(unsupported-churn|rubric-rollout|settlement)/.test(t.class!)),
}

const json = JSON.stringify(report, null, 2) + '\n'
if (OUT) {
  fs.writeFileSync(OUT, json)
  console.log(`wrote ${OUT}: ${transitions.length} transitions, ${standing.length} standing unsupported-churn cells`)
} else {
  process.stdout.write(json)
}
