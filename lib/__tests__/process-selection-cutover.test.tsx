// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { loadProcesses } from '../processes'
import { buildProcessCheckSteps } from '../processCheckData'
import { crossArenaStepRankings, functionMappingFor, stepVendorScore } from '../processRankings'
import { readSharedCatalog } from '../shared-processes/reader'
import { buildStepComparisons } from '../shared-processes/step-comparisons'
import { buildProcessProviderChoice } from '../shared-processes/provider-choice'
import { buildVendorPreview } from '../shared-processes/vendor-preview'
import { processSelectionContract } from '../shared-processes/page-compatibility'
import { restoreLegacySelection } from '../shared-processes/selection-compatibility'
import { VendorSelectionProvider, useVendorSelection } from '@/components/shared-processes/VendorSelection'
import StepComparisonTable from '@/components/shared-processes/StepComparisonTable'

const records = readSharedCatalog()
afterEach(cleanup)

describe('existing judged extra-arena selection compatibility', () => {
  it('restores every positive old candidate without promoting zero scores or changing process aggregates', () => {
    let extraCount = 0
    let zeroCount = 0
    let positiveCount = 0
    for (const task of loadProcesses()) {
      const record = records.find(record => record.id === task.id)!
      const comparisons = buildStepComparisons(record)
      const choice = buildProcessProviderChoice(record, comparisons)
      const contract = processSelectionContract(record, records, comparisons, choice, buildVendorPreview(record))
      const functionOnly = Object.fromEntries(Object.entries(comparisons).map(([scope, comparison]) => [scope, { ...comparison, additionalComparisons: undefined }]))
      expect(buildProcessProviderChoice(record, functionOnly)).toEqual(choice)
      for (const step of buildProcessCheckSteps(task)) {
        const binding = contract.steps.find(binding => binding.legacyStep?.nodeId === step.nodeId)!
        expect(binding).toBeDefined()
        const node = task.dag.nodes.find(node => node.id === step.nodeId)!
        const comparison = comparisons[binding.scope]
        const mapping = functionMappingFor(task.id, node)!
        // Function scores and citations are unchanged, including published zero rows.
        for (const product of comparison.products) {
          const expected = stepVendorScore(mapping.arenaId, mapping.storyIds, product.productId)!
          expect(product.score).toBe(expected.score)
          expect(product.stories.map(story => [story.id, story.verdict, story.quality, story.weight]))
            .toEqual(expected.cites.map(cite => [cite.storyId, cite.verdict, cite.quality, cite.weight]))
        }
        const originalExtras = crossArenaStepRankings(task.id, node)
        expect(comparison.additionalComparisons?.map(group => group.arenaId) ?? []).toEqual(originalExtras.map(group => group.arenaId))
        for (const [index, extra] of originalExtras.entries()) {
          const added = comparison.additionalComparisons![index]
          expect(added.products.map(product => [product.productId, product.score])).toEqual(extra.vendors.map(vendor => [vendor.productId, vendor.score]))
          expect(added.storyCount).toBe(extra.stories.length)
          for (const [i, product] of added.products.entries()) {
            expect(product.stories.map(story => [story.id, story.verdict, story.quality, story.weight]))
              .toEqual(extra.vendors[i].cites.map(cite => [cite.storyId, cite.verdict, cite.quality, cite.weight]))
          }
          extraCount += added.products.length
        }
        for (const arena of step.arenas) for (const vendor of arena.vendors.filter(vendor => !vendor.shutdown)) {
          const candidate = `${arena.arenaId}/${vendor.productId}`
          if (vendor.score <= 0) {
            expect(binding.candidates).not.toContain(candidate)
            zeroCount++
            continue
          }
          const restored = restoreLegacySelection(contract, { [arena.arenaId]: vendor.productId }, {})
          const selected = restored.overrides[binding.scope] ?? (binding.choiceScope ? restored.picks[binding.choiceScope] : undefined)
          expect(selected, `${task.id}/${step.nodeId}/${candidate}`).toBe(candidate)
          positiveCount++
        }
      }
    }
    expect(extraCount).toBe(93)
    expect(zeroCount).toBe(168)
    expect(positiveCount).toBe(2476)
  })

  it('keeps separate arena groups and one step override when switching between their candidates', () => {
    const record = records.find(record => record.id === 'qs_021')!
    const comparisons = buildStepComparisons(record)
    const [scope, comparison] = Object.entries(comparisons).find(([, comparison]) => comparison.additionalComparisons?.some(group => group.arenaId === 'ai-coding'))!
    function State() { const state = useVendorSelection(); return <output data-testid="selection">{JSON.stringify(state?.overrides)}</output> }
    const page = render(<VendorSelectionProvider><State /><StepComparisonTable comparison={comparison} scope={scope} /></VendorSelectionProvider>)
    expect(page.getAllByRole('region', { name: 'Step product comparison' })).toHaveLength(1 + comparison.additionalComparisons!.length)
    fireEvent.click(page.getByRole('button', { name: 'Use Codex for this step' }))
    expect(page.getByTestId('selection').textContent).toBe(JSON.stringify({ [scope]: 'ai-coding/codex' }))
    expect(page.getByRole('button', { name: 'Use Codex for this step' }).getAttribute('aria-pressed')).toBe('true')
    const original = comparison.products.find(product => product.score > 0)!
    fireEvent.click(page.getByRole('button', { name: `Use ${original.name} for this step` }))
    expect(page.getByTestId('selection').textContent).toBe(JSON.stringify({ [scope]: original.id }))
    expect(page.getByRole('button', { name: 'Use Codex for this step' }).getAttribute('aria-pressed')).toBe('false')
  })
})
