/** Presentation-only binding, not a canonical API/MCP instruction contract.
 * A future typed instruction model must handle applicability and confirmed responsibility.
 * Provider choice here never confirms handling or completion. */
export interface PreviewContext {
  /** Local decision part ID in this record (e.g. n4). */
  decision: string
  /** Authored option ID (e.g. default); no inferred country propagation. */
  option: string
}

export interface PreviewBrief {
  /** Exact vendor reference ID, resolved through the existing candidate catalog. */
  vendor: string
  /** Authored conditional guidance, never a claim of completed provider handling. */
  guidance: string
}

// Optional source metadata keys used by the preview reader:
// part.metadata.previewContext: PreviewContext gates that part's default-scope
// presentation (including its guidance and metadata) under the named decision.
// part.metadata.previewBriefs: PreviewBrief[] replaces guidance only for a matching
// selected vendor in that process. Without a match, part.guidance remains visible.
// Option.summary remains bound to its own option. No new completion/handling state
// is inferred from provider selection; those instructions must stay conditional.

export function previewContext(metadata: Record<string, unknown>): PreviewContext | undefined {
  const value = metadata.previewContext
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const { decision, option } = value as Record<string, unknown>
  return typeof decision === 'string' && typeof option === 'string' ? { decision, option } : undefined
}

export function previewBriefs(metadata: Record<string, unknown>): PreviewBrief[] {
  const values = metadata.previewBriefs
  return Array.isArray(values) ? values.flatMap(value => value && typeof value === 'object' && typeof value.vendor === 'string' && typeof value.guidance === 'string' ? [{ vendor: value.vendor, guidance: value.guidance }] : []) : []
}
