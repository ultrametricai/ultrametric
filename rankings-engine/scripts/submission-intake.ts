// Trusted checkout CLI. Issue data is never executed. Source fetching and publishing
// run in separate Actions jobs; only the publisher receives repository write access.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { z } from 'zod'
import { ProductSchema } from '../../lib/schemas'
import { ROOT, DATA_DIR, readCategories } from '../paths'
import { assess, normalizeIssue, submissionIdentity, REPOSITORY, type Catalog } from '../intake/submission'
import { ghApi, githubPublisher, parseReport, publish } from '../intake/publish'

export function eventIssue(event: unknown, enabled: string | undefined): number | null {
  if (enabled !== 'true') return null
  const parsed = z.object({ action: z.string(), repository: z.object({ full_name: z.string() }),
    issue: z.object({ number: z.number().int().positive(), state: z.string(), pull_request: z.unknown().optional(), labels: z.array(z.object({ name: z.string() })) }) }).parse(event)
  if (parsed.repository.full_name !== REPOSITORY || !['opened', 'edited', 'reopened', 'labeled', 'unlabeled'].includes(parsed.action)) return null
  const issue = parsed.issue
  if (issue.pull_request || issue.state !== 'open' || !issue.labels.some(l => l.name === 'product-request') || issue.labels.some(l => ['needs-founder', 'intake-paused'].includes(l.name))) return null
  return issue.number
}

export async function main(argv: string[]): Promise<void> {
  const issueArg = argv.indexOf('--issue')
  let number = issueArg < 0 ? '' : argv[issueArg + 1]
  if (argv.includes('--event')) {
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8'))
    const n = eventIssue(event, process.env.UM_SUBMISSION_INTAKE_ENABLED)
    if (n === null) { console.log('Issue event is not eligible or unattended intake is disabled.'); return }
    number = String(n)
  }
  if (!/^[1-9][0-9]{0,8}$/.test(number ?? '')) throw new Error('usage: submission-intake.ts --issue N [--prepare|--publish|--publish-prepared] or --event --prepare')
  if (argv.some(a => !['--issue', number, '--event', '--prepare', '--publish', '--publish-prepared'].includes(a))) throw new Error('unknown argument')
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  const output = path.join(ROOT, 'reports', 'submission-intake-local')
  const reportPath = path.join(output, `${number}.json`)
  fs.mkdirSync(output, { recursive: true })
  try {
    const publisher = githubPublisher(revision)
    let report
    if (argv.includes('--publish-prepared')) {
      if (fs.statSync(reportPath).size > 512 * 1024) throw new Error('prepared report exceeds size limit')
      report = parseReport(JSON.parse(fs.readFileSync(reportPath, 'utf8')))
      if (report.submission.issue !== Number(number) || report.baseRevision !== revision) throw new Error('prepared report does not match the issue and trusted checkout')
    } else {
      const categories = readCategories()
      const catalog: Catalog = { revision, categories,
        products: categories.flatMap(c => ProductSchema.array().parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, c.id, 'products.json'), 'utf8'))).map(product => ({ arena: c.id, product }))),
        roadmap: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), candidateProducts: z.array(z.string()) })).parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'arena-roadmap.json'), 'utf8'))) }
      const submission = normalizeIssue(ghApi(`repos/${REPOSITORY}/issues/${number}`))
      const reserved = argv.includes('--publish') || argv.includes('--prepare') ? await publisher.readBranch(submissionIdentity(submission).branch) : null
      // Carry the current checkout separately from the reserved revision. publish compares
      // both before opening a PR, including retries after a partial publication.
      report = reserved ? { ...reserved, submission, baseRevision: revision } : await assess(submission, catalog)
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
    }
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `issue=${number}\nrevision=${revision}\npublishable=${['draft-bringup', 'arena-review'].includes(report.route)}\n`)
    const result = argv.includes('--publish') || argv.includes('--publish-prepared') ? await publish(report, publisher) : { status: 'prepared', route: report.route, reason: report.reason }
    fs.writeFileSync(path.join(output, `${number}-result.json`), JSON.stringify(result, null, 2) + '\n')
    // Use a fixed summary with a JSON-escaped result; no issue text is rendered as HTML.
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Submission #${number}: ${report.route}. See the intake artifact for source receipts, disposition, and review requirements.\n`)
    console.log(JSON.stringify(result))
  } catch (error) {
    fs.writeFileSync(path.join(output, `${number}-error.json`), JSON.stringify({ issue: Number(number), status: 'blocked', error: String(error) }, null, 2) + '\n')
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Submission #${number} needs human review. See the intake error artifact.\n`)
    throw error
  }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(String(error)); process.exitCode = 1 })
