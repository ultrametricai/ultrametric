import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Founder batch 2026-09-30, items 4c + 4e. The arena page is an async server component over
// fs-loaded params, so these pins read the source — the same pragmatic pattern as
// app/__tests__/layout-footer.test.ts. The rendered-output halves of item 4 (no pypi, no
// per-row vs link, no disputed datum, accessible table name) are pinned against the real
// component render in components/__tests__/ArenaTable.test.tsx.
const pageSrc = readFileSync(path.join(__dirname, '..', '[category]', 'page.tsx'), 'utf8')

describe('arena page header (founder 2026-09-30 removals)', () => {
  it('renders no stats line (stories/cells counts, updated date, evidence freshness)', () => {
    expect(pageSrc).not.toContain('user stories ·')
    expect(pageSrc).not.toContain('judged cells')
    expect(pageSrc).not.toContain('Evidence as of')
    // The freshness lookup left with its only consumer.
    expect(pageSrc).not.toContain('categoryFreshness')
  })

  it('renders no visible "Leaderboard" word — the table carries an aria-label instead', () => {
    // No JSX text node "Leaderboard" (the word may survive in comments explaining its removal).
    expect(pageSrc).not.toMatch(/>\s*Leaderboard\s*</)
    const tableSrc = readFileSync(
      path.join(__dirname, '..', '..', '..', 'components', 'ArenaTable.tsx'),
      'utf8',
    )
    expect(tableSrc).toContain('aria-label={`${data.category.name} rankings`}')
  })
})

// View-in-repo footer (founder 2026-10-08 deep-link audit): the arena page links its whole
// data area — the per-arena dir holding products.json, evidence/, verdicts.json, rankings.json.
// Source-read pin, same pattern as above (async server component over fs-loaded params).
describe('arena page view-in-repo footer (founder 2026-10-08)', () => {
  it('links data/<category>/ on GitHub with the muted process-page idiom', () => {
    expect(pageSrc).toContain('https://github.com/${REPO}/tree/main/data/${category}')
    expect(pageSrc).toContain('View the evidence in the repo')
  })
})
