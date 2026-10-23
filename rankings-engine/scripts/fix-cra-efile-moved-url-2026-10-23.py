#!/usr/bin/env python3
# Accuracy queue 2026-10-21 (issue #401): dead cited URL on government-services/cra.
#
# The CRA moved its "EFILE for electronic filers" page from
#   https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/efile-electronic-filers.html
# (HTTP 404 live-checked 2026-10-23, the staleness scan's dead-cited-URL finding) to
#   https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-individuals/efile-electronic-filers.html
# (HTTP 200, title "EFILE for electronic filers - Canada.ca", live-checked 2026-10-23; the
# canada.ca tax-preparer page links the new location). All six distinct excerpts quoted by the
# seven affected evidence rows (cra-docs-14..19, cra-supp-3) were verified verbatim on the
# moved page on 2026-10-23, so this is a URL relink: excerpts and verdicts are untouched, only
# the url moves and fetchedAt restamps to the verification time. Evidence doctrine: the source
# moved, the claim did not; a reachable URL replaces the dead one and this script documents it.
#
# Usage: python3 rankings-engine/scripts/fix-cra-efile-moved-url-2026-10-23.py
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "open-rankings" / "government-services" / "evidence" / "cra.json"

OLD_URL = "https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/efile-electronic-filers.html"
NEW_URL = "https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-individuals/efile-electronic-filers.html"
VERIFIED_AT = "2026-10-23T18:58:00.000Z"  # when the moved page and all excerpts were re-verified

def main() -> None:
    rows = json.loads(EVIDENCE.read_text())
    changed = []
    for row in rows:
        if row.get("url") == OLD_URL:
            row["url"] = NEW_URL
            row["fetchedAt"] = VERIFIED_AT
            changed.append(row["id"])
    if not changed:
        print("nothing to do — no rows cite the dead URL")
        return
    EVIDENCE.write_text(json.dumps(rows, indent=2) + "\n")
    print(f"relinked {len(changed)} rows to the moved EFILE page: {', '.join(changed)}")

if __name__ == "__main__":
    main()
