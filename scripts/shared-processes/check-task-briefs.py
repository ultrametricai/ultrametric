"""Check catalog descriptions against a portable, committed preservation snapshot.

This check reads canonical records and audit fixtures only. It requires neither
Git history nor legacy process inputs. The baseline records which fields this
bounded editorial change was permitted to alter; it is not a second catalog.
"""
import collections
import copy
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RECORDS = ROOT / "content/processes/records"
AUDIT_DIR = ROOT / "docs/catalog-task-briefs"


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def slots(record):
    result = {}

    def walk(parts, parents):
        for part in parts:
            result[(record["id"], parents, part["id"], "", "guidance")] = part
            for option in part["options"]:
                result[(record["id"], parents, part["id"], option["id"], "summary")] = option
                walk(option["parts"], parents + ((part["id"], option["id"]),))

    walk(record["parts"], ())
    return result


def item_key(item):
    parents = tuple((p["partId"], p["optionId"]) for p in item["parentOptionPath"])
    return (item["recordId"], parents, item["partId"], item.get("optionId", ""), item["field"])


def reference_snapshot(references):
    return {"count": len(references), "hash": digest(references),
            "urls": sorted({ref["url"] for ref in references if ref["kind"] == "url"})}


def invariant_hash(record):
    """Hash every field except the explicitly reviewed editorial fields."""
    normalized = copy.deepcopy(record)
    for key, target in slots(normalized).items():
        target[key[-1]] = None
        target["references"] = []  # Original prefix and added citations checked separately.
        if record["id"] == "form_001" and key[-1] == "guidance":
            for name in ("previewContext", "previewBriefs"):
                target["metadata"].pop(name, None)  # Checked against the retained bindings.
    return digest(normalized)


def check_references(baseline, references, key, sources):
    count = baseline["count"]
    assert digest(references[:count]) == baseline["hash"], f"Altered existing reference: {key}"
    added = references[count:]
    for ref in added:
        assert ref["kind"] == "url", f"Added non-source reference: {key}"
        assert ref["role"] == "authored-guidance-source", key
        assert ref["url"].startswith("https://"), key
        assert ref.get("description") is None, key
    expected_urls = {source["url"] for source in sources} - set(baseline["urls"])
    added_urls = [ref["url"] for ref in added]
    assert len(added_urls) == len(set(added_urls)), f"Duplicate source link: {key}"
    assert set(added_urls) == expected_urls, f"Source link mismatch: {key}"


def main():
    audit = json.loads((AUDIT_DIR / "audit.json").read_text())
    baseline = json.loads((AUDIT_DIR / "preservation-baseline.json").read_text())
    assert baseline["version"] == 2, "Unsupported preservation fixture"
    assert audit["baseCommit"] == baseline["baseCommit"], "Audit baseline differs"
    paths = {p.stem: p for p in RECORDS.glob("*.json")}
    current = {rid: json.loads(p.read_text()) for rid, p in paths.items()}
    target_ids = set(baseline["recordInvariantHashes"])
    excluded = set(baseline["excludedRecordByteHashes"])
    assert not target_ids & excluded, "Overlapping process/situation scope"
    assert set(current) == target_ids | excluded, "Record added or removed"
    assert all(rid == record["id"] for rid, record in current.items()), "Record filename/id mismatch"
    for rid in excluded:
        assert hashlib.sha256(paths[rid].read_bytes()).hexdigest() == baseline["excludedRecordByteHashes"][rid], (
            f"Excluded situation changed: {rid}")

    new_slots = {key: value for rid in target_ids for key, value in slots(current[rid]).items()}
    audited = {item_key(i): i for i in audit["items"]}
    frozen = {item_key(i): i for i in baseline["slots"]}
    preserved = {item_key(i): i for i in baseline["items"]}
    assert len(audited) == len(audit["items"]), "Duplicate audit target"
    assert len(frozen) == len(baseline["slots"]), "Duplicate baseline target"
    assert len(preserved) == len(baseline["items"]), "Duplicate preserved target"
    assert set(audited) == set(new_slots) == set(frozen), "Missing/extra target"
    assert set(preserved) == {key for key, item in audited.items() if item["status"] == "preserved"}, (
        "Preserved target set changed")

    texts = collections.defaultdict(list)
    statuses = collections.Counter()
    for key, entry in audited.items():
        target = new_slots[key]
        text = target[key[-1]]
        assert isinstance(text, str) and text.strip(), f"Empty brief: {key}"
        assert entry["contentHash"] == digest(text), f"Audit prose mismatch: {key}"
        assert entry["previousContentHash"] == frozen[key]["previousContentHash"], key
        assert entry["wordCount"] == len(text.split()), key
        assert entry["status"] in {"authored", "preserved", "needs_review"}, key
        assert bool(entry["reviewGaps"]) == (entry["status"] == "needs_review"), key
        assert all(isinstance(gap, str) and len(gap) > 10 for gap in entry["reviewGaps"]), key
        if entry["status"] == "preserved":
            assert digest(text) == preserved[key]["contentHash"], f"Preserved brief changed: {key}"
        assert not re.search(r"\b(?:TODO|TBD|lorem ipsum)\b", text), key
        check_references(frozen[key]["references"], target["references"], key, entry["sources"])
        if key[0] == "form_001" and key[-1] == "guidance":
            for name in ("previewContext", "previewBriefs"):
                expected = baseline["incorporationMetadata"].get(key[2], {}).get(name)
                assert target["metadata"].get(name) == expected, (key, name)
        texts[re.sub(r"\s+", " ", text).strip()].append(key)
        statuses[entry["status"]] += 1

    duplicates = [keys for keys in texts.values() if len(keys) > 1]
    assert not duplicates, f"Duplicate descriptions: {duplicates}"
    for rid in target_ids:
        assert invariant_hash(current[rid]) == baseline["recordInvariantHashes"][rid], (
            f"Change outside authored fields: {rid}")

    manifest = json.loads((ROOT / "content/processes/import-manifest.json").read_text())
    assert digest(manifest) == baseline["importManifestHash"], "Importer manifest changed"
    for rid in target_ids:
        assert digest(current[rid]) != manifest["records"][rid]["generatedHash"], (
            f"Authored record could be mistaken for generated output: {rid}")
    counts = {"processRecords": len(target_ids), "excludedSituations": len(excluded),
              "parts": sum(k[-1] == "guidance" for k in audited),
              "options": sum(k[-1] == "summary" for k in audited),
              "slots": len(audited), "statuses": dict(statuses),
              "duplicateBriefs": len(duplicates), "preservedGraphAndMetadata": True,
              "allAuthoredRecordsProtectedByImportManifest": True}
    assert counts == audit["validation"], "Audit aggregate drift"
    print(json.dumps(counts, indent=2))


if __name__ == "__main__":
    main()
