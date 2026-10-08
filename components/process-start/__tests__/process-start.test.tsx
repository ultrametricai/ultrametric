// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ProcessRunCTA from '../ProcessRunCTA'
import { RegionalVariantProvider, RegionalVariantSelector } from '@/components/shared-processes/RegionalVariant'
import { regionalDecision } from '@/lib/shared-processes/regions'
import { findSharedRecord, readSharedCatalog, sharedPreviewHref } from '@/lib/shared-processes/reader'
import { processStartTarget } from '@/lib/shared-processes/start'
import { startPrompt } from '@/lib/process-start'
import { setGeoChoice } from '@/lib/geoPreference'

const records = readSharedCatalog()
const record = findSharedRecord(records, 'form_001')!
const target = processStartTarget(record)
const publicHref = sharedPreviewHref(record.id, records)
let writeText = vi.fn()

beforeEach(() => {
  setGeoChoice(null)
  window.history.replaceState({}, '', publicHref)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')) }
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
})

function picker() {
  const view = render(<RegionalVariantProvider decision={regionalDecision(record)}><RegionalVariantSelector /><ProcessRunCTA target={target} /></RegionalVariantProvider>)
  const trigger = screen.getByRole('button', { name: 'Run this process with Ultrametric' })
  fireEvent.click(trigger)
  return { view, trigger }
}

describe('inline process picker', () => {
  it('copies immediately with one click, without navigation, a panel, or another confirmation', async () => {
    let complete!: () => void
    writeText.mockImplementation(() => new Promise<void>(resolve => { complete = resolve }))
    const { trigger } = picker()
    expect(trigger.textContent?.trim()).toBe('Run this process with Ultrametric')
    const location = window.location.href
    const open = vi.spyOn(window, 'open')
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(writeText).toHaveBeenCalledExactlyOnceWith(startPrompt(target, 'default', 'claude'))
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.queryByRole('textbox')).toBeNull()
    await act(async () => complete())
    expect(screen.getByRole('status').textContent).toBe('Copied.')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(window.location.href).toBe(location)
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
  })

  it('selects agents without copying, then copies the exact process and country in one click', async () => {
    picker()
    fireEvent.click(screen.getByRole('radio', { name: 'India - MCA SPICe+ filing' }))
    for (const [name, agent] of [['Claude', 'claude'], ['ChatGPT', 'chatgpt'], ['Codex', 'codex'], ['Claude Code', 'claude-code'], ['Cursor', 'cursor']] as const) {
      writeText.mockClear()
      fireEvent.click(screen.getByRole('radio', { name }))
      expect(writeText).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
      await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(startPrompt(target, 'india-spice-plus', agent)))
      expect(window.location.pathname).toBe(publicHref)
    }
    // Ultrametric CLI is the exception (founder 2026-10-08): it has no launch URL, so
    // selecting it IS the one click — the prompt copies on selection, with the country kept.
    writeText.mockClear()
    fireEvent.click(screen.getByRole('radio', { name: 'Ultrametric CLI' }))
    expect(writeText).toHaveBeenCalledExactlyOnceWith(startPrompt(target, 'india-spice-plus', 'cli'))
    expect(window.location.pathname).toBe(publicHref)
  })

  it('launches only verified destinations with public identity in a new tab', () => {
    picker()
    fireEvent.click(screen.getByRole('radio', { name: 'India - MCA SPICe+ filing' }))
    const launch = screen.getByRole('link', { name: 'Run on web' })
    expect(new URL(launch.getAttribute('href')!).searchParams.get('q')).toBe(startPrompt(target, 'india-spice-plus', 'claude'))
    expect(launch.getAttribute('target')).toBe('_blank')
    expect(launch.getAttribute('rel')).toBe('noopener noreferrer')
    expect(launch.getAttribute('referrerpolicy')).toBe('no-referrer')
    fireEvent.click(screen.getByRole('radio', { name: 'ChatGPT' }))
    const chatgpt = screen.getByRole('link', { name: 'Run on web' })
    expect(new URL(chatgpt.getAttribute('href')!).searchParams.get('q')).toBe(startPrompt(target, 'india-spice-plus', 'chatgpt'))
    expect(chatgpt.getAttribute('title')).toContain('send this process prompt')
    for (const name of ['Codex', 'Claude Code']) {
      fireEvent.click(screen.getByRole('radio', { name }))
      expect(screen.queryByRole('link')).toBeNull()
    }
    fireEvent.click(screen.getByRole('radio', { name: 'Cursor' }))
    const cursor = new URL(screen.getByRole('link', { name: 'Open in Cursor' }).getAttribute('href')!)
    expect(cursor.origin).toBe('https://cursor.com')
    expect(cursor.searchParams.get('text')).toBe(startPrompt(target, 'india-spice-plus', 'cursor'))
    expect(writeText).not.toHaveBeenCalled()
  })

  it('keeps the explicit regional selector ahead of the site-wide country preference', () => {
    setGeoChoice('UK')
    picker()
    const launchPrompt = () => new URL(screen.getByRole('link', { name: 'Run on web' }).getAttribute('href')!).searchParams.get('q')
    expect(launchPrompt()).toBe(startPrompt(target, 'default', 'claude'))
    fireEvent.click(screen.getByRole('radio', { name: 'India - MCA SPICe+ filing' }))
    expect(launchPrompt()).toBe(startPrompt(target, 'india-spice-plus', 'claude'))
  })

  // Founder sequence (2026-10-08): open modal → click Ultrametric CLI → prompt copied,
  // feedback shown, /get-started install path linked. No terminal-command panel.
  it('copies the agent prompt on CLI selection, confirms, and links the CLI install path', async () => {
    picker()
    fireEvent.click(screen.getByRole('radio', { name: 'Ultrametric CLI' }))
    expect(writeText).toHaveBeenCalledExactlyOnceWith(startPrompt(target, 'default', 'cli'))
    expect(writeText.mock.calls[0][0]).toContain('method=cli')
    expect(writeText.mock.calls[0][0]).not.toContain('vendor=')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Copied.'))
    // A user without the CLI is not stranded: the only link is the install path.
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/get-started')
    expect(links[0].textContent).toContain('Install the CLI')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText(/curl|terminal commands/)).toBeNull()
  })

  it('shows the manual-copy textarea and keeps the install link when the CLI copy fails', async () => {
    writeText.mockRejectedValue(new Error('Denied'))
    picker()
    fireEvent.click(screen.getByRole('radio', { name: 'Ultrametric CLI' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Clipboard unavailable'))
    const field = screen.getByRole('textbox', { name: 'Process prompt for manual copy' }) as HTMLTextAreaElement
    expect(field.value).toBe(startPrompt(target, 'default', 'cli'))
    expect(document.activeElement).toBe(field)
    expect(screen.getByRole('status').textContent).not.toContain('Copied.')
    expect(screen.getByRole('link', { name: /Install the CLI/ }).getAttribute('href')).toBe('/get-started')
  })

  it('leaves non-CLI agents launch-or-copy only, with no install link', () => {
    picker()
    for (const name of ['Claude', 'ChatGPT', 'Codex', 'Claude Code', 'Cursor']) {
      fireEvent.click(screen.getByRole('radio', { name }))
      expect(screen.queryByRole('link', { name: /Install the CLI/ })).toBeNull()
    }
    expect(writeText).not.toHaveBeenCalled()
  })

  it('only exposes manual copy after failure and never reports copied on failure', async () => {
    writeText.mockRejectedValue(new Error('Denied'))
    picker()
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Clipboard unavailable'))
    const field = screen.getByRole('textbox', { name: 'Process prompt for manual copy' }) as HTMLTextAreaElement
    expect(document.activeElement).toBe(field)
    expect(field.selectionEnd).toBe(field.value.length)
    expect(screen.getByRole('status').textContent).not.toContain('Copied.')
  })

  it('closes on Back, restores focus, and reopens without stale feedback', async () => {
    const { trigger } = picker()
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Copied.'))
    window.history.replaceState({}, '', publicHref)
    fireEvent(window, new PopStateEvent('popstate'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('ignores late clipboard completion after closing and reopening', async () => {
    let complete!: () => void
    writeText.mockImplementation(() => new Promise<void>(resolve => { complete = resolve }))
    const { trigger } = picker()
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    fireEvent(window, new PopStateEvent('popstate'))
    fireEvent.click(trigger)
    await act(async () => complete())
    expect(screen.getByRole('status').textContent).toBe('')
    expect((screen.getByRole('radio', { name: 'Claude' }) as HTMLInputElement).checked).toBe(true)
  })

  it('waits for a delayed close navigation before accepting another open', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const { trigger } = picker()
    fireEvent.click(screen.getByRole('radio', { name: 'India - MCA SPICe+ filing' }))
    for (let cycle = 0; cycle < 2; cycle++) {
      fireEvent.click(screen.getByRole('button', { name: 'Close agent picker' }))
      expect(document.activeElement).toBe(trigger)
      expect(trigger.getAttribute('aria-disabled')).toBe('true')
      fireEvent.click(trigger)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(back).toHaveBeenCalledTimes(cycle + 1)
      window.history.replaceState({}, '', publicHref)
      fireEvent(window, new PopStateEvent('popstate'))
      expect(trigger.getAttribute('aria-disabled')).toBeNull()
      fireEvent.click(trigger)
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(window.location.hash).toBe('#run-process')
    }
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(writeText).toHaveBeenCalledExactlyOnceWith(startPrompt(target, 'india-spice-plus', 'claude'))
    back.mockRestore()
  })

  it('wraps keyboard focus and closes on Escape', () => {
    const { trigger } = picker()
    const first = screen.getByRole('button', { name: 'Close agent picker' })
    const last = screen.getByRole('button', { name: 'Copy prompt' })
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(back).toHaveBeenCalledOnce()
    back.mockRestore()
  })

  it('clears stale copied status when the context changes', async () => {
    picker()
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Copied.'))
    fireEvent.click(screen.getByRole('radio', { name: 'India - MCA SPICe+ filing' }))
    expect(screen.getByRole('status').textContent).toBe('')
  })

})
