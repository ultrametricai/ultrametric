import { describe, expect, it } from 'vitest'
import {
  LAWS_MAX,
  LAWS_MIN,
  loadAuthorityCitations,
  loadKnownCitationIds,
  loadStartupLawsMarkdown,
  parseStartupLaws,
  validateLaws,
  validateStartupLaws,
} from '@/lib/laws'

// The startup-laws gates: open-law/LAWS.md must satisfy every structural and referential
// invariant — rigid grammar, continuous numbering, and every Sources id resolving across
// the two domain registries (open-law/citations/registry.json for authorities;
// open-lore/library.json plus open-lore/citations.json for the reading canon).
// Deterministic — liveness checks are editorial, recorded via checked_on (see
// open-law/README.md and open-lore/README.md).

describe('startup laws (open-law/LAWS.md)', () => {
  it('the committed laws pass every invariant', () => {
    expect(validateLaws()).toEqual([])
  })

  it('the authority registry carries the law rules’ primary sources with unique ids', () => {
    const registry = loadAuthorityCitations()
    const ids = new Set(registry.citations.map((c) => c.id))
    expect(ids.size).toBe(registry.citations.length)
    // The law rules' primary authorities resolve here (schema validation and the
    // jurisdiction/locator doctrine run in __tests__/founder-ops.test.ts).
    for (const id of ['de-dgcl-503', 'irs-form-15620-2025', 'irs-rp-2025-32']) {
      expect(ids.has(id), `registry must keep ${id}`).toBe(true)
    }
  })

  it(`distils ${LAWS_MIN}-${LAWS_MAX} laws, each grouped under a lifecycle stage with resolving citations`, () => {
    const { laws, errors } = parseStartupLaws(loadStartupLawsMarkdown())
    expect(errors).toEqual([])
    expect(laws.length).toBeGreaterThanOrEqual(LAWS_MIN)
    expect(laws.length).toBeLessThanOrEqual(LAWS_MAX)
    const known = loadKnownCitationIds()
    expect(known.errors).toEqual([])
    for (const law of laws) {
      expect(law.stage.length, `law ${law.number} needs a stage`).toBeGreaterThan(0)
      expect(law.sourceIds.length, `law ${law.number} needs citations`).toBeGreaterThan(0)
      for (const id of law.sourceIds) expect(known.ids.has(id), `law ${law.number} cites unknown ${id}`).toBe(true)
    }
    // The aphorisms keep their attribution: the two headline laws cite their actual
    // origins (now the canonical open-lore/library.json entries).
    const byTitle = new Map(laws.map((l) => [l.title, l]))
    expect(byTitle.get("Do things that don't scale")?.sourceIds).toContain('pg-do-things-that-dont-scale')
    expect(byTitle.get('Make something people want')?.sourceIds).toContain('ralston-ycs-essential-startup-advice')
  })

  it('cites works at their canonical home: no law cites an id the dedupe retired', () => {
    // The fold into open-lore/ removed the duplicate reading records for works already
    // in the library; LAWS.md cites the library ids instead.
    const retired = ['pg-startup-growth', 'pg-default-alive', 'pg-13-sentences', 'pg-how-to-start',
      'pg-equity-equation', 'pg-startup-ideas', 'yc-documents', 'holloway-equity-guide',
      'pg-18-mistakes', 'yc-essential-startup-advice']
    const cited = new Set(parseStartupLaws(loadStartupLawsMarkdown()).laws.flatMap((l) => l.sourceIds))
    for (const id of retired) expect(cited.has(id), `LAWS.md still cites retired id ${id}`).toBe(false)
  })
})

describe('law validators (failure modes)', () => {
  const known = new Set(['real-source'])

  it('rejects laws with unresolved citations, no citations, or broken numbering', () => {
    const unknown = '## Stage\n\n### 1. A law\nBody.\nSources: `ghost-id`\n'
    expect(validateStartupLaws(unknown, known).join(';')).toContain('unknown source id ghost-id')
    const uncited = '## Stage\n\n### 1. A law\nBody with no sources line.\n'
    expect(validateStartupLaws(uncited, known).join(';')).toContain('missing Sources line')
    const misnumbered = '## Stage\n\n### 2. A law\nBody.\nSources: `real-source`\n'
    expect(validateStartupLaws(misnumbered, known).join(';')).toContain('expected number 1')
    // And a too-short list is itself an error (the 25-40 corpus contract).
    expect(validateStartupLaws('## Stage\n\n### 1. Only law\nBody.\nSources: `real-source`\n', known).join(';')).toContain('expected 25-40')
  })

  it('rejects duplicate citations on one law and duplicate law titles', () => {
    const duplicated = '## Stage\n\n### 1. A law\nBody.\nSources: `real-source`, `real-source`\n'
    expect(validateStartupLaws(duplicated, known).join(';')).toContain('duplicate citation real-source')
    const twice = '## Stage\n\n### 1. A law\nBody.\nSources: `real-source`\n\n### 2. A law\nBody.\nSources: `real-source`\n'
    expect(validateStartupLaws(twice, known).join(';')).toContain('duplicate law title')
  })
})

describe('law wording (the public name is "rule")', () => {
  // The site's /open-law page bans the retired "card" wording (the 2026-10 rename). This
  // gate keeps new jurisdictions from reintroducing it in rule prose. Card-type phrases
  // quoted from statutes (credit card, debit card, ...) stay legal.
  const CARD = /\bcards?\b/i
  const QUOTED_CARD_TYPES = /\b(?:credit|debit|charge|gift|prepaid)\s+cards?\b/gi
  const offenders = (text: string | undefined): boolean =>
    !!text && CARD.test(text.replace(QUOTED_CARD_TYPES, ''))

  it('no rule statement or caveat says "card"', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const bad: string[] = []
    for (const dir of readdirSync('open-law')) {
      const full = join('open-law', dir)
      if (!statSync(full).isDirectory() || dir === 'citations') continue
      for (const file of readdirSync(full)) {
        if (!file.endsWith('.json')) continue
        const rule = JSON.parse(readFileSync(join(full, file), 'utf8'))
        if (offenders(rule.statement) || offenders(rule.caveat)) bad.push(join(dir, file))
      }
    }
    expect(bad).toEqual([])
  })

  it('no map.json prose says "card"', async () => {
    const { readFileSync } = await import('node:fs')
    const map = JSON.parse(readFileSync('open-law/map.json', 'utf8'))
    const texts: string[] = [map.scope, ...Object.values(map.maturity_grades ?? {}) as string[]]
    for (const d of map.domains ?? []) {
      texts.push(d.covers ?? '')
      for (const s of d.subareas ?? []) texts.push(...(s.gaps ?? []))
    }
    expect(texts.filter((t) => offenders(t))).toEqual([])
  })
})
