import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { type Evidence, EvidenceSchema, ProductSchema, StorySchema } from '../lib/schemas'
import { fetchWithRetry, htmlToMarkdown } from './fetch-page'
import { categoryDir, readJson, resolveCategories, ROOT, writeJson } from './paths'
import { writeStepRankings } from './scripts/generate-step-rankings'
import { writeStoryGraph } from './scripts/generate-story-graph'
import { writeVendorReviews } from './scripts/generate-vendor-reviews'
import { runDerive } from './stages/derive'
import { runJudge } from './stages/judge'
import { REPO as DEFAULT_REPO } from '../lib/site'

const REPO = process.env.GITHUB_REPOSITORY ?? DEFAULT_REPO

// Story provenance note: this module currently only ever appends Evidence items (see
// buildContestEvidence below) — it never adds or edits a Story, so there is no story-side
// origin to stamp {kind:'contest'} on yet. If a future contest flow starts minting new
// stories (as opposed to evidence for existing ones), stamp them with
// `{ kind: 'contest', recordedAt: new Date().toISOString() }` (see lib/schemas.ts's
// StoryOriginSchema) at the point they're written, the same way normalize.ts's
// assembleTaxonomy stamps 'normalized'/'canonical' origin today.

export interface ParsedContestIssue {
  category: string
  productId: string
  storyId: string
  urls: string[]
}

function stripHtmlComments(body: string): string {
  return body.replace(/<!--[\s\S]*?-->/g, '')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Grabs everything after a "**Heading**" marker up to the next "**" marker (or end of
// string). Tolerant of the exact whitespace/CRLF the GitHub issue form UI produces.
function extractSection(body: string, heading: string): string | null {
  // No `\s*` between the heading marker and the capture group: a greedy `\s*` there would
  // swallow the blank-line separator the lookahead needs to find the *next* heading,
  // silently merging an empty section into whatever follows it. Leading/trailing whitespace
  // in the capture is stripped by trim() instead.
  const re = new RegExp(`\\*\\*${escapeRegExp(heading)}\\*\\*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, 'i')
  const match = body.match(re)
  return match ? match[1].trim() : null
}

function firstLine(section: string | null): string {
  if (!section) return ''
  return (section.split('\n')[0] ?? '').trim()
}

// Tolerant parser for the "Contest a verdict" issue template body
// (.github/ISSUE_TEMPLATE/contest-verdict.md). Strips leftover HTML comments (contributors
// sometimes leave the template's instructional comments in place around the sections they
// didn't need to touch), then reads each labeled section by name. Returns null if any of the
// three required identifying fields (category/product/story id) is missing.
export function parseIssueBody(rawBody: string): ParsedContestIssue | null {
  const body = stripHtmlComments(rawBody)
  const category = firstLine(extractSection(body, 'Category'))
  const productId = firstLine(extractSection(body, 'Product'))
  const storyId = firstLine(extractSection(body, 'Story id'))
  const evidenceSection = extractSection(body, 'Evidence URLs') ?? ''
  const urls = [...evidenceSection.matchAll(/https?:\/\/[^\s)\]>]+/g)].map((m) => m[0])

  if (!category || !productId || !storyId) return null
  return { category, productId, storyId, urls }
}

// Ids for evidence items minted from a contest issue's URLs — namespaced by issue number so
// they can never collide with ids the pipeline's own stages mint (`{product}-docs-N`,
// `{product}-comm-N`, `{product}-probe-N`) or with a previous contest issue's items.
export function contestEvidenceIds(productId: string, issueNumber: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${productId}-contest-${issueNumber}-${i + 1}`)
}

interface GithubIssue {
  number: number
  title: string
  body: string | null
}

async function fetchIssue(issueNumber: string): Promise<GithubIssue> {
  const token = process.env.GITHUB_TOKEN
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues/${issueNumber}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`GitHub API returned HTTP ${res.status} fetching issue #${issueNumber}`)
  return (await res.json()) as GithubIssue
}

// Fetches each contested URL and turns it into a claimed-docs-tier evidence item (the URL is
// user-submitted supporting material, not necessarily vendor docs, but claimed-docs is the
// lowest/most-generic tier and is always a safe default for un-triaged evidence — a
// maintainer reviewing the resulting PR can retier it). URLs that fail to fetch are skipped
// with a warning rather than failing the whole run.
async function buildContestEvidence(urls: string[], productId: string, issueNumber: string): Promise<Evidence[]> {
  const ids = contestEvidenceIds(productId, issueNumber, urls.length)
  const now = new Date().toISOString()
  const items: Evidence[] = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    try {
      const html = await fetchWithRetry(url)
      const text = htmlToMarkdown(html).trim().replace(/\s+/g, ' ')
      const excerpt = text.slice(0, 400) || `Contest evidence URL for issue #${issueNumber} (page had no extractable text)`
      items.push({ id: ids[i], tier: 'claimed-docs', url, excerpt, fetchedAt: now })
    } catch (err) {
      console.warn(`contest-check: WARN failed to fetch ${url}: ${(err as Error).message}`)
    }
  }
  return items
}

function git(args: string[]): void {
  execFileSync('git', args, { cwd: ROOT, stdio: 'inherit' })
}

function writeOutput(key: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT
  if (!outputFile) return
  fs.appendFileSync(outputFile, `${key}=${value.replace(/\n/g, ' ')}\n`)
}

// Full automated flow for one contest issue: fetch it, parse its body, fetch the cited
// evidence URLs, append them to the product's evidence file, re-judge and re-derive that
// category, then open a PR referencing the issue. Never touches any data if parsing or
// validation fails. Not run in this task — see the module doc comment in
// .github/workflows/contest-check.yml for the dormant-until-secret-configured gate.
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const issueFlag = args.indexOf('--issue')
  const issueNumber = issueFlag >= 0 ? args[issueFlag + 1] : undefined
  if (!issueNumber) {
    console.error('usage: pnpm tsx rankings-engine/contest-check.ts --issue <number>')
    process.exit(1)
  }

  const issue = await fetchIssue(issueNumber)
  const parsed = parseIssueBody(issue.body ?? '')
  if (!parsed) {
    throw new Error(
      `issue #${issueNumber}: could not find Category/Product/Story id sections in the issue body — ` +
        `does it follow .github/ISSUE_TEMPLATE/contest-verdict.md?`,
    )
  }

  const { category, productId, storyId, urls } = parsed
  resolveCategories(category) // throws "unknown category: ..." if invalid
  const dataDir = categoryDir(category)
  const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
  if (!products.some((p) => p.id === productId)) {
    throw new Error(`issue #${issueNumber}: unknown product "${productId}" in category "${category}"`)
  }
  const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
  if (!stories.some((s) => s.id === storyId)) {
    throw new Error(`issue #${issueNumber}: unknown story id "${storyId}" in category "${category}"`)
  }
  if (urls.length === 0) {
    throw new Error(`issue #${issueNumber}: no evidence URLs found in the "Evidence URLs" section`)
  }

  const newEvidence = await buildContestEvidence(urls, productId, issueNumber)
  if (newEvidence.length === 0) {
    throw new Error(`issue #${issueNumber}: none of the ${urls.length} evidence URL(s) could be fetched`)
  }

  const evidenceFile = path.join(dataDir, 'evidence', `${productId}.json`)
  const existing = readJson(EvidenceSchema.array(), evidenceFile)
  writeJson(evidenceFile, [...existing, ...newEvidence])

  await runJudge({ category, product: productId })
  await runDerive({ category })
  // Derive restamped rankings.generatedAt, which feeds every review's tested_on/recheck_due —
  // regenerate the interchange records so the PR passes the drift test
  // (rankings-engine/__tests__/vendorReviews.test.ts).
  writeVendorReviews()
  // The judge pass can flip story→product verdicts, an input of open-rankings/graph.json — regenerate
  // the graph so the PR passes the byte-identity tests (lib/__tests__/storyProcessGraph.test.ts
  // and shared-canonical-identity.test.ts).
  writeStoryGraph()
  // Verdicts are also an input of open-rankings/step-rankings.json (per-step vendor scores) —
  // regenerate so the PR passes its drift gates (lib/__tests__/stepRankings.test.ts and
  // pnpm recompute-check).
  writeStepRankings()

  const branch = `contest-${issueNumber}`
  git(['checkout', '-b', branch])
  git([
    'add',
    path.relative(ROOT, evidenceFile),
    path.relative(ROOT, path.join(dataDir, 'verdicts.json')),
    path.relative(ROOT, path.join(dataDir, 'rankings.json')),
    'open-rankings/graph.json',
    'open-rankings/step-rankings.json',
    'open-rankings/reviews/generated',
  ])
  git([
    '-c',
    'user.name=init-bot',
    '-c',
    'user.email=actions@github.com',
    'commit',
    '-m',
    `contest: apply issue #${issueNumber} evidence to ${category}/${productId}`,
  ])
  git(['push', '-u', 'origin', branch])

  const prBody = [
    `Automated contest resolution for #${issueNumber}.`,
    '',
    `Added ${newEvidence.length} evidence item(s) to \`open-rankings/${category}/evidence/${productId}.json\` from the issue's ` +
      `Evidence URLs, then re-ran \`judge --category ${category} --product ${productId}\` and ` +
      `\`derive --category ${category}\`.`,
    '',
    `Closes #${issueNumber}.`,
  ].join('\n')
  const prOutput = execFileSync(
    'gh',
    [
      'pr',
      'create',
      '--title',
      `contest: ${category}/${productId} (#${issueNumber})`,
      '--body',
      prBody,
      '--head',
      branch,
      '--base',
      'main',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  )
  const prUrl = prOutput.trim().split('\n').pop() ?? ''
  console.log(`contest-check: opened PR ${prUrl}`)
  writeOutput('pr_url', prUrl)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    writeOutput('failure_reason', String((err as Error)?.message ?? err))
    process.exit(1)
  })
}
