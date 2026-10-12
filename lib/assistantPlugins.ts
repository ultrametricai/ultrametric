// Assistant-plugin coverage map (rankings/assistant-plugins.json): RECORDED EVIDENCE of which of our
// vendors have an integration listed on each of the four assistant platforms — ChatGPT (Plugin
// Directory / Apps SDK), Claude (Connectors directory, remote MCP), Grok (Connectors catalog +
// BYO MCP), and Muse (Meta's fixed, Meta-reviewed connector directory). Probe-tier facts only:
// no scores, no verdicts. None of the four directories is keylessly crawlable per-entry (each
// platform record says exactly what 403'd/401'd and when), so entries carry their `source`
// (the public catalog capture they were swept from) and `urlStatus` (the HTTP status curl saw
// for `url` on `verifiedAt` — 403 = listing exists but bot-blocked keylessly, 0 = fetch failed).
// firstParty means the integration is published/operated by the vendor itself (e.g. a hosted MCP
// endpoint on the vendor's own domain), not by the platform or a community third party.
// Zod-validated at load; structural invariants (real product ids, known platforms, deterministic
// order) live in lib/__tests__/assistantPlugins.test.ts. Server-only (fs read at build time).
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

export const AssistantPlatformSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  // The platform's own name for its extension surface, e.g. "Connectors (remote MCP servers)".
  mechanism: z.string().min(1),
  directoryUrl: z.string().url(),
  // Whether the directory itself is keylessly fetchable — false for all four as of 2026-09-28;
  // `notes` records the observed HTTP behavior and the catalog capture used instead.
  crawlable: z.boolean(),
  notes: z.string().min(1).optional(),
})

export const AssistantPluginEntrySchema = z.object({
  productId: z.string().min(1),
  platform: z.string().min(1),
  // The integration's listed name on that platform (may differ from our product name,
  // e.g. "Atlassian Rovo" for jira, "Shop Pay" for shopify).
  name: z.string().min(1),
  url: z.string().url(),
  firstParty: z.boolean(),
  // connector | app | remote MCP — the platform-specific mechanism this listing uses.
  mechanism: z.string().min(1),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Which public catalog capture this entry was swept from (mirror repo or directory page).
  source: z.string().min(1),
  // HTTP status curl observed for `url` on verifiedAt (0 = keyless fetch failed/timed out).
  urlStatus: z.number().int().min(0).max(599),
})

export const AssistantPluginsFileSchema = z.object({
  generatedAt: z.string().min(1),
  note: z.string().min(1),
  platforms: AssistantPlatformSchema.array().min(1),
  sweep: z.object({
    rosterSize: z.number().int().positive(),
    boundary: z.string().min(1),
  }),
  entries: AssistantPluginEntrySchema.array().min(1),
})

export type AssistantPlatform = z.infer<typeof AssistantPlatformSchema>
export type AssistantPluginEntry = z.infer<typeof AssistantPluginEntrySchema>
export type AssistantPluginsFile = z.infer<typeof AssistantPluginsFileSchema>

const DEFAULT_FILE = () => path.join(process.cwd(), 'rankings', 'assistant-plugins.json')
let cache: { file: string; data: AssistantPluginsFile } | null = null

export function loadAssistantPlugins(file: string = DEFAULT_FILE()): AssistantPluginsFile {
  if (cache && cache.file === file) return cache.data
  const data = AssistantPluginsFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
  cache = { file, data }
  return data
}

// Entries for one product across all platforms, in the file's deterministic order.
export function assistantPluginsFor(productId: string, data: AssistantPluginsFile = loadAssistantPlugins()): AssistantPluginEntry[] {
  return data.entries.filter((e) => e.productId === productId)
}

// productId -> set of platform ids it is present on — the coverage map a surface would chip from.
// Pure over its input (tests drive it with fixtures).
export function coverageByProduct(entries: AssistantPluginEntry[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const e of entries) {
    let set = map.get(e.productId)
    if (!set) {
      set = new Set<string>()
      map.set(e.productId, set)
    }
    set.add(e.platform)
  }
  return map
}
