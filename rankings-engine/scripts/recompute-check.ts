// Standalone determinism check: calls buildRankings() directly against on-disk data for every
// category and deep-compares against the persisted rankings.json. Used as a sanity gate after
// any manual verdicts.json edit (e.g. rankings-engine/scripts/revert-churn.ts) to confirm the derive
// step was applied cleanly and rankings.json isn't stale/drifted.
import fs from 'node:fs'
import path from 'node:path'
import { attachProvenance } from '../../lib/provenance'
import { buildRollups, RollupsSchema } from '../../lib/rollups'
import { ProductSchema, RankingsSchema, StorySchema, VerdictSchema } from '../../lib/schemas'
import { buildRankings } from '../../lib/scoring'
import { buildStepRankings, serializeStepRankings } from '../../lib/stepRankings'

const ROOT = path.resolve(__dirname, '..', '..')
const CATEGORIES = [
  'accounting',
  'agentic-commerce',
  'agent-skills',
  'agent-frameworks',
  'agent-sandboxes',
  'ai-assistants',
  'ai-code-review',
  'ai-coding',
  'ai-memory',
  'ai-research-agents',
  'ai-search-apis',
  'ai-video',
  'api-platforms',
  'applicant-tracking',
  'auth-platforms',
  'authenticator-apps',
  'backend-as-a-service',
  'banking-as-a-service',
  'banking-data-apis',
  'billing-subscriptions',
  'browser-agents',
  'card-issuing',
  'cloud-platforms',
  'cloud-storage',
  'code-hosting',
  'compliance-automation',
  'crm',
  'customer-data-platforms',
  'design-tools',
  'data-warehouses',
  'data-pipelines',
  'desktop-os',
  'device-agents',
  'durable-workflows',
  'ai-support-agents',
  'docs-platforms',
  'document-extraction',
  'domain-registrars',
  'ecommerce-platforms',
  'email',
  'email-apis',
  'edge-platforms',
  'email-marketing',
  'equity-management',
  'error-tracking',
  'expense-management',
  'feature-flags',
  'file-converters',
  'fp-a',
  'fraud-prevention',
  'frontend-frameworks',
  'frontier-models',
  'game-engines',
  'gpu-clouds',
  'gpus',
  'processors',
  'identity-verification',
  'incident-management',
  'inference-providers',
  'infra-as-code',
  'legal-ops',
  'llm-evals-observability',
  'local-llm-runtimes',
  'marketplace-payments',
  'mcp-infrastructure',
  'meeting-ai',
  'mobile-dev',
  'mobile-payments',
  'notes-knowledge',
  'package-managers',
  'payments',
  'model-gateways',
  'payroll',
  'product-analytics',
  'product-feedback',
  'robotics-platforms',
  'project-management',
  'scheduling',
  'screen-sharing',
  'search-infra',
  'security-keys',
  'security-scanners',
  'self-hosted-assistants',
  'serverless-databases',
  'software-factory',
  'sso-identity',
  'stablecoin-payments',
  'startup-banking',
  'startup-immigration',
  'startup-law-firms',
  'government-services',
  'tax-automation',
  'team-chat',
  'terminals',
  'vector-databases',
  'vibe-coding',
  'virtual-mailboxes',
  'voice-agents',
  'web-scraping',
  'workflow-automation',
  'observability',
]

function readJson<T>(schema: { parse: (v: unknown) => T }, file: string): T {
  return schema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
}

let allMatch = true
const results: string[] = []
for (const cat of CATEGORIES) {
  const dataDir = path.join(ROOT, 'open-rankings', cat)
  const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
  const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
  const verdicts = readJson(VerdictSchema.array(), path.join(dataDir, 'verdicts.json'))
  const persisted = readJson(RankingsSchema, path.join(dataDir, 'rankings.json'))
  // Same stamp the derive stage applies — the provenance watermark is a pure function of the
  // rankings content, so it must reproduce exactly too.
  const recomputed = attachProvenance(cat, buildRankings(products, stories, verdicts, persisted.generatedAt))
  let match = JSON.stringify(recomputed) === JSON.stringify(persisted)
  // Country/area rollups (lib/rollups.ts) are derived the same way: where a persisted
  // rollups.json exists it must reproduce byte-for-byte from (products, persisted rankings).
  const rollupsPath = path.join(dataDir, 'rollups.json')
  if (fs.existsSync(rollupsPath)) {
    const persistedRollups = readJson(RollupsSchema, rollupsPath)
    const recomputedRollups = buildRollups(products, persisted)
    if (JSON.stringify(recomputedRollups) !== JSON.stringify(persistedRollups)) match = false
  }
  results.push(`${cat} ${match ? 'MATCH' : 'MISMATCH'}`)
  if (!match) allMatch = false
}

// open-rankings/step-rankings.json is derived from every arena's verdicts plus the process
// corpus and step→story mapping (lib/stepRankings.ts); it must reproduce byte-for-byte too.
const stepRankingsPath = path.join(ROOT, 'open-rankings', 'step-rankings.json')
const stepRankingsMatch = fs.existsSync(stepRankingsPath)
  && fs.readFileSync(stepRankingsPath, 'utf8') === serializeStepRankings(buildStepRankings(path.join(ROOT, 'open-rankings')))
results.push(`step-rankings ${stepRankingsMatch ? 'MATCH' : 'MISMATCH'}`)
if (!stepRankingsMatch) allMatch = false

console.log(results.join(' · '))
console.log(allMatch ? 'ALL DETERMINISTIC' : 'MISMATCH DETECTED')
process.exit(allMatch ? 0 : 1)
