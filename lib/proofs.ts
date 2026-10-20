import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

// Replayable probe recordings ("proofs") — transcripts/videos captured by the probe-record
// pipeline stage (rankings-engine/stages/probe-record.ts) so a verdict's probe-tier evidence comes
// with something a human can watch, not just a citation.
//
// Proof metadata deliberately lives HERE, in sidecar JSON files + a per-category index, and
// NOT in lib/schemas.ts — the evidence schema is owned by another lane; folding proofs into
// Evidence is phase 2 of docs/prove-it.md. Layout on disk:
//
//   open-rankings/<category>/proofs/<productId>/<probeId>.txt    plain sanitized transcript
//   open-rankings/<category>/proofs/<productId>/<probeId>.webm   browser recording (kind: 'video')
//   open-rankings/<category>/proofs/<productId>/<probeId>.json   sidecar (ProofSidecarSchema)
//   open-rankings/<category>/proofs/index.json                   ProofIndexSchema (adds productId/file)

export const ProofSidecarSchema = z.object({
  probeId: z.string(),
  storyIds: z.array(z.string()),
  command: z.string(),
  recordedAt: z.string(),
  exitCode: z.number(),
  kind: z.enum(['terminal', 'video']),
})
export type ProofSidecar = z.infer<typeof ProofSidecarSchema>

// Index entries are the sidecar plus the two fields a listing needs without opening each
// sidecar: which product the proof belongs to and where the artifact lives (path relative to
// the category's proofs/ dir, e.g. "claude-code/mcp-handshake.txt").
export const ProofIndexEntrySchema = ProofSidecarSchema.extend({
  productId: z.string(),
  file: z.string(),
})
export type ProofIndexEntry = z.infer<typeof ProofIndexEntrySchema>

export const ProofIndexSchema = z.object({
  generatedAt: z.string(),
  proofs: z.array(ProofIndexEntrySchema),
})
export type ProofIndex = z.infer<typeof ProofIndexSchema>

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')

export function proofsDir(categoryId: string, dir: string = DEFAULT_DIR()): string {
  return path.join(dir, categoryId, 'proofs')
}

// Same optional-file contract as popularity/claims in lib/data.ts: a category that has never
// been through probe-record simply has no proofs ([]), never an error.
export function loadProofIndex(categoryId: string, dir: string = DEFAULT_DIR()): ProofIndexEntry[] {
  const file = path.join(proofsDir(categoryId, dir), 'index.json')
  if (!fs.existsSync(file)) return []
  return ProofIndexSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).proofs
}

export function proofsForProduct(categoryId: string, productId: string, dir: string = DEFAULT_DIR()): ProofIndexEntry[] {
  return loadProofIndex(categoryId, dir).filter((p) => p.productId === productId)
}

// Every recorded proof site-wide, grouped by category — the /proofs theater's data source
// (app/proofs/page.tsx). Walks open-rankings/*/proofs/index.json directly off the filesystem rather
// than going through loadAll(): proofs are sidecar files with their own optional-file
// contract, so a category needs no open-rankings/verdicts to have its recordings listed. Sorted
// by categoryId for a stable build output; categories without a single proof are omitted.
export interface CategoryProofs {
  categoryId: string
  proofs: ProofIndexEntry[]
}

export function collectSiteProofs(dir: string = DEFAULT_DIR()): CategoryProofs[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ categoryId: d.name, proofs: loadProofIndex(d.name, dir) }))
    .filter((g) => g.proofs.length > 0)
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId))
}

// Terminal transcripts are read server-side and rendered inline; video files are served as
// static assets from the /data mirror instead (see components/ProofBlock.tsx). Missing or
// non-terminal entries resolve to null, never an error — a stale index must not 500 a page.
export function readProofTranscript(categoryId: string, entry: ProofIndexEntry, dir: string = DEFAULT_DIR()): string | null {
  if (entry.kind !== 'terminal') return null
  const file = path.join(proofsDir(categoryId, dir), entry.file)
  if (!path.resolve(file).startsWith(path.resolve(proofsDir(categoryId, dir)) + path.sep)) return null
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file, 'utf8')
}

// ---------------------------------------------------------------------------
// Transcript sanitization — shared by the recorder (pipeline) and unit-tested here.
// ---------------------------------------------------------------------------

// BSD `script` transcripts are raw pty captures: CRLF line endings, echoed control characters
// (^D, backspaces), cursor/OSC escape sequences. Keep SGR color sequences (ESC[...m) so the
// site can render colors later; strip everything else.
export function sanitizeTranscript(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // Apply backspaces the way a terminal would (delete the char before), then drop leading ones.
  while (/[^\n\x08]\x08/.test(s)) s = s.replace(/[^\n\x08]\x08/g, '')
  s = s.replace(/\x08+/g, '')
  // OSC sequences (title set etc.): ESC ] ... BEL | ESC \
  s = s.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
  // CSI sequences: keep SGR (final byte "m"), strip the rest (cursor moves, clears, modes).
  s = s.replace(/\x1b\[([0-9;?]*)([A-Za-z])/g, (m, _p, final: string) => (final === 'm' ? m : ''))
  // Any other escapes (ESC + single char) and remaining C0 controls except \n and \t.
  // The lookahead protects the SGR color sequences the CSI pass above chose to keep.
  s = s.replace(/\x1b(?!\[[0-9;]*m)[@-Z\\-_]?/g, '')
  // (0x1b excluded from the range — surviving ESCs all belong to kept SGR sequences.)
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1a\x1c-\x1f\x7f]/g, '')
  return s.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// Anything that looks like a secret VALUE gets replaced first (so "Bearer abc..." never
// survives), keeping surrounding prose readable.
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{4,}/g,
  /\b(?:api[-_ ]?key|token|secret|password|passwd|bearer|authorization|credential)s?\b\s*[:=]\s*\S+/gi,
]

// The hard gate from the recording spec: a written transcript must NEVER contain a string
// matching this pattern. Prose hits (the word "key" in help text) are redacted too — better a
// mangled help line than a leaked credential.
export const FORBIDDEN_SECRET_PATTERN = /sk-|key|token/i

export function redactSecrets(s: string): string {
  let out = s
  for (const p of SECRET_VALUE_PATTERNS) out = out.replace(p, '[redacted]')
  out = out.replace(/sk-|key|token/gi, '[redacted]')
  return out
}

export function containsForbiddenSecretPattern(s: string): boolean {
  return FORBIDDEN_SECRET_PATTERN.test(s)
}

// One call for the recorder: sanitize, redact, and hard-assert the result is publishable.
export function sanitizeForPublication(raw: string): string {
  const clean = redactSecrets(sanitizeTranscript(raw))
  if (containsForbiddenSecretPattern(clean)) {
    throw new Error('transcript still matches the forbidden secret pattern after redaction — refusing to write')
  }
  return clean
}
