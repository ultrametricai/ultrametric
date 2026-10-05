// Client-safe (no node:fs) logic behind the product pages' "Try it" microterminal
// (components/TryIt/Microterminal.tsx): character-paced replay math, SGR stripping for plain
// display, and the rendering of a live /api/mcp-probe result as terminal lines. Kept pure so
// lib/__tests__/tryitReplay.test.ts can exercise every branch without a DOM or a network.

// One selectable "story" in the microterminal menu. Recorded stories carry a full transcript
// (a proof recording from lib/proofs.ts, SGR-stripped server-side); the live MCP story has no
// transcript — its text is produced at run time from the probe result.
export interface TryItStory {
  id: string
  /** Human title from the prefixed user stories the proof substantiates. */
  title: string
  kind: 'recorded' | 'live-mcp'
  command: string
  recordedAt?: string
  exitCode?: number
  transcript?: string
  /** This exact command is in the live-probe manifest (lib/liveProbes.ts) — the worker can
   *  re-run it as a fetch, so the terminal offers a "run live" button next to the replay. */
  live?: boolean
}

// One entry in the microterminal's run-type selector (founder 2026-10-05 redesign): the long
// combined story titles move into the tooltip, the chip shows a short functional label derived
// from the command, and stories that run the same command path collapse into one option.
export interface RunOption {
  /** Representative story — its id is what the menu plays; command/live/transcript come from it. */
  story: TryItStory
  /** Short functional label ("Install locally", "MCP handshake", …), unique within one menu. */
  label: string
  /** Every full story title behind this option (merged variants included) — the tooltip copy. */
  titles: string[]
}

// Short functional label for one recorded command — what KIND of run this is, not which stories
// it substantiates (those stay in the tooltip). Heuristics over the committed probe commands;
// the fallback is honest: anything that isn't an HTTP fetch or an install is a CLI run.
export function deriveRunLabel(command: string): string {
  const c = command.toLowerCase()
  if (c.includes('llms.txt')) return 'llms.txt discovery'
  if (c.includes('agent-skills')) return 'Skills registry'
  if (c.includes('.well-known/mcp')) return 'MCP discovery'
  if (c.includes('jsonrpc') && c.includes('initialize')) return 'MCP handshake'
  if (c.includes('mcp') && c.includes('tools/call')) return 'MCP tool call'
  if (/(^|[\s&(;])(npm (install|i) |pnpm add |yarn add |pip3? install |pipx install |uv add |brew install |cargo install |go install |gem install )/.test(c)) return 'Install locally'
  if (/\bnpm (view|info)\b/.test(c)) return 'Package registry'
  if (c.includes('openapi')) return 'Public API'
  if (c.startsWith('curl') && /\.md\b/.test(c)) return 'Markdown docs'
  if (c.startsWith('curl')) return 'Public API'
  return 'CLI'
}

// First URL host in a command — the natural qualifier when two options share a run type
// (e.g. three MCP handshakes against different endpoints of one vendor).
function commandHost(command: string): string | null {
  const m = command.match(/https?:\/\/([^/\s'"]+)/)
  return m ? m[1] : null
}

// The selector's options: one per distinct command path (combined-story variants that run the
// same command merge into one option; all their titles ride the tooltip), labeled by run type.
// Labels are made unique deterministically — first by the command's host, then by the probe id —
// so the menu never shows two identical chips. Selection semantics are unchanged: every option
// plays exactly one real recorded story.
export function buildRunOptions(stories: TryItStory[]): RunOption[] {
  const byCommand = new Map<string, TryItStory[]>()
  for (const s of stories) {
    const group = byCommand.get(s.command)
    if (group) group.push(s)
    else byCommand.set(s.command, [s])
  }
  const options: RunOption[] = [...byCommand.values()].map((group) => ({
    story: group[0],
    label: deriveRunLabel(group[0].command),
    titles: [...new Set(group.flatMap((s) => s.title.split(' · ')))],
  }))
  // Two disambiguation passes: host qualifier for same-run-type options, probe id if the hosts
  // collide too (probe ids are unique per product, so this terminates unique).
  for (const qualify of [
    (o: RunOption) => commandHost(o.story.command) ?? o.story.id,
    (o: RunOption) => o.story.id,
  ]) {
    const counts = new Map<string, number>()
    for (const o of options) counts.set(o.label, (counts.get(o.label) ?? 0) + 1)
    for (const o of options) {
      if ((counts.get(o.label) ?? 0) > 1) o.label = `${o.label} · ${qualify(o)}`
    }
  }
  return options
}

export const REPLAY_MS_PER_CHAR = 8

// How many characters of a transcript are visible `elapsedMs` after replay start. Pure and
// clamped so the component can drive it straight from an rAF timestamp; "skip" simply renders
// the full length.
export function replayCharCount(elapsedMs: number, totalChars: number, msPerChar: number = REPLAY_MS_PER_CHAR): number {
  if (totalChars <= 0 || elapsedMs <= 0) return 0
  return Math.min(totalChars, Math.floor(elapsedMs / Math.max(1, msPerChar)))
}

// Recordings keep SGR color sequences on disk (lib/proofs.ts); the microterminal renders plain
// text, so drop them before replaying (same regex as components/ProofBlock.tsx).
export function stripSgr(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

// Which credential tier a probe/call ran under (worker's handleMcpProbe `auth` field).
export type McpProbeAuth = 'keyless' | 'byo-key' | 'sandbox'

// Sanitized summary returned by the worker's /api/mcp-probe (infra/cloudflare-proxy/worker.js
// — probeMcpEndpoint + handleMcpProbe).
export interface McpProbeResult {
  ok?: boolean
  error?: string
  endpoint?: string
  probedAt?: string
  auth?: McpProbeAuth
  reachable?: boolean
  authRequired?: boolean
  oauth?: boolean
  httpStatus?: number
  handshake?: boolean
  serverInfo?: { name: string; version: string }
  protocolVersion?: string
  toolCount?: number
  toolNames?: string[]
  // Auth-wall enrichment (RFC 9728 protected-resource metadata, fetched by the worker when the
  // handshake got a 401/403) — what the wall itself discloses, so an auth-gated result still
  // leaves the visitor with something concrete.
  resourceName?: string
  scopes?: string[]
  authServers?: string[]
  // Set when this endpoint has a curated read-only demo call (data/mcp-demo-calls.json) — the
  // "▶ run a real call" affordance. Tool + label only; the args ship server-side.
  demoCall?: { tool: string; label: string }
  // Set when the operator has provisioned a DEMO_CRED_<PRODUCTID> wrangler secret — the
  // "use our sandbox account" affordance (docs/TRY-IT-DEMO-ACCOUNTS.md).
  sandboxAvailable?: boolean
}

// Sanitized summary of one curated demo tool call (worker's callMcpDemo via action: 'call').
export interface McpCallResult {
  ok?: boolean
  error?: string
  auth?: McpProbeAuth
  reachable?: boolean
  authRequired?: boolean
  httpStatus?: number
  handshake?: boolean
  serverInfo?: { name: string; version: string }
  call?: {
    tool: string
    label: string
    ok: boolean
    error?: string
    isError?: boolean
    resultText?: string
    truncated?: boolean
  }
}

// Sanitized summary returned by the worker's /api/try/:arena/:product/:probeId
// (infra/cloudflare-proxy/worker.js — executeLiveProbe + handleTryProbe): one recorded proof
// command re-run live as a worker-native fetch.
export interface TryProbeResult {
  ok?: boolean
  error?: string
  method?: string
  url?: string
  ranAt?: string
  reachable?: boolean
  status?: number
  contentType?: string
  elapsedMs?: number
  bodyExcerpt?: string
  truncated?: boolean
  /** true/false = live result matches / differs from what the recorded proof asserted;
   *  null = the recording pinned no status or pattern, so no verdict is claimed. */
  pass?: boolean | null
  expected?: { status: number | null; pattern: string | null }
}

// Render one live re-run result as terminal lines. Honesty rules match probeResultLines: the
// verdict line only claims a match/mismatch when the recorded proof pinned something to compare
// against, and a truncated excerpt says so.
export function tryResultLines(result: TryProbeResult): string[] {
  if (result.error && !result.reachable) return [`← ${result.error}`]
  if (!result.ok && result.error) return [`← live run failed: ${result.error}`]
  const lines = [
    `← HTTP ${result.status ?? '???'}${result.contentType ? ` · ${result.contentType}` : ''} · ${result.elapsedMs ?? '?'} ms — LIVE, just now from our edge`,
  ]
  const excerpt = (result.bodyExcerpt ?? '').trimEnd()
  if (excerpt) {
    for (const line of excerpt.split('\n')) lines.push(`  ${line}`)
    if (result.truncated) lines.push('  … [truncated — live runs show the first 2 KB, unfiltered]')
  } else {
    lines.push('  (empty response body)')
  }
  if (result.pass === true) {
    const what = [
      result.expected?.status !== null && result.expected?.status !== undefined ? `HTTP ${result.expected.status}` : null,
      result.expected?.pattern ? `matches /${result.expected.pattern}/` : null,
    ].filter(Boolean).join(', ')
    lines.push(`✓ matches the recorded proof${what ? ` (${what})` : ''}`)
  } else if (result.pass === false) {
    const wanted = [
      result.expected?.status !== null && result.expected?.status !== undefined ? `HTTP ${result.expected.status}` : null,
      result.expected?.pattern ? `body matching /${result.expected.pattern}/` : null,
    ].filter(Boolean).join(' and ')
    lines.push(`✗ differs from the recorded proof${wanted ? ` (it got ${wanted})` : ''} — the vendor may have changed something`)
  } else {
    lines.push('— raw live answer above; the recording pinned no status/pattern, so no match verdict is claimed')
  }
  return lines
}

// The copy-paste MCP client config for this product's documented endpoint — the "take it with
// you" follow-up under the microterminal (components/TryIt/Microterminal.tsx). The
// `mcpServers` shape is the convention Claude Code / Cursor / VS Code-family clients share for
// remote servers; clients run the vendor's OAuth sign-in themselves when the server demands it.
export function mcpClientConfig(productId: string, endpoint: string): string {
  return JSON.stringify({ mcpServers: { [productId]: { url: endpoint } } }, null, 2)
}

// Render one probe result as the terminal lines the microterminal types out. Honest by
// construction: a 401 is reported as proof of life + auth requirement, never dressed up as a
// working session.
export function probeResultLines(result: McpProbeResult): string[] {
  if (result.error) return [`← probe failed: ${result.error}`]
  if (!result.reachable) return ['← no response — endpoint unreachable from our edge right now']

  if (result.authRequired) {
    if (result.auth && result.auth !== 'keyless') {
      // An authenticated attempt that still hit the wall: the credential was rejected — say
      // exactly that, never that "the server needs auth" (it had auth; it didn't accept it).
      return [
        `← HTTP ${result.httpStatus ?? 401} — the server did not accept this ${result.auth === 'sandbox' ? 'sandbox credential' : 'key'}`,
        '  (some vendors only accept OAuth session tokens here, not API keys — check their MCP docs)',
      ]
    }
    const lines = [
      `← HTTP ${result.httpStatus ?? 401} unauthorized${result.oauth ? ' (OAuth)' : ''} — server is live, auth required`,
    ]
    // Everything the auth wall itself disclosed (RFC 9728 metadata) — an auth-gated probe
    // should still hand the visitor facts, not just a dead 401.
    if (result.resourceName) lines.push(`  the wall names itself: "${result.resourceName}"`)
    if (result.authServers?.length) lines.push(`  sign-in handled by: ${result.authServers.join(', ')}`)
    if (result.scopes?.length) lines.push(`  scopes it grants: ${result.scopes.join(', ')}`)
    lines.push('  verified reachable, auth-gated — untestable keylessly; add it to your MCP client to sign in')
    return lines
  }

  if (!result.handshake) {
    return [`← HTTP ${result.httpStatus ?? '???'} — endpoint responded, but not with an MCP handshake we understand`]
  }

  const lines = [
    `← initialized — ${result.serverInfo?.name ?? 'unknown server'} v${result.serverInfo?.version ?? '?'} (protocol ${result.protocolVersion ?? '?'})${authSuffix(result.auth)}`,
    '→ tools/list',
  ]
  if (typeof result.toolCount === 'number') {
    const names = result.toolNames ?? []
    const suffix = result.toolCount > names.length ? ', …' : ''
    lines.push(`← ${result.toolCount} tools: ${names.join(', ')}${suffix}`)
  } else {
    lines.push('← tools/list not answered keyless — tool catalog needs an authenticated session')
  }
  return lines
}

function authSuffix(auth?: McpProbeAuth): string {
  if (auth === 'byo-key') return ' — authenticated with your key'
  if (auth === 'sandbox') return ' — authenticated with our sandbox account'
  return ''
}

// Render one demo-call result (worker action: 'call') as terminal lines. Same honesty rules:
// a rejected credential, a tool-level error, and a truncated result are all said out loud.
export function callResultLines(result: McpCallResult): string[] {
  if (result.error) return [`← call failed: ${result.error}`]
  if (!result.reachable) return ['← no response — endpoint unreachable from our edge right now']
  if (result.authRequired) {
    return result.auth && result.auth !== 'keyless'
      ? [`← HTTP ${result.httpStatus ?? 401} — the server did not accept this ${result.auth === 'sandbox' ? 'sandbox credential' : 'key'}`]
      : [`← HTTP ${result.httpStatus ?? 401} — the server wants auth before it will take a tool call`]
  }
  if (!result.handshake) {
    return [`← HTTP ${result.httpStatus ?? '???'} — endpoint responded, but not with an MCP handshake we understand`]
  }
  const call = result.call
  if (!call) return ['← call failed: the server answered the handshake but the tool call never completed']
  if (!call.ok) return [`← ${call.error ?? 'tool call failed'}`]
  const lines = [
    call.isError
      ? `← the tool ran and returned an error result (that is the server talking, verbatim):`
      : `← result${call.truncated ? ' (truncated to 2 KB — the demo is a taste, not an export)' : ''}:`,
  ]
  for (const line of (call.resultText ?? '').split('\n')) lines.push(`  ${line}`)
  return lines
}
