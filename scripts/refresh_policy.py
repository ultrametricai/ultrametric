"""Pure policy for generated story/radar content; never executes candidate code."""
import re

ACTIONS_BOT = {'id': 41898282, 'login': 'github-actions[bot]', 'type': 'Bot'}
HOLDS = {'automerge-hold', 'do-not-merge', 'hold', 'manual-merge'}


def family(pr):
    match = re.fullmatch(r'(story-runner|vendor-radar|vendor-radar-bringup)/[A-Za-z0-9_-]+',
                         pr.get('head', {}).get('ref', ''))
    return match.group(1) if match else None


def actions_author(author):
    return all(author.get(key) == value for key, value in ACTIONS_BOT.items())


def held(pr):
    labels = pr.get('labels')
    return (not isinstance(labels, list) or
            any(not isinstance(label.get('name'), str) or label['name'].lower() in HOLDS
                for label in labels))


def allowed_path(kind, path):
    if (not isinstance(path, str) or not path or
            any(part in ('', '.', '..') for part in path.split('/'))):
        return False
    if kind == 'vendor-radar':
        return bool(re.fullmatch(
            r'(reports/vendor-radar/[A-Za-z0-9_./-]+\.(json|md)'
            r'|reports/radar-imports/manifests/[a-f0-9]{64}\.json'
            r'|reports/radar-imports/files/[a-f0-9]{64}/reports/vendor-radar/[A-Za-z0-9_./-]+\.(json|md)'
            r'|rankings-engine/radar-discoveries/[A-Za-z0-9_./-]+\.json)', path))
    if kind not in ('story-runner', 'vendor-radar-bringup'):
        return False
    if kind == 'story-runner' and re.fullmatch(
            r'rankings-engine/cache/refresh-retention/[a-z0-9][a-z0-9-]*/decisions\.json', path):
        return True
    if path == 'README.md' or re.fullmatch(r'rankings-engine/cache/judge/[A-Za-z0-9_./-]+\.json', path):
        return True
    if re.fullmatch(r'open-rankings/(graph|step-rankings|predictions)\.json', path):
        return True
    if re.fullmatch(r'open-rankings/(slo-history/[A-Za-z0-9_.-]+\.jsonl|reviews/generated/[A-Za-z0-9_./-]+\.json)', path):
        return True
    if re.fullmatch(r'open-rankings/[a-z0-9-]+/((evidence|claims)/[a-z0-9-]+\.json|'
                    r'(verdicts|rankings|rollups|score-intervals|popularity)\.json|'
                    r'(score-history|popularity-history)\.jsonl)', path):
        return True
    return kind == 'vendor-radar-bringup' and bool(re.fullmatch(
        r'open-rankings/[a-z0-9-]+/products\.json', path))


def check_scope(kind, files, expected_count, mode):
    if (not isinstance(expected_count, int) or not 0 < expected_count < 3000 or
            len(files) != expected_count):
        raise RuntimeError('Generated-content file list is incomplete or exceeds the inspection limit')
    for file in files:
        path = file.get('filename')
        if (file.get('status') not in ('added', 'modified') or file.get('previous_filename') or
                not allowed_path(kind, path)):
            raise RuntimeError('Generated-content scope changed; manual merge required')
        if kind == 'vendor-radar-bringup' and path.endswith('/products.json') and file['status'] != 'modified':
            raise RuntimeError('Creating an arena requires an ordinary maintainer PR')
        if mode(path) != '100644':
            raise RuntimeError('Generated content must be regular non-executable files')


class MissingProvenance(RuntimeError):
    """No canonical receipt; API failures must not enter the intent fallback."""


def canonical_artifact(api, repo, name, allowed):
    """Authenticate immutable artifact metadata without downloading its content."""
    records = api(f'repos/{repo}/actions/artifacts?name={name}&per_page=100')
    if records.get('total_count', 100) >= 100:
        raise RuntimeError('Provenance artifact listing exceeds inspection limit')
    for artifact in records['artifacts']:
        if artifact.get('name') != name or artifact.get('expired') is not False:
            continue
        run_id = artifact.get('workflow_run', {}).get('id')
        if not isinstance(run_id, int):
            continue
        run = api(f'repos/{repo}/actions/runs/{run_id}')
        if (run.get('id') != run_id or run.get('path') not in allowed or run.get('head_branch') != 'main'
            or run.get('event') not in ('schedule', 'workflow_dispatch', 'workflow_run', 'push')
            or (run.get('repository') or {}).get('full_name') != repo
            or (run.get('head_repository') or {}).get('full_name') != repo
            or run.get('status') != 'completed' or not re.fullmatch(r'[a-f0-9]{40}', run.get('head_sha', ''))):
            continue
        workflow = api(f"repos/{repo}/actions/workflows/{run['path'].split('/')[-1]}")
        if workflow.get('id') != run.get('workflow_id') or workflow.get('path') != run['path'] or workflow.get('state') != 'active':
            continue
        source = api(f"repos/{repo}/compare/{run['head_sha']}...main")
        if source.get('status') in ('ahead', 'identical'):
            return True
    return False


def verify_provenance(api, repo, pr):
    """Artifact names are immutable run-bound receipts, not PR-supplied labels."""
    kind, head = family(pr), pr['head']['sha']
    if kind is None or not re.fullmatch(r'[a-f0-9]{40}', head):
        raise RuntimeError('Invalid internal refresh head')
    allowed = {'.github/workflows/refresh-automerge.yml',
               '.github/workflows/story-runner.yml' if kind == 'story-runner' else '.github/workflows/vendor-radar.yml'}
    if kind == 'story-runner':
        allowed.add('.github/workflows/refresh-repair.yml')
    if not canonical_artifact(api, repo, f"internal-refresh-{kind}-{pr['number']}-{head}", allowed):
        raise MissingProvenance('No canonical main workflow receipt for this exact head; manual review required')


if __name__ == '__main__':
    # Publication preflight uses local Git metadata only, before any remote write.
    import subprocess
    import sys
    import os
    import json
    from pathlib import Path
    names = subprocess.check_output(['git', 'diff', '--name-status', '--no-renames', '-z', 'HEAD^', 'HEAD']).decode().split('\0')[:-1]
    files = [{'status': {'A': 'added', 'M': 'modified'}.get(names[i], names[i]),
              'filename': names[i + 1]} for i in range(0, len(names), 2)]
    tree = subprocess.check_output(['git', 'ls-tree', '-r', '-z', 'HEAD']).decode().split('\0')[:-1]
    modes = {entry.split('\t', 1)[1]: entry.split(' ', 1)[0] for entry in tree}
    check_scope(sys.argv[1], files, len(files), modes.get)
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    if os.environ.get('RUNNER_TEMP'):
        (Path(os.environ['RUNNER_TEMP']) / (sys.argv[1] + '-head.json')).write_text(json.dumps({'head': head, 'family': sys.argv[1]}))
    if len(sys.argv) > 2 and sys.argv[2] == '--published':
        number = int(sys.argv[3].rstrip('/').split('/')[-1])
        repo = os.environ['GITHUB_REPOSITORY']
        pr = json.loads(subprocess.check_output(['gh', 'api', f'repos/{repo}/pulls/{number}'], text=True))
        branch = subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip()
        if (pr['state'] != 'open' or pr['head']['sha'] != head or pr['head']['ref'] != branch or
            (pr['head'].get('repo') or {}).get('full_name') != repo or family(pr) != sys.argv[1]):
            raise RuntimeError('Published PR no longer matches the checked local head')
        if not os.environ.get('GITHUB_OUTPUT'):
            raise RuntimeError('Missing workflow output destination')
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write(f'published_head={head}\npublished_pr={number}\n')
