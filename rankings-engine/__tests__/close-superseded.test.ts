import { describe, expect, it } from 'vitest'
import { closeSuperseded, listOpenItems, parseArgs, pickSuperseded, supersessionComment, type GhItem } from '../scripts/close-superseded'

// Supersession hygiene for the recurring generators: the new issue/PR closes the previous
// still-open one with a comment naming the successor. The gh runner is injected, so these tests
// pin the selection and the exact close invocations without a network or a gh binary.

const OPEN: GhItem[] = [
  { number: 410, title: 'vendor-radar: candidates 2026-10-20' },
  { number: 415, title: 'vendor-radar: needs-human candidates 2026-10-22' },
  { number: 401, title: 'yc-coverage: next bring-up candidates 2026-10-17' },
  { number: 420, title: 'vendor-radar: report ready on vendor-radar/123' },
  { number: 430, title: 'vendor-radar: needs-human candidates 2026-10-23' },
  // The standing founder-call list (#378). Its title shares the bare "vendor-radar: candidates"
  // prefix; only the date-anchored prefixes keep it out of supersession.
  { number: 378, title: 'vendor-radar: candidates needing a founder call' },
]

describe('pickSuperseded', () => {
  it('matches the date-anchored prefixes, excludes the successor, and closes oldest-first', () => {
    const picked = pickSuperseded(OPEN, ['vendor-radar: needs-human candidates 20', 'vendor-radar: candidates 20'], 430)
    expect(picked.map((i) => i.number)).toEqual([410, 415])
  })

  it('never matches the standing founder-call list under the date-anchored prefixes', () => {
    const picked = pickSuperseded(OPEN, ['vendor-radar: needs-human candidates 20', 'vendor-radar: candidates 20'], 430)
    expect(picked.map((i) => i.number)).not.toContain(378)
    // The regression this pins: the bare prefix DOES match the founder-call title.
    const bare = pickSuperseded(OPEN, ['vendor-radar: candidates'], 430)
    expect(bare.map((i) => i.number)).toContain(378)
  })

  it('leaves unrelated generators and non-matching titles open', () => {
    const picked = pickSuperseded(OPEN, ['accuracy-engine: work queue'], 999)
    expect(picked).toEqual([])
    // The compare-link fallback issue ("report ready on …") does not start with the candidates
    // prefixes and stays open: its branch holds an additive dated report.
    const radar = pickSuperseded(OPEN, ['vendor-radar: candidates 20'], 430)
    expect(radar.map((i) => i.number)).toEqual([410])
  })
})

describe('supersessionComment', () => {
  it('names the successor and keeps the merge boundary explicit for PRs', () => {
    expect(supersessionComment('issue', 430)).toContain('Superseded by #430')
    const pr = supersessionComment('pr', 77)
    expect(pr).toContain('Superseded by #77')
    expect(pr).toContain('fully regenerates')
    expect(pr).toContain('merges stay human')
  })
})

describe('listOpenItems', () => {
  it('narrows each listing server-side with an in:title search and unions the results by number', () => {
    const calls: string[][] = []
    const run = (args: string[]): string => {
      calls.push(args)
      // Loose server-side matching: both queries return an overlapping slice of OPEN.
      return JSON.stringify(OPEN.slice(0, 3))
    }
    const items = listOpenItems('issue', ['vendor-radar: needs-human candidates', 'vendor-radar: candidates'], run)
    expect(calls[0]).toEqual(['issue', 'list', '--state', 'open', '--limit', '100', '--search', 'in:title "vendor-radar: needs-human candidates"', '--json', 'number,title'])
    expect(calls[1]).toEqual(['issue', 'list', '--state', 'open', '--limit', '100', '--search', 'in:title "vendor-radar: candidates"', '--json', 'number,title'])
    expect(items.map((i) => i.number).sort((a, b) => a - b)).toEqual([401, 410, 415])
  })
})

describe('closeSuperseded', () => {
  it('lists open items per prefix, then closes each superseded one with the naming comment', () => {
    const calls: string[][] = []
    const run = (args: string[]): string => {
      calls.push(args)
      if (args[1] === 'list') return JSON.stringify(OPEN)
      return ''
    }
    const closed = closeSuperseded({ kind: 'issue', prefixes: ['vendor-radar: needs-human candidates 20', 'vendor-radar: candidates 20'], successor: 430, run })
    expect(closed.map((i) => i.number)).toEqual([410, 415])
    expect(calls.filter((c) => c[1] === 'list')).toHaveLength(2)
    expect(calls.at(-2)).toEqual(['issue', 'close', '410', '--comment', supersessionComment('issue', 430)])
    expect(calls.at(-1)).toEqual(['issue', 'close', '415', '--comment', supersessionComment('issue', 430)])
    expect(calls).toHaveLength(4)
  })

  it('never issues a merge command, only close', () => {
    const calls: string[][] = []
    const run = (args: string[]): string => {
      calls.push(args)
      if (args[1] === 'list') return JSON.stringify([{ number: 70, title: 'accuracy-engine: weekly staleness report' }])
      return ''
    }
    closeSuperseded({ kind: 'pr', prefixes: ['accuracy-engine: weekly staleness report'], successor: 77, run })
    expect(calls.some((c) => c.includes('merge'))).toBe(false)
    expect(calls[1]).toEqual(['pr', 'close', '70', '--comment', supersessionComment('pr', 77)])
  })

  it('rejects a malformed gh listing instead of guessing', () => {
    const run = (): string => '{"not":"an array"}'
    expect(() => closeSuperseded({ kind: 'issue', prefixes: ['x'], successor: 1, run })).toThrow()
  })
})

describe('parseArgs', () => {
  it('parses kind, successor, and repeatable title prefixes', () => {
    expect(
      parseArgs(['--kind', 'issue', '--successor', '430', '--title-prefix', 'a', '--title-prefix', 'b']),
    ).toEqual({ kind: 'issue', successor: 430, prefixes: ['a', 'b'] })
  })

  it('fails on a missing or malformed successor, kind, or prefix', () => {
    expect(() => parseArgs(['--kind', 'issue', '--title-prefix', 'a'])).toThrow(/usage/)
    expect(() => parseArgs(['--kind', 'issue', '--successor', 'not-a-number', '--title-prefix', 'a'])).toThrow(/usage/)
    expect(() => parseArgs(['--kind', 'branch', '--successor', '1', '--title-prefix', 'a'])).toThrow(/--kind/)
    expect(() => parseArgs(['--kind', 'pr', '--successor', '1'])).toThrow(/usage/)
    expect(() => parseArgs(['--unknown'])).toThrow(/unknown argument/)
  })
})
