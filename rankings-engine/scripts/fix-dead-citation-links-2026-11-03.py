#!/usr/bin/env python3
# Dead citation links found by the monthly citation-link check (private site issue
# "Citation links: monthly check"), re-run against this repo on 2026-11-03.
#
# Only claimed-docs rows are relinked. Probe-tier rows whose excerpt records an HTTP 404 at the
# probed URL ("PROBE llms.txt: HTTP 404 at ...") are recorded negative observations: the 404 is
# the evidence, so those rows stay as they are.
#
# Two kinds of relink, both keeping ids and excerpts. Committed verdicts and rankings are
# untouched here. The judge cellHash covers [id, tier, url, excerpt], so a url change does
# invalidate the affected products' cached judgments; on 2026-11-03 those caches were already
# keyed to PROMPT_VERSION v5 while the judge runs v6, so every one of these cells re-judges on
# its next judge touch regardless of this relink.
#
# - MOVED: the vendor moved the page. Every excerpt on the affected rows was verified verbatim
#   on the new URL (HTTP 200) on 2026-11-03, so url moves and fetchedAt restamps to the
#   verification time (the fix-cra-efile-moved-url-2026-10-23.py convention).
#     kushki: docs.kushki.com/cl/en/... -> docs.kushki.com/en/cl/... (the docs site swapped the
#       country and language path segments; /cl/en answers 404, /en/cl answers 200)
#     wise: docs.wise.com/api-reference/<tag>/tag.md -> docs.wise.com/api-reference/<tag>.md
# - ARCHIVED: the page is gone from the live web. url points at a web.archive.org snapshot of
#   the original page, fetched on 2026-11-03 and confirmed to carry the excerpt; fetchedAt keeps
#   the original observation date (the 2026-10-21 repair-commit convention).
#     morph: Reflex docs removed from docs.morphllm.com (no Reflex page in llms.txt or sitemap)
#     smithery: smithery.ai/docs/* answers 404 (the site no longer serves its docs)
#     elicit: the Alerts article was renamed "-legacy-tool" and then removed
#     kushki-docs-1: the excerpt's subtitle is absent from the moved overview page
#
# Usage: python3 rankings-engine/scripts/fix-dead-citation-links-2026-11-03.py
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "open-rankings"
VERIFIED_AT = "2026-11-03T23:30:00.000Z"  # when the moved pages and their excerpts were verified

WA = "https://web.archive.org/web"
KUSHKI_EN_CL = "https://docs.kushki.com/en/cl"

# (arena, product file, evidence id, expected old url, new url, kind)
RELINKS = [
    # kushki: moved
    *[
        ("payments", "kushki", f"kushki-docs-{n}", "https://docs.kushki.com/cl/en", KUSHKI_EN_CL, "moved")
        for n in (3, 4, 6, 7, 9, 11)
    ],
    ("payments", "kushki", "kushki-docs-2",
     "https://docs.kushki.com/cl/en/card-payments/one-step-payments/accept-a-payment",
     f"{KUSHKI_EN_CL}/card-payments/one-step-payments/accept-a-payment", "moved"),
    ("payments", "kushki", "kushki-docs-1",
     "https://docs.kushki.com/cl/en/card-payments/overview",
     f"{WA}/20241009213130/https://docs.kushki.com/cl/en/card-payments/overview/", "archived"),
    # wise: moved
    ("startup-banking", "wise", "wise-docs-13", "https://docs.wise.com/api-reference/3ds/tag.md",
     "https://docs.wise.com/api-reference/3ds.md", "moved"),
    *[
        ("startup-banking", "wise", i, "https://docs.wise.com/api-reference/card-order/tag.md",
         "https://docs.wise.com/api-reference/card-order.md", "moved")
        for i in ("wise-docs-14", "wise-docs-36")
    ],
    ("startup-banking", "wise", "wise-docs-15",
     "https://docs.wise.com/api-reference/card-sensitive-details/tag.md",
     "https://docs.wise.com/api-reference/card-sensitive-details.md", "moved"),
    # morph: archived
    *[
        ("inference-providers", "morph", i, "https://docs.morphllm.com/sdk/components/reflexes/custom.md",
         f"{WA}/20260708191251/https://docs.morphllm.com/sdk/components/reflexes/custom", "archived")
        for i in ("morph-docs-6", "morph-docs-20")
    ],
    # smithery: archived
    *[
        ("mcp-infrastructure", "smithery", f"smithery-docs-{n}", "https://smithery.ai/docs",
         f"{WA}/20261025024441/https://smithery.ai/docs", "archived")
        for n in (2, 3, 17, 18, 19)
    ],
    *[
        ("mcp-infrastructure", "smithery", f"smithery-docs-{n}", "https://smithery.ai/docs/use/connect",
         f"{WA}/20261025024440/https://smithery.ai/docs/use/connect", "archived")
        for n in (1, 16, 21, 22)
    ],
    *[
        ("mcp-infrastructure", "smithery", f"smithery-docs-{n}", "https://smithery.ai/docs/use/deep-linking",
         f"{WA}/20261025024440/https://smithery.ai/docs/use/deep-linking", "archived")
        for n in (8, 27)
    ],
    *[
        ("mcp-infrastructure", "smithery", f"smithery-docs-{n}", "https://smithery.ai/docs/use/token-scoping",
         f"{WA}/20261025024441/https://smithery.ai/docs/use/token-scoping", "archived")
        for n in (6, 7)
    ],
    *[
        ("mcp-infrastructure", "smithery", f"smithery-docs-{n}", "https://smithery.ai/docs/use/uplink",
         f"{WA}/20261025024440/https://smithery.ai/docs/use/uplink", "archived")
        for n in (4, 5, 20)
    ],
    # elicit: archived (elicit-docs-53's excerpt is in no archived version, so it is not relinked)
    *[
        ("ai-research-agents", "elicit", f"elicit-docs-{n}",
         "https://support.elicit.com/en/articles/14757570-elicit-alerts.md",
         f"{WA}/20260910020248/https://support.elicit.com/en/articles/14757570-elicit-alerts", "archived")
        for n in (3, 15, 26)
    ],
    ("ai-research-agents", "elicit", "elicit-docs-80",
     "https://support.elicit.com/en/articles/14757570-elicit-alerts.md",
     f"{WA}/20261012061754/https://support.elicit.com/en/articles/14757570-elicit-alerts-legacy-tool", "archived"),
]


def main() -> None:
    by_file: dict[pathlib.Path, list[tuple[str, str, str, str]]] = {}
    for arena, product, evidence_id, old, new, kind in RELINKS:
        by_file.setdefault(EVIDENCE / arena / "evidence" / f"{product}.json", []).append((evidence_id, old, new, kind))
    changed = 0
    for path, relinks in by_file.items():
        rows = json.loads(path.read_text())
        by_id = {row["id"]: row for row in rows}
        for evidence_id, old, new, kind in relinks:
            row = by_id[evidence_id]
            if row["url"] == new:
                continue
            if row["url"] != old:
                raise SystemExit(f"{path.name} {evidence_id}: expected {old}, found {row['url']}")
            row["url"] = new
            if kind == "moved":
                row["fetchedAt"] = VERIFIED_AT
            changed += 1
        path.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    print(f"relinked {changed} evidence rows")


if __name__ == "__main__":
    main()
