// Per-product improvement opportunities, derived purely from the product's OWN judged verdicts:
// every story judged none or partial is something the vendor could ship (or evidence better),
// ranked by how much score headroom it represents. This is the vendor-facing complement to the
// verdicts table — "here is your to-do list, straight from the evidence" — and it complements
// the vendor-response lane (docs/vendor-responses.md) and the per-verdict Flag link: if a
// verdict here is wrong, contest it; if it's right, close it.
//
// Pure and `node:fs`-free (same contract as lib/data-helpers.ts): callers pass the stories +
// verdicts (any CategoryData satisfies the input shape), tests pass fixtures.
//
// Ranking formula (honest and contestable, like everything else on the site):
//
//   impact = story.weight × (10 − quality) × boost
//
// where quality is the judged 0–10 quality (0 for none) and boost = AGENTIC_BOOST for stories
// in the three index-feeding agenticness groups (agent-access → agent-ready, agentic-features →
// Built-in AI, api-quality → API quality — see lib/scoring.ts), because closing those gaps moves
// a headline index directly, not just the coverage score. `na` verdicts are excluded entirely:
// "not applicable" is not an opportunity.

import type { Story, Verdict } from './schemas'
import { parseStoryPersona } from './storyText'

// Which headline index closing this story would move. Group-scoped agenticness stories feed a
// named index (see lib/scoring.ts's agentReady/agenticApp/apiQuality filters); everything else
// feeds the Overall score blend through its theme (openness, automation-depth) or the coverage score.
export type ScoreLever = 'agent-ready' | 'Built-in AI' | 'API quality' | 'Overall score'

// Extra weight for the three groups that feed a headline index directly. 1.5 is deliberately
// mild — a weight-3 domain story still outranks a weight-1 agentic nicety.
export const AGENTIC_BOOST = 1.5

// At most this many opportunities are returned; `total`/`truncated` on the report say when the
// full list is longer.
export const OPPORTUNITY_CAP = 8

export interface Opportunity {
  storyId: string
  // Action form of the story title ("Use an official CLI…"), via lib/storyText.ts — never the
  // raw "As a {persona}, …" frame.
  title: string
  theme: string
  group: string
  verdict: 'none' | 'partial'
  quality: number
  // weight × (10 − quality) × boost, rounded to 1 decimal — the ranking key.
  impact: number
  // One honest sentence on what's missing, per the judge's own rationale: the rationale's
  // "missing for 10: …" clause when present (rankings-engine/stages/judge.ts requires it whenever
  // quality < 10), else the rationale's first sentence.
  why: string
  scoreLever: ScoreLever
}

export interface OpportunityReport {
  // Ranked best-first, capped at OPPORTUNITY_CAP.
  opportunities: Opportunity[]
  // How many qualifying (none/partial) stories exist before the cap.
  total: number
  truncated: boolean
}

// Structural subset of CategoryData — keeps this module (and its tests) independent of the full
// shape; loadCategory()'s result satisfies it as-is.
export interface OpportunitySource {
  stories: Story[]
  verdicts: Verdict[]
}

const LEVER_BY_GROUP: Record<string, ScoreLever> = {
  'agent-access': 'agent-ready',
  'agentic-features': 'Built-in AI',
  'api-quality': 'API quality',
}

// The lever must match lib/scoring.ts exactly: the three indexes filter on theme === 'agenticness'
// AND the group, so a same-named group under another theme does NOT feed the index.
export function scoreLeverFor(story: Pick<Story, 'theme' | 'group'>): ScoreLever {
  if (story.theme === 'agenticness') {
    const lever = LEVER_BY_GROUP[story.group]
    if (lever) return lever
  }
  return 'Overall score'
}

// The judge's required gap-naming clause (rankings-engine/stages/judge.ts: quality < 10 must include
// "missing for 10: …"; a few older cached verdicts phrase it "missing for a 10"). Everything
// after the phrase IS the gap list by construction — it's authored as the rationale's closer.
const MISSING_CLAUSE = /missing for (?:a )?10:\s*([\s\S]+)/i

function endSentence(s: string): string {
  const trimmed = s.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

// One honest sentence on what's missing. Prefers the judge's own "missing for 10: …" clause;
// falls back to the rationale's first sentence for verdicts that predate the requirement.
export function opportunityWhy(rationale: string): string {
  const m = MISSING_CLAUSE.exec(rationale)
  if (m) {
    const clause = m[1].trim()
    return endSentence(`Missing: ${clause.charAt(0).toLowerCase()}${clause.slice(1)}`)
  }
  const firstSentence = rationale.split(/(?<=[.!?])\s+/)[0] ?? rationale
  return endSentence(firstSentence)
}

export function opportunityImpact(story: Pick<Story, 'weight' | 'theme' | 'group'>, quality: number): number {
  const boost = scoreLeverFor(story) === 'Overall score' ? 1 : AGENTIC_BOOST
  return Math.round(story.weight * (10 - quality) * boost * 10) / 10
}

// The ranked improvement list for one product. Only none/partial verdicts qualify: `full` is
// done, `na` is not applicable (≠ opportunity), and `disputed` belongs to the contest lane, not
// a to-do list. Sorted by impact (desc), then story weight (desc), then storyId for stability.
export function opportunitiesFor(source: OpportunitySource, productId: string): OpportunityReport {
  const storyById = new Map(source.stories.map((s) => [s.id, s]))
  const all: Opportunity[] = []
  for (const v of source.verdicts) {
    if (v.productId !== productId) continue
    if (v.verdict !== 'none' && v.verdict !== 'partial') continue
    const story = storyById.get(v.storyId)
    if (!story) continue
    all.push({
      storyId: story.id,
      title: parseStoryPersona(story.title).action,
      theme: story.theme,
      group: story.group,
      verdict: v.verdict,
      quality: v.quality,
      impact: opportunityImpact(story, v.quality),
      why: opportunityWhy(v.rationale),
      scoreLever: scoreLeverFor(story),
    })
  }
  all.sort(
    (a, b) =>
      b.impact - a.impact ||
      (storyById.get(b.storyId)!.weight - storyById.get(a.storyId)!.weight) ||
      a.storyId.localeCompare(b.storyId),
  )
  return {
    opportunities: all.slice(0, OPPORTUNITY_CAP),
    total: all.length,
    truncated: all.length > OPPORTUNITY_CAP,
  }
}
