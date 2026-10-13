import { describe, expect, it } from 'vitest'
import { loadAll } from '@/lib/data'
import { computeHotFlags, loadCuratedHot } from '@/lib/hotProducts'

// Integration gate over the COMMITTED data files (same stance as data.test.ts): the curated
// override must always validate, and every hot flag — mechanical or curated — must carry a
// concrete reason and point at a product that actually exists in some arena.
describe('committed hot-products data', () => {
  it('rankings/hot-products.json parses and every curated entry names a real product', () => {
    const curated = loadCuratedHot()
    const known = new Set(loadAll().flatMap((data) => data.products.map((p) => p.id)))
    for (const entry of curated) {
      expect(entry.reason.length).toBeGreaterThan(0)
      expect(known.has(entry.productId), `curated hot product ${entry.productId} exists in some arena`).toBe(true)
    }
  })

  it('every computed hot flag carries a reason string and a known source', () => {
    const flags = computeHotFlags(loadAll())
    for (const [productId, flag] of flags) {
      expect(flag.reason.length, `reason for ${productId}`).toBeGreaterThan(0)
      expect(['tracked', 'young', 'curated']).toContain(flag.source)
    }
  })
})
