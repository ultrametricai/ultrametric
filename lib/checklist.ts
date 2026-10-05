// Buyer checklist / RFP view of an arena's story taxonomy (app/arena/[category]/checklist/
// page.tsx): every judged user story becomes a checkbox line grouped by theme, with its weight
// surfaced as a buyer priority (3 = must-have, 2 = should-have, 1 = nice-to-have — the same
// weights lib/scoring.ts multiplies by). Pure and `node:fs`-free, same contract as
// lib/data-helpers.ts: callers pass CategoryData, tests pass fixtures.
import { humanizeTheme } from './icons'
import { groupInOrder, stripPersonaPrefix, verdictFor, type CategoryData } from './data-helpers'
import type { Story, Verdict } from './schemas'
import { SITE_URL } from './site'

export type Priority = 'must-have' | 'should-have' | 'nice-to-have'

export function priorityForWeight(weight: number): Priority {
  return weight >= 3 ? 'must-have' : weight === 2 ? 'should-have' : 'nice-to-have'
}

// Stories grouped by theme in first-seen order, each theme's stories sorted heaviest-first
// (stable within a weight, preserving taxonomy order) — the shape both the page and the
// markdown export render.
export function checklistThemes(stories: Story[]): Array<[string, Story[]]> {
  return groupInOrder(stories, (s) => s.theme).map(([theme, themeStories]) => [
    theme,
    [...themeStories].sort((a, b) => b.weight - a.weight),
  ])
}

// Same glyph vocabulary as VerdictBadge/the access-glyph strips, plus an explicit 'n/a' for
// the checklist's product chips (where a blank would read as "missing data", not "not
// applicable").
export const VERDICT_GLYPHS: Record<Verdict['verdict'], string> = {
  full: '✓',
  partial: '~',
  disputed: '!',
  none: '—',
  na: 'n/a',
}

// How the field does on one requirement today — feeds the checklist item's muted "why it
// matters" line. 'na' verdicts are excluded from the denominator so a requirement most products
// can't even attempt doesn't read as universally failed.
export function storyPassStats(
  data: CategoryData,
  storyId: string,
): { full: number; applicable: number } {
  let full = 0
  let applicable = 0
  for (const p of data.products) {
    const verdict = verdictFor(data, p.id, storyId).verdict
    if (verdict === 'na') continue
    applicable += 1
    if (verdict === 'full') full += 1
  }
  return { full, applicable }
}

// The checklist item's one-line "why it matters": what the priority means for scoring (the
// honest mechanical truth — weight is the multiplier lib/scoring.ts applies) plus how much of
// the field fully delivers it today, so a buyer can tell table stakes from frontier asks.
const PRIORITY_WHY: Record<Priority, string> = {
  'must-have': 'Core requirement — weighs 3× in arena scoring',
  'should-have': 'Important, not disqualifying — weighs 2× in arena scoring',
  'nice-to-have': 'Differentiator, not a dealbreaker — weighs 1× in arena scoring',
}

export function checklistWhy(weight: number, stats: { full: number; applicable: number }): string {
  const base = PRIORITY_WHY[priorityForWeight(weight)]
  if (stats.applicable === 0) return base
  const status =
    stats.full === 0
      ? 'no product fully delivers this yet'
      : stats.full === stats.applicable
        ? `all ${stats.applicable} products fully deliver this today`
        : `${stats.full} of ${stats.applicable} products fully deliver this today`
  return `${base} · ${status}`
}

// The "copy as markdown" payload: a clean, self-contained RFP checklist — GitHub-flavored
// task-list lines grouped by theme, each tagged with its priority — ending with a provenance
// line back to the arena so recipients can check the evidence themselves. Deliberately no
// verdict matrix: an RFP asks vendors the questions; the arena page holds our answers.
export function checklistMarkdown(data: CategoryData): string {
  const lines: string[] = [
    `# ${data.category.name} — buyer checklist (RFP)`,
    '',
    `Derived from Ultrametric's agent-tested user-story taxonomy for ${data.category.name}: ${data.stories.length} judged requirements. Priorities mirror story weights (3 = must-have, 2 = should-have, 1 = nice-to-have).`,
    '',
  ]
  for (const [theme, stories] of checklistThemes(data.stories)) {
    lines.push(`## ${humanizeTheme(theme)}`, '')
    for (const s of stories) {
      lines.push(`- [ ] **[${priorityForWeight(s.weight)}]** ${stripPersonaPrefix(s.title)}`)
    }
    lines.push('')
  }
  lines.push(
    '---',
    '',
    `Source: ${SITE_URL}/arena/${data.category.id} (agent-tested verdicts for ${data.products.length} products) · methodology: ${SITE_URL}/methodology`,
    '',
  )
  return lines.join('\n')
}
