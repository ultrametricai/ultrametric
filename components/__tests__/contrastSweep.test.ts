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

describe('plain-language renames (founder 2026-09-30)', () => {
  it('the arena page heads its judged-stories table "What we tested", not "Story matrix"', () => {
    const src = readFileSync(path.join(ROOT, 'app/arena/[category]/page.tsx'), 'utf8')
    expect(src).toContain('What we tested')
    // The anchor id stays for URL compat — only the display text renamed.
    expect(src).toContain('id="story-matrix"')
    expect(src).not.toMatch(/>\s*Story matrix\s*</)
  })
})
