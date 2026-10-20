import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  auditProcessArenaCoverage,
  processArenaCoverageMarkdown,
} from '../../scripts/generate-process-arena-coverage'

// Coverage assertions read canonical definitions and the registry directly.
// The CLI reports current gaps without writing a tracked report.

const temporary: string[] = []
afterEach(() => temporary.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })))

describe('process → arena coverage audit', () => {
  it('has ZERO mechanical gaps: every registry arenaId names a real arena', () => {
    // The one auto-fixable class (a key typo pointing at nothing) must stay empty — anything
    // else in the report is curation, but this failing means a registry edit broke a pointer.
    expect(auditProcessArenaCoverage().badArena).toEqual([])
  })

  it('classifies every corpus vendor: tracked + deliberately untracked + unregistered = all', () => {
    const a = auditProcessArenaCoverage()
    expect(a.tracked.length + a.untrackedRegistered.length + a.unregistered.length).toBe(a.vendorRefs.size)
    // Tracked vendors dominate — the registry is the resolution path, not the exception.
    expect(a.tracked.length).toBeGreaterThan(a.unregistered.length)
  })

  it('runs without compatibility files and retains conditional, method and nested vendor references', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-coverage-'))
    temporary.push(root)
    for (const directory of ['scripts', 'open-processes', 'open-rankings']) fs.mkdirSync(path.join(root, directory))
    for (const directory of ['lib', 'node_modules']) fs.symlinkSync(path.join(process.cwd(), directory), path.join(root, directory))
    const index = JSON.parse(fs.readFileSync('open-processes/catalog.json', 'utf8')) as { processes: string[] }
    for (const file of [
      'scripts/generate-process-arena-coverage.ts', 'open-rankings/categories.json',
      ...['catalog', 'vendor-registry', ...index.processes].map(name => `open-processes/${name}.json`),
    ]) fs.copyFileSync(file, path.join(root, file))
    expect(fs.existsSync(path.join(root, 'open-processes/corpus.json'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'open-processes/chains.json'))).toBe(false)
    const run = () => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/generate-process-arena-coverage.ts'], { cwd: root, encoding: 'utf8' })
    const initial = run()
    expect(initial.status, initial.stderr).toBe(0)
    expect(initial.stdout).toBe(processArenaCoverageMarkdown())
    expect(fs.existsSync(path.join(root, 'docs'))).toBe(false)

    const file = path.join(root, 'open-processes/incorporate-c-corp.json')
    const definition = JSON.parse(fs.readFileSync(file, 'utf8'))
    const conditional = definition.parts.find((part: { metadata: { jurisdictions?: string[] } }) => part.metadata.jurisdictions?.length)
    conditional.references.push({ kind: 'vendor', role: 'stated-vendor', id: 'fixture_conditional' })
    const method = definition.parts.flatMap((part: { options: { parts: unknown[] }[] }) => part.options).find((option: { parts: unknown[] }) => option.parts.length)
    method.references.push({ kind: 'vendor', role: 'candidate', id: 'fixture_method' })
    method.parts[0].references.push({ kind: 'vendor', role: 'stated-vendor', id: 'fixture_nested' })
    fs.writeFileSync(file, JSON.stringify(definition))
    const modified = run()
    expect(modified.status, modified.stderr).toBe(0)
    expect(fs.existsSync(path.join(root, 'docs'))).toBe(false)
    for (const vendor of ['fixture_conditional', 'fixture_method', 'fixture_nested']) {
      expect(modified.stdout).toContain(`| \`${vendor}\` | \`form_001\` |`)
    }
  })
})
