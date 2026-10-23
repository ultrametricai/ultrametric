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
    // Re-pinned at the treg addition (mcp-infrastructure, 2026-10-08): the new judged product
    // joins the mcp-infrastructure candidate lists of the steps mapped to that arena.
    // Re-pinned at the yc-coverage bring-up (issue #239, 2026-10-13): ten newly judged products
    // (moss, cactus-compute, channel3, stagewise, mirrors, bentolabs, chronicle-labs, gitcafe,
    // ardent, lightsprint) join the candidate lists of the steps mapped to their arenas.
    // Re-pinned at the radar bring-up with definition-checked placement (2026-10-13): zcode and
    // omnirush-gui join ai-coding and edge0 joins local-llm-runtimes, so the newly judged
    // products join the candidate lists of the steps mapped to those arenas.
    // Re-pinned at the 2026-10-14 radar bring-up: logo-design-skill joins agent-skills, so the
    // newly judged product joins the candidate lists of the steps mapped to that arena.
    // Re-pinned at the AngelList bring-up (2026-10-14): angellist joins equity-management, so
    // the newly judged product joins the candidate lists of the steps mapped to that arena.
    // Re-pinned at the validate-the-idea method routing (startup_001): the landing-page step
    // became the method-choice decision, so its vibe-coding function cells and design-tools
    // extra-arena cells leave the contract.
    // Re-pinned at the judge prompt v5 re-judge (2026-10-19, partial-credit boundary): the
    // five re-judged arenas' tier flips move some judged step scores to zero, so those
    // associations leave the positive candidate lists and join the published zero rows.
    // Re-pinned at the code-hosting evidence repair (2026-10-20): the arena re-ran its whole
    // evidence pipeline after the shared-host probe fix, normalize re-canonicalized 41 of its
    // 72 stories, and the step→story mapping regenerated against the new corpus, so the
    // code-hosting candidate cells re-partition between the positive and zero rows.
    // Re-pinned at the crm/product-analytics bring-up (2026-10-22): eight newly judged products
    // (pipedrive, close, folk, zoho-crm, google-analytics, heap, pendo, statsig) join the
    // candidate lists of the steps mapped to those arenas, and the product-analytics v4-residue
    // re-judge under prompt v5 moves some incumbent step scores into the published zero rows.
    // Re-pinned at the 2026-10-22 payroll + equity-management bring-up: nine newly judged
    // products (adp-run, paychex-flex, quickbooks-payroll, remote, oyster, warp-payroll, check;
    // eqvista, qapita) join the candidate lists of the steps mapped to those arenas, and the v5
    // re-judge the two arenas' stale v4 caches demanded re-partitions some incumbent cells
    // between the positive and zero rows. Counts moved again (2875/198 -> 2877/196) when the
    // PR #428 review's evidence-gap fix (recorded llms.txt probes for eqvista and adp-run,
    // payroll-specific Workforce API lines for quickbooks-payroll) re-judged those packs.
    // Re-pinned at the v5 settlement wave 1 (2026-10-23): ten arenas still serving pre-v5
    // verdicts (cloud-platforms, cloud-storage, virtual-mailboxes, backend-as-a-service,
    // data-warehouses, infra-as-code, ai-search-apis, sso-identity, customer-data-platforms,
    // team-chat) re-judged under the v5 partial-credit boundary, moving one judged step
    // association from the positive candidate lists into the published zero rows.
    expect(positiveCount).toBe(2876)
    expect(zeroCount).toBe(197)
    expect(extraArena).toBe(96)
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
