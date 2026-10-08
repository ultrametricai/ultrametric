// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotFound from '@/app/not-found'
import { SPOTLIGHT_IDS, spotlightPick, spotlightTasks } from '@/lib/notFoundSpotlight'
import { processSlug } from '@/lib/processes'

// 404 process spotlight (founder 2026-10-08): the page renders a real corpus process with its
// committed description, verbatim, plus one committed fact and the process link. The pick is
// deterministic per build date, so the test recomputes it with the same function.
describe('app/not-found.tsx process spotlight', () => {
  it('the shortlist resolves entirely to committed corpus records', () => {
    const tasks = spotlightTasks()
    expect(tasks.length).toBe(SPOTLIGHT_IDS.length)
    for (const task of tasks) {
      expect(task.description.length).toBeGreaterThan(0)
      expect(task.title.length).toBeGreaterThan(0)
    }
  })

  it('renders the picked corpus process: title, committed description verbatim, one committed fact, and the link', () => {
    const spotlight = spotlightPick()
    const { container } = render(<NotFound />)
    const text = container.textContent ?? ''
    // A real corpus record from the shortlist.
    expect(SPOTLIGHT_IDS).toContain(spotlight.id)
    expect(text).toContain(spotlight.title)
    // The committed description, verbatim (never paraphrased).
    expect(text).toContain(spotlight.description)
    // The process link resolves by the same slug convention the process pages use.
    expect(container.querySelector(`a[href="${spotlight.href}"]`)).not.toBeNull()
    expect(spotlight.href).toBe(`/processes/${processSlug(spotlight.title)}`)
    // One committed fact renders: the produced artifact (linked) or the Agentic %.
    if (spotlight.fact.kind === 'artifact') {
      expect(text).toContain(spotlight.fact.artifactLabel)
      expect(container.querySelector(`a[href="${spotlight.fact.href}"]`)).not.toBeNull()
    } else {
      expect(text).toContain(`${spotlight.fact.pct}%`)
    }
  })

  it('keeps the existing 404 affordances', () => {
    const { container } = render(<NotFound />)
    const text = container.textContent ?? ''
    expect(text).toContain('No evidence this page exists')
    expect(text).toContain('Back to the rankings')
    expect(container.querySelector('a[href="/"]')).not.toBeNull()
    expect(container.querySelector('a[href="/rankings/init"]')).not.toBeNull()
  })
})
