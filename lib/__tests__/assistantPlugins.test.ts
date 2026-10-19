// Assistant-plugin evidence map: the committed open-rankings/assistant-plugins.json must always validate,
// every entry must point at a product that actually exists in some arena and at a platform the
// file itself declares, and the file must be deterministic (stably sorted) so regenerating it
// produces reviewable diffs. A typo'd productId here would silently orphan recorded evidence —
// exactly what the map exists to prevent.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AssistantPluginsFileSchema,
  assistantPluginsFor,
  coverageByProduct,
  loadAssistantPlugins,
} from '../assistantPlugins'

const DATA = loadAssistantPlugins() // the real committed file

describe('open-rankings/assistant-plugins.json', () => {
  it('parses and declares the four assistant platforms exactly once each', () => {
    const ids = DATA.platforms.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(['chatgpt', 'claude', 'grok', 'muse'])
  })

  it('every entry references a declared platform', () => {
    const platforms = new Set(DATA.platforms.map((p) => p.id))
    for (const e of DATA.entries) {
      expect(platforms.has(e.platform), `unknown platform ${e.platform} on ${e.productId}`).toBe(true)
    }
  })

  it('every entry references a tracked product id', () => {
    const tracked = new Set<string>()
    const dataDir = path.join(process.cwd(), 'open-rankings')
    for (const dir of fs.readdirSync(dataDir)) {
      const file = path.join(dataDir, dir, 'products.json')
      if (!fs.existsSync(file)) continue
      for (const p of JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ id: string }>) tracked.add(p.id)
    }
    for (const e of DATA.entries) {
      expect(tracked.has(e.productId), `unknown product id ${e.productId}`).toBe(true)
    }
  })

  it('entries are deterministically sorted by (productId, platform, name) with no exact duplicates', () => {
    const keys = DATA.entries.map((e) => `${e.productId}\u0000${e.platform}\u0000${e.name}`)
    expect(keys).toEqual([...keys].sort())
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('loader caches: two loads of the same file return the identical object', () => {
    expect(loadAssistantPlugins()).toBe(DATA)
  })

  it('schema rejects an entry missing its listing url', () => {
    const broken = structuredClone(DATA) as { entries: Array<Record<string, unknown>> }
    delete broken.entries[0].url
    expect(AssistantPluginsFileSchema.safeParse(broken).success).toBe(false)
  })
})

describe('helpers', () => {
  it('assistantPluginsFor returns only that product, in file order', () => {
    const stripe = assistantPluginsFor('stripe', DATA)
    expect(stripe.length).toBeGreaterThan(0)
    for (const e of stripe) expect(e.productId).toBe('stripe')
  })

  it('coverageByProduct maps products to their platform sets', () => {
    const cov = coverageByProduct(DATA.entries)
    for (const [productId, platforms] of cov) {
      expect(platforms.size).toBeGreaterThan(0)
      expect(platforms.size).toBeLessThanOrEqual(DATA.platforms.length)
      for (const p of platforms) {
        expect(DATA.entries.some((e) => e.productId === productId && e.platform === p)).toBe(true)
      }
    }
    expect(cov.get('stripe')).toBeDefined()
  })
})
