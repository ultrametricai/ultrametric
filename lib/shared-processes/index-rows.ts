import { buildPlaybookRows, buildProcessRows, buildSituationRows, AREA_ORDER } from '../processRows'
import { loadProcesses, processSlug } from '../processes'
import type { ProcessTableRow } from '@/components/ProcessesTable'
import { buildPreviewRoutes, readSharedCatalog } from './reader'
import iconBindings from './index-icons.json'

export function buildPreviewIndex() {
  const records = readSharedCatalog()
  const byId = new Map(records.map(record => [record.id, record]))
  const routes = buildPreviewRoutes(records)
  const href = (id: string) => `/processes/${encodeURIComponent(routes.get(id)!)}/v2`
  const used = new Set<string>()
  const original = buildProcessRows()
  // The preview table keeps FULL corpus coverage: /processes proper excludes kind=situation
  // rows (founder 2026-10-02 — they live on /situations now), but every shared record still
  // needs its preview row here, situations included, with their trigger/urgency presentation.
  const sourceRows = [...original.rows, ...buildSituationRows()]
  const tasks = new Map(loadProcesses().map(task => [processSlug(task.title), task]))
  const bindings: Record<string, { icon: string }> = iconBindings
  const rows: ProcessTableRow[] = sourceRows.map(row => {
    const task = tasks.get(row.slug)!
    const record = byId.get(task.id)
    if (!record) throw new Error(`Missing shared record for index process ${task.id}`)
    used.add(record.id)
    return { ...row, title: record.title, href: href(record.id), icon: bindings[record.id]?.icon ?? row.icon }
  })
  const playbooks = buildPlaybookRows().map(row => {
    const record = byId.get(row.id)
    if (!record) throw new Error(`Missing shared record for index chain ${row.id}`)
    used.add(record.id)
    return { ...row, title: record.title, tagline: record.summary, href: href(record.id),
      processes: row.processes.map(part => ({ ...part, icon: bindings[part.id]?.icon ?? part.icon })),
    }
  })
  // Canonical-only records remain in the SAME searchable/sortable table. Their
  // absent legacy assessments stay null, not zero or an inferred global scope.
  for (const record of records.filter(record => !used.has(record.id))) {
    rows.push({
      slug: routes.get(record.id)!, href: href(record.id), title: record.title, icon: '',
      kind: 'process', trigger: null, urgency: null, phase: '', area: 'Other processes', areaRank: AREA_ORDER.length, geoScope: null,
      pct: null, agentSteps: null, totalSteps: record.parts.length, complexity: '',
      timeOrder: null, cadenceLabel: null, cadenceRank: null, annoyance: null, risk: null,
      growthImpact: null, vendors: [], geoNotesByCountry: {},
    })
  }
  return { rows, phases: original.phases, playbooks }
}
