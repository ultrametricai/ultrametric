import { REPO } from '@/lib/site'

// The ⚑ flag link's prefilled-GitHub-issue URL, shared by ContestLink (rendered next to every
// verdict on battle/vs/product pages) and RowMenu (the product table's row menu).
//
// `.github/ISSUE_TEMPLATE/flag-verdict.yml` is a GitHub issue FORM, and forms are prefilled
// per-field via query params keyed by each field's `id` (category, product, story-id,
// current-verdict) — GitHub ignores the legacy `body` param for form templates. The previous
// URL carried a ~600-byte markdown `body` that was therefore dead weight: it never prefilled
// anything, and with two of these links in every judged round it accounted for ~5-9% of every
// prerendered battle/vs artifact (docs/BUILD-SIZE.md). The field params prefill the form for
// real at a third of the bytes; the free-text fields (proposed verdict, evidence URLs, quotes)
// keep the form's own placeholders.
export function flagVerdictUrl({
  category,
  productId,
  storyId,
  verdict,
  quality,
}: {
  category: string
  productId: string
  storyId: string
  verdict: string
  quality: number
}): string {
  const params = new URLSearchParams({
    template: 'flag-verdict.yml',
    title: `[flag] ${category}/${productId}/${storyId}`,
    labels: 'contest',
    category,
    product: productId,
    'story-id': storyId,
    'current-verdict': `${verdict}, quality ${quality}`,
  })
  return `https://github.com/${REPO}/issues/new?${params.toString()}`
}
