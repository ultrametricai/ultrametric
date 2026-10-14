#!/usr/bin/env python3
# Adversarial bias audit for the agent-skills scheduled refresh (2026-10-14) — the owner-product
# governance pass (README §9), following pipeline/scripts/bias-audit-ultrametric-bringup-2026-10-08.py.
# The refresh re-judged every ultrametric cell against a pack that gained 9 new claimed-docs items
# (ultrametric-docs-27..35, all first-party pages) and a REPLACED probe set: the recorded 2026-10-08
# counter-checks (the 404 at the documented /contracts/openapi.json, the observed AUTH_REQUIRED MCP
# wall) were clobbered by thinner probe rows that only note which docs pages exist (the known
# probe-stage replacement gotcha). On that weakened pack the judge restored eleven grades the
# 2026-10-08 audit had corrected, moving the owner product from #4 to #2 on the aiEra leaderboard.
# This pass re-reads every ultrametric cell whose grade changed in the refresh (25 cells) against
# the bar the same stories applied to the other six products, with fresh hands-on counter-checks.
# Downgrades only, never upgrades; each change appends a dated bracket note to the rationale and is
# applied to BOTH verdicts.json and the judge cache file (judge.ts assembles verdicts.json from
# cache, so an unpatched cache would silently revert the audit on the next judge run; the cache
# entry's evidence hash is kept so re-judging unchanged evidence returns the audited verdict).
#
# Hands-on counter-checks recorded for this pass (2026-10-14):
#   1. The documented OpenAPI contract location 404s on BOTH hosts:
#        GET https://api.ultrametric.ai/contracts/openapi.json
#          -> 404 {"schemaVersion":1,"error":{"code":"NOT_FOUND","message":"Endpoint not found."}}
#        GET https://docs.ultrametric.ai/contracts/openapi.json -> 404 "Asset not found"
#      This reproduces the 2026-10-08 audit fetch and affirmatively contradicts the refresh
#      rationales' shared pivot "the 404s were only at generic paths, not the documented
#      /contracts/openapi.json, so they do not contradict the claim". Five upgraded cells leaned
#      on that pivot (agentic-public-api, api-machine-spec, agentic-sdks, api-interactive-docs,
#      openness-api-parity).
#   2. POST initialize to the documented MCP endpoint https://api.ultrametric.ai/mcp
#        -> 401 {"schemaVersion":1,"error":{"code":"AUTH_REQUIRED","message":"Sign in to continue."}}
#      with `www-authenticate: Bearer resource_metadata="https://api.ultrametric.ai/
#      .well-known/oauth-protected-resource"` — the same RFC 9728 wall the 2026-10-08 audit graded
#      full 7 medium; no initialize/tools/list session has ever been observed.
#
# Cells examined and KEPT (the audit trail shows cells examined, not just cells changed):
#   - active-maintenance (none 0 medium): the refresh moved this DOWN to the arena floor while
#     three peers hold partials. Nothing generous to remove.
#   - agentic-ai-insights (partial 4 medium): quality unchanged by the refresh; the confidence
#     move low -> medium matches the same-story treatment of both docs-only peer partials
#     (anthropic-skills and mattpocock-skills each sit at partial 5 medium), and the owner grades
#     below both.
#   - agentic-autonomous-automation (partial 3 low): the documented `--period` recurring runs,
#     `--json` non-interactive operation and cross-session resume are at least the surface
#     codex-plugins' partial 3 low stands on (glancing webhook/hooks mentions), and the rationale
#     states the unattended-execution gap. Matches the strictest comparable partial treatment.
#   - five-minute-quickstart (partial 5 medium): refresh downgrade (was full 7) while five peers
#     hold full 7. Kept.
#   - one-command-install (partial 5 medium): refresh downgrade (was full 7) below five fulls,
#     with the two-step flow conceded. Kept.
#   - open-spec-compliance (partial 3 low): refresh downgrade to the arena bottom. Kept.
#   - openness-full-export (partial 3 low): refresh downgrade to the arena bottom. Kept.
#   - plain-files-portability (partial 5 medium): refresh downgrade (was full 7) while six peers
#     hold full 8-9. Kept.
#   - privacy-data-residency (none 0 medium): verdict and quality at the floor; the confidence
#     move to medium matches every peer's medium on the same recorded absence, and higher
#     confidence in a negative does not favor the product.
#   - reliable-auto-triggering (partial 3 low): refresh downgrade to the arena bottom. Kept.
# The remaining 25 ultrametric cells changed rationale text only; their grades carry the
# pre-refresh judged values unchanged. Three of them mention the OpenAPI contract
# (agentic-headless partial 6, api-versioning-policy partial 3, openness-open-license none 0),
# in each case as a secondary or negative mention the grade does not rest on (the carrying
# evidence is the CLI's non-interactive JSON mode, the schemaVersion envelope plus version
# pinning, and a recorded absence respectively), so their unchanged grades stand.
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERDICTS = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'agent-skills', 'verdicts.json')
CACHE_DIR = os.path.join(ROOT, 'cache', 'judge', 'agent-skills', 'ultrametric')

NOTE = 'Ultrametric-affiliation governance, README §9.'

# storyId -> (new verdict, new quality, new confidence or None to keep, audit note)
AUDITS = {
    'agent-installs-skill': ('partial', 5, None,
        'reverted full 7 -> partial 5 — four peers (anthropic-skills, codex-plugins, mattpocock-skills, superpowers) sit at partial 5 medium with documented install paths whose headless end-to-end completion is not established, and the owner rationale concedes the same gap: the sign-in link step may need a human browser action and the non-dry-run init flags are elided. skills-cli\'s full 8 stands on an explicitly documented non-interactive CI path plus auth reuse; the owner docs cover only the output half (`--json`), not the auth half, so the cell takes the partial-5 treatment.'),
    'agentic-mcp-server': ('full', 7, 'medium',
        'quality re-capped 9 -> 7 and confidence high -> medium, restoring the 2026-10-08 audit cap the refresh reversed on weaker probe evidence (the refreshed probe row records only that the MCP docs page exists, and the rationale concedes no corroboration of a working connection beyond first-party docs). Counter-check 2026-10-14: POST initialize to the documented https://api.ultrametric.ai/mcp answers 401 {"code":"AUTH_REQUIRED"} behind the RFC 9728 www-authenticate resource_metadata wall — the same observed state the 2026-10-08 audit graded full 7 medium; a still-never-observed handshake cannot carry q9 high.'),
    'agentic-public-api': ('full', 6, None,
        'quality re-capped 8 -> 6, restoring the 2026-10-08 audit. The upgrade\'s load-bearing sentence ("the 404s were only at generic OpenAPI paths, not the documented /contracts/openapi.json, so they do not contradict the claim") is affirmatively false: the documented path was fetched on 2026-10-08 and re-fetched on 2026-10-14 and answers 404 ({"code":"NOT_FOUND"} on api.ultrametric.ai, "Asset not found" on docs.ultrametric.ai). anthropic-skills\' full 8 is the bar for a corroborated public API; the owner\'s docs claims minus the contradicted contract and with no authenticated call stay at 6.'),
    'agentic-scoped-keys': ('none', 0, None,
        'reverted partial 3 -> none 0, restoring the 2026-10-08 audit on the same two evidence items: one scope name in the MCP auth docs is not an issuance capability, the rationale concedes nothing shows a user issuing, configuring or revoking a scoped credential, and every peer with no issuance surface sits at none/na.'),
    'agentic-sdks': ('none', 0, None,
        'reverted partial 3 -> none 0, restoring the 2026-10-08 audit: the rationale concedes no official SDK exists, and the partial rides on the downloadable OpenAPI contract "that could be used to generate clients" — the documented contract path answers 404 on the 2026-10-14 re-fetch (both hosts). A conceded absence plus a contradicted enabler is none, the bar at which four peers sit.'),
    'api-interactive-docs': ('none', 0, None,
        'reverted partial 3 -> none 0, restoring the 2026-10-08 audit: the rationale concedes nothing shows an interactive explorer or runnable examples (the story object), and the backing contract 404s at its documented path on the 2026-10-14 re-fetch. Parity: codex-plugins\' "Checkout API reference" mention was graded none 0 with its OpenAPI 404s counted AGAINST it; the owner product does not get the same 404s explained away.'),
    'api-machine-spec': ('partial', 3, None,
        'reverted full 7 -> partial 3, restoring the 2026-10-08 audit: the grade rests entirely on the documented /contracts/openapi.json download, and this audit re-fetched that exact path on 2026-10-14 — 404 {"code":"NOT_FOUND"} on api.ultrametric.ai and 404 on docs.ultrametric.ai — so the rationale\'s "does not contradict the claim" pivot is affirmatively contradicted. What survives is the CLI\'s keyless JSON Schema output (documented schemaVersion/data envelopes): machine-readable contracts, not a retrievable OpenAPI document. Parity: codex-plugins\' 404ing OpenAPI probe produced none 0 on this story.'),
    'api-sandbox': ('partial', 3, 'low',
        'reverted full 7 -> partial 3 low — all four peers with a documented-but-unverified test surface (anthropic-skills\' execution container, codex-plugins\' local test marketplace, skills-cli\'s temp-dir trial, superpowers\' worktree isolation) sit at partial 3 low; the owner evidence is a documented `--environment staging` flag value with conceded missing provisioning path, isolation guarantees and corroboration. The owner product as the arena\'s only full on this story fails the parity check.'),
    'browse-searchable-catalog': ('none', 0, None,
        'reverted partial 5 -> none 0, restoring the 2026-10-08 audit: the story object is a browsable, searchable catalog of skills, and the rationale still concedes the cited catalog is "a thinly described first-party process catalog rather than a clearly documented skills registry" with no search or filtering. The only new evidence since the audit is nextCursor pagination of the same process catalog, which addresses neither the object mismatch nor the conceded absence.'),
    'inspect-before-install': ('partial', 5, None,
        'reverted full 7 -> partial 5, restoring the 2026-10-08 audit: all six peers sit at partial 4-6, the rationale concedes the dry-run preview\'s content (file list vs. full instruction contents) is undocumented, and the new "reviewable after installation" point is not the story (inspect before install). The owner product being the arena\'s only full again fails the parity check.'),
    'multi-harness-support': ('partial', 5, None,
        'quality 6 -> 5 — the +1 rests on docs-27/docs-30, which restate the already-judged Codex + Claude Code support; no new harness was added. The arena\'s fulls (gstack 7, mattpocock-skills/skills-cli 8, superpowers 9) document many harnesses; two documented hosts plus a remote-MCP claim was judged partial 5 on the same facts pre-refresh, and the owner product does not get the higher reading of restated first-party claims.'),
    'openness-api-parity': ('partial', 6, None,
        'reverted full 7 -> partial 6 — the full rests partly on the OpenAPI contract (404 at its documented path on the 2026-10-14 re-fetch) and the rationale concedes both the missing parity statement and that the HTTP surface is described as read-plus-context only. Tying anthropic-skills\' full 7 (the arena\'s corroborated API-first bar) on conceded gaps plus a contradicted contract fails the strict read; the pre-refresh partial 6 stands.'),
    'privacy-no-training': ('none', 0, None,
        'reverted partial 3 -> none 0, restoring the 2026-10-08 audit: "runs no model" is an architecture statement, not a no-training commitment for hosted company records, and the rationale concedes no data-use policy or opt-out exists. Every peer sits at none/na on the same class of silence.'),
    'selective-install': ('partial', 3, None,
        'quality 4 -> 3 — the +1 rests on docs-30, which documents choosing the target agent host, not choosing skills, and the rationale concedes it is unclear whether individual skills can be picked at all. anthropic-skills\' partial 5 stands on a real per-skill API selection surface; the owner\'s "implies some selection" reading stays at the pre-refresh 3.'),
    'team-distribution': ('partial', 5, None,
        'reverted full 7 -> partial 5, restoring the 2026-10-08 audit parity: gstack\'s dedicated team tooling and superpowers\' shared marketplace repo sit at partial 5, and the owner\'s only path is committing generated skill files, with no team tooling and no hands-on teammate pickup. The arena\'s fulls (anthropic-skills/codex-plugins 9, mattpocock-skills/skills-cli 8) stand on marketplace or registry distribution.'),
}


def audited_rationale(old: str, note: str) -> str:
    return f'{old} [2026-10-14 adversarial bias audit (owner-product refresh lane): {note} {NOTE}]'


def apply(row: dict) -> dict:
    verdict, quality, confidence, note = AUDITS[row['storyId']]
    row['verdict'] = verdict
    row['quality'] = quality
    if confidence:
        row['confidence'] = confidence
    row['rationale'] = audited_rationale(row['rationale'], note)
    return row


def main() -> None:
    verdicts = json.load(open(VERDICTS))
    changed = 0
    for row in verdicts:
        if row['productId'] != 'ultrametric' or row['storyId'] not in AUDITS:
            continue
        if '2026-10-14 adversarial bias audit' in row['rationale']:
            print(f"skip (already audited): {row['storyId']}")
            continue
        apply(row)
        changed += 1
        print(f"audited verdicts.json: {row['storyId']} -> {row['verdict']} q{row['quality']}")
    with open(VERDICTS, 'w') as f:
        f.write(json.dumps(verdicts, indent=2, ensure_ascii=False) + '\n')

    for story_id in AUDITS:
        path = os.path.join(CACHE_DIR, f'{story_id}.json')
        cached = json.load(open(path))
        if '2026-10-14 adversarial bias audit' in cached['verdict']['rationale']:
            print(f"skip cache (already audited): {story_id}")
            continue
        apply(cached['verdict'])
        with open(path, 'w') as f:
            f.write(json.dumps(cached, indent=2, ensure_ascii=False) + '\n')
        print(f"audited cache: {story_id}")

    print(f"done: {changed} verdict rows audited")


if __name__ == '__main__':
    main()
