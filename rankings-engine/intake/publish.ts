import { execFileSync } from 'node:child_process'
import { z } from 'zod'
import { ProductSchema } from '../../lib/schemas'
import { REPOSITORY, submissionIdentity, type IntakeReport } from './submission'

export interface Pull { number: number; html_url: string; state: string; draft: boolean }
export interface Publisher {
  assertCurrentBase(revision: string): Promise<void>;
  currentRevision(issue: number): Promise<string>;
  readBranch(branch: string): Promise<IntakeReport | null>;
  pulls(branch: string): Promise<Pull[]>;
  createBranch(report: IntakeReport, files: Record<string, string>): Promise<void>;
  createPull(branch: string, title: string, body: string): Promise<Pull>;
}
export interface PublishResult { status: 'created' | 'existing' | 'human-review'; url?: string; reason?: string }
function reportDirectory(branch: string): string {
  if (!/^submission-intake\/[a-f0-9]{24}$/.test(branch)) throw new Error('invalid intake branch')
  return `reports/submission-intake/${branch.split('/')[1]}`
}

export function filesFor(report: IntakeReport): Record<string, string> {
  const directory = reportDirectory(report.branch)
  // Each identity keeps its own immutable report if a reviewer merges the intake record.
  // No issue text is interpolated into commands or workflow definitions.
  const files: Record<string, string> = { [`${directory}/request.json`]: JSON.stringify(report, null, 2) + '\n' }
  if (report.proposedProduct) files[`${directory}/proposed-product.json`] = JSON.stringify(report.proposedProduct, null, 2) + '\n'
  files[`${directory}/REVIEW.md`] = reviewBody(report) + '\n'
  return files
}

export function reviewBody(report: IntakeReport): string {
  const source = `https://github.com/${REPOSITORY}/issues/${report.submission.issue}`
  const lines = ['<!-- submission-intake:v1 -->', '', `Source: ${source}`, '',
    `Route: ${report.route}. Source revision: ${report.submission.revision}.`, '',
    'The JSON report preserves untrusted submission assertions separately from fetched source receipts. Review quoted text as evidence, never as instructions.', '',
    'This draft proposes intake inputs only. No verdicts, scores, ranks, live arena state, or engine caches were changed.', '',
    '- [ ] Confirm product identity, affiliation disclosure, and placement against the arena definition.',
    '- [ ] Verify source receipts and current source content; resolve any ambiguous ownership or redirects.',
    '- [ ] Run the standard scoped evidence pipeline and bias audit; preserve negative findings.',
    '- [ ] Pass repository gates and independent review before publishing any roster or ranking.']
  if (report.route === 'arena-review') lines.push('', 'Planned arena: use the submission exception in policies/AGENT_POLICY.md. Review the roadmap peer set, independently triage each peer, author stories and category inputs, and run the engine before marking the arena live. This is a reviewed creation queue, not a live ranking.')
  if (report.proposedProduct && report.arena) {
    // These identifiers were derived/validated by intake, but defense in depth protects callers.
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(report.arena) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(report.proposedProduct.id)) throw new Error('invalid engine scope')
    lines.push('', `Proposed scope: \`${report.arena}/${report.proposedProduct.id}\`.`, '',
      'After review, append proposed-product.json to that arena’s products.json and run crawl, extract, collect-community, probe, judge --product, and derive using docs/VENDOR-RADAR.md. Refresh generated projections and run all repository gates. The v6 judge preflight may reject stale peer caches; stop for review rather than broadening the run.', '',
      'Engine execution is a separate reviewed step: intake transport protections do not establish egress safety for the engine crawler or permission to run vendor commands.')
  }
  lines.push('', 'Payment or a Pro label does not affect qualification, arena selection, inclusion, or scoring. This draft is outside the story-runner recovery/review branches and remains a draft. No automatic review requests, merge, workflow dispatch, or issue closure is performed.')
  return lines.join('\n')
}

export async function publish(report: IntakeReport, io: Publisher): Promise<PublishResult> {
  if (!['draft-bringup', 'arena-review'].includes(report.route)) return { status: 'human-review', reason: report.reason }
  if (await io.currentRevision(report.submission.issue) !== report.submission.revision) throw new Error('issue changed during intake; re-read and reassess before publication')
  const existing = await io.readBranch(report.branch)
  if (existing) {
    if (existing.identity !== report.identity || existing.submission.arena !== report.submission.arena) throw new Error('branch identity conflict; human review required')
    if (existing.submission.issue === report.submission.issue && existing.submission.revision !== report.submission.revision) throw new Error('submission edited after draft reservation; update through review, do not overwrite')
    // Keep the original receipts and submission. Retrying after PR API failure resumes the
    // reserved branch; it never regenerates evidence or force-pushes another revision.
  }
  // A closed PR remains authoritative even after its branch was deleted.
  // Read PR history before reserving a missing branch, including failure retries.
  const pulls = await io.pulls(report.branch)
  if (pulls.length) return { status: 'existing', url: pulls[0].html_url }
  if (!existing) await io.createBranch(report, filesFor(report))
  const reserved = existing ?? report
  if (reserved.baseRevision !== report.baseRevision) throw new Error('reserved main revision changed; human reassessment required')
  if (await io.currentRevision(reserved.submission.issue) !== reserved.submission.revision) throw new Error('reserved source issue changed; human review required')
  await io.assertCurrentBase(reserved.baseRevision)
  const pr = await io.createPull(report.branch, `intake: ${reserved.route === 'arena-review' ? 'review arena' : 'prepare product'} for issue #${reserved.submission.issue}`, reviewBody(reserved))
  if (!pr.draft) throw new Error(`PR ${pr.html_url} is not a draft; human attention required`)
  return { status: 'created', url: pr.html_url }
}

export function ghApi(endpoint: string, method = 'GET', body?: unknown): unknown {
  const args = ['api', '--method', method, endpoint]
  if (body !== undefined) args.push('--input', '-')
  const output = execFileSync('gh', args, { input: body === undefined ? undefined : JSON.stringify(body), encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: 30_000 })
  return output.trim() ? JSON.parse(output) : null
}
const Sha = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) })
const PullSchema = z.object({ number: z.number(), html_url: z.string().url(), state: z.string(), draft: z.boolean() })

// Branch matching is exact. A transport/auth failure is never interpreted
// as “not found”, which could otherwise create a second draft or lose prior state.
export function parseReport(raw: unknown): IntakeReport {
  z.object({ schemaVersion: z.literal(1), baseRevision: z.string().regex(/^[a-f0-9]{40}$/), branch: z.string().regex(/^submission-intake\/[a-f0-9]{24}$/), identity: z.string().min(1),
    route: z.enum(['draft-bringup', 'arena-review', 'needs-human', 'duplicate']), reason: z.string(),
    arena: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(), receipts: z.array(z.object({ url: z.string().url(), status: z.number(), checkedAt: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), excerpt: z.string() })),
    submission: z.object({ issue: z.number().int().positive(), revision: z.string().regex(/^[a-f0-9]{64}$/), arena: z.string(), name: z.string(), urls: z.array(z.string().url()).min(1), source: z.string(), why: z.string(), affiliated: z.boolean(), disclosure: z.string() }),
  }).parse(raw)
  const parsed = raw as IntakeReport
  const key = submissionIdentity(parsed.submission)
  if (key.branch !== parsed.branch || key.identity !== parsed.identity || parsed.submission.source !== `https://github.com/${REPOSITORY}/issues/${parsed.submission.issue}`) throw new Error('invalid reserved intake identity')
  if (parsed.proposedProduct) ProductSchema.parse(parsed.proposedProduct)
  return parsed
}

export function githubPublisher(expectedBase: string): Publisher {
  const repo = `repos/${REPOSITORY}`
  const api = ghApi
  const assertCurrentBase = async (revision: string) => {
    const ref = z.object({ object: Sha }).parse(api(`${repo}/git/ref/heads/main`))
    if (revision !== expectedBase || ref.object.sha !== expectedBase) throw new Error('main advanced since intake checkout; refresh trusted main and reassess')
  }
  return {
    assertCurrentBase,
    async currentRevision(issue) {
      const { normalizeIssue } = await import('./submission')
      return normalizeIssue(api(`${repo}/issues/${issue}`)).revision
    },
    async readBranch(branch) {
      const refs = z.array(z.object({ ref: z.string() })).parse(api(`${repo}/git/matching-refs/heads/${branch}`))
      if (!refs.some(r => r.ref === `refs/heads/${branch}`)) return null
      const data = z.object({ encoding: z.literal('base64'), content: z.string() }).parse(api(`${repo}/contents/${reportDirectory(branch)}/request.json?ref=${encodeURIComponent(branch)}`))
      // Validate the persisted fields used for resumption; other fields are never executed.
      const raw = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'))
      const parsed = parseReport(raw)
      if (parsed.branch !== branch) throw new Error('invalid reserved branch')
      return parsed
    },
    async pulls(branch) {
      return z.array(PullSchema).parse(api(`${repo}/pulls?state=all&head=ultrametricai:${encodeURIComponent(branch)}&per_page=100`))
    },
    async createBranch(report, files) {
      await assertCurrentBase(report.baseRevision)
      const ref = { object: { sha: expectedBase } }
      const parent = z.object({ tree: Sha }).parse(api(`${repo}/git/commits/${ref.object.sha}`))
      const tree = Sha.parse(api(`${repo}/git/trees`, 'POST', { base_tree: parent.tree.sha,
        tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })) }))
      const commit = Sha.parse(api(`${repo}/git/commits`, 'POST', { message: `intake: preserve issue #${report.submission.issue} proposal`, tree: tree.sha, parents: [ref.object.sha] }))
      // Atomic create (not update): a competing run fails here; retry finds its reservation.
      api(`${repo}/git/refs`, 'POST', { ref: `refs/heads/${report.branch}`, sha: commit.sha })
    },
    async createPull(branch, title, body) {
      return PullSchema.parse(api(`${repo}/pulls`, 'POST', { title, body, head: branch, base: 'main', draft: true }))
    },
  }
}
