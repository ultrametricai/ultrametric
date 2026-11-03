import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Evidence } from '../../lib/schemas'
import { sourceHash } from '../evidence-source.mjs'

const mocks = vi.hoisted(() => ({
  readFileSync: vi.fn(), existsSync: vi.fn(), fetch: vi.fn(), llm: vi.fn(), readJson: vi.fn(), writeJson: vi.fn(),
}))
vi.mock('node:fs', () => ({ default: { readFileSync: mocks.readFileSync, existsSync: mocks.existsSync } }))
vi.mock('../fetch-page', () => ({ fetchWithRetry: mocks.fetch, htmlToMarkdown: (text: string) => text }))
vi.mock('../llm', () => ({ llmJson: mocks.llm }))
vi.mock('../paths', () => ({
  categoryDir: () => '/fixture/category', resolveCategories: () => [{ id: 'fixture', name: 'Fixture arena' }],
  readJson: mocks.readJson, writeJson: mocks.writeJson,
}))
import { mergeCommunityEvidence, runCollectCommunity } from '../stages/collect-community'

const apiUrl = 'https://hn.algolia.com/api/v1/items/23760278'
const discussionUrl = 'https://news.ycombinator.com/item?id=23760278'
const thread = { title: 'Fixture discussion', children: [{ text: 'A user reports scheduled tasks.' }] }
const threadText = '# Fixture discussion\nA user reports scheduled tasks.'
const product = { id: 'vendor', name: 'Fixture', vendor: 'Fixture vendor', urls: { site: 'https://fixture.invalid' } }
let saved: Evidence[]

beforeEach(() => {
  vi.clearAllMocks()
  saved = []
  mocks.readFileSync.mockReturnValue(JSON.stringify({ fixture: { vendor: [apiUrl] } }))
  mocks.existsSync.mockReturnValue(true)
  mocks.readJson.mockImplementation((_schema, file: string) => file.endsWith('products.json') ? [product] : saved)
  mocks.writeJson.mockImplementation((_file, evidence: Evidence[]) => { saved = evidence })
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.includes('/search?')) return JSON.stringify({ hits: [{ objectID: '23760278', num_comments: 1 }] })
    if (url === apiUrl) return JSON.stringify(thread)
    throw new Error(`Unexpected fixture fetch: ${url}`)
  })
  mocks.llm.mockResolvedValue({ items: [{ url: apiUrl, excerpt: 'A report about scheduled tasks.' }] })
})

describe('community source provenance', () => {
  it.each(['misses', 'fails'])('does not turn an unchanged curated discussion into new evidence when search %s', async mode => {
    await runCollectCommunity({ category: 'fixture' })
    const original = structuredClone(saved)
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.includes('/search?')) {
        if (mode === 'fails') throw new Error('temporary search failure')
        return JSON.stringify({ hits: [] })
      }
      return JSON.stringify(thread)
    })
    mocks.llm.mockResolvedValue({ items: [{ url: apiUrl, excerpt: 'A different paraphrase of scheduled tasks.' }] })
    await runCollectCommunity({ category: 'fixture' })
    expect(saved).toEqual(original)
    expect(original).toHaveLength(1)
    expect(original[0].sourceHash).toBe(sourceHash(threadText))
    expect(mocks.llm.mock.calls[0][0].prompt.match(/=== https:/g)).toHaveLength(1)
  })

  it('uses the same HN representation when a curated fetch fails and search supplies the thread', async () => {
    await runCollectCommunity({ category: 'fixture' })
    const original = structuredClone(saved)
    mocks.fetch.mockRejectedValueOnce(new Error('temporary seed failure'))
    mocks.llm.mockResolvedValue({ items: [{ url: discussionUrl, excerpt: 'A new paraphrase of the same report.' }] })
    await runCollectCommunity({ category: 'fixture' })
    expect(saved).toEqual(original)
  })

  it('normalizes curated display URLs through the same HN source representation', async () => {
    mocks.readFileSync.mockReturnValue(JSON.stringify({ fixture: { vendor: [discussionUrl, apiUrl] } }))
    mocks.llm.mockResolvedValue({ items: [{ url: discussionUrl, excerpt: 'A report about scheduled tasks.' }] })
    await runCollectCommunity({ category: 'fixture' })
    expect(saved).toHaveLength(1)
    expect(saved[0].sourceHash).toBe(sourceHash(threadText))
    expect(mocks.fetch.mock.calls.filter(([url]) => url === apiUrl)).toHaveLength(1)
  })

  it('appends a dated report when the fetched discussion actually changes', async () => {
    await runCollectCommunity({ category: 'fixture' })
    const original = structuredClone(saved)
    mocks.fetch.mockImplementation(async (url: string) => url.includes('/search?')
      ? JSON.stringify({ hits: [] })
      : JSON.stringify({ ...thread, children: [...thread.children, { text: 'A new user reports a new capability.' }] }))
    mocks.llm.mockResolvedValue({ items: [{ url: discussionUrl, excerpt: 'A new report about a new capability.' }] })
    await runCollectCommunity({ category: 'fixture' })
    expect(saved).toHaveLength(2)
    expect(saved[0]).toEqual(original[0])
    expect(saved[1].sourceHash).not.toBe(original[0].sourceHash)
  })

  it('keeps the seed fallback limited to successfully fetched seeds', async () => {
    const failedSeed = 'https://missing.invalid/thread'
    mocks.readFileSync.mockReturnValue(JSON.stringify({ fixture: { vendor: [failedSeed, apiUrl] } }))
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url === failedSeed) throw new Error('missing seed')
      if (url.includes('/search?')) return JSON.stringify({ hits: [{ objectID: '42', num_comments: 1 }] })
      if (url === apiUrl) return JSON.stringify(thread)
      return JSON.stringify({ title: 'Other discussion', children: [{ text: 'Unrelated search result.' }] })
    })
    mocks.llm.mockRejectedValueOnce(new Error('full corpus refused'))
    await runCollectCommunity({ category: 'fixture' })
    expect(mocks.llm).toHaveBeenCalledTimes(2)
    expect(mocks.llm.mock.calls[1][0].prompt).not.toContain('Other discussion')
    expect(saved[0].sourceHash).toBe(sourceHash(threadText))
  })

  it('rejects a fallback result citing a search source absent from the successful prompt', async () => {
    mocks.fetch.mockImplementation(async (url: string) => url.includes('/search?')
      ? JSON.stringify({ hits: [{ objectID: '42', num_comments: 1 }] }) : JSON.stringify(thread))
    mocks.llm.mockRejectedValueOnce(new Error('full corpus refused'))
      .mockResolvedValueOnce({ items: [{ url: 'https://news.ycombinator.com/item?id=42', excerpt: 'Not in the seed prompt.' }] })
    await runCollectCommunity({ category: 'fixture' })
    expect(mocks.llm).toHaveBeenCalledTimes(2)
    expect(mocks.writeJson).not.toHaveBeenCalled()
  })

  it('hashes complete prompt sources and rejects a citation beyond the corpus budget', async () => {
    const urls = Array.from({ length: 4 }, (_, i) => `https://fixture.invalid/thread-${i}`)
    mocks.readFileSync.mockReturnValue(JSON.stringify({ fixture: { vendor: urls } }))
    const text = 'A'.repeat(20_000)
    mocks.fetch.mockImplementation(async (url: string) => url.includes('/search?') ? JSON.stringify({ hits: [] }) : text)
    mocks.llm.mockResolvedValueOnce({ items: [{ url: urls[0], excerpt: 'A report from the visible source.' }] })
    await runCollectCommunity({ category: 'fixture' })
    expect(saved[0].sourceHash).toBe(sourceHash(text))
    const prompt = mocks.llm.mock.calls[0][0].prompt
    expect(prompt).toContain(urls[2])
    expect(prompt).not.toContain(urls[3])
    expect(prompt.split('Discussions:\n\n')[1].length).toBeLessThanOrEqual(80_000)

    mocks.writeJson.mockClear()
    mocks.llm.mockResolvedValueOnce({ items: [{ url: urls[3], excerpt: 'A report from an omitted source.' }] })
    await runCollectCommunity({ category: 'fixture' })
    expect(mocks.writeJson).not.toHaveBeenCalled()
  })

  it('fails closed if an ambiguous canonical source bypasses corpus selection', () => {
    expect(() => mergeCommunityEvidence('vendor', [], [{ url: apiUrl, excerpt: 'A report.' }], [
      { url: apiUrl, text: JSON.stringify(thread) }, { url: discussionUrl, text: threadText },
    ], '2026-11-03T00:00:00Z')).toThrow(/Ambiguous community source/)
  })
})
