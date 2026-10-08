import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DOCS_URL, REPO } from '@/lib/site'

// The sitewide footer lives inline in RootLayout — an async server component that fetches the
// GitHub star count and builds the full search index, and whose root element is <html> (invalid
// to nest inside a jsdom render container) — so these pins read the source, the same pragmatic
// pattern as the other source-asserting tests in this repo.
const layoutSrc = readFileSync(path.join(__dirname, '..', 'layout.tsx'), 'utf8')

describe('shared Docs links', () => {
  it.each(['header', 'footer'])('links the live docs site from the %s', (element) => {
    const section = layoutSrc.slice(layoutSrc.indexOf(`<${element}`), layoutSrc.indexOf(`</${element}>`))
    const anchors = section.match(/<a\s[^>]*href=\{DOCS_URL\}[^>]*>\s*Docs\s*<\/a>/g)
    expect(DOCS_URL).toBe('https://docs.ultrametric.ai')
    expect(anchors).toHaveLength(1)
    expect(anchors![0]).toContain('target="_blank"')
    expect(anchors![0]).toContain('rel="noopener noreferrer"')
    if (element === 'header') {
      expect(anchors![0]).toContain('hidden shrink-0')
      expect(anchors![0]).toContain('sm:flex')
    }
  })
})

describe('sitewide footer (app/layout.tsx)', () => {
  it('carries the GitHub repo link with the mark + "GitHub ↗" label (founder 2026-09-30)', () => {
    // The footer link row is everything after the <footer element.
    const footer = layoutSrc.slice(layoutSrc.indexOf('<footer'))
    expect(footer).toContain('GitHub ↗')
    // Same destination as the header's star chip: the open startup repo, via the single
    // REPO constant (lib/site.ts) — never a hardcoded duplicate.
    expect(footer).toContain('https://github.com/${REPO}')
    expect(REPO).toBe('ultrametricai/ultrametric')
    // The GitHub mark (the 16×16 octocat path) renders next to the label.
    expect(footer).toContain('M8 0C3.58 0 0 3.58 0 8c0 3.54')
    // External link hygiene on the GitHub anchor itself.
    const anchorStart = footer.lastIndexOf('<a', footer.indexOf('GitHub ↗'))
    const anchor = footer.slice(anchorStart, footer.indexOf('GitHub ↗'))
    expect(anchor).toContain('target="_blank"')
    expect(anchor).toContain('rel="noopener noreferrer"')
  })

  it('links the live Discord invite in the footer (founder supplied 2026-10-02)', () => {
    const footer = layoutSrc.slice(layoutSrc.indexOf('<footer'))
    expect(footer).toContain('href="https://discord.com/invite/3aHky836qP"')
    expect(footer).not.toContain('DISCORD_INVITE_URL')
  })

  it('carries ONE muted disclaimer line near the © line, linking /terms (founder liability pass 2026-10-02)', () => {
    const footer = layoutSrc.slice(layoutSrc.indexOf('<footer'))
    // The exact line — research content, not advice — still the quietest readable line (contrast
    // pass 3, founder 2026-10-08: zinc-600 is decorative-chrome-only, so the disclaimer sits at
    // the zinc-500 fine-print tier, nothing louder than text-xs).
    const lineIdx = footer.indexOf('Research content — not legal, tax, or financial advice. See')
    expect(lineIdx).toBeGreaterThan(-1)
    const block = footer.slice(footer.lastIndexOf('<p', lineIdx), footer.indexOf('</p>', lineIdx))
    expect(block).toContain('text-xs text-zinc-500')
    expect(block).toContain('href="/terms"')
    // It sits in the © column, next to the copyright line.
    expect(footer.indexOf('© 2026 Ultrametric.')).toBeLessThan(lineIdx)
  })
})

describe('header GitHub links (app/layout.tsx)', () => {
  const header = layoutSrc.slice(layoutSrc.indexOf('<header'), layoutSrc.indexOf('</header>'))
  const chipStart = header.indexOf(`href={\`https://github.com/\${REPO}\`}`)
  const chip = header.slice(chipStart, header.indexOf('</a>', chipStart))

  it('the desktop chip is icon-only (founder 2026-10-08: drop the word "GitHub") and desktop-only', () => {
    expect(chipStart).toBeGreaterThan(-1)
    expect(chip).toContain('hidden shrink-0 items-center')
    expect(chip).toContain('sm:flex')
    // Icon only: the octocat mark with no visible label — the accessible name is the aria-label.
    expect(chip).toContain('M8 0C3.58 0 0 3.58 0 8c0 3.54')
    expect(chip).toContain('aria-label="Ultrametric on GitHub"')
    expect(chip).not.toContain('>GitHub<')
    expect(chip).not.toContain('font-mono')
  })

  it('renders a compact mobile-only GitHub mark top-right (founder 2026-10-01)', () => {
    // The mobile mark: icon-only, visible below sm, hidden from sm up — the desktop chip's
    // counterpart so the repo stays one tap away on phones. It is the SECOND "Ultrametric on
    // GitHub" anchor: the desktop chip carries the same accessible name since it went
    // icon-only (founder 2026-10-08).
    const markIdx = header.indexOf('aria-label="Ultrametric on GitHub"', chipStart + chip.length)
    expect(markIdx).toBeGreaterThan(-1)
    const anchorStart = header.lastIndexOf('<a', markIdx)
    const anchor = header.slice(anchorStart, header.indexOf('</a>', markIdx))
    expect(anchor).toContain('sm:hidden')
    expect(anchor).toContain('https://github.com/${REPO}')
    // The same octocat mark as the chip/footer — no star count, no border chip, just the mark.
    expect(anchor).toContain('M8 0C3.58 0 0 3.58 0 8c0 3.54')
    expect(anchor).toContain('target="_blank"')
    expect(anchor).toContain('rel="noopener noreferrer"')
  })
})
