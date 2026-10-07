// @vitest-environment jsdom
// Per-step vendor API calls follow the vendor selection (founder 2026-10-07: the calls neither
// changed with the chip selection nor disappeared without one). The pinned sequence: no
// selection → NO calls render; select vendor A via the chips (?via=/pa-lens) → A's grounded
// calls ONLY; switch to B → B's only; clear → none again. A stack ("I'm using") pick counts as
// a selection too, with the lens pick winning — the lib/processLens.ts resolution order.
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import StepApiCalls, { type VendorApiCalls } from '@/components/StepApiCalls'
import { lensStorageKey, serializeLensState, PROCESS_LENS_EVENT, type LensMap } from '@/lib/processLens'
import { STACK_KEY, serializeStackMap, STACK_EVENT } from '@/lib/myStack'

// Same in-memory localStorage stand-in as components/__tests__/StepVendorRow.test.tsx.
function stubLocalStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
  })
}

const LENS_KEY = 'task-x'

const VENDORS: VendorApiCalls[] = [
  {
    productId: 'vendor-a',
    name: 'Vendor A',
    arenaId: 'payroll',
    calls: [{ method: 'POST /a/runs', sourceUrl: 'https://docs.a.example/runs' }],
  },
  {
    productId: 'vendor-b',
    name: 'Vendor B',
    arenaId: 'payroll',
    calls: [{ method: 'POST /b/payrolls' }],
  },
]

const setLens = (picks: LensMap) =>
  act(() => {
    window.localStorage.setItem(
      lensStorageKey(LENS_KEY),
      serializeLensState({ picks, names: {} }),
    )
    window.dispatchEvent(new Event(PROCESS_LENS_EVENT))
  })

beforeEach(() => stubLocalStorage())
afterEach(() => window.localStorage.clear())

describe('StepApiCalls (calls follow the selection — founder 2026-10-07)', () => {
  it('renders the founder sequence: none → A only → B only → none', () => {
    const { container } = render(
      <StepApiCalls
        vendors={VENDORS}
        lensKey={LENS_KEY}
      />,
    )
    // No selection: nothing renders — not the old every-vendor roster.
    expect(container.textContent).toBe('')

    // Select vendor A via the chips' lens: A's grounded calls only.
    setLens({ payroll: 'vendor-a' })
    expect(container.textContent).toContain('Vendor A')
    expect(container.textContent).toContain('POST /a/runs')
    expect(container.textContent).not.toContain('Vendor B')
    expect(container.textContent).not.toContain('POST /b/payrolls')

    // Switch to B: B's calls only.
    setLens({ payroll: 'vendor-b' })
    expect(container.textContent).toContain('Vendor B')
    expect(container.textContent).toContain('POST /b/payrolls')
    expect(container.textContent).not.toContain('Vendor A')
    expect(container.textContent).not.toContain('POST /a/runs')

    // Clear the selection: none again.
    setLens({})
    expect(container.textContent).toBe('')
  })

  it("a stack ('I'm using') pick counts as a selection, and the lens pick wins over it", () => {
    act(() => {
      window.localStorage.setItem(
        STACK_KEY,
        serializeStackMap({ payroll: ['vendor-b'] }),
      )
      window.dispatchEvent(new Event(STACK_EVENT))
    })
    const { container } = render(<StepApiCalls vendors={VENDORS} lensKey={LENS_KEY} />)
    expect(container.textContent).toContain('Vendor B')
    expect(container.textContent).not.toContain('Vendor A')

    setLens({ payroll: 'vendor-a' })
    expect(container.textContent).toContain('Vendor A')
    expect(container.textContent).not.toContain('Vendor B')
  })
})
