"""Review gate regressions using recorded metadata shapes and no network calls."""
import json
import os
from pathlib import Path
import unittest
import tempfile
from unittest.mock import patch

SHA = 'a' * 40
OTHER = 'b' * 40
DESC = '0 unresolved Greptile findings; Foreloop excluded'


class ReviewGateTests(unittest.TestCase):
    def run_gate(self, *, target='513', head='', checks=None, threads=None, status=None,
                 pages=None, changed=False, metadata_error=False, status_read_error=False):
        source = (Path(__file__).resolve().parents[2] / '.github/workflows/review-findings.yml').read_text()
        selection = source.split('        run: |\n', 1)[1].split('\n  findings:', 1)[0]
        selection = '\n'.join(line[10:] if line.startswith('          ') else line for line in selection.splitlines())
        source = source.split('- name: Gate unresolved Greptile findings', 1)[1].split('        run: |\n', 1)[1]
        code = '\n'.join(line[10:] if line.startswith('          ') else line for line in source.splitlines())
        posts, reads = [], []
        prior = list(status or [])
        checks = checks if checks is not None else [
            {'id': 20, 'app': {'id': 867647}, 'status': 'completed', 'conclusion': 'success'}]
        threads = threads if threads is not None else [{'nodes': [], 'pageInfo': {'hasNextPage': False, 'endCursor': None}}]
        prs = [{'number': 513, 'head': {'sha': SHA}}, {'number': 999, 'head': {'sha': OTHER}}]

        def output(args, input=None, **_kwargs):
            if '--slurp' in args:
                return json.dumps([prs])
            endpoint = args[2]
            reads.append(endpoint)
            data = json.loads(input) if input else None
            if '/pulls/999' in endpoint:
                raise RuntimeError('unrelated PR must not block this CI run')
            if '/pulls/513' in endpoint:
                return json.dumps({'head': {'sha': SHA}, 'state': 'open'})
            if endpoint == 'graphql':
                if metadata_error:
                    raise RuntimeError('metadata unavailable')
                cursor = data['variables']['cursor']
                page = threads[0 if cursor is None else 1]
                return json.dumps({'data': {'repository': {'pullRequest': {
                    'headRefOid': OTHER if changed else SHA, 'reviewThreads': page}}}})
            if '/check-runs?' in endpoint:
                return json.dumps({'check_runs': checks})
            if endpoint.endswith('/status'):
                if status_read_error:
                    raise RuntimeError('status history unavailable')
                return json.dumps({'statuses': prior})
            if '/statuses/' in endpoint:
                posts.append(data)
                prior[:] = [data]
                return '{}'
            raise AssertionError(endpoint)

        env = {'REPO': 'owner/repo', 'SERVER_URL': 'https://github.com', 'RUN_ID': '123',
               'TARGET_PR': target, 'TARGET_HEAD': head}
        namespace = {}
        with patch.dict(os.environ, env), patch('subprocess.check_output', side_effect=output):
            try:
                with tempfile.NamedTemporaryFile(mode='r+') as selected:
                    with patch.dict(os.environ, {'GITHUB_OUTPUT': selected.name}):
                        exec(selection, {})
                    selected.seek(0)
                    numbers = json.loads(selected.read().split('=', 1)[1])
                    for number in numbers:
                        with patch.dict(os.environ, {'TARGET_PR': str(number)}):
                            exec(code, namespace)
            except SystemExit:
                pass
            if pages:
                for _ in range(pages):
                    namespace['publish'](SHA, 'success', DESC)
        return posts, reads

    def test_unchanged_success_creates_no_status_and_never_resets_pending(self):
        posts, _ = self.run_gate(status=[{'context': 'review-findings', 'state': 'success', 'description': DESC}])
        self.assertEqual(posts, [])

    def test_repeated_polls_do_not_exhaust_github_status_limit(self):
        posts, _ = self.run_gate(pages=1001)
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]['state'], 'success')

    def test_ci_checks_only_its_own_pr(self):
        posts, reads = self.run_gate()
        self.assertFalse(any('/pulls/999' in endpoint for endpoint in reads))
        self.assertEqual(posts[0]['state'], 'success')

    def test_dispatched_ci_targets_its_head(self):
        posts, reads = self.run_gate(target='', head=SHA)
        self.assertFalse(any('/pulls/999' in endpoint for endpoint in reads))
        self.assertEqual(posts[0]['state'], 'success')

    def test_latest_pending_review_cannot_reuse_an_old_success(self):
        checks = [{'id': 1, 'app': {'id': 867647}, 'status': 'completed', 'conclusion': 'success'},
                  {'id': 2, 'app': {'id': 867647}, 'status': 'in_progress', 'conclusion': None}]
        posts, _ = self.run_gate(checks=checks)
        self.assertEqual(posts[0]['state'], 'pending')

    def test_second_page_greptile_finding_blocks_but_foreloop_does_not(self):
        def thread(author):
            return {'isResolved': False, 'comments': {'nodes': [{'author': {'login': author}}]}}
        pages = [{'nodes': [thread('foreloop-app')], 'pageInfo': {'hasNextPage': True, 'endCursor': 'next'}},
                 {'nodes': [thread('greptile-apps')], 'pageInfo': {'hasNextPage': False, 'endCursor': None}}]
        posts, _ = self.run_gate(threads=pages)
        self.assertEqual(posts[0]['state'], 'failure')
        self.assertTrue(posts[0]['description'].startswith('1 unresolved'))

    def test_foreloop_alone_does_not_block(self):
        pages = [{'nodes': [{'isResolved': False, 'comments': {'nodes': [{'author': {'login': 'foreloop-app'}}]}}],
                  'pageInfo': {'hasNextPage': False, 'endCursor': None}}]
        posts, _ = self.run_gate(threads=pages)
        self.assertEqual(posts[0]['state'], 'success')

    def test_metadata_failure_revokes_stale_success(self):
        posts, _ = self.run_gate(metadata_error=True,
            status=[{'context': 'review-findings', 'state': 'success', 'description': DESC}])
        self.assertEqual(posts[0]['state'], 'pending')

    def test_status_read_failure_revokes_stale_success(self):
        posts, _ = self.run_gate(status_read_error=True,
            status=[{'context': 'review-findings', 'state': 'success', 'description': DESC}])
        self.assertEqual(posts, [{
            'state': 'pending',
            'context': 'review-findings',
            'description': 'Review metadata unavailable; retry required',
            'target_url': 'https://github.com/owner/repo/actions/runs/123',
        }])

    def test_head_change_never_publishes_approval(self):
        posts, _ = self.run_gate(changed=True)
        self.assertFalse(any(post['state'] == 'success' for post in posts))


if __name__ == '__main__':
    unittest.main()
