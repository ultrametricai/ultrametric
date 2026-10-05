// @vitest-environment jsdom
// Founder batch 2026-10-02: the "Best by user type" cards keep each persona's WINNER only —
// the runner-up line and the "N {persona} stories scored" caption are display-removed.
// lib/personaStacks.ts still computes runnerUp/storyCount (data untouched), so these pins
// assert a real suppression against an arena whose computed results carry both.
import { render } from '@testing-library/react'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import PersonaStacksSection from '@/components/PersonaStacksSection'
import { loadCategory } from '@/lib/data'
import { allPersonaStacks } from '@/lib/personaStacks'

const DATA_DIR = path.resolve(__dirname, '../../data')

// Any committed arena where at least one persona has both a winner and a runner-up — so the
// absence pins below can't pass vacuously on an empty section.
function arenaWithRunnerUp() {
  for (const id of ['ai-coding', 'startup-banking', 'vector-databases', 'desktop-os']) {
    const data = loadCategory(id, DATA_DIR)
    const results = allPersonaStacks(data).filter((r) => r.winner !== null)
    if (results.some((r) => r.runnerUp !== null)) return { data, results }
  }
  throw new Error('corpus must contain an arena with a persona runner-up')
}

describe('PersonaStacksSection (founder 2026-10-02: winner only)', () => {
  it('renders each persona card with its winner and score', () => {
    const { data, results } = arenaWithRunnerUp()
    const { container } = render(<PersonaStacksSection data={data} />)
    expect(container.textContent).toContain('Best by user type')
    const productById = new Map(data.products.map((p) => [p.id, p]))
    for (const r of results) {
      expect(container.textContent).toContain(`Best for ${r.persona}`)
      expect(container.textContent).toContain(productById.get(r.winner!.productId)!.name)
    }
  })

  it('renders no runner-up line (the lib still computes it — display only)', () => {
    const { data, results } = arenaWithRunnerUp()
    expect(results.some((r) => r.runnerUp !== null)).toBe(true)
    const { container } = render(<PersonaStacksSection data={data} />)
    expect(container.textContent).not.toContain('Runner-up')
  })

  it('renders no "N {persona} stories scored" caption', () => {
    const { data } = arenaWithRunnerUp()
    const { container } = render(<PersonaStacksSection data={data} />)
    expect(container.textContent).not.toMatch(/stor(y|ies) scored/)
  })
})
