"""Metadata-only repair recheck/resume scenarios; no network or repository writes."""
import json
import os
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

with patch.dict(os.environ, {'REPO':'owner/repo','PR_NUMBER':'536','PR_HEAD':'a'*40}):
    MODULE = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/refresh-repair.py'), run_name='controller_test')
GLOBALS = MODULE['recheck'].__globals__
SHA = 'a'*40
BRANCH = 'story-runner/email-123'
PR = {'state':'open','draft':False,'base':{'ref':'main'},'head':{'sha':SHA,'ref':BRANCH,'repo':{'full_name':'owner/repo'}},'user':{'login':'github-actions[bot]'}}
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

    def test_audit_resume_precedes_the_published_attempt_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            def output(args):
                if args[:3]==['git','rev-parse','HEAD']:return 'b'*40
                if args[:3]==['git','rev-parse','refs/repair/head']:return SHA
                if args[:3]==['git','log','--format=%B']:return '\n'.join(f'Refresh-Repair-Attempt: {i}' for i in range(1,4))
                if args[:2]==['git','merge-base']:return 'c'*40
                raise AssertionError(args)
            command=Mock(); resume=Mock(return_value={**REPORT,'publishedHead':SHA})
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

    def test_waiting_resumes_do_not_consume_failed_worker_budget(self):
        history=[{'display_title':f'Repair refresh #536 @{SHA}','status':'completed','conclusion':'success'} for _ in range(4)]
        self.request(history).assert_called_once()

    def test_parent_worker_prevents_a_second_worker_for_the_same_pr(self):
        history=[{'display_title':f'Repair refresh #536 @{"b"*40}','status':'in_progress','conclusion':None}]
        self.request(history).assert_not_called()

    def test_three_failed_workers_stop_dispatching_that_head(self):
        history=[{'display_title':f'Repair refresh #536 @{SHA}','status':'completed','conclusion':'failure'} for _ in range(3)]
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

if __name__=='__main__':
    unittest.main()
