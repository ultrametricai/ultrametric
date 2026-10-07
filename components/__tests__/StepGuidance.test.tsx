// @vitest-environment jsdom
// Pin for the step-guidance rendering (founder 2026-10-07): the committed guidance paragraphs
// render IN FULL under the step label — the 2026-10-05 one-line/expander split is retired, so
// no details/summary, no truncation, no interactive element — at text-sm in the secondary
// zinc-400 tier (readable per the contrast sweep, still subordinate to the label's zinc-100).
// Committed text only: guidanceParagraphs cleans markers, StepGuidance renders every paragraph.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StepGuidance } from '@/components/ProcessDag'

afterEach(cleanup)

const LONG_TEXT = [
  'Lead paragraph with **bold** that used to truncate behind the expander because it runs well past the old two-hundred-and-twenty character one-line budget, so it is deliberately long enough to have collapsed under the retired details idiom and must now render whole.',
  '- first point\n- second point',
  'Closing paragraph after the bullets.',
].join('\n\n')

describe('StepGuidance (full paragraphs, no expander — founder 2026-10-07)', () => {
  it('renders every committed paragraph in full with no details/summary and no interactive element', () => {
    const { container } = render(<StepGuidance text={LONG_TEXT} />)
    expect(container.querySelector('details')).toBeNull()
    expect(container.querySelector('summary')).toBeNull()
    expect(
      container.querySelectorAll('a, button, input, select, textarea, [role="button"]').length,
    ).toBe(0)
    const paragraphs = [...container.querySelectorAll('p')]
    expect(paragraphs.length).toBe(3)
    expect(paragraphs[0].textContent).toContain('must now render whole')
    expect(paragraphs[1].textContent).toBe('· first point · second point')
    expect(paragraphs[2].textContent).toBe('Closing paragraph after the bullets.')
    // Nothing truncates: no truncate utility class anywhere in the rendered guidance.
    expect(
      [...container.querySelectorAll('*')].filter((el) => el.className.includes('truncate')),
    ).toEqual([])
  })

  it('sits at text-sm in the secondary zinc-400 tier (the founder 2026-10-07 size lift)', () => {
    const { container } = render(<StepGuidance text="One short committed line." />)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).toContain('text-sm')
    expect(wrapper.className).toContain('text-zinc-400')
    expect(container.textContent).toBe('One short committed line.')
  })

  it('renders nothing for empty committed text', () => {
    const { container } = render(<StepGuidance text={'   \n\n  '} />)
    expect(container.innerHTML).toBe('')
  })
})
