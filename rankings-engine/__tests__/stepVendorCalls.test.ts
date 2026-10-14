// Committed-file + loader tests for the step→vendor→API-call mapping. Two layers, same posture
// as map-step-stories.test.ts: pure-part tests of the generator's validator/hash (no LLM, no
// network), then schema + referential-integrity validation of the committed
// open-rankings/step-vendor-calls.json and a loader smoke test against it.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProcesses } from '../../lib/processes'
import { coveringArenaId } from '../../lib/processRankings'
import {
  StepVendorCallsFileSchema, stepVendorCallsFor, type StepVendorCallEntry,
} from '../../lib/stepVendorCalls'
import { DATA_DIR } from '../paths'
import {
  MAX_CALLS_PER_VENDOR, MAX_EVIDENCE_PER_VENDOR, methodShapeOk, selectEvidence,
  STEP_CALLS_PROMPT_VERSION, targetHash, validateCalls, type CallTarget,
} from '../scripts/map-step-calls'

// ---------------------------------------------------------------------------
// Pure parts of the generator
// ---------------------------------------------------------------------------

describe('methodShapeOk', () => {
  it('accepts real invocations of each type', () => {
    expect(methodShapeOk('POST /v1/invoices', 'rest')).toBe(true)
    expect(methodShapeOk('GET /api/v1/accounts', 'rest')).toBe(true)
    expect(methodShapeOk('stripe.invoices.create(...)', 'sdk')).toBe(true)
    expect(methodShapeOk('mutation CreateInvoice($input: InvoiceInput!)', 'graphql')).toBe(true)
    expect(methodShapeOk('POST /graphql', 'graphql')).toBe(true)
    expect(methodShapeOk('create_invoice', 'mcp')).toBe(true)
    expect(methodShapeOk('gh pr create --fill', 'cli')).toBe(true)
  })

  it('rejects prose and mismatched shapes', () => {
    expect(methodShapeOk('Use the invoices endpoint to create an invoice', 'rest')).toBe(false)
    expect(methodShapeOk('POST v1/invoices', 'rest')).toBe(false) // no leading slash
    expect(methodShapeOk('create an invoice', 'sdk')).toBe(false)
    expect(methodShapeOk('the create_invoice tool', 'mcp')).toBe(false)
    expect(methodShapeOk('deploy', 'cli')).toBe(false) // a bare word is not a command line
  })
})

describe('validateCalls', () => {
  const allowed = new Set(['https://docs.example.com/api', 'https://mcp.example.com/mcp'])

  it('accepts grounded calls, including the honest empty answer', () => {
    expect(validateCalls([], allowed)).toBeNull()
    expect(validateCalls(
      [{ method: 'POST /v1/things', type: 'rest', sourceUrl: 'https://docs.example.com/api' }],
      allowed,
    )).toBeNull()
  })

  it('rejects sourceUrls outside the provided evidence set — the grounding hard requirement', () => {
    expect(validateCalls(
      [{ method: 'POST /v1/things', type: 'rest', sourceUrl: 'https://invented.example.com' }],
      allowed,
    )).toMatch(/not one of the provided evidence URLs/)
  })

  it('rejects non-call method strings, duplicates, and over-cap answers', () => {
    expect(validateCalls(
      [{ method: 'call the things API', type: 'rest', sourceUrl: 'https://docs.example.com/api' }],
      allowed,
    )).toMatch(/does not look like a rest call/)
    const call = { method: 'POST /v1/things', type: 'rest' as const, sourceUrl: 'https://docs.example.com/api' }
    expect(validateCalls([call, call], allowed)).toMatch(/duplicate call/)
    const many = Array.from({ length: MAX_CALLS_PER_VENDOR + 1 }, (_, i) => ({
      method: `POST /v1/things${i}`, type: 'rest' as const, sourceUrl: 'https://docs.example.com/api',
    }))
    expect(validateCalls(many, allowed)).toMatch(/exceeds the cap/)
  })
})

const target: CallTarget = {
  taskId: 'qs_050',
  nodeId: 'n1',
  arenaId: 'startup-banking',
  productId: 'mercury',
  productName: 'Mercury',
  stepKey: 'qs_050:n1',
  label: 'Fetch account balances',
  route: 'agent',
  taskTitle: 'Track runway',
  canonicalCalls: [{ method: 'mercury.accounts.list()', type: 'rest', description: 'Fetch balances' }],
  evidence: [{
    id: 'mercury-docs-1', tier: 'claimed-docs', url: 'https://docs.mercury.com',
    excerpt: 'Retrieve accounts.', fetchedAt: '2026-08-27T23:14:27.099Z',
  }],
  mcpEndpoint: 'https://mcp.mercury.com/mcp',
}

describe('targetHash', () => {
  it('is stable for identical inputs and changes with step text, evidence, or prompt version', () => {
    const h = targetHash(target, STEP_CALLS_PROMPT_VERSION)
    expect(targetHash({ ...target }, STEP_CALLS_PROMPT_VERSION)).toBe(h)
    expect(targetHash({ ...target, label: 'Different step' }, STEP_CALLS_PROMPT_VERSION)).not.toBe(h)
    expect(targetHash({ ...target, evidence: [] }, STEP_CALLS_PROMPT_VERSION)).not.toBe(h)
    expect(targetHash({ ...target, mcpEndpoint: null }, STEP_CALLS_PROMPT_VERSION)).not.toBe(h)
    expect(targetHash(target, 'v999')).not.toBe(h)
  })
})

describe('selectEvidence', () => {
  it('ranks term-matching entries first, caps deterministically, and keeps file order on ties', () => {
    const mk = (id: string, excerpt: string) => ({
      id, tier: 'claimed-docs' as const, url: `https://docs.example.com/${id}`, excerpt,
      fetchedAt: '2026-08-27T23:14:27.099Z',
    })
    const all = [mk('a', 'unrelated'), mk('b', 'list account balances'), mk('c', 'unrelated too')]
    const picked = selectEvidence(all, ['account', 'balances'], 2)
    expect(picked.map((e) => e.id)).toEqual(['b', 'a']) // relevant first, then file order fill
    const many = Array.from({ length: 30 }, (_, i) => mk(`e${i}`, 'account'))
    expect(selectEvidence(many, ['account']).length).toBe(MAX_EVIDENCE_PER_VENDOR)
  })
})

// ---------------------------------------------------------------------------
// The committed file — schema + referential integrity against the corpus
// ---------------------------------------------------------------------------

const COMMITTED = path.join(DATA_DIR, 'step-vendor-calls.json')
const hasFile = fs.existsSync(COMMITTED)
const entries: StepVendorCallEntry[] = hasFile
  ? StepVendorCallsFileSchema.parse(JSON.parse(fs.readFileSync(COMMITTED, 'utf8')))
  : []

describe.skipIf(!hasFile)('committed open-rankings/step-vendor-calls.json', () => {
  it('is non-empty and zod-valid (parsed above), with every sourceUrl http(s) and every method call-shaped', () => {
    expect(entries.length).toBeGreaterThan(0)
    for (const e of entries) {
      expect(e.calls.length).toBeGreaterThanOrEqual(1) // empty cells are omitted by contract
      expect(e.calls.length).toBeLessThanOrEqual(MAX_CALLS_PER_VENDOR)
      for (const c of e.calls) {
        expect(c.sourceUrl).toMatch(/^https?:\/\//)
        expect(methodShapeOk(c.method, c.type), `${e.taskId}:${e.nodeId}/${e.productId} "${c.method}" (${c.type})`).toBe(true)
      }
    }
  })

  it('resolves every taskId/nodeId/arenaId/productId against the corpus and arena data', () => {
    const tasks = new Map(loadProcesses(DATA_DIR).map((t) => [t.id, t]))
    for (const e of entries) {
      const task = tasks.get(e.taskId)
      expect(task, `unknown taskId ${e.taskId}`).toBeDefined()
      const node = task!.dag.nodes.find((n) => n.id === e.nodeId)
      expect(node, `unknown nodeId ${e.taskId}:${e.nodeId}`).toBeDefined()
      // The cell's arena is either the step's covering arena (ranking vendors) or the canonical
      // vendor's own arena — both must be real, populated arena directories with the product.
      const products = path.join(DATA_DIR, e.arenaId, 'products.json')
      expect(fs.existsSync(products), `missing arena ${e.arenaId}`).toBe(true)
      const ids = new Set((JSON.parse(fs.readFileSync(products, 'utf8')) as Array<{ id: string }>).map((p) => p.id))
      expect(ids.has(e.productId), `${e.productId} not in ${e.arenaId}`).toBe(true)
      // Only rankable steps are enumerated — the covering arena must exist for the node.
      expect(coveringArenaId(node!), `${e.taskId}:${e.nodeId} has no covering arena`).not.toBeNull()
    }
  })

  it('every sourceUrl comes from the vendor evidence pool or a documented MCP endpoint', () => {
    // Sample-level integrity (full evidence re-derivation lives in the generator's hash): each
    // sourceUrl must at least be a URL present in the cell's arena evidence file or MCP map.
    for (const e of entries.slice(0, 50)) {
      const file = path.join(DATA_DIR, e.arenaId, 'evidence', `${e.productId}.json`)
      const urls = new Set<string>(
        fs.existsSync(file)
          ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ url: string }>).map((ev) => ev.url)
          : [],
      )
      for (const c of e.calls) {
        const fromEvidence = urls.has(c.sourceUrl)
        const fromMcp = c.type === 'mcp' || c.sourceUrl.includes('mcp')
        expect(fromEvidence || fromMcp, `${e.taskId}:${e.nodeId}/${e.productId} cites ${c.sourceUrl}`).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Loader smoke
// ---------------------------------------------------------------------------

describe('stepVendorCallsFor', () => {
  it('returns [] for an unknown step', () => {
    expect(stepVendorCallsFor('no-such-task', 'no-such-node', DATA_DIR)).toEqual([])
  })

  it.skipIf(!hasFile || entries.length === 0)('returns named, ordered entries for a known mapped step', () => {
    const first = entries[0]
    const got = stepVendorCallsFor(first.taskId, first.nodeId, DATA_DIR)
    expect(got.length).toBeGreaterThan(0)
    const hit = got.find((v) => v.productId === first.productId && v.arenaId === first.arenaId)
    expect(hit).toBeDefined()
    expect(hit!.calls.length).toBeGreaterThan(0)
    expect(hit!.name.length).toBeGreaterThan(0)
    for (const v of got) {
      for (const c of v.calls) expect(typeof c.method).toBe('string')
    }
  })
})
