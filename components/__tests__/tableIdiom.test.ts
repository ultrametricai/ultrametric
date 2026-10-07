import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// The 2026-10-05 table-idiom sweep (founder: consistent table structure sitewide): every data
// table shares ONE shell (rounded-2xl border, horizontal scroll inside it) and ONE header-row
// treatment (text-xs sentence case — no uppercase transform — zinc-400). The constants live in
// components/tableStyles.ts so future tables inherit the idiom instead of copy-pasting it.
// This sweep pins (a) the constant values, (b) that every table surface imports them, and
// (c) that no table header row/cell regrows an uppercase transform.
const ROOT = path.join(__dirname, '..', '..')

// Every file that renders a data table through the shared idiom. StoryMatrix keeps a local
// two-axis overflow-auto wrapper (sticky thead needs a vertical scroll ancestor) but shares
// the header-row constant; VirtualStartup's in-panel tables share the header row only (their
// cells are edge-flush inside the simulator panel, no bordered shell).
const ADOPTERS = [
  'components/AgenticIndexTable.tsx',
  'components/AiNativeIndexTable.tsx',
  'components/ArenaTable.tsx',
  'components/ClaimsIntegrityIndexTable.tsx',
  'components/CompareBuilder.tsx',
  'components/CompareRivals.tsx',
  'components/ControlSurfacesTable.tsx',
  'components/CountryRankings.tsx',
  'components/FamilySection.tsx',
  'components/HomeProcessesMini.tsx',
  'components/HomeRankingsMini.tsx',
  'components/InitIndexTable.tsx',
  'components/MegaTable.tsx',
  'components/OpsDashboard.tsx',
  'components/ProcessesTable.tsx',
  'components/ProcessOpenModulesTable.tsx',
  'components/ProcessProducesTable.tsx',
  'components/SituationsTable.tsx',
  'components/shared-processes/ProcessBottomTables.tsx',
  'components/StackBattle.tsx',
  'components/StackBuilder.tsx',
  'components/StoryMatrix.tsx',
  'components/StoryVerdictsTable.tsx',
  'components/VendorProcesses.tsx',
  'components/VirtualStartup.tsx',
  'app/artifacts/page.tsx',
  'app/experiments/gpus/GpuTable.tsx',
  'app/experiments/processors/ProcessorTable.tsx',
  'app/global/page.tsx',
  'app/global/[story]/page.tsx',
  'app/icp/[type]/page.tsx',
  'app/open-documents/page.tsx',
  'app/pipeline/page.tsx',
  'app/queue/page.tsx',
  'app/rankings/best-api/page.tsx',
  'app/rankings/law-firms/page.tsx',
  'app/rankings/most-connected/page.tsx',
  'app/rankings/most-open/page.tsx',
  'app/rankings/most-tested/page.tsx',
  'app/rankings/popular/page.tsx',
  'app/rankings/rising/page.tsx',
  'app/rankings/processes/best-covered/page.tsx',
  'app/rankings/processes/growth-drivers/page.tsx',
  'app/rankings/processes/most-annoying/page.tsx',
  'app/rankings/processes/most-automatable/page.tsx',
  'app/rankings/processes/riskiest/page.tsx',
  'app/stacks/page.tsx',
  'app/yc/page.tsx',
  'app/yc/[batch]/page.tsx',
  'app/arena/[category]/report/page.tsx',
]

describe('table idiom sweep (founder 2026-10-05)', () => {
  it('pins the shared shell and header-row classes', () => {
    expect(TABLE_SHELL).toBe('overflow-x-auto rounded-2xl border border-zinc-800')
    expect(TABLE_HEADER_ROW).toBe('border-b border-zinc-800 text-left text-xs tracking-wide text-zinc-400')
  })

  it.each(ADOPTERS)('%s imports the shared table styles', (file) => {
    const src = readFileSync(path.join(ROOT, file), 'utf8')
    expect(src).toContain("from '@/components/tableStyles'")
  })

  it.each(ADOPTERS)('%s has no uppercase transform on a table header row or cell', (file) => {
    const src = readFileSync(path.join(ROOT, file), 'utf8')
    expect(src).not.toMatch(/<(tr|th)[^>]*className="[^"]*uppercase/)
    // The retired per-table header strings must not come back as literals either.
    expect(src).not.toMatch(/border-b border-zinc-800 text-left text-(?:\[10px\]|xs) uppercase/)
  })
})
