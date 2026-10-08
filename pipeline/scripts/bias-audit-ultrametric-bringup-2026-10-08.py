#!/usr/bin/env python3
# Adversarial bias audit for the ultrametric bring-up (agent-skills, 2026-10-08) — the
# owner-product governance pass (README §9): Ultrametric is built by Ultrametric Inc, which
# operates this site, so every favorable verdict was re-examined against the bar the same
# stories applied to the other six products in the arena, and against hands-on counter-checks.
# Downgrades only, never upgrades; each change appends a dated bracket note to the rationale
# (the Foreloop/judge-migration audit pattern) and is applied to BOTH verdicts.json and the
# judge cache file (judge.ts assembles verdicts.json from cache, so an unpatched cache would
# silently revert the audit on the next judge run).
#
# The load-bearing hands-on counter-check: the docs offer a downloadable OpenAPI contract at
# /contracts/openapi.json; the audit fetched it on 2026-10-08 and it answers
# 404 {"schemaVersion":1,"error":{"code":"NOT_FOUND","message":"Endpoint not found."}} —
# affirmative counter-evidence that four of the judged rationales leaned on.
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERDICTS = os.path.join(os.path.dirname(ROOT), 'data', 'agent-skills', 'verdicts.json')
CACHE_DIR = os.path.join(ROOT, 'cache', 'judge', 'agent-skills', 'ultrametric')

NOTE = 'Ultrametric-affiliation governance, README §9.'

# storyId -> (new verdict, new quality, new confidence or None to keep, audit note)
AUDITS = {
    'agentic-mcp-server': ('full', 7, 'medium',
        'quality capped 9 -> 7 and confidence high -> medium — MCP cells are the most bias-sensitive class (fleet precedent: probe-grade evidence); the recorded probe shows only the documented AUTH_REQUIRED wall, and the rationale concedes no observed initialize/tools/list session. full stands on the documented hosted server, documented tools, and the live RFC 9728 wall; a never-observed handshake cannot carry q9 high.'),
    'agentic-public-api': ('full', 6, None,
        'quality 8 -> 6 — the judged rationale leaned on the 404s not covering the documented /contracts/openapi.json location; the audit fetched that documented location and it answers 404 {"code":"NOT_FOUND"} (2026-10-08), so the OpenAPI sub-claim is affirmatively contradicted. full stands on the documented operations reference plus keyless schema output (the anthropic-skills full-8 bar), minus the contradicted contract claim and no authenticated call.'),
    'api-machine-spec': ('partial', 3, None,
        'reverted full 7 -> partial 3 — the story object is a retrievable machine-readable spec; the documented download path https://api.ultrametric.ai/contracts/openapi.json answers 404 on the 2026-10-08 audit fetch, and every conventional path 404d in the recorded probe. What survives hands-on is `context schema open|save|get` printing JSON Schema 2020-12 input contracts keylessly — machine-readable contracts, not a retrievable OpenAPI document.'),
    'team-distribution': ('partial', 5, None,
        'reverted full 7 -> partial 5 — parity: gstack\'s dedicated team tooling (./setup --team + gstack-team-init) and superpowers\' shared marketplace repo both sit at partial 5; the owner product\'s only path is committing two generated SKILL.md files for a single skill, with no team tooling and no hands-on teammate pickup. The owner product does not get the higher reading of an ambiguous bar.'),
    'inspect-before-install': ('partial', 5, None,
        'reverted full 7 -> partial 5 — all six competitors sit at partial 4-6 on this story, including gstack\'s public-SKILL.md inspection probe at partial 5; the recorded dry run lists target file paths, not the instruction contents the story asks to review before install. The owner product being the arena\'s only full on a path-listing preview fails the parity check.'),
    'browse-searchable-catalog': ('none', 0, None,
        'reverted partial 4 -> none 0 — the judged partial rests on the hosted process catalog (a different object than a skills catalog, and AUTH_REQUIRED-walled in the recorded probe) plus a preview of the single bundled skill; the rationale concedes there is no browsable set of skills. Partial credit on a conceded absence is the class the Foreloop audits reverted.'),
    'api-sandbox': ('partial', 3, None,
        'quality 5 -> 3 — peers with the same thin-mention evidence (anthropic-skills, skills-cli, superpowers) sit at partial 3, and the rationale itself calls `--environment staging` a single thin mention with no documented isolation semantics.'),
    'agentic-sdks': ('none', 0, None,
        'reverted partial 3 -> none 0 — the rationale opens by conceding no SDK or client library is documented; the partial rode on a downloadable OpenAPI contract enabling client generation, and the documented contract path answers 404 (2026-10-08 audit fetch). A conceded absence plus a contradicted enabler is none — the bar at which five of six peers sit (none/na).'),
    'agentic-scoped-keys': ('none', 0, None,
        'reverted partial 3 -> none 0 — the story is issuing scoped/least-privilege credentials for an agent; the rationale concedes nothing shows a user issuing a dedicated scoped credential, and one scope name in the MCP auth docs is not an issuance capability. Every peer with no issuance surface sits at none/na.'),
    'privacy-no-training': ('none', 0, None,
        'reverted partial 3 -> none 0 — the rationale concedes the evidence only indirectly addresses training and that nothing states how hosted records may be used; "runs no model" is an architecture statement, not a no-training commitment. Every peer sits at none/na on the same class of silence.'),
    'privacy-data-residency': ('none', 0, None,
        'reverted partial 3 -> none 0 — the rationale\'s first sentence concedes no region or residency selection exists; keeping some data local via --data-dir is not choosing where hosted records are stored. Every peer sits at none/na.'),
    'api-interactive-docs': ('none', 0, None,
        'reverted partial 3 -> none 0 — the rationale concedes nothing shows an interactive explorer or runnable examples (the story object), and the cited downloadable OpenAPI contract 404s at its documented path (2026-10-08 audit fetch).'),
}


def audited_rationale(old: str, note: str) -> str:
    return f'{old} [2026-10-08 adversarial bias audit (owner-product bring-up lane): {note} {NOTE}]'


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
        if 'adversarial bias audit' in row['rationale']:
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
        if 'adversarial bias audit' in cached['verdict']['rationale']:
            print(f"skip cache (already audited): {story_id}")
            continue
        apply(cached['verdict'])
        with open(path, 'w') as f:
            f.write(json.dumps(cached, indent=2, ensure_ascii=False) + '\n')
        print(f"audited cache: {story_id}")

    print(f"done: {changed} verdict rows audited")


if __name__ == '__main__':
    main()
