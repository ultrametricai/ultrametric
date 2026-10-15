"""Content checks for the canonical catalog and recursively authored briefs."""
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
RECORDS = ROOT / "open-processes"
# Preserve the reviewed authored membership independently of the guidance under test.
# sit_012 was authored after the preservation snapshot.
AUTHORED_IDS = set(json.loads((ROOT / "docs/catalog-task-briefs/preservation-baseline.json").read_text())["recordInvariantHashes"]) | {"sit_012"}


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def authored_records(directory=RECORDS):
    records = [json.loads(p.read_text()) for p in directory.glob("*.json")]
    by_id = {r["id"]: r for r in records if isinstance(r, dict)
             and r.get("schemaVersion") == 1 and "parts" in r}
    return {record_id: by_id[record_id] for record_id in sorted(AUTHORED_IDS)}


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
        self.assertEqual(set(records), AUTHORED_IDS)
        self.check_briefs(records)

    def test_rejects_loss_of_every_guidance_field_on_an_authored_record(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / "open-processes"
            shutil.copytree(RECORDS, directory)
            record = authored_records(directory)["form_001"]

            def clear(parts):
                for part in parts:
                    part["guidance"] = None
                    for option in part["options"]:
                        clear(option["parts"])

            record["guidance"] = None
            clear(record["parts"])
            file = next(p for p in directory.glob("*.json")
                        if isinstance(value := json.loads(p.read_text()), dict)
                        and value.get("id") == record["id"])
            file.write_text(json.dumps(record))
            records = authored_records(directory)
            self.assertIn("form_001", records)
            with self.assertRaises(AssertionError):
                self.check_briefs(records)

    def test_rejects_incomplete_duplicate_briefs_and_invalid_source_links(self):
        formation = authored_records()["form_001"]
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


if __name__ == '__main__':
    unittest.main()
