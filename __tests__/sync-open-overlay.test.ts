import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Safety behavior of scripts/sync-open.mjs (docs/REPO-SPLIT-PLAN.md, section 2): manifest
// path sanitization, resolved-path collision integrity, and the overlay ledger that removes
// stale files after a pin bump. Every scenario runs the real script as a subprocess against
// throwaway temp directories; the gate is the exit code (execFileSync throws on non-zero).
// The repo's own tree is never touched.

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'sync-open.mjs')

const tempDirs: string[] = []

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

type Entry = {
  path: unknown
  type?: string
  disposition?: string
  overlay?: boolean
}

function manifestWith(entries: Entry[]): string {
  return JSON.stringify({
    version: 1,
    entries: entries.map(entry => ({
      type: 'dir',
      disposition: 'open',
      overlay: false,
      ...entry,
    })),
  })
}

function runScript(cwd: string, args: string[] = []): string {
  return execFileSync(process.execPath, [SCRIPT, ...args], { cwd }).toString('utf8')
}

function runScriptExpectingFailure(cwd: string, args: string[] = []): string {
  try {
    execFileSync(process.execPath, [SCRIPT, ...args], { cwd, stdio: 'pipe' })
  } catch (error) {
    const spawned = error as { status?: number; stderr?: Buffer }
    expect(spawned.status).toBe(1)
    return spawned.stderr?.toString('utf8') ?? ''
  }
  throw new Error('expected sync-open to exit non-zero')
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd })
}

function initConsumerRepo(trackedFiles: Record<string, string>): string {
  const root = makeTempDir('sync-open-consumer-')
  git(root, ['init', '--quiet'])
  for (const [file, content] of Object.entries(trackedFiles)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), content)
  }
  if (Object.keys(trackedFiles).length > 0) git(root, ['add', '--all'])
  return root
}

// Build a codeload-shaped tarball (one wrapper dir, stripped on extract) from a source
// tree, seed it into the consumer's download cache, and write the matching open.lock.
function pinArtifact(root: string, sha: string, sourceFiles: Record<string, string>): void {
  const stage = makeTempDir('sync-open-artifact-')
  const wrapper = path.join(stage, 'ultrametric-pin')
  for (const [file, content] of Object.entries(sourceFiles)) {
    fs.mkdirSync(path.dirname(path.join(wrapper, file)), { recursive: true })
    fs.writeFileSync(path.join(wrapper, file), content)
  }
  const cacheDir = path.join(root, 'node_modules', '.cache', 'open-artifact')
  fs.mkdirSync(cacheDir, { recursive: true })
  const tarPath = path.join(cacheDir, `${sha}.tar.gz`)
  execFileSync('tar', ['-czf', tarPath, '-C', stage, 'ultrametric-pin'])
  const tarballSha256 = createHash('sha256').update(fs.readFileSync(tarPath)).digest('hex')
  fs.writeFileSync(
    path.join(root, 'open.lock'),
    JSON.stringify({ repo: 'ultrametricai/ultrametric', sha, tarballSha256 })
  )
}

const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)

describe('manifest path sanitization', () => {
  it.each(['.', '..', '/etc/passwd', './components', 'lib/../app', 'data/'])(
    'rejects manifest entry path %j at load',
    badPath => {
      const dir = makeTempDir('sync-open-badpath-')
      fs.writeFileSync(path.join(dir, 'open-manifest.json'), manifestWith([{ path: badPath }]))
      const stderr = runScriptExpectingFailure(dir, ['--check'])
      expect(stderr).toContain('invalid entry path')
    }
  )
})

describe('overlay collision gate on resolved paths', () => {
  it('fails before removing anything when a tracked FILE sits at an overlay dir destination', () => {
    // Raw-string prefix matching (`f.startsWith(entry.path + '/')`) misses this case: a
    // tracked file named exactly `catalog` resolves to the same destination as the
    // overlay dir entry `catalog`, and would be silently deleted and replaced.
    const root = initConsumerRepo({ catalog: 'tracked closed-repo file\n' })
    pinArtifact(root, SHA_A, {
      'open-manifest.json': manifestWith([{ path: 'catalog', overlay: true }]),
      'catalog/inner.json': '{}\n',
    })
    const stderr = runScriptExpectingFailure(root)
    expect(stderr).toContain('collide')
    expect(fs.readFileSync(path.join(root, 'catalog'), 'utf8')).toBe('tracked closed-repo file\n')
  })

  it('fails when a FILE entry destination is currently a directory holding tracked files', () => {
    // rmSync is recursive for every destination, so the tracked-children check must run
    // for file entries too: `lib/data.ts` here is a tracked DIRECTORY in the consumer.
    const root = initConsumerRepo({ 'lib/data.ts/kept.txt': 'tracked content\n' })
    pinArtifact(root, SHA_A, {
      'open-manifest.json': manifestWith([{ path: 'lib/data.ts', type: 'file', overlay: true }]),
      'lib/data.ts': 'export {}\n',
    })
    const stderr = runScriptExpectingFailure(root)
    expect(stderr).toContain('collision with tracked path: lib/data.ts/kept.txt')
    expect(fs.readFileSync(path.join(root, 'lib', 'data.ts', 'kept.txt'), 'utf8')).toBe('tracked content\n')
  })

  it('refuses to copy or remove through a symlinked ancestor of the destination', () => {
    // resolveInsideRoot is lexical; a symlinked `lib` would redirect rmSync/cpSync at
    // `lib/data.ts` to a tree outside the repo root. The lstat ancestor walk must reject it.
    const outside = makeTempDir('sync-open-victim-')
    fs.writeFileSync(path.join(outside, 'data.ts'), 'victim outside the repo root\n')
    const root = initConsumerRepo({})
    fs.symlinkSync(outside, path.join(root, 'lib'))
    pinArtifact(root, SHA_A, {
      'open-manifest.json': manifestWith([{ path: 'lib/data.ts', type: 'file', overlay: true }]),
      'lib/data.ts': 'export {}\n',
    })
    const stderr = runScriptExpectingFailure(root)
    expect(stderr).toContain('symlink')
    expect(fs.readFileSync(path.join(outside, 'data.ts'), 'utf8')).toBe('victim outside the repo root\n')
  })

  it('fails when tracked files live under an overlay dir destination', () => {
    const root = initConsumerRepo({ 'data/site-owned.json': '{}\n' })
    pinArtifact(root, SHA_A, {
      'open-manifest.json': manifestWith([{ path: 'data', overlay: true }]),
      'data/foo.json': '{}\n',
    })
    const stderr = runScriptExpectingFailure(root)
    expect(stderr).toContain('collision with tracked path: data/site-owned.json')
    expect(fs.existsSync(path.join(root, 'data', 'site-owned.json'))).toBe(true)
  })
})

describe('overlay ledger', () => {
  it('materializes entries, records them, and removes a dropped entry on the next pin', () => {
    const root = initConsumerRepo({})
    pinArtifact(root, SHA_A, {
      'open-manifest.json': manifestWith([
        { path: 'data', overlay: true },
        { path: 'extra', overlay: true },
      ]),
      'data/foo.json': '{"v":1}\n',
      'extra/old.md': 'dropped after the pin bump\n',
    })
    runScript(root)
    expect(fs.readFileSync(path.join(root, 'data', 'foo.json'), 'utf8')).toBe('{"v":1}\n')
    expect(fs.existsSync(path.join(root, 'extra', 'old.md'))).toBe(true)
    const ledger = JSON.parse(fs.readFileSync(path.join(root, '.open-overlay-manifest.json'), 'utf8'))
    expect(ledger.paths).toEqual(['data', 'extra'])

    // Pin bump: the new manifest no longer lists `extra`; its files must not survive.
    pinArtifact(root, SHA_B, {
      'open-manifest.json': manifestWith([{ path: 'data', overlay: true }]),
      'data/foo.json': '{"v":2}\n',
    })
    runScript(root)
    expect(fs.readFileSync(path.join(root, 'data', 'foo.json'), 'utf8')).toBe('{"v":2}\n')
    expect(fs.existsSync(path.join(root, 'extra'))).toBe(false)
    const bumped = JSON.parse(fs.readFileSync(path.join(root, '.open-overlay-manifest.json'), 'utf8'))
    expect(bumped.paths).toEqual(['data'])
  })

  it('cleans up the partial output of a failed run after a pin change', () => {
    // The ledger is written before the copy loop, so a run that dies mid-copy (here: the
    // pinned tree is missing its second overlay path) still records what it materialized.
    const root = initConsumerRepo({})
    pinArtifact(root, SHA_A, {
      'open-manifest.json': manifestWith([
        { path: 'data', overlay: true },
        { path: 'zz-missing', overlay: true },
      ]),
      'data/foo.json': '{"v":1}\n',
    })
    const stderr = runScriptExpectingFailure(root)
    expect(stderr).toContain('pinned tree is missing overlay path: zz-missing')
    expect(fs.readFileSync(path.join(root, 'data', 'foo.json'), 'utf8')).toBe('{"v":1}\n')
    const partial = JSON.parse(fs.readFileSync(path.join(root, '.open-overlay-manifest.json'), 'utf8'))
    expect(partial.paths).toEqual(['data', 'zz-missing'])

    // A later run under a pin that drops both entries must remove the partial output.
    pinArtifact(root, SHA_B, {
      'open-manifest.json': manifestWith([{ path: 'other', overlay: true }]),
      'other/x.txt': 'y\n',
    })
    runScript(root)
    expect(fs.existsSync(path.join(root, 'data'))).toBe(false)
    expect(fs.readFileSync(path.join(root, 'other', 'x.txt'), 'utf8')).toBe('y\n')
    const ledger = JSON.parse(fs.readFileSync(path.join(root, '.open-overlay-manifest.json'), 'utf8'))
    expect(ledger.paths).toEqual(['other'])
  })

  it('leaves a stale ledger path in place when it is git-tracked in the consuming repo', () => {
    const root = initConsumerRepo({ 'adopted/kept.ts': 'now owned by the consuming repo\n' })
    fs.writeFileSync(
      path.join(root, '.open-overlay-manifest.json'),
      JSON.stringify({ version: 1, paths: ['adopted'] })
    )
    pinArtifact(root, SHA_A, {
      'open-manifest.json': manifestWith([{ path: 'data', overlay: true }]),
      'data/foo.json': '{}\n',
    })
    runScript(root)
    expect(fs.readFileSync(path.join(root, 'adopted', 'kept.ts'), 'utf8')).toBe(
      'now owned by the consuming repo\n'
    )
  })

  it.each(['../outside', '/absolute/path', 'a/../../escape'])(
    'refuses to act on ledger path %j',
    (badPath: string) => {
      const root = initConsumerRepo({})
      fs.writeFileSync(
        path.join(root, '.open-overlay-manifest.json'),
        JSON.stringify({ version: 1, paths: [badPath] })
      )
      pinArtifact(root, SHA_A, {
        'open-manifest.json': manifestWith([{ path: 'data', overlay: true }]),
        'data/foo.json': '{}\n',
      })
      const stderr = runScriptExpectingFailure(root)
      expect(stderr).toContain('.open-overlay-manifest.json')
    }
  )
})

describe('--check full-tree classification', () => {
  const baseEntries: Entry[] = [
    { path: 'open-manifest.json', type: 'file' },
    { path: 'covered' },
  ]

  it('fails when a tracked file has no covering manifest entry', () => {
    const root = initConsumerRepo({ 'covered/one.txt': 'x\n', 'rogue.txt': 'x\n' })
    fs.writeFileSync(path.join(root, 'open-manifest.json'), manifestWith(baseEntries))
    git(root, ['add', '--all'])
    const stderr = runScriptExpectingFailure(root, ['--check'])
    expect(stderr).toContain('unclassified tracked file: rogue.txt')
  })

  it('passes once every tracked file is covered by an entry', () => {
    const root = initConsumerRepo({ 'covered/one.txt': 'x\n', 'rogue.txt': 'x\n' })
    fs.writeFileSync(
      path.join(root, 'open-manifest.json'),
      manifestWith([...baseEntries, { path: 'rogue.txt', type: 'file' }])
    )
    git(root, ['add', '--all'])
    expect(runScript(root, ['--check'])).toContain('consistent with the tracked tree')
  })
})
