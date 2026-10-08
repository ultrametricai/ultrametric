// @vitest-environment jsdom
import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RankingsNav, { GLOBAL_RANKINGS, PROCESS_RANKINGS } from '@/components/RankingsNav'

const APP_DIR = path.join(process.cwd(), 'app')

// Every nav entry must have a real static page behind its href, and every ranking page
// directory must be listed in the nav — 1:1, so the Explore menu, the cross-link footer, and
// the filesystem can never drift apart.
describe('ranking lists ↔ pages are 1:1', () => {
  it('every GLOBAL_RANKINGS entry has a page at app<href>/page.tsx', () => {
    for (const r of GLOBAL_RANKINGS) {
      expect(fs.existsSync(path.join(APP_DIR, r.href, 'page.tsx')), r.href).toBe(true)
    }
  })

  it('every PROCESS_RANKINGS entry has a page at app<href>/page.tsx', () => {
    for (const r of PROCESS_RANKINGS) {
      expect(r.href).toBe(`/rankings/processes/${r.id}`)
      expect(fs.existsSync(path.join(APP_DIR, r.href, 'page.tsx')), r.href).toBe(true)
    }
  })

  it('every app/rankings/processes/* page is listed in PROCESS_RANKINGS', () => {
    const dirs = fs
      .readdirSync(path.join(APP_DIR, 'rankings', 'processes'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== '__tests__')
      .map((d) => d.name)
      .sort()
    expect(dirs).toEqual([...PROCESS_RANKINGS.map((r) => r.id)].sort())
  })

  it('every app/rankings/* company page dir is listed in GLOBAL_RANKINGS', () => {
    const dirs = fs
      .readdirSync(path.join(APP_DIR, 'rankings'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'processes')
      .map((d) => d.name)
      .sort()
    expect(dirs).toEqual([...GLOBAL_RANKINGS.map((r) => r.id)].sort())
  })

  it('ids never collide across the two groups (they share the GeoMark seed space)', () => {
    const all = [...GLOBAL_RANKINGS, ...PROCESS_RANKINGS].map((r) => r.id)
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('RankingsNav', () => {
  it('renders BOTH labeled groups — company and process leaderboards', () => {
    render(<RankingsNav current="agentic" />)
    // Each group label wears its house glyph as SVG — never the old 🏢/🔁 emoji or a raw
    // `pi:` token (founder sweep 2026-10-02).
    for (const label of ['Company leaderboards', 'Process leaderboards']) {
      const group = screen.getByText(label)
      expect(group.querySelector('svg')).not.toBeNull()
      expect(group.textContent).not.toMatch(/🏢|🔁|pi:/)
    }
    // Every sibling from both groups is present (selector: GeoMark repeats each name in an
    // SVG <title>, so target the visible link/span only).
    for (const r of [...GLOBAL_RANKINGS, ...PROCESS_RANKINGS]) {
      expect(screen.getByText(r.name, { selector: 'a, span:not(.sr-only)' })).toBeDefined()
    }
  })

  it('marks the current company ranking as quiet text, never a self-link', () => {
    render(<RankingsNav current="agentic" />)
    const current = screen.getByText('Most agent-ready', { selector: 'a, span:not(.sr-only)' })
    expect(current.tagName).toBe('SPAN')
    expect(current.getAttribute('aria-current')).toBe('page')
    // A process ranking is a live link from a company page (the clarity ask: both groups).
    const process = screen.getByRole('link', { name: /Most automatable/ })
    expect(process.getAttribute('href')).toBe('/rankings/processes/most-automatable')
  })

  it('accepts a process ranking id as current', () => {
    render(<RankingsNav current="riskiest" />)
    const current = screen.getByText('Riskiest', { selector: 'a, span:not(.sr-only)' })
    expect(current.tagName).toBe('SPAN')
    // Company rankings stay linked from a process page.
    expect(screen.getByRole('link', { name: /Highest Overall score/ }).getAttribute('href')).toBe('/rankings/init')
  })

  // View-in-repo line (founder 2026-10-08 deep-link audit): each leaderboard links the repo
  // area it is computed from — the whole data tree for cross-arena company rankings, the one
  // arena dir for the arena-scoped law-firms board, the corpus for process leaderboards.
  it('links the repo data area the current leaderboard is computed from', () => {
    const repoHref = () => screen.getByRole('link', { name: /View the evidence in the repo/ }).getAttribute('href')
    const { unmount: u1 } = render(<RankingsNav current="agentic" />)
    expect(repoHref()).toBe('https://github.com/ultrametricai/ultrametric/tree/main/data')
    u1()
    const { unmount: u2 } = render(<RankingsNav current="law-firms" />)
    expect(repoHref()).toBe('https://github.com/ultrametricai/ultrametric/tree/main/data/startup-law-firms')
    u2()
    render(<RankingsNav current="most-automatable" />)
    expect(repoHref()).toBe('https://github.com/ultrametricai/ultrametric/blob/main/processes/corpus.json')
  })
})
