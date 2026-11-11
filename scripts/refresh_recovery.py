"""Explicit, fresh attestation of a replayed no-model repair. Never publishes a commit."""
import copy
import hashlib
import io
import json
import os
import re
import stat
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

SHA = r'[a-f0-9]{40}'
DIGEST = r'[a-f0-9]{64}'
WORKFLOW = '.github/workflows/refresh-repair.yml'
GATES = [['pnpm', 'recompute-check'], ['pnpm', 'typecheck'], ['pnpm', 'lint'],
         ['pnpm', 'test', '--maxWorkers=2'], ['pnpm', 'manifest:check'], ['pnpm', 'shared:check']]
# Recovery may land after the failed run, but unrelated main changes require a
# dedicated repair. Replay and full validation execute the current trusted code.
RECOVERY_CODE = {
    WORKFLOW, 'scripts/refresh-repair.py', 'scripts/refresh_recovery.py',
    'rankings-engine/refresh-repair.ts', 'rankings-engine/scripts/repair-refresh.ts',
    'rankings-engine/stages/derive.ts', 'rankings-engine/scripts/settle-predictions.ts',
    'rankings-engine/__tests__/refresh_repair_controller.py',
    'rankings-engine/__tests__/refresh_recovery_controller.py',
    'rankings-engine/__tests__/refresh-recovery.test.ts',
    'rankings-engine/__tests__/radar-state.test.ts',
    'rankings-engine/__tests__/refresh_producer_controller.py',
    'rankings-engine/__tests__/refresh-repair.test.ts', 'rankings-engine/__tests__/derive.test.ts',
    'scripts/author-automerge.mjs', 'scripts/author-automerge.test.mjs',
    'docs/ACCURACY.md', 'docs/repo-split-census.json', 'open-manifest.json',
}
EMPTY_LISTS = ('originalThreads', 'restored', 'rejudged', 'audits', 'unresolved')


def selected(environ):
    values = [environ.get(key, '') for key in ('RECOVER_RUN', 'RECOVER_ARTIFACT', 'RECOVER_DIGEST')]
    if not any(values):
        return None
    if (not all(values) or not all(re.fullmatch(r'[1-9][0-9]*', value) for value in values[:2])
            or not re.fullmatch(DIGEST, values[2])):
        raise RuntimeError('Receipt recovery requires the exact failed run, artifact ID and SHA-256 digest')
    return tuple(values)


def strict_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise RuntimeError('Duplicate audit JSON key')
            result[key] = value
        return result
    def invalid_constant(value):
        raise ValueError(f'Non-finite audit JSON constant: {value}')
    value = json.loads(text, object_pairs_hook=pairs, parse_constant=invalid_constant)
    if not isinstance(value, dict):
        raise RuntimeError('Audit must be an object')
    return value


def run_metadata(run, repo, run_id, active=False):
    return (type(run.get('id')) is int and str(run['id']) == str(run_id)
            and run.get('path') == WORKFLOW and run.get('head_branch') == 'main'
            and run.get('event') == 'workflow_dispatch'
            and (run.get('repository') or {}).get('full_name') == repo
            and (run.get('head_repository') or {}).get('full_name') == repo
            and re.fullmatch(SHA, run.get('head_sha', ''))
            and run.get('status') == ('in_progress' if active else 'completed'))


def trusted_run(api, output, repo, run_id, trusted, *, active=False, run=None):
    run = api(f'repos/{repo}/actions/runs/{run_id}') if run is None else run
    if not run_metadata(run, repo, run_id, active):
        raise RuntimeError('Recovery run is not the authenticated main repair workflow')
    workflow = api(f'repos/{repo}/actions/workflows/refresh-repair.yml')
    if (workflow.get('path') != WORKFLOW or workflow.get('id') != run.get('workflow_id')
            or workflow.get('state') != 'active'):
        raise RuntimeError('Recovery workflow identity changed or is paused')
    if output(['git', 'merge-base', run['head_sha'], trusted]) != run['head_sha']:
        raise RuntimeError('Recovery run source is outside trusted main history')
    return run


def artifact_report(api, command, repo, artifact_id, run, name, digest=None):
    artifact = api(f'repos/{repo}/actions/artifacts/{artifact_id}')
    binding = artifact.get('workflow_run') or {}
    actual = artifact.get('digest', '')
    if (type(artifact.get('id')) is not int or str(artifact['id']) != str(artifact_id)
            or artifact.get('name') != name or artifact.get('expired') is not False
            or type(artifact.get('size_in_bytes')) is not int or not 0 < artifact['size_in_bytes'] <= 2_000_000
            or binding.get('id') != run['id'] or binding.get('head_sha') != run['head_sha']
            or binding.get('head_branch') != 'main'
            or not re.fullmatch('sha256:' + DIGEST, actual)
            or (digest is not None and actual != 'sha256:' + digest)):
        raise RuntimeError('Recovery artifact identity, digest or bounds do not match')
    with tempfile.TemporaryDirectory(prefix='refresh-receipt-') as directory:
        target = Path(directory) / 'audit.zip'
        with target.open('wb') as stream:
            command(['gh', 'api', f'repos/{repo}/actions/artifacts/{artifact_id}/zip'], stdout=stream)
        if target.stat().st_size > 2_000_000:
            raise RuntimeError('Recovery artifact exceeds its download bound')
        content = target.read_bytes()
    if hashlib.sha256(content).hexdigest() != actual.removeprefix('sha256:'):
        raise RuntimeError('Recovery artifact content digest mismatch')
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        entries = archive.infolist()
        if (len(entries) != 1 or entries[0].filename != 'refresh-repair-report.json'
                or entries[0].is_dir() or entries[0].file_size > 200_000
                or stat.S_IFMT(entries[0].external_attr >> 16) not in (0, stat.S_IFREG)):
            raise RuntimeError('Recovery artifact must contain one bounded regular root audit')
        return strict_json(archive.read(entries[0]).decode('utf-8'))


def commit_binding(output, head):
    message = output(['git', 'log', '-1', '--format=%B', head])
    fields = {}
    for name, pattern in [('Run', r'[1-9][0-9]*'), ('Base', SHA), ('Attempt', r'[1-3]')]:
        values = re.findall(rf'^Refresh-Repair-{name}: ({pattern})$', message, re.MULTILINE)
        if len(values) != 1:
            raise RuntimeError('Recovery commit has missing or ambiguous repair bindings')
        fields[name] = values[0]
    parents = output(['git', 'show', '-s', '--format=%P', head]).split()
    tree = output(['git', 'rev-parse', f'{head}^{{tree}}'])
    return fields, parents, tree, message


def empty_audit(report):
    return (all(report.get(key) == [] for key in EMPTY_LISTS)
            and report.get('findingSnapshots') == {}
            and isinstance(report.get('evidenceRenames'), dict)
            and all(value == {} for value in report['evidenceRenames'].values()))


def recovery_evidence(api, command, output, verify_provenance, repo, pr, trusted, selection):
    run_id, artifact_id, digest = selection
    head = pr['head']['sha']
    fields, parents, tree, message = commit_binding(output, head)
    if fields['Run'] != run_id:
        raise RuntimeError('Selected failed run does not match the exact requested head')
    run = trusted_run(api, output, repo, run_id, trusted)
    if run.get('conclusion') != 'failure':
        raise RuntimeError('Recovery requires a completed failed repair run')
    report = artifact_report(api, command, repo, artifact_id, run, f'refresh-repair-{pr["number"]}-{run_id}', digest)
    arena = re.fullmatch(r'story-runner/([a-z0-9-]+)-[0-9]+', pr['head']['ref']).group(1)
    if (report.get('mode') != 'base-update' or report.get('phase') != 'error'
            or report.get('pr') != pr['number'] or report.get('runId') != run_id
            or report.get('main') != fields['Base'] or report['main'] != run['head_sha']
            or not re.fullmatch(SHA, report.get('head', '')) or report.get('arena') != arena
            or 'publishedHead' in report or not empty_audit(report)
            or report.get('failedStage') != f'gh api repos/{repo}/pulls/{pr["number"]}'
            or report.get('blocked') != 'Remote head changed after repair publication; no receipt emitted'):
        raise RuntimeError('Failed audit is not a narrow interrupted no-model base update')
    base, original = report['main'], report['head']
    if parents != [original, base] or output(['git', 'merge-base', original, base]) == base:
        raise RuntimeError('Orphan commit does not have the exact ordered base-update parents')
    expected_message = (f'chore(story-runner): repair {arena} judgments and projections\n\n'
                        f'Refresh-Repair-Attempt: {fields["Attempt"]}\nRefresh-Repair-Base: {base}\n'
                        f'Refresh-Repair-Run: {run_id}\nRestored-Churn-Cells: 0')
    if message != expected_message:
        raise RuntimeError('Orphan commit message does not match the bounded repair form')
    original_pr = copy.deepcopy(pr)
    original_pr['head']['sha'] = original
    verify_provenance(api, repo, original_pr)
    changed = output(['git', 'diff', '--name-only', base, trusted]).splitlines()
    if any(file not in RECOVERY_CODE for file in changed):
        raise RuntimeError('Main contains changes outside the bounded recovery code; dedicated repair required')
    ranking = strict_json(output(['git', 'show', f'{head}:open-rankings/{arena}/rankings.json']))
    at = ranking.get('generatedAt', '')
    if not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z', at):
        raise RuntimeError('Orphan ranking has no bounded replay timestamp')
    parse = lambda value: datetime.fromisoformat(value.replace('Z', '+00:00'))
    if not parse(run['run_started_at']) <= parse(at) <= parse(run['updated_at']):
        raise RuntimeError('Replay timestamp is outside the authenticated failed run')
    return report, {'head': head, 'runId': run_id, 'artifactId': artifact_id, 'artifactDigest': digest,
                    'originalHead': original, 'base': base, 'tree': tree, 'parents': parents, 'replayedAt': at}


def replay(command, output, report, proof, trusted, directory):
    """Execute current trusted code, reconstructing the old whole tree in an isolated index."""
    finding_file, replay_file = Path(directory) / 'recovery-findings.json', Path(directory) / 'recovery-replay.json'
    finding_file.write_text('[]\n')
    env = os.environ.copy()
    for key in ('ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'GH_TOKEN', 'GITHUB_TOKEN',
                'UM_JUDGE_MODEL', 'PA_MODEL', 'UM_DATA_DIR', 'PA_DATA_DIR', 'NODE_OPTIONS', 'GIT_INDEX_FILE'):
        env.pop(key, None)
    command(['pnpm', 'exec', 'tsx', 'rankings-engine/scripts/repair-refresh.ts', proof['originalHead'],
             proof['base'], report['arena'], str(finding_file), str(replay_file), '--replay', trusted, proof['replayedAt']], env=env)
    result = strict_json(replay_file.read_text())
    if (result.get('mode') != 'base-update' or result.get('arena') != report['arena']
            or result.get('head') != proof['originalHead'] or result.get('main') != proof['base']
            or any(result.get(key) != [] for key in ('restored', 'rejudged', 'audits', 'unresolved'))
            or result.get('evidenceRenames') != report['evidenceRenames']):
        raise RuntimeError('Replay performed work outside the authenticated no-model base update')
    command(['git', 'add', 'open-rankings', 'rankings-engine/cache', 'README.md'])
    generated = output(['git', 'write-tree'])
    files = output(['git', 'diff', '--name-only', trusted, generated]).splitlines()
    with tempfile.TemporaryDirectory(prefix='refresh-replay-index-') as index_dir:
        index_env = {**env, 'GIT_INDEX_FILE': str(Path(index_dir) / 'index')}
        command(['git', 'read-tree', proof['base']], env=index_env)
        for file in files:
            if not (file == 'README.md' or file.startswith(('open-rankings/', 'rankings-engine/cache/'))):
                raise RuntimeError('Replay changed executable code or undeclared data')
            entry = output(['git', 'ls-tree', generated, '--', file]).split()
            if len(entry) != 4 or entry[0] != '100644' or entry[1] != 'blob' or entry[3] != file:
                raise RuntimeError('Replay contains deleted or non-regular data')
            command(['git', 'update-index', '--add', '--cacheinfo', f'100644,{entry[2]},{file}'], env=index_env)
        if output(['git', 'write-tree'], env=index_env) != proof['tree']:
            raise RuntimeError('Replayed whole tree differs from the explicitly selected orphan head')
    for gate in GATES:
        command(gate, env=env)
    command(['node', 'rankings-engine/scripts/check-refresh-stability.mjs', proof['base'], proof['head']], env=env)
    command(['git', 'add', 'open-rankings', 'rankings-engine/cache', 'README.md'])
    if output(['git', 'write-tree']) != generated or output(['git', 'diff', '--name-only']):
        raise RuntimeError('Validation changed the replayed tree')


def recovery_resume(api, command, output, repo, number, head, trusted):
    name = f'internal-refresh-story-runner-{number}-{head}'
    listed = api(f'repos/{repo}/actions/artifacts?name={name}&per_page=100')
    if listed.get('total_count', 100) >= 100:
        raise RuntimeError('Recovery receipt listing exceeds the inspection limit')
    if not listed['artifacts']:
        return None
    fields, parents, tree, _ = commit_binding(output, head)
    for artifact in sorted(listed['artifacts'], key=lambda item: item['id'], reverse=True):
        if artifact.get('name') != name or artifact.get('expired') is not False:
            continue
        run_id = (artifact.get('workflow_run') or {}).get('id')
        if not isinstance(run_id, int) or str(run_id) == fields['Run']:
            continue
        metadata = api(f'repos/{repo}/actions/runs/{run_id}')
        if not run_metadata(metadata, repo, run_id):
            continue
        run = trusted_run(api, output, repo, str(run_id), trusted, run=metadata)
        if run.get('conclusion') not in ('success', 'failure'):
            raise RuntimeError('Recovery attestation run has no completed validation result')
        report = artifact_report(api, command, repo, artifact['id'], run, name)
        if report.get('mode') != 'receipt-recovery':
            continue
        proof = report.get('recovery') or {}
        if (report.get('attestationVersion') != 1 or report.get('runId') != str(run_id)
                or report.get('pr') != number or report.get('publishedHead') != head
                or report.get('main') != run['head_sha'] or not empty_audit(report)
                or report.get('validated') != [gate[1] for gate in GATES] + ['refresh-stability']
                or proof.get('runId') != fields['Run'] or proof.get('base') != fields['Base']
                or proof.get('head') != head or proof.get('parents') != parents or proof.get('tree') != tree
                or len(parents) != 2 or parents[1] != fields['Base'] or proof.get('originalHead') != parents[0]
                or report.get('head') != parents[0]
                or not re.fullmatch(r'[1-9][0-9]*', proof.get('artifactId', ''))
                or not re.fullmatch(DIGEST, proof.get('artifactDigest', ''))
                or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z', proof.get('replayedAt', ''))):
            raise RuntimeError('Recovery attestation does not match this exact head and new run')
        return report
    return None
