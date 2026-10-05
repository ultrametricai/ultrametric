import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  computeChipsForStep, loadBusinessLogicMap, loadBusinessLogicSteps, moduleReadmeHref,
  modulesForProcess,
} from '../businessLogicMap'
import { loadProcesses } from '../processes'

// Totality gate for the open-modules ↔ process map (founder 2026-10-02, deepened same day):
// every mapped module id is a real lib/openstartup file, every mapped process id exists in the
// corpus, every chip target (label/anchor) resolves to a real heading in
// open-modules/README.md — and, for the per-step layer, every entry's node id exists in that
// process's DAG, its (module, process) pair is also task-level mapped, and its named function
// is a REAL exported function of the module (a misspelled name fails the suite). The map is
// curation; these tests make sure the curation can never point at nothing. The README "Serves"
// sync direction lives in businessLogicServes.test.ts.

const ROOT = path.resolve(__dirname, '..', '..')
const README = fs.readFileSync(path.join(ROOT, 'open-modules', 'README.md'), 'utf8')

// GitHub's heading slug (github-slugger behavior for these headings): lowercase, strip
// everything but letters/numbers/spaces/hyphens, spaces → hyphens. The registry anchors are
// validated against the README headings through this, so a reworded heading fails here instead
// of 404ing the chip.
function githubSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-')
}

describe('processes/business-logic-map.json totality', () => {
  const map = loadBusinessLogicMap()
  const processIds = new Set(loadProcesses().map((t) => t.id))

  it('maps at least the founder-named module families', () => {
    for (const id of ['deFranchiseTax', 'election83b', 'deadlines', 'capTable', 'vesting', 'round', 'antiDilution', 'waterfall', 'qsbs', 'payrollTax', 'rdCredit', 'runway']) {
      expect(map[id], `module ${id} missing from the map`).toBeDefined()
    }
  })

  it('every module id is the basename of a real lib/openstartup file', () => {
    for (const [id, m] of Object.entries(map)) {
      expect(m.file, `module ${id}: file/id mismatch`).toBe(`lib/openstartup/${id}.ts`)
      expect(fs.existsSync(path.join(ROOT, m.file)), `module ${id}: ${m.file} does not exist`).toBe(true)
    }
  })

  it('every mapped process id exists in the corpus, with no duplicates per module', () => {
    for (const [id, m] of Object.entries(map)) {
      expect(new Set(m.processes).size, `module ${id} lists a process twice`).toBe(m.processes.length)
      for (const pid of m.processes) {
        expect(processIds.has(pid), `module ${id} maps unknown process ${pid}`).toBe(true)
      }
    }
  })

  it('every label is a real README heading and every anchor is its GitHub slug', () => {
    for (const [id, m] of Object.entries(map)) {
      expect(README.includes(`### ${m.label}`), `module ${id}: no "### ${m.label}" heading in open-modules/README.md`).toBe(true)
      expect(githubSlug(m.label), `module ${id}: anchor drifted from the heading slug`).toBe(m.anchor)
    }
  })

  it('modulesForProcess resolves the franchise-tax wiring (process + delinquency situation)', () => {
    const tax = modulesForProcess('tax_001').map((c) => c.id)
    expect(tax).toContain('deFranchiseTax')
    expect(tax).toContain('deadlines')
    const cure = modulesForProcess('sit_010').map((c) => c.id)
    expect(cure).toContain('deFranchiseTax')
    // Chip hrefs deep-link into the README on GitHub.
    expect(modulesForProcess('tax_001')[0].href).toBe(moduleReadmeHref(loadBusinessLogicMap()[modulesForProcess('tax_001')[0].id].anchor))
    expect(moduleReadmeHref('cap-table')).toMatch(/^https:\/\/github\.com\/.+\/open-modules\/README\.md#cap-table$/)
    // Unmapped tasks render nothing.
    expect(modulesForProcess('ops_001')).toEqual([])
  })
})

describe('processes/business-logic-map.json step-level totality', () => {
  const map = loadBusinessLogicMap()
  const steps = loadBusinessLogicSteps()
  const tasks = new Map(loadProcesses().map((t) => [t.id, t]))

  it('carries the honest curated set (both bounds guard against decorating and silent loss)', () => {
    expect(steps.length).toBeGreaterThanOrEqual(25)
    // Ceiling raised 60 → 75 with the business-logic deep pass (founder 2026-10-02): the
    // composer/unit-economics/deferred-revenue modules added curated step entries
    // (fund_002 n1/n7/n9, fund_006 n4, fin_003 n4, scale_005 n4, growth_002 n3,
    // growth_014 n4/n7, fin_002 n5). The bound still exists to force this comment the
    // next time someone is tempted to decorate.
    expect(steps.length).toBeLessThanOrEqual(75)
  })

  it('every entry names a known module whose task-level processes include the step process', () => {
    for (const s of steps) {
      const key = `${s.processId}/${s.nodeId}`
      expect(map[s.module], `${key}: unknown module ${s.module}`).toBeDefined()
      expect(
        map[s.module].processes,
        `${key}: module ${s.module} maps the step but not the process at task level`,
      ).toContain(s.processId)
    }
  })

  it('every entry points at a real step of a real process', () => {
    for (const s of steps) {
      const t = tasks.get(s.processId)
      expect(t, `step entry maps unknown process ${s.processId}`).toBeDefined()
      expect(
        t!.dag.nodes.some((n) => n.id === s.nodeId),
        `${s.processId}: no node ${s.nodeId} (module ${s.module}.${s.function})`,
      ).toBe(true)
    }
  })

  it('every entry names a real exported FUNCTION of its module (misspellings fail here)', async () => {
    for (const s of steps) {
      const mod: Record<string, unknown> = await import(`../openstartup/${s.module}.ts`)
      expect(
        typeof mod[s.function],
        `${s.processId}/${s.nodeId}: ${s.module}.${s.function} is not an exported function`,
      ).toBe('function')
    }
  })

  it('no duplicate (process, node, module, function) entries', () => {
    const keys = steps.map((s) => `${s.processId}|${s.nodeId}|${s.module}|${s.function}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('computeChipsForStep resolves the 83(b) wiring and renders nothing for unmapped steps', () => {
    const chips = computeChipsForStep('form_001', 'n8a')
    expect(chips.map((c) => `${c.module}.${c.fn}`)).toContain('election83b.compare83bScenario')
    for (const c of chips) {
      expect(c.href).toBe(moduleReadmeHref(loadBusinessLogicMap()[c.module].anchor))
      expect(c.what.length).toBeGreaterThan(10)
    }
    // The filing step leans on the deadlines clock, not the money math.
    expect(computeChipsForStep('form_001', 'n8').map((c) => `${c.module}.${c.fn}`)).toEqual([
      'deadlines.election83bWindow',
    ])
    expect(computeChipsForStep('form_001', 'n1')).toEqual([])
    expect(computeChipsForStep('ops_001', 'n1')).toEqual([])
  })
})
