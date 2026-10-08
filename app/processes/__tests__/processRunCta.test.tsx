// @vitest-environment jsdom
// Founder 2026-10-08: the canonical /processes/[slug] page carries the v2 reader's
// run-with-Ultrametric affordance — the SAME ProcessRunCTA component (agent-picker modal over
// the public api.ultrametric.ai/start prompt handoff; public on v2, so public here), triggered
// by the site's header-CTA idiom (the product pages' emerald 'Test in Ultrametric' button
// style) on the RIGHT of the header. Situations render no CTA, mirroring the v2 reader's
// kind === 'process' gate.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProcessPage from '@/app/processes/[slug]/page'
import { loadProcesses, processSlug } from '@/lib/processes'
import { findSharedRecord, readSharedCatalog } from '@/lib/shared-processes/reader'
import { processStartTarget } from '@/lib/shared-processes/start'
import { startPrompt } from '@/lib/process-start'
import { setGeoChoice } from '@/lib/geoPreference'

const tasks = loadProcesses()
const renderPage = async (id: string) => {
  const task = tasks.find((t) => t.id === id)!
  const page = await ProcessPage({ params: Promise.resolve({ slug: processSlug(task.title) }) })
  return { task, ...render(page) }
}

beforeEach(() => {
  setGeoChoice(null)
  window.history.replaceState({}, '', '/processes/incorporate-a-us-company')
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')) }
})

describe('canonical process page — Run this process in Ultrametric (founder 2026-10-08)', () => {
  it('renders the CTA in the product pages\' primary-button idiom and opens the lifted agent-picker modal', async () => {
    await renderPage('form_001')
    const trigger = screen.getByRole('button', { name: 'Run this process in Ultrametric' })
    // The site's existing primary-CTA idiom (the product header's 'Test in Ultrametric' style),
    // not the v2 pill.
    expect(trigger.className).toContain('bg-emerald-400')
    expect(trigger.className).toContain('font-semibold')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    fireEvent.click(trigger)
    // The lifted v2 modal: the agent picker over the public start-prompt handoff.
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Choose your agent')).toBeTruthy()
    for (const agent of ['Claude', 'ChatGPT', 'Codex', 'Claude Code', 'Cursor', 'Ultrametric CLI']) {
      expect(screen.getByRole('radio', { name: agent })).toBeTruthy()
    }
    // The handoff is the REAL public start prompt for this record — never a fake run.
    const record = findSharedRecord(readSharedCatalog(), 'form_001')!
    const prompt = startPrompt(processStartTarget(record), undefined, 'claude')
    expect(prompt).toContain('https://api.ultrametric.ai/start?process=form_001')
    const launch = screen.getByRole('link', { name: 'Run on web' })
    expect(new URL(launch.getAttribute('href')!).searchParams.get('q')).toBe(prompt)
  })

  it('carries the canonical country selection through copied and launched handoffs for every agent', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    await renderPage('form_001')
    fireEvent.click(screen.getByRole('button', { name: 'switch to the United Kingdom view →' }))
    expect(window.location.search).toBe('?geo=uk')
    fireEvent.click(screen.getByRole('button', { name: 'Run this process in Ultrametric' }))
    const target = processStartTarget(findSharedRecord(readSharedCatalog(), 'form_001')!)
    for (const [name, agent] of [['Claude', 'claude'], ['ChatGPT', 'chatgpt'], ['Codex', 'codex'], ['Claude Code', 'claude-code'], ['Cursor', 'cursor'], ['Ultrametric CLI', 'cli']] as const) {
      writeText.mockClear()
      await act(async () => fireEvent.click(screen.getByRole('radio', { name })))
      const expected = startPrompt(target, 'uk-companies-house', agent)
      if (agent === 'cli') {
        expect(writeText).toHaveBeenCalledExactlyOnceWith(expected)
        expect(screen.getByRole('status').textContent).toBe('Copied.')
      } else expect(writeText).not.toHaveBeenCalled()
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' })))
      expect(writeText).toHaveBeenLastCalledWith(expected)
      const launch = screen.queryByRole('link', { name: /^(Run on web|Open in Cursor)$/ })
      if (['claude', 'chatgpt', 'cursor'].includes(agent)) {
        expect(new URL(launch!.getAttribute('href')!).searchParams.get(agent === 'cursor' ? 'text' : 'q')).toBe(expected)
      } else expect(launch).toBeNull()
    }
    scroll.mockRestore()
  })

  it('the CTA sits in the header row, outside the #steps region', async () => {
    const { container } = await renderPage('form_001')
    const trigger = screen.getByRole('button', { name: 'Run this process in Ultrametric' })
    const steps = container.querySelector('#steps')!.parentElement!
    expect(steps.contains(trigger)).toBe(false)
  })

  it('the v2 kind gate carries over verbatim: the CTA renders exactly when the task\'s shared record is kind \'process\' (today that includes situations — their shared records are kind \'process\', so the v2 reader shows the CTA for them too)', async () => {
    const catalog = readSharedCatalog()
    const situation = tasks.find((t) => t.kind === 'situation')
    expect(situation, 'corpus must contain at least one situation').toBeDefined()
    const record = findSharedRecord(catalog, situation!.id)
    expect(record?.kind).toBe('process') // the mirror fact the parity rests on
    await renderPage(situation!.id)
    expect(screen.getByRole('button', { name: 'Run this process in Ultrametric' })).toBeTruthy()
  })
})
