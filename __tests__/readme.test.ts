import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// README surface pins (founder batch 2026-10-02): the contribution-guide row, the situations
// surface, the single structural overview, the arena-index rename, and the not-yet-live
// Discord slot. These are source pins (the README is data here), the same pragmatic pattern
// as app/__tests__/layout-footer.test.ts.

const ROOT = path.join(__dirname, '..')
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
const contributing = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING.md'), 'utf8')

describe('README.md (founder batch 2026-10-02)', () => {
  it('carries the contribution-guide row near the top, each link resolving to a real CONTRIBUTING anchor', () => {
    const row = readme.indexOf('**Contribution guides:**')
    expect(row).toBeGreaterThan(-1)
    // Near the top: before the Map of the repo section.
    expect(row).toBeLessThan(readme.indexOf('## Map of the repo'))
    // The four guides, links only, each with a matching anchor in CONTRIBUTING.md.
    for (const anchor of ['add-your-vendor', 'add-a-process', 'add-a-jurisdiction', 'add-an-open-module']) {
      expect(readme).toContain(`(CONTRIBUTING.md#${anchor})`)
      expect(contributing, `CONTRIBUTING.md is missing <a id="${anchor}">`).toContain(`<a id="${anchor}"></a>`)
    }
  })

  it('surfaces situations: a Map lead and a Processes-pillar paragraph, no counts', () => {
    // The reactive layer links both its live index and its repo doctrine.
    expect(readme).toContain('https://ultrametric.ai/situations')
    expect(readme).toContain('processes/SITUATIONS.md')
    // The pillar paragraph names the trigger + urgency model (plain prose, no bold-label
    // scaffolding — AGENTS.md Writing style rule 5).
    const para = readme.indexOf('**situations**, the reactive layer')
    expect(para).toBeGreaterThan(-1)
    const paraText = readme.slice(para, readme.indexOf('\n\n', para))
    expect(paraText).toContain('trigger')
    expect(paraText).toContain('`hours` / `days` / `weeks`')
    // No counts: the number of situations is corpus-owned (processes/SITUATIONS.md), never a
    // hand-maintained README claim.
    expect(paraText).not.toMatch(/\b12\b/)
  })

  it('keeps ONE structural overview: the merged Map owns both tasks and structure', () => {
    expect(readme).toContain('## Map of the repo')
    // Exactly one overview claim: the phrase appears once, and the old Start here
    // section (merged into the Map, founder batch 2026-10-08) is gone.
    expect(readme.indexOf('The single structural overview')).toBe(
      readme.lastIndexOf('The single structural overview'),
    )
    expect(readme.indexOf('The single structural overview')).toBeGreaterThan(-1)
    expect(readme).not.toContain('## Start here')
    // Inbound #start-here deep links keep resolving (Writing style rule 8).
    expect(readme).toContain('<a id="start-here"></a>')
  })

  it('names the arena table for what it shows (renamed from "The arenas", no counts in the heading)', () => {
    expect(readme).toContain('## Rankings index — every market we rank')
    expect(readme).not.toContain('## The arenas')
  })

  it('routes developer setup to CONTRIBUTING instead of carrying its own quickstart block', () => {
    // The README is for people consuming the open repo; the dev commands live in one place.
    expect(readme).not.toContain('## Local development')
    expect(readme).toContain('(./CONTRIBUTING.md#local-setup)')
    expect(contributing).toContain('## Local setup')
    expect(contributing).toContain('pnpm test')
  })

  it('carries the live Discord invite the founder supplied (2026-10-02)', () => {
    expect(readme).toContain('[Discord](https://discord.com/invite/3aHky836qP)')
    expect(readme).not.toContain('TODO(founder): drop the Discord invite URL here')
  })
})

// Founder batch 2026-10-03: worked examples copied from committed data (never invented), and
// the agent-surfaces section pointing only at routes that exist in app/. Same source-pin
// pattern as above: the README is data, the committed corpus is the authority.
type DagNodeRec = { id: string; label: string; route: string; vendorOptions?: string[]; producesArtifact?: string }
type CorpusRec = { id: string; trigger?: string; urgency?: string; dag: { nodes: DagNodeRec[] } }

describe('README.md worked examples (founder batch 2026-10-03)', () => {
  const corpus: CorpusRec[] = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'processes', 'corpus.json'), 'utf8'),
  )
  const byId = (id: string) => corpus.find((t) => t.id === id)!

  it('Processes example: the Incorporate C-Corp step/artifact/vendor-options facts match corpus record form_001', () => {
    const proc = byId('form_001')
    expect(proc).toBeDefined()
    expect(readme).toContain('https://ultrametric.ai/processes/incorporate-c-corp')
    const nodes = proc.dag.nodes
    // The quoted opening step and its vendor options, verbatim from the corpus.
    const n1 = nodes.find((n) => n.id === 'n1')!
    expect(readme).toContain(`"label": "${n1.label}"`)
    expect(readme).toContain(JSON.stringify(n1.vendorOptions).replace(/,/g, ', '))
    // The quoted artifact-producing step.
    const n5 = nodes.find((n) => n.id === 'n5')!
    expect(n5.producesArtifact).toBe('certificate-of-incorporation')
    expect(readme).toContain(`"label": "${n5.label}"`)
    expect(readme).toContain('"producesArtifact": "certificate-of-incorporation"')
    // The artifact exists in the registry the README links.
    const artifacts = JSON.parse(fs.readFileSync(path.join(ROOT, 'processes', 'artifacts.json'), 'utf8'))
    expect(artifacts.artifacts.some((a: { id: string }) => a.id === 'certificate-of-incorporation')).toBe(true)
  })

  it('Situations example: the cease-and-desist trigger, clock, and counsel step match corpus record sit_001', () => {
    const sit = byId('sit_001')
    expect(sit).toBeDefined()
    expect(readme).toContain('https://ultrametric.ai/processes/respond-to-a-cease-and-desist')
    // The trigger and urgency are quoted verbatim, never paraphrased.
    expect(readme).toContain(`"trigger": "${sit.trigger}"`)
    expect(readme).toContain(`"urgency": "${sit.urgency}"`)
    // The counsel step quoted in the snippet exists and stays human-routed.
    const n4 = sit.dag.nodes.find((n) => n.id === 'n4')!
    expect(n4.route).toBe('person')
    expect(readme).toContain(`"label": "${n4.label}"`)
  })

  it('Vendors example: the Stripe payments verdict, story title, and evidence excerpt match the committed data', () => {
    const verdicts: Array<{ productId: string; storyId: string; verdict: string; quality: number; evidenceIds: string[] }> = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data', 'payments', 'verdicts.json'), 'utf8'),
    )
    const cell = verdicts.find((v) => v.productId === 'stripe' && v.storyId === 'accept-card-payment-online')!
    expect(cell).toBeDefined()
    // The verdict facts the README states, pinned to the derived-from-evidence record.
    expect(readme).toContain(`"verdict": "${cell.verdict}"`)
    expect(readme).toContain(`"quality": ${cell.quality}`)
    // The story title is quoted verbatim from the taxonomy.
    const stories: Array<{ id: string; title: string }> = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data', 'payments', 'stories.json'), 'utf8'),
    )
    const story = stories.find((s) => s.id === 'accept-card-payment-online')!
    expect(readme).toContain(story.title)
    // The quoted community excerpt exists in the cited evidence item, and the verdict cites it.
    const evidence: Array<{ id: string; excerpt: string }> = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data', 'payments', 'evidence', 'stripe.json'), 'utf8'),
    )
    const item = evidence.find((e) => e.id === 'stripe-comm-9')!
    expect(item.excerpt).toContain('up and running and accepting recurring payments in less than an hour')
    expect(readme).toContain('up and running and accepting recurring payments in less than\nan hour')
    expect(cell.evidenceIds).toContain('stripe-comm-9')
  })
})

describe('README.md "Use it from an agent" (founder batch 2026-10-03)', () => {
  const section = readme.slice(
    readme.indexOf('## Use it from an agent'),
    readme.indexOf('## Status & roadmap'),
  )

  it('exists, keeps the old anchor, and the top-of-README links point at it', () => {
    expect(section.length).toBeGreaterThan(0)
    // Inbound #for-ai-agents deep links keep resolving (Writing style rule 8).
    expect(readme).toContain('<a id="for-ai-agents"></a>')
    expect(readme).toContain('(#use-it-from-an-agent)')
    expect(readme).not.toContain('## For AI agents')
  })

  it('lists only surfaces whose routes exist in app/ today', () => {
    const surfaces: Array<[string, string]> = [
      ['/llms.txt', path.join('app', 'llms.txt', 'route.ts')],
      ['/openapi.json', path.join('app', 'openapi.json', 'route.ts')],
      ['/search-index.json', path.join('app', 'search-index.json', 'route.ts')],
      ['/feed.xml', path.join('app', 'feed.xml', 'route.ts')],
      ['/processes/{slug}/manifest.json', path.join('app', 'processes', '[slug]', 'manifest.json', 'route.ts')],
      ['/processes/chains/{chain}/manifest.json', path.join('app', 'processes', 'chains', '[chain]', 'manifest.json', 'route.ts')],
      ['/arena/{category}/llms.md', path.join('app', 'arena', '[category]', 'llms.md', 'route.ts')],
      ['/arena/{category}/product/{productId}/llms.md', path.join('app', 'arena', '[category]', 'product', '[id]', 'llms.md', 'route.ts')],
    ]
    for (const [surface, route] of surfaces) {
      expect(section, `section is missing surface ${surface}`).toContain(surface)
      expect(fs.existsSync(path.join(ROOT, route)), `${surface} has no route at ${route}`).toBe(true)
    }
    // The raw committed files the section points at resolve in the repo.
    for (const p of ['data', path.join('processes', 'corpus.json'), path.join('journeys', 'chains.json'), 'rules', 'sources', 'schemas', path.join('docs', 'AFK-HANDOFF.md')]) {
      expect(fs.existsSync(path.join(ROOT, p)), `missing repo path ${p}`).toBe(true)
    }
  })

  it('documents the real CLI/MCP (the shipped ultrametric npm package) and points at /get-started', () => {
    // 2026-10-08: /get-started also appears in the Map's Agent access block (install first),
    // so these pins scope to the section, not the whole README.
    // Correction 2026-10-05: an earlier pass wrongly claimed no CLI existed — the `ultrametric`
    // npm package (CLI + MCP server) shipped 2026-09-30 with /get-started as its install page
    // and lib/ultrametricCli.ts mapping the corpus steps it drives.
    expect(section).toContain('https://ultrametric.ai/get-started')
    expect(section).toContain('lib/ultrametricCli.ts')
    expect(section).not.toContain('no Ultrametric MCP server or CLI today')
    // Install mechanics live on /get-started, not inlined here.
    for (const inlined of ['npx ultrametric', 'claude mcp add', 'pnpm dlx', 'mcp.ultrametric']) {
      expect(section).not.toContain(inlined)
    }
  })
})

describe('README.md agent surfaces: the docs site (founder batch 2026-10-08)', () => {
  const section = readme.slice(
    readme.indexOf('## Use it from an agent'),
    readme.indexOf('## Status & roadmap'),
  )

  it('cites the docs site, its llms.txt, and a per-page .md endpoint (external URLs: presence pins, each verified 200 by curl on 2026-10-08)', () => {
    for (const url of [
      'https://docs.ultrametric.ai',
      'https://docs.ultrametric.ai/llms.txt',
      'https://docs.ultrametric.ai/quickstart.md',
    ]) {
      expect(section, `section is missing docs surface ${url}`).toContain(url)
    }
  })

  it('the self-eval dossier records the docs-site agent surface as a dated addendum', () => {
    const selfEval = fs.readFileSync(path.join(ROOT, 'docs', 'SELF-EVAL.md'), 'utf8')
    expect(selfEval).toContain('## Addendum (2026-10-08)')
    expect(selfEval).toContain('https://docs.ultrametric.ai/llms.txt')
  })
})

// Founder batch 2026-10-08 (second pass): Start here and Map of the repo merged into one
// functional map, no question framing, grouped by functional area with path links and the
// site views folded in. Same source-pin pattern: repo paths must exist, folded destinations
// must survive the merge.
describe('README.md merged map (founder batch 2026-10-08)', () => {
  const map = readme.slice(readme.indexOf('## Map of the repo'), readme.indexOf('\n## Processes'))

  it('sits at the top and carries the functional groups in reading order, no question framing', () => {
    // The map is the first H2 after the intro block.
    expect(readme.indexOf('## Map of the repo')).toBeLessThan(readme.indexOf('\n## Processes'))
    const groups = [
      '**Processes** —',
      '**Vendors** —',
      '**Open modules** —',
      '**Contracts & infrastructure** —',
      '**Agent access** —',
    ]
    let last = -1
    for (const g of groups) {
      const at = map.indexOf(g)
      expect(at, `missing group lead "${g}"`).toBeGreaterThan(-1)
      expect(at, `group "${g}" out of order`).toBeGreaterThan(last)
      last = at
    }
    // No question-styled rows or persona leads survive the merge.
    expect(readme).not.toContain('| The question |')
    expect(readme).not.toContain("**You're a founder")
    expect(readme).not.toContain("**You're an agent")
    expect(readme).not.toContain("**You're a contributor")
    // No hand-maintained counts inside the map (evidence doctrine).
    expect(map).not.toMatch(/~\d/)
  })

  it('every repo path the map links resolves, at post-rename locations (coverage/, not catalog/)', () => {
    for (const p of [
      'processes',
      path.join('processes', 'SITUATIONS.md'),
      path.join('processes', 'artifacts.json'),
      path.join('processes', 'company-fields.json'),
      'journeys',
      'data',
      'vendors',
      'pipeline',
      'rules',
      'sources',
      path.join('open-modules', 'README.md'),
      path.join('lib', 'openstartup'),
      'jurisdictions',
      'open-documents',
      'resources',
      path.join('lore', 'registry.json'),
      'schemas',
      'coverage',
      'templates',
      'fixtures',
      path.join('governance', 'AGENT_POLICY.md'),
      path.join('docs', 'FOUNDER-OPS.md'),
    ]) {
      expect(fs.existsSync(path.join(ROOT, p)), `missing repo path ${p}`).toBe(true)
    }
    expect(map).toContain('(coverage/)')
    expect(readme).not.toContain('(catalog/)')
  })

  it('keeps every site destination folded in from the old Start here table', () => {
    for (const url of [
      'https://ultrametric.ai/processes',
      'https://ultrametric.ai/situations',
      'https://ultrametric.ai/artifacts',
      'https://ultrametric.ai/overall',
      'https://ultrametric.ai/arenas',
      'https://ultrametric.ai/compare',
      'https://ultrametric.ai/stacks',
      'https://ultrametric.ai/arena/government-services',
      'https://ultrametric.ai/open-documents',
      'https://ultrametric.ai/startup-sim',
    ]) {
      expect(map, `map is missing ${url}`).toContain(url)
    }
    for (const route of [
      path.join('app', 'artifacts', 'page.tsx'),
      path.join('app', 'open-documents', 'page.tsx'),
      path.join('app', 'compare'),
      path.join('app', 'arenas'),
      path.join('app', 'stacks'),
      path.join('app', 'startup-sim'),
      path.join('app', 'situations'),
      path.join('app', 'get-started'),
    ]) {
      expect(fs.existsSync(path.join(ROOT, route)), `missing app route ${route}`).toBe(true)
    }
  })

  it('states the shipped geo country set (PT and CA included), not the stale five', () => {
    expect(map).toContain('US · UK · IN · DE · FR · PT · CA')
    expect(readme).not.toContain('(US · UK · IN · DE · FR)')
  })

  it('Agent access leads with the CLI + MCP install, then the keyless curl surfaces', () => {
    const agentBlock = map.slice(map.indexOf('**Agent access** —'))
    const install = agentBlock.indexOf('https://ultrametric.ai/get-started')
    expect(install).toBeGreaterThan(-1)
    expect(agentBlock).toContain('`ultrametric` npm package')
    expect(install).toBeLessThan(agentBlock.indexOf('curl https://'))
    expect(agentBlock).toContain('governance/AGENT_POLICY.md')
  })
})
