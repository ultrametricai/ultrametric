// Committed-file + loader tests for the step→prompt generator (rankings-engine/scripts/
// map-step-prompts.ts). Two layers, same posture as stepVendorCalls.test.ts: pure-part tests
// of the generator's validator (no LLM, no network), then re-validation of the committed
// open-rankings/step-prompts.json against EXACTLY the rules the generator enforced — referential
// integrity against open-processes/corpus.json, the {{vendor}} placeholder rule, endpoint grounding
// against open-rankings/step-vendor-calls.json, the human-step audit posture — and a loader smoke test.
import { describe, expect, it } from 'vitest'
import { humanStepAudit } from '../../lib/humanSteps'
import { loadProcesses, type DagNode } from '../../lib/processes'
import { coveringArenaId } from '../../lib/processRankings'
import { loadStepPrompts, stepPromptFor } from '../../lib/stepPrompts'
import { stepVendorCallsFor } from '../../lib/stepVendorCalls'
import { DATA_DIR } from '../paths'
import {
  ENDPOINT_RE, enumeratePromptTargets, generationPrompt, hasVendorMarket, instructsImpersonation,
  MAX_PROMPT_WORDS, MIN_PROMPT_WORDS, promptTargetHash, REMAINS_HUMAN_RE, SECRETS_RE,
  STEP_PROMPT_VERSION, StepPromptsFileSchema, STOP_FOR_HUMAN_RE, validatePrompt,
  VENDOR_PLACEHOLDER, wordCount, type PromptTarget,
} from '../scripts/map-step-prompts'

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')

const base: PromptTarget = {
  taskId: 'growth_005',
  nodeId: 'n3',
  stepKey: 'growth_005:n3',
  taskTitle: 'Set up transactional email',
  taskDescription: 'Configure transactional email.',
  label: 'Add DNS records',
  route: 'agent',
  async: false,
  approvalRequired: false,
  legalSignature: false,
  actionUrl: null,
  functionCalls: [{ method: 'POST /zones/{id}/dns_records', type: 'rest', description: 'Add SPF/DKIM records' }],
  vendor: 'cloudflare',
  arenaId: 'edge-platforms',
  storyTitles: [],
  groundedCalls: [],
  audit: null,
}

// ---------------------------------------------------------------------------
// Pure parts of the generator
// ---------------------------------------------------------------------------

describe('validatePrompt', () => {
  it('preserves the human signature boundary independently of category and audit', () => {
    const signature = enumeratePromptTargets(loadProcesses(DATA_DIR)).find(t => t.stepKey === 'sit_009:n6')!
    expect(signature.legalSignature).toBe(true)
    expect(generationPrompt(signature)).toContain('legalSignature: a human must perform the signature')
    const body = `${signature.arenaId ? VENDOR_PLACEHOLDER : ''} ${words(150)}`
    expect(validatePrompt(signature, `${body} Stop for human sign-off. Sign on my behalf.`)).toMatch(/human's behalf/)
    for (const category of ['agent-native', 'agent-computer-use', 'human-online', 'human-offline', null, undefined] as const) {
      const target: PromptTarget = { ...base, legalSignature: true, execution: category === undefined ? undefined : {
        category, basis: category === null ? 'unresolved' : category === 'agent-native' ? 'local-work' : category === 'agent-computer-use' ? 'browser-evidence' : 'human-work',
        rationale: 'Fixture', evidence: ['fixture'], reviewRequired: false,
      } }
      const text = `${VENDOR_PLACEHOLDER} ${words(150)}`
      expect(validatePrompt(target, `${text} Stop for human sign-off. Sign on my behalf.`)).toMatch(/human's behalf/)
      expect(validatePrompt(target, `${text} Signing remains a human step.`)).toMatch(/sign-off/)
      expect(validatePrompt(target, `${text} Stop for human sign-off.`)).toMatch(/remains a human step/)
      expect(validatePrompt(target, `${text} Stop for human sign-off. Do not sign on my behalf. Signing remains a human step.`)).toBeNull()
    }
  })

  it('requires approval independently of category, route and historical audit', () => {
    const targets = enumeratePromptTargets(loadProcesses(DATA_DIR))
    for (const key of ['sw_011:n1', 'sales_001:n5']) {
      const target = targets.find(t => t.stepKey === key)!
      expect(target.approvalRequired).toBe(true)
      expect(target.execution?.category).toBe('agent-computer-use')
      const body = `${VENDOR_PLACEHOLDER} ${words(150)}`
      expect(validatePrompt(target, body)).toMatch(/approvalRequired/)
      expect(validatePrompt(target, `${body} Stop for human sign-off.`)).toBeNull()
    }
    for (const category of ['agent-native', 'agent-computer-use', 'human-online', 'human-offline', null] as const) {
      const execution = { category, basis: category === null ? 'unresolved' as const : category === 'agent-native' ? 'local-work' as const : category === 'agent-computer-use' ? 'browser-evidence' as const : 'human-work' as const, rationale: 'Fixture', evidence: ['fixture'], reviewRequired: category === null }
      const target = { ...base, approvalRequired: true, execution }
      const body = `${VENDOR_PLACEHOLDER} The personal act remains a human step. ${words(150)}`
      expect(validatePrompt(target, body)).toMatch(/sign-off/)
      expect(validatePrompt(target, `${body} Stop for human sign-off.`)).toBeNull()
    }
  })

  it('keeps unresolved generation context unresolved without a manual fallback', () => {
    const targets = enumeratePromptTargets(loadProcesses(DATA_DIR))
    for (const key of ['growth_015:n6', 'prod_002:n6']) {
      const target = targets.find(t => t.stepKey === key)!
      expect(target.execution?.category).toBeNull()
      expect(generationPrompt(target)).toContain('EXECUTION NEEDS REVIEW')
      expect(generationPrompt(target)).not.toContain('this is a manual step')
      expect(generationPrompt(target)).not.toContain('let me execute')
    }
  })

  it('preserves assessed human work and unresolved review even on a legacy agent route', () => {
    const human: PromptTarget = { ...base, execution: { category: 'human-online', basis: 'human-work', rationale: 'Human signer', evidence: ['fixture'], reviewRequired: false } }
    expect(validatePrompt(human, `${VENDOR_PLACEHOLDER} ${words(150)}`)).toMatch(/remains a human step/)
    expect(validatePrompt(human, `${VENDOR_PLACEHOLDER} Signing remains a human step. ${words(150)}`)).toBeNull()
    const unresolved: PromptTarget = { ...base, execution: { ...human.execution!, category: null, basis: 'unresolved', reviewRequired: true } }
    expect(validatePrompt(unresolved, `${VENDOR_PLACEHOLDER} ${words(150)}`)).toMatch(/stop for human sign-off/)
    expect(validatePrompt(unresolved, `${VENDOR_PLACEHOLDER} stop for human sign-off. ${words(150)}`)).toBeNull()
  })

  it('enforces the word range', () => {
    expect(validatePrompt(base, `${VENDOR_PLACEHOLDER} ${words(50)}`)).toMatch(/words/)
    expect(validatePrompt(base, `${VENDOR_PLACEHOLDER} ${words(MAX_PROMPT_WORDS + 10)}`)).toMatch(/words/)
    expect(validatePrompt(base, `${VENDOR_PLACEHOLDER} ${words(MIN_PROMPT_WORDS + 10)}`)).toBeNull()
  })

  it('requires the literal {{vendor}} placeholder when the step has a vendor market — and forbids the canonical vendor name beside it', () => {
    expect(validatePrompt(base, words(150))).toMatch(/placeholder .* is required/)
    expect(validatePrompt(base, `${VENDOR_PLACEHOLDER} Cloudflare ${words(150)}`)).toMatch(/names the canonical vendor/)
    expect(validatePrompt(base, `${VENDOR_PLACEHOLDER} ${words(150)}`)).toBeNull()
  })

  it('forbids the placeholder when the step has no vendor market', () => {
    const noMarket: PromptTarget = { ...base, vendor: 'sendgrid', arenaId: null }
    expect(hasVendorMarket(noMarket)).toBe(false)
    expect(validatePrompt(noMarket, `${VENDOR_PLACEHOLDER} ${words(150)}`)).toMatch(/placeholder is forbidden/)
    expect(validatePrompt(noMarket, `Use SendGrid. ${words(150)}`)).toBeNull()
  })

  it('rejects endpoints that are not grounded vendor calls, and accepts grounded ones', () => {
    // growth_005 node functionCalls do NOT license endpoints — only grounded vendor calls do.
    expect(validatePrompt(base, `${VENDOR_PLACEHOLDER} call POST /zones/{id}/dns_records. ${words(150)}`))
      .toMatch(/not among the step's grounded vendor calls/)
    const grounded: PromptTarget = {
      ...base,
      groundedCalls: [{ vendorName: 'Cloudflare', method: 'POST /zones/{id}/dns_records', type: 'rest' }],
    }
    expect(validatePrompt(grounded, `${VENDOR_PLACEHOLDER} call POST /zones/{id}/dns_records. ${words(150)}`))
      .toBeNull()
    expect(validatePrompt(grounded, `${VENDOR_PLACEHOLDER} call GET /invented. ${words(150)}`))
      .toMatch(/not among the step's grounded vendor calls/)
  })

  it("audit posture: assist/policy-gate prompts must stop for human sign-off and never act in the human's place", () => {
    const gated: PromptTarget = {
      ...base,
      route: 'form',
      vendor: 'sendgrid',
      arenaId: null,
      audit: {
        taskId: 'growth_005', nodeId: 'n1', route: 'form', why: 'contractual commitment',
        computerUse: 'policy-gate', computerUseWhy: 'binding vendor/billing decision',
      },
    }
    expect(validatePrompt(gated, words(150))).toMatch(/stop for human sign-off/)
    expect(validatePrompt(gated, `Prepare everything, then stop for human sign-off. ${words(150)}`)).toBeNull()
    expect(validatePrompt(gated, `Accept the terms on my behalf, then stop for human sign-off. ${words(150)}`))
      .toMatch(/act on the human's behalf/)
    // Negated instructions are the wanted posture, not a violation.
    expect(validatePrompt(gated, `You must NOT accept terms or submit forms on my behalf. Prepare, then stop for human sign-off. ${words(150)}`))
      .toBeNull()
  })

  it('audit posture: no-screen/third-party-wait prompts must state what remains a human step', () => {
    const noScreen: PromptTarget = {
      ...base,
      route: 'person',
      vendor: null,
      arenaId: null,
      audit: {
        taskId: 't', nodeId: 'n', route: 'person', why: 'in-person meeting',
        computerUse: 'no-screen', computerUseWhy: 'no screen to drive',
      },
    }
    expect(validatePrompt(noScreen, words(150))).toMatch(/remains a human step/)
    expect(validatePrompt(noScreen, `Prepare the brief; the meeting itself remains a human step. ${words(150)}`)).toBeNull()
  })

  it('rejects secrets-handling instructions but tolerates "use your configured credentials" and email-domain prose', () => {
    expect(validatePrompt(base, `${VENDOR_PLACEHOLDER} paste your API key into the file. ${words(150)}`))
      .toMatch(/secrets-handling/)
    expect(validatePrompt(base, `${VENDOR_PLACEHOLDER} use your configured credentials. ${words(150)}`)).toBeNull()
    expect(validatePrompt(base, `${VENDOR_PLACEHOLDER} transactional email (password resets, receipts). ${words(150)}`)).toBeNull()
  })
})

describe('instructsImpersonation', () => {
  it('flags direct instructions and ignores negated ones', () => {
    expect(instructsImpersonation('Sign the agreement on my behalf.')).toBe(true)
    expect(instructsImpersonation('Approve the invoice on the user\'s behalf.')).toBe(true)
    expect(instructsImpersonation('Do NOT sign or accept terms on my behalf.')).toBe(false)
    expect(instructsImpersonation('Never submit the form on my behalf.')).toBe(false)
  })
})

describe('promptTargetHash / generationPrompt / enumeration', () => {
  it('hash is stable and moves with node fields, grounded calls, the audit, and the version', () => {
    const h = promptTargetHash(base, STEP_PROMPT_VERSION)
    expect(promptTargetHash({ ...base }, STEP_PROMPT_VERSION)).toBe(h)
    expect(promptTargetHash({ ...base, label: 'Different' }, STEP_PROMPT_VERSION)).not.toBe(h)
    expect(promptTargetHash({ ...base, legalSignature: true }, STEP_PROMPT_VERSION)).not.toBe(h)
    expect(promptTargetHash(
      { ...base, groundedCalls: [{ vendorName: 'X', method: 'GET /x', type: 'rest' }] },
      STEP_PROMPT_VERSION,
    )).not.toBe(h)
    expect(promptTargetHash(
      { ...base, audit: { taskId: 'a', nodeId: 'b', route: 'form', why: 'w', computerUse: 'assist', computerUseWhy: 'c' } },
      STEP_PROMPT_VERSION,
    )).not.toBe(h)
    expect(promptTargetHash(base, 'v999')).not.toBe(h)
  })

  it('generationPrompt carries the grounding and the market posture', () => {
    const p = generationPrompt(base)
    expect(p).toContain('Set up transactional email')
    expect(p).toContain('Add DNS records')
    expect(p).toContain('Vendor market: YES')
    expect(p).toContain('GROUNDED VENDOR CALLS: none')
    const q = generationPrompt({ ...base, vendor: 'sendgrid', arenaId: null })
    expect(q).toContain('Vendor market: NO')
    expect(q).toContain('SendGrid')
  })

  it('enumerates one target per DAG node, mirroring the market/audit resolution the site uses', () => {
    const tasks = loadProcesses(DATA_DIR)
    const targets = enumeratePromptTargets(tasks)
    const nodes = tasks.flatMap((t) => t.dag.nodes.map((n) => [`${t.id}:${n.id}`, n] as const))
    expect(targets.length).toBe(nodes.length)
    const byKey = new Map<string, DagNode>(nodes)
    for (const t of targets.filter((x) => x.taskId === 'growth_005')) {
      const node = byKey.get(t.stepKey)!
      expect(t.arenaId).toBe(coveringArenaId(node))
      expect(t.audit).toEqual(node.route !== 'agent' ? humanStepAudit(t.taskId, t.nodeId) : null)
    }
  })
})

// ---------------------------------------------------------------------------
// The committed file, re-checked against exactly the generator's rules
// ---------------------------------------------------------------------------

describe('open-rankings/step-prompts.json', () => {
  const entries = StepPromptsFileSchema.parse(loadStepPrompts())
  const tasks = loadProcesses(DATA_DIR)
  const nodeByKey = new Map<string, DagNode>(
    tasks.flatMap((t) => t.dag.nodes.map((n) => [`${t.id}:${n.id}`, n] as const)),
  )

  it('contains the growth_005 pilot and only resolvable (taskId, nodeId) pairs, one prompt each', () => {
    expect(entries.length).toBeGreaterThan(0)
    const keys = entries.map((e) => `${e.taskId}:${e.nodeId}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) expect(nodeByKey.has(key)).toBe(true)
    const pilot = tasks.find((t) => t.id === 'growth_005')!
    for (const node of pilot.dag.nodes) expect(keys).toContain(`growth_005:${node.id}`)
  })

  it('every prompt is within the word range', () => {
    for (const e of entries) {
      const n = wordCount(e.prompt)
      expect(n, `${e.taskId}:${e.nodeId}`).toBeGreaterThanOrEqual(MIN_PROMPT_WORDS)
      expect(n, `${e.taskId}:${e.nodeId}`).toBeLessThanOrEqual(MAX_PROMPT_WORDS)
    }
  })

  it('uses the literal {{vendor}} placeholder exactly when the step has a vendor market', () => {
    for (const e of entries) {
      const node = nodeByKey.get(`${e.taskId}:${e.nodeId}`)!
      const market = coveringArenaId(node) !== null
      expect(e.prompt.includes(VENDOR_PLACEHOLDER), `${e.taskId}:${e.nodeId} market=${market}`).toBe(market)
    }
  })

  it('quotes endpoints only from the step\'s grounded vendor calls (open-rankings/step-vendor-calls.json)', () => {
    for (const e of entries) {
      const grounded = stepVendorCallsFor(e.taskId, e.nodeId, DATA_DIR).flatMap((v) => v.calls.map((c) => c.method))
      for (const raw of e.prompt.match(ENDPOINT_RE) ?? []) {
        const endpoint = raw.replace(/[.,;:!?)\]}'"`]+$/, '')
        expect(
          grounded.some((m) => m.includes(endpoint)),
          `${e.taskId}:${e.nodeId} quotes ungrounded endpoint "${endpoint}"`,
        ).toBe(true)
      }
    }
  })

  it('non-agent prompts respect the audit verdict: prepare-and-stop phrasing, no acting in the human\'s place, no secrets handling', () => {
    for (const e of entries) {
      const node = nodeByKey.get(`${e.taskId}:${e.nodeId}`)!
      expect(SECRETS_RE.test(e.prompt), `${e.taskId}:${e.nodeId} secrets`).toBe(false)
      if (node.route === 'agent') continue
      const audit = humanStepAudit(e.taskId, e.nodeId)
      if (!audit || audit.computerUse === 'drivable') continue
      expect(instructsImpersonation(e.prompt), `${e.taskId}:${e.nodeId} impersonation`).toBe(false)
      if (audit.computerUse === 'assist' || audit.computerUse === 'policy-gate') {
        expect(STOP_FOR_HUMAN_RE.test(e.prompt), `${e.taskId}:${e.nodeId} must stop for human sign-off`).toBe(true)
      } else {
        expect(REMAINS_HUMAN_RE.test(e.prompt), `${e.taskId}:${e.nodeId} must state what remains a human step`).toBe(true)
      }
    }
  })

  it('preserves access to all historical prompts during the content migration', () => {
    const first = entries[0]
    expect(stepPromptFor(first.taskId, first.nodeId)).toEqual(first)
    expect(entries[0]).toEqual(first) // the published history is retained
    // growth_005 graduated to a covered market (optionsArenaId email-apis, 2026-09-23), so its
    // prompts carry the {{vendor}} placeholder instead of a hard-coded SendGrid.
    expect(stepPromptFor('growth_005', 'n1')?.prompt).toMatch(/\{\{vendor\}\}/)
    for (const entry of entries) expect(stepPromptFor(entry.taskId, entry.nodeId)).toEqual(entry)
    expect(stepPromptFor('no_such_task', 'n1')).toBeNull()
  })
})
