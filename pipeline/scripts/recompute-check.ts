// Standalone determinism check: calls buildRankings() directly against on-disk data for every
// category and deep-compares against the persisted rankings.json. Used as a sanity gate after
// any manual verdicts.json edit (e.g. pipeline/scripts/revert-churn.ts) to confirm the derive
// step was applied cleanly and rankings.json isn't stale/drifted.
import fs from 'node:fs'
import path from 'node:path'
import { attachProvenance } from '../../lib/provenance'
import { ProductSchema, RankingsSchema, StorySchema, VerdictSchema } from '../../lib/schemas'
import { buildRankings } from '../../lib/scoring'

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
  const dataDir = path.join(ROOT, 'data', cat)
  const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
  const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
  const verdicts = readJson(VerdictSchema.array(), path.join(dataDir, 'verdicts.json'))
  const persisted = readJson(RankingsSchema, path.join(dataDir, 'rankings.json'))
  // Same stamp the derive stage applies — the provenance watermark is a pure function of the
  // rankings content, so it must reproduce exactly too.
  const recomputed = attachProvenance(cat, buildRankings(products, stories, verdicts, persisted.generatedAt))
  const match = JSON.stringify(recomputed) === JSON.stringify(persisted)
  results.push(`${cat} ${match ? 'MATCH' : 'MISMATCH'}`)
  if (!match) allMatch = false
}

console.log(results.join(' · '))
console.log(allMatch ? 'ALL DETERMINISTIC' : 'MISMATCH DETECTED')
process.exit(allMatch ? 0 : 1)
