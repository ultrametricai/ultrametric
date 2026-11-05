"""Replay provenance, scope and post-merge continuation without GitHub writes."""
import copy
import json
import os
import subprocess
import tempfile
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import refresh_policy as policy
import refresh_main_ci as continuation
import refresh_update as update

REPO = 'ultrametricai/ultrametric'
HEAD, SOURCE, MERGE = 'a'*40, 'b'*40, 'c'*40
PR = {'number': 613, 'head': {'sha': HEAD, 'ref': 'story-runner/email-123', 'repo': {'full_name': REPO}}}


class ProvenanceTests(unittest.TestCase):
    def proof(self, *, kind='story-runner', mutate=lambda _: None, pr=None):
        pr = pr or {**PR, 'head': {**PR['head'], 'ref': kind + '/fixture-123'}}
        path = '.github/workflows/' + ('story-runner.yml' if kind == 'story-runner' else 'vendor-radar.yml')
        data = {
            'artifacts': {'total_count': 1, 'artifacts': [{'name': f'internal-refresh-{kind}-613-{HEAD}',
                'expired': False, 'workflow_run': {'id': 123}}]},
            'run': {'id':123, 'path':path, 'head_branch':'main', 'head_sha':SOURCE,
                'event':'schedule', 'status':'completed', 'conclusion':'success', 'workflow_id':42,
                'repository':{'full_name':REPO}, 'head_repository':{'full_name':REPO}},
            'workflow': {'id':42, 'path':path, 'state':'active'}, 'comparison': {'status':'ahead'},
        }
        mutate(data)
        def api(endpoint):
            if '/actions/artifacts?' in endpoint:
                self.assertIn(pr['head']['sha'], endpoint)
                self.assertIn(f"-{pr['number']}-", endpoint)
                return data['artifacts']
            if '/actions/runs/' in endpoint: return data['run']
            if '/actions/workflows/' in endpoint: return data['workflow']
            if '/compare/' in endpoint: return data['comparison']
            raise AssertionError(endpoint)
        policy.verify_provenance(api, REPO, pr)

    def test_canonical_producer_receipts_cover_all_requested_families(self):
        for kind in ['story-runner','vendor-radar','vendor-radar-bringup']:
            self.proof(kind=kind)

    def test_current_head_and_pr_cannot_replay_a_different_receipt(self):
        for pr in [{**PR,'number':614}, {**PR,'head':{**PR['head'],'sha':MERGE}}]:
            with self.assertRaises(RuntimeError): self.proof(pr=pr)

    def test_foreign_workflows_and_untrusted_source_refs_fail_closed(self):
        cases = [
            lambda d:d['run'].update(path='.github/workflows/unrelated.yml'),
            lambda d:d['run'].update(head_branch='feature'),
            lambda d:d['run'].update(event='pull_request_target'),
            lambda d:d['run'].update(head_repository={'full_name':'outsider/fork'}),
            lambda d:d['run'].update(repository={'full_name':'outsider/fork'}),
            lambda d:d['run'].update(workflow_id=99),
            lambda d:d['run'].update(status='in_progress'),
            lambda d:d['comparison'].update(status='diverged'),
            lambda d:d['workflow'].update(state='disabled_manually'),
            lambda d:d['artifacts']['artifacts'][0].update(expired=True),
            lambda d:d['artifacts'].update(total_count=100),
        ]
        for change in cases:
            with self.subTest(change=change), self.assertRaises(RuntimeError): self.proof(mutate=change)

    def test_late_generator_failure_does_not_invalidate_its_published_scan(self):
        self.proof(kind='vendor-radar',mutate=lambda d:d['run'].update(conclusion='failure'))

    def test_only_explicit_continuation_workflows_can_attest_new_heads(self):
        for path in ['refresh-repair.yml','refresh-automerge.yml']:
            def change(d):
                name='.github/workflows/'+path
                d['run'].update(path=name,event='workflow_dispatch')
                d['workflow'].update(path=name)
            self.proof(mutate=change)
        with self.assertRaises(RuntimeError):
            self.proof(kind='vendor-radar',mutate=change_repair)


def change_repair(d):
    name='.github/workflows/refresh-repair.yml'
    d['run'].update(path=name); d['workflow'].update(path=name)


class UpdateIntentTests(unittest.TestCase):
    def proof(self, mutate=lambda _:None, *, pr=None, ordinary=False):
        plan = {'family':'story-runner','pr':613,'head':'d'*40,'previous':HEAD,'main':MERGE,'tree':'e'*40}
        pr = pr or {**PR,'head':{**PR['head'],'sha':plan['head']}}
        path = '.github/workflows/refresh-automerge.yml'
        data = {'intent':{'name':update.intent_name(plan),'expired':False,'workflow_run':{'id':123}},
                'commit':{'sha':pr['head']['sha'],'tree':{'sha':plan['tree']},
                          'parents':[{'sha':HEAD},{'sha':MERGE}]},
                'run':{'id':123,'path':path,'head_branch':'main','head_sha':SOURCE,'event':'schedule',
                       'status':'completed','conclusion':'failure','workflow_id':42,
                       'repository':{'full_name':REPO},'head_repository':{'full_name':REPO}},
                'workflow':{'id':42,'path':path,'state':'active'},
                'prior_receipt':True,'base_status':'ahead'}
        mutate(data)
        def api(endpoint):
            if '/git/commits/' in endpoint: return data['commit']
            if '/actions/artifacts?' in endpoint:
                if 'name=internal-refresh-update-' in endpoint: artifact=data['intent']
                elif endpoint.endswith(f'name=internal-refresh-story-runner-613-{HEAD}&per_page=100') and data['prior_receipt']:
                    artifact={**data['intent'],'name':f'internal-refresh-story-runner-613-{HEAD}'}
                else: return {'total_count':0,'artifacts':[]}
                return {'total_count':1,'artifacts':[artifact]}
            if '/actions/runs/' in endpoint:return data['run']
            if '/actions/workflows/' in endpoint:return data['workflow']
            if f'/compare/{MERGE}...main' in endpoint:return {'status':data['base_status']}
            if '/compare/' in endpoint:return {'status':'ahead'}
            raise AssertionError(endpoint)
        if ordinary: return policy.verify_provenance(api,REPO,pr)
        return update.verify_update_intent(api,REPO,pr)

    def test_completed_failed_run_can_recover_only_its_exact_planned_head(self):
        self.assertEqual(self.proof()['head'],'d'*40)

    def test_intent_is_not_an_ordinary_published_head_receipt(self):
        with self.assertRaises(policy.MissingProvenance): self.proof(ordinary=True)

    def test_manual_replacement_with_identical_tree_and_parents_cannot_replay_intent(self):
        with self.assertRaisesRegex(RuntimeError,'No canonical intent'):
            self.proof(pr={**PR,'head':{**PR['head'],'sha':'f'*40}})

    def test_wrong_pr_family_tree_parents_and_order_reject_saved_intent(self):
        cases = [lambda d:d['commit']['tree'].update(sha='f'*40),
                 lambda d:d['commit'].update(parents=[{'sha':MERGE},{'sha':HEAD}]),
                 lambda d:d['commit'].update(parents=[{'sha':HEAD},{'sha':'f'*40}]),
                 lambda d:d['commit'].update(parents=[{'sha':HEAD}])]
        for mutate in cases:
            with self.subTest(mutate=mutate),self.assertRaises(RuntimeError):self.proof(mutate)
        for pr in [{**PR,'number':614,'head':{**PR['head'],'sha':'d'*40}},
                   {**PR,'head':{**PR['head'],'sha':'d'*40,'ref':'vendor-radar/fixture'}}]:
            with self.subTest(pr=pr),self.assertRaises(RuntimeError):self.proof(pr=pr)

    def test_missing_prior_provenance_or_rewritten_main_cannot_be_recovered(self):
        for mutate in [lambda d:d.update(prior_receipt=False),lambda d:d.update(base_status='diverged')]:
            with self.subTest(mutate=mutate),self.assertRaises(RuntimeError):self.proof(mutate)

    def test_foreign_active_expired_or_modified_source_intents_fail_closed(self):
        for mutate in [lambda d:d['intent'].update(expired=True),
                       lambda d:d['run'].update(path='.github/workflows/unrelated.yml'),
                       lambda d:d['run'].update(status='in_progress'),
                       lambda d:d['run'].update(head_branch='feature'),
                       lambda d:d['run'].update(workflow_id=43),
                       lambda d:d['run'].update(head_repository={'full_name':'other/repo'})]:
            with self.subTest(mutate=mutate),self.assertRaises(RuntimeError):self.proof(mutate)

    def test_applied_intent_remains_recoverable_when_main_advances(self):
        self.assertEqual(self.proof(lambda d:d.update(base_status='ahead'))['main'],MERGE)


class ScopeTests(unittest.TestCase):
    def test_internal_identity_needs_immutable_id_login_and_bot_type(self):
        self.assertTrue(policy.actions_author(policy.ACTIONS_BOT))
        for key,value in [('id',1),('login','other[bot]'),('type','User')]:
            self.assertFalse(policy.actions_author({**policy.ACTIONS_BOT,key:value}))

    def test_manual_stops_fail_closed(self):
        for label in ['hold','HOLD','manual-merge','do-not-merge','automerge-hold']:
            self.assertTrue(policy.held({'labels':[{'name':label}]}))
        self.assertTrue(policy.held({}))
        self.assertFalse(policy.held({'labels':[]}))

    def check(self,kind,path,**over):
        file={'filename':path,'status':'modified',**over}
        policy.check_scope(kind,[file],1,lambda _: '100644')

    def test_expected_data_scopes_pass(self):
        for kind,path in [('story-runner','open-rankings/email/verdicts.json'),
                          ('story-runner','rankings-engine/cache/judge/email/a.json'),
                          ('vendor-radar','reports/vendor-radar/runs/fixture-triage.json'),
                          ('vendor-radar',f'reports/radar-imports/files/{HEAD+HEAD[:24]}/reports/vendor-radar/2026-11-05.md'),
                          ('vendor-radar-bringup','open-rankings/email/products.json')]:
            self.check(kind,path)

    def test_code_taxonomy_unrelated_reports_and_path_tricks_fail(self):
        for kind in ['story-runner','vendor-radar','vendor-radar-bringup']:
            for path in ['.github/workflows/ci.yml','scripts/refresh_policy.py','package.json',
                         'open-rankings/categories.json','open-rankings/email/stories.json',
                         'reports/other.md','rankings-engine/cache/judge/../../evil.json']:
                with self.subTest(kind=kind,path=path),self.assertRaises(RuntimeError): self.check(kind,path)
        with self.assertRaises(RuntimeError): self.check('story-runner','open-rankings/email/products.json')

    def test_renames_deletions_truncation_symlinks_and_executable_files_fail(self):
        path='open-rankings/email/verdicts.json'
        for over in [{'status':'removed'},{'status':'renamed','previous_filename':'scripts/code.py'}]:
            with self.assertRaises(RuntimeError): self.check('story-runner',path,**over)
        files=[{'filename':path,'status':'modified'}]
        for count in [0,2,3000]:
            with self.assertRaises(RuntimeError): policy.check_scope('story-runner',files,count,lambda _: '100644')
        for mode in ['120000','100755','160000',None]:
            with self.assertRaises(RuntimeError): policy.check_scope('story-runner',files,1,lambda _:mode)


class PublicationReceiptTests(unittest.TestCase):
    def test_receipt_is_emitted_only_after_fresh_remote_head_verification(self):
        script=Path(__file__).resolve().parents[2]/'scripts/refresh_policy.py'
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            def git(*args):
                return subprocess.check_output(['/usr/bin/git',*args],cwd=root,text=True).strip()
            git('init','-q','--initial-branch=story-runner/email-123')
            target=root/'open-rankings/email/verdicts.json';target.parent.mkdir(parents=True)
            target.write_text('[]');git('add','.')
            git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','base')
            target.write_text('[{}]');git('add','.')
            git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','candidate')
            head=git('rev-parse','HEAD')
            binary=root/'bin';binary.mkdir()
            gh=binary/'gh';gh.write_text("#!/bin/sh\nprintf '%s' \"$FAKE_PR\"\n");gh.chmod(0o755)
            output=root/'output';output.touch()
            pr={**PR,'state':'open','head':{**PR['head'],'sha':head}}
            env={**os.environ,'PATH':str(binary)+':/usr/bin:/bin','GITHUB_OUTPUT':str(output),
                 'RUNNER_TEMP':directory,'GITHUB_REPOSITORY':REPO,'FAKE_PR':json.dumps(pr)}
            def invoke(*args):
                return subprocess.run([sys.executable,str(script),'story-runner',*args],cwd=root,env=env,
                                      text=True,capture_output=True)
            self.assertEqual(invoke().returncode,0)
            self.assertEqual(output.read_text(),'')
            env['FAKE_PR']=json.dumps({**pr,'head':{**pr['head'],'sha':MERGE}})
            self.assertNotEqual(invoke('--published','https://github.com/'+REPO+'/pull/613').returncode,0)
            self.assertEqual(output.read_text(),'')
            env['FAKE_PR']=json.dumps(pr)
            result=invoke('--published','https://github.com/'+REPO+'/pull/613')
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(output.read_text(),f'published_head={head}\npublished_pr=613\n')


class MainCITests(unittest.TestCase):
    def replay(self, history=None, *, moved=False, unrelated=False, untrusted=False, confirm=True):
        writes=[]; control_reads=0
        workflow={'id':4,'path':'.github/workflows/ci.yml','state':'active'}
        def read(path,data=None):
            nonlocal control_reads
            if path=='graphql':
                control_reads+=1
                return {'data':{'repository':{'nameWithOwner':REPO,'autoMergeAllowed':True,
                    'defaultBranchRef':{'name':'main','target':{'oid':SOURCE if moved and control_reads>1 else MERGE}}}}}
            if '/commits/' in path and '/pulls?' in path: return [] if unrelated else [PR]
            if '/pulls/613' in path: return {**copy.deepcopy(PR),'merged':True,'merge_commit_sha':MERGE,
                'merged_by':policy.ACTIONS_BOT,'base':{'ref':'main'}}
            if path.endswith('/actions/workflows/ci.yml'): return workflow
            if path.endswith('/dispatches'):
                writes.append(data);return None
            if '/runs?' in path:
                items=list(history or [])
                if writes and confirm: items.append({'id':99,'status':'queued','conclusion':None})
                return {'total_count':len(items),'workflow_runs':[{
                    **workflow,'workflow_id':workflow['id'],'head_sha':MERGE,'head_branch':'main',
                    'event':'workflow_dispatch',**item} for item in items]}
            raise AssertionError(path)
        with patch('refresh_main_ci.verify_provenance',side_effect=RuntimeError('untrusted') if untrusted else None):
            result=continuation.recover(REPO,read=read,pause=lambda _:None)
        return result,writes

    def test_missing_ci_dispatches_only_main_and_confirms_exact_observed_sha(self):
        result,writes=self.replay()
        self.assertEqual(writes,[{'ref':'main'}]);self.assertIn(MERGE,result)

    def test_active_success_and_any_real_failure_are_not_retried(self):
        for status,conclusion in [('queued',None),('completed','success'),('completed','failure')]:
            _,writes=self.replay([{'id':1,'status':status,'conclusion':conclusion}])
            self.assertEqual(writes,[])
        _,writes=self.replay([{'id':1,'status':'completed','conclusion':'success'},
                             {'id':2,'status':'completed','conclusion':'failure'}])
        self.assertEqual(writes,[])

    def test_unrelated_or_advanced_main_never_dispatches(self):
        for options in [{'unrelated':True},{'moved':True}]:
            _,writes=self.replay(**options);self.assertEqual(writes,[])

    def test_unknown_provenance_unconfirmed_dispatch_and_retry_limit_remain_visible(self):
        for options in [{'untrusted':True},{'confirm':False},
                        {'history':[{'id':i,'status':'completed','conclusion':'cancelled'} for i in range(3)]}]:
            with self.assertRaises(RuntimeError): self.replay(**options)


if __name__ == '__main__':
    unittest.main()
