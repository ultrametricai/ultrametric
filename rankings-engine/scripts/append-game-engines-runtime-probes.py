#!/usr/bin/env python3
# Helper for the game-engines arena (bring-up 2026-09-15, accuracy wave 2026-09-23): upserts
# probe-tier evidence items distilled from the recorded runtime probes in
# open-rankings/game-engines/proofs/ (see rankings-engine/probes/game-engines.ts) plus MCP/CLI-landscape facts
# verified live via keyless GitHub/npm/UPM API calls (official vs community attribution
# matters — the founder asked for agenticness measured honestly). The 2026-09-23 wave added
# Unity's first-party CLI (`unity mcp` / `unity eval`, the announced replacement for the
# deprecated in-editor MCP server), Unity's keyless UPM registry, Epic's new-but-flaky
# llms.txt files, and Godot's built-in LSP counterweight. Run AFTER
# `pnpm engine probe --category game-engines` — that stage wholesale-replaces probe-tier
# evidence and would wipe these items.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'unity': [
        {
            'id': 'unity-probe-rt-1',
            'tier': 'probe',
            'url': 'https://unity.com/features/ai',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Unity ships an OFFICIAL MCP server as part of Unity's AI tools (beta) inside the com.unity.ai.assistant package — unity.com/features/ai links 'View MCP Docs' to the package manual's unity-mcp-get-started page (verified live), and the Personal plan page lists \"Unity's MCP\" as included. Closed distribution: no public repo (GitHub search `mcp org:Unity-Technologies` → 0 results) and no standalone package, so no keyless handshake is possible; AI usage is metered via Unity Credits. Community MCP is the largest of any engine: CoplayDev/unity-mcp, 14,243 stars, pushed 2026-09-05.",
            'fetchedAt': NOW,
        },
        {
            'id': 'unity-probe-rt-2',
            'tier': 'probe',
            'url': 'https://unity.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-15): unity.com serves a site-root llms.txt ('# Unity — Develop, deploy, and grow with Unity...'), but docs.unity3d.com has none (HTTP 404) and manual pages have no .md mirrors — the marketing site is machine-readable, the actual documentation is not.",
            'fetchedAt': NOW,
        },
        {
            'id': 'unity-probe-rt-3',
            'tier': 'probe',
            'url': 'https://unity.com/download',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Unity Hub installs keylessly from Homebrew (cask unity-hub 3.21.2, 'Management tool for Unity') — the entry point to the editor whose -batchmode/-nographics CLI is documented for headless CI builds.",
            'fetchedAt': NOW,
        },
        {
            'id': 'unity-probe-rt-4',
            'tier': 'probe',
            'url': 'https://docs.unity.com/en-us/unity-cli',
            'excerpt': "PROBE runtime (recorded 2026-09-23): Unity now ships a first-party standalone CLI (experimental) with a public keyless install script — `curl -fsSL https://unity.com/install.sh | bash` serves '# Unity CLI Installer' (verified live) — plus Homebrew/deb/rpm/MSIX distribution for headless CI workers, structured JSON/TSV output and documented exit codes. Its docs section serves its own llms.txt ('# Unity command-line interface (CLI)'). Docs state the in-editor MCP server (com.unity.ai.assistant) is DEPRECATED in favor of this CLI: `unity mcp` is the CLI's own fully-supported MCP server mode, and `unity <command>`/`unity eval` drive the Editor directly without MCP ('faster and use fewer tokens than MCP. Use these commands if your agent can run shell commands').",
            'fetchedAt': NOW,
        },
        {
            'id': 'unity-probe-rt-5',
            'tier': 'probe',
            'url': 'https://packages.unity.com/com.unity.ai.assistant',
            'excerpt': "PROBE runtime (recorded 2026-09-23): Unity's UPM registry answers keyless JSON — packages.unity.com/com.unity.ai.assistant resolves the in-editor AI Assistant package (latest 2.20.0-pre.1, the package that ships Unity's official MCP server bridge and AI gateway integration), and packages.unity.com/com.unity.ai.inference resolves Sentis, 'a neural network inference library' for on-device ML in games. docs.unity.com also serves a site-wide llms.txt index ('# Unity Documentation').",
            'fetchedAt': NOW,
        },
    ],
    'godot': [
        {
            'id': 'godot-probe-rt-1',
            'tier': 'probe',
            'url': 'https://godotengine.org/download/',
            'excerpt': "PROBE runtime (recorded 2026-09-15): Godot installs keylessly from Homebrew (cask godot 4.7.2, '2D and 3D game engine') — one command to the binary that runs `godot --headless` for CI builds, exports, and scripted editor automation.",
            'fetchedAt': NOW,
        },
        {
            'id': 'godot-probe-rt-2',
            'tier': 'probe',
            'url': 'https://godotengine.org/asset-library/asset',
            'excerpt': "PROBE runtime (recorded 2026-09-15): the Godot Asset Library exposes a keyless JSON API — GET godotengine.org/asset-library/api/asset?godot_version=4.3 returns structured asset records ({\"result\":[{\"asset_id\":...}) an agent can query directly.",
            'fetchedAt': NOW,
        },
        {
            'id': 'godot-probe-rt-3',
            'tier': 'probe',
            'url': 'https://godotengine.org/',
            'excerpt': "PROBE runtime negative (recorded 2026-09-15): godotengine.org serves no llms.txt (HTTP 404; docs.godotengine.org 404 as well) and docs pages have no .md mirrors. No official MCP exists (GitHub search `mcp org:godotengine` → 0 results); the community scene is large but fragmented — Coding-Solo/godot-mcp (5,698 stars) idle since 2026-04-16, hi-godot/godot-ai (2,437 stars) actively pushed 2026-09-15, three more repos at 600-800 stars.",
            'fetchedAt': NOW,
        },
        {
            'id': 'godot-probe-rt-4',
            'tier': 'probe',
            'url': 'https://godotengine.org/asset-library/api/asset?filter=mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-23): MCP landscape re-verified — still no official Godot MCP (GitHub search `mcp org:godotengine` → 0 results; the keyless Asset Library API search for 'mcp' returns an empty result set, so the community MCP servers live only on GitHub, outside Godot's own distribution channel). Coding-Solo/godot-mcp now 5,803 stars but still idle since 2026-04-16. Counterweight verified in official docs: Godot ships a BUILT-IN GDScript language server (LSP) any external editor or agent tooling can attach to, and godotengine/godot-vscode-plugin (official org, 2,130 stars, pushed 2026-09-10) is its first-party LSP client.",
            'fetchedAt': NOW,
        },
    ],
    'threejs': [
        {
            'id': 'threejs-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.npmjs.com/package/three',
            'excerpt': "PROBE runtime (recorded 2026-09-15): `npm view three version` → 0.186.0, and the public npm downloads API reports 12,206,532 weekly downloads — an order of magnitude above every other engine in the arena. MIT license verified from the registry.",
            'fetchedAt': NOW,
        },
        {
            'id': 'threejs-probe-rt-2',
            'tier': 'probe',
            'url': 'https://threejs.org/docs/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-15): threejs.org publishes llms.txt at the site root pointing to a docs llms.txt that carries a literal '## Instructions for Large Language Models' section plus a 363 KB llms-full.txt of the complete docs. Caveat recorded honestly: human doc pages are hash-routed (no per-page static URLs) — the llms files are the machine path. No three.js MCP exists, official or notable community; coding agents drive the library directly through npm.",
            'fetchedAt': NOW,
        },
    ],
    'babylonjs': [
        {
            'id': 'babylonjs-probe-rt-1',
            'tier': 'probe',
            'url': 'https://doc.babylonjs.com/setup/frameworkPackages/npmSupport',
            'excerpt': "PROBE runtime (recorded 2026-09-15): `npm view @babylonjs/core version` → 9.26.1 (Apache-2.0, 234,040 weekly downloads via the public npm API), and BOTH doc.babylonjs.com and www.babylonjs.com serve llms.txt files.",
            'fetchedAt': NOW,
        },
        {
            'id': 'babylonjs-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.babylonjs.com/',
            'excerpt': "PROBE runtime negative (recorded 2026-09-15): despite Microsoft parentage, Babylon.js has essentially no MCP ecosystem — no official server, and the largest community repo has 9 stars (davidvanstory/babylonjs-mcp, idle since 2025-07). Docs pages are client-rendered Next.js with no .md mirrors.",
            'fetchedAt': NOW,
        },
    ],
    'bevy': [
        {
            'id': 'bevy-probe-rt-1',
            'tier': 'probe',
            'url': 'https://bevy.org/learn/quick-start/getting-started/setup/',
            'excerpt': "PROBE runtime (recorded 2026-09-15): bevy resolves on crates.io — `cargo search bevy` → 'bevy = \"0.19.1\" # A refreshingly simple data-driven game engine and app framework', and the keyless crates.io API reports max_stable_version 0.19.1, 1,478,352 downloads in 90 days, license 'MIT OR Apache-2.0'. Pre-1.0 with breaking changes each release — a real caveat for agents trained on older APIs.",
            'fetchedAt': NOW,
        },
        {
            'id': 'bevy-probe-rt-2',
            'tier': 'probe',
            'url': 'https://bevy.org/',
            'excerpt': "PROBE runtime negative (recorded 2026-09-15): bevy.org serves no llms.txt (HTTP 404; docs.rs likewise) and no official MCP exists — community tooling is nascent (natepiano/bevy_brp, 70 stars, built on the first-party Bevy Remote Protocol). Counterweight: docs.rs/bevy gives fully static, crawlable API docs, and the code-first cargo workflow needs no editor for an agent to drive.",
            'fetchedAt': NOW,
        },
    ],
    'playcanvas': [
        {
            'id': 'playcanvas-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developer.playcanvas.com/user-manual/editor/mcp-server/',
            'excerpt': "PROBE runtime (recorded 2026-09-15): PlayCanvas ships the only OFFICIAL, open, npm-published editor MCP server of the eight engines — `npm view @playcanvas/editor-mcp-server version` → 0.7.1, source at playcanvas/editor-mcp-server (official org, 137 stars, pushed 2026-09-09, 'MCP Server for AI automation of the PlayCanvas Editor'), documented in the user manual.",
            'fetchedAt': NOW,
        },
        {
            'id': 'playcanvas-probe-rt-2',
            'tier': 'probe',
            'url': 'https://developer.playcanvas.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-15): developer.playcanvas.com serves llms.txt plus the largest llms-full.txt of the arena (2,053,637 bytes of complete docs), and `npm view playcanvas version` → 2.22.2 (MIT engine runtime, 48,435 weekly downloads). A scriptable Editor API is separately documented at api.playcanvas.com/editor/.",
            'fetchedAt': NOW,
        },
    ],
    'phaser': [
        {
            'id': 'phaser-probe-rt-1',
            'tier': 'probe',
            'url': 'https://phaser.io/agent/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-15): `npm view phaser version` → 4.2.1 (MIT, 263,018 weekly downloads), and phaser.io/llms.txt is live as a programmatic examples-API index ('# Phaser Examples Index... For full metadata and source code, use the API: GET /api/v1/examples/{id}'). Phaser Studio's official MCP rides its hosted Game Agent (phaser.io/agent/mcp 'Connect your coding agent'); no @phaserjs MCP package exists on npm (E404, recorded). Caveat: phaser.io root 403s non-browser clients — deep links and a browser UA required.",
            'fetchedAt': NOW,
        },
    ],
    'unreal': [
        {
            # 2026-09-23 correction: the original 2026-09-15 recording said "no llms.txt
            # exists" — that is no longer true (see unreal-probe-rt-2), so the claim was
            # removed from this item rather than left standing. Everything else re-verified.
            'id': 'unreal-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/EpicGames/UnrealEngine',
            'excerpt': "PROBE runtime negative (recorded 2026-09-15, revised 2026-09-23): Unreal is the least machine-readable presence of the eight — api.github.com/repos/EpicGames/UnrealEngine answers {\"message\": \"Not Found\"} keylessly (source access is EULA/account-gated), unrealengine.com/epicgames.com/fab.com return HTTP 403 to most non-browser clients, and appending .md to dev.epicgames.com docs URLs serves the HTML SPA shell, not markdown. No official Epic MCP (GitHub search `mcp org:EpicGames` → 0 results, re-verified 2026-09-23); the most-starred community MCP (chongdashu/unreal-mcp, 2,084 stars) has been unmaintained since 2025-04, and kvick-games/UnrealMCP (612 stars) since 2025-06. Counterweight: the Python editor-scripting docs, Remote Control API references, and UAT/automation CLI docs on dev.epicgames.com/documentation ARE fetchable keylessly.",
            'fetchedAt': NOW,
        },
        {
            'id': 'unreal-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.unrealengine.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-23): Epic now serves llms.txt on BOTH www.unrealengine.com ('# Unreal Engine — Epic Games' real-time 3D creation tool...') and dev.epicgames.com ('# Epic Developer Community'), verified live. Caveat recorded honestly: Epic's CDN intermittently WAF-challenges non-browser clients — identical back-to-back requests alternate between the llms.txt content and an HTTP 403 challenge page (curl, node fetch, and python urllib all affected), so the surface exists but is unreliable for agents without a browser-grade client.",
            'fetchedAt': NOW,
        },
    ],
}


def main() -> None:
    for pid, items in ITEMS.items():
        path = f'open-rankings/game-engines/evidence/{pid}.json'
        with open(path) as f:
            evidence = json.load(f)
        # Upsert by id (2026-09-23): re-appending is not enough once a recorded fact needs a
        # dated correction (unreal-probe-rt-1's "no llms.txt exists" stopped being true), so an
        # existing item whose excerpt drifted from this script is rewritten in place — same id,
        # citations stay resolvable, the correction is visible in the excerpt itself.
        by_id = {e['id']: e for e in evidence}
        added = updated = 0
        for item in items:
            if item['id'] not in by_id:
                evidence.append(item)
                added += 1
            elif by_id[item['id']]['excerpt'] != item['excerpt']:
                by_id[item['id']].update({k: v for k, v in item.items() if k != 'fetchedAt'})
                updated += 1
        with open(path, 'w') as f:
            json.dump(evidence, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f'{pid}: +{added} probe runtime items, {updated} revised')


if __name__ == '__main__':
    main()
