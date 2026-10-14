#!/usr/bin/env python3
# One-shot helper for the security-keys arena bring-up (2026-09-15): appends probe-tier
# evidence items distilled from the recorded runtime probes in open-rankings/security-keys/proofs/
# (see pipeline/probes/security-keys.ts — all 11 recorded probes passed, two of them
# deliberate negatives). Run AFTER `pnpm pipeline probe --category security-keys` — that
# stage wholesale-replaces probe-tier evidence and would wipe these items (re-run this
# script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'yubikey': [
        {
            'id': 'yubikey-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developers.yubico.com/yubikey-manager/',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Yubico's official ykman CLI installs keylessly from public registries and identifies itself — `uvx --from yubikey-manager ykman --version` → 'YubiKey Manager (ykman) version: 5.9.2'; Homebrew packages it as ykman ('Tool for managing your YubiKey configuration'). Full scriptable device management: enable applications, PINs, PIV/OATH/OTP slots, device info.",
            'fetchedAt': NOW,
        },
        {
            'id': 'yubikey-probe-rt-2',
            'tier': 'probe',
            'url': 'https://console.yubico.com/apidocs/',
            'excerpt': "PROBE runtime (recorded 2026-09-15): the YubiEnterprise 'YubiKey as a Service' REST API documentation is live and public at console.yubico.com/apidocs/ (page title verified keylessly) — the documented programmatic surface for fleet delivery, inventory, and shipment management.",
            'fetchedAt': NOW,
        },
        {
            'id': 'yubikey-probe-rt-3',
            'tier': 'probe',
            'url': 'https://developers.yubico.com/python-fido2/',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Yubico's python-fido2 SDK resolves on the public PyPI registry (fido2 2.2.1), alongside yubikey-manager 5.9.2 — the building blocks for integrating and automating the key from code.",
            'fetchedAt': NOW,
        },
        {
            'id': 'yubikey-probe-rt-4',
            'tier': 'probe',
            'url': 'https://docs.yubico.com/',
            'excerpt': "PROBE runtime negative (recorded 2026-09-15): Yubico publishes no llms.txt on any host — https://docs.yubico.com/llms.txt answers HTTP 404 (developers.yubico.com and www.yubico.com 404 as well), and appending .md to developers.yubico.com pages answers HTTP 300 'Multiple Choices', not markdown. Docs are human-oriented HTML only; no MCP endpoint exists (mcp.yubico.com does not resolve).",
            'fetchedAt': NOW,
        },
    ],
    'nitrokey': [
        {
            'id': 'nitrokey-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.nitrokey.com/software/nitropy/',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Nitrokey's official nitropy CLI installs keylessly from PyPI and identifies itself — `uvx --from pynitrokey nitropy version` → 'Command line tool to interact with Nitrokey devices' / 0.13.0. The official Python SDK also resolves on PyPI (nitrokey 0.4.2).",
            'fetchedAt': NOW,
        },
        {
            'id': 'nitrokey-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/Nitrokey/nitrokey-3-firmware/releases',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Nitrokey 3 firmware is open source in Rust WITH tagged, installable releases — https://github.com/Nitrokey/nitrokey-3-firmware/releases/latest resolves keylessly to /releases/tag/v1.8.3, and the docs ship a dedicated firmware-update guide. The direct contrast to sealed, non-updatable closed firmware.",
            'fetchedAt': NOW,
        },
    ],
    'solokeys': [
        {
            'id': 'solokeys-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/solokeys/solo1-cli',
            'excerpt': "PROBE runtime negative (recorded 2026-09-15): the official Solo CLI has bit-rotted — `uvx --from solo-python solo version` fails with 'ImportError: cannot import name CTAP1 from fido2.ctap1' (solo-python 0.1.1 is incompatible with current python-fido2 2.x), and the last tagged Solo 2 firmware release is 2.964.0 from 2022-08-25. Repos still receive dependency/CI commits (Aug 2026), but no firmware release in 4 years.",
            'fetchedAt': NOW,
        },
        {
            'id': 'solokeys-probe-rt-2',
            'tier': 'probe',
            'url': 'https://solokeys.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-15): solokeys.com serves an llms.txt ('# Agent Instructions — SoloKeys'), but it is Shopify's platform-generated shopping-agent file for the store (it recommends the shop.app SKILL.md) — NOT product or technical documentation. docs.solokeys.dev has no llms.txt (404).",
            'fetchedAt': NOW,
        },
    ],
    'token2': [
        {
            'id': 'token2-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/token2/fido2-manage',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Token2's open-source fido2-manage — 'An open-source FIDO2.1 key management tool (with a GUI) under different platforms' — is live on GitHub (112 stars, pushed 2026-09-11), alongside fido2_bulkenroll_entraid, a PowerShell bulk-enrollment tool for Entra ID. Unusually strong scriptable provisioning for a budget vendor; works against any CTAP2 key.",
            'fetchedAt': NOW,
        },
    ],
}


def main() -> None:
    for pid, items in ITEMS.items():
        path = f'open-rankings/security-keys/evidence/{pid}.json'
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
