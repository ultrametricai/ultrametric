"""Trusted-main repair controller. PR refs are read only as allowlisted JSON data."""
import json
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

def output(args):
    global STAGE
    STAGE = " ".join(args[:4])
    return subprocess.check_output(args, text=True).strip()

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
    return (pr['state'] == 'open' and not pr['draft'] and pr['base']['ref'] == 'main'
            and pr['head']['repo'] is not None and pr['head']['repo']['full_name'] == REPO
            and pr['user']['login'] == 'github-actions[bot]'
            and re.fullmatch(r'story-runner/([a-z0-9-]+)-[0-9]+', pr['head']['ref']))

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
                continue
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


def recheck(report, branch, new_sha):
    original_ids = set(report['originalThreads'])
    runs = api(f'repos/{REPO}/actions/workflows/ci.yml/runs?head_sha={new_sha}&per_page=100')
    if not runs['workflow_runs']:
        command(['gh', 'workflow', 'run', 'ci.yml', '--repo', REPO, '--ref', branch])
    checks = api(f'repos/{REPO}/commits/{new_sha}/check-runs?per_page=100')['check_runs']
    if not any(check['app']['id'] == 867647 for check in checks):
        command(['gh', 'pr', 'comment', str(NUMBER), '--repo', REPO, '--body', '@greptileai review'])
    reviewed = False
    for _ in range(24):
        pr = current()
        if pr['state'] != 'open' or pr['head']['sha'] != new_sha:
            return 'closed-or-changed'
        checks = api(f'repos/{REPO}/commits/{new_sha}/check-runs?per_page=100')['check_runs']
        if any(c['name'] in ['ci', 'validation'] and c['app']['id'] == 15368
               and c['status'] == 'completed' and c['conclusion'] == 'failure' for c in checks):
            return 'needs-repair'
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
            if current()['head']['sha'] != new_sha:
                return 'closed-or-changed'
            api('graphql', {'query': 'mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}',
                            'variables': {'id': audit['thread']}})
    command(['gh', 'workflow', 'run', 'review-findings.yml', '--repo', REPO, '--ref', 'main', '--field', f'pr={NUMBER}'])
    addressed = {audit['thread'] for audit in report['audits'] if audit['addressed']}
    if (live_ids & original_ids) - addressed:
        return 'needs-repair'
    command(['gh', 'pr', 'merge', str(NUMBER), '--repo', REPO, '--auto', '--merge', '--match-head-commit', new_sha])
    print(f'#{NUMBER}: repaired and independently rechecked; auto-merge remains gated')
    return 'rechecked'


def main():
    pr = current()
    if pr['state'] != 'open':
        print('PR is already closed; no repair needed')
        return
    match = identity(pr)
    if not match or pr['head']['sha'] != EXPECTED or not re.fullmatch('[0-9a-f]{40}', EXPECTED):
        raise RuntimeError('PR identity or expected head changed; no repair performed')
    branch, arena = pr['head']['ref'], match.group(1)
    trusted = output(['git', 'rev-parse', 'HEAD'])
    command(['git', 'fetch', '--no-tags', 'origin', f'refs/heads/{branch}:refs/repair/head'])
    if output(['git', 'rev-parse', 'refs/repair/head']) != EXPECTED:
        raise RuntimeError('Fetched branch no longer matches the requested head')
    base = output(['git', 'merge-base', trusted, EXPECTED])
    messages = output(['git', 'log', '--format=%B', f'{base}..{EXPECTED}'])
    rounds = len(re.findall(r'^Refresh-Repair-Attempt: [1-3]$', messages, re.MULTILINE))
    previous = load_resume_report(EXPECTED, trusted)
    if previous is not None:
        report_file = Path(os.environ['RUNNER_TEMP']) / 'refresh-repair-report.json'
        report_file.write_text(json.dumps(previous, indent=2))
        previous['phase'] = recheck(previous, branch, EXPECTED)
        report_file.write_text(json.dumps(previous, indent=2))
        if previous['phase'] != 'needs-repair':
            return
    sha, findings = threads()
    if sha != EXPECTED:
        raise RuntimeError('PR changed while collecting review context')
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
    if current()['head']['sha'] != EXPECTED:
        raise RuntimeError('PR changed during checks; discarding repair')
    # Non-force push rejects a concurrent update, including one after the preceding check.
    command(['git', 'push', 'origin', f'{new_sha}:refs/heads/{branch}'])
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
