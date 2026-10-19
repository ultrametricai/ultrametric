#!/usr/bin/env python3
# One-shot helper for the authenticator-apps arena bring-up (2026-09-15): appends probe-tier
# evidence items distilled from the recorded runtime probes in open-rankings/authenticator-apps/proofs/
# (see rankings-engine/probes/authenticator-apps.ts — all 14 recorded probes passed). Run AFTER
# `pnpm engine probe --category authenticator-apps` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'bitwarden': [
        {
            'id': 'bitwarden-probe-rt-1',
            'tier': 'probe',
            'url': 'https://bitwarden.com/help/cli/',
            'excerpt': "PROBE runtime (recorded 2026-09-15): the official bw CLI installs keylessly from npm (@bitwarden/cli, registry latest 2026.8.0) and prints its version — the CLI whose documented `bw serve` mode exposes the whole vault as a local RESTful API (Vault Management API) an agent can query for TOTP codes and items.",
            'fetchedAt': NOW,
        },
        {
            'id': 'bitwarden-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/bitwarden/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Bitwarden's OFFICIAL MCP server completed a FULL keyless stdio initialize handshake — `npx -y @bitwarden/mcp-server` answered with serverInfo {\"name\":\"Bitwarden MCP Server\",\"version\":\"2026.7.0\"}. First-party repo (bitwarden/mcp-server, GPL-3.0), published to npm.",
            'fetchedAt': NOW,
        },
        {
            'id': 'bitwarden-probe-rt-3',
            'tier': 'probe',
            'url': 'https://bitwarden.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-15): bitwarden.com serves a live llms.txt ('# Bitwarden — The most trusted open source password manager...'), and help pages ship real per-page .md mirrors — https://bitwarden.com/help/cli.md returns markdown starting '# Password Manager CLI'.",
            'fetchedAt': NOW,
        },
    ],
    '1password': [
        {
            'id': '1password-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.1password.dev/ai-readable-docs',
            'excerpt': "PROBE runtime (recorded 2026-09-15): 1Password's public docs MCP server at https://www.1password.dev/mcp completed a FULL keyless initialize handshake — serverInfo {\"name\":\"1Password Developer\",\"version\":\"1.0.0\"} ('The server is public and requires no authentication' per its own docs). A second official MCP, the Environments MCP Server (Beta), manages Environments 'without returning secrets to the agent'.",
            'fetchedAt': NOW,
        },
        {
            'id': '1password-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.1password.dev/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-15): 1password.dev serves llms.txt ('# 1Password Developer Documentation') plus llms-full.txt, and every docs page has a real .md mirror — https://www.1password.dev/cli/get-started.md returns markdown '# Get started with 1Password CLI'. support.1password.com serves its own llms.txt of support guides.",
            'fetchedAt': NOW,
        },
        {
            'id': '1password-probe-rt-3',
            'tier': 'probe',
            'url': 'https://www.1password.dev/cli/get-started',
            'excerpt': "PROBE runtime (recorded 2026-09-15): the official op CLI is packaged in Homebrew as the 1password-cli cask ('Command-line interface for 1Password', v2.39.0) — the scriptable surface behind service accounts, Connect, and secrets automation.",
            'fetchedAt': NOW,
        },
    ],
    'ente-auth': [
        {
            'id': 'ente-auth-probe-rt-1',
            'tier': 'probe',
            'url': 'https://ente.com/help/auth/migration/export',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Ente's official CLI is packaged in Homebrew as ente-cli 0.3.0, described by the formula itself as 'Utility for exporting data from Ente and decrypt the export from Ente Auth' — scriptable, keyless-to-install export tooling that makes the no-lock-in claim mechanically true.",
            'fetchedAt': NOW,
        },
        {
            'id': 'ente-auth-probe-rt-2',
            'tier': 'probe',
            'url': 'https://ente.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-15): ente.com serves a live llms.txt — '# Ente — Ente builds private, end-to-end encrypted apps for photos, two-factor authentication codes, and files. Ente's apps and server are open source...'.",
            'fetchedAt': NOW,
        },
    ],
    '2fas': [
        {
            'id': '2fas-probe-rt-1',
            'tier': 'probe',
            'url': 'https://2fas.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-15): 2fas.com serves the most agent-forward docs plumbing in the arena — llms.txt with a literal 'For AI agents — when to use 2FAS' section, modular per-section llms files, llms-full.txt, per-page .md mirrors (https://2fas.com/auth.md → '# 2FAS Auth — Free, Open-source 2FA Authenticator App'), Accept: text/markdown rendering, and machine-readable pricing at /.well-known/pricing.md. The same llms.txt honestly declares 'Public API: None' — local-first by design, no agent-callable endpoint for token generation.",
            'fetchedAt': NOW,
        },
        {
            'id': '2fas-probe-rt-2',
            'tier': 'probe',
            'url': 'https://2fas.com/.well-known/pricing.md',
            'excerpt': "PROBE runtime (recorded 2026-09-15): machine-readable pricing verified live at https://2fas.com/.well-known/pricing.md — '# 2FAS Pricing... 2FAS Auth — free forever... Price: $0 — no tiers, no premium, no in-app purchases, no advertising, no telemetry.'",
            'fetchedAt': NOW,
        },
    ],
    'authy': [
        {
            'id': 'authy-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.twilio.com/docs/authy',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Twilio's own docs page carries the deprecation notice verbatim — 'The Authy API is now closed to new customers and will be fully deprecated in the future.' — with Verify v2 as the designated successor. No programmatic surface remains open to new integrations.",
            'fetchedAt': NOW,
        },
    ],
}


def main() -> None:
    for pid, items in ITEMS.items():
        path = f'open-rankings/authenticator-apps/evidence/{pid}.json'
        with open(path) as f:
            evidence = json.load(f)
        have = {e['id'] for e in evidence}
        added = [i for i in items if i['id'] not in have]
        evidence.extend(added)
        with open(path, 'w') as f:
            json.dump(evidence, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f'{pid}: +{len(added)} probe runtime items')


if __name__ == '__main__':
    main()
