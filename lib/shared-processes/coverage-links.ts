export function vendorEvidenceHref(href: string | null, storyIds: readonly string[]) {
  const stories = [...new Set(storyIds)]
  if (!href || !stories.length) return undefined
  return `${href}#${stories.length === 1 ? `story-${stories[0]}` : 'story-verdicts'}`
}
