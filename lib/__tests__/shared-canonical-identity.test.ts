// Corpus ↔ shared-record identity pins (docs/PR171-EXTRACTION.md, port plan item 3 —
// extracted from PR #171's process-route-cutover suite and rescoped off the route
// registry). These guard the additive transition regardless of routing: the shared
// records in content/processes/ mirror the legacy corpus identities, so chains,
// jurisdiction files, and site loaders keep resolving while both surfaces exist.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadChains, loadProcesses, processSlug } from '../processes'
import { findSharedRecord, readSharedCatalog } from '../shared-processes/reader'
import { buildStoryGraph } from '../storyProcessGraph'
import { VS_EVENTS } from '../virtualStartupRun'

const records = readSharedCatalog()
const tasks = loadProcesses()

describe('corpus and shared-record identity', () => {
  it('keeps the committed process/story graph and simulator/chain identities unchanged', () => {
    expect(buildStoryGraph()).toEqual(JSON.parse(readFileSync('data/graph.json', 'utf8')))
    for (const event of VS_EVENTS) expect(findSharedRecord(records, event.groundedIn)?.id).toBe(event.groundedIn)
    for (const chain of loadChains()) expect(findSharedRecord(records, chain.id)?.id).toBe(chain.id)
  })

  it('maps every corpus task to one shared record: source.id identity, slugAliases mirror, no invented operations', () => {
    let aliasCount = 0
    for (const task of tasks) {
      const record = findSharedRecord(records, task.id)
      expect(record, `task ${task.id} must have a shared record`).toBeDefined()
      expect(record!.source?.id).toBe(task.id)
      // The canonical title slug resolves to the same record — old links cannot drift.
      expect(findSharedRecord(records, processSlug(task.title))?.id).toBe(task.id)
      // Renamed-process aliases mirror exactly (lib/processes.ts slugAliases is the source).
      expect(record!.metadata.slugAliases ?? []).toEqual(task.slugAliases ?? [])
      aliasCount += task.slugAliases?.length ?? 0
      // Operation strings remain in the existing execution source, never inferred from
      // canonical prose or flattened from a decision's alternative paths.
      expect(JSON.stringify(record)).not.toContain('"toolCall":')
      expect(JSON.stringify(record)).not.toContain('"functionCalls":')
    }
    expect(aliasCount, 'the alias mirror pin must not pass vacuously').toBeGreaterThan(0)
  })
})
