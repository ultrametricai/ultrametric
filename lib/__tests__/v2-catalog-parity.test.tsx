import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadProcesses } from '../processes'
import { crossArenaStepRankings, processLeaderboard } from '../processRankings'
import { loadStepVendorCalls } from '../stepVendorCalls'
import { processAnchorContract } from '../shared-processes/compatibility'
import { sourceStepScope } from '../shared-processes/source-step'
import { buildStepComparisons } from '../shared-processes/step-comparisons'
import { buildStepReceipts, buildComposedReceipts } from '../shared-processes/step-receipts'
import { readerContext } from '../shared-processes/reader-context'
import { readSharedCatalog } from '../shared-processes/reader'
import { processSelectionContract } from '../shared-processes/page-compatibility'
import { restoreLegacySelection } from '../shared-processes/selection-compatibility'
import { CountryContext } from '@/components/shared-processes/RegionalVariant'
import SharedProcessPreview from '@/components/shared-processes/SharedProcessPreview'
import StepReceipts from '@/components/shared-processes/StepReceipts'

const records = readSharedCatalog()
const tasks = loadProcesses()

describe('v2 current-catalog parity adapters', () => {
  it('preserves every country note and situation trigger/urgency from the current metadata', () => {
    let noteCount = 0, situationCount = 0
    for (const record of records) {
      const context = readerContext(record)
      expect(context.notes).toEqual(record.metadata.geoNotes ?? [])
      const html = renderToStaticMarkup(<CountryContext notes={context.notes} geoScope={context.geoScope} />)
      expect((html.match(/data-country-note=/g) ?? []).length).toBe(context.notes.length)
      noteCount += context.notes.length
      if (record.metadata.kind === 'situation') {
        expect(context.trigger).toBe(record.metadata.trigger)
        expect(context.urgency?.label).toBe(`act within ${record.metadata.urgency}`)
        situationCount++
      }
    }
    expect(noteCount).toBe(298)
    expect(situationCount).toBe(22)
  })

  it('carries every canonical extra-arena group with unchanged order, scores and citations, including extra-only steps', () => {
    let groups = 0, extraOnly = 0
    for (const task of tasks) {
      const record = records.find(record => record.id === task.id)!
      const before = processLeaderboard(task)
      const comparisons = buildStepComparisons(record)
      const contract = processSelectionContract(record, records, comparisons)
      for (const node of task.dag.nodes) {
        const canonical = crossArenaStepRankings(task.id, node)
        if (!canonical.length) continue
        const scope = sourceStepScope(record, node, processAnchorContract(record, records, task))!
        const comparison = comparisons[scope]
        expect(comparison, scope).toBeDefined()
        expect(comparison.additionalComparisons?.map(group => ({ arenaId: group.arenaId, products: group.products.map(product => ({ id: product.productId, score: product.score, stories: product.stories.map(story => [story.id, story.verdict, story.quality, story.weight]) })) })))
          .toEqual(canonical.map(group => ({ arenaId: group.arenaId, products: group.vendors.map(product => ({ id: product.productId, score: product.score, stories: product.cites.map(cite => [cite.storyId, cite.verdict, cite.quality, cite.weight]) })) })))
        for (const group of canonical) for (const vendor of group.vendors) {
          const selected = restoreLegacySelection(contract, { [group.arenaId]: vendor.productId }, {})
          expect(selected.overrides[scope], `${scope}/${vendor.productId}`).toBe(`${group.arenaId}/${vendor.productId}`)
        }
        groups += canonical.length
        if (!comparison.products.length) extraOnly++
      }
      expect(processLeaderboard(task)).toEqual(before)
    }
    expect(groups).toBe(65)
    expect(extraOnly).toBe(39)
  })

  it('closes website and LLC drafting gaps while retaining separate authored method boundaries', () => {
    const site = buildStepComparisons(records.find(record => record.id === 'site_001')!)
    const ids = site['site_001:n1:default'].additionalComparisons!.flatMap(group => group.products.map(product => product.id))
    expect(ids).toEqual(expect.arrayContaining(['ai-assistants/chatgpt', 'ai-assistants/claude', 'design-tools/figma', 'design-tools/framer', 'design-tools/canva']))
    expect(site['site_001:n1:design-tool-publish']).toBeUndefined()
    const llc = buildStepComparisons(records.find(record => record.id === 'form_011')!)
    expect(llc['form_011:n5'].products).toEqual([])
    expect(llc['form_011:n5'].additionalComparisons![0].products.map(product => product.id)).toEqual(expect.arrayContaining(['ai-assistants/chatgpt', 'ai-assistants/claude']))
  })

  it('adapts committed grounded calls without legacy operation strings or alternative-method propagation', () => {
    const committed = loadStepVendorCalls()
    let groups = 0, calls = 0
    for (const record of records) for (const [scope, vendors] of Object.entries(buildStepReceipts(record))) {
      const nodeId = scope.split(':')[1]
      for (const vendor of vendors) {
        const entry = committed.find(entry => entry.taskId === record.id && entry.nodeId === nodeId && entry.productId === vendor.productId && entry.arenaId === vendor.arenaId)!
        expect(entry).toBeDefined()
        expect(vendor.calls).toEqual(entry.calls)
        expect(vendor.calls.every(call => !!call.sourceUrl)).toBe(true)
        groups++; calls += vendor.calls.length
      }
      const html = renderToStaticMarkup(<StepReceipts vendors={vendors} />)
      expect(html).toContain('do not establish a configured or tested process integration')
      expect(html).not.toContain('<button')
    }
    expect(groups).toBe(295); expect(calls).toBe(410)
    const site = records.find(record => record.id === 'site_001')!
    expect(buildStepReceipts(site)['site_001:n1:design-tool-publish']).toBeUndefined()
    const chain = records.find(record => record.id === 'launch-website')!
    expect(Object.keys(buildComposedReceipts(chain, records)).some(scope => scope.includes(':ref:'))).toBe(true)
  })

  it('renders the current v2 surface with notes, situation context and legacy targets without restored removed blocks', () => {
    const corporation = renderToStaticMarkup(SharedProcessPreview({ id: 'form_001' }))
    expect(corporation).toContain('Country notes (')
    expect(corporation).toContain('data-country-note="PT"')
    expect(corporation).toContain('data-country-note="CA"')
    expect(corporation).toContain('id="step-form_001-n4"')
    expect(corporation).toContain('id="steps"')
    expect(corporation).toContain('href="/processes/v2"')
    expect(corporation).toContain('Hard to undo')
    expect(corporation).not.toContain('if it goes wrong')
    const situation = renderToStaticMarkup(SharedProcessPreview({ id: 'sit_011' }))
    expect(situation).toContain('Trigger:')
    expect(situation).toContain('act within hours')
    const logo = renderToStaticMarkup(SharedProcessPreview({ id: 'brand_002' }))
    // Native hash scrolling must not expand a closed method before hydration.
    expect(logo.indexOf('id="step-brand_002-n1"')).toBeGreaterThan(0)
    expect(logo.indexOf('id="step-brand_002-n1"')).toBeLessThan(logo.indexOf('id="brand_002:n1:image-generation"'))
  })
})
