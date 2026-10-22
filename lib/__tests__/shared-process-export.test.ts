import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sharedSchemaJson } from '../shared-processes/json-schema'

const repo = process.cwd()
let root: string

function commit() {
  execFileSync('git', ['add', '.'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic export fixture'], { cwd: root })
}

function runExport(example: boolean) {
  return spawnSync(process.execPath, [
    path.join(repo, 'node_modules/tsx/dist/cli.mjs'), path.join(repo, 'scripts/shared-processes/export.ts'),
    '--output', path.join(root, 'catalog.json'), ...(example ? ['--example'] : []),
  ], { cwd: root, encoding: 'utf8' })
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'um-shared-export-'))
  for (const directory of ['schemas', 'open-processes', 'scripts/shared-processes/examples']) mkdirSync(path.join(root, directory), { recursive: true })
  writeFileSync(path.join(root, 'schemas/shared-process.schema.json'), sharedSchemaJson())
  const example = readFileSync(path.join(repo, 'scripts/shared-processes/examples/staging.json'), 'utf8')
  writeFileSync(path.join(root, 'scripts/shared-processes/examples/staging.json'), example)
  const definitions = JSON.parse(example).map((record: { id: string; parts: Array<{ id: string }>; links: Array<{ to: string }> }) => {
    if (!record.parts.length) record.parts.push({ id: 'synthetic-step', kind: 'step', title: 'Synthetic step', guidance: 'Perform the synthetic check.', when: null, ref: null, options: [], references: [], notes: [], metadata: {} } as typeof record.parts[number])
    return { ...record, entrySteps: record.parts.filter(part => !record.links.some(link => link.to === part.id)).map(part => part.id) }
  })
  for (const record of definitions) writeFileSync(path.join(root, 'open-processes', `${record.id}.json`), JSON.stringify(record))
  writeFileSync(path.join(root, 'open-processes/catalog.json'), JSON.stringify({ processes: definitions.map((record: { id: string }) => record.id) }))
  execFileSync('git', ['init', '-q'], { cwd: root })
  commit()
})

afterEach(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))

describe('pinned catalog export', () => {
  it.each([false, true])('rejects a committed stale schema (example=%s) before writing an artifact', (example) => {
    const stale = JSON.parse(sharedSchemaJson())
    stale.properties.summary.maxLength = 1
    writeFileSync(path.join(root, 'schemas/shared-process.schema.json'), JSON.stringify(stale, null, 2) + '\n')
    commit()
    const result = runExport(example)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Regenerate schemas/shared-process.schema.json')
    expect(existsSync(path.join(root, 'catalog.json'))).toBe(false)
  })

  it.each([false, true])('exports the matching schema and committed revision (example=%s)', (example) => {
    expect(existsSync(path.join(root, 'content/processes'))).toBe(false)
    const result = runExport(example)
    expect(result.status, result.stderr).toBe(0)
    const artifact = JSON.parse(readFileSync(path.join(root, 'catalog.json'), 'utf8'))
    expect(artifact.schema).toEqual(JSON.parse(sharedSchemaJson()))
    expect(artifact.records).toHaveLength(2)
    expect(artifact.sourceRevision).toBe(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim())
  })

  it.each([false, true])('rejects an uncommitted example edit (example=%s)', (example) => {
    const file = path.join(root, 'scripts/shared-processes/examples/staging.json')
    const records = JSON.parse(readFileSync(file, 'utf8'))
    records[0].title = 'Uncommitted example edit'
    writeFileSync(file, JSON.stringify(records))
    const result = runExport(example)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Commit the shared records and schema before exporting')
    expect(existsSync(path.join(root, 'catalog.json'))).toBe(false)
  })

  it('preserves the canonical logo entry, graph, guidance and metadata in the normal export', () => {
    const directory = path.join(root, 'open-processes')
    rmSync(directory, { recursive: true })
    cpSync(path.join(repo, 'open-processes'), directory, { recursive: true })
    commit()
    const result = runExport(false)
    expect(result.status, result.stderr).toBe(0)
    const artifact = JSON.parse(readFileSync(path.join(root, 'catalog.json'), 'utf8'))
    const canonical = JSON.parse(readFileSync(path.join(repo, 'open-processes/generate-a-brand-logo.json'), 'utf8'))
    const projected = artifact.records.find((record: { id: string }) => record.id === canonical.id)
    expect(projected).toEqual({
      ...canonical,
      notes: [...canonical.notes,
        { text: 'Required artifacts: company-name' },
        { text: 'Produced artifacts: brand-logo' },
      ],
      parts: canonical.parts.map((part: { id: string; notes: unknown[] }) => part.id === 'n2'
        ? { ...part, notes: [...part.notes, { text: 'Produced artifact: brand-logo' }] }
        : part),
    })
  })
})
