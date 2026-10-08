// @vitest-environment jsdom
// The header's signed-out account corner (founder bug 2026-10-08: the Sign up pill landed on the
// AuthKit LOGIN screen). Both links go through the worker's /auth/login route; the screens
// differ by the screen_hint param the worker forwards to the AuthKit authorize URL
// (infra/cloudflare-proxy/worker.js): sign-up for the pill, none for Log in. These tests pin
// that split — href shape AND the click-time URL (the handler rebuilds it from
// window.location so return_to is the exact page, not the server-rendered site root).
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/session'

// Same controllable session stub as ProcessCheck/WatchButton tests; the URL builders stay the
// REAL implementations (they are the mechanism under test).
const sessionStub = vi.hoisted(() => ({ current: { state: 'anonymous' } as Session }))
vi.mock('@/lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session')>()),
  useSession: () => sessionStub.current,
}))

import AccountMenu from '@/components/AccountMenu'

// jsdom forbids real navigation — swap window.location for a plain object whose href is
// assignable, so the click handlers' destination is observable.
function stubLocation(href: string) {
  const loc = { href } as Location
  Object.defineProperty(window, 'location', { configurable: true, value: loc })
  return loc
}

beforeEach(() => {
  sessionStub.current = { state: 'anonymous' }
})

describe('signed-out account corner: Log in vs Sign up screens', () => {
  it('the Sign up pill opens the AuthKit SIGN-UP screen (screen_hint=sign-up); Log in carries no hint', () => {
    render(<AccountMenu />)
    const signup = screen.getByRole('link', { name: 'Sign up' }) as HTMLAnchorElement
    const login = screen.getByRole('link', { name: 'Log in' }) as HTMLAnchorElement
    expect(signup.getAttribute('href')).toContain('/auth/login?screen_hint=sign-up&return_to=')
    expect(login.getAttribute('href')).toContain('/auth/login?return_to=')
    expect(login.getAttribute('href')).not.toContain('screen_hint')
  })

  it('a Sign up click navigates to the sign-up screen with the CURRENT page as return_to', () => {
    const loc = stubLocation('https://ultrametric.ai/arena/crm')
    render(<AccountMenu />)
    fireEvent.click(screen.getByRole('link', { name: 'Sign up' }))
    expect(loc.href).toBe(
      '/auth/login?screen_hint=sign-up&return_to=https%3A%2F%2Fultrametric.ai%2Farena%2Fcrm',
    )
  })

  it('a Log in click keeps the plain login flow with the CURRENT page as return_to', () => {
    const loc = stubLocation('https://ultrametric.ai/processes')
    render(<AccountMenu />)
    fireEvent.click(screen.getByRole('link', { name: 'Log in' }))
    expect(loc.href).toBe('/auth/login?return_to=https%3A%2F%2Fultrametric.ai%2Fprocesses')
  })
})
