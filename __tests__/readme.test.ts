import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProcesses } from '@/lib/processes'

import { GEO_COUNTRIES, GEO_PREF_META } from '../lib/geoPreference'

// README structure pins (founder rounds 2-3, 2026-10-12): the preserved intro block, the
// compressed section order (no Trust section; artifacts directly after modules with the docs
// catalog folded inside; country switch and getting-acquired as Example subsections), the
// one-liner-per-section format, the section-guide tables, the plain-language vocabulary bar,
// the compact generated blocks, and the committed media. The README is data; these are
// source pins.

const ROOT = path.join(__dirname, '..')
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
const contributing = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING.md'), 'utf8')

// The intro ("what we are making here and motivations") is preserved byte-for-byte from the
// pre-rewrite README; edits to it are a founder decision, not a lane decision.
// Rewritten in founder round 9 (authorized intro edit, PR #278): short founder-written
// intro with no prose links, a Discord button directly under the banner, and the separate
// "Community:" line removed (the button supersedes it). The layout tree, legacy anchor,
// and demo gif placement are unchanged.
// Round 10 (founder-ordered folder renames): the tree reads the open- folder names,
// leads with open-processes / open-rankings / open-modules, adds open-startup-sim/, and
// is an HTML <pre> block so each folder with a matching README section links its anchor
// (a fenced code block cannot carry links).
// Founder visual+language batch (2026-10-14): the founder-authorized vocabulary sweep
// ("episodes" banned; "records" and "every X" rewritten in plain alternatives) reaches
// into the motto and the layout tree, and the supported-countries line sits directly
// above the demo gif (globe first, then the geo switcher's country set, US first).
// Fold (2026-10-14): citations/ dissolved into open-law/ and open-lore/, so its tree
// line is gone, and governance/ was renamed policies/ (the founder-specified last line,
// keeping the └── connector).
// Skew audit (2026-10-14): tree lines widened to match folder contents — open-processes
// also holds the situations, open-law the distilled laws (LAWS.md), open-lore the
// stories, lib the simulator code. The motto and intro paragraph stay founder-locked.
const INTRO = [
  '![Ultrametric](assets/banner.svg)',
  '',
  '[![Discord](https://img.shields.io/badge/Discord-Join_the_community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/3aHky836qP)',
  '',
  '**The open repo for the whole startup journey in the agentic era.**',
  '',
  "Navigate all business processes, compare and select AI native vendors, inform yourself on startup lore, run open modules to become vendor free, save money using open documentation. Help future founders by making PRs to the open artifacts, gaps in open documents or improve the open module logic. Let's make it easy to start and run a startup around the world.",
  '',
  '<pre>',
  'ultrametric/',
  '├── <a href="#open-vendor-rankings">open-rankings</a>/      per-market products, stories, evidence, verdicts',
  '├── <a href="#open-processes">open-processes</a>/     founder processes and situations as routed, timed steps',
  '├── <a href="#open-modules">open-modules</a>/       worked guides to each startup calculation',
  '├── <a href="#open-startup-simulator">open-startup-sim</a>/   what the simulator runs and assumes',
  '├── <a href="#open-law">open-law</a>/           startup legal rules by jurisdiction, the distilled laws',
  '├── <a href="#open-lore">open-lore</a>/          founder advice and stories, who said it, the reading library',
  '├── <a href="#open-docs">open-documents</a>/     openly published legal documents, by use case',
  '├── <a href="#open-artifacts">open-artifacts</a>/     the business objects processes exchange, with field standards',
  '├── rankings-engine/    the code that crawls, probes, judges, scores',
  '├── lib/                loaders, scoring, the calculation and simulator code',
  '├── jurisdictions/      country and state data, vendor availability',
  '├── coverage/           what each area covers and what is missing',
  '├── schemas/            the JSON shape each data file validates against',
  '└── policies/           how records are reviewed and what agents may do here',
  '</pre>',
  '',
  '<!-- Legacy anchor: external links to #start-here predate the merge into this map. -->',
  '<a id="start-here"></a>',
  '',
  'Supporting founders globally: 🌐 🇺🇸 🇬🇧 🇮🇳 🇩🇪 🇫🇷 🇵🇹 🇨🇦 🇳🇿 🇦🇺',
  '',
  '[![A tour of ultrametric.ai at 4x: the simulator founding a company, a process page, a vendor page, a situation, the overall rankings, government services, and open documents](assets/readme/demo.gif)](https://ultrametric.ai)',
].join('\n')

// The founder-specified section order (round 3): artifacts directly after modules with the
// docs catalog folded inside, country-switch and getting-acquired framed as examples.
// Round 9: the "The open startup repo" preamble section was removed; the intro now leads
// straight into Open vendor rankings.
// Round 10: the "Open skills for startups" section was removed (founder call); the
// agent-skills market stays reachable through the rankings index.
const SECTIONS = [
  '## Open vendor rankings',
  '## Open processes',
  '## Open modules',
  '## Open artifacts',
  // Round 10: "Situations" joins the open- family as "Open situations"; the legacy
  // #situations anchor keeps resolving.
  '## Open situations',
  '## Open lore',
  '## Open law',
  '## Government services and startups',
  '## Startup ecosystem',
  '## Open startup simulator',
  // Round 12 (founder 2026-10-15): two lifecycle stages shown as cross-area indexes.
  '## Stages',
  '## Install Ultrametric into your agent',
  '## License',
]

// Demoted to subsections inside their parent sections (founder rounds 2 and 3).
const SUBSECTIONS: Array<[string, string]> = [
  ['## Open processes', '### Examples'],
  ['## Open modules', '### Shared data fields'],
  ['## Open artifacts', '### Open docs'],
  ['## Open situations', '### Example: Founder country switch'],
  ['## Open lore', '### Example: Getting acquired'],
  // Round 11 (founder 2026-10-15): the law section shows the geo scoping, the lifecycle
  // grouping of the distilled laws, and one rule cross-linked through process and module.
  ['## Open law', '### Example: The 83(b) election'],
  ['## Stages', '### Stage: Formation'],
  ['## Stages', '### Stage: Growth'],
]

const sectionBody = (heading: string) => {
  const start = readme.indexOf(heading) + heading.length
  const idx = SECTIONS.indexOf(heading)
  const end = idx === SECTIONS.length - 1 ? readme.length : readme.indexOf(SECTIONS[idx + 1])
  return readme.slice(start, end)
}

describe('README.md structure (founder round 2, 2026-10-12)', () => {
  it('opens with the preserved intro block, byte-for-byte', () => {
    expect(readme.startsWith(INTRO)).toBe(true)
  })

  it('carries exactly the specified sections, in order, and no Trust section', () => {
    const headings = readme.split('\n').filter((l) => l.startsWith('## '))
    expect(headings).toEqual(SECTIONS)
    expect(readme).not.toContain('\n## Trust')
  })

  it('each demoted area lives as a subsection inside its parent section', () => {
    for (const [parent, sub] of SUBSECTIONS) {
      const body = sectionBody(parent)
      expect(body, `${sub} missing from ${parent}`).toContain(sub)
    }
    // Demoted areas are gone from the top level.
    // Round 10: '## Situations' joined the gone list when the section took its open- name.
    for (const gone of ['## Founder country switch', '## Getting acquired', '## Open data structure', '## Situations', '## Open docs']) {
      expect(readme).not.toContain(`\n${gone} `)
      expect(readme).not.toContain(`\n${gone}\n`)
    }
  })

  it('every section leads with a prose one-liner paragraph, not a table or list', () => {
    for (const heading of SECTIONS) {
      const firstLine = sectionBody(heading)
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0 && !l.startsWith('<a id=') && !l.startsWith('<!--'))
      expect(firstLine, `${heading} must open with prose`).toBeDefined()
      expect(firstLine!.startsWith('|'), `${heading} opens with a table`).toBe(false)
      expect(firstLine!.startsWith('- '), `${heading} opens with a list`).toBe(false)
      expect(firstLine!.startsWith('!['), `${heading} opens with an image before its one-liner`).toBe(false)
    }
  })

  it('the demo gif sits under the intro with no heading or caption, mp4 committed unnarrated', () => {
    const beforeFirstSection = readme.slice(0, readme.indexOf('\n## '))
    expect(beforeFirstSection).toContain('assets/readme/demo.gif')
    expect(readme).not.toContain('## Video demo')
    expect(readme).not.toContain('demo.mp4')
    // The full recording stays committed for native upload later.
    expect(fs.existsSync(path.join(ROOT, 'assets', 'readme', 'demo.mp4'))).toBe(true)
  })

  it('the intro carries no duplicate links (image wraps excluded)', () => {
    // Clickable images are the display layer; the dedup rule governs prose links.
    // Founder round 9: the intro is prose-only with no links, so this guards against
    // future duplicates rather than requiring any.
    const intro = readme
      .slice(0, readme.indexOf('\n## '))
      .replace(/\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)/g, '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    const dests = [...intro.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1])
    expect(new Set(dests).size, `duplicate intro links: ${dests.join(', ')}`).toBe(dests.length)
  })

  it('the intro layout tree lists real top-level folders, open catalogs first, linked to their sections', () => {
    // Round 10: the tree is an HTML <pre> block (a fenced code block cannot carry links);
    // each folder with a matching README section links its anchor, the rest stay plain.
    const intro = readme.slice(0, readme.indexOf('\n## '))
    const tree = intro.slice(intro.indexOf('<pre>'), intro.indexOf('</pre>'))
    // Classic waterfall form: a root line, ├── branch connectors, └── on the last entry.
    expect(tree).toContain('\nultrametric/\n')
    expect(tree).toMatch(/\n└── /)
    const rows = [...tree.matchAll(/^[├└]── (?:<a href="#([a-z-]+)">)?([a-z][a-z-]*)(?:<\/a>)?\/ +\S/gm)].map(
      (m) => ({ anchor: m[1] ?? null, dir: m[2] }),
    )
    // The founder-specified order: the open catalogs people come for first (rankings
    // leading, founder 2026-10-15), policies last.
    expect(rows.map((r) => r.dir)).toEqual([
      'open-rankings', 'open-processes', 'open-modules', 'open-startup-sim',
      'open-law', 'open-lore', 'open-documents', 'open-artifacts',
      'rankings-engine', 'lib', 'jurisdictions', 'coverage', 'schemas', 'policies',
    ])
    // Every README anchor a heading or explicit <a id> establishes (GitHub slug form).
    const slug = (h: string) => h.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-')
    const anchors = new Set([
      ...[...readme.matchAll(/^#{2,3} (.+)$/gm)].map((m) => slug(m[1])),
      ...[...readme.matchAll(/<a id="([a-z-]+)"><\/a>/g)].map((m) => m[1]),
    ])
    for (const { anchor, dir } of rows) {
      expect(
        fs.existsSync(path.join(ROOT, dir)) && fs.statSync(path.join(ROOT, dir)).isDirectory(),
        `layout tree lists ${dir}/ but no such top-level folder exists`,
      ).toBe(true)
      if (anchor) {
        expect(anchors.has(anchor), `tree links ${dir}/ to #${anchor} but no such anchor resolves`).toBe(true)
      } else {
        // Plain-text folders stay unlinked because no section covers them.
        expect(anchors.has(dir), `tree leaves ${dir}/ unlinked but #${dir} resolves to a section`).toBe(false)
      }
    }
  })

  it('the supported-countries line sits directly above the demo gif and matches the geo switcher', () => {
    // Founder visual+language batch (2026-10-14): globe first, then the full GEO_COUNTRIES
    // set in switcher order (US first). The line is plain prose, no heading.
    const line = `Supporting founders globally: 🌐 ${GEO_COUNTRIES.map((c) => GEO_PREF_META[c].flag).join(' ')}`
    expect(readme).toContain(`\n${line}\n\n[![A tour of ultrametric.ai`)
  })

  it('the Government services and Startup ecosystem sections carry their live-board screenshots', () => {
    expect(sectionBody('## Government services and startups')).toContain(
      '](assets/readme/government-services.png)](https://ultrametric.ai/arena/government-services)',
    )
    expect(sectionBody('## Startup ecosystem')).toContain(
      '](assets/readme/law-firms.png)](https://ultrametric.ai/rankings/law-firms)',
    )
  })

  it('the Getting acquired example names the playbook gap without linking coverage/', () => {
    const at = readme.indexOf('### Example: Getting acquired')
    expect(at).toBeGreaterThan(-1)
    const body = readme.slice(at, readme.indexOf('\n## ', at))
    expect(body).toContain('open gap')
    expect(body).not.toContain('](coverage/')
  })

  it('every screenshot is a clickable link to the live page it shows', () => {
    const embeds = [...readme.matchAll(/!\[[^\]]*\]\(assets\/readme\/[^)]+\)/g)]
    const wrapped = [...readme.matchAll(/\[!\[[^\]]*\]\(assets\/readme\/[^)]+\)\]\((https:\/\/ultrametric\.ai[^)]*)\)/g)]
    expect(embeds.length).toBeGreaterThan(0)
    expect(wrapped.length, 'an image under assets/readme/ is not wrapped in a live-site link').toBe(embeds.length)
  })

  it('both Example subsections use the bulleted link format', () => {
    for (const sub of ['### Examples', '### Example: Founder country switch']) {
      const at = readme.indexOf(sub)
      expect(at).toBeGreaterThan(-1)
      const body = readme.slice(at, readme.indexOf('\n#', at + sub.length))
      expect(body, `${sub} carries no bulleted example links`).toMatch(/\n- \[[^\]]+\]\(https:\/\/ultrametric\.ai\/processes\//)
    }
  })

  it('uses plain language: no insider vocabulary anywhere on the page', () => {
    // 'episodes' joined the list in the founder visual+language batch (2026-10-14).
    for (const banned of ['corpus', 'interchange', 'disposition', 'manifest', 'taxonomy', 'HMAC', 'DAG', 'provenance', 'episodes']) {
      expect(readme.toLowerCase(), `README contains banned word "${banned}"`).not.toContain(banned.toLowerCase())
    }
  })

  it('avoids "record(s)" and "every X" constructions (founder sweep, 2026-10-14)', () => {
    // Soft sweep: plain alternatives ("the processes", "any verdict", "each data file")
    // replaced them throughout; no exception survived, so the allowed list is empty.
    // The intro is byte-pinned above (its founder-specified policies/ tree line carries
    // "records"), so the sweep scans everything after it.
    const allowed: string[] = []
    const hits = [...readme.replace(INTRO, '').matchAll(/\b(records?|every)\b/gi)]
      .map((m) => m[0])
      .filter((w) => !allowed.includes(w))
    expect(hits, `README uses swept vocabulary: ${hits.join(', ')}`).toEqual([])
  })

  it('per-directory doc surfaces carry no hand-written catalog counts', () => {
    // Founder truth pass (2026-10-14): descriptive counts in prose go stale the moment
    // content grows, so the no-counts rule extends to the open-* doc surfaces. Generated
    // marker blocks are computed and stay; this scans only the hand-written remainder.
    const surfaces = [
      'open-modules/README.md', 'open-processes/README.md', 'open-processes/SITUATIONS.md',
      'open-rankings/README.md',
      'open-documents/README.md', 'open-law/README.md', 'open-lore/LORE.md',
      'open-startup-sim/README.md', 'open-artifacts/README.md', 'coverage/README.md',
      'policies/README.md', 'policies/AGENT_POLICY.md', 'policies/REVIEW_POLICY.md',
      'rankings-engine/README.md',
    ]
    const countPattern = /\b\d[\d,]* (rankings|products|verdicts|arenas|processes|markets|situations|modules|documents|cards|records)\b/
    for (const file of surfaces) {
      const text = fs
        .readFileSync(path.join(ROOT, file), 'utf8')
        // Strip generated blocks (<!-- x:start ... --> … <!-- x:end -->); their counts are computed.
        .replace(/<!--[^>]*:start[^>]*-->[\s\S]*?<!--[^>]*:end[^>]*-->/g, '')
      const hit = text.match(countPattern)
      expect(hit, `${file} carries a hand-written count: "${hit?.[0]}"`).toBeNull()
    }
  })

  it('prose carries no counts and no dates anywhere on the page', () => {
    // The last generated count block (the arenas line) was retired in the founder's
    // rankings-examples order (2026-10-14), so the no-counts gate scans the whole page.
    // scripts/update-readme-stats.mjs (`pnpm stats`) applies the same rule as a CLI gate.
    expect(readme).not.toMatch(/\b\d[\d,]* (rankings|products|verdicts|arenas|processes|markets)\b/)
    expect(readme).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/)
  })
})

describe('README.md section-guide tables (founder round 2)', () => {
  it('Open modules carries the grouped module tables with a row per mapped module', () => {
    const section = sectionBody('## Open modules')
    // Founder round 8: two columns (sources moved to prose), and "409A sanity" reads "409A".
    // Founder catalog order (2026-10-14): the table splits into the committed groups and
    // gains the machine-owned Serves column (drift-gated in
    // lib/__tests__/businessLogicServes.test.ts; cells written by
    // scripts/generate-business-logic-serves.ts).
    expect(section).toContain('| Module | What it computes | Serves |')
    expect(section).not.toContain('Source it cites')
    expect(section).not.toContain('409A sanity')
    expect(section).toContain('| [409A](open-modules/README.md#409a-grant-sanity)')
    const map = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'open-processes', 'business-logic-map.json'), 'utf8'),
    ) as { modules: Record<string, { anchor: string; group: string }> }
    const anchors = Object.values(map.modules).map((m) => m.anchor)
    expect(anchors.length).toBeGreaterThan(0)
    for (const anchor of anchors) {
      expect(section, `module table is missing a link to #${anchor}`).toContain(
        `](open-modules/README.md#${anchor})`,
      )
    }
    for (const group of new Set(Object.values(map.modules).map((m) => m.group))) {
      expect(section, `module catalog is missing the group heading ${group}`).toContain(`### ${group}`)
    }
  })

  it('the Open docs subsection carries the category table covering every registry use_case, with a gaps column', () => {
    const section = sectionBody('## Open artifacts')
    // Founder round 8: the Gaps column is gone; gaps live in the catalog prose.
    expect(section).toContain('| Category | Example documents |')
    expect(section).not.toContain('| Gaps |')
    const registry = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'open-documents', 'registry.json'), 'utf8'),
    ) as { documents: Array<{ use_case: string }> }
    const useCases = [...new Set(registry.documents.map((d) => d.use_case))]
    expect(useCases.length).toBeGreaterThan(0)
    for (const useCase of useCases) {
      const row = section
        .split('\n')
        .find((l) => l.toLowerCase().startsWith(`| ${useCase} `.toLowerCase()))
      expect(row, `docs table is missing category ${useCase}`).toBeDefined()
      // Founder round 5: every example-document cell links its real publisher destination.
      expect(row, `docs row ${useCase} has no publisher link`).toMatch(/\]\(https:\/\//)
    }
  })

  it('the Open lore table rows match open-lore/library.json sections, each example URL a committed entry', () => {
    const section = sectionBody('## Open lore')
    expect(section).toContain('| Section | What it teaches | Example entry |')
    const library = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'open-lore', 'library.json'), 'utf8'),
    ) as { sections: Array<{ title: string; covers: string }>; entries: Array<{ url: string }> }
    expect(library.sections.length).toBeGreaterThan(0)
    for (const s of library.sections) {
      expect(section, `lore table is missing section ${s.title}`).toContain(`| ${s.title} | ${s.covers} |`)
    }
    // One row per library section, and every example link is a committed library entry.
    const rows = section
      .split('\n')
      .filter((l) => l.startsWith('| ') && !l.startsWith('| Section') && !l.startsWith('| ---'))
    expect(rows.length).toBe(library.sections.length)
    const urls = new Set(library.entries.map((e) => e.url))
    for (const row of rows) {
      const link = row.match(/\]\((https:\/\/[^)]+)\)/)
      expect(link, `lore row carries no example link: ${row.slice(0, 50)}`).toBeTruthy()
      expect(urls.has(link![1]), `example URL is not a library entry: ${link![1]}`).toBe(true)
    }
  })
})

describe('README.md retired generated blocks', () => {
  it('carries no generated count blocks; the stats line, arenas line, badge row, and CI badge are gone', () => {
    // Founder round 8 removed the stats line and badge row; the rankings-examples order
    // (2026-10-14) retired the arenas line in favor of the curated example list below.
    for (const gone of [
      '<!-- stats:start -->', '<!-- stat-badges:start -->',
      '<!-- arenas:start -->', '<!-- arenas:end -->', 'badge.svg',
    ]) {
      expect(readme).not.toContain(gone)
    }
    // Founder round 9: the single shields.io exception is the Discord button under the banner.
    const shields = [...readme.matchAll(/https:\/\/img\.shields\.io\/[^)\s]+/g)].map((m) => m[0])
    expect(shields).toEqual([
      'https://img.shields.io/badge/Discord-Join_the_community-5865F2?style=for-the-badge&logo=discord&logoColor=white',
    ])
  })

  it('the vendor-rankings section carries the curated example list and the full-index link', () => {
    // The founder's picks (rankings-examples order, 2026-10-14), all verified 200 on the
    // live site that day. Each bullet links one judged market; the ids pin to the
    // committed categories below.
    const section = sectionBody('## Open vendor rankings')
    const bullets = [...section.matchAll(/^- \[[^\]]+\]\(https:\/\/ultrametric\.ai\/arena\/([a-z-]+)\) — \S/gm)]
    expect(bullets.map((m) => m[1])).toEqual(['startup-banking', 'equity-management', 'legal-ops', 'payments', 'email-marketing', 'crm', 'government-services'])
    const categories = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'open-rankings', 'categories.json'), 'utf8'),
    ) as Array<{ id: string }>
    const ids = new Set(categories.map((c) => c.id))
    for (const m of bullets) {
      expect(ids.has(m[1]), `example ranking ${m[1]} is not a committed category`).toBe(true)
    }
    expect(section).toContain('https://ultrametric.ai/arenas')
    // The founder's vocabulary rule: prose says rankings or markets; "arenas" appears only
    // inside URLs, never as a displayed word.
    const prose = section.replace(/\(https:\/\/[^)]+\)/g, '').replace(/\]\([^)]*\)/g, '')
    expect(prose.toLowerCase()).not.toContain('arena')
  })
})

describe('README.md anchors and links', () => {
  it('keeps every legacy inbound anchor resolving (Writing style rule 8)', () => {
    for (const id of [
      'start-here', 'processes', 'vendors', 'business-logic', 'situations',
      'add-your-country-or-state', 'open-docs', 'for-ai-agents', 'use-it-from-an-agent',
      'install-ultrametric',
    ]) {
      expect(readme, `missing anchor #${id}`).toContain(`<a id="${id}"></a>`)
    }
    // #open-modules resolves through its heading.
    expect(readme).toContain('\n## Open modules')
  })

  it('every CONTRIBUTING.md anchor the README links exists', () => {
    // Founder 2026-10-15: only the vendor call-to-action stays on the front page.
    for (const anchor of ['add-your-vendor']) {
      expect(readme).toContain(`(CONTRIBUTING.md#${anchor})`)
      expect(contributing, `CONTRIBUTING.md is missing <a id="${anchor}">`).toContain(`<a id="${anchor}"></a>`)
    }
    // Round 10: the Add a jurisdiction link left the country-switch example (founder call);
    // CONTRIBUTING.md keeps the guide and its anchor for direct links.
    expect(readme).not.toContain('(CONTRIBUTING.md#add-a-jurisdiction)')
    expect(contributing).toContain('<a id="add-a-jurisdiction"></a>')
  })

  it('every repo path the README links resolves', () => {
    const repoLinks = [...readme.matchAll(/\]\((?!https?:)(?!#)(?:\.\/)?([^)]+?)(?:#[^)]*)?\)/g)]
      .map((m) => m[1])
      .filter((p) => !p.startsWith('mailto:'))
    expect(repoLinks.length).toBeGreaterThan(0)
    for (const p of repoLinks) {
      expect(fs.existsSync(path.join(ROOT, p)), `missing repo path ${p}`).toBe(true)
    }
  })
})

describe('README.md examples pin to the committed records', () => {
  type CorpusRec = { id: string; title: string }
  const corpus: CorpusRec[] = loadProcesses(path.join(ROOT, 'open-rankings'))
  // Mirrors lib/processes.ts processSlug.
  const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  it('the three example links resolve to real processes via their derived slugs', () => {
    // Founder round 4: the formal picks — Incorporate C-Corp, Get a 409A valuation,
    // Set up mailing address (all three verified 200 on the live site, 2026-10-12).
    for (const id of ['form_001', 'fund_003', 'qs_044']) {
      const rec = corpus.find((t) => t.id === id)
      expect(rec, `corpus record ${id} missing`).toBeDefined()
      expect(readme).toContain(`https://ultrametric.ai/processes/${slug(rec!.title)}`)
    }
  })
})

describe('README.md media', () => {
  it('every committed image and recording the README embeds exists on disk', () => {
    const media = [...readme.matchAll(/\]\((assets\/[^)]+)\)/g)].map((m) => m[1])
    expect(media.length).toBeGreaterThan(0)
    for (const p of media) {
      expect(fs.existsSync(path.join(ROOT, p)), `missing media file ${p}`).toBe(true)
    }
  })

  it('each screenshot stays under the 300KB budget and the gif under 5MB', () => {
    const dir = path.join(ROOT, 'assets', 'readme')
    for (const file of fs.readdirSync(dir)) {
      const size = fs.statSync(path.join(dir, file)).size
      if (file.endsWith('.png')) expect(size, `${file} over 300KB`).toBeLessThan(300 * 1024)
      if (file.endsWith('.gif')) expect(size, `${file} over 5MB`).toBeLessThan(5 * 1024 * 1024)
    }
  })

  it('every embedded image is wide enough that GitHub renders them all at equal full width', () => {
    // GitHub caps rendered images at the markdown container (~1012px); anything at or over
    // that renders edge to edge, so the gif and the screenshots display at the same width
    // (founder visual batch, 2026-10-14: screenshots 1260px, gif re-rendered at 1260px).
    const dir = path.join(ROOT, 'assets', 'readme')
    for (const file of fs.readdirSync(dir)) {
      const buf = fs.readFileSync(path.join(dir, file))
      let width: number | null = null
      if (file.endsWith('.png')) width = buf.readUInt32BE(16)
      if (file.endsWith('.gif')) width = buf.readUInt16LE(6)
      if (width !== null) expect(width, `${file} narrower than the render cap`).toBeGreaterThanOrEqual(1012)
    }
  })
})
