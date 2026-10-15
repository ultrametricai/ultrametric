import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

// coverage/index.json is the cross-area rollup: one entry per top-level content area, each
// pointing at the file where that area tracks its own gaps in detail. These gates stop the
// index drifting from the tree: the area list must match the directories the README layout
// tree names (each pinned to a real tracked directory here and in readme.test.ts), every
// detail pointer must resolve to a committed file, and the index must validate against the
// committed schema. Everything reads the committed tree; no network.

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

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1024 * 1024 * 512 })
  .toString('utf8').split('\0').filter(Boolean)
const topLevelDirs = new Set(tracked.filter((f) => f.includes('/')).map((f) => f.split('/')[0]))

// The area list the index must carry: the directories the README layout tree names.
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
const tree = readme.slice(readme.indexOf('<pre>'), readme.indexOf('</pre>'))
const treeDirs = [...tree.matchAll(/^[├└]── (?:<a href="#[a-z-]+">)?([a-z][a-z-]*)(?:<\/a>)?\//gm)]
  .map((match) => match[1])

describe('coverage/index.json', () => {
  it('validates against the committed schema, byte-stable', () => {
    expect(z.fromJSONSchema(schema).parse(index)).toEqual(index)
  })

  it('lists exactly the README layout-tree areas (an area is listed if and only if the tree names it)', () => {
    const ids = index.areas.map((area) => area.id)
    expect(treeDirs.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...treeDirs].sort())
  })

  it('covers every tracked open-* catalog and jurisdictions, so a new content dir needs an entry', () => {
    const ids = new Set(index.areas.map((area) => area.id))
    for (const dir of topLevelDirs) {
      if (dir.startsWith('open-') || dir === 'jurisdictions') {
        expect(ids.has(dir), `top-level content dir ${dir} has no index entry`).toBe(true)
      }
    }
  })

  it('every area and every detail pointer resolves to a committed path', () => {
    const trackedSet = new Set(tracked)
    for (const area of index.areas) {
      expect(topLevelDirs.has(area.id), `${area.id} is not a tracked top-level directory`).toBe(true)
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
