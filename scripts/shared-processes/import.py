import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
import claim_audit
from source_snapshot import read_snapshot

parser = argparse.ArgumentParser()
parser.add_argument("--write", action="store_true")
parser.add_argument("--output", type=Path, help="Destination catalog directory; defaults to processes.")
args = parser.parse_args()
SOURCE = Path(__file__).resolve().parents[2]
ROOT = args.output.resolve() if args.output else SOURCE / "processes"
REVISION, SOURCE_FILES = read_snapshot(SOURCE)
TRACE = []
ISSUES = []


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def issue(record, code, detail):
    ISSUES.append({"record": record, "code": code, "detail": detail})


class Move:
    def __init__(self, source, source_path, target_path):
        self.left = copy.deepcopy(source)
        self.source_path = source_path
        self.target_path = target_path

    def take(self, key, target, default=None, note="Copied without changing its claim."):
        if key not in self.left:
            return default
        value = self.left.pop(key)
        if key in ("description", "summary"):
            claim_audit.add(self.source_path, key, value)
        TRACE.append({"from": f"{self.source_path}.{key}", "to": f"{self.target_path}.{target}", "note": note})
        return value

    def metadata(self):
        for key in list(self.left):
            if key in claim_audit.REASONS:
                claim_audit.add(self.source_path, key, self.left[key])
            if key in claim_audit.QUARANTINE:
                self.left.pop(key)
                TRACE.append({"from": f"{self.source_path}.{key}", "to": "claim-audit.json (audit only)", "note": "Excluded from candidate instructions; resolve through verified documentation."})
        for key in self.left:
            TRACE.append({"from": f"{self.source_path}.{key}", "to": f"{self.target_path}.metadata.{key}", "note": "Preserved during transition; not promoted into new reasoning rules."})
        return self.left


REF_RULES = {
    "vendors": ("vendor", "involves"),
    "vendor": ("vendor", "stated-vendor"),
    "vendorOptions": ("vendor", "candidate"),
    "optionsArenaId": ("category", "rankings"),
    "extraOptionArenas": ("category", "additional-rankings"),
    "extraOptionRefs": ("product", "additional-candidate"),
    "rule_ids": ("rule", "evidence"),
}


def references(move):
    result = []
    for field, (kind, role) in REF_RULES.items():
        if field not in move.left:
            continue
        values = move.take(field, "references", note=f"Reference by ID; preserve role '{role}'. No endorsement inferred.")
        if not isinstance(values, list):
            values = [values]
        for value in values:
            identifier = value if isinstance(value, str) else f"{value['arenaId']}/{value['productId']}"
            result.append({"kind": kind, "id": identifier, "role": role})
    for field, role in [("actionUrl", "legacy-action-link"), ("signupUrl", "legacy-signup-link")]:
        if field not in move.left:
            continue
        url = move.take(field, "references[url].url", note="Preserve as a typed web link; do not infer it performs the action.")
        title = move.take("actionLabel", "references[url].title") if field == "actionUrl" else None
        result.append({"kind": "url", "url": url, "role": role, "title": title, "description": None})
        claim_audit.add(move.source_path, field, url, "reference_needs_review", "Title and expected content need review against the destination. A valid or reachable URL is not proof an action can be completed there.")
    return result


def part(value, source_path, target_path, record, workflow=False):
    m = Move(value, source_path, target_path)
    result = {
        "id": m.take("id", "id"),
        "kind": "step",
        "title": m.take("action" if workflow else "label", "title"),
        "guidance": None,
        "when": None,
        "ref": m.take("processRef", "ref"),
        "options": [],
        "notes": [],
        "references": references(m),
    }
    if result["ref"] is not None:
        original = result["ref"]
        result["ref"] = SLUGS.get(original, original)
        result["kind"] = "reference"
        if original not in SLUGS:
            issue(record, "unresolved_process_reference", original)
    methods = m.take("methods", "options", [])
    for method in methods:
        child_source = f"{source_path}.methods[{method['id']}]"
        child_target = f"{target_path}.options[{method['id']}]"
        mm = Move(method, child_source, child_target)
        context = mm.take("context", "metadata.context", note="Preserve kind/countries; move the when text to option.when.")
        TRACE.append({"from": f"{child_source}.context.when", "to": f"{child_target}.when", "note": "Copy applicability prose; do not turn it into executable code."})
        context = copy.deepcopy(context)
        condition = context.pop("when")
        claim_audit.add(f"{child_source}.context", "when", condition)
        option = {
            "id": mm.take("id", "id"),
            "title": mm.take("label", "title"),
            "summary": mm.take("summary", "summary"),
            "when": condition,
            "parts": [],
            "notes": [],
            "references": references(mm),
        }
        substeps = mm.take("subSteps", "parts", [])
        option["parts"] = [part(s, f"{child_source}.subSteps[{s['id']}]", f"{child_target}.parts[{s['id']}]", record) for s in substeps]
        option["metadata"] = mm.metadata()
        option["metadata"]["context"] = context
        result["options"].append(option)
    result["metadata"] = m.metadata()
    if methods:
        if result["kind"] != "step":
            raise ValueError(f"{source_path}: method-bearing references need an authored base option")
        if any(option["id"] == "default" for option in result["options"]):
            raise ValueError(f"{source_path}: legacy method ID collides with explicit default")
        # The old renderer supplied an implicit default from the node itself. Preserve that
        # choice in the source graph, rather than treating its fields as common to all methods.
        # Labels come only from existing source text; no country/applicability is inferred.
        base_label = value.get("actionLabel") if value.get("actionUrl") else None
        default = {
            "id": "default",
            "title": "Default — " + (base_label or result["title"]),
            "summary": result["title"] if base_label else "",
            "when": None,
            "parts": [],
            "notes": [],
            "references": result["references"],
            "metadata": result["metadata"],
        }
        result["kind"] = "decision"
        result["references"] = []
        result["metadata"] = {}
        result["options"].insert(0, default)
        for trace in TRACE:
            for field in ("references", "metadata"):
                prefix = f"{target_path}.{field}"
                if trace["to"] == prefix or trace["to"].startswith(prefix + ".") or trace["to"].startswith(prefix + "["):
                    trace["to"] = trace["to"].replace(prefix, f"{target_path}.options[default].{field}", 1)
        TRACE.append({"from": f"{source_path}.label", "to": f"{target_path}.options[default]", "note": "Materialize the legacy renderer's base method from its preserved label, action label, references and annotations. No conditions or edges added."})
        issue(record, "implicit_default_made_explicit", f"Part {result['id']}: base-method fields live in option default; alternative IDs and graph connections are unchanged.")
        if any(option["metadata"].get("context", {}).get("kind") == "geo" for option in result["options"][1:]):
            issue(record, "geographic_downstream_unresolved", f"Part {result['id']}: geographic alternatives exist but the source has no option-specific downstream connections. Existing connections are preserved, not asserted applicable to every alternative.")
    if result["metadata"].get("jurisdictions"):
        issue(record, "jurisdiction_flag_needs_guidance", f"Part {result['id']}: preserve the source flags; applicability prose is not invented.")
    return result


def record_base(value, path, record_id, summary):
    return {
        "schemaVersion": 1,
        "id": record_id,
        "kind": "process",
        "title": value.get("title", value.get("name")),
        "summary": summary,
        "outcomes": [],
        "guidance": None,
        "parts": [],
        "links": [],
        "references": [],
        "notes": [],
        "metadata": {},
        "source": {"path": path, "id": value["id"], "revision": REVISION, "sha256": digest(value)},
    }


def operational(value):
    path = "processes/corpus.json"
    key = value["id"]
    r = record_base(value, path, key, value["description"])
    m = Move(value, f"operational[{key}]", f"records[{key}]")
    for field, target in [("id", "id"), ("title", "title"), ("description", "summary")]:
        m.take(field, target)
    r["references"] = references(m)
    graph = m.take("dag", "parts + links")
    if "edges" in graph:
        claim_audit.add(f"operational[{key}].dag", "edges", graph["edges"])
    r["parts"] = [part(n, f"operational[{key}].dag.nodes[{n['id']}]", f"records[{key}].parts[{n['id']}]", key) for n in graph["nodes"]]
    r["links"] = [{"from": e["from"], "to": e["to"], "when": None} for e in graph.get("edges", [])]
    r["metadata"] = m.metadata()
    issue(key, "outcome_not_explicit", "No explicit outcome in the source schema; no outcome inferred from title or last step.")
    issue(key, "guidance_not_authored", "Labels and call descriptions are preserved; they are not a finished agent guide.")
    return r


def chain(value):
    key = value["id"]
    r = record_base(value, "processes/chains.json", key, value["tagline"])
    m = Move(value, f"chain[{key}]", f"records[{key}]")
    for field, target in [("id", "id"), ("name", "title"), ("tagline", "summary")]:
        m.take(field, target)
    task_ids = m.take("taskIds", "parts[].ref", note="Reference existing processes in source order; do not invent dependency edges.")
    r["parts"] = [{"id": f"part-{i + 1}", "kind": "reference", "title": TITLES.get(task), "guidance": None, "when": None, "ref": task, "options": [], "notes": [], "references": [], "metadata": {}} for i, task in enumerate(task_ids)]
    r["metadata"] = m.metadata()
    issue(key, "composition_kind_needs_review", "Imported as a process composition. A chain is not automatically a user situation.")
    issue(key, "composition_order_not_dependency", "The source records a list; ordering has not been strengthened into required dependencies.")
    issue(key, "outcome_not_explicit", "The chain tagline is preserved as summary, not asserted as a completion contract.")
    return r


def workflow(value, path):
    key = value["id"]
    r = record_base(value, path, key, value["summary"])
    m = Move(value, f"workflow[{key}]", f"records[{key}]")
    for field in ["id", "title", "summary"]:
        m.take(field, field)
    r["outcomes"] = m.take("outputs", "outcomes")
    r["references"] = references(m)
    steps = m.take("steps", "parts")
    r["parts"] = [part(s, f"workflow[{key}].steps[{s['id']}]", f"records[{key}].parts[{s['id']}]", key, workflow=True) for s in steps]
    if value.get("decisions"):
        issue(key, "decision_placement_unknown", "Source decisions have no explicit graph placement/options. Preserve them in metadata.decisions until their locations in the process are authored; do not invent placement or a second active decision list.")
    r["metadata"] = m.metadata()
    issue(key, "workflow_conditions_preserved", "Applicability, review/maturity, authority and stop conditions remain in metadata pending a dedicated presentation; do not claim automated execution.")
    return r


corpus = SOURCE_FILES["processes/corpus.json"]
chains = SOURCE_FILES["processes/chains.json"]
registry = SOURCE_FILES["processes/vendor-registry.json"]
def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
TITLES = {p["id"]: p["title"] for p in corpus}
SLUGS = {slug(p["title"]): p["id"] for p in corpus}
SLUGS.update({a["slug"]: p["id"] for p in corpus for a in p.get("slugAliases", [])})
records = [operational(p) for p in corpus] + [chain(c) for c in chains]
for path, value in SOURCE_FILES.items():
    if path.startswith("processes/equity/"):
        records.append(workflow(value, path))
def check_vendor_refs(value, record_id):
    if isinstance(value, dict):
        for ref in value.get("references", []):
            if ref.get("kind") == "vendor" and ref["id"] not in registry["vendors"]:
                issue(record_id, "vendor_missing_from_registry", ref["id"])
        for child in value.values():
            check_vendor_refs(child, record_id)
    elif isinstance(value, list):
        for child in value:
            check_vendor_refs(child, record_id)
for record in records:
    check_vendor_refs(record, record["id"])
if len({r["id"] for r in records}) != len(records):
    raise ValueError("Duplicate record ID")
manifest_path = ROOT / "import-manifest.json"
previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"records": {}}
changes = []
conflicts = []
pending = {}
manifest = {"records": {}, "vendorRegistryHash": digest(registry)}
for record in records:
    key = record["id"]
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._-]*", key):
        raise ValueError("Invalid record ID")
    target = ROOT / "records" / (key + ".json")
    prior = previous["records"].get(key)
    existing = json.loads(target.read_text()) if target.exists() else None
    source_hash = record["source"]["sha256"]
    if prior and prior["sourceHash"] == source_hash and existing is not None:
        manifest["records"][key] = prior
        continue
    if existing is not None and (prior is None or digest(existing) != prior["generatedHash"]):
        conflicts.append(key)
        continue
    changes.append(key)
    pending[target] = record
    manifest["records"][key] = {"sourceHash": source_hash, "generatedHash": digest(record)}
removed = sorted(set(previous["records"]) - {r["id"] for r in records})
if conflicts or removed:
    raise SystemExit(json.dumps({"editedRecordsWithSourceChanges": conflicts, "removedSources": removed, "action": "Reconcile source changes with authored records; no files written."}))
changed_registry = previous.get("vendorRegistryHash") != manifest["vendorRegistryHash"]
report = {"mappedRecords": len(records), "sourceNodes": sum(len(p["dag"]["nodes"]) for p in corpus), "sourceEdges": sum(len(p["dag"].get("edges", [])) for p in corpus), "changedRecords": changes, "vendorRegistryChanged": changed_registry, "issues": ISSUES}
if not args.write:
    print(json.dumps({k:v for k,v in report.items() if k != "issues"}, indent=2))
    raise SystemExit(1 if changes or changed_registry else 0)
def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
for target, record in pending.items():
    save(target, record)
save(manifest_path, manifest)
save(ROOT / "legacy-audit.json", {"claims": claim_audit.ENTRIES, "issues": ISSUES, "mapping": TRACE, "vendorRegistryHash": digest(registry), "scope": "Source preservation, not factual verification. Metadata is temporary migration data."})
print(json.dumps({k:v for k,v in report.items() if k != "issues"}, indent=2))
