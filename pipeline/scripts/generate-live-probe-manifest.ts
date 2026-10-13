// Generates the LIVE-PROBE manifest behind the product pages' "Try it → run live" button
// (components/TryIt/Microterminal.tsx) and the worker's /api/try/:arena/:product/:probeId
// route (infra/cloudflare-proxy/worker.js).
//
// The idea: many recorded keyless probes (rankings/<arena>/proofs/) are pure HTTP — a curl GET/POST
// of a fixed public URL with static args, or an npm/pip registry lookup. Those exact requests
// can be re-run live from the Cloudflare Worker as worker-native fetch calls (never a shell,
// never user input). This script scans every committed proof index, parses each recorded
// command, and emits ONLY the ones that are provably reproducible as a plain fetch:
//
//   INCLUDED   curl GET/POST/HEAD of an https URL with static headers/body, optionally piped
//              through display-only filters (head/grep/sort/…— never executed, but a grep
//              pattern becomes the live run's expectPattern), and `npm view` / `pip index
//              versions` registry lookups (reimplemented as registry HTTP GETs).
//   EXCLUDED   anything with shell interpolation ($, backticks, ;, &&, redirects), any
//              credential-shaped header (Authorization/Cookie/api-key/…), placeholder bodies
//              ('<jsonrpc initialize>'), non-https or non-public URLs, unknown curl flags, and
//              every non-HTTP binary (npx, uvx, docker, stripe, …) — those keep the replay.
//
// Outputs (both committed, both generated — do not hand-edit):
//   rankings/live-probes.json                          read by lib/liveProbes.ts (site, build time)
//                                                  and mirrored to public/data/ by copy-data.mjs
//   infra/cloudflare-proxy/live-probes.generated.js  imported by worker.js — `wrangler deploy`
//                                                  bundles it into the worker (same "committed
//                                                  static allowlist" pattern as MCP_ENDPOINTS)
//
// A unit test (infra/cloudflare-proxy/__tests__/try.test.ts) asserts the two outputs never
// drift. NEVER accept request-time URLs anywhere downstream: this build-time scan of committed
// data is the only door in.
//
// Run: pnpm tsx pipeline/scripts/generate-live-probe-manifest.ts
import fs from 'node:fs'
import path from 'node:path'
import { loadProofIndex, readProofTranscript, type ProofIndexEntry } from '../../lib/proofs'
import { stripSgr } from '../../lib/tryitReplay'
import { ROOT, DATA_DIR } from '../paths'

export interface LiveProbeSpec {
  kind: 'http-fetch' | 'registry-lookup'
  method: 'GET' | 'POST' | 'HEAD'
  url: string
  /** Static, pre-vetted request headers (lowercased names). Never credential-shaped. */
  headers: Record<string, string>
  body: string | null
  /** The recorded command used -L: the live fetch follows redirects the same way. */
  followRedirects: boolean
  /** The recorded command used -i/-I: the transcript shows the status line, so we can pin it. */
  includeHeaders: boolean
  /** Status the recorded proof got (derivable) — live pass criterion. null = no assertion. */
  expectStatus: number | null
  /** JS-compatible regex from the recorded command's own grep stage. null = no assertion. */
  expectPattern: string | null
  expectFlags: string
  /** The exact recorded command, verbatim — what the UI shows next to the Run live button. */
  displayCommand: string
}

export interface LiveProbeEntry extends LiveProbeSpec {
  arena: string
  productId: string
  probeId: string
}

// ---------------------------------------------------------------------------
// Shell-free command parsing
// ---------------------------------------------------------------------------

// Quote-aware tokenizer. Returns null for anything a shell would interpret (variables, command
// substitution, redirects, chaining) — those commands are NOT static and never go live.
// Unquoted `|` becomes its own token so the caller can split pipeline stages; an unquoted `#`
// at a token boundary starts a trailing comment (several recorded commands carry one).
export function tokenize(command: string): string[] | null {
  const tokens: string[] = []
  let cur = ''
  let started = false
  let i = 0
  while (i < command.length) {
    const ch = command[i]
    if (ch === "'") {
      const end = command.indexOf("'", i + 1)
      if (end === -1) return null
      cur += command.slice(i + 1, end)
      started = true
      i = end + 1
      continue
    }
    if (ch === '"') {
      const end = command.indexOf('"', i + 1)
      if (end === -1) return null
      const inner = command.slice(i + 1, end)
      if (/[$`\\]/.test(inner)) return null // double quotes still expand — not static
      cur += inner
      started = true
      i = end + 1
      continue
    }
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      if (started) {
        tokens.push(cur)
        cur = ''
        started = false
      }
      i++
      continue
    }
    if (ch === '#' && !started) break // trailing comment
    if (ch === '|') {
      if (started) {
        tokens.push(cur)
        cur = ''
        started = false
      }
      if (command[i + 1] === '|') return null // `||` chaining
      tokens.push('|')
      i++
      continue
    }
    if ('$`;&<>(){}\\!'.includes(ch)) return null // shell metacharacter — not static
    cur += ch
    started = true
    i++
  }
  if (started) tokens.push(cur)
  return tokens.length > 0 ? tokens : null
}

function splitStages(tokens: string[]): string[][] {
  const stages: string[][] = [[]]
  for (const t of tokens) {
    if (t === '|') stages.push([])
    else stages[stages.length - 1].push(t)
  }
  return stages
}

// Pipe stages after the curl are display-only text filters in the recorded sessions — they are
// NEVER executed live (the worker shows the raw response excerpt), but a stage outside this set
// means we can't claim the live run reproduces the probe, so the probe stays replay-only.
const SAFE_PIPE_STAGES = new Set(['head', 'tail', 'grep', 'sort', 'uniq', 'wc', 'tr', 'cut', 'sed'])

// Header names that smell like credentials. Belt and braces: the recorded keyless probes hold
// no secrets by construction, but a manifest entry must never carry one either.
const CREDENTIAL_HEADER_RE = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|apikey|x-auth(-token)?|x-token|x-secret.*)$/i

// Mirrors the worker's validateTarget: public https hosts only.
function isPublicHttpsUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.username || url.password || url.port) return false
  if (raw.includes('<')) return false // placeholder, not a real URL
  const host = url.hostname.toLowerCase()
  if (!host.includes('.')) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')) return false
  if (
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || host.endsWith('.internal') || host.endsWith('.home.arpa') || host.endsWith('.arpa')
    || host.endsWith('.onion')
  ) return false
  return true
}

// Parse the curl stage into a fetch shape, or null when anything is off-menu. Every flag must
// be explicitly understood — an unknown flag disqualifies the whole probe (fail closed).
function parseCurl(tokens: string[]): Omit<LiveProbeSpec, 'kind' | 'expectStatus' | 'expectPattern' | 'expectFlags' | 'displayCommand'> | null {
  let explicitMethod: string | null = null
  let url: string | null = null
  const headers: Record<string, string> = {}
  let body: string | null = null
  let followRedirects = false
  let includeHeaders = false
  let headMethod = false

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '-X' || t === '--request') {
      explicitMethod = (tokens[++i] ?? '').toUpperCase()
      continue
    }
    if (t === '-H' || t === '--header') {
      const raw = tokens[++i] ?? ''
      const colon = raw.indexOf(':')
      if (colon === -1) return null
      const name = raw.slice(0, colon).trim()
      const value = raw.slice(colon + 1).trim()
      if (!name || CREDENTIAL_HEADER_RE.test(name) || value.includes('<')) return null
      headers[name.toLowerCase()] = value
      continue
    }
    if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') {
      body = tokens[++i] ?? ''
      continue
    }
    if (t === '-A' || t === '--user-agent') {
      headers['user-agent'] = tokens[++i] ?? ''
      continue
    }
    if (t === '--compressed') continue
    if (t === '-m' || t === '--max-time' || t === '--connect-timeout') {
      i++ // the worker enforces its own timeout
      continue
    }
    if (t === '--url') {
      if (url !== null) return null
      url = tokens[++i] ?? null
      continue
    }
    if (t.startsWith('--')) return null // unknown long flag — fail closed
    if (t.startsWith('-') && t.length > 1) {
      for (const c of t.slice(1)) {
        if (c === 's' || c === 'S' || c === 'f') continue // silent/show-error/fail: display-only
        else if (c === 'i') includeHeaders = true
        else if (c === 'I') { headMethod = true; includeHeaders = true }
        else if (c === 'L') followRedirects = true
        else return null // -o, -c, -w, -u, -b, -E, -x, … — fail closed
      }
      continue
    }
    if (url !== null) return null // two positional URLs — off-menu
    url = t
  }

  if (!url || !isPublicHttpsUrl(url)) return null
  // '<jsonrpc initialize>'-style placeholders and curl @file references are not static bodies.
  if (body !== null && (body.includes('<') || body.startsWith('@') || body.length > 4096)) return null

  let method: 'GET' | 'POST' | 'HEAD'
  if (headMethod) {
    if (body !== null || (explicitMethod && explicitMethod !== 'HEAD')) return null
    method = 'HEAD'
  } else if (explicitMethod) {
    if (explicitMethod !== 'GET' && explicitMethod !== 'POST' && explicitMethod !== 'HEAD') return null
    if (explicitMethod === 'GET' && body !== null) return null
    method = explicitMethod as 'GET' | 'POST' | 'HEAD'
  } else {
    method = body !== null ? 'POST' : 'GET'
  }

  return { method, url, headers, body, followRedirects, includeHeaders }
}

// A grep stage in the recorded pipeline is a ready-made live assertion: the recorded output
// matched this pattern, so the live response should too. Only adopted when the pattern
// compiles as a JS regex (grep BRE/ERE mostly overlaps); otherwise the probe still goes live,
// just without a content assertion.
function grepAssertion(stage: string[]): { pattern: string; flags: string } | null {
  let flags = ''
  let pattern: string | null = null
  for (let i = 1; i < stage.length; i++) {
    const t = stage[i]
    if (t === '-e' || t === '--regexp') {
      pattern = stage[++i] ?? null
      break
    }
    if (t.startsWith('-')) {
      if (/^-[a-zA-Z]+$/.test(t) && t.includes('i')) flags = 'i'
      if (t === '-m' || t === '-A' || t === '-B' || t === '-C') i++ // numeric argument
      continue
    }
    pattern = t
    break
  }
  if (!pattern) return null
  try {
    void new RegExp(pattern, flags)
  } catch {
    return null
  }
  return { pattern, flags }
}

const NPM_PKG_RE = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/
const PIP_PKG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

// Parse one recorded proof command into a live-probe spec, or null when it is not a pure-HTTP
// probe we can reproduce as a worker-native fetch. Pure — unit-tested with fixture commands.
export function parseProbeCommand(command: string): Omit<LiveProbeSpec, 'expectStatus'> | null {
  const tokens = tokenize(command.trim())
  if (!tokens) return null
  const stages = splitStages(tokens)
  if (stages.some((s) => s.length === 0)) return null
  const head = stages[0]

  // Registry lookups: reimplemented as registry HTTP GETs (the "registry-lookup" probe shape).
  if (head[0] === 'npm' && head[1] === 'view' && stages.length === 1) {
    const pkg = head[2] ?? ''
    if (!NPM_PKG_RE.test(pkg)) return null
    if (head.slice(3).some((f) => !/^[a-z][a-z.-]*$/i.test(f))) return null // fields only, no flags
    return {
      kind: 'registry-lookup',
      method: 'GET',
      url: `https://registry.npmjs.org/${pkg}/latest`,
      headers: { accept: 'application/json' },
      body: null,
      followRedirects: true,
      includeHeaders: false,
      expectPattern: '"version"',
      expectFlags: '',
      displayCommand: command.trim(),
    }
  }
  if (head[0] === 'pip' && head[1] === 'index' && head[2] === 'versions' && stages.length === 1) {
    const pkg = head[3] ?? ''
    if (head.length !== 4 || !PIP_PKG_RE.test(pkg)) return null
    return {
      kind: 'registry-lookup',
      method: 'GET',
      url: `https://pypi.org/pypi/${pkg}/json`,
      headers: { accept: 'application/json' },
      body: null,
      followRedirects: true,
      includeHeaders: false,
      expectPattern: '"info"',
      expectFlags: '',
      displayCommand: command.trim(),
    }
  }

  if (head[0] !== 'curl') return null
  for (const stage of stages.slice(1)) {
    if (!SAFE_PIPE_STAGES.has(stage[0])) return null
  }
  const shape = parseCurl(head)
  if (!shape) return null

  const grepStage = stages.slice(1).find((s) => s[0] === 'grep')
  const assertion = grepStage ? grepAssertion(grepStage) : null
  return {
    kind: 'http-fetch',
    ...shape,
    expectPattern: assertion?.pattern ?? null,
    expectFlags: assertion?.flags ?? '',
    displayCommand: command.trim(),
  }
}

// Pin the pass criterion to what the RECORDED proof actually got:
//   - commands that printed response headers (-i/-I): the transcript's last HTTP status line
//     (last = the landing status of an -L redirect chain);
//   - plain GET/HEAD bodies: the recording shows content, which implies a 200;
//   - everything else (e.g. a bare POST whose recorded value was the error body itself):
//     no status assertion — the live run reports what it saw without a pass/fail verdict
//     (unless a grep pattern asserts content).
export function deriveExpectStatus(
  spec: Omit<LiveProbeSpec, 'expectStatus'>,
  transcript: string | null,
): number | null {
  if (spec.includeHeaders && transcript) {
    const matches = [...stripSgr(transcript).matchAll(/^HTTP\/[0-9.]+ +(\d{3})/gm)]
    if (matches.length > 0) return Number(matches[matches.length - 1][1])
  }
  if (!spec.includeHeaders && (spec.method === 'GET' || spec.method === 'HEAD') && spec.body === null) return 200
  return null
}

// ---------------------------------------------------------------------------
// Manifest assembly
// ---------------------------------------------------------------------------

export function buildManifest(dataDir: string = DATA_DIR): LiveProbeEntry[] {
  const entries: LiveProbeEntry[] = []
  const arenas = fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  for (const arena of arenas) {
    for (const proof of loadProofIndex(arena, dataDir)) {
      if (proof.kind !== 'terminal') continue
      const spec = parseProbeCommand(proof.command)
      if (!spec) continue
      const transcript = readProofTranscript(arena, proof as ProofIndexEntry, dataDir)
      entries.push({
        arena,
        productId: proof.productId,
        probeId: proof.probeId,
        ...spec,
        expectStatus: deriveExpectStatus(spec, transcript),
      })
    }
  }
  entries.sort((a, b) =>
    a.arena.localeCompare(b.arena) || a.productId.localeCompare(b.productId) || a.probeId.localeCompare(b.probeId))
  return entries
}

export function workerModuleSource(entries: LiveProbeEntry[]): string {
  const lines = entries.map((e) => {
    const { arena, productId, probeId, ...spec } = e
    return `  ${JSON.stringify(`${arena}/${productId}/${probeId}`)}: ${JSON.stringify(spec)},`
  })
  return [
    '// GENERATED — do not hand-edit. Regenerate with:',
    '//   pnpm tsx pipeline/scripts/generate-live-probe-manifest.ts',
    '//',
    '// The static allowlist behind the worker\'s /api/try/:arena/:product/:probeId route: every',
    '// entry is a recorded keyless proof command (rankings/*/proofs/) that is provably reproducible',
    '// as one worker-native fetch of a fixed public https URL — no shell, no user input, ever.',
    '// `wrangler deploy` bundles this module into worker.js (same committed-allowlist pattern as',
    '// MCP_ENDPOINTS there). Kept byte-identical to rankings/live-probes.json by',
    '// __tests__/try.test.ts.',
    'export const LIVE_PROBES = {',
    ...lines,
    '}',
    '',
  ].join('\n')
}

function main() {
  const entries = buildManifest()
  const jsonPath = path.join(DATA_DIR, 'live-probes.json')
  fs.writeFileSync(jsonPath, JSON.stringify({ probes: entries }, null, 2) + '\n')
  const workerPath = path.join(ROOT, 'infra', 'cloudflare-proxy', 'live-probes.generated.js')
  fs.writeFileSync(workerPath, workerModuleSource(entries))

  const byArena = new Map<string, number>()
  for (const e of entries) byArena.set(e.arena, (byArena.get(e.arena) ?? 0) + 1)
  console.log(`live-probe manifest: ${entries.length} live-capable probes across ${byArena.size} arenas`)
  for (const [arena, n] of [...byArena.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${arena}: ${n}`)
  console.log(`wrote ${path.relative(ROOT, jsonPath)} and ${path.relative(ROOT, workerPath)}`)
}

if (require.main === module) main()
