import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The 2026-09-30 contrast sweep (founder: section names like "Caching" rendered very dark grey
// on black): zinc-600/zinc-700 is banned on TEXT CONTENT — section names/labels lift to the
// secondary tier (zinc-400), de-emphasized annotations ("/100", units, counts) to the tertiary
// tier (zinc-500). Decorative glyphs, dividers, arrows, and placeholder dashes may stay dark,
// so these pins target the exact label lines that regressed, same pattern as fontSweep.test.ts.
const ROOT = path.join(__dirname, '..', '..')

// [file, substring that must be present] — each pin is the fixed line, at its lifted class.
const CLASS_PINS: Array<[string, string]> = [
  // The flagged offender: StoryMap's box header + stem labels ("Caching" on product pages).
  ['components/StoryMap.tsx', 'tracking-widest text-zinc-400">{label}'],
  ['components/StoryMap.tsx', 'tracking-wide text-zinc-400">{c.label}'],
  // Same section name in the arena page's what-we-tested table (sticky group divider).
  ['components/StoryMatrix.tsx', 'text-zinc-400">{humanizeTheme(group)}'],
  // The visible theme one-liner under StoryMap headings reads as a sentence — secondary tier.
  ['components/StoryMap.tsx', 'text-zinc-400">{themeExplanation(theme)}'],
  // 2026-10-02 round: the "/100" units that lagged the sweep — tertiary tier like the other
  // eighteen "/100" renders sitewide (e.g. app/yc/page.tsx, components/MegaTable.tsx).
  ['app/rankings/law-firms/page.tsx', '<>{score(value)}<span className="text-zinc-500">/100</span></>'],
  ['app/rankings/law-firms/page.tsx', '<>{score(row.entry.agentReady)}<span className="text-zinc-500">/100</span></>'],
  // (VendorProcesses' "/100" pin left with its scores — founder 2026-10-08: the section is a
  // names-only inline list; the per-step scores live on the process pages.)
  // (The /processes hidden-rows disclosure pin left with the disclosure itself — founder
  // 2026-10-05: the country filter just filters; the note summaries render on the detail
  // pages, where ProcessGeoBanner carries the same field at zinc-300.)
  // StepVendorRow's "use" control label sits at the same tier as its sibling clear button.
  ['components/StepVendorRow.tsx', 'text-[10px] text-zinc-500 transition hover:text-emerald-300'],
]

// Contrast pass 3 (founder 2026-10-08, the bar TIGHTENS): CONTENT text — anything a reader is
// meant to read: values, labels, license strings, summaries — renders ≥ zinc-400; zinc-500 only
// for genuinely de-emphasized metadata; zinc-600+ is decorative chrome (separators, disabled
// states) only. These pins fix representative lifted sites per surface; the deliberate-dark
// notes above still stand where they named decorative chrome.
const PASS3_PINS: Array<[string, string]> = [
  // /open-documents: the committed license class label reads at the content tier.
  ['app/open-documents/page.tsx', 'align-top text-zinc-400 md:table-cell'],
  // Artifact pages: the license string and the publisher name are content, not chrome.
  ['app/artifacts/[id]/page.tsx', 'text-zinc-400">{d.license_note}'],
  ['app/artifacts/[id]/page.tsx', 'text-zinc-400">{d.publisher}'],
  // Judged-verdict rationale and evidence excerpts are the reason the reader expanded the row.
  ['components/StoryVerdictsTable.tsx', 'text-zinc-400">{row.rationale}'],
  // Situation triggers are the row's one-line answer to "when does this fire".
  ['components/SituationsTable.tsx', 'text-zinc-400">{r.trigger}'],
  ['components/ProcessesTable.tsx', 'text-zinc-400">{r.trigger}'],
  // Theme one-liners on the report and checklist surfaces (the StoryMap precedent above).
  ['app/arena/[category]/report/page.tsx', 'text-zinc-400">{themeExplanation(theme)}'],
  ['app/arena/[category]/checklist/page.tsx', 'text-zinc-400">{themeExplanation(theme)}'],
  // Methodology: the score-dimension names are labels, read against their glosses.
  ['app/methodology/page.tsx', 'text-zinc-400">agent-ready</td>'],
  // Ranking-page intro explainers are summaries (law-firms as the per-surface representative).
  ['app/rankings/law-firms/page.tsx', '<p className="mt-2 text-xs text-zinc-400">'],
  // The sitewide footer disclaimer leaves the decorative tier: fine print, but readable
  // (layout-footer.test.ts pins the full block).
  ['app/layout.tsx', '<p className="text-xs text-zinc-500">\n                  Research content'],
]

describe('contrast sweep (founder 2026-09-30)', () => {
  it.each(CLASS_PINS)('%s keeps its label at the lifted tier: %s', (file, pin) => {
    const src = readFileSync(path.join(ROOT, file), 'utf8')
    expect(src).toContain(pin)
  })

  it('StoryMap has no zinc-600/700 on its label lines (only the decorative connector stays dark)', () => {
    const src = readFileSync(path.join(ROOT, 'components/StoryMap.tsx'), 'utf8')
    const textDark = src.split('\n').filter((l) => /text-zinc-[67]00/.test(l) && !l.includes('svg'))
    expect(textDark).toEqual([])
  })
})

describe('contrast pass 3 (founder 2026-10-08): content ≥ zinc-400, zinc-600 is chrome only', () => {
  it.each(PASS3_PINS)('%s keeps its content at the lifted floor: %s', (file, pin) => {
    const src = readFileSync(path.join(ROOT, file), 'utf8')
    expect(src).toContain(pin)
  })
})

describe('plain-language renames (founder 2026-09-30)', () => {
  it('the arena page heads its judged-stories table "What we tested", not "Story matrix"', () => {
    const src = readFileSync(path.join(ROOT, 'app/arena/[category]/page.tsx'), 'utf8')
    expect(src).toContain('What we tested')
    // The anchor id stays for URL compat — only the display text renamed.
    expect(src).toContain('id="story-matrix"')
    expect(src).not.toMatch(/>\s*Story matrix\s*</)
  })
})
