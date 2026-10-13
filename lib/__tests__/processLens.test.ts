// The process lens (lib/processLensCore.ts): pure resolution semantics over the pre-serialized
// ProcessCheckStep rows — lens > stack > null, a lens pick without judged step evidence falls
// through, a shutdown vendor is never resolvable FROM the lens (offer surface) while a stack
// shutdown pick still resolves (the reader really runs it) — plus the banner's process-score
// math, which must be processLeaderboard's exact normalization (sum / rankable, one decimal).
import { describe, expect, it } from 'vitest'
import type { ProcessCheckStep } from '@/lib/processCheck'
import {
  encodeViaParam,
  lensGapFor,
  lensProcessSummary,
  parseLensState,
  parseViaParam,
  resolveStepVendor,
  serializeLensState,
} from '@/lib/processLensCore'

function step(overrides: Partial<ProcessCheckStep>): ProcessCheckStep {
  return {
    nodeId: 'n1',
    label: 'Open the account',
    storyCount: 3,
    arenas: [
      {
        arenaId: 'startup-banking',
        arenaName: 'Startup banking',
        kind: 'function',
        vendors: [
          { productId: 'best-bank', name: 'Best Bank', score: 90 },
          { productId: 'mid-bank', name: 'Mid Bank', score: 71 },
          { productId: 'my-bank', name: 'My Bank', score: 60 },
          { productId: 'dead-bank', name: 'Dead Bank', score: 85, shutdown: true },
        ],
      },
    ],
    best: { productId: 'best-bank', name: 'Best Bank', score: 90, arenaId: 'startup-banking' },
    ...overrides,
  }
}

const withExtra = (): ProcessCheckStep =>
  step({
    arenas: [
      ...step({}).arenas,
      {
        arenaId: 'ai-assistants',
        arenaName: 'AI assistants',
        kind: 'extra',
        vendors: [{ productId: 'chatgpt', name: 'ChatGPT', score: 55 }],
      },
    ],
  })

describe('parseLensState / serializeLensState', () => {
  it('round-trips and sorts keys canonically', () => {
    const state = { picks: { b: 'y', a: 'x' }, names: { y: 'Y Inc', x: 'X Inc' } }
    const raw = serializeLensState(state)
    expect(raw.indexOf('"a"')).toBeLessThan(raw.indexOf('"b"'))
    expect(parseLensState(raw)).toEqual(state)
  })

  it('degrades junk entry-wise and garbage wholesale, never a crash', () => {
    expect(parseLensState(null)).toEqual({ picks: {}, names: {} })
    expect(parseLensState('not json')).toEqual({ picks: {}, names: {} })
    expect(parseLensState('[1,2]')).toEqual({ picks: {}, names: {} })
    expect(parseLensState('{"picks":{"a":"x","b":7,"c":""},"names":["nope"]}')).toEqual({
      picks: { a: 'x' },
      names: {},
    })
  })
})

describe('resolveStepVendor — lens > stack > null', () => {
  it('an explicit lens pick beats the stack pick', () => {
    const r = resolveStepVendor(step({}), { 'startup-banking': 'mid-bank' }, { 'startup-banking': ['my-bank'] })
    expect(r).toMatchObject({ source: 'lens', vendor: { productId: 'mid-bank', score: 71 } })
  })

  it('a lens vendor not in the step vendor list falls through to the stack, then to null', () => {
    const s = step({})
    const viaStack = resolveStepVendor(s, { 'startup-banking': 'ghost-bank' }, { 'startup-banking': ['my-bank'] })
    expect(viaStack).toMatchObject({ source: 'stack', vendor: { productId: 'my-bank' } })
    expect(resolveStepVendor(s, { 'startup-banking': 'ghost-bank' }, {})).toBeNull()
    expect(resolveStepVendor(s, {}, {})).toBeNull()
  })

  it('a lens pick in an EXTRA arena serves the step when the covering arena has none', () => {
    const r = resolveStepVendor(withExtra(), { 'ai-assistants': 'chatgpt' }, {})
    expect(r).toMatchObject({
      source: 'lens',
      vendor: { productId: 'chatgpt', arenaId: 'ai-assistants', arenaName: 'AI assistants' },
    })
  })

  it('a lens pick for an unrelated arena resolves nothing', () => {
    expect(resolveStepVendor(step({}), { payroll: 'gusto' }, {})).toBeNull()
  })

  it('a shutdown vendor is NEVER resolvable from the lens, but a stack shutdown pick still is', () => {
    const s = step({})
    // Lens → shutdown: falls through (to stack when present, else null) — never offered.
    expect(resolveStepVendor(s, { 'startup-banking': 'dead-bank' }, {})).toBeNull()
    const fallthrough = resolveStepVendor(s, { 'startup-banking': 'dead-bank' }, { 'startup-banking': ['my-bank'] })
    expect(fallthrough).toMatchObject({ source: 'stack', vendor: { productId: 'my-bank' } })
    // Stack → shutdown: resolves (the reader really runs it; the check tells them to migrate).
    const stackShutdown = resolveStepVendor(s, {}, { 'startup-banking': ['dead-bank'] })
    expect(stackShutdown).toMatchObject({ source: 'stack', vendor: { productId: 'dead-bank', shutdown: true } })
  })

  it('a multi-pick stack resolves to the BEST covered pick (yoursForStep semantics)', () => {
    const r = resolveStepVendor(step({}), {}, { 'startup-banking': ['my-bank', 'mid-bank'] })
    expect(r).toMatchObject({ source: 'stack', vendor: { productId: 'mid-bank', score: 71 } })
    // The lens (an explicit single view choice) still beats every stack pick.
    const viaLens = resolveStepVendor(step({}), { 'startup-banking': 'my-bank' }, { 'startup-banking': ['my-bank', 'mid-bank'] })
    expect(viaLens).toMatchObject({ source: 'lens', vendor: { productId: 'my-bank' } })
  })
})

describe('lensGapFor — the honest "not covered by <Vendor>" note', () => {
  it('names a lens pick with no judged evidence on the step', () => {
    expect(lensGapFor(step({}), { 'startup-banking': 'ghost-bank' })).toEqual({
      arenaId: 'startup-banking',
      arenaName: 'Startup banking',
      productId: 'ghost-bank',
    })
  })

  it('a covering pick, an unrelated-arena pick, and an empty lens are not gaps', () => {
    expect(lensGapFor(step({}), { 'startup-banking': 'mid-bank' })).toBeNull()
    expect(lensGapFor(step({}), { payroll: 'gusto' })).toBeNull()
    expect(lensGapFor(step({}), {})).toBeNull()
  })

  it('a lens pick resolving to a shutdown vendor is a gap (never offered)', () => {
    expect(lensGapFor(step({}), { 'startup-banking': 'dead-bank' })?.productId).toBe('dead-bank')
  })
})

describe('lensProcessSummary — processLeaderboard normalization, client-safe', () => {
  it('sums resolved step scores over ALL rankable steps (unserved = 0) and normalizes', () => {
    const steps = [
      step({ nodeId: 'a' }), // lens serves via mid-bank at 71
      step({
        nodeId: 'b',
        arenas: [
          { arenaId: 'payroll', arenaName: 'Payroll', kind: 'function', vendors: [{ productId: 'gusto', name: 'Gusto', score: 80 }] },
        ],
        best: { productId: 'gusto', name: 'Gusto', score: 80, arenaId: 'payroll' },
      }), // unserved → 0
    ]
    const summary = lensProcessSummary(steps, { 'startup-banking': 'mid-bank' }, {})
    expect(summary.rankable).toBe(2)
    expect(summary.served).toBe(1)
    expect(summary.score).toBe(Math.round((71 / 2) * 10) / 10) // 35.5 — sum/rankable, one decimal
    expect(summary.vendors).toEqual([{ productId: 'mid-bank', name: 'Mid Bank', source: 'lens' }])
  })

  it('mixes lens and stack sources, dedupes vendors, and handles the empty page', () => {
    const steps = [step({ nodeId: 'a' }), step({ nodeId: 'b' }), step({ nodeId: 'c' })]
    const summary = lensProcessSummary(
      steps,
      { 'startup-banking': 'mid-bank' },
      { 'startup-banking': ['my-bank'] }, // shadowed by the lens on every step
    )
    expect(summary.served).toBe(3)
    expect(summary.vendors).toEqual([{ productId: 'mid-bank', name: 'Mid Bank', source: 'lens' }])
    expect(summary.score).toBe(71)
    expect(lensProcessSummary([], {}, {})).toEqual({ vendors: [], served: 0, rankable: 0, score: 0 })
  })
})

describe('shareable ?via param (parseViaParam / encodeViaParam)', () => {
  it('parses comma-separated and repeated forms identically', () => {
    const want = { 'startup-banking': 'mid-bank', payroll: 'gusto' }
    expect(parseViaParam(['startup-banking:mid-bank,payroll:gusto'])).toEqual(want)
    expect(parseViaParam(['startup-banking:mid-bank', 'payroll:gusto'])).toEqual(want)
  })

  it('skips invalid entries silently — a mangled shared URL degrades, never crashes', () => {
    expect(parseViaParam(['no-colon', ':no-arena', 'no-product:', '', 'ok:fine'])).toEqual({ ok: 'fine' })
    expect(parseViaParam([])).toEqual({})
  })

  it('splits on the FIRST colon so a product id containing one survives', () => {
    expect(parseViaParam(['arena:prod:v2'])).toEqual({ arena: 'prod:v2' })
  })

  it('encodes sorted + comma-joined, and an empty lens encodes to null (param deleted)', () => {
    expect(encodeViaParam({ payroll: 'gusto', banking: 'mercury' })).toBe('banking:mercury,payroll:gusto')
    expect(encodeViaParam({})).toBeNull()
  })

  it('round-trips: encode(parse(v)) is canonical for any valid value', () => {
    const picks = parseViaParam(['b:two,a:one'])
    expect(encodeViaParam(picks)).toBe('a:one,b:two')
    expect(parseViaParam([encodeViaParam(picks) as string])).toEqual(picks)
  })
})
