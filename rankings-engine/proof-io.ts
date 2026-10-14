import fs from 'node:fs'
import path from 'node:path'
import {
  ProofIndexSchema,
  sanitizeForPublication,
  type ProofIndexEntry,
} from '../lib/proofs'
import { categoryDir } from './paths'

// Shared disk layer for proof recordings (see lib/proofs.ts for the on-disk layout). Used by
// the probe-record stage (terminal transcripts) and pipeline/scripts/record-browser-proof.ts
// (video sidecars) so both write the same sidecar + index shape.

export function proofsDirFor(categoryId: string): string {
  return path.join(categoryDir(categoryId), 'proofs')
}

// Writes the artifact + its sidecar. `content` (terminal transcripts) is passed through
// sanitizeForPublication — the hard no-secrets gate — before touching disk; `copyFrom`
// (binary video files) is copied verbatim.
export function writeProofArtifact(
  categoryId: string,
  entry: ProofIndexEntry,
  source: { content: string } | { copyFrom: string },
): void {
  const dir = proofsDirFor(categoryId)
  const artifact = path.join(dir, entry.file)
  fs.mkdirSync(path.dirname(artifact), { recursive: true })
  if ('content' in source) {
    fs.writeFileSync(artifact, sanitizeForPublication(source.content))
  } else {
    fs.copyFileSync(source.copyFrom, artifact)
  }
  const sidecar = {
    probeId: entry.probeId,
    storyIds: entry.storyIds,
    command: entry.command,
    recordedAt: entry.recordedAt,
    exitCode: entry.exitCode,
    kind: entry.kind,
  }
  const sidecarFile = artifact.replace(/\.[^.]+$/, '.json')
  fs.writeFileSync(sidecarFile, JSON.stringify(sidecar, null, 2) + '\n')
}

// Regenerate-in-place semantics (same pattern as probe.ts's replace-prior-tier): entries for
// the same (productId, probeId) are replaced, everything else in the index survives — so the
// terminal recorder and the browser recorder can each refresh their own proofs.
export function upsertProofIndex(categoryId: string, entries: ProofIndexEntry[]): void {
  const file = path.join(proofsDirFor(categoryId), 'index.json')
  const existing = fs.existsSync(file)
    ? ProofIndexSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).proofs
    : []
  const replaced = new Set(entries.map((e) => `${e.productId}:${e.probeId}`))
  const merged = [...existing.filter((e) => !replaced.has(`${e.productId}:${e.probeId}`)), ...entries].sort(
    (a, b) => a.productId.localeCompare(b.productId) || a.probeId.localeCompare(b.probeId),
  )
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), proofs: merged }, null, 2) + '\n')
}
