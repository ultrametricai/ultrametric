import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  auditProcessArenaCoverage,
  PROCESS_ARENA_COVERAGE_FILE,
  processArenaCoverageMarkdown,
} from '../../scripts/generate-process-arena-coverage'

// The TIMELINE-INVERSIONS pattern: the committed coverage report is pinned to the live corpus +
// registry — any corpus/registry change that moves the audit fails here until the report is
// regenerated (npx tsx scripts/generate-process-arena-coverage.ts).

describe('process → arena coverage audit', () => {
  it('docs/PROCESS-ARENA-COVERAGE.md matches what the live corpus generates', () => {
    expect(fs.readFileSync(PROCESS_ARENA_COVERAGE_FILE, 'utf8')).toBe(processArenaCoverageMarkdown())
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
