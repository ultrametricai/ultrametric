// @vitest-environment jsdom
// Founder 2026-10-08: (a) the Install section moved back UP the product page — right after the
// header/score area, before the story content (showcase, processes, verdicts); (b) directly
// under it, 'Install via Ultrametric' — a copyable prompt (the ProcessRunCTA copy idiom) handing
// an agent the COMMITTED setup process for this product (lib/installViaUm.ts mapping over the
// vendorProcesses reverse index; prompt mechanics lib/process-start.ts installPrompt). Products
// with no mapped setup process render NO block — the committed start contract is process-scoped,
// so there is no prompt target to offer (never invented).
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InstallViaUltrametric from '@/components/InstallViaUltrametric'
import ProductPage from '@/app/arena/[category]/product/[id]/page'
import { installProcessForVendor } from '@/lib/installViaUm'
import { installPrompt } from '@/lib/process-start'

let writeText = vi.fn()

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
})

const stripePage = () =>
  ProductPage({ params: Promise.resolve({ category: 'payments', id: 'stripe' }) })

describe('Install placement + Install via Ultrametric (product page)', () => {
  it('Install sits right after the header, above showcase/processes/sandbox, with the UM block directly under it', async () => {
    const { container } = render(await stripePage())
    const install = screen.getByText('Install')
    const viaUm = screen.getByText('Install via Ultrametric')
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    // Install → Install via Ultrametric, in that order.
    expect(follows(install, viaUm)).toBe(true)
    // Both precede the story content: the processes section and the sandbox.
    const processes = screen.getByText('Processes this product serves')
    expect(follows(viaUm, processes)).toBe(true)
    const tryIt = container.querySelector('#try-it')!
    expect(follows(viaUm, tryIt)).toBe(true)
  })

  it('the prompt is the committed start contract for the mapped setup process — never an invented target', async () => {
    const { container } = render(await stripePage())
    const mapped = installProcessForVendor('payments', 'stripe')!
    expect(mapped).not.toBeNull()
    const prompt = installPrompt('Stripe', mapped.target)
    // The page renders several <code> blocks (install commands) — the prompt is one of them,
    // verbatim.
    const codes = [...container.querySelectorAll('code')].map((el) => el.textContent)
    expect(codes).toContain(prompt)
    expect(prompt).toContain(`https://api.ultrametric.ai/start?process=${mapped.target.id}`)
    expect(prompt).toContain('Stripe')
    // The grounding is said out loud: which process the prompt runs.
    expect(container.textContent).toContain(mapped.title)
  })

  it('renders NO block for a product with no mapped setup process, even one with install commands (web-scraping/firecrawl)', async () => {
    expect(installProcessForVendor('web-scraping', 'firecrawl')).toBeNull()
    const { container } = render(
      await ProductPage({ params: Promise.resolve({ category: 'web-scraping', id: 'firecrawl' }) }),
    )
    // The install commands still render (and still sit up top); the UM prompt does not.
    expect(screen.getByText('Install')).toBeTruthy()
    expect(container.textContent).not.toContain('Install via Ultrametric')
    expect(container.textContent).not.toContain('api.ultrametric.ai/start')
  })
})

describe('InstallViaUltrametric copy idiom (ProcessRunCTA mechanics)', () => {
  const target = { id: 'qs_023', title: 'Open bank account', regions: [] }

  it('one click copies the exact prompt and reports Copied.', async () => {
    render(<InstallViaUltrametric productName="Mercury" target={target} processTitle="Open bank account" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(writeText).toHaveBeenCalledExactlyOnceWith(installPrompt('Mercury', target))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Copied.'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('only exposes manual copy after a clipboard failure and never reports Copied. on failure', async () => {
    writeText.mockRejectedValue(new Error('Denied'))
    render(<InstallViaUltrametric productName="Mercury" target={target} processTitle="Open bank account" />)
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Clipboard unavailable'))
    const field = screen.getByRole('textbox', { name: 'Install prompt for manual copy' }) as HTMLTextAreaElement
    expect(document.activeElement).toBe(field)
    expect(field.selectionEnd).toBe(field.value.length)
    expect(screen.getByRole('status').textContent).not.toContain('Copied.')
  })
})
