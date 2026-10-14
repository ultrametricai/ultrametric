import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import type { ProofIndexEntry } from '../../lib/proofs'
import { upsertProofIndex, writeProofArtifact } from '../proof-io'

// Browser-proof pilot (docs/PROVE-IT.md): record a short video of a real browser loading a
// vendor's PUBLIC docs page and locating the documented endpoint behind a claimed story —
// visual, replayable proof that the claim's documentation actually exists, keyless and
// deterministic. Currently one hardcoded pilot (firecrawl's POST /v2/scrape endpoint for
// web-scraping/agentic-public-api); generalizing this into spec-driven browser probes is the
// Prove-It runner's job.
//
// Playwright is intentionally NOT a repo dependency (it would dwarf the app's node_modules for
// a script that runs rarely). Run it with a scratch install, e.g.:
//
//   npm install --prefix .proof-scratch playwright   # browsers come from ~/Library/Caches/ms-playwright
//   pnpm exec tsx pipeline/scripts/record-browser-proof.ts
//
// UM_PLAYWRIGHT_DIR overrides the scratch location.

const SCRATCH = process.env.UM_PLAYWRIGHT_DIR ?? process.env.PA_PLAYWRIGHT_DIR ?? path.resolve(__dirname, '../../.proof-scratch')

const PILOT = {
  category: 'web-scraping',
  productId: 'firecrawl',
  probeId: 'api-docs-scrape-endpoint',
  storyIds: ['agentic-public-api'],
  url: 'https://docs.firecrawl.dev/api-reference/endpoint/scrape',
  anchorText: 'https://api.firecrawl.dev/v2/scrape',
  command:
    'playwright: load https://docs.firecrawl.dev/api-reference/endpoint/scrape and locate the documented POST https://api.firecrawl.dev/v2/scrape endpoint',
}

// Minimal structural types for the slice of the Playwright API this script touches — the real
// package lives in the scratch install, invisible to tsc.
interface PwLocator {
  first(): PwLocator
  waitFor(opts: { state: 'visible'; timeout: number }): Promise<void>
  scrollIntoViewIfNeeded(): Promise<void>
  evaluate(fn: (el: HTMLElement) => void): Promise<void>
}
interface PwPage {
  goto(url: string, opts: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<unknown>
  getByText(text: string): PwLocator
  waitForTimeout(ms: number): Promise<void>
  video(): { path(): Promise<string> } | null
}
interface PwContext {
  newPage(): Promise<PwPage>
  close(): Promise<void>
}
interface PwBrowser {
  newContext(opts: object): Promise<PwContext>
  close(): Promise<void>
}

async function main() {
  const require = createRequire(path.join(SCRATCH, 'noop.js'))
  const { chromium } = require('playwright') as { chromium: { launch(): Promise<PwBrowser> } }

  const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-browser-proof-'))
  const browser = await chromium.launch()
  let exitCode = 1
  let videoFile: string | null = null
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
    })
    const page = await context.newPage()
    await page.goto(PILOT.url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const anchor = page.getByText(PILOT.anchorText).first()
    await anchor.waitFor({ state: 'visible', timeout: 30_000 })
    await anchor.scrollIntoViewIfNeeded()
    // Outline the located endpoint so the recording visibly "finds" it, then linger so the
    // moment survives video compression.
    await anchor.evaluate((el) => {
      el.style.outline = '3px solid #34d399'
      el.style.outlineOffset = '4px'
    })
    await page.waitForTimeout(2_500)
    exitCode = 0
    const video = page.video()
    await context.close() // flushes the video file
    videoFile = video ? await video.path() : null
  } finally {
    await browser.close()
  }

  if (!videoFile || !fs.existsSync(videoFile)) throw new Error('playwright produced no video file')

  const entry: ProofIndexEntry = {
    probeId: PILOT.probeId,
    productId: PILOT.productId,
    storyIds: PILOT.storyIds,
    command: PILOT.command,
    recordedAt: new Date().toISOString(),
    exitCode,
    kind: 'video',
    file: `${PILOT.productId}/${PILOT.probeId}.webm`,
  }
  writeProofArtifact(PILOT.category, entry, { copyFrom: videoFile })
  upsertProofIndex(PILOT.category, [entry])
  fs.rmSync(videoDir, { recursive: true, force: true })
  console.log(`browser-proof: ${PILOT.category}/${PILOT.productId}/${PILOT.probeId} — recorded (exit ${exitCode})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
