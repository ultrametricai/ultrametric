import type { Option, SharedRecord } from './schema'
import { previewContext } from './preview-context'

export function isGeographicOption(option: Option) {
  const context = option.metadata.context
  return !!context && typeof context === 'object' && !Array.isArray(context)
    && (context as Record<string, unknown>).kind === 'geo'
}

export function regionalDecision(record: SharedRecord) {
  const decisions = record.parts.filter(part => part.kind === 'decision' && part.options.some(isGeographicOption))
  // No inferred propagation across multiple independent decisions.
  if (decisions.length !== 1 || !decisions[0].options.some(option => option.id === 'default')) return undefined
  const part = decisions[0]
  return { scope: `${record.id}:${part.id}`, title: part.title ?? part.id,
    options: part.options.filter(option => option.id === 'default' || isGeographicOption(option)).map(option => {
      const context = option.metadata.context as { countries?: unknown } | undefined
      const source = option.id === 'default' ? [record.metadata.geoScope] : context?.countries
      const countries = Array.isArray(source) ? source.filter((country): country is string => typeof country === 'string' && /^[a-z]{2}$/i.test(country)).map(country => country.toUpperCase()) : []
      // Unbound surrounding steps remain on their original path. A part explicitly
      // bound to this decision is either hidden or reviewed for its selected option.
      const hasUnadaptedSteps = option.id !== 'default' && record.parts.some(other => other.id !== part.id && previewContext(other.metadata)?.decision !== part.id)
      // These are the same subtrees unmounted by RegionalOption and PreviewScope.
      // Descendant anchors inherit their containing scope's availability.
      const hiddenScopes = [
        ...part.options.filter(other => (other.id === 'default' || isGeographicOption(other)) && other.id !== option.id).map(other => `${record.id}:${part.id}:${other.id}`),
        ...record.parts.filter(other => { const context = previewContext(other.metadata); return context?.decision === part.id && context.option !== option.id }).map(other => `${record.id}:${other.id}`),
      ]
      return { id: option.id, title: option.title, countries, hasUnadaptedSteps, hiddenScopes }
    }),
  }
}
