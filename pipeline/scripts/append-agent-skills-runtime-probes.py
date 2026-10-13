#!/usr/bin/env python3
# One-shot helper for the agent-skills arena bring-up (2026-09-06): appends probe-tier evidence
# items distilled from the recorded runtime probes in rankings/agent-skills/proofs/ (see
# pipeline/probes/agent-skills.ts — all 7 recorded probes passed).
# Run AFTER `pnpm pipeline probe --category agent-skills` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'superpowers': [
        {
            'id': 'superpowers-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/obra/superpowers',
            'excerpt': "PROBE runtime (recorded 2026-09-06): a REAL end-to-end keyless install into a scratch project dir — `npx -y skills add obra/superpowers --skill test-driven-development -a claude-code -y --copy` fetched the repo, copied the skill to ./.claude/skills/test-driven-development/, and the installed SKILL.md frontmatter (name: test-driven-development) read back cleanly; the installer prints 'Review skills before use; they run with full agent permissions.' Skills are plain, selectively-installable markdown folders.",
            'fetchedAt': NOW,
        },
    ],
    'anthropic-skills': [
        {
            'id': 'anthropic-skills-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/anthropics/skills',
            'excerpt': "PROBE runtime (recorded 2026-09-06): a REAL end-to-end keyless install into a scratch project dir — `npx -y skills add anthropics/skills --skill skill-creator -a claude-code -y --copy` fetched the official repo, selectively installed ONE skill (skill-creator) to ./.claude/skills/, and the installed SKILL.md frontmatter (name: skill-creator) read back cleanly — the repo's skills are plain, spec-conformant markdown folders installable by third-party tooling, no Anthropic account needed.",
            'fetchedAt': NOW,
        },
    ],
    'mattpocock-skills': [
        {
            'id': 'mattpocock-skills-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/mattpocock/skills',
            'excerpt': "PROBE runtime (recorded 2026-09-06): a REAL end-to-end keyless install into a scratch project dir — `npx -y skills add mattpocock/skills --skill tdd -a claude-code -y --copy` fetched the repo, selectively installed the single `tdd` skill to ./.claude/skills/tdd/, and the installed SKILL.md frontmatter (name: tdd) read back cleanly — the documented skills.sh install path works non-interactively, exactly as the README promises.",
            'fetchedAt': NOW,
        },
    ],
    'skills-cli': [
        {
            'id': 'skills-cli-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/vercel-labs/skills',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the skills CLI ran keylessly from npm — `npx -y skills --version` printed 1.5.24 with no account, and it auto-detected it was being driven by a coding agent ('claude-code_2-1-245_agent — installing non-interactively'), switching to promptless mode by itself.",
            'fetchedAt': NOW,
        },
        {
            'id': 'skills-cli-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/vercel-labs/skills',
            'excerpt': "PROBE runtime (recorded 2026-09-06): `npx -y skills add vercel-labs/agent-skills --list` enumerated all 9 skills in a public repo — each with its name and full trigger description — WITHOUT installing anything: a keyless review-before-install path that shows exactly what instructions a skill would add.",
            'fetchedAt': NOW,
        },
    ],
    'codex-plugins': [
        {
            'id': 'codex-plugins-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/openai/plugins',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the curated Codex marketplace manifest at .agents/plugins/marketplace.json fetched keylessly over raw.githubusercontent.com — a public JSON catalog ('openai-curated', display name 'Codex official') listing plugins with source paths and installation/authentication policies.",
            'fetchedAt': NOW,
        },
        {
            'id': 'codex-plugins-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/openai/plugins',
            'excerpt': "PROBE runtime (recorded 2026-09-06): a REAL keyless cross-harness install from the catalog — `npx -y skills add openai/plugins --skill plugin-creator -a codex -y --copy` in a scratch dir landed the skill at ./.agents/skills/plugin-creator/SKILL.md with valid frontmatter (name: plugin-creator): the catalog's skills are plain portable folders that third-party tooling can install, not a Codex-locked format.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'rankings/agent-skills/evidence/{pid}.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for item in items:
        if item['id'] in existing:
            print(f'{pid}: {item["id"]} already present, skipping')
            continue
        ev.append(item)
        print(f'{pid}: appended {item["id"]}')
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
