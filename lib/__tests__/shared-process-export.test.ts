import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  for (const directory of ['schemas', 'processes/records', 'processes/examples']) mkdirSync(path.join(root, directory), { recursive: true })
  writeFileSync(path.join(root, 'schemas/shared-process.schema.json'), sharedSchemaJson())
  const example = readFileSync(path.join(repo, 'processes/examples/staging.json'), 'utf8')
  writeFileSync(path.join(root, 'processes/examples/staging.json'), example)
  for (const record of JSON.parse(example)) writeFileSync(path.join(root, 'processes/records', `${record.id}.json`), JSON.stringify(record))
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
    const result = runExport(example)
    expect(result.status, result.stderr).toBe(0)
    const artifact = JSON.parse(readFileSync(path.join(root, 'catalog.json'), 'utf8'))
    expect(artifact.schema).toEqual(JSON.parse(sharedSchemaJson()))
    expect(artifact.records).toHaveLength(2)
    expect(artifact.sourceRevision).toBe(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim())
  })
})
