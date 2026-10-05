import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent

class ImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'scripts/shared-processes').mkdir(parents=True)
        (self.root / 'processes').mkdir()
        (self.root / 'journeys').mkdir()
        for name in ('import.py', 'claim_audit.py', 'source_snapshot.py', 'check-import.py'):
            shutil.copy(SCRIPT / name, self.root / 'scripts/shared-processes' / name)
        self.source = self.root / 'processes/corpus.json'
        self.records = [{'id': key, 'title': key, 'description': 'Synthetic source', 'dag': {'nodes': [{'id': 'step', 'label': 'Synthetic step', 'estimatedMinutes': 5, 'toolCall': 'unverified-test-operation'}], 'edges': []}} for key in ('alpha', 'beta')]
        self.source.write_text(json.dumps(self.records))
        (self.root / 'journeys/chains.json').write_text('[]')
        (self.root / 'processes/vendor-registry.json').write_text('{"vendors":{}}')
        subprocess.run(['git', 'init', '-q'], cwd=self.root, check=True)
        self.commit_sources()
        self.run_import('--write', expected=0)

    def commit_sources(self):
        subprocess.run(['git', 'add', 'processes', 'journeys'], cwd=self.root, check=True)
        subprocess.run(['git', '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic source'], cwd=self.root, check=True)

    def check_preservation(self, expected):
        result = subprocess.run(['python3', str(self.root / 'scripts/shared-processes/check-import.py')], capture_output=True, text=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result

    def tearDown(self):
        self.temp.cleanup()

    def run_import(self, *args, expected):
        result = subprocess.run(['python3', str(self.root / 'scripts/shared-processes/import.py'), *args], capture_output=True, text=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result

    def test_preserves_authored_edits_and_stops_before_any_conflicting_write(self):
        target = self.root / 'content/processes/records/alpha.json'
        value = json.loads(target.read_text())
        value['notes'] = [{'text': 'Authored note'}]
        target.write_text(json.dumps(value))
        self.run_import('--write', expected=0)
        self.assertEqual(json.loads(target.read_text())['notes'], value['notes'])
        before = {str(p): p.read_bytes() for p in (self.root / 'content/processes').rglob('*.json')}
        self.records[0]['description'] = 'Changed source'
        self.records[1]['description'] = 'Another changed source'
        self.source.write_text(json.dumps(self.records))
        self.commit_sources()
        self.run_import('--write', expected=1)
        self.assertEqual({str(p): p.read_bytes() for p in (self.root / 'content/processes').rglob('*.json')}, before)

    def test_reports_drift_then_updates_an_unedited_generated_record(self):
        self.records[0]['description'] = 'Changed source'
        self.source.write_text(json.dumps(self.records))
        self.commit_sources()
        self.run_import(expected=1)
        self.run_import('--write', expected=0)
        target = self.root / 'content/processes/records/alpha.json'
        self.assertEqual(json.loads(target.read_text())['summary'], 'Changed source')
        self.run_import(expected=0)


    def test_rejects_unstaged_and_staged_source_changes_without_writes(self):
        before = {str(p): p.read_bytes() for p in (self.root / 'content/processes').rglob('*.json')}
        self.records[0]['description'] = 'Uncommitted change'
        self.source.write_text(json.dumps(self.records))
        for staged in (False, True):
            if staged:
                subprocess.run(['git', 'add', 'processes/corpus.json'], cwd=self.root, check=True)
            result = self.run_import('--write', expected=1)
            self.assertIn('Commit legacy source changes', result.stderr)
            self.assertEqual({str(p): p.read_bytes() for p in (self.root / 'content/processes').rglob('*.json')}, before)

    def test_rejects_an_untracked_workflow(self):
        directory = self.root / 'processes/equity'
        directory.mkdir()
        (directory / 'new.json').write_text('{}')
        result = self.run_import('--write', expected=1)
        self.assertIn('processes/equity/new.json', result.stderr)

    def test_records_the_commit_containing_the_imported_values(self):
        self.records[0]['description'] = 'Committed change'
        self.source.write_text(json.dumps(self.records))
        self.commit_sources()
        self.run_import('--write', expected=0)
        target = json.loads((self.root / 'content/processes/records/alpha.json').read_text())
        original = json.loads(subprocess.check_output(['git', 'show', target['source']['revision'] + ':' + target['source']['path']], cwd=self.root, text=True))
        self.assertEqual(target['summary'], original[0]['description'])
        self.assertEqual(target['summary'], 'Committed change')

    def test_fresh_preservation_allows_authored_catalog_changes(self):
        target = self.root / 'content/processes/records/alpha.json'
        value = json.loads(target.read_text())
        value.update(notes=[{'text': 'Authored note'}], guidance='Authored guidance', outcomes=['Authored outcome'], summary='Authored summary')
        target.write_text(json.dumps(value))
        before = {str(p): p.read_bytes() for p in (self.root / 'content/processes').rglob('*.json')}
        self.check_preservation(expected=0)
        self.assertEqual({str(p): p.read_bytes() for p in (self.root / 'content/processes').rglob('*.json')}, before)

    def test_fresh_preservation_detects_a_dropped_source_value(self):
        importer = self.root / 'scripts/shared-processes/import.py'
        importer.write_text(importer.read_text().replace('        return self.left', '        self.left.pop("estimatedMinutes", None)\n        return self.left'))
        result = self.check_preservation(expected=1)
        self.assertIn('metadata', result.stderr)

    def test_fresh_preservation_detects_a_lost_quarantined_value(self):
        audit = self.root / 'scripts/shared-processes/claim_audit.py'
        audit.write_text(audit.read_text().replace('    ENTRIES.append(entry)', '    pass'))
        result = self.check_preservation(expected=1)
        self.assertIn('Quarantined source values', result.stderr)

    def test_formation_chooser_manifest_protects_authored_guidance_on_source_change(self):
        # Exercise the committed migration receipt, not an invented authored hash.
        # Re-blessing the authored chooser as generated makes this regression fail:
        # a later corpus edit would silently replace its guidance and option scope.
        repository = SCRIPT.parents[1]
        corpus = json.loads((repository / 'processes/corpus.json').read_text())
        source = next(record for record in corpus if record['id'] == 'form_001')
        self.records.append(source)
        self.source.write_text(json.dumps(self.records))
        self.commit_sources()
        target = self.root / 'content/processes/records/form_001.json'
        shutil.copy(repository / 'content/processes/records/form_001.json', target)
        manifest_path = self.root / 'content/processes/import-manifest.json'
        manifest = json.loads(manifest_path.read_text())
        receipt = json.loads((repository / 'content/processes/import-manifest.json').read_text())
        manifest['records']['form_001'] = receipt['records']['form_001']
        manifest_path.write_text(json.dumps(manifest))
        self.run_import(expected=0)
        source['description'] += ' Synthetic later source change.'
        self.source.write_text(json.dumps(self.records))
        self.commit_sources()
        before = {str(p): p.read_bytes() for p in (self.root / 'content/processes').rglob('*.json')}
        result = self.run_import('--write', expected=1)
        self.assertIn('form_001', result.stderr)
        self.assertEqual({str(p): p.read_bytes() for p in (self.root / 'content/processes').rglob('*.json')}, before)

if __name__ == '__main__':
    unittest.main()
