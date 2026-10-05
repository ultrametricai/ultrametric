import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// The post-build dedup (scripts/dedupe-segments.mjs, wired as package.json postbuild):
// _full.segment.rsc files that are byte-identical to their page .rsc become hardlinks,
// anything that differs is left alone. See docs/BUILD-SIZE.md round 3.
function makeApp(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dedupe-seg-'))
  const seg = path.join(root, 'arena/x/battle/a-vs-b.segments/arena/$d/battle/$d')
  mkdirSync(seg, { recursive: true })
  writeFileSync(path.join(root, 'arena/x/battle/a-vs-b.rsc'), 'IDENTICAL-PAYLOAD')
  writeFileSync(path.join(seg, '_full.segment.rsc'), 'IDENTICAL-PAYLOAD')
  const seg2 = path.join(root, 'vs/c-vs-d.segments/vs/$d')
  mkdirSync(seg2, { recursive: true })
  writeFileSync(path.join(root, 'vs/c-vs-d.rsc'), 'PAGE-PAYLOAD')
  writeFileSync(path.join(seg2, '_full.segment.rsc'), 'DIFFERENT-PAYLOAD')
  return root
}

describe('dedupe-segments postbuild', () => {
  it('hardlinks byte-identical _full.segment.rsc to the page .rsc and leaves differing files alone', () => {
    const root = makeApp()
    try {
      const out = execFileSync('node', ['scripts/dedupe-segments.mjs', root], { encoding: 'utf8' })
      expect(out).toContain('1 _full.segment.rsc linked')
      expect(out).toContain('1 skipped (content differs)')
      const page = statSync(path.join(root, 'arena/x/battle/a-vs-b.rsc'))
      const seg = statSync(path.join(root, 'arena/x/battle/a-vs-b.segments/arena/$d/battle/$d/_full.segment.rsc'))
      expect(seg.ino).toBe(page.ino)
      const diff = statSync(path.join(root, 'vs/c-vs-d.segments/vs/$d/_full.segment.rsc'))
      const diffPage = statSync(path.join(root, 'vs/c-vs-d.rsc'))
      expect(diff.ino).not.toBe(diffPage.ino)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('dry run reports without touching anything', () => {
    const root = makeApp()
    try {
      const out = execFileSync('node', ['scripts/dedupe-segments.mjs', root, '--dry-run'], { encoding: 'utf8' })
      expect(out).toContain('(dry run)')
      const page = statSync(path.join(root, 'arena/x/battle/a-vs-b.rsc'))
      const seg = statSync(path.join(root, 'arena/x/battle/a-vs-b.segments/arena/$d/battle/$d/_full.segment.rsc'))
      expect(seg.ino).not.toBe(page.ino)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
