import { describe, expect, it } from 'vitest'
import VsPage, { generateStaticParams } from '@/app/vs/[slug]/page'
import { battleSlug, findBattleBySlug, loadAll } from '@/lib/data'

// /vs/{slug} is a prerendered permanent-redirect stub to the arena battle page
// (docs/BUILD-SIZE.md round 3). These pins hold the redirect contract: every generated slug
// 308s to a battle page that actually prerenders, and the slug audit stays true (every /vs
// slug has a battle twin — the build must fail this test, not silently 404, if the corpus
// ever grows a twinless slug).

// permanentRedirect throws an error whose digest is `NEXT_REDIRECT;{type};{url};{status};`
// (next/dist/client/components/redirect-error.js) — parse it rather than mocking the router.
async function redirectTarget(slug: string): Promise<{ url: string; status: number }> {
  try {
    await VsPage({ params: Promise.resolve({ slug }) })
  } catch (error) {
    const digest = (error as { digest?: string }).digest
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT;')) {
      const parts = digest.split(';')
      return { url: parts.slice(2, -2).join(';'), status: Number(parts.at(-2)) }
    }
    throw error
  }
  throw new Error(`/vs/${slug} rendered instead of redirecting`)
}

describe('/vs/[slug] permanent-redirect stub', () => {
  const all = loadAll()

  it('a known slug 308s to its arena battle page', async () => {
    const data = all[0]
    const battle = data.rankings.battles[0]
    const slug = battleSlug(battle.a, battle.b)
    expect(await redirectTarget(slug)).toEqual({
      url: `/arena/${data.category.id}/battle/${slug}`,
      status: 308,
    })
  })

  it('every generated /vs slug has a battle twin whose page prerenders (no twinless slugs)', () => {
    // Audited 2026-10-04: 1,876 battle pages, 1,872 unique /vs slugs — the four extra battle
    // pages are pair-slugs battling in TWO arenas (same two products ranked in both), not /vs
    // slugs without a twin. findBattleBySlug resolves those to the first category in loadAll
    // order, which is the battle the /vs page rendered before it became a redirect.
    const battlePages = new Set(
      all.flatMap((d) => d.rankings.battles.map((b) => `${d.category.id}/${battleSlug(b.a, b.b)}`)),
    )
    const params = generateStaticParams()
    expect(params.length).toBeGreaterThan(0)
    for (const { slug } of params) {
      const found = findBattleBySlug(all, slug)
      expect(found, `/vs/${slug} has no battle twin`).not.toBeNull()
      expect(battlePages.has(`${found!.data.category.id}/${slug}`)).toBe(true)
    }
  })

  it('a two-arena pair-slug redirects to the first category in loadAll order (what /vs rendered)', async () => {
    const bySlug = new Map<string, string[]>()
    for (const d of all) {
      for (const b of d.rankings.battles) {
        const slug = battleSlug(b.a, b.b)
        bySlug.set(slug, [...(bySlug.get(slug) ?? []), d.category.id])
      }
    }
    const dups = [...bySlug.entries()].filter(([, cats]) => cats.length > 1)
    for (const [slug, cats] of dups) {
      expect((await redirectTarget(slug)).url).toBe(`/arena/${cats[0]}/battle/${slug}`)
    }
  })

  it('an unknown slug refuses to redirect (notFound, not a guessed target)', async () => {
    await expect(redirectTarget('not-a-product-vs-nothing')).rejects.toThrow()
  })
})
