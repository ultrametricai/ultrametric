// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadSharedProcesses } from '../shared-processes/load'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'

type SourceMethod = { id: string; label: string; summary: string; context: { when: string; kind: string } }
type SourceNode = { id: string; label: string; actionUrl?: string; actionLabel?: string; methods?: SourceMethod[]; [key: string]: unknown }
const corpus = JSON.parse(readFileSync('processes/corpus.json', 'utf8')) as { id: string; dag: { nodes: SourceNode[]; edges?: { from: string; to: string }[] } }[]
const records = loadSharedProcesses()
const repairs = JSON.parse(readFileSync('content/processes/default-options-audit.json', 'utf8')).entries as Array<{ record: string; part: string }>

describe('explicit defaults in migrated method decisions', () => {
  it('preserves every base and alternative identity, annotations, applicability and original edge across the catalog', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'um-method-import-'))
    let imported: ReturnType<typeof loadSharedProcesses>
    try {
      execFileSync('python3', ['scripts/shared-processes/import.py', '--write', '--output', path.join(root, 'content/processes')], { stdio: 'pipe' })
      imported = loadSharedProcesses(root)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
    let decisions = 0
    let alternatives = 0
    for (const source of corpus) {
      const record = imported.find(record => record.id === source.id)!
      for (const node of source.dag.nodes) {
        if (!node.methods?.length || !repairs.some(repair => repair.record === source.id && repair.part === node.id)) continue
        decisions++
        const part = record.parts.find(part => part.id === node.id)!
        const [base, ...options] = part.options
        expect(part.kind).toBe('decision')
        expect(part.title).toBe(node.label)
        expect(part.references).toEqual([])
        expect(part.metadata).toEqual({})
        expect(base.id).toBe('default')
        const actionLabel = node.actionUrl ? node.actionLabel : undefined
        expect(base.title).toBe(`Default — ${actionLabel || node.label}`)
        expect(base.summary).toBe(actionLabel ? node.label : '')
        expect(base.when).toBeNull()
        expect(base.parts).toEqual([])
        expect(base.links ?? []).toEqual([])
        const moved = new Set(['id', 'label', 'methods', 'toolCall', 'functionCalls', 'vendor', 'vendorOptions', 'optionsArenaId', 'extraOptionRefs', 'actionUrl', 'actionLabel'])
        expect(base.metadata).toEqual(Object.fromEntries(Object.entries(node).filter(([key]) => !moved.has(key))))
        if (node.actionUrl) expect(base.references).toContainEqual({kind: 'url', role: 'legacy-action-link', url: node.actionUrl, title: node.actionLabel ?? null, description: null})
        if (node.vendor) expect(base.references).toContainEqual({kind: 'vendor', role: 'stated-vendor', id: node.vendor})
        expect(options.map(option => option.id)).toEqual(node.methods.map(method => method.id))
        for (const [index, option] of options.entries()) {
          expect(option.title).toBe(node.methods[index].label)
          expect(option.summary).toBe(node.methods[index].summary)
          expect(option.when).toBe(node.methods[index].context.when)
        }
        alternatives += options.length
      }
      expect(record.links).toEqual((source.dag.edges ?? []).map(edge => ({...edge, when: null})))
    }
    expect(decisions).toBe(38)
    expect(alternatives).toBe(97)
  })

  it('preserves authored incorporation option summaries separately from generated defaults', () => {
    const copy = JSON.parse(readFileSync('docs/INCORPORATION-SHOWCASE-COPY.json', 'utf8')).items as Array<{ partId: string; optionId: string | null; text: string }>
    const record = records.find(record => record.id === 'form_001')!
    for (const part of record.parts) for (const option of part.options) {
      expect(option.summary).toBe(copy.find(item => item.partId === part.id && item.optionId === option.id)?.text)
    }
  })

  it('renders the authored default and preserves every regional alternative in the page selector', () => {
    const record = records.find(record => record.id === 'form_001')!
    const el = document.createElement('div')
    el.innerHTML = renderToStaticMarkup(<SharedProcessReader record={record} records={records} />)
    const filing = el.querySelector('[id="form_001:n4"]')!
    const radios = [...el.querySelectorAll<HTMLInputElement>('fieldset[aria-describedby] input[type="radio"]')]
    expect(radios.find(radio => radio.checked)?.value).toBe('default')
    expect(radios.map(option => ({ id: option.value, title: option.getAttribute('aria-label') })).sort((a, b) => a.id.localeCompare(b.id))).toEqual(record.parts.find(part => part.id === 'n4')!.options.map(option => ({ id: option.id, title: option.title })).sort((a, b) => a.id.localeCompare(b.id)))
    expect(filing.querySelector('[id="form_001:n4:default"]')).not.toBeNull()
    expect(filing.querySelector('[id="form_001:n4:germany-notary-gmbh"]')).toBeNull()
    expect(filing.querySelector('a[href="https://corp.delaware.gov/howtoform/"]')).not.toBeNull()
    expect(filing.querySelector('details[open]')).toBeNull()
    expect(el.querySelectorAll('[data-overview-fallback] li')).toHaveLength(record.links.length)
    expect(record.links).toHaveLength(9)
  })
})
