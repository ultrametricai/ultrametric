// LatAm candidate triage (maintainer request 2026-10-23: map the agentic vendors for Latin
// American geographies). A maintainer-directed candidate list run through the SAME mechanical
// criteria as the daily radar (radar-triage.ts triageCandidate — docs surface, shipped product,
// founder affiliation, agentic surface, existing-ranking fit), so the dispositions land with the
// same evidence discipline. The one difference from a radar run is the nomination text: these
// candidates were named by the maintainer, so arena matching runs over each product's OWN pages
// instead of a launch-post title — the homepage head text (title + meta description) plus the
// head text of the docs page the homepage itself links (findDocsLink, the same discovery the
// triage uses). The docs head matters here: several LatAm vendors publish Spanish or Portuguese
// homepage metadata, which the English arena vocabulary structurally cannot match, while their
// developer docs are English. Both fetched texts are recorded per disposition.
//
// Output: reports/vendor-radar/<date>-latam-triage.json (TriageReportSchema) + .md. The triage
// creates no rankings; bring-up of passers is a separate, reviewed step.
//
// Invocation: pnpm tsx rankings-engine/scripts/latam-candidate-triage.ts [--date YYYY-MM-DD]
import fs from 'node:fs'
import path from 'node:path'
import { readCategories } from '../paths'
import {
  buildTriageMarkdown, findDocsLink, realTriageIo, triageCandidate, TriageReportSchema, type Disposition,
} from './radar-triage'
import { buildArenaVocab, matchArenas, type RadarCandidate } from './vendor-radar'

const ROOT = path.resolve(__dirname, '..', '..')

// The maintainer's candidate list. Jeeves is deliberately absent: it is already rostered in
// startup-banking (the radar's tracked-vendor dedupe would skip it too); its LatAm availability
// ships as vendor-geo rows instead.
const CANDIDATES: { key: string; name: string; url: string }[] = [
  { key: 'dlocal.com', name: 'dLocal', url: 'https://dlocal.com' },
  { key: 'ebanx.com', name: 'EBANX', url: 'https://www.ebanx.com' },
  { key: 'kushki.com', name: 'Kushki', url: 'https://www.kushki.com' },
  { key: 'pomelo.la', name: 'Pomelo', url: 'https://pomelo.la' },
  { key: 'belvo.com', name: 'Belvo', url: 'https://belvo.com' },
  { key: 'starkbank.com', name: 'Stark Bank', url: 'https://starkbank.com' },
  { key: 'asaas.com', name: 'Asaas', url: 'https://www.asaas.com' },
  { key: 'clara.com', name: 'Clara', url: 'https://www.clara.com' },
  { key: 'contasimples.com', name: 'Conta Simples', url: 'https://contasimples.com' },
  { key: 'openpay.mx', name: 'Openpay', url: 'https://www.openpay.mx' },
  { key: 'mercadopago.com', name: 'Mercado Pago', url: 'https://www.mercadopago.com' },
]

function headText(html: string): string {
  const pick = (re: RegExp) => html.match(re)?.[1] ?? ''
  const title = pick(/<title[^>]*>([^<]*)<\/title>/i)
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || pick(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
  const og = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)
    || pick(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i)
  return [title, desc, og].filter(Boolean).join(' ')
}

async function main(argv: string[]): Promise<void> {
  const dateFlag = argv.indexOf('--date')
  const date = dateFlag === -1 ? new Date().toISOString().slice(0, 10) : argv[dateFlag + 1]
  const categories = readCategories()
  const existingArenas = new Set(categories.map((c) => c.id))
  const arenaDefinitions = new Map<string, string>(categories.map((c) => [c.id, c.description]))
  const sections = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', 'arena-sections.json'), 'utf8')) as {
    sections: { name: string; arenaIds: string[] }[]
  }
  const sectionNameByArena = new Map<string, string>()
  for (const s of sections.sections) for (const a of s.arenaIds) sectionNameByArena.set(a, s.name)
  const vocab = buildArenaVocab(categories, sectionNameByArena)
  const io = realTriageIo()

  const dispositions: Disposition[] = []
  for (const c of CANDIDATES) {
    const page = await io.fetchPage(c.url)
    let text = `${c.name} ${headText(page.html)}`
    const docsLink = findDocsLink(page.html, c.url)
    let docsNote = 'no docs link on homepage'
    if (docsLink) {
      const docsPage = await io.fetchPage(docsLink)
      docsNote = `${docsLink} — HTTP ${docsPage.status}`
      if (docsPage.status === 200) text += ` ${headText(docsPage.html)}`
    }
    const matched = matchArenas(text, vocab)
    const candidate: RadarCandidate = {
      key: c.key,
      name: c.name,
      url: c.url,
      sources: [],
      matchedArenas: matched,
      firstSeen: date,
    }
    const d = await triageCandidate(candidate, existingArenas, io, arenaDefinitions)
    // Record the nomination text so the lexical match is auditable.
    d.evidence.unshift(`nomination text (${c.url} — HTTP ${page.status}; docs head: ${docsNote}): "${text.slice(0, 300)}"`)
    dispositions.push(d)
    console.log(`${c.name}: ${d.status}${d.arena ? ` → ${d.arena}` : ''} (${d.reason.slice(0, 100)})`)
  }

  const report = TriageReportSchema.parse({
    _comment:
      'Generated by rankings-engine/scripts/latam-candidate-triage.ts — maintainer-directed LatAm candidate list run through the radar-triage criteria (policies/AGENT_POLICY.md). Arena matching ran over each product homepage head text, recorded per disposition. The triage creates no rankings; bring-up of passers is a separate, reviewed step.',
    generatedAt: new Date().toISOString(),
    policy: 'policies/AGENT_POLICY.md#vendor-radar-candidate-approval',
    dispositions,
  })
  const outDir = path.join(ROOT, 'reports', 'vendor-radar')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `${date}-latam-triage.json`), JSON.stringify(report, null, 2) + '\n')
  fs.writeFileSync(path.join(outDir, `${date}-latam-triage.md`), buildTriageMarkdown(report) + '\n')
  console.log(`wrote reports/vendor-radar/${date}-latam-triage.{json,md}`)
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
