import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The 2026-09-30 mono sweep (founder: "we are using a lot of monospace font — change to a
// default body font"): font-mono is now reserved for terminal/code/copyable-command UI and for
// tabular numeric columns where per-character alignment matters (which keep tabular-nums).
// Stylistic mono on BODY text — eyebrows, uppercase tracking labels, word chips, counters,
// stats sentences, info rows — was switched to the default body font (Inter via --font-sans;
// body inherits it, so dropping the class is the switch; font-sans is used only to opt out of
// a mono ancestor). These files were swept clean of font-mono entirely — a reappearance means
// the stylistic-mono habit is creeping back. Files with legitimately KEPT mono (score/number
// columns, glyph grids, code) are deliberately not listed.
const ROOT = path.join(__dirname, '..', '..')

const SWEPT_CLEAN = [
  // Homepage + its sections
  'app/home/page.tsx',
  'components/BackedByBuilders.tsx',
  'components/GetStartedSections.tsx',
  'components/HomeProcessesMini.tsx',
  // Word chips / badges
  'components/TierChip.tsx',
  'components/PersonaChip.tsx',
  'components/CertificationChip.tsx',
  'components/SpikeDepthChip.tsx',
  'components/VerificationMixChip.tsx',
  'components/ClaimsChip.tsx',
  'components/MomentumChip.tsx',
  'components/MomentumTrend.tsx',
  'components/ScoreTrend.tsx',
  'components/AccountMenu.tsx',
  'components/ProductLogoView.tsx',
  'components/ArenaMenu.tsx',
  // Stats lines / info rows
  'components/ClaimsSection.tsx',
  'components/PersonaStacksSection.tsx',
  'components/ProcessLensBanner.tsx',
  'components/ProcessYourVendor.tsx',
  'components/ProductFinePrint.tsx',
  'components/VsEventCard.tsx',
  // Pages whose only mono was stylistic
  'app/processes/operating-rhythm/page.tsx',
  'app/icp/page.tsx',
]

describe('mono-font sweep (founder 2026-09-30)', () => {
  it.each(SWEPT_CLEAN)('%s stays free of font-mono', (file) => {
    const src = readFileSync(path.join(ROOT, file), 'utf8')
    expect(src).not.toContain('font-mono')
  })
})
