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
  ProcessChainSchema, ProcessTaskSchema, processSlug, StepGeoResolutionSchema,
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
    expect(catalog).toHaveLength(186)
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

  it('keeps personal tax identifiers outside generic and US process context', () => {
    const record = recordForExport(byId('form_002'))
    expect(record.title).toBe('Obtain the company tax identifiers')
    expect(record.aliases).toEqual(expect.arrayContaining(['obtain-the-company-tax-identifiers', 'get-ein', 'confirm-the-company-utr-uk']))
    expect(record.globalSlug).toBe('obtain-the-company-tax-identifiers')
    expect(record.countryViews).toContainEqual({ country: 'US', title: 'Get an EIN', slug: 'get-ein' })
    expect(record.countryViews).toContainEqual({ country: 'UK', title: 'Confirm the company UTR', slug: 'confirm-the-company-utr-uk' })
    expect(record.metadata.geoScope).toBe('global')
    expect(record.metadata.slugAliases).toContainEqual({ slug: 'get-ein', label: 'Get EIN' })
    expect(record.entrySteps).toEqual(['n2'])
    expect(record.parts.map(part => part.id)).toEqual(['n2', 'n3', 'n4'])
    expect(record.links).toEqual([{ from: 'n2', to: 'n3', when: null }, { from: 'n3', to: 'n4', when: null }])
    expect(record.guidance).toContain('Never request, collect, or transmit raw SSNs or ITINs in chat, tool arguments, saved company context, or agent-generated artifacts.')
    expect(record.guidance).toContain("directly in the official tax authority's application or permitted filing channel")
    expect(record.notes).toContainEqual({ text: "Required context: confirmation that the responsible person can enter any required personal tax identifier directly in the official tax authority's workflow; do not provide the identifier here" })
    for (const part of record.parts.slice(0, 2)) {
      const us = StepGeoResolutionSchema.array().parse(part.metadata.geoResolutions).find(row => row.country === 'US')!
      expect(us.kind).toBe('analog')
      expect(us.guidance).toContain('directly in the official IRS workflow')
      expect(us.guidance).toContain('chat or tool arguments')
      expect(part.notes.some(note => note.text.startsWith('US resolution (analog):') && note.text.includes(us.guidance!))).toBe(true)
    }
    const filing = record.parts[1]
    expect(filing.metadata.verify).toEqual({ how: 'Retain the official confirmation or accepted documents required for this step in the selected jurisdiction; reconcile them with the approved company records.' })
    expect(filing.metadata.cost).toBeUndefined()
    const usFiling = StepGeoResolutionSchema.array().parse(filing.metadata.geoResolutions).find(row => row.country === 'US')!
    expect(usFiling.verify?.how).toContain('CP 575')
    expect(usFiling.cost?.usd).toBe(0)
    expect(filing.notes.some(note => note.text.startsWith('US completion check:') && note.text.includes('CP 575'))).toBe(true)
    expect(filing.notes.some(note => note.text.startsWith('US cost: 0 USD'))).toBe(true)
    expect(filing.metadata.execution).toMatchObject({ category: 'human-online', basis: 'human-work', reviewRequired: true })
    expect(JSON.stringify(filing.metadata.execution)).toContain('Existing restrictions on automated access remain')
    expect(filing.notes.some(note => note.text.includes('If the applicant is ineligible for the online assistant, use the appropriate IRS alternative'))).toBe(true)
    expect(record.parts[2].guidance).toContain('Exclude raw SSNs and ITINs from saved context and agent-generated artifacts.')
    expect(record.parts[2].guidance).toContain('keep it outside agent retrieval')
    expect(JSON.stringify(record)).not.toContain('founder ssn')
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
