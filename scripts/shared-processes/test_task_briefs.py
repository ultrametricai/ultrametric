"""Portable catalog preservation checks and isolated historical importer tests."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def load_checker(root=ROOT):
    spec = importlib.util.spec_from_file_location(
        "task_brief_check", ROOT / "scripts/shared-processes/check-task-briefs.py")
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    checker.ROOT = root
    checker.RECORDS = root / "content/processes/records"
    checker.AUDIT_DIR = root / "docs/catalog-task-briefs"
    return checker


def copy_canonical_fixture(root):
    shutil.copytree(ROOT / "content/processes", root / "content/processes")
    shutil.copytree(ROOT / "docs/catalog-task-briefs", root / "docs/catalog-task-briefs")


class TaskBriefPreservationTests(unittest.TestCase):
    def test_checker_needs_no_git_history_or_legacy_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copy_canonical_fixture(root)
            self.assertFalse((root / ".git").exists())
            self.assertFalse((root / "processes").exists())
            self.assertFalse((root / "journeys").exists())
            checker = load_checker(root)
            with patch.dict(os.environ, {"PATH": ""}), contextlib.redirect_stdout(io.StringIO()):
                checker.main()

    def test_audited_sources_match_added_links(self):
        checker = load_checker()
        source = {"url": "https://example.invalid/audited-source"}
        link = {"kind": "url", "url": source["url"], "title": "Audited source",
                "role": "authored-guidance-source", "description": None}
        legacy = {"kind": "url", "url": "https://example.invalid/legacy-source"}
        baseline = checker.reference_snapshot([legacy])
        checker.check_references(baseline, [legacy, link], "fixture", [source, legacy])
        for links in ([], [dict(link, url="https://example.invalid/unrelated-source")]):
            with self.subTest(links=links), self.assertRaisesRegex(AssertionError, "Source link mismatch"):
                checker.check_references(baseline, [legacy] + links, "fixture", [source])
        with self.assertRaisesRegex(AssertionError, "Duplicate source link"):
            checker.check_references(baseline, [legacy, link, link], "fixture", [source])
        with self.assertRaisesRegex(AssertionError, "Altered existing reference"):
            checker.check_references(baseline, [dict(legacy, title="Changed"), link], "fixture", [source])

    def test_rejects_changed_retained_copy_bindings_and_main_fields(self):
        for target in ("description", "provider", "government_metadata", "provenance", "graph", "situation"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                copy_canonical_fixture(root)
                checker = load_checker(root)
                path = checker.RECORDS / ("sit_001.json" if target == "situation" else "form_001.json")
                record = json.loads(path.read_text())
                if target == "description":
                    part = next(p for p in record["parts"] if p["id"] == "n3")
                    part["guidance"] += " Unreviewed change."
                    audit_path = checker.AUDIT_DIR / "audit.json"
                    audit = json.loads(audit_path.read_text())
                    item = next(i for i in audit["items"] if i["recordId"] == "form_001"
                                and i["partId"] == "n3" and i["field"] == "guidance")
                    item["contentHash"] = checker.digest(part["guidance"])
                    item["wordCount"] = len(part["guidance"].split())
                    audit_path.write_text(json.dumps(audit))
                    error = "Preserved brief changed"
                elif target == "provider":
                    part = next(p for p in record["parts"] if p["id"] == "n8")
                    part["metadata"]["previewBriefs"][0]["guidance"] += " Unreviewed change."
                    error = "previewBriefs"
                elif target == "government_metadata":
                    part = next(p for p in record["parts"] if p["id"] == "n8")
                    part["metadata"]["verify"]["how"] = "Reverted government-source correction."
                    error = "Change outside authored fields"
                elif target == "provenance":
                    record["source"]["revision"] = "changed"
                    error = "Change outside authored fields"
                elif target == "graph":
                    record["links"] = []
                    error = "Change outside authored fields"
                else:
                    record["summary"] += " Changed situation."
                    error = "Excluded situation changed"
                path.write_text(json.dumps(record))
                with self.assertRaisesRegex(AssertionError, error):
                    checker.main()


class TaskBriefImportTests(unittest.TestCase):
    def test_formation_receipt_describes_generated_baseline(self):
        checker = load_checker()
        authored = json.loads((checker.RECORDS / "form_001.json").read_text())
        manifest = json.loads((ROOT / "content/processes/import-manifest.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run([sys.executable, str(ROOT / "scripts/shared-processes/import.py"),
                            "--write", "--output", directory], check=True, capture_output=True)
            generated = json.loads((Path(directory) / "records/form_001.json").read_text())
        generated["source"]["revision"] = authored["source"]["revision"]
        receipt = manifest["records"]["form_001"]
        self.assertEqual(receipt["sourceHash"], generated["source"]["sha256"])
        self.assertEqual(receipt["generatedHash"], checker.digest(generated))
        self.assertNotEqual(receipt["generatedHash"], checker.digest(authored))

    def test_full_catalog_is_idempotent_and_all_authored_source_changes_conflict(self):
        audit = json.loads((ROOT / "docs/catalog-task-briefs/audit.json").read_text())
        authored_ids = {i["recordId"] for i in audit["items"]}
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            shutil.copytree(ROOT / "scripts/shared-processes", work / "scripts/shared-processes")
            shutil.copytree(ROOT / "content/processes", work / "content/processes")
            for name in ("processes/corpus.json", "processes/vendor-registry.json", "journeys/chains.json"):
                dest = work / name
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, dest)
            shutil.copytree(ROOT / "processes/equity", work / "processes/equity")

            def git(*args):
                subprocess.run(["git", *args], cwd=work, check=True, capture_output=True)

            def commit():
                git("add", "processes", "journeys")
                git("-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                    "-c", "commit.gpgsign=false", "commit", "-qm", "Isolated importer fixture")

            def snapshot():
                return {str(p.relative_to(work)): hashlib.sha256(p.read_bytes()).hexdigest()
                        for p in (work / "content/processes").rglob("*.json")}

            def run_import():
                return subprocess.run([sys.executable, str(work / "scripts/shared-processes/import.py"),
                                       "--write"], cwd=work, capture_output=True, text=True)

            git("init", "-q")
            commit()
            before = snapshot()
            for _ in range(2):
                result = run_import()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(result.stdout)["changedRecords"], [])
                self.assertEqual(snapshot(), before, "Unchanged-source import changed catalog bytes")

            # Commit independent source edits for every authored record, including
            # chain references and equity workflows, without editing the catalog.
            for name, field in (("processes/corpus.json", "description"),
                                ("journeys/chains.json", "tagline")):
                path = work / name
                records = json.loads(path.read_text())
                for record in records:
                    if record["id"] in authored_ids:
                        record[field] += " Synthetic source change for conflict protection."
                path.write_text(json.dumps(records))
            for path in (work / "processes/equity").rglob("*.json"):
                record = json.loads(path.read_text())
                if record["id"] in authored_ids:
                    record["summary"] += " Synthetic source change for conflict protection."
                    path.write_text(json.dumps(record))
            commit()
            result = run_import()
            self.assertNotEqual(result.returncode, 0, "Source changes silently replaced authored content")
            report = json.loads(result.stderr)
            self.assertEqual(set(report["editedRecordsWithSourceChanges"]), authored_ids)
            self.assertEqual(snapshot(), before, "Conflict wrote part of the catalog")


if __name__ == "__main__":
    unittest.main()
