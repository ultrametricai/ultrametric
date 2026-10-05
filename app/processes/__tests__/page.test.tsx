// @vitest-environment jsdom
// The combined /processes view (founder 2026-09-29: "combine playbooks and all processes into
// one table so we have one view for the processes under the process search"), with the same-day
// vocabulary follow-up ("we don't need to say 'playbook' on those playbooks… playbooks are
// still processes"): chain rows in the one table — no 'Playbooks' group, no chip, one unified
// search count. Founder 2026-09-30: the 'All processes' heading is gone (the table stands alone
// under the search) and the default view is the flat FOUNDER-TIMELINE sort — process rows in
// timeOrder, chain rows (no timeOrder of their own in the flat view) after them. Founder
// 2026-10-02: the simulator promo card and the vendor-tracing footer line are gone too — the
// table is the page's bottom (title + search + controls + table).
import { render, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProcessesPage from '@/app/processes/page'
import { usFlagGlyph } from '@/lib/geoPreference'
import { loadProcesses, processSlug } from '@/lib/processes'
import { areaOf, buildPlaybookRows, buildProcessRows } from '@/lib/processRows'

describe('/processes — one combined table, one processes vocabulary', () => {
  it("renders ONE table with no 'All processes' heading, flat in founder-timeline order, chain rows linked after the processes (no 'Playbooks' group or label)", () => {
    const { container } = render(<ProcessesPage />)

    // Exactly one table on the page (the old page rendered a second, playbooks-only table).
    expect(container.querySelectorAll('table').length).toBe(1)
    expect(within(container).queryByText('End-to-end playbooks')).toBeNull()
    expect(within(container).queryByText('Playbooks & all processes')).toBeNull()
    // The heading is gone (founder 2026-09-30) — the table stands alone under the search.
    expect(within(container).queryByText('All processes')).toBeNull()

    const table = container.querySelector('table') as HTMLElement
    const playbooks = buildPlaybookRows()
    const { rows } = buildProcessRows()
    // No leading 'Playbooks' group header and no 'playbook' chip — one vocabulary.
    expect(within(table).queryByText('Playbooks')).toBeNull()
    expect(within(table).queryByText('playbook')).toBeNull()
    // The default view is FLAT founder-timeline (founder 2026-09-30) — no area group headers.
    expect(table.querySelectorAll('tbody th').length).toBe(0)
    expect(table.querySelectorAll('tbody tr').length).toBe(playbooks.length + rows.length)
    // Process rows lead in timeOrder; chain rows (no per-process timeOrder in the flat view)
    // follow them, each linking to its chain page from inside the one table.
    const trs = [...table.querySelectorAll('tbody tr')]
    const lastProcessIdx = Math.max(
      ...rows.map((r) => trs.findIndex((tr) => tr.querySelector(`a[href="/processes/${r.slug}"]`) !== null)),
    )
    for (const p of playbooks) {
      const rowIdx = trs.findIndex((tr) => tr.querySelector(`a[href="${p.href}"]`) !== null)
      expect(rowIdx, `chain ${p.id} must link to its chain page`).toBeGreaterThanOrEqual(0)
      expect(rowIdx, `chain ${p.id} must follow the timeline-sorted processes`).toBeGreaterThan(lastProcessIdx)
    }
    // The first two process rows really are in founder-timeline order. Situations carry no
    // timeOrder slot (founder 2026-10-01) — they follow the timeline, so the probe scopes to
    // the timeline rows.
    const byTime = rows
      .filter((r) => r.timeOrder !== null)
      .sort((a, b) => (a.timeOrder ?? 0) - (b.timeOrder ?? 0))
    const idxOf = (slug: string) => trs.findIndex((tr) => tr.querySelector(`a[href="/processes/${slug}"]`) !== null)
    expect(idxOf(byTime[0].slug)).toBeLessThan(idxOf(byTime[byTime.length - 1].slug))
    expect(idxOf(byTime[0].slug)).toBe(0)
  })

  it('shows NO kind=situation rows — they moved to /situations (founder 2026-10-02); their detail pages stay reachable', () => {
    const { container } = render(<ProcessesPage />)
    const table = container.querySelector('table') as HTMLElement
    const situations = loadProcesses().filter((t) => t.kind === 'situation')
    expect(situations).toHaveLength(22)
    for (const t of situations) {
      expect(
        table.querySelector(`a[href="/processes/${processSlug(t.title)}"]`),
        `${t.id} must not render on /processes`,
      ).toBeNull()
    }
    // No situation vocabulary left on the page: no trigger subtitles, no urgency chips, and —
    // with the rows gone — no 'Situations' area group can ever materialize in the grouped view.
    expect(container.textContent).not.toContain(situations[0].trigger!)
    expect(within(container).queryByText('Situations')).toBeNull()
    // The row set is exactly processes + playbooks (count pins above already derive from
    // buildProcessRows, which excludes situations by construction).
    const { rows } = buildProcessRows()
    expect(rows.some((r) => r.kind === 'situation')).toBe(false)
  })

  it('every chain row carries its dominant area (first constituent) and that constituent timeOrder', () => {
    for (const p of buildPlaybookRows()) {
      expect(p.dominantArea).toBe(areaOf(p.processes[0].phase))
      expect(p.timeOrder).toBeGreaterThanOrEqual(1)
    }
  })

  it('the fat search counts chains in the one processes N; the simulator card and the footer line are gone (founder 2026-10-02)', () => {
    const { container } = render(<ProcessesPage />)
    const playbooks = buildPlaybookRows()
    const { rows } = buildProcessRows()

    const input = within(container).getByLabelText('Search processes') as HTMLInputElement
    expect(input.placeholder).toBe(`Search ${rows.length + playbooks.length} processes — payroll, SOC 2, EIN…`)

    // The route-dot legend was removed with the dots (founder 2026-09-29).
    expect(within(container).queryByText('agent-runnable')).toBeNull()
    // The simulator promo card is gone (founder 2026-10-02) — no /startup-sim link on this
    // page; the route stays reachable through the nav and ⌘K.
    expect(within(container).queryByText('🐣 The open startup simulator')).toBeNull()
    expect(container.querySelector('a[href="/startup-sim"]')).toBeNull()
    // So is the vendor-tracing footer line (same founder batch) — the table ends the page.
    expect(container.textContent).not.toContain('Every mapped vendor traces to a live arena leaderboard')
    expect(within(container).queryByText('See all rankings →')).toBeNull()
  })
})

describe('/processes defaults onto the GLOBAL view (founder 2026-09-30: "default /processes onto a global view — you can include the US specific ones in the first view")', () => {
  it('the SERVER render is the global view — geo dropdown reads 🌐 Global, every row present and glyph-marked with the sharp scope set — no client flash', () => {
    const ssr = renderToString(<ProcessesPage />)
    const doc = document.createElement('div')
    doc.innerHTML = ssr
    // The geo dropdown's default (no-param, no-stored-pref) framing is 🌐 Global, in the static
    // HTML itself (SSG honesty: the prop, not a mount effect, carries the default).
    const geoTrigger = [...doc.querySelectorAll('button')].find((b) => b.title.includes('Where you operate'))
    expect(geoTrigger?.textContent).toContain('Global')
    expect(geoTrigger?.textContent).toContain('🌐')
    expect(geoTrigger?.textContent).not.toContain('USA')
    // "Include the US specific ones in the first view": the row set is the FULL corpus — the
    // geo dimension annotates, never filters. Scope glyphs since the founder batch 2026-10-02:
    // us AND us-state rows wear the 🇺🇸 flag (keyed strictly on geoScope — the label still
    // tells federal from state work); global rows wear NO scope glyph, and no 🌐/🏛 ever
    // follows a title.
    const { rows } = buildProcessRows()
    const table = doc.querySelector('table') as HTMLElement
    expect(table.querySelectorAll('tbody tr').length).toBe(rows.length + buildPlaybookRows().length)
    const countByTitle = (label: string) => table.querySelectorAll(`span[title="${label}"]`).length
    for (const scope of ['us', 'us-state'] as const) {
      const expected = rows.filter((r) => r.geoScope === scope).length
      expect(expected, `corpus should carry ${scope} rows for the pin to bite`).toBeGreaterThan(0)
      expect(countByTitle(usFlagGlyph(scope)!.label), `every ${scope} row flag-marked`).toBe(expected)
    }
    const titleCells = [...table.querySelectorAll('tbody td:first-child')]
    expect(titleCells.filter((c) => c.textContent?.includes('🇺🇸')).length).toBe(
      rows.filter((r) => r.geoScope !== 'global').length,
    )
    expect(titleCells.some((c) => c.textContent?.includes('🌐'))).toBe(false)
    expect(titleCells.some((c) => c.textContent?.includes('🏛'))).toBe(false)
    // The qs_023 audit (founder 2026-10-02): 'Open bank account' is geoScope GLOBAL in the
    // corpus — its row must wear NO flag. A global record can never render the flag.
    const bank = rows.find((r) => r.slug === 'open-bank-account')
    expect(bank?.geoScope).toBe('global')
    const bankCell = titleCells.find((c) => c.querySelector('a[href="/processes/open-bank-account"]'))
    expect(bankCell, 'the qs_023 row must render').toBeTruthy()
    expect(bankCell!.textContent).not.toContain('🇺🇸')
  })

  it('the client render matches (hydrated default = Global framing, all rows still present)', () => {
    const { container } = render(<ProcessesPage />)
    const geoTrigger = [...container.querySelectorAll('button')].find((b) => b.title.includes('Where you operate'))
    expect(geoTrigger?.textContent).toContain('Global')
    const { rows } = buildProcessRows()
    expect((container.querySelector('table') as HTMLElement).querySelectorAll('tbody tr').length).toBe(rows.length + buildPlaybookRows().length)
  })
})
