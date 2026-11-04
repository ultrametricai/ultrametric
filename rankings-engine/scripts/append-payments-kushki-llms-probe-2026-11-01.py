#!/usr/bin/env python3
# Accuracy queue 2026-10-28 (issue #508): payments/kushki llms.txt flip.
#
# The 2026-10-28 staleness scan found https://docs.kushki.com/llms.txt answering HTTP 200
# while the kushki agentic-agent-docs verdict was a none recorded against the 2026-10-28
# probe rows (llms.txt 404 at the retired /cl/en docs tree). Kushki moved its docs from
# docs.kushki.com/cl/en/* to docs.kushki.com/cl/* (the /cl/en tree 404s live, verified
# 2026-11-01) and now publishes an llms.txt docs index at the docs origin.
#
# The engine probe stage re-records the positive under the same ids it used at the
# baseline (kushki-probe-1..3), and the churn rule (settle-churn-vs-ref.py, the
# check-refresh-stability.mjs upgrade rule) only lets an upgrade stand when it cites an
# evidence id that did not exist at the baseline ref. This script mints that id: a
# preserved, dated manual probe row recording the live llms.txt check, per the
# append-*-runtime-probes precedent. Run AFTER `pnpm engine probe --category payments
# --product kushki`; re-run after any probe refresh (preserve:true keeps it through
# scheduled refreshes; removal is by explicit dated script only).
#
# Usage: python3 rankings-engine/scripts/append-payments-kushki-llms-probe-2026-11-01.py
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "open-rankings" / "payments" / "evidence" / "kushki.json"

ROW = {
    "id": "kushki-probe-4",
    "tier": "probe",
    "url": "https://docs.kushki.com/llms.txt",
    "excerpt": (
        "PROBE llms.txt: HTTP 200 at https://docs.kushki.com/llms.txt (observed 2026-11-01, "
        "content-type text/plain) — a markdown docs index titled \"# Kushki Docs\" linking the "
        "docs as .md pages (home.md, mx.md, card-payments guides), published after Kushki moved "
        "its docs from docs.kushki.com/cl/en/* to docs.kushki.com/cl/* (the old tree 404s live). "
        "Resolves the 2026-10-28 staleness-scan llms-txt flip for payments/kushki (issue #508)."
    ),
    "fetchedAt": "2026-11-01T20:24:00.000Z",
    "preserve": True,
}


def main() -> None:
    rows = json.loads(EVIDENCE.read_text())
    if any(r["id"] == ROW["id"] for r in rows):
        print(f"nothing to do — {ROW['id']} already present")
        return
    rows.append(ROW)
    EVIDENCE.write_text(json.dumps(rows, indent=2) + "\n")
    print(f"appended {ROW['id']} (preserved llms.txt record)")


if __name__ == "__main__":
    main()
