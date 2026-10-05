// Decorative external-link mark; the link label remains the accessible name.
export default function ExternalLinkMark({ href, label }: { href: string; label: string }) {
  let external = false
  try {
    const url = new URL(href, 'https://ultrametric.ai')
    external = ['https:', 'http:'].includes(url.protocol) && !['ultrametric.ai', 'www.ultrametric.ai'].includes(url.hostname)
  } catch { return null }
  return external && !label.trimEnd().endsWith('↗') ? <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="ml-1 inline-block h-3.5 w-3.5 align-[-0.125em]"><path d="M15 3h6v6M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg> : null
}
