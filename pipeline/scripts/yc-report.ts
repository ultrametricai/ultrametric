// Aggregates open-rankings/yc-map.json into the lane's required report: top proposed new arenas by
// company density (>=3 candidates), and the full list of YC companies mapped to an EXISTING
// arena (direct add-candidates for that arena's products.json). Read-only — writes
// .superpowers/yc-lane-report.md (not tracked as a "gate" artifact, just the requested report
// path). Run with: tsx pipeline/scripts/yc-report.ts
import fs from 'node:fs'
import path from 'node:path'
import { YcMapSchema } from '../../lib/schemas'
import { ROOT } from '../paths'

const YC_MAP_PATH = path.join(ROOT, 'open-rankings', 'yc-map.json')
const YC_BATCHES_PATH = path.join(ROOT, 'open-rankings', 'yc-batches.json')
const REPORT_PATH = path.join(ROOT, '.superpowers', 'yc-lane-report.md')

function main() {
  const map = YcMapSchema.parse(JSON.parse(fs.readFileSync(YC_MAP_PATH, 'utf8')))
  const ycBatches = JSON.parse(fs.readFileSync(YC_BATCHES_PATH, 'utf8')) as Record<string, string>

  const byProposed = new Map<string, typeof map>()
  const byExisting = new Map<string, typeof map>()
  let nullCount = 0
  for (const c of map) {
    if (c.proposedArena) {
      if (!byProposed.has(c.proposedArena)) byProposed.set(c.proposedArena, [])
      byProposed.get(c.proposedArena)!.push(c)
    } else if (c.mappedArena) {
      if (!byExisting.has(c.mappedArena)) byExisting.set(c.mappedArena, [])
      byExisting.get(c.mappedArena)!.push(c)
    } else {
      nullCount++
    }
  }

  const proposedRanked = Array.from(byProposed.entries())
    .filter(([, members]) => members.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)

  const existingTotal = Array.from(byExisting.values()).reduce((n, v) => n + v.length, 0)

  const lines: string[] = []
  lines.push('# YC ingestion + category-mapping lane report')
  lines.push('')
  lines.push(`Generated from open-rankings/yc-map.json (${map.length} companies, batches W23-S26) and open-rankings/yc-batches.json (${Object.keys(ycBatches).length} existing products verified as YC alumni).`)
  lines.push('')
  lines.push('## Top proposed new arenas by density (>=3 candidates)')
  lines.push('')
  for (const [arena, members] of proposedRanked.slice(0, 15)) {
    lines.push(`### ${arena} (${members.length})`)
    for (const m of members) lines.push(`- ${m.name} (${m.slug}, ${m.batch}) — ${m.oneLiner}`)
    lines.push('')
  }
  lines.push(`Total distinct proposed arenas (any size): ${byProposed.size}. With >=3 members: ${proposedRanked.length}.`)
  lines.push('')
  lines.push('## YC companies mapped to EXISTING arenas (direct add-candidates)')
  lines.push('')
  lines.push(`Total: ${existingTotal}`)
  lines.push('')
  for (const [arena, members] of Array.from(byExisting.entries()).sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${arena} (${members.length})`)
    for (const m of members) lines.push(`- ${m.name} (${m.slug}, ${m.batch}) — ${m.oneLiner}`)
    lines.push('')
  }
  lines.push('## Existing products verified as YC alumni (open-rankings/yc-batches.json)')
  lines.push('')
  for (const [productId, code] of Object.entries(ycBatches)) lines.push(`- ${productId}: ${code}`)
  lines.push('')
  lines.push(`## Summary`)
  lines.push('')
  lines.push(`- Total modern-batch companies ingested: ${map.length}`)
  lines.push(`- Mapped to existing arenas: ${existingTotal}`)
  lines.push(`- Proposed new arenas (>=3 members): ${proposedRanked.length}, covering ${proposedRanked.reduce((n, [, m]) => n + m.length, 0)} companies`)
  lines.push(`- Not a rankable software product (null/null): ${nullCount}`)

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n')

  console.log(`Wrote report to ${path.relative(ROOT, REPORT_PATH)}`)
  console.log(`\nTop 8 proposed arenas:`)
  for (const [arena, members] of proposedRanked.slice(0, 8)) console.log(`  ${arena}: ${members.length}`)
  console.log(`\nExisting-arena add-candidates: ${existingTotal}`)
  console.log(`Not-applicable (null/null): ${nullCount}`)
}

main()
