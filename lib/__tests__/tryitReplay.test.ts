// Pure tests for the microterminal's replay logic and probe-result rendering
// (lib/tryitReplay.ts) plus the server-side story/eligibility assembly (lib/tryit.ts) against
// the committed data corpus.
import { describe, expect, it } from 'vitest'
import { mcpEndpointFor } from '../mcpEndpoints'
import { buildRecordedStories, hasTryIt, mcpDocsUrlFor, processesFeaturing } from '../tryit'
import { buildRunOptions, callResultLines, deriveRunLabel, mcpClientConfig, probeResultLines, replayCharCount, stripSgr, tryResultLines, type TryItStory } from '../tryitReplay'
import { loadAll, loadCategory } from '../data'
import { loadProofIndex } from '../proofs'
import fs from 'node:fs'
import path from 'node:path'

describe('run-type selector options (founder 2026-10-05)', () => {
  const story = (id: string, title: string, command: string, live = false): TryItStory =>
    ({ id, title, kind: 'recorded', command, live })

  it('deriveRunLabel maps committed command shapes to short functional labels', () => {
    expect(deriveRunLabel('curl -s https://resend.com/llms.txt | head -3')).toBe('llms.txt discovery')
    expect(deriveRunLabel('curl -s https://resend.com/.well-known/agent-skills/index.json | head -c 200')).toBe('Skills registry')
    expect(deriveRunLabel('curl -s https://resend.com/.well-known/mcp.json | head -c 200')).toBe('MCP discovery')
    expect(deriveRunLabel("curl -si -X POST https://mcp.resend.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'")).toBe('MCP handshake')
    expect(deriveRunLabel("curl -s -X POST https://catalog.shopify.com/api/ucp/mcp -d '<tools/call search_catalog without agent profile>'")).toBe('MCP tool call')
    expect(deriveRunLabel('mktemp -d && npm install @shopify/ucp-cli && ucp --version && ucp --help')).toBe('Install locally')
    expect(deriveRunLabel('npm view resend version')).toBe('Package registry')
    expect(deriveRunLabel('curl -s https://resend.com/openapi.json | head -c 200')).toBe('Public API')
    expect(deriveRunLabel('curl -sL https://www.mintlify.com/docs/quickstart.md | head -8')).toBe('Markdown docs')
    expect(deriveRunLabel('curl -s https://api.example.com/v1/ping')).toBe('Public API')
    expect(deriveRunLabel('npx -y mint --help | head -16')).toBe('CLI')
    expect(deriveRunLabel('claude --version')).toBe('CLI')
  })

  it('merges same-command variants into one option carrying every title; distinct commands stay apart', () => {
    const options = buildRunOptions([
      story('a', 'agent docs · machine index', 'curl -s https://x.dev/llms.txt'),
      story('b', 'docs an agent can read', 'curl -s https://x.dev/llms.txt'),
      story('c', 'install the CLI', 'npm install x-cli && x --version'),
    ])
    expect(options).toHaveLength(2)
    // Interest order (founder 2026-10-08): an install run outranks passive llms.txt discovery.
    expect(options.map((o) => o.label)).toEqual(['Install locally', 'llms.txt discovery'])
    const llms = options.find((o) => o.label === 'llms.txt discovery')!
    expect(llms.story.id).toBe('a') // representative = first story of the command group, selection unchanged
    expect(llms.titles).toEqual(['agent docs', 'machine index', 'docs an agent can read'])
  })

  it('orders options by user interest — live capability demos first, passive discovery last; the first option is the default (founder 2026-10-08)', () => {
    const options = buildRunOptions([
      story('md', 'markdown mirror', 'curl -sL https://x.dev/docs/quickstart.md | head -8'),
      story('llms', 'agent docs', 'curl -s https://x.dev/llms.txt'),
      story('install', 'install the CLI', 'npm install x-cli && x --version'),
      story('skills', 'skills index', 'curl -s https://x.dev/.well-known/agent-skills/index.json'),
      story('registry', 'registry listing', 'npm view x-cli version'),
      story('cli', 'run the CLI', 'x --help'),
      story('api', 'public API', 'curl -s https://api.x.dev/v1/ping'),
      story('mcp-disc', 'MCP manifest', 'curl -s https://x.dev/.well-known/mcp.json'),
      story('mcp-hs', 'MCP handshake', "curl -si -X POST https://mcp.x.dev -d '<jsonrpc initialize>'"),
      story('mcp-call', 'a real tool call', "curl -s -X POST https://mcp.x.dev/mcp -d '<tools/call search>'"),
    ])
    expect(options.map((o) => o.label)).toEqual([
      'MCP tool call',
      'MCP handshake',
      'MCP discovery',
      'Public API',
      'CLI',
      'Skills registry',
      'Package registry',
      'Install locally',
      'llms.txt discovery',
      'Markdown docs',
    ])
    // The microterminal auto-plays options[0] — the MCP tool call leads, llms.txt never does.
    expect(options[0].story.id).toBe('mcp-call')
  })

  it('CORPUS PIN: shopify-ucp (proofs spanning several run types) leads with its real MCP tool call, llms.txt last', () => {
    const proofs = loadProofIndex('agentic-commerce').filter((p) => p.kind === 'terminal' && p.productId === 'shopify-ucp')
    expect(proofs.length).toBeGreaterThanOrEqual(4)
    const options = buildRunOptions(proofs.map((p) => story(p.probeId, p.storyIds.join(' · '), p.command)))
    expect(options[0].label).toBe('MCP tool call')
    expect(options[0].story.id).toBe('ucp-profile-gate')
    expect(options.at(-1)!.label).toBe('llms.txt discovery')
  })

  it('CORPUS PIN: mintlify keeps every MCP handshake (host-qualified) ahead of CLI, llms.txt, and markdown — ties in committed proof order', () => {
    const proofs = loadProofIndex('docs-platforms').filter((p) => p.kind === 'terminal' && p.productId === 'mintlify')
    const options = buildRunOptions(proofs.map((p) => story(p.probeId, p.storyIds.join(' · '), p.command)))
    expect(options.map((o) => o.label)).toEqual([
      'MCP handshake · mcp.mintlify.com',
      'MCP handshake · www.mintlify.com',
      'MCP handshake · index.mintlify.com',
      'CLI',
      'llms.txt discovery',
      'Markdown docs',
    ])
  })

  it('same run type over different commands gets host-qualified labels — never two identical chips', () => {
    const options = buildRunOptions([
      story('m1', 'admin MCP', "curl -si -X POST https://mcp.x.dev -d '<jsonrpc initialize>'"),
      story('m2', 'docs MCP', "curl -s -X POST https://www.x.dev/docs/mcp -d '<jsonrpc initialize>'"),
    ])
    expect(options.map((o) => o.label)).toEqual(['MCP handshake · mcp.x.dev', 'MCP handshake · www.x.dev'])
  })

  it('CORPUS PIN: every product with terminal proofs gets unique labels, each mapping to a real recorded proof', () => {
    const dataDir = path.join(process.cwd(), 'data')
    const categories = fs.readdirSync(dataDir).filter((c) => fs.existsSync(path.join(dataDir, c, 'proofs', 'index.json')))
    expect(categories.length).toBeGreaterThan(0)
    for (const category of categories) {
      const proofs = loadProofIndex(category).filter((p) => p.kind === 'terminal')
      const byProduct = new Map<string, typeof proofs>()
      for (const p of proofs) byProduct.set(p.productId, [...(byProduct.get(p.productId) ?? []), p])
      for (const [productId, productProofs] of byProduct) {
        const stories = productProofs.map((p) => story(p.probeId, p.storyIds.join(' · '), p.command))
        const options = buildRunOptions(stories)
        const labels = options.map((o) => o.label)
        expect(new Set(labels).size, `${category}/${productId}: duplicate labels ${labels.join(', ')}`).toBe(labels.length)
        for (const o of options) {
          expect(productProofs.some((p) => p.probeId === o.story.id), `${category}/${productId}: option ${o.label} must map to a real proof`).toBe(true)
        }
      }
    }
  })
})

describe('replayCharCount', () => {
  it('is clamped, monotonic, and paced at msPerChar', () => {
    expect(replayCharCount(-5, 100)).toBe(0)
    expect(replayCharCount(0, 100)).toBe(0)
    expect(replayCharCount(80, 100, 8)).toBe(10)
    expect(replayCharCount(799, 100, 8)).toBe(99)
    expect(replayCharCount(10_000, 100, 8)).toBe(100) // never past the end
    expect(replayCharCount(10_000, 0)).toBe(0)
    // monotonic in elapsed time
    let prev = 0
    for (let t = 0; t < 1000; t += 7) {
      const now = replayCharCount(t, 100, 8)
      expect(now).toBeGreaterThanOrEqual(prev)
      prev = now
    }
  })

  it('guards a zero/negative msPerChar instead of dividing by zero', () => {
    expect(replayCharCount(50, 100, 0)).toBe(50)
  })
})

describe('stripSgr', () => {
  it('drops color sequences and keeps text', () => {
    expect(stripSgr('\x1b[1mserver\x1b[0m: nginx')).toBe('server: nginx')
  })
})

describe('probeResultLines', () => {
  it('renders auth-required as proof of life, never as failure', () => {
    const lines = probeResultLines({ reachable: true, authRequired: true, httpStatus: 401, oauth: true })
    expect(lines[0]).toBe('← HTTP 401 unauthorized (OAuth) — server is live, auth required')
    expect(lines[lines.length - 1]).toMatch(/verified reachable, auth-gated — untestable keylessly/)
  })

  it('renders everything the auth wall itself disclosed (RFC 9728 metadata)', () => {
    const lines = probeResultLines({
      reachable: true,
      authRequired: true,
      httpStatus: 401,
      oauth: true,
      resourceName: 'Acme MCP Server',
      scopes: ['mcp.read', 'mcp.write'],
      authServers: ['auth.acme.example'],
    })
    expect(lines).toContain('  the wall names itself: "Acme MCP Server"')
    expect(lines).toContain('  sign-in handled by: auth.acme.example')
    expect(lines).toContain('  scopes it grants: mcp.read, mcp.write')
  })

  it('renders a keyless handshake with the tool catalog (ellipsis when capped)', () => {
    const lines = probeResultLines({
      reachable: true,
      authRequired: false,
      handshake: true,
      serverInfo: { name: 'vendor-mcp', version: '2.0' },
      protocolVersion: '2025-06-18',
      toolCount: 12,
      toolNames: ['a', 'b'],
    })
    expect(lines[0]).toBe('← initialized — vendor-mcp v2.0 (protocol 2025-06-18)')
    expect(lines[1]).toBe('→ tools/list')
    expect(lines[2]).toBe('← 12 tools: a, b, …')
  })

  it('reports unreachable, transport errors, and non-MCP responses honestly', () => {
    expect(probeResultLines({ reachable: false })[0]).toMatch(/unreachable/)
    expect(probeResultLines({ error: 'rate limited' })[0]).toBe('← probe failed: rate limited')
    expect(probeResultLines({ reachable: true, authRequired: false, handshake: false, httpStatus: 503 })[0]).toMatch(/HTTP 503/)
  })

  it('says so when tools/list needed auth after a keyless initialize', () => {
    const lines = probeResultLines({ reachable: true, authRequired: false, handshake: true, serverInfo: { name: 'x', version: '1' }, protocolVersion: '2025-06-18' })
    expect(lines[2]).toMatch(/authenticated session/)
  })

  it('reports a rejected BYO key as a rejection, never as "auth required"', () => {
    const lines = probeResultLines({ reachable: true, authRequired: true, httpStatus: 401, auth: 'byo-key' })
    expect(lines[0]).toBe('← HTTP 401 — the server did not accept this key')
    expect(lines.join('\n')).not.toMatch(/server is live, auth required/)
    // sandbox credentials get named as ours, not the visitor's
    expect(callResultLines({ reachable: true, authRequired: true, httpStatus: 403, auth: 'sandbox' })[0]).toMatch(/sandbox credential/)
  })

  it('labels an authenticated handshake with the tier that produced it', () => {
    const base = { reachable: true, authRequired: false, handshake: true, serverInfo: { name: 'v', version: '1' }, protocolVersion: '2025-06-18' } as const
    expect(probeResultLines({ ...base, auth: 'byo-key' })[0]).toMatch(/authenticated with your key$/)
    expect(probeResultLines({ ...base, auth: 'sandbox' })[0]).toMatch(/authenticated with our sandbox account$/)
    expect(probeResultLines({ ...base, auth: 'keyless' })[0]).not.toMatch(/authenticated/)
  })
})

describe('callResultLines', () => {
  const okCall = {
    reachable: true,
    authRequired: false,
    handshake: true,
    serverInfo: { name: 'vendor-mcp', version: '1' },
    call: { tool: 'search_docs', label: 'search docs', ok: true, isError: false, resultText: 'line one\nline two', truncated: false },
  }

  it('renders a successful call result indented under an honest header', () => {
    const lines = callResultLines(okCall)
    expect(lines[0]).toBe('← result:')
    expect(lines[1]).toBe('  line one')
    expect(lines[2]).toBe('  line two')
  })

  it('discloses truncation and renders tool-level errors as the server talking', () => {
    const truncated = callResultLines({ ...okCall, call: { ...okCall.call, truncated: true } })
    expect(truncated[0]).toMatch(/truncated to 2 KB/)
    const toolError = callResultLines({ ...okCall, call: { ...okCall.call, isError: true } })
    expect(toolError[0]).toMatch(/returned an error result/)
  })

  it('reports transport failures, auth walls, and missing results honestly', () => {
    expect(callResultLines({ error: 'rate limited' })[0]).toBe('← call failed: rate limited')
    expect(callResultLines({ reachable: false })[0]).toMatch(/unreachable/)
    expect(callResultLines({ reachable: true, authRequired: true, httpStatus: 401, auth: 'keyless' })[0]).toMatch(/wants auth before it will take a tool call/)
    expect(callResultLines({ reachable: true, authRequired: false, handshake: false, httpStatus: 503 })[0]).toMatch(/HTTP 503/)
    expect(callResultLines({ reachable: true, authRequired: false, handshake: true, serverInfo: { name: 'v', version: '1' } })[0]).toMatch(/never completed/)
    expect(callResultLines({ ...okCall, call: { tool: 't', label: 'l', ok: false, error: 'server rejected the call (HTTP 500)' } })[0]).toBe('← server rejected the call (HTTP 500)')
  })
})

describe('tryResultLines', () => {
  it('labels a matching live run with the LIVE marker, elapsed ms, and the recorded expectation', () => {
    const lines = tryResultLines({
      ok: true, reachable: true, status: 200, contentType: 'text/plain', elapsedMs: 312,
      bodyExcerpt: '# acme\ndocs body', truncated: false, pass: true, expected: { status: 200, pattern: null },
    })
    expect(lines[0]).toContain('HTTP 200')
    expect(lines[0]).toContain('312 ms')
    expect(lines[0]).toContain('LIVE')
    expect(lines).toContain('  # acme')
    expect(lines.at(-1)).toContain('✓ matches the recorded proof (HTTP 200)')
  })

  it('says a mismatch out loud instead of dressing it up', () => {
    const lines = tryResultLines({
      ok: true, reachable: true, status: 404, elapsedMs: 90, bodyExcerpt: 'gone',
      pass: false, expected: { status: 200, pattern: null },
    })
    expect(lines.at(-1)).toContain('✗ differs from the recorded proof')
  })

  it('claims no verdict when the recording pinned nothing, and flags truncation', () => {
    const lines = tryResultLines({
      ok: true, reachable: true, status: 401, elapsedMs: 10, bodyExcerpt: 'x'.repeat(10),
      truncated: true, pass: null, expected: { status: null, pattern: null },
    })
    expect(lines.some((l) => l.includes('truncated'))).toBe(true)
    expect(lines.at(-1)).toContain('no match verdict is claimed')
    expect(lines.join('\n')).not.toContain('✓')
  })

  it('reports an unreachable run as exactly that', () => {
    expect(tryResultLines({ reachable: false, error: 'unreachable from our edge (network error or 10s timeout)', pass: false })).toEqual([
      '← unreachable from our edge (network error or 10s timeout)',
    ])
  })
})

describe('mcpClientConfig', () => {
  it('emits the shared mcpServers shape keyed by product id', () => {
    const config = JSON.parse(mcpClientConfig('stripe', 'https://mcp.stripe.com/')) as {
      mcpServers: Record<string, { url: string }>
    }
    expect(config).toEqual({ mcpServers: { stripe: { url: 'https://mcp.stripe.com/' } } })
  })
})

describe('tryit assembly (committed corpus)', () => {
  it('mcpDocsUrlFor prefers a docs-page links.mcp, never the endpoint itself', () => {
    // stripe's links.mcp is a documentation page — pass it through
    expect(mcpDocsUrlFor('payments', 'stripe')).toBe('https://docs.stripe.com/mcp')
    // unknown product → null
    expect(mcpDocsUrlFor('payments', 'no-such-product')).toBeNull()
  })

  it('stripe is tryable with recorded stories AND a live endpoint; its stories carry transcripts', () => {
    expect(hasTryIt('payments', 'stripe')).toBe(true)
    expect(mcpEndpointFor('payments', 'stripe')).toBe('https://mcp.stripe.com/')
    const { stories } = loadCategory('payments')
    const recorded = buildRecordedStories('payments', 'stripe', stories)
    expect(recorded.length).toBeGreaterThanOrEqual(3)
    for (const story of recorded) {
      expect(story.kind).toBe('recorded')
      expect(story.transcript?.length).toBeGreaterThan(0)
      expect(story.transcript).not.toMatch(/\x1b\[[0-9;]*m/) // SGR stripped for replay
      expect(story.title.length).toBeGreaterThan(0)
    }
  })

  it('mercury is tryable via the live MCP endpoint alone; unknown products are not', () => {
    expect(hasTryIt('startup-banking', 'mercury')).toBe(true)
    expect(buildRecordedStories('startup-banking', 'mercury', [])).toEqual([])
    expect(hasTryIt('payroll', 'gusto')).toBe(true) // official MCP server evidence → live endpoint qualifies
    expect(hasTryIt('accounting', 'quickbooks')).toBe(false) // docs-only MCP link, no proofs → no fake try
  })

  it('hasTryIt equals the sandbox section\'s own render predicate for every committed product — the header CTA can never point at an empty section', () => {
    for (const data of loadAll()) {
      for (const p of data.products) {
        const sectionRenders =
          buildRecordedStories(data.category.id, p.id, data.stories).length > 0 ||
          mcpEndpointFor(data.category.id, p.id) !== null
        expect(hasTryIt(data.category.id, p.id), `${data.category.id}/${p.id}`).toBe(sectionRenders)
      }
    }
  })

  it('cross-links founder processes only for the arena the vendor is mapped to', () => {
    const stripeProcesses = processesFeaturing('payments', 'stripe')
    expect(stripeProcesses.length).toBeGreaterThan(0)
    for (const p of stripeProcesses) expect(p.slug).toMatch(/^[a-z0-9-]+$/)
    // stripe is mapped to 'payments' in VENDOR_ARENA — a different arena gets nothing.
    expect(processesFeaturing('mobile-payments', 'stripe')).toEqual([])
  })
})
