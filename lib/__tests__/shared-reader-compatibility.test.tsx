// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
import { useRegionalVariant } from '@/components/shared-processes/RegionalVariant'
import { useVendorSelection } from '@/components/shared-processes/VendorSelection'
import { loadSharedProcesses } from '../shared-processes/load'

const records = loadSharedProcesses()
const corporation = records.find(record => record.id === 'form_001')!
afterEach(cleanup)

it('places the compatibility bridge inside both state providers and exposes the steps anchor', () => {
  function Bridge() {
    const region = useRegionalVariant()
    const vendors = useVendorSelection()
    return <button onClick={() => { region!.select('france-inpi-guichet'); vendors!.toggle('provider', 'chosen') }}>{region?.selected}:{vendors?.picks.provider ?? 'none'}</button>
  }
  const el = render(<SharedProcessReader record={corporation} records={records} compatibility={<Bridge />} />)
  fireEvent.click(el.getByRole('button', { name: 'default:none' }))
  expect(el.getByRole('button', { name: 'france-inpi-guichet:chosen' })).toBeDefined()
  expect(el.getByRole('region', { name: 'Process parts' }).id).toBe('steps')
})

it('mounts legacy aliases only with their corresponding step and regional option', () => {
  const el = render(<SharedProcessReader record={corporation} records={records} stepAnchorAliases={{
    'form_001:n7b': ['legacy-signatures', 'legacy-signatures', 'form_001:n7b'],
    'form_001:n4:default': ['legacy-filing'],
    'form_001:n4:germany-notary-gmbh': ['legacy-germany'],
    'form_001:n4:germany-notary-gmbh:de1': ['legacy-notary-preparation'],
  }} />)
  expect(document.querySelectorAll('[id="legacy-signatures"]')).toHaveLength(1)
  expect(document.querySelectorAll('[id="form_001:n7b"]')).toHaveLength(1)
  expect(document.getElementById('legacy-signatures')?.closest('article')?.id).toBe('form_001:n7b')
  expect(document.getElementById('legacy-filing')?.parentElement?.id).toBe('form_001:n4:default')
  expect(document.getElementById('legacy-germany')).toBeNull()
  fireEvent.click(el.container.querySelector('input[value="germany-notary-gmbh"]')!)
  expect(document.getElementById('legacy-signatures')).toBeNull()
  expect(document.getElementById('legacy-filing')).toBeNull()
  expect(document.getElementById('legacy-germany')?.parentElement?.id).toBe('form_001:n4:germany-notary-gmbh')
  expect(document.getElementById('legacy-notary-preparation')?.closest('article')?.id).toBe('form_001:n4:germany-notary-gmbh:de1')
  fireEvent.click(el.container.querySelector('input[value="default"]')!)
  expect(document.getElementById('legacy-signatures')).not.toBeNull()
  expect(document.getElementById('legacy-germany')).toBeNull()
})

it('threads aliases through referenced subprocesses', () => {
  const root = records.find(record => record.id === 'get-paid')!
  const part = root.parts.find(part => part.ref)!
  const child = records.find(record => record.id === part.ref)!
  const scope = `${root.id}:${part.id}:ref:${child.parts[0].id}`
  render(<SharedProcessReader record={root} records={records} stepAnchorAliases={{ [scope]: ['legacy-subprocess-step'] }} />)
  expect(document.getElementById('legacy-subprocess-step')?.closest('article')?.id).toBe(scope)
})
