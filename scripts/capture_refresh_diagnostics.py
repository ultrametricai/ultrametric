"""Save bounded story-runner inputs for offline diagnosis, without publication authority."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tarfile
import tempfile

MAX_BYTES = 64 * 1024 * 1024
MAX_FILES = 10000


MAX_JUDGE_FAILURE_BYTES = 256 * 1024
FIELD_LIMITS = {
    'evidenceId': 256, 'quote': 2000, 'sourceExcerpt': 6000, 'sourceId': 256,
    'expectedSubject': 512, 'actualSubject': 512, 'rationale': 1000,
    'verdict': 32, 'quality': 32, 'relation': 32, 'coverage': 32, 'citationCount': 32,
}
FAILURE_CODES = {
    'unknown-evidence-id', 'support-subject', 'direct-support', 'full-coverage',
    'unknown-support-id', 'support-id-not-cited', 'quote-mismatch', 'question-only',
    'missing-evidence', 'disputed-tiers', 'zero-quality', 'quality-gap',
}


def validate_judge_failure(data, arena=None):
    """Strict field allowlist; a diagnostic cannot smuggle arbitrary response metadata."""
    def require(ok):
        if not ok:
            raise ValueError('Invalid judge failure diagnostic')

    def keys(value, required, optional=()):
        require(isinstance(value, dict) and set(required) <= value.keys()
                and value.keys() <= set(required) | set(optional))

    def digest(value):
        require(isinstance(value, str) and re.fullmatch(r'[a-f0-9]{64}', value))

    def bounded(value, limit):
        keys(value, ('text', 'truncated', 'redacted'))
        require(isinstance(value['text'], str) and len(value['text']) <= limit
                and type(value['truncated']) is bool and type(value['redacted']) is bool)

    require(len(data) <= MAX_JUDGE_FAILURE_BYTES)
    record = json.loads(data)
    keys(record, ('kind', 'version', 'publicationAuthority', 'exactReplay', 'cell', 'input', 'termination', 'attempts'))
    require(record['kind'] == 'judge-semantic-failure' and type(record['version']) is int and record['version'] == 1
            and record['publicationAuthority'] is False and record['exactReplay'] is False)
    cell = record['cell']
    keys(cell, ('category', 'productId', 'storyId'))
    require(isinstance(cell['category'], str) and re.fullmatch(r'[a-z0-9][a-z0-9-]*', cell['category'])
            and (arena is None or cell['category'] == arena))
    bounded(cell['productId'], 256)
    bounded(cell['storyId'], 256)
    metadata = record['input']
    keys(metadata, ('hash', 'keyVersion', 'promptVersion', 'model', 'initialPromptHash'))
    digest(metadata['hash'])
    digest(metadata['initialPromptHash'])
    for key in ('keyVersion', 'promptVersion'):
        require(isinstance(metadata[key], str) and re.fullmatch(r'v[0-9]{1,3}', metadata[key]))
    bounded(metadata['model'], 256)
    attempts = record['attempts']
    require(isinstance(attempts, list) and 1 <= len(attempts) <= 4)
    require(record['termination'] in ('semantic-exhaustion', 'correction-request-failed'))
    require(len(attempts) == 4 if record['termination'] == 'semantic-exhaustion' else len(attempts) <= 3)
    for index, attempt in enumerate(attempts):
        keys(attempt, ('attempt', 'transport', 'requestPromptHash', 'failure', 'fields'))
        require(type(attempt['attempt']) is int and attempt['attempt'] == index + 1
                and attempt['transport'] in (('interactive', 'batch') if index == 0 else ('interactive',)))
        digest(attempt['requestPromptHash'])
        failure = attempt['failure']
        keys(failure, ('code',), ('citationIndex', 'evidenceIdIndex'))
        require(isinstance(failure['code'], str) and failure['code'] in FAILURE_CODES)
        for key in ('citationIndex', 'evidenceIdIndex'):
            if key in failure:
                require(type(failure[key]) is int and 0 <= failure[key] <= 9007199254740991)
        fields = attempt['fields']
        keys(fields, (), FIELD_LIMITS)
        for key, value in fields.items():
            bounded(value, FIELD_LIMITS[key])
    return record


def inspect_judge_failure(file):
    file = Path(file)
    if file.is_symlink() or any(parent.is_symlink() for parent in file.parents):
        raise ValueError('Judge failure diagnostic cannot traverse a symlink')
    if not file.is_file() or file.stat().st_size > MAX_JUDGE_FAILURE_BYTES:
        raise ValueError('Invalid judge failure diagnostic size or file')
    # ensure_ascii escapes terminal controls and all Unicode direction/line controls.
    # This is inspection of a deliberately partial record, not exact model replay.
    return json.dumps(validate_judge_failure(file.read_bytes()), ensure_ascii=True)


def capture(root, baseline, arena, output, report=None):
    root = Path(root).resolve()
    if not re.fullmatch(r'[a-f0-9]{40}', baseline) or not re.fullmatch(r'[a-z0-9][a-z0-9-]*', arena):
        raise ValueError('Expected an exact baseline commit and an arena ID')

    def git(*args):
        return subprocess.check_output(['git', *args], cwd=root)

    git('cat-file', '-e', baseline + '^{commit}')
    git('merge-base', '--is-ancestor', baseline, 'HEAD')
    arena_dir = f'open-rankings/{arena}'
    prefixes = [arena_dir + '/evidence/', f'rankings-engine/cache/judge/{arena}/']
    exact = {f'{arena_dir}/{name}.json' for name in ['products', 'stories', 'verdicts']}
    exact.add(f'rankings-engine/cache/refresh-retention/{arena}/decisions.json')
    failure_name = f'.pa-tmp/judge-failures/{arena}/terminal.json'
    exact.add(failure_name)

    def allowed(name):
        if name in exact:
            return True
        return any(name.startswith(prefix) and re.fullmatch(r'[a-z0-9_/-]+\.json', name[len(prefix):])
                   and all(part not in ('', '.', '..') for part in name[len(prefix):].split('/'))
                   for prefix in prefixes)

    entries = {}
    size = 0

    def add(name, data):
        nonlocal size
        size += len(data)
        if size > MAX_BYTES or len(entries) >= MAX_FILES:
            raise ValueError('Refresh diagnostics exceed the capture limit')
        # Limit inputs to generated JSON, not arbitrary checkout files or environment data.
        json.loads(data)
        entries[name] = data

    tree = git('ls-tree', '-r', '-z', baseline).decode().split('\0')
    for record in filter(None, tree):
        metadata, name = record.split('\t', 1)
        if name == failure_name or not allowed(name):
            continue
        if metadata.split()[0] != '100644':
            raise ValueError(f'Non-regular baseline input: {name}')
        add('baseline/' + name, git('show', baseline + ':' + name))

    candidates = {root / name for name in exact}
    for prefix in prefixes:
        folder = root / prefix.rstrip('/')
        if folder.is_symlink():
            raise ValueError(f'Symlink input: {prefix}')
        if folder.exists():
            candidates.update(folder.rglob('*'))
    for file in sorted(candidates):
        if not file.exists() and not file.is_symlink():
            continue
        name = file.relative_to(root).as_posix()
        if file.is_symlink():
            raise ValueError(f'Symlink input: {name}')
        if not allowed(name):
            continue
        # Every ancestor must remain within the checkout without traversing a symlink.
        if any(parent.is_symlink() for parent in file.parents if parent != root and root in parent.parents):
            raise ValueError(f'Symlink parent: {name}')
        if not stat.S_ISREG(file.stat().st_mode):
            raise ValueError(f'Non-regular candidate input: {name}')
        if file.stat().st_size > MAX_BYTES - size:
            raise ValueError('Refresh diagnostics exceed the capture limit')
        if name == failure_name:
            if file.stat().st_size > MAX_JUDGE_FAILURE_BYTES:
                raise ValueError('Judge failure diagnostic exceeds the capture limit')
            data = file.read_bytes()
            validate_judge_failure(data, arena)
        else:
            data = file.read_bytes()
        add('candidate/' + name, data)
    if report:
        report = Path(report)
        if report.is_symlink() or any(parent.is_symlink() for parent in report.parents):
            raise ValueError('Diagnostic report must be a regular file')
        if report.exists():
            if not report.is_file() or report.stat().st_size > MAX_BYTES - size:
                raise ValueError('Invalid diagnostic report')
            add('reconciliation-report.json', report.read_bytes())

    manifest = {
        'kind': 'story-refresh-diagnostics', 'version': 1,
        'publicationAuthority': False, 'arena': arena, 'baseline': baseline,
        'candidateHead': git('rev-parse', 'HEAD').decode().strip(),
        'runId': os.environ.get('GITHUB_RUN_ID'), 'runAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
        'files': {name: hashlib.sha256(data).hexdigest() for name, data in sorted(entries.items())},
    }
    output = Path(output)
    if output.is_symlink() or any(parent.is_symlink() for parent in output.parents):
        raise ValueError('Diagnostic output cannot traverse a symlink')
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, delete=False) as handle:
            temporary = handle.name
        with tarfile.open(temporary, 'w:gz') as archive:
            entries['manifest.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
            for name, data in sorted(entries.items()):
                info = tarfile.TarInfo(name)
                info.size = len(data)
                info.mode = 0o644
                archive.addfile(info, io.BytesIO(data))
        os.replace(temporary, output)
    finally:
        if temporary and Path(temporary).exists():
            Path(temporary).unlink()
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline')
    parser.add_argument('--category')
    parser.add_argument('--output')
    parser.add_argument('--inspect-judge-failure', metavar='FILE', help='Keyless bounded inspection; does not call a model or publish')
    parser.add_argument('--report')
    args = parser.parse_args()
    if args.inspect_judge_failure:
        if any((args.baseline, args.category, args.output, args.report)):
            parser.error('Inspection cannot be combined with capture')
        print(inspect_judge_failure(args.inspect_judge_failure))
    else:
        if not all((args.baseline, args.category, args.output)):
            parser.error('Capture requires --baseline, --category and --output')
        capture(Path.cwd(), args.baseline, args.category, args.output, args.report)
