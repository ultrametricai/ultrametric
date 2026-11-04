"""Replay reservation races and worker restarts without GitHub or paid reviews."""
import datetime as dt
import json
import runpy
import unittest
from pathlib import Path
from unittest.mock import patch

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
                   paused=False, pr=PR, suite=123, validation='success', change_after_reserve=False, runs=None):
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
        with patch.dict(GLOBALS, {'api':api}), patch('subprocess.check_output', side_effect=lambda *a,**k:json.dumps([comments])):
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

    def test_only_bot_reservations_for_the_exact_head_count(self):
        comments=[]
        self.run_worker(comments)
        comments[0]['user']['login']='someone'
        self.assertEqual(MODULE['reservations'](comments,SHA),[])
        comments[0]['user']['login']='github-actions[bot]'
        self.assertEqual(MODULE['reservations'](comments,'b'*40),[])


if __name__ == '__main__':
    unittest.main()
