// @vitest-environment jsdom
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { RegionalOption } from '@/components/shared-processes/RegionalVariant'
import { markProcessScopeHydrated, openProcessTarget, whenProcessTargetReady } from '../shared-processes/open-target'

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks() })

it('opens a source option only after its hydration commits, without changing the initial HTML', async () => {
  const id = 'brand_002:n1:image-generation'
  const tree = <RegionalOption scope="brand_002:n1" optionId="image-generation" id={id} heading="Generate a logo direction"><span id="step-brand_002-n1" /></RegionalOption>
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  document.body.append(container)
  HTMLElement.prototype.scrollIntoView = vi.fn()
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  const details = document.getElementById(id) as HTMLDetailsElement
  const cancel = whenProcessTargetReady(id, () => openProcessTarget(id))
  expect(details.open).toBe(false)
  expect(details.getAttribute('tabindex')).toBeNull()
  let root: ReturnType<typeof hydrateRoot>
  await act(async () => { root = hydrateRoot(container, tree) })
  expect(details.open).toBe(true)
  expect(document.activeElement?.id).toBe(id)
  expect(errors.mock.calls.flat().join(' ')).not.toMatch(/hydrated|mismatch/i)
  cancel()
  await act(async () => root!.unmount())
})

it('cancels a superseded target and waits for all enclosing source options', () => {
  document.body.innerHTML = '<details data-process-scope id="outer"><details data-process-scope id="inner"><span id="target"></span></details></details>'
  const abandoned = vi.fn()
  const cancel = whenProcessTargetReady('target', abandoned)
  cancel()
  const ready = vi.fn()
  whenProcessTargetReady('target', ready)
  markProcessScopeHydrated(document.getElementById('inner'))
  expect(ready).not.toHaveBeenCalled()
  markProcessScopeHydrated(document.getElementById('outer'))
  expect(ready).toHaveBeenCalledOnce()
  expect(abandoned).not.toHaveBeenCalled()
})
