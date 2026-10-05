// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import ExternalLinkMark from '../shared-processes/ExternalLinkMark'
afterEach(cleanup)
it('uses the decorative square-with-arrow icon only for external web links and never duplicates it', () => {
  const view = render(<ExternalLinkMark href="https://corp.delaware.gov" label="Delaware" />)
  expect(view.container.querySelectorAll('svg path')).toHaveLength(2)
  expect(view.container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  for (const href of ['/processes/preview/form_001', '/arena/legal-ops/product/clerky', '#step', 'https://ultrametric.ai/processes', 'https://www.ultrametric.ai/processes', 'mailto:hello@example.com']) {
    view.rerender(<ExternalLinkMark href={href} label="Link" />)
    expect(view.container.textContent).toBe('')
  }
  view.rerender(<ExternalLinkMark href="https://corp.delaware.gov" label="Delaware ↗" />)
  expect(view.container.textContent).toBe('')
})
