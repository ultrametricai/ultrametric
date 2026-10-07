// `pnpm stats`: recomputes the top-line arena/product/verdict counts from data/ and rewrites
// the marked block in README.md (<!-- stats:start -->...<!-- stats:end -->). Keeps the README
// from going stale as arenas/products/verdicts are added — never hand-edit the numbers inside
// the marked block, run this script instead. Idempotent: running it twice with no data changes
// produces no diff.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, 'data')
const README_PATH = path.join(ROOT, 'README.md')

const START_MARKER = '<!-- stats:start -->'
const END_MARKER = '<!-- stats:end -->'
const ARENAS_START_MARKER = '<!-- arenas:start -->'
const ARENAS_END_MARKER = '<!-- arenas:end -->'
const BADGES_START_MARKER = '<!-- stat-badges:start -->'
const BADGES_END_MARKER = '<!-- stat-badges:end -->'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function computeStats() {
  const categories = readJson(path.join(DATA_DIR, 'categories.json'))
  let productCount = 0
  let verdictCount = 0

  for (const category of categories) {
    const categoryDir = path.join(DATA_DIR, category.id)
    const productsPath = path.join(categoryDir, 'products.json')
    const verdictsPath = path.join(categoryDir, 'verdicts.json')

    if (fs.existsSync(productsPath)) {
      productCount += readJson(productsPath).length
    }
    if (fs.existsSync(verdictsPath)) {
      verdictCount += readJson(verdictsPath).length
    }
  }

  return {
    arenas: categories.length,
    products: productCount,
    verdicts: verdictCount,
  }
}

function renderArenasBlock() {
  const categories = readJson(path.join(DATA_DIR, 'categories.json'))
  const rows = []
  for (const category of categories) {
    const productsPath = path.join(DATA_DIR, category.id, 'products.json')
    if (!fs.existsSync(productsPath)) continue
    const ids = readJson(productsPath).map((p) => p.id)
    rows.push(`| ${category.name} (\`${category.id}\`) | ${ids.join(', ')} |`)
  }
  return [ARENAS_START_MARKER, '| Ranking | Products |', '|---|---|', ...rows, ARENAS_END_MARKER].join('\n')
}

// The count badges in the README's top badge row — static shields.io badges carrying the same
// generated numbers as the stats line, so the row can never drift from data/ (the repo has no
// public dynamic-badge source to hotlink while it's private).
function renderStatBadgesBlock(stats) {
  const site = 'https://ultrametric.ai'
  return [
    BADGES_START_MARKER,
    `[![rankings](https://img.shields.io/badge/rankings-${stats.arenas}-34d399)](${site})`,
    `[![products](https://img.shields.io/badge/products-${stats.products}-34d399)](${site}/everything)`,
    `[![judged verdicts](https://img.shields.io/badge/judged_verdicts-${stats.verdicts}-34d399)](${site}/methodology)`,
    BADGES_END_MARKER,
  ].join('\n')
}

function renderBlock(stats) {
  return [
    START_MARKER,
    `As of the last full pipeline run: **${stats.arenas} rankings, ${stats.products} products, ${stats.verdicts.toLocaleString('en-US')} judged verdicts.**`,
    END_MARKER,
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

  let next = replaceBetween(readme, START_MARKER, END_MARKER, renderBlock(stats))
  next = replaceBetween(next, ARENAS_START_MARKER, ARENAS_END_MARKER, renderArenasBlock())
  next = replaceBetween(next, BADGES_START_MARKER, BADGES_END_MARKER, renderStatBadgesBlock(stats))

  if (next === readme) {
    console.log('update-readme-stats: README already up to date, no changes written')
    return
  }

  fs.writeFileSync(README_PATH, next)
  console.log(
    `update-readme-stats: wrote ${stats.arenas} arenas, ${stats.products} products, ${stats.verdicts} verdicts`,
  )
}

const stats = computeStats()
updateReadme(stats)
