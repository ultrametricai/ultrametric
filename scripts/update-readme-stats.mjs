// `pnpm stats`: recomputes the open-rankings/products counts from open-rankings/ and rewrites the one
// generated block left in README.md, the compact arenas line between
// <!-- arenas:start --> / <!-- arenas:end -->. The README carries no other generated
// numbers (founder round 8 removed the stats line and badge row), so this is the only
// block the script maintains — never hand-edit the numbers inside it, run this script
// instead. Idempotent: running it twice with no data changes produces no diff.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, 'open-rankings')
const README_PATH = path.join(ROOT, 'README.md')

const ARENAS_START_MARKER = '<!-- arenas:start -->'
const ARENAS_END_MARKER = '<!-- arenas:end -->'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function computeStats() {
  const categories = readJson(path.join(DATA_DIR, 'categories.json'))
  let productCount = 0

  for (const category of categories) {
    const productsPath = path.join(DATA_DIR, category.id, 'products.json')
    if (fs.existsSync(productsPath)) {
      productCount += readJson(productsPath).length
    }
  }

  return {
    arenas: categories.length,
    products: productCount,
  }
}

// One computed line, not a table: the full per-market listing lives on the live index, and
// README prose never hand-writes a count (evidence doctrine).
function renderArenasBlock(stats) {
  return [
    ARENAS_START_MARKER,
    `**${stats.arenas} rankings** today, ${stats.products} products judged head to head — the full index is [ultrametric.ai/arenas](https://ultrametric.ai/arenas), and each ranking's data lives under [\`open-rankings/\`](open-rankings/).`,
    ARENAS_END_MARKER,
  ].join('\n')
}

function replaceBetween(text, startMarker, endMarker, block) {
  const startIdx = text.indexOf(startMarker)
  const endIdx = text.indexOf(endMarker)

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`update-readme-stats: could not find ${startMarker} / ${endMarker} markers in README.md`)
  }

  const before = text.slice(0, startIdx)
  const after = text.slice(endIdx + endMarker.length)
  return `${before}${block}${after}`
}

function updateReadme(stats) {
  const readme = fs.readFileSync(README_PATH, 'utf8')
  const next = replaceBetween(readme, ARENAS_START_MARKER, ARENAS_END_MARKER, renderArenasBlock(stats))

  if (next === readme) {
    console.log('update-readme-stats: README already up to date, no changes written')
    return
  }

  fs.writeFileSync(README_PATH, next)
  console.log(`update-readme-stats: wrote the arenas line (${stats.arenas} rankings, ${stats.products} products)`)
}

updateReadme(computeStats())
