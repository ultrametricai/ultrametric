#!/usr/bin/env python3
# PR #561 review (Foreloop P2 + Greptile, accuracy queue 2026-10-28, issue #508): complete
# the kushki docs-move repair. Kushki retired its English docs tree (docs.kushki.com/cl/en/*
# answers HTTP 404 live) and serves the current docs at docs.kushki.com/cl/* — the keyed
# re-crawl relinked products.json and added fresh evidence, but the retained claimed-docs
# rows (the evidence-union keeps prior rows) still cited the dead /cl/en URLs, and the
# generated payments--kushki review surfaced one of them.
#
# URL relink per the CRA EFILE precedent (fix-cra-efile-moved-url-2026-10-23.py), with one
# difference documented here: every successor URL below was live-checked HTTP 200 on
# 2026-11-01, but the successor pages are the Spanish-language relaunch of the same docs
# (the English tree was removed, not moved), so the English excerpts are NOT verbatim on
# the successor pages. The rows therefore keep their original fetchedAt (they remain dated
# records of the retired English tree); only the dead URL is replaced by the live successor
# page for the same docs location. Excerpts and verdicts are untouched, and the judge cache
# is unaffected (cellHash covers [id, excerpt], not url).
#
# Usage: python3 rankings-engine/scripts/relink-kushki-cl-en-evidence-2026-11-01.py
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "open-rankings" / "payments" / "evidence" / "kushki.json"

OLD_PREFIX = "https://docs.kushki.com/cl/en"
NEW_PREFIX = "https://docs.kushki.com/cl"

# Every successor URL this relink can produce, live-checked HTTP 200 on 2026-11-01:
#   https://docs.kushki.com/cl
#   https://docs.kushki.com/cl/card-payments/overview
#   https://docs.kushki.com/cl/card-payments/one-step-payments/accept-a-payment
#   https://docs.kushki.com/cl/card-payments/two-steps-payments/authorization-capture
#   https://docs.kushki.com/cl/card-payments/refunds/manage-voids-and-refunds
#   https://docs.kushki.com/cl/card-payments/3d-secure/3ds-overview
#   https://docs.kushki.com/cl/card-payments/network-tokens


def main() -> None:
    rows = json.loads(EVIDENCE.read_text())
    changed = []
    for row in rows:
        url = row.get("url", "")
        if url == OLD_PREFIX or url.startswith(OLD_PREFIX + "/"):
            row["url"] = NEW_PREFIX + url[len(OLD_PREFIX):]
            changed.append(row["id"])
    if not changed:
        print("nothing to do — no rows cite the retired /cl/en tree")
        return
    EVIDENCE.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    print(f"relinked {len(changed)} rows to the live /cl tree: {', '.join(changed)}")


if __name__ == "__main__":
    main()
