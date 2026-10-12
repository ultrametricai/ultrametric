import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  battleSlug, findBattleBySlug, isPopulated, leadingBattle, loadAll, loadCategories, loadCategory, parseBattleSlug,
} from '@/lib/data'

const REAL = path.resolve(__dirname, '../../rankings')
let tmp: string | undefined
afterEach(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); tmp = undefined })

function corruptedCopy(mutate: (dir: string) => void): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-data-'))
  fs.cpSync(REAL, tmp, { recursive: true })
  mutate(tmp)
  return tmp
}

describe('loadCategory', () => {
  it('loads the committed desktop-os dataset', () => {
    const data = loadCategory('desktop-os', REAL)
    expect(data.category.id).toBe('desktop-os')
    expect(data.products.length).toBeGreaterThanOrEqual(4)
    expect(data.verdicts).toHaveLength(data.products.length * data.stories.length)
  })

  it('rejects a verdict citing missing evidence', () => {
    const dir = corruptedCopy((d) => {
      const p = path.join(d, 'desktop-os', 'verdicts.json')
      const verdicts = JSON.parse(fs.readFileSync(p, 'utf8'))
      verdicts[0].evidenceIds = ['ghost-ev-99']
      fs.writeFileSync(p, JSON.stringify(verdicts))
    })
    expect(() => loadCategory('desktop-os', dir)).toThrow(/ghost-ev-99/)
  })

  it('rejects an incomplete matrix', () => {
    const dir = corruptedCopy((d) => {
      const p = path.join(d, 'desktop-os', 'verdicts.json')
      const verdicts = JSON.parse(fs.readFileSync(p, 'utf8'))
      fs.writeFileSync(p, JSON.stringify(verdicts.slice(1)))
    })
    expect(() => loadCategory('desktop-os', dir)).toThrow(/missing verdict/)
  })
})

describe('loadCategories', () => {
  it('returns every category from categories.json', () => {
    const categories = loadCategories(REAL)
    // Derive expected ids/count from the raw file rather than hardcoding a number — this
    // list grows over time as new categories are seeded.
    const raw = JSON.parse(fs.readFileSync(path.join(REAL, 'categories.json'), 'utf8')) as { id: string }[]
    expect(categories).toHaveLength(raw.length)
    expect(categories.map((c) => c.id)).toEqual(raw.map((c) => c.id))
    expect(categories[0].id).toBe('desktop-os')
    for (const c of categories) expect(c.personas).toContain('ai-native')
  })
})

describe('loadAll', () => {
  it('returns full CategoryData for every populated category', () => {
    // Which categories are populated grows over time as the pipeline is run for more
    // categories — derive the expected set from isPopulated rather than hardcoding a count.
    const expectedIds = loadCategories(REAL)
      .filter((c) => isPopulated(c.id, REAL))
      .map((c) => c.id)
    const all = loadAll(REAL)
    expect(all.map((c) => c.category.id).sort()).toEqual([...expectedIds].sort())
    expect(expectedIds).toContain('desktop-os')
  })

  it('excludes categories missing required data files', () => {
    const baselineCount = loadAll(REAL).length
    const baselineCategoryCount = loadCategories(REAL).length
    const dir = corruptedCopy((d) => {
      const categories = JSON.parse(fs.readFileSync(path.join(d, 'categories.json'), 'utf8'))
      categories.push({
        id: 'empty-cat',
        name: 'Empty Category',
        description: 'not populated yet',
        personas: ['someone'],
      })
      fs.writeFileSync(path.join(d, 'categories.json'), JSON.stringify(categories))
    })
    const all = loadAll(dir)
    expect(all).toHaveLength(baselineCount)
    expect(all.some((c) => c.category.id === 'empty-cat')).toBe(false)

    // The unpopulated category must still be listed by loadCategories — only loadAll
    // (which is used for static generation) filters it out.
    const categories = loadCategories(dir)
    expect(categories).toHaveLength(baselineCategoryCount + 1)
    expect(categories.some((c) => c.id === 'empty-cat')).toBe(true)
  })
})

describe('isPopulated', () => {
  it('is true for the committed desktop-os category', () => {
    expect(isPopulated('desktop-os', REAL)).toBe(true)
  })

  it('is false when stories/verdicts/rankings files are absent', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-empty-cat-'))
    fs.mkdirSync(path.join(tmp, 'empty-cat'))
    expect(isPopulated('empty-cat', tmp)).toBe(false)
  })
})

describe('battle slugs', () => {
  it('round-trips', () => {
    const products = loadCategory('desktop-os', REAL).products
    expect(battleSlug('macos', 'omarchy')).toBe('macos-vs-omarchy')
    expect(parseBattleSlug('macos-vs-omarchy', products)).toEqual({ a: 'macos', b: 'omarchy' })
    expect(parseBattleSlug('nope-vs-omarchy', products)).toBeNull()
  })
})

describe('findBattleBySlug', () => {
  it('resolves a slug to the one category whose product list recognizes it', () => {
    const all = loadAll(REAL)
    const desktopOs = all.find((c) => c.category.id === 'desktop-os')!
    const found = findBattleBySlug(all, 'macos-vs-omarchy')
    expect(found?.data.category.id).toBe('desktop-os')
    expect(found?.battle).toEqual(desktopOs.rankings.battles.find((b) => b.a === 'macos' && b.b === 'omarchy'))
  })

  it('returns null for an unknown slug', () => {
    expect(findBattleBySlug(loadAll(REAL), 'nope-vs-alsonope')).toBeNull()
  })
})

describe('leadingBattle', () => {
  it('returns the #1-vs-#2 battle, ordered by product-list index (not leaderboard order)', () => {
    const data = loadCategory('desktop-os', REAL)
    const [first, second] = data.rankings.leaderboard
    const battle = leadingBattle(data)
    expect(battle).not.toBeNull()
    expect(new Set([battle!.a, battle!.b])).toEqual(new Set([first.productId, second.productId]))
    const idx = (id: string) => data.products.findIndex((p) => p.id === id)
    expect(idx(battle!.a)).toBeLessThan(idx(battle!.b))
  })
})
