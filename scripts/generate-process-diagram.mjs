// Deterministic SVG views of canonical processes. No authored dependencies or steps.
// node scripts/generate-process-diagram.mjs [processId] [outPath]
// node scripts/generate-process-diagram.mjs --examples
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tsImport } from 'tsx/esm/api'

const { loadProcessCatalog } = await tsImport('../lib/shared-processes/catalog.ts', import.meta.url)
const { projectOperational } = await tsImport('../lib/shared-processes/projection.ts', import.meta.url)
const { layerNodes } = await tsImport('../lib/dagLayers.ts', import.meta.url)
const { EXECUTION_LABELS } = await tsImport('../lib/execution.ts', import.meta.url)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = loadProcessCatalog(undefined, ROOT).processes
const examples = ['incorporate-c-corp', 'get-a-409a-valuation', 'set-up-mailing-address', 'sell-the-company-through-an-acquisition']
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const W = 1280, PAD = 40, COLS = 5, CW = 216, GX = 30, CH = 174, GY = 20, ROW_GAP = 68

function wrap(value, limit) {
  const lines = []
  for (const word of String(value).split(/\s+/)) {
    const last = lines.length - 1
    if (last < 0 || lines[last].length + word.length + 1 > limit) lines.push(word)
    else lines[last] += ` ${word}`
  }
  return lines
}
function minutes(value) {
  if (value == null) return 'Time not estimated'
  if (value >= 1440) return `~${Math.round(value / 1440)} days elapsed`
  return `~${value} min`
}
function draw(item, output) {
  const record = projectOperational(item, catalog)
  if (!record) throw new Error(`process ${item.record.id} has no operational view`)
  const nodes = record.dag.nodes, edges = record.dag.edges ?? []
  // Disconnected jurisdiction-specific nodes stay separate. Being outside a chain
  // does not make a node jurisdiction-conditional (e.g. the 409A cap-table input).
  const connected = new Set(edges.flatMap(e => [e.from, e.to]))
  const detached = nodes.filter(n => n.jurisdictions?.length && !connected.has(n.id))
  const main = nodes.filter(n => !detached.includes(n))
  const layers = layerNodes(main, edges)
  const positions = new Map()
  let y = 188
  for (let base = 0; base < layers.length; base += COLS) {
    const row = layers.slice(base, base + COLS)
    const height = Math.max(...row.map(layer => layer.length * (CH + GY) - GY))
    row.forEach((layer, i) => {
      const col = Math.floor(base / COLS) % 2 ? COLS - 1 - i : i
      const groupHeight = layer.length * (CH + GY) - GY
      layer.forEach((n, j) => positions.set(n.id, { x: PAD + col * (CW + GX), y: y + (height - groupHeight) / 2 + j * (CH + GY), row: Math.floor(base / COLS) }))
    })
    y += height + ROW_GAP
  }
  let detachedHeading
  if (detached.length) {
    detachedHeading = y - 12
    y += 26
    detached.forEach((n, i) => positions.set(n.id, { x: PAD + (i % COLS) * (CW + GX), y: y + Math.floor(i / COLS) * (CH + GY), row: null }))
    y += Math.ceil(detached.length / COLS) * (CH + GY)
  }
  const footer = y + 12, H = footer + 92
  const pieces = []
  const text = (x, yy, value, cls = 'body', extra = '') => pieces.push(`<text x="${x}" y="${yy}" class="${cls}" ${extra}>${esc(value)}</text>`)
  const parts = new Map(item.record.parts.map(part => [part.id, part]))
  text(PAD, 38, `Processes / ${item.record.metadata.phase ?? 'Process'}`, 'muted')
  text(PAD, 82, item.record.title, 'title')
  wrap(item.record.summary ?? '', 145).forEach((line, i) => text(PAD, 112 + i * 22, line, 'body'))
  text(PAD, 160, 'Execution labels and estimates come from the source record. Open the linked guide for applicability, approvals and alternatives.', 'muted')

  // Draw each authored edge once, behind the node surfaces. The next row reverses
  // direction so a long process remains readable without introducing extra edges.
  for (const edge of edges) {
    const a = positions.get(edge.from), b = positions.get(edge.to)
    if (!a || !b) throw new Error(`edge ${edge.from} → ${edge.to} has no endpoint`)
    let d
    if (a.row === b.row) {
      const right = b.x > a.x
      const sx = a.x + (right ? CW : 0), ex = b.x + (right ? 0 : CW)
      const sy = a.y + CH / 2, ey = b.y + CH / 2, mid = (sx + ex) / 2
      // Cubic curves give the same soft bends as the site's process connectors.
      d = `M${sx} ${sy} C${mid} ${sy} ${mid} ${ey} ${ex} ${ey}`
    } else {
      const sx = a.x + CW / 2, sy = a.y + CH, ex = b.x + CW / 2, ey = b.y
      d = `M${sx} ${sy} C${sx} ${(sy + ey) / 2} ${ex} ${(sy + ey) / 2} ${ex} ${ey}`
    }
    pieces.push(`<path data-from="${esc(edge.from)}" data-to="${esc(edge.to)}" d="${d}" class="edge"${edge.when ? ' stroke-dasharray="5 4"' : ''}><title>${esc(edge.when ?? `${edge.from} → ${edge.to}`)}</title></path>`)
  }
  if (detachedHeading) text(PAD, detachedHeading, 'Jurisdiction-specific steps · applicability in the linked guide', 'heading')
  for (const n of nodes) {
    const p = positions.get(n.id), part = parts.get(n.id)
    const lines = wrap(n.label, 24)
    const height = Math.max(CH, 62 + lines.length * 21)
    if (height > CH) throw new Error(`step ${n.id} label needs a larger card`)
    pieces.push(`<a href="https://github.com/ultrametricai/ultrametric/blob/main/open-processes/pages/${esc(item.slug)}.md#${esc(`step-${item.record.parts.findIndex(part => part.id === n.id) + 1}`)}"><g data-node="${esc(n.id)}">`)
    pieces.push(`<rect x="${p.x}" y="${p.y}" width="${CW}" height="${CH}" rx="12" fill="#18181b" stroke="#3f3f46"/>`)
    lines.forEach((line, i) => text(p.x + 16, p.y + 28 + i * 21, line, 'node-title'))
    const category = n.execution?.category
    const label = EXECUTION_LABELS[category] ?? 'Execution unclassified'
    const color = category?.startsWith('agent-') ? '#6ee7b7' : category?.startsWith('human-') ? '#7dd3fc' : '#a1a1aa'
    text(p.x + 16, p.y + CH - 41, label, 'badge', `style="fill:${color}"`)
    if (n.legalSignature) text(p.x + 16, p.y + CH - 22, 'Signature', 'badge', 'style="fill:#c4b5fd"')
    else if (n.approvalRequired || part?.metadata?.approvalRequired) text(p.x + 16, p.y + CH - 22, 'Ⅱ Approval', 'badge', 'style="fill:#fcd34d"')
    text(p.x + CW - 16, p.y + CH - 22, minutes(n.estimatedMinutes), 'badge', 'text-anchor="end" style="fill:#a1a1aa"')
    if (n.jurisdictions?.length) text(p.x + CW - 16, p.y + CH - 41, n.jurisdictions.join(' · '), 'badge', 'text-anchor="end" style="fill:#a1a1aa"')
    pieces.push('</g></a>')
  }
  pieces.push(`<line x1="${PAD}" y1="${footer}" x2="${W-PAD}" y2="${footer}" stroke="#27272a"/>`)
  text(PAD, footer + 28, `Source: open-processes/${item.slug}.json`, 'muted')
  text(PAD, footer + 51, 'Arrows show recorded dependencies. Steps without connecting arrows have no recorded dependency.', 'muted')
  text(PAD, footer + 74, 'Default step view. Read the guide for options, verification, recovery and country-specific guidance.', 'muted')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(record.title)} step graph">
<title>${esc(item.record.title)}</title>
<desc>Generated from ${esc(item.slug)}.json. ${esc(nodes.map(n=>n.label).join('; '))}. Each arrow preserves a recorded dependency. Execution assessments and explicit signature and approval markers come from the record.</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="#a1a1aa" stroke-width="1.5"/></marker></defs>
<style>text{font-family:Inter,Arial,Helvetica,sans-serif;fill:#f4f4f5}.title{font-size:30px;font-weight:600}.heading{font-size:18px;font-weight:500}.node-title{font-size:16px;font-weight:500}.body{font-size:16px;fill:#a1a1aa}.muted{font-size:14px;fill:#a1a1aa}.badge{font-size:12px}.edge{fill:none;stroke:#a1a1aa;stroke-width:2;marker-end:url(#arrow)}</style>
<rect width="${W}" height="${H}" fill="#09090b"/>
${pieces.join('\n')}
</svg>\n`
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, svg)
  console.log(`wrote ${path.relative(ROOT, output)}`)
}
if (process.argv[2] === '--examples') {
  for (const slug of examples) draw(catalog.find(p=>p.slug===slug), path.join(ROOT, `open-processes/assets/${slug}.svg`))
} else {
  const id = process.argv[2] ?? 'form_001'
  const item = catalog.find(p=>p.record.id===id)
  if (!item) throw new Error(`process ${id} not found in the operational catalog`)
  draw(item, path.resolve(ROOT, process.argv[3] ?? 'open-processes/assets/incorporate-c-corp.svg'))
}
