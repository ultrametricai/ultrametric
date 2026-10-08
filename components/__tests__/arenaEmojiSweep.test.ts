import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The 2026-10-02 old-icon sweep (founder: "we still have the older icons in various places,
// e.g. /overall — look through the entire site"): every VISUAL arena-icon render site goes
// through arenaIcon() (lib/arenaIcons.ts house tokens) + IconChip/IconGlyph, never the legacy
// emoji in data/arena-icons.json. The legacy emoji stay committed as the semantic guides and
// for text-only surfaces where SVG cannot render. This sweep pins the import graph: a new
// `data/arena-icons.json` import outside the allowlist means the raw-emoji habit is creeping
// back — route the new surface through arenaIcon() instead.
const ROOT = path.join(__dirname, '..', '..')

// Files that may STILL read the raw emoji map, each for a text-only reason:
const ALLOWED = new Set([
  // Native <select><option> labels (the mega-table's BELOW-SM arena scope filter — the desktop
  // control is the house listbox since the 2026-10-08 sweep) — options can't render SVG, so
  // the emoji remain the only decoration a select can carry (same precedent as phaseEmoji()
  // in the processes table's phase filter).
  'lib/megaTable.ts',
  // The product page header converted in the 2026-10-08 house icon sweep — arenaIcon() +
  // IconGlyph, no raw import left.
  // The arena-icon source of truth documents itself.
  'lib/arenaIcons.ts',
])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

describe('arena emoji sweep (founder 2026-10-02)', () => {
  it('no app/components/lib source imports data/arena-icons.json outside the text-only allowlist', () => {
    const offenders: string[] = []
    for (const base of ['app', 'components', 'lib']) {
      for (const file of walk(path.join(ROOT, base))) {
        const rel = path.relative(ROOT, file)
        if (ALLOWED.has(rel)) continue
        const src = readFileSync(file, 'utf8')
        // Imports only — prose comments may still NAME the file as the semantic guide.
        if (/import[^\n]*data\/arena-icons\.json/.test(src)) offenders.push(rel)
      }
    }
    expect(offenders, `route these through arenaIcon() + IconChip/IconGlyph: ${offenders.join(', ')}`).toEqual([])
  })
})
