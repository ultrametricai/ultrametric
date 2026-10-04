// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Home from '@/app/page'
import { battleSlug, leadingBattle, loadAll } from '@/lib/data'
import { isHardwareClass } from '@/lib/megaTable'

// Founder batch 2026-09-30, item 1: the /overall Leading-battles strip drops its explainer
// line and swaps the win-count for a PODIUM — ① winner / ② runner-up, straight from the
// COMMITTED judged battle.winner (HONESTY DOCTRINE: display only, nothing recomputed).
describe('/overall Leading battles podium (founder 2026-09-30)', () => {
  it('drops the "Every arena\'s #1 vs #2 …" explainer line', () => {
    render(<Home />)
    expect(screen.queryByText(/Every arena.s #1 vs #2/)).toBeNull()
    // The section heading itself survives.
    expect(screen.getByText('Leading battles')).toBeDefined()
  })

  it('every battle card podiums the committed judged winner as ① (listed first) over ② — no win counts', () => {
    const { container } = render(<Home />)
    const battled = loadAll().filter((d) => !isHardwareClass(d))
    expect(battled.length).toBeGreaterThan(0)
    let decidedCards = 0
    for (const data of battled) {
      const battle = leadingBattle(data)
      if (!battle) continue
      const card = container.querySelector(
        `a[href="/arena/${data.category.id}/battle/${battleSlug(battle.a, battle.b)}"]`,
      )
      expect(card).not.toBeNull()
      const text = card!.textContent ?? ''
      // The old "· 2–1" record count no longer renders anywhere on the card.
      expect(text).not.toMatch(/\d+–\d+/)
      if (battle.winner === 'draw') {
        expect(text).toContain('Draw')
        expect(text).not.toContain('①')
      } else {
        decidedCards++
        const winner = data.products.find((p) => p.id === battle.winner)!
        // ① before ② …
        expect(text.indexOf('①')).toBeGreaterThan(-1)
        expect(text.indexOf('①')).toBeLessThan(text.indexOf('②'))
        // … and the ① segment carries the COMMITTED winner's name + the "winner" tag.
        const topRow = text.slice(text.indexOf('①'), text.indexOf('②'))
        expect(topRow).toContain(winner.name)
        expect(topRow.toLowerCase()).toContain('winner')
        // The runner-up segment is tagged too.
        expect(text.slice(text.indexOf('②')).toLowerCase()).toContain('runner-up')
      }
    }
    // The pin is only meaningful if at least one decided battle rendered.
    expect(decidedCards).toBeGreaterThan(0)
  })
})
