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
        if not allowed(name):
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
        add('candidate/' + name, file.read_bytes())
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
    parser.add_argument('--baseline', required=True)
    parser.add_argument('--category', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--report')
    args = parser.parse_args()
    capture(Path.cwd(), args.baseline, args.category, args.output, args.report)
