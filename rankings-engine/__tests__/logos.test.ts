import { describe, expect, it } from 'vitest'
import { isPngBytes, pickFaviconHost, pickIconHref } from '@/pipeline/stages/logos'

describe('pickIconHref', () => {
  it('prefers apple-touch-icon over a larger plain icon', () => {
    const html = `<html><head>
      <link rel="apple-touch-icon" href="/apple-touch-icon.png">
      <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
    </head></html>`
    expect(pickIconHref(html, 'https://example.com/')).toBe('https://example.com/apple-touch-icon.png')
  })

  it('resolves a relative href against the base url', () => {
    const html = `<link rel="apple-touch-icon" href="assets/touch-icon.png">`
    expect(pickIconHref(html, 'https://example.com/sub/page.html')).toBe(
      'https://example.com/sub/assets/touch-icon.png',
    )
  })

  it('chooses the larger png icon (192x192) over a smaller one (16x16) when no apple-touch-icon exists', () => {
    const html = `<html><head>
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
      <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
    </head></html>`
    expect(pickIconHref(html, 'https://example.com/')).toBe('https://example.com/favicon-192.png')
  })

  it('ignores png icons smaller than 64px when nothing bigger is present', () => {
    const html = `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">`
    expect(pickIconHref(html, 'https://example.com/')).toBeNull()
  })

  it('ignores non-png icons (e.g. svg)', () => {
    const html = `<link rel="icon" type="image/svg+xml" sizes="192x192" href="/icon.svg">`
    expect(pickIconHref(html, 'https://example.com/')).toBeNull()
  })

  it('returns null when there are no relevant link tags', () => {
    const html = `<html><head><title>No icons here</title></head></html>`
    expect(pickIconHref(html, 'https://example.com/')).toBeNull()
  })
})

describe('pickFaviconHost', () => {
  it('uses the site host directly when it is not github.com', () => {
    expect(pickFaviconHost({ site: 'https://example.com/product' })).toBe('example.com')
  })

  it('prefers the docs host over github.com when the site is a github.com repo', () => {
    expect(
      pickFaviconHost({
        site: 'https://github.com/google-gemini/gemini-cli',
        docs: 'https://developers.google.com/gemini-code-assist/docs/gemini-cli',
      }),
    ).toBe('developers.google.com')
  })

  it('falls back to the first urls.extra host when there is no docs url', () => {
    expect(
      pickFaviconHost({
        site: 'https://github.com/some-org/some-tool',
        extra: ['https://some-tool.dev/docs', 'https://other.example.com'],
      }),
    ).toBe('some-tool.dev')
  })

  it('falls back to github.com when no non-github host is configured', () => {
    expect(pickFaviconHost({ site: 'https://github.com/some-org/some-tool' })).toBe('github.com')
  })
})

describe('isPngBytes', () => {
  it('accepts a buffer starting with the PNG magic signature', () => {
    const buffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0x00, 0x00, 0x00, 0x0d]), // arbitrary trailing bytes, e.g. IHDR chunk length
    ])
    expect(isPngBytes(buffer)).toBe(true)
  })

  it('rejects an HTML document served at a .png-looking href', () => {
    const buffer = Buffer.from('<!DOCTYPE html><html><head></head><body>Not Found</body></html>', 'utf8')
    expect(isPngBytes(buffer)).toBe(false)
  })

  it('rejects a buffer shorter than the signature', () => {
    expect(isPngBytes(Buffer.from([0x89, 0x50]))).toBe(false)
  })

  it('rejects a buffer with a near-miss signature (one byte off)', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00])
    expect(isPngBytes(buffer)).toBe(false)
  })
})
