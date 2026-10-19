import fs from 'node:fs'
import path from 'node:path'
import { ProductSchema, type Product } from '../../lib/schemas'
import { fetchWithRetry, htmlToMarkdown } from '../fetch-page'
import { CACHE_DIR, categoryDir, readJson, resolveCategories } from '../paths'

function githubReadmeUrl(githubUrl: string): string {
  const [, owner, repo] = new URL(githubUrl).pathname.split('/')
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`
}

// Raw text/markdown sources (llms.txt, Mintlify-style .md page mirrors, OpenAPI specs) must
// NOT go through the HTML→markdown converter: turndown strips iframes and chokes on the JSX
// component exports Mintlify embeds in its .md mirrors, silently truncating pages to a few
// hundred chars (caught live on rive.app/docs/*.md at the 2026-09-14 bring-up).
function isRawTextUrl(url: string): boolean {
  try {
    return /\.(md|txt|ya?ml|json)$/i.test(new URL(url).pathname)
  } catch {
    return false
  }
}

async function crawlProduct(categoryId: string, product: Product): Promise<number> {
  const dir = path.join(CACHE_DIR, 'crawl', categoryId, product.id)
  fs.mkdirSync(dir, { recursive: true })
  const { extra, ...singleUrls } = product.urls
  const sources: [string, string][] = [
    ...(Object.entries(singleUrls) as [string, string][]),
    ...(extra ?? []).map((url, i): [string, string] => [`extra-${i}`, url]),
  ]
  // Robots-walled front doors are never fetched (see ProductSchema.crawlExclude): the wall is
  // recorded once as dated probe evidence, and the crawl stage honors it mechanically.
  const excluded = new Set(product.crawlExclude ?? [])
  let saved = 0
  for (const [key, url] of sources) {
    if (excluded.has(url)) {
      console.log(`crawl: ${categoryId}/${product.id}/${key} SKIPPED (crawlExclude — robots-walled, recorded as probe evidence)`)
      continue
    }
    try {
      const raw = await fetchWithRetry(key === 'github' ? githubReadmeUrl(url) : url)
      const markdown = key === 'github' || isRawTextUrl(url) ? raw : htmlToMarkdown(raw)
      fs.writeFileSync(path.join(dir, `${key}.md`), `<!-- source: ${url} -->\n\n${markdown}\n`)
      console.log(`crawl: ${categoryId}/${product.id}/${key} (${markdown.length} chars)`)
      saved++
    } catch (err) {
      console.warn(`crawl: WARN ${categoryId}/${product.id}/${key} failed: ${(err as Error).message}`)
    }
  }
  return saved
}

export async function runCrawl({ category, product }: { category?: string; product?: string }): Promise<void> {
  let matched = 0
  for (const cat of resolveCategories(category)) {
    const products = readJson(ProductSchema.array(), path.join(categoryDir(cat.id), 'products.json')).filter(
      (p) => !product || p.id === product,
    )
    matched += products.length
    for (const p of products) {
      const urls = [p.urls.site, p.urls.docs, p.urls.changelog, p.urls.github, ...(p.urls.extra ?? [])]
      const excluded = new Set(p.crawlExclude ?? [])
      if (urls.filter((u): u is string => !!u).every((u) => excluded.has(u))) {
        // Fully robots-walled product (every corpus URL excluded): nothing to crawl is the
        // recorded finding, not an error — its evidence pack is wall probes.
        console.log(`crawl: ${cat.id}/${p.id} fully crawlExcluded — nothing fetched`)
        continue
      }
      const saved = await crawlProduct(cat.id, p)
      if (saved === 0) throw new Error(`crawl: no pages saved for ${cat.id}/${p.id}`)
    }
  }
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
}
