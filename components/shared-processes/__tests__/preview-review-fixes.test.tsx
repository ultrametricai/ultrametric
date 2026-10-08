// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { loadSharedProcesses } from '@/lib/shared-processes/load'
import { loadProcesses } from '@/lib/processes'
import { buildStepComparisons } from '@/lib/shared-processes/step-comparisons'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
import { RegionalCoverageNote } from '@/components/shared-processes/RegionalVariant'
import ProcessLeaderboard from '@/components/ProcessLeaderboard'
const records = loadSharedProcesses()
afterEach(cleanup)

it('opens the non-geographic default on arrival, keeps alternatives closed and preserves manual collapse with the overview always visible', () => {
  const record = records.find(record => record.id === 'qs_021')!
  const el = render(<SharedProcessReader record={record} records={records} comparisons={buildStepComparisons(record)} />)
  const defaults = [...el.container.querySelectorAll<HTMLDetailsElement>('details[id$=":default"]')]
  expect(defaults.length).toBeGreaterThan(0)
  expect(defaults.every(item => item.open)).toBe(true)
  expect([...el.container.querySelectorAll<HTMLDetailsElement>('details[id]:not([id$=":default"])')].every(item => !item.open)).toBe(true)
  expect(defaults.some(item => item.querySelector('a[href*="/arena/"]'))).toBe(true)
  fireEvent.click(defaults[0].querySelector('summary')!)
  expect(defaults[0].open).toBe(false)
  expect(el.queryByRole('button', { name: 'Graph' })).toBeNull()
    expect(el.getByRole('region', { name: 'Process overview graph' })).toBeDefined()
  expect(el.getByRole('region', { name: 'Process parts' })).toBeDefined()
  expect(defaults[0].open).toBe(false)
})

it('qualifies the real supplementary leaderboard without changing its scores or order on region changes', () => {
  const record = records.find(record => record.id === 'form_001')!
  const task = loadProcesses().find(task => task.id === record.id)!
  const el = render(<SharedProcessReader record={record} records={records} supplementary={<ProcessLeaderboard task={task} scopeNote={<RegionalCoverageNote />} />} />)
  const heading = el.getByRole('heading', { name: 'Who covers this process best' })
  const section = heading.closest('section')!
  // Leaderboard rows are plain (non-expandable) now — pin vendor order + the score spans.
  const rows = () =>
    [...section.querySelectorAll('a[href*="/product/"]')].map(a => a.textContent)
      .concat([...section.querySelectorAll('span[title^="Process score"]')].map(s => s.textContent))
  const before = rows()
  expect(before.length).toBeGreaterThan(0)
  expect(section.textContent).toContain('Default-scope coverage')
  expect(section.textContent).not.toContain('selected regional variant not assessed')
  fireEvent.click(el.container.querySelector('input[type="radio"][value="germany-notary-gmbh"]')!)
  expect(section.textContent).toContain('Default-scope coverage · selected regional variant not assessed')
  expect(rows()).toEqual(before)
  fireEvent.click(el.container.querySelector('input[type="radio"][value="default"]')!)
  expect(section.textContent).not.toContain('selected regional variant not assessed')
  expect(rows()).toEqual(before)
})

it('adds no regional boilerplate to a process without a bound regional decision', () => {
  const record = records.find(record => record.id === 'get-paid')!
  const el = render(<SharedProcessReader record={record} records={records} supplementary={<RegionalCoverageNote />} />)
  expect(el.queryByText(/Default-scope coverage/)).toBeNull()
})
