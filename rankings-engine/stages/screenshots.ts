import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { ProductSchema, type Product } from '../../lib/schemas'
import { categoryDir, readJson, resolveCategories, ROOT } from '../paths'

// Showcase screenshots: capture each product's vendor homepage (and docs landing page, when
// it's a distinct URL) with a real browser, compress to a small WebP, and commit the result
// under public/screenshots/ for components/ProductShowcase.tsx to render. Mirrors the logos
// stage's shape (per-category loop, warn-and-continue on failure) and record-browser-proof.ts's
// Playwright convention: playwright + sharp are NOT repo dependencies — they load from a
// gitignored scratch install (browsers come from ~/Library/Caches/ms-playwright):
//
//   npm install --prefix .proof-scratch playwright sharp
//   pnpm pipeline screenshots [--category <id>] [--product <id>] [--force]
//
// UM_PLAYWRIGHT_DIR overrides the scratch location.

const SCREENSHOTS_DIR = path.join(ROOT, 'public', 'screenshots')
const SCRATCH = process.env.UM_PLAYWRIGHT_DIR ?? process.env.PA_PLAYWRIGHT_DIR ?? path.resolve(__dirname, '../../.proof-scratch')

const VIEWPORT = { width: 1440, height: 900 }
const OUTPUT_WIDTH = 1200 // downscaled from the 1440px capture; plenty for a gallery thumbnail
const MAX_BYTES = 300 * 1024
// A 1200px-wide WebP smaller than this is almost certainly a blank/failed render, not a real page.
const MIN_BYTES = 4 * 1024
const FRESH_MS = 30 * 24 * 60 * 60 * 1000 // re-runnable: skip files younger than 30 days
const WEBP_QUALITIES = [75, 60, 45]
const GOTO_TIMEOUT_MS = 45_000
const SETTLE_TIMEOUT_MS = 12_000

// Never commit an error page: bot challenges and 403/404 interstitials give themselves away in
// the title/body. Checked case-insensitively against both.
const BLOCK_PHRASES = [
  'access denied',
  'just a moment',
  'attention required',
  'verify you are human',
  'verifying you are human',
  'pardon our interruption',
  'page not found',
  // Parked/lapsed domains render a registrar ad, not the vendor (seen live: kong.com is a
  // GoDaddy parked page — the vendor actually lives at konghq.com).
  'is parked free',
  'domain is parked',
  'buy this domain',
]

/**
 * Returns a human-readable block reason when a page's title/body looks like a bot challenge or
 * error page (403/404/Cloudflare "Just a moment…" etc.), or null when the page looks legit.
 * Bare "404" is only trusted in the title — page bodies mention 404 too easily (docs, blogs).
 */
export function detectBlockedPage(title: string, bodyText: string): string | null {
  const t = title.toLowerCase()
  const b = bodyText.toLowerCase()
  if (/\b404\b/.test(t)) return 'title contains 404'
  for (const phrase of BLOCK_PHRASES) {
    if (t.includes(phrase)) return `title contains "${phrase}"`
    if (b.includes(phrase)) return `body contains "${phrase}"`
  }
  return null
}

/** True when `docs` is a real, distinct page from `site` (ignoring trailing-slash noise). */
export function docsDiffersFromSite(urls: Product['urls']): boolean {
  if (!urls.docs) return false
  const norm = (u: string) => u.replace(/\/+$/, '').toLowerCase()
  return norm(urls.docs) !== norm(urls.site)
}

// ---- minimal structural types for the scratch-installed playwright + sharp (invisible to tsc) ----

interface PwResponse {
  status(): number
}
interface PwPage {
  goto(url: string, opts: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<PwResponse | null>
  waitForLoadState(state: 'networkidle', opts: { timeout: number }): Promise<void>
  waitForTimeout(ms: number): Promise<void>
  title(): Promise<string>
  evaluate<T>(fn: () => T): Promise<T>
  screenshot(opts: { type: 'png'; fullPage: boolean }): Promise<Buffer>
  close(): Promise<void>
}
interface PwContext {
  newPage(): Promise<PwPage>
  close(): Promise<void>
}
interface PwBrowser {
  newContext(opts: object): Promise<PwContext>
  close(): Promise<void>
}
type SharpFn = (input: Buffer) => {
  resize(opts: { width: number }): {
    webp(opts: { quality: number }): { toBuffer(): Promise<Buffer> }
  }
}

function loadScratchDeps(): { chromium: { launch(): Promise<PwBrowser> }; sharp: SharpFn } {
  const require = createRequire(path.join(SCRATCH, 'noop.js'))
  const { chromium } = require('playwright') as { chromium: { launch(): Promise<PwBrowser> } }
  const sharp = require('sharp') as SharpFn
  return { chromium, sharp }
}

export type ShotKind = 'home' | 'docs'

function destFor(productId: string, kind: ShotKind): string {
  return path.join(SCREENSHOTS_DIR, `${productId}-${kind}.webp`)
}

function isFresh(dest: string): boolean {
  try {
    return Date.now() - fs.statSync(dest).mtimeMs < FRESH_MS
  } catch {
    return false
  }
}

async function compressToWebp(sharp: SharpFn, png: Buffer): Promise<Buffer> {
  let out: Buffer | null = null
  for (const quality of WEBP_QUALITIES) {
    out = await sharp(png).resize({ width: OUTPUT_WIDTH }).webp({ quality }).toBuffer()
    if (out.length <= MAX_BYTES) return out
  }
  throw new Error(`could not compress under ${MAX_BYTES / 1024}KB (best: ${Math.round(out!.length / 1024)}KB)`)
}

interface RunTally {
  captured: number
  skippedFresh: number
  blocked: string[]
  failed: string[]
}

async function captureShot(
  context: PwContext,
  sharp: SharpFn,
  label: string,
  url: string,
  dest: string,
): Promise<'captured' | 'blocked' | 'failed'> {
  const page = await context.newPage()
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO_TIMEOUT_MS })
    const status = response?.status() ?? 0
    if (status >= 400) {
      console.warn(`screenshots: SKIP ${label} — HTTP ${status} from ${url}`)
      return 'blocked'
    }
    // Let SPA hydration/fonts/hero images settle; networkidle can never fire on chatty sites,
    // so a timeout there is fine — we still grab whatever has rendered.
    await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => {})
    await page.waitForTimeout(1_500)

    const title = await page.title()
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 5_000) ?? '')
    const blockReason = detectBlockedPage(title, bodyText)
    if (blockReason) {
      console.warn(`screenshots: SKIP ${label} — blocked (${blockReason})`)
      return 'blocked'
    }

    const png = await page.screenshot({ type: 'png', fullPage: false }) // above-the-fold only
    const webp = await compressToWebp(sharp, png)
    if (webp.length < MIN_BYTES) {
      console.warn(`screenshots: SKIP ${label} — near-blank render (${webp.length} bytes)`)
      return 'blocked'
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, webp)
    console.log(`screenshots: ${label} saved (${Math.round(webp.length / 1024)}KB)`)
    return 'captured'
  } catch (err) {
    console.warn(`screenshots: WARN ${label} failed: ${(err as Error).message.split('\n')[0]}`)
    return 'failed'
  } finally {
    await page.close().catch(() => {})
  }
}

export async function runScreenshots({
  category,
  product,
  force,
}: {
  category?: string
  product?: string
  force?: boolean
}): Promise<void> {
  const { chromium, sharp } = loadScratchDeps()
  const browser = await chromium.launch()
  const tally: RunTally = { captured: 0, skippedFresh: 0, blocked: [], failed: [] }
  let matched = 0
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: 'dark',
      deviceScaleFactor: 1,
    })
    for (const cat of resolveCategories(category)) {
      const products = readJson(ProductSchema.array(), path.join(categoryDir(cat.id), 'products.json')).filter(
        (p) => !product || p.id === product,
      )
      matched += products.length
      for (const p of products) {
        const shots: Array<{ kind: ShotKind; url: string }> = [{ kind: 'home', url: p.urls.site }]
        if (docsDiffersFromSite(p.urls)) shots.push({ kind: 'docs', url: p.urls.docs! })
        for (const shot of shots) {
          const dest = destFor(p.id, shot.kind)
          const label = `${cat.id}/${p.id} ${shot.kind}`
          if (!force && isFresh(dest)) {
            tally.skippedFresh++
            console.log(`screenshots: ${label} fresh (<30d), skipping — use --force to recapture`)
            continue
          }
          const outcome = await captureShot(context, sharp, label, shot.url, dest)
          if (outcome === 'captured') tally.captured++
          else if (outcome === 'blocked') tally.blocked.push(label)
          else tally.failed.push(label)
        }
      }
    }
    await context.close()
  } finally {
    await browser.close()
  }
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
  console.log(
    `screenshots: done — ${tally.captured} captured, ${tally.skippedFresh} fresh-skipped, ` +
      `${tally.blocked.length} blocked [${tally.blocked.join(', ')}], ` +
      `${tally.failed.length} failed [${tally.failed.join(', ')}]`,
  )
}
