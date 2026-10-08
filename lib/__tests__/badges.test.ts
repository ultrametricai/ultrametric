import { describe, expect, it } from 'vitest'
// Pure string helpers exported by the badge generator script itself (node, no deps) — the
// same functions main() uses to write public/badges/*.svg.
import { badgeFiles, badgeSvg, certBadgeSvg, textWidth } from '@/scripts/generate-badges.mjs'

describe('textWidth', () => {
  it('is monotonic in string length and integer-valued', () => {
    expect(textWidth('')).toBe(0)
    expect(textWidth('ab')).toBeGreaterThan(textWidth('a'))
    expect(Number.isInteger(textWidth('agent-ready 72/100'))).toBe(true)
  })

  it('counts narrow glyphs as narrower and bold as wider', () => {
    expect(textWidth('ill')).toBeLessThan(textWidth('mww'))
    expect(textWidth('Arena', { bold: true })).toBeGreaterThan(textWidth('Arena'))
  })
})

describe('badgeSvg', () => {
  it('renders a scored badge: emerald panel, rounded score, wordmark', () => {
    const svg = badgeSvg({ label: 'agent-ready', score: 72.4 })
    expect(svg).toContain('agent-ready 72/100')
    expect(svg).toContain('#059669') // emerald right panel
    expect(svg).toContain('#09090b') // zinc-950 left panel
    expect(svg).toContain('>Ultra</text>')
    expect(svg).toContain('>metric</text>')
    expect(svg).toContain('aria-label="Ultrametric: agent-ready 72/100"')
  })

  it('rounds instead of truncating', () => {
    expect(badgeSvg({ label: 'overall score', score: 68.5 })).toContain('overall score 69/100')
  })

  it('renders null scores as an untested zinc badge, never a fake 0', () => {
    const svg = badgeSvg({ label: 'agent-ready', score: null })
    expect(svg).toContain('agent-ready untested')
    expect(svg).toContain('#3f3f46') // zinc panel
    expect(svg).not.toContain('#059669')
    expect(svg).not.toContain('0/100')
  })

  it('is a standalone well-formed SVG document with consistent panel widths', () => {
    const svg = badgeSvg({ label: 'overall score', score: 100 })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    const total = Number(svg.match(/<svg [^>]*width="(\d+)"/)![1])
    const left = Number(svg.match(/<rect width="(\d+)" height="20" fill=/)![1])
    const right = Number(svg.match(/<rect x="\d+" width="(\d+)" height="20" fill=/)![1])
    expect(left + right).toBe(total)
  })
})

describe('certBadgeSvg', () => {
  it('renders an emerald shield with the level and certification year', () => {
    const svg = certBadgeSvg({ level: 'agent-ready', date: '2026-09-08' })
    expect(svg).toContain('CERTIFIED AGENT-READY · 2026')
    expect(svg).toContain('#059669') // always the earned emerald panel — no untested variant
    expect(svg).toContain('aria-label="Ultrametric: CERTIFIED AGENT-READY · 2026"')
    expect(certBadgeSvg({ level: 'agent-native', date: '2027-01-02' })).toContain('CERTIFIED AGENT-NATIVE · 2027')
  })

  it('is a standalone well-formed SVG with consistent panel widths', () => {
    const svg = certBadgeSvg({ level: 'agent-native', date: '2026-09-08' })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    const total = Number(svg.match(/<svg [^>]*width="(\d+)"/)![1])
    const left = Number(svg.match(/<rect width="(\d+)" height="20" fill=/)![1])
    const right = Number(svg.match(/<rect x="\d+" width="(\d+)" height="20" fill=/)![1])
    expect(left + right).toBe(total)
  })
})

describe('badgeFiles', () => {
  it('emits both files for a leaderboard entry', () => {
    const files = badgeFiles('stripe', { agentReady: 77, aiEra: 81.2 })
    expect(files.map(([name]) => name)).toEqual(['stripe-agent-ready.svg', 'stripe-score.svg'])
    expect(files[0][1]).toContain('agent-ready 77/100')
    expect(files[1][1]).toContain('overall score 81/100')
  })

  it('treats a missing leaderboard entry as untested on both axes', () => {
    const files = badgeFiles('ghost', undefined)
    expect(files[0][1]).toContain('agent-ready untested')
    expect(files[1][1]).toContain('overall score untested')
  })
})
