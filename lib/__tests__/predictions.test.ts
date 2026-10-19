import { describe, expect, it } from 'vitest'
import type { ChangeEvent } from '@/lib/changelog'
import {
  generateQuestions, PREDICTION_WINDOW_DAYS, questionId, settleQuestions, settlementRef,
  type ArenaTop2Snapshot, type PredictionQuestion,
} from '@/lib/predictions'

function snapshot(overrides: Partial<ArenaTop2Snapshot> = {}): ArenaTop2Snapshot {
  return {
    categoryId: 'ai-coding',
    categoryName: 'AI Coding Agents',
    generatedAt: '2026-09-04T10:00:00.000Z',
    top1: { productId: 'claude-code', name: 'Claude Code', aiEra: 40.0 },
    top2: { productId: 'cline', name: 'Cline', aiEra: 38.5 },
    ...overrides,
  }
}

function overtake(overrides: Partial<Extract<ChangeEvent, { kind: 'overtake' }>> = {}): ChangeEvent {
  return {
    kind: 'overtake',
    date: '2026-09-12T06:00:00.000Z',
    categoryId: 'ai-coding',
    categoryName: 'AI Coding Agents',
    productId: 'cline',
    productName: 'Cline',
    productAiEra: 40.2,
    overtookId: 'claude-code',
    overtookName: 'Claude Code',
    overtookAiEra: 40.0,
    ...overrides,
  }
}

describe('generateQuestions', () => {
  it('opens a question for a close race: challenger vs leader, 30-day deadline, honest text', () => {
    const { questions, added } = generateQuestions([], [snapshot()])
    expect(added).toHaveLength(1)
    expect(questions).toEqual(added)
    expect(added[0]).toEqual({
      id: 'ai-coding--cline-vs-claude-code--2026-09-04',
      arena: 'ai-coding',
      question: 'Will Cline overtake Claude Code in AI Coding Agents by 2026-10-04?',
      productA: 'cline',
      productB: 'claude-code',
      opensAt: '2026-09-04T10:00:00.000Z',
      settlesBy: '2026-10-04T10:00:00.000Z',
      status: 'open',
    })
    // The deadline really is opensAt + the advertised window.
    expect(new Date(added[0].settlesBy).getTime() - new Date(added[0].opensAt).getTime()).toBe(
      PREDICTION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    )
  })

  it('skips arenas that are not close races, have null aiEra, or fewer than 2 ranked products', () => {
    const wide = snapshot({ categoryId: 'a', top1: { productId: 'x', name: 'X', aiEra: 50 }, top2: { productId: 'y', name: 'Y', aiEra: 40 } })
    const nullish = snapshot({ categoryId: 'b', top1: { productId: 'x', name: 'X', aiEra: null } })
    const solo = snapshot({ categoryId: 'c', top2: null })
    expect(generateQuestions([], [wide, nullish, solo]).added).toEqual([])
  })

  it('a tie (Δ0.0) is still a close race', () => {
    const tie = snapshot({ top1: { productId: 'a', name: 'A', aiEra: 18.6 }, top2: { productId: 'b', name: 'B', aiEra: 18.6 } })
    expect(generateQuestions([], [tie]).added).toHaveLength(1)
  })

  it('is idempotent: re-running on the same data (and a later snapshot of the same open pair) adds nothing', () => {
    const first = generateQuestions([], [snapshot()])
    // Exact same snapshot.
    expect(generateQuestions(first.questions, [snapshot()]).added).toEqual([])
    // A newer snapshot of the same still-open pair — even with the two products swapped
    // (the challenger already overtook but the question hasn't settled yet): same race,
    // no duplicate question.
    const swapped = snapshot({
      generatedAt: '2026-09-10T10:00:00.000Z',
      top1: { productId: 'cline', name: 'Cline', aiEra: 40.2 },
      top2: { productId: 'claude-code', name: 'Claude Code', aiEra: 40.0 },
    })
    expect(generateQuestions(first.questions, [swapped]).added).toEqual([])
  })

  it('a settled question does not block a new one for the same pair', () => {
    const settled: PredictionQuestion = {
      ...generateQuestions([], [snapshot()]).added[0],
      status: 'settled',
      outcome: 'no',
    }
    const later = snapshot({ generatedAt: '2026-10-06T10:00:00.000Z' })
    const { added } = generateQuestions([settled], [later])
    expect(added).toHaveLength(1)
    expect(added[0].id).toBe('ai-coding--cline-vs-claude-code--2026-10-06')
    expect(added[0].opensAt).toBe('2026-10-06T10:00:00.000Z')
  })

  it('never collides on id: same pair re-opening on the same UTC day is skipped, not duplicated', () => {
    const sameDaySettled: PredictionQuestion = {
      ...generateQuestions([], [snapshot()]).added[0],
      status: 'settled',
      outcome: 'yes',
    }
    // A second snapshot from later the same day would mint the same id — skipped.
    const sameDay = snapshot({ generatedAt: '2026-09-04T22:00:00.000Z' })
    expect(generateQuestions([sameDaySettled], [sameDay]).added).toEqual([])
  })

  it('a different arena with the same product pair is an independent question', () => {
    const other = snapshot({ categoryId: 'terminals', categoryName: 'Terminals' })
    const first = generateQuestions([], [snapshot()])
    const { added } = generateQuestions(first.questions, [other])
    expect(added).toHaveLength(1)
    expect(added[0].id).toBe(questionId('terminals', 'cline', 'claude-code', '2026-09-04T10:00:00.000Z'))
  })
})

describe('settleQuestions', () => {
  const open = generateQuestions([], [snapshot()]).added[0]
  // Well inside the window: opens 2026-09-04, settles by 2026-10-04.
  const midWindow = new Date('2026-09-20T00:00:00Z')
  const afterDeadline = new Date('2026-10-05T00:00:00Z')

  it("settles 'yes' on a qualifying flip inside the window, citing the changelog event", () => {
    const { questions, settled } = settleQuestions([open], [overtake()], midWindow)
    expect(settled).toHaveLength(1)
    expect(questions[0]).toEqual({
      ...open,
      status: 'settled',
      outcome: 'yes',
      settledBy: 'overtake:ai-coding:cline>claude-code@2026-09-12T06:00:00.000Z',
    })
  })

  it('cites the EARLIEST qualifying flip when there are several', () => {
    const later = overtake({ date: '2026-09-25T00:00:00.000Z' })
    const { questions } = settleQuestions([open], [later, overtake()], afterDeadline)
    expect(questions[0].settledBy).toBe(settlementRef(overtake() as Extract<ChangeEvent, { kind: 'overtake' }>))
  })

  it('ignores flips outside the window, in the wrong direction, wrong arena, or non-overtake events', () => {
    const before = overtake({ date: '2026-09-01T00:00:00.000Z' }) // before opensAt
    const after = overtake({ date: '2026-10-10T00:00:00.000Z' }) // after settlesBy
    const reverse = overtake({ productId: 'claude-code', overtookId: 'cline' }) // leader re-extending
    const elsewhere = overtake({ categoryId: 'terminals' })
    const move: ChangeEvent = {
      kind: 'score-move', date: '2026-09-12T06:00:00.000Z', categoryId: 'ai-coding',
      categoryName: 'AI Coding Agents', productId: 'cline', productName: 'Cline', delta: 2.5, to: 41,
    }
    // Still inside the window with no qualifying flip: stays open, untouched.
    const { questions, settled } = settleQuestions([open], [before, after, reverse, elsewhere, move], midWindow)
    expect(settled).toEqual([])
    expect(questions).toEqual([open])
  })

  it("settles 'no' once the deadline passes without a qualifying flip — no event to cite", () => {
    const { questions, settled } = settleQuestions([open], [], afterDeadline)
    expect(settled).toHaveLength(1)
    expect(questions[0]).toEqual({ ...open, status: 'settled', outcome: 'no' })
    expect(questions[0].settledBy).toBeUndefined()
  })

  it('never touches already-settled questions, even when a matching flip exists', () => {
    const done: PredictionQuestion = { ...open, status: 'settled', outcome: 'no' }
    const { questions, settled } = settleQuestions([done], [overtake()], afterDeadline)
    expect(settled).toEqual([])
    expect(questions).toEqual([done])
  })

  it('never cites a voided settlement ref: a reopened question skips the annulled flip', () => {
    const annulledRef = settlementRef(overtake() as Extract<ChangeEvent, { kind: 'overtake' }>)
    const reopened: PredictionQuestion = {
      ...open,
      note: 'reopened: the cited overtake came from later-reverted judge churn',
      voidedSettlements: [annulledRef],
    }
    // Inside the window, the only qualifying flip is the annulled one: stays open.
    const mid = settleQuestions([reopened], [overtake()], midWindow)
    expect(mid.settled).toEqual([])
    expect(mid.questions).toEqual([reopened])
    // A later, non-voided flip still settles 'yes' and is the one cited.
    const fresh = overtake({ date: '2026-09-25T00:00:00.000Z' })
    const again = settleQuestions([reopened], [overtake(), fresh], midWindow)
    expect(again.settled).toHaveLength(1)
    expect(again.questions[0].settledBy).toBe(settlementRef(fresh as Extract<ChangeEvent, { kind: 'overtake' }>))
    // Past the deadline with only the annulled flip, it settles 'no' (nothing citable).
    const late = settleQuestions([reopened], [overtake()], afterDeadline)
    expect(late.questions[0].outcome).toBe('no')
  })

  it('is idempotent: settling an already-settled batch changes nothing', () => {
    const first = settleQuestions([open], [overtake()], afterDeadline)
    const second = settleQuestions(first.questions, [overtake()], afterDeadline)
    expect(second.settled).toEqual([])
    expect(second.questions).toEqual(first.questions)
  })
})
