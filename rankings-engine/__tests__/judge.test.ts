import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Evidence, Story, Verdict } from '@/lib/schemas'
import { cellHash, validateVerdictRules } from '@/rankings-engine/stages/judge'

const story: Story = { id: 's1', persona: 'developer', title: 't', theme: 'core', group: 'core', weight: 2 }
const ev = (id: string, tier: Evidence['tier']): Evidence => ({
  id, tier, url: 'https://x.example/e', excerpt: 'q', fetchedAt: '2026-08-26T00:00:00Z',
})
const verdict = (over: Partial<Verdict>): Verdict => ({
  productId: 'p', storyId: 's1', verdict: 'full', quality: 8, confidence: 'high',
  rationale: 'r. Missing for 10: independent corroboration.', evidenceIds: ['e1'], ...over,
})

describe('cellHash', () => {
  it('is stable and sensitive to evidence and prompt version', () => {
    const evidence = [ev('e1', 'claimed-docs')]
    const h1 = cellHash(story, evidence, 'v1')
    expect(h1).toBe(cellHash(story, [...evidence], 'v1'))
    expect(h1).not.toBe(cellHash(story, evidence, 'v2'))
    expect(h1).not.toBe(cellHash(story, [ev('e1', 'claimed-docs'), ev('e2', 'community')], 'v1'))
  })

  it('changes when an evidence item keeps its id but gets a new excerpt (same-id regeneration)', () => {
    // This is the exact staleness scenario the judge assembly guard must catch:
    // extract/collect-community regenerates evidence for a product, reusing ids
    // but changing excerpt text — the cached verdict hash must no longer match.
    const before = [{ ...ev('e1', 'claimed-docs'), excerpt: 'old excerpt' }]
    const after = [{ ...ev('e1', 'claimed-docs'), excerpt: 'new excerpt' }]
    expect(cellHash(story, before, 'v1')).not.toBe(cellHash(story, after, 'v1'))
  })

  it('changes when an evidence item keeps its id but its tier or url is corrected (both reach the prompt)', () => {
    const base = [ev('e1', 'claimed-docs')]
    const retiered = [{ ...ev('e1', 'claimed-docs'), tier: 'community' as const }]
    const relinked = [{ ...ev('e1', 'claimed-docs'), url: 'https://x.example/corrected' }]
    expect(cellHash(story, base, 'v1')).not.toBe(cellHash(story, retiered, 'v1'))
    expect(cellHash(story, base, 'v1')).not.toBe(cellHash(story, relinked, 'v1'))
  })
})

describe('validateVerdictRules', () => {
  const evidence = [ev('e1', 'claimed-docs'), ev('e2', 'community')]

  it('accepts a clean verdict', () => {
    expect(validateVerdictRules(verdict({}), evidence)).toBeNull()
  })
  it('rejects citations of unknown evidence', () => {
    expect(validateVerdictRules(verdict({ evidenceIds: ['nope'] }), evidence)).toMatch(/unknown evidence/)
  })
  it('requires two tiers for disputed', () => {
    expect(validateVerdictRules(verdict({ verdict: 'disputed', evidenceIds: ['e1'] }), evidence)).toMatch(/two distinct tiers/)
    expect(validateVerdictRules(verdict({ verdict: 'disputed', evidenceIds: ['e1', 'e2'] }), evidence)).toBeNull()
  })
  it('forces quality 0 for none', () => {
    expect(validateVerdictRules(verdict({ verdict: 'none', quality: 3, evidenceIds: [] }), evidence)).toMatch(/quality 0/)
    expect(validateVerdictRules(verdict({ verdict: 'none', quality: 0, evidenceIds: [] }), evidence)).toBeNull()
  })
  it('requires a "missing for 10" clause when a full/partial quality is below 10', () => {
    expect(validateVerdictRules(verdict({ quality: 8, rationale: 'fully supports the story' }), evidence)).toMatch(/missing for 10/)
    expect(validateVerdictRules(verdict({ verdict: 'partial', quality: 5, rationale: 'delivers with caveats' }), evidence)).toMatch(/missing for 10/)
    // case-insensitive match on the required phrase
    expect(validateVerdictRules(verdict({ quality: 8, rationale: 'solid docs. missing for 10: probe evidence.' }), evidence)).toBeNull()
  })
  it('does not require the clause at quality 10 or for none/na', () => {
    expect(validateVerdictRules(verdict({ quality: 10, rationale: 'flawless, corroborated' }), evidence)).toBeNull()
    expect(validateVerdictRules(verdict({ verdict: 'na', quality: 0, rationale: 'wrong axis', evidenceIds: [] }), evidence)).toBeNull()
  })
})

describe('scoped judge execution', () => {
  let directory: string
  let categoryIds: string[]
  let judge: typeof import('../stages/judge')
  let create: ReturnType<typeof vi.fn>
  const pack = [ev('e1', 'claimed-docs')]
  const response = { ...verdict({}), support: { subject: story.title, relation: 'direct', coverage: 'complete',
    citations: [{ evidenceId: 'e1', quote: 'q' }] } }
  const write = (file: string, data: unknown) => {
    const target = path.join(directory, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, JSON.stringify(data))
  }
  const snapshot = () => Object.fromEntries(fs.readdirSync(directory, { recursive: true }).map(String)
    .filter(file => fs.statSync(path.join(directory, file)).isFile())
    .map(file => [file, fs.readFileSync(path.join(directory, file), 'utf8')]))

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'um-scoped-judge-'))
    categoryIds = ['fixture']
    vi.resetModules()
    vi.doMock('@/rankings-engine/paths', async () => {
      const actual = await vi.importActual<typeof import('../paths')>('@/rankings-engine/paths')
      return { ...actual, CACHE_DIR: path.join(directory, 'cache'),
        categoryDir: (id: string) => path.join(directory, id),
        resolveCategories: (id?: string) => {
          if (id && id !== 'fixture') throw new Error(`unknown category: ${id}`)
          return (id ? [id] : categoryIds).map(id => ({ id, name: id, description: '', personas: ['developer'] }))
        } }
    })
    judge = await import('../stages/judge')
    const llm = await import('../llm')
    create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(response) }] })
    llm.setClientForTests({ messages: { create } } as never)
    llm.setSleepForTests(async () => {})
    write('fixture/products.json', ['p', 'untouched'].map(id => ({ id, name: id, vendor: id, type: 'oss', urls: { site: 'https://example.invalid' } })))
    write('fixture/stories.json', [story])
    write('fixture/verdicts.json', ['p', 'untouched'].map(productId => verdict({ productId })))
    for (const id of ['p', 'untouched']) {
      write(`fixture/evidence/${id}.json`, pack)
      write(`cache/judge/fixture/${id}/${story.id}.json`, {
        hash: judge.cellHash(story, pack, 'v5'), keyVersion: judge.CELL_HASH_VERSION, verdict: verdict({ productId: id }),
      })
    }
  })

  afterEach(() => {
    vi.doUnmock('@/rankings-engine/paths')
    vi.resetModules()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('rejects an incompatible untouched cache before scoped model calls or writes', async () => {
    const before = snapshot()
    await expect(judge.runJudge({ category: 'fixture', product: 'p' })).rejects.toThrow(/untouched.*judge-preview/)
    expect(create).not.toHaveBeenCalled()
    expect(snapshot()).toEqual(before)
  })

  for (const state of ['missing', 'old-format', 'corrupt', 'wrong-identity']) it(`rejects ${state} untouched caches before a scoped run`, async () => {
    const file = `cache/judge/fixture/untouched/${story.id}.json`
    if (state === 'missing') fs.rmSync(path.join(directory, file))
    else if (state === 'corrupt') fs.writeFileSync(path.join(directory, file), '{')
    else write(file, { hash: judge.cellHash(story, pack, judge.PROMPT_VERSION),
      keyVersion: state === 'old-format' ? 'v1' : judge.CELL_HASH_VERSION,
      verdict: verdict({ productId: state === 'wrong-identity' ? 'p' : 'untouched' }) })
    const before = snapshot()
    await expect(judge.runJudge({ category: 'fixture', product: 'p' })).rejects.toThrow(/untouched/)
    expect(create).not.toHaveBeenCalled()
    expect(snapshot()).toEqual(before)
  })

  it('previews exactly one cell without reading incompatible peer caches or writing files', async () => {
    fs.writeFileSync(path.join(directory, `cache/judge/fixture/untouched/${story.id}.json`), '{invalid peer cache')
    const before = snapshot()
    const result = await judge.runJudgePreview({ category: 'fixture', product: 'p', story: story.id })
    expect(result).toMatchObject({ mode: 'judge-preview', category: 'fixture', productId: 'p', storyId: story.id,
      promptVersion: judge.PROMPT_VERSION, inputHash: judge.cellHash(story, pack, judge.PROMPT_VERSION), verdict: response })
    expect(result.promptHash).toMatch(/^[a-f0-9]{64}$/)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].max_tokens).toBe(4096)
    expect(create.mock.calls[0][1]).toEqual({ maxRetries: 0, timeout: 60_000 })
    expect(snapshot()).toEqual(before)
  })

  it('rejects mechanical support failures without correction retries or writes', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ ...response,
      support: { ...response.support, relation: 'adjacent' } }) }] })
    const before = snapshot()
    await expect(judge.runJudgePreview({ category: 'fixture', product: 'p', story: story.id })).rejects.toThrow(/direct support/)
    expect(create).toHaveBeenCalledTimes(1)
    expect(snapshot()).toEqual(before)
  })

  it('rejects missing or unknown preview scope before any model call', async () => {
    for (const options of [{}, { category: 'fixture', product: 'p' },
      { category: 'fixture', product: 'absent', story: story.id },
      { category: 'fixture', product: 'p', story: 'absent' },
      { category: '../fixture', product: 'p', story: story.id }]) {
      await expect(judge.runJudgePreview(options)).rejects.toThrow()
    }
    expect(create).not.toHaveBeenCalled()
  })

  it('requires separate review for affiliated products and oversized preview inputs', async () => {
    write('fixture/products.json', [{ id: 'p', name: 'p', vendor: 'p', type: 'oss', urls: { site: 'https://example.invalid' }, affiliation: 'fixture-affiliation' }])
    await expect(judge.runJudgePreview({ category: 'fixture', product: 'p', story: story.id })).rejects.toThrow(/bias-audit/)
    write('fixture/products.json', [{ id: 'p', name: 'p', vendor: 'p', type: 'oss', urls: { site: 'https://example.invalid' } }])
    write('fixture/evidence/p.json', [{ ...pack[0], excerpt: 'x'.repeat(40_001) }])
    await expect(judge.runJudgePreview({ category: 'fixture', product: 'p', story: story.id })).rejects.toThrow(/pilot limit/)
    expect(create).not.toHaveBeenCalled()
  })

  it('publishes a scoped judgment when untouched caches already match the current inputs and rubric', async () => {
    const untouched = { ...response, productId: 'untouched' }
    write(`cache/judge/fixture/untouched/${story.id}.json`, {
      hash: judge.cellHash(story, pack, judge.PROMPT_VERSION), keyVersion: judge.CELL_HASH_VERSION, verdict: untouched,
    })
    const before = fs.readFileSync(path.join(directory, `cache/judge/fixture/untouched/${story.id}.json`), 'utf8')
    await judge.runJudge({ category: 'fixture', product: 'p' })
    expect(create).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'fixture/verdicts.json'), 'utf8'))).toEqual([response, untouched])
    expect(fs.readFileSync(path.join(directory, `cache/judge/fixture/untouched/${story.id}.json`), 'utf8')).toBe(before)
  })

  for (const batch of [false, true]) it(`skips unrelated categories but assembles a fully cached target (batch=${batch})`, async () => {
    categoryIds = ['unrelated', 'fixture']
    write('unrelated/products.json', [{ id: 'other', name: 'Other', vendor: 'Other', type: 'oss', urls: { site: 'https://example.invalid' } }])
    write('unrelated/stories.json', [story])
    write('unrelated/verdicts.json', [verdict({ productId: 'other' })])
    write('unrelated/evidence/other.json', pack)
    write(`cache/judge/unrelated/other/${story.id}.json`, { hash: 'stale', keyVersion: judge.CELL_HASH_VERSION, verdict: verdict({ productId: 'other' }) })
    for (const productId of ['p', 'untouched']) write(`cache/judge/fixture/${productId}/${story.id}.json`, {
      hash: judge.cellHash(story, pack, judge.PROMPT_VERSION), keyVersion: judge.CELL_HASH_VERSION,
      verdict: { ...response, productId },
    })
    write('fixture/verdicts.json', [])
    const before = snapshot()
    await judge.runJudge({ product: 'p', batch })
    expect(create).not.toHaveBeenCalled()
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'fixture/verdicts.json'), 'utf8'))).toEqual([response, { ...response, productId: 'untouched' }])
    for (const [file, contents] of Object.entries(before)) if (file.includes('unrelated')) {
      expect(fs.readFileSync(path.join(directory, file), 'utf8')).toBe(contents)
    }
  })

  it('still refreshes and assembles every cell in an explicitly unscoped category run', async () => {
    await judge.runJudge({ category: 'fixture' })
    expect(create).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'fixture/verdicts.json'), 'utf8'))).toEqual([response, { ...response, productId: 'untouched' }])
  })
})
