import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { modelDecimalRound, vestedMonthlyShares, type DecimalRoundInput } from '../capTableDecimal'
import { buildCapTable } from '../capTable'
import { addMonthsClamped } from '../calendar'

const base = (): DecimalRoundInput => ({
  fullyDilutedShares: '10000000', availablePoolShares: '750000',
  safes: [], preMoney: '15000000', poolTargetPct: 10,
  investments: [{ holderId: 'investor', amount: '5000000' }],
})

describe('decimal-string financing contract', () => {
  it('replays YC Appendix II SAFE ownership while retaining higher price precision', () => {
    const input = base()
    input.safes = [
      { id: 'a', holderId: 'a', amount: '200000', cap: '4000000' },
      { id: 'b', holderId: 'b', amount: '800000', cap: '8000000' },
    ]
    const result = modelDecimalRound(input)
    expect(result.conversions.map(s => s.shares)).toEqual(['588235', '1176470'])
    expect(result.poolPct).toMatch(/^10\.00000/)
    expect(result.pricePerShare).toMatch(/^\d+\.\d{18}$/)
    const report = buildCapTable([
      { kind: 'found', founders: [{ name: 'Founder', shares: 9250000 }], poolShares: 750000 },
      { kind: 'safe', name: 'a', amount: 200000, cap: 4000000 },
      { kind: 'safe', name: 'b', amount: 800000, cap: 8000000 },
      { kind: 'priced', name: 'A', preMoney: 15000000, newMoney: 5000000, poolTargetPct: 10 },
    ])
    expect(report.error).toBeUndefined()
    // Legacy educational output remains rounded to four places.
    expect(report.snapshots.at(-1)?.round?.pps).toBe(1.1802)
    expect(Number(result.pricePerShare)).not.toBe(1.1802)
  })
  it('supports prices below four decimal places without floating-point loss', () => {
    const result = modelDecimalRound({ ...base(), preMoney: '0.10', poolTargetPct: 0,
      investments: [{ holderId: 'investor', amount: '0.025' }] })
    expect(result.pricePerShare).toBe('0.000000010000000000')
    expect(result.allocations[0].shares).toBe('2500000')
  })
  it('uses the better discount or cap conversion route', () => {
    const input = base()
    input.safes = [{ id: 'a', holderId: 'a', amount: '500000', discountPct: 20 }]
    expect(modelDecimalRound(input).conversions[0].method).toBe('discount')
    input.safes[0].cap = '5000000'
    expect(modelDecimalRound(input).conversions[0].method).toBe('cap')
  })
  it('conserves capitalization and reports sub-share cash for synthetic rounds', () => {
    for (let i = 1; i <= 80; i++) {
      const input = base()
      input.preMoney = String(10000000 + i * 12345)
      input.poolTargetPct = i % 20
      input.safes = [{ id: 'a', holderId: 'a', amount: String(i * 1000), cap: '9000000' }]
      input.investments.push({ holderId: 'second', amount: String(i * 1234) })
      const result = modelDecimalRound(input)
      const shares = [input.fullyDilutedShares, result.poolIncrease,
        ...result.conversions.map(s => s.shares), ...result.allocations.map(s => s.shares)]
      expect(shares.reduce((n, s) => n.plus(s), new Decimal(0)).toFixed()).toBe(result.fullyDilutedShares)
      for (const allocation of result.allocations) {
        expect(new Decimal(allocation.unallocatedCash).gte(0)).toBe(true)
        expect(new Decimal(allocation.unallocatedCash).lte(result.pricePerShare)).toBe(true)
      }
      expect(modelDecimalRound(input)).toEqual(result)
    }
  })
  it.each([
    { preMoney: '0' }, { preMoney: 'NaN' }, { preMoney: '1e10' },
    { fullyDilutedShares: '0' }, { fullyDilutedShares: '1.5' },
    { availablePoolShares: '10000001' }, { poolTargetPct: -1 }, { poolTargetPct: Infinity },
    { investments: [] }, { investments: [{ holderId: 'a', amount: '-1' }] },
    { safes: [{ id: 'a', holderId: 'a', amount: '1', discountPct: 100 }] },
    { safes: [{ id: 'a', holderId: 'a', amount: '1', cap: '0' }] },
    { safes: [{ id: 'a', holderId: 'a', amount: '0' }] },
    { safes: [{ id: 'a', holderId: 'a', amount: '1' }, { id: 'a', holderId: 'b', amount: '1' }] },
  ])('rejects invalid standalone inputs %j', invalid => {
    expect(() => modelDecimalRound({ ...base(), ...invalid })).toThrow(RangeError)
  })
  it('rejects unreachable pool targets and overcommitted SAFE claims', () => {
    expect(() => modelDecimalRound({ ...base(), poolTargetPct: 90 })).toThrow(/unreachable/)
    expect(() => modelDecimalRound({ ...base(), safes: [
      { id: 'a', holderId: 'a', amount: '8000000', cap: '9000000' },
      { id: 'b', holderId: 'b', amount: '2000000', cap: '3000000' },
    ] })).toThrow(/100%/)
  })
  it('uses the public clamped-calendar convention for month-end anniversaries', () => {
    expect(addMonthsClamped('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonthsClamped('2023-01-31', 1)).toBe('2023-02-28')
    expect(addMonthsClamped('2024-02-29', 12)).toBe('2025-02-28')
    expect(() => addMonthsClamped('2023-02-29', 1)).toThrow(RangeError)
  })
})

it('vests monthly on public calendar dates with cliff and termination cutoffs', () => {
  const input = { shares: '10000001', start: '2024-01-31', months: 48, cliffMonths: 12, asOf: '2025-01-30' };
  expect(vestedMonthlyShares(input)).toBe('0');
  expect(vestedMonthlyShares({ ...input, asOf: '2025-01-31' })).toBe('2500000');
  expect(vestedMonthlyShares({ ...input, asOf: '2028-01-31' })).toBe('10000001');
  expect(vestedMonthlyShares({ ...input, asOf: '2028-01-31', terminatedAt: '2025-01-31' })).toBe('2500000');
});

it('accepts aggregate capitalization above an individual security limit', () => {
  const result = modelDecimalRound({ ...base(), fullyDilutedShares: '1999999999999998',
    availablePoolShares: '0', poolTargetPct: 0 });
  expect(new Decimal(result.fullyDilutedShares).gt('1999999999999998')).toBe(true);
});
it('preserves early calendar years and rejects out-of-range anniversaries', () => {
  expect(addMonthsClamped('0099-01-31', 1)).toBe('0099-02-28');
  expect(addMonthsClamped('0000-01-31', 1)).toBe('0000-02-29');
  expect(() => addMonthsClamped('9999-12-31', 1)).toThrow(RangeError);
});
