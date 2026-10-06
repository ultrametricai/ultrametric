// @vitest-environment jsdom
// The process detail page's two bottom tables (founder 2026-10-05):
//   1. 'Open modules' — the bottom table ("go to a different table at the bottom of the page to
//      see how it links to those modules there"): one row per registry-mapped module, linking the
//      /open-modules/{id} page (the computed vendor context lives there, never duplicated
//      here), the committed README "What it computes" cell, the exact steps the module's
//      functions compute for as in-page #step anchors, and the GitHub source file. Unmapped
//      processes render neither the link nor the table.
//   2. 'Artifacts it produces' — the header 'Produces:' chip row became a table: each produced
//      registry artifact links its /artifacts page, carries the registry description, and names
//      the step on this page where it is born (#step anchor); exception producers keep the
//      honest canonical-producer pointer.
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProcessPage from '@/app/processes/[slug]/page'
import { modulesForProcess } from '@/lib/businessLogicMap'
import { processOpenModuleRows } from '@/lib/openModulePages'
import { producedArtifactRows } from '@/lib/processDeps'
import { loadProcesses, processSlug } from '@/lib/processes'

const byId = new Map(loadProcesses().map((t) => [t.id, t]))
const renderPage = async (id: string) => {
  const task = byId.get(id)!
  const page = await ProcessPage({ params: Promise.resolve({ slug: processSlug(task.title) }) })
  return { task, ...render(page) }
}

describe('the bottom Open modules table (founder 2026-10-05)', () => {
  it('tax_001 (a really mapped process): every registry module renders a row — /open-modules link, committed computes cell, step-anchor links resolving to REAL step blocks on this page, GitHub source', async () => {
    const { task, container } = await renderPage('tax_001')
    const rows = processOpenModuleRows(task)
    // Non-vacuous: the franchise-tax wiring really maps these two modules, with step entries.
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining(['deFranchiseTax', 'deadlines']))
    expect(rows.some((r) => r.serves.length > 0)).toBe(true)

    const section = container.querySelector('section#open-modules') as HTMLElement
    expect(section, 'the #open-modules anchor section must exist').toBeTruthy()
    for (const row of rows) {
      const moduleLink = section.querySelector(`a[href="/open-modules/${row.id}"]`)
      expect(moduleLink, `${row.id} must link its /open-modules page`).toBeTruthy()
      expect(moduleLink!.textContent).toBe(row.label)
      // The committed README "What it computes" cell, read back — never paraphrased.
      expect(section.textContent).toContain(row.computes)
      // Source: the repo file, deep-linked on GitHub.
      const source = section.querySelector(`a[href="${row.sourceHref}"]`)
      expect(source, `${row.id} must deep-link its source`).toBeTruthy()
      expect(source!.textContent).toContain(row.sourceFile)
      // Serves: one step-label link per function-level entry, each resolving to a real rendered
      // step block (the ProcessDag per-step anchor ids).
      for (const s of row.serves) {
        const stepLink = section.querySelector(`a[href="${s.anchor}"]`)
        expect(stepLink, `${row.id} must link step ${s.nodeId}`).toBeTruthy()
        expect(stepLink!.textContent).toBe(s.label)
        expect(
          container.querySelector(`[id="${s.anchor.slice(1)}"]`),
          `${s.anchor} must resolve to a real step block on this page`,
        ).toBeTruthy()
      }
    }
    // Vendor lists are NOT duplicated into this table — the module pages carry them.
    expect(section.textContent).not.toContain('Vendors')
  })

  it('a process-level-only mapping says the process plainly (no step links for that row)', async () => {
    // qs_050's runway module carries step entries; capTable on fund_004 does too — find a real
    // process-level-only row from the registry so the pin is honest, not synthetic.
    const candidate = loadProcesses()
      .flatMap((t) => processOpenModuleRows(t).map((r) => ({ t, r })))
      .find(({ r }) => r.serves.length === 0)
    expect(candidate, 'the registry should carry at least one process-level-only mapping').toBeTruthy()
    const { container } = await renderPage(candidate!.t.id)
    const section = container.querySelector('section#open-modules') as HTMLElement
    expect(section.textContent).toContain('this process as a whole')
  })

  it('the header affordance sits INLINE with the geo control (founder 2026-10-06): several modules = a small house menu of repo links, no #open-modules anchor left', async () => {
    const { task, container } = await renderPage('tax_001')
    // The 2026-10-05 '↓' anchor onto the bottom table is retired.
    expect(container.querySelector('a[href="#open-modules"]')).toBeNull()
    // tax_001 maps two modules → the dropdown form: a menu-button trigger at the geo control's
    // visual weight, in the SAME controls row as the geo dropdown.
    const trigger = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Open modules'),
    ) as HTMLElement
    expect(trigger, 'the Open modules menu trigger must render').toBeTruthy()
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    const row = trigger.closest('div.flex') as HTMLElement
    expect(
      row?.querySelector('button[title^="Where you operate"]'),
      'the control must share the geo dropdown’s controls row',
    ).toBeTruthy()
    // Open it: one repo link per registry module — the module's open-modules/README.md section
    // on GitHub (moduleReadmeHref), external-link hygiene intact.
    fireEvent.click(trigger)
    const menu = container.querySelector('[role="menu"][aria-label="Open modules"]') as HTMLElement
    expect(menu).toBeTruthy()
    const chips = modulesForProcess(task.id)
    expect(chips.length).toBeGreaterThan(1)
    for (const chip of chips) {
      const entry = menu.querySelector(`a[href="${chip.href}"]`) as HTMLElement
      expect(entry, `${chip.id} must link its README section`).toBeTruthy()
      expect(chip.href).toContain('/open-modules/README.md#')
      expect(entry.textContent).toContain(chip.label)
      expect(entry.getAttribute('target')).toBe('_blank')
      expect(entry.getAttribute('rel')).toContain('noopener')
    }
  })

  it("a single-module process (tax_002) renders plain inline text — 'Open module: Deadline calendar' linking the repo, no button, no menu", async () => {
    const { task, container } = await renderPage('tax_002')
    const [chip, ...rest] = modulesForProcess(task.id)
    expect(rest).toEqual([])
    const link = container.querySelector(`a[href="${chip.href}"]`) as HTMLElement
    expect(link, 'the inline Open module link must render').toBeTruthy()
    expect(link.textContent).toContain(`Open module: ${chip.label}`)
    expect(link.getAttribute('target')).toBe('_blank')
    // In the geo controls row, not on its own line above.
    expect(link.closest('div.flex')?.querySelector('button[title^="Where you operate"]')).toBeTruthy()
    // No expanding behavior anywhere near the title: no menu trigger.
    expect(
      [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Open module')),
    ).toBeUndefined()
  })

  it('an unmapped process (ops_001) renders neither the inline control nor the table', async () => {
    const { task, container } = await renderPage('ops_001')
    expect(processOpenModuleRows(task)).toEqual([])
    expect(modulesForProcess(task.id)).toEqual([])
    expect(container.querySelector('a[href="#open-modules"]')).toBeNull()
    expect(container.textContent).not.toContain('Open module')
    expect(container.querySelector('section#open-modules')).toBeNull()
    expect(container.querySelector('a[href^="/open-modules/"]')).toBeNull()
  })
})

describe("the bottom 'Artifacts it produces' table (founder 2026-10-05)", () => {
  it('form_011 (LLC — an exception producer): every produced artifact links its /artifacts page, carries the registry description, and its born-at step anchor resolves; the EIN row keeps the canonical-producer pointer', async () => {
    const { task, container } = await renderPage('form_011')
    const rows = producedArtifactRows(task)
    expect(rows.length).toBeGreaterThan(0)
    expect(container.textContent).toContain('Artifacts it produces')
    for (const row of rows) {
      const link = container.querySelector(`a[href="${row.href}"]`)
      expect(link, `${row.id} must link its /artifacts page`).toBeTruthy()
      expect(link!.textContent).toBe(row.label)
      expect(container.textContent).toContain(row.description)
      const born = container.querySelector(`a[href="${row.bornAt.anchor}"]`)
      expect(born, `${row.id} must link its producing step`).toBeTruthy()
      expect(
        container.querySelector(`[id="${row.bornAt.anchor.slice(1)}"]`),
        `${row.bornAt.anchor} must resolve to a real step block`,
      ).toBeTruthy()
    }
    // The honest canonical-producer pointer the old header chips carried: this page's EIN is the
    // documented exception — the registry's canonical producer is Get EIN.
    const ein = rows.find((r) => r.id === 'ein')!
    expect(ein.canonicalProducer).not.toBeNull()
    expect(container.textContent).toContain('canonical producer:')
    expect(
      container.querySelector(`a[href="${ein.canonicalProducer!.href}"]`),
      'the EIN row must point at the canonical producer page',
    ).toBeTruthy()
  })

  it('form_002 (the canonical EIN producer): its own row carries NO canonical pointer, and the old header chip row is gone', async () => {
    const { task, container } = await renderPage('form_002')
    expect(producedArtifactRows(task).every((r) => r.canonicalProducer === null)).toBe(true)
    expect(container.textContent).not.toContain('canonical producer:')
    // The header 'Produces:' chip row no longer renders anywhere on the page.
    expect(container.textContent).not.toContain('Produces:')
  })

  it('a process that produces no registry artifact (tax_001) renders no produces table', async () => {
    const { task, container } = await renderPage('tax_001')
    expect(task.produces).toEqual([])
    expect(container.textContent).not.toContain('Artifacts it produces')
  })
})
