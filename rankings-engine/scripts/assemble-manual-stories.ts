// Assembles a category's stories.json from a hand-curated manual taxonomy plus the canonical
// lens stories — the manual-authoring counterpart of normalize.ts's LLM path (payroll was built
// the same way). The manual stories live in pipeline/seeds/manual-stories/<category>.json and
// carry origin {kind:'manual'}; the 29 canonical lens stories (pipeline/agentic-stories.ts) are
// injected verbatim with origin {kind:'canonical'}, exactly as assembleTaxonomy does. The same
// guards apply: manual stories must not use canon themes or id prefixes, ids must be unique,
// and output is sorted theme → group → id for stable diffs.
//
// Usage: pnpm tsx pipeline/scripts/assemble-manual-stories.ts --category <id>
//
// Refuses to clobber a taxonomy that already has real verdicts (same guard as normalize.ts)
// unless UM_FORCE_NORMALIZE=1 — rewriting stories.json under committed verdicts silently
// invalidates the judge matrix.
import fs from 'node:fs'
import path from 'node:path'
import { type Story, StorySchema } from '../../lib/schemas'
import {
  AGENTIC_FEATURE_STORIES,
  AGENTIC_STORIES,
  API_QUALITY_STORIES,
  AUTOMATION_STORIES,
  OPENNESS_STORIES,
  PRIVACY_STORIES,
} from '../agentic-stories'
import { categoryDir, resolveCategories, writeJson } from '../paths'

const CANON_THEMES = new Set(['agenticness', 'openness', 'automation-depth', 'privacy-posture'])
const CANON_ID_PREFIXES = ['agentic-', 'api-', 'openness-', 'automation-', 'privacy-']

export function assembleManualTaxonomy(manual: Story[], recordedAt: string = new Date().toISOString()): Story[] {
  for (const s of manual) {
    if (CANON_THEMES.has(s.theme)) throw new Error(`manual story "${s.id}" uses canonical theme "${s.theme}"`)
    if (CANON_ID_PREFIXES.some((p) => s.id.startsWith(p))) {
      throw new Error(`manual story id "${s.id}" collides with a canonical id prefix`)
    }
  }
  const stamped = manual.map((s) => ({ ...s, origin: { kind: 'manual' as const, recordedAt } }))
  const canon = [
    ...AGENTIC_STORIES,
    ...AGENTIC_FEATURE_STORIES,
    ...API_QUALITY_STORIES,
    ...OPENNESS_STORIES,
    ...AUTOMATION_STORIES,
    ...PRIVACY_STORIES,
  ].map((s) => ({ ...s, origin: { kind: 'canonical' as const, recordedAt } }))
  const combined = [...stamped, ...canon]

  const ids = new Set<string>()
  for (const s of combined) {
    if (ids.has(s.id)) throw new Error(`assemble-manual-stories: duplicate story id "${s.id}"`)
    ids.add(s.id)
  }

  return combined.sort(
    (a, b) => a.theme.localeCompare(b.theme) || a.group.localeCompare(b.group) || a.id.localeCompare(b.id),
  )
}

function main(): void {
  const categoryFlag = process.argv.indexOf('--category')
  const categoryId = categoryFlag >= 0 ? process.argv[categoryFlag + 1] : undefined
  if (!categoryId) {
    console.error('usage: pnpm tsx pipeline/scripts/assemble-manual-stories.ts --category <id>')
    process.exit(1)
  }
  const [cat] = resolveCategories(categoryId)
  const seedPath = path.join(__dirname, '..', 'seeds', 'manual-stories', `${cat.id}.json`)
  if (!fs.existsSync(seedPath)) throw new Error(`no manual-stories seed at ${seedPath}`)

  const dataDir = categoryDir(cat.id)
  const verdictsPath = path.join(dataDir, 'verdicts.json')
  if (fs.existsSync(verdictsPath) && (process.env.UM_FORCE_NORMALIZE ?? process.env.PA_FORCE_NORMALIZE) !== '1') {
    throw new Error(
      `assemble-manual-stories: verdicts already exist for ${cat.id}; re-run with UM_FORCE_NORMALIZE=1 and re-judge`,
    )
  }

  const themes = new Set(cat.themes ?? [])
  const manual = StorySchema.array().parse(JSON.parse(fs.readFileSync(seedPath, 'utf8')))
  for (const s of manual) {
    if (!themes.has(s.theme)) throw new Error(`manual story "${s.id}" uses theme "${s.theme}" not in categories.json`)
    if (!cat.personas.includes(s.persona)) {
      throw new Error(`manual story "${s.id}" uses persona "${s.persona}" not in categories.json`)
    }
  }

  const assembled = StorySchema.array().min(30).max(80).parse(assembleManualTaxonomy(manual))
  writeJson(path.join(dataDir, 'stories.json'), assembled)
  console.log(`assemble-manual-stories: wrote ${assembled.length} stories for ${cat.id} (${manual.length} manual + canon)`)
}

if (require.main === module) {
  main()
}
