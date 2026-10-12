import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

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
// Rewritten in founder round 7 (authorized intro edit): one paragraph, each capability
// named once with one link, no duplicate destinations, the mission line closing it, and
// the demo gif sitting directly under the intro with no heading or caption.
const INTRO = [
  '![Ultrametric](docs/assets/banner.svg)',
  '',
  'Ultrametric ([ultrametric.ai](https://ultrametric.ai)) is the open startup repo: every',
  'founder [process](#open-processes) step by step, the [tools](#open-vendor-rankings) and',
  'the [service providers](#startup-ecosystem) around a company (law firms included) ranked',
  'by how well an agent can drive them, [company law](#open-law) mapped across',
  'jurisdictions, the [lore](#open-lore) and its library recorded with sources, the open',
  '[documents and artifacts](#open-artifacts) collected, the startup',
  '[calculations](#open-modules) as tested code, all of it replayable in the',
  '[simulator](https://ultrametric.ai/startup-sim) and readable by',
  '[agents](#install-ultrametric) without keys. The aim: make starting and running a',
  'company agentic, automated, and standardized across geographies.',
  '',
  '**Contribution guides:** [Add your vendor](CONTRIBUTING.md#add-your-vendor) · [Add a process](CONTRIBUTING.md#add-a-process) · [Add a jurisdiction](CONTRIBUTING.md#add-a-jurisdiction) · [Add an open module](CONTRIBUTING.md#add-an-open-module)',
  '',
  '**Talk:** [Discord](https://discord.com/invite/3aHky836qP) — founders and contributors',
  '',
  '<!-- Legacy anchor: external links to #start-here predate the merge into this map. -->',
  '<a id="start-here"></a>',
  '',
  '![A tour of ultrametric.ai at 4x: the simulator founding a company, a process page, a vendor page, a situation, the overall rankings, government services, and open documents](docs/assets/readme/demo.gif)',
].join('\n')

// The founder-specified section order (round 3): artifacts directly after modules with the
// docs catalog folded inside, country-switch and getting-acquired framed as examples.
const SECTIONS = [
  '## The open startup repo',
  '## Open vendor rankings',
  '## Open processes',
  '## Open modules',
  '## Open artifacts',
  '## Situations',
  '## Open lore',
  '## Open law',
  '## Government services and startups',
  '## Startup ecosystem',
  '## Open startup simulator',
  '## Open skills for startups',
  '## Install Ultrametric',
  '## Methodology',
  '## Upcoming',
  '## License',
]

// Demoted to subsections inside their parent sections (founder rounds 2 and 3).
const SUBSECTIONS: Array<[string, string]> = [
  ['## Open processes', '### Examples'],
  ['## Open modules', '### Shared data fields'],
  ['## Open artifacts', '### Open docs'],
  ['## Situations', '### Example: Founder country switch'],
  ['## Open lore', '### Example: Getting acquired'],
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
    for (const gone of ['## Founder country switch', '## Getting acquired', '## Open data structure', '## Open situations', '## Open docs']) {
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
    expect(beforeFirstSection).toContain('docs/assets/readme/demo.gif')
    expect(readme).not.toContain('## Video demo')
    expect(readme).not.toContain('demo.mp4')
    // The full recording stays committed for native upload later.
    expect(fs.existsSync(path.join(ROOT, 'docs', 'assets', 'readme', 'demo.mp4'))).toBe(true)
  })

  it('the intro links each destination exactly once', () => {
    const intro = readme.slice(0, readme.indexOf('\n## '))
    const dests = [...intro.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1])
    expect(dests.length).toBeGreaterThan(0)
    expect(new Set(dests).size, `duplicate intro links: ${dests.join(', ')}`).toBe(dests.length)
  })

  it('uses plain language: no insider vocabulary anywhere on the page', () => {
    for (const banned of ['corpus', 'interchange', 'disposition', 'manifest', 'taxonomy', 'HMAC', 'DAG', 'provenance']) {
      expect(readme.toLowerCase(), `README contains banned word "${banned}"`).not.toContain(banned.toLowerCase())
    }
  })

  it('hand-written prose carries no counts and no dates; numbers live in generated blocks only', () => {
    let stripped = readme
    for (const [s, e] of [
      ['<!-- stats:start -->', '<!-- stats:end -->'],
      ['<!-- stat-badges:start -->', '<!-- stat-badges:end -->'],
      ['<!-- arenas:start -->', '<!-- arenas:end -->'],
    ]) {
      stripped = stripped.slice(0, stripped.indexOf(s)) + stripped.slice(stripped.indexOf(e) + e.length)
    }
    expect(stripped).not.toMatch(/\b\d[\d,]* (rankings|products|verdicts|arenas|processes|markets)\b/)
    expect(stripped).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/)
  })
})

describe('README.md section-guide tables (founder round 2)', () => {
  it('Open modules carries the module guide table with a row per mapped module', () => {
    const section = sectionBody('## Open modules')
    expect(section).toContain('| Module | What it computes | Source it cites |')
    const map = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'processes', 'business-logic-map.json'), 'utf8'),
    ) as { modules: Record<string, { anchor: string }> }
    const anchors = Object.values(map.modules).map((m) => m.anchor)
    expect(anchors.length).toBeGreaterThan(0)
    for (const anchor of anchors) {
      expect(section, `module table is missing a link to #${anchor}`).toContain(
        `](open-modules/README.md#${anchor})`,
      )
    }
  })

  it('the Open docs subsection carries the category table covering every registry use_case, with a gaps column', () => {
    const section = sectionBody('## Open artifacts')
    expect(section).toContain('| Category | Example documents | Gaps |')
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

  it('the Open lore table rows match lore/library.json sections, each example URL a committed entry', () => {
    const section = sectionBody('## Open lore')
    expect(section).toContain('| Section | What it teaches | Example entry |')
    const library = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'lore', 'library.json'), 'utf8'),
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

describe('README.md generated blocks', () => {
  it('keeps the three generated marker pairs pnpm stats rewrites', () => {
    for (const marker of [
      '<!-- stats:start -->', '<!-- stats:end -->',
      '<!-- stat-badges:start -->', '<!-- stat-badges:end -->',
      '<!-- arenas:start -->', '<!-- arenas:end -->',
    ]) {
      expect(readme).toContain(marker)
    }
  })

  it('the arenas block is the compact one-line form, not the old per-market table', () => {
    const block = readme.slice(
      readme.indexOf('<!-- arenas:start -->'),
      readme.indexOf('<!-- arenas:end -->'),
    )
    expect(block).not.toContain('| Ranking | Products |')
    expect(block).not.toContain('|---|')
    expect(block).toContain('https://ultrametric.ai/arenas')
    expect(block.trim().split('\n').length).toBe(2)
  })
})

describe('README.md anchors and links', () => {
  it('keeps every legacy inbound anchor resolving (Writing style rule 8)', () => {
    for (const id of [
      'start-here', 'processes', 'vendors', 'business-logic',
      'add-your-country-or-state', 'open-docs', 'for-ai-agents', 'use-it-from-an-agent',
    ]) {
      expect(readme, `missing anchor #${id}`).toContain(`<a id="${id}"></a>`)
    }
    // #methodology and #open-modules resolve through their headings.
    expect(readme).toContain('\n## Methodology')
    expect(readme).toContain('\n## Open modules')
  })

  it('every CONTRIBUTING.md anchor the README links exists', () => {
    for (const anchor of ['add-your-vendor', 'add-a-process', 'add-a-jurisdiction', 'add-an-open-module']) {
      expect(readme).toContain(`(CONTRIBUTING.md#${anchor})`)
      expect(contributing, `CONTRIBUTING.md is missing <a id="${anchor}">`).toContain(`<a id="${anchor}"></a>`)
    }
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
  const corpus: CorpusRec[] = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'processes', 'corpus.json'), 'utf8'),
  )
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
    const media = [...readme.matchAll(/\]\((docs\/assets\/[^)]+)\)/g)].map((m) => m[1])
    expect(media.length).toBeGreaterThan(0)
    for (const p of media) {
      expect(fs.existsSync(path.join(ROOT, p)), `missing media file ${p}`).toBe(true)
    }
  })

  it('each screenshot stays under the 300KB budget and the gif under 5MB', () => {
    const dir = path.join(ROOT, 'docs', 'assets', 'readme')
    for (const file of fs.readdirSync(dir)) {
      const size = fs.statSync(path.join(dir, file)).size
      if (file.endsWith('.png')) expect(size, `${file} over 300KB`).toBeLessThan(300 * 1024)
      if (file.endsWith('.gif')) expect(size, `${file} over 5MB`).toBeLessThan(5 * 1024 * 1024)
    }
  })
})
