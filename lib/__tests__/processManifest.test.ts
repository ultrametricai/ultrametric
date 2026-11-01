import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { IRREDUCIBLE_REASON } from '@/lib/gapClosers'
import {
  buildChainManifest, buildManifestStep, buildProcessManifest, chainManifestById,
  chainManifestPath, chainManifestUrl, MANIFEST_VERSION, manifestVendorOption,
  processManifestBySlug, processManifestPath, processManifestUrl, stepApprovalRequired, stepKind,
} from '@/lib/processManifest'
import { DagNodeSchema, loadChains, loadProcesses, processSlug, type DagNode } from '@/lib/processes'
import { SITE_URL } from '@/lib/site'

const DATA_DIR = path.resolve(__dirname, '../../open-rankings')

const node = (over: Partial<DagNode>): DagNode => ({
  id: 'n1',
  label: 'step',
  route: 'agent',
  reversibility: 'reversible',
  estimatedMinutes: 5,
  ...over,
})

describe('stepKind', () => {
  it('maps corpus routes onto executor kinds', () => {
    expect(stepKind('agent')).toBe('api')
    expect(stepKind('form')).toBe('computer-use')
    expect(stepKind('person')).toBe('human')
  })
})

describe('stepApprovalRequired — any side-effectful step is gated', () => {
  it('honors an explicit corpus gate and flagged risk', () => {
    expect(stepApprovalRequired(node({ approvalRequired: true }))).toBe(true)
    expect(stepApprovalRequired(node({ riskLevel: 'high' }))).toBe(true)
    expect(stepApprovalRequired(node({ riskLevel: 'medium' }))).toBe(true)
  })

  it('always gates computer-use steps — a browser agent acting on a real portal', () => {
    expect(stepApprovalRequired(node({ route: 'form' }))).toBe(true)
  })

  it('never machine-gates human steps — the human is the actor', () => {
    expect(stepApprovalRequired(node({ route: 'person' }))).toBe(false)
  })

  it('leaves read-only api steps ungated', () => {
    expect(stepApprovalRequired(node({
      functionCalls: [{ method: 'GET /api/name-availability?state=DE', type: 'rest' }],
    }))).toBe(false)
    expect(stepApprovalRequired(node({ toolCall: 'company_data_get' }))).toBe(false)
    expect(stepApprovalRequired(node({}))).toBe(true) // absent binding cannot establish read-only behavior
  })

  it('gates api steps with any write call', () => {
    expect(stepApprovalRequired(node({
      functionCalls: [
        { method: 'GET /api/customers', type: 'rest' },
        { method: 'stripe.customers.create()', type: 'sdk' },
      ],
    }))).toBe(true)
    expect(stepApprovalRequired(node({ functionCalls: [{ method: 'integrations.connect()', type: 'sdk' }] }))).toBe(true)
  })
})

describe('manifestVendorOption', () => {
  it('resolves a tracked vendor to product id, arena, agent-readiness, MCP endpoint, and arena url', () => {
    const opt = manifestVendorOption('mercury', DATA_DIR)
    expect(opt.vendor).toBe('mercury')
    expect(opt.productId).toBe('mercury')
    expect(opt.arena).toBe('startup-banking')
    expect(typeof opt.agentReady).toBe('number')
    expect(opt.mcpEndpoint).toBe('https://mcp.mercury.com/mcp')
    expect(opt.paProductUrl).toBe(`${SITE_URL}/arena/startup-banking/product/mercury`)
  })

  it('yields honest nulls for untracked vendors', () => {
    const opt = manifestVendorOption('doola', DATA_DIR)
    expect(opt.name).toBe('Doola')
    expect(opt.productId).toBeNull()
    expect(opt.arena).toBeNull()
    expect(opt.agentReady).toBeNull()
    expect(opt.mcpEndpoint).toBeNull()
    expect(opt.paProductUrl).toBeNull()
  })

  it('tracked vendors without a published MCP endpoint get a null endpoint, not an invented one', () => {
    // (gusto graduated to a live endpoint when its official-MCP-server evidence landed —
    // quickbooks is the current no-endpoint example.)
    const opt = manifestVendorOption('quickbooks', DATA_DIR)
    expect(opt.arena).toBe('accounting')
    expect(opt.mcpEndpoint).toBeNull()
  })
})

describe('buildManifestStep', () => {
  it('marks judgment/identity steps irreducible with the shared reason', () => {
    const step = buildManifestStep(node({ label: 'Board approves the option grants', route: 'person' }), DATA_DIR)
    expect(step.kind).toBe('human')
    expect(step.irreducible).toBe(IRREDUCIBLE_REASON)
  })

  it('leaves closable and agent steps without the irreducible marker', () => {
    expect(buildManifestStep(node({ label: 'Check name availability' }), DATA_DIR).irreducible).toBeUndefined()
    expect(
      buildManifestStep(node({ label: 'Submit filing on state portal', route: 'form' }), DATA_DIR).irreducible,
    ).toBeUndefined()
  })

  it('passes forward-compat actionUrl/signupUrl through when present and omits them otherwise', () => {
    const bare = buildManifestStep(node({}), DATA_DIR)
    expect('actionUrl' in bare).toBe(false)
    expect('signupUrl' in bare).toBe(false)
    const linked = buildManifestStep(
      node({ actionUrl: 'https://mercury.com/apply', signupUrl: 'https://mercury.com/signup' }),
      DATA_DIR,
    )
    expect(linked.actionUrl).toBe('https://mercury.com/apply')
    expect(linked.signupUrl).toBe('https://mercury.com/signup')
  })

  it('dedupes the canonical vendor against vendorOptions, canonical first', () => {
    const step = buildManifestStep(
      node({ vendor: 'mercury', vendorOptions: ['mercury', 'brex', 'relay'] }),
      DATA_DIR,
    )
    expect(step.vendorOptions.map((o) => o.vendor)).toEqual(['mercury', 'brex', 'relay'])
  })
})

describe('DagNodeSchema forward-compat', () => {
  it('retains actionUrl/signupUrl instead of stripping them', () => {
    const parsed = DagNodeSchema.parse({
      id: 'n1', label: 'Apply', route: 'form', reversibility: 'reversible', estimatedMinutes: 5,
      actionUrl: 'https://example.com/apply', signupUrl: 'https://example.com/signup',
    })
    expect(parsed.actionUrl).toBe('https://example.com/apply')
    expect(parsed.signupUrl).toBe('https://example.com/signup')
  })
})

describe('process manifests over the real corpus', () => {
  it('builds a versioned manifest for every process, steps 1:1 with the DAG', () => {
    for (const task of loadProcesses(DATA_DIR)) {
      const manifest = buildProcessManifest(task, DATA_DIR)
      expect(manifest.manifestVersion).toBe(MANIFEST_VERSION)
      expect(manifest.process.slug).toBe(processSlug(task.title))
      expect(manifest.steps.length).toBe(task.dag.nodes.length)
      expect(manifest.manifestUrl).toBe(processManifestUrl(manifest.process.slug))
      expect(manifest.provenance.source).toBe('productarena')
    }
  })

  it('resolves incorporate-c-corp with kinds, gates, and vendor options intact', () => {
    const manifest = processManifestBySlug('incorporate-c-corp', DATA_DIR)!
    expect(manifest.process.title).toBe('Incorporate the company')
    expect(manifest.process.phase).toBe('formation')
    const byId = new Map(manifest.steps.map((s) => [s.id, s]))
    expect(byId.get('n3')!.kind).toBe('api')
    expect(byId.get('n3')!.approvalRequired).toBe(true) // private evidence is required for a read-only availability check
    expect(byId.get('n4')!.kind).toBe('computer-use')
    expect(byId.get('n4')!.approvalRequired).toBe(true)
    expect(byId.get('n1')!.vendorOptions.map((o) => o.vendor)).toEqual(
      ['clerky', 'stripe_atlas', 'firstbase', 'legalzoom', 'northwest', 'doola'],
    )
  })

  it('derived-market steps (optionsArenaId) expose the arena\'s current roster to the executor', () => {
    const task = loadProcesses(DATA_DIR).find((t) => t.id === 'qs_063')!
    const m = buildProcessManifest(task, DATA_DIR)
    const signup = m.steps.find((s) => s.id === 'n3')!
    const vendors = signup.vendorOptions.map((o) => o.productId)
    // All four judged payroll providers are offered, not just the curated defaults.
    for (const pid of ['deel', 'gusto', 'rippling', 'justworks']) expect(vendors).toContain(pid)
    for (const o of signup.vendorOptions) expect(o.arena).toBe('payroll')
  })

  it('returns null for an unknown slug', () => {
    expect(processManifestBySlug('not-a-process', DATA_DIR)).toBeNull()
  })
})

describe('chain manifests', () => {
  it('composes the company-launch chain in run order under one provenance', () => {
    const chain = loadChains(DATA_DIR).find((c) => c.id === 'company-launch')!
    const manifest = buildChainManifest(chain, DATA_DIR)
    expect(manifest.manifestVersion).toBe(MANIFEST_VERSION)
    expect(manifest.chain.slug).toBe('company-launch')
    expect(manifest.chain.manifestUrl).toBe(chainManifestUrl('company-launch'))
    expect(manifest.processes.length).toBe(chain.taskIds.length)
    // Run order preserved, and each embedded process carries its own standalone manifest URL.
    expect(manifest.processes[0].process.slug).toBe('incorporate-the-company')
    for (const p of manifest.processes) {
      expect(p.manifestUrl).toBe(processManifestUrl(p.process.slug))
      expect(p.steps.length).toBeGreaterThan(0)
    }
  })

  it('builds every chain and returns null for unknown ids', () => {
    for (const chain of loadChains(DATA_DIR)) {
      expect(chainManifestById(chain.id, DATA_DIR)!.manifestVersion).toBe(MANIFEST_VERSION)
    }
    expect(chainManifestById('not-a-chain', DATA_DIR)).toBeNull()
  })
})

describe('manifest URLs', () => {
  it('derive from SITE_URL with the documented paths', () => {
    expect(processManifestPath('get-ein')).toBe('/processes/get-ein/manifest.json')
    expect(chainManifestPath('company-launch')).toBe('/processes/chains/company-launch/manifest.json')
    expect(processManifestUrl('get-ein')).toBe(`${SITE_URL}/processes/get-ein/manifest.json`)
  })
})
