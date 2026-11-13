#!/usr/bin/env node
// Run only from trusted main. PR metadata is data; no PR code or dependencies run here.
import { execFileSync } from 'node:child_process'
import { appendFileSync, realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const REPO = 'ultrametricai/ultrametric'
export const REPO_ID = 1347853946
export const AUTHORS = new Map([[666306, 'judegomila'], [10182232, 'tylerlastovich']])
export const HOLDS = new Set(['automerge-hold', 'do-not-merge', 'hold', 'manual-merge', 'maintainer-manual-merge'])
const ACTIONS = 15368
const CHECKS = new Map([['ci', ACTIONS], ['validation', ACTIONS], ['Greptile Review', 867647]])
const GREPTILE = new Set(['greptile-apps', 'greptile-apps[bot]', 'greptileai'])
const CI = '.github/workflows/ci.yml'
const FINDINGS = '.github/workflows/review-findings.yml'
const SHA = /^[a-f0-9]{40}$/
const newest = (items) => items.reduce((a, b) => !a || b.id > a.id ? b : a, null)

export function config(env = process.env) {
  const notBefore = env.AUTHOR_AUTOMERGE_NOT_BEFORE
  if (env.GITHUB_REPOSITORY !== REPO) throw new Error('unexpected repository')
  if (env.AUTHOR_AUTOMERGE_ENABLED !== 'true') return null
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(notBefore ?? '') ||
      !Number.isFinite(Date.parse(notBefore)) || new Date(notBefore).toISOString() !== notBefore.replace('Z', '.000Z')) {
    throw new Error('AUTHOR_AUTOMERGE_NOT_BEFORE must be an explicit UTC activation timestamp')
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\[bot\]$/.test(env.AUTOMERGE_BOT_LOGIN ?? '') ||
      env.AUTOMERGE_BOT_LOGIN === 'github-actions[bot]') throw new Error('a dedicated AUTOMERGE_BOT_LOGIN is required')
  const canary = env.AUTHOR_AUTOMERGE_CANARY_PR || ''
  if (canary && !/^[1-9]\d*$/.test(canary)) throw new Error('invalid canary PR number')
  return { notBefore, bot: env.AUTOMERGE_BOT_LOGIN, canary: canary ? Number(canary) : null }
}

export function candidateReasons(pr, settings) {
  const reasons = []
  // Both the immutable account ID and current login must agree; a rename needs review.
  if (pr.user?.type !== 'User' || !AUTHORS.has(pr.user?.id) || AUTHORS.get(pr.user.id) !== pr.user.login) reasons.push('author is outside the two-account whitelist')
  if (pr.state !== 'open' || pr.draft !== false) reasons.push('PR must be open and ready')
  if (pr.base?.ref !== 'main' || pr.base?.repo?.id !== REPO_ID || pr.base?.repo?.full_name !== REPO ||
      pr.head?.repo?.id !== REPO_ID || pr.head?.repo?.full_name !== REPO) reasons.push('only same-repository PRs into main qualify')
  if (!SHA.test(pr.head?.sha ?? '')) reasons.push('head SHA is missing or invalid')
  if (!(Date.parse(pr.created_at) > Date.parse(settings.notBefore))) reasons.push('PR predates activation')
  if (settings.canary && settings.canary !== pr.number) reasons.push('outside the configured canary PR')
  if (!Array.isArray(pr.labels)) reasons.push('labels unavailable')
  else if (pr.labels.some((label) => HOLDS.has(label.name?.toLowerCase()))) reasons.push('manual hold label present')
  if (pr.auto_merge !== null) reasons.push('existing native auto-merge is managed separately')
  return reasons
}

function manualFile(path) {
  return path.startsWith('.github/') || path.startsWith('scripts/author-automerge.') ||
    ['scripts/refresh_policy.py', 'scripts/refresh_main_ci.py', 'scripts/refresh_update.py', 'scripts/refresh-automerge.py', 'scripts/refresh-review.py', 'scripts/refresh-repair.py'].includes(path) ||
    path.startsWith('scripts/config/') || path === 'scripts/docs-fast-path.mjs'
}

function runNumber(url) {
  const match = new RegExp(`^https://github\\.com/${REPO}/actions/runs/(\\d+)(?:/job/\\d+)?$`).exec(url ?? '')
  return match ? Number(match[1]) : null
}

export function checkReasons({ pr, checks, statuses, runs, workflows, rules, review }) {
  const reasons = []
  const head = pr.head.sha
  const required = rules.filter((rule) => rule.type === 'required_status_checks')
    .flatMap((rule) => rule.parameters?.required_status_checks ?? [])
  for (const [name, app] of [...CHECKS, ['review-findings', ACTIONS]]) {
    if (!required.some((check) => check.context === name && check.integration_id === app)) reasons.push(`required protection missing: ${name}`)
  }
  const selected = new Map()
  for (const [name, app] of CHECKS) {
    const check = newest(checks.filter((item) => item.name === name && item.app?.id === app))
    selected.set(name, check)
    if (!check || !Number.isSafeInteger(check.id) || check.head_sha !== head || check.status !== 'completed' || check.conclusion !== 'success') reasons.push(`${name} has no successful check on this head from its expected App`)
    if (checks.some((item) => item.name === name && item.app?.id === app && item.status !== 'completed')) reasons.push(`${name} still has an active check`)
  }
  const ciId = runNumber(selected.get('ci')?.details_url)
  if (!ciId || ciId !== runNumber(selected.get('validation')?.details_url)) reasons.push('CI checks must belong to one workflow run')
  const ciRun = runs.get(ciId)
  const ciWorkflow = workflows.get(CI)
  if (!ciWorkflow || ciWorkflow.state !== 'active' || ciWorkflow.path !== CI || !ciRun ||
      ciRun.workflow_id !== ciWorkflow.id || ciRun.path !== CI || ciRun.id !== ciId ||
      ciRun.repository?.id !== REPO_ID || ciRun.event !== 'pull_request' || ciRun.head_sha !== head ||
      ciRun.status !== 'completed' || ciRun.conclusion !== 'success' || !Number.isSafeInteger(ciRun.check_suite_id) ||
      !ciRun.pull_requests?.some((item) => item.number === pr.number && item.head?.sha === head) ||
      ['ci', 'validation'].some((name) => selected.get(name)?.check_suite?.id !== ciRun.check_suite_id)) reasons.push('CI run is not a successful registered run for this PR head')

  const status = newest(statuses.filter((item) => item.context === 'review-findings'))
  const statusRun = runs.get(runNumber(status?.target_url))
  const statusWorkflow = workflows.get(statusRun?.path)
  if (!status || !Number.isSafeInteger(status.id) || status.state !== 'success' || status.creator?.login !== 'github-actions[bot]' || status.creator?.type !== 'Bot' ||
      !statusRun || ![CI, FINDINGS].includes(statusRun.path) || !statusWorkflow || statusWorkflow.state !== 'active' ||
      statusRun.workflow_id !== statusWorkflow.id || statusRun.repository?.id !== REPO_ID ||
      statusRun.status !== 'completed' || statusRun.conclusion !== 'success') reasons.push('review-findings has no successful trusted workflow status')
  if (review.head !== head || review.blocked !== false) reasons.push('current-head review metadata is missing or has unresolved Greptile findings')
  if (review.changesRequested !== false) reasons.push('human or Greptile review approval state is blocked or unknown')
  return reasons
}

export function eligibility(snapshot, settings) {
  const { pr, files } = snapshot
  const reasons = candidateReasons(pr, settings)
  if (pr.mergeable !== true || pr.mergeable_state !== 'clean') reasons.push('mergeability must be known and clean')
  if (!Number.isSafeInteger(pr.changed_files) || pr.changed_files < 1 || files.length !== pr.changed_files ||
      files.some((file) => typeof file.filename !== 'string' || !file.filename)) reasons.push('changed-file list is incomplete')
  if (files.some((file) => [file.filename, file.previous_filename].filter(Boolean).some(manualFile))) reasons.push('workflow or merge-control changes require manual merge')
  reasons.push(...checkReasons(snapshot))
  return reasons
}

function gh(args, { token = process.env.GH_TOKEN, input } = {}) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GH_TOKEN: token }, stdio: ['pipe', 'pipe', 'pipe'] }))
}

export function client(call = gh) {
  return {
    get: (path) => call(['api', `repos/${REPO}/${path}`]),
    pages: (path) => call(['api', '--paginate', '--slurp', `repos/${REPO}/${path}`]),
    query: (query, variables) => {
      const data = call(['api', 'graphql', '--input', '-'], { input: JSON.stringify({ query, variables }) })
      if (data.errors?.length) throw new Error('review metadata query failed')
      return data.data.repository.pullRequest
    },
    merge: (number, sha, token) => call(['api', '--method', 'PUT', `repos/${REPO}/pulls/${number}/merge`, '--input', '-'],
      { token, input: JSON.stringify({ sha, merge_method: 'merge' }) }),
  }
}

export function readReview(api, number, head) {
  const query = `query($number:Int!,$cursor:String) {
    repository(owner:"ultrametricai",name:"ultrametric") { pullRequest(number:$number) {
      headRefOid reviewThreads(first:100,after:$cursor) { pageInfo {hasNextPage endCursor}
        nodes {isResolved comments(first:1) {nodes {author {login}}}}}
    }} }`
  let cursor = null
  let blocked = false
  const cursors = new Set()
  for (;;) {
    const pr = api.query(query, { number, cursor })
    if (pr.headRefOid !== head) throw new Error('head changed during review pagination')
    for (const thread of pr.reviewThreads.nodes) {
      if (typeof thread.isResolved !== 'boolean' || !thread.comments?.nodes?.length) throw new Error('incomplete review thread')
      if (!thread.isResolved && thread.comments.nodes.some((comment) => !comment.author?.login)) throw new Error('unresolved review author unavailable')
      if (!thread.isResolved && thread.comments.nodes.some((comment) => GREPTILE.has(comment.author?.login))) blocked = true
    }
    if (pr.reviewThreads.pageInfo.hasNextPage === false) break
    cursor = pr.reviewThreads.pageInfo.endCursor
    if (!cursor || cursors.has(cursor)) throw new Error('incomplete review pagination')
    cursors.add(cursor)
  }
  const reviews = api.pages(`pulls/${number}/reviews?per_page=100`).flat()
  const latest = new Map()
  for (const review of [...reviews].sort((a, b) => a.id - b.id)) {
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state) &&
        (review.user?.type === 'User' || GREPTILE.has(review.user?.login))) latest.set(review.user.id, review)
  }
  return { head, blocked, changesRequested: [...latest.values()].some((review) => review.state === 'CHANGES_REQUESTED') }
}

export function inspect(api, number, settings) {
  const pr = api.get(`pulls/${number}`)
  const preliminary = candidateReasons(pr, settings)
  if (preliminary.length) return { pr, reasons: preliminary }
  const files = api.pages(`pulls/${number}/files?per_page=100`).flat()
  const checks = api.pages(`commits/${pr.head.sha}/check-runs?filter=all&per_page=100`).flatMap((page) => page.check_runs)
  const statuses = api.pages(`commits/${pr.head.sha}/statuses?per_page=100`).flat()
  const workflows = new Map([CI, FINDINGS].map((path) => [path, api.get(`actions/workflows/${path.split('/').at(-1)}`)]))
  const ids = new Set([...checks.filter((check) => ['ci', 'validation'].includes(check.name)).map((check) => runNumber(check.details_url)),
    runNumber(newest(statuses.filter((status) => status.context === 'review-findings'))?.target_url)].filter(Boolean))
  const runs = new Map([...ids].map((id) => [id, api.get(`actions/runs/${id}`)]))
  const rules = api.pages('rules/branches/main?per_page=100').flat()
  const review = readReview(api, number, pr.head.sha)
  const snapshot = { pr, files, checks, statuses, runs, workflows, rules, review }
  return { pr, reasons: eligibility(snapshot, settings) }
}

// No pending native auto-merge enrollment: each attempt authorizes only the checked head.
export function processCandidate({ api, number, settings, token, appSlug, inspectCandidate = inspect }) {
  const first = inspectCandidate(api, number, settings)
  if (first.reasons.length || !token) return { ...first, ready: first.reasons.length === 0, merged: false }
  if (!appSlug || `${appSlug}[bot]` !== settings.bot) throw new Error('minted App does not match AUTOMERGE_BOT_LOGIN')
  const second = inspectCandidate(api, number, settings)
  if (second.pr.head.sha !== first.pr.head.sha) second.reasons.push('head changed during final validation')
  if (second.reasons.length) return { ...second, ready: false, merged: false }
  // Re-read mutable PR metadata last, after the final check/review pagination.
  const current = api.get(`pulls/${number}`)
  const reasons = candidateReasons(current, settings)
  if (current.head?.sha !== first.pr.head.sha || current.mergeable !== true || current.mergeable_state !== 'clean') reasons.push('PR changed before merge')
  if (reasons.length) return { pr: current, reasons, ready: false, merged: false }
  const receipt = api.merge(number, first.pr.head.sha, token)
  if (receipt.merged !== true || !SHA.test(receipt.sha ?? '')) throw new Error('merge did not return a confirmed receipt; inspect before retrying')
  const after = api.get(`pulls/${number}`)
  if (after.merged !== true || after.head?.sha !== first.pr.head.sha || after.merge_commit_sha !== receipt.sha ||
      after.merged_by?.login !== settings.bot) throw new Error('merge postcondition unavailable or mismatched; outcome uncertain')
  return { pr: after, reasons: [`merged ${first.pr.head.sha} as ${receipt.sha}`], ready: false, merged: true }
}

export function run(env = process.env, api = client()) {
  const settings = config(env)
  if (!settings) { console.log('Author automerge is disabled'); return }
  const target = env.TARGET_PR || ''
  if (target && !/^[1-9]\d*$/.test(target)) throw new Error('TARGET_PR must be a positive integer')
  const numbers = target ? [Number(target)] : api.pages('pulls?state=open&base=main&per_page=100').flat()
    .filter((pr) => candidateReasons(pr, settings).length === 0).map((pr) => pr.number)
  let needsToken = false
  const errors = []
  for (const number of numbers) {
    try {
      const result = processCandidate({ api, number, settings, token: env.AUTOMERGE_TOKEN, appSlug: env.AUTOMERGE_APP_SLUG })
      needsToken ||= result.ready
      const message = `#${number}: ${result.merged ? 'merged' : result.ready ? 'ready (read-only)' : 'blocked'}${result.reasons.length ? `: ${result.reasons.join('; ')}` : ''}`
      console.log(message)
      if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${message}\n`)
    } catch (error) {
      // Avoid exposing gh stderr/arguments or token-bearing subprocess errors.
      console.error(`#${number}: ${error.status !== undefined ? 'GitHub API failed; no further action for this PR' : error.message}`)
      errors.push(number)
    }
  }
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `needs_token=${needsToken}\n`)
  if (errors.length) throw new Error(`manual inspection or retry required for PRs: ${errors.join(', ')}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { run() } catch (error) { console.error(`author-automerge: ${error.message}`); process.exitCode = 1 }
}
