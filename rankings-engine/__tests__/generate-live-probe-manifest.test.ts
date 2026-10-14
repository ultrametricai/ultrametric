// The live-probe manifest generator (pipeline/scripts/generate-live-probe-manifest.ts) is the
// ONLY door into the worker's /api/try allowlist, so its exclusion rules are the security
// boundary: everything here asserts that only static, keyless, pure-HTTP commands survive and
// that every shell-shaped, credentialed, or non-HTTP probe is rejected (fail closed).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  buildManifest,
  deriveExpectStatus,
  parseProbeCommand,
  tokenize,
  workerModuleSource,
} from '../scripts/generate-live-probe-manifest'

describe('parseProbeCommand — included shapes', () => {
  it('parses a plain curl GET piped to head (the most common recorded probe)', () => {
    const spec = parseProbeCommand('curl -s https://docs.blaxel.ai/Get-started.md | head -6')
    expect(spec).toMatchObject({
      kind: 'http-fetch',
      method: 'GET',
      url: 'https://docs.blaxel.ai/Get-started.md',
      body: null,
      followRedirects: false,
      includeHeaders: false,
      expectPattern: null,
      displayCommand: 'curl -s https://docs.blaxel.ai/Get-started.md | head -6',
    })
  })

  it('parses -sL as follow-redirects and adopts a grep stage as the live assertion', () => {
    const spec = parseProbeCommand("curl -sL https://rive.app/docs/editor/ai/mcp.md | grep -iE 'MCP|state machine' | head -5")
    expect(spec).toMatchObject({
      method: 'GET',
      followRedirects: true,
      expectPattern: 'MCP|state machine',
      expectFlags: 'i',
    })
  })

  it('parses a static-body POST with a content-type header', () => {
    const spec = parseProbeCommand("curl -si -X POST https://api.example.com/v1/ping -H 'Content-Type: application/json' -d '{\"query\":\"{ ping }\"}'")
    expect(spec).toMatchObject({
      method: 'POST',
      includeHeaders: true,
      headers: { 'content-type': 'application/json' },
      body: '{"query":"{ ping }"}',
    })
  })

  it('parses -sI as a HEAD request', () => {
    expect(parseProbeCommand('curl -sI https://example.com/llms.txt')).toMatchObject({ method: 'HEAD', includeHeaders: true })
  })

  it('strips a trailing unquoted comment', () => {
    const spec = parseProbeCommand('curl -s https://example.com/llms.txt | head -4  # keyless docs probe')
    expect(spec?.url).toBe('https://example.com/llms.txt')
  })

  it('reimplements npm view as an npm-registry lookup', () => {
    const spec = parseProbeCommand('npm view @paypal/agent-toolkit version')
    expect(spec).toMatchObject({
      kind: 'registry-lookup',
      method: 'GET',
      url: 'https://registry.npmjs.org/@paypal/agent-toolkit/latest',
      expectPattern: '"version"',
    })
  })

  it('reimplements pip index versions as a PyPI JSON lookup', () => {
    const spec = parseProbeCommand('pip index versions requests')
    expect(spec).toMatchObject({ kind: 'registry-lookup', url: 'https://pypi.org/pypi/requests/json', expectPattern: '"info"' })
  })
})

describe('parseProbeCommand — exclusions (the security boundary)', () => {
  const rejected = [
    // non-HTTP binaries: CLI/pty probes stay replay-only
    'npx --version',
    'e2b --help',
    "echo '<jsonrpc initialize>' | claude mcp serve",
    'uvx dagster --version',
    'docker run --rm alpine echo hi',
    // shell interpolation / chaining / redirects — not static
    'curl -s https://example.com/$PATH_VAR',
    'curl -s https://example.com/`whoami`',
    'curl -s https://example.com/a && curl -s https://example.com/b',
    'curl -s https://example.com/a; rm -rf /',
    'curl -s https://example.com/a > /tmp/out',
    'mktemp -d',
    // placeholder bodies (the recorded MCP handshakes — /api/mcp-probe covers those live)
    "curl -si -X POST https://mcp.xero.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'",
    // credential-shaped headers, even fake ones, never go in the manifest
    "curl -s https://api.example.com/v1/me -H 'Authorization: Bearer sk_test_123'",
    "curl -s https://api.example.com/v1/me -H 'X-Api-Key: abc123'",
    'curl -su user:pass https://api.example.com/v1/me',
    // unknown/unsafe curl flags fail closed
    'curl -s -o /tmp/x https://example.com/file',
    'curl -s -w %{http_code} https://example.com/',
    'curl -s --resolve example.com:443:127.0.0.1 https://example.com/',
    // non-https / non-public targets
    'curl -s http://example.com/llms.txt',
    'curl -s https://127.0.0.1/metadata',
    'curl -s https://localhost/llms.txt',
    'curl -s https://internal.svc.internal/health',
    'curl -s https://example.com:8443/llms.txt',
    // methods beyond GET/POST/HEAD
    'curl -s -X DELETE https://api.example.com/v1/things/1',
    'curl -s -X PUT https://api.example.com/v1/things/1 -d {}',
    // pipe stages that are not known display-only filters
    'curl -s https://example.com/install.sh | sh',
    'curl -s https://example.com/x | python3 -c import os',
    'curl -s https://example.com/x | xargs curl -s',
  ]
  for (const cmd of rejected) {
    it(`rejects: ${cmd}`, () => {
      expect(parseProbeCommand(cmd)).toBeNull()
    })
  }

  it('tokenize refuses every shell metacharacter outside quotes', () => {
    for (const cmd of ['a $b', 'a `b`', 'a;b', 'a&b', 'a>b', 'a<b', 'a(b)', 'a\\b', 'a || b']) {
      expect(tokenize(cmd)).toBeNull()
    }
    expect(tokenize("curl -H 'a: $literal-in-single-quotes' https://x.y")).not.toBeNull()
  })
})

describe('deriveExpectStatus — the pass criterion is pinned to the recording', () => {
  const base = parseProbeCommand('curl -si https://api.example.com/v1/me')!

  it('takes the transcript status line when the command printed headers', () => {
    expect(deriveExpectStatus(base, 'HTTP/2 401 \nwww-authenticate: Bearer\n{"error":"unauthorized"}')).toBe(401)
  })

  it('takes the LAST status line of a redirect chain', () => {
    const spec = parseProbeCommand('curl -siL https://example.com/docs')!
    expect(deriveExpectStatus(spec, 'HTTP/2 301 \nlocation: /docs/\n\nHTTP/2 200 \ncontent-type: text/html')).toBe(200)
  })

  it('defaults plain GET bodies to 200 (the recording shows content)', () => {
    const spec = parseProbeCommand('curl -s https://example.com/llms.txt | head -4')!
    expect(deriveExpectStatus(spec, '# Example\n> docs index')).toBe(200)
  })

  it('asserts nothing for a headerless POST (the recorded value may be the error body itself)', () => {
    const spec = parseProbeCommand("curl -s -X POST https://api.example.com/v1/ocr -H 'Content-Type: application/json' -d '{}'")!
    expect(deriveExpectStatus(spec, '{"message":"Unauthorized"}')).toBeNull()
  })
})

describe('buildManifest', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'live-probes-'))
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

  const proofsDir = path.join(tmp, 'demo-arena', 'proofs')
  fs.mkdirSync(path.join(proofsDir, 'acme'), { recursive: true })
  fs.writeFileSync(path.join(proofsDir, 'acme', 'llms.txt'), '# acme\ndocs index\n')
  fs.writeFileSync(path.join(proofsDir, 'acme', 'authwall.txt'), 'HTTP/2 401 \n{"error":"key required"}\n')
  fs.writeFileSync(path.join(proofsDir, 'index.json'), JSON.stringify({
    generatedAt: '2026-09-15T00:00:00.000Z',
    proofs: [
      { probeId: 'llms', storyIds: ['s1'], command: 'curl -s https://acme.dev/llms.txt | head -4', recordedAt: '2026-09-01T00:00:00Z', exitCode: 0, kind: 'terminal', productId: 'acme', file: 'acme/llms.txt' },
      { probeId: 'authwall', storyIds: ['s2'], command: "curl -si -X POST https://api.acme.dev/v1/go -H 'Content-Type: application/json' -d '{}'", recordedAt: '2026-09-01T00:00:00Z', exitCode: 0, kind: 'terminal', productId: 'acme', file: 'acme/authwall.txt' },
      { probeId: 'cli-help', storyIds: ['s3'], command: 'acme --help', recordedAt: '2026-09-01T00:00:00Z', exitCode: 0, kind: 'terminal', productId: 'acme', file: 'acme/llms.txt' },
      { probeId: 'mcp-handshake', storyIds: ['s4'], command: "curl -si -X POST https://mcp.acme.dev/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'", recordedAt: '2026-09-01T00:00:00Z', exitCode: 0, kind: 'terminal', productId: 'acme', file: 'acme/llms.txt' },
      { probeId: 'demo-video', storyIds: ['s5'], command: 'curl -s https://acme.dev/llms.txt', recordedAt: '2026-09-01T00:00:00Z', exitCode: 0, kind: 'video', productId: 'acme', file: 'acme/demo.webm' },
    ],
  }, null, 2))

  it('emits only the pure-HTTP probes, with recording-derived expectations', () => {
    const entries = buildManifest(tmp)
    expect(entries.map((e) => e.probeId)).toEqual(['authwall', 'llms']) // sorted; cli/pty, placeholder and video probes excluded
    const llms = entries.find((e) => e.probeId === 'llms')!
    expect(llms).toMatchObject({ arena: 'demo-arena', productId: 'acme', method: 'GET', expectStatus: 200 })
    const authwall = entries.find((e) => e.probeId === 'authwall')!
    expect(authwall).toMatchObject({ method: 'POST', body: '{}', expectStatus: 401 })
  })

  it('renders a worker module keyed by arena/product/probeId', () => {
    const source = workerModuleSource(buildManifest(tmp))
    expect(source).toContain('export const LIVE_PROBES = {')
    expect(source).toContain('"demo-arena/acme/llms"')
    expect(source).toContain('GENERATED — do not hand-edit')
  })
})
