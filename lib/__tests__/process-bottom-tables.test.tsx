// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
import { modulesForProcess, loadBusinessLogicMap, loadBusinessLogicSteps } from '../businessLogicMap'
import { readmeComputes } from '../openModulePages'
import { loadArtifacts } from '../processes'
import { processBottomTables } from '../shared-processes/bottom-tables'
import { loadSharedProcesses } from '../shared-processes/load'
import { regionalDecision } from '../shared-processes/regions'
import { sharedPreviewHref } from '../shared-processes/reader'

const records = loadSharedProcesses()
const byId = (id: string) => records.find(record => record.id === id)!
afterEach(cleanup)

describe('shared reader bottom tables', () => {
  it('uses exact declared LLC artifacts and producing steps, retains canonical producer links and authored step chips', () => {
    const record = byId('form_011')
    const el = render(<SharedProcessReader record={record} records={records} />)
    const table = el.getByRole('table', { name: 'Artifacts produced by this process' })
    const rows = processBottomTables(record, records).default.produces
    expect(rows.map(row => row.id)).toEqual(record.metadata.produces)
    for (const row of rows) {
      const artifact = loadArtifacts().find(artifact => artifact.id === row.id)!
      expect(within(table).getByRole('link', { name: artifact.label }).getAttribute('href')).toBe(`/artifacts/${row.id}`)
      expect(table.textContent).toContain(artifact.description)
      for (const step of row.steps) {
        const target = document.getElementById(step.scope)!
        expect(target.querySelector('h3')!.textContent).toContain(step.label)
        expect(target.textContent).toContain('Produces:')
        expect(target.textContent).toContain(row.label)
      }
    }
    expect(rows.find(row => row.id === 'ein')!.canonicalProducer?.href).toBe(sharedPreviewHref('form_002', records))
    expect(table.compareDocumentPosition(el.getByRole('region', { name: 'Process parts' })) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(el.container.querySelector('header')!.textContent).not.toMatch(/Produces|Open modules/)
    expect(el.queryByRole('table', { name: 'Open modules serving this process' })).toBeNull()
  })

  it('uses mapped modules, exact README computations, actual step targets and source files at the bottom', () => {
    const record = byId('tax_001')
    const el = render(<SharedProcessReader record={record} records={records} />)
    const table = el.getByRole('table', { name: 'Open modules serving this process' })
    const rows = processBottomTables(record, records).default.modules
    expect(rows.map(row => row.id)).toEqual(modulesForProcess(record.id).map(module => module.id))
    expect(rows.map(row => row.id)).toContain('deFranchiseTax')
    for (const row of rows) {
      const source = loadBusinessLogicMap()[row.id]
      expect(table.textContent).toContain(readmeComputes().get(source.anchor))
      expect(within(table).getByRole('link', { name: row.label }).getAttribute('href')).toBe(`/open-modules/${row.id}`)
      const sourceLink = within(table).getByRole('link', { name: source.file })
      expect(sourceLink.getAttribute('href')).toBe(row.sourceHref)
      expect(sourceLink.getAttribute('rel')).toBe('noopener noreferrer')
      expect(row.steps.length).toBeGreaterThan(0)
      for (const step of row.steps) expect(document.getElementById(step.scope)).not.toBeNull()
    }
    expect(table.compareDocumentPosition(el.getByRole('region', { name: 'Process parts' })) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(el.queryByText('Open modules:')).toBeNull()
    expect(el.queryByRole('table', { name: 'Artifacts produced by this process' })).toBeNull()
  })

  it('opens and focuses a producing step from its real anchor', () => {
    const el = render(<SharedProcessReader record={byId('form_011')} records={records} />)
    const target = document.getElementById('form_011:n7')!
    target.scrollIntoView = vi.fn()
    fireEvent.click(within(el.getByRole('table', { name: 'Artifacts produced by this process' })).getByRole('link', { name: 'Apply for an EIN' }))
    expect(document.activeElement).toBe(target)
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  })

  it('follows country visibility without inheriting default module math or losing non-geographic alternatives', () => {
    const el = render(<SharedProcessReader record={byId('form_001')} records={records} />)
    expect(el.queryByRole('table', { name: 'Artifacts produced by this process' })).not.toBeNull()
    expect(el.queryByRole('table', { name: 'Open modules serving this process' })).not.toBeNull()
    fireEvent.click(el.container.querySelector('input[value="uk-companies-house"]')!)
    expect(el.queryByRole('table', { name: 'Artifacts produced by this process' })).toBeNull()
    expect(el.queryByRole('table', { name: 'Open modules serving this process' })).toBeNull()
    fireEvent.click(el.container.querySelector('input[value="default"]')!)
    expect(el.queryByRole('table', { name: 'Artifacts produced by this process' })).not.toBeNull()
    cleanup()
    const cap = render(<SharedProcessReader record={byId('qs_051')} records={records} />)
    fireEvent.click(cap.container.querySelector('input[value="india-demat"]')!)
    const moduleTable = cap.getByRole('table', { name: 'Open modules serving this process' })
    expect(moduleTable.querySelector('a[href="#qs_051:n2"]')).toBeNull()
    expect(moduleTable.querySelector('a[href="#qs_051:n3"]')).not.toBeNull()
    expect(cap.queryByRole('table', { name: 'Artifacts produced by this process' })).toBeNull()
    cleanup()
    const payroll = render(<SharedProcessReader record={byId('qs_063')} records={records} />)
    fireEvent.click(payroll.container.querySelector('input[value="uk-paye-rti"]')!)
    expect(payroll.container.querySelector('[id="qs_063:n3:eor-international"] summary')).not.toBeNull()
  })

  it('keeps process-only mappings honest and leaves unmapped processes empty', () => {
    const candidate = records.flatMap(record => processBottomTables(record, records).default.modules.map(row => ({ record, row }))).find(({ row }) => row.processOnly)!
    expect(candidate).toBeDefined()
    expect(loadBusinessLogicSteps().filter(mapping => mapping.processId === candidate.record.id && mapping.module === candidate.row.id)).toEqual([])
    const el = render(<SharedProcessReader record={candidate.record} records={records} />)
    expect(el.getByRole('table', { name: 'Open modules serving this process' }).textContent).toContain('This process as a whole')
    expect(processBottomTables(byId('ops_001'), records).default.modules).toEqual([])
    const empty = records.find(record => (!Array.isArray(record.metadata.produces) || !record.metadata.produces.length) && !modulesForProcess(record.id).length)!
    expect(processBottomTables(empty, records).default).toEqual({ produces: [], modules: [] })
  })

  it('resolves every bottom-table step in every authored regional view across the real catalog', () => {
    for (const record of records) {
      const before = JSON.stringify(record)
      const variants = processBottomTables(record, records)
      const el = render(<SharedProcessReader record={record} records={records} />)
      for (const selected of Object.keys(variants)) {
        if (regionalDecision(record)) fireEvent.click(el.container.querySelector(`input[value="${selected}"]`)!)
        for (const link of el.container.querySelectorAll('table a[href^="#"]')) {
          expect(document.getElementById(link.getAttribute('href')!.slice(1)), `${record.id}/${selected}: ${link.outerHTML}`).not.toBeNull()
        }
      }
      expect(JSON.stringify(record)).toBe(before)
      cleanup()
    }
  })
})
