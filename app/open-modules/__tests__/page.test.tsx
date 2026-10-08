// @vitest-environment jsdom
// The open-module page family (founder 2026-10-05): /open-modules index + one page per mapped
// lib/openstartup module, rendered against the real committed registry. The load-bearing pin:
// a module's vendor lists are COMPUTED from its processes' step function mappings and the
// covering arenas' committed leaderboards — order and membership must match rankings.json
// exactly (never hand-picked), and the functional description is the README index's committed
// "What it computes" cell.
import { render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OpenModuleDetailPage from '@/app/open-modules/[id]/page'
import OpenModulesPage from '@/app/open-modules/page'
import sitemap from '@/app/sitemap'
import { ARENA_LEADERS_CAP } from '@/lib/arenaLeaders'
import { loadBusinessLogicMap } from '@/lib/businessLogicMap'
import { fieldsConsumedByModule } from '@/lib/companyFields'
import { loadCategory } from '@/lib/data'
import { findOpenModulePage, loadOpenModulePages } from '@/lib/openModulePages'
import { processSlug } from '@/lib/processes'
import { isShutdown } from '@/lib/shutdown'
import { SITE_URL } from '@/lib/site'

// The committed leaderboard leaders an arena should contribute: rankings.json order, shutdown
// products dropped (a derived roster is an offer), capped — recomputed here straight from the
// arena data so the page derivation can never drift from the published ranking.
function committedLeaders(arenaId: string): string[] {
  const data = loadCategory(arenaId)
  return data.rankings.leaderboard
    .filter((e) => {
      const product = data.products.find((p) => p.id === e.productId)
      return product !== undefined && !isShutdown(product)
    })
    .slice(0, ARENA_LEADERS_CAP)
    .map((e) => e.productId)
}

describe('/open-modules index', () => {
  it('lists every mapped module (processes/business-logic-map.json) linking its page, with the committed README "What it computes" description', () => {
    const { container } = render(<OpenModulesPage />)
    const map = loadBusinessLogicMap()
    for (const [id, m] of Object.entries(map)) {
      const link = container.querySelector(`a[href="/open-modules/${id}"]`)
      expect(link, `${id} must link its page`).not.toBeNull()
      expect(link!.textContent).toBe(m.label)
    }
    // The description is the README module index's committed cell, read back — pin one.
    const capTable = findOpenModulePage('capTable')!
    expect(container.textContent).toContain(capTable.computes)
    expect(capTable.computes).toContain('SAFE conversion')
  })
})

describe('/open-modules/[id] — computed vendor derivation', () => {
  const params = (id: string) => Promise.resolve({ id })

  it("capTable: every arena block's vendor list matches that arena's committed leaderboard order exactly (non-vacuous: capTable derives populated arenas)", async () => {
    const mod = findOpenModulePage('capTable')!
    expect(mod.arenas.length).toBeGreaterThan(0)
    const { container } = render(await OpenModuleDetailPage({ params: params('capTable') }))
    for (const arena of mod.arenas) {
      const expected = committedLeaders(arena.arenaId)
      expect(expected.length).toBeGreaterThan(0)
      // The derived list IS the committed leaderboard slice — membership and order.
      expect(arena.leaders.map((l) => l.productId)).toEqual(expected)
      // And the page renders those links in that order.
      const hrefs = [...container.querySelectorAll(`a[href^="/arena/${arena.arenaId}/product/"]`)]
        .map((a) => a.getAttribute('href'))
      expect(hrefs).toEqual(expected.map((pid) => `/arena/${arena.arenaId}/product/${pid}`))
      // Each leader's rendered Overall score is the committed leaderboard number.
      const committed = loadCategory(arena.arenaId).rankings.leaderboard
      for (const leader of arena.leaders) {
        expect(leader.overall).toBe(committed.find((e) => e.productId === leader.productId)!.aiEra)
      }
    }
  })

  it('every module derivation stays on the committed rails: leaders match rankings.json for every mapped module', () => {
    for (const mod of loadOpenModulePages()) {
      for (const arena of mod.arenas) {
        expect(arena.leaders.map((l) => l.productId), `${mod.id}/${arena.arenaId}`).toEqual(
          committedLeaders(arena.arenaId),
        )
      }
    }
  })

  it('capTable links every registry-mapped process page, its README section, and its source file', async () => {
    const map = loadBusinessLogicMap()
    const { container } = render(await OpenModuleDetailPage({ params: params('capTable') }))
    const mod = findOpenModulePage('capTable')!
    expect(mod.processes.map((p) => p.id)).toEqual(map.capTable.processes)
    for (const p of mod.processes) {
      expect(
        container.querySelector(`a[href="${p.href}"]`),
        `${p.id} must link its process page`,
      ).not.toBeNull()
      expect(p.href).toBe(`/processes/${processSlug(p.title)}`)
    }
    expect(container.querySelector(`a[href="${mod.readmeHref}"]`)).not.toBeNull()
    expect(container.querySelector(`a[href="${mod.sourceHref}"]`)).not.toBeNull()
    expect(mod.sourceHref).toContain('lib/openstartup/capTable.ts')
  })

  it('a module with populated covering arenas never renders the empty state', async () => {
    const { container } = render(await OpenModuleDetailPage({ params: params('capTable') }))
    expect(container.textContent).not.toContain('No populated arena covers')
    expect(within(container).getByText('Vendors serving these processes today')).toBeDefined()
  })
})

// The Data fields row (founder 2026-10-07: typed company data fields): the
// processes/company-fields.json fields this module's functions consume, each linking the
// establishing artifact. Registry totality lives in lib/__tests__/companyFields.test.ts.
describe('/open-modules/[id] — data fields it consumes', () => {
  it('runway lists its registered fields with function names and establishing-artifact links', async () => {
    const rows = fieldsConsumedByModule('runway')
    expect(rows.length).toBeGreaterThan(0)
    const { container } = render(
      await OpenModuleDetailPage({ params: Promise.resolve({ id: 'runway' }) }),
    )
    expect(container.textContent).toContain('Data fields it consumes')
    for (const r of rows) {
      expect(container.textContent).toContain(r.field.label)
      expect(container.textContent).toContain(r.functions[0])
      expect(
        container.querySelector(`a[href="${r.artifactHref}"]`),
        `${r.field.id} must link ${r.artifactHref}`,
      ).not.toBeNull()
      // The field label links its /fields specification page (founder 2026-10-08).
      expect(
        container.querySelector(`a[href="/fields/${r.field.id}"]`),
        `${r.field.id} must link its spec page`,
      ).not.toBeNull()
    }
  })

  it('a module with no registered company-level field renders no section', async () => {
    expect(fieldsConsumedByModule('unitEconomics')).toEqual([])
    const { container } = render(
      await OpenModuleDetailPage({ params: Promise.resolve({ id: 'unitEconomics' }) }),
    )
    expect(container.textContent).not.toContain('Data fields it consumes')
  })
})

describe('sitemap registration — open-modules family', () => {
  it('lists the index and one URL per mapped module', () => {
    const urls = new Set(sitemap().map((e) => e.url))
    expect(urls.has(`${SITE_URL}/open-modules`)).toBe(true)
    for (const id of Object.keys(loadBusinessLogicMap())) {
      expect(urls.has(`${SITE_URL}/open-modules/${id}`), id).toBe(true)
    }
  })
})
