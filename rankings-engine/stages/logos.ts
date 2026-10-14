import fs from 'node:fs'
import path from 'node:path'
import { ProductSchema, type Product } from '../../lib/schemas'
import { fetchBinaryWithRetry, fetchWithRetry } from '../fetch-page'
import { categoryDir, readJson, resolveCategories, ROOT } from '../paths'

const LOGOS_DIR = path.join(ROOT, 'public', 'logos')
const MIN_ICON_SIZE = 64

interface LinkTag {
  rel: string[]
  href: string
  sizes: string
  type: string
}

// Minimal <link> tag attribute scan: robust enough for real-world <head> markup
// without pulling in a full HTML parser for a handful of pages per run.
function parseLinkTags(html: string): LinkTag[] {
  const tags: LinkTag[] = []
  const linkRegex = /<link\b[^>]*>/gi
  const attrRegex = /([a-zA-Z-]+)\s*=\s*"([^"]*)"|([a-zA-Z-]+)\s*=\s*'([^']*)'/g
  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(html))) {
    const tag = match[0]
    const attrs: Record<string, string> = {}
    let am: RegExpExecArray | null
    attrRegex.lastIndex = 0
    while ((am = attrRegex.exec(tag))) {
      const name = (am[1] ?? am[3]).toLowerCase()
      const value = am[2] ?? am[4] ?? ''
      attrs[name] = value
    }
    if (attrs.rel && attrs.href) {
      tags.push({
        rel: attrs.rel.toLowerCase().split(/\s+/).filter(Boolean),
        href: attrs.href,
        sizes: attrs.sizes ?? '',
        type: (attrs.type ?? '').toLowerCase(),
      })
    }
  }
  return tags
}

function sizeOf(sizes: string): number {
  const m = sizes.match(/(\d+)x\d+/i)
  return m ? parseInt(m[1], 10) : 0
}

function isPng(tag: LinkTag): boolean {
  return tag.type === 'image/png' || /\.png(?:[?#]|$)/i.test(tag.href)
}

function resolveHref(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

/**
 * Picks the best favicon/touch-icon href from a page's <head> markup.
 * Prefers apple-touch-icon (any size), then falls back to the largest
 * png `rel="icon"` link that's at least MIN_ICON_SIZE px. Returns null
 * when nothing suitable is found, or the href can't be resolved.
 */
export function pickIconHref(html: string, baseUrl: string): string | null {
  const tags = parseLinkTags(html)

  const appleTouch = tags
    .filter((t) => t.rel.includes('apple-touch-icon') || t.rel.includes('apple-touch-icon-precomposed'))
    .sort((a, b) => sizeOf(b.sizes) - sizeOf(a.sizes))
  if (appleTouch.length > 0) return resolveHref(appleTouch[0].href, baseUrl)

  const icons = tags
    .filter((t) => t.rel.includes('icon'))
    .filter(isPng)
    .filter((t) => sizeOf(t.sizes) >= MIN_ICON_SIZE)
    .sort((a, b) => sizeOf(b.sizes) - sizeOf(a.sizes))
  if (icons.length > 0) return resolveHref(icons[0].href, baseUrl)

  return null
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * True iff the buffer starts with the 8-byte PNG magic signature. This is the only
 * reliable check — content-type headers and .png-looking URLs can both lie (e.g. a
 * site serving an HTML error/redirect page at a .png href with a png content-type).
 */
export function isPngBytes(buffer: Buffer): boolean {
  return buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
}

function writeLogo(dest: string, buffer: Buffer): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buffer)
}

async function fetchSiteIcon(product: Product): Promise<Buffer> {
  const html = await fetchWithRetry(product.urls.site)
  const iconHref = pickIconHref(html, product.urls.site)
  if (!iconHref) throw new Error('no suitable icon link found')

  const { buffer, contentType } = await fetchBinaryWithRetry(iconHref)
  const looksLikePng = (contentType ?? '').includes('png') || /\.png(?:[?#]|$)/i.test(iconHref)
  if (!looksLikePng) throw new Error(`icon at ${iconHref} is not a png (content-type: ${contentType ?? 'unknown'})`)
  if (!isPngBytes(buffer)) throw new Error(`icon at ${iconHref} is not actually PNG bytes (bad magic signature)`)

  return buffer
}

async function fetchGoogleFavicon(host: string): Promise<Buffer> {
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
  const { buffer } = await fetchBinaryWithRetry(url)
  return buffer
}

/**
 * Picks the host to query Google's s2 favicon service for. A bare github.com host returns
 * GitHub's generic favicon for every product whose `site` happens to be a github.com repo
 * URL (e.g. an OSS CLI with no marketing site), which collides across unrelated products.
 * Prefer a more specific, non-github host when one is available: docs, then the first
 * urls.extra entry, falling back to github.com only if nothing else is configured.
 */
export function pickFaviconHost(urls: Product['urls']): string {
  const siteHost = new URL(urls.site).host
  if (siteHost !== 'github.com') return siteHost
  if (urls.docs) return new URL(urls.docs).host
  if (urls.extra && urls.extra.length > 0) return new URL(urls.extra[0]).host
  return siteHost
}

async function saveLogo(categoryId: string, product: Product): Promise<void> {
  const dest = path.join(LOGOS_DIR, `${product.id}.png`)
  // crawlExclude (lib/schemas.ts): a robots-walled front door is never fetched, so the
  // site-icon path is skipped and only the Google favicon service (a third-party cache,
  // not the host) is queried.
  const walled = (product.crawlExclude ?? []).includes(product.urls.site)
  if (walled) {
    console.log(`logos: ${categoryId}/${product.id} site is crawlExcluded — Google favicon service only`)
  } else {
    try {
      const buffer = await fetchSiteIcon(product)
      writeLogo(dest, buffer)
      console.log(`logos: ${categoryId}/${product.id} saved from site icon`)
      return
    } catch (err) {
      console.warn(`logos: WARN ${categoryId}/${product.id} site icon failed (${(err as Error).message}), falling back to Google favicons`)
    }
  }

  try {
    const host = pickFaviconHost(product.urls)
    const buffer = await fetchGoogleFavicon(host)
    if (!isPngBytes(buffer)) throw new Error('Google favicon response is not actually PNG bytes (bad magic signature)')
    writeLogo(dest, buffer)
    console.log(`logos: ${categoryId}/${product.id} saved from Google favicon fallback`)
  } catch (err) {
    console.warn(`logos: WARN ${categoryId}/${product.id} Google favicon fallback also failed: ${(err as Error).message}`)
  }
}

export async function runLogos({ category, product }: { category?: string; product?: string }): Promise<void> {
  let matched = 0
  for (const cat of resolveCategories(category)) {
    const products = readJson(ProductSchema.array(), path.join(categoryDir(cat.id), 'products.json')).filter(
      (p) => !product || p.id === product,
    )
    matched += products.length
    for (const p of products) {
      try {
        await saveLogo(cat.id, p)
      } catch (err) {
        console.warn(`logos: WARN ${p.id} failed: ${(err as Error).message}`)
      }
    }
  }
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
}
