// Dead citation links from the monthly citation-link check (site issue "Citation links:
// monthly check"), re-verified on 2026-11-18. Every URL below answered HTTP 404 that day.
//
// The check samples ranking evidence, so each affected product's whole roster and evidence
// pack was re-fetched. Open WebUI's sampled dead link turned out to be one page of a removed
// docs section: every docs.openwebui.com/ecosystem/computer/* page answers 404.
//
// Three kinds of change, applied to roster input and evidence input only. Verdicts and
// rankings come from the scoped engine run that follows (crawl, extract, judge --product,
// derive).
//
// - MOVED: the excerpt is a verbatim substring of the page's current location. The row keeps
//   its id and excerpt; url moves, fetchedAt restamps to the verification time, and the stale
//   sourceHash is dropped so the extract stage stamps the current source.
// - WITHDRAWN: the excerpt is on no current page. The row is removed.
// - RESTATED: the dead page has a direct successor that makes the same claim in new words.
//   The old row is withdrawn and a new row carries the successor's verbatim sentence under a
//   fresh id (changed source content gets a new id, the normalize-refresh-evidence convention).
//
// The script fetches each target page through the crawl stage's own fetcher and converter and
// fails closed unless every MOVED and RESTATED excerpt passes the extract stage's substring
// check (evidence-source.mjs sourceText). Idempotent.
//
// flutterwave (payments): developer.flutterwave.com/reference/introduction-1 is now
//   developer.flutterwave.com/api ("API Introduction"). flutterwave-docs-6 is verbatim there.
//   docs-4, docs-5 and docs-7 were reworded on the new page and are restated as docs-29..31.
// rainforest (marketplace-payments): docs/understanding-deposits.md is now docs/deposits.md.
//   rainforest-docs-7 dropped the link target the page carries, so it is restated as docs-40
//   with the sentence as the page serves it.
// open-webui (self-hosted-assistants): the Open WebUI Computer docs left docs.openwebui.com
//   (no /ecosystem/computer path in its sitemap or llms.txt; openwebui.com/computer redirects
//   to /open-terminal). None of the 24 excerpts from those pages appears on any page in the
//   current sitemap, or in the open-webui/computer README, changelog or manifesto, so all 24
//   are withdrawn. The roster swaps the dead pages for the docs that now cover agent and
//   computer use (Open Terminal, Tether, connect-an-agent, OpenAPI tool servers) and the
//   Computer repository README, which is the remaining reachable source for that component.
//   features/extensibility/pipelines also answers 404 and has no successor page; it leaves
//   the roster (no evidence row cited it).
//
// Usage: pnpm tsx rankings-engine/scripts/fix-dead-citation-links-2026-11-18.ts
import fs from 'node:fs'
import path from 'node:path'
import { EvidenceSchema, ProductSchema, type Evidence } from '../../lib/schemas'
import { sourceText } from '../evidence-source.mjs'
import { fetchWithRetry, htmlToMarkdown } from '../fetch-page'
import { categoryDir, writeJson } from '../paths'

const VERIFIED_AT = '2026-11-18T00:00:00.000Z' // the day the pages and excerpts were verified

const OWUI = 'https://docs.openwebui.com'
const OWUI_COMPUTER = `${OWUI}/ecosystem/computer`

type Fix = {
  arena: string
  product: string
  roster: { remove: string[]; replace: Record<string, string>; add: string[] }
  moved: { id: string; from: string; to: string }[]
  withdrawn: { id: string; from: string }[]
  restated: { id: string; replaces: string; url: string; excerpt: string }[]
}

const FLW_OLD = 'https://developer.flutterwave.com/reference/introduction-1'
const FLW_NEW = 'https://developer.flutterwave.com/api'
const RF_OLD = 'https://docs.rainforestpay.com/docs/understanding-deposits.md'
const RF_NEW = 'https://docs.rainforestpay.com/docs/deposits.md'

const FIXES: Fix[] = [
  {
    arena: 'payments',
    product: 'flutterwave',
    roster: { remove: [], replace: { [FLW_OLD]: FLW_NEW }, add: [] },
    moved: [{ id: 'flutterwave-docs-6', from: FLW_OLD, to: FLW_NEW }],
    withdrawn: [4, 5, 7].map((n) => ({ id: `flutterwave-docs-${n}`, from: FLW_OLD })),
    restated: [
      { id: 'flutterwave-docs-29', replaces: 'flutterwave-docs-4', url: FLW_NEW, excerpt: 'Responses are **JSON**.' },
      {
        id: 'flutterwave-docs-30',
        replaces: 'flutterwave-docs-5',
        url: FLW_NEW,
        excerpt:
          'The [Postman collection](https://www.postman.com/lively-zodiac-773579/flutterwave-api/collection/9qa6trt/flutterwave-v3) lets you call the API without writing code.',
      },
      {
        id: 'flutterwave-docs-31',
        replaces: 'flutterwave-docs-7',
        url: FLW_NEW,
        excerpt: 'If you are adding Flutterwave to an existing website builder, use a plugin from the same directory.',
      },
    ],
  },
  {
    arena: 'marketplace-payments',
    product: 'rainforest',
    roster: { remove: [], replace: { [RF_OLD]: RF_NEW }, add: [] },
    moved: [],
    withdrawn: [{ id: 'rainforest-docs-7', from: RF_OLD }],
    restated: [
      {
        id: 'rainforest-docs-40',
        replaces: 'rainforest-docs-7',
        url: RF_NEW,
        excerpt:
          'For **Active** merchants, the deposit frequency can be updated by setting the new deposit frequency on the [Update merchant](https://docs.rainforestpay.com/reference/update_merchant) endpoint.',
      },
    ],
  },
  {
    arena: 'self-hosted-assistants',
    product: 'open-webui',
    roster: {
      remove: [
        `${OWUI_COMPUTER}/quickstart`,
        `${OWUI_COMPUTER}/ai`,
        `${OWUI_COMPUTER}/ai/skills-and-memory`,
        `${OWUI_COMPUTER}/ai/subagents`,
        `${OWUI_COMPUTER}/ai/approvals-and-plan-mode`,
        `${OWUI_COMPUTER}/ai/chat-features`,
        `${OWUI_COMPUTER}/ai/coding-agents`,
        `${OWUI_COMPUTER}/ai/connect-a-model`,
        `${OWUI_COMPUTER}/ai/voice-and-audio`,
        `${OWUI_COMPUTER}/ai/web-search-and-browsing`,
        `${OWUI_COMPUTER}/automate/scheduled-tasks`,
        `${OWUI_COMPUTER}/automate/tool-servers`,
        `${OWUI_COMPUTER}/reference/gateway-api`,
        `${OWUI_COMPUTER}/reference/cli`,
        `${OWUI_COMPUTER}/use-cases/supervise-a-coding-agent`,
        `${OWUI_COMPUTER}/use-cases/an-agent-that-learns-your-way`,
        `${OWUI_COMPUTER}/use-cases/parallel-agents-on-worktrees`,
        `${OWUI}/features/extensibility/pipelines`,
      ],
      replace: {},
      add: [
        `${OWUI}/ecosystem/open-terminal`,
        `${OWUI}/ecosystem/tether`,
        `${OWUI}/features/open-terminal/`,
        `${OWUI}/features/open-terminal/coding-agents`,
        `${OWUI}/getting-started/quick-start/connect-an-agent`,
        `${OWUI}/features/extensibility/plugin/tools/openapi-servers`,
        'https://raw.githubusercontent.com/open-webui/computer/HEAD/README.md',
      ],
    },
    moved: [],
    withdrawn: (
      [
        [4, 'automate/tool-servers'],
        [10, 'ai/subagents'],
        [11, 'ai/skills-and-memory'],
        [12, 'quickstart'],
        [13, 'use-cases/supervise-a-coding-agent'],
        [14, 'automate/scheduled-tasks'],
        [31, 'automate/scheduled-tasks'],
        [33, 'reference/gateway-api'],
        [34, 'ai/connect-a-model'],
        [35, 'ai/coding-agents'],
        [36, 'use-cases/parallel-agents-on-worktrees'],
        [37, 'ai/approvals-and-plan-mode'],
        [38, 'reference/cli'],
        [42, 'use-cases/an-agent-that-learns-your-way'],
        [44, 'ai/voice-and-audio'],
        [56, 'quickstart'],
        [57, 'ai/skills-and-memory'],
        [58, 'ai/subagents'],
        [59, 'use-cases/supervise-a-coding-agent'],
        [60, 'ai'],
        [61, 'ai/approvals-and-plan-mode'],
        [62, 'ai/chat-features'],
        [63, 'ai/voice-and-audio'],
        [64, 'ai/web-search-and-browsing'],
      ] as [number, string][]
    ).map(([n, page]) => ({ id: `open-webui-docs-${n}`, from: `${OWUI_COMPUTER}/${page}` })),
    restated: [],
  },
]

const pages = new Map<string, string>()
async function page(url: string): Promise<string> {
  const cached = pages.get(url)
  if (cached !== undefined) return cached
  const raw = await fetchWithRetry(url)
  const text: string = sourceText(/\.(md|txt|ya?ml|json)$/i.test(new URL(url).pathname) ? raw : htmlToMarkdown(raw))
  pages.set(url, text)
  return text
}
async function requireVerbatim(id: string, url: string, excerpt: string): Promise<void> {
  if (!(await page(url)).includes(sourceText(excerpt))) throw new Error(`${id}: excerpt is not verbatim at ${url}`)
}

async function apply(fix: Fix): Promise<void> {
  const dir = categoryDir(fix.arena)

  const rosterFile = path.join(dir, 'products.json')
  const rosterText = fs.readFileSync(rosterFile, 'utf8')
  const roster = ProductSchema.array().parse(JSON.parse(rosterText))
  const product = roster.find((p) => p.id === fix.product)
  if (!product) throw new Error(`unknown product ${fix.arena}/${fix.product}`)
  const gone = new Set(fix.roster.remove)
  const extra = (product.urls.extra ?? []).filter((url) => !gone.has(url)).map((url) => fix.roster.replace[url] ?? url)
  for (const url of fix.roster.add) if (!extra.includes(url)) extra.push(url)
  for (const url of [...Object.values(fix.roster.replace), ...fix.roster.add]) await page(url) // must be reachable
  product.urls.extra = extra
  // Re-read as plain JSON so fields outside this product keep their exact committed shape.
  const plain = JSON.parse(rosterText) as { id: string; urls: { extra?: string[] } }[]
  plain.find((p) => p.id === fix.product)!.urls.extra = extra
  writeJson(rosterFile, plain)

  const evidenceFile = path.join(dir, 'evidence', `${fix.product}.json`)
  let rows = EvidenceSchema.array().parse(JSON.parse(fs.readFileSync(evidenceFile, 'utf8')))
  const byId = new Map(rows.map((row) => [row.id, row]))

  for (const { id, from, to } of fix.moved) {
    // After the move, normalize-refresh-evidence rekeys the row to `${id}-refresh-<digest>`.
    if (rows.some((item) => item.id.startsWith(`${id}-refresh-`) && item.url === to)) continue
    const row = byId.get(id)
    if (!row) throw new Error(`${id}: missing`)
    if (row.url === to) continue
    if (row.url !== from) throw new Error(`${id}: expected ${from}, found ${row.url}`)
    await requireVerbatim(id, to, row.excerpt)
    row.url = to
    row.fetchedAt = VERIFIED_AT
    delete row.sourceHash
  }
  for (const { id, from } of fix.withdrawn) {
    const row = byId.get(id)
    if (!row) continue
    if (row.url !== from) throw new Error(`${id}: expected ${from}, found ${row.url}`)
    rows = rows.filter((item) => item.id !== id)
  }
  const added: Evidence[] = []
  for (const { id, url, excerpt } of fix.restated) {
    if (byId.has(id)) continue
    await requireVerbatim(id, url, excerpt)
    added.push({ id, tier: 'claimed-docs', url, excerpt, fetchedAt: VERIFIED_AT })
  }
  // Extract-stage order: claimed-docs and github rows first, then community and probe rows.
  const docs = rows.filter((row) => row.tier === 'claimed-docs' || row.tier === 'github')
  const rest = rows.filter((row) => row.tier !== 'claimed-docs' && row.tier !== 'github')
  writeJson(evidenceFile, [...docs, ...added, ...rest])
  console.log(`${fix.arena}/${fix.product}: ${fix.moved.length} moved, ${fix.withdrawn.length} withdrawn, ${fix.restated.length} restated`)
}

async function main(): Promise<void> {
  const only = process.argv[2]
  for (const fix of FIXES) if (!only || only === fix.product) await apply(fix)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
