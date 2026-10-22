// Draws one committed process record as an SVG step graph for the open-processes README.
// Reads the unfiltered operational projection of the canonical definition, preserving
// jurisdiction-conditional nodes. Deterministic: same definition in, same bytes out.
//
//   node scripts/generate-process-diagram.mjs [processId] [outPath]
//
// Defaults: form_001 -> open-processes/assets/incorporate-c-corp.svg

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tsImport } from 'tsx/esm/api'

const { loadProcessCatalog } = await tsImport('../lib/shared-processes/catalog.ts', import.meta.url)
const { projectOperational } = await tsImport('../lib/shared-processes/projection.ts', import.meta.url)

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const processId = process.argv[2] ?? 'form_001'
const outPath = path.join(ROOT, process.argv[3] ?? 'open-processes/assets/incorporate-c-corp.svg')

const catalog = loadProcessCatalog(undefined, ROOT).processes
const record = catalog.map(process => projectOperational(process, catalog)).find(record => record?.id === processId)
if (!record) throw new Error(`process ${processId} not found in the operational catalog`)

// Execution colors are independent of signature and approval properties.
const STYLES = {
  'agent-native': { fill: '#0b2e22', stroke: '#34d399', text: '#d1fae5', glyph: '🤖' },
  'agent-computer-use': { fill: '#2e230b', stroke: '#fbbf24', text: '#fef3c7', glyph: '🖥' },
  'human-online': { fill: '#0b2233', stroke: '#38bdf8', text: '#e0f2fe', glyph: '🧑' },
  'human-offline': { fill: '#230b33', stroke: '#a78bfa', text: '#ede9fe', glyph: '🚶' },
}

const styleOf = (n) => STYLES[n.execution?.category] ?? { fill: '#20242c', stroke: '#94a3b8', text: '#e2e8f0', glyph: '?' }
const minutesLabel = (m) =>
  m == null ? '' : m >= 1440 ? ` (~${Math.round(m / 1440)}d wait)` : ` (${m}m)`
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Chain order from the edges; nodes outside the chain are the jurisdiction-conditional group.
const edgeFrom = new Map(record.dag.edges.map((e) => [e.from, e.to]))
const targets = new Set(record.dag.edges.map((e) => e.to))
const byId = new Map(record.dag.nodes.map((n) => [n.id, n]))
const start = record.dag.nodes.find((n) => edgeFrom.has(n.id) && !targets.has(n.id))
const chain = []
for (let id = start?.id; id; id = edgeFrom.get(id)) chain.push(byId.get(id))
const conditional = record.dag.nodes.filter((n) => !chain.includes(n))

const W = 760
const BOX_W = 560
const BOX_H = 42
const GAP = 26
const X = (W - BOX_W) / 2
const PAD_TOP = 16

const parts = []
let y = PAD_TOP
const box = (n, x, w, suffix = '') => {
  const s = styleOf(n)
  const label = `${s.glyph}${n.legalSignature ? ' ✍' : ''} ${n.label}${minutesLabel(n.estimatedMinutes)}${suffix}`
  // ~7.2px per character at 14px; squeeze long labels to the box instead of overflowing.
  const fit = label.length * 7.2 > w - 16 ? ` textLength="${w - 16}" lengthAdjust="spacingAndGlyphs"` : ''
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${BOX_H}" rx="8" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.5"/>`,
    `<text x="${x + w / 2}" y="${y + BOX_H / 2 + 5}" text-anchor="middle" fill="${s.text}" font-family="-apple-system, 'Segoe UI', sans-serif" font-size="14"${fit}>${esc(label)}</text>`,
  )
  y += BOX_H
}
const arrow = () => {
  parts.push(
    `<line x1="${W / 2}" y1="${y}" x2="${W / 2}" y2="${y + GAP - 7}" stroke="#94a3b8" stroke-width="1.5"/>`,
    `<path d="M ${W / 2 - 5} ${y + GAP - 8} L ${W / 2} ${y + GAP - 1} L ${W / 2 + 5} ${y + GAP - 8} Z" fill="#94a3b8"/>`,
  )
  y += GAP
}

chain.forEach((n, i) => {
  if (i > 0) arrow()
  box(n, X, BOX_W)
})

if (conditional.length > 0) {
  y += 30
  const groupTop = y
  y += 30
  for (const n of conditional) {
    const tag = n.jurisdictions?.length
      ? ` — ${n.jurisdictions.map((j) => (j === 'MULTI' ? 'multi-state' : j)).join(', ')}`
      : ''
    box(n, X, BOX_W, tag)
    y += 10
  }
  const groupBottom = y + 4
  parts.push(
    `<rect x="${X - 24}" y="${groupTop}" width="${BOX_W + 48}" height="${groupBottom - groupTop}" rx="10" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="6 4"/>`,
    `<text x="${W / 2}" y="${groupTop + 20}" text-anchor="middle" fill="#64748b" font-family="-apple-system, 'Segoe UI', sans-serif" font-size="12" textLength="${BOX_W + 24}" lengthAdjust="spacingAndGlyphs">${esc('Jurisdiction-conditional steps (attached client-side by lib/jurisdictions.ts, never in static ranks)')}</text>`,
  )
  y = groupBottom
}

const H = y + PAD_TOP
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(record.title)} step graph">\n${parts.join('\n')}\n</svg>\n`
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, svg)
console.log(`wrote ${path.relative(ROOT, outPath)} (${chain.length} chained steps, ${conditional.length} conditional)`)
