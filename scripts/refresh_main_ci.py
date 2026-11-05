"""Recover missing current-main CI after an authenticated internal native merge."""
import json
import os
import re
import subprocess
import time
from refresh_policy import actions_author, family, verify_provenance


def api(path, data=None):
    args = ['gh', 'api', path]
    if data is not None:
        args += ['--method', 'POST', '--input', '-']
    result = subprocess.check_output(args, input=json.dumps(data) if data is not None else None, text=True)
    value = json.loads(result) if result.strip() else None
    if isinstance(value, dict) and value.get('errors'):
        raise RuntimeError('Repository control lookup failed')
    return value


def recover(repo, read=api, pause=time.sleep):
    if repo != 'ultrametricai/ultrametric':
        raise RuntimeError('Unexpected repository')
    prefix = f'repos/{repo}/'
    def controls():
        result = read('graphql', {'query': '''query {
          repository(owner:"ultrametricai",name:"ultrametric") {
            nameWithOwner autoMergeAllowed defaultBranchRef {name target {oid}}
          }}'''})['data']['repository']
        if result['nameWithOwner'] != repo or result['defaultBranchRef']['name'] != 'main' or result['autoMergeAllowed'] is not True:
            raise RuntimeError('Repository merge controls changed; stop recovery')
        head = result['defaultBranchRef']['target']['oid']
        if not re.fullmatch(r'[a-f0-9]{40}', head or ''):
            raise RuntimeError('Repository default-branch head is unavailable')
        return head
    sha = controls()
    associations = read(prefix + f'commits/{sha}/pulls?per_page=100')
    if len(associations) >= 100:
        raise RuntimeError('Merge association listing is incomplete')
    internal = None
    for item in associations:
        if family(item) is None:
            continue
        pr = read(prefix + f"pulls/{item['number']}")
        if (pr.get('merged') is True and pr.get('merge_commit_sha') == sha and
            actions_author(pr.get('merged_by') or {}) and pr['base']['ref'] == 'main' and
            (pr['head'].get('repo') or {}).get('full_name') == repo):
            verify_provenance(read, repo, pr)
            internal = pr
            break
    if internal is None:
        return 'No internal bot merge at the current main tip'
    workflow = read(prefix + 'actions/workflows/ci.yml')
    if workflow.get('state') != 'active' or workflow.get('path') != '.github/workflows/ci.yml':
        raise RuntimeError('CI is paused or its registered path changed')
    def runs():
        result = read(prefix + f'actions/workflows/ci.yml/runs?head_sha={sha}&per_page=100')
        if result.get('total_count', 100) >= 100:
            raise RuntimeError('CI history exceeds inspection limit')
        return [run for run in result['workflow_runs'] if run.get('workflow_id') == workflow['id']
                and run.get('path') == workflow['path'] and run.get('head_sha') == sha
                and run.get('head_branch') == 'main' and run.get('event') in ('push', 'workflow_dispatch')]
    history = runs()
    if any(run['status'] != 'completed' or run['conclusion'] in ('success', 'failure') for run in history):
        return 'Current main already has CI; completed failures remain visible'
    if len(history) >= 3:
        raise RuntimeError('Current-main CI exhausted three attempts; manual attention required')
    if controls() != sha:
        return 'Main advanced; its new tip will be evaluated on the next sweep'
    read(prefix + 'actions/workflows/ci.yml/dispatches', {'ref': 'main'})
    previous = {run['id'] for run in history}
    for _ in range(10):
        pause(2)
        if any(run['id'] not in previous for run in runs()):
            return f'Confirmed CI started on current main {sha}'
        if controls() != sha:
            return 'Main advanced during dispatch; no historical-SHA claim made'
    raise RuntimeError('CI dispatch outcome not yet confirmed; inspect before retrying')


if __name__ == '__main__':
    print(recover(os.environ['REPO']))
