// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readSharedCatalog, findSharedRecord } from '../shared-processes/reader'
import { resolveServiceCandidates } from '../shared-processes/service-candidates'
import ServiceCandidates from '@/components/shared-processes/ServiceCandidates'
import type { Reference } from '../shared-processes/schema'

const refs = findSharedRecord(readSharedCatalog(), 'form_001')!.parts[0].references

describe('shared process service candidates', () => {
  it('keeps the canonical candidate order and resolves existing brand identities without scores', () => {
    const result = resolveServiceCandidates(refs)
    expect(result.map(candidate => candidate.name)).toEqual(['Clerky', 'Stripe Atlas', 'Firstbase', 'LegalZoom', 'Northwest Registered Agent', 'Doola'])
    expect(result.map(candidate => candidate.logoId)).toEqual(['clerky', 'stripe-atlas', 'firstbase', 'legalzoom', null, null])
    expect(result.find(candidate => candidate.name === 'LegalZoom')?.href).toBe('/arena/legal-ops/product/legalzoom')
    expect(result.find(candidate => candidate.name === 'Doola')?.href).toBeNull()
    expect(result.find(candidate => candidate.name === 'Northwest Registered Agent')?.href).toBeNull()
  })

  it('renders accessible real links and the existing table logo fallback', () => {
    const el = document.createElement('div')
    el.innerHTML = renderToStaticMarkup(<ServiceCandidates references={refs} />)
    expect(el.querySelectorAll('li')).toHaveLength(6)
    expect(el.querySelectorAll('img')).toHaveLength(4)
    expect(el.querySelectorAll('a')).toHaveLength(4)
    expect(el.querySelector('a[href="/arena/legal-ops/product/clerky"]')?.textContent).toContain('Clerky')
    for (const link of el.querySelectorAll('a')) {
      expect(link.getAttribute('href')).toMatch(/^\/arena\/legal-ops\/product\//)
      expect(link.hasAttribute('target')).toBe(false)
    }
    expect(el.querySelector('svg')).toBeNull()
    expect(el.textContent).not.toContain('opens in a new tab')
    const fallback = [...el.querySelectorAll('li')].find(row => row.textContent?.includes('Northwest Registered Agent'))!
    expect(fallback).toBeDefined()
    expect(fallback.querySelector('img, a')).toBeNull()
    expect(fallback.textContent).toContain('Not assessed')
    expect([...fallback.querySelectorAll('[aria-hidden]')].some(node => node.textContent === 'N')).toBe(true)
    expect(el.textContent).not.toMatch(/score|could attempt|prompt|37|32/)
  })

  it('handles explicit product candidates, duplicate identities and unknown mappings generically', () => {
    const references: Reference[] = [
      { kind: 'vendor', id: 'figma', role: 'candidate' },
      { kind: 'product', id: 'design-tools/figma', role: 'additional-candidate' },
      { kind: 'vendor', id: 'new_unmapped_service', role: 'candidate' },
      { kind: 'vendor', id: 'clerky', role: 'involves' },
      { kind: 'url', url: 'https://example.com', title: 'Guidance', description: null, role: 'source' },
    ]
    const result = resolveServiceCandidates(references)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Figma')
    expect(result[1]).toMatchObject({ name: 'New Unmapped Service', logoId: null, href: null })
    expect(resolveServiceCandidates([{ kind: 'product', id: '../outside', role: 'additional-candidate' }])[0].href).toBeNull()
  })
})
