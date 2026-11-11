"""Offline receipt recovery guards using fictional API records and isolated Git data."""
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
import warnings
import zipfile
from contextlib import redirect_stdout
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import refresh_recovery as recovery
from refresh_policy import MissingProvenance

REPO = 'fixture-owner/fixture-repo'
NUMBER = 736
HEAD, ORIGINAL, BASE, TRUSTED, TREE, GENERATED = [letter * 40 for letter in 'abcdef']
RUN, NEW_RUN, ARTIFACT = '101', '202', '303'
BRANCH = 'story-runner/fixture-123'
AT = '2026-01-02T12:01:00.000Z'
NAME = f'refresh-repair-{NUMBER}-{RUN}'
RECEIPT = f'internal-refresh-story-runner-{NUMBER}-{HEAD}'
PR = {
    'number': NUMBER, 'labels': [], 'state': 'open', 'draft': False,
    'auto_merge': {'enabled_by': {'login': 'fixture-maintainer'}}, 'base': {'ref': 'main'},
    'head': {'sha': HEAD, 'ref': BRANCH, 'repo': {'full_name': REPO}},
    'user': {'id': 41898282, 'login': 'github-actions[bot]', 'type': 'Bot'},
}


def workflow():
    return {'id': 23, 'path': recovery.WORKFLOW, 'state': 'active'}


def run_record(run_id=RUN, head=BASE, *, active=False):
    return {
        'id': int(run_id), 'workflow_id': 23, 'path': recovery.WORKFLOW,
        'head_branch': 'main', 'event': 'workflow_dispatch', 'head_sha': head,
        'repository': {'full_name': REPO}, 'head_repository': {'full_name': REPO},
        'status': 'in_progress' if active else 'completed', 'conclusion': 'failure',
        'run_started_at': '2026-01-02T12:00:00Z', 'updated_at': '2026-01-02T12:02:00Z',
    }


def repair_message(*, original_run=RUN, base=BASE):
    return (f'chore(story-runner): repair fixture judgments and projections\n\n'
            f'Refresh-Repair-Attempt: 1\nRefresh-Repair-Base: {base}\n'
            f'Refresh-Repair-Run: {original_run}\nRestored-Churn-Cells: 0')


def failed_report():
    return {
        'mode': 'base-update', 'phase': 'error', 'pr': NUMBER, 'runId': RUN,
        'main': BASE, 'head': ORIGINAL, 'arena': 'fixture', 'originalThreads': [],
        'restored': [], 'rejudged': [], 'audits': [], 'unresolved': [],
        'findingSnapshots': {}, 'evidenceRenames': {'fixture-product': {}},
        'failedStage': f'gh api repos/{REPO}/pulls/{NUMBER}',
        'blocked': 'Remote head changed after repair publication; no receipt emitted',
    }


def proof_record(digest='1' * 64):
    return {
        'head': HEAD, 'runId': RUN, 'artifactId': ARTIFACT, 'artifactDigest': digest,
        'originalHead': ORIGINAL, 'base': BASE, 'tree': TREE,
        'parents': [ORIGINAL, BASE], 'replayedAt': AT,
    }


def attestation():
    report = failed_report()
    report.update(mode='receipt-recovery', phase='receipt-recovered', runId=NEW_RUN,
                  main=TRUSTED, publishedHead=HEAD, attestationVersion=1,
                  validated=[gate[1] for gate in recovery.GATES] + ['refresh-stability'],
                  recovery=proof_record())
    report.pop('blocked')
    report.pop('failedStage')
    return report


def archive_bytes(report=None, *, entries=None):
    if entries is None:
        entries = [('refresh-repair-report.json', json.dumps(report).encode(), stat.S_IFREG | 0o644)]
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data, mode in entries:
            entry = zipfile.ZipInfo(name)
            entry.create_system = 3
            entry.external_attr = mode << 16
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', UserWarning)
                archive.writestr(entry, data, compress_type=zipfile.ZIP_DEFLATED)
    return stream.getvalue()


def artifact_record(content, *, name=NAME, run=None, artifact_id=ARTIFACT):
    run = run or run_record()
    return {
        'id': int(artifact_id), 'name': name, 'expired': False, 'size_in_bytes': len(content),
        'digest': 'sha256:' + hashlib.sha256(content).hexdigest(),
        'workflow_run': {'id': run['id'], 'head_sha': run['head_sha'], 'head_branch': 'main'},
    }


class RecoveryInputTests(unittest.TestCase):
    def test_absent_selection_preserves_ordinary_repair(self):
        self.assertIsNone(recovery.selected({}))
        self.assertIsNone(recovery.selected({'RECOVER_RUN': '', 'RECOVER_ARTIFACT': '', 'RECOVER_DIGEST': ''}))

    def test_explicit_selection_retains_exact_strings(self):
        self.assertEqual(recovery.selected({'RECOVER_RUN': RUN, 'RECOVER_ARTIFACT': ARTIFACT,
                                           'RECOVER_DIGEST': 'a' * 64}), (RUN, ARTIFACT, 'a' * 64))

    def test_partial_or_malformed_selection_cannot_fall_back(self):
        valid = {'RECOVER_RUN': RUN, 'RECOVER_ARTIFACT': ARTIFACT, 'RECOVER_DIGEST': 'a' * 64}
        changes = [(key, '') for key in valid]
        changes += [(key, value) for key in ('RECOVER_RUN', 'RECOVER_ARTIFACT')
                    for value in ('0', '-1', '01', '1.0', ' 1', '1\n', 'latest')]
        changes += [('RECOVER_DIGEST', value) for value in ('a' * 63, 'a' * 65, 'A' * 64,
                                                           'sha256:' + 'a' * 64, 'g' * 64)]
        for key, value in changes:
            with self.subTest(key=key, value=value), self.assertRaisesRegex(RuntimeError, 'exact failed run'):
                recovery.selected({**valid, key: value})

    def test_strict_json_requires_an_object_and_unique_nested_keys(self):
        self.assertEqual(recovery.strict_json('{"audit":{"empty":[]}}'), {'audit': {'empty': []}})
        for data in ('[]', 'null', '1', '"object"'):
            with self.subTest(data=data), self.assertRaisesRegex(RuntimeError, 'must be an object'):
                recovery.strict_json(data)
        for data in ('{"mode":"base-update","mode":"repair"}', '{"audit":{"a":1,"a":2}}'):
            with self.subTest(data=data), self.assertRaisesRegex(RuntimeError, 'Duplicate audit JSON key'):
                recovery.strict_json(data)

    def test_strict_json_rejects_truncated_and_trailing_documents(self):
        for data in ('{"mode":', '{} {}', '{"mode":1,}'):
            with self.subTest(data=data), self.assertRaises(json.JSONDecodeError):
                recovery.strict_json(data)

    def test_strict_json_rejects_nonfinite_numbers(self):
        for value in ('NaN', 'Infinity', '-Infinity'):
            with self.subTest(value=value), self.assertRaisesRegex((ValueError, RuntimeError), 'constant|finite|JSON'):
                recovery.strict_json('{"audit":' + value + '}')


class RecoveryRunTests(unittest.TestCase):
    def authenticate(self, run=None, definition=None, *, ancestor=BASE, active=False):
        run = run_record(active=active) if run is None else run
        definition = workflow() if definition is None else definition
        def api(endpoint):
            if endpoint == f'repos/{REPO}/actions/runs/{RUN}':
                return run
            if endpoint == f'repos/{REPO}/actions/workflows/refresh-repair.yml':
                return definition
            raise AssertionError(endpoint)
        return recovery.trusted_run(api, Mock(return_value=ancestor), REPO, RUN, TRUSTED, active=active)

    def test_completed_failed_run_and_current_active_run_have_separate_status_guards(self):
        self.assertEqual(self.authenticate()['id'], int(RUN))
        self.assertEqual(self.authenticate(active=True)['status'], 'in_progress')
        with self.assertRaisesRegex(RuntimeError, 'authenticated main repair workflow'):
            self.authenticate(run_record(active=True))
        with self.assertRaisesRegex(RuntimeError, 'authenticated main repair workflow'):
            self.authenticate(run_record(), active=True)

    def test_run_identity_rejects_wrong_run_repository_workflow_event_or_hash(self):
        changes = [
            ('id', int(RUN) + 1), ('id', RUN), ('id', True),
            ('path', '.github/workflows/untrusted.yml'), ('head_branch', BRANCH),
            ('event', 'pull_request'), ('repository', {'full_name': 'other/repo'}),
            ('head_repository', {'full_name': 'fork/repo'}), ('head_repository', None),
            ('head_sha', 'z' * 40), ('head_sha', BASE[:-1]), ('status', 'queued'),
        ]
        for key, value in changes:
            with self.subTest(key=key, value=value), self.assertRaisesRegex(RuntimeError, 'authenticated main repair workflow'):
                self.authenticate({**run_record(), key: value})

    def test_paused_or_replaced_workflow_is_rejected(self):
        for change in ({'state': 'disabled_manually'}, {'id': 24}, {'path': 'changed.yml'}):
            with self.subTest(change=change), self.assertRaisesRegex(RuntimeError, 'identity changed or is paused'):
                self.authenticate(definition={**workflow(), **change})

    def test_source_must_be_in_current_trusted_main_history(self):
        with self.assertRaisesRegex(RuntimeError, 'outside trusted main history'):
            self.authenticate(ancestor=ORIGINAL)


class RecoveryArtifactTests(unittest.TestCase):
    def read(self, *, content=None, artifact=None, digest=None):
        content = archive_bytes(failed_report()) if content is None else content
        artifact = artifact_record(content) if artifact is None else artifact
        calls = []
        def api(endpoint):
            self.assertEqual(endpoint, f'repos/{REPO}/actions/artifacts/{ARTIFACT}')
            return artifact
        def command(args, **kwargs):
            calls.append(args)
            self.assertEqual(args, ['gh', 'api', f'repos/{REPO}/actions/artifacts/{ARTIFACT}/zip'])
            kwargs['stdout'].write(content)
        result = recovery.artifact_report(api, command, REPO, ARTIFACT, run_record(), NAME, digest)
        self.assertEqual(len(calls), 1)
        return result

    def test_downloaded_bytes_are_authenticated_by_exact_digest(self):
        content = archive_bytes(failed_report())
        self.assertEqual(self.read(content=content, digest=hashlib.sha256(content).hexdigest()), failed_report())
        with self.assertRaisesRegex(RuntimeError, 'identity, digest or bounds'):
            self.read(content=content, digest='0' * 64)
        wrong = artifact_record(content)
        wrong['digest'] = 'sha256:' + '0' * 64
        with self.assertRaisesRegex(RuntimeError, 'content digest mismatch'):
            self.read(content=content, artifact=wrong)

    def test_artifact_identity_bounds_expiry_and_run_binding_fail_before_download(self):
        content = archive_bytes(failed_report())
        changes = [('id', int(ARTIFACT) + 1), ('id', ARTIFACT), ('id', True), ('name', 'other'),
                   ('expired', True), ('expired', None), ('size_in_bytes', 0), ('size_in_bytes', True),
                   ('size_in_bytes', 2_000_001), ('digest', '0' * 64),
                   ('workflow_run', {'id': 999, 'head_sha': BASE, 'head_branch': 'main'}),
                   ('workflow_run', {'id': int(RUN), 'head_sha': ORIGINAL, 'head_branch': 'main'}),
                   ('workflow_run', {'id': int(RUN), 'head_sha': BASE, 'head_branch': BRANCH})]
        for key, value in changes:
            command = Mock()
            with self.subTest(key=key, value=value), self.assertRaisesRegex(RuntimeError, 'identity, digest or bounds'):
                recovery.artifact_report(Mock(return_value={**artifact_record(content), key: value}), command,
                                         REPO, ARTIFACT, run_record(), NAME)
            command.assert_not_called()

    def test_actual_download_bound_is_independent_of_metadata(self):
        content = b'x' * 2_000_001
        artifact = {**artifact_record(content), 'size_in_bytes': 20}
        with self.assertRaisesRegex(RuntimeError, 'exceeds its download bound'):
            self.read(content=content, artifact=artifact)

    def test_zip_requires_one_regular_bounded_root_report(self):
        payload = b'{}'
        regular = stat.S_IFREG | 0o644
        entries = [[], [('nested/refresh-repair-report.json', payload, regular)],
                   [('../refresh-repair-report.json', payload, regular)],
                   [('refresh-repair-report.json/', b'', stat.S_IFDIR | 0o755)],
                   [('refresh-repair-report.json', b'target', stat.S_IFLNK | 0o777)],
                   [('refresh-repair-report.json', payload, stat.S_IFIFO | 0o644)],
                   [('refresh-repair-report.json', b'x' * 200_001, regular)],
                   [('refresh-repair-report.json', payload, regular), ('extra.json', payload, regular)],
                   [('refresh-repair-report.json', payload, regular)] * 2]
        for members in entries:
            with self.subTest(members=[member[0] for member in members]), self.assertRaisesRegex(RuntimeError, 'one bounded regular root audit'):
                self.read(content=archive_bytes(entries=members))

    def test_archive_json_duplicates_are_not_hidden_by_transport(self):
        content = archive_bytes(entries=[('refresh-repair-report.json', b'{"mode":1,"mode":2}', stat.S_IFREG | 0o644)])
        with self.assertRaisesRegex(RuntimeError, 'Duplicate audit JSON key'):
            self.read(content=content)

    def test_invalid_zip_and_invalid_utf8_fail_at_their_decoder(self):
        with self.assertRaises(zipfile.BadZipFile):
            self.read(content=b'not a zip')
        content = archive_bytes(entries=[('refresh-repair-report.json', b'\xff', stat.S_IFREG | 0o644)])
        with self.assertRaises(UnicodeDecodeError):
            self.read(content=content)


class EvidenceFixture:
    def __init__(self):
        self.report = failed_report()
        self.run = run_record()
        self.message = repair_message()
        self.parents = [ORIGINAL, BASE]
        self.tree = TREE
        self.common = '0' * 40
        self.changed = ['scripts/refresh_recovery.py']
        self.timestamp = AT
        self.verify = Mock()
        self.calls = []

    def output(self, args, **kwargs):
        self.calls.append(args)
        if args == ['git', 'log', '-1', '--format=%B', HEAD]:
            return self.message
        if args == ['git', 'show', '-s', '--format=%P', HEAD]:
            return ' '.join(self.parents)
        if args == ['git', 'rev-parse', f'{HEAD}^{{tree}}']:
            return self.tree
        if args == ['git', 'merge-base', BASE, TRUSTED]:
            return BASE
        if args == ['git', 'merge-base', ORIGINAL, BASE]:
            return self.common
        if args == ['git', 'diff', '--name-only', BASE, TRUSTED]:
            return '\n'.join(self.changed)
        if args == ['git', 'show', f'{HEAD}:open-rankings/fixture/rankings.json']:
            return json.dumps({'generatedAt': self.timestamp})
        raise AssertionError(args)

    def collect(self):
        content = archive_bytes(self.report)
        artifact = artifact_record(content, run=self.run)
        def api(endpoint):
            values = {f'repos/{REPO}/actions/runs/{RUN}': self.run,
                      f'repos/{REPO}/actions/workflows/refresh-repair.yml': workflow(),
                      f'repos/{REPO}/actions/artifacts/{ARTIFACT}': artifact}
            if endpoint not in values:
                raise AssertionError(endpoint)
            return values[endpoint]
        def command(args, **kwargs):
            if args != ['gh', 'api', f'repos/{REPO}/actions/artifacts/{ARTIFACT}/zip']:
                raise AssertionError(args)
            kwargs['stdout'].write(content)
        return recovery.recovery_evidence(api, command, self.output, self.verify, REPO, copy.deepcopy(PR),
                                          TRUSTED, (RUN, ARTIFACT, hashlib.sha256(content).hexdigest()))


class RecoveryEvidenceTests(unittest.TestCase):
    def test_valid_failed_report_requires_the_original_heads_canonical_receipt(self):
        fixture = EvidenceFixture()
        report, proof = fixture.collect()
        self.assertEqual(report, failed_report())
        self.assertEqual(proof['parents'], [ORIGINAL, BASE])
        self.assertEqual(proof['head'], HEAD)
        self.assertEqual(proof['tree'], TREE)
        self.assertEqual(proof['replayedAt'], AT)
        fixture.verify.assert_called_once()
        verified_pr = fixture.verify.call_args.args[2]
        self.assertEqual(verified_pr['head']['sha'], ORIGINAL)
        self.assertEqual(PR['head']['sha'], HEAD)

    def test_missing_original_receipt_does_not_authorize_replay(self):
        fixture = EvidenceFixture()
        fixture.verify.side_effect = MissingProvenance('original fixture receipt missing')
        with self.assertRaisesRegex(MissingProvenance, 'original fixture receipt missing'):
            fixture.collect()
        self.assertFalse(any(args[:3] == ['git', 'diff', '--name-only'] for args in fixture.calls))

    def test_only_the_exact_interrupted_no_model_failure_is_eligible(self):
        changes = [('mode', 'repair'), ('phase', 'validated'), ('pr', NUMBER + 1), ('runId', NEW_RUN),
                   ('main', TRUSTED), ('head', 'invalid'), ('arena', 'other'), ('publishedHead', HEAD),
                   ('failedStage', 'git push origin'), ('blocked', 'unrelated failure')]
        for key, value in changes:
            fixture = EvidenceFixture()
            fixture.report[key] = value
            with self.subTest(key=key), self.assertRaisesRegex(RuntimeError, 'narrow interrupted no-model base update'):
                fixture.collect()
            fixture.verify.assert_not_called()

    def test_every_empty_audit_field_is_required_and_must_be_empty(self):
        for key in recovery.EMPTY_LISTS + ('findingSnapshots', 'evidenceRenames'):
            for missing in (False, True):
                fixture = EvidenceFixture()
                if missing:
                    fixture.report.pop(key)
                else:
                    fixture.report[key] = {'unexpected': 'value'} if key in ('findingSnapshots', 'evidenceRenames') else ['unexpected']
                with self.subTest(key=key, missing=missing), self.assertRaisesRegex(RuntimeError, 'narrow interrupted no-model base update'):
                    fixture.collect()

    def test_success_cancelled_or_incomplete_run_result_cannot_be_recovered(self):
        for conclusion in ('success', 'cancelled', 'timed_out', None):
            fixture = EvidenceFixture()
            fixture.run['conclusion'] = conclusion
            with self.subTest(conclusion=conclusion), self.assertRaisesRegex(RuntimeError, 'completed failed repair run'):
                fixture.collect()

    def test_commit_run_must_match_explicit_selection(self):
        fixture = EvidenceFixture()
        fixture.message = repair_message(original_run=NEW_RUN)
        with self.assertRaisesRegex(RuntimeError, 'Selected failed run does not match'):
            fixture.collect()

    def test_missing_or_duplicate_commit_bindings_cannot_select_a_report(self):
        for message in (repair_message().replace('Refresh-Repair-Attempt: 1', ''),
                        repair_message() + f'\nRefresh-Repair-Run: {RUN}',
                        repair_message().replace('Refresh-Repair-Attempt: 1', 'Refresh-Repair-Attempt: 4')):
            fixture = EvidenceFixture()
            fixture.message = message
            with self.subTest(message=message), self.assertRaisesRegex(RuntimeError, 'missing or ambiguous repair bindings'):
                fixture.collect()

    def test_parent_order_count_and_base_update_ancestry_are_exact(self):
        for parents in ([BASE, ORIGINAL], [ORIGINAL], [ORIGINAL, BASE, TRUSTED], [HEAD, BASE]):
            fixture = EvidenceFixture()
            fixture.parents = parents
            with self.subTest(parents=parents), self.assertRaisesRegex(RuntimeError, 'exact ordered base-update parents'):
                fixture.collect()
        fixture = EvidenceFixture()
        fixture.common = BASE
        with self.assertRaisesRegex(RuntimeError, 'exact ordered base-update parents'):
            fixture.collect()

    def test_commit_cannot_carry_extra_work_or_claim_nonzero_churn(self):
        for message in (repair_message() + '\nAdditional changes',
                        repair_message().replace('Restored-Churn-Cells: 0', 'Restored-Churn-Cells: 1')):
            fixture = EvidenceFixture()
            fixture.message = message
            with self.subTest(message=message), self.assertRaisesRegex(RuntimeError, 'bounded repair form'):
                fixture.collect()

    def test_unrelated_main_changes_require_a_dedicated_repair(self):
        for path in ('package.json', 'open-rankings/fixture/products.json', 'scripts/unrelated.py'):
            fixture = EvidenceFixture()
            fixture.changed.append(path)
            with self.subTest(path=path), self.assertRaisesRegex(RuntimeError, 'outside the bounded recovery code'):
                fixture.collect()

    def test_replay_timestamp_must_be_bounded_and_inside_the_failed_run(self):
        for timestamp in ('', '2026-01-02', '2026-01-02T12:01:00Z'):
            fixture = EvidenceFixture()
            fixture.timestamp = timestamp
            with self.subTest(timestamp=timestamp), self.assertRaisesRegex(RuntimeError, 'no bounded replay timestamp'):
                fixture.collect()
        for timestamp in ('2026-01-02T11:59:59.999Z', '2026-01-02T12:02:00.001Z'):
            fixture = EvidenceFixture()
            fixture.timestamp = timestamp
            with self.subTest(timestamp=timestamp), self.assertRaisesRegex(RuntimeError, 'outside the authenticated failed run'):
                fixture.collect()


class ReplayFixture:
    def __init__(self):
        self.result = failed_report()
        self.files = ['open-rankings/fixture/rankings.json']
        self.entry = f'100644 blob {"0" * 40}\t{self.files[0]}'
        self.reconstructed = TREE
        self.final_tree = GENERATED
        self.dirty = ''
        self.calls = []
        self.outputs = []
        self.failure = None
        self.ordinary_tree_reads = 0

    def command(self, args, **kwargs):
        self.calls.append((args, kwargs))
        if self.failure == args:
            raise subprocess.CalledProcessError(17, args)
        if args[:4] == ['pnpm', 'exec', 'tsx', 'rankings-engine/scripts/repair-refresh.ts']:
            Path(args[8]).write_text(json.dumps(self.result))

    def output(self, args, **kwargs):
        self.outputs.append((args, kwargs))
        if args == ['git', 'write-tree']:
            if kwargs.get('env', {}).get('GIT_INDEX_FILE'):
                return self.reconstructed
            self.ordinary_tree_reads += 1
            return GENERATED if self.ordinary_tree_reads == 1 else self.final_tree
        if args == ['git', 'diff', '--name-only', TRUSTED, GENERATED]:
            return '\n'.join(self.files)
        if args[:3] == ['git', 'ls-tree', GENERATED]:
            return self.entry
        if args == ['git', 'diff', '--name-only']:
            return self.dirty
        raise AssertionError(args)

    def execute(self, directory):
        return recovery.replay(self.command, self.output, failed_report(), proof_record(), TRUSTED, directory)


class RecoveryReplayTests(unittest.TestCase):
    def test_replay_uses_current_trusted_code_fixed_time_isolated_index_and_fresh_gates(self):
        fixture = ReplayFixture()
        secrets = {key: 'fixture-unavailable' for key in (
            'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'GH_TOKEN', 'GITHUB_TOKEN',
            'UM_JUDGE_MODEL', 'PA_MODEL', 'UM_DATA_DIR', 'PA_DATA_DIR', 'NODE_OPTIONS', 'GIT_INDEX_FILE')}
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, secrets):
            fixture.execute(directory)
            args, kwargs = fixture.calls[0]
            self.assertEqual(args[4:7], [ORIGINAL, BASE, 'fixture'])
            self.assertEqual(args[9:], ['--replay', TRUSTED, AT])
            self.assertEqual(json.loads(Path(args[7]).read_text()), [])
            self.assertFalse(set(secrets) & set(kwargs['env']))
        self.assertEqual([args for args, _ in fixture.calls if args in recovery.GATES], recovery.GATES)
        self.assertIn((['node', 'rankings-engine/scripts/check-refresh-stability.mjs', BASE, HEAD], kwargs), fixture.calls)
        index_calls = [(args, options) for args, options in fixture.calls if args[:2] in (
            ['git', 'read-tree'], ['git', 'update-index'])]
        self.assertEqual(index_calls[0][0], ['git', 'read-tree', BASE])
        self.assertEqual(index_calls[1][0][-1], f'100644,{"0" * 40},open-rankings/fixture/rankings.json')
        for _, options in index_calls:
            self.assertNotEqual(options['env']['GIT_INDEX_FILE'], secrets['GIT_INDEX_FILE'])
            self.assertFalse((set(secrets) - {'GIT_INDEX_FILE'}) & set(options['env']))

    def test_replay_rejects_changed_identity_or_any_model_work_before_gates(self):
        changes = [('mode', 'repair'), ('arena', 'other'), ('head', HEAD), ('main', TRUSTED),
                   ('restored', ['cell']), ('rejudged', ['product']), ('audits', ['audit']),
                   ('unresolved', ['finding']), ('evidenceRenames', {'fixture-product': {'old': 'new'}})]
        for key, value in changes:
            fixture = ReplayFixture()
            fixture.result[key] = value
            with self.subTest(key=key), tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(RuntimeError, 'outside the authenticated no-model base update'):
                    fixture.execute(directory)
            self.assertEqual(len(fixture.calls), 1)

    def test_whole_tree_mismatch_prevents_every_validation_gate(self):
        fixture = ReplayFixture()
        fixture.reconstructed = '0' * 40
        with tempfile.TemporaryDirectory() as directory, self.assertRaisesRegex(RuntimeError, 'Replayed whole tree differs'):
            fixture.execute(directory)
        self.assertFalse(any(args in recovery.GATES for args, _ in fixture.calls))

    def test_replay_may_not_change_code_delete_data_or_write_nonregular_entries(self):
        fixture = ReplayFixture()
        fixture.files = ['scripts/refresh-repair.py']
        with tempfile.TemporaryDirectory() as directory, self.assertRaisesRegex(RuntimeError, 'executable code or undeclared data'):
            fixture.execute(directory)
        for entry in ('', f'120000 blob {"0" * 40}\topen-rankings/fixture/rankings.json',
                      f'100755 blob {"0" * 40}\topen-rankings/fixture/rankings.json'):
            fixture = ReplayFixture()
            fixture.entry = entry
            with self.subTest(entry=entry), tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(RuntimeError, 'deleted or non-regular data'):
                    fixture.execute(directory)

    def test_every_gate_and_stability_failure_stops_the_remaining_commands(self):
        for gate in recovery.GATES + [['node', 'rankings-engine/scripts/check-refresh-stability.mjs', BASE, HEAD]]:
            fixture = ReplayFixture()
            fixture.failure = gate
            with self.subTest(gate=gate), tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(subprocess.CalledProcessError) as failure:
                    fixture.execute(directory)
            self.assertEqual(failure.exception.cmd, gate)
            self.assertEqual(fixture.calls[-1][0], gate)

    def test_validation_cannot_change_the_index_or_leave_dirty_files(self):
        for change in ('final_tree', 'dirty'):
            fixture = ReplayFixture()
            setattr(fixture, change, '0' * 40 if change == 'final_tree' else 'README.md')
            with self.subTest(change=change), tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(RuntimeError, 'Validation changed the replayed tree'):
                    fixture.execute(directory)


class RecoveryGitFixtureTests(unittest.TestCase):
    def test_real_git_reconstructs_the_exact_old_tree_without_downgrading_trusted_code(self):
        self.check_git_replay(False)

    def test_historical_snapshot_excludes_newer_data_but_keeps_current_code(self):
        self.check_git_replay(True)

    def check_git_replay(self, historical):
        git_binary = shutil.which('git')
        if git_binary is None:
            self.skipTest('Git is required for the isolated whole-tree fixture')
        with tempfile.TemporaryDirectory(prefix='receipt-recovery-git-') as directory:
            root = Path(directory)
            def git(*args, env=None):
                return subprocess.check_output([git_binary, *args], cwd=root, env=env,
                                               stderr=subprocess.PIPE, text=True).strip()
            git('init', '-b', 'main')
            git('config', 'user.name', 'Fictional Fixture')
            git('config', 'user.email', 'fixture@example.invalid')
            rankings = root / 'open-rankings/fixture/rankings.json'
            rankings.parent.mkdir(parents=True)
            rankings.write_text('{"fixture":"initial"}\n')
            (root / 'rankings-engine/cache').mkdir(parents=True)
            (root / 'rankings-engine/cache/.keep').write_text('')
            (root / 'README.md').write_text('Fixture\n')
            (root / 'trusted-code.py').write_text('version = 1\n')
            git('add', '.')
            git('commit', '-m', 'fictional shared ancestor')
            common = git('rev-parse', 'HEAD')
            rankings.write_text('{"fixture":"original"}\n')
            git('add', '.')
            git('commit', '-m', 'fictional original refresh')
            original = git('rev-parse', 'HEAD')
            git('checkout', '-B', 'main', common)
            (root / 'base-only.txt').write_text('Base content survives replay.\n')
            git('add', '.')
            git('commit', '-m', 'fictional base update')
            base = git('rev-parse', 'HEAD')
            generated_data = json.dumps({'fixture': 'replayed', 'generatedAt': AT}) + '\n'
            rankings.write_text(generated_data)
            git('add', '.')
            tree = git('write-tree')
            orphan = git('commit-tree', tree, '-p', original, '-p', base,
                         '-m', repair_message(base=base))
            git('reset', '--hard', base)
            (root / 'trusted-code.py').write_text('version = 2\n')
            if historical:
                rankings.write_text('{"fixture":"newer main"}\n')
                (rankings.parent / 'newer.json').write_text('{}\n')
            git('add', '.')
            git('commit', '-m', 'fictional trusted recovery code')
            trusted = git('rev-parse', 'HEAD')
            report = {**failed_report(), 'head': original, 'main': base}
            proof = {**proof_record(), 'head': orphan, 'originalHead': original,
                     'base': base, 'parents': [original, base], 'tree': tree,
                     **({'historicalData': True} if historical else {})}
            commands = []
            def command(args, **kwargs):
                commands.append(args)
                if args[:4] == ['pnpm', 'exec', 'tsx', 'rankings-engine/scripts/repair-refresh.ts']:
                    self.assertEqual(args[9:12], ['--replay-historical' if historical else '--replay', trusted, AT])
                    if historical:
                        self.assertEqual(rankings.read_text(), '{"fixture":"initial"}\n')
                        self.assertFalse((rankings.parent / 'newer.json').exists())
                        self.assertEqual(args[12], git('write-tree'))
                    self.assertEqual((root / 'trusted-code.py').read_text(), 'version = 2\n')
                    rankings.write_text(generated_data)
                    Path(args[8]).write_text(json.dumps(report))
                elif args[0] == 'git':
                    self.assertIn(args[1], ('add', 'read-tree', 'update-index', 'restore'))
                    git(*args[1:], **kwargs)
                elif args not in recovery.GATES and args != [
                        'node', 'rankings-engine/scripts/check-refresh-stability.mjs', base, orphan]:
                    raise AssertionError(args)
            def output(args, **kwargs):
                self.assertEqual(args[0], 'git')
                return git(*args[1:], **kwargs)
            with tempfile.TemporaryDirectory() as replay_dir:
                recovery.replay(command, output, report, proof, trusted, replay_dir)
            fields, parents, actual_tree, _ = recovery.commit_binding(output, orphan)
            self.assertEqual(fields, {'Run': RUN, 'Base': base, 'Attempt': '1'})
            self.assertEqual(parents, [original, base])
            self.assertEqual(actual_tree, tree)
            self.assertEqual(git('rev-parse', 'HEAD'), trusted)
            self.assertEqual((root / 'trusted-code.py').read_text(), 'version = 2\n')
            self.assertEqual(git('show', f'{orphan}:trusted-code.py'), 'version = 1')
            self.assertEqual((root / 'base-only.txt').read_text(), 'Base content survives replay.\n')
            self.assertEqual([args for args in commands if args in recovery.GATES], recovery.GATES)


class HistoricalPathTests(unittest.TestCase):
    def test_paths_are_data_only_not_configuration_or_traversal(self):
        for file in ('open-rankings/fixture/products.json', 'rankings-engine/cache/judge/fixture/item.json'):
            self.assertTrue(recovery.historical_path(file))
        for file in ('open-rankings/package.json', 'open-rankings/fixture/tsconfig.json',
                     'open-rankings/a/../b.json', 'open-rankings/.hidden.json', 'open-rankings/a.js',
                     'open-rankings/a/loader.config.json', 'scripts/input.json',
                     'open-rankings/node_modules/input.json', 'open-rankings/a\\b.json'):
            with self.subTest(file=file): self.assertFalse(recovery.historical_path(file))

    def test_explicit_historical_selection_cannot_stand_alone(self):
        for env in ({'RECOVER_HISTORICAL': 'true'}, {'RECOVER_HISTORICAL': 'yes'}):
            with self.assertRaises(RuntimeError): recovery.selected(env)

    def test_historical_snapshot_rejects_dirty_or_foreign_source_before_writes(self):
        for actual, dirty in ((BASE, ''), (TRUSTED, ' M input')):
            output = Mock(side_effect=[actual, dirty] if actual == TRUSTED else [actual])
            command = Mock()
            with self.assertRaisesRegex(RuntimeError, 'clean trusted checkout'):
                recovery.historical_snapshot(command, output, BASE, TRUSTED, {})
            command.assert_not_called()

    def test_historical_snapshot_rejects_changed_other_corpus_or_unsafe_paths(self):
        for file in ('open-processes/fixture.json', 'jurisdictions/fixture.json',
                     'open-rankings/package.json', 'rankings-engine/cache/run.sh'):
            output = Mock(side_effect=[TRUSTED, '', file]); command = Mock()
            with self.assertRaises(RuntimeError):
                recovery.historical_snapshot(command, output, BASE, TRUSTED, {})
            command.assert_not_called()

    def test_historical_snapshot_rejects_symlink_executable_gitlink(self):
        file = 'open-rankings/fixture/products.json'
        for mode, kind in (('120000', 'blob'), ('100755', 'blob'), ('160000', 'commit')):
            output = Mock(side_effect=[TRUSTED, '', file, f'{mode} {kind} {BASE}\t{file}'])
            command = Mock()
            with self.assertRaisesRegex(RuntimeError, 'regular authenticated'):
                recovery.historical_snapshot(command, output, BASE, TRUSTED, {})
            command.assert_not_called()

    def test_snapshot_detects_blob_change_during_materialization(self):
        file = 'open-rankings/fixture/products.json'
        output = Mock(side_effect=[TRUSTED, '', file, f'100644 blob {BASE}\t{file}',
                                  f'100644 blob {TRUSTED}\t{file}', f'100644 {TRUSTED} 0\t{file}'])
        with self.assertRaisesRegex(RuntimeError, 'blob identity changed'):
            recovery.historical_snapshot(Mock(), output, BASE, TRUSTED, {})


class ResumeFixture:
    def __init__(self, report=None):
        self.report = attestation() if report is None else report
        self.run = run_record(NEW_RUN, TRUSTED)
        self.content = archive_bytes(self.report)
        self.artifact = artifact_record(self.content, name=RECEIPT, run=self.run, artifact_id='404')
        self.listing = {'total_count': 1, 'artifacts': [self.artifact]}
        self.extra_runs = {}
        self.api_calls = []
        self.commands = []

    def api(self, endpoint):
        self.api_calls.append(endpoint)
        values = {f'repos/{REPO}/actions/artifacts?name={RECEIPT}&per_page=100': self.listing,
                  f'repos/{REPO}/actions/runs/{NEW_RUN}': self.run,
                  f'repos/{REPO}/actions/workflows/refresh-repair.yml': workflow(),
                  f'repos/{REPO}/actions/artifacts/404': self.artifact}
        values.update({f'repos/{REPO}/actions/runs/{run_id}': run for run_id, run in self.extra_runs.items()})
        if endpoint not in values:
            raise AssertionError(endpoint)
        return values[endpoint]

    def output(self, args, **kwargs):
        if args == ['git', 'merge-base', TRUSTED, TRUSTED]:
            return TRUSTED
        return EvidenceFixture().output(args, **kwargs)

    def command(self, args, **kwargs):
        self.commands.append(args)
        if args != ['gh', 'api', f'repos/{REPO}/actions/artifacts/404/zip']:
            raise AssertionError(args)
        kwargs['stdout'].write(self.content)

    def resume(self):
        return recovery.recovery_resume(self.api, self.command, self.output, REPO, NUMBER, HEAD, TRUSTED)


class RecoveryResumeTests(unittest.TestCase):
    def test_new_run_bound_attestation_resumes_the_original_orphan(self):
        fixture = ResumeFixture()
        self.assertEqual(fixture.resume(), attestation())
        self.assertEqual(fixture.commands, [['gh', 'api', f'repos/{REPO}/actions/artifacts/404/zip']])

    def test_missing_expired_wrong_name_and_original_run_receipts_do_not_attest(self):
        for change in (None, {'expired': True}, {'name': 'unrelated'},
                       {'workflow_run': {'id': int(RUN)}}, {'workflow_run': {'id': NEW_RUN}}):
            fixture = ResumeFixture()
            fixture.listing['artifacts'] = [] if change is None else [{**fixture.artifact, **change}]
            with self.subTest(change=change):
                self.assertIsNone(fixture.resume())
            self.assertEqual(fixture.commands, [])

    def test_unbounded_listing_cannot_hide_an_existing_attestation(self):
        fixture = ResumeFixture()
        fixture.listing['total_count'] = 100
        with self.assertRaisesRegex(RuntimeError, 'listing exceeds the inspection limit'):
            fixture.resume()

    def test_resume_requires_the_exact_new_run_head_parent_tree_and_validation_set(self):
        changes = [('attestationVersion', 2), ('runId', RUN), ('pr', NUMBER + 1),
                   ('publishedHead', ORIGINAL), ('main', BASE), ('validated', ['typecheck']),
                   ('originalThreads', ['new']), ('findingSnapshots', {'new': '0' * 64}),
                   ('audits', ['finding'])]
        for key, value in changes:
            with self.subTest(key=key), self.assertRaisesRegex(RuntimeError, 'exact head and new run'):
                ResumeFixture({**attestation(), key: value}).resume()
        for key, value in [('runId', NEW_RUN), ('base', TRUSTED), ('tree', ORIGINAL),
                           ('parents', [BASE, ORIGINAL]), ('originalHead', HEAD)]:
            report = attestation()
            report['recovery'][key] = value
            with self.subTest(proof=key), self.assertRaisesRegex(RuntimeError, 'exact head and new run'):
                ResumeFixture(report).resume()

    def test_non_recovery_audit_is_not_treated_as_a_recovery_receipt(self):
        self.assertIsNone(ResumeFixture({**attestation(), 'mode': 'base-update'}).resume())

    def test_newer_forged_name_artifacts_cannot_hide_an_older_authentic_receipt(self):
        changes = [
            {'path': '.github/workflows/untrusted.yml'}, {'head_branch': BRANCH},
            {'event': 'pull_request'}, {'repository': {'full_name': 'other/repo'}},
            {'head_repository': {'full_name': 'fork/repo'}}, {'status': 'in_progress'},
            {'id': 999}, {'head_sha': 'not-a-sha'},
        ]
        for change in changes:
            fixture = ResumeFixture()
            fixture.extra_runs['203'] = {**run_record('203', TRUSTED), **change}
            forged = {**fixture.artifact, 'id': 405, 'workflow_run': {'id': 203}}
            fixture.listing = {'total_count': 2, 'artifacts': [fixture.artifact, forged]}
            with self.subTest(change=change):
                self.assertEqual(fixture.resume(), attestation())
            self.assertEqual(fixture.commands, [['gh', 'api', f'repos/{REPO}/actions/artifacts/404/zip']])
            self.assertNotIn(f'repos/{REPO}/actions/artifacts/405', fixture.api_calls)
            self.assertLess(fixture.api_calls.index(f'repos/{REPO}/actions/runs/203'),
                            fixture.api_calls.index(f'repos/{REPO}/actions/runs/{NEW_RUN}'))

    def test_completed_attestation_requires_a_success_or_failure_result(self):
        for conclusion in ('success', 'failure'):
            fixture = ResumeFixture()
            fixture.run['conclusion'] = conclusion
            with self.subTest(conclusion=conclusion):
                self.assertEqual(fixture.resume(), attestation())
        for conclusion in ('cancelled', 'timed_out', 'action_required', None):
            fixture = ResumeFixture()
            fixture.run['conclusion'] = conclusion
            with self.subTest(conclusion=conclusion), self.assertRaisesRegex(RuntimeError, 'no completed validation result'):
                fixture.resume()
            self.assertEqual(fixture.commands, [])


class RecoveryControllerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.dict(os.environ, {'REPO': REPO, 'PR_NUMBER': str(NUMBER),
                                     'PR_HEAD': HEAD, 'GITHUB_RUN_ID': NEW_RUN}):
            cls.module = runpy.run_path(str(ROOT / 'scripts/refresh-repair.py'), run_name='recovery_controller_test')
        cls.namespace = cls.module['recover_receipt'].__globals__

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='receipt-controller-')
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.report_file = self.directory / 'refresh-repair-report.json'
        self.output_file = self.directory / 'github-output'
        self.command = Mock()
        self.current = Mock(side_effect=lambda: copy.deepcopy(PR))
        self.threads = Mock(return_value=(HEAD, []))
        self.review_active = Mock(return_value=False)
        self.verify = Mock(side_effect=MissingProvenance('fictional orphan receipt absent'))
        self.trusted_run = Mock(return_value=run_record(NEW_RUN, TRUSTED, active=True))
        self.evidence = Mock(return_value=(failed_report(), proof_record()))
        self.replay = Mock()
        self.main_reads = 0
        self.workflow_reads = 0
        self.remote_reads = 0
        self.api_override = None
        self.output_override = None
        self.namespace_values = {
            'command': self.command, 'current': self.current, 'threads': self.threads,
            'review_active': self.review_active, 'verify_provenance': self.verify,
            'trusted_run': self.trusted_run, 'recovery_evidence': self.evidence, 'replay': self.replay,
            'api': self.api, 'output': self.output,
        }

    def api(self, endpoint, data=None):
        self.assertIsNone(data, 'Recovery must never resolve threads or submit API mutations')
        if endpoint == f'repos/{REPO}/branches/main':
            self.main_reads += 1
            value = {'commit': {'sha': TRUSTED}}
        elif endpoint == f'repos/{REPO}/actions/workflows/refresh-repair.yml':
            self.workflow_reads += 1
            value = workflow()
        else:
            raise AssertionError(endpoint)
        return self.api_override(endpoint, value) if self.api_override else value

    def output(self, args, **kwargs):
        if args == ['git', 'rev-parse', 'HEAD']:
            value = TRUSTED
        elif args == ['git', 'rev-parse', f'refs/repair/recovery/{NEW_RUN}']:
            value = HEAD
        elif args == ['git', 'ls-remote', '--refs', 'origin', f'refs/heads/{BRANCH}']:
            self.remote_reads += 1
            value = f'{HEAD}\trefs/heads/{BRANCH}'
        else:
            raise AssertionError(args)
        return self.output_override(args, value) if self.output_override else value

    def invoke(self, *, entry='recover_receipt', environment=None, extra=None):
        environ = {'RUNNER_TEMP': str(self.directory), 'GITHUB_OUTPUT': str(self.output_file),
                   'RECOVER_RUN': RUN, 'RECOVER_ARTIFACT': ARTIFACT, 'RECOVER_DIGEST': '1' * 64}
        environ.update(environment or {})
        with patch.dict(self.namespace, {**self.namespace_values, **(extra or {})}), patch.dict(os.environ, environ), redirect_stdout(io.StringIO()):
            if entry == 'main':
                return self.module['main']()
            return self.module['recover_receipt'](copy.deepcopy(PR), (RUN, ARTIFACT, '1' * 64))

    def assert_no_receipt(self):
        self.assertFalse(self.output_file.exists(), 'A failed recovery must not emit a receipt output')
        self.assertFalse(self.report_file.exists(), 'An unvalidated recovery must not create an attestation')
        self.assertFalse(any(call.args[0][:2] == ['git', 'push'] for call in self.command.call_args_list))

    def test_explicit_recovery_routes_before_ordinary_repair_and_writes_report_before_output(self):
        original_open = open
        events = []
        def checked_open(file, mode='r', *args, **kwargs):
            if str(file) == str(self.output_file):
                self.assertEqual(mode, 'a')
                report = json.loads(self.report_file.read_text())
                self.assertEqual(report['runId'], NEW_RUN)
                self.assertEqual(report['publishedHead'], HEAD)
                self.assertEqual(report['main'], TRUSTED)
                self.assertEqual(report['recovery']['runId'], RUN)
                self.assertEqual(report['validated'], [gate[1] for gate in recovery.GATES] + ['refresh-stability'])
                events.append('new-run-report-persisted-before-output')
            return original_open(file, mode, *args, **kwargs)
        with patch('builtins.open', checked_open):
            self.invoke(entry='main')
        self.assertEqual(events, ['new-run-report-persisted-before-output'])
        self.assertEqual(self.output_file.read_text(), f'published_head={HEAD}\n')
        self.assertEqual(self.command.call_args_list[0].args[0], [
            'git', 'fetch', '--no-tags', 'origin', f'refs/heads/{BRANCH}:refs/repair/recovery/{NEW_RUN}'])
        self.assertEqual(self.command.call_count, 1, 'Recovery must not push, dispatch, or run ordinary repair')
        self.replay.assert_called_once()
        self.assertEqual((self.main_reads, self.workflow_reads, self.remote_reads), (2, 2, 2))
        self.assertEqual(ResumeFixture(json.loads(self.report_file.read_text())).resume()['runId'], NEW_RUN)

    def test_ordinary_missing_provenance_never_implicitly_enters_recovery(self):
        with self.assertRaisesRegex(MissingProvenance, 'fictional orphan receipt absent'):
            self.invoke(entry='main', environment={'RECOVER_RUN': '', 'RECOVER_ARTIFACT': '', 'RECOVER_DIGEST': ''})
        self.evidence.assert_not_called()
        self.replay.assert_not_called()
        self.assert_no_receipt()

    def test_partial_selection_fails_before_provenance_or_replay(self):
        with self.assertRaisesRegex(RuntimeError, 'exact failed run'):
            self.invoke(entry='main', environment={'RECOVER_DIGEST': ''})
        self.verify.assert_not_called()
        self.assert_no_receipt()

    def test_current_receipt_and_api_errors_cannot_authorize_recovery(self):
        self.verify.side_effect = None
        with self.assertRaisesRegex(RuntimeError, 'already has provenance'):
            self.invoke()
        self.trusted_run.assert_not_called()
        self.verify.side_effect = RuntimeError('fixture API unavailable')
        with self.assertRaisesRegex(RuntimeError, 'fixture API unavailable'):
            self.invoke()
        self.assert_no_receipt()

    def test_distinct_active_run_output_destination_and_matching_checkout_are_required(self):
        for run_id in (RUN, '0', 'not-a-run'):
            with self.subTest(run_id=run_id), self.assertRaisesRegex(RuntimeError, 'distinct new workflow run'):
                self.invoke(extra={'RUN_ID': run_id})
        with self.assertRaisesRegex(RuntimeError, 'distinct new workflow run'):
            self.invoke(environment={'GITHUB_OUTPUT': ''})
        self.trusted_run.return_value = run_record(NEW_RUN, BASE, active=True)
        with self.assertRaisesRegex(RuntimeError, 'checkout differs from this run source'):
            self.invoke()
        self.assert_no_receipt()

    def test_fetched_ref_must_still_be_the_explicit_orphan(self):
        self.output_override = lambda args, value: ORIGINAL if args[1] == 'rev-parse' and args[2] != 'HEAD' else value
        with self.assertRaisesRegex(RuntimeError, 'branch no longer matches'):
            self.invoke()
        self.evidence.assert_not_called()
        self.assert_no_receipt()

    def test_late_head_branch_hold_draft_opt_in_and_author_changes_prevent_attestation(self):
        changes = [
            {'head': {**PR['head'], 'sha': ORIGINAL}}, {'head': {**PR['head'], 'ref': 'story-runner/fixture-999'}},
            {'labels': [{'name': 'automerge-hold'}]}, {'draft': True}, {'auto_merge': None}, {'state': 'closed'},
            {'user': {**PR['user'], 'id': 999}}, {'head': {**PR['head'], 'repo': {'full_name': 'fork/repo'}}},
        ]
        for change in changes:
            self.current.side_effect = [copy.deepcopy(PR), {**copy.deepcopy(PR), **change}]
            with self.subTest(change=change), self.assertRaisesRegex(RuntimeError, 'identity, expected head or automation opt-in changed'):
                self.invoke()
            self.assert_no_receipt()
        self.assertEqual(self.replay.call_count, len(changes))

    def test_late_base_and_workflow_identity_or_pause_changes_prevent_attestation(self):
        cases = [('main', {'commit': {'sha': BASE}}), ('workflow', {'state': 'disabled_manually'}),
                 ('workflow', {'id': 999}), ('workflow', {'path': 'other.yml'})]
        for kind, replacement in cases:
            self.main_reads = self.workflow_reads = 0
            def override(endpoint, value):
                if kind == 'main' and endpoint.endswith('/branches/main') and self.main_reads == 2:
                    return replacement
                if kind == 'workflow' and endpoint.endswith('/refresh-repair.yml') and self.workflow_reads == 2:
                    return {**value, **replacement}
                return value
            self.api_override = override
            expected = 'Main changed during receipt recovery' if kind == 'main' else 'workflow identity changed or was paused'
            with self.subTest(kind=kind, replacement=replacement), self.assertRaisesRegex(RuntimeError, expected):
                self.invoke()
            self.assert_no_receipt()

    def test_late_review_activity_findings_or_review_head_changes_prevent_attestation(self):
        for finding_head, findings, active in ((HEAD, [], True), (HEAD, [{'id': 'new'}], False), (ORIGINAL, [], False)):
            self.threads.side_effect = [(HEAD, []), (finding_head, findings)]
            self.review_active.side_effect = [False, active]
            with self.subTest(head=finding_head, findings=findings, active=active):
                with self.assertRaisesRegex(RuntimeError, 'active/unresolved review'):
                    self.invoke()
            self.assert_no_receipt()

    def test_late_remote_ref_readback_prevents_attestation(self):
        self.output_override = lambda args, value: f'{ORIGINAL}\trefs/heads/{BRANCH}' if self.remote_reads == 2 and args[1] == 'ls-remote' else value
        with self.assertRaisesRegex(RuntimeError, 'Remote head changed after repair publication'):
            self.invoke()
        self.replay.assert_called_once()
        self.assert_no_receipt()

    def test_gate_failure_or_replay_tree_mismatch_emits_no_report_or_receipt(self):
        failures = [subprocess.CalledProcessError(17, ['pnpm', 'recompute-check']),
                    RuntimeError('Replayed whole tree differs from the explicitly selected orphan head')]
        for failure in failures:
            self.replay.side_effect = failure
            with self.subTest(failure=str(failure)), self.assertRaises(type(failure)) as raised:
                self.invoke()
            self.assertIs(raised.exception, failure)
            self.assert_no_receipt()

    def test_report_write_failure_does_not_emit_output(self):
        with patch.object(Path, 'write_text', side_effect=OSError('fixture report write failure')):
            with self.assertRaisesRegex(OSError, 'fixture report write failure'):
                self.invoke()
        self.assert_no_receipt()

    def test_ordinary_resume_consumes_the_fresh_attestation_before_the_failed_old_run(self):
        fixture = ResumeFixture()
        with patch.dict(self.namespace, {'api': fixture.api, 'output': fixture.output,
                                         'command': fixture.command}):
            resumed = self.module['load_resume_report'](HEAD, TRUSTED)
        self.assertEqual(resumed, attestation())
        self.assertNotIn(f'repos/{REPO}/actions/runs/{RUN}', fixture.api_calls)
        self.assertEqual(fixture.commands, [['gh', 'api', f'repos/{REPO}/actions/artifacts/404/zip']])


if __name__ == '__main__':
    unittest.main()
