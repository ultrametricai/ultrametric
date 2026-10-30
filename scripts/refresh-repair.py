"""Trusted-main repair controller. PR refs are read only as allowlisted JSON data."""
import json
import os
import re
import subprocess
import time
from pathlib import Path

REPO = os.environ['REPO']
NUMBER = int(os.environ['PR_NUMBER'])
EXPECTED = os.environ['PR_HEAD']
MAX_ROUNDS = 3

def command(args, **kwargs):
    return subprocess.run(args, text=True, check=True, **kwargs)

def output(args):
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

def threads():
    query = '''query($owner:String!, $name:String!, $number:Int!, $cursor:String) {
      repository(owner:$owner,name:$name) { pullRequest(number:$number) {
        headRefOid reviewThreads(first:100,after:$cursor) {
          pageInfo {hasNextPage endCursor}
          nodes {id isResolved path originalLine comments(first:1) {nodes {
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
            comment = thread['comments']['nodes'][0] if thread['comments']['nodes'] else None
            if (thread['isResolved'] or not comment or (comment.get('author') or {}).get('login')
                    not in ['greptile-apps', 'greptile-apps[bot]']):
                continue
            if thread['originalLine'] is None or not comment.get('originalCommit'):
                continue
            findings.append({'id': thread['id'], 'path': thread['path'], 'line': thread['originalLine'],
                             'commit': comment['originalCommit']['oid'], 'body': comment['body']})
        page = pr['reviewThreads']['pageInfo']
        if not page['hasNextPage']:
            return pr['headRefOid'], findings
        cursor = page['endCursor']


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
    if rounds >= MAX_ROUNDS:
        raise RuntimeError('Repair stopped after three published attempts; human review required')
    sha, findings = threads()
    if sha != EXPECTED:
        raise RuntimeError('PR changed while collecting review context')
    checks = api(f'repos/{REPO}/commits/{EXPECTED}/check-runs?per_page=100')['check_runs']
    healthy = all(any(c['name'] == name and c['app']['id'] == 15368 and c['conclusion'] == 'success'
                      for c in checks) for name in ['validation', 'ci'])
    if not findings and healthy and output(['git', 'merge-base', trusted, EXPECTED]) == trusted:
        print('PR is current and healthy; no repair needed')
        return
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
    message = (f'chore(story-runner): repair {arena} judgments and projections\n\n'
               f'Refresh-Repair-Attempt: {rounds + 1}\n'
               f'Refresh-Repair-Base: {trusted}\n'
               f'Restored-Churn-Cells: {len(report["restored"])}\n')
    parents = ['-p', EXPECTED]
    if output(['git', 'merge-base', EXPECTED, trusted]) != trusted:
        parents += ['-p', trusted]
    new_sha = output(['git', 'commit-tree', tree, *parents, '-m', message])
    if current()['head']['sha'] != EXPECTED:
        raise RuntimeError('PR changed during checks; discarding repair')
    # Non-force push rejects a concurrent update, including one after the preceding check.
    command(['git', 'push', 'origin', f'{new_sha}:refs/heads/{branch}'])
    report['publishedHead'] = new_sha
    report_file.write_text(json.dumps(report, indent=2))
    command(['gh', 'workflow', 'run', 'ci.yml', '--repo', REPO, '--ref', branch])
    command(['gh', 'pr', 'comment', str(NUMBER), '--repo', REPO, '--body', '@greptileai review'])
    # Fresh independent review and CI must finish before audited old threads may close.
    reviewed = False
    for _ in range(24):
        time.sleep(25)
        pr = current()
        if pr['state'] != 'open' or pr['head']['sha'] != new_sha:
            print('PR closed or changed after repair; leaving findings intact')
            return
        checks = api(f'repos/{REPO}/commits/{new_sha}/check-runs?per_page=100')['check_runs']
        required = {'ci': 15368, 'validation': 15368, 'Greptile Review': 867647}
        if all(any(c['name'] == name and c['app']['id'] == app and c['status'] == 'completed'
                   and c['conclusion'] == 'success' for c in checks) for name, app in required.items()):
            reviewed = True
            break
    if not reviewed:
        print('Recheck remains incomplete or failing; the next loop handles the new head')
        return
    sha, remaining = threads()
    if sha != new_sha:
        return
    original_ids = {finding['id'] for finding in findings}
    new_findings = [finding for finding in remaining if finding['id'] not in original_ids]
    # A new finding on the verdict matrix keeps old findings open for another bounded pass.
    if not any(finding['path'] == f'open-rankings/{arena}/verdicts.json' for finding in new_findings):
        live_ids = {finding['id'] for finding in remaining}
        for audit in report['audits']:
            if audit['addressed'] and audit['thread'] in original_ids and audit['thread'] in live_ids:
                if current()['head']['sha'] != new_sha:
                    return
                api('graphql', {'query': 'mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}',
                                'variables': {'id': audit['thread']}})
    command(['gh', 'workflow', 'run', 'review-findings.yml', '--repo', REPO, '--ref', 'main', '--field', f'pr={NUMBER}'])
    command(['gh', 'pr', 'merge', str(NUMBER), '--repo', REPO, '--auto', '--merge', '--match-head-commit', new_sha])
    print(f'#{NUMBER}: repaired and independently rechecked; auto-merge remains gated')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        report_file = Path(os.environ['RUNNER_TEMP']) / 'refresh-repair-report.json'
        if not report_file.exists():
            report_file.write_text(json.dumps({'pr':NUMBER,'head':EXPECTED,'blocked':str(error)}, indent=2))
        raise
