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
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from unittest.mock import Mock, patch

with patch.dict(os.environ, {'REPO':'owner/repo','PR_NUMBER':'536','PR_HEAD':'a'*40}):
    MODULE = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/refresh-repair.py'), run_name='controller_test')
GLOBALS = MODULE['recheck'].__globals__
SHA = 'a'*40
BRANCH = 'story-runner/email-123'
PR = {'number':536,'labels':[], 'state':'open','draft':False,'auto_merge':{'enabled_by':{'login':'maintainer'}},'base':{'ref':'main'},'head':{'sha':SHA,'ref':BRANCH,'repo':{'full_name':'owner/repo'}},'user':{'id':41898282,'login':'github-actions[bot]','type':'Bot'}}
REPORT = {'originalThreads':['old'],'audits':[{'thread':'old','addressed':True}],
          'findingSnapshots':{'old':MODULE['finding_fingerprint']({'id':'old'})}}

def checks(status='success'):
    return [{'name':name,'app':{'id':app},'check_suite':{'id':123},'status':'completed' if status=='success' else 'in_progress','conclusion':status if status=='success' else None}
            for name,app in [('validation',15368),('ci',15368),('Greptile Review',867647)]]

class ControllerTests(unittest.TestCase):
    def recheck(self, report, *, pending=False, findings=None, changed=False, runs=None):
        calls=[]
        def api(endpoint,data=None):
            calls.append((endpoint,data))
            if '/workflows/ci.yml/runs' in endpoint:return {'workflow_runs':runs if runs is not None else [
                {'id':1,'event':'workflow_dispatch','status':'completed','conclusion':'success','check_suite_id':123}]}
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

    def test_recheck_uses_approved_ci_without_retrying_a_newer_cancelled_dispatch(self):
        runs=[{'id':1,'event':'pull_request','status':'completed','conclusion':'success','check_suite_id':123},
              {'id':2,'event':'workflow_dispatch','status':'completed','conclusion':'cancelled','check_suite_id':124}]
        phase,_,commands=self.recheck(REPORT,runs=runs)
        self.assertEqual(phase,'rechecked')
        self.assertFalse(any(call.args[0][3]=='ci.yml' for call in commands.call_args_list))

    def test_active_approved_ci_keeps_recheck_waiting_despite_newer_cancelled_dispatch(self):
        runs=[{'id':1,'event':'pull_request','status':'in_progress','conclusion':None,'check_suite_id':123},
              {'id':2,'event':'workflow_dispatch','status':'completed','conclusion':'cancelled','check_suite_id':124}]
        phase,calls,commands=self.recheck(REPORT,runs=runs)
        self.assertEqual(phase,'waiting-checks')
        self.assertFalse(any(endpoint=='graphql' for endpoint,_ in calls))
        commands.assert_not_called()

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
            with patch.dict(GLOBALS, {'verify_provenance':lambda *_:None, 'current':lambda:PR,'output':output,'command':command,'load_resume_report':resume,'recheck':lambda *_:'waiting-checks'}),patch.dict(os.environ,{'RUNNER_TEMP':directory}):
                MODULE['main']()
            resume.assert_called_once()
            self.assertFalse(any(call.args[0][0]=='pnpm' for call in command.call_args_list))
            self.assertEqual(json.loads((Path(directory)/'refresh-repair-report.json').read_text())['phase'],'waiting-checks')


class RepairReviewBoundaryTests(unittest.TestCase):
    def repair(self, review_states, token='app-fixture'):
        with tempfile.TemporaryDirectory() as directory:
            report_file=Path(directory)/'refresh-repair-report.json'
            calls=[]; review_reads=[]; states=iter(review_states)
            def api(endpoint,data=None):
                if '/check-runs?' in endpoint:
                    if 'check_name=' in endpoint:
                        review_reads.append(endpoint)
                        return {'check_runs':[{'name':'Greptile Review','app':{'id':867647},
                                              'status':next(states),'conclusion':None}]}
                    return {'check_runs':checks()}
                if endpoint.endswith('/branches/main'):return {'commit':{'sha':'b'*40}}
                if endpoint.endswith('/workflows/refresh-repair.yml'):return {'state':'active'}
                raise AssertionError(endpoint)
            def output(args):
                if args==['git','rev-parse','HEAD']:return 'b'*40
                if args==['git','rev-parse','refs/repair/head']:return SHA
                if args[:2]==['git','merge-base']:return 'c'*40
                if args[:2]==['git','log']:return ''
                if args[:2]==['git','write-tree']:return 'd'*40
                if args[:2]==['git','commit-tree']:return 'e'*40
                if args[:2]==['git','ls-remote']:return 'e'*40+'\trefs/heads/'+BRANCH
                raise AssertionError(args)
            def command(args,**kwargs):
                calls.append(args)
                if args[0]=='git' and 'push' in args:
                    self.assertEqual(kwargs['env']['GH_TOKEN'], 'app-fixture')
                    self.assertIn('credential.helper=!gh auth git-credential', args)
                if 'rankings-engine/scripts/repair-refresh.ts' in args:
                    report_file.write_text(json.dumps({'restored':[],'audits':[]}))
            with patch.dict(GLOBALS,{'verify_provenance':lambda *_:None,'api':api,'current':lambda:({**PR,'head':{**PR['head'],'sha':'e'*40}} if any(c[0]=='git' and 'push' in c for c in calls) else PR),'output':output,'command':command,
                                    'threads':lambda:(SHA,[{'id':'finding'}]),'load_resume_report':lambda *_:None,
                                    'recheck':lambda *_:'rechecked'}),patch.dict(os.environ,{'RUNNER_TEMP':directory,'CONTENT_TOKEN':token}):
                MODULE['main']()
            return calls, json.loads(report_file.read_text()) if report_file.exists() else {}, review_reads

    def test_missing_app_token_cannot_publish_a_repaired_head(self):
        with self.assertRaisesRegex(RuntimeError,'Content App publication token is required'):
            self.repair(['completed','completed'], token='')

    def test_repair_accepts_only_configured_story_app_identity(self):
        with patch.dict(os.environ, {'CONTENT_BOT_LOGIN':'fixture-content[bot]'}):
            pr={**PR,'user':{'login':'fixture-content[bot]','type':'Bot'}}
            self.assertTrue(MODULE['identity'](pr))
            for changed in [{'user':{'login':'other[bot]','type':'Bot'}},
                            {'user':{'login':'fixture-content[bot]','type':'User'}},
                            {'head':{**PR['head'],'ref':'vendor-radar/fixture-123'}},
                            {'labels':[{'name':'hold'}]}, {'auto_merge':None}]:
                self.assertFalse(MODULE['identity']({**pr,**changed}))

    def test_worker_defers_before_model_or_data_writes_if_review_is_active(self):
        for status in ['queued','in_progress','waiting']:
            with self.subTest(status=status):
                calls,report,reads=self.repair([status])
                self.assertFalse(any(call[0]=='pnpm' or (call[0]=='git' and 'push' in call) for call in calls))
                self.assertEqual(report,{})
                self.assertEqual(len(reads),1)

    def test_review_starting_during_repair_prevents_publication(self):
        calls,report,reads=self.repair(['completed','in_progress'])
        self.assertEqual(sum('rankings-engine/scripts/repair-refresh.ts' in call for call in calls),1)
        self.assertFalse(any((call[0]=='git' and 'push' in call) for call in calls))
        self.assertNotIn('publishedHead',report)
        self.assertEqual(report['phase'],'waiting-review')
        self.assertEqual(len(reads),2)
        self.assertTrue(all('filter=all' in path for path in reads))

    def test_completed_review_allows_validated_repair_to_publish(self):
        calls,report,reads=self.repair(['completed','completed'])
        self.assertEqual(sum((call[0]=='git' and 'push' in call) for call in calls),1)
        self.assertEqual(report['publishedHead'],'e'*40)
        self.assertEqual(report['phase'],'rechecked')
        self.assertEqual(len(reads),2)


class PublicationReadbackTests(unittest.TestCase):
    def confirm(self, refs, heads, changes=None):
        refs = iter(refs); heads = iter(heads)
        sleep = Mock()
        def current():
            return {**PR, **(changes or {}), 'head':{**PR['head'], 'sha':next(heads)}}
        read = Mock(side_effect=lambda _:next(refs)+'\trefs/heads/'+BRANCH)
        with patch.dict(GLOBALS, {'current':current, 'output':read}), patch.object(MODULE['time'],'sleep',sleep):
            MODULE['confirm_publication'](BRANCH, SHA, 'b'*40)
        return read, sleep

    def test_immediate_consistent_readback(self):
        read,sleep=self.confirm(['b'*40]*2, ['b'*40])
        self.assertEqual(read.call_count,2); sleep.assert_not_called()

    def test_stale_pr_metadata_converges(self):
        read,sleep=self.confirm(['b'*40]*4, [SHA,'b'*40])
        self.assertEqual(read.call_count,4); sleep.assert_called_once_with(2)

    def test_stale_ref_also_requires_convergence(self):
        _,sleep=self.confirm([SHA,SHA,'b'*40,'b'*40], ['b'*40]*2)
        sleep.assert_called_once_with(2)

    def test_other_writer_never_retried(self):
        for refs,heads in [(['c'*40], []), (['b'*40],['c'*40]), (['b'*40,'c'*40],['b'*40])]:
            with self.subTest(refs=refs,heads=heads),self.assertRaisesRegex(RuntimeError,'head changed'):
                self.confirm(refs, heads)

    def test_stale_forever_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError,'did not converge'):
            self.confirm(['b'*40]*12,[SHA]*6)

    def test_hold_draft_or_closed_fails_closed(self):
        for change in [{'labels':[{'name':'manual-merge'}]}, {'draft':True}, {'state':'closed'}, {'auto_merge':None}]:
            with self.subTest(change=change),self.assertRaisesRegex(RuntimeError,'identity or automation'):
                self.confirm(['b'*40],['b'*40],change)

    def test_missing_ambiguous_or_bad_remote_ref_fails_closed(self):
        for value in ['', 'b'*40+'\trefs/heads/wrong', 'bad\trefs/heads/'+BRANCH,
                      ('b'*40+'\trefs/heads/'+BRANCH+'\n')*2]:
            with self.subTest(value=value),patch.dict(GLOBALS,{'output':lambda _:value}),self.assertRaises(RuntimeError):
                MODULE['confirm_publication'](BRANCH,SHA,'b'*40)


class DispatcherTests(unittest.TestCase):
    def controller(self):
        source=(Path(__file__).resolve().parents[2]/'scripts/refresh-automerge.py').read_text()
        code=source
        namespace={}
        with patch.dict(os.environ,{'REPO':'owner/repo'}),patch('subprocess.check_output',return_value='[[]]'):
            exec(code,namespace)
        return namespace

    def request(self,history,review_checks=None):
        namespace=self.controller()
        namespace['api']=lambda endpoint: ({'check_runs':review_checks if review_checks is not None else checks()}
                                           if '/check-runs?' in endpoint else {'workflow_runs':history})
        command=Mock()
        with patch('subprocess.run',command):
            namespace['request_repair']({'number':536,'head':{'ref':BRANCH}},SHA)
        return command

    def test_review_gate_failure_cannot_trigger_a_data_repair(self):
        fn=self.controller()['failed_validation']
        run={'id':1,'event':'workflow_dispatch','status':'completed','conclusion':'failure','check_suite_id':123}
        check={'name':'review-findings','app':{'id':15368},'check_suite':{'id':123},'status':'completed','conclusion':'failure'}
        self.assertFalse(fn([run],[check]))
        self.assertTrue(fn([run],[{**check,'name':'validation'}]))
        self.assertFalse(fn([run],[{**check,'name':'validation','check_suite':{'id':122}}]))
        self.assertFalse(fn([run,{**run,'id':2,'status':'in_progress','conclusion':None}],[{**check,'name':'validation'}]))

    def test_approved_pr_failure_survives_a_newer_cancelled_dispatch(self):
        fn=self.controller()['failed_validation']
        approved={'id':1,'event':'pull_request','status':'completed','conclusion':'failure','check_suite_id':123}
        cancelled={**approved,'id':2,'event':'workflow_dispatch','conclusion':'cancelled','check_suite_id':124}
        check={'name':'validation','app':{'id':15368},'check_suite':{'id':123},'status':'completed','conclusion':'failure'}
        self.assertTrue(fn([approved,cancelled],[check]))
        self.assertFalse(fn([approved,cancelled],[{**check,'check_suite':{'id':124}}]))
        self.assertFalse(fn([{**approved,'event':'workflow_dispatch'},cancelled],[check]))

    def test_latest_check_replaces_an_older_cancelled_or_failed_check(self):
        latest=MODULE['latest_checks']([{'id':1,'name':'ci','app':{'id':15368},'conclusion':'cancelled'},
                                       {'id':2,'name':'ci','app':{'id':15368},'conclusion':'success'}])
        self.assertEqual(latest[0]['conclusion'],'success')

    def test_approval_diagnostic_uses_latest_pr_run_and_never_dispatch_status(self):
        fn=self.controller()['pr_ci_approval_required']
        held={'id':1,'event':'pull_request','status':'completed','conclusion':'action_required'}
        dispatch={**held,'id':3,'event':'workflow_dispatch','conclusion':'success'}
        self.assertTrue(fn([held,dispatch]))
        for conclusion in ['success','failure',None]:
            newer={**held,'id':2,'conclusion':conclusion,
                   'status':'in_progress' if conclusion is None else 'completed'}
            self.assertFalse(fn([held,newer,dispatch]))
        self.assertFalse(fn([]))
        self.assertFalse(fn([dispatch]))

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

    def test_repair_dispatch_waits_for_an_active_review_even_with_older_success(self):
        for status in ['queued','in_progress','waiting']:
            with self.subTest(status=status):
                review={'id':10,'name':'Greptile Review','app':{'id':867647},'status':status,'conclusion':None}
                self.request([],checks()+[review]).assert_not_called()

    def test_review_activity_reads_all_pages_in_both_controllers(self):
        completed={'name':'Greptile Review','app':{'id':867647},'status':'completed'}
        for namespace in [self.controller(),GLOBALS]:
            api=Mock(side_effect=[{'check_runs':[completed]*100},
                                  {'check_runs':[{**completed,'status':'in_progress'}]}])
            with patch.dict(namespace,{'api':api}):
                self.assertTrue(namespace['review_active'](SHA))
            self.assertEqual(len(api.call_args_list),2)
            self.assertTrue(api.call_args_list[-1].args[0].endswith('page=2'))

    def test_unrelated_active_checks_do_not_block_repairs(self):
        self.request([], [{'name':'Greptile Review','app':{'id':1},'status':'in_progress'},
                           {'name':'Other check','app':{'id':867647},'status':'in_progress'}]).assert_called_once()

    def test_freshness_uses_all_applicable_rules_including_later_pages(self):
        namespace=self.controller()
        loose={'type':'required_status_checks','parameters':{'strict_required_status_checks_policy':False}}
        strict={'type':'required_status_checks','parameters':{'strict_required_status_checks_policy':True}}
        api=Mock(side_effect=[[loose]*100,[strict]])
        namespace['api']=api
        self.assertTrue(namespace['rules_require_current_base']())
        self.assertEqual([call.args[0] for call in api.call_args_list],
                         ['rules/branches/main?per_page=100&page=1','rules/branches/main?per_page=100&page=2'])

    def test_absent_or_loose_rules_do_not_require_a_current_base(self):
        for rules in [[], [{'type':'deletion'}], [{'type':'required_status_checks','parameters':{'strict_required_status_checks_policy':False}}]]:
            namespace=self.controller()
            namespace['api']=Mock(return_value=rules)
            self.assertFalse(namespace['rules_require_current_base']())

    def test_missing_freshness_parameter_is_not_guessed(self):
        namespace=self.controller()
        namespace['api']=Mock(return_value=[{'type':'required_status_checks','parameters':{}}])
        with self.assertRaisesRegex(RuntimeError,'policy unavailable'):
            namespace['rules_require_current_base']()


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

    def recover(self, runs, *, pr=None, updated_head=None, pending_review=False,
                strict=True, behind=None, mergeable=True, current_override=None,
                rules_error=False, unresolved=False, later_runs=None, finding_path='README.md',
                review_history=None, content_bot='fixture-content[bot]', content_token='fixture-installation-token', content_slug='fixture-content',
                update_tokens=None, provenance_error=False, bad_tree=False, phase='apply',
                delayed=False, commit_read_error=False, update_response_error=False,
                intent_error=False, stale_plan=False, graphql_error=False,
                late_override=None, main_changed=False, replacement_head=None, plan_override=None):
        pr = pr or {**PR,'number':536,'auto_merge':{'enabled_by':{'login':'maintainer'}}}
        calls = []
        branch_updated = False
        ci_reads = 0
        initial_sha = pr['head']['sha']
        pull_reads = main_reads = 0
        def run(args, **kwargs):
            nonlocal branch_updated, ci_reads, pull_reads, main_reads
            calls.append(args)
            result = None
            if args[:3] == ['gh','api','graphql']:
                result = {'data':{'repository':{'pullRequest':{'reviewThreads':{
                    'nodes':[{'isResolved':False,'path':finding_path,'comments':{'nodes':[{'author':{'login':'greptileai'}}]}}] if unresolved else [],
                    'pageInfo':{'hasNextPage':False}}}}}}
            elif args[:2] == ['gh','api']:
                endpoint = args[4]
                if '/compare/main...' in endpoint:
                    result = {'behind_by':behind if behind is not None else (1 if updated_head else 0)}
                elif endpoint.endswith('/update-branch') or endpoint == 'graphql':
                    if endpoint == 'graphql':
                        mutation = json.loads(kwargs['input'])['variables']['input']['refUpdates'][0]
                        self.assertEqual(mutation, {'name':f"refs/heads/{pr['head']['ref']}",
                            'beforeOid':initial_sha, 'afterOid':updated_head, 'force':False})
                    if update_tokens is not None:
                        update_tokens.append(kwargs.get('env', {}).get('GH_TOKEN'))
                    branch_updated = not graphql_error
                    if update_response_error:
                        raise subprocess.CalledProcessError(1,args,stderr='response lost after update')
                    result = {'errors':[{'message':'expected head mismatch'}]} if graphql_error else {'data':{'updateRefs':{'clientMutationId':None}}}
                elif endpoint.endswith('/pulls/536'):
                    pull_reads += 1
                    result = {**pr,'mergeable':mergeable,'merge_commit_sha':'d'*40,
                              'head':{**pr['head'],'sha':(replacement_head or updated_head) if branch_updated and not delayed else initial_sha},
                              **(current_override or {}),
                              **(late_override or {} if pull_reads >= 2 and not branch_updated else {})}
                elif endpoint == 'repos/owner/repo/':
                    result = {'node_id':'repository-id'}
                elif endpoint.endswith('/git/ref/heads/main'):
                    main_reads += 1
                    result = {'object':{'sha':('f' if main_changed and main_reads > 1 else 'c')*40}}
                elif endpoint.endswith('/git/commits') or '/git/commits/' in endpoint:
                    before = endpoint.endswith('d'*40)
                    if commit_read_error and branch_updated:
                        raise subprocess.CalledProcessError(1,args,stderr='commit read unavailable')
                    result = {'sha':'d'*40 if before else updated_head,
                              'tree':{'sha':('f' if bad_tree and not before else 'e')*40},
                              'parents':[{'sha':x} for x in (['c'*40,initial_sha] if before else [initial_sha,'c'*40])]}
                elif '/rules/branches/main?' in endpoint:
                    if rules_error:
                        raise subprocess.CalledProcessError(1,args,stderr='policy lookup failed')
                    result = [{'type':'required_status_checks','parameters':{'strict_required_status_checks_policy':strict}}]
                elif '/workflows/ci.yml/runs?' in endpoint:
                    self.assertIn(f'head_sha={(updated_head if branch_updated else None) or initial_sha}&', endpoint)
                    ci_reads += 1
                    result = {'workflow_runs':later_runs if later_runs is not None and ci_reads > 1 else runs}
                elif '/check-runs?' in endpoint:
                    head_checks = [{'id':index,'name':name,'app':{'id':app},'check_suite':{'id':123},
                        'status':'in_progress' if pending_review and name=='Greptile Review' else 'completed',
                        'conclusion':'failure' if app==15368 and any(r['conclusion']=='failure' for r in runs) else 'success'}
                        for index,(name,app) in enumerate([('validation',15368),('ci',15368),('Greptile Review',867647)])]
                    result = {'check_runs':review_history if review_history is not None and 'check_name=' in endpoint else head_checks}
                elif '/workflows/refresh-repair.yml/runs?' in endpoint:
                    result = {'workflow_runs':[]}
                else:
                    raise AssertionError(endpoint)
            return subprocess.CompletedProcess(args, 0, json.dumps(result) if result is not None else '')
        source = (Path(__file__).resolve().parents[2]/'scripts/refresh-automerge.py').read_text()
        code = source
        error = None
        plan = {'family':pr['head']['ref'].split('/')[0], 'pr':536, 'branch':pr['head']['ref'],
                'previous':initial_sha, 'main':('f' if stale_plan else 'c')*40, 'tree':'e'*40,
                'head':updated_head, 'app':True}
        plan.update(plan_override or {})
        from refresh_policy import MissingProvenance
        provenance_exception = MissingProvenance('No receipt') if provenance_error == 'missing' else RuntimeError('Untrusted head')
        with patch.dict(os.environ,{'REPO':'owner/repo','CONTENT_BOT_LOGIN':content_bot,
                                    'CONTENT_BOT_TOKEN':content_token,'CONTENT_BOT_SLUG':content_slug,
                                    'REFRESH_UPDATE':json.dumps(plan) if updated_head and phase=='apply' else ''}), \
                patch('subprocess.check_output',return_value=json.dumps([[pr]])), \
                patch('subprocess.run',side_effect=run), patch('time.sleep'), \
                patch('refresh_policy.verify_provenance',side_effect=provenance_exception if provenance_error else None), \
                patch('refresh_update.verify_update_intent',side_effect=RuntimeError('Invalid intent') if intent_error else None), \
                redirect_stdout(io.StringIO()) as captured:
            try:
                exec(code,{})
            except SystemExit as exc:
                error = str(exc)
        self.recovery_output = captured.getvalue()
        ci = [call for call in calls if call[:4] == ['gh','workflow','run','ci.yml']]
        return ci, calls, error

    def radar_pr(self, family='vendor-radar', app=False):
        return {**PR, 'number':536, 'head':{**PR['head'], 'ref':f'{family}/fixture-123'},
                'user':{'id':999 if app else 41898282,'login':'fixture-content[bot]' if app else 'github-actions[bot]', 'type':'Bot'}}

    def test_manual_hold_skips_all_recovery_and_repair_actions(self):
        for label in ['hold','manual-merge','do-not-merge','automerge-hold']:
            ci,calls,error=self.recover([],pr={**PR,'number':536,'labels':[{'name':label}]})
            self.assertEqual(calls,[])
            self.assertIsNone(error)

    def test_hold_arriving_before_dispatch_prevents_work_on_the_head(self):
        ci,calls,error=self.recover([],current_override={'labels':[{'name':'hold'}]})
        self.assertEqual(ci,[])
        self.assertFalse(any(call[:3]==['gh','workflow','run'] for call in calls))

    def test_unattested_parent_cannot_be_laundered_through_base_update(self):
        ci,calls,error=self.recover([self.run_record('workflow_dispatch','success')],
                                   updated_head='b'*40,provenance_error=True)
        self.assertIn('Refresh PRs need attention',error)
        self.assertFalse(any(('/update-branch' in str(call) or 'graphql' in call[4:5]) for call in calls))
        self.assertEqual(ci,[])

    def test_unexpected_update_tree_does_not_receive_a_provenance_output(self):
        with tempfile.NamedTemporaryFile(mode='r+') as output,patch.dict(os.environ,{'GITHUB_OUTPUT':output.name}):
            _,_,error=self.recover([self.run_record('workflow_dispatch','success')],
                                  updated_head='b'*40,bad_tree=True)
            output.seek(0)
            self.assertIn('updated=[]',output.read())
            self.assertIn('Refresh PRs need attention',error)

    def test_verified_base_update_records_head_despite_different_parent_order(self):
        with tempfile.NamedTemporaryFile(mode='r+') as output,patch.dict(os.environ,{'GITHUB_OUTPUT':output.name}):
            _,_,error=self.recover([self.run_record('workflow_dispatch','success')],updated_head='b'*40)
            output.seek(0)
            record=json.loads(output.read().splitlines()[0].split('=',1)[1])
            self.assertIsNone(error)
            self.assertEqual(record,[{'family':'story-runner','head':'b'*40,'pr':536}])

    def test_planning_creates_only_an_object_before_durable_intent_upload(self):
        with tempfile.NamedTemporaryFile(mode='r+') as output,patch.dict(os.environ,{'GITHUB_OUTPUT':output.name}):
            ci,calls,error=self.recover([self.run_record('workflow_dispatch','success')],updated_head='b'*40,phase='plan')
            output.seek(0); fields=dict(line.rstrip().split('=',1) for line in output)
            self.assertIsNone(error)
            self.assertEqual(json.loads(fields['updated']),[])
            self.assertEqual(json.loads(fields['planned'])[0]['head'],'b'*40)
            self.assertFalse(any('graphql' in call[4:5] or '/update-branch' in str(call) for call in calls))
            self.assertFalse(ci)
        source=(Path(__file__).resolve().parents[2]/'.github/workflows/refresh-automerge.yml').read_text()
        apply=source.split('\n  apply-updates:',1)[1]
        self.assertLess(apply.index('name: Upload durable update intent'),apply.index('name: Apply exact planned update'))
        before_apply=apply.split('name: Apply exact planned update',1)[0]
        self.assertNotIn('continue-on-error',before_apply)
        self.assertNotIn('if: always()',apply.split('name: Apply exact planned update',1)[1].split('run: python3',1)[0])

    def test_interrupted_update_restores_receipt_on_later_sweep_without_republishing(self):
        for failure in ['delayed','commit_read_error','update_response_error']:
            with self.subTest(failure=failure),tempfile.NamedTemporaryFile(mode='r+') as output,patch.dict(os.environ,{'GITHUB_OUTPUT':output.name}):
                _,calls,error=self.recover([self.run_record('workflow_dispatch','success')],updated_head='b'*40,**{failure:True})
                self.assertIn('need attention',error)
                self.assertEqual(sum('graphql' in call[4:5] for call in calls),1)
                output.seek(0); self.assertIn('updated=[]',output.read())
                output.seek(0); output.truncate()
                changed={**PR,'head':{**PR['head'],'sha':'b'*40}}
                ci,calls,error=self.recover([],pr=changed,provenance_error='missing')
                self.assertIsNone(error)
                self.assertFalse(ci)
                self.assertFalse(any(call[:3]==['gh','workflow','run'] or 'graphql' in call[4:5] for call in calls))
                output.seek(0)
                self.assertEqual(json.loads(output.readline().split('=',1)[1]),[{'family':'story-runner','head':'b'*40,'pr':536}])

    def test_untrusted_intent_and_stale_unapplied_plan_never_mutate_or_dispatch(self):
        for options in [{'provenance_error':'missing','intent_error':True},
                        {'updated_head':'b'*40,'stale_plan':True}]:
            with self.subTest(options=options):
                ci,calls,error=self.recover([self.run_record('workflow_dispatch','success')],**options)
                self.assertIn('need attention',error)
                self.assertFalse(ci)
                self.assertFalse(any('graphql' in call[4:5] or '/update-branch' in str(call) for call in calls))

    def test_hold_during_receipt_restoration_prevents_attestation(self):
        with tempfile.NamedTemporaryFile(mode='r+') as output,patch.dict(os.environ,{'GITHUB_OUTPUT':output.name}):
            _,_,error=self.recover([],provenance_error='missing',current_override={'labels':[{'name':'hold'}]})
            self.assertIsNone(error)
            output.seek(0);self.assertIn('updated=[]',output.read())

    def test_fresh_hold_opt_out_head_or_main_change_prevents_atomic_update(self):
        options=[{'late_override':{'labels':[{'name':'hold'}]}},
                 {'late_override':{'auto_merge':None}},
                 {'late_override':{'head':{**PR['head'],'sha':'f'*40}}},
                 {'main_changed':True}]
        for option in options:
            with self.subTest(option=option):
                ci,calls,error=self.recover([self.run_record('workflow_dispatch','success')],updated_head='b'*40,**option)
                self.assertIn('need attention',error)
                self.assertFalse(ci)
                self.assertFalse(any('graphql' in call[4:5] for call in calls))

    def test_graphql_http_success_with_errors_and_manual_replacement_do_not_attest(self):
        for option in [{'graphql_error':True},{'replacement_head':'f'*40}]:
            with self.subTest(option=option),tempfile.NamedTemporaryFile(mode='r+') as output,patch.dict(os.environ,{'GITHUB_OUTPUT':output.name}):
                ci,calls,error=self.recover([self.run_record('workflow_dispatch','success')],updated_head='b'*40,**option)
                self.assertIn('need attention',error)
                self.assertFalse(ci)
                self.assertEqual(sum('graphql' in call[4:5] for call in calls),1)
                output.seek(0);self.assertIn('updated=[]',output.read())

    def test_apply_job_cannot_fall_through_to_another_branch_family_or_head(self):
        for override in [{'branch':'story-runner/other'}, {'family':'vendor-radar'}, {'previous':'f'*40}]:
            with self.subTest(override=override):
                ci,calls,error=self.recover([],updated_head='b'*40,plan_override=override)
                self.assertIn('need attention',error)
                self.assertEqual(calls,[])
                self.assertFalse(ci)

    def test_radar_families_recover_missing_ci_for_both_author_paths(self):
        for family in ['vendor-radar','vendor-radar-bringup']:
            for app in [False,True]:
                with self.subTest(family=family,app=app):
                    pr=self.radar_pr(family,app)
                    ci,calls,error=self.recover([self.run_record()],pr=pr,content_bot='fixture-content[bot]')
                    self.assertIn('need attention',error)
                    self.assertEqual(ci,[['gh','workflow','run','ci.yml','--repo','owner/repo','--ref',pr['head']['ref']]])
                    self.assertNotIn('refresh-repair.yml',[c[3] for c in calls if c[:3]==['gh','workflow','run']])

    def test_radar_real_failure_never_enters_story_data_repair(self):
        for family in ['vendor-radar','vendor-radar-bringup']:
            ci,calls,error=self.recover([self.run_record('workflow_dispatch','failure')],
                pr=self.radar_pr(family,True),content_bot='fixture-content[bot]')
            self.assertIsNone(error)
            self.assertEqual(ci,[])
            self.assertNotIn('refresh-repair.yml',[c[3] for c in calls if c[:3]==['gh','workflow','run']])

    def test_app_radar_current_base_update_uses_only_matching_app_token(self):
        for family in ['story-runner','vendor-radar','vendor-radar-bringup']:
            tokens=[]
            _,_,error=self.recover([self.run_record('pull_request','success')],
                pr=self.radar_pr(family,True),updated_head='b'*40,content_bot='fixture-content[bot]',
                content_token='fixture-installation-token',content_slug='fixture-content',update_tokens=tokens)
            self.assertIsNone(error)
            self.assertEqual(tokens,['fixture-installation-token'])

    def test_app_radar_missing_or_mismatched_token_cannot_fall_back_for_base_update(self):
        for token,slug in [('', 'fixture-content'), ('fixture-token','wrong-app')]:
            tokens=[]
            _,_,error=self.recover([self.run_record('pull_request','success')],
                pr=self.radar_pr(app=True),updated_head='b'*40,content_bot='fixture-content[bot]',
                content_token=token,content_slug=slug,update_tokens=tokens)
            self.assertIn('need attention',error)
            self.assertEqual(tokens,[])

    def test_legacy_actions_head_update_requires_app_without_fallback(self):
        tokens=[]
        _,_,error=self.recover([self.run_record('pull_request','success')], updated_head='b'*40,
                               content_token='', update_tokens=tokens)
        self.assertIn('need attention',error)
        self.assertEqual(tokens,[])

    def test_configured_app_does_not_adopt_other_authors_families_or_manual_stops(self):
        pr=self.radar_pr(app=True)
        cases=[(pr,''),({**pr,'user':{'login':'other[bot]','type':'Bot'}},'fixture-content[bot]'),
               ({**pr,'user':{'login':'fixture-content[bot]','type':'User'}},'fixture-content[bot]'),
               (self.radar_pr('accuracy-engine',True),'fixture-content[bot]'),
               ({**pr,'draft':True},'fixture-content[bot]'),({**pr,'auto_merge':None},'fixture-content[bot]'),
               ({**pr,'head':{**pr['head'],'repo':{'full_name':'fork/repo'}}},'fixture-content[bot]')]
        for candidate,login in cases:
            with self.subTest(candidate=candidate,login=login):
                ci,calls,error=self.recover([],pr=candidate,content_bot=login)
                self.assertIsNone(error)
                self.assertEqual(calls,[])
                self.assertEqual(ci,[])

    def test_malformed_app_config_preserves_actions_recovery_and_rejects_app_author(self):
        for app in [False,True]:
            with self.subTest(app=app):
                ci,calls,error=self.recover([],pr=self.radar_pr(app=app),content_bot='not a bot')
                self.assertIsNone(error)
                self.assertEqual(len(ci),0 if app else 1)
                if app:
                    self.assertEqual(calls,[])

    def test_radar_retries_keep_the_existing_budget(self):
        ci,_,error=self.recover([self.run_record('workflow_dispatch','cancelled',id=i) for i in range(3)],
            pr=self.radar_pr(app=True),content_bot='fixture-content[bot]')
        self.assertEqual(ci,[])
        self.assertIn('need attention',error)

    def test_approval_event_winning_branch_update_race_still_dispatches_ci(self):
        ci, calls, error = self.recover([self.run_record()], updated_head='b'*40)
        self.assertIn('need attention',error)
        self.assertEqual(ci, [['gh','workflow','run','ci.yml','--repo','owner/repo','--ref',BRANCH]])
        self.assertTrue(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))
        self.assertFalse(any('approve' in call for call in calls))

    def test_main_advance_does_not_replace_a_head_while_review_is_pending(self):
        _, calls, error = self.recover([self.run_record('workflow_dispatch','success')], updated_head='b'*40, pending_review=True)
        self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))
        self.assertIsNone(error)

    def test_base_update_waits_for_active_review_hidden_by_latest_completed_check(self):
        _, calls, error = self.recover([self.run_record('workflow_dispatch','success')],
            updated_head='b'*40, review_history=[{'id':1,'name':'Greptile Review',
                'app':{'id':867647},'status':'in_progress','conclusion':None}])
        self.assertIsNone(error)
        self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))

    def test_loose_policy_keeps_a_reviewed_behind_head_unchanged(self):
        ci, calls, error = self.recover([self.run_record('workflow_dispatch','success')],
                                        updated_head='b'*40, strict=False, phase='plan')
        self.assertIsNone(error)
        self.assertEqual(ci, [])
        self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))
        reviews = [call for call in calls if call[:4] == ['gh','workflow','run','refresh-review.yml']]
        self.assertEqual(reviews[0][-1], f'head={SHA}')

    def test_apply_job_defers_without_dispatch_when_base_update_is_no_longer_required(self):
        ci,calls,error=self.recover([self.run_record('workflow_dispatch','success')],updated_head='b'*40,strict=False)
        self.assertIsNone(error)
        self.assertFalse(ci)
        self.assertFalse(any('graphql' in call[4:5] or call[:3]==['gh','workflow','run'] for call in calls))

    def test_real_conflict_reaches_bounded_repair_even_with_loose_policy(self):
        ci, calls, error = self.recover([self.run_record('workflow_dispatch','success')],
                                        behind=1, strict=False, mergeable=False)
        self.assertIn('need attention', error)
        self.assertEqual(ci, [])
        self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))
        workers = [call[3] for call in calls if call[:3] == ['gh','workflow','run']]
        self.assertEqual(workers, ['refresh-review.yml','review-findings.yml','refresh-repair.yml'])

    def test_unknown_mergeability_waits_without_requesting_review_or_repair(self):
        _, calls, error = self.recover([], behind=1, strict=False, mergeable=None)
        self.assertIn('need attention', error)
        self.assertFalse(any(call[:3] == ['gh','workflow','run'] for call in calls))
        self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))

    def test_conflict_does_not_replace_a_head_awaiting_review_or_findings(self):
        for waiting in [{'pending_review':True}, {'unresolved':True}]:
            with self.subTest(waiting=waiting):
                _, calls, error = self.recover([self.run_record('workflow_dispatch','success')],
                                               behind=1, mergeable=False, **waiting)
                self.assertIn('need attention', error)
                workers = [call[3] for call in calls if call[:3] == ['gh','workflow','run']]
                self.assertEqual(workers, ['refresh-review.yml','review-findings.yml'])
                self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))

    def test_conflict_keeps_missing_or_cancelled_ci_and_review_recoverable(self):
        for runs in [[], [self.run_record()], [self.run_record('workflow_dispatch','cancelled')]]:
            with self.subTest(runs=runs):
                ci, calls, error = self.recover(runs, behind=1, mergeable=False, strict=False)
                self.assertIn('need attention', error)
                self.assertEqual(len(ci),1)
                workers = [call[3] for call in calls if call[:3] == ['gh','workflow','run']]
                self.assertEqual(workers,['ci.yml','refresh-review.yml','review-findings.yml'])
                self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))

    def test_verdict_findings_keep_same_head_recovery_but_wait_for_review_to_finish(self):
        for conflict in [False,True]:
            with self.subTest(conflict=conflict):
                _, calls, _ = self.recover([self.run_record('workflow_dispatch','success')],
                    behind=1 if conflict else 0, mergeable=not conflict, pending_review=True,
                    unresolved=True, finding_path='open-rankings/email/verdicts.json')
                workers=[call[3] for call in calls if call[:3]==['gh','workflow','run']]
                self.assertEqual(workers,['refresh-review.yml','review-findings.yml'])

    def test_completed_review_with_verdict_findings_remains_repairable(self):
        _, calls, _ = self.recover([self.run_record('workflow_dispatch','success')],
            behind=1, mergeable=False, unresolved=True, finding_path='open-rankings/email/verdicts.json')
        self.assertIn('refresh-repair.yml',[call[3] for call in calls if call[:3]==['gh','workflow','run']])

    def test_failed_policy_lookup_keeps_the_existing_head(self):
        _, calls, error = self.recover([], updated_head='b'*40, rules_error=True)
        self.assertIn('need attention', error)
        self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))
        self.assertFalse(any(call[:3] == ['gh','workflow','run'] for call in calls))

    def test_strict_policy_does_not_update_with_unresolved_findings(self):
        _, calls, error = self.recover([self.run_record('workflow_dispatch','success')],
                                       updated_head='b'*40, unresolved=True)
        self.assertIsNone(error)
        self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))

    def test_manual_stop_or_head_change_after_listing_prevents_branch_update(self):
        for override in [{'draft':True}, {'auto_merge':None}, {'state':'closed'},
                         {'head':{**PR['head'],'sha':'c'*40}}, {'base':{'ref':'other'}}]:
            with self.subTest(override=override):
                _, calls, error = self.recover([], updated_head='b'*40, current_override=override)
                self.assertIsNone(error)
                self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))
                self.assertFalse(any(call[:3] == ['gh','workflow','run'] for call in calls))

    def test_no_run_or_approval_only_history_dispatches(self):
        for runs in [[], [self.run_record()]]:
            with self.subTest(runs=runs):
                ci, _, error = self.recover(runs)
                if runs:
                    self.assertIn('need attention',error)
                else:
                    self.assertIsNone(error)
                self.assertEqual(len(ci), 1)

    def test_pending_ci_is_left_running(self):
        for event in ['pull_request','workflow_dispatch']:
            for status in ['queued','in_progress','waiting']:
                with self.subTest(event=event,status=status):
                    ci, _, error = self.recover([self.run_record(event,None,status=status)])
                    self.assertIsNone(error)
                    self.assertEqual(ci, [])

    def test_pending_ci_prevents_stale_checks_from_updating_a_behind_head(self):
        for event in ['pull_request','workflow_dispatch']:
            for status in ['queued','in_progress','waiting']:
                with self.subTest(event=event,status=status):
                    _, calls, error = self.recover([self.run_record(event,None,status=status)],
                                                   updated_head='b'*40)
                    self.assertIsNone(error)
                    self.assertFalse(any(('/update-branch' in ' '.join(call) or 'graphql' in call[4:5]) for call in calls))
                    self.assertFalse(any(call[:3] == ['gh','workflow','run'] for call in calls))

    def test_pending_ci_prevents_conflict_repair_from_replacing_an_active_head(self):
        _, calls, error = self.recover([self.run_record('workflow_dispatch',None,status='queued')],
                                       behind=1, mergeable=False, strict=False)
        self.assertIsNone(error)
        self.assertFalse(any(call[:3] == ['gh','workflow','run'] for call in calls))

    def test_ci_started_during_recovery_prevents_conflict_repair(self):
        _, calls, error = self.recover([self.run_record('workflow_dispatch','success')],
                                       behind=1, mergeable=False, strict=False,
                                       later_runs=[self.run_record('workflow_dispatch',None,status='queued')])
        self.assertIn('need attention', error)
        workers = [call[3] for call in calls if call[:3] == ['gh','workflow','run']]
        self.assertEqual(workers,['refresh-review.yml','review-findings.yml'])

    def test_real_ci_results_are_preserved_despite_newer_approval_record(self):
        for conclusion in ['success','failure']:
            with self.subTest(conclusion=conclusion):
                ci, calls, error = self.recover([
                    self.run_record('workflow_dispatch',conclusion), self.run_record(id=2)])
                self.assertIn('need attention',error)
                self.assertIn('PR CI awaits workflow approval',self.recovery_output)
                self.assertIn('do not satisfy required PR checks',self.recovery_output)
                self.assertEqual(ci, [])
                self.assertFalse(any('approve' in call or 'rerun' in call for call in calls))
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
        self.assertIn('need attention',error)
        self.assertEqual(ci, [])

    def test_repeated_startup_failures_exhaust_budget_without_dispatching(self):
        ci, calls, error = self.recover([
            self.run_record('workflow_dispatch','startup_failure',id=i) for i in range(3)])
        self.assertEqual(ci, [])
        self.assertIn('Refresh PRs need attention or retry: [536]', error)
        self.assertFalse(any(call[:3] == ['gh','pr','merge'] for call in calls))

    def test_many_approval_records_do_not_exhaust_dispatch_budget(self):
        ci, _, error = self.recover([self.run_record(id=i) for i in range(4)])
        self.assertIn('need attention',error)
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
    def radar_step(self, name):
        source=(Path(__file__).resolve().parents[2]/'.github/workflows/vendor-radar.yml').read_text()
        step=source.split(f'      - name: {name}\n',1)[1].split('\n      - name:',1)[0]
        lines=step.split('        run: |\n',1)[1].split('\n      - name: Continue main CI',1)[0].splitlines()
        return step, '\n'.join(line[10:] for line in lines if line.startswith('          '))

    def publish_radar(self, bringup, app, *, fail_dispatch=False, fail_create=False, fail_merge=False):
        name='Bring-up PR for auto-approved passers' if bringup else 'Commit report + discovery records as PR (or compare-link issue)'
        source,script=self.radar_step(name)
        self.assertNotIn('UM_BOT_PR_PAT',source)
        with tempfile.TemporaryDirectory() as directory:
            cwd=Path(directory); binaries=cwd/'bin'; binaries.mkdir()
            reports=cwd/'reports/vendor-radar/runs'; reports.mkdir(parents=True)
            (reports/'fixture-123-triage.json').write_text('{}')
            (cwd/'vendor-radar-triage.md').write_text('Fixture triage')
            # Only executable workflow commands are replayed; all git/GitHub/engine
            # commands below are local fixtures with no network or model access.
            stub="""#!/usr/bin/python3
import json, os, sys
from pathlib import Path
name=Path(sys.argv[0]).name
args=sys.argv[1:]
with open(os.environ['CALL_LOG'],'a') as log:
    log.write(json.dumps([name,args,os.environ.get('GH_TOKEN')])+'\\n')
if name=='git' and args[:2]==['status','--porcelain']: print(' M reports/fixture.json')
if name=='pnpm' and 'rankings-engine/scripts/radar-bringup.ts' in args: print('fixture vendor')
if name=='gh' and args[:2]==['pr','create']:
    if os.environ['FAIL_CREATE']=='true': sys.exit(18)
    print('https://github.com/owner/repo/pull/1')
if name=='gh' and args[:3]==['workflow','run','ci.yml'] and os.environ['FAIL_DISPATCH']=='true': sys.exit(17)
if name=='gh' and args[:2]==['pr','merge'] and os.environ['FAIL_MERGE']=='true': sys.exit(19)
"""
            for name in ['git','gh','pnpm','python3']:
                binary=binaries/name; binary.write_text(stub); binary.chmod(0o755)
            result=subprocess.run(['bash','-e','-c',script.replace('/tmp/',directory+'/')],cwd=cwd,
                text=True,capture_output=True,env={'PATH':str(binaries)+os.pathsep+os.environ['PATH'],
                'CALL_LOG':str(cwd/'calls.jsonl'),'RADAR_RUN_ID':'fixture-123','GITHUB_SHA':'baseline',
                'GITHUB_REPOSITORY':'owner/repo','ANTHROPIC_API_KEY':'fixture',
                'GH_TOKEN':('app-fixture' if app else '') if not bringup else 'actions-fixture',
                'CONTENT_TOKEN':'app-fixture' if app else '', 'GH_ACTIONS_TOKEN':'actions-fixture',
                'HAS_CONTENT_BOT':'true' if app else 'false',
                'FAIL_DISPATCH':str(fail_dispatch).lower(),'FAIL_CREATE':str(fail_create).lower(),
                'FAIL_MERGE':str(fail_merge).lower()})
            calls=[json.loads(line) for line in (cwd/'calls.jsonl').read_text().splitlines()]
            return result,calls

    def test_radar_app_publishes_with_one_identity_and_ordinary_pr_ci(self):
        for bringup in [False,True]:
            result,calls=self.publish_radar(bringup,True)
            self.assertEqual(result.returncode,0,result.stderr)
            publications=[c for c in calls if (c[0]=='git' and 'push' in c[1]) or (c[0]=='gh' and c[1][0]=='pr')]
            self.assertTrue(publications)
            self.assertTrue(all(c[2]=='app-fixture' for c in publications))
            self.assertTrue(any('credential.helper=!gh auth git-credential' in c[1] for c in publications))
            self.assertFalse(any(c[0]=='gh' and c[1][0]=='workflow' for c in calls))
            self.assertTrue(all(c[2]=='actions-fixture' for c in calls if c[0]=='pnpm'))

    def test_radar_missing_app_token_fails_before_remote_publication(self):
        for bringup in [False,True]:
            result,calls=self.publish_radar(bringup,False)
            self.assertNotEqual(result.returncode,0)
            self.assertFalse(any((c[0]=='git' and 'push' in c[1]) or
                                 (c[0]=='gh' and c[1][0] in ['pr','workflow']) for c in calls))

    def test_radar_opt_in_failure_remains_visible_without_duplicate_ci(self):
        for bringup in [False,True]:
            result,calls=self.publish_radar(bringup,True,fail_merge=True)
            self.assertEqual(result.returncode,19,result.stderr)
            self.assertFalse(any(c[0]=='gh' and c[1][0] in ['workflow','issue'] for c in calls))

    def test_radar_issue_fallback_uses_actions_token_with_app_publication(self):
        for bringup in [False,True]:
            result,calls=self.publish_radar(bringup,True,fail_create=True)
            self.assertEqual(result.returncode,18,result.stderr)
            issues=[c for c in calls if c[0]=='gh' and c[1][:2]==['issue','create']]
            self.assertEqual(len(issues),1)
            self.assertEqual(issues[0][2],'actions-fixture')
            self.assertFalse(any(c[0]=='gh' and c[1][0]=='workflow' for c in calls))

    def test_radar_publication_rejects_missing_or_wrong_app_identity(self):
        _,script=self.radar_step('Verify content publication identity')
        for slug,login,success in [('fixture-content','fixture-content[bot]',True),
                                   ('','fixture-content[bot]',False),('other','fixture-content[bot]',False),
                                   ('fixture-content','',False)]:
            result=subprocess.run(['bash','-e','-c',script],capture_output=True,text=True,
                env={'APP_SLUG':slug,'CONTENT_BOT_LOGIN':login})
            self.assertEqual(result.returncode==0,success,result.stderr)

    def test_publication_uses_the_bot_identity_accepted_by_recovery(self):
        root=Path(__file__).resolve().parents[2]
        source=(root/'.github/workflows/story-runner.yml').read_text().split('      - name: Open PR if anything changed\n',1)[1]
        self.assertIn('GH_TOKEN: ${{ steps.content-app.outputs.token }}',source)
        self.assertNotIn('UM_BOT_PR_PAT',source)

    def test_unsupported_grade_change_stops_before_remote_push_pr_or_review(self):
        root=Path(__file__).resolve().parents[2]
        source=(root/'.github/workflows/story-runner.yml').read_text().split('      - name: Open PR if anything changed\n',1)[1]
        script='\n'.join(line[10:] for line in source.split('        run: |\n',1)[1].split('\n      - name:',1)[0].splitlines())
        with tempfile.TemporaryDirectory() as directory:
            cwd=Path(directory)
            arena=cwd/'open-rankings/fixture'; (arena/'evidence').mkdir(parents=True)
            checker=cwd/'rankings-engine/scripts/check-refresh-stability.mjs'; checker.parent.mkdir(parents=True)
            shutil.copy(root/'rankings-engine/scripts/check-refresh-stability.mjs',checker)
            shutil.copy(root/'rankings-engine/evidence-source.mjs',cwd/'rankings-engine/evidence-source.mjs')
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
