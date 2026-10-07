// @vitest-environment jsdom
// The header dropdown's grouped + searchable behavior: section headers render, the pinned
// search filters items live (empty sections disappear), and mouse selection still works.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ArenaMenu, { type ArenaMenuSection } from '@/components/ArenaMenu'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const SECTIONS: ArenaMenuSection[] = [
  { name: 'AI & Agents', items: [{ id: 'ai-coding', name: 'AI Coding Agents', label: 'AI' }] },
  {
    name: 'Fintech & Back Office',
    items: [
      { id: 'payments', name: 'Online Payments', label: 'Payments' },
      { id: 'payroll', name: 'Payroll & HR Ops', label: 'Payroll' },
    ],
  },
]

function openMenu() {
  render(<ArenaMenu sections={SECTIONS} searchable />)
  fireEvent.click(screen.getByRole('button', { name: /Rankings/ }))
}

describe('ArenaMenu (grouped + searchable)', () => {
  it('renders section headers and every item when open', () => {
    openMenu()
    expect(screen.getByText('AI & Agents')).toBeTruthy()
    expect(screen.getByText('Fintech & Back Office')).toBeTruthy()
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })

  it('filters live from the pinned search and hides empty sections', () => {
    openMenu()
    fireEvent.change(screen.getByLabelText('Search rankings'), { target: { value: 'payro' } })
    expect(screen.getAllByRole('menuitem')).toHaveLength(1)
    expect(screen.getByText('Payroll & HR Ops')).toBeTruthy()
    expect(screen.queryByText('AI & Agents')).toBeNull()
  })

  it('shows an honest empty state for a no-match query', () => {
    openMenu()
    fireEvent.change(screen.getByLabelText('Search rankings'), { target: { value: 'zzz' } })
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
    expect(screen.getByText('No matches')).toBeTruthy()
  })

  it('menu items stay clickable links (mouse selection unchanged)', () => {
    openMenu()
    const link = screen.getByText('Online Payments').closest('a')
    expect(link?.getAttribute('href')).toBe('/arena/payments')
    fireEvent.click(link!)
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0) // clicking closes the menu
  })

  it('keeps the flat items mode for the Explore menu', () => {
    render(<ArenaMenu title="Explore" items={[{ id: 'global', name: 'Capability adoption', label: 'stats', href: '/global' }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Explore/ }))
    expect(screen.getByText('Capability adoption').closest('a')?.getAttribute('href')).toBe('/global')
    expect(screen.queryByLabelText('Search explore')).toBeNull() // not searchable unless asked
  })

  it('row layout pin (founder 2026-10-02: right column misaligned under Gateways): centered rows, fixed w-4 icon column, no-wrap shrink-proof label, truncating name', () => {
    // ROOT CAUSE pinned here: items-baseline took the left group's baseline from the SVG icon
    // box (not the name text) and the unguarded label wrapped into a ragged second line once
    // the icon slot's ~24px pushed long name+label rows past the 320px panel ("Browser
    // Automation for Agents" + "BROWSER AGENTS"). The fix: items-center rows, a shrink-0
    // whitespace-nowrap right label (the min-w-0 truncate name gives way instead), and one
    // consistent w-4 shrink-0 icon slot.
    render(
      <ArenaMenu
        sections={[
          {
            name: 'Models & Inference',
            items: [{ id: 'browser-agents', name: 'Browser Automation for Agents', label: 'Browser agents', icon: 'pi:globe:emerald' }],
          },
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Rankings/ }))
    const row = screen.getByRole('menuitem')
    expect(row.className).toContain('items-center')
    expect(row.className).not.toContain('items-baseline')
    const [nameGroup, label] = Array.from(row.children) as HTMLElement[]
    expect(nameGroup.className).toContain('min-w-0')
    expect(label.className).toContain('shrink-0')
    expect(label.className).toContain('whitespace-nowrap')
    const iconSlot = nameGroup.firstElementChild as HTMLElement
    expect(iconSlot.className).toContain('w-4')
    expect(iconSlot.className).toContain('shrink-0')
    expect(screen.getByText('Browser Automation for Agents').className).toContain('truncate')
  })

  it('renders house icon tokens as the custom duotone glyphs — items and section headers alike', () => {
    // The custom-icon upgrade (founder 2026-10-01): a `pi:` token renders the hand-authored SVG
    // via IconGlyph; a plain emoji string keeps rendering as text (two systems coexist).
    const { container } = render(
      <ArenaMenu
        sections={[
          {
            name: 'Fintech & Back Office',
            icon: 'pi:building:sky',
            items: [
              { id: 'startup-banking', name: 'Startup Banking', label: 'Banking', icon: 'pi:bank:emerald' },
              { id: 'legacy', name: 'Legacy Emoji Arena', label: 'legacy', icon: '🏦' },
            ],
          },
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Rankings/ }))
    expect(container.querySelectorAll('svg[data-glyph="bank"]').length).toBe(1) // the item glyph
    expect(container.querySelectorAll('svg[data-glyph="building"]').length).toBe(1) // the section glyph
    expect(container.querySelectorAll('svg[data-glyph="unknown"]').length).toBe(0) // never the placeholder
    expect(screen.getByText('🏦')).toBeTruthy() // emoji passthrough unchanged
  })
})
