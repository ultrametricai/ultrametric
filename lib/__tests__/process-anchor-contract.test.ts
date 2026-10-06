// The legacy anchor contract (docs/PR171-EXTRACTION.md, bucket c — lifted from PR #171's
// route-cutover suite and rescoped off the route registry): every published
// step-<task>-<node> hash maps to an existing mounted shared scope without renaming any
// scope, and geo/hash conflicts resolve honestly (a reached state is never claimed when
// the explicit country contradicts the target's region).
import { describe, expect, it } from 'vitest'
import { loadProcesses } from '../processes'
import { findSharedRecord, readSharedCatalog } from '../shared-processes/reader'
import { processAnchorContract, regionForGeo, resolveProcessAnchor } from '../shared-processes/compatibility'
import { regionalDecision } from '../shared-processes/regions'
import { stepGuidanceFor } from '../shared-processes/step-guidance'

const records = readSharedCatalog()
const tasks = loadProcesses()

describe('legacy and native anchor contracts', () => {
  it('maps every default legacy node to an existing source scope without renaming any scope', () => {
    let count = 0
    for (const task of tasks) {
      const record = findSharedRecord(records, task.id)!
      const contract = processAnchorContract(record, records, task)
      for (const node of task.dag.nodes) {
        const key = `step-${task.id}-${node.id}`
        const target = contract.targets[key]
        expect(contract.scopes[target], key).toBeDefined()
        expect(contract.aliases[target]).toContain(key)
        expect(resolveProcessAnchor(contract, `#${key}`, 'default', false).status).toBe('reachable')
        count++
      }
    }
    expect(count).toBe(856)
  })

  it('preserves reviewed branding activities and records the pre-existing logo title drift', () => {
    const logo = findSharedRecord(records, 'brand_002')!
    const task = tasks.find(task => task.id === logo.id)!
    const contract = processAnchorContract(logo, records, task)
    expect(contract.targets['step-brand_002-n1']).toBe('brand_002:n1:image-generation')
    expect(contract.targets['step-brand_002-n2']).toBe('brand_002:n2')
    const returned = logo.parts.find(part => part.id === 'n2')!
    expect(returned.metadata.producesArtifact).toBe('brand-logo')
    expect(returned.guidance?.trim()).toBe(stepGuidanceFor('brand_002', 'n2'))
    // Existing stable-ID mapping predates any cutover; this does not claim selection equals handoff.
    expect(task.dag.nodes.find(node => node.id === 'n2')?.label).toBe('Set primary logo')
    expect(returned.title).toBe('Return the useful logo set and design choices')
  })

  it('honors explicit geo conflicts and restores source-declared options only when geo is absent', () => {
    const record = findSharedRecord(records, 'form_001')!
    const contract = processAnchorContract(record, records, tasks.find(task => task.id === record.id))
    const india = regionForGeo(regionalDecision(record), 'IN')
    expect(india).toEqual({ explicit: true, region: 'india-spice-plus' })
    expect(regionForGeo(regionalDecision(record), 'GB').region).toBe('uk-companies-house')
    expect(resolveProcessAnchor(contract, '#step-form_001-n1', india.region!, true).status).toBe('conflict')
    expect(resolveProcessAnchor(contract, '#step-form_001-n4', india.region!, true)).toEqual({ status: 'reachable', target: 'form_001:n4', region: undefined })
    expect(resolveProcessAnchor(contract, '#form_001%3An4%3Aindia-spice-plus', 'default', false)).toEqual({ status: 'reachable', target: 'form_001:n4:india-spice-plus', region: 'india-spice-plus' })
    expect(resolveProcessAnchor(contract, '#%invalid', 'default', false).status).toBe('unknown')
  })

  it('maps countries to source-declared options only — US/GLOBAL to default, GB as the UK alias, legacy countries explicit', () => {
    const decision = regionalDecision(findSharedRecord(records, 'form_001')!)
    expect(regionForGeo(decision, null)).toEqual({ explicit: false, region: undefined })
    expect(regionForGeo(decision, 'US')).toEqual({ explicit: true, region: 'default' })
    expect(regionForGeo(decision, 'GLOBAL')).toEqual({ explicit: true, region: 'default' })
    // A supported legacy country with no local variant stays explicit, on the default
    // scope, never relabelled; an unsupported token is neither explicit nor a region.
    expect(regionForGeo(undefined, 'CA')).toEqual({ explicit: true, region: undefined })
    expect(regionForGeo(decision, 'XX')).toEqual({ explicit: false, region: undefined })
  })
})
