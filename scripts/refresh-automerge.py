"""Metadata-only refresh recovery, shared by planning and exact-head application."""
import json, os, re, subprocess, time
from refresh_policy import family, verify_provenance, MissingProvenance
from refresh_update import check_commit, intent_name, verify_update_intent
repo = os.environ['REPO']
def api(path, method='GET', data=None, token=None):
    args = ['gh', 'api', '--method', method, 'graphql' if path == 'graphql' else f'repos/{repo}/{path}']
    if data is not None:
        args += ['--input', '-']
    result = subprocess.run(args, input=json.dumps(data) if data is not None else None,
                            text=True, capture_output=True, check=True,
                            **({'env': {**os.environ, 'GH_TOKEN': token}} if token else {}))
    return json.loads(result.stdout) if result.stdout.strip() else None
def actions_author(author):
    return (author.get('id') == 41898282 and author.get('login') == 'github-actions[bot]'
            and author.get('type') == 'Bot')
def held(pr):
    labels = pr.get('labels')
    return (not isinstance(labels, list) or any(label.get('name', '').lower() in
            ['automerge-hold', 'do-not-merge', 'hold', 'manual-merge'] for label in labels))
content_bot = os.environ.get('CONTENT_BOT_LOGIN', '')
if content_bot and not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\[bot\]', content_bot):
    print('::warning::Invalid CONTENT_BOT_LOGIN; configured App recovery is disabled', flush=True)
    content_bot = ''
def radar_app_author(pr):
    return (bool(content_bot) and pr['user']['login'] == content_bot
            and pr['user'].get('type') == 'Bot'
            and re.fullmatch(r'vendor-radar(?:-bringup)?/[A-Za-z0-9_-]+', pr['head']['ref']))

prs = json.loads(subprocess.check_output(
    ['gh', 'api', '--paginate', '--slurp', f'repos/{repo}/pulls?state=open&per_page=100'], text=True))
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

def needs_ci_dispatch(runs):
    # Approval-required records have no jobs. Keep active runs and real
    # results from either event: an approved PR run can finish after a
    # cancelled dispatch despite having an older run ID.
    dispatches = [run for run in runs if run['event'] == 'workflow_dispatch']
    candidates = [run for run in runs if run['conclusion'] != 'action_required']
    if any(run['status'] != 'completed' for run in candidates):
        return False
    if usable_ci_run(runs) is not None:
        return False # real failures stay with the existing repair/review gates
    # Bound same-head retries when CI is cancelled or cannot start.
    # A new head gets its own budget; the approval-only runs do not count.
    if len(dispatches) >= 3:
        raise RuntimeError('CI ended without a result and exhausted three dispatches on this head; human review required')
    return True

def failed_validation(runs, checks):
    newest = usable_ci_run(runs)
    if newest is None:
        return False
    return any(check['name'] in ['validation', 'ci'] and check['app']['id'] == 15368
               and check.get('check_suite', {}).get('id') == newest.get('check_suite_id')
               and check['status'] == 'completed' and check['conclusion'] == 'failure'
               for check in checks)

def review_active(sha):
    page = 1
    while True:
        checks = api(f'commits/{sha}/check-runs?check_name=Greptile%20Review&filter=all&per_page=100&page={page}')['check_runs']
        if any(check['name'] == 'Greptile Review' and check['app']['id'] == 867647
               and check['status'] != 'completed' for check in checks):
            return True
        if len(checks) < 100:
            return False
        page += 1

def request_repair(pr, sha):
    if not pr['head']['ref'].startswith('story-runner/'):
        return
    if review_active(sha):
        print(f"#{pr['number']}: review is active; defer repair on this head", flush=True)
        return
    title = f"Repair refresh #{pr['number']} @{sha} [support-loss-v2]"
    history = api('actions/workflows/refresh-repair.yml/runs?per_page=100')['workflow_runs']
    # Retry failed workers at most three times; waiting resumes are read-only.
    # Published repairs create a new
    # head. The worker also caps the total published repair commits at three.
    previous = [run for run in history if run['display_title'] == title]
    if any(run['status'] != 'completed' and run['display_title'].startswith(f"Repair refresh #{pr['number']} @") for run in history):
        return
    if sum(run['conclusion'] in ['failure','timed_out','cancelled'] for run in previous) >= 3:
        return
    if sum(run['status'] != 'completed' for run in history) >= 2:
        return # bound concurrent repair workers and model spend
    subprocess.run(['gh', 'workflow', 'run', 'refresh-repair.yml', '--repo', repo,
                    '--ref', 'main', '--field', f"pr={pr['number']}",
                    '--field', f'head={sha}'], check=True)

def has_findings(number, verdict_only=True):
    query = """query($owner:String!,$name:String!,$number:Int!,$cursor:String) {
      repository(owner:$owner,name:$name) { pullRequest(number:$number) {
        reviewThreads(first:100,after:$cursor) {pageInfo {hasNextPage endCursor}
          nodes {isResolved path comments(first:1){nodes{author{login}}}}}
      }}}"""
    owner, name = repo.split('/')
    cursor = None
    while True:
        result = subprocess.run(['gh', 'api', 'graphql', '--method', 'POST', '--input', '-'],
            input=json.dumps({'query':query,'variables':{'owner':owner,'name':name,'number':number,'cursor':cursor}}),
            text=True,capture_output=True,check=True)
        data = json.loads(result.stdout)
        if data.get('errors'):
            raise RuntimeError(data['errors'])
        threads = data['data']['repository']['pullRequest']['reviewThreads']
        if any(not t['isResolved'] and (not verdict_only or t['path'].endswith('/verdicts.json')) and
               any((c.get('author') or {}).get('login') in ['greptile-apps','greptile-apps[bot]','greptileai']
                   for c in t['comments']['nodes']) for t in threads['nodes']):
            return True
        if not threads['pageInfo']['hasNextPage']:
            return False
        cursor = threads['pageInfo']['endCursor']

def checks_allow_update(checks):
    latest = {}
    for check in checks:
        key = (check['name'], check['app']['id'])
        if key not in latest or check['id'] > latest[key]['id']:
            latest[key] = check
    return all(key in latest and latest[key]['status'] == 'completed'
               and latest[key]['conclusion'] == 'success'
               for key in [('validation',15368), ('ci',15368), ('Greptile Review',867647)])

def rules_require_current_base():
    # This public repository uses rulesets. Read every active rule that
    # applies to main, including inherited rules, without admin access.
    page = 1
    while True:
        rules = api(f'rules/branches/main?per_page=100&page={page}')
        for rule in rules:
            if rule['type'] == 'required_status_checks':
                strict = rule.get('parameters', {}).get('strict_required_status_checks_policy')
                if not isinstance(strict, bool):
                    raise RuntimeError('required-check freshness policy unavailable; human review required')
                if strict:
                    return True
        if len(rules) < 100:
            return False
        page += 1

errors = []
updated = []
planned = []
apply_plan = json.loads(os.environ['REFRESH_UPDATE']) if os.environ.get('REFRESH_UPDATE') else None
if apply_plan:
    intent_name(apply_plan)
for pr in sorted([pr for page in prs for pr in page], key=lambda pr: pr['number']):
    if apply_plan and pr['number'] != apply_plan['pr']:
        continue
    branch = pr['head']['ref']
    if (pr['draft'] or held(pr) or not pr['auto_merge'] or pr['base']['ref'] != 'main'
        or pr['head']['repo'] is None or pr['head']['repo']['full_name'] != repo
        or not (actions_author(pr['user']) or radar_app_author(pr))
        or not re.fullmatch(r'(story-runner|accuracy-engine|vendor-radar|vendor-radar-bringup|yc-coverage)/[A-Za-z0-9_-]+', branch)):
        continue
    number, sha = pr['number'], pr['head']['sha']
    try:
        if apply_plan and (apply_plan['branch'] != branch or apply_plan['family'] != family(pr)
                           or apply_plan['previous'] != sha):
            raise RuntimeError('Planned PR branch, family or previous head changed; no update attempted')
        if family(pr):
            read = lambda path: api(path.removeprefix(f'repos/{repo}/'))
            try:
                verify_provenance(read, repo, pr)
            except MissingProvenance:
                # A prior run may have changed the ref, then lost its response or
                # failed before uploading the receipt. Intent alone is not a gate.
                verify_update_intent(read, repo, pr)
                current = api(f'pulls/{number}')
                if (current['state'] == 'open' and not current['draft'] and not held(current)
                    and current['auto_merge'] and current['base']['ref'] == 'main'
                    and current['head']['sha'] == sha and current['head']['ref'] == branch
                    and (current['head'].get('repo') or {}).get('full_name') == repo
                    and (actions_author(current['user']) or radar_app_author(current))):
                    updated.append({'family': family(current), 'head': sha, 'pr': number})
                continue # wait for the restored ordinary receipt before dispatch
        # New CI runs may not have created check records yet. Preserve
        # their head before considering a base update or conflict repair.
        active_runs = api(f'actions/workflows/ci.yml/runs?head_sha={sha}&per_page=100')['workflow_runs']
        if any(run['status'] != 'completed' and run['conclusion'] != 'action_required' for run in active_runs):
            print(f'#{number}: CI is active; retain the existing head', flush=True)
            continue
        comparison = api(f'compare/main...{sha}')
        head_checks = api(f'commits/{sha}/check-runs?per_page=100')['check_runs']
        conflict = False
        if comparison['behind_by']:
            current = api(f'pulls/{number}')
            if (current['state'] != 'open' or current['draft'] or held(current) or not current['auto_merge']
                or current['head']['sha'] != sha or current['base']['ref'] != 'main'):
                continue # a manual stop or concurrent edit wins over the listing
            conflict = current.get('mergeable') is False
            if not conflict and current.get('mergeable') is not True:
                raise RuntimeError('mergeability is not known yet; retry on next run')
        # Leave pending reviews and unresolved findings on a stable head.
        # Being behind alone does not invalidate a reviewed candidate.
        if (comparison['behind_by'] and not conflict and checks_allow_update(head_checks)
            and not has_findings(number, verdict_only=False) and rules_require_current_base()
            and not review_active(sha)):
            kind = family(current)
            expected_merge = None
            if kind:
                verify_provenance(lambda path: api(path.removeprefix(f'repos/{repo}/')), repo, current)
                main_sha = api('git/ref/heads/main')['object']['sha']
                expected_merge = api(f"git/commits/{current['merge_commit_sha']}")
                expected_parents = [parent['sha'] for parent in expected_merge['parents']]
                if len(expected_parents) != 2 or set(expected_parents) != {sha, main_sha}:
                    raise RuntimeError('Synthetic merge does not match the current internal head')
            update_token = None
            if radar_app_author(current):
                update_token = os.environ.get('CONTENT_BOT_TOKEN', '')
                if not update_token or os.environ.get('CONTENT_BOT_SLUG', '') + '[bot]' != content_bot:
                    raise RuntimeError('Configured radar App token unavailable or identity mismatch; retain this head')
            if kind:
                if not apply_plan:
                    # Create an immutable object, without moving any branch. Its
                    # exact SHA is persisted by the next job before ref mutation.
                    candidate = api('git/commits', 'POST', {
                        'message': f'Update internal refresh #{number} with main {main_sha}',
                        'tree': expected_merge['tree']['sha'], 'parents': [sha, main_sha],
                    }, token=update_token)
                    plan = {'family': kind, 'pr': number, 'branch': branch,
                            'previous': sha, 'main': main_sha, 'tree': expected_merge['tree']['sha'],
                            'head': candidate['sha'], 'app': bool(radar_app_author(current))}
                    check_commit(plan, candidate)
                    planned.append(plan)
                    continue
                if (apply_plan['pr'] != number or apply_plan['family'] != kind or
                    apply_plan['branch'] != branch or apply_plan['previous'] != sha or
                    apply_plan['main'] != main_sha or apply_plan['tree'] != expected_merge['tree']['sha'] or
                    apply_plan['app'] != bool(radar_app_author(current))):
                    raise RuntimeError('Update intent is stale; retain the current head')
                check_commit(apply_plan, api(f"git/commits/{apply_plan['head']}"))
                latest = api(f'pulls/{number}')
                if (latest['state'] != 'open' or latest['draft'] or held(latest) or not latest['auto_merge']
                    or latest['head']['sha'] != sha or latest['head']['ref'] != branch
                    or latest['base']['ref'] != 'main'
                    or (latest['head'].get('repo') or {}).get('full_name') != repo
                    or not (actions_author(latest['user']) or radar_app_author(latest))
                    or api('git/ref/heads/main')['object']['sha'] != main_sha):
                    raise RuntimeError('Update eligibility changed; retain the current head')
                # This job is ordered after a successful immutable intent upload.
                # beforeOid is an atomic compare-and-swap; force:false also
                # prevents non-fast-forward writes. No branch protection bypass.
                result = api('graphql', 'POST', {'query': '''mutation($input:UpdateRefsInput!) {
                  updateRefs(input:$input) {clientMutationId}}''', 'variables': {'input': {
                    'repositoryId': api('')['node_id'], 'refUpdates': [{
                        'name': f'refs/heads/{branch}', 'beforeOid': sha,
                        'afterOid': apply_plan['head'], 'force': False}]}}}, token=update_token)
                if result.get('errors') or result.get('data', {}).get('updateRefs') is None:
                    raise RuntimeError('Atomic branch update was rejected or not confirmed')
            else:
                api(f'pulls/{number}/update-branch', 'PUT', {'expected_head_sha': sha}, token=update_token)
            for _ in range(10):
                time.sleep(2)
                current = api(f'pulls/{number}')
                if current['state'] != 'open':
                    break
                if current['head']['sha'] != sha:
                    sha = current['head']['sha']
                    break
            else:
                raise RuntimeError('branch update has not completed; retry on next run')
            if current['state'] != 'open':
                continue
            if expected_merge is not None:
                if sha != apply_plan['head']:
                    raise RuntimeError('Branch changed to an unplanned head; no provenance recorded')
                actual = api(f'git/commits/{sha}')
                check_commit(apply_plan, actual)
                updated.append({'family': kind, 'head': sha, 'pr': number})
        if apply_plan and not updated:
            continue # this job applies its plan only; a later sweep can replan
        current = api(f'pulls/{number}')
        if (current['state'] != 'open' or current['draft'] or held(current) or not current['auto_merge']
            or current['head']['sha'] != sha or current['base']['ref'] != 'main'
            or current['head']['repo'] is None or current['head']['repo']['full_name'] != repo
            or not (actions_author(current['user']) or radar_app_author(current))):
            continue
        runs = api(f'actions/workflows/ci.yml/runs?head_sha={sha}&per_page=100')
        ci_requested = needs_ci_dispatch(runs['workflow_runs'])
        if ci_requested:
            subprocess.run(['gh', 'workflow', 'run', 'ci.yml', '--repo', repo, '--ref', branch], check=True)
        subprocess.run(['gh', 'workflow', 'run', 'refresh-review.yml', '--repo', repo,
                        '--ref', 'main', '--field', f'pr={number}', '--field', f'head={sha}'], check=True)
        subprocess.run(['gh', 'workflow', 'run', 'review-findings.yml', '--repo', repo,
                        '--ref', 'main', '--field', f'pr={number}'], check=True)
        checks = api(f'commits/{sha}/check-runs?per_page=100')['check_runs']
        if (not ci_requested and usable_ci_run(runs['workflow_runs']) is not None) and (failed_validation(runs['workflow_runs'], checks)
            or (branch.startswith('story-runner/') and has_findings(number))
            or (conflict and checks_allow_update(checks) and not has_findings(number, verdict_only=False))):
            request_repair(pr, sha)
        if conflict:
            print(f'::warning::#{number}: merge conflict remains; same-head CI/review recovery retained', flush=True)
            errors.append(number)
        print(f'#{number}: CI dispatched or present; existing auto-merge opt-in retained', flush=True)
    except (subprocess.CalledProcessError, RuntimeError) as error:
        # Conflicts and setup failures stay visible; process independent PRs too.
        detail = getattr(error, 'stderr', None) or str(error)
        if 'merge conflict between base and head' in detail:
            try:
                request_repair(pr, sha)
            except (subprocess.CalledProcessError, RuntimeError) as repair_error:
                print(f'::warning::#{number}: repair dispatch failed: {repair_error}', flush=True)
        print(f'::warning::#{number}: {detail}', flush=True)
        errors.append(number)
if os.environ.get('GITHUB_OUTPUT'):
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('updated=' + json.dumps(updated) + '\n')
        output.write('planned=' + json.dumps(planned) + '\n')
        if apply_plan and any(item['head'] == apply_plan['head'] for item in updated):
            output.write('published_head=' + apply_plan['head'] + '\n')
if errors:
    raise SystemExit(f'Refresh PRs need attention or retry: {errors}')
