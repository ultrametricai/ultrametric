"""Serialized, durable paid-review requests. Execute only from the main workflow.

The reservation is written BEFORE the mention. A crash or ambiguous API response
consumes the attempt, so the next run cannot immediately issue a duplicate request.
GitHub's per-PR workflow concurrency serializes all callers of this controller.
"""
import datetime as dt
import json
from refresh_policy import actions_author, held, family, verify_provenance
import os
import re
import subprocess

MARKER = 'refresh-review-reservation:v1'
COOLDOWN = dt.timedelta(hours=1)
MAX_REQUESTS = 2
BOT = 'github-actions[bot]'


def api(repo, path, data=None):
    args = ['gh', 'api', f'repos/{repo}/{path}']
    if data is not None:
        args += ['--method', 'POST', '--input', '-']
    result = subprocess.run(args, input=json.dumps(data) if data is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout) if result.stdout.strip() else None


def eligible(pr, repo, head):
    content_bot = os.environ.get('CONTENT_BOT_LOGIN', '')
    if content_bot and not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\[bot\]', content_bot):
        print('::warning::Invalid CONTENT_BOT_LOGIN; configured App review requests are disabled')
        content_bot = ''
    radar_app = (bool(content_bot) and pr['user']['login'] == content_bot
                 and pr['user'].get('type') == 'Bot'
                 and re.fullmatch(r'vendor-radar(?:-bringup)?/[A-Za-z0-9_-]+', pr['head']['ref']))
    return (pr['state'] == 'open' and not pr['draft'] and bool(pr['auto_merge'])
            and pr['base']['ref'] == 'main' and pr['head']['sha'] == head
            and pr['head']['repo'] is not None and pr['head']['repo']['full_name'] == repo
            and (actions_author(pr['user']) or radar_app) and not held(pr)
            and re.fullmatch(r'(story-runner|accuracy-engine|vendor-radar|vendor-radar-bringup|yc-coverage)/[A-Za-z0-9_-]+', pr['head']['ref']))


def reservations(comments, head):
    result = []
    for comment in comments:
        if not actions_author(comment['user']):
            continue
        match = re.search(r'<!-- ' + MARKER + r' (\{[^\n]+\}) -->', comment['body'])
        if not match:
            continue
        record = json.loads(match.group(1))
        if record['head'] == head:
            # Use GitHub's timestamp rather than a caller-supplied clock.
            result.append(dt.datetime.fromisoformat(comment['created_at'].replace('Z', '+00:00')))
    return result


def next_request(checks, reserved, now):
    reviews = [c for c in checks if c['name'] == 'Greptile Review' and c['app']['id'] == 867647]
    latest = max(reviews, key=lambda c: c['id']) if reviews else None
    if latest and (latest['status'] != 'completed' or latest['conclusion'] == 'success'):
        return None
    if len(reserved) >= MAX_REQUESTS:
        raise RuntimeError('Review request budget exhausted on this head; human attention required')
    if latest and not reserved:
        raise RuntimeError('Existing unsuccessful review has no managed reservation; human attention required')
    if reserved and now - max(reserved) < COOLDOWN:
        return None
    return len(reserved) + 1


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


def request(repo, number, head, now=None):
    if not re.fullmatch('[a-f0-9]{40}', head):
        raise RuntimeError('Invalid expected head')
    now = now or dt.datetime.now(dt.timezone.utc)
    if api(repo, 'actions/workflows/refresh-automerge.yml')['state'] != 'active':
        print('Refresh recovery is paused; no review requested')
        return
    current = api(repo, f'pulls/{number}')
    if not eligible(current, repo, head):
        print('PR changed or automation opt-in was removed; no review requested')
        return
    if family(current):
        verify_provenance(lambda path: api(repo, path.removeprefix(f'repos/{repo}/')), repo, current)
    runs = api(repo, f'actions/workflows/ci.yml/runs?head_sha={head}&per_page=100')['workflow_runs']
    newest = usable_ci_run(runs)
    if newest is None:
        return
    # Read the exact CI suite, not similarly named checks from another workflow.
    checks = api(repo, f'commits/{head}/check-runs?per_page=100')['check_runs']
    if not all(any(c['name'] == name and c['app']['id'] == 15368
                   and c.get('check_suite', {}).get('id') == newest['check_suite_id']
                   and c['status'] == 'completed' and c['conclusion'] == 'success' for c in checks)
               for name in ['validation', 'ci']):
        return
    pages = json.loads(subprocess.check_output(
        ['gh', 'api', '--paginate', '--slurp', f'repos/{repo}/issues/{number}/comments?per_page=100'], text=True))
    attempt = next_request(checks, reservations([c for page in pages for c in page], head), now)
    if attempt is None:
        return
    if not eligible(api(repo, f'pulls/{number}'), repo, head):
        return
    record = json.dumps({'head': head, 'attempt': attempt}, separators=(',', ':'))
    api(repo, f'issues/{number}/comments', {
        'body': f'<!-- {MARKER} {record} -->\nReview request {attempt}/{MAX_REQUESTS} reserved for `{head}` after CI passed.'})
    # A reservation with no receipt is deliberately left in place on errors.
    if not eligible(api(repo, f'pulls/{number}'), repo, head):
        return
    if api(repo, 'actions/workflows/refresh-automerge.yml')['state'] != 'active':
        return
    api(repo, f'issues/{number}/comments', {'body': f'@greptileai review\n\nReserved refresh head: `{head}`; attempt {attempt}/{MAX_REQUESTS}.'})


if __name__ == '__main__':
    request(os.environ['REPO'], int(os.environ['PR_NUMBER']), os.environ['PR_HEAD'])
