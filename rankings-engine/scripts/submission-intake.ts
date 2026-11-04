// Trusted checkout CLI. Reads GitHub issue data, never commands from issue text.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { z } from 'zod'
import { ProductSchema } from '../../lib/schemas'
import { ROOT, DATA_DIR, readCategories } from '../paths'
import { assess, normalizeIssue, submissionIdentity, REPOSITORY, type Catalog } from '../intake/submission'
import { ghApi, githubPublisher, publish } from '../intake/publish'

export async function main(argv: string[]): Promise<void> {
  const issueArg = argv.indexOf('--issue')
  const number = issueArg < 0 ? '' : argv[issueArg + 1]
  if (!/^[1-9][0-9]{0,8}$/.test(number ?? '')) throw new Error('usage: submission-intake.ts --issue N [--publish]')
  if (argv.some(a => !['--issue', number, '--publish'].includes(a))) throw new Error('unknown argument')
  const categories = readCategories()
  const catalog: Catalog = { categories,
    products: categories.flatMap(c => ProductSchema.array().parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, c.id, 'products.json'), 'utf8'))).map(product => ({ arena: c.id, product }))),
    roadmap: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), candidateProducts: z.array(z.string()) })).parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'arena-roadmap.json'), 'utf8'))) }
  const output = path.join(ROOT, 'reports', 'submission-intake-local')
  fs.mkdirSync(output, { recursive: true })
  try {
    const submission = normalizeIssue(ghApi(`repos/${REPOSITORY}/issues/${number}`))
    const publisher = githubPublisher(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim())
    const reserved = argv.includes('--publish') ? await publisher.readBranch(submissionIdentity(submission).branch) : null
    // Resume immutable receipts after a partial publication, even if the source is now
    // temporarily unavailable. publish() checks both current and reserved issue revisions.
    const report = reserved ? { ...reserved, submission } : await assess(submission, catalog)
    fs.writeFileSync(path.join(output, `${number}.json`), JSON.stringify(report, null, 2) + '\n')
    const result = argv.includes('--publish') ? await publish(report, publisher) : { status: 'dry-run', route: report.route, reason: report.reason }
    fs.writeFileSync(path.join(output, `${number}-result.json`), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result))
  } catch (error) {
    fs.writeFileSync(path.join(output, `${number}-error.json`), JSON.stringify({ issue: Number(number), status: 'blocked', error: String(error) }, null, 2) + '\n')
    throw error
  }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(String(error)); process.exitCode = 1 })
