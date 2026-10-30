import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import importedIdentities from './fixtures/imported-process-identities.json'
import { loadProcessCatalog } from '../shared-processes/catalog'
import { recordForExport, recordForInstructions } from '../shared-processes/instructions'
import { projectChain, projectOperational } from '../shared-processes/projection'
import { validateCatalog } from '../shared-processes/schema'
import { buildManifestStep } from '../processManifest'
import {
  computeCeiling, findProcessBySlug, jurisdictionNodes, jurisdictionStepViews, loadChains, loadProcesses,
  ProcessChainSchema, ProcessTaskSchema, processSlug,
} from '../processes'
import { crossArenaStepRankings } from '../processRankings'
import { operationalSources } from './helpers/operational-sources'

const catalog = loadProcessCatalog().processes
const temporary: string[] = []
afterEach(() => temporary.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })))
const byId = (id: string) => catalog.find(item => item.record.id === id)!

describe('canonical operational readers', () => {
  const root = path.resolve(__dirname, '../..')

  it('preserves every projected task, conditional node and ordered chain', () => {
    const raw = ProcessTaskSchema.array().parse(operationalSources(root))
    const expected = raw.map(task => {
      const conditional = task.dag.nodes.filter(node => node.jurisdictions?.length)
      expect(jurisdictionNodes(task.id)).toEqual(conditional)
      if (!conditional.length) return task
      const nodes = task.dag.nodes.filter(node => !conditional.includes(node))
      const ids = new Set(nodes.map(node => node.id))
      return { ...task, dag: { nodes, edges: task.dag.edges?.filter(edge => ids.has(edge.from) && ids.has(edge.to)) } }
    })
    expect(loadProcesses()).toEqual(expected)
    expect(loadChains()).toEqual(ProcessChainSchema.array().parse(catalog.filter(item => item.taskIds).map(item => ({
      ...item.record.metadata, id: item.record.id, name: item.record.title, tagline: item.record.summary,
      taskIds: item.record.parts.map(part => part.ref),
    }))))
  })

  it('loads the same views and aliases from canonical files without compatibility files', () => {
    const fixture = mkdtempSync(path.join(os.tmpdir(), 'canonical-readers-'))
    temporary.push(fixture)
    const directory = path.join(fixture, 'open-processes')
    const data = path.join(fixture, 'open-rankings')
    mkdirSync(directory)
    const index = JSON.parse(readFileSync(path.join(root, 'open-processes/catalog.json'), 'utf8')) as { processes: string[] }
    for (const name of ['catalog', ...index.processes]) {
      cpSync(path.join(root, 'open-processes', `${name}.json`), path.join(directory, `${name}.json`))
    }
    expect(existsSync(path.join(directory, 'corpus.json'))).toBe(false)
    expect(existsSync(path.join(directory, 'chains.json'))).toBe(false)
    expect(existsSync(path.join(fixture, 'content/processes'))).toBe(false)
    const tasks = loadProcesses(data)
    expect(tasks).toEqual(loadProcesses())
    expect(loadChains(data)).toEqual(loadChains())
    expect(loadProcesses(data)).toBe(tasks)
    expect(loadChains(data)).toBe(loadChains(data))
    for (const task of tasks) {
      expect(jurisdictionNodes(task.id, data)).toEqual(jurisdictionNodes(task.id))
      expect(jurisdictionStepViews(task.id, data)).toEqual(jurisdictionStepViews(task.id))
      for (const slug of [processSlug(task.title), ...(task.slugAliases ?? []).map(alias => alias.slug)]) {
        expect(findProcessBySlug(slug, data)).toBe(task)
      }
    }
  })
})

describe('canonical diagram generator', () => {
  function fixture() {
    const root = mkdtempSync(path.join(os.tmpdir(), 'canonical-diagram-'))
    temporary.push(root)
    for (const directory of ['scripts', 'open-processes']) mkdirSync(path.join(root, directory))
    for (const directory of ['lib', 'node_modules']) symlinkSync(path.join(process.cwd(), directory), path.join(root, directory))
    cpSync('scripts/generate-process-diagram.mjs', path.join(root, 'scripts/generate-process-diagram.mjs'))
    for (const name of ['catalog', ...catalog.map(process => process.slug)]) {
      cpSync(`open-processes/${name}.json`, path.join(root, 'open-processes', `${name}.json`))
    }
    return root
  }

  const run = (root: string, ...args: string[]) => spawnSync(process.execPath, ['scripts/generate-process-diagram.mjs', ...args], { cwd: root, encoding: 'utf8' })

  it('preserves the default SVG and README embed without compatibility files', () => {
    const root = fixture()
    expect(existsSync(path.join(root, 'open-processes/corpus.json'))).toBe(false)
    expect(existsSync(path.join(root, 'open-processes/chains.json'))).toBe(false)
    const result = run(root)
    expect(result.status, result.stderr).toBe(0)
    const asset = 'open-processes/assets/incorporate-c-corp.svg'
    expect(readFileSync(path.join(root, asset))).toEqual(readFileSync(asset))
    expect(readFileSync('open-processes/README.md', 'utf8')).toContain('<img src="assets/incorporate-c-corp.svg" alt="Incorporate C-Corp step graph" width="700">')
  })

  it('generates the README examples with every authored node and edge, including the 409A join', () => {
    const root = fixture()
    const result = run(root, '--examples')
    expect(result.status, result.stderr).toBe(0)
    for (const slug of ['incorporate-c-corp', 'get-a-409a-valuation', 'set-up-mailing-address', 'sell-the-company-through-an-acquisition']) {
      const process = catalog.find(item => item.slug === slug)!
      const projected = projectOperational(process, catalog)!
      const asset = `open-processes/assets/${slug}.svg`
      const svg = readFileSync(path.join(root, asset), 'utf8')
      expect(svg).toBe(readFileSync(asset, 'utf8'))
      expect([...svg.matchAll(/data-node="([^"]+)"/g)].map(match => match[1]).sort())
        .toEqual(projected.dag.nodes.map(node => node.id).sort())
      expect([...svg.matchAll(/data-from="([^"]+)" data-to="([^"]+)"/g)].map(match => `${match[1]}:${match[2]}`).sort())
        .toEqual((projected.dag.edges ?? []).map(edge => `${edge.from}:${edge.to}`).sort())
      if (slug === 'get-a-409a-valuation') {
        expect(svg).toContain('data-from="n1" data-to="n3"')
        expect(svg).toContain('data-from="n2" data-to="n3"')
        expect(svg).not.toContain('Jurisdiction-specific steps')
      }
      if (slug === 'set-up-mailing-address') {
        // The current assessment overrides the historical agent route on address updates.
        const last = svg.slice(svg.indexOf('<g data-node="n3">')).split('</g>')[0]
        expect(last).toContain('Human Online')
        expect(last).not.toContain('Agent Native')
        expect(svg).toContain('Signature')
      }
    }
  })

  it('regenerates the README maps and preserves the conditional 83(b) scope and approvals', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'readme-maps-'))
    temporary.push(root)
    for (const file of ['scripts/generate-readme-maps.mjs', 'README.md', 'open-processes/get-ein.json',
      'open-processes/set-up-an-llc.json', 'open-processes/consider-a-section-83-b-election-after-a-restricted-property-transfer.json']) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      cpSync(file, path.join(root, file))
    }
    const result = spawnSync(process.execPath, ['scripts/generate-readme-maps.mjs'], { cwd: root, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    for (const name of ['83b-election-map', 'founder-country-switch', 'formation-and-growth-map']) {
      const file = `open-processes/assets/${name}.svg`
      expect(readFileSync(path.join(root, file))).toEqual(readFileSync(file))
      expect(readFileSync('README.md', 'utf8')).toContain(file)
    }
    const svg = readFileSync(path.join(root, 'open-processes/assets/83b-election-map.svg'), 'utf8')
    const record = byId('equity.us-de.83b-election').record
    expect([...svg.matchAll(/data-node="([^"]+)"/g)].map(match => match[1]))
      .toEqual(record.parts.map(part => part.id))
    expect([...svg.matchAll(/data-from="([^"]+)" data-to="([^"]+)"/g)].map(match => `${match[1]}:${match[2]}`))
      .toEqual(record.links.map(edge => `${edge.from}:${edge.to}`))
    expect(svg).toContain('stroke-dasharray="5 4"')
    expect(svg).toContain('eligible recipient chooses the election after tax review')
    expect(svg).toContain('demonstration')
    expect(svg.match(/Approval: recipient/g)).toHaveLength(2)
  })

  it('retains process/output arguments, escaping, and failure for an unknown process', () => {
    const root = fixture()
    const file = path.join(root, 'open-processes/generate-a-brand-logo.json')
    const definition = JSON.parse(readFileSync(file, 'utf8'))
    definition.title = 'Fixture & diagram <review>'
    definition.parts[0].title = 'Input & review <source>'
    writeFileSync(file, JSON.stringify(definition))
    const result = run(root, 'brand_002', 'results/logo.svg')
    expect(result.status, result.stderr).toBe(0)
    const svg = readFileSync(path.join(root, 'results/logo.svg'), 'utf8')
    expect(svg).toContain('aria-label="Fixture &amp; diagram &lt;review&gt; step graph"')
    expect(svg).toContain('Input &amp; review &lt;source&gt;')
    expect(existsSync(path.join(root, 'open-processes/assets/incorporate-c-corp.svg'))).toBe(false)
    const missing = run(root, 'fixture_missing', 'results/missing.svg')
    expect(missing.status).not.toBe(0)
    expect(missing.stderr).toContain('process fixture_missing not found')
    expect(existsSync(path.join(root, 'results/missing.svg'))).toBe(false)
  })
})

describe('canonical catalog consumer contract', () => {
  it('retains every historical identity and the existing situation classification', () => {
    // Every historical (imported) identity is retained; records authored after the import
    // (the non-profit and business-phone-number processes) sit beside them.
    const retained = new Set(catalog.map(item => item.record.id))
    for (const id of importedIdentities.ids) expect(retained.has(id), `historical identity ${id}`).toBe(true)
    expect(catalog).toHaveLength(266)
    expect(catalog.filter(item => item.taskIds)).toHaveLength(24)
    const situations = catalog.filter(item => item.record.metadata.kind === 'situation')
    expect(situations).toHaveLength(33)
    expect(situations.every(item => recordForExport(item).kind === 'situation')).toBe(true)
    expect(validateCatalog(catalog.map(recordForExport))).toHaveLength(catalog.length)
  })

  it('exports explicit DAG entries and preserves composition order without creating chain dependencies', () => {
    expect(catalog.map(projectChain).filter(Boolean)).toEqual(catalog.filter(item => item.taskIds).map(item => ({
      ...item.record.metadata, id: item.record.id, name: item.record.title, tagline: item.record.summary,
      taskIds: item.record.parts.map(part => part.ref),
    })))
    for (const item of catalog) {
      const exported = recordForExport(item)
      if (item.taskIds) {
        expect(exported.taskIds).toEqual(item.record.parts.map(part => part.ref))
        expect(exported.entrySteps).toBeUndefined()
        expect(exported.links).toEqual([])
        expect(exported.notes.at(-1)?.text).toContain(item.taskIds.join(' → '))
      } else expect(exported.entrySteps).toEqual(item.entrySteps)
    }
    const selected = loadProcessCatalog({ processes: ['first-hire'] }).processes
    for (const id of byId('first-hire').taskIds!) expect(selected.some(item => item.record.id === id)).toBe(true)
  })

  it('carries verification, failure recovery, scoped approvals and geography into assembler-visible notes', () => {
    const formation = recordForExport(byId('form_001'))
    const text = JSON.stringify(formation.parts.map(part => ({ notes: part.notes, options: part.options })))
    expect(text).toContain('Verification:')
    expect(text).toContain('Recovery:')
    expect(text).toContain('For stripe_atlas:')
    const geo = formation.notes.find(note => note.text.startsWith('IN (analog):'))!
    expect(geo.references?.some(ref => ref.kind === 'url' && ref.url === 'https://www.nsws.gov.in/')).toBe(true)
    expect(formation.notes.some(note => note.text.startsWith('Required context: founder legal names'))).toBe(true)
    const equity = recordForExport(byId('equity.us-de.409a-valuation'))
    expect(equity.notes.some(note => note.text.startsWith('Stop condition:'))).toBe(true)
    expect(equity.parts.some(part => part.notes.some(note => note.text.startsWith('Required approval from ')))).toBe(true)
    expect(JSON.stringify(equity)).not.toMatch(/"(?:toolCall|functionCalls)"/)
  })

  it('leaves authored records unchanged when projecting or enriching instructions', () => {
    const before = JSON.stringify(catalog)
    for (const item of catalog) {
      recordForExport(item)
      projectOperational(item, catalog)
      projectChain(item)
    }
    expect(JSON.stringify(catalog)).toBe(before)
    const sample = structuredClone(byId('brand_002').record)
    sample.metadata.supportReason = 'Internal integration availability assertion'
    sample.metadata.contextNeeded = [{ tool: 'private_connector', query: 'company name', required: true }]
    const notes = JSON.stringify(recordForInstructions(sample).notes)
    expect(notes).toContain('Required context: company name')
    expect(notes).not.toContain('private_connector')
    expect(notes).not.toContain('Internal integration')
  })

  it('propagates unknown logo timing and execution kind while preserving known estimates', () => {
    const task = loadProcesses().find(task => task.id === 'brand_002')!
    for (const id of ['design-brief', 'inspect-logo']) {
      const step = task.dag.nodes.find(step => step.id === id)!
      expect(step.estimatedMinutes).toBeUndefined()
      expect(buildManifestStep(step).estimatedMinutes).toBeUndefined()
    }
    const generate = task.dag.nodes.find(step => step.id === 'n1')!
    expect(generate.route).toBeUndefined()
    expect(buildManifestStep(generate).kind).toBe('unclassified')
    expect(buildManifestStep(generate).approvalRequired).toBe(true)
    expect(computeCeiling(task.dag.nodes).totalMinutes).toBeUndefined()
    const known = { ...task, dag: { nodes: [{ ...generate, route: 'agent' as const, estimatedMinutes: 7 }], edges: [] } }
    expect(computeCeiling(known.dag.nodes).totalMinutes).toBe(7)
  })

  it('preserves the original explicit logo vendor allowlist and its judged scores and citations', () => {
    const node = loadProcesses().find(task => task.id === 'brand_002')!.dag.nodes.find(node => node.id === 'n1')!
    const refs = [{ arenaId: 'ai-assistants', productId: 'chatgpt' }, { arenaId: 'ai-assistants', productId: 'gemini' },
      { arenaId: 'design-tools', productId: 'canva' }, { arenaId: 'design-tools', productId: 'figma' }]
    const current = crossArenaStepRankings('brand_002', node)
    expect(current).toEqual(crossArenaStepRankings('brand_002', { ...node, extraOptionRefs: refs }))
    expect(current.flatMap(ranking => ranking.vendors.map(vendor => `${ranking.arenaId}/${vendor.productId}`)).sort())
      .toEqual(refs.map(ref => `${ref.arenaId}/${ref.productId}`).sort())
  })

  it('checks generated drift without rewriting definitions or accepting an unindexed definition', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'canonical-projection-'))
    temporary.push(root)
    for (const file of ['lib/execution.ts', 'lib/shared-processes/catalog.ts', 'lib/shared-processes/schema.ts', 'lib/shared-processes/projection.ts',
      'scripts/shared-processes/project.ts', 'open-processes/generate-a-brand-logo.json']) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      cpSync(file, path.join(root, file))
    }
    symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(root, 'node_modules'))
    writeFileSync(path.join(root, 'open-processes/catalog.json'), JSON.stringify({ processes: ['generate-a-brand-logo'] }))
    const equity = catalog.find(item => item.record.id === 'equity.us-de.409a-valuation')!
    cpSync(`open-processes/${equity.slug}.json`, path.join(root, 'open-processes', `${equity.slug}.json`))
    writeFileSync(path.join(root, 'open-processes/catalog.json'), JSON.stringify({ processes: ['generate-a-brand-logo', equity.slug] }))
    mkdirSync(path.join(root, 'open-processes/equity/us-de'), { recursive: true })
    const definition = readFileSync(path.join(root, 'open-processes/generate-a-brand-logo.json'), 'utf8')
    const run = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/shared-processes/project.ts', ...args], { cwd: root, encoding: 'utf8' })
    expect(run('--write').status).toBe(0)
    expect(run().status).toBe(0)
    for (const retired of ['corpus.json', 'chains.json']) {
      const file = path.join(root, 'open-processes', retired)
      expect(existsSync(file)).toBe(false)
      writeFileSync(file, '[]\n')
      for (const args of [[], ['--write']]) {
        const result = run(...args)
        expect(result.status).not.toBe(0)
        expect(result.stderr).toContain('retired projection')
      }
      rmSync(file)
    }
    const workflow = path.join(root, 'open-processes/equity/us-de/409a-valuation.json')
    writeFileSync(workflow, '{}\n')
    expect(run().status).not.toBe(0)
    expect(run('--write').status).toBe(0)
    expect(run().status).toBe(0)
    expect(readFileSync(path.join(root, 'open-processes/generate-a-brand-logo.json'), 'utf8')).toBe(definition)
    writeFileSync(path.join(root, 'open-processes/orphan.json'), definition)
    expect(() => loadProcessCatalog(undefined, root)).toThrow('missing from catalog')
  })
})
