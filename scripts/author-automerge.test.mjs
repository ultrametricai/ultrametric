import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { AUTHORS, REPO, REPO_ID, candidateReasons, checkReasons, client, config, eligibility, inspect, processCandidate, readReview, run } from './author-automerge.mjs'

const head = 'a'.repeat(40)
const mergeSha = 'b'.repeat(40)
const CI = '.github/workflows/ci.yml'
const FINDINGS = '.github/workflows/review-findings.yml'
const settings = { notBefore: '2026-11-04T00:00:00Z', bot: 'example-automerge[bot]', canary: null }
function fixture() {
  const repo = { id: REPO_ID, full_name: REPO }
  return {
    pr: { number: 600, user: { id: 666306, login: 'judegomila', type: 'User' }, state: 'open', draft: false,
      head: { sha: head, repo }, base: { ref: 'main', repo }, labels: [], auto_merge: null,
      created_at: '2026-11-04T00:00:01Z', changed_files: 1, mergeable: true, mergeable_state: 'clean' },
    files: [{ filename: 'lib/example.ts' }],
    checks: ['ci', 'validation', 'Greptile Review'].map((name, index) => ({ id: 200 + index, name,
      app: { id: index === 2 ? 867647 : 15368 }, head_sha: head, status: 'completed', conclusion: 'success',
      details_url: `https://github.com/${REPO}/actions/runs/100/job/${index + 1}`, check_suite: { id: 50 } })),
    statuses: [{ id: 300, context: 'review-findings', state: 'success', creator: { type: 'Bot', login: 'github-actions[bot]' },
      target_url: `https://github.com/${REPO}/actions/runs/101` }],
    runs: new Map([[100, { id: 100, workflow_id: 10, path: CI, repository: repo, event: 'pull_request', head_sha: head,
      status: 'completed', conclusion: 'success', check_suite_id: 50, pull_requests: [{ number: 600, head: { sha: head } }] }],
    [101, { id: 101, workflow_id: 11, path: FINDINGS, repository: repo, status: 'completed', conclusion: 'success' }]]),
    workflows: new Map([[CI, { id: 10, path: CI, state: 'active' }], [FINDINGS, { id: 11, path: FINDINGS, state: 'active' }]]),
    rules: [{ type: 'required_status_checks', parameters: { strict_required_status_checks_policy: false,
      required_status_checks: ['ci', 'validation', 'Greptile Review', 'review-findings'].map((context) => ({ context, integration_id: context === 'Greptile Review' ? 867647 : 15368 })) } }],
    review: { head, blocked: false, changesRequested: false },
  }
}

test('only the two verified people qualify, without a label opt-in or up-to-date requirement', () => {
  assert.equal(AUTHORS.size, 2)
  for (const [id, login] of AUTHORS) {
    const value = fixture()
    value.pr.user = { id, login, type: 'User' }
    assert.deepEqual(eligibility(value, settings), [])
  }
})

const denyCases = {
  'outsider with a whitelisted display login': (f) => { f.pr.user.id = 777 },
  'unexpected rename': (f) => { f.pr.user.login = 'someone-else' },
  'bot with a whitelisted ID': (f) => { f.pr.user.type = 'Bot' },
  'missing author ID': (f) => { delete f.pr.user.id },
  'draft': (f) => { f.pr.draft = true },
  'unknown draft state': (f) => { delete f.pr.draft },
  'closed PR': (f) => { f.pr.state = 'closed' },
  'fork': (f) => { f.pr.head.repo = { id: 777, full_name: 'judegomila/ultrametric' } },
  'deleted fork': (f) => { f.pr.head.repo = null },
  'different base': (f) => { f.pr.base.ref = 'release' },
  'wrong repo ID': (f) => { f.pr.base.repo.id = 777 },
  'unknown SHA': (f) => { f.pr.head.sha = '' },
  'PR created before activation': (f) => { f.pr.created_at = '2026-11-03T00:00:00Z' },
  'PR created at activation': (f) => { f.pr.created_at = settings.notBefore },
  'unknown creation time': (f) => { delete f.pr.created_at },
  'missing labels': (f) => { delete f.pr.labels },
  'existing native enrollment': (f) => { f.pr.auto_merge = { enabled_by: { login: 'someone' } } },
  'unknown enrollment': (f) => { delete f.pr.auto_merge },
  'merge conflict': (f) => { f.pr.mergeable = false; f.pr.mergeable_state = 'dirty' },
  'unknown mergeability': (f) => { f.pr.mergeable = null },
  'blocked merge state': (f) => { f.pr.mergeable_state = 'blocked' },
  'truncated files': (f) => { f.pr.changed_files = 3001 },
  'missing file metadata': (f) => { f.files = [{}] },
  'workflow change': (f) => { f.files = [{ filename: '.github/workflows/ci.yml' }] },
  'renamed workflow': (f) => { f.files = [{ filename: 'docs/old.yml', previous_filename: '.github/workflows/old.yml' }] },
  'local Action': (f) => { f.files = [{ filename: '.github/actions/test/action.yml' }] },
  'controller change': (f) => { f.files = [{ filename: 'scripts/author-automerge.mjs' }] },
  'internal merge policy change': (f) => { f.files = [{ filename: 'scripts/refresh_policy.py' }] },
  'internal recovery controller change': (f) => { f.files = [{ filename: 'scripts/refresh-automerge.py' }] },
  'internal update intent change': (f) => { f.files = [{ filename: 'scripts/refresh_update.py' }] },
  'internal continuation change': (f) => { f.files = [{ filename: 'scripts/refresh_main_ci.py' }] },
  'internal repair change': (f) => { f.files = [{ filename: 'scripts/refresh-repair.py' }] },
  'receipt recovery trust change': (f) => { f.files = [{ filename: 'scripts/refresh_recovery.py' }] },
  'internal review change': (f) => { f.files = [{ filename: 'scripts/refresh-review.py' }] },
  'gate config change': (f) => { f.files = [{ filename: 'scripts/config/vitest.config.ts' }] },
  'fast path change': (f) => { f.files = [{ filename: 'scripts/docs-fast-path.mjs' }] },
  'missing required rule': (f) => { f.rules = [] },
  'unbound check protection': (f) => { f.rules[0].parameters.required_status_checks[0].integration_id = null },
  'missing CI check': (f) => { f.checks.shift() },
  'unknown check ID': (f) => { delete f.checks[0].id },
  'wrong App': (f) => { f.checks[0].app.id = 999 },
  'stale CI check': (f) => { f.checks[0].head_sha = mergeSha },
  'failed CI check': (f) => { f.checks[0].conclusion = 'failure' },
  'skipped CI check': (f) => { f.checks[0].conclusion = 'skipped' },
  'cancelled CI check': (f) => { f.checks[0].conclusion = 'cancelled' },
  'neutral CI check': (f) => { f.checks[0].conclusion = 'neutral' },
  'pending CI check': (f) => { f.checks[0].status = 'in_progress' },
  'older active review despite later success': (f) => { f.checks.push({ ...f.checks[2], id: 1, status: 'in_progress', conclusion: null }) },
  'new failing check supersedes success': (f) => { f.checks.push({ ...f.checks[0], id: 900, conclusion: 'failure' }) },
  'checks from different runs': (f) => { f.checks[1].details_url = `https://github.com/${REPO}/actions/runs/102` },
  'wrong check suite': (f) => { f.checks[0].check_suite.id = 999 },
  'unassociated CI': (f) => { f.runs.get(100).pull_requests = [] },
  'unassociated head': (f) => { f.runs.get(100).pull_requests[0].head.sha = mergeSha },
  'stale CI run': (f) => { f.runs.get(100).head_sha = mergeSha },
  'wrong workflow path': (f) => { f.runs.get(100).path = '.github/workflows/other.yml' },
  'unregistered workflow': (f) => { f.runs.get(100).workflow_id = 999 },
  'disabled workflow': (f) => { f.workflows.get(CI).state = 'disabled_manually' },
  'non-PR CI event': (f) => { f.runs.get(100).event = 'workflow_dispatch' },
  'pending CI run': (f) => { f.runs.get(100).status = 'in_progress' },
  'missing Greptile check': (f) => { f.checks.pop() },
  'stale Greptile check': (f) => { f.checks[2].head_sha = mergeSha },
  'new failed findings status': (f) => { f.statuses.push({ ...f.statuses[0], id: 901, state: 'failure' }) },
  'forged findings creator': (f) => { f.statuses[0].creator = { type: 'User', login: 'judegomila' } },
  'foreign findings link': (f) => { f.statuses[0].target_url = 'https://example.com/actions/runs/101' },
  'unsuccessful findings workflow': (f) => { f.runs.get(101).conclusion = 'failure' },
  'fresh unresolved findings': (f) => { f.review.blocked = true },
  'stale review snapshot': (f) => { f.review.head = mergeSha },
  'human changes requested': (f) => { f.review.changesRequested = true },
  'unknown review decision': (f) => { delete f.review.changesRequested },
  'unknown review thread state': (f) => { delete f.review.blocked },
}
for (const [name, change] of Object.entries(denyCases)) {
  test(`deny: ${name}`, () => {
    const value = fixture()
    change(value)
    assert.ok(eligibility(value, settings).length > 0)
  })
}
for (const label of ['automerge-hold', 'do-not-merge', 'hold', 'manual-merge', 'HOLD']) {
  test(`deny hold label: ${label}`, () => {
    const value = fixture(); value.pr.labels.push({ name: label })
    assert.ok(candidateReasons(value.pr, settings).length)
  })
}
test('canary confines automation to one newly created PR', () => {
  assert.ok(candidateReasons(fixture().pr, { ...settings, canary: 601 }).length)
  assert.deepEqual(candidateReasons(fixture().pr, { ...settings, canary: 600 }), [])
})
test('new successful rerun replaces a completed failure', () => {
  const value = fixture()
  value.checks.push({ ...value.checks[0], id: 1, conclusion: 'failure' })
  assert.deepEqual(checkReasons(value), [])
})
test('CI reusable findings status is accepted after the registered CI run succeeds', () => {
  const value = fixture(); value.statuses[0].target_url = `https://github.com/${REPO}/actions/runs/100`
  assert.deepEqual(checkReasons(value), [])
})
test('findings link repair must finish in a successful trusted run before eligibility', () => {
  const value = fixture()
  value.runs.get(101).conclusion = 'failure'
  assert.ok(checkReasons(value).length)
  value.runs.set(102, { ...value.runs.get(101), id: 102, status: 'in_progress', conclusion: null })
  value.statuses.push({ ...value.statuses[0], id: 301, target_url: `https://github.com/${REPO}/actions/runs/102` })
  assert.ok(checkReasons(value).length)
  value.runs.get(102).status = 'completed'
  value.runs.get(102).conclusion = 'success'
  assert.deepEqual(checkReasons(value), [])
})

function fakeApi(value = fixture()) {
  const merges = []
  let after = null
  const api = {
    get(path) {
      if (path === 'pulls/600') return structuredClone(after ?? value.pr)
      if (path === 'actions/workflows/ci.yml') return value.workflows.get(CI)
      if (path === 'actions/workflows/review-findings.yml') return value.workflows.get(FINDINGS)
      if (path.startsWith('actions/runs/')) return value.runs.get(Number(path.split('/').at(-1)))
      throw new Error(`unexpected read: ${path}`)
    },
    pages(path) {
      if (path === 'pulls?state=open&base=main&per_page=100') return [[value.pr]]
      if (path === 'pulls/600/files?per_page=100') return [value.files]
      if (path.includes('/check-runs?')) return [{ check_runs: value.checks }]
      if (path.includes('/statuses?')) return [value.statuses]
      if (path === 'rules/branches/main?per_page=100') return [value.rules]
      if (path === 'pulls/600/reviews?per_page=100') return [[]]
      throw new Error(`unexpected listing: ${path}`)
    },
    query() { return { headRefOid: value.pr.head.sha, reviewThreads: {
      nodes: value.review.blocked ? [{ isResolved: false, comments: { nodes: [{ author: { login: 'greptile-apps' } }] } }] : [],
      pageInfo: { hasNextPage: false },
    } } },
    merge(number, sha, token) {
      merges.push({ number, sha, token })
      after = { ...structuredClone(value.pr), merged: true, merge_commit_sha: mergeSha, merged_by: { login: settings.bot } }
      return { merged: true, sha: mergeSha }
    },
  }
  return { api, merges }
}
const invocation = (api) => ({ api, number: 600, settings, token: 'test-token', appSlug: 'example-automerge' })
test('full controller inspection merges exactly the verified head with the App token', () => {
  const { api, merges } = fakeApi()
  assert.deepEqual(inspect(api, 600, settings).reasons, [])
  assert.equal(processCandidate(invocation(api)).merged, true)
  assert.deepEqual(merges, [{ number: 600, sha: head, token: 'test-token' }])
})
test('read-only preflight makes no mutation', () => {
  const { api, merges } = fakeApi()
  assert.equal(processCandidate({ ...invocation(api), token: undefined }).ready, true)
  assert.equal(merges.length, 0)
})
test('App slug mismatch fails before mutation', () => {
  const { api, merges } = fakeApi()
  assert.throws(() => processCandidate({ ...invocation(api), appSlug: 'another-app' }), /does not match/)
  assert.equal(merges.length, 0)
})
for (const [name, change] of [
  ['new head', (f) => { f.pr.head.sha = mergeSha }],
  ['hold', (f) => { f.pr.labels = [{ name: 'hold' }] }],
  ['draft conversion', (f) => { f.pr.draft = true }],
  ['new finding', (f) => { f.review.blocked = true }],
  ['failed check', (f) => { f.checks[0].conclusion = 'failure' }],
]) {
  test(`final eligibility recheck blocks ${name}`, () => {
    const value = fixture(), { api, merges } = fakeApi(value)
    let calls = 0
    const inspectCandidate = (...args) => { if (++calls === 2) change(value); return inspect(...args) }
    assert.equal(processCandidate({ ...invocation(api), inspectCandidate }).merged, false)
    assert.equal(merges.length, 0)
  })
}
test('last metadata refresh catches a hold after both inspections', () => {
  const { api, merges } = fakeApi()
  const get = api.get
  let reads = 0
  api.get = (path) => { const pr = get(path); if (path === 'pulls/600' && ++reads === 3) pr.labels = [{ name: 'hold' }]; return pr }
  assert.equal(processCandidate(invocation(api)).merged, false)
  assert.equal(merges.length, 0)
})
test('API read failure makes no mutation', () => {
  const { api, merges } = fakeApi(); api.pages = () => { throw new Error('API unavailable') }
  assert.throws(() => processCandidate(invocation(api)), /API unavailable/)
  assert.equal(merges.length, 0)
})
test('merge refusal is not retried or bypassed', () => {
  const { api } = fakeApi(); let attempts = 0
  api.merge = () => { attempts++; throw new Error('409 head changed') }
  assert.throws(() => processCandidate(invocation(api)), /409/)
  assert.equal(attempts, 1)
})
test('uncertain merge receipt is reported, not retried', () => {
  const { api } = fakeApi(); let attempts = 0
  api.merge = () => { attempts++; return { merged: false } }
  assert.throws(() => processCandidate(invocation(api)), /confirmed receipt/)
  assert.equal(attempts, 1)
})
test('postcondition must confirm the merged head and bot', () => {
  const { api } = fakeApi(); api.merge = () => ({ merged: true, sha: mergeSha })
  assert.throws(() => processCandidate(invocation(api)), /outcome uncertain/)
})

test('review pagination finds a late unresolved Greptile thread, preserving Foreloop exclusion', () => {
  const { api } = fakeApi(); let page = 0
  api.query = (_, variables) => {
    page++
    assert.equal(variables.cursor, page === 1 ? null : 'next')
    return { headRefOid: head, reviewThreads: { pageInfo: { hasNextPage: page === 1, endCursor: 'next' }, nodes: [
      { isResolved: false, comments: { nodes: [{ author: { login: page === 1 ? 'foreloop' : 'greptile-apps' } }] } },
    ] } }
  }
  assert.equal(readReview(api, 600, head).blocked, true)
  assert.equal(page, 2)
})
test('head drift during review pagination fails closed', () => {
  const { api } = fakeApi(); api.query = () => ({ headRefOid: mergeSha })
  assert.throws(() => readReview(api, 600, head), /head changed/)
})
test('unknown author on an unresolved review fails closed', () => {
  const { api } = fakeApi()
  api.query = () => ({ headRefOid: head, reviewThreads: { nodes: [
    { isResolved: false, comments: { nodes: [{ author: null }] } },
  ], pageInfo: { hasNextPage: false } } })
  assert.throws(() => readReview(api, 600, head), /author unavailable/)
})
test('comment-only human review does not clear an earlier changes request', () => {
  const { api } = fakeApi()
  api.pages = () => [[{ id: 1, state: 'CHANGES_REQUESTED', user: { id: 7, type: 'User' } },
    { id: 2, state: 'COMMENTED', user: { id: 7, type: 'User' } }]]
  assert.equal(readReview(api, 600, head).changesRequested, true)
})
test('dismissal clears a human changes request', () => {
  const { api } = fakeApi()
  api.pages = () => [[{ id: 1, state: 'DISMISSED', user: { id: 7, type: 'User' } }]]
  assert.equal(readReview(api, 600, head).changesRequested, false)
})

const env = { GITHUB_REPOSITORY: REPO, AUTHOR_AUTOMERGE_ENABLED: 'true',
  AUTHOR_AUTOMERGE_NOT_BEFORE: settings.notBefore, AUTOMERGE_BOT_LOGIN: settings.bot }
test('activation is explicitly disabled by default', () => {
  assert.equal(config({ GITHUB_REPOSITORY: REPO }), null)
  run({ GITHUB_REPOSITORY: REPO }, { pages() { assert.fail('disabled workflow must not query candidates') } })
})
test('activation requires repo, date, identity and valid canary configuration', () => {
  assert.deepEqual(config(env), settings)
  for (const change of [{ GITHUB_REPOSITORY: 'someone/ultrametric' }, { AUTHOR_AUTOMERGE_NOT_BEFORE: '' },
    { AUTHOR_AUTOMERGE_NOT_BEFORE: '2026-02-30T00:00:00Z' }, { AUTOMERGE_BOT_LOGIN: 'github-actions[bot]' },
    { AUTOMERGE_BOT_LOGIN: 'tylerlastovich' }, { AUTHOR_AUTOMERGE_CANARY_PR: 'oops' }]) {
    assert.throws(() => config({ ...env, ...change }))
  }
})
test('invalid manual PR input cannot become a CLI argument', () => {
  assert.throws(() => run({ ...env, TARGET_PR: '600; curl example.com' }), /positive integer/)
})
test('pre-activation PRs are excluded from sweeps without further reads', () => {
  const value = fixture(); value.pr.created_at = '2026-11-03T00:00:00Z'
  const { api, merges } = fakeApi(value)
  api.get = () => { assert.fail('old PR must not be inspected') }
  run(env, api)
  assert.equal(merges.length, 0)
})
test('merge client uses one normal SHA-conditional REST merge, with no enrollment or bypass', () => {
  const calls = []
  const api = client((args, options) => { calls.push({ args, options }); return { merged: true, sha: mergeSha } })
  api.merge(600, head, 'test-token')
  assert.deepEqual(calls, [{ args: ['api', '--method', 'PUT', `repos/${REPO}/pulls/600/merge`, '--input', '-'],
    options: { token: 'test-token', input: JSON.stringify({ sha: head, merge_method: 'merge' }) } }])
})
test('workflow loads only main, installs no PR dependencies, and leaves default token read-only', () => {
  const yaml = readFileSync(new URL('../.github/workflows/author-automerge.yml', import.meta.url), 'utf8')
  assert.match(yaml, /ref: main/)
  assert.match(yaml, /persist-credentials: false/)
  assert.match(yaml, /vars.AUTHOR_AUTOMERGE_ENABLED == 'true'/)
  assert.doesNotMatch(yaml, /ref:.*(?:head|inputs)|pnpm install|npm install|\n\s+(?:pull-requests|contents): write/)
  assert.match(yaml, /permission-contents: write/)
})
