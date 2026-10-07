// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { buildPreviewIndex } from '../shared-processes/index-rows'
import { buildPreviewRoutes, findSharedRecord, readSharedCatalog, sharedPreviewHref } from '../shared-processes/reader'
import PreviewIndex from '@/app/processes/v2/page'
import { buildProcessRows } from '../processRows'
import bindings from '../shared-processes/index-icons.json'

const records = readSharedCatalog()
afterEach(() => { cleanup(); history.replaceState(null, '', '/') })

describe('existing index presentation over shared records', () => {
  it('keeps all 173 records, source metrics, exact authored icon bindings, and unique functional routes', () => {
    const index = buildPreviewIndex()
    const all = [...index.rows, ...index.playbooks]
    expect(all).toHaveLength(173)
    expect(new Set(all.map(row => row.href)).size).toBe(173)
    for (const record of records) {
      const href = sharedPreviewHref(record.id, records)
      expect(all.find(row => row.href === href)?.title).toBe(record.title)
      expect(findSharedRecord(records, decodeURIComponent(href.split('/').at(-2)!))?.id).toBe(record.id)
    }
    const original = buildProcessRows().rows
    for (const row of original) expect(index.rows.find(preview => preview.slug === row.slug)?.pct).toBe(row.pct)
    expect(index.rows.filter(row => row.pct === null)).toHaveLength(2)
    const situations = index.rows.filter(row => row.kind === 'situation')
    expect(situations).toHaveLength(22)
    expect(situations.every(row => row.area === 'Situations' && row.timeOrder === null && row.trigger && row.urgency)).toBe(true)
    expect(Object.keys(bindings)).toHaveLength(123)
    for (const binding of Object.values(bindings)) {
      const file = path.join('public', binding.icon.slice('asset:'.length))
      expect(existsSync(file)).toBe(true)
      expect(readFileSync(file, 'utf8')).toContain('<svg')
    }
    expect(sharedPreviewHref('opp_002', records)).toBe('/processes/add-a-contractor-1099/v2')
    expect(sharedPreviewHref('first-hire', records)).toBe('/processes/first-hire/v2')
  })

  it('retains sorting, filtering, search, and canonical-only records without fabricated metrics', () => {
    const el = render(<PreviewIndex />)
    const table = el.getByRole('table')
    expect(table.querySelectorAll('tbody tr')).toHaveLength(173)
    expect(el.getByRole('searchbox', { name: 'Search processes' }).getAttribute('placeholder')).toContain('173')
    const contractor = table.querySelector('a[href="/processes/add-a-contractor-1099/v2"]')!
    expect(contractor.textContent).toBe('Add a contractor (1099)')
    for (const record of records) {
      expect(table.querySelector(`a[href="${sharedPreviewHref(record.id, records)}"]`)?.textContent).toBe(record.title)
    }
    expect(contractor.closest('tr')?.querySelector('img')?.getAttribute('width')).toBe('24')
    const equity = table.querySelector('a[href*="review-common-stock"]')!.closest('tr')!
    expect(equity.querySelectorAll('td')[2].textContent).toBe('')
    expect(equity.querySelectorAll('td')[4].textContent).toBe('')
    fireEvent.click(within(table).getByRole('button', { name: /Agentic %/ }))
    expect([...table.querySelectorAll('tbody tr')].slice(-2).some(row => row.contains(equity.querySelector('a')))).toBe(true)
    fireEvent.change(el.getByRole('combobox', { name: 'Rank by' }), { target: { value: 'order' } })
    fireEvent.click(within(table).getByRole('button', { name: /^Timeline/ }))
    const processHrefs = new Set(buildPreviewIndex().rows.map(row => row.href))
    const processRows = [...table.querySelectorAll('tbody tr')].filter(row => [...row.querySelectorAll('a')].some(link => processHrefs.has(link.getAttribute('href')!)))
    expect(processRows.slice(-2).some(row => row.contains(equity.querySelector('a')))).toBe(true)
    const search = el.getByRole('searchbox', { name: 'Search processes' })
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: 'contractor' } })
    expect(el.getAllByRole('link').some(link => link.getAttribute('href') === '/processes/add-a-contractor-1099/v2')).toBe(true)
  })

  it('reserves existing IDs/aliases and resolves synthetic title collisions deterministically', () => {
    const samples = records.slice(0, 3).map((record, i) => ({ ...record, id: `test_${i}`, title: 'Same task', aliases: i === 0 ? ['same-task'] : [] }))
    const first = buildPreviewRoutes(samples)
    const reversed = buildPreviewRoutes([...samples].reverse())
    expect(new Set(first.values()).size).toBe(3)
    for (const [id, slug] of first) { expect(reversed.get(id)).toBe(slug); expect(findSharedRecord(samples, slug)?.id).toBe(id) }
    expect(findSharedRecord(samples, 'same-task')?.id).toBe('test_0')
    expect(findSharedRecord(samples, 'missing')).toBeUndefined()
  })
})
