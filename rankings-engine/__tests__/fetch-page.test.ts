import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '@/pipeline/fetch-page'

describe('htmlToMarkdown', () => {
  it('converts headings and paragraphs, strips scripts and nav', () => {
    const html = `<html><head><script>evil()</script></head><body>
      <nav><a href="/">Home</a></nav>
      <h1>Omarchy</h1><p>Opinionated <strong>Arch</strong> setup.</p>
      <footer>© 2026</footer></body></html>`
    const md = htmlToMarkdown(html)
    expect(md).toContain('# Omarchy')
    expect(md).toContain('**Arch**')
    expect(md).not.toContain('evil()')
    expect(md).not.toContain('Home')
    expect(md).not.toContain('© 2026')
  })
})
