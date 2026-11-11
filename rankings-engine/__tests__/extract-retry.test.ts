import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sourceHash } from '../evidence-source.mjs'
import * as llm from '../llm'

const mocks = vi.hoisted(() => ({
  readFileSync: vi.fn(), readdirSync: vi.fn(), existsSync: vi.fn(), readJson: vi.fn(), writeJson: vi.fn(),
}))
vi.mock('node:fs', () => ({ default: {
  readFileSync: mocks.readFileSync, readdirSync: mocks.readdirSync, existsSync: mocks.existsSync,
} }))
vi.mock('../paths', () => ({
  CACHE_DIR: '/fixture/cache', categoryDir: () => '/fixture/data/arena',
  resolveCategories: () => [{ id: 'arena', name: 'Fixture arena' }],
  readJson: mocks.readJson, writeJson: mocks.writeJson,
}))
import { type Extraction, runExtract } from '../stages/extract'

const product = {
  id: 'vendor', name: 'Fixture', vendor: 'Fixture vendor', type: 'oss',
  urls: { site: 'https://fixture.invalid', docs: 'https://fixture.invalid/docs', extra: ['https://fixture.invalid/api'] },
}
const quotes = [
  'The API streams responses.', 'Jobs run in an isolated sandbox.', 'You can schedule jobs.',
  'Logs are available in the dashboard.', 'You can export reports.',
]
const sources: Record<string, string> = {
  site: 'Install the application.',
  docs: `${quotes.slice(1).join('\n')}\nCan jobs run offline?`,
  'extra-0': `API documentation\n${quotes[0]}\nEnd of documentation.`,
  'extra-1': '',
}
const extraction = (): Extraction => ({ stories: quotes.map((quote, i) => ({
  persona: 'developer', title: `As a developer, I can use capability ${i + 1}`,
  quote, sourceKey: i === 0 ? 'extra-0' : 'docs',
})) })
const response = (value: Extraction) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] })
const create = vi.fn()
const sleep = vi.fn(async () => {})
const run = () => runExtract({ category: 'arena', product: 'vendor' })

beforeEach(() => {
  vi.clearAllMocks()
  create.mockReset()
  mocks.existsSync.mockReturnValue(true)
  mocks.readdirSync.mockReturnValue(Object.keys(sources).map(key => `${key}.md`))
  mocks.readFileSync.mockImplementation((file: string) => sources[file.split('/').at(-1)!.replace(/\.md$/, '')])
  mocks.readJson.mockImplementation((_schema, file: string) => file.endsWith('products.json') ? [product] : [])
  llm.setClientForTests({ messages: { create } } as never)
  llm.setSleepForTests(sleep)
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('extraction source correction', () => {
  it('corrects a shape-valid misquotation within the existing model loop before writing evidence', async () => {
    const invalid = extraction()
    invalid.stories[0].quote = 'The API supports every protocol.'
    create.mockResolvedValueOnce(response(invalid)).mockImplementationOnce(async () => {
      expect(mocks.writeJson).not.toHaveBeenCalled()
      return response(extraction())
    })

    await run()

    expect(create).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
    const correction = create.mock.calls[1][0].messages[2].content
    expect(correction).toContain('extract: arena/vendor: story 1')
    expect(correction).toContain('source extra-0')
    expect(correction).toContain('quote is not a case-sensitive substring after whitespace normalization')
    expect(correction).not.toContain(invalid.stories[0].quote)
    expect(correction).not.toContain(sources['extra-0'])
    expect(mocks.writeJson).toHaveBeenCalledTimes(2)
    const [evidenceFile, evidence] = mocks.writeJson.mock.calls[0]
    expect(evidenceFile).toBe('/fixture/data/arena/evidence/vendor.json')
    expect(evidence).toHaveLength(5)
    expect(evidence[0]).toMatchObject({
      id: 'vendor-docs-1', url: product.urls.extra[0], excerpt: quotes[0], sourceHash: sourceHash(sources['extra-0']),
    })
    expect(evidence.some((item: { excerpt: string }) => item.excerpt === invalid.stories[0].quote)).toBe(false)
    expect(mocks.writeJson.mock.calls[1][0]).toBe('/fixture/cache/extract/arena/vendor.json')
    expect(mocks.writeJson.mock.calls[1][1]).toHaveLength(5)
  })

  it.each([
    { name: 'invented quote', quote: 'Jobs run on the moon.', sourceKey: 'docs', reason: 'quote is not a case-sensitive substring' },
    { name: 'wrong source', quote: quotes[0], sourceKey: 'docs', reason: 'quote is not a case-sensitive substring' },
    { name: 'missing source', quote: quotes[0], sourceKey: 'extra-9', reason: 'source is missing or empty' },
    { name: 'empty source', quote: quotes[0], sourceKey: 'extra-1', reason: 'source is missing or empty' },
    { name: 'question-only quote', quote: 'Can jobs run offline?', sourceKey: 'docs', reason: 'quote is question-only' },
    { name: 'changed capitalization', quote: quotes[1].toLowerCase(), sourceKey: 'docs', reason: 'quote is not a case-sensitive substring' },
  ])('exhausts five attempts for $name without writing evidence or extraction cache', async ({ quote, sourceKey, reason }) => {
    const invalid = extraction()
    invalid.stories[1] = { ...invalid.stories[1], quote, sourceKey }
    create.mockResolvedValue(response(invalid))

    const error = await run().then(
      () => { throw new Error('Expected source validation to fail') },
      (error: Error) => error,
    )

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('LLM output failed validation after 5 attempts')
    expect(error.message).toContain('extract: arena/vendor: story 2')
    expect(error.message).toContain(`source ${sourceKey}: ${reason}`)
    expect(error.message).not.toContain(quote)
    expect(error.message).not.toContain(sources.docs)
    expect(create).toHaveBeenCalledTimes(5)
    expect(sleep).toHaveBeenCalledTimes(4)
    expect(mocks.writeJson).not.toHaveBeenCalled()
  })

  it('accepts whitespace normalization without changing the source or saved quote', async () => {
    const valid = extraction()
    valid.stories[0].quote = '  The API\n\tstreams   responses.  '
    create.mockResolvedValue(response(valid))

    await run()

    expect(create).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
    expect(mocks.writeJson.mock.calls[0][1][0]).toMatchObject({
      excerpt: valid.stories[0].quote, url: product.urls.extra[0], sourceHash: sourceHash(sources['extra-0']),
    })
  })

  it.each([0, 1, 2, 3, 4])('accepts %i supported stories without quota retries or invented additions', async (count) => {
    const sparse = { stories: extraction().stories.slice(0, count) }
    create.mockResolvedValue(response(sparse))

    await run()

    expect(create).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
    expect(mocks.writeJson).toHaveBeenCalledTimes(2)
    expect(mocks.writeJson.mock.calls[0][1].map((item: { excerpt: string }) => item.excerpt))
      .toEqual(quotes.slice(0, count))
    expect(mocks.writeJson.mock.calls[1][1]).toHaveLength(count)
  })

  it('preserves dated evidence when an empty extraction supplies no new support', async () => {
    const existing = [
      { id: 'vendor-docs-8', tier: 'claimed-docs', url: product.urls.docs,
        excerpt: 'A previously observed capability.', fetchedAt: '2026-01-01T00:00:00Z', sourceHash: 'a'.repeat(64) },
      { id: 'vendor-probe-1', tier: 'probe', url: product.urls.site,
        excerpt: 'Recorded probe result.', fetchedAt: '2026-01-01T00:00:00Z' },
      { id: 'vendor-comm-1', tier: 'community', url: 'https://community.invalid/thread',
        excerpt: 'Recorded community observation.', fetchedAt: '2026-01-01T00:00:00Z' },
    ]
    mocks.readJson.mockImplementation((_schema, file: string) => file.endsWith('products.json') ? [product] : existing)
    create.mockResolvedValue(response({ stories: [] }))

    await run()

    expect(create).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
    expect(mocks.writeJson.mock.calls[0][1]).toEqual(existing)
    expect(mocks.writeJson.mock.calls[1][1]).toEqual([])
  })

  it('still rejects an unsupported single story without writing evidence', async () => {
    const invalid = { stories: [{ ...extraction().stories[0], quote: 'The API supports every protocol.' }] }
    create.mockResolvedValue(response(invalid))

    await expect(run()).rejects.toThrow('lacks an affirmative verbatim quotation')

    expect(create).toHaveBeenCalledTimes(5)
    expect(sleep).toHaveBeenCalledTimes(4)
    expect(mocks.writeJson).not.toHaveBeenCalled()
  })

  it('keeps the maximum story count inside the same five-attempt budget', async () => {
    const invalid = { stories: Array.from({ length: 41 }, () => extraction().stories[0]) }
    create.mockResolvedValue(response(invalid))

    await expect(run()).rejects.toThrow('LLM output failed validation after 5 attempts')

    expect(create).toHaveBeenCalledTimes(5)
    expect(sleep).toHaveBeenCalledTimes(4)
    expect(mocks.writeJson).not.toHaveBeenCalled()
  })

  it('retains final source validation if a response bypasses the model schema', async () => {
    const invalid = extraction()
    invalid.stories[0].sourceKey = 'extra-9'
    vi.spyOn(llm, 'llmJson').mockResolvedValue(invalid)

    await expect(run()).rejects.toThrow('extract: arena/vendor: story 1 lacks an affirmative verbatim quotation from source extra-9: source is missing or empty')

    expect(create).not.toHaveBeenCalled()
    expect(mocks.writeJson).not.toHaveBeenCalled()
  })
})
