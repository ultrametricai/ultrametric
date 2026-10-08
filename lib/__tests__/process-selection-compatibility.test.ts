// Legacy selection compatibility (docs/PR171-EXTRACTION.md, bucket c — rescoped from
// PR #171's selection-cutover suite): every positive legacy vendor association in a
// step's FUNCTION arena restores onto the shared selection contract through the existing
// lens precedence (lib/processLens.ts resolveStepVendor), zero-score associations stay
// ineligible, and the judged scores/citations the contract consumes are the original
// pipeline numbers. The cross-arena judged groups (additionalComparisons) live on the
// reader branch; their 93 extra-arena associations are pinned here as awaiting that port
// rather than silently dropped.
import { describe, expect, it } from 'vitest'
import { loadProcesses } from '../processes'
import { buildProcessCheckSteps } from '../processCheckData'
import { functionMappingFor, stepVendorScore } from '../processRankings'
import { readSharedCatalog } from '../shared-processes/reader'
import { buildStepComparisons } from '../shared-processes/step-comparisons'
import { buildProcessProviderChoice } from '../shared-processes/provider-choice'
import { buildVendorPreview } from '../shared-processes/vendor-preview'
import { processSelectionContract } from '../shared-processes/page-compatibility'
import { parseSavedSelection, restoreLegacySelection, type SelectionContract } from '../shared-processes/selection-compatibility'

const records = readSharedCatalog()

describe('existing judged selection compatibility', () => {
  it('restores every positive function-arena candidate without promoting zero scores or changing judged numbers', () => {
    let extraArena = 0
    let zeroCount = 0
    let positiveCount = 0
    for (const task of loadProcesses()) {
      const record = records.find(record => record.id === task.id)!
      const comparisons = buildStepComparisons(record)
      const choice = buildProcessProviderChoice(record, comparisons)
      const contract = processSelectionContract(record, records, comparisons, choice, buildVendorPreview(record))
      for (const step of buildProcessCheckSteps(task)) {
        const binding = contract.steps.find(binding => binding.legacyStep?.nodeId === step.nodeId)!
        expect(binding, `${task.id}/${step.nodeId}`).toBeDefined()
        const node = task.dag.nodes.find(node => node.id === step.nodeId)!
        const mapping = functionMappingFor(task.id, node)
        // Function scores and citations are unchanged, including published zero rows.
        for (const product of comparisons[binding.scope].products) {
          const expected = stepVendorScore(mapping!.arenaId, mapping!.storyIds, product.productId)!
          expect(product.score).toBe(expected.score)
          expect(product.stories.map(story => [story.id, story.verdict, story.quality, story.weight]))
            .toEqual(expected.cites.map(cite => [cite.storyId, cite.verdict, cite.quality, cite.weight]))
        }
        for (const arena of step.arenas) for (const vendor of arena.vendors.filter(vendor => !vendor.shutdown)) {
          const candidate = `${arena.arenaId}/${vendor.productId}`
          if (vendor.score <= 0) {
            expect(binding.candidates, `${task.id}/${step.nodeId}/${candidate} (zero score)`).not.toContain(candidate)
            zeroCount++
            continue
          }
          if (arena.arenaId !== mapping?.arenaId) {
            // Cross-arena judged associations restore once the reader branch's
            // additionalComparisons land; until then they are not contract candidates.
            expect(binding.candidates, `${task.id}/${step.nodeId}/${candidate} (extra arena)`).not.toContain(candidate)
            extraArena++
            continue
          }
          const restored = restoreLegacySelection(contract, { [arena.arenaId]: vendor.productId }, {})
          const selected = restored.overrides[binding.scope] ?? (binding.choiceScope ? restored.picks[binding.choiceScope] : undefined)
          expect(selected, `${task.id}/${step.nodeId}/${candidate}`).toBe(candidate)
          positiveCount++
        }
      }
    }
    // Re-pinned at the government-services applicability scoping (founder 2026-10-08,
    // lib/processes.ts governmentStepEligibility): a government-covered step's candidates are
    // now only the agencies sharing its wired agency's committed country+area tags, so the
    // 2817 positive / 185 zero cells of the Phase 2 bring-up (2026-10-07, +31 judged agencies;
    // 2811 base + 6 sw_011 function cells) drop the foreign/wrong-area gov associations.
    expect(positiveCount).toBe(2491)
    expect(zeroCount).toBe(137)
    expect(extraArena).toBe(93)
  })

  it('accepts only contract-listed saved selections and rejects malformed payloads', () => {
    const contract: SelectionContract = {
      groups: [{ scope: 'p:n1', arenaId: 'legal-ops', candidates: ['legal-ops/clerky'] }],
      steps: [{ scope: 'p:n2', choiceScope: 'p:n1', candidates: ['legal-ops/clerky', 'legal-ops/stripe-atlas'] }],
    }
    expect(parseSavedSelection(JSON.stringify({
      picks: { 'p:n1': 'legal-ops/clerky', 'p:other': 'legal-ops/clerky' },
      overrides: { 'p:n2': 'legal-ops/stripe-atlas', 'p:n9': 'legal-ops/clerky' },
    }), contract)).toEqual({ picks: { 'p:n1': 'legal-ops/clerky' }, overrides: { 'p:n2': 'legal-ops/stripe-atlas' } })
    // A null override is a remembered explicit reset; a non-candidate pick never restores.
    expect(parseSavedSelection(JSON.stringify({ picks: { 'p:n1': 'legal-ops/unlisted' }, overrides: { 'p:n2': null } }), contract))
      .toEqual({ picks: {}, overrides: { 'p:n2': null } })
    expect(parseSavedSelection(null, contract)).toBeUndefined()
    expect(parseSavedSelection('not json', contract)).toBeUndefined()
    expect(parseSavedSelection(JSON.stringify(['array']), contract)).toBeUndefined()
  })
})
