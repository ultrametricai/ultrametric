"""Replay reservation races and worker restarts without GitHub or paid reviews."""
import datetime as dt
import json
import os
import runpy
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import refresh_queue
MODULE = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/refresh-review.py'))
GLOBALS = MODULE['request'].__globals__
SHA = 'a' * 40
NOW = dt.datetime(2026, 11, 3, tzinfo=dt.timezone.utc)
PR = {'state':'open', 'draft':False, 'auto_merge':{'enabled_by':{'login':'maintainer'}},
      'base':{'ref':'main'}, 'head':{'sha':SHA, 'ref':'story-runner/ai-video-567', 'repo':{'full_name':'owner/repo'}},
      'user':{'login':'github-actions[bot]'}}


def review(conclusion='success', status='completed'):
    return {'id':9, 'name':'Greptile Review', 'app':{'id':867647}, 'status':status, 'conclusion':conclusion}


class ReviewTests(unittest.TestCase):
    def run_worker(self, comments, *, now=NOW, extra_checks=None, fail_mention=False,
                   paused=False, pr=PR, suite=123, validation='success', change_after_reserve=False, runs=None,
                   queue_states=None):
        writes = []
        def api(repo, endpoint, data=None):
            if endpoint.endswith('/comments'):
                writes.append(data['body'])
                if data['body'].startswith('@') and fail_mention:
                    raise RuntimeError('ambiguous send outcome')
                comments.append({'user':{'login':'github-actions[bot]'}, 'body':data['body'],
                                 'created_at':now.isoformat()})
                return {}
            if endpoint == 'pulls/567':
                return {**pr, 'draft':True} if change_after_reserve and writes else pr
            if endpoint == 'actions/workflows/refresh-automerge.yml':
                return {'state':'disabled_manually' if paused else 'active'}
            if '/ci.yml/runs?' in endpoint:
                return {'workflow_runs':runs if runs is not None else [{'id':1, 'event':'workflow_dispatch', 'status':'completed', 'conclusion':'success', 'check_suite_id':123}]}
            if '/check-runs?' in endpoint:
                return {'check_runs':[
                    {'id':i, 'name':name, 'app':{'id':15368}, 'status':'completed',
                     'conclusion':validation, 'check_suite':{'id':suite}}
                    for i,name in enumerate(['validation','ci'])] + (extra_checks or [])}
            raise AssertionError(endpoint)
        with patch.dict(GLOBALS, {'api':api,'queue_allows':Mock(side_effect=queue_states) if queue_states else lambda *_:True}), patch('subprocess.check_output', side_effect=lambda *a,**k:json.dumps([comments])):
            MODULE['request']('owner/repo', 567, SHA, now)
        return writes

    def test_second_caller_reads_durable_reservation_and_does_not_repeat_request(self):
        comments=[]
        writes=self.run_worker(comments)
        self.assertIn('reservation',writes[0])
        self.assertTrue(writes[1].startswith('@greptileai review'))
        self.assertEqual(self.run_worker(comments),[])

    def test_ambiguous_send_consumes_attempt_and_does_not_immediately_retry(self):
        comments=[]
        with self.assertRaisesRegex(RuntimeError,'ambiguous'):
            self.run_worker(comments,fail_mention=True)
        self.assertEqual(len(comments),1)
        self.assertEqual(self.run_worker(comments),[])

    def test_delayed_missing_check_allows_one_retry_then_stops(self):
        comments=[]
        self.run_worker(comments)
        self.assertEqual(self.run_worker(comments,now=NOW+dt.timedelta(minutes=59)),[])
        self.assertEqual(len(self.run_worker(comments,now=NOW+dt.timedelta(hours=1))),2)
        with self.assertRaisesRegex(RuntimeError,'budget exhausted'):
            self.run_worker(comments,now=NOW+dt.timedelta(hours=2))

    def test_cancelled_review_obeys_the_same_cooldown_and_budget(self):
        comments=[]
        self.run_worker(comments)
        self.assertEqual(self.run_worker(comments,extra_checks=[review('cancelled')]),[])
        self.assertEqual(len(self.run_worker(comments,now=NOW+dt.timedelta(hours=1),extra_checks=[review('cancelled')])),2)

    def test_active_or_successful_check_never_requests_again(self):
        for check in [review(),review(None,'in_progress')]:
            with self.subTest(check=check):
                self.assertEqual(self.run_worker([],extra_checks=[check]),[])

    def test_legacy_failed_checks_require_attention_instead_of_resetting_budget(self):
        with self.assertRaisesRegex(RuntimeError,'no managed reservation'):
            self.run_worker([],extra_checks=[review('neutral')])

    def test_ci_must_pass_on_the_exact_suite(self):
        for options in [{'validation':'failure'},{'suite':122}]:
            self.assertEqual(self.run_worker([],**options),[])

    def test_approved_pr_result_survives_a_newer_cancelled_dispatch(self):
        approved={'id':1,'event':'pull_request','status':'completed','conclusion':'success','check_suite_id':123}
        cancelled={**approved,'id':2,'event':'workflow_dispatch','conclusion':'cancelled','check_suite_id':124}
        self.assertEqual(len(self.run_worker([],runs=[approved,cancelled])),2)
        self.assertEqual(self.run_worker([],runs=[approved,cancelled],suite=124),[])

    def test_newer_cancelled_run_of_same_event_cannot_reuse_old_success(self):
        old={'id':1,'event':'workflow_dispatch','status':'completed','conclusion':'success','check_suite_id':123}
        cancelled={**old,'id':2,'conclusion':'cancelled','check_suite_id':124}
        self.assertEqual(self.run_worker([],runs=[old,cancelled]),[])

    def test_paused_workflow_draft_or_disabled_auto_merge_cannot_request(self):
        self.assertEqual(self.run_worker([],paused=True),[])
        for override in [{'draft':True},{'auto_merge':None},{'head':{**PR['head'],'sha':'b'*40}}]:
            self.assertEqual(self.run_worker([],pr={**PR,**override}),[])

    def test_manual_stop_after_reservation_prevents_the_paid_mention(self):
        writes=self.run_worker([],change_after_reserve=True)
        self.assertEqual(len(writes),1)
        self.assertFalse(writes[0].startswith('@'))

    def test_later_pr_cannot_reserve_or_request_a_review(self):
        self.assertEqual(self.run_worker([],queue_states=[False]),[])

    def test_queue_change_before_reservation_prevents_every_write(self):
        self.assertEqual(self.run_worker([],queue_states=[True,False]),[])

    def test_queue_change_after_reservation_prevents_paid_mention(self):
        writes=self.run_worker([],queue_states=[True,True,False])
        self.assertEqual(len(writes),1)
        self.assertFalse(writes[0].startswith('@'))

    def test_only_bot_reservations_for_the_exact_head_count(self):
        comments=[]
        self.run_worker(comments)
        comments[0]['user']['login']='someone'
        self.assertEqual(MODULE['reservations'](comments,SHA),[])
        comments[0]['user']['login']='github-actions[bot]'
        self.assertEqual(MODULE['reservations'](comments,'b'*40),[])


class QueueTests(unittest.TestCase):
    def pr(self, number, **override):
        return {**PR,'number':number,**override}

    def test_selects_oldest_across_pages_independent_of_api_order(self):
        pages=[[self.pr(572),self.pr(548)],[self.pr(518),self.pr(519)]]
        with patch('subprocess.check_output',return_value=json.dumps(pages)):
            self.assertTrue(refresh_queue.allows('owner/repo',518))
            self.assertFalse(refresh_queue.allows('owner/repo',519))
            self.assertFalse(refresh_queue.allows('owner/repo'))

    def test_paused_oldest_remains_a_queue_barrier(self):
        for stop in [{'draft':True},{'auto_merge':None}]:
            pages=[[self.pr(518,**stop),self.pr(519)]]
            with patch('subprocess.check_output',return_value=json.dumps(pages)):
                self.assertFalse(refresh_queue.allows('owner/repo',519))
                self.assertFalse(refresh_queue.allows('owner/repo'))

    def test_closed_oldest_advances_to_next_pr(self):
        first=refresh_queue.oldest([self.pr(518,state='closed'),self.pr(519)],'owner/repo')
        self.assertEqual(first['number'],519)

    def test_unrelated_human_or_fork_pr_does_not_join_managed_queue(self):
        unrelated=[self.pr(495,user={'login':'human'}),self.pr(496,head={**PR['head'],'repo':{'full_name':'fork/repo'}})]
        self.assertIsNone(refresh_queue.oldest(unrelated,'owner/repo'))
        with patch('subprocess.check_output',return_value=json.dumps([unrelated])):
            self.assertTrue(refresh_queue.allows('owner/repo'))

    def test_queue_read_failure_does_not_authorize_any_operation(self):
        with patch('subprocess.check_output',side_effect=RuntimeError('API unavailable')):
            with self.assertRaisesRegex(RuntimeError,'API unavailable'):
                refresh_queue.allows('owner/repo',518)

    def test_generation_job_output_blocks_before_engine_work_until_queue_empty(self):
        for prs,allow in [([self.pr(518)],'false'),([],'true')]:
            with tempfile.TemporaryDirectory() as directory:
                output=Path(directory)/'output'
                with patch.dict(os.environ,{'REPO':'owner/repo','GITHUB_OUTPUT':str(output)}), \
                     patch('sys.argv',['refresh_queue.py','--generation']), \
                     patch('subprocess.check_output',return_value=json.dumps([prs])):
                    runpy.run_path(str(Path(refresh_queue.__file__)),run_name='__main__')
                self.assertEqual(output.read_text(),f'allow={allow}\n')

    def test_publication_stops_if_queue_changed_after_generation_started(self):
        with patch.dict(os.environ,{'REPO':'owner/repo'}), \
             patch('sys.argv',['refresh_queue.py','--require-empty']), \
             patch('subprocess.check_output',return_value=json.dumps([[self.pr(518)]])):
            with self.assertRaises(SystemExit) as raised:
                runpy.run_path(str(Path(refresh_queue.__file__)),run_name='__main__')
        self.assertEqual(raised.exception.code,1)

    def test_new_pr_auto_merge_opt_in_requires_oldest_position(self):
        with patch.dict(os.environ,{'REPO':'owner/repo'}), \
             patch('sys.argv',['refresh_queue.py','--pr','519']), \
             patch('subprocess.check_output',return_value=json.dumps([[self.pr(518),self.pr(519)]])):
            with self.assertRaises(SystemExit) as raised:
                runpy.run_path(str(Path(refresh_queue.__file__)),run_name='__main__')
        self.assertEqual(raised.exception.code,1)


if __name__ == '__main__':
    unittest.main()
