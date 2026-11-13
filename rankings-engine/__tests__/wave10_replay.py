"""Offline contract fixtures, not captured vendor responses or new evidence."""
import importlib.util
import json
from pathlib import Path
import unittest
import tempfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('wave10', Path(__file__).parents[1] / 'scripts/append-api-quality-gap-evidence-2026-11-06-wave10.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReplayTests(unittest.TestCase):
    def verify(self, body, status=200):
        with patch.object(module, 'fetch', return_value=(status, body)):
            module.verify('https://example.invalid/spec', ['"due_on"'], evidence_id='gitea-milestone-schema-20261106')

    def test_nested_datetime_accepts_compact_json(self):
        self.verify(json.dumps({'definitions': {'Milestone': {'properties': {'due_on': {'type': 'string', 'format': 'date-time'}}}}}))

    def test_unrelated_model_due_date_rejected(self):
        with self.assertRaises(SystemExit):
            self.verify(json.dumps({'definitions': {'Milestone': {'properties': {}}, 'Issue': {'properties': {'due_on': {'type': 'string', 'format': 'date-time'}}}}}))

    def test_malformed_missing_and_changed_types_fail_closed(self):
        for body in ['invalid', 'null', '[]', '{}', '{"definitions":null}', json.dumps({'definitions': {'Milestone': {'properties': {'due_on': {'type': 'number', 'format': 'date-time'}}}}}), json.dumps({'definitions': {'Milestone': {'properties': {'due_on': {'type': 'string'}}}}})]:
            with self.subTest(body=body), self.assertRaises(SystemExit):
                self.verify(body)

    def test_existing_evidence_is_checked_before_skip(self):
        row = next(row for row in module.ITEMS[('code-hosting', 'gitea')] if row[0] == 'gitea-milestone-schema-20261106')
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / 'open-rankings/code-hosting/evidence/gitea.json'
            target.parent.mkdir(parents=True)
            saved = json.dumps([{'id': row[0], 'excerpt': 'saved evidence'}])
            target.write_text(saved)
            with patch.multiple(module, ROOT=root, ITEMS={('code-hosting', 'gitea'): [row]}, REMOVALS={}, UPDATES={}), patch.object(module, 'fetch', return_value=(200, '{"Milestone": {}, "due_on": "unrelated"}')):
                with self.assertRaises(SystemExit):
                    module.main()
            self.assertEqual(target.read_text(), saved)

    def test_http_failure_rejected(self):
        with self.assertRaises(SystemExit):
            self.verify('{}', 503)


if __name__ == '__main__':
    unittest.main()
