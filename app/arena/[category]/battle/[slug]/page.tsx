import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BattleView from '@/components/BattleView'
import { battleSlug, loadAll, loadCategory, parseBattleSlug, type CategoryData } from '@/lib/data'
import type { BattleRecord, Product } from '@/lib/schemas'
import { SITE_URL } from '@/lib/site'

export function generateStaticParams() {
  return loadAll().flatMap((data) =>
    data.rankings.battles.map((b) => ({ category: data.category.id, slug: battleSlug(b.a, b.b) })),
  )
}

export const dynamicParams = false

// Honest FAQPage JSON-LD, same discipline as the arena page's arenaFaqJsonLd — both answers
// come straight from this battle's own computed record, never a fabricated rating. Ported from
// the retired /vs/{slug} mirror (now a permanent redirect here — see app/vs/[slug]/page.tsx),
// so the surviving URL keeps the structured data.
function battleFaqJsonLd(data: CategoryData, battle: BattleRecord, a: Product, b: Product) {
  const winnerName = battle.winner === 'draw' ? null : battle.winner === a.id ? a.name : b.name
  const record = `${battle.record.aWins}–${battle.record.bWins}${battle.record.draws > 0 ? ` (${battle.record.draws} drawn)` : ''}`
  const url = `${SITE_URL}/arena/${data.category.id}/battle/${battleSlug(battle.a, battle.b)}`
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `${a.name} vs ${b.name}: which is more AI-ready?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: winnerName
            ? `${winnerName} wins the head-to-head ${record} across ${data.category.name}'s agent-tested user stories — see ${url}.`
            : `${a.name} and ${b.name} draw the head-to-head ${record} across ${data.category.name}'s agent-tested user stories.`,
        },
      },
      {
        '@type': 'Question',
        name: 'How is this measured?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Every user story is judged independently for both products using cited evidence (vendor docs, GitHub, community sources, or a hands-on probe) — never opinion — and the higher-scoring product wins that round. See ${SITE_URL}/methodology for the full scoring writeup.`,
        },
      },
    ],
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}): Promise<Metadata> {
  const { category, slug } = await params
  const data = loadCategory(category)
  const pair = parseBattleSlug(slug, data.products)
  if (!pair) return { title: `Battle — ${data.category.name} Arena` }
  const a = data.products.find((p) => p.id === pair.a)!
  const b = data.products.find((p) => p.id === pair.b)!
  const year = new Date().getFullYear()
  return {
    // This page is the canonical head-to-head URL; the old top-level /vs/{slug} mirror now
    // 308s here (app/vs/[slug]/page.tsx), and this title/description moved with it.
    title: `${a.name} vs ${b.name} (${year}): which is more AI-ready? Evidence-tested comparison`,
    description: `Head-to-head, agent-tested comparison of ${a.name} and ${b.name} across ${data.category.name} — Overall score, agent-readiness, business model, vendor claims verified, and every judged round.`,
    alternates: { canonical: `${SITE_URL}/arena/${category}/battle/${slug}` },
  }
}

export default async function BattlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}) {
  const { category, slug } = await params
  const data = loadCategory(category)
  const pair = parseBattleSlug(slug, data.products)
  if (!pair) notFound()
  const battle = data.rankings.battles.find((b) => b.a === pair.a && b.b === pair.b)
  if (!battle) notFound()
  const a = data.products.find((p) => p.id === battle.a)!
  const b = data.products.find((p) => p.id === battle.b)!
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(battleFaqJsonLd(data, battle, a, b)) }}
      />
      <BattleView data={data} battle={battle} />
    </>
  )
}
