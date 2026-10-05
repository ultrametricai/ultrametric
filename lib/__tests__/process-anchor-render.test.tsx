// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
import { readSharedCatalog } from '../shared-processes/reader'
import { processAnchorContract } from '../shared-processes/compatibility'
import { loadProcesses } from '../processes'

it('mounts every legacy alias inside its actual canonical scope and preserves native nested/option anchors', () => {
  const records = readSharedCatalog()
  const tasks = loadProcesses()
  let aliases = 0
  for (const record of records) {
    const contract = processAnchorContract(record, records, tasks.find(task => task.id === record.id))
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(<SharedProcessReader record={record} records={records} stepAnchorAliases={contract.aliases} />)
    const mounted = new Map([...container.querySelectorAll('[id]')].map(element => [element.id, element]))
    expect(mounted.size).toBe(container.querySelectorAll('[id]').length)
    for (const [target, scope] of Object.entries(contract.scopes)) {
      if (scope.region && scope.region !== 'default') continue
      expect(mounted.has(target), `${record.id}: ${target}`).toBe(true)
    }
    for (const [alias, target] of Object.entries(contract.targets)) {
      expect(mounted.has(alias), alias).toBe(true)
      expect(mounted.get(target)!.contains(mounted.get(alias)!), alias).toBe(true)
      aliases++
    }
  }
  expect(aliases).toBe(856)
}, 60_000)
