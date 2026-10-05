import { describe, expect, it } from 'vitest'
import { pairKey } from '../integrations'
import type { MyStackProduct } from '../myStack'
import {
  aggregateStack,
  battleVerdict,
  encodeBattleSideParam,
  MAX_BATTLE_SIDE,
  parseBattleSideParam,
  slotComparisons,
  VERDICT_EVEN_DELTA,
  type BattleSideState,
} from '../stackBattle'

function product(overrides: Partial<MyStackProduct>): MyStackProduct {
  return {
    id: 'p',
    name: 'P',
    vendor: 'P Inc',
    arenaId: 'payments',
    arenaName: 'Payments',
    type: 'commercial',
    aiEra: 50,
    agentReady: 50,
    confidence: 'B',
    rank: 1,
    fieldSize: 3,
    hasLogo: false,
    ...overrides,
  }
}

describe('aggregateStack', () => {
  const stack = [
    product({ id: 'stripe', name: 'Stripe', arenaId: 'payments', aiEra: 84, agentReady: 90 }),
    product({ id: 'mercury', name: 'Mercury', arenaId: 'startup-banking', arenaName: 'Startup banking', aiEra: 78, agentReady: 70 }),
    product({ id: 'oldtool', name: 'OldTool', arenaId: 'crm', arenaName: 'CRM', aiEra: 55, agentReady: null }),
  ]

  it('computes means, coverage, interconnects, and the weakest link', () => {
    const agg = aggregateStack(stack, [pairKey('stripe', 'mercury')])
    expect(agg.productCount).toBe(3)
    expect(agg.arenaCount).toBe(3)
    expect(agg.meanAiEra).toBeCloseTo((84 + 78 + 55) / 3, 1)
    expect(agg.aiEraCount).toBe(3)
    expect(agg.meanAgentReady).toBe(80) // only stripe + mercury have agentReady
    expect(agg.agentReadyCount).toBe(2)
    expect(agg.possiblePairs).toBe(3)
    expect(agg.verifiedInterconnects).toBe(1)
    expect(agg.weakestLink?.id).toBe('oldtool')
  })

  it('handles unscored products honestly — null means, no invented weakest link', () => {
    const agg = aggregateStack([product({ aiEra: null, agentReady: null })], [])
    expect(agg.meanAiEra).toBeNull()
    expect(agg.meanAgentReady).toBeNull()
    expect(agg.weakestLink).toBeNull()
  })

  it('skips same-id pairs (a product fielded twice has nothing to interconnect)', () => {
    const twice = [
      product({ id: 'square', arenaId: 'payments' }),
      product({ id: 'square', arenaId: 'mobile-payments', arenaName: 'Mobile payments' }),
    ]
    expect(aggregateStack(twice, []).possiblePairs).toBe(0)
  })
})

describe('slotComparisons', () => {
  const a = [
    product({ id: 'stripe', name: 'Stripe', arenaId: 'payments', aiEra: 84 }),
    product({ id: 'linear', name: 'Linear', arenaId: 'project-management', arenaName: 'Project management', aiEra: 80 }),
  ]
  const b = [
    product({ id: 'adyen', name: 'Adyen', arenaId: 'payments', aiEra: 76 }),
    product({ id: 'mercury', name: 'Mercury', arenaId: 'startup-banking', arenaName: 'Startup banking', aiEra: 78 }),
  ]

  it('builds one row per arena (union of both sides), sorted by arena name, with per-slot winners', () => {
    const slots = slotComparisons(a, b, ['payments/stripe-vs-adyen'])
    expect(slots.map((s) => s.arenaId)).toEqual(['payments', 'project-management', 'startup-banking'])
    const payments = slots[0]
    expect(payments.winner).toBe('a')
    expect(payments.battleHref).toBe('/arena/payments/battle/stripe-vs-adyen')
    // Arenas only one side covers have no winner — an empty slot isn't a loss.
    expect(slots[1].winner).toBeNull()
    expect(slots[2].winner).toBeNull()
  })

  it('finds the judged battle in either stored order, and never links a battle that does not exist', () => {
    expect(slotComparisons(a, b, ['payments/adyen-vs-stripe'])[0].battleHref).toBe('/arena/payments/battle/adyen-vs-stripe')
    expect(slotComparisons(a, b, [])[0].battleHref).toBeNull()
    // The arena prefix is part of the key: another arena's battle for the same pair never
    // links this slot (a few pairs battle in two arenas).
    expect(slotComparisons(a, b, ['frontier-models/stripe-vs-adyen'])[0].battleHref).toBeNull()
  })

  it('declares a tie on equal best scores and no winner when a side is unscored', () => {
    const tied = slotComparisons(
      [product({ id: 'x', aiEra: 80 })],
      [product({ id: 'y', aiEra: 80 })],
      [],
    )
    expect(tied[0].winner).toBe('tie')
    const unscored = slotComparisons(
      [product({ id: 'x', aiEra: 80 })],
      [product({ id: 'y', aiEra: null })],
      [],
    )
    expect(unscored[0].winner).toBeNull()
  })

  it('only links a judged battle when each side fields exactly one product in the slot', () => {
    const slots = slotComparisons(
      [product({ id: 'x', aiEra: 80 }), product({ id: 'z', aiEra: 70 })],
      [product({ id: 'y', aiEra: 75 })],
      ['x-vs-y'],
    )
    expect(slots[0].battleHref).toBeNull()
  })
})

describe('battleVerdict', () => {
  const agg = (meanAiEra: number | null, count = 4) => ({
    productCount: count,
    arenaCount: count,
    meanAiEra,
    aiEraCount: count,
    meanAgentReady: null,
    agentReadyCount: 0,
    verifiedInterconnects: 2,
    possiblePairs: 6,
    weakestLink: null,
  })

  it('names the leader with both means and refuses to crown a winner inside the noise band', () => {
    const verdict = battleVerdict('Alpha', 'Beta', agg(80), agg(72))
    expect(verdict).toContain('Alpha leads on mean Overall score, 80.0/100 vs 72.0/100')
    expect(verdict).toContain('not a judged head-to-head')
    const even = battleVerdict('Alpha', 'Beta', agg(80), agg(80 - VERDICT_EVEN_DELTA / 2))
    expect(even).toContain('effectively even')
  })

  it('includes the verified-interconnect comparison when both sides have pairs', () => {
    expect(battleVerdict('A', 'B', agg(80), agg(70))).toContain('verified interconnects 2/6 vs 2/6')
  })

  it('is honest when a side has no scored products', () => {
    expect(battleVerdict('A', 'B', agg(null), agg(70))).toContain('Not enough scored products')
  })
})

describe('battle side URL state', () => {
  const validIds = new Set(['stripe', 'linear', 'slack'])
  const presetIds = new Set(['agentic-founder', 'financial-ops'])

  it('matches a preset id first, then falls back to a validated custom id list', () => {
    expect(parseBattleSideParam('agentic-founder', validIds, presetIds)).toEqual({
      kind: 'preset',
      presetId: 'agentic-founder',
    })
    expect(parseBattleSideParam('stripe,ghost,linear,stripe', validIds, presetIds)).toEqual({
      kind: 'custom',
      ids: ['stripe', 'linear'],
    })
  })

  it('degrades unknown or empty input to the empty side', () => {
    expect(parseBattleSideParam(null, validIds, presetIds)).toEqual({ kind: 'empty' })
    expect(parseBattleSideParam('ghost,phantom', validIds, presetIds)).toEqual({ kind: 'empty' })
  })

  it('caps a custom side', () => {
    const many = Array.from({ length: MAX_BATTLE_SIDE + 3 }, (_, i) => `p${i}`)
    const parsed = parseBattleSideParam(many.join(','), new Set(many), presetIds)
    expect(parsed.kind).toBe('custom')
    if (parsed.kind === 'custom') expect(parsed.ids).toHaveLength(MAX_BATTLE_SIDE)
  })

  it('round-trips both side kinds through encode', () => {
    const preset: BattleSideState = { kind: 'preset', presetId: 'financial-ops' }
    const custom: BattleSideState = { kind: 'custom', ids: ['stripe', 'slack'] }
    expect(parseBattleSideParam(encodeBattleSideParam(preset), validIds, presetIds)).toEqual(preset)
    expect(parseBattleSideParam(encodeBattleSideParam(custom), validIds, presetIds)).toEqual(custom)
    expect(encodeBattleSideParam({ kind: 'empty' })).toBe('')
  })
})
