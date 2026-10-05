import { describe, expect, it } from 'vitest'
import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import config from '../../next.config'
import { loadChains, loadProcesses, processSlug, taskCeiling } from '../processes'
import { readSharedCatalog, findSharedRecord, sharedProcessHref } from '../shared-processes/reader'
import { buildProcessRouteRegistry, processRouteRedirects } from '../shared-processes/routes'
import { withProcessSearchParams } from '../shared-processes/redirect-query'
import { processAnchorContract, regionForGeo, resolveProcessAnchor } from '../shared-processes/compatibility'
import { regionalDecision } from '../shared-processes/regions'
import { generateMetadata, generateStaticParams } from '@/app/processes/[slug]/page'
import { GET, generateStaticParams as manifestParams } from '@/app/processes/[slug]/manifest.json/route'
import { buildProcessManifest } from '../processManifest'
import { buildCanonicalProcessIndex } from '../shared-processes/index-rows'
import { stepGuidanceFor } from '../shared-processes/step-guidance'
import { parseViaParam } from '../processLens'
import { readFileSync } from 'node:fs'
import { buildStoryGraph } from '../storyProcessGraph'
import { VS_EVENTS } from '../virtualStartupRun'

const records = readSharedCatalog()
const tasks = loadProcesses()
const registry = buildProcessRouteRegistry(records)

describe('canonical process cutover identity and URL contracts', () => {
  it('keeps the committed process/story graph and simulator/chain identities unchanged', () => {
    expect(buildStoryGraph()).toEqual(JSON.parse(readFileSync('data/graph.json', 'utf8')))
    for (const event of VS_EVENTS) expect(findSharedRecord(records, event.groundedIn)?.id).toBe(event.groundedIn)
    for (const chain of loadChains()) expect(findSharedRecord(records, chain.id)?.id).toBe(chain.id)
    for (const task of tasks) {
      const record = findSharedRecord(records, task.id)!
      expect(record.source?.id).toBe(task.id)
      expect(record.metadata.slugAliases ?? []).toEqual(task.slugAliases ?? [])
      // Operation strings remain in the existing execution source, never inferred
      // from canonical prose or flattened from a decision's alternative paths.
      expect(JSON.stringify(record)).not.toContain('"toolCall":')
      expect(JSON.stringify(record)).not.toContain('"functionCalls":')
    }
  })
  it('resolves every existing canonical slug, immutable ID, and all legacy aliases to the same record', () => {
    expect(generateStaticParams()).toHaveLength(records.length)
    let aliases = 0
    for (const task of tasks) {
      expect(findSharedRecord(records, processSlug(task.title))?.id).toBe(task.id)
      expect(sharedProcessHref(task.id, records)).toBe(`/processes/${processSlug(task.title)}`)
      for (const key of [task.id, ...(task.slugAliases ?? []).map(alias => alias.slug)]) expect(findSharedRecord(records, key)?.id).toBe(task.id)
      aliases += task.slugAliases?.length ?? 0
    }
    expect(aliases).toBe(56)
    expect(registry.byKey.size).toBe(376)
    const collision = structuredClone(records.slice(0, 2))
    collision[1].metadata.slugAliases = [{ slug: collision[0].id.replaceAll('_', '-'), label: 'old name' }]
    collision[0].aliases = [collision[0].id.replaceAll('_', '-')]
    expect(() => buildProcessRouteRegistry(collision)).toThrow('Ambiguous process route')
    expect(findSharedRecord(records, 'unpublished-process')).toBeUndefined()
  })

  it('redirects every old preview key directly to its canonical record without loops', () => {
    const redirects = processRouteRedirects(records)
    const bySource = new Map(redirects.map(redirect => [redirect.source, redirect]))
    expect(bySource.size).toBe(redirects.length)
    for (const [key, record] of registry.byKey) {
      const redirect = bySource.get(`/processes/preview/${key}`)!
      expect(redirect.destination).toBe(sharedProcessHref(record.id, records))
      expect(bySource.has(redirect.destination)).toBe(false)
      expect(redirect.permanent).toBe(true)
      expect(redirect.destination).not.toMatch(/[?#]/)
    }
    expect(bySource.get('/processes/incorporate-c-corp/v2')?.destination).toBe('/processes/incorporate-c-corp')
    expect(bySource.has('/processes/open-a-bank-account/v2')).toBe(false)
  })

  it('uses Next redirect matching to retain repeated, unknown and selection parameters', async () => {
    for (const path of ['/processes/preview/form_001', '/processes/incorporate-c-corp/v2', '/processes/incorporate-a-company']) {
      const response = await unstable_getResponseFromNextConfig({ url: `https://ultrametric.ai${path}?via=legal-ops:clerky&via=payments:stripe&geo=IN&extra=keep`, nextConfig: config })
      expect(response.status).toBe(308)
      const destination = new URL(getRedirectUrl(response)!)
      expect(destination.pathname).toBe('/processes/incorporate-c-corp')
      // Next's experimental config-testing utility folds repeated values into one
      // comma string. Assert lens semantics here; check-process-cutover.ts exercises
      // the real HTTP router and requires repeated values to survive individually.
      expect(parseViaParam(destination.searchParams.getAll('via'))).toEqual({ 'legal-ops': 'clerky', payments: 'stripe' })
      expect(destination.searchParams.get('geo')).toBe('IN')
      expect(destination.searchParams.get('extra')).toBe('keep')
      expect(destination.hash).toBe('') // HTTP cannot receive a fragment; browser inheritance is separately exercised.
    }
    const fallback = new URL(withProcessSearchParams('/processes/incorporate-c-corp', { via: ['a:b', 'c:d'], geo: 'GB', x: 'keep' }), 'https://ultrametric.ai')
    expect(fallback.searchParams.getAll('via')).toEqual(['a:b', 'c:d'])
    expect(fallback.searchParams.get('x')).toBe('keep')
  })

  it('keeps all alias manifests on the existing canonical execution payload', async () => {
    const params = new Set(manifestParams().map(param => param.slug))
    for (const task of tasks) {
      for (const key of [task.id, processSlug(task.title), ...(task.slugAliases ?? []).map(alias => alias.slug)]) {
        expect(params.has(key)).toBe(true)
        const response = await GET(new Request(`https://ultrametric.ai/processes/${key}/manifest.json`), { params: Promise.resolve({ slug: key }) })
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(buildProcessManifest(task))
      }
    }
  })

  it('publishes shared metadata and discovers shared-only records while preserving the situations split and execution metrics', async () => {
    const index = buildCanonicalProcessIndex()
    expect(index.rows.some(row => row.kind === 'situation')).toBe(false)
    expect(index.playbooks).toHaveLength(loadChains().length)
    expect([...index.rows, ...index.playbooks].every(row => row.href?.startsWith('/processes/') && !row.href.includes('/preview/'))).toBe(true)
    for (const record of records) {
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: registry.slugs.get(record.id)! }) })
      expect(metadata.description).toBe(record.summary)
      expect(metadata.alternates?.canonical).toBe(`https://ultrametric.ai${sharedProcessHref(record.id, records)}`)
      expect(metadata.robots).toBeUndefined()
      const task = tasks.find(task => task.id === record.id)
      const row = index.rows.find(row => row.href === sharedProcessHref(record.id, records))
      if (task && row) expect(row.pct).toBe(taskCeiling(task).pct)
    }
  })
})

describe('legacy and native anchor contracts', () => {
  it('maps every default legacy node to an existing source scope without renaming any scope', () => {
    let count = 0
    for (const task of tasks) {
      const record = findSharedRecord(records, task.id)!
      const contract = processAnchorContract(record, records, task)
      for (const node of task.dag.nodes) {
        const key = `step-${task.id}-${node.id}`
        const target = contract.targets[key]
        expect(contract.scopes[target], key).toBeDefined()
        expect(contract.aliases[target]).toContain(key)
        expect(resolveProcessAnchor(contract, `#${key}`, 'default', false).status).toBe('reachable')
        count++
      }
    }
    expect(count).toBe(856)
  })

  it('preserves reviewed branding activities and records the pre-existing logo title drift', () => {
    const logo = findSharedRecord(records, 'brand_002')!
    const task = tasks.find(task => task.id === logo.id)!
    const contract = processAnchorContract(logo, records, task)
    expect(contract.targets['step-brand_002-n1']).toBe('brand_002:n1:image-generation')
    expect(contract.targets['step-brand_002-n2']).toBe('brand_002:n2')
    const returned = logo.parts.find(part => part.id === 'n2')!
    expect(returned.metadata.producesArtifact).toBe('brand-logo')
    expect(returned.guidance?.trim()).toBe(stepGuidanceFor('brand_002', 'n2'))
    // Existing stable-ID mapping predates cutover; this does not claim selection equals handoff.
    expect(task.dag.nodes.find(node => node.id === 'n2')?.label).toBe('Set primary logo')
    expect(returned.title).toBe('Return the useful logo set and design choices')
  })

  it('honors explicit geo conflicts and restores source-declared options only when geo is absent', () => {
    const record = findSharedRecord(records, 'form_001')!
    const contract = processAnchorContract(record, records, tasks.find(task => task.id === record.id))
    const india = regionForGeo(regionalDecision(record), 'IN')
    expect(india).toEqual({ explicit: true, region: 'india-spice-plus' })
    expect(regionForGeo(regionalDecision(record), 'GB').region).toBe('uk-companies-house')
    expect(resolveProcessAnchor(contract, '#step-form_001-n1', india.region!, true).status).toBe('conflict')
    expect(resolveProcessAnchor(contract, '#step-form_001-n4', india.region!, true)).toEqual({ status: 'reachable', target: 'form_001:n4', region: undefined })
    expect(resolveProcessAnchor(contract, '#form_001%3An4%3Aindia-spice-plus', 'default', false)).toEqual({ status: 'reachable', target: 'form_001:n4:india-spice-plus', region: 'india-spice-plus' })
    expect(resolveProcessAnchor(contract, '#%invalid', 'default', false).status).toBe('unknown')
  })
})
