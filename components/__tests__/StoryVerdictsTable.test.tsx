// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import StoryVerdictsTable from '@/components/StoryVerdictsTable'
import { loadCategory } from '@/lib/data'
import { buildStoryVerdictRows } from '@/lib/storyVerdictsSort'

const data = loadCategory('desktop-os', path.resolve(__dirname, '../../data'))
const productId = data.products[0].id
const rows = buildStoryVerdictRows(data, productId)

function renderTable() {
  return render(<StoryVerdictsTable rows={rows} />)
}

afterEach(() => {
  // The hash auto-expand test sets location.hash; reset so later mounts start collapsed.
  window.location.hash = ''
})

describe('StoryVerdictsTable', () => {
  it('renders one anchored row per story and defaults to "Sorted by importance"', () => {
    const { container } = renderTable()
    for (const row of rows) {
      const anchored = container.querySelector(`[id="story-${row.storyId}"]`)
      expect(anchored, `missing #story-${row.storyId}`).not.toBeNull()
      expect(anchored!.className).toContain('scroll-mt-4')
    }
    expect(screen.getByText(/Sorted by/).textContent).toMatch(/importance/)
  })

  it('expands a row to reveal the rationale and evidence links', () => {
    renderTable()
    const target = rows.find((r) => r.evidence.length > 0)!
    const button = screen.getByLabelText(`Details for story ${target.storyId}`)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByText(target.rationale).length).toBeGreaterThan(0)
    const link = screen.getAllByText(`[${target.evidence[0].tier}]`)[0].closest('a')
    expect(link?.getAttribute('href')).toBe(target.evidence[0].url)
  })

  it('auto-expands the row targeted by a #story-<id> hash on mount', () => {
    const target = rows[0]
    window.location.hash = `#story-${target.storyId}`
    renderTable()
    const button = screen.getByLabelText(`Details for story ${target.storyId}`)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByText(target.rationale).length).toBeGreaterThan(0)
  })

  it('filters rows by the text filter', () => {
    renderTable()
    const input = screen.getByLabelText('Filter stories by title, persona, or theme')
    fireEvent.change(input, { target: { value: 'zzz-no-such-story' } })
    expect(screen.getByText(/No stories match/)).toBeDefined()
  })

  it('filters rows by the theme dropdown', () => {
    const { container } = renderTable()
    const themes = [...new Set(rows.map((r) => r.theme))]
    expect(themes.length).toBeGreaterThan(1)
    const select = screen.getByLabelText('Filter stories by theme')
    fireEvent.change(select, { target: { value: themes[0] } })
    const expected = rows.filter((r) => r.theme === themes[0])
    const visible = container.querySelectorAll('tr[id^="story-"]:not([id^="story-details-"])')
    expect(visible.length).toBe(expected.length)
  })

  it('renders the official vendor response block in the expanded row when one exists', () => {
    // software-factory carries the one real seeded response: foreloop / agentic-agent-docs
    // (see data/software-factory/vendor-responses.json and docs/VENDOR-RESPONSES.md).
    const sf = loadCategory('software-factory', path.resolve(__dirname, '../../data'))
    const sfRows = buildStoryVerdictRows(sf, 'foreloop')
    const target = sfRows.find((r) => r.vendorResponse !== null)!
    expect(target.storyId).toBe('agentic-agent-docs')
    render(<StoryVerdictsTable rows={sfRows} />)

    // Collapsed: the block is not in the DOM yet.
    expect(screen.queryByText('Official vendor response')).toBeNull()

    fireEvent.click(screen.getByLabelText(`Details for story ${target.storyId}`))
    expect(screen.getByText('Official vendor response')).toBeDefined()
    expect(screen.getByText('Vendor')).toBeDefined()
    // Statement renders verbatim, in quotes.
    expect(screen.getByText(`“${target.vendorResponse!.statement}”`)).toBeDefined()
    // Verification method + never-changes-a-verdict rule are stated inline.
    expect(screen.getByText(/verified via vendor GitHub org/)).toBeDefined()
    expect(screen.getByText(/never change a verdict by themselves/)).toBeDefined()
    // The fuller-statement link points at the vendor's url.
    expect(screen.getByText('full statement ↗').getAttribute('href')).toBe(target.vendorResponse!.url)
  })

  it('renders no vendor response block for rows without one', () => {
    renderTable()
    const target = rows.find((r) => r.evidence.length > 0)!
    expect(target.vendorResponse).toBeNull()
    fireEvent.click(screen.getByLabelText(`Details for story ${target.storyId}`))
    expect(screen.queryByText('Official vendor response')).toBeNull()
  })

  it('renders tier chips on classified rows only and offers the tier filter', () => {
    // Stamp tiers onto copies of real rows — the annotation layer is optional, so the fixture
    // arena may or may not have been through the classifier; the table must work either way.
    const covered = rows.filter((r) => r.verdict === 'full' || r.verdict === 'partial')
    expect(covered.length).toBeGreaterThan(1)
    const tieredRows = rows.map((r) => {
      if (r.storyId === covered[0].storyId) return { ...r, tier: 'enterprise' as const, tierNote: 'SSO on Enterprise plan only' }
      if (r.storyId === covered[1].storyId) return { ...r, tier: 'unknown' as const }
      return { ...r, tier: undefined, tierNote: undefined }
    })
    const { container } = render(<StoryVerdictsTable rows={tieredRows} />)
    // Exactly one chip: the enterprise cell — unknown and unclassified rows render nothing.
    const chips = screen.getAllByText('enterprise')
    // (one chip + one <option> in the tier filter dropdown)
    const chip = chips.find((el) => el.tagName === 'A')!
    expect(chip).toBeDefined()
    expect(chip.getAttribute('href')).toBe('/methodology#story-tiers')
    expect(chip.getAttribute('title')).toContain('SSO on Enterprise plan only')
    expect(chip.getAttribute('title')).toContain('never affects scores')

    // The tier filter narrows to classified rows of that tier.
    const select = screen.getByLabelText('Filter stories by pricing tier')
    fireEvent.change(select, { target: { value: 'enterprise' } })
    const visible = container.querySelectorAll('tr[id^="story-"]:not([id^="story-details-"])')
    expect(visible.length).toBe(1)
    expect(container.querySelector(`[id="story-${covered[0].storyId}"]`)).not.toBeNull()
  })

  it('renders no tier filter at all when no row is classified', () => {
    renderTable()
    expect(rows.every((r) => r.tier === undefined || r.tier === 'unknown')).toBe(true)
    expect(screen.queryByLabelText('Filter stories by pricing tier')).toBeNull()
  })

  it('hides the Processes column entirely when the prop is absent (8 columns, colSpan 8)', () => {
    const { container } = renderTable()
    expect(screen.queryByText('Processes')).toBeNull()
    expect(container.querySelectorAll('thead th').length).toBe(8)
    // Expanded details row spans the 8 base columns.
    fireEvent.click(screen.getByLabelText(`Details for story ${rows[0].storyId}`))
    expect(container.querySelector(`#story-details-${rows[0].storyId} td`)?.getAttribute('colspan')).toBe('8')
    // The no-match row does too.
    const input = screen.getByLabelText('Filter stories by title, persona, or theme')
    fireEvent.change(input, { target: { value: 'zzz-no-such-story' } })
    expect(screen.getByText(/No stories match/).getAttribute('colspan')).toBe('8')
  })

  it('renders the Processes column when the prop is present: chips, +N overflow, em-dash, colSpan 9', () => {
    const processes = {
      [rows[0].storyId]: [
        { slug: 'run-payroll', title: 'Run payroll', icon: '💸' },
        { slug: 'open-bank-account', title: 'Open bank account', icon: '🏦' },
        { slug: 'track-runway', title: 'Track runway', icon: '📉' },
      ],
    }
    const { container } = render(<StoryVerdictsTable rows={rows} processes={processes} />)
    // Header present, 9 columns.
    expect(screen.getByText('Processes')).toBeDefined()
    expect(container.querySelectorAll('thead th').length).toBe(9)

    // The mapped row: 2 chips linking to /processes/<slug>#steps + a "+1" title-tooltip chip.
    const mappedRow = container.querySelector(`[id="story-${rows[0].storyId}"]`)!
    const chips = [...mappedRow.querySelectorAll('a[href^="/processes/"]')]
    expect(chips.map((a) => a.getAttribute('href'))).toEqual([
      '/processes/run-payroll#steps',
      '/processes/open-bank-account#steps',
    ])
    expect(chips[0].textContent).toContain('Run payroll')
    const overflow = screen.getByText('+1')
    expect(overflow.getAttribute('title')).toBe('Track runway')

    // Every unmapped row renders the honest em-dash.
    const dashes = container.querySelectorAll('td [title="No founder process maps onto this story"]')
    expect(dashes.length).toBe(rows.length - 1)

    // Expanded details row spans all 9 columns.
    fireEvent.click(screen.getByLabelText(`Details for story ${rows[0].storyId}`))
    expect(container.querySelector(`#story-details-${rows[0].storyId} td`)?.getAttribute('colspan')).toBe('9')

    // The no-match row too.
    const input = screen.getByLabelText('Filter stories by title, persona, or theme')
    fireEvent.change(input, { target: { value: 'zzz-no-such-story' } })
    expect(screen.getByText(/No stories match/).getAttribute('colspan')).toBe('9')
  })

  it('re-sorts when a column header is clicked, with aria-sort on the current column', () => {
    renderTable()
    // importance is the default composite sort — no column header carries aria-sort until a
    // column is explicitly clicked.
    const qualityHeader = screen.getByText('Quality').closest('th')
    expect(qualityHeader?.getAttribute('aria-sort')).toBe('none')
    fireEvent.click(screen.getByText('Weight'))
    const weightHeader = screen.getByText('Weight').closest('th')
    expect(weightHeader?.getAttribute('aria-sort')).toBe('descending')
    expect(screen.getByText(/Sorted by/).textContent).toMatch(/weight/)
  })
})
