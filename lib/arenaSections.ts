// Curated higher-level sections for the header's Rankings dropdown (data/arena-sections.json):
// 65+ arenas grouped into ~9 scannable buckets ("AI & Agents", "Dev Tools", "Fintech & Back
// Office"…) with small uppercase headers, instead of one undifferentiated 65-row list. The
// curation lives in data (not code) so adding an arena is a one-line JSON edit; the invariant
// that EVERY arena in data/categories.json is assigned to exactly one section is enforced by
// lib/__tests__/arenaSections.test.ts — an unassigned arena would silently vanish from the menu.
// Section order in the file is display order; arenaIds order within a section is display order.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

export const ArenaSectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  arenaIds: z.string().min(1).array().min(1),
})

export const ArenaSectionsFileSchema = z.object({
  sections: ArenaSectionSchema.array().min(1),
})

export type ArenaSection = z.infer<typeof ArenaSectionSchema>

const DEFAULT_FILE = () => path.join(process.cwd(), 'data', 'arena-sections.json')
let cache: { file: string; sections: ArenaSection[] } | null = null

export function loadArenaSections(file: string = DEFAULT_FILE()): ArenaSection[] {
  if (cache && cache.file === file) return cache.sections
  const sections = ArenaSectionsFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).sections
  cache = { file, sections }
  return sections
}
