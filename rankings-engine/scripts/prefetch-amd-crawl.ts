// Hardware arena bring-up (2026-09): pre-populates the crawl cache for www.amd.com pages.
// www.amd.com resets connections for the pipeline's Ultrametric crawler UA (verified live at
// bring-up: HTTP/2 stream reset with the probe UA, HTTP 200 with a browser UA) — the same
// bot-wall class as Intel ARK at the experiments curation (see open-rankings/experiments/*.json notes).
// This writes the exact crawl-cache layout crawl.ts produces (<!-- source: url --> header +
// turndown markdown) so `pnpm engine extract` runs the standard path over real page content.
// Run BEFORE `pnpm engine extract` whenever the processors/gpus crawl cache is rebuilt
// (rankings-engine/cache/crawl/ is gitignored); `pnpm engine crawl` warns-and-skips these URLs.
//
// Usage: pnpm exec tsx rankings-engine/scripts/prefetch-amd-crawl.ts
import fs from 'node:fs'
import path from 'node:path'
import { htmlToMarkdown } from '../fetch-page'

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
const CACHE = path.join(__dirname, '..', 'cache', 'crawl')

const JOBS: Array<{ cat: string; pid: string; key: string; url: string }> = [
  { cat: 'processors', pid: 'amd-ryzen-ai-max-plus-395', key: 'site', url: 'https://www.amd.com/en/products/processors/laptop/ryzen/ai-300-series/amd-ryzen-ai-max-plus-395.html' },
  { cat: 'processors', pid: 'amd-ryzen-9-9950x3d', key: 'site', url: 'https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x3d.html' },
  { cat: 'processors', pid: 'amd-ryzen-9-9950x3d', key: 'docs', url: 'https://www.amd.com/en/products/processors/desktops/ryzen.html' },
  { cat: 'gpus', pid: 'amd-rx-9070-xt', key: 'site', url: 'https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9070xt.html' },
  { cat: 'gpus', pid: 'amd-mi355x', key: 'site', url: 'https://www.amd.com/en/products/accelerators/instinct/mi350/mi355x.html' },
]

async function main() {
  for (const job of JOBS) {
    const res = await fetch(job.url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${job.url}`)
    const markdown = htmlToMarkdown(await res.text())
    const dir = path.join(CACHE, job.cat, job.pid)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `${job.key}.md`), `<!-- source: ${job.url} -->\n\n${markdown}\n`)
    console.log(`prefetch: ${job.cat}/${job.pid}/${job.key} (${markdown.length} chars)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
