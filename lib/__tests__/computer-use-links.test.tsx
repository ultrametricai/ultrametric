// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { loadSharedProcesses } from '../shared-processes/load'
import { computerUseForPart } from '../shared-processes/computer-use'
import { computerUseOptions, isComputerUseCandidate } from '../processRankings'
import { humanStepAudit } from '../humanSteps'
import { showComputerUseChips } from '../humanStepsUi'
import { loadProcesses } from '../processes'
import { hasLogo } from '../logos'
import { buildComposedComparisons } from '../shared-processes/composed-preview'
import { buildProcessProviderChoice } from '../shared-processes/provider-choice'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'

const records = loadSharedProcesses()
afterEach(cleanup)

it('reuses the legacy evidence, ordering, and applicability for every preserved source step', () => {
  for (const task of loadProcesses()) {
    const record = records.find(record => record.id === task.id)!
    for (const node of task.dag.nodes) {
      const part = record.parts.find(part => part.id === node.id)
      if (!part) continue
      const option = node.methods?.length && part.options.some(option => option.id === 'default') ? 'default' : undefined
      const metadata = option ? part.options.find(option => option.id === 'default')?.metadata : part.metadata
      const expected = metadata && ['form', 'person'].includes(String(metadata.route)) && metadata.legalSignature !== true
        && isComputerUseCandidate(node) && showComputerUseChips(humanStepAudit(task.id, node.id)?.computerUse, node.legalSignature)
        ? computerUseOptions(task.id, node.id).map(({ arenaId, productId, name, score }) => ({ arenaId, productId, name, score })) : []
      expect(computerUseForPart(task.id, part, option), `${task.id}:${part.id}`).toEqual(expected)
      for (const alternative of part.options.filter(option => option.id !== 'default')) {
        expect(computerUseForPart(task.id, part, alternative.id)).toEqual([])
      }
    }
  }
})

it('shows preparation options but excludes signature, authority, wait, agent and unmapped steps', () => {
  const mailbox = records.find(record => record.id === 'qs_044')!
  const el = render(<SharedProcessReader record={mailbox} records={records} />)
  expect([...el.container.querySelectorAll('article:has([data-computer-use])')].map(article => article.id)).toEqual(['qs_044:n1', 'qs_044:n2', 'qs_044:n4a'])
  const form = el.container.querySelector('[id="qs_044:n4a"]') as HTMLElement
  expect(within(form).getByText('Do this with computer use agent:')).toBeDefined()
  expect(within(form).queryByRole('combobox')).toBeNull()
  expect(within(form).getByText('Human or computer use')).toBeDefined()
  expect(el.getByRole('definition').textContent).toBe('20%')
  expect(computerUseForPart('unmapped', mailbox.parts[0])).toEqual([])
  cleanup()
  const corporation = records.find(record => record.id === 'form_001')!
  const corp = render(<SharedProcessReader record={corporation} records={records} />)
  expect([...corp.container.querySelectorAll('article:has([data-computer-use])')].map(article => article.id)).toEqual(['form_001:n1', 'form_001:n6', 'form_001:n7'])
})

it('shows mapped logo links without tool selection state or provider side effects', () => {
  const record = records.find(record => record.id === 'qs_044')!
  const comparisons = buildComposedComparisons(record, records)
  const el = render(<SharedProcessReader record={record} records={records} comparisons={comparisons} processChoice={buildProcessProviderChoice(record, comparisons)} />)
  const form = el.container.querySelector('[id="qs_044:n4a"] [data-computer-use]') as HTMLElement
  const options = computerUseForPart(record.id, record.parts.find(part => part.id === 'n4a')!)
  expect(within(form).getAllByRole('link').map(link => link.getAttribute('aria-label'))).toEqual(options.map(option => `${option.name} computer-use evidence`))
  for (const option of options) {
    const link = within(form).getByRole('link', { name: `${option.name} computer-use evidence` })
    expect(link.getAttribute('href')).toBe(`/arena/${option.arenaId}/product/${option.productId}`)
    if (hasLogo(option.productId)) expect(within(link).getByRole('img', { name: `${option.name} logo` })).toBeDefined()
    else expect(link.querySelector('[aria-hidden]')?.textContent).toBe(option.name.charAt(0).toUpperCase())
  }
  expect(within(form).queryByRole('button')).toBeNull()
  expect(within(form).queryByRole('combobox')).toBeNull()
  expect(el.getByRole('button', { name: 'Use VirtualPostMail' }).getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(el.getByRole('button', { name: 'Use VirtualPostMail' }))
  expect(within(form).getAllByRole('link')).toHaveLength(options.length)
  expect(el.getByRole('definition').textContent).toBe('20%')
})
