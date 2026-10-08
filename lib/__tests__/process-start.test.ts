import { describe, expect, it } from 'vitest'
import { agentLaunch, processHandoffUrl, startPrompt, startRegionForCountry } from '../process-start'
import { findSharedRecord, readSharedCatalog } from '../shared-processes/reader'
import { processStartTarget } from '../shared-processes/start'

const records = readSharedCatalog()
const record = findSharedRecord(records, 'form_001')!
const target = processStartTarget(record)

describe('API-owned process handoff', () => {
  it('carries the exact stable identity for every public record', () => {
    for (const item of records) {
      const url = new URL(processHandoffUrl(processStartTarget(item)))
      expect(url.origin + url.pathname).toBe('https://api.ultrametric.ai/start')
      expect(url.searchParams.get('process')).toBe(item.id)
      expect([...url.searchParams.keys()]).toEqual(['process'])
    }
  })

  it('preserves only a valid public country option in copied prompts', () => {
    const region = target.regions.find(item => item.id !== 'default')!
    expect(new URL(processHandoffUrl(target, region.id)).searchParams.get('region')).toBe(region.id)
    expect(startPrompt(target, region.id)).toContain(`region=${region.id}`)
    expect(startPrompt(target, 'private-company')).not.toContain('private-company')
    expect(startPrompt(target)).toBe(`Start “${record.title}” with Ultrametric. Install and use the supported connection if needed. Read and follow https://api.ultrametric.ai/start?process=form_001`)
    expect(startPrompt(target)).not.toMatch(/open_process|auth login|npm install|companyId/)
  })

  it('encodes exact public identity for supported destinations', () => {
    for (const item of records) {
      const target = processStartTarget(item)
      for (const [method, endpoint, key] of [
        ['claude', 'https://claude.ai/new', 'q'],
        ['cursor', 'https://cursor.com/link/prompt', 'text'],
        ['chatgpt', 'https://chatgpt.com/', 'q'],
      ] as const) {
        const url = new URL(agentLaunch(target, method)!.href)
        expect(url.origin + url.pathname).toBe(endpoint)
        expect([...url.searchParams.keys()]).toEqual([key])
        expect(url.searchParams.get(key)).toBe(startPrompt(target, undefined, method))
        expect(url.searchParams.get(key)).not.toContain('region=')
        expect(url.href.length).toBeLessThan(10000)
      }
    }
    const punctuation = { id: 'form_001', title: 'Quotes “&” / + ? # 日本語', regions: [] }
    expect(new URL(agentLaunch(punctuation, 'claude')!.href).searchParams.get('q')).toBe(startPrompt(punctuation, undefined, 'claude'))
    for (const method of ['codex', 'claude-code', 'cli'] as const) expect(agentLaunch(target, method)).toBeUndefined()
  })

  it('preserves a valid selected region in every launch destination', () => {
    for (const [agent, key] of [['claude', 'q'], ['chatgpt', 'q'], ['cursor', 'text']] as const) {
      for (const region of target.regions) {
        const launch = new URL(agentLaunch(target, agent, region.id)!.href)
        expect(launch.searchParams.get(key)).toBe(startPrompt(target, region.id, agent))
        const handoff = new URL(launch.searchParams.get(key)!.split('Read and follow ')[1])
        expect(Object.fromEntries(handoff.searchParams)).toEqual({
          process: 'form_001', region: region.id,
          method: agent === 'cursor' ? 'cli' : 'mcp', vendor: agent,
        })
      }
      expect(new URL(agentLaunch(target, agent, 'unknown')!.href).searchParams.get(key)).not.toContain('region=')
    }
  })

  it('maps a canonical country only to one explicitly supported process option', () => {
    expect(startRegionForCountry(target, 'UK')?.id).toBe('uk-companies-house')
    expect(startRegionForCountry(target, 'IN')?.id).toBe('india-spice-plus')
    expect(startRegionForCountry(target, null)).toBeUndefined()
    expect(startRegionForCountry(target, 'CA')).toBeUndefined()
    const duplicate = { ...target.regions.find(region => region.id === 'uk-companies-house')!, id: 'other-uk-option' }
    expect(startRegionForCountry({ ...target, regions: [...target.regions, duplicate] }, 'UK')).toBeUndefined()
  })

  it('maps method and vendor independently while retaining the exact process and country', () => {
    for (const agent of ['claude', 'chatgpt', 'codex', 'claude-code', 'cursor', 'cli'] as const) {
      const url = new URL(processHandoffUrl(target, 'india-spice-plus', agent))
      expect(url.searchParams.get('process')).toBe('form_001')
      expect(url.searchParams.get('region')).toBe('india-spice-plus')
      expect(url.searchParams.get('method')).toBe(['claude', 'chatgpt'].includes(agent) ? 'mcp' : 'cli')
      expect(url.searchParams.get('vendor')).toBe(agent === 'cli' ? null : agent)
    }
  })
})
