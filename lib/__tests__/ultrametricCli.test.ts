import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProcesses } from '@/lib/processes'
import { ULTRAMETRIC_CLI_DISCLOSURE, ULTRAMETRIC_CLI_STEPS, ultrametricCliFor } from '@/lib/ultrametricCli'

const DATA_DIR = path.resolve(__dirname, '../../open-rankings')

// The Ultrametric CLI/MCP step map (founder ask 2026-09-30) is OWNER-PRODUCT surface data:
// every key must resolve against the live corpus (no stale/invented processes), every command
// must be the real shipped invocation, and the honesty framing must survive edits.
describe('lib/ultrametricCli.ts — curated map validation', () => {
  const tasks = loadProcesses(DATA_DIR)
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const entries = Object.entries(ULTRAMETRIC_CLI_STEPS)

  it('is a small curated map, not a sweep — and never empty by accident', () => {
    expect(entries.length).toBeGreaterThan(0)
    // The live production catalog served 14 processes on 2026-09-30; only those with a
    // same-result corpus task are mapped. Growing past the catalog size means invention.
    expect(entries.length).toBeLessThanOrEqual(14)
  })

  it('every key is a live corpus task (no stale mappings)', () => {
    for (const [taskId] of entries) {
      expect(taskById.has(taskId), `mapped task ${taskId} is not in the live corpus`).toBe(true)
    }
  })

  it('every entry carries the real shipped command shape, the MCP tool, and provenance', () => {
    const seenProcessIds = new Set<string>()
    for (const [taskId, e] of entries) {
      expect(e.processId, `${taskId}: processId`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(seenProcessIds.has(e.processId), `${taskId}: duplicate processId ${e.processId}`).toBe(false)
      seenProcessIds.add(e.processId)
      expect(e.processVersion, `${taskId}: processVersion`).toBeGreaterThanOrEqual(1)
      expect(Number.isInteger(e.processVersion)).toBe(true)
      // The exact shipped invocation — `process open` starts/resumes the hosted run.
      expect(e.command).toBe(`ultrametric process open ${e.processId}`)
      expect(e.mcpTool).toBe('open_process')
      // Provenance pins the audited artifact + catalog date; re-audit before changing it.
      expect(e.releasedIn).toContain('ultrametric@0.4.1')
      expect(e.releasedIn).toMatch(/\d{4}-\d{2}-\d{2}/)
    }
  })

  it('accessor resolves committed entries and misses honestly (null, never a fabrication)', () => {
    const [taskId, e] = entries[0]
    expect(ultrametricCliFor(taskId)).toEqual(e)
    expect(ultrametricCliFor('no_such_task')).toBeNull()
  })

  it('the disclosure names the affiliation and the honest capability boundary', () => {
    expect(ULTRAMETRIC_CLI_DISCLOSURE).toContain('Ultrametric Inc')
    expect(ULTRAMETRIC_CLI_DISCLOSURE).toContain('also operates this site')
    expect(ULTRAMETRIC_CLI_DISCLOSURE).toContain('your agent does the work')
    expect(ULTRAMETRIC_CLI_DISCLOSURE).toContain('never affects the judged vendor picks')
  })

  it('the excluded hosted processes stay excluded: no corpus task maps to a different-result guide', () => {
    // A new mapping requires a verified catalog entry and a corpus task with the same result.
    const excluded = ['company-profile', 'ai-native-assessment', 'branding', 'delaware-review']
    const mapped = new Set(Object.values(ULTRAMETRIC_CLI_STEPS).map((e) => e.processId))
    for (const id of excluded) expect(mapped.has(id), `${id} must stay unmapped`).toBe(false)
  })
})
