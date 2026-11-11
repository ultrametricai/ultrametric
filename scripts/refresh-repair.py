"""Trusted-main repair controller. PR refs are read only as allowlisted JSON data."""
import json
from refresh_policy import actions_author, held, verify_provenance, MissingProvenance
from refresh_recovery import selected, trusted_run, recovery_evidence, recovery_resume, replay, GATES
import hashlib
import os
import re
import subprocess
import time
import tempfile
from pathlib import Path

REPO = os.environ['REPO']
NUMBER = int(os.environ['PR_NUMBER'])
EXPECTED = os.environ['PR_HEAD']
MAX_ROUNDS = 3
STAGE = "identity"
RUN_ID = os.environ.get("GITHUB_RUN_ID", "0")

def command(args, **kwargs):
    global STAGE
    STAGE = " ".join(args[:4])
    return subprocess.run(args, text=True, check=True, **kwargs)

def output(args, **kwargs):
    global STAGE
    STAGE = " ".join(args[:4])
    return subprocess.check_output(args, text=True, **kwargs).strip()

def api(endpoint, data=None):
    args = ['gh', 'api', endpoint]
    if data is not None:
        args += ['--method', 'POST', '--input', '-']
    result = command(args, input=json.dumps(data) if data is not None else None, capture_output=True)
    value = json.loads(result.stdout) if result.stdout.strip() else None
    if isinstance(value, dict) and value.get('errors'):
        raise RuntimeError(value['errors'])
    return value

def current():
    return api(f'repos/{REPO}/pulls/{NUMBER}')

def identity(pr):
    return (pr['state'] == 'open' and not pr['draft'] and bool(pr['auto_merge']) and pr['base']['ref'] == 'main'
            and pr['head']['repo'] is not None and pr['head']['repo']['full_name'] == REPO
            and actions_author(pr['user']) and not held(pr)
            and re.fullmatch(r'story-runner/([a-z0-9-]+)-[0-9]+', pr['head']['ref']))

def confirm_publication(branch, previous_sha, new_sha):
    """Wait only for stale pre-push metadata; a different writer or hold fails closed."""
    ref = f'refs/heads/{branch}'

    def remote_head():
        rows = output(['git', 'ls-remote', '--refs', 'origin', ref]).splitlines()
        if len(rows) != 1:
            raise RuntimeError('Published branch is missing or ambiguous; no receipt emitted')
        parts = rows[0].split()
        if len(parts) != 2 or parts[1] != ref or not re.fullmatch('[a-f0-9]{40}', parts[0]):
            raise RuntimeError('Invalid published branch readback; no receipt emitted')
        if parts[0] not in (previous_sha, new_sha):
            raise RuntimeError('Remote head changed after repair publication; no receipt emitted')
        return parts[0]

    for attempt in range(6):
        before = remote_head()
        live = current()
        if not identity(live) or live['head']['ref'] != branch:
            raise RuntimeError('PR identity or automation opt-in changed after publication; no receipt emitted')
        observed = live['head']['sha']
        if observed not in (previous_sha, new_sha):
            raise RuntimeError('PR head changed after repair publication; no receipt emitted')
        after = remote_head()
        if before == new_sha and observed == new_sha and after == new_sha:
            return
        if attempt < 5:
            time.sleep(2)
    raise RuntimeError('Publication readback did not converge; no receipt emitted')


def diagnostic_comments(comments):
    return '\n\n'.join(f"[{(entry.get('author') or {}).get('login')}] {entry['body']}"
                        for entry in comments
                        if (entry.get('author') or {}).get('login') not in ['foreloop-app','foreloop-app[bot]'])


def threads():
    query = '''query($owner:String!, $name:String!, $number:Int!, $cursor:String) {
      repository(owner:$owner,name:$name) { pullRequest(number:$number) {
        headRefOid reviewThreads(first:100,after:$cursor) {
          pageInfo {hasNextPage endCursor}
          nodes {id isResolved path originalLine comments(first:100) {pageInfo {hasNextPage} nodes {
            body author {login} originalCommit {oid}
          }}}
        }
      }}
    }'''
    owner, name = REPO.split('/')
    cursor, findings = None, []
    while True:
        result = api('graphql', {'query': query, 'variables': {
            'owner': owner, 'name': name, 'number': NUMBER, 'cursor': cursor}})
        if result.get('errors'):
            raise RuntimeError(result['errors'])
        pr = result['data']['repository']['pullRequest']
        for thread in pr['reviewThreads']['nodes']:
            if thread['comments']['pageInfo']['hasNextPage']:
                raise RuntimeError('Review thread exceeds the bounded diagnostic context; scoped review required')
            comment = thread['comments']['nodes'][0] if thread['comments']['nodes'] else None
            if (thread['isResolved'] or not comment or (comment.get('author') or {}).get('login')
                    not in ['greptile-apps', 'greptile-apps[bot]', 'greptileai']):
                continue
            if thread['originalLine'] is None or not comment.get('originalCommit'):
                raise RuntimeError(f"Unresolved finding {thread['id']} has no supported inline scope; human review required")
            findings.append({'id': thread['id'], 'path': thread['path'], 'line': thread['originalLine'],
                             'commit': comment['originalCommit']['oid'], 'body': diagnostic_comments(thread['comments']['nodes'])})
        page = pr['reviewThreads']['pageInfo']
        if not page['hasNextPage']:
            return pr['headRefOid'], findings
        cursor = page['endCursor']


def finding_fingerprint(finding):
    fields = {key:finding.get(key) for key in ['path','line','commit','body']}
    return hashlib.sha256(json.dumps(fields,sort_keys=True).encode()).hexdigest()


def load_resume_report(head, trusted):
    message = output(['git', 'log', '-1', '--format=%B', head])
    run_match = re.search(r'^Refresh-Repair-Run: ([0-9]+)$', message, re.MULTILINE)
    base_match = re.search(r'^Refresh-Repair-Base: ([a-f0-9]{40})$', message, re.MULTILINE)
    if not run_match:
        return None
    if not base_match:
        raise RuntimeError('Repair commit lacks its trusted base binding')
    recovered = recovery_resume(api, command, output, REPO, NUMBER, head, trusted)
    if recovered is not None:
        return recovered
    run_id = run_match.group(1)
    run = api(f'repos/{REPO}/actions/runs/{run_id}')
    if (run['path'] != '.github/workflows/refresh-repair.yml' or run['head_branch'] != 'main'
            or run['event'] != 'workflow_dispatch'):
        raise RuntimeError('Prior audit was not produced by the trusted repair workflow')
    if run['status'] != 'completed':
        raise RuntimeError('Prior repair is still producing its audit artifact; retry later')
    artifacts = api(f'repos/{REPO}/actions/runs/{run_id}/artifacts?per_page=100')['artifacts']
    expected_name = f'refresh-repair-{NUMBER}-{run_id}'
    artifact = next((a for a in artifacts if a['name'] == expected_name), None)
    if not artifact or artifact['expired'] or artifact['size_in_bytes'] > 2_000_000:
        raise RuntimeError('Prior repair audit is unavailable, expired, or oversized; review required')
    with tempfile.TemporaryDirectory(prefix='refresh-audit-') as directory:
        command(['gh', 'run', 'download', run_id, '--repo', REPO, '--name', expected_name, '--dir', directory])
        files = list(Path(directory).rglob('refresh-repair-report.json'))
        if len(files) != 1:
            raise RuntimeError('Prior repair artifact has no unique audit report')
        report = json.loads(files[0].read_text())
    if (report.get('publishedHead') != head or report.get('main') != base_match.group(1)
            or report.get('runId') != run_id or report.get('pr') != NUMBER):
        raise RuntimeError('Prior repair audit does not match this PR and published head')
    if (output(['git', 'merge-base', run['head_sha'], report['main']]) != run['head_sha']
            or output(['git', 'merge-base', report['main'], trusted]) != report['main']):
        raise RuntimeError('Prior audit source is outside trusted main history')
    if (not isinstance(report.get('originalThreads'), list) or len(report['originalThreads']) > 20
            or not all(isinstance(thread, str) for thread in report['originalThreads'])
            or not isinstance(report.get('findingSnapshots'), dict)
            or any(not re.fullmatch('[a-f0-9]{64}',report['findingSnapshots'].get(thread,'')) for thread in report['originalThreads'])
            or not isinstance(report.get('audits'), list) or len(report['audits']) > 20
            or any(not isinstance(audit.get('addressed'), bool) or not isinstance(audit.get('thread'), str)
                   for audit in report['audits'])):
        raise RuntimeError('Prior audit report has invalid structure')
    return report


def latest_checks(checks, ci_suite=None):
    latest = {}
    for check in checks:
        if (ci_suite is not None and check['name'] in ['ci','validation'] and check['app']['id'] == 15368
                and check.get('check_suite',{}).get('id') != ci_suite):
            continue
        key = (check['name'],check['app']['id'])
        if key not in latest or check.get('id',0) >= latest[key].get('id',0):
            latest[key] = check
    return list(latest.values())


def usable_ci_run(runs):
    candidates = [run for run in runs if run['conclusion'] != 'action_required']
    if any(run['status'] != 'completed' for run in candidates):
        return None
    latest = {}
    for run in candidates:
        if run['event'] not in latest or run['id'] > latest[run['event']]['id']:
            latest[run['event']] = run
    usable = [run for run in latest.values() if run['conclusion'] in ['success', 'failure']]
    return max(usable, key=lambda run: run['id']) if usable else None


def review_active(sha):
    page = 1
    while True:
        checks = api(f'repos/{REPO}/commits/{sha}/check-runs?check_name=Greptile%20Review&filter=all&per_page=100&page={page}')['check_runs']
        if any(check['name'] == 'Greptile Review' and check['app']['id'] == 867647
               and check['status'] != 'completed' for check in checks):
            return True
        if len(checks) < 100:
            return False
        page += 1


def recheck(report, branch, new_sha):
    live = current()
    if not identity(live) or live['head']['sha'] != new_sha:
        return 'closed-or-changed'
    original_ids = set(report['originalThreads'])
    runs = api(f'repos/{REPO}/actions/workflows/ci.yml/runs?head_sha={new_sha}&per_page=100')
    if not runs['workflow_runs']:
        command(['gh', 'workflow', 'run', 'ci.yml', '--repo', REPO, '--ref', branch])
        return 'waiting-checks'
    candidates = [run for run in runs['workflow_runs'] if run['conclusion'] != 'action_required']
    ci_active = any(run['status'] != 'completed' for run in candidates)
    if not ci_active and usable_ci_run(runs['workflow_runs']) is None:
        command(['gh','workflow','run','ci.yml','--repo',REPO,'--ref',branch])
        raise RuntimeError('CI ended without a result; same-head CI retry requested within the failed-worker budget')
    checks = api(f'repos/{REPO}/commits/{new_sha}/check-runs?per_page=100')['check_runs']
    if not any(check['app']['id'] == 867647 for check in checks):
        command(['gh', 'workflow', 'run', 'refresh-review.yml', '--repo', REPO,
                 '--ref', 'main', '--field', f'pr={NUMBER}', '--field', f'head={new_sha}'])
    reviewed = False
    for _ in range(24):
        pr = current()
        if not identity(pr) or pr['head']['sha'] != new_sha:
            return 'closed-or-changed'
        runs = api(f'repos/{REPO}/actions/workflows/ci.yml/runs?head_sha={new_sha}&per_page=100')
        newest = usable_ci_run(runs['workflow_runs'])
        if newest is None or newest.get('check_suite_id') is None:
            time.sleep(25)
            continue
        checks = latest_checks(api(f'repos/{REPO}/commits/{new_sha}/check-runs?per_page=100')['check_runs'],newest['check_suite_id'])
        if any(c['name'] in ['ci', 'validation'] and c['app']['id'] == 15368
               and c['status'] == 'completed' and c['conclusion'] == 'failure' for c in checks):
            return 'needs-repair'
        if any(c['name'] == 'Greptile Review' and c['app']['id'] == 867647 and c['status'] == 'completed'
               and c['conclusion'] != 'success' for c in checks):
            command(['gh', 'workflow', 'run', 'refresh-review.yml', '--repo', REPO,
                     '--ref', 'main', '--field', f'pr={NUMBER}', '--field', f'head={new_sha}'])
            return 'waiting-review' # the reservation worker owns cooldowns and retry limits
        required = {'ci': 15368, 'validation': 15368, 'Greptile Review': 867647}
        if all(any(c['name'] == name and c['app']['id'] == app and c['status'] == 'completed'
                   and c['conclusion'] == 'success' for c in checks) for name, app in required.items()):
            reviewed = True
            break
        time.sleep(25)
    if not reviewed:
        print('Checks remain pending; retain this audit for a metadata-only resume')
        return 'waiting-checks'
    sha, remaining = threads()
    if sha != new_sha:
        return 'closed-or-changed'
    new_findings = [finding for finding in remaining if finding['id'] not in original_ids]
    if new_findings or any(finding['id'] in original_ids and
                           report['findingSnapshots'].get(finding['id']) != finding_fingerprint(finding)
                           for finding in remaining):
        return 'needs-repair'
    live_ids = {finding['id'] for finding in remaining}
    for audit in report['audits']:
        if audit['addressed'] and audit['thread'] in original_ids and audit['thread'] in live_ids:
            live = current()
            if not identity(live) or live['head']['sha'] != new_sha:
                return 'closed-or-changed'
            api('graphql', {'query': 'mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}',
                            'variables': {'id': audit['thread']}})
    command(['gh', 'workflow', 'run', 'review-findings.yml', '--repo', REPO, '--ref', 'main', '--field', f'pr={NUMBER}'])
    addressed = {audit['thread'] for audit in report['audits'] if audit['addressed']}
    if (live_ids & original_ids) - addressed:
        return 'needs-repair'
    print(f'#{NUMBER}: repaired and independently rechecked; auto-merge remains gated')
    return 'rechecked'


def recover_receipt(pr, selection):
    # Explicit workflow inputs select the orphan. Missing provenance alone never
    # routes ordinary repair into this path, and API errors are not permission.
    if not re.fullmatch(r'[1-9][0-9]*', RUN_ID) or RUN_ID == selection[0] or not os.environ.get('GITHUB_OUTPUT'):
        raise RuntimeError('Recovery attestation requires a distinct new workflow run and output destination')
    try:
        verify_provenance(api, REPO, pr)
    except MissingProvenance:
        pass
    else:
        raise RuntimeError('This exact head already has provenance; use ordinary repair')
    trusted = output(['git', 'rev-parse', 'HEAD'])
    own_run = trusted_run(api, output, REPO, RUN_ID, trusted, active=True)
    if own_run['head_sha'] != trusted:
        raise RuntimeError('Recovery checkout differs from this run source')
    branch = pr['head']['ref']
    ref = f'refs/repair/recovery/{RUN_ID}'
    command(['git', 'fetch', '--no-tags', 'origin', f'refs/heads/{branch}:{ref}'])
    if output(['git', 'rev-parse', ref]) != EXPECTED:
        raise RuntimeError('Recovery branch no longer matches the explicitly selected orphan')
    original, proof = recovery_evidence(api, command, output, verify_provenance, REPO, pr, trusted, selection)

    def eligible():
        live = current()
        if not identity(live) or live['head']['sha'] != EXPECTED or live['head']['ref'] != branch:
            raise RuntimeError('Recovery PR identity, expected head or automation opt-in changed')
        if api(f'repos/{REPO}/branches/main')['commit']['sha'] != trusted:
            raise RuntimeError('Main changed during receipt recovery')
        workflow = api(f'repos/{REPO}/actions/workflows/refresh-repair.yml')
        if workflow.get('id') != own_run['workflow_id'] or workflow.get('path') != own_run['path'] or workflow.get('state') != 'active':
            raise RuntimeError('Recovery workflow identity changed or was paused')
        sha, findings = threads()
        if sha != EXPECTED or findings or review_active(EXPECTED):
            raise RuntimeError('Recovery head has changed or active/unresolved review; ordinary review required')

    eligible()
    replay(command, output, original, proof, trusted, os.environ['RUNNER_TEMP'])
    eligible()
    confirm_publication(branch, EXPECTED, EXPECTED)
    report = {key: original[key] for key in ('arena', 'head', 'evidenceRenames', 'restored', 'rejudged',
                                            'audits', 'unresolved', 'originalThreads', 'findingSnapshots')}
    report.update(pr=NUMBER, runId=RUN_ID, main=trusted, mode='receipt-recovery', attestationVersion=1,
                  publishedHead=EXPECTED, phase='receipt-recovered', recovery=proof,
                  validated=[gate[1] for gate in GATES] + ['refresh-stability'])
    report_file = Path(os.environ['RUNNER_TEMP']) / 'refresh-repair-report.json'
    report_file.write_text(json.dumps(report, indent=2) + '\n')
    # Persist the new run's proof first. The workflow uploads it under this run;
    # no old receipt is fabricated, no branch is pushed, and no threads are resolved.
    with open(os.environ['GITHUB_OUTPUT'], 'a') as receipt:
        receipt.write(f'published_head={EXPECTED}\n')
    print('Exact orphan tree replayed and freshly validated; new run-bound receipt prepared')


def main():
    pr = current()
    if pr['state'] != 'open':
        print('PR is already closed; no repair needed')
        return
    match = identity(pr)
    if not match or pr['head']['sha'] != EXPECTED or not re.fullmatch('[0-9a-f]{40}', EXPECTED):
        raise RuntimeError('PR identity or expected head changed; no repair performed')
    recovery = selected(os.environ)
    if recovery is not None:
        recover_receipt(pr, recovery)
        return
    verify_provenance(api, REPO, pr)
    branch, arena = pr['head']['ref'], match.group(1)
    trusted = output(['git', 'rev-parse', 'HEAD'])
    command(['git', 'fetch', '--no-tags', 'origin', f'refs/heads/{branch}:refs/repair/head'])
    if output(['git', 'rev-parse', 'refs/repair/head']) != EXPECTED:
        raise RuntimeError('Fetched branch no longer matches the requested head')
    base = output(['git', 'merge-base', trusted, EXPECTED])
    messages = output(['git', 'log', '--format=%B', f'{base}..{EXPECTED}'])
    rounds = len(re.findall(r'^Refresh-Repair-Attempt: [1-3]$', messages, re.MULTILINE))
    previous = load_resume_report(EXPECTED, trusted)
    if previous is not None and previous['main'] == trusted:
        report_file = Path(os.environ['RUNNER_TEMP']) / 'refresh-repair-report.json'
        report_file.write_text(json.dumps(previous, indent=2))
        previous['phase'] = recheck(previous, branch, EXPECTED)
        report_file.write_text(json.dumps(previous, indent=2))
        if previous['phase'] != 'needs-repair':
            return
    sha, findings = threads()
    if sha != EXPECTED:
        raise RuntimeError('PR changed while collecting review context')
    if review_active(EXPECTED):
        print('Review is active; defer repair before model calls or data changes')
        return
    checks = api(f'repos/{REPO}/commits/{EXPECTED}/check-runs?per_page=100')['check_runs']
    healthy = all(any(c['name'] == name and c['app']['id'] == 15368 and c['conclusion'] == 'success'
                      for c in checks) for name in ['validation', 'ci'])
    if not findings and healthy and output(['git', 'merge-base', trusted, EXPECTED]) == trusted:
        print('PR is current and healthy; no repair needed')
        return
    if rounds >= MAX_ROUNDS:
        raise RuntimeError('Repair stopped after three published attempts; human review required')
    tmp = Path(os.environ['RUNNER_TEMP'])
    finding_file, report_file = tmp / 'refresh-findings.json', tmp / 'refresh-repair-report.json'
    finding_file.write_text(json.dumps(findings))
    # No PR code, package scripts, dependencies, or workflow definitions are executed.
    command(['pnpm', 'exec', 'tsx', 'rankings-engine/scripts/repair-refresh.ts', EXPECTED,
             trusted, arena, str(finding_file), str(report_file)])
    for gate in [
        ['pnpm', 'recompute-check'], ['pnpm', 'typecheck'], ['pnpm', 'lint'],
        ['pnpm', 'test', '--maxWorkers=2'], ['pnpm', 'manifest:check'],
    ]:
        command(gate)
    # Verify the fixed data with the same stability predicate used by CI before publishing.
    command(['git', 'add', 'open-rankings', 'rankings-engine/cache', 'README.md'])
    tree = output(['git', 'write-tree'])
    report = json.loads(report_file.read_text())
    report.update(pr=NUMBER, runId=RUN_ID, originalThreads=[finding['id'] for finding in findings],
                  findingSnapshots={finding['id']:finding_fingerprint(finding) for finding in findings},phase='validated')
    report_file.write_text(json.dumps(report, indent=2))
    message = (f'chore(story-runner): repair {arena} judgments and projections\n\n'
               f'Refresh-Repair-Attempt: {rounds + 1}\n'
               f'Refresh-Repair-Base: {trusted}\n'
               f'Refresh-Repair-Run: {RUN_ID}\n'
               f'Restored-Churn-Cells: {len(report["restored"])}\n')
    parents = ['-p', EXPECTED]
    if output(['git', 'merge-base', EXPECTED, trusted]) != trusted:
        parents += ['-p', trusted]
    new_sha = output(['git', 'commit-tree', tree, *parents, '-m', message])
    command(['node', 'rankings-engine/scripts/check-refresh-stability.mjs', trusted, new_sha])
    if api(f'repos/{REPO}/branches/main')['commit']['sha'] != trusted:
        raise RuntimeError('Main changed during validation; discard and retry against its new head')
    live = current()
    if not identity(live) or live['head']['sha'] != EXPECTED:
        raise RuntimeError('PR changed or automation opt-in was removed during checks; discarding repair')
    if api(f'repos/{REPO}/actions/workflows/refresh-repair.yml')['state'] != 'active':
        raise RuntimeError('Repair workflow was paused during checks; discarding repair')
    if review_active(EXPECTED):
        report.update(phase='waiting-review', blocked='Review became active before publication; head unchanged')
        report_file.write_text(json.dumps(report, indent=2))
        print('Review became active; retain the existing head and discard this unpublished candidate')
        return
    # Non-force push rejects a concurrent update, including one after the preceding check.
    command(['git', 'push', 'origin', f'{new_sha}:refs/heads/{branch}'])
    confirm_publication(branch, EXPECTED, new_sha)
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as receipt:
            receipt.write(f'published_head={new_sha}\n')
    report['publishedHead'] = new_sha
    report_file.write_text(json.dumps(report, indent=2))
    report['phase'] = recheck(report, branch, new_sha)
    report_file.write_text(json.dumps(report, indent=2))



def record_failure(error):
    report_file = Path(os.environ['RUNNER_TEMP']) / 'refresh-repair-report.json'
    try:
        report = json.loads(report_file.read_text()) if report_file.exists() else {'pr':NUMBER,'head':EXPECTED}
    except (ValueError, OSError):
        report = {'pr':NUMBER,'head':EXPECTED,'unreadablePreviousReport':True}
    report.update(blocked=str(error), failedStage=STAGE, phase='error')
    report_file.write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        record_failure(error)
        raise
