import fs from 'node:fs'
import path from 'node:path'
import { arenaVendorBlocks, type ArenaVendors } from './arenaLeaders'
import { loadBusinessLogicMap, moduleReadmeHref } from './businessLogicMap'
import { functionMappingFor } from './processRankings'
import { loadProcesses, processSlug, type ProcessTask } from './processes'
import { areaOfTask, type Area } from './processRows'
import { REPO } from './site'

// /open-modules page family (founder 2026-10-05): one site page per lib/openstartup module,
// built entirely from committed sources — the module registry processes/business-logic-map.json
// (which modules serve which corpus processes), the open-modules/README.md module index (the
// one committed functional description per module, parsed from its "What it computes" column —
// never paraphrased here), and the corpus itself. The vendor section is DERIVED, never curated:
// the module's processes' steps' function mappings (data/process-step-stories.json) name the
// covering arenas, and each arena contributes its committed leaderboard leaders
// (lib/arenaLeaders.ts). A module whose processes' steps have no populated covering arena keeps
// an honest empty state.

export interface ModuleProcessLink {
  id: string
  title: string
  href: string
  area: Area
}

export interface OpenModulePageData {
  id: string
  label: string
  // The committed "What it computes" cell from the open-modules/README.md module index.
  computes: string
  // The module's section in open-modules/README.md on GitHub.
  readmeHref: string
  // The module source file, repo-relative, and its GitHub blob URL.
  sourceFile: string
  sourceHref: string
  processes: ModuleProcessLink[]
  arenas: ArenaVendors[]
}

const README_FILE = () => path.join(process.cwd(), 'open-modules', 'README.md')

// anchor → the "What it computes" cell, parsed from the README's module-index table rows
// (`| [Label](#anchor) | What it computes | …`). The README is the one committed home of this
// prose (house SSOT posture, like the Serves lines) — the page reads it back rather than
// duplicating a second description that could drift.
let computesCache: Map<string, string> | null = null
export function readmeComputes(): Map<string, string> {
  if (!computesCache) {
    const markdown = fs.readFileSync(README_FILE(), 'utf8')
    const out = new Map<string, string>()
    for (const line of markdown.split('\n')) {
      const m = /^\| \[[^\]]+\]\(#([^)]+)\) \| ([^|]+) \|/.exec(line)
      if (m) out.set(m[1], m[2].trim())
    }
    computesCache = out
  }
  return computesCache
}

// The step-level covering arenas of one module, in first-seen corpus order: for each process
// the registry maps to the module, each step's committed function mapping
// (data/process-step-stories.json kind 'function') names the arena covering that step's
// general function. Pure collection — population and leaderboard resolution happen in
// lib/arenaLeaders.ts.
function moduleArenaIds(processIds: string[], byId: Map<string, ProcessTask>, dir?: string): string[] {
  const arenaIds: string[] = []
  for (const pid of processIds) {
    const task = byId.get(pid)
    if (!task) throw new Error(`open-modules: registry maps unknown process ${pid}`)
    for (const node of task.dag.nodes) {
      const entry = functionMappingFor(task.id, node, dir)
      if (entry && !arenaIds.includes(entry.arenaId)) arenaIds.push(entry.arenaId)
    }
  }
  return arenaIds
}

export function loadOpenModulePages(dir?: string): OpenModulePageData[] {
  const byId = new Map(loadProcesses(dir).map((t) => [t.id, t]))
  const computes = readmeComputes()
  return Object.entries(loadBusinessLogicMap()).map(([id, m]) => {
    const what = computes.get(m.anchor)
    if (!what) {
      throw new Error(
        `open-modules/README.md module index has no row for module ${id} (anchor ${m.anchor})`,
      )
    }
    return {
      id,
      label: m.label,
      computes: what,
      readmeHref: moduleReadmeHref(m.anchor),
      sourceFile: m.file,
      sourceHref: `https://github.com/${REPO}/blob/main/${m.file}`,
      processes: m.processes.map((pid) => {
        const task = byId.get(pid)!
        return {
          id: pid,
          title: task.title,
          href: `/processes/${processSlug(task.title)}`,
          area: areaOfTask(task),
        }
      }),
      arenas: arenaVendorBlocks(moduleArenaIds(m.processes, byId, dir), dir),
    }
  })
}

export function findOpenModulePage(id: string, dir?: string): OpenModulePageData | null {
  return loadOpenModulePages(dir).find((m) => m.id === id) ?? null
}
