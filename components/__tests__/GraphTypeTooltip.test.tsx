// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import GraphTypeTooltip from '../shared-processes/GraphTypeTooltip'

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 40, y: 40, left: 40, top: 40, right: 160, bottom: 64, width: 120, height: 24, toJSON: () => ({}) })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('escapes the clipping container, describes its trigger, and dismisses on Escape', () => {
  const view = render(<div style={{ overflow: 'auto' }}><GraphTypeTooltip label="Agent" symbol="✦" color="text-emerald-300" /></div>)
  const button = screen.getByRole('button', { name: 'Agent' })
  fireEvent.focus(button)
  const tip = screen.getByRole('tooltip')
  expect(tip.parentElement).toBe(document.body)
  expect(view.container.contains(tip)).toBe(false)
  expect(button.getAttribute('aria-describedby')).toBe(tip.id)
  expect(button.hasAttribute('title')).toBe(false) // no competing global/native tooltip
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).toBeNull()
  expect(button.hasAttribute('aria-describedby')).toBe(false)
})

it('supports explicit open/close and outside dismissal without activating a step', () => {
  render(<GraphTypeTooltip label="Manual form" symbol="▤" color="text-amber-300" />)
  const button = screen.getByRole('button', { name: 'Manual form' })
  fireEvent.click(button)
  expect(screen.getByRole('tooltip').textContent).toBe('Manual form')
  fireEvent.click(button)
  expect(screen.queryByRole('tooltip')).toBeNull()
  fireEvent.click(button)
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('tooltip')).toBeNull()
})
