"""Replay scheduled producer ordering and bounded diagnostics without model calls."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import capture_refresh_diagnostics as diagnostics


class DiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.git('init', '-q', '--initial-branch=main')
        self.write('open-rankings/fixture/verdicts.json', '["before"]')
        self.write('open-rankings/fixture/evidence/product.json', '[]')
        self.write('rankings-engine/cache/judge/fixture/product/story.json', '{}')
        self.write('rankings-engine/cache/refresh-retention/fixture/decisions.json', '{}')
        self.write('open-rankings/other/verdicts.json', '[]')
        self.write('rankings-engine/cache/crawl/secret.json', '{"secret":true}')
        self.write('.env', 'DO_NOT_CAPTURE=secret')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'baseline')
        self.baseline = self.git('rev-parse', 'HEAD')
        self.output = self.root / 'diagnostics.tar.gz'

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True).strip()

    def write(self, name, data):
        file = self.root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(data)
        return file

    def capture(self, **kwargs):
        return diagnostics.capture(self.root, kwargs.pop('baseline', self.baseline),
                                   kwargs.pop('arena', 'fixture'), self.output, **kwargs)

    def test_allowlist_preserves_before_and_after_without_secrets_or_authority(self):
        self.write('open-rankings/fixture/verdicts.json', '["after"]')
        report = self.write('report.json', '{"blocked":[{"cell":"product:story"}]}')
        self.capture(report=report)
        with tarfile.open(self.output) as archive:
            self.assertTrue(all(member.isfile() for member in archive.getmembers()))
            files = {member.name: archive.extractfile(member).read() for member in archive.getmembers()}
        manifest = json.loads(files.pop('manifest.json'))
        self.assertEqual(manifest['kind'], 'story-refresh-diagnostics')
        self.assertIs(manifest['publicationAuthority'], False)
        self.assertEqual(manifest['baseline'], self.baseline)
        self.assertEqual(manifest['files'], {name: hashlib.sha256(data).hexdigest() for name, data in files.items()})
        self.assertEqual(files['baseline/open-rankings/fixture/verdicts.json'], b'["before"]')
        self.assertEqual(files['candidate/open-rankings/fixture/verdicts.json'], b'["after"]')
        self.assertIn('reconciliation-report.json', files)
        self.assertIn('candidate/rankings-engine/cache/judge/fixture/product/story.json', files)
        self.assertIn('baseline/rankings-engine/cache/refresh-retention/fixture/decisions.json', files)
        self.assertFalse(any('.env' in name or '/crawl/' in name or '/other/' in name for name in files))
        self.assertFalse(any(b'secret' in data for data in files.values()))

    def test_invalid_ids_nonancestor_and_nonjson_fail_without_artifact(self):
        for kwargs in [{'arena': '../fixture'}, {'baseline': 'HEAD'}, {'baseline': 'a' * 40}]:
            with self.subTest(kwargs=kwargs), self.assertRaises((ValueError, subprocess.CalledProcessError)):
                self.capture(**kwargs)
            self.assertFalse(self.output.exists())
        self.git('checkout', '-q', '--orphan', 'unrelated')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'unrelated')
        with self.assertRaises(subprocess.CalledProcessError):
            self.capture()
        self.git('checkout', '-q', 'main')
        self.write('open-rankings/fixture/verdicts.json', 'not json')
        with self.assertRaises(ValueError):
            self.capture()
        self.assertFalse(self.output.exists())

    def test_size_and_count_limits_never_leave_partial_artifacts(self):
        for name, value in [('MAX_BYTES', 1), ('MAX_FILES', 1)]:
            with patch.object(diagnostics, name, value), self.assertRaisesRegex(ValueError, 'capture limit'):
                self.capture()
            self.assertFalse(self.output.exists())

    def test_symlink_file_parent_and_report_are_rejected(self):
        file = self.root / 'open-rankings/fixture/evidence/product.json'
        file.unlink()
        file.symlink_to(self.root / 'rankings-engine/cache/crawl/secret.json')
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            self.capture()
        file.unlink()
        file.parent.rmdir()
        file.parent.symlink_to(self.root / 'rankings-engine/cache/crawl', target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            self.capture()
        file.parent.unlink()
        self.write('open-rankings/fixture/evidence/product.json', '[]')
        report = self.root / 'report.json'
        report.symlink_to(file)
        with self.assertRaisesRegex(ValueError, 'regular file'):
            self.capture(report=report)
        self.assertFalse(self.output.exists())

    def test_nonregular_baseline_is_rejected(self):
        file = self.root / 'open-rankings/fixture/evidence/product.json'
        file.chmod(0o755)
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'executable')
        self.baseline = self.git('rev-parse', 'HEAD')
        with self.assertRaisesRegex(ValueError, 'Non-regular baseline'):
            self.capture()


class ProducerOrderingTests(unittest.TestCase):
    def test_reconciliation_precedes_claims_and_derivation_and_stops_on_failure(self):
        workflow = (ROOT / '.github/workflows/story-runner.yml').read_text()
        block = workflow.split('      - name: Run engine stages for arena\n', 1)[1].split('\n      # Prediction layer', 1)[0]
        self.assertIn('BASELINE_SHA: ${{ steps.baseline.outputs.sha }}', block)
        script = '\n'.join(line[10:] for line in block.split('        run: |\n', 1)[1].splitlines())
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            executable = root / 'pnpm'
            executable.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALLS"\n'
                                  'case "$*" in *reconcile-refresh.ts*) exit "$FAIL_RECONCILE";; esac\n')
            executable.chmod(0o755)
            calls = root / 'calls'
            env = {**os.environ, 'PATH': f'{root}:/usr/bin:/bin', 'CALLS': str(calls),
                   'CATEGORY': 'fixture', 'BASELINE_SHA': 'a' * 40, 'RUNNER_TEMP': str(root)}
            for fail in ['0', '42']:
                calls.write_text('')
                result = subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', script], env={**env, 'FAIL_RECONCILE': fail},
                                        text=True, capture_output=True)
                self.assertEqual(result.returncode, int(fail), result.stderr)
                lines = calls.read_text().splitlines()
                judge = next(i for i, line in enumerate(lines) if 'cli.ts judge ' in line)
                reconcile = next(i for i, line in enumerate(lines) if 'reconcile-refresh.ts ' in line)
                self.assertEqual(reconcile, judge + 1)
                self.assertIn('--baseline ' + 'a' * 40, lines[reconcile])
                if fail == '0':
                    self.assertLess(reconcile, next(i for i, line in enumerate(lines) if 'cli.ts claims ' in line))
                    self.assertLess(reconcile, next(i for i, line in enumerate(lines) if 'cli.ts derive ' in line))
                else:
                    self.assertEqual(reconcile, len(lines) - 1)
        self.assertIn('node rankings-engine/scripts/check-refresh-stability.mjs HEAD^ HEAD', workflow)
        self.assertIn('name: story-refresh-diagnostics-${{ github.run_id }}-${{ github.run_attempt }}', workflow)
        self.assertIn('if: failure() &&', workflow)


if __name__ == '__main__':
    unittest.main()
