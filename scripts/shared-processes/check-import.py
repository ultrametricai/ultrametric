import copy
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from source_snapshot import read_snapshot
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
revision, sources = read_snapshot(ROOT)
with tempfile.TemporaryDirectory() as temporary:
    output = Path(temporary)
    subprocess.run([sys.executable, str(ROOT / "scripts/shared-processes/import.py"), "--write", "--output", str(output)], check=True, stdout=subprocess.DEVNULL)
    records = [json.loads(p.read_text()) for p in sorted((output / "records").glob("*.json"))]
    audit = json.loads((output / "legacy-audit.json").read_text())["claims"]
by_id = {r["id"]: r for r in records}
corpus = sources["open-processes/corpus.json"]
chains = sources["open-processes/chains.json"]
slugs = {re.sub(r"[^a-z0-9]+", "-", p["title"].lower()).strip("-"): p["id"] for p in corpus}
slugs.update({a["slug"]: p["id"] for p in corpus for a in p.get("slugAliases", [])})
checks = 0
quarantined = {"toolCall", "functionCalls"}


def equal(actual, expected, label):
    global checks
    checks += 1
    assert actual == expected, label


def check_refs(raw, target, label):
    fields = {
        "vendors": ("vendor", "involves"),
        "vendor": ("vendor", "stated-vendor"),
        "vendorOptions": ("vendor", "candidate"),
        "optionsArenaId": ("category", "rankings"),
        "extraOptionArenas": ("category", "additional-rankings"),
        "extraOptionRefs": ("product", "additional-candidate"),
        "rule_ids": ("rule", "evidence"),
    }
    for field, (kind, role) in fields.items():
        matches = [x for x in target["references"] if x["kind"] == kind and x["role"] == role]
        expected = raw.get(field, [])
        if not isinstance(expected, list):
            expected = [expected]
        actual = [x["id"] for x in matches]
        if field == "extraOptionRefs":
            actual = [{"arenaId": x.split("/", 1)[0], "productId": x.split("/", 1)[1]} for x in actual]
        equal(actual, expected, f"{label}.{field}")
    for field, role in [("actionUrl", "legacy-action-link"), ("signupUrl", "legacy-signup-link")]:
        actual = [x for x in target["references"] if x["kind"] == "url" and x["role"] == role]
        equal([x["url"] for x in actual], [raw[field]] if field in raw else [], f"{label}.{field}")
        if actual:
            equal("reviewStatus" in actual[0], False, f"{label}.{field}.noReviewWorkflow")
            equal(actual[0]["description"], None, f"{label}.{field}.noInventedContent")
            equal(actual[0]["title"], raw.get("actionLabel") if field == "actionUrl" else None, f"{label}.{field}.title")
    return set(fields) | {"actionUrl", "signupUrl"} | ({"actionLabel"} if "actionUrl" in raw else set())


def check_part(raw, target, label, workflow=False):
    equal(target["id"], raw["id"], label + ".id")
    title = "action" if workflow else "label"
    equal(target["title"], raw[title], label + "." + title)
    methods = raw.get("methods", [])
    base = target["options"][0] if methods else target
    alternatives = target["options"][1:] if methods else target["options"]
    if methods:
        equal(target["kind"], "decision", label + ".decision")
        equal(base["id"], "default", label + ".explicitDefault")
        base_label = raw.get("actionLabel") if raw.get("actionUrl") else None
        equal(base["title"], "Default — " + (base_label or raw[title]), label + ".default.title")
        equal(base["summary"], raw[title] if base_label else "", label + ".default.summary")
        equal(base["when"], None, label + ".noInventedDefaultCondition")
        equal(base["parts"], [], label + ".noInventedDefaultParts")
        equal(base.get("links", []), [], label + ".noInventedDefaultEdges")
        equal(target["references"], [], label + ".noDefaultReferencesOnDecision")
        equal(target["metadata"], {}, label + ".noDefaultAnnotationsOnDecision")
    moved = {"id", title, "methods", "processRef"} | quarantined | check_refs(raw, base, label)
    equal(target["ref"], slugs.get(raw.get("processRef"), raw.get("processRef")), label + ".processRef")
    equal(base["metadata"], {k: v for k, v in raw.items() if k not in moved}, label + ".metadata")
    equal(len(alternatives), len(methods), label + ".methods.count")
    for method, option in zip(methods, alternatives):
        at = label + ".methods." + method["id"]
        equal(option["id"], method["id"], at + ".id")
        equal(option["title"], method["label"], at + ".label")
        equal(option["summary"], method["summary"], at + ".summary")
        equal(option["when"], method["context"]["when"], at + ".context.when")
        moved_method = {"id", "label", "summary", "subSteps", "context"} | quarantined | check_refs(method, option, at)
        remainder = {k: v for k, v in method.items() if k not in moved_method}
        remainder["context"] = {k: v for k, v in method["context"].items() if k != "when"}
        equal(option["metadata"], remainder, at + ".metadata")
        equal(len(option["parts"]), len(method.get("subSteps", [])), at + ".subSteps.count")
        for before, after in zip(method.get("subSteps", []), option["parts"]):
            check_part(before, after, at + "." + before["id"])


for record in records:
    equal(record["source"]["revision"], revision, record["id"] + ".sourceRevision")

for raw in corpus:
    r = by_id[raw["id"]]
    equal(r["source"]["sha256"], hashlib.sha256(json.dumps(raw, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest(), raw["id"] + ".sourceHash")
    for a, b in [("id", "id"), ("title", "title"), ("description", "summary")]:
        equal(r[b], raw[a], raw["id"] + "." + a)
    moved = {"id", "title", "description", "dag"} | check_refs(raw, r, raw["id"])
    equal(r["metadata"], {k: v for k, v in raw.items() if k not in moved}, raw["id"] + ".metadata")
    equal(set(raw["dag"]) - {"nodes", "edges"}, set(), raw["id"] + ".dag.extraFields")
    equal([{"from": e["from"], "to": e["to"]} for e in r["links"]], raw["dag"].get("edges", []), raw["id"] + ".edges")
    equal(len(r["parts"]), len(raw["dag"]["nodes"]), raw["id"] + ".nodes.count")
    for before, after in zip(raw["dag"]["nodes"], r["parts"]):
        check_part(before, after, raw["id"] + "." + before["id"])

for raw in chains:
    r = by_id[raw["id"]]
    equal(r["source"]["sha256"], hashlib.sha256(json.dumps(raw, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest(), raw["id"] + ".sourceHash")
    equal(r["title"], raw["name"], raw["id"] + ".name")
    equal(r["summary"], raw["tagline"], raw["id"] + ".tagline")
    equal([p["ref"] for p in r["parts"]], raw["taskIds"], raw["id"] + ".taskIds")
    equal(r["links"], [], raw["id"] + ".noInventedDependencies")
    equal(r["metadata"], {k: v for k, v in raw.items() if k not in {"id", "name", "tagline", "taskIds"}}, raw["id"] + ".metadata")

for path, raw in sources.items():
    if not path.startswith("open-processes/equity/"):
        continue
    r = by_id[raw["id"]]
    equal(r["source"]["sha256"], hashlib.sha256(json.dumps(raw, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest(), raw["id"] + ".sourceHash")
    for field in ("id", "title", "summary"):
        equal(r[field], raw[field], raw["id"] + "." + field)
    equal(r["outcomes"], raw["outputs"], raw["id"] + ".outputs")
    check_refs(raw, r, raw["id"])
    for before, after in zip(raw["steps"], r["parts"]):
        check_part(before, after, raw["id"] + "." + before["id"], workflow=True)
    equal(len(r["parts"]), len(raw["steps"]), raw["id"] + ".steps.count")
    equal(r["metadata"]["decisions"], raw["decisions"], raw["id"] + ".decisionsPreservedPendingPlacement")
    equal(r["metadata"], {k: v for k, v in raw.items() if k not in {"id", "title", "summary", "steps", "outputs", "rule_ids"}}, raw["id"] + ".metadata")

equal(all(r["notes"] == [] for r in records), True, "No invented notes or UM opinions")
equal(all(not ({"reviewStatus", "umTake", "decisions"} & set(r)) for r in records), True, "No review workflow, rigid opinion field, or second active decision list")
equal(all("relation" not in link for r in records for link in r["links"]), True, "No redundant flow label")
# journeys/chains.json is the recorded import provenance of chain records authored before
# the file moved to open-processes/chains.json; both spellings stay covered.
equal(all(not r["outcomes"] for r in records if r["source"]["path"] in ("open-processes/corpus.json", "open-processes/chains.json", "journeys/chains.json")), True, "No invented outcomes")

from collections import Counter
expected_claims = []
def find_quarantined(value, record):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in quarantined:
                expected_claims.append((record, key, json.dumps(item, sort_keys=True)))
            find_quarantined(item, record)
    elif isinstance(value, list):
        for item in value:
            find_quarantined(item, record)
for raw in corpus:
    find_quarantined(raw, raw["id"])
actual_claims = [(x["record"], x["field"], json.dumps(x["value"], sort_keys=True)) for x in audit if x["disposition"] == "audit_only"]
equal(Counter(actual_claims), Counter(expected_claims), "Quarantined source values preserved in separate audit")
for r in records:
    def reject_operations(value):
        if isinstance(value, dict):
            assert not (set(value) & quarantined), "Unverified operation in candidate"
            for child in value.values(): reject_operations(child)
        elif isinstance(value, list):
            for child in value: reject_operations(child)
    reject_operations(r)

positive_checks = checks
mutated = copy.deepcopy(by_id[corpus[0]["id"]]["parts"][0])
timing_metadata = next((option["metadata"] for option in mutated["options"] if option["id"] == "default"), mutated["metadata"])
timing_metadata["estimatedMinutes"] += 1
try:
    check_part(corpus[0]["dag"]["nodes"][0], mutated, "negative changed timing")
except AssertionError:
    negative = "changed source value rejected"
else:
    raise AssertionError("Value-preservation check failed to detect a changed estimate")

out = {"records": len(records), "valueChecks": positive_checks, "negativeCheck": negative, "scope": "Fresh migration output checked against committed legacy sources. Authored catalog records are not modified or compared to the baseline."}

print(json.dumps(out, indent=2))
