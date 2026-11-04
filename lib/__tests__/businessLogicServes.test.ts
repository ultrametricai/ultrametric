import { describe, expect, it } from 'vitest'
import { loadBusinessLogicSteps, MODULE_GROUPS } from '../businessLogicMap'
import {
  CATALOGS, renderServesCell, renderServesLine, SERVES_PREFIX, servesSource, validateCatalogDoc,
  validateCatalogs, validateServes, validateServesDoc, writeCatalogServesCells, writeServesLines,
} from '../businessLogicServes'

// open-modules/README.md "Serves" ↔ map drift gate (founder 2026-10-02): every module's
// section carries exactly one machine-owned Serves line, byte-identical to what
// open-processes/business-logic-map.json renders (scripts/generate-business-logic-serves.ts) — so
// the README can never go stale against the map, in either direction: a map edit without a
// regenerated README fails, and a stray/edited README line fails too. This is the second half
// of the two-way totality bar (the map-side totality lives in businessLogicMap.test.ts).

describe('open-modules/README.md Serves sync', () => {
  const src = servesSource()

  it('the committed README passes the drift gate', () => {
    expect(validateServes()).toEqual([])
  })

  it('every module with at least one function mapping appears in the sync (both ways)', () => {
    const mapped = new Set(loadBusinessLogicSteps().map((s) => s.module))
    for (const moduleId of mapped) {
      // Rendering throws on a module the map does not know; the committed README must carry
      // the line (validateServes above), so a function-mapped module can never miss its
      // Serves entry.
      const line = renderServesLine(moduleId, src)
      expect(line.startsWith(SERVES_PREFIX)).toBe(true)
    }
    // And every map module renders one line — task-level-only modules included.
    for (const moduleId of Object.keys(src.modules)) {
      expect(renderServesLine(moduleId, src).startsWith(SERVES_PREFIX)).toBe(true)
    }
  })

  it('a Serves line names each mapped process once, with its step functions where they exist', () => {
    const line = renderServesLine('election83b', src)
    expect(line).toContain('n8a `compare83bScenario`')
    expect(line).toContain('/processes/incorporate-the-company')
    // The deadlines module carries the filing-window step, not election83b.
    expect(line).not.toContain('election83bWindow')
    // A mixed module: one process with a step function, one served at task level only.
    // fund_001 n6 maps to liquidityWaterfall: the SAFE's §A.3 greater-of choice needs the
    // waterfall engine (conversionIndifferencePrice is documented one-series, no-SAFE).
    const mixed = renderServesLine('waterfall', src)
    expect(mixed).toContain('n6 `liquidityWaterfall`')
    expect(mixed).toContain('/processes/close-a-priced-equity-round')
  })
})

describe('module catalog tables (grouped, machine-owned Serves cells)', () => {
  const src = servesSource()

  it('both committed catalogs pass the drift gate (README.md and open-modules/README.md)', () => {
    expect(validateCatalogs()).toEqual([])
  })

  it('a Serves cell is the served process titles in map order', () => {
    const cell = renderServesCell('deFranchiseTax', src)
    expect(cell).toContain('·')
    expect(cell).not.toContain('](') // titles only, no links in the cell
  })

  it('fails on a drifted cell, a wrong group, and a missing row', () => {
    const opts = CATALOGS[1] // open-modules/README.md, local anchors
    const doc = minimalCatalog(src)
    const good = writeCatalogServesCells(doc, src, opts)
    expect(validateCatalogDoc(good, src, opts)).toEqual([])
    const drifted = good.replace(renderServesCell('capTable', src), 'hand-edited')
    expect(validateCatalogDoc(drifted, src, opts).join(';')).toContain('has drifted')
    const wrongGroup = good.replace('### Formation & equity', '### Finance & runway')
    expect(validateCatalogDoc(wrongGroup, src, opts).join(';')).toContain('files it under')
    const missing = good
      .split('\n')
      .filter((l) => !l.includes('](#cap-table)'))
      .join('\n')
    expect(validateCatalogDoc(missing, src, opts).join(';')).toContain('expected exactly one module-table row')
  })
})

describe('serves validators (failure modes)', () => {
  const src = servesSource()

  it('fails when a Serves line drifted from the map', () => {
    const good = writeServesLines(minimalDoc(src), src)
    const stale = good.replace('`compare83bScenario`', '`compare83bScenarioTypo`')
    expect(validateServesDoc(stale, src).join(';')).toContain('missing or has drifted')
  })

  it('fails when a Serves line is missing, and when a stray extra line appears', () => {
    const doc = minimalDoc(src)
    const missing = validateServesDoc(doc, src)
    expect(missing.join(';')).toContain('missing or has drifted')
    const good = writeServesLines(doc, src)
    expect(validateServesDoc(good, src)).toEqual([])
    const stray = `${good}\n${SERVES_PREFIX} stray\n`
    expect(validateServesDoc(stray, src).join(';')).toContain('expected exactly one Serves line')
  })

  it('fails when a module heading is gone', () => {
    const doc = writeServesLines(minimalDoc(src), src).replace('### Cap table\n', '### Cap tables\n')
    expect(validateServesDoc(doc, src).join(';')).toContain('no "### Cap table" heading')
  })
})

/** A synthetic README with every mapped module's heading and a stub paragraph — lets the
 * failure modes run without touching the committed file. */
function minimalDoc(src: ReturnType<typeof servesSource>): string {
  const sections = Object.values(src.modules).map((m) => `### ${m.label}\n\nstub prose.\n`)
  return `# Open modules\n\n## Modules\n\n${sections.join('\n')}`
}

/** A synthetic grouped catalog (local anchors, Serves cells unfilled) for the failure modes. */
function minimalCatalog(src: ReturnType<typeof servesSource>): string {
  const used = new Set(Object.values(src.modules).map((m) => m.group))
  const groups = MODULE_GROUPS.filter((g) => used.has(g))
  const blocks = groups.map((g) => {
    const rows = Object.values(src.modules)
      .filter((m) => m.group === g)
      .map((m) => `| [${m.label}](#${m.anchor}) | stub | tbd |`)
    return `### ${g}\n\n| Module | What it computes | Serves |\n| --- | --- | --- |\n${rows.join('\n')}\n`
  })
  return `# Open modules\n\n## Module index\n\n${blocks.join('\n')}`
}
