import { describe, expect, it } from 'vitest'
import { agentLaunch, processHandoffUrl, startPrompt } from '../process-start'
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

  it('encodes exact public identity for supported destinations, without country context', () => {
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
