import { describe, expect, it } from 'vitest'
import {
  auditProcessArenaCoverage,
  processArenaCoverageMarkdown,
} from '../../scripts/generate-process-arena-coverage'

describe('process → arena coverage audit', () => {
  it('reports every unresolved vendor from the current corpus', () => {
    const audit = auditProcessArenaCoverage()
    const report = processArenaCoverageMarkdown()
    for (const vendor of audit.unregistered) expect(report).toContain(`\`${vendor}\``)
  })

  it('has ZERO mechanical gaps: every registry arenaId names a real arena', () => {
    // The one auto-fixable class (a key typo pointing at nothing) must stay empty — anything
    // else in the report is curation, but this failing means a registry edit broke a pointer.
    expect(auditProcessArenaCoverage().badArena).toEqual([])
  })

  it('classifies every corpus vendor: tracked + deliberately untracked + unregistered = all', () => {
    const a = auditProcessArenaCoverage()
    expect(a.tracked.length + a.untrackedRegistered.length + a.unregistered.length).toBe(a.vendorRefs.size)
    // Tracked vendors dominate — the registry is the resolution path, not the exception.
    expect(a.tracked.length).toBeGreaterThan(a.unregistered.length)
  })
})
