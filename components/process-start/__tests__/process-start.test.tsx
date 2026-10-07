// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ProcessRunCTA from '../ProcessRunCTA'
import { RegionalVariantProvider, RegionalVariantSelector } from '@/components/shared-processes/RegionalVariant'
import { regionalDecision } from '@/lib/shared-processes/regions'
import { findSharedRecord, readSharedCatalog, sharedPreviewHref } from '@/lib/shared-processes/reader'
import { processStartTarget } from '@/lib/shared-processes/start'
import { startPrompt } from '@/lib/process-start'

const records = readSharedCatalog()
const record = findSharedRecord(records, 'form_001')!
const target = processStartTarget(record)
const publicHref = sharedPreviewHref(record.id, records)
let writeText = vi.fn()

beforeEach(() => {
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
    for (const [name, agent] of [['Claude', 'claude'], ['ChatGPT', 'chatgpt'], ['Codex', 'codex'], ['Claude Code', 'claude-code'], ['Cursor', 'cursor'], ['Ultrametric CLI', 'cli']] as const) {
      writeText.mockClear()
      fireEvent.click(screen.getByRole('radio', { name }))
      expect(writeText).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
      await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(startPrompt(target, 'india-spice-plus', agent)))
      expect(window.location.pathname).toBe(publicHref)
    }
  })

  it('launches only verified destinations with public identity in a new tab', () => {
    picker()
    fireEvent.click(screen.getByRole('radio', { name: 'India - MCA SPICe+ filing' }))
    const launch = screen.getByRole('link', { name: 'Run on web' })
    expect(new URL(launch.getAttribute('href')!).searchParams.get('q')).toBe(startPrompt(target, undefined, 'claude'))
    expect(launch.getAttribute('target')).toBe('_blank')
    expect(launch.getAttribute('rel')).toBe('noopener noreferrer')
    expect(launch.getAttribute('referrerpolicy')).toBe('no-referrer')
    fireEvent.click(screen.getByRole('radio', { name: 'ChatGPT' }))
    const chatgpt = screen.getByRole('link', { name: 'Run on web' })
    expect(new URL(chatgpt.getAttribute('href')!).searchParams.get('q')).toBe(startPrompt(target, undefined, 'chatgpt'))
    expect(chatgpt.getAttribute('title')).toContain('send this process prompt')
    for (const name of ['Codex', 'Claude Code']) {
      fireEvent.click(screen.getByRole('radio', { name }))
      expect(screen.queryByRole('link')).toBeNull()
    }
    fireEvent.click(screen.getByRole('radio', { name: 'Cursor' }))
    const cursor = new URL(screen.getByRole('link', { name: 'Open in Cursor' }).getAttribute('href')!)
    expect(cursor.origin).toBe('https://cursor.com')
    expect(cursor.searchParams.get('text')).toBe(startPrompt(target, undefined, 'cursor'))
    expect(writeText).not.toHaveBeenCalled()
  })

  it('offers only one-click agent-prompt copy for CLI, with no terminal-command panel', async () => {
    picker()
    fireEvent.click(screen.getByRole('radio', { name: 'Ultrametric CLI' }))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(/curl|terminal commands/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(writeText).toHaveBeenCalledExactlyOnceWith(startPrompt(target, 'default', 'cli'))
    expect(writeText.mock.calls[0][0]).toContain('method=cli')
    expect(writeText.mock.calls[0][0]).not.toContain('vendor=')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Copied.'))
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

describe('agent preference on the existing process history entry', () => {
  it.each([
    ['ChatGPT', 'chatgpt'], ['Codex', 'codex'], ['Claude Code', 'claude-code'], ['Cursor', 'cursor'], ['Ultrametric CLI', 'cli'],
  ] as const)('restores %s after reload/reopen with the exact method/vendor and no automatic launch', async (name, agent) => {
    const { view } = picker()
    fireEvent.click(screen.getByRole('radio', { name }))
    const url = location.href
    const state = structuredClone(history.state)
    view.unmount()
    const open = vi.spyOn(window, 'open')
    const reloaded = render(<ProcessRunCTA target={target} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(location.href).toBe(url)
    expect(writeText).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Run this process with Ultrametric' }))
    expect((screen.getByRole('radio', { name }) as HTMLInputElement).checked).toBe(true)
    expect(history.state.paProcessSelection.startAgent).toBe(agent)
    expect(history.state.paProcessSelection.recordId).toBe(target.id)
    expect(state.paProcessSelection.startAgent).toBe(agent)
    const launch = screen.queryByRole('link')
    if (launch) {
      const params = new URL(launch.getAttribute('href')!).searchParams
      expect(params.get(agent === 'cursor' ? 'text' : 'q')).toBe(startPrompt(target, undefined, agent))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(startPrompt(target, undefined, agent)))
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
    reloaded.unmount()
  })

  it('carries the agent choice through close/Back to the originating entry without replacing other state', () => {
    const initial = { nextState: 'keep', paProcessSelection: { recordId: target.id, geo: 'pt', picks: { 'form_001:n1': 'legal-ops/clerky' }, overrides: { 'form_001:n6': 'legal-ops/stripe-atlas' }, methods: { 'form_001:n6': true } } }
    history.replaceState(initial, '', `${publicHref}?geo=pt&keep=one#steps`)
    const origin = location.href
    const back = vi.spyOn(history, 'back').mockImplementation(() => {})
    const { trigger } = picker()
    fireEvent.click(screen.getByRole('radio', { name: 'ChatGPT' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close agent picker' }))
    history.replaceState(initial, '', origin)
    fireEvent(window, new PopStateEvent('popstate'))
    expect(history.state).toEqual({ ...initial, paProcessSelection: { ...initial.paProcessSelection, startAgent: 'chatgpt' } })
    expect(location.href).toBe(origin)
    fireEvent.click(trigger)
    expect((screen.getByRole('radio', { name: 'ChatGPT' }) as HTMLInputElement).checked).toBe(true)
    back.mockRestore()
  })

  it.each(['unknown', null, { id: 'chatgpt' }])('falls back from malformed saved agent %j', startAgent => {
    history.replaceState({ paProcessSelection: { recordId: target.id, startAgent } }, '', publicHref)
    picker()
    expect((screen.getByRole('radio', { name: 'Claude' }) as HTMLInputElement).checked).toBe(true)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('ignores a different process and restores Back/Forward and cached page entries without opening the dialog', () => {
    history.replaceState({ paProcessSelection: { recordId: 'other', startAgent: 'chatgpt' } }, '', publicHref)
    const view = render(<ProcessRunCTA target={target} />)
    const selected = () => view.container.querySelector<HTMLInputElement>('dialog input:checked')!.value
    expect(selected()).toBe('claude')
    const restore = (agent: string, event: Event) => {
      history.replaceState({ paProcessSelection: { recordId: target.id, startAgent: agent } }, '', publicHref)
      fireEvent(window, event)
    }
    restore('chatgpt', new PopStateEvent('popstate'))
    expect(selected()).toBe('chatgpt')
    restore('cursor', new PopStateEvent('popstate'))
    expect(selected()).toBe('cursor')
    restore('codex', new PageTransitionEvent('pageshow', { persisted: true }))
    expect(selected()).toBe('codex')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(writeText).not.toHaveBeenCalled()
  })
})
