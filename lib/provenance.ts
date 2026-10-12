import { createHash, createHmac } from 'node:crypto'
import type { Rankings } from './schemas'

// Provenance watermark for the published dataset files (rankings/{category}/rankings.json, which
// is also what the /data API and the MCP servers serve verbatim). The HMAC key below is a
// committed constant, NOT a secret: the point isn't to hide anything, it's that a republished
// copy of our data carries a fingerprint only our exact bytes produce. Anyone (including us,
// against a suspected copy) can recompute HMAC(key, arenaId + "\n" + sha256(content)) and check
// it matches — see pipeline/scripts/verify-provenance.ts. Everything here is a pure function of
// the rankings content + arena id, so pipeline/scripts/recompute-check.ts stays deterministic.
// Legacy-named from the pre-rebrand ProductArena era ON PURPOSE: this string is the HMAC key,
// so renaming it would invalidate the fingerprint on every published dataset file.
export const PROVENANCE_KEY = 'productarena-provenance-v1'
export const PROVENANCE_OWNER = 'Ultrametric Inc'
export const PROVENANCE_LICENSE = 'see DATA-LICENSE'
// Deliberately NOT lib/site.ts's SITE_URL: that reads NEXT_PUBLIC_SITE_URL, and the watermark
// written into committed data files must not vary with the build environment.
export const PROVENANCE_SOURCE = 'https://ultrametric.ai'
const FINGERPRINT_HEX_CHARS = 32 // truncated SHA-256 HMAC — 128 bits is plenty for a watermark

export interface Provenance {
  owner: string
  license: string
  source: string
  arena: string
  fingerprint: string
}

// Canonical JSON: recursively key-sorted, no whitespace. Makes the fingerprint independent of
// key order and formatting, so a copy that survives a parse/re-serialize round trip still
// verifies (and a single changed score does not).
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const entries = Object.keys(record)
      .sort()
      .filter((k) => record[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

// HMAC(committed key, arenaId + "\n" + sha256(canonical rankings content)), truncated. The
// `_provenance` object itself is excluded from the hashed content so stamping is idempotent.
export function computeFingerprint(arenaId: string, rankings: unknown): string {
  const { _provenance: _ignored, ...content } = rankings as Record<string, unknown>
  const contentHash = createHash('sha256').update(canonicalJson(content)).digest('hex')
  return createHmac('sha256', PROVENANCE_KEY)
    .update(`${arenaId}\n${contentHash}`)
    .digest('hex')
    .slice(0, FINGERPRINT_HEX_CHARS)
}

export function buildProvenance(arenaId: string, rankings: unknown): Provenance {
  return {
    owner: PROVENANCE_OWNER,
    license: PROVENANCE_LICENSE,
    source: PROVENANCE_SOURCE,
    arena: arenaId,
    fingerprint: computeFingerprint(arenaId, rankings),
  }
}

// Returns the rankings with `_provenance` stamped (replacing any existing stamp). Key order
// (generatedAt, leaderboard, battles, _provenance) matches RankingsSchema's shape order so
// recompute-check's JSON.stringify comparison sees identical strings.
export function attachProvenance(arenaId: string, rankings: Rankings): Rankings {
  const { _provenance: _ignored, ...content } = rankings
  return { ...content, _provenance: buildProvenance(arenaId, rankings) }
}

export interface ProvenanceCheck {
  ok: boolean
  arena: string | null
  expected: string | null // what the file's content should fingerprint to
  actual: string | null // what the file claims
}

// Verifies a parsed JSON payload (ours, or a suspected copy) against its embedded watermark.
// `arenaId` overrides the embedded `_provenance.arena` when the copy stripped/renamed it.
export function verifyProvenance(json: unknown, arenaId?: string): ProvenanceCheck {
  const provenance =
    json !== null && typeof json === 'object' ? ((json as Record<string, unknown>)._provenance as Partial<Provenance> | undefined) : undefined
  const arena = arenaId ?? (typeof provenance?.arena === 'string' ? provenance.arena : null)
  const actual = typeof provenance?.fingerprint === 'string' ? provenance.fingerprint : null
  if (arena === null) return { ok: false, arena: null, expected: null, actual }
  const expected = computeFingerprint(arena, json)
  return { ok: actual !== null && actual === expected, arena, expected, actual }
}

// One-line provenance notice embedded as a comment header in text outputs (llms.txt, llms.md,
// feed.xml). Contains no `--`, so it's safe inside an XML/HTML comment.
export function provenanceLine(fingerprint?: string): string {
  const base = `© ${PROVENANCE_OWNER} · license: ${PROVENANCE_LICENSE} · source: ${PROVENANCE_SOURCE} · terms: ${PROVENANCE_SOURCE}/terms`
  return fingerprint ? `${base} · fingerprint: ${fingerprint}` : base
}
