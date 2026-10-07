import { humanizeTheme } from './icons'
import { CLAIM_STATUSES, claimBucketCounts, claimEntriesByStatus, unmappedClaims } from './claims'
import type { CategoryData } from './data'
import { evidenceById, groupInOrder, verdictFor } from './data'
import { opportunitiesFor } from './opportunities'
import { provenanceLine } from './provenance'
import type { Product, Story } from './schemas'
import type { StoryTier } from './storyTiers'
import { coverageMapFor } from './storyCoverage'
import { parseStoryPersona } from './storyText'
import { strongestEvidence } from './verification'

const CLAIM_STATUS_LABEL: Record<(typeof CLAIM_STATUSES)[number], string> = {
  'claimed-verified': 'Verified',
  'claimed-unverified': 'Unverified',
  'claimed-contradicted': 'Contradicted',
  'delivered-unclaimed': 'Undersold (delivered, never claimed)',
  'unclaimed-none': 'Neither claimed nor delivered',
}

// Pure markdown renderers backing app/arena/[category]/llms.md and
// app/arena/[category]/product/[id]/llms.md — kept out of the route handlers so they're
// trivially unit-testable without going through Next's request/response machinery.

// MCP is two stories, not one: `agentic-mcp-server` (ships an MCP server for other agents to
// connect to) and `agentic-mcp-client` (consumes MCP servers itself). Showing only the
// `-server` verdict here would repeat the wrong-axis mistake for agent products (the product
// IS the agent, so "does it ship a server" is often correctly `na`) — so this mark shows
// whichever of the two verdicts is stronger. See components/AgentAccessGlyphs.tsx for the
// on-site equivalent of this same logic.
const AGENT_ACCESS_STORIES = {
  mcp: ['agentic-mcp-server', 'agentic-mcp-client'],
  cli: ['agentic-official-cli'],
  api: ['agentic-public-api'],
} as const

const VERDICT_RANK: Record<string, number> = { full: 3, partial: 2, disputed: 1, none: 0, na: 0 }

function glyph(verdict: string): string {
  if (verdict === 'full') return '✓'
  if (verdict === 'partial') return '~'
  return '—'
}

function agentAccessMarks(data: CategoryData, productId: string): string {
  return (Object.keys(AGENT_ACCESS_STORIES) as Array<keyof typeof AGENT_ACCESS_STORIES>)
    .map((key) => {
      const storyIds = AGENT_ACCESS_STORIES[key].filter((id) => data.stories.some((s) => s.id === id))
      if (storyIds.length === 0) return `${key.toUpperCase()}:n/a`
      const best = storyIds
        .map((id) => verdictFor(data, productId, id))
        .reduce((a, b) => (VERDICT_RANK[b.verdict] > VERDICT_RANK[a.verdict] ? b : a))
      return `${key.toUpperCase()}:${glyph(best.verdict)}`
    })
    .join(' ')
}

function fmtNum(n: number | null): string {
  return n === null ? 'n/a' : String(n)
}

function businessModelLine(product: Product): string {
  const bm = product.businessModel
  if (!bm) return '_no business model curated_'
  return `${bm.models.join(', ')} — ${bm.summary} ([pricing](${bm.url}))`
}

// Full-arena markdown: leaderboard table, business models, then the grouped story matrix with
// verdicts and each cell's strongest-evidence proof URL.
export function renderArenaMarkdown(data: CategoryData, siteUrl: string): string {
  const { category, products, rankings } = data
  const productById = new Map(products.map((p) => [p.id, p]))
  const evidence = evidenceById(data)

  const lines: string[] = []
  // Provenance header (see lib/provenance.ts) — the fingerprint is the arena's rankings.json
  // watermark, so a republished copy of this markdown still points back at verifiable data.
  lines.push(`<!-- ${provenanceLine(rankings._provenance?.fingerprint)} -->`)
  lines.push('')
  lines.push(`# ${category.name} Ranking`)
  lines.push('')
  lines.push(category.description)
  lines.push('')
  lines.push(
    `${data.stories.length} user stories · ${data.verdicts.length} judged cells · updated ${rankings.generatedAt.slice(0, 10)}. Full methodology: ${siteUrl}/methodology`,
  )
  lines.push('')

  lines.push('## Leaderboard')
  lines.push('')
  lines.push('| Rank | Product | Overall score | Score | Agent-ready | API quality | MCP | CLI | API |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  rankings.leaderboard.forEach((entry, i) => {
    const product = productById.get(entry.productId)!
    const marks = agentAccessMarks(data, entry.productId)
    const markOf = (key: string) => marks.split(' ').find((m) => m.startsWith(`${key}:`))?.split(':')[1] ?? 'n/a'
    lines.push(
      `| ${i + 1} | [${product.name}](${siteUrl}/arena/${category.id}/product/${product.id}) | ${fmtNum(entry.aiEra)} | ${fmtNum(entry.score)} | ${fmtNum(entry.agentReady)} | ${fmtNum(entry.apiQuality)} | ${markOf('MCP')} | ${markOf('CLI')} | ${markOf('API')} |`,
    )
  })
  lines.push('')
  lines.push('Per-product markdown deep-dive: `' + `${siteUrl}/arena/${category.id}/product/{productId}/llms.md` + '`')
  lines.push('')

  lines.push('## Business models')
  lines.push('')
  for (const p of products) {
    lines.push(`- **${p.name}**: ${businessModelLine(p)}`)
  }
  lines.push('')

  lines.push('## Story matrix')
  lines.push('')
  const byTheme = groupInOrder(data.stories, (s) => s.theme)
  for (const [theme, storiesInTheme] of byTheme) {
    lines.push(`### ${humanizeTheme(theme)}`)
    const byGroup = groupInOrder(storiesInTheme, (s) => s.group)
    for (const [group, stories] of byGroup) {
      if (group !== theme) {
        lines.push('')
        lines.push(`#### ${humanizeTheme(group)}`)
      }
      for (const s of stories) {
        // Story heading leads with the action; the persona survives as an explicit labeled
        // field (lib/storyText.ts) — agents get the structured persona without every heading
        // re-opening "As a {persona}, …".
        const parsed = parseStoryPersona(s.title)
        lines.push('')
        lines.push(`**${parsed.action}** (weight ${s.weight} · persona: ${parsed.persona ?? s.persona})`)
        for (const p of products) {
          const v = verdictFor(data, p.id, s.id)
          const proof = strongestEvidence(v, evidence)
          const proofText = proof ? ` — [proof](${proof.url}) (${proof.tier})` : ''
          const quality = v.verdict === 'na' ? '' : ` q${v.quality}/10`
          lines.push(`- ${p.name}: ${v.verdict}${quality}${proofText}`)
        }
      }
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}

// Product deep-dive markdown: every verdict, rationale, and proof URL for one product.
// `tiersByCell` (lib/storyTiers.ts's storyTiersByCell over loadStoryTiers) is optional — same
// tolerant contract as the file itself; when present, classified story lines gain a
// "Pricing tier" field quoting the gating evidence.
export function renderProductMarkdown(
  data: CategoryData,
  productId: string,
  siteUrl: string,
  tiersByCell?: ReadonlyMap<string, StoryTier>,
): string {
  const product = data.products.find((p) => p.id === productId)
  if (!product) throw new Error(`renderProductMarkdown: unknown product ${productId}`)
  const entry = data.rankings.leaderboard.find((e) => e.productId === productId)!
  const rank = data.rankings.leaderboard.indexOf(entry) + 1
  const evidence = evidenceById(data)

  const lines: string[] = []
  lines.push(`<!-- ${provenanceLine(data.rankings._provenance?.fingerprint)} -->`)
  lines.push('')
  lines.push(`# ${product.name} — ${data.category.name} Ranking`)
  lines.push('')
  lines.push(
    `${product.vendor} · ${product.type === 'oss' ? 'open source' : product.type === 'government' ? 'government service' : 'commercial'} · [site](${product.urls.site}) · [full ranking](${siteUrl}/arena/${data.category.id}/llms.md)`,
  )
  lines.push('')
  lines.push(
    `Rank #${rank} · Overall score ${fmtNum(entry.aiEra)} · Score ${fmtNum(entry.score)} · Agent-ready ${fmtNum(entry.agentReady)} · Built-in AI ${fmtNum(entry.agenticApp)} · API quality ${fmtNum(entry.apiQuality)} · ${entry.applicable}/${entry.total} stories applicable`,
  )
  lines.push('')
  lines.push(`Business model: ${businessModelLine(product)}`)
  lines.push('')

  const linkPairs = Object.entries(product.links ?? {}).filter(([, v]) => v)
  if (linkPairs.length > 0) {
    lines.push(`Links: ${linkPairs.map(([k, v]) => `[${k}](${v})`).join(' · ')}`)
    lines.push('')
  }

  if (product.install && product.install.length > 0) {
    lines.push('## Install')
    lines.push('')
    lines.push('Vendor-official one-liners — verify before piping any script to a shell.')
    for (const entry of product.install) {
      lines.push('')
      lines.push(`${entry.label}${entry.url ? ` ([docs](${entry.url}))` : ''}:`)
      lines.push('```')
      lines.push(entry.command)
      lines.push('```')
    }
    lines.push('')
  }

  // Top improvement opportunities (lib/opportunities.ts) — the vendor's own to-do list, derived
  // purely from the judged verdicts below, so a vendor's agent reading this file finds "what
  // would move our scores" without parsing the whole matrix. Compact top-3 here; the product
  // page's Opportunities section has the full capped list.
  const report = opportunitiesFor(data, productId)
  if (report.total > 0) {
    const top = report.opportunities.slice(0, 3)
    lines.push('## Top opportunities')
    lines.push('')
    lines.push(
      `What would move ${product.name}'s scores, from its own judged verdicts (${report.total} stories with headroom; ranked by story weight × (10 − quality), agentic stories boosted):`,
    )
    lines.push('')
    for (const o of top) {
      const q = o.verdict === 'partial' ? ` q${o.quality}/10` : ''
      lines.push(`- **${o.title}** — ${o.verdict}${q} · moves ${o.scoreLever} · ${o.why}`)
    }
    lines.push('')
    lines.push(
      `Verdicts wrong? Flag them or publish a vendor response — see ${siteUrl}/methodology. Scores move when the evidence does.`,
    )
    lines.push('')
  }

  lines.push('## Story verdicts')
  const byTheme = groupInOrder<Story>(data.stories, (s) => s.theme)
  for (const [theme, storiesInTheme] of byTheme) {
    lines.push('')
    lines.push(`### ${humanizeTheme(theme)}`)
    const byGroup = groupInOrder<Story>(storiesInTheme, (s) => s.group)
    for (const [group, stories] of byGroup) {
      if (group !== theme) {
        lines.push('')
        lines.push(`#### ${humanizeTheme(group)}`)
      }
      for (const s of stories) {
        const v = verdictFor(data, productId, s.id)
        const proof = strongestEvidence(v, evidence)
        // Same de-framing as the arena markdown above: action as the heading, persona as a
        // labeled bullet so agents keep the field without the repetitive prefix.
        const parsed = parseStoryPersona(s.title)
        lines.push('')
        lines.push(`**${parsed.action}**`)
        lines.push(`- Persona: ${parsed.persona ?? s.persona}`)
        const quality = v.verdict === 'na' ? '' : ` — quality ${v.quality}/10`
        lines.push(`- Verdict: ${v.verdict}${quality} (confidence: ${v.confidence})`)
        // Pricing-tier annotation, only where the classifier found stated gating — 'unknown'
        // entries and unclassified arenas emit nothing (absence is absence, never "free").
        const tier = tiersByCell?.get(`${productId}:${s.id}`)
        if (tier && tier.tier !== 'unknown') {
          lines.push(`- Pricing tier: ${tier.tier}${tier.tierNote ? ` — ${tier.tierNote}` : ''}`)
        }
        lines.push(`- Rationale: ${v.rationale}`)
        if (proof) lines.push(`- Proof: [${proof.tier}](${proof.url})`)
        if (v.evidenceIds.length > 0) {
          const cites = v.evidenceIds
            .map((id) => evidence.get(id))
            .filter((e): e is NonNullable<typeof e> => e !== undefined)
            .map((e) => `[${e.tier}](${e.url})`)
            .join(', ')
          lines.push(`- Cited evidence: ${cites}`)
        }
      }
    }
  }

  // Coverage map (lib/storyCoverage.ts): which docs area / API section / community source the
  // cited evidence behind each covered verdict came from — the inverse index agents want
  // ("the API reference alone covers 14 stories"). Pure derivation from the citations above.
  const coverage = coverageMapFor(data, productId)
  if (coverage.length > 0) {
    lines.push('')
    lines.push('## Coverage')
    lines.push('')
    lines.push(
      'Evidence surfaces behind the covered (full/partial/disputed) verdicts above, most-covering first — clustered by evidence URL host + first path segment.',
    )
    lines.push('')
    for (const c of coverage) {
      lines.push(
        `- Coverage: [${c.label}](${c.url}) → ${c.storyIds.length} ${c.storyIds.length === 1 ? 'story' : 'stories'} (strongest tier: ${c.tier})`,
      )
    }
  }

  const claims = data.claims[productId] ?? []
  if (claims.length > 0) {
    const counts = claimBucketCounts(data, productId)
    const storyById = new Map(data.stories.map((s) => [s.id, s]))
    lines.push('')
    lines.push('## Claims vs evidence')
    lines.push('')
    lines.push(
      `${claims.length} distinct capability claims found in ${product.name}'s own claimed-docs/GitHub materials, reconciled against our judge's independent verdicts.`,
    )
    lines.push('')
    lines.push(
      CLAIM_STATUSES.filter((s) => s !== 'unclaimed-none')
        .map((s) => `${CLAIM_STATUS_LABEL[s]} ${counts[s]}`)
        .join(' · '),
    )
    for (const status of CLAIM_STATUSES) {
      if (status === 'unclaimed-none') continue
      const entries = claimEntriesByStatus(data, productId, status)
      if (entries.length === 0) continue
      lines.push('')
      lines.push(`### ${CLAIM_STATUS_LABEL[status]} (${entries.length})`)
      for (const { claim, storyId } of entries) {
        const story = storyById.get(storyId)!
        const v = verdictFor(data, productId, storyId)
        const claimText = claim ? `"${claim.text}" — ` : ''
        lines.push(`- ${claimText}${parseStoryPersona(story.title).action} → ${v.verdict}${v.verdict === 'na' ? '' : ` q${v.quality}/10`}`)
      }
    }
    const unmapped = unmappedClaims(data, productId)
    if (unmapped.length > 0) {
      lines.push('')
      lines.push(`### Claims outside our story set (${unmapped.length})`)
      lines.push('Real capability claims with no matching story in this ranking\'s taxonomy yet — feedback on the taxonomy, not the product.')
      for (const c of unmapped) {
        lines.push(`- "${c.text}" — [source](${c.url})`)
      }
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}
