import { readSharedCatalog } from './reader'
import type { Part, SharedRecord } from './schema'

// Committed per-step descriptions for the CORPUS process pages (founder 2026-10-05: steps like
// 'Set primary logo' rendered with no description while the /processes/preview pages carry
// per-part guidance). The source is the shared catalog (content/processes/records/*.json):
// every corpus task has a shared record, and the record parts whose id matches a corpus DAG
// node id (n1, n2, …) carry that step's authored guidance — their metadata mirrors the node's
// own fields, which is the binding. NOTHING is invented here: a node whose record part has no
// guidance (or no matching part at all) simply gets no description, and the text rendered is
// the committed guidance verbatim minus markdown markers (display cleaning only).
//
// Read-only over the catalog — the site keeps its corpus loaders; this is the additive reader
// the content/processes README describes (lib/shared-processes/load.ts, opt-in).

let catalogCache: SharedRecord[] | null = null
function catalog(): SharedRecord[] {
  if (catalogCache === null) catalogCache = readSharedCatalog()
  return catalogCache
}

const taskCache = new Map<string, Record<string, string>>()

function collectParts(parts: Part[], into: Map<string, Part>): void {
  for (const part of parts) {
    // First match wins — top-level parts (the node-bound ones) come before option-nested parts.
    if (!into.has(part.id)) into.set(part.id, part)
    for (const option of part.options) collectParts(option.parts, into)
  }
}

/**
 * Committed guidance by DAG node id for one corpus task — {} when the task has no shared
 * record or none of its parts both match a node id and carry guidance.
 */
export function stepGuidanceForTask(taskId: string): Record<string, string> {
  const cached = taskCache.get(taskId)
  if (cached) return cached
  const record = catalog().find((r) => r.id === taskId || r.aliases?.includes(taskId))
  const result: Record<string, string> = {}
  if (record) {
    const parts = new Map<string, Part>()
    collectParts(record.parts, parts)
    for (const [id, part] of parts) {
      const guidance = part.guidance?.trim()
      if (guidance) result[id] = guidance
    }
  }
  taskCache.set(taskId, result)
  return result
}

/** One node's committed guidance, or null — the ProcessDag step-block call. */
export function stepGuidanceFor(taskId: string, nodeId: string): string | null {
  return stepGuidanceForTask(taskId)[nodeId] ?? null
}

/**
 * Display cleaning ONLY (never a rewrite): the committed guidance is Markdown-ish prose; the
 * step blocks render plain text. Splits on blank lines into paragraphs, folds a paragraph's
 * internal newlines (bullet lines become `· ` items), and strips the `**`/`` ` `` markers.
 */
export function guidanceParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => line.replace(/^\s*-\s+/, '· ').trim())
        .filter((line) => line !== '')
        .join(' ')
        .replace(/\*\*/g, '')
        .replace(/`/g, ''),
    )
    .filter((p) => p !== '')
}
