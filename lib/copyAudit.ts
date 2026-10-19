// The copy audit behind /admin (founder ask 2026-09-29: "give me a /admin where I can see all
// the examples of stuff that is superfluous"). open-rankings/copy-audit.json is a CURATED, hand-ranked
// sweep of user-visible prose — intros, explainers, tooltips, eyebrows, legends, empty states,
// stat clutter — each with a cut/tighten/keep suggestion and a one-line why. 'keep' entries are
// the honesty/legal floor (affiliation disclosures, absence-of-evidence framing, licensing,
// liability): they are listed so nobody "cleans" them up by accident. Zod-validated at load;
// structural invariants (unique ids, files exist, routes well-formed) live in
// lib/__tests__/copyAudit.test.ts. Review list only — nothing here feeds any score or page copy.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

export const COPY_AUDIT_KINDS = [
  'intro',
  'explainer',
  'tooltip',
  'eyebrow',
  'legend',
  'empty-state',
  'stat-clutter',
  'disclosure',
] as const

export const COPY_AUDIT_SUGGESTIONS = ['cut', 'tighten', 'keep'] as const

export const CopyAuditCandidateSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case id'),
  // The URL where the copy renders (route pattern, e.g. /arena/[category]/report).
  route: z.string().regex(/^\/[a-zA-Z0-9\-_/[\]]*$/, 'route must be a well-formed path'),
  // Repo-relative source location, as text — the founder reads it and fires an ask from it.
  file: z.string().regex(/^(app|components)\/.+\.tsx$/),
  line: z.number().int().positive(),
  kind: z.enum(COPY_AUDIT_KINDS),
  // First ~200 chars of the candidate copy, whitespace-normalized (eyebrows are micro-copy,
  // so the floor is low).
  excerpt: z.string().min(5).max(300),
  suggestion: z.enum(COPY_AUDIT_SUGGESTIONS),
  // One line. For 'keep': the honesty/legal reason it must stay.
  why: z.string().min(8).max(200),
})

export const CopyAuditFileSchema = z.object({
  version: z.literal(1),
  auditedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  candidates: CopyAuditCandidateSchema.array().min(1),
})

export type CopyAuditCandidate = z.infer<typeof CopyAuditCandidateSchema>
export type CopyAudit = z.infer<typeof CopyAuditFileSchema>
export type CopyAuditKind = (typeof COPY_AUDIT_KINDS)[number]
export type CopyAuditSuggestion = (typeof COPY_AUDIT_SUGGESTIONS)[number]

const DEFAULT_FILE = () => path.join(process.cwd(), 'open-rankings', 'copy-audit.json')
let cache: { file: string; audit: CopyAudit } | null = null

export function loadCopyAudit(file: string = DEFAULT_FILE()): CopyAudit {
  if (cache && cache.file === file) return cache.audit
  const audit = CopyAuditFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
  cache = { file, audit }
  return audit
}

// Headline counts for the '/admin' header: N candidates · M cut / K tighten / J keep.
export function copyAuditCounts(audit: CopyAudit): {
  total: number
  cut: number
  tighten: number
  keep: number
  byKind: Record<CopyAuditKind, number>
} {
  const byKind = Object.fromEntries(COPY_AUDIT_KINDS.map((k) => [k, 0])) as Record<CopyAuditKind, number>
  let cut = 0
  let tighten = 0
  let keep = 0
  for (const c of audit.candidates) {
    byKind[c.kind] += 1
    if (c.suggestion === 'cut') cut += 1
    else if (c.suggestion === 'tighten') tighten += 1
    else keep += 1
  }
  return { total: audit.candidates.length, cut, tighten, keep, byKind }
}
