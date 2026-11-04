import { execFileSync, spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadProcessCatalog, validateFlow } from '../shared-processes/catalog'

const temporary: string[] = []
// maxRetries guards the macOS ENOTEMPTY race between the exporter child process exiting
// and its files becoming deletable.
afterEach(() => temporary.splice(0).forEach(folder => rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })))
describe('process authoring catalog', () => {
  it('preserves every authored logo value through catalog loading', () => {
    const { processes } = loadProcessCatalog({ processes: ['generate-a-brand-logo'] })
    const { entrySteps, ...record } = JSON.parse(readFileSync('open-processes/generate-a-brand-logo.json', 'utf8'))
    expect(processes).toHaveLength(1)
    expect(processes[0].slug).toBe('generate-a-brand-logo')
    expect(processes[0].record).toEqual(record)
    expect(processes[0].entrySteps).toEqual(entrySteps)
    for (const id of ['design-brief', 'inspect-logo']) {
      expect(processes[0].record.parts.find(part => part.id === id)?.metadata).toMatchObject({ route: 'agent', reversibility: 'reversible' })
    }
  })
  it('requires explicit entries and connections without inferred order', () => {
    expect(() => validateFlow(['a', 'b'], [], ['a'])).toThrow('reachable')
    expect(() => validateFlow(['a', 'b'], [{ from: 'a', to: 'b' }], ['a'])).not.toThrow()
    expect(() => validateFlow(['a', 'b'], [], ['a', 'b'])).not.toThrow()
    expect(() => validateFlow(['a', 'b'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }], ['a'])).toThrow()
  })
  it('selects process files explicitly and rejects registries and unsafe paths', () => {
    expect(() => loadProcessCatalog({ processes: ['business-logic-map'] })).toThrow()
    expect(() => loadProcessCatalog({ processes: ['chains'] })).toThrow()
    expect(() => loadProcessCatalog({ processes: ['../secret'] })).toThrow()
    expect(() => loadProcessCatalog({ processes: ['v1'] })).toThrow()
    const root = mkdtempSync(path.join(os.tmpdir(), 'process-catalog-'))
    temporary.push(root)
    mkdirSync(path.join(root, 'open-processes'))
    const definition = JSON.parse(readFileSync('open-processes/generate-a-brand-logo.json', 'utf8'))
    writeFileSync(path.join(root, 'open-processes/example.json'), JSON.stringify({ ...definition, links: [] }))
    expect(() => loadProcessCatalog({ processes: ['example'] }, root)).toThrow('reachable')
  })
})

function exportFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'candidate-export-'))
  temporary.push(root)
  const files = ['lib/execution.ts', 'lib/shared-processes/catalog.ts', 'lib/shared-processes/schema.ts', 'lib/shared-processes/json-schema.ts', 'lib/shared-processes/instructions.ts', 'scripts/shared-processes/export-candidate.ts', 'schemas/shared-process.schema.json', 'open-processes/generate-a-brand-logo.json']
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    cpSync(file, path.join(root, file))
  }
  symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(root, 'node_modules'))
  writeFileSync(path.join(root, '.gitignore'), 'node_modules\n')
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['add', '.'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic candidate'], { cwd: root })
  return root
}
function exportCandidate(root: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'scripts/shared-processes/export-candidate.ts', '--process', 'generate-a-brand-logo', '--output', 'catalog.json', '--lock', 'candidate.lock'], { cwd: root, encoding: 'utf8' })
}
describe('candidate source pin', () => {
  it.each(['lib/execution.ts', 'lib/shared-processes/json-schema.ts', 'lib/shared-processes/instructions.ts', 'scripts/shared-processes/export-candidate.ts'])('rejects uncommitted exporter code in %s', file => {
    const root = exportFixture()
    const source = path.join(root, file)
    writeFileSync(source, readFileSync(source, 'utf8') + '\n')
    const result = exportCandidate(root)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Commit candidate source before exporting')
    expect(existsSync(path.join(root, 'catalog.json'))).toBe(false)
  })
  it('exports reproducible JSON files without executable helper files in the lock', () => {
    const root = exportFixture()
    const result = exportCandidate(root)
    expect(result.status, result.stderr).toBe(0)
    const lock = JSON.parse(readFileSync(path.join(root, 'candidate.lock'), 'utf8'))
    expect(lock.sourceRevision).toBe(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim())
    expect(lock.files.map((file: { path: string }) => file.path)).toEqual(['open-processes/generate-a-brand-logo.json', 'schemas/shared-process.schema.json'])
  })
})
