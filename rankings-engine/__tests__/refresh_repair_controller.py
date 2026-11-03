"""Metadata-only repair recheck/resume scenarios; no network or repository writes."""
import json
import io
import os
import runpy
import shutil
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import Mock, patch

with patch.dict(os.environ, {'REPO':'owner/repo','PR_NUMBER':'536','PR_HEAD':'a'*40}):
    MODULE = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/refresh-repair.py'), run_name='controller_test')
GLOBALS = MODULE['recheck'].__globals__
SHA = 'a'*40
BRANCH = 'story-runner/email-123'
PR = {'state':'open','draft':False,'auto_merge':{'enabled_by':{'login':'maintainer'}},'base':{'ref':'main'},'head':{'sha':SHA,'ref':BRANCH,'repo':{'full_name':'owner/repo'}},'user':{'login':'github-actions[bot]'}}
REPORT = {'originalThreads':['old'],'audits':[{'thread':'old','addressed':True}],
          'findingSnapshots':{'old':MODULE['finding_fingerprint']({'id':'old'})}}

def checks(status='success'):
    return [{'name':name,'app':{'id':app},'status':'completed' if status=='success' else 'in_progress','conclusion':status if status=='success' else None}
            for name,app in [('validation',15368),('ci',15368),('Greptile Review',867647)]]

class ControllerTests(unittest.TestCase):
    def recheck(self, report, *, pending=False, findings=None, changed=False):
        calls=[]
        def api(endpoint,data=None):
            calls.append((endpoint,data))
            if '/workflows/ci.yml/runs' in endpoint:return {'workflow_runs':[{}]}
            if '/check-runs?' in endpoint:return {'check_runs':checks('pending' if pending else 'success')}
            if endpoint=='graphql':return {'data':{'resolveReviewThread':{'thread':{'id':'old','isResolved':True}}}}
            raise AssertionError(endpoint)
        current = {**PR,'head':{**PR['head'],'sha':'b'*40 if changed else SHA}}
        commands=Mock()
        with patch.dict(GLOBALS, {'api':api,'current':lambda:current,'threads':lambda:(SHA,findings if findings is not None else [{'id':'old'}]),'command':commands}),patch.object(MODULE['time'],'sleep',lambda _:None):
            result=MODULE['recheck'](report,BRANCH,SHA)
        return result,calls,commands

    def test_foreloop_replies_are_not_diagnostic_or_audit_input(self):
        body=MODULE['diagnostic_comments']([{'author':{'login':'greptileai'},'body':'review concern'},
                                          {'author':{'login':'foreloop-app'},'body':'excluded concern'}])
        self.assertIn('review concern',body)
        self.assertNotIn('excluded concern',body)

    def test_slow_checks_keep_audit_without_publishing_or_resolving(self):
        phase,calls,commands=self.recheck(REPORT,pending=True)
        self.assertEqual(phase,'waiting-checks')
        self.assertFalse(any(endpoint=='graphql' for endpoint,_ in calls))
        commands.assert_not_called()

    def test_fresh_checks_allow_only_audited_old_threads_to_close(self):
        phase,calls,_=self.recheck(REPORT)
        self.assertEqual(phase,'rechecked')
        self.assertEqual([data['variables']['id'] for endpoint,data in calls if endpoint=='graphql'],['old'])

    def test_new_findings_keep_old_threads_open_for_another_pass(self):
        phase,calls,_=self.recheck(REPORT,findings=[{'id':'old'},{'id':'new'}])
        self.assertEqual(phase,'needs-repair')
        self.assertFalse(any(endpoint=='graphql' for endpoint,_ in calls))

    def test_edited_diagnostic_or_reply_invalidates_the_saved_audit(self):
        phase,calls,_=self.recheck(REPORT,findings=[{'id':'old','body':'New review reply: still incorrect'}])
        self.assertEqual(phase,'needs-repair')
        self.assertFalse(any(endpoint=='graphql' for endpoint,_ in calls))

    def test_failed_audit_is_not_resolved_or_reported_complete(self):
        phase,calls,_=self.recheck({**REPORT,'audits':[{'thread':'old','addressed':False}]})
        self.assertEqual(phase,'needs-repair')
        self.assertFalse(any(endpoint=='graphql' for endpoint,_ in calls))

    def test_changed_head_keeps_findings_intact(self):
        phase,calls,_=self.recheck(REPORT,changed=True)
        self.assertEqual(phase,'closed-or-changed')
        self.assertFalse(any(endpoint=='graphql' for endpoint,_ in calls))

    def test_manual_stop_during_recheck_does_not_resolve_or_reenable(self):
        for override in [{'draft':True}, {'auto_merge':None}]:
            command=Mock()
            def api(endpoint,data=None):
                return {'workflow_runs':[{}]} if '/runs?' in endpoint else {'check_runs':checks()}
            with patch.dict(GLOBALS,{'api':api,'command':command,'current':lambda:{**PR,**override}}):
                self.assertEqual(MODULE['recheck'](REPORT,BRANCH,SHA),'closed-or-changed')
            command.assert_not_called()

    def test_audit_resume_precedes_the_published_attempt_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            def output(args):
                if args[:3]==['git','rev-parse','HEAD']:return 'b'*40
                if args[:3]==['git','rev-parse','refs/repair/head']:return SHA
                if args[:3]==['git','log','--format=%B']:return '\n'.join(f'Refresh-Repair-Attempt: {i}' for i in range(1,4))
                if args[:2]==['git','merge-base']:return 'c'*40
                raise AssertionError(args)
            command=Mock(); resume=Mock(return_value={**REPORT,'publishedHead':SHA,'main':'b'*40})
            with patch.dict(GLOBALS, {'current':lambda:PR,'output':output,'command':command,'load_resume_report':resume,'recheck':lambda *_:'waiting-checks'}),patch.dict(os.environ,{'RUNNER_TEMP':directory}):
                MODULE['main']()
            resume.assert_called_once()
            self.assertFalse(any(call.args[0][0]=='pnpm' for call in command.call_args_list))
            self.assertEqual(json.loads((Path(directory)/'refresh-repair-report.json').read_text())['phase'],'waiting-checks')


class DispatcherTests(unittest.TestCase):
    def controller(self):
        source=(Path(__file__).resolve().parents[2]/'.github/workflows/refresh-automerge.yml').read_text().split('        run: |\n',1)[1]
        code='\n'.join(line[10:] if line.startswith('          ') else line for line in source.splitlines())
        namespace={}
        with patch.dict(os.environ,{'REPO':'owner/repo'}),patch('subprocess.check_output',return_value='[[]]'):
            exec(code,namespace)
        return namespace

    def request(self,history):
        namespace=self.controller()
        namespace['api']=lambda *_:{'workflow_runs':history}
        command=Mock()
        with patch('subprocess.run',command):
            namespace['request_repair']({'number':536,'head':{'ref':BRANCH}},SHA)
        return command

    def test_review_gate_failure_cannot_trigger_a_data_repair(self):
        fn=self.controller()['failed_validation']
        run={'id':1,'status':'completed','conclusion':'failure','check_suite_id':123}
        check={'name':'review-findings','app':{'id':15368},'check_suite':{'id':123},'status':'completed','conclusion':'failure'}
        self.assertFalse(fn([run],[check]))
        self.assertTrue(fn([run],[{**check,'name':'validation'}]))
        self.assertFalse(fn([run],[{**check,'name':'validation','check_suite':{'id':122}}]))
        self.assertFalse(fn([run,{**run,'id':2,'status':'in_progress','conclusion':None}],[{**check,'name':'validation'}]))

    def test_latest_check_replaces_an_older_cancelled_or_failed_check(self):
        latest=MODULE['latest_checks']([{'id':1,'name':'ci','app':{'id':15368},'conclusion':'cancelled'},
                                       {'id':2,'name':'ci','app':{'id':15368},'conclusion':'success'}])
        self.assertEqual(latest[0]['conclusion'],'success')

    def test_a_superseded_workflow_suite_cannot_satisfy_a_new_recheck(self):
        old={'id':1,'name':'validation','app':{'id':15368},'conclusion':'success','check_suite':{'id':10}}
        self.assertEqual(MODULE['latest_checks']([old],ci_suite=20),[])

    def test_cancelled_ci_restarts_the_same_head_without_a_repair_commit(self):
        def api(endpoint,data=None):
            return {'workflow_runs':[{'id':1,'event':'workflow_dispatch','status':'completed','conclusion':'cancelled'}]}
        command=Mock()
        with patch.dict(GLOBALS,{'api':api,'command':command,'current':lambda:PR}):
            with self.assertRaisesRegex(RuntimeError,'same-head CI retry requested'):
                MODULE['recheck'](REPORT,BRANCH,SHA)
        command.assert_called_once_with(['gh','workflow','run','ci.yml','--repo','owner/repo','--ref',BRANCH])

    def test_waiting_resumes_do_not_consume_failed_worker_budget(self):
        history=[{'display_title':f'Repair refresh #536 @{SHA} [support-loss-v2]','status':'completed','conclusion':'success'} for _ in range(4)]
        self.request(history).assert_called_once()

    def test_parent_worker_prevents_a_second_worker_for_the_same_pr(self):
        history=[{'display_title':f'Repair refresh #536 @{"b"*40}','status':'in_progress','conclusion':None}]
        self.request(history).assert_not_called()

    def test_three_failed_workers_stop_dispatching_that_head(self):
        history=[{'display_title':f'Repair refresh #536 @{SHA} [support-loss-v2]','status':'completed','conclusion':'failure'} for _ in range(3)]
        self.request(history).assert_not_called()


class ResumeArtifactTests(unittest.TestCase):
    def resume(self, *, bad_branch=False, bad_binding=False, expired=False):
        base='b'*40
        report={'pr':536,'runId':'123','publishedHead':'x'*40 if bad_binding else SHA,'main':base,
                'originalThreads':['old'],'audits':[{'thread':'old','addressed':True}],
                'findingSnapshots':REPORT['findingSnapshots']}
        def output(args):
            if args[:3]==['git','log','-1']:return f'Refresh-Repair-Run: 123\nRefresh-Repair-Base: {base}'
            if args[:2]==['git','merge-base']:return args[2]
            raise AssertionError(args)
        def api(endpoint):
            if endpoint.endswith('/artifacts?per_page=100'):
                return {'artifacts':[{'name':'refresh-repair-536-123','expired':expired,'size_in_bytes':100}]}
            return {'path':'.github/workflows/refresh-repair.yml','head_branch':'feature' if bad_branch else 'main',
                    'event':'workflow_dispatch','status':'completed','head_sha':'d'*40}
        def download(args):
            directory=Path(args[args.index('--dir')+1])
            (directory/'refresh-repair-report.json').write_text(json.dumps(report))
        with patch.dict(GLOBALS,{'output':output,'api':api,'command':download}):
            return MODULE['load_resume_report'](SHA,'c'*40)

    def test_matching_trusted_artifact_can_resume(self):
        self.assertEqual(self.resume()['publishedHead'],SHA)

    def test_audit_from_another_workflow_branch_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError,'trusted repair workflow'):self.resume(bad_branch=True)

    def test_audit_from_a_different_head_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError,'does not match'):self.resume(bad_binding=True)

    def test_expired_audit_does_not_trigger_another_publish(self):
        with self.assertRaisesRegex(RuntimeError,'unavailable, expired'):self.resume(expired=True)

    def test_late_failure_preserves_published_audit_and_names_its_stage(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(os.environ,{'RUNNER_TEMP':directory}),patch.dict(GLOBALS,{'STAGE':'gh workflow run ci.yml'}):
            file=Path(directory)/'refresh-repair-report.json'
            file.write_text(json.dumps({'publishedHead':SHA,'audits':REPORT['audits']}))
            MODULE['record_failure'](RuntimeError('dispatch failed'))
            result=json.loads(file.read_text())
            self.assertEqual(result['publishedHead'],SHA)
            self.assertEqual(result['audits'],REPORT['audits'])
            self.assertEqual(result['failedStage'],'gh workflow run ci.yml')
            self.assertEqual(result['blocked'],'dispatch failed')

class RecoveryCITests(unittest.TestCase):
    """Execute the recovery workflow against GitHub event histories, without writes."""
    def run_record(self, event='pull_request', conclusion='action_required', *, id=1, status='completed'):
        return {'id':id,'event':event,'status':status,'conclusion':conclusion,'check_suite_id':123}

    def recover(self, runs, *, pr=None, updated_head=None, pending_review=False):
        pr = pr or {**PR,'number':536,'auto_merge':{'enabled_by':{'login':'maintainer'}}}
        calls = []
        def run(args, **kwargs):
            calls.append(args)
            result = None
            if args[:3] == ['gh','api','graphql']:
                result = {'data':{'repository':{'pullRequest':{'reviewThreads':{
                    'nodes':[],'pageInfo':{'hasNextPage':False}}}}}}
            elif args[:2] == ['gh','api']:
                endpoint = args[4]
                if '/compare/main...' in endpoint:
                    result = {'behind_by':1 if updated_head else 0}
                elif endpoint.endswith('/update-branch'):
                    result = {}
                elif endpoint.endswith('/pulls/536'):
                    result = {**pr,'head':{**pr['head'],'sha':updated_head}}
                elif '/workflows/ci.yml/runs?' in endpoint:
                    self.assertIn(f'head_sha={(updated_head if not pending_review else None) or SHA}&', endpoint)
                    result = {'workflow_runs':runs}
                elif '/check-runs?' in endpoint:
                    result = {'check_runs':[{'id':index,'name':name,'app':{'id':app},'check_suite':{'id':123},
                        'status':'in_progress' if pending_review and name=='Greptile Review' else 'completed',
                        'conclusion':'failure' if app==15368 and any(r['conclusion']=='failure' for r in runs) else 'success'}
                        for index,(name,app) in enumerate([('validation',15368),('ci',15368),('Greptile Review',867647)])]}
                elif '/workflows/refresh-repair.yml/runs?' in endpoint:
                    result = {'workflow_runs':[]}
                else:
                    raise AssertionError(endpoint)
            return subprocess.CompletedProcess(args, 0, json.dumps(result) if result is not None else '')
        source = (Path(__file__).resolve().parents[2]/'.github/workflows/refresh-automerge.yml').read_text().split('        run: |\n',1)[1]
        code = '\n'.join(line[10:] if line.startswith('          ') else line for line in source.splitlines())
        error = None
        with patch.dict(os.environ,{'REPO':'owner/repo'}), \
                patch('subprocess.check_output',return_value=json.dumps([[pr]])), \
                patch('subprocess.run',side_effect=run), patch('time.sleep'), redirect_stdout(io.StringIO()):
            try:
                exec(code,{})
            except SystemExit as exc:
                error = str(exc)
        ci = [call for call in calls if call[:4] == ['gh','workflow','run','ci.yml']]
        return ci, calls, error

    def test_approval_event_winning_branch_update_race_still_dispatches_ci(self):
        ci, calls, error = self.recover([self.run_record()], updated_head='b'*40)
        self.assertIsNone(error)
        self.assertEqual(ci, [['gh','workflow','run','ci.yml','--repo','owner/repo','--ref',BRANCH]])
        self.assertTrue(any('/update-branch' in ' '.join(call) for call in calls))
        self.assertFalse(any('approve' in call for call in calls))

    def test_main_advance_does_not_replace_a_head_while_review_is_pending(self):
        _, calls, error = self.recover([self.run_record('workflow_dispatch','success')], updated_head='b'*40, pending_review=True)
        self.assertFalse(any('/update-branch' in ' '.join(call) for call in calls))
        self.assertIsNone(error)

    def test_no_run_or_approval_only_history_dispatches(self):
        for runs in [[], [self.run_record()]]:
            with self.subTest(runs=runs):
                ci, _, error = self.recover(runs)
                self.assertIsNone(error)
                self.assertEqual(len(ci), 1)

    def test_pending_ci_is_left_running(self):
        for event in ['pull_request','workflow_dispatch']:
            for status in ['queued','in_progress','waiting']:
                with self.subTest(event=event,status=status):
                    ci, _, error = self.recover([self.run_record(event,None,status=status)])
                    self.assertIsNone(error)
                    self.assertEqual(ci, [])

    def test_real_ci_results_are_preserved_despite_newer_approval_record(self):
        for conclusion in ['success','failure']:
            with self.subTest(conclusion=conclusion):
                ci, calls, error = self.recover([
                    self.run_record('workflow_dispatch',conclusion), self.run_record(id=2)])
                self.assertIsNone(error)
                self.assertEqual(ci, [])
                repairs = [call for call in calls if call[:4] == ['gh','workflow','run','refresh-repair.yml']]
                self.assertEqual(len(repairs), 1 if conclusion == 'failure' else 0)

    def test_approved_pr_ci_result_also_counts(self):
        ci, _, error = self.recover([self.run_record(conclusion='success')])
        self.assertIsNone(error)
        self.assertEqual(ci, [])

    def test_approved_pr_ci_prevents_duplicate_after_cancelled_dispatch(self):
        # Approval resumes the original PR run ID, which predates the dispatch.
        for status, conclusion in [('queued',None), ('in_progress',None),
                                   ('completed','success'), ('completed','failure')]:
            with self.subTest(status=status,conclusion=conclusion):
                ci, _, error = self.recover([
                    self.run_record(status=status,conclusion=conclusion),
                    self.run_record('workflow_dispatch','cancelled',id=2)])
                self.assertIsNone(error)
                self.assertEqual(ci, [])

    def test_ci_without_a_result_retries_the_same_branch(self):
        for conclusion in ['cancelled','timed_out','action_required','startup_failure','stale','skipped','neutral']:
            with self.subTest(conclusion=conclusion):
                ci, _, error = self.recover([self.run_record('workflow_dispatch',conclusion)])
                self.assertIsNone(error)
                self.assertEqual(len(ci), 1)
                self.assertEqual(ci[0][-1], BRANCH)

    def test_newer_cancelled_dispatch_supersedes_older_completed_result(self):
        for conclusion in ['success','failure']:
            with self.subTest(conclusion=conclusion):
                ci, _, error = self.recover([
                    self.run_record('workflow_dispatch',conclusion,id=1),
                    self.run_record('workflow_dispatch','cancelled',id=2)])
                self.assertIsNone(error)
                self.assertEqual(len(ci),1)

    def test_newer_cancelled_pr_run_supersedes_its_older_success(self):
        ci, _, error = self.recover([self.run_record(conclusion='success',id=1),
                                     self.run_record(conclusion='cancelled',id=2)])
        self.assertIsNone(error)
        self.assertEqual(len(ci),1)

    def test_newer_success_supersedes_cancelled_dispatch(self):
        ci, _, error = self.recover([
            self.run_record('workflow_dispatch','success',id=2),
            self.run_record('workflow_dispatch','cancelled'), self.run_record(id=3)])
        self.assertIsNone(error)
        self.assertEqual(ci, [])

    def test_repeated_startup_failures_exhaust_budget_without_dispatching(self):
        ci, calls, error = self.recover([
            self.run_record('workflow_dispatch','startup_failure',id=i) for i in range(3)])
        self.assertEqual(ci, [])
        self.assertIn('Refresh PRs need attention or retry: [536]', error)
        self.assertFalse(any(call[:3] == ['gh','pr','merge'] for call in calls))

    def test_many_approval_records_do_not_exhaust_dispatch_budget(self):
        ci, _, error = self.recover([self.run_record(id=i) for i in range(4)])
        self.assertIsNone(error)
        self.assertEqual(len(ci), 1)

    def test_drafts_forks_and_unrelated_authors_still_stay_outside_recovery(self):
        for override in [{'draft':True}, {'auto_merge':None}, {'user':{'login':'someone'}},
                         {'head':{**PR['head'],'repo':{'full_name':'fork/repo'}}}]:
            with self.subTest(override=override):
                ci, calls, error = self.recover([], pr={**PR,'number':536,**override})
                self.assertIsNone(error)
                self.assertEqual(ci, [])
                self.assertEqual(calls, [])


class PublicationTests(unittest.TestCase):
    def test_unsupported_grade_change_stops_before_remote_push_pr_or_review(self):
        root=Path(__file__).resolve().parents[2]
        source=(root/'.github/workflows/story-runner.yml').read_text().split('      - name: Open PR if anything changed\n',1)[1]
        script='\n'.join(line[10:] for line in source.split('        run: |\n',1)[1].splitlines())
        with tempfile.TemporaryDirectory() as directory:
            cwd=Path(directory)
            arena=cwd/'open-rankings/fixture'; (arena/'evidence').mkdir(parents=True)
            checker=cwd/'rankings-engine/scripts/check-refresh-stability.mjs'; checker.parent.mkdir(parents=True)
            shutil.copy(root/'rankings-engine/scripts/check-refresh-stability.mjs',checker)
            old={'productId':'vendor','storyId':'story','verdict':'partial','quality':5,'evidenceIds':['old']}
            (arena/'verdicts.json').write_text(json.dumps([old]))
            (arena/'evidence/vendor.json').write_text(json.dumps([{'id':'old','excerpt':'same support'}]))
            (cwd/'README.md').write_text('Fixture\n')
            (cwd/'rankings-engine/cache').mkdir()
            (cwd/'rankings-engine/cache/.keep').write_text('')
            git=shutil.which('git')
            for args in [['init','-b','main'],['config','user.name','Fixture'],['config','user.email','fixture@example.invalid'],['add','.'],['commit','-m','baseline']]:
                subprocess.run([git,*args],cwd=cwd,check=True,capture_output=True)
            (arena/'verdicts.json').write_text(json.dumps([{**old,'quality':9}]))
            binaries=cwd/'bin'; binaries.mkdir()
            for name,body in {
                'pnpm':'exit 0',
                'gh':'touch "$ATTEMPT_LOG"; exit 90',
                'git':f'if [ "$1" = push ]; then touch "$ATTEMPT_LOG"; exit 91; fi\nexec "{git}" "$@"',
            }.items():
                binary=binaries/name; binary.write_text('#!/bin/sh\n'+body+'\n'); binary.chmod(0o755)
            result=subprocess.run(['bash','-e','-c',script],cwd=cwd,text=True,capture_output=True,
                env={**os.environ,'PATH':str(binaries)+os.pathsep+os.environ['PATH'],'CATEGORY':'fixture',
                     'RUN_ID':'123','ATTEMPT_LOG':str(cwd/'remote-attempt')})
            self.assertNotEqual(result.returncode,0)
            self.assertIn('unsupported refresh grade changes',result.stderr)
            self.assertFalse((cwd/'remote-attempt').exists())

if __name__=='__main__':
    unittest.main()
