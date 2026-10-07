import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../worker.js'

// Synthetic asset names exercise the shared namespace without pinning a release hash.
const assets = [
  ['/_astro/v2.release.css', 'text/css', '.stage{display:grid}'],
  ['/_astro/foreloop.release.css', 'text/css', '@font-face{src:url(/fonts/Satoshi-Variable.woff2)}'],
  ['/_astro/DeviceStage.release.js', 'text/javascript', 'import "./scenes.release.js"'],
  ['/_astro/scenes.release.js', 'text/javascript', 'export const scenes=[]'],
  ['/_astro/claude.release.svg', 'image/svg+xml', '<svg/>'],
  ['/fonts/Satoshi-Variable.woff2', 'font/woff2', 'font bytes'],
  ['/fonts/Satoshi-VariableItalic.woff2', 'font/woff2', 'italic font bytes'],
  ['/images/foreloop/og-review.png', 'image/png', 'image bytes'],
  ['/og-sitegen.svg', 'image/svg+xml', '<svg/>'],
] as const

function harness(response = new Response('landing asset')) {
  const landing = vi.fn(async (_request: Request) => response)
  const web = vi.fn(async (_input: URL, _init: RequestInit) => new Response('Vercel page', {
    headers: { 'content-type': 'text/html' },
  }))
  vi.stubGlobal('fetch', web)
  const env = { LANDING_ASSETS: { fetch: landing }, PA_SESSION_KEY: 'test-only-session-key' }
  return { landing, web, env, request: (path: string, init?: RequestInit) =>
    worker.fetch(new Request('https://ultrametric.ai' + path, init), env, {}) as Promise<Response> }
}

afterEach(() => vi.unstubAllGlobals())

describe('landing asset ownership', () => {
  it.each(assets)('serves %s from landing with its original MIME type', async (path, type, body) => {
    const response = new Response(body, { headers: {
      'content-type': type,
      'access-control-allow-origin': 'https://foreloop.com',
      'x-content-type-options': 'nosniff',
    } })
    const h = harness(response)
    const received = await h.request(path)
    expect(received).toBe(response)
    expect(received.headers.get('content-type')).toBe(type)
    expect(received.headers.get('access-control-allow-origin')).toBe('https://foreloop.com')
    expect(received.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await received.text()).toBe(body)
    expect(h.landing).toHaveBeenCalledTimes(1)
    expect(h.web).not.toHaveBeenCalled()
  })

  it.each([undefined, 'https://ultrametric.ai/v2/', 'https://foreloop.com/', 'https://elsewhere.example/'])(
    'routes root assets independently of Referer %s', async (referer) => {
      const h = harness()
      await h.request('/_astro/v2.release.css', { headers: referer ? { referer } : {} })
      expect(h.landing).toHaveBeenCalledTimes(1)
      expect(h.web).not.toHaveBeenCalled()
    },
  )

  it('preserves HEAD, query, conditional and range request headers', async () => {
    const response = new Response(null, { status: 206, headers: {
      'content-range': 'bytes 0-2/100', etag: '"release"',
      'cache-control': 'public, max-age=31536000, immutable',
    } })
    const h = harness(response)
    const received = await h.request('/_astro/v2.release.css?v=1&v=2', {
      method: 'HEAD', headers: { range: 'bytes=0-2', 'if-none-match': '"previous"',
        origin: 'https://foreloop.com', 'if-range': '"release"' },
    })
    const forwarded = h.landing.mock.calls[0]?.[0]
    expect(forwarded?.url).toBe('https://ultrametric.ai/_astro/v2.release.css?v=1&v=2')
    expect(forwarded?.method).toBe('HEAD')
    expect(forwarded?.headers.get('range')).toBe('bytes=0-2')
    expect(forwarded?.headers.get('if-none-match')).toBe('"previous"')
    expect(forwarded?.headers.get('if-range')).toBe('"release"')
    expect(forwarded?.headers.get('origin')).toBe('https://foreloop.com')
    expect(received).toBe(response)
    expect(await received.text()).toBe('')
  })

  it.each([304, 403, 404, 500])('preserves landing status %s without a Vercel retry', async (status) => {
    const response = new Response(status === 304 ? null : 'upstream result', {
      status, headers: { etag: '"asset"', vary: 'Origin' },
    })
    const h = harness(response)
    expect(await h.request('/_astro/v2.release.css')).toBe(response)
    expect(h.web).not.toHaveBeenCalled()
  })

  it('returns an uncacheable configuration error if the binding is missing', async () => {
    const h = harness()
    const response = await worker.fetch(new Request('https://ultrametric.ai/_astro/v2.release.css'), {}, {})
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(h.web).not.toHaveBeenCalled()
  })
})

describe('existing page, Vercel and private routes', () => {
  it.each(['/v2', '/v2/'])('retains the existing proxy redirect for %s', async (path) => {
    // The production dashboard's more-specific landing page overrides run before this Worker.
    const h = harness()
    const response = await h.request(path + '?source=test')
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('https://ultrametric.ai/get-started?source=test')
    expect(h.landing).not.toHaveBeenCalled()
    expect(h.web).not.toHaveBeenCalled()
  })

  it.each(['/foreloop', '/foreloop/', '/company', '/get-started', '/processes',
    '/_next/static/chunks/app.js', '/_next/static/css/app.css',
    '/_astro-extra/file.css', '/fonts/another-font.woff2', '/faces/jude-gomila.jpg',
    '/logos/stripe.png', '/images/foreloop/unrelated.png'])(
    'keeps %s on the existing Vercel path when it reaches this Worker', async (path) => {
      const h = harness()
      await h.request(path + '?x=1')
      expect(h.web.mock.calls[0]?.[0].href).toBe('https://ultrametric.vercel.app' + path + '?x=1')
      expect(h.landing).not.toHaveBeenCalled()
    },
  )

  it('retains the homepage rewrite to Vercel /home', async () => {
    const h = harness()
    await h.request('/')
    expect(h.web.mock.calls[0]?.[0].href).toBe('https://ultrametric.vercel.app/home')
    expect(h.landing).not.toHaveBeenCalled()
  })

  it('does not send mutations to the landing asset binding', async () => {
    const h = harness()
    await h.request('/_astro/v2.release.css', { method: 'POST', body: 'test' })
    expect(h.landing).not.toHaveBeenCalled()
    expect(h.web).toHaveBeenCalledTimes(1)
  })

  it.each(['/auth/me', '/api/watchlist', '/api/my-stack'])(
    'preserves anonymous rejection for %s', async (path) => {
      const h = harness()
      expect((await h.request(path)).status).toBe(401)
      expect(h.landing).not.toHaveBeenCalled()
      expect(h.web).not.toHaveBeenCalled()
    },
  )

  it('normalizes dot segments before dispatch and retains the auth gate', async () => {
    const h = harness()
    expect((await h.request('/_astro/../auth/me')).status).toBe(401)
    expect(h.landing).not.toHaveBeenCalled()
    expect(h.web).not.toHaveBeenCalled()
  })
})
