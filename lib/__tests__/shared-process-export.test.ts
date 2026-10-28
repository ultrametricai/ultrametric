import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sharedSchemaJson } from '../shared-processes/json-schema'
import { sharedRecordSchema } from '../shared-processes/schema'

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
  for (const directory of ['lib', 'schemas', 'open-processes', 'scripts/shared-processes/examples']) mkdirSync(path.join(root, directory), { recursive: true })
  cpSync(path.join(repo, 'lib/execution.ts'), path.join(root, 'lib/execution.ts'))
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
  it.each([false, true])('rejects uncommitted execution validation code (example=%s)', (example) => {
    const file = path.join(root, 'lib/execution.ts')
    writeFileSync(file, readFileSync(file, 'utf8') + '\n// Uncommitted validation change.\n')
    const result = runExport(example)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Commit the shared records and schema before exporting')
    expect(existsSync(path.join(root, 'catalog.json'))).toBe(false)
  })

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

  it('preserves canonical logo content and generic/US tax-identifier boundaries in the normal export', () => {
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
    const taxId = sharedRecordSchema.parse(artifact.records.find((record: { id: string }) => record.id === 'form_002'))
    expect(taxId.title).toBe('Obtain the company tax identifiers')
    expect(taxId.metadata.geoScope).toBe('global')
    expect(taxId.aliases).toContain('get-ein')
    expect(taxId.globalSlug).toBe('obtain-the-company-tax-identifiers')
    expect(taxId.countryViews).toContainEqual({ country: 'US', title: 'Get an EIN', slug: 'get-ein' })
    expect(taxId.countryViews).toContainEqual({ country: 'UK', title: 'Confirm the company UTR', slug: 'confirm-the-company-utr-uk' })
    expect(taxId.guidance).toContain('Never request, collect, or transmit raw SSNs or ITINs in chat, tool arguments, saved company context, or agent-generated artifacts.')
    expect(taxId.notes.some(note => note.text.startsWith('Required context: confirmation') && note.text.endsWith('do not provide the identifier here'))).toBe(true)
    for (const part of taxId.parts.slice(0, 2)) {
      const us = part.notes.find(note => note.text.startsWith('US resolution (analog):'))!
      expect(us.text).toContain('directly in the official IRS workflow')
      expect(us.text).toContain('chat or tool arguments')
    }
    expect(taxId.parts[1].metadata.execution).toMatchObject({ category: 'human-online', reviewRequired: true })
    expect(taxId.parts[1].metadata.cost).toBeUndefined()
    expect(taxId.parts[1].notes.some(note => note.text.startsWith('US completion check:') && note.text.includes('CP 575'))).toBe(true)
    expect(taxId.parts[1].notes.some(note => note.text.startsWith('US cost: 0 USD'))).toBe(true)
    expect(taxId.parts[1].notes.some(note => note.text.includes('If the applicant is ineligible for the online assistant'))).toBe(true)
    expect(taxId.parts[2].guidance).toContain('Exclude raw SSNs and ITINs from saved context and agent-generated artifacts.')
    expect(JSON.stringify(taxId)).not.toContain('founder ssn')
  })
})
