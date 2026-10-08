import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOCAL_PROBES } from '@/pipeline/probes'

// Total probes across all arena modules. Bump this when adding or removing probes in
// pipeline/probes/<arena-id>.ts — it exists to catch accidental drops during merges.
const EXPECTED_TOTAL_PROBES = 1030

const probesDir = path.resolve(__dirname, '../probes')
const NON_ARENA_MODULES = new Set(['index.ts', 'types.ts'])

describe('pipeline/probes registry', () => {
  it('registers every arena module in the index (and nothing else)', () => {
    const moduleIds = fs
      .readdirSync(probesDir)
      .filter((f) => f.endsWith('.ts') && !NON_ARENA_MODULES.has(f))
      .map((f) => f.replace(/\.ts$/, ''))
      .sort()
    const registeredIds = Object.keys(LOCAL_PROBES).sort()
    expect(registeredIds).toEqual(moduleIds)
  })

  it('uses real arena ids from data/categories.json as keys', () => {
    const categories = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../data/categories.json'), 'utf8'),
    ) as Array<{ id: string }>
    const arenaIds = new Set(categories.map((c) => c.id))
    for (const key of Object.keys(LOCAL_PROBES)) {
      expect(arenaIds, `LOCAL_PROBES key "${key}" is not a real arena id`).toContain(key)
    }
  })

  it('every arena module exports a non-empty probe list with unique ids per product', () => {
    for (const [arena, probes] of Object.entries(LOCAL_PROBES)) {
      expect(probes.length, `${arena} has no probes`).toBeGreaterThan(0)
      const seen = new Set<string>()
      for (const probe of probes) {
        const key = `${probe.productId}/${probe.probeId}`
        expect(seen.has(key), `${arena} has duplicate probe ${key}`).toBe(false)
        seen.add(key)
      }
    }
  })

  it(`keeps the total probe count at ${EXPECTED_TOTAL_PROBES}`, () => {
    const total = Object.values(LOCAL_PROBES).reduce((n, probes) => n + probes.length, 0)
    expect(total).toBe(EXPECTED_TOTAL_PROBES)
  })
})
