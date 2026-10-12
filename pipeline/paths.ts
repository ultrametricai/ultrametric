import fs from 'node:fs'
import path from 'node:path'
import type { z } from 'zod'
import { CategorySchema, type Category } from '../lib/schemas'

export const ROOT = path.resolve(__dirname, '..')
// PA_DATA_DIR is the deprecated pre-rename spelling, honored as a fallback.
export const DATA_DIR = process.env.UM_DATA_DIR ?? process.env.PA_DATA_DIR ?? path.join(ROOT, 'rankings')
export const CACHE_DIR = path.join(ROOT, 'pipeline', 'cache')

export function categoryDir(categoryId: string): string {
  return path.join(DATA_DIR, categoryId)
}

export function readCategories(): Category[] {
  return readJson(CategorySchema.array(), path.join(DATA_DIR, 'categories.json'))
}

// Resolves the category (or categories) a stage should operate on: a single category when
// `categoryId` is given (throws if unknown), otherwise every category in categories.json.
export function resolveCategories(categoryId?: string): Category[] {
  const all = readCategories()
  if (!categoryId) return all
  const found = all.find((c) => c.id === categoryId)
  if (!found) throw new Error(`unknown category: ${categoryId}`)
  return [found]
}

export function readJson<T>(schema: z.ZodType<T>, file: string): T {
  return schema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
}

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}
