import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPopulated, loadCategory } from '@/lib/data'
import {
  chainTasks, GOVERNMENT_ARENA_ID, governmentStepEligibility, loadChains, loadProcesses,
  STEP_OPTIONS_CAP, vendorAlternatives, vendorProductId,
} from '@/lib/processes'
import {
  COMPUTER_USE_SOURCES, computerUseEligibleProducts, computerUseMappingsFor, computerUseOptions,
  coveringArenaId, crossArenaStepRankings, extraArenasFor, extraMappingsFor, functionMappingFor,
  isComputerUseCandidate, loadStepStoryMap, processLeaderboard, stepRanking, stepVendorScore,
  temporarilyHumanSteps,
} from '@/lib/processRankings'
import { VERDICT_FACTORS } from '@/lib/scoring'
import { isShutdown } from '@/lib/shutdown'

const DATA_DIR = path.resolve(__dirname, '../../data')

const tasks = () => loadProcesses(DATA_DIR)

describe('committed step→story mapping (data/process-step-stories.json)', () => {
  it('exists — the rankings feature ships with its mapping', () => {
    expect(fs.existsSync(path.join(DATA_DIR, 'process-step-stories.json'))).toBe(true)
    expect(loadStepStoryMap(DATA_DIR).length).toBeGreaterThan(0)
  })

  it('every entry targets a real (task, node), a populated arena, and REAL story ids of that arena', () => {
    const nodeByKey = new Map(
      tasks().flatMap((t) => t.dag.nodes.map((n) => [`${t.id}:${n.id}`, { task: t, node: n }] as const)),
    )
    const storyIdsOf = new Map<string, Set<string>>()
    for (const e of loadStepStoryMap(DATA_DIR)) {
      const hit = nodeByKey.get(`${e.taskId}:${e.nodeId}`)
      expect(hit, `mapping targets unknown step ${e.taskId}:${e.nodeId}`).toBeDefined()
      expect(isPopulated(e.arenaId, DATA_DIR), `mapping targets unpopulated arena ${e.arenaId}`).toBe(true)
      if (!storyIdsOf.has(e.arenaId)) {
        storyIdsOf.set(e.arenaId, new Set(loadCategory(e.arenaId, DATA_DIR).stories.map((s) => s.id)))
      }
      const known = storyIdsOf.get(e.arenaId)!
      for (const sid of e.storyIds) {
        expect(known.has(sid), `mapping ${e.taskId}:${e.nodeId} cites unknown story ${e.arenaId}/${sid}`).toBe(true)
      }
      expect(new Set(e.storyIds).size, `duplicate storyIds in ${e.taskId}:${e.nodeId}`).toBe(e.storyIds.length)
      expect(e.storyIds.length, `mapping ${e.taskId}:${e.nodeId} exceeds the per-step cap`).toBeLessThanOrEqual(8)
    }
  })

  it('kinds are honest: function entries match the step\'s covering arena; extra entries only for declared extra arenas; computer-use entries only for manual (non-agent) steps, only from fleet sources', () => {
    const nodeByKey = new Map(
      tasks().flatMap((t) => t.dag.nodes.map((n) => [`${t.id}:${n.id}`, n] as const)),
    )
    const sourceByArena = new Map(COMPUTER_USE_SOURCES.map((s) => [s.arenaId, s]))
    const seen = new Set<string>()
    for (const e of loadStepStoryMap(DATA_DIR)) {
      const key = `${e.taskId}:${e.nodeId}:${e.kind}:${e.arenaId}`
      expect(seen.has(key), `duplicate mapping ${key}`).toBe(false)
      seen.add(key)
      const node = nodeByKey.get(`${e.taskId}:${e.nodeId}`)!
      if (e.kind === 'function') {
        expect(e.arenaId, `function mapping ${e.taskId}:${e.nodeId} disagrees with the covering arena`)
          .toBe(coveringArenaId(node))
      } else if (e.kind === 'extra') {
        expect(extraArenasFor(node), `extra mapping ${e.taskId}:${e.nodeId} targets undeclared arena ${e.arenaId}`)
          .toContain(e.arenaId)
      } else {
        // Founder 2026-09-18: every MANUAL step (any non-agent route) is a computer-use
        // candidate — agent steps never are.
        expect(isComputerUseCandidate(node), `computer-use mapping on agent step ${e.taskId}:${e.nodeId}`).toBe(true)
        const source = sourceByArena.get(e.arenaId)
        expect(source, `computer-use mapping from non-fleet arena ${e.arenaId}`).toBeDefined()
        // Assistants may only be mapped onto their judged computer-use stories — never onto
        // generic assistant capabilities.
        if (source!.storyIds !== null) {
          for (const sid of e.storyIds) expect(source!.storyIds).toContain(sid)
        }
      }
    }
  })

  it('is complete: every step with a populated covering arena has a function mapping; every declared extra arena has an extra mapping; every manual step has its computer-use mappings', () => {
    for (const task of tasks()) {
      for (const node of task.dag.nodes) {
        const arenaId = coveringArenaId(node)
        if (arenaId && isPopulated(arenaId, DATA_DIR)) {
          expect(functionMappingFor(task.id, node, DATA_DIR), `missing function mapping for ${task.id}:${node.id}`).not.toBeNull()
        }
        const extraArenas = extraArenasFor(node).filter((a) => isPopulated(a, DATA_DIR))
        expect(
          extraMappingsFor(task.id, node, DATA_DIR).map((e) => e.arenaId).sort(),
          `missing extra mapping(s) for ${task.id}:${node.id}`,
        ).toEqual([...extraArenas].sort())
      }
    }
    const populatedSources = COMPUTER_USE_SOURCES.filter((s) => isPopulated(s.arenaId, DATA_DIR))
    expect(populatedSources.length).toBeGreaterThan(0)
    for (const task of tasks()) {
      for (const node of task.dag.nodes) {
        const mapped = computerUseMappingsFor(task.id, node.id, DATA_DIR)
        if (isComputerUseCandidate(node)) {
          expect(mapped.length, `missing computer-use mappings for ${task.id}:${node.id}`).toBe(populatedSources.length)
        } else {
          expect(mapped.length, `computer-use mapping on agent step ${task.id}:${node.id}`).toBe(0)
        }
      }
    }
  })
})

describe('step scores are deterministic recomputations of the judged verdicts', () => {
  // Independent recompute of the documented formula — weight × quality × verdict factor over
  // the mapped stories, na excluded — straight from the raw data files.
  function recompute(arenaId: string, storyIds: string[], productId: string): number | null {
    const stories = JSON.parse(fs.readFileSync(path.join(DATA_DIR, arenaId, 'stories.json'), 'utf8')) as
      Array<{ id: string; weight: number }>
    const verdicts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, arenaId, 'verdicts.json'), 'utf8')) as
      Array<{ productId: string; storyId: string; verdict: keyof typeof VERDICT_FACTORS; quality: number }>
    const weightOf = new Map(stories.map((s) => [s.id, s.weight]))
    let num = 0
    let den = 0
    for (const sid of storyIds) {
      const v = verdicts.find((x) => x.productId === productId && x.storyId === sid)
      if (!v || v.verdict === 'na') continue
      const w = weightOf.get(sid)!
      num += w * v.quality * VERDICT_FACTORS[v.verdict]
      den += w * 10
    }
    if (den === 0) return null
    return Math.round((num / den) * 100 * 10) / 10
  }

  it('every ranked step score matches the from-scratch recompute (first 25 mapped steps)', () => {
    let checked = 0
    outer: for (const task of tasks()) {
      for (const node of task.dag.nodes) {
        const ranking = stepRanking(task.id, node, DATA_DIR)
        if (!ranking) continue
        for (const v of ranking.vendors) {
          expect(v.score, `${task.id}:${node.id} ${v.productId}`).toBe(
            recompute(ranking.arenaId, ranking.stories.map((s) => s.id), v.productId),
          )
          expect(v.score).toBeGreaterThanOrEqual(0)
          expect(v.score).toBeLessThanOrEqual(100)
        }
        expect(ranking.vendors.length).toBeLessThanOrEqual(STEP_OPTIONS_CAP)
        // Ranked best-first.
        for (let i = 1; i < ranking.vendors.length; i++) {
          expect(ranking.vendors[i - 1].score).toBeGreaterThanOrEqual(ranking.vendors[i].score)
        }
        checked += 1
        if (checked >= 25) break outer
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('cites behind a score reference the real verdict rows', () => {
    const task = tasks().find((t) => t.dag.nodes.some((n) => stepRanking(t.id, n, DATA_DIR)))!
    const node = task.dag.nodes.find((n) => stepRanking(task.id, n, DATA_DIR))!
    const ranking = stepRanking(task.id, node, DATA_DIR)!
    const { verdicts } = loadCategory(ranking.arenaId, DATA_DIR)
    for (const v of ranking.vendors) {
      expect(v.cites.length).toBeGreaterThan(0)
      for (const c of v.cites) {
        const real = verdicts.find((x) => x.productId === v.productId && x.storyId === c.storyId)
        expect(real, `cite ${v.productId}:${c.storyId} has no verdict row`).toBeDefined()
        expect(c.verdict).toBe(real!.verdict)
        expect(c.quality).toBe(real!.quality)
      }
    }
  })

  it('recomputing a process leaderboard twice is bit-identical (pure derivation)', () => {
    const task = tasks().find((t) => processLeaderboard(t, DATA_DIR).entries.length > 0)!
    const a = processLeaderboard(task, DATA_DIR)
    const b = processLeaderboard(task, DATA_DIR)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('process leaderboard (coverage × step scores)', () => {
  it('processScore = sum of served step scores over rankable steps; avg over served steps', () => {
    const task = tasks().find((t) => {
      const lb = processLeaderboard(t, DATA_DIR)
      return lb.entries.length > 2 && lb.rankableSteps > 1
    })!
    const lb = processLeaderboard(task, DATA_DIR)
    for (const e of lb.entries) {
      const sum = e.steps.reduce((acc, s) => acc + s.score, 0)
      expect(e.stepsServed).toBe(e.steps.length)
      expect(e.avgStepScore).toBe(Math.round((sum / e.stepsServed) * 10) / 10)
      expect(e.processScore).toBe(Math.round((sum / lb.rankableSteps) * 10) / 10)
      expect(e.processScore).toBeLessThanOrEqual(e.avgStepScore + 1e-9)
    }
    // Sorted best-first.
    for (let i = 1; i < lb.entries.length; i++) {
      expect(lb.entries[i - 1].processScore).toBeGreaterThanOrEqual(lb.entries[i].processScore)
    }
    // The best-per-step chain names each rankable step's top vendor.
    expect(lb.bestPerStep.length).toBe(lb.rankableSteps)
    for (const s of lb.bestPerStep) {
      const ranking = stepRanking(task.id, task.dag.nodes.find((n) => n.id === s.nodeId)!, DATA_DIR)!
      expect(s.top.productId).toBe(ranking.vendors[0].productId)
      expect(s.top.score).toBe(ranking.vendors[0].score)
    }
  })
})

describe('computer use for manual steps — judged evidence only', () => {
  it('every option (across ALL manual steps, form and person alike) comes from the browser-agents roster or an assistant with a judged full/partial computer-use verdict', () => {
    const eligibleByArena = new Map(
      COMPUTER_USE_SOURCES
        .filter((s) => isPopulated(s.arenaId, DATA_DIR))
        .map((s) => [s.arenaId, computerUseEligibleProducts(s, DATA_DIR)] as const),
    )
    let optionSteps = 0
    for (const task of tasks()) {
      for (const node of task.dag.nodes.filter(isComputerUseCandidate)) {
        const options = computerUseOptions(task.id, node.id, DATA_DIR)
        expect(options.length).toBeLessThanOrEqual(STEP_OPTIONS_CAP)
        if (options.length > 0) optionSteps += 1
        for (const o of options) {
          const eligible = eligibleByArena.get(o.arenaId)
          expect(eligible, `option from non-fleet arena ${o.arenaId}`).toBeDefined()
          expect(eligible!.has(o.productId), `${o.productId} has no judged computer-use evidence`).toBe(true)
          // Never a vibes entry: a positive score backed by at least one full/partial verdict.
          expect(o.score).toBeGreaterThan(0)
          expect(o.cites.some((c) => c.verdict === 'full' || c.verdict === 'partial')).toBe(true)
        }
      }
    }
    // The feature actually surfaces options somewhere (not vacuously green).
    expect(optionSteps).toBeGreaterThan(0)
  })

  it('founder 2026-09-18: "any time manual is seen" — form-route steps carry computer-use options too, not just irreducible human steps', () => {
    // Steps beyond the old irreducible-only set now get options (the founder's ask): count the
    // form-route steps with judged evidence that the previous mechanism would have skipped.
    const irreducibleKeys = new Set(temporarilyHumanSteps(tasks()).map((g) => `${g.taskId}:${g.node.id}`))
    let formStepsWithOptions = 0
    let beyondIrreducible = 0
    for (const task of tasks()) {
      for (const node of task.dag.nodes) {
        if (node.route !== 'form') continue
        if (computerUseOptions(task.id, node.id, DATA_DIR).length > 0) {
          formStepsWithOptions += 1
          if (!irreducibleKeys.has(`${task.id}:${node.id}`)) beyondIrreducible += 1
        }
      }
    }
    // A real share of the manual-portal work has judged attempt-it-today evidence, and most of
    // it is NEW coverage the irreducible-only mechanism never reached.
    expect(formStepsWithOptions).toBeGreaterThanOrEqual(20)
    expect(beyondIrreducible).toBeGreaterThanOrEqual(20)
    // The anchor: the Mercury application (manual form, no API path) shows who could attempt it.
    const bank = tasks().find((t) => t.id === 'qs_023')!
    const apply = bank.dag.nodes.find((n) => n.id === 'n3')!
    expect(apply.route).toBe('form')
    const options = computerUseOptions(bank.id, apply.id, DATA_DIR)
    expect(options.length).toBeGreaterThan(0)
    expect(options.some((o) => o.arenaId === 'browser-agents')).toBe(true)
  })

  it('assistants without judged computer-use evidence are excluded from eligibility', () => {
    const assistants = COMPUTER_USE_SOURCES.find((s) => s.arenaId === 'ai-assistants')!
    const eligible = computerUseEligibleProducts(assistants, DATA_DIR)
    const { products, verdicts } = loadCategory('ai-assistants', DATA_DIR)
    for (const p of products) {
      const hasEvidence = verdicts.some(
        (v) => v.productId === p.id
          && assistants.storyIds!.includes(v.storyId)
          && (v.verdict === 'full' || v.verdict === 'partial'),
      )
      expect(eligible.has(p.id)).toBe(hasEvidence)
    }
  })
})

describe('cross-arena step options (extraOptionArenas / extraOptionRefs) — judged evidence only', () => {
  it('every cross-arena vendor is allowed by the node, scored on the committed extra mapping, and backed by a full/partial verdict', () => {
    let optionSteps = 0
    for (const task of tasks()) {
      for (const node of task.dag.nodes) {
        const rankings = crossArenaStepRankings(task.id, node, DATA_DIR)
        for (const r of rankings) {
          expect(r.kind).toBe('extra')
          expect(extraArenasFor(node)).toContain(r.arenaId)
          expect(r.arenaId).not.toBe(coveringArenaId(node))
          const wholeArena = (node.extraOptionArenas ?? []).includes(r.arenaId)
          const allowedRefs = new Set(
            (node.extraOptionRefs ?? []).filter((x) => x.arenaId === r.arenaId).map((x) => x.productId),
          )
          const mapping = extraMappingsFor(task.id, node, DATA_DIR).find((e) => e.arenaId === r.arenaId)!
          expect(mapping.storyIds.length).toBeGreaterThan(0)
          const mapped = new Set(mapping.storyIds)
          expect(r.vendors.length).toBeLessThanOrEqual(STEP_OPTIONS_CAP)
          for (const v of r.vendors) {
            if (!wholeArena) {
              expect(allowedRefs.has(v.productId), `${task.id}:${node.id}: ${v.productId} is not an allowed extra ref`).toBe(true)
            }
            // Never a vibes entry: positive score, at least one judged full/partial verdict,
            // every cite drawn from exactly the committed mapping.
            expect(v.score).toBeGreaterThan(0)
            expect(v.cites.some((c) => c.verdict === 'full' || c.verdict === 'partial')).toBe(true)
            for (const c of v.cites) expect(mapped.has(c.storyId)).toBe(true)
          }
        }
        if (rankings.length > 0) optionSteps += 1
      }
    }
    // The curation sweep actually landed: a meaningful slice of the corpus gained cross-arena vendors.
    expect(optionSteps).toBeGreaterThanOrEqual(50)
  })

  it('every committed extra ref survives the evidence gate — refs without a judged full/partial verdict must be pruned, not shipped', () => {
    for (const task of tasks()) {
      for (const node of task.dag.nodes) {
        const rankings = crossArenaStepRankings(task.id, node, DATA_DIR)
        for (const ref of node.extraOptionRefs ?? []) {
          const r = rankings.find((x) => x.arenaId === ref.arenaId)
          expect(
            r?.vendors.some((v) => v.productId === ref.productId),
            `${task.id}:${node.id}: extra ref ${ref.arenaId}/${ref.productId} has no judged full/partial evidence for this move — remove the ref (record it as an honest exclusion) or land the evidence`,
          ).toBe(true)
        }
      }
    }
  })

  it('cross-arena scores are the same weightedPercent recompute as primary step scores (first 10 rankings)', () => {
    let checked = 0
    outer: for (const task of tasks()) {
      for (const node of task.dag.nodes) {
        for (const r of crossArenaStepRankings(task.id, node, DATA_DIR)) {
          const { verdicts } = loadCategory(r.arenaId, DATA_DIR)
          for (const v of r.vendors) {
            let num = 0
            let den = 0
            for (const s of r.stories) {
              const row = verdicts.find((x) => x.productId === v.productId && x.storyId === s.id)
              if (!row || row.verdict === 'na') continue
              num += s.weight * row.quality * VERDICT_FACTORS[row.verdict]
              den += s.weight * 10
            }
            expect(v.score, `${task.id}:${node.id} ${r.arenaId}/${v.productId}`).toBe(
              Math.round((num / den) * 100 * 10) / 10,
            )
          }
          checked += 1
          if (checked >= 10) break outer
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('end-to-end: launch-website chain (founder ask: key other vendors for every move)', () => {
  it('site generation lists ChatGPT (ai-assistants) and Framer/Figma/Canva (design-tools) beside the vibe-coding roster, each evidence-backed', () => {
    const chain = loadChains(DATA_DIR).find((c) => c.id === 'launch-website')!
    const snapshot = chainTasks(chain, DATA_DIR).map((task) => ({
      task: task.id,
      steps: task.dag.nodes.map((n) => {
        const primary = stepRanking(task.id, n, DATA_DIR)
        const extras = crossArenaStepRankings(task.id, n, DATA_DIR)
        return {
          nodeId: n.id,
          label: n.label,
          primary: primary ? primary.vendors.map((v) => `${v.productId}:${v.score}`) : null,
          extras: extras.map((r) => ({
            arena: r.arenaId,
            vendors: r.vendors.map((v) => `${v.productId}:${v.score}`),
          })),
        }
      }),
    }))
    // The founder examples, asserted directly (not just snapshotted): "generate a website" is
    // served by ChatGPT and by the real design-tool site builders, with judged evidence.
    const gen = snapshot.find((t) => t.task === 'site_001')!.steps.find((s) => s.nodeId === 'n1')!
    expect(gen.extras.find((e) => e.arena === 'ai-assistants')?.vendors.some((v) => v.startsWith('chatgpt:'))).toBe(true)
    expect(gen.extras.find((e) => e.arena === 'design-tools')?.vendors.some((v) => v.startsWith('framer:'))).toBe(true)
    // Publishing is also served by the vibe-coding builders themselves (one-click publish).
    const publish = snapshot.find((t) => t.task === 'site_001')!.steps.find((s) => s.nodeId === 'n2')!
    expect(publish.extras.some((e) => e.arena === 'vibe-coding' && e.vendors.length > 0)).toBe(true)
    expect(snapshot).toMatchSnapshot()
  })

  it('poly is honestly excluded from site generation — its judged notes-knowledge stories do not evidence the move — but ships where it is evidenced', () => {
    // The founder asked for Poly on launch-website; the judged evidence says no (its
    // publish-notes-website verdict is none, and no notes-knowledge story maps to generating a
    // company site). Poly surfaces where its verdicts DO clear the gate: importing files.
    const site = tasks().find((t) => t.id === 'site_001')!
    for (const node of site.dag.nodes) {
      const vendors = crossArenaStepRankings(site.id, node, DATA_DIR).flatMap((r) => r.vendors)
      expect(vendors.some((v) => v.productId === 'poly')).toBe(false)
    }
    // The Dropbox-import opportunity folded into doc-storage setup (curation 2026-09-18) — the
    // import step carries the same Poly cross-arena ref.
    const docStorage = tasks().find((t) => t.id === 'qs_015')!
    const importStep = docStorage.dag.nodes.find((n) => n.id === 'n4')!
    const poly = crossArenaStepRankings(docStorage.id, importStep, DATA_DIR)
      .flatMap((r) => r.vendors)
      .find((v) => v.productId === 'poly')
    expect(poly).toBeDefined()
    expect(poly!.arenaId).toBe('notes-knowledge')
    expect(poly!.cites.some((c) => c.verdict === 'full' || c.verdict === 'partial')).toBe(true)
  })
})

describe('LLM-first thinking steps (founder 2026-09-30: "validation of the idea is more likely to be done in ChatGPT, Claude, Grok etc first and maybe Notion after")', () => {
  // The curated sweep: every step whose realistic first venue is a conversation with an
  // assistant now has ai-assistants as its PRIMARY covering arena — the judged assistant
  // rankings lead, nothing hand-ordered.
  const LLM_FIRST_STEPS: Array<[string, string]> = [
    ['startup_001', 'n1'], // draft problem hypothesis & target customer
    ['brand_001', 'n1'], // generate name candidates
    ['brand_001', 'n3'], // present ranked candidates
    ['vendor_011', 'n1'], // define requirements and constraints
    ['vendor_011', 'n2'], // research the market and shortlist
    ['hr_001', 'n1'], // draft offer letter
    ['hr_010', 'n5'], // draft the exec offer
    ['legal_004', 'n1'], // draft SaaS agreement template
    ['legal_004', 'n2'], // draft Terms of Service
    ['legal_004', 'n3'], // draft Privacy Policy
    ['scale_003', 'n1'], // draft handbook sections
    ['fund_001', 'n4'], // draft investor outreach emails
    ['growth_010', 'n1'], // prepare launch assets and copy
    ['growth_011', 'n1'], // keyword and topic research
    ['growth_011', 'n2'], // draft content with an agent
  ]

  it('every curated step covers to ai-assistants and carries a judged, non-empty assistant ranking', () => {
    const byId = new Map(tasks().map((t) => [t.id, t]))
    for (const [taskId, nodeId] of LLM_FIRST_STEPS) {
      const node = byId.get(taskId)!.dag.nodes.find((n) => n.id === nodeId)!
      expect(coveringArenaId(node), `${taskId}:${nodeId} should cover to ai-assistants`).toBe('ai-assistants')
      const r = stepRanking(taskId, node, DATA_DIR)
      expect(r, `${taskId}:${nodeId} should have a judged assistant ranking`).not.toBeNull()
      expect(r!.arenaId).toBe('ai-assistants')
      expect(r!.vendors.length).toBeGreaterThan(0)
      // No stale extra ref may duplicate the primary arena (the mapping kinds stay honest).
      expect((node.extraOptionRefs ?? []).some((x) => x.arenaId === 'ai-assistants')).toBe(false)
    }
  })

  it('validate-the-idea: the sim prints an assistant as the judged top pick, and the Notion capture step follows', () => {
    const task = tasks().find((t) => t.id === 'startup_001')!
    const draft = task.dag.nodes.find((n) => n.id === 'n1')!
    const r = stepRanking('startup_001', draft, DATA_DIR)!
    // The top pick is whatever the judged ai-assistants ranking says — a real assistant
    // product with runners-up, never a hand pick.
    const assistantIds = new Set(
      loadCategory('ai-assistants', DATA_DIR).products.map((p) => p.id),
    )
    expect(assistantIds.has(r.vendors[0].productId)).toBe(true)
    expect(r.vendors.length).toBeGreaterThanOrEqual(2) // runners-up exist for the sim terminal
    // "and maybe Notion after": the capture step covers to the arena where Notion is judged.
    const capture = task.dag.nodes.find((n) => n.id === 'n1b')!
    expect(capture.vendor).toBe('notion')
    expect(coveringArenaId(capture)).toBe('project-management')
    expect(stepRanking('startup_001', capture, DATA_DIR)).not.toBeNull()
  })
})

describe('end-to-end: Incorporate C-Corp (company-launch playbook)', () => {
  it('step rankings + process leaderboard + a temporarily-human step with computer-use options', () => {
    const task = tasks().find((t) => t.id === 'form_001')!
    const lb = processLeaderboard(task, DATA_DIR)
    const snapshot = {
      task: task.id,
      rankableSteps: lb.rankableSteps,
      totalSteps: lb.totalSteps,
      leaderboard: lb.entries.map((e) => ({
        productId: e.productId,
        arenaId: e.arenaId,
        stepsServed: e.stepsServed,
        processScore: e.processScore,
      })),
      bestPerStep: lb.bestPerStep.map((s) => ({ nodeId: s.nodeId, top: s.top.productId, score: s.top.score })),
      stepRankings: task.dag.nodes.map((n) => {
        const r = stepRanking(task.id, n, DATA_DIR)
        return {
          nodeId: n.id,
          label: n.label,
          ranked: r ? r.vendors.map((v) => `${v.productId}:${v.score}`) : null,
        }
      }),
      computerUse: temporarilyHumanSteps([task]).map((g) => ({
        nodeId: g.node.id,
        label: g.node.label,
        options: computerUseOptions(g.taskId, g.node.id, DATA_DIR).map((o) => `${o.arenaId}/${o.productId}:${o.score}`),
      })),
    }
    expect(snapshot.leaderboard.length).toBeGreaterThan(0)
    expect(snapshot).toMatchSnapshot()
  })

  // form_001 has no temporarily-human steps, so the computer-use surface is snapshotted on a
  // process that does: filing the corporate tax return (CPA prepare/review/file steps).
  it('temporarily-human steps carry ranked, verdict-backed computer-use options (corporate tax return)', () => {
    const task = tasks().find((t) => t.id === 'tax_002')!
    const cu = temporarilyHumanSteps([task]).map((g) => ({
      nodeId: g.node.id,
      label: g.node.label,
      options: computerUseOptions(g.taskId, g.node.id, DATA_DIR).map((o) => `${o.arenaId}/${o.productId}:${o.score}`),
    }))
    expect(cu.some((s) => s.options.length > 0)).toBe(true)
    expect(cu).toMatchSnapshot()
  })
})

describe('government-services step applicability (founder 2026-10-08: scope candidates by committed country+area tags)', () => {
  const govProducts = () => loadCategory(GOVERNMENT_ARENA_ID, DATA_DIR).products

  it('every government-covered step derives its required country+area from its wired agency, and every candidate shares both tags', () => {
    const byId = new Map(govProducts().map((p) => [p.id, p]))
    const unfiltered: string[] = []
    let checkedSteps = 0
    for (const task of tasks()) {
      for (const node of task.dag.nodes) {
        if (coveringArenaId(node) !== GOVERNMENT_ARENA_ID) continue
        const eligible = governmentStepEligibility(node, GOVERNMENT_ARENA_ID, DATA_DIR)
        if (!eligible) {
          unfiltered.push(`${task.id}:${node.id}`)
          continue
        }
        const anchor = byId.get(vendorProductId(node.vendor!))!
        const r = stepRanking(task.id, node, DATA_DIR)
        if (!r) continue
        checkedSteps += 1
        for (const v of r.vendors) {
          const p = byId.get(v.productId)!
          expect(p.country, `${task.id}:${node.id}: ${v.productId} is a foreign agency for this step`).toBe(anchor.country)
          expect(p.area, `${task.id}:${node.id}: ${v.productId} serves the wrong area for this step`).toBe(anchor.area)
        }
      }
    }
    expect(checkedSteps).toBeGreaterThan(0)
    // The derivation is total today: every government-covered step is wired to a tagged
    // agency. A step landing here means its area could not be derived from committed data and
    // its pull shipped UNFILTERED — report it to the founder rather than guessing a filter.
    expect(unfiltered, `government-covered steps shipping unfiltered: ${unfiltered.join(', ')}`).toEqual([])
  })

  it('pin: the federal tax return (tax_002) admits US tax agencies — IRS and EFTPS present, USPTO absent', () => {
    const task = tasks().find((t) => t.id === 'tax_002')!
    const govStepVendors = task.dag.nodes
      .map((n) => stepRanking(task.id, n, DATA_DIR))
      .filter((r) => r?.arenaId === GOVERNMENT_ARENA_ID)
      .flatMap((r) => r!.vendors.map((v) => v.productId))
    expect(govStepVendors).toContain('irs')
    expect(govStepVendors).toContain('eftps')
    expect(govStepVendors).not.toContain('uspto')
    const lbGov = processLeaderboard(task, DATA_DIR).entries
      .filter((e) => e.arenaId === GOVERNMENT_ARENA_ID)
      .map((e) => e.productId)
    expect(lbGov).toContain('irs')
    expect(lbGov).not.toContain('uspto')
  })

  it('pin: Portugal\'s IRN is absent from the US incorporation steps (form_001), and the trademark filing (legal_002) admits only US IP offices', () => {
    const inc = tasks().find((t) => t.id === 'form_001')!
    const incGov = [
      ...inc.dag.nodes
        .map((n) => stepRanking(inc.id, n, DATA_DIR))
        .filter((r) => r?.arenaId === GOVERNMENT_ARENA_ID)
        .flatMap((r) => r!.vendors.map((v) => v.productId)),
      ...processLeaderboard(inc, DATA_DIR).entries
        .filter((e) => e.arenaId === GOVERNMENT_ARENA_ID)
        .map((e) => e.productId),
    ]
    expect(incGov.length).toBeGreaterThan(0)
    expect(incGov).not.toContain('irn-portugal')
    const tm = tasks().find((t) => t.id === 'legal_002')!
    const node = tm.dag.nodes.find((n) => n.id === 'n5')!
    const r = stepRanking(tm.id, node, DATA_DIR)!
    expect(r.vendors.map((v) => v.productId)).toContain('uspto')
    for (const v of r.vendors) {
      const p = govProducts().find((x) => x.id === v.productId)!
      expect(p.country).toBe('US')
      expect(p.area).toBe('ip-office')
    }
  })

  it('pin: the "or:" row for a government agency obeys the same rule — IRS never suggests a foreign or wrong-area agency', () => {
    for (const alt of vendorAlternatives('irs', 99, DATA_DIR)) {
      const p = govProducts().find((x) => x.id === alt.id)!
      expect(p.country).toBe('US')
      expect(p.area).toBe('tax')
    }
  })

  it('pin: the government arena page keeps its FULL roster — the filter lives only on the step-candidate path', () => {
    const { rankings, products } = loadCategory(GOVERNMENT_ARENA_ID, DATA_DIR)
    const lb = rankings.leaderboard.map((e) => e.productId)
    expect(lb).toContain('uspto')
    expect(lb).toContain('irn-portugal')
    expect(new Set(lb).size).toBe(products.length)
  })

  it('pin: a non-government arena is completely unaffected — eligibility is null and the ranking spans the full roster', () => {
    const task = tasks().find((t) => t.id === 'startup_001')!
    const node = task.dag.nodes.find((n) => n.id === 'n1')!
    expect(coveringArenaId(node)).toBe('ai-assistants')
    expect(governmentStepEligibility(node, 'ai-assistants', DATA_DIR)).toBeNull()
    const r = stepRanking(task.id, node, DATA_DIR)!
    // Recompute the unfiltered expectation straight from the full arena roster (shutdown
    // exclusion is the only eligibility layer for a non-government arena).
    const { products, rankings } = loadCategory('ai-assistants', DATA_DIR)
    const rank = new Map(rankings.leaderboard.map((e, i) => [e.productId, i]))
    const expected = products
      .filter((p) => !isShutdown(p))
      .map((p) => stepVendorScore('ai-assistants', r.stories.map((s) => s.id), p.id, DATA_DIR))
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.score - a.score || (rank.get(a.productId) ?? 0) - (rank.get(b.productId) ?? 0))
      .slice(0, STEP_OPTIONS_CAP)
      .map((s) => s.productId)
      .sort()
    expect([...r.vendors.map((v) => v.productId)].sort()).toEqual(expected)
  })
})
