import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The shared um-* classes exist only to dedupe the highest-repetition utility strings in the
// prerendered battle//vs/product markup (docs/BUILD-SIZE.md) — they must stay byte-for-byte
// @apply bundles of the exact utilities the call sites used inline before 2026-10-02, or the
// dedup silently becomes a restyle. Pin each bundle.
const css = readFileSync(path.join(__dirname, '..', 'globals.css'), 'utf8')

const APPLY: Record<string, string> = {
  'um-pill': 'rounded-full px-2 py-0.5 text-xs font-medium ring-1',
  'um-pill-hover': 'transition hover:brightness-125 hover:ring-emerald-400/60',
  'um-pill-link': 'inline-flex rounded-full transition hover:brightness-125 hover:ring-1 hover:ring-emerald-400/60',
  'um-persona-chip':
    'inline-flex max-w-full shrink-0 items-center rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 align-middle text-[10px] leading-4 text-zinc-500',
  'um-round-summary':
    'flex cursor-pointer select-none items-baseline gap-2 px-4 py-2.5 transition hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden',
  'um-round-title': 'min-w-0 flex-1 truncate text-sm font-medium group-open:whitespace-normal',
  'um-cite-link': 'underline decoration-zinc-700 hover:text-emerald-300',
  'um-theme-bar':
    'sticky top-0 z-10 -mx-5 flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-950/95 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-emerald-400 backdrop-blur',
}

describe('shared um-* chip classes (app/globals.css)', () => {
  for (const [name, utilities] of Object.entries(APPLY)) {
    it(`.${name} @applies exactly the utilities it replaced`, () => {
      const rule = css.match(new RegExp(`\\.${name}\\s*\\{\\s*@apply ([^;]+);`))
      expect(rule, `.${name} rule missing from globals.css`).not.toBeNull()
      expect(rule![1].replace(/\s+/g, ' ').trim()).toBe(utilities)
    })
  }

  it('the dedup is in use where it counts (BattleView rounds + the badge chips)', () => {
    const battleView = readFileSync(path.join(__dirname, '..', '..', 'components', 'BattleView.tsx'), 'utf8')
    for (const cls of ['um-round-summary', 'um-round-title', 'um-cite-link', 'um-theme-bar']) {
      expect(battleView).toContain(cls)
    }
    expect(readFileSync(path.join(__dirname, '..', '..', 'components', 'VerdictBadge.tsx'), 'utf8')).toContain('um-pill')
    expect(readFileSync(path.join(__dirname, '..', '..', 'components', 'VerificationBadge.tsx'), 'utf8')).toContain('um-pill')
    expect(readFileSync(path.join(__dirname, '..', '..', 'components', 'PersonaChip.tsx'), 'utf8')).toContain('um-persona-chip')
  })
})
