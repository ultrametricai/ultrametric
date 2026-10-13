import { describe, expect, it } from 'vitest'
import {
  LORE_MAX,
  LORE_MIN,
  VERACITY_GRADES,
  loadStartupLore,
  parseStartupLore,
  validateLore,
  validateStartupLore,
} from '@/lib/lore'
import type { StartupLaw } from '@/lib/citations'

// The startup-lore gates (LAWS.md precedent): the committed lore/LORE.md must satisfy
// every structural and referential invariant — unique ids, a valid veracity grade on every
// episode, a non-empty lesson, at least one HTTPS source with a what-it-supports note, law
// numbers resolving against law/LAWS.md, and process ids resolving (read-only) against
// processes/corpus.json. Deterministic — URL liveness is editorial (citations/README.md).

describe('lore corpus', () => {
  it('the committed LORE.md passes every invariant', () => {
    expect(validateLore()).toEqual([])
  })

  it(`curates ${LORE_MIN}-${LORE_MAX} episodes, each themed, graded, lessoned, and sourced`, () => {
    const entries = loadStartupLore()
    expect(entries.length).toBeGreaterThanOrEqual(LORE_MIN)
    expect(entries.length).toBeLessThanOrEqual(LORE_MAX)
    for (const e of entries) {
      expect(e.theme.length, `lore ${e.number} needs a theme`).toBeGreaterThan(0)
      expect(VERACITY_GRADES, `lore ${e.number} needs a veracity grade`).toContain(e.veracity)
      expect(e.lesson.length, `lore ${e.number} needs a lesson`).toBeGreaterThan(0)
      expect(e.sources.length, `lore ${e.number} needs a source`).toBeGreaterThan(0)
      for (const s of e.sources) expect(s.url, `lore ${e.number} source URL`).toMatch(/^https:\/\//)
    }
  })

  it('keeps the honesty doctrine: legends are present and graded as legend, not asserted', () => {
    const entries = loadStartupLore()
    // The corpus must carry negative/unverifiable lore honestly, not only heroics.
    expect(entries.some((e) => e.veracity === 'legend')).toBe(true)
    expect(entries.some((e) => e.veracity === 'first-person')).toBe(true)
    // The headline do-things-that-don't-scale episode cites pg's essay, where the term was
    // coined — and is graded documented, not first-person: pg told it, the Collisons did it.
    const collison = entries.find((e) => e.id === 'stripe-collison-installation')
    expect(collison?.sources.some((s) => s.url === 'https://paulgraham.com/ds.html')).toBe(true)
    expect(collison?.veracity).toBe('documented')
  })
})

describe('lore validators (failure modes)', () => {
  const LAWS: StartupLaw[] = [
    { number: 1, stage: 'Stage', title: 'A law', sourceIds: ['x'] },
    { number: 2, stage: 'Stage', title: 'B law', sourceIds: ['x'] },
  ]
  const PROCESSES = new Set(['form_001', 'fund_007'])

  const entry = (over: Partial<Record<string, string>> = {}) => {
    const f = {
      heading: '### 1. An episode',
      id: 'Id: `an-episode`',
      era: 'Era: 2008',
      companies: 'Companies: ExampleCo',
      people: 'People: A Founder',
      episode:
        'A tight factual retelling that is long enough to clear the thin-episode bar, with ' +
        'several sentences of concrete detail. It says what happened, when, and to whom. ' +
        'It does not embellish. It ends with the outcome.',
      lesson: 'Lesson: Take the honest lesson.',
      veracity: 'Veracity: first-person',
      sources: 'Sources:\n- [A source](https://example.com/a) — supports the whole episode.',
      links: 'Related laws: `1`\nRelated processes: `form_001`',
      ...over,
    }
    return `## Theme\n\n${f.heading}\n\n${f.id}\n${f.era}\n${f.companies}\n${f.people}\n\n${f.episode}\n\n${f.lesson}\n${f.veracity}\n${f.sources}\n${f.links}\n`
  }
  const check = (md: string) => validateStartupLore(md, LAWS, PROCESSES).join(';')

  it('accepts a well-formed entry (only the corpus-size contract fails)', () => {
    expect(validateStartupLore(entry(), LAWS, PROCESSES)).toEqual([`lore: expected ${LORE_MIN}-${LORE_MAX} entries, found 1`])
  })

  it('rejects unknown veracity grades, empty lessons, and thin episodes', () => {
    expect(check(entry({ veracity: 'Veracity: probably-true' }))).toContain('unknown veracity')
    expect(check(entry({ lesson: 'Lesson:' }))).toContain('empty lesson')
    expect(check(entry({ episode: 'Too short.' }))).toContain('episode too thin')
  })

  it('rejects missing, non-HTTPS, or note-less sources', () => {
    expect(check(entry({ sources: 'Sources:' }))).toContain('needs at least one source')
    expect(check(entry({ sources: 'Sources:\n- [A](http://example.com/a) — note.' }))).toContain('HTTPS')
    expect(check(entry({ sources: 'Sources:\n- bare bullet, no link' }))).toContain('malformed bullet')
    expect(check(entry({ sources: 'Sources:\n- [A](https://example.com/a) no em-dash note' }))).toContain('malformed bullet')
  })

  it('rejects unresolved cross-links and duplicate ids', () => {
    expect(check(entry({ links: 'Related laws: `99`' }))).toContain('unknown law number 99')
    expect(check(entry({ links: 'Related processes: `ghost_001`' }))).toContain('unknown process id ghost_001')
    const two = entry() + entry({ heading: '### 2. Another episode' })
    expect(check(two)).toContain('duplicate lore id an-episode')
    const misnumbered = entry({ heading: '### 5. An episode' })
    expect(check(misnumbered)).toContain('expected number 1')
  })

  it('fails when a candidate process starts resolving, demanding promotion', () => {
    expect(check(entry({ links: 'Candidate processes: `sit_001`' }))).not.toContain('sit_001')
    expect(check(entry({ links: 'Candidate processes: `fund_007`' }))).toContain('promote it to Related processes')
  })

  it('parses labeled lines and source bullets into the entry record', () => {
    const { entries, errors } = parseStartupLore(entry())
    expect(errors).toEqual([])
    expect(entries).toHaveLength(1)
    const e = entries[0]
    expect(e.id).toBe('an-episode')
    expect(e.theme).toBe('Theme')
    expect(e.companies).toEqual(['ExampleCo'])
    expect(e.people).toEqual(['A Founder'])
    expect(e.veracity).toBe('first-person')
    expect(e.sources).toEqual([{ title: 'A source', url: 'https://example.com/a', note: 'supports the whole episode.' }])
    expect(e.relatedLaws).toEqual([1])
    expect(e.relatedProcesses).toEqual(['form_001'])
    expect(e.episode).toMatch(/^A tight factual retelling/)
  })
})
