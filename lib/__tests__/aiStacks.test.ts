import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadAiStacks, resolveStack } from '@/lib/aiStacks'
import { loadAll } from '@/lib/data'

const DATA_DIR = path.resolve(__dirname, '../../open-rankings')

describe('ai-stacks data', () => {
  it('parses and every arena-top slot references a real arena id', () => {
    const stacks = loadAiStacks(DATA_DIR)
    expect(stacks.length).toBeGreaterThan(0)
    const arenaIds = new Set(loadAll(DATA_DIR).map((c) => c.category.id))
    for (const stack of stacks) {
      for (const slot of stack.slots) {
        if (slot.pick.kind === 'arena-top') {
          expect(arenaIds.has(slot.pick.arenaId), `${stack.id}/${slot.role}: unknown arena ${slot.pick.arenaId}`).toBe(true)
        }
      }
    }
  })

  it('keeps search aliases in sync with every stack id', () => {
    const stackIds = new Set(loadAiStacks(DATA_DIR).map((stack) => stack.id))
    const searchAliases = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'search-aliases.json'), 'utf8'),
    ) as { stacks: Record<string, string[]> }

    for (const id of stackIds) {
      expect(searchAliases.stacks[id], `stack ${id} has no aliases`).toBeDefined()
    }
    for (const id of Object.keys(searchAliases.stacks)) {
      expect(stackIds.has(id), `unknown stack alias id ${id}`).toBe(true)
    }
  })
})

describe('gstack (Garry Tan) curated stack', () => {
  // resolveStack silently drops picks that stop resolving (dead product, renamed arena) — for an
  // externally-attributed stack that silent degradation would misrepresent the source, so pin
  // every member explicitly.
  // Founder 2026-09-28: gstack sits LAST on the page (house-curated stacks lead), not first.
  it('sits last on the page and every curated pick resolves against judged data', () => {
    const stacks = loadAiStacks(DATA_DIR)
    expect(stacks[stacks.length - 1]?.id).toBe('gstack')
    const gstack = stacks[stacks.length - 1]!
    const resolved = resolveStack(gstack, loadAll(DATA_DIR))
    const byRole = new Map(resolved.slots.map((s) => [s.role, s]))
    for (const [role, productId] of [
      ['Coding agent', 'claude-code'],
      ['Runtime & package manager', 'bun'],
      ['Backend & knowledge store', 'supabase'],
      ['Private mesh network', 'tailscale'],
    ] as const) {
      const slot = byRole.get(role)
      expect(slot, `gstack/${role}: slot dropped — pick no longer resolves`).toBeTruthy()
      expect(slot!.productId).toBe(productId)
      expect(slot!.metricValue).not.toBeNull()
    }
  })

  it('records its source URL, attribution, and liveness/as-of dates in the data entry', () => {
    const gstack = loadAiStacks(DATA_DIR).find((s) => s.id === 'gstack')!
    expect(gstack.name).toBe('gstack (Garry Tan)')
    expect(gstack.tagline).toContain('github.com/garrytan/gstack')
    expect(gstack.tagline).toMatch(/as of \d{4}-\d{2}-\d{2}/)
    const source = gstack.slots
      .map((s) => s.pick)
      .find((p): p is Extract<typeof p, { kind: 'editorial' }> => p.kind === 'editorial')
    expect(source?.url).toBe('https://github.com/garrytan/gstack')
    expect(source?.note).toMatch(/verified live \d{4}-\d{2}-\d{2}/)
  })
})

describe('SageOx community stack', () => {
  it('preserves every submitted role and leaves planned arenas unscored', () => {
    const stack = loadAiStacks(DATA_DIR).find((s) => s.id === 'sageox-coworker-team')!
    const resolved = resolveStack(stack, loadAll(DATA_DIR))
    expect(resolved.slots).toHaveLength(stack.slots.length)
    expect(resolved.slots.filter((s) => s.kind === 'product').map((s) => s.productId))
      .toEqual(['buzz', 'turbopuffer', 'zoom-scribe', 'deepgram'])
    for (const role of ['Realtime transport', 'CI runners']) {
      const slot = resolved.slots.find((s) => s.role === role)!
      expect(slot.kind).toBe('editorial')
      expect(slot.metricValue).toBeNull()
      expect(slot.rank).toBeNull()
      expect(slot.editorialNote).toContain('planned')
      expect(slot.editorialNote).toContain('https://github.com/ultrametricai/ultrametric/issues/493')
    }
    expect(stack.tagline).toContain('SageOx founder/CEO')
    expect(stack.tagline).toContain('paying customer')
  })
})

describe('resolveStack', () => {
  it('resolves arena-top slots to the metric leader and keeps editorial slots labeled', () => {
    const categories = loadAll(DATA_DIR)
    const stacks = loadAiStacks(DATA_DIR)
    for (const stack of stacks) {
      const resolved = resolveStack(stack, categories)
      expect(resolved.slots.length).toBeGreaterThan(0)
      for (const slot of resolved.slots) {
        if (slot.kind === 'arena-top') {
          expect(slot.productId).toBeTruthy()
          expect(slot.metricValue).not.toBeNull()
          const data = categories.find((c) => c.category.id === slot.arenaId)!
          // ossOnly slots rank a filtered field, so only check the unfiltered maximum bound.
          const best = Math.max(
            ...data.rankings.leaderboard
              .map((e) => e[slot.metric as 'agentReady' | 'aiEra' | 'agenticApp'])
              .filter((v): v is number => v !== null),
          )
          expect(slot.metricValue).toBeLessThanOrEqual(best)
          if (slot.coPick) {
            expect(slot.metricValue! - slot.coPick.metricValue).toBeLessThan(3.0)
            expect(slot.coPick.productId).not.toBe(slot.productId)
          }
        } else if (slot.kind === 'product') {
          expect(slot.productId).toBeTruthy()
          expect(slot.curatedNote).toBeTruthy()
          expect(slot.rank).toBeGreaterThanOrEqual(1)
        } else {
          expect(slot.editorialName).toBeTruthy()
          expect(slot.editorialNote).toBeTruthy()
        }
      }
    }
  })

  it('drops arena-top slots whose arena is not loaded instead of throwing', () => {
    const categories = loadAll(DATA_DIR)
    const stack = {
      id: 'test-stack',
      name: 'Test',
      tagline: 't',
      audience: 'a',
      slots: [
        { role: 'A', why: 'w', pick: { kind: 'arena-top' as const, arenaId: 'no-such-arena', metric: 'agentReady' as const } },
        { role: 'B', why: 'w', pick: { kind: 'arena-top' as const, arenaId: 'ai-coding', metric: 'agentReady' as const } },
      ],
    }
    const resolved = resolveStack(stack, categories)
    expect(resolved.slots.map((s) => s.role)).toEqual(['B'])
  })
})
