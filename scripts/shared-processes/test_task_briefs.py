"""Isolated importer checks for authored catalog records and their generated receipts."""
import copy
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RECORDS = ROOT / "processes/records"


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def has_authored_guidance(record):
    def walk(parts):
        return any(part["guidance"] is not None
                   or any(walk(option["parts"]) for option in part["options"])
                   for part in parts)
    return record["guidance"] is not None or walk(record["parts"])


def authored_records():
    manifest = json.loads((ROOT / "processes/import-manifest.json").read_text())
    records = {record_id: json.loads((RECORDS / f"{record_id}.json").read_text())
               for record_id in manifest["records"]}
    # Guidance also identifies authored records if a receipt is accidentally re-blessed.
    return {record_id: record for record_id, record in records.items()
            if has_authored_guidance(record)
            or digest(record) != manifest["records"][record_id]["generatedHash"]}


class TaskBriefContentTests(unittest.TestCase):
    def check_briefs(self, records):
        # Validate the live catalog independently of the historical editorial snapshot.
        texts = {}

        def check(target, field, location):
            text = target[field]
            self.assertIsInstance(text, str, location)
            self.assertTrue(text.strip(), location)
            self.assertIsNone(re.search(r"\b(?:TODO|TBD|lorem ipsum)\b", text), location)
            normalized = re.sub(r"\s+", " ", text).strip()
            self.assertNotIn(normalized, texts, f"Duplicate brief: {location}, {texts.get(normalized)}")
            texts[normalized] = location
            links = [ref for ref in target["references"] if ref.get("role") == "authored-guidance-source"]
            urls = [ref["url"] for ref in links]
            self.assertEqual(len(urls), len(set(urls)), f"Duplicate source link: {location}")
            for ref in links:
                self.assertEqual(ref["kind"], "url", location)
                self.assertTrue(ref["url"].startswith("https://"), location)
                self.assertIsNone(ref.get("description"), location)

        def walk(parts, location):
            for part in parts:
                part_location = f"{location}/{part['id']}"
                check(part, "guidance", part_location)
                for option in part["options"]:
                    option_location = f"{part_location}/{option['id']}"
                    check(option, "summary", option_location)
                    walk(option["parts"], option_location)

        for record_id, record in records.items():
            walk(record["parts"], record_id)
        self.assertTrue(texts)

    def test_authored_briefs_are_complete_distinct_and_have_valid_source_links(self):
        records = authored_records()
        self.assertIn("form_001", records)
        self.check_briefs(records)

    def test_rejects_incomplete_duplicate_briefs_and_invalid_source_links(self):
        formation = json.loads((RECORDS / "form_001.json").read_text())
        for mutation in ("blank", "placeholder", "duplicate", "option_summary",
                         "duplicate_link", "source_kind", "source_url", "source_description"):
            with self.subTest(mutation=mutation):
                record = copy.deepcopy(formation)
                part = record["parts"][0]
                link = next(ref for ref in part["references"]
                            if ref.get("role") == "authored-guidance-source")
                if mutation == "blank":
                    part["guidance"] = " "
                elif mutation == "placeholder":
                    part["guidance"] = "TODO"
                elif mutation == "duplicate":
                    part["guidance"] = record["parts"][1]["guidance"]
                elif mutation == "option_summary":
                    part["options"][0]["summary"] = ""
                elif mutation == "duplicate_link":
                    part["references"].append(copy.deepcopy(link))
                elif mutation == "source_kind":
                    link["kind"] = "vendor"
                elif mutation == "source_url":
                    link["url"] = "http://example.invalid/source"
                else:
                    link["description"] = "Briefs belong in guidance."
                with self.assertRaises(AssertionError):
                    self.check_briefs({record["id"]: record})


class TaskBriefImportTests(unittest.TestCase):
    def test_formation_receipt_describes_generated_baseline(self):
        authored = json.loads((RECORDS / "form_001.json").read_text())
        manifest = json.loads((ROOT / "processes/import-manifest.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run([sys.executable, str(ROOT / "scripts/shared-processes/import.py"),
                            "--write", "--output", directory], check=True, capture_output=True)
            generated = json.loads((Path(directory) / "records/form_001.json").read_text())
        generated["source"]["revision"] = authored["source"]["revision"]
        receipt = manifest["records"]["form_001"]
        self.assertEqual(receipt["sourceHash"], generated["source"]["sha256"])
        self.assertEqual(receipt["generatedHash"], digest(generated))
        self.assertNotEqual(receipt["generatedHash"], digest(authored))

    def test_full_catalog_is_idempotent_and_all_authored_source_changes_conflict(self):
        authored_ids = set(authored_records())
        self.assertIn("form_001", authored_ids, "Authored-record conflict coverage must be nonempty")
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            shutil.copytree(ROOT / "scripts/shared-processes", work / "scripts/shared-processes")
            shutil.copytree(ROOT / "processes", work / "processes")
            def git(*args):
                subprocess.run(["git", *args], cwd=work, check=True, capture_output=True)

            def commit():
                git("add", "processes")
                git("-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                    "-c", "commit.gpgsign=false", "commit", "-qm", "Isolated importer fixture")

            def snapshot():
                return {str(p.relative_to(work)): hashlib.sha256(p.read_bytes()).hexdigest()
                        for p in (work / "processes").rglob("*.json")
                        if any(part in ("records", "examples") for part in p.relative_to(work / "processes").parts)
                        or p.name in ("import-manifest.json", "legacy-audit.json", "default-options-audit.json")}

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
                                ("processes/chains.json", "tagline")):
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
