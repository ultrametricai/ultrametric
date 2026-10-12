// The prediction layer (v1): auto-generated yes/no questions about live close races, settled
// mechanically from the public changelog. Questions live in rankings/predictions.json (committed,
// append-then-settle — see PredictionQuestionSchema below); they are CREATED by
// pipeline/scripts/generate-predictions.ts whenever an arena's #1 and #2 are within
// CLOSE_RACE_THRESHOLD Overall score points (the same "close race" definition as
// pipeline/scripts/uncertainty-pass.ts, via lib/uncertainty.ts's isCloseRace), and SETTLED by
// pipeline/scripts/settle-predictions.ts against the rank-flip (overtake) events that
// lib/changelog.ts derives from the committed score history.
//
// Honest by construction:
//   - a question only ever asks about something the data can answer mechanically: "did the
//     challenger's overtake event land in the changelog before the deadline?"
//   - settlement never consults opinion — 'yes' cites the exact changelog event
//     (see settlementRef), 'no' is simply the deadline passing without one.
//   - participation is a prefilled GitHub issue (.github/ISSUE_TEMPLATE/prediction.yml); v1
//     records predictions as submitted issues and nothing more — no scoring/leaderboard yet.
//
// Everything above loadPredictions() is pure (no node:fs) so generation and settlement are
// trivially unit-testable on fixtures; the two pipeline scripts are thin fs wrappers.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { ChangeEvent } from './changelog'
import { dayOf } from './changelog'
import { isCloseRace } from './uncertainty'

// Same threshold as the multi-judge uncertainty pass — one site-wide definition of "close race".
export const CLOSE_RACE_THRESHOLD = 3.0
// A question stays open this long after it opens; the deadline is part of the question text.
export const PREDICTION_WINDOW_DAYS = 30

export const PREDICTIONS_FILE = 'predictions.json'

export const PredictionQuestionSchema = z.object({
  id: z.string().min(1),
  /** Arena (category) id the race lives in. */
  arena: z.string().min(1),
  /** Human-readable question, frozen at open time (product/arena names as of that snapshot). */
  question: z.string().min(1),
  /** The challenger — the arena's #2 at open time; a 'yes' means this product overtook. */
  productA: z.string().min(1),
  /** The leader — the arena's #1 at open time. */
  productB: z.string().min(1),
  /** rankings.generatedAt of the snapshot the question was generated from. */
  opensAt: z.iso.datetime({ offset: true }),
  /** opensAt + PREDICTION_WINDOW_DAYS — the mechanical settlement deadline. */
  settlesBy: z.iso.datetime({ offset: true }),
  status: z.enum(['open', 'settled']),
  outcome: z.enum(['yes', 'no']).optional(),
  /** For 'yes' outcomes: the changelog overtake event that settled it (see settlementRef). */
  settledBy: z.string().min(1).optional(),
})

export type PredictionQuestion = z.infer<typeof PredictionQuestionSchema>
export const PredictionsArraySchema = PredictionQuestionSchema.array()

/** One arena's current top-2 snapshot — what the generator needs from rankings.json. */
export interface ArenaTop2Snapshot {
  categoryId: string
  categoryName: string
  /** rankings.generatedAt — becomes opensAt so a question is reproducible from its snapshot. */
  generatedAt: string
  top1: { productId: string; name: string; aiEra: number | null } | null
  top2: { productId: string; name: string; aiEra: number | null } | null
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

// Unordered pair key: an open "A overtakes B?" question also blocks opening "B overtakes A?" —
// the two are the same race, and the changelog will answer whichever direction actually flips.
function pairKey(arena: string, a: string, b: string): string {
  return `${arena}::${[a, b].sort().join('|')}`
}

export function questionId(arena: string, productA: string, productB: string, opensAt: string): string {
  return `${arena}--${productA}-vs-${productB}--${dayOf(opensAt)}`
}

export function questionText(challengerName: string, leaderName: string, categoryName: string, settlesBy: string): string {
  return `Will ${challengerName} overtake ${leaderName} in ${categoryName} by ${dayOf(settlesBy)}?`
}

// Generate/refresh questions from the current close races. Idempotent by arena + unordered
// pair: an arena that already has an OPEN question for its top-2 pair contributes nothing
// (re-running on the same data appends zero questions); a settled question never blocks a new
// one — the next close race between the same two products is a new question with a new
// deadline. Existing questions are never mutated here (settlement is settleQuestions' job).
export function generateQuestions(
  existing: PredictionQuestion[],
  arenas: ArenaTop2Snapshot[],
  threshold: number = CLOSE_RACE_THRESHOLD,
): { questions: PredictionQuestion[]; added: PredictionQuestion[] } {
  const openPairs = new Set(existing.filter((q) => q.status === 'open').map((q) => pairKey(q.arena, q.productA, q.productB)))
  const knownIds = new Set(existing.map((q) => q.id))

  const added: PredictionQuestion[] = []
  for (const arena of [...arenas].sort((a, b) => a.categoryId.localeCompare(b.categoryId))) {
    const { top1, top2 } = arena
    if (!top1 || !top2) continue
    if (!isCloseRace(top1.aiEra, top2.aiEra, threshold)) continue
    if (openPairs.has(pairKey(arena.categoryId, top2.productId, top1.productId))) continue

    const opensAt = arena.generatedAt
    const settlesBy = addDays(opensAt, PREDICTION_WINDOW_DAYS)
    const id = questionId(arena.categoryId, top2.productId, top1.productId, opensAt)
    // Same pair re-opening on the same UTC day as an earlier question (open-settle-reopen inside
    // one day) would collide on id — skip rather than duplicate; the next run picks it up.
    if (knownIds.has(id)) continue

    const q: PredictionQuestion = {
      id,
      arena: arena.categoryId,
      question: questionText(top2.name, top1.name, arena.categoryName, settlesBy),
      productA: top2.productId,
      productB: top1.productId,
      opensAt,
      settlesBy,
      status: 'open',
    }
    added.push(q)
    openPairs.add(pairKey(q.arena, q.productA, q.productB))
    knownIds.add(q.id)
  }
  return { questions: [...existing, ...added], added }
}

/** The changelog-event reference a 'yes' settlement cites — traceable on /changelog. */
export function settlementRef(e: Extract<ChangeEvent, { kind: 'overtake' }>): string {
  return `overtake:${e.categoryId}:${e.productId}>${e.overtookId}@${e.date}`
}

// Settle open questions against the derived changelog. Pure and mechanical:
//   - 'yes' iff an overtake event with productId === productA (challenger) and
//     overtookId === productB (leader) exists in [opensAt, settlesBy] — the EARLIEST such event
//     is cited, since that's the moment the question's claim became true.
//   - 'no' iff `now` is past settlesBy with no qualifying flip (nothing to cite — the deadline
//     itself is the settlement).
//   - otherwise the question stays open. Already-settled questions are never touched.
// Flips in the other direction (the leader extending its lead, or re-overtaking later) don't
// settle anything; flips outside the window don't either.
export function settleQuestions(
  questions: PredictionQuestion[],
  events: ChangeEvent[],
  now: Date,
): { questions: PredictionQuestion[]; settled: PredictionQuestion[] } {
  const overtakes = events
    .filter((e): e is Extract<ChangeEvent, { kind: 'overtake' }> => e.kind === 'overtake')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const settled: PredictionQuestion[] = []
  const next = questions.map((q) => {
    if (q.status !== 'open') return q

    const opens = new Date(q.opensAt).getTime()
    const deadline = new Date(q.settlesBy).getTime()
    const flip = overtakes.find((e) => {
      const t = new Date(e.date).getTime()
      return e.categoryId === q.arena && e.productId === q.productA && e.overtookId === q.productB && t >= opens && t <= deadline
    })

    if (flip) {
      const done: PredictionQuestion = { ...q, status: 'settled', outcome: 'yes', settledBy: settlementRef(flip) }
      settled.push(done)
      return done
    }
    if (now.getTime() > deadline) {
      const done: PredictionQuestion = { ...q, status: 'settled', outcome: 'no' }
      settled.push(done)
      return done
    }
    return q
  })
  return { questions: next, settled }
}

// Tolerant-optional loader, same contract as popularity/claims in lib/data.ts: no
// rankings/predictions.json yet resolves to an empty list, never an error.
export function loadPredictions(dir: string = path.join(process.cwd(), 'rankings')): PredictionQuestion[] {
  const file = path.join(dir, PREDICTIONS_FILE)
  if (!fs.existsSync(file)) return []
  return PredictionsArraySchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
}
