// The depth runner: executes a target's check plans against the live network ONCE, recording
// every exchange as a sanitized transcript, then grades purely from those transcripts. The
// grade step is shared with `--replay` and the unit tests, so a committed pilot regrades to
// the identical report with no network. Network access goes through the same injectable
// fetcher shape as pipeline/scripts/certify.ts.
//
// Evidence doctrine mechanics:
//   - robots.txt is absolute: each origin's robots.txt is fetched once, recorded as its own
//     transcript, and any disallowed GET is recorded as 'robots-disallowed', never sent;
//   - auth walls are recorded, never bypassed: no credentials exist in this process, and
//     declared-wall checks never issue requests at all;
//   - every stored body/header value passes lib/proofs sanitizeForPublication (the hard
//     no-secrets gate); sha256/bytes digest the raw body as received.

import { createHash } from 'node:crypto'
import { sanitizeForPublication } from '../../lib/proofs'
import type { CertifyFetcher } from '../scripts/certify'
import {
  ARENABENCH_VERSION,
  computeSurfaceLadder,
  type DepthCheckResult,
  type DepthReport,
  type DepthRequestRecord,
  type DepthTranscript,
  type RobotsNote,
  type Surface,
} from './arenabench'
import { NOT_PILOTED, type DepthCheckDef, type DepthRequestPlan, type DepthTarget } from './checks'
import { robotsAllows } from './robots'

export const DEPTH_USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric-Depth/0.1; +https://ultrametric.ai)'
export const DEPTH_UA_TOKEN = 'ultrametric-depth'
const FETCH_TIMEOUT_MS = 20_000

/** Full bodies at or under this size are committed in the transcript; larger ones keep an
 * excerpt plus any per-check digest. */
export const BODY_INLINE_MAX_BYTES = 32_768
export const BODY_EXCERPT_CHARS = 1_200

const HEADER_ALLOWLIST = [
  'content-type',
  'content-length',
  'www-authenticate',
  'stripe-version',
  'request-id',
  'x-robots-tag',
  'retry-after',
  'ratelimit-limit',
  'x-ratelimit-limit',
  'allow',
] as const

export const defaultDepthFetcher: CertifyFetcher = async (url, init = {}) => {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { 'User-Agent': DEPTH_USER_AGENT, ...init.headers },
    body: init.body,
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const body = await res.text()
  const headers: Record<string, string> = {}
  res.headers.forEach((value, name) => {
    headers[name.toLowerCase()] = value
  })
  return { status: res.status, contentType: res.headers.get('content-type'), body, headers }
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function sanitizeField(raw: string): string {
  return raw === '' ? '' : sanitizeForPublication(raw).trimEnd()
}

function isTextual(contentType: string | null): boolean {
  const ct = (contentType ?? '').toLowerCase()
  return ct === '' || ct.includes('json') || ct.startsWith('text/') || ct.includes('xml') || ct.includes('event-stream')
}

// ---------------------------------------------------------------------------
// robots gate — one recorded robots.txt per origin, decisions absolute.
// ---------------------------------------------------------------------------

export interface RobotsGate {
  /** Decide whether a GET of `url` is allowed; fetches + records the origin's robots.txt on
   * first contact. */
  decide(url: string): Promise<RobotsNote>
  transcripts(): DepthTranscript[]
}

export function makeRobotsGate(fetcher: CertifyFetcher, now: () => string, targetId: string): RobotsGate {
  const byOrigin = new Map<string, { body: string | null; transcript: DepthTranscript }>()
  async function originEntry(origin: string) {
    const cached = byOrigin.get(origin)
    if (cached) return cached
    const url = `${origin}/robots.txt`
    const host = new URL(origin).hostname
    let record: DepthRequestRecord
    let body: string | null = null
    const robotsNote: RobotsNote = { consulted: false, allowed: true, detail: 'robots.txt fetch is itself exempt' }
    try {
      const res = await fetcher(url)
      if (res.status === 200) body = res.body
      record = {
        url,
        method: 'GET',
        status: res.status,
        contentType: res.contentType,
        bytes: Buffer.byteLength(res.body),
        sha256: sha256Hex(res.body),
        fetchedAt: now(),
        robots: robotsNote,
        body: Buffer.byteLength(res.body) <= BODY_INLINE_MAX_BYTES ? sanitizeField(res.body) : undefined,
        bodyExcerpt: Buffer.byteLength(res.body) > BODY_INLINE_MAX_BYTES ? sanitizeField(res.body.slice(0, BODY_EXCERPT_CHARS)) : undefined,
      }
    } catch {
      record = {
        url,
        method: 'GET',
        status: null,
        contentType: null,
        bytes: 0,
        sha256: null,
        fetchedAt: now(),
        robots: robotsNote,
      }
    }
    const entry = {
      body,
      transcript: {
        arenabenchVersion: ARENABENCH_VERSION,
        checkId: `robots-${host.replace(/\./g, '-')}`,
        target: targetId,
        requests: [record],
      },
    }
    byOrigin.set(origin, entry)
    return entry
  }
  return {
    async decide(url: string): Promise<RobotsNote> {
      const u = new URL(url)
      const entry = await originEntry(u.origin)
      // No robots.txt (non-200 or unreachable) leaves everything allowed.
      if (entry.body === null) {
        return { consulted: true, allowed: true, detail: `no robots.txt at ${u.origin}` }
      }
      const decision = robotsAllows(entry.body, u.pathname + u.search, DEPTH_UA_TOKEN)
      return { consulted: true, allowed: decision.allowed, detail: decision.detail }
    },
    transcripts() {
      return [...byOrigin.values()].map((e) => e.transcript).sort((a, b) => a.checkId.localeCompare(b.checkId))
    },
  }
}

// ---------------------------------------------------------------------------
// Recording.
// ---------------------------------------------------------------------------

async function recordRequest(
  plan: DepthRequestPlan,
  fetcher: CertifyFetcher,
  robotsGate: RobotsGate,
  now: () => string,
): Promise<DepthRequestRecord> {
  const robots: RobotsNote = plan.robotsApplies
    ? await robotsGate.decide(plan.url)
    : { consulted: false, allowed: true, detail: 'protocol request, robots.txt not applicable' }
  const base: DepthRequestRecord = {
    url: plan.url,
    method: plan.method,
    requestBody: plan.body,
    status: null,
    contentType: null,
    bytes: 0,
    sha256: null,
    fetchedAt: now(),
    robots,
  }
  if (!robots.allowed) return base // recorded, never fetched
  let res: Awaited<ReturnType<CertifyFetcher>>
  try {
    res = await fetcher(plan.url, { method: plan.method, headers: plan.headers, body: plan.body })
  } catch {
    return base // network failure: status stays null
  }
  const bytes = Buffer.byteLength(res.body)
  const headers: Record<string, string> = {}
  for (const name of HEADER_ALLOWLIST) {
    if (res.headers[name] !== undefined) headers[name] = sanitizeField(res.headers[name])
  }
  const record: DepthRequestRecord = {
    ...base,
    status: res.status,
    contentType: res.contentType,
    bytes,
    sha256: sha256Hex(res.body),
    headers,
  }
  if (isTextual(res.contentType) && bytes <= BODY_INLINE_MAX_BYTES) {
    record.body = sanitizeField(res.body)
  } else if (isTextual(res.contentType)) {
    record.bodyExcerpt = sanitizeField(res.body.slice(0, BODY_EXCERPT_CHARS))
  }
  if (plan.digest && res.status === 200) record.digest = plan.digest(res.body, plan.url)
  return record
}

export async function recordCheck(
  def: DepthCheckDef,
  targetId: string,
  fetcher: CertifyFetcher,
  robotsGate: RobotsGate,
  now: () => string,
): Promise<DepthTranscript> {
  const transcript: DepthTranscript = {
    arenabenchVersion: ARENABENCH_VERSION,
    checkId: def.id,
    target: targetId,
    requests: [],
  }
  if (def.wall) {
    transcript.notRun = { outcome: def.wall.outcome, reason: def.wall.reason }
    return transcript
  }
  for (const plan of def.requests) {
    const record = await recordRequest(plan, fetcher, robotsGate, now)
    transcript.requests.push(record)
    if (plan.stopOnStatus !== undefined && record.status === plan.stopOnStatus) break
  }
  return transcript
}

// ---------------------------------------------------------------------------
// Grading + report assembly (pure; shared by live runs, --replay, and tests).
// ---------------------------------------------------------------------------

export function gradeCheck(def: DepthCheckDef, transcript: DepthTranscript): DepthCheckResult {
  const graded = transcript.notRun
    ? { outcome: transcript.notRun.outcome, detail: transcript.notRun.reason }
    : def.grade(transcript)
  return {
    checkId: def.id,
    surface: def.surface,
    level: def.level,
    title: def.title,
    outcome: graded.outcome,
    detail: graded.detail,
    evidence: `transcripts/${def.id}.json`,
    docUrl: def.docUrl,
  }
}

export function buildReport(
  target: DepthTarget,
  transcripts: Map<string, DepthTranscript>,
  robotsTranscripts: DepthTranscript[],
): DepthReport {
  const results = target.checks.map((def) => {
    const t = transcripts.get(def.id)
    if (!t) throw new Error(`missing transcript for check ${def.id}`)
    return gradeCheck(def, t)
  })
  const pilotedSurfaces = [...new Set(target.checks.map((c) => c.surface))] as Surface[]
  const fetchedAts = [...transcripts.values(), ...robotsTranscripts]
    .flatMap((t) => t.requests.map((r) => r.fetchedAt))
    .sort()
  return {
    version: 1,
    tool: 'arenabench-depth',
    arenabenchVersion: ARENABENCH_VERSION,
    program: 'docs/AGENTIC-DEPTH-PROGRAM.md',
    phase: 'phase-1-pilot',
    target: { productId: target.productId, categoryId: target.categoryId, vendor: target.vendor },
    scope:
      'credential-free public surfaces only: no account creation, no credentials, no payments; robots.txt absolute; auth walls recorded, never bypassed',
    runAt: fetchedAts[fetchedAts.length - 1] ?? '',
    surfaces: pilotedSurfaces.map((s) => computeSurfaceLadder(s, results)),
    notPiloted: NOT_PILOTED,
    robotsTranscripts: robotsTranscripts.map((t) => `transcripts/${t.checkId}.json`),
  }
}

export interface DepthRun {
  report: DepthReport
  transcripts: DepthTranscript[]
}

export async function runDepth(
  target: DepthTarget,
  opts: { fetcher?: CertifyFetcher; now?: () => string } = {},
): Promise<DepthRun> {
  const fetcher = opts.fetcher ?? defaultDepthFetcher
  const now = opts.now ?? (() => new Date().toISOString())
  const robotsGate = makeRobotsGate(fetcher, now, target.productId)
  const transcripts = new Map<string, DepthTranscript>()
  for (const def of target.checks) {
    transcripts.set(def.id, await recordCheck(def, target.productId, fetcher, robotsGate, now))
  }
  const robotsTranscripts = robotsGate.transcripts()
  return {
    report: buildReport(target, transcripts, robotsTranscripts),
    transcripts: [...transcripts.values(), ...robotsTranscripts],
  }
}
