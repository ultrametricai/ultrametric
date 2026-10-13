import json
import subprocess
from pathlib import Path

# git's null object id — the revision reported when no git history is available (a plain
# extracted tree, e.g. the open artifact materialized into a consuming repo). 40-hex so
# records written from such a tree still satisfy the source.revision schema.
NULL_REVISION = '0' * 40

FIXED_PATHS = ['processes/corpus.json', 'journeys/chains.json', 'processes/vendor-registry.json']


def _working_workflows(root):
    return sorted(path.relative_to(root).as_posix() for path in (Path(root) / 'processes/equity').rglob('*.json'))


def read_snapshot(root):
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=root, text=True, stderr=subprocess.DEVNULL)

    def read_working(path):
        return json.loads((Path(root) / path).read_text(encoding='utf-8'))

    working_workflows = _working_workflows(root)

    # Git mode needs a repo whose toplevel IS the source root: a tree extracted inside some
    # unrelated parent repo must read its own files, not the parent's history.
    try:
        toplevel = git('rev-parse', '--show-toplevel').strip()
        revision = git('rev-parse', 'HEAD').strip()
    except (OSError, subprocess.CalledProcessError):
        toplevel = None
        revision = None
    if revision is None or Path(toplevel).resolve() != Path(root).resolve():
        paths = FIXED_PATHS + working_workflows
        return NULL_REVISION, {path: read_working(path) for path in paths}

    tracked = set(
        git('ls-tree', '-rz', '--name-only', revision, '--', *FIXED_PATHS, 'processes/equity').split('\0')
    )
    tracked.discard('')
    workflows = sorted({p for p in tracked if p.startswith('processes/equity/')} | set(working_workflows))
    paths = FIXED_PATHS + workflows
    # Tracked sources must be committed before an import is trusted; untracked paths that the
    # repo deliberately ignores (the materialized open artifact in a consuming repo) are read
    # from the working tree instead, and non-ignored untracked files still fail here.
    dirty = git('status', '--porcelain', '--untracked-files=all', '--', *sorted(set(paths + working_workflows)))
    if dirty.strip():
        raise SystemExit('Commit legacy source changes before importing or checking migration preservation.\n' + dirty)
    return revision, {
        path: json.loads(git('show', f'{revision}:{path}')) if path in tracked else read_working(path)
        for path in paths
    }
