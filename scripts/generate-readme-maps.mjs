// Source-backed maps for the README examples. The acquisition workflow uses
// generate-process-diagram.mjs; these views show cross-repo and geography associations.
// node scripts/generate-readme-maps.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'open-processes/assets')
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
function wrap(value, width) {
  const lines = []
  for (const word of value.split(/\s+/)) {
    const last = lines.length - 1
    if (last < 0 || lines[last].length + word.length + 1 > width) lines.push(word)
    else lines[last] += ` ${word}`
  }
  return lines
}
class Svg {
  constructor(height, title, subtitle) {
    this.parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${height}" viewBox="0 0 1280 ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="#a1a1aa" stroke-width="1.5"/></marker></defs>
<style>text{font-family:Inter,Arial,Helvetica,sans-serif;fill:#f4f4f5}.muted{fill:#a1a1aa;font-size:14px}.body{fill:#d4d4d8;font-size:16px}.title{font-size:30px;font-weight:600}.heading{font-size:18px;font-weight:500}.badge{font-size:12px}.edge{fill:none;stroke:#a1a1aa;stroke-width:2;marker-end:url(#a)}</style>
<rect width="1280" height="${height}" fill="#09090b"/>`]
    this.text(40, 36, 'README example', 'muted')
    this.text(40, 78, title, 'title')
    this.lines(40, 108, subtitle, 135)
  }
  text(x, y, value, cls = 'body', color) {
    this.parts.push(`<text x="${x}" y="${y}" class="${cls}"${color ? ` style="fill:${color}"` : ''}>${esc(value)}</text>`)
  }
  lines(x, y, value, width = 32, cls = 'body', step = 22) {
    const lines = wrap(value, width)
    lines.forEach((line, i) => this.text(x, y + i * step, line, cls))
    return lines.length
  }
  box(x, y, width, height) {
    this.parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="#18181b" stroke="#3f3f46"/>`)
  }
  rule(y) { this.parts.push(`<line x1="40" y1="${y}" x2="1240" y2="${y}" stroke="#27272a"/>`) }
  save(name) {
    fs.mkdirSync(out, { recursive: true })
    fs.writeFileSync(path.join(out, `${name}.svg`), `${this.parts.join('\n')}\n</svg>\n`)
    console.log(`wrote open-processes/assets/${name}.svg`)
  }
}

function election() {
  const p = read('open-processes/consider-a-section-83-b-election-after-a-restricted-property-transfer.json')
  // Deliberately abbreviated labels, keyed to stable IDs. Fail if the source changes
  // shape so the authored summary must be reconciled rather than silently going stale.
  const labels = {
    'record-transfer': 'Establish the property-transfer facts',
    'get-advice': 'Recipient and counsel assess the election',
    prepare: 'Prepare the election if chosen',
    file: 'Recipient files the signed election',
    'deliver-copies': 'Send required copies and retain proof',
  }
  if (p.parts.length !== Object.keys(labels).length || p.parts.some(n => !labels[n.id])) throw new Error('Reconcile the 83(b) diagram summaries with the source steps')
  const s = new Svg(770, 'The 83(b) election', 'The existing README example connects law, a scoped workflow, the calculation module and private outputs.')
  s.text(40, 157, 'Repository connections', 'heading')
  const connections = [
    ['Law', ['Cited federal rules', 'Effect, filing, copies, revocation']],
    ['Process', ['Recipient considers the election', 'Eligibility and tax review']],
    ['Module', ['83(b) election math', 'Tax at grant vs tax at vesting']],
    ['Outputs', ["Recipient’s private decision", 'Filing and delivery proof, if chosen']],
  ]
  connections.forEach(([title, lines], i) => {
    const x = 40 + i * 310
    s.box(x, 178, 270, 124)
    s.text(x + 16, 207, title, 'heading')
    let cursor = 238
    lines.forEach(line => { cursor += s.lines(x + 16, cursor, line, 31, 'body', 20) * 22 + 6 })
  })
  s.text(40, 340, 'Workflow: continue only if the eligible recipient chooses the election after tax review', 'heading')
  s.text(40, 367, `${p.metadata.status} · ${p.metadata.reviewer}`, 'muted', '#fcd34d')
  const positions = new Map(p.parts.map((n, i) => [n.id, 40 + i * 246]))
  for (const edge of p.links) {
    const from = positions.get(edge.from), to = positions.get(edge.to)
    if (from === undefined || to === undefined) throw new Error('Unresolved 83(b) edge')
    s.parts.push(`<path data-from="${esc(edge.from)}" data-to="${esc(edge.to)}" d="M${from + 216} 501 H${to}" class="edge"${edge.when ? ' stroke-dasharray="5 4"' : ''}><title>${esc(edge.when ?? `${edge.from} → ${edge.to}`)}</title></path>`)
  }
  p.parts.forEach(n => {
    const x = positions.get(n.id)
    s.parts.push(`<g data-node="${esc(n.id)}">`)
    s.box(x, 402, 216, 198)
    s.lines(x + 16, 432, labels[n.id], 23)
    const category = n.metadata.execution?.category
    s.text(x + 16, 543, category?.replaceAll('-', ' ') ?? 'Execution unclassified', 'badge', category?.startsWith('agent-') ? '#6ee7b7' : '#7dd3fc')
    const approval = n.metadata.approval
    s.text(x + 16, 582, approval ? `Approval: ${approval.role}` : n.id, 'badge', approval ? '#fcd34d' : '#a1a1aa')
    s.parts.push('</g>')
  })
  s.text(40, 642, 'The dashed dependency is conditional. Filing and copies each have a separate, scoped recipient approval.', 'muted')
  s.rule(668)
  s.text(40, 696, 'Source: canonical 83(b) workflow and its jurisdiction-scoped projection; connections from README → Open law.', 'muted')
  s.text(40, 722, 'Short labels summarize source steps. The guide retains applicability, stop conditions and the full approval scopes.', 'muted')
  s.text(40, 748, 'The connection cards are a map of related material; they do not define an execution sequence.', 'muted')
  s.save('83b-election-map')
}

function countries() {
  const tax = read('open-processes/get-ein.json'), llc = read('open-processes/set-up-an-llc.json')
  const geoTax = new Map(tax.metadata.geoNotes.map(n => [n.country, n]))
  const geoLlc = new Map(llc.metadata.geoNotes.map(n => [n.country, n]))
  const regions = [['UK', 'United Kingdom'], ['IN', 'India'], ['DE', 'Germany'], ['FR', 'France'], ['PT', 'Portugal'], ['CA', 'Canada'], ['NZ', 'New Zealand']]
  const labels = { absorbed: 'Included in another process', analog: 'Local analog', 'not-applicable': 'Not applicable' }
  const s = new Svg(890, 'Founder country switch', 'The same README tasks use different local treatments. This compares the classifications already authored in the repo.')
  s.text(40, 168, 'Country', 'heading')
  s.text(260, 168, 'Obtain company tax identifiers', 'heading')
  s.text(770, 168, 'Set up an LLC', 'heading')
  s.rule(188)
  regions.forEach(([code, name], i) => {
    const y = 218 + i * 77
    s.text(40, y, name)
    for (const [x, geo] of [[260, geoTax], [770, geoLlc]]) {
      const note = geo.get(code)
      if (!note || !labels[note.kind]) throw new Error(`Unclassified country mapping: ${code}`)
      s.text(x, y, labels[note.kind])
      s.lines(x, y + 23, note.actionLabel ?? 'See the process guide', 57, 'muted', 18)
    }
    s.rule(y + 49)
  })
  s.text(40, 790, 'Source: get-ein.json and set-up-an-llc.json → metadata.geoNotes, using the countries named in the README.', 'muted')
  s.text(40, 817, '“Local analog” is the source’s coverage classification; it does not imply equivalent legal or tax treatment.', 'muted')
  s.text(40, 844, 'Open each guide for official links, applicability, exceptions and the full country-specific explanation.', 'muted')
  s.save('founder-country-switch')
}

function stages() {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
  const s = new Svg(982, 'Formation and Growth across the repository', 'These README stage maps connect processes with their supporting vendors, calculations, artifacts, lore and law.')
  for (const [j, stage] of ['Formation', 'Growth'].entries()) {
    const block = readme.split(`### Stage: ${stage}\n`)[1]?.split('\n### ')[0].split('\n<a ')[0]
    if (!block) throw new Error(`Missing README stage: ${stage}`)
    const rows = block.split('\n').filter(line => line.startsWith('- '))
    if (rows.length !== 6) throw new Error(`Reconcile the ${stage} map with the README selections`)
    const x = 40 + j * 620
    s.text(x, 168, stage, 'heading')
    rows.forEach((line, i) => {
      const colon = line.indexOf(': '), category = line.slice(2, colon)
      const body = line.slice(colon + 2).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replaceAll('`', '')
      const y = 194 + i * 112
      s.box(x, y, 580, 98)
      s.text(x + 16, y + 23, category, 'muted')
      s.lines(x + 16, y + 49, body, 72, 'body', 20)
    })
  }
  s.rule(891)
  s.text(40, 920, 'Source: README → Stages. The selections and relationships come directly from the existing Formation and Growth examples.', 'muted')
  s.text(40, 947, 'Each row is related material for the stage; row order does not establish a workflow or a prerequisite.', 'muted')
  s.save('formation-and-growth-map')
}
election()
countries()
stages()
