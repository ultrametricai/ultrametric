import { loadArtifacts, loadProcesses, processSlug, taskCeiling, type ProcessTask } from './processes'

// The 404 process spotlight (founder 2026-10-08): every not-found page shows one worked
// example from the corpus, so a dead URL still teaches something real. The shortlist is
// curated for committed depth: each entry carries rich committed guidance (a produced
// artifact chain, a jurisdiction-cited situation, or a notable agent ceiling). The pick
// rotates deterministically through the shortlist by build date, so one static build shows
// one process everywhere and the next build may show another; nothing varies per request.
// Display only: the title, description, Agentic %, and artifact all come from the committed
// corpus via the same loaders the process pages use.
export const SPOTLIGHT_IDS = [
  'form_001', // Incorporate C-Corp: the artifact chain (charter → bylaws → stock → 83(b))
  'sit_001', // Respond to a cease-and-desist: the situation doctrine end to end
  'tax_001', // File DE franchise tax: both published methods, computed in deFranchiseTax.ts
  'sit_010', // Cure a Delaware franchise tax delinquency: rule-card-cited situation
] as const

export interface Spotlight {
  id: string
  title: string
  // The committed description, verbatim.
  description: string
  href: string
  // One committed fact: the first produced artifact when the process establishes one,
  // otherwise the computed Agentic % over its committed step routes.
  fact:
    | { kind: 'artifact'; artifactId: string; artifactLabel: string; href: string }
    | { kind: 'agentic'; pct: number; agentSteps: number; totalSteps: number }
}

export function spotlightTasks(): ProcessTask[] {
  const byId = new Map(loadProcesses().map((t) => [t.id, t]))
  return SPOTLIGHT_IDS.map((id) => {
    const task = byId.get(id)
    if (!task) throw new Error(`404 spotlight shortlist id ${id} is not in the corpus`)
    return task
  })
}

// Deterministic at build time: the day index rotates the shortlist, computed once when the
// static 404 page renders.
export function spotlightPick(now: Date = new Date()): Spotlight {
  const tasks = spotlightTasks()
  const day = Math.floor(now.getTime() / 86_400_000)
  const task = tasks[((day % tasks.length) + tasks.length) % tasks.length]
  return toSpotlight(task)
}

function toSpotlight(task: ProcessTask): Spotlight {
  const produced = task.dag.nodes.find((n) => n.producesArtifact)?.producesArtifact
  let fact: Spotlight['fact']
  if (produced) {
    const artifact = loadArtifacts().find((a) => a.id === produced)
    if (!artifact) throw new Error(`spotlight artifact ${produced} is not in the registry`)
    fact = { kind: 'artifact', artifactId: artifact.id, artifactLabel: artifact.label, href: `/artifacts/${artifact.id}` }
  } else {
    const ceiling = taskCeiling(task)
    fact = { kind: 'agentic', pct: ceiling.pct, agentSteps: ceiling.agentSteps, totalSteps: ceiling.totalSteps }
  }
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    href: `/processes/${processSlug(task.title)}`,
    fact,
  }
}
