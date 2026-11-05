"""Exact-commit intent for interrupted refresh base updates; metadata only."""
import re
from refresh_policy import canonical_artifact, family, verify_provenance


def intent_name(plan):
    if (plan.get('family') not in ('story-runner', 'vendor-radar', 'vendor-radar-bringup') or
            type(plan.get('pr')) is not int or plan['pr'] <= 0 or
            any(not isinstance(plan.get(key), str) or not re.fullmatch(r'[a-f0-9]{40}', plan[key])
                for key in ('head', 'previous', 'main', 'tree')) or
            len({plan['head'], plan['previous'], plan['main']}) != 3):
        raise RuntimeError('Invalid base-update intent')
    return '-'.join(['internal-refresh-update', plan['family'], str(plan['pr']),
                     plan['head'], plan['previous'], plan['main'], plan['tree']])


def check_commit(plan, commit):
    intent_name(plan)
    if (commit.get('sha') != plan['head'] or commit.get('tree', {}).get('sha') != plan['tree'] or
            [parent.get('sha') for parent in commit.get('parents', [])] != [plan['previous'], plan['main']]):
        raise RuntimeError('Planned update differs from its exact commit, tree or ordered parents')


def verify_update_intent(api, repo, pr):
    """A distinct intent can restore a receipt only after this exact head is observed.

    A different SHA with identical parents/tree is not the planned commit. The
    ordinary findings gate never accepts intent artifacts directly.
    """
    kind, head = family(pr), pr['head']['sha']
    if kind is None or not re.fullmatch(r'[a-f0-9]{40}', head):
        raise RuntimeError('Invalid update head')
    commit = api(f'repos/{repo}/git/commits/{head}')
    parents = commit.get('parents', [])
    if len(parents) != 2:
        raise RuntimeError('Unattested head is not a planned base update')
    plan = {'family': kind, 'pr': pr['number'], 'head': head,
            'previous': parents[0].get('sha'), 'main': parents[1].get('sha'),
            'tree': commit.get('tree', {}).get('sha')}
    check_commit(plan, commit)
    if not canonical_artifact(api, repo, intent_name(plan), {'.github/workflows/refresh-automerge.yml'}):
        raise RuntimeError('No canonical intent for this exact update head')
    prior = {**pr, 'head': {**pr['head'], 'sha': plan['previous']}}
    verify_provenance(api, repo, prior)
    if api(f"repos/{repo}/compare/{plan['main']}...main").get('status') not in ('ahead', 'identical'):
        raise RuntimeError('Planned base is no longer in main history')
    return plan
