// Regenerates the Markdown page set under open-processes/pages/ (one page per canonical
// record in open-processes/) and the index block in open-processes/README.md, between the
// markers lib/processPages.ts defines. The prose around the README block is authored; only
// the block and the pages are machine-owned. Drift gate: __tests__/process-pages.test.ts
// (same pattern as scripts/generate-situations-md.ts and the step-rankings byte gate).
//
// Usage: pnpm exec tsx scripts/generate-process-pages.ts
import fs from 'node:fs'
import path from 'node:path'
import {
  buildPageContext, INDEX_END, INDEX_START, PAGES_DIR, PROCESSES_README, renderAllPages,
  renderPagesIndex,
} from '../lib/processPages'

const root = process.cwd()
const dir = path.join(root, PAGES_DIR)
fs.mkdirSync(dir, { recursive: true })

const pages = renderAllPages(root)
for (const stale of fs.readdirSync(dir).filter((n) => n.endsWith('.md') && !pages.has(n))) {
  fs.unlinkSync(path.join(dir, stale))
  console.log(`process pages: removed stale ${PAGES_DIR}/${stale}`)
}
for (const [name, content] of pages) {
  fs.writeFileSync(path.join(dir, name), content)
}

const readmePath = path.join(root, PROCESSES_README)
const readme = fs.readFileSync(readmePath, 'utf8')
const start = readme.indexOf(INDEX_START)
const end = readme.indexOf(INDEX_END)
if (start === -1 || end === -1 || end < start) {
  throw new Error(`${PROCESSES_README}: index markers not found — restore them before regenerating`)
}
const block = renderPagesIndex(buildPageContext(root).sources)
fs.writeFileSync(readmePath, readme.slice(0, start) + block + readme.slice(end + INDEX_END.length))

console.log(`process pages: wrote ${pages.size} pages into ${PAGES_DIR} and the index block in ${PROCESSES_README}`)
