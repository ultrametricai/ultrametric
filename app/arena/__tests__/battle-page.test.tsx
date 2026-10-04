// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BattlePage, { generateMetadata } from '@/app/arena/[category]/battle/[slug]/page'
import { battleSlug, loadAll } from '@/lib/data'
import { SITE_URL } from '@/lib/site'

// The battle page is the canonical head-to-head URL since /vs/{slug} became a permanent
// redirect to it (docs/BUILD-SIZE.md round 3): the canonical, the SEO description, and the
// FAQPage JSON-LD the /vs mirror carried all live here now.
describe('/arena/[category]/battle/[slug] as the canonical head-to-head', () => {
  const data = loadAll()[0]
  const battle = data.rankings.battles[0]
  const slug = battleSlug(battle.a, battle.b)
  const params = Promise.resolve({ category: data.category.id, slug })

  it('canonicalizes to itself, not the retired /vs mirror', async () => {
    const metadata = await generateMetadata({ params })
    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/arena/${data.category.id}/battle/${slug}`)
    expect(String(metadata.title)).toContain(' vs ')
    expect(metadata.description).toContain(data.category.name)
  })

  it('renders the FAQPage JSON-LD built from the committed battle record', async () => {
    const { container } = render(await BattlePage({ params }))
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    const jsonLd = JSON.parse(script!.innerHTML)
    expect(jsonLd['@type']).toBe('FAQPage')
    const answer: string = jsonLd.mainEntity[0].acceptedAnswer.text
    const record = `${battle.record.aWins}–${battle.record.bWins}`
    if (battle.winner !== 'draw') {
      expect(answer).toContain(record)
      expect(answer).toContain(`${SITE_URL}/arena/${data.category.id}/battle/${slug}`)
    } else {
      expect(answer).toContain('draw the head-to-head')
    }
  })
})
