import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

// coverage/index.json is the cross-area rollup: one entry per top-level content area, each
// pointing at the file where that area tracks its own gaps in detail. These gates stop the
// index drifting from the tree: a content area added or removed without an index entry
// fails CI, as does a pointer at a moved or deleted detail source. Everything reads the
// committed tree; no network.

interface DetailPointer {
  path: string
  tracks: string
}
interface Area {
  id: string
  name: string
  maturity: string
  summary: string
  known_gaps: string[]
  detail: DetailPointer[]
}
interface CoverageIndex {
  updated_on: string
  maturity_grades: Record<string, string>
  areas: Area[]
}

const ROOT = path.resolve(__dirname, '..')
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'coverage/index.json'), 'utf8')) as CoverageIndex
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/coverage-index.schema.json'), 'utf8'))

// The content dirs the index must cover: every top-level open-* catalog plus jurisdictions.
// Derived from the git-tracked tree so an untracked scratch directory cannot widen the list.
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1024 * 1024 * 512 })
  .toString('utf8').split('\0').filter(Boolean)
const contentDirs = [...new Set(tracked.filter((f) => f.includes('/')).map((f) => f.split('/')[0]))]
  .filter((dir) => dir.startsWith('open-') || dir === 'jurisdictions')
  .sort()

describe('coverage/index.json', () => {
  it('validates against the committed schema, byte-stable', () => {
    expect(z.fromJSONSchema(schema).parse(index)).toEqual(index)
  })

  it('lists exactly the top-level content areas (an area exists if and only if it is listed)', () => {
    const ids = index.areas.map((area) => area.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(contentDirs)
  })

  it('every area and every detail pointer resolves to a committed path', () => {
    const trackedSet = new Set(tracked)
    for (const area of index.areas) {
      expect(fs.statSync(path.join(ROOT, area.id)).isDirectory(), `${area.id} is not a directory`).toBe(true)
      for (const pointer of area.detail) {
        expect(trackedSet.has(pointer.path), `${area.id}: detail source ${pointer.path} is not a tracked file`).toBe(true)
      }
    }
  })

  it('every maturity grade an area uses is defined in maturity_grades', () => {
    for (const area of index.areas) {
      expect(Object.keys(index.maturity_grades), `${area.id} uses an undefined grade`).toContain(area.maturity)
    }
  })
})
