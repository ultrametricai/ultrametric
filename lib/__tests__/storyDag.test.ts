// Heuristic domain-story clustering (lib/storyDag.ts), pinned on two real arenas' committed
// stories.json fixtures (payroll + ai-coding) so a heuristic tweak that regresses live pages
// shows up here first.

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCategory } from '@/lib/data'
import {
  clusterDomainStories, layerByEdges, significantTokens, tidyGroupLabel,
} from '@/lib/storyDag'

const DATA_DIR = path.resolve(__dirname, '../../open-rankings')
const payroll = loadCategory('payroll', DATA_DIR)
const aiCoding = loadCategory('ai-coding', DATA_DIR)

function groupStories(data: typeof payroll, group: string) {
  return data.stories.filter((s) => s.group === group).map((s) => ({ id: s.id, title: s.title, weight: s.weight }))
}

describe('significantTokens', () => {
  it('strips the persona prefix, stopwords, and plural s', () => {
    expect(
      significantTokens('As an ops user, I can run an off-cycle payroll for bonuses, corrections, or terminations outside the regular schedule'),
    ).toEqual(['run', 'cycle', 'payroll', 'bonuse', 'correction', 'termination', 'outside', 'regular', 'schedule'])
  })

  it('drops generic lead verbs so "have an agent…" stems on agent', () => {
    expect(significantTokens('As an ai-native user, I can have an agent onboard a new hire end-to-end via the API')[0]).toBe('agent')
  })
})

describe('clusterDomainStories', () => {
  it('clusters the payroll "run …" stories under one stem with a tidy label', () => {
    const clusters = clusterDomainStories(groupStories(payroll, 'pay-runs'))
    const run = clusters.find((c) => c.id === 'stem-run')
    expect(run).toBeDefined()
    expect(run!.storyIds.sort()).toEqual(['off-cycle-payroll-run', 'run-payroll-end-to-end'])
    expect(run!.label).toBe('Run payroll')
    // Root = highest weight, ties broken by input order (both weight 3 → off-cycle first).
    expect(run!.rootId).toBe('off-cycle-payroll-run')
    expect(run!.storyIds[0]).toBe(run!.rootId)
    // The cancel/correct story shares no leading stem — it stays a singleton with no label.
    const cancel = clusters.find((c) => c.storyIds.includes('cancel-or-correct-payroll'))
    expect(cancel).toBeDefined()
    expect(cancel!.storyIds).toEqual(['cancel-or-correct-payroll'])
    expect(cancel!.label).toBeNull()
    expect(cancel!.rootId).toBe('cancel-or-correct-payroll')
  })

  it('keeps unrelated stories in a group as singletons (payroll tax-filing)', () => {
    const clusters = clusterDomainStories(groupStories(payroll, 'tax-filing'))
    expect(clusters).toHaveLength(3)
    for (const c of clusters) {
      expect(c.storyIds).toHaveLength(1)
      expect(c.label).toBeNull()
    }
  })

  it('picks the highest-weight story as root (ai-coding terminal-workflow)', () => {
    // local-terminal-agent (w3) + terminal-scripting-automation (w2) share the "run" stem.
    const clusters = clusterDomainStories(groupStories(aiCoding, 'terminal-workflow'))
    const withBoth = clusters.find((c) => c.storyIds.length === 2)
    expect(withBoth).toBeDefined()
    expect(withBoth!.rootId).toBe('local-terminal-agent')
  })

  it('is deterministic and order-stable', () => {
    const stories = groupStories(payroll, 'pay-runs')
    expect(clusterDomainStories(stories)).toEqual(clusterDomainStories(stories))
    // Every domain group in both arenas covers each story exactly once.
    for (const data of [payroll, aiCoding]) {
      for (const group of new Set(data.stories.map((s) => s.group))) {
        const stories = groupStories(data, group)
        const clustered = clusterDomainStories(stories).flatMap((c) => c.storyIds)
        expect(clustered.sort()).toEqual(stories.map((s) => s.id).sort())
      }
    }
  })
})

describe('tidyGroupLabel', () => {
  it('turns taxonomy slugs into readable headers', () => {
    expect(tidyGroupLabel('pay-runs')).toBe('Pay runs')
    expect(tidyGroupLabel('ai-billing-ops')).toBe('Ai billing ops')
  })
})

describe('layerByEdges', () => {
  it('layers a chain vertically and siblings side by side', () => {
    expect(
      layerByEdges(['api', 'webhooks', 'sdks', 'mcp'], [['api', 'webhooks'], ['api', 'sdks'], ['sdks', 'mcp']]),
    ).toEqual([['api'], ['webhooks', 'sdks'], ['mcp']])
  })

  it('returns one layer per id when there are no edges', () => {
    expect(layerByEdges(['a', 'b'], [])).toEqual([['a'], ['b']])
  })

  it('appends nodes a cycle would strand as their own rows', () => {
    const layers = layerByEdges(['a', 'b', 'c'], [['b', 'c'], ['c', 'b']])
    expect(layers.flat().sort()).toEqual(['a', 'b', 'c'])
  })

  it('ignores edges pointing outside the id set', () => {
    expect(layerByEdges(['a', 'b'], [['a', 'zzz'], ['a', 'b']])).toEqual([['a'], ['b']])
  })
})
