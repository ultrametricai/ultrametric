// @vitest-environment jsdom
// The header's Objects dropdown (founder 2026-10-08): one menu for the object registries —
// Situations, Artifacts, Open documents — in the slot Situations held as a top-level link.
// Pins: the dropdown carries exactly the ObjectsNav entries and routes with the house ArenaMenu
// open/close contract (aria-haspopup/expanded trigger, Escape close); the layout mounts it from
// the shared constants and carries NO residual top-level /situations link; and the ☰ panel
// mirrors the same group from the same list, each destination exactly once.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
}))

import ArenaMenu from '@/components/ArenaMenu'
import MobileNav from '@/components/MobileNav'
import { OBJECTS_ITEMS, OBJECTS_LABEL } from '@/components/ObjectsNav'

const OBJECT_ROUTES = ['/situations', '/artifacts', '/open-documents']

describe('the Objects list (components/ObjectsNav.ts)', () => {
  it('carries Situations, Artifacts, and Open documents, each with its route and an icon', () => {
    expect(OBJECTS_ITEMS.map((i) => i.href)).toEqual(OBJECT_ROUTES)
    expect(OBJECTS_ITEMS.map((i) => i.name)).toEqual(['Situations', 'Artifacts', 'Open documents'])
    for (const item of OBJECTS_ITEMS) expect(item.icon).toMatch(/^pi:/)
  })
})

describe('the desktop Objects dropdown (ArenaMenu mount)', () => {
  function openMenu() {
    const r = render(<ArenaMenu title={OBJECTS_LABEL} items={OBJECTS_ITEMS} />)
    fireEvent.click(screen.getByRole('button', { name: /Objects/ }))
    return r
  }

  it('opens from an aria-haspopup trigger to a menu of the three routes', () => {
    openMenu()
    const trigger = screen.getByRole('button', { name: /Objects/ })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const hrefs = screen.getAllByRole('menuitem').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(OBJECT_ROUTES)
  })

  it('closes on Escape and on selecting an entry (the house dropdown contract)', () => {
    openMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryAllByRole('menuitem')).toEqual([])
    expect(screen.getByRole('button', { name: /Objects/ }).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: /Objects/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Situations/ }))
    expect(screen.queryAllByRole('menuitem')).toEqual([])
  })
})

describe('the header mounts Objects where the Situations link was (app/layout.tsx)', () => {
  const layoutSrc = readFileSync(path.join(__dirname, '..', '..', 'app', 'layout.tsx'), 'utf8')

  it('renders the shared-constant dropdown and no top-level /situations link remains', () => {
    expect(layoutSrc).toContain('<ArenaMenu title={OBJECTS_LABEL} items={OBJECTS_ITEMS} />')
    // Situations reaches the header ONLY through the Objects menu — no duplicate direct link.
    expect(layoutSrc).not.toContain('href="/situations"')
  })
})

describe('the ☰ panel mirrors the Objects group', () => {
  it('shows the Objects section label and each object route exactly once', () => {
    const { container } = render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByText(OBJECTS_LABEL)).toBeTruthy()
    for (const href of OBJECT_ROUTES) {
      expect(container.querySelectorAll(`a[href="${href}"]`)).toHaveLength(1)
    }
    // The group sits in the desktop position: right after Processes, before Technologies.
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs.indexOf('/situations')).toBe(hrefs.indexOf('/processes') + 1)
    expect(hrefs.indexOf('/open-documents')).toBe(hrefs.indexOf('/technologies') - 1)
  })
})
