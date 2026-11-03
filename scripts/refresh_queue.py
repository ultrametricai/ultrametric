"""Read-only ordering guard shared by refresh dispatch, workers and generation.

Manual pauses remain queue barriers: a draft or disabled auto-merge does not
authorize processing a newer managed PR. Unrelated human PRs are outside this
queue. This module never changes PR state or requests a review.
"""
import argparse
import json
import os
import re
import subprocess


def managed(pr, repo):
    return (pr['state'] == 'open' and pr['base']['ref'] == 'main'
            and (pr['head'].get('repo') or {}).get('full_name') == repo
            and pr['user']['login'] == 'github-actions[bot]'
            and re.fullmatch(r'(story-runner|accuracy-engine|vendor-radar|vendor-radar-bringup|yc-coverage)/[A-Za-z0-9_-]+',
                             pr['head']['ref']))


def oldest(prs, repo):
    return min((pr for pr in prs if managed(pr, repo)), key=lambda pr: pr['number'], default=None)


def allows(repo, number=None):
    pages = json.loads(subprocess.check_output(
        ['gh', 'api', '--paginate', '--slurp', f'repos/{repo}/pulls?state=open&per_page=100'], text=True))
    first = oldest([pr for page in pages for pr in page], repo)
    allowed = first is None if number is None else first is not None and first['number'] == number
    if not allowed:
        print(f"Refresh queue waits for #{first['number']}" if first else 'Requested PR is no longer in the refresh queue')
    return allowed


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--generation', action='store_true', help='Write an allow job output; do not fail when waiting')
    modes.add_argument('--require-empty', action='store_true', help='Stop publication if a refresh PR appeared')
    modes.add_argument('--pr', type=int, help='Require this PR to be the oldest managed PR')
    args = parser.parse_args()
    allowed = allows(os.environ['REPO'], args.pr)
    if args.generation:
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write(f'allow={str(allowed).lower()}\n')
    elif not allowed:
        raise SystemExit(1)
