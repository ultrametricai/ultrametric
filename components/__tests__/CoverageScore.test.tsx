// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { scorePlace } from '../shared-processes/CoverageScore'
import ServiceCandidateRows from '../shared-processes/ServiceCandidateRows'
import { ProviderChoice } from '../shared-processes/ProcessProviderSelector'
import StepComparisonTable from '../shared-processes/StepComparisonTable'
import { VendorSelectionProvider } from '../shared-processes/VendorSelection'

const candidates = ['Alpha', 'Beta', 'Gamma', 'Zero', 'Unknown'].map(name => ({ id: name, name, href: `/vendor/${name}`, logoId: null }))
const scores = [52.4, 52.4, 52.1, 0]
afterEach(cleanup)

describe('scoped coverage placement', () => {
  it('uses underlying score, competition ties, and correct ordinal suffixes', () => {
    expect(scores.map(score => scorePlace(score, scores))).toEqual(['1st', '1st', '3rd', '4th'])
    for (const [place, label] of [[2, '2nd'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd']] as const) {
      expect(scorePlace(0, Array(place - 1).fill(1))).toBe(label)
    }
  })
  it('shows /100 and places for assessed services including zero, but leaves missing assessments hidden', () => {
    render(<ServiceCandidateRows candidates={candidates} coverage={Object.fromEntries(candidates.slice(0, 4).map((candidate, index) => [candidate.id, { score: scores[index], scope: 'filing', storyCount: 3 }]))} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows[0].textContent).toContain('1st52/100')
    expect(rows[1].textContent).toContain('1st52/100')
    expect(rows[2].textContent).toContain('3rd52/100')
    expect(rows[3].textContent).toContain('4th0/100')
    expect(rows[4].textContent).toContain('Unknown')
    expect(rows[4].textContent).not.toContain('/100')
    expect(rows[4].querySelector('[title]')).toBeNull()
  })
  it('keeps the actual process place when a selected vendor is pinned first', () => {
    render(<VendorSelectionProvider><ProviderChoice choice={{ title: 'Services', scope: 'providers', arenaId: 'test', stepCount: 1, candidates: candidates.slice(0, 4), scores: Object.fromEntries(candidates.slice(0, 4).map((candidate, index) => [candidate.id, { score: scores[index], assessedSteps: 1, steps: [] }])) }} /></VendorSelectionProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Use Gamma' }))
    const first = screen.getAllByRole('listitem')[0]
    expect(first.textContent).toContain('Gamma')
    expect(first.textContent).toContain('3rd')
    expect(first.textContent).toContain('52/100')
    expect(first.querySelector('a')?.nextElementSibling?.textContent).toBe('3rd')
    expect(within(first).getByRole('button', { name: 'Use Gamma' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('keeps the actual step place when a selected vendor is pinned first', () => {
    render(<VendorSelectionProvider><StepComparisonTable scope="step" comparison={{ storyCount: 1, products: candidates.slice(0, 4).map((candidate, index) => ({ ...candidate, productId: candidate.id, hasLogo: false, score: scores[index], stories: [{ id: 'story', title: 'Story', verdict: 'full', quality: 5, weight: 1, confidence: 'high', rationale: '', evidence: [] }] })) }} /></VendorSelectionProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Use Gamma for this step' }))
    const first = screen.getAllByRole('listitem')[0]
    expect(first.textContent).toContain('Gamma')
    expect(first.textContent).toContain('3rd')
    expect(first.textContent).toContain('52/100')
    expect(first.querySelector('a')?.nextElementSibling?.textContent).toBe('3rd')
  })
})
