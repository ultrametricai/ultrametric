// Process → arena coverage audit (founder 2026-10-02): every corpus vendor should resolve
// through processes/vendor-registry.json to a live arena, or be deliberately untracked — this
// script walks EVERY vendor reference in the raw corpus (task.vendors, node.vendor,
// node.vendorOptions, and the same fields on step methods and their subSteps — a wider net than
// the node.vendorOptions allowlist test in lib/__tests__/processes.test.ts) and COMMITS the gap
// list as docs/PROCESS-ARENA-COVERAGE.md, the TIMELINE-INVERSIONS pattern: the drift test
// (lib/__tests__/processArenaCoverage.test.ts) fails whenever the committed report diverges
// from what the live corpus generates. Report, never auto-fix: an arena placement is a
// curation act (a judged arena + product must exist first); only MECHANICAL gaps — a registry
// key typo pointing at nothing — are ever fixed, and the report calls those out separately.
// Regenerate with: npx tsx scripts/generate-process-arena-coverage.ts
import fs from 'node:fs'
import path from 'node:path'
import { loadVendorRegistry } from '../lib/processes'

const ROOT = path.resolve(__dirname, '..')
export const PROCESS_ARENA_COVERAGE_FILE = path.join(ROOT, 'docs', 'PROCESS-ARENA-COVERAGE.md')

// Narrow structural types for the raw corpus walk — the audit reads processes/corpus.json
// directly (NOT loadProcesses()) so jurisdiction-conditional nodes, which the site loader
// strips from the default view, still have their vendor references audited.
interface RawNode {
  vendor?: string
  vendorOptions?: string[]
  optionsArenaId?: string
  extraOptionArenas?: string[]
  methods?: RawMethod[]
}
interface RawMethod {
  vendor?: string
  vendorOptions?: string[]
  optionsArenaId?: string
  subSteps?: RawNode[]
}
interface RawTask {
  id: string
  title: string
  kind?: string
  vendors: string[]
  dag: { nodes: RawNode[] }
}

function collectNode(n: RawNode, vendors: Set<string>, arenas: Set<string>): void {
  if (n.vendor) vendors.add(n.vendor)
  for (const v of n.vendorOptions ?? []) vendors.add(v)
  if (n.optionsArenaId) arenas.add(n.optionsArenaId)
  for (const a of n.extraOptionArenas ?? []) arenas.add(a)
  for (const m of n.methods ?? []) {
    if (m.vendor) vendors.add(m.vendor)
    for (const v of m.vendorOptions ?? []) vendors.add(v)
    if (m.optionsArenaId) arenas.add(m.optionsArenaId)
    for (const s of m.subSteps ?? []) collectNode(s, vendors, arenas)
  }
}

export interface CoverageAudit {
  /** vendor key → sorted ids of processes referencing it (every reference site counted). */
  vendorRefs: Map<string, string[]>
  /** Vendor keys referenced by the corpus but absent from the registry (the gap list). */
  unregistered: string[]
  /** Vendor keys with a registry entry but no arenaId (deliberately untracked). */
  untrackedRegistered: string[]
  /** Vendor keys whose registry arenaId is not a rankings/categories.json arena (MECHANICAL gaps). */
  badArena: { vendor: string; arenaId: string }[]
  /** Arena-tracked vendor keys (registry arenaId resolves to a real arena). */
  tracked: string[]
  /** Processes whose vendor set + direct arena claims resolve to zero arenas. */
  zeroArenaProcesses: { id: string; title: string; kind: string; vendors: string[] }[]
  /** Registry keys no corpus reference uses (typo suspects / site-only vendors) — informational. */
  unreferencedRegistryKeys: string[]
  totalProcesses: number
}

export function auditProcessArenaCoverage(): CoverageAudit {
  const corpus = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'processes', 'corpus.json'), 'utf8'),
  ) as RawTask[]
  const registry = loadVendorRegistry()
  const arenaIds = new Set(
    (JSON.parse(fs.readFileSync(path.join(ROOT, 'rankings', 'categories.json'), 'utf8')) as { id: string }[]).map(
      (c) => c.id,
    ),
  )

  const vendorRefSets = new Map<string, Set<string>>()
  const zeroArenaProcesses: CoverageAudit['zeroArenaProcesses'] = []
  for (const task of corpus) {
    const vendors = new Set<string>(task.vendors ?? [])
    const arenas = new Set<string>()
    for (const n of task.dag.nodes) collectNode(n, vendors, arenas)
    for (const v of vendors) {
      if (!vendorRefSets.has(v)) vendorRefSets.set(v, new Set())
      vendorRefSets.get(v)!.add(task.id)
      const arenaId = registry[v]?.arenaId
      if (arenaId && arenaIds.has(arenaId)) arenas.add(arenaId)
    }
    if (arenas.size === 0) {
      zeroArenaProcesses.push({
        id: task.id,
        title: task.title,
        kind: task.kind === 'situation' ? 'situation' : 'process',
        vendors: [...vendors].sort(),
      })
    }
  }

  const allVendors = [...vendorRefSets.keys()].sort()
  const unregistered = allVendors.filter((v) => !registry[v])
  const untrackedRegistered = allVendors.filter((v) => registry[v] && !registry[v].arenaId)
  const badArena = allVendors
    .filter((v) => registry[v]?.arenaId && !arenaIds.has(registry[v].arenaId!))
    .map((v) => ({ vendor: v, arenaId: registry[v].arenaId! }))
  const tracked = allVendors.filter((v) => registry[v]?.arenaId && arenaIds.has(registry[v].arenaId!))
  const referenced = new Set(allVendors)
  const unreferencedRegistryKeys = Object.keys(registry)
    .filter((k) => !referenced.has(k))
    .sort()

  return {
    vendorRefs: new Map(allVendors.map((v) => [v, [...vendorRefSets.get(v)!].sort()])),
    unregistered,
    untrackedRegistered,
    badArena,
    tracked,
    zeroArenaProcesses,
    unreferencedRegistryKeys,
    totalProcesses: corpus.length,
  }
}

// Deterministic: built only from the committed corpus + registry + categories (no dates, no
// environment reads), so regenerating on an unchanged corpus is byte-identical.
export function processArenaCoverageMarkdown(): string {
  const a = auditProcessArenaCoverage()
  const registry = loadVendorRegistry()
  const lines: string[] = []
  lines.push('# Process → arena coverage — the gap audit')
  lines.push('')
  lines.push(
    'GENERATED by `scripts/generate-process-arena-coverage.ts` from the raw corpus ' +
      '(`processes/corpus.json` — every vendor reference site: task vendors, node vendors/options, ' +
      'method and sub-step vendors) against `processes/vendor-registry.json` and ' +
      '`rankings/categories.json` — edit the corpus or registry, never this file; the drift test in ' +
      '`lib/__tests__/processArenaCoverage.test.ts` pins it to the live data.',
  )
  lines.push('')
  lines.push(
    'Doctrine: every corpus vendor resolves through the registry to a live arena, or is ' +
      'deliberately untracked (an honest unlinked chip). Gaps below are CURATION work — an arena ' +
      'placement needs a judged arena and product to exist first, so nothing here is auto-fixed. ' +
      'Only mechanical gaps (a registry key typo pointing at a nonexistent arena) are fixable ' +
      'without curation; those get their own section.',
  )
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- ${a.vendorRefs.size} distinct corpus vendor keys across ${a.totalProcesses} processes`)
  lines.push(
    `- ${a.tracked.length} arena-tracked · ${a.untrackedRegistered.length} deliberately untracked ` +
      `(registry entry, no arena) · ${a.unregistered.length} unregistered (gap list below)`,
  )
  lines.push(`- ${a.badArena.length} mechanical gaps (registry arenaId pointing at no arena)`)
  lines.push(
    `- ${a.zeroArenaProcesses.length} of ${a.totalProcesses} processes resolve to zero arenas ` +
      '(no tracked vendor and no direct arena claim on any step)',
  )
  lines.push('')
  lines.push(`## Mechanical gaps (${a.badArena.length})`)
  lines.push('')
  if (a.badArena.length === 0) {
    lines.push(
      'None — every registry `arenaId` names a real `rankings/categories.json` arena. (This is the ' +
        'only section whose rows would be fixed in place rather than reported.)',
    )
  } else {
    lines.push('| Vendor key | registry arenaId (no such arena) |')
    lines.push('|---|---|')
    for (const b of a.badArena) lines.push(`| \`${b.vendor}\` | \`${b.arenaId}\` |`)
  }
  lines.push('')
  lines.push(`## Vendors referenced by the corpus but absent from the registry (${a.unregistered.length})`)
  lines.push('')
  lines.push(
    'Each is a real supplier referenced somewhere the registry never heard of — either register ' +
      'it as deliberately untracked (entry without `arenaId`, with a note) or track it when a ' +
      'judging arena exists. None of these keys is a near-miss typo of an existing registry key, ' +
      'and none is a judged product in any arena — so none is mechanically fixable.',
  )
  lines.push('')
  lines.push('| Vendor key | referenced by |')
  lines.push('|---|---|')
  for (const v of a.unregistered) {
    lines.push(`| \`${v}\` | ${a.vendorRefs.get(v)!.map((id) => `\`${id}\``).join(', ')} |`)
  }
  lines.push('')
  lines.push(`## Deliberately untracked vendors (${a.untrackedRegistered.length})`)
  lines.push('')
  lines.push(
    'Registry entries without an `arenaId` — honest unlinked chips by design (government ' +
      'counterparties, suppliers whose market has no judged arena yet). Listed for review, not as ' +
      'gaps; the registry `note` carries the reason where one is recorded.',
  )
  lines.push('')
  lines.push('| Vendor key | note | referenced by |')
  lines.push('|---|---|---|')
  for (const v of a.untrackedRegistered) {
    const note = registry[v]?.note ?? ''
    lines.push(`| \`${v}\` | ${note} | ${a.vendorRefs.get(v)!.map((id) => `\`${id}\``).join(', ')} |`)
  }
  lines.push('')
  lines.push(`## Processes resolving to zero arenas (${a.zeroArenaProcesses.length})`)
  lines.push('')
  lines.push(
    'No vendor on these resolves to an arena and no step claims one directly ' +
      '(`optionsArenaId`/`extraOptionArenas`). Some are honestly market-less (government and ' +
      'program counterparties — the USPTO is not a vendor market); others mark arenas the site ' +
      'does not judge yet. Curation calls, never auto-placed.',
  )
  lines.push('')
  lines.push('| Process | kind | vendor references |')
  lines.push('|---|---|---|')
  for (const p of a.zeroArenaProcesses) {
    const vendors = p.vendors.length > 0 ? p.vendors.map((v) => `\`${v}\``).join(', ') : '— none —'
    lines.push(`| ${p.title} \`${p.id}\` | ${p.kind} | ${vendors} |`)
  }
  lines.push('')
  lines.push(`## Registry keys no corpus reference uses (${a.unreferencedRegistryKeys.length})`)
  lines.push('')
  lines.push(
    'Informational: registered vendors the corpus never references. Not gaps — the registry also ' +
      'serves non-corpus surfaces — but the first place to look when a key was meant to match a ' +
      'corpus vendor and missed (a typo would show up as one row here plus one in the ' +
      'unregistered list).',
  )
  lines.push('')
  lines.push(a.unreferencedRegistryKeys.map((k) => `\`${k}\``).join(', '))
  lines.push('')
  return lines.join('\n')
}

function main(): void {
  fs.writeFileSync(PROCESS_ARENA_COVERAGE_FILE, processArenaCoverageMarkdown())
  console.log(`wrote ${path.relative(ROOT, PROCESS_ARENA_COVERAGE_FILE)}`)
}

if (require.main === module) main()
