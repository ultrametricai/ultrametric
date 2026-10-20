// ArenaBench depth types + ladder math — Agentic Depth Program phase 1
// (docs/agentic-depth-program.md §1–§2). The capability ladder is graded per surface from
// recorded transcripts; grading is pure over those transcripts so a replay from disk
// reproduces the report byte-for-byte (rankings-engine/depth/__tests__/depth.test.ts). This module
// is types + arithmetic only: no network, no filesystem.
//
// Structurally separate from the evidence pipeline on purpose: depth results land as dated
// snapshots under open-rankings/experiments/depth/ and touch no evidence/*.json, verdicts, or
// rankings (the program's "never blocks the fast loop" boundary).

// Versioned like PROMPT_VERSION in rankings-engine/stages/judge.ts: a spec change is a visible
// version bump, and old transcripts stay attributed to the version that produced them.
export const ARENABENCH_VERSION = '0.1.0'

export const SURFACES = ['mcp', 'api', 'cli', 'automation', 'human-ai-ux'] as const
export type Surface = (typeof SURFACES)[number]

export type DepthLevel = 1 | 2 | 3 | 4 | 5

// 'auth-gated' records a wall (the check needs credentials/an account we deliberately do not
// have); 'robots-disallowed' records that the host's robots.txt forbade the fetch for our
// user agent. Both are findings, not bypassed.
export type DepthOutcome = 'pass' | 'fail' | 'auth-gated' | 'robots-disallowed' | 'unreachable' | 'skip'

export interface RobotsNote {
  consulted: boolean
  allowed: boolean
  detail: string
}

// One recorded HTTP exchange. `sha256`/`bytes` digest the RAW body as received (same
// convention as cert-report request digests); `body`/`bodyExcerpt` are stored only after
// lib/proofs sanitizeForPublication, the hard no-secrets gate. `digest` carries per-check
// structured summaries of bodies too large to commit (e.g. the OpenAPI spec), computed at
// record time by a deterministic function so grading can replay without the body.
export interface DepthRequestRecord {
  url: string
  method: 'GET' | 'POST'
  requestBody?: string
  /** null = the request never completed (network failure) or was never sent (robots). */
  status: number | null
  contentType: string | null
  bytes: number
  sha256: string | null
  fetchedAt: string
  robots: RobotsNote
  /** Prior hop URLs when the plan URL redirected: every hop passed the robots gate before
   * being fetched, and `url`/`status` describe the final hop. */
  redirectedFrom?: string[]
  /** Allowlisted response headers (lower-cased names), sanitized values. */
  headers?: Record<string, string>
  body?: string
  bodyExcerpt?: string
  digest?: Record<string, unknown>
}

export interface DepthTranscript {
  arenabenchVersion: string
  checkId: string
  target: string
  requests: DepthRequestRecord[]
  /** Set when the check's requests were never issued: a declared wall, recorded as such. */
  notRun?: { outcome: Extract<DepthOutcome, 'auth-gated' | 'skip'>; reason: string }
}

export interface DepthCheckResult {
  checkId: string
  surface: Surface
  level: DepthLevel
  title: string
  outcome: DepthOutcome
  detail: string
  /** Transcript path relative to the report directory. */
  evidence: string
  /** Where the vendor documents this surface/URL (the L1 "documented" citation). */
  docUrl: string
}

export interface SurfaceLadder {
  surface: Surface
  /** Highest level at which every declared check passed keylessly. */
  rung: 0 | DepthLevel
  /** First level where passes mix with walls: verified checks listed next to the gated ones. */
  partial?: {
    level: DepthLevel
    verified: string[]
    unverified: Array<{ checkId: string; outcome: DepthOutcome; detail: string }>
  }
  /** First level where a declared check failed outright. */
  blocked?: { level: DepthLevel; failed: string[] }
  checks: DepthCheckResult[]
}

export interface DepthReport {
  version: 1
  tool: 'arenabench-depth'
  arenabenchVersion: string
  program: string
  phase: string
  target: { productId: string; categoryId: string; vendor: string }
  scope: string
  /** Max fetchedAt across transcripts — derived, so a replay reproduces it exactly. */
  runAt: string
  surfaces: SurfaceLadder[]
  notPiloted: Partial<Record<Surface, string>>
  /** robots.txt recordings consulted by the run, one per origin. */
  robotsTranscripts: string[]
}

const FAIL_OUTCOMES: ReadonlySet<DepthOutcome> = new Set(['fail', 'unreachable'])

// Rung semantics: walk L1..L5; a level counts as verified only when every check declared at
// that level passed. A failure (or an unreachable surface) blocks the ladder there; recorded
// walls — auth-gated checks and robots-disallowed fetches — stop the climb but are reported
// as `partial` so "2/3 structural checks pass, the third is auth-gated" is visible instead of
// averaged away. A wall is a doctrine boundary we record, not an observed protocol failure.
// Levels with no declared checks end the walk.
export function computeSurfaceLadder(surface: Surface, results: DepthCheckResult[]): SurfaceLadder {
  const mine = results.filter((r) => r.surface === surface)
  const ladder: SurfaceLadder = { surface, rung: 0, checks: mine }
  for (const level of [1, 2, 3, 4, 5] as const) {
    const at = mine.filter((r) => r.level === level)
    if (at.length === 0) break
    const failed = at.filter((r) => FAIL_OUTCOMES.has(r.outcome))
    if (failed.length > 0) {
      ladder.blocked = { level, failed: failed.map((r) => r.checkId) }
      break
    }
    const passed = at.filter((r) => r.outcome === 'pass')
    if (passed.length === at.length) {
      ladder.rung = level
      continue
    }
    ladder.partial = {
      level,
      verified: passed.map((r) => r.checkId),
      unverified: at
        .filter((r) => r.outcome !== 'pass')
        .map((r) => ({ checkId: r.checkId, outcome: r.outcome, detail: r.detail })),
    }
    break
  }
  return ladder
}
