"""Review gate regressions using recorded metadata shapes and no network calls."""
import json
import hashlib
import os
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import unittest
import tempfile
from unittest.mock import patch

SHA = 'a' * 40
OTHER = 'b' * 40
DESC = '0 unresolved Greptile findings; Foreloop excluded'
RENOVATE = {'id': 29139614, 'login': 'renovate[bot]', 'type': 'Bot'}
RENOVATE_HEAD = {'sha': SHA, 'ref': 'renovate/non-major-dependencies',
                 'repo': {'full_name': 'owner/repo'}}


def successful_status(run=122):
    return {'context': 'review-findings', 'state': 'success', 'description': DESC,
            'target_url': f'https://github.com/owner/repo/actions/runs/{run}'}


class ReviewGateTests(unittest.TestCase):
    def run_gate(self, *, target='513', head='', checks=None, threads=None, status=None,
                 pages=None, changed=False, metadata_error=False, status_read_error=False,
                 author=None, pr_head=None, final_head=None, final_state='open',
                 status_runs=None, poll_run_ids=None, internal=None, files=None,
                 file_mode="100644", reviews=None, final_override=None, proof_error=False,
                 permissions=None, permission_error=False, final_reviews=None,
                 final_permissions=None, proof_reads=None, content_bot='', bot_id=99):
        source = (Path(__file__).resolve().parents[2] / '.github/workflows/review-findings.yml').read_text()
        selection = source.split('        run: |\n', 1)[1].split('\n  findings:', 1)[0]
        selection = '\n'.join(line[10:] if line.startswith('          ') else line for line in selection.splitlines())
        source = source.split('- name: Check source trust and Greptile findings', 1)[1].split('        run: |\n', 1)[1]
        code = '\n'.join(line[10:] if line.startswith('          ') else line for line in source.splitlines())
        posts, reads = [], []
        prior = list(status or [])
        checks = checks if checks is not None else [
            {'id': 20, 'app': {'id': 867647}, 'status': 'completed', 'conclusion': 'success'}]
        threads = threads if threads is not None else [{'nodes': [], 'pageInfo': {'hasNextPage': False, 'endCursor': None}}]
        prs = [{'number': 513, 'head': {'sha': SHA}}, {'number': 999, 'head': {'sha': OTHER}}]

        files = files if files is not None else [{'filename':'open-rankings/email/verdicts.json','status':'modified'}]
        tree_nodes={SHA:{}}
        for file in files:
            parts=file['filename'].split('/');parent=SHA
            for index,part in enumerate(parts):
                child=hashlib.sha256('/'.join(parts[:index+1]).encode()).hexdigest()
                final=index==len(parts)-1
                tree_nodes[parent][part]={'path':part,'sha':child,'type':'blob' if final else 'tree',
                                         'mode':file_mode if final else '040000'}
                tree_nodes.setdefault(child,{})
                parent=child

        review_reads, permission_reads = 0, 0

        def output(args, input=None, **_kwargs):
            nonlocal review_reads, permission_reads
            if '--slurp' in args:
                if '/files?' in args[-1]:return json.dumps([files])
                if '/reviews?' in args[-1]:
                    review_reads += 1
                    current = final_reviews if review_reads > 1 and final_reviews is not None else reviews
                    return json.dumps([current or []])
                return json.dumps([prs])
            endpoint = args[2]
            reads.append(endpoint)
            data = json.loads(input) if input else None
            if endpoint.startswith('users/'):
                return json.dumps({'id':bot_id,'type':'Bot'})
            if '/pulls/999' in endpoint:
                raise RuntimeError('unrelated PR must not block this CI run')
            if '/pulls/513' in endpoint:
                final = reads.count(endpoint) > 1
                return json.dumps({'head': (final_head if final and final_head is not None
                                           else pr_head or {'sha': SHA}),
                                   'user': author or {'id': 1, 'login': 'contributor', 'type': 'User'},
                                   'state': final_state if final else 'open',
                                   **(internal or {}), **((final_override or {}) if final else {})})
            if endpoint == 'graphql':
                if metadata_error:
                    raise RuntimeError('metadata unavailable')
                cursor = data['variables']['cursor']
                page = threads[0 if cursor is None else 1]
                return json.dumps({'data': {'repository': {'pullRequest': {
                    'headRefOid': OTHER if changed else SHA, 'reviewThreads': page}}}})
            if '/git/trees/' in endpoint:
                return json.dumps({'truncated':False,'tree':list(tree_nodes[endpoint.rsplit('/',1)[1]].values())})
            if '/collaborators/' in endpoint and endpoint.endswith('/permission'):
                permission_reads += 1
                if permission_error:
                    raise RuntimeError('maintainer permissions unavailable')
                current = final_permissions if permission_reads > 1 and final_permissions is not None else permissions
                return json.dumps(current or {'permission': 'none', 'user': {}})
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
            if '/actions/runs/' in endpoint:
                run_id = int(endpoint.rsplit('/', 1)[1])
                run = (status_runs or {}).get(run_id, {
                    'id': run_id, 'status': 'completed', 'conclusion': 'success'})
                if isinstance(run, Exception):
                    raise run
                return json.dumps(run)
            raise AssertionError(endpoint)

        env = {'REPO': 'owner/repo', 'SERVER_URL': 'https://github.com', 'RUN_ID': '123',
               'TARGET_PR': target, 'TARGET_HEAD': head, 'CONTENT_BOT_LOGIN':content_bot}
        namespace = {}
        def provenance(*_args):
            if proof_reads is not None:
                proof_reads.append(True)
            if proof_error:
                raise RuntimeError('No canonical receipt')
        with patch.dict(os.environ, env), patch('subprocess.check_output', side_effect=output), patch('refresh_policy.verify_provenance',side_effect=provenance):
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
            for run_id in poll_run_ids or []:
                with patch.dict(os.environ, {'RUN_ID': str(run_id)}):
                    namespace['publish'](SHA, 'success', DESC)
        return posts, reads

    def internal_pr(self):
        return {'number':513,'head':{'sha':SHA,'ref':'story-runner/email-123','repo':{'full_name':'owner/repo'}},
                'base':{'ref':'main','repo':{'full_name':'owner/repo'}},'changed_files':1,'draft':False,'labels':[],
                'user':{'id':41898282,'login':'github-actions[bot]','type':'Bot'}}

    def test_authenticated_scoped_internal_head_passes_all_existing_review_gates(self):
        posts,_=self.run_gate(internal=self.internal_pr())
        self.assertEqual(posts[0]['state'],'success')

    def test_content_app_story_head_keeps_exact_receipt_scope_and_numeric_identity_gates(self):
        pr={**self.internal_pr(),'user':{'id':99,'login':'fixture-content[bot]','type':'Bot'}}
        for options,expected in [({},'success'), ({'proof_error':True},'pending'),
                ({'bot_id':100},'pending'), ({'content_bot':'other[bot]'},'pending'),
                ({'files':[{'filename':'rankings-engine/__tests__/claims.test.ts','status':'modified'}]},'pending')]:
            posts,_=self.run_gate(**{'internal':pr,'content_bot':'fixture-content[bot]',**options})
            self.assertEqual(posts[0]['state'],expected)

    def test_internal_hold_revokes_prior_green_even_if_it_arrives_on_final_read(self):
        for label in ['hold','manual-merge','automerge-hold','do-not-merge']:
            for final in [False,True]:
                pr=self.internal_pr();changes={'labels':[{'name':label}]}
                posts,_=self.run_gate(internal=pr if final else {**pr,**changes},
                    final_override=changes if final else {},status=[successful_status()])
                self.assertEqual(posts[0]['state'],'pending')

    def test_untrusted_current_heads_and_incomplete_scopes_cannot_reuse_success(self):
        base=self.internal_pr()
        cases=[{'internal':{**base,'user':{**base['user'],'id':1}}},
               {'internal':{**base,'head':{**base['head'],'repo':{'full_name':'fork/repo'}}}},
               {'internal':{**base,'draft':True}}, {'internal':{**base,'changed_files':2}},
               {'proof_error':True}, {'file_mode':'120000'}, {'file_mode':'100755'},
               {'files':[{'filename':'.github/workflows/ci.yml','status':'modified'}]},
               {'files':[{'filename':'open-rankings/email/verdicts.json','status':'renamed','previous_filename':'code.py'}]}]
        for case in cases:
            posts,_=self.run_gate(**{'internal':base,**case},status=[successful_status()])
            self.assertEqual(posts[0]['state'],'pending')

    def test_human_change_request_is_an_internal_manual_stop(self):
        posts,_=self.run_gate(internal=self.internal_pr(),reviews=[
            {'id':1,'user':{'id':7,'type':'User'},'state':'CHANGES_REQUESTED'}])
        self.assertEqual(posts[0]['state'],'pending')

    def manual_pr(self):
        return {**self.internal_pr(), 'labels': [{'name': 'maintainer-manual-merge'}], 'auto_merge': None}

    def maintainer_approval(self, *, head=SHA, state='APPROVED'):
        return {'id': 10, 'user': {'id': 7, 'login': 'maintainer', 'type': 'User'},
                'state': state, 'commit_id': head}

    def maintainer_permission(self, permission='write'):
        return {'permission': permission, 'user': {'id': 7, 'login': 'maintainer', 'type': 'User'}}

    def test_explicit_current_head_maintainer_review_can_replace_a_missing_receipt(self):
        for role in ['write', 'admin']:
            with self.subTest(role=role):
                proof_reads = []
                posts, reads = self.run_gate(internal=self.manual_pr(), proof_error=True,
                    reviews=[self.maintainer_approval()], permissions=self.maintainer_permission(role),
                    proof_reads=proof_reads)
                self.assertEqual(posts[0]['state'], 'success')
                self.assertIn('Maintainer-reviewed by maintainer', posts[0]['description'])
                self.assertEqual(proof_reads, [])
                self.assertEqual(reads.count('repos/owner/repo/collaborators/maintainer/permission'), 2)
        # GitHub maps the maintain role to the legacy write permission.
        permission = {**self.maintainer_permission(), 'role_name': 'maintain'}
        posts, _ = self.run_gate(internal=self.manual_pr(), proof_error=True,
            reviews=[self.maintainer_approval()], permissions=permission)
        self.assertEqual(posts[0]['state'], 'success')

    def test_content_app_manual_route_requires_both_bot_identity_and_maintainer_authority(self):
        pr = {**self.manual_pr(), 'user': {'id': 99, 'login': 'fixture-content[bot]', 'type': 'Bot'}}
        for overrides, expected in [({}, 'success'), ({'bot_id': 100}, 'pending'),
                                    ({'content_bot': 'other[bot]'}, 'pending'),
                                    ({'reviews': []}, 'pending'),
                                    ({'permissions': self.maintainer_permission('read')}, 'pending')]:
            with self.subTest(overrides=overrides):
                posts, _ = self.run_gate(**{'internal': pr, 'content_bot': 'fixture-content[bot]',
                    'proof_error': True, 'reviews': [self.maintainer_approval()],
                    'permissions': self.maintainer_permission(), **overrides})
                self.assertEqual(posts[0]['state'], expected)

    def test_manual_label_alone_or_old_bot_comment_and_dismissed_reviews_cannot_approve(self):
        approval = self.maintainer_approval()
        cases = [[], [self.maintainer_approval(head=OTHER)],
                 [self.maintainer_approval(state='COMMENTED')],
                 [self.maintainer_approval(state='DISMISSED')],
                 [{**approval, 'user': {**approval['user'], 'type': 'Bot'}}],
                 [{**approval, 'user': {**approval['user'], 'id': '7'}}],
                 [approval, {**self.maintainer_approval(state='DISMISSED'), 'id': 11}]]
        for reviews in cases:
            with self.subTest(reviews=reviews):
                posts, _ = self.run_gate(internal=self.manual_pr(), proof_error=True,
                    reviews=reviews, permissions=self.maintainer_permission(), status=[successful_status()])
                self.assertEqual(posts[0]['state'], 'pending')

    def test_manual_route_requires_auto_merge_explicitly_off(self):
        for value in [{}, {'enabled_by': {'login': 'maintainer'}}, False]:
            posts, _ = self.run_gate(internal={**self.manual_pr(), 'auto_merge': value},
                reviews=[self.maintainer_approval()], permissions=self.maintainer_permission())
            self.assertEqual(posts[0]['state'], 'pending')
        pr = self.manual_pr()
        del pr['auto_merge']
        posts, _ = self.run_gate(internal=pr, reviews=[self.maintainer_approval()],
                                 permissions=self.maintainer_permission())
        self.assertEqual(posts[0]['state'], 'pending')

    def test_manual_route_authenticates_identity_and_write_permission_and_fails_closed(self):
        good = self.maintainer_permission()
        cases = [{'permissions': self.maintainer_permission('read')},
                 {'permissions': self.maintainer_permission('none')},
                 {'permissions': {**good, 'user': {**good['user'], 'id': 8}}},
                 {'permissions': {**good, 'user': {**good['user'], 'login': 'another'}}},
                 {'permissions': {**good, 'user': {**good['user'], 'type': 'Bot'}}},
                 {'permissions': {'permission': 'write'}}, {'permission_error': True}]
        for case in cases:
            with self.subTest(case=case):
                posts, _ = self.run_gate(internal=self.manual_pr(), reviews=[self.maintainer_approval()],
                    status=[successful_status()], **case)
                self.assertEqual(posts[0]['state'], 'pending')

    def test_manual_authority_is_revalidated_before_publishing(self):
        cases = [{'final_reviews': []},
                 {'final_reviews': [self.maintainer_approval(state='DISMISSED')]},
                 {'final_permissions': self.maintainer_permission('read')},
                 {'final_override': {'labels': []}, 'proof_error': True},
                 {'final_override': {'auto_merge': {}}}]
        for case in cases:
            with self.subTest(case=case):
                posts, _ = self.run_gate(internal=self.manual_pr(), reviews=[self.maintainer_approval()],
                    permissions=self.maintainer_permission(), status=[successful_status()], **case)
                self.assertEqual(posts[0]['state'], 'pending')

    def test_manual_route_preserves_holds_scope_author_identity_and_current_head_checks(self):
        pr = self.manual_pr()
        cases = [{'internal': {**pr, 'labels': pr['labels'] + [{'name': 'hold'}]}},
                 {'internal': {**pr, 'labels': pr['labels'] + [{'name': 'manual-merge'}]}},
                 {'internal': {**pr, 'draft': True}},
                 {'internal': {**pr, 'user': {**pr['user'], 'id': 1}}},
                 {'internal': {**pr, 'head': {**pr['head'], 'repo': {'full_name': 'fork/repo'}}}},
                 {'files': [{'filename': '.github/workflows/ci.yml', 'status': 'modified'}]},
                 {'internal': {**pr, 'changed_files': 2}},
                 {'file_mode': '120000'}, {'file_mode': '100755'}, {'changed': True}]
        for case in cases:
            with self.subTest(case=case):
                posts, _ = self.run_gate(**{'internal': pr, 'reviews': [self.maintainer_approval()],
                    'permissions': self.maintainer_permission(), 'status': [successful_status()], **case})
                self.assertFalse(any(post['state'] == 'success' for post in posts))

    def test_manual_approval_does_not_replace_current_greptile_review_or_findings(self):
        for checks in [[], [{'id': 21, 'app': {'id': 867647}, 'status': 'in_progress', 'conclusion': None}]]:
            posts, _ = self.run_gate(internal=self.manual_pr(), reviews=[self.maintainer_approval()],
                permissions=self.maintainer_permission(), checks=checks)
            self.assertEqual(posts[0]['state'], 'pending')
        threads = [{'nodes': [{'isResolved': False, 'comments': {'nodes': [
            {'author': {'login': 'greptile-apps'}}]}}],
            'pageInfo': {'hasNextPage': False, 'endCursor': None}}]
        posts, _ = self.run_gate(internal=self.manual_pr(), reviews=[self.maintainer_approval()],
            permissions=self.maintainer_permission(), threads=threads)
        self.assertEqual(posts[0]['state'], 'failure')
        other = {'id': 11, 'user': {'id': 8, 'login': 'reviewer', 'type': 'User'},
                 'state': 'CHANGES_REQUESTED', 'commit_id': SHA}
        posts, _ = self.run_gate(internal=self.manual_pr(), reviews=[self.maintainer_approval(), other],
            permissions=self.maintainer_permission())
        self.assertEqual(posts[0]['state'], 'pending')

    def test_automatic_generated_route_still_requires_its_receipt(self):
        proof_reads = []
        posts, _ = self.run_gate(internal=self.internal_pr(), proof_error=True,
            reviews=[self.maintainer_approval()], permissions=self.maintainer_permission(),
            proof_reads=proof_reads)
        self.assertEqual(posts[0]['state'], 'pending')
        self.assertEqual(len(proof_reads), 1)

    def test_unchanged_success_creates_no_status_and_never_resets_pending(self):
        posts, _ = self.run_gate(status=[successful_status()])
        self.assertEqual(posts, [])

    def test_failed_shared_run_link_is_repaired_once_then_healthy_sweeps_deduplicate(self):
        # This PR's previous evaluation passed, but another matrix job failed.
        posts, reads = self.run_gate(status=[successful_status()], status_runs={
            122: {'id': 122, 'status': 'completed', 'conclusion': 'failure'},
            123: {'id': 123, 'status': 'completed', 'conclusion': 'success'},
        }, pages=1001, poll_run_ids=range(124, 1125))
        self.assertEqual(posts, [successful_status(123)])
        self.assertIn('repos/owner/repo/actions/runs/122', reads)
        self.assertIn('repos/owner/repo/actions/runs/123', reads)

    def test_cancelled_and_timed_out_links_can_recover(self):
        for conclusion in ['cancelled', 'timed_out']:
            with self.subTest(conclusion=conclusion):
                posts, _ = self.run_gate(status=[successful_status()], status_runs={
                    122: {'id': 122, 'status': 'completed', 'conclusion': conclusion}})
                self.assertEqual(posts, [successful_status(123)])

    def test_failed_run_link_does_not_bypass_a_new_pending_review(self):
        posts, reads = self.run_gate(status=[successful_status()], checks=[
            {'id': 21, 'app': {'id': 867647}, 'status': 'in_progress', 'conclusion': None}],
            status_runs={122: {'id': 122, 'status': 'completed', 'conclusion': 'failure'}})
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]['state'], 'pending')
        self.assertFalse(any('/actions/runs/' in endpoint for endpoint in reads))

    def test_active_or_unknown_linked_run_does_not_append_identical_statuses(self):
        for state, conclusion in [('in_progress', None), ('queued', None),
                                  ('completed', None), ('unknown', 'failure')]:
            with self.subTest(state=state, conclusion=conclusion):
                posts, _ = self.run_gate(status=[successful_status()], status_runs={
                    122: {'id': 122, 'status': state, 'conclusion': conclusion}},
                    poll_run_ids=range(124, 134))
                self.assertEqual(posts, [])

    def test_same_run_link_needs_no_lookup_or_repeated_write(self):
        posts, reads = self.run_gate(status=[successful_status(123)], pages=1001)
        self.assertEqual(posts, [])
        self.assertFalse(any('/actions/runs/' in endpoint for endpoint in reads))

    def test_run_lookup_failure_revokes_stale_success(self):
        posts, _ = self.run_gate(status=[successful_status()], status_runs={
            122: RuntimeError('run metadata unavailable')})
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]['state'], 'pending')
        self.assertEqual(posts[0]['description'], 'Review metadata unavailable; retry required')

    def test_foreign_run_link_is_not_followed(self):
        status = {**successful_status(), 'target_url': 'https://github.com/other/repo/actions/runs/122'}
        posts, reads = self.run_gate(status=[status])
        self.assertEqual(posts[0]['state'], 'pending')
        self.assertFalse(any('/actions/runs/' in endpoint for endpoint in reads))

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

    def test_renovate_without_review_passes_without_reading_check_runs(self):
        posts, reads = self.run_gate(author=RENOVATE, pr_head=RENOVATE_HEAD, checks=[])
        self.assertEqual(posts[0]['state'], 'success')
        self.assertIn('verified Renovate PR', posts[0]['description'])
        self.assertFalse(any('/check-runs?' in endpoint for endpoint in reads))

    def test_renovate_exemption_does_not_hide_unresolved_findings(self):
        pages = [{'nodes': [{'isResolved': False, 'comments': {
            'nodes': [{'author': {'login': 'greptile-apps'}}]}}],
            'pageInfo': {'hasNextPage': False, 'endCursor': None}}]
        posts, _ = self.run_gate(author=RENOVATE, pr_head=RENOVATE_HEAD,
                                 checks=[], threads=pages)
        self.assertEqual(posts[0]['state'], 'failure')
        self.assertTrue(posts[0]['description'].startswith('1 unresolved'))

    def test_renovate_identity_and_repository_must_all_match(self):
        for field, value in [('id', 1), ('login', 'someone'), ('type', 'User')]:
            with self.subTest(field=field):
                author = {**RENOVATE, field: value}
                posts, _ = self.run_gate(author=author, pr_head=RENOVATE_HEAD, checks=[])
                self.assertEqual(posts[0]['state'], 'pending')
        for field, value in [('repo', {'full_name': 'fork/repo'}), ('repo', None),
                             ('ref', 'feature/renovate')]:
            with self.subTest(field=field, value=value):
                posts, _ = self.run_gate(author=RENOVATE,
                    pr_head={**RENOVATE_HEAD, field: value}, checks=[])
                self.assertEqual(posts[0]['state'], 'pending')

    def test_renovate_metadata_error_fails_closed(self):
        posts, _ = self.run_gate(author=RENOVATE, pr_head=RENOVATE_HEAD,
                                 metadata_error=True, checks=[])
        self.assertEqual(posts[0]['state'], 'pending')

    def test_renovate_rechecks_head_and_open_state_before_success(self):
        for final_head, final_state in [({**RENOVATE_HEAD, 'sha': OTHER}, 'open'),
                                       (RENOVATE_HEAD, 'closed'),
                                       ({**RENOVATE_HEAD, 'repo': None}, 'open')]:
            with self.subTest(head=final_head, state=final_state):
                posts, _ = self.run_gate(author=RENOVATE, pr_head=RENOVATE_HEAD, checks=[],
                                         final_head=final_head, final_state=final_state)
                self.assertFalse(any(post['state'] == 'success' for post in posts))

    def test_renovate_head_change_during_pagination_fails_closed(self):
        posts, _ = self.run_gate(author=RENOVATE, pr_head=RENOVATE_HEAD,
                                 changed=True, checks=[])
        self.assertFalse(any(post['state'] == 'success' for post in posts))


if __name__ == '__main__':
    unittest.main()

