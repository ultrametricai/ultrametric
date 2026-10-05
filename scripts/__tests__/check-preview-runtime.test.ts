import { afterEach, describe, expect, it } from 'vitest'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { staticTargets, stopRuntime } from '../check-preview-runtime.mjs'

const roots: string[] = []
const checker = path.resolve('scripts/check-preview-runtime.mjs')
const traces = ['processes/preview/page.js.nft.json', 'processes/preview/[id]/page.js.nft.json', 'processes/incorporate-c-corp/v2/page.js.nft.json']
const inputs = ['processes/corpus.json', 'journeys/chains.json', 'processes/business-logic-map.json']
function fixture(omit?: { trace: number; file: string }, staticExtras: string[] = []) {
  const root = mkdtempSync(path.join(tmpdir(), 'preview-trace-test-'))
  roots.push(root)
  for (const file of inputs) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), '[]')
  }
  traces.forEach((trace, index) => {
    const filename = path.join(root, '.next/server/app', trace)
    mkdirSync(path.dirname(filename), { recursive: true })
    const files = inputs.filter(file => omit?.trace !== index || omit.file !== file)
      .map(file => path.relative(path.dirname(filename), path.join(root, file)))
    writeFileSync(filename, JSON.stringify({ version: 1, files }))
  })
  // Static routes' traces must carry code/deps only — never the build-time-only data dirs
  // that next.config.ts's outputFileTracingExcludes keeps out of the deployment.
  for (const target of staticTargets) {
    const filename = path.join(root, '.next/server/app', target.trace)
    mkdirSync(path.dirname(filename), { recursive: true })
    const files = ['node_modules/next/dist/server/next-server.js', ...staticExtras]
      .map(file => path.relative(path.dirname(filename), path.join(root, file)))
    writeFileSync(filename, JSON.stringify({ version: 1, files }))
  }
  return root
}
function check(root: string) {
  return spawnSync(process.execPath, [checker, '--root', root, '--trace-only'], { encoding: 'utf8' })
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('preview deployment trace regression gate', () => {
  it('accepts all required runtime files in every preview trace', () => {
    expect(check(fixture()).status).toBe(0)
  })
  it.each(traces.map((trace, index) => ({ trace, index })))('rejects any omitted runtime file in $trace', ({ index }) => {
    for (const file of inputs) {
      const result = check(fixture({ trace: index, file }))
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(`deployment trace omits ${file}`)
    }
  })
  it('rejects a listed runtime file that is absent from disk', () => {
    const root = fixture()
    rmSync(path.join(root, 'journeys/chains.json'))
    const result = check(root)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('ENOENT')
  })
})

describe('static trace exclusion regression gate', () => {
  it.each(['data/ai-coding/verdicts.json', 'public/data/categories.json', 'pipeline/cache/claims.json'])(
    'rejects a static trace that carries build-time-only file %s', extra => {
      const result = check(fixture(undefined, [extra]))
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(`build-time-only file ${extra}`)
    })
  it('accepts static traces that only carry code and dependencies', () => {
    expect(check(fixture()).status).toBe(0)
  })
})

describe('packaged runtime cleanup', () => {
  it('finishes after a failed spawn that never emits exit', async () => {
    const root = fixture()
    const child = spawn(path.join(root, 'missing-executable'))
    const [error] = await once(child, 'error')
    expect(error.code).toBe('ENOENT')
    expect(child.pid).toBeUndefined()
    await stopRuntime(child)
  }, 2_000)
  it('stops a running server process', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'])
    await once(child, 'spawn')
    await stopRuntime(child)
    expect(child.signalCode).toBe('SIGTERM')
    await stopRuntime(child) // already terminated: do not wait for another exit
  }, 2_000)
})
