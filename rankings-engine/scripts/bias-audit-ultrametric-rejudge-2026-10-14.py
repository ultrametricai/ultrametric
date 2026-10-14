#!/usr/bin/env python3
# Owner-product parity pass over the 2026-10-14 agent-skills re-judge (README §9), following
# pipeline/scripts/bias-audit-ultrametric-refresh-2026-10-14.py. That audit set explicit
# strictest-comparable standards on 15 ultrametric cells. This re-judge ran against the pack
# with the counter-evidence restored (PR #305: the nine 2026-10-07 self-eval rows and the two
# 2026-10-14 audit counter-checks, all preserve: true) plus the five peers' restored runtime
# rows. Of the 15 audit-set cells the judge confirmed or went below the standard on six
# (agentic-public-api partial 5, agentic-sdks none 0, api-machine-spec disputed 4 — a lower
# score contribution than the audited partial 3 at verdict weight 0.3 vs 0.6 — multi-harness-
# support partial 5, openness-api-parity partial 5, selective-install partial 3) and exceeded
# it on nine. The owner evidence on those nine is unchanged since both audits (docs-27..35
# restate already-judged claims; the restored self-eval rows were in the pack the 2026-10-08
# audit graded), so the audit standard applies. Downgrades only, never upgrades; each change
# appends a dated bracket note and is applied to BOTH verdicts.json and the judge cache
# (hash kept, so re-judging unchanged evidence returns the audited verdict).
#
# Per-cell parity grounds against the post-re-judge peer grades:
#   - agent-installs-skill: peers' fulls (skills-cli/mattpocock 9 high, superpowers 8 high,
#     anthropic 7) stand on recorded REAL end-to-end installs; the owner's recorded evidence
#     is a dry-run preview plus a tool install, the exact end-to-end gap both audits named.
#   - agentic-mcp-server: the never-observed initialize/tools/list handshake (the 401
#     AUTH_REQUIRED wall is IN the pack as ultrametric-audit-20261014-2 and selfeval-5, and
#     the judge cites both) is the unchanged fact both audits capped at full 7 medium.
#   - agentic-scoped-keys, api-interactive-docs, privacy-no-training: every peer sits at
#     none/na on the same class of recorded absence; both audits reverted these to none 0.
#   - api-sandbox: all four peers with a documented-but-unverified test surface sit at
#     partial 3 low; the owner's `--environment staging` flag mention is the thinnest of them.
#   - browse-searchable-catalog: the story object is a browsable, searchable SKILLS catalog;
#     the owner's process catalog (and the arena-command catalog in selfeval-9) is a
#     different object, the mismatch both audits graded none 0.
#   - inspect-before-install: the owner's dry run previews file NAMES only (contents
#     undocumented) yet graded full 7 — above skills-cli's partial 5, whose keyless --list
#     enumerates every skill's full trigger description. Audit standard partial 5.
#   - team-distribution: the owner's only path is committing generated files, below gstack's
#     dedicated team tooling (partial 5); the peers' fulls stand on marketplace/registry
#     distribution. Both audits set partial 5.
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERDICTS = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'agent-skills', 'verdicts.json')
CACHE_DIR = os.path.join(ROOT, 'cache', 'judge', 'agent-skills', 'ultrametric')

MARKER = '2026-10-14 re-judge parity audit'
NOTE = 'Ultrametric-affiliation governance, README §9.'

# storyId -> (verdict, quality, confidence or None to keep, note)
AUDITS = {
    'agent-installs-skill': ('partial', 5, None,
        'full 8 -> partial 5, the standard both audits set on the same evidence: the recorded hands-on is a dry-run preview plus a tool install, not a completed skill install, and the peers\' fulls (skills-cli/mattpocock-skills 9 high, superpowers 8 high) stand on recorded real end-to-end installs. The sign-in half of the flow is still unestablished headlessly.'),
    'agentic-mcp-server': ('full', 7, 'medium',
        'quality re-capped 8 -> 7, the cap both audits applied: the judge\'s own citations include the 401 AUTH_REQUIRED wall (ultrametric-audit-20261014-2, selfeval-5) and no initialize/tools/list session has ever been observed; a never-observed handshake cannot out-grade the documented-wall state graded full 7 medium twice.'),
    'agentic-scoped-keys': ('none', 0, None,
        'partial 3 -> none 0, restoring both audits on unchanged evidence: one scope name in the MCP auth docs is not an issuance capability, nothing shows a user issuing, configuring or revoking a scoped credential, and every peer sits at none/na on the same absence.'),
    'api-interactive-docs': ('none', 0, None,
        'partial 3 -> none 0, restoring both audits: nothing shows an interactive explorer or runnable examples (the story object), the backing contract 404s at its documented path (ultrametric-audit-20261014-1), and every peer sits at none/na — codex-plugins\' API-reference mention was graded none with its 404s counted against it.'),
    'api-sandbox': ('partial', 3, 'low',
        'partial 5 medium -> partial 3 low: all four peers with a documented-but-unverified test surface sit at partial 3 low, and the owner evidence is a `--environment staging` flag value with conceded missing provisioning path and isolation semantics. The owner product above every peer on the thinnest mention fails the parity check both audits applied.'),
    'browse-searchable-catalog': ('none', 0, None,
        'partial 4 -> none 0, restoring both audits: the story object is a browsable, searchable catalog of SKILLS, and the cited catalog is the first-party process catalog (plus the arena-command catalog of selfeval-9) with no search or filtering — the object mismatch and conceded absence are unchanged since both audits graded it none.'),
    'inspect-before-install': ('partial', 5, None,
        'full 7 -> partial 5, the audit standard: the recorded dry run previews file names only and the preview\'s content (file list vs full instruction text) is undocumented — weaker evidence than skills-cli\'s keyless --list enumerating every skill\'s full trigger description, which sits at partial 5. The owner product does not get a higher reading of thinner recorded evidence.'),
    'privacy-no-training': ('none', 0, None,
        'partial 3 -> none 0, restoring both audits: "runs no model" is an architecture statement, not a no-training commitment for hosted company records, no data-use policy or opt-out exists, and every peer sits at none/na on the same class of silence.'),
    'team-distribution': ('partial', 5, None,
        'full 7 -> partial 5, the standard both audits set: the owner\'s only distribution path is committing generated skill files, with no team tooling and no recorded teammate pickup — below gstack\'s dedicated team tooling at partial 5, while the arena\'s fulls (8-9) stand on marketplace or registry distribution.'),
}


def audited_rationale(old: str, note: str) -> str:
    return f'{old} [{MARKER} (owner-product lane): {note} {NOTE}]'


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
        if MARKER in row['rationale']:
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
        if MARKER in cached['verdict']['rationale']:
            print(f"skip cache (already audited): {story_id}")
            continue
        apply(cached['verdict'])
        with open(path, 'w') as f:
            f.write(json.dumps(cached, indent=2, ensure_ascii=False) + '\n')
        print(f"audited cache: {story_id}")

    print(f"done: {changed} verdict rows audited")


if __name__ == '__main__':
    main()
