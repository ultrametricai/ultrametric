#!/usr/bin/env python3
# Game-engines evidence-coverage repair for unreal, 2026-10-22 (maintainer-requested): the
# crawl seeded only 19 doc URLs, so the pack missed whole documented capability areas and 26
# of 57 stories judged "none" with rationales that say "nothing in the evidence pack
# documents..." for capabilities Epic publishes (physics, 2D, profiling, asset formats,
# version control, rendering, testing, ML inference). Same precedent as
# append-api-quality-gap-evidence-2026-10-21.py and append-kitty-docs-evidence.py: every URL
# below was live-fetched on 2026-10-22 with a plain HTTP client and every quoted fragment is
# verbatim from the fetched page. The same dev.epicgames.com URLs were added to unreal's
# urls.extra in open-rankings/game-engines/products.json.
#
# Bot-wall substitutions (house rule: document the wall, cite a reachable source):
#   - www.epicgames.com/site/en-US/privacypolicy answers HTTP 403 WAF challenges to
#     non-browser clients; the cited source is the Wayback Machine copy (20250813040822),
#     which serves the full policy text.
#   - fab.com answers WAF challenges to non-browser clients; the reachable source for the
#     marketplace is Epic's Fab documentation hub at dev.epicgames.com/documentation/en-us/fab.
#   - portal.productboard.com/epicgames/1-unreal-engine-public-roadmap is a JS-rendered
#     portal, but the raw HTML embeds the portal data payload; the quoted strings are
#     verbatim from that payload as fetched.
#
# Verified-honest counterparts (NO items added, on purpose — the figma/databricks precedent):
#   - agentic-scoped-keys: no credential or passphrase scheme is documented on any of the
#     Remote Control pages checked (landing, quick start, web application, HTTP reference,
#     WebSocket reference) — none of them mention "passphrase", "token", or authentication.
#   - api-machine-spec: no OpenAPI or equivalent machine-readable spec is published for the
#     Remote Control HTTP/WebSocket API; the references are HTML pages only.
#   - api-versioning-policy: no versioned-API or deprecation-policy page found; the Epic C++
#     Coding Standard never mentions UE_DEPRECATED or an API deprecation policy.
#   - privacy-telemetry-optout: no telemetry or usage-data opt-out is documented; the privacy
#     policy's only opt-outs cover marketing email and browser cookie settings.
#   - privacy-no-training: the privacy policy describes training ML models for content
#     moderation with no user opt-out, so it does not establish this capability.
#   - privacy-data-residency: the privacy policy's "Our Global Operations" section offers no
#     region or residency choice.
#   - official-ai-copilot / agentic-mcp-server / agentic-mcp-client / agentic-builtin-assistant /
#     agentic-nl-commands / agentic-ai-insights: no official Epic AI assistant or MCP surface
#     found; community MCP servers do not count.
#   - npm-installable-runtime, permissive-license-no-royalties, pricing-terms-stability,
#     browser-deployment: the existing evidence is honest (royalties and EULA-gated source
#     are already cited; no current first-party web-target docs exist); negatives stay
#     published.
import datetime
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = [
    # builtin-physics — Chaos Physics is first-party and documented.
    ('unreal-supp-chaos-physics',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/physics-in-unreal-engine',
     '"Chaos Physics is a light-weight physics simulation solution available in Unreal Engine, built from the ground up to meet the needs of next-generation games. The system includes the following major features: Destruction, Networked Physics, Chaos Visual Debugger, Rigid Body Dynamics ..." The page links "Collision — All about collision, collision responses, and collision presets in Unreal Engine" and "Traces with Raycasts — The landing page for Physics Traces."'),
    # first-class-2d — Paper 2D ships in the engine; the landing page is published under 4.27,
    # the Tile Sets/Tile Maps page is in the current 5.8 docs and flagged Experimental.
    ('unreal-supp-paper2d',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/paper-2d?application_version=4.27',
     '"Paper 2D in Unreal Engine 4 (UE4) is a sprite-based system for creating 2D and 2D/3D hybrid games entirely within the editor. At the core of Paper 2D are Sprites (which are a Texture Mapped Planar Mesh and associated Material)."'),
    ('unreal-supp-paper2d-tilemaps',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/paper-2d-tile-sets-and-tile-maps-in-unreal-engine',
     'Unreal Engine 5.8 documentation: "Tile Sets and Tile Maps within Paper 2D, provide a quick and easy way to layout the framework or \'general layout\' of your 2D levels. By creating and using a Tile Set (a collection of tiles pulled from a texture) with a Tile map (a 2D grid with a defined width and height in tiles), you can select various tiles to \'paint\' onto the Tile Map" — banner: "Learn to use this Experimental feature, but use caution when shipping with it."'),
    # performance-at-scale — profiler, ECS, task system.
    ('unreal-supp-unreal-insights',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-in-unreal-engine',
     '"Profile your project\'s performance with Unreal Insights." — "Unreal Insights is a telemetry capture and analysis suite that can capture events from your project at high data rates. Unreal Insights helps you identify areas of data that might require optimization."'),
    ('unreal-supp-mass-entity',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/mass-entity-in-unreal-engine',
     '"MassEntity is a gameplay-focused framework for data-oriented calculations." The section links "MassEntity Overview — Overview of Unreal Engine\'s MassEntity system", "MassGameplay Overview", and "Mass Debugger Overview — Learn how to use the Mass Debugger tool".'),
    ('unreal-supp-tasks-system',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/tasks-systems-in-unreal-engine',
     '"Tasks System is a job manager that provides the capability to execute your gameplay code asynchronously." — "Tasks System and TaskGraph both use the same backend (the scheduler and worker threads). The main features are: Launching a task by providing a callable object that needs to be executed asynchronously. Waiting for task completion and/or retrieving the task execution result. Specifying task prerequisites."'),
    # standard-asset-formats — FBX, glTF, USD.
    ('unreal-supp-fbx-pipeline',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/fbx-content-pipeline',
     '"Information on using the FBX content import pipeline for meshes, animations, materials, and textures." — "Unreal Engine supports a variety of file formats for importing content into your project. FBX is a flexible file format that is owned by Autodesk and provides interoperability between digital content creation (DCC) applications."'),
    ('unreal-supp-gltf',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/the-gl-transmission-format-gltf-in-unreal-engine',
     '"Importing and Exporting Unreal Engine Content using the glTF file format" — "GL Transmission Format (glTF™) is an extensible, open-standard file format developed and maintained by Khronos Group. It is designed to create compact files that load quickly, and represent scenes completely."'),
    ('unreal-supp-usd',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/universal-scene-description-usd-in-unreal-engine',
     '"Importing and Editing Content using Universal Scene Description (USD) in Unreal Engine" — "The Universal Scene Description (USD) interchange format is an open-source format developed by Pixar" — banner: "Learn to use this Beta feature, but use caution when shipping with it."'),
    # collaboration-versioning (and rollback of scripted automations, which live as assets
    # and files under the same version control).
    ('unreal-supp-perforce',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/using-perforce-as-source-control-for-unreal-engine',
     '"Unreal Engine (UE) comes with an integrated method that allows people to work together on their projects using version control software called Perforce. Source Control allows users on your team to share assets and code with one another, as well as providing a backup and history of changes so any files can be rolled back to an earlier version if something went wrong with the file."'),
    ('unreal-supp-version-control',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/collaboration-and-version-control-in-unreal-engine',
     '"How to setup Perforce or SVN so that you can share assets with other on your team." — "Unreal Engine comes with two fully-integrated methods that allow people to work together on their projects using version control software like Perforce and SVN."'),
    ('unreal-supp-multi-user-editing',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/multi-user-editing-in-unreal-engine',
     '"Get multiple users on different computers into a shared Unreal Editor session, collaborating live to build content together." — "With Multi-User Editing, you can connect multiple instances of Unreal Editor together to work collaboratively in a shared editing session, building a single virtual world together with your teammates" — banner: "Learn to use this Beta feature, but use caution when shipping with it."'),
    # scripting-machine-tooling — generated Python type stubs plus a keylessly fetchable
    # generated API reference.
    ('unreal-supp-python-stubs',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-autocomplete-for-unreal-editor-python-scripting',
     '"Setting up Autocomplete for Unreal Editor Python Scripting" — "Before setting up autocomplete, you will need to tell the Unreal Engine (UE) Python Plugin to generate the necessary stubs. You can do this by checking Developer Mode in Editor Preferences > Plugins > Python, then restarting the editor. The generated stub file will be located at PROJECT_DIRECTORY/Intermediate/PythonStub", with per-IDE setup starting with PyCharm.'),
    ('unreal-supp-python-api-reference',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/',
     '"Unreal Python API Documentation" (Unreal Python 5.8, marked Experimental): "Python API sections: Modules, Native Types, Struct Types, Class Types, Enum Types" — a generated per-class/per-function reference that serves full HTML to plain non-browser clients.'),
    # agentic-webhooks — what IS documented: event subscription pushed over the engine's
    # WebSocket connection, not outbound HTTP webhook delivery.
    ('unreal-supp-ws-preset-events',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/remote-control-api-websocket-reference-for-unreal-engine',
     '"WebSocket Message Type - Preset.Register — Use this message type to subscribe to events emitted by a Remote Control Preset. Example JSON message: { \\"MessageName\\": \\"preset.register\\", \\"Parameters\\": { \\"PresetName\\": \\"MyPreset\\" } } The following sections describe the events that are emitted by the preset". Events are pushed over the engine\'s own WebSocket connection; no outbound HTTP webhook delivery is documented.'),
    # runtime-ml-inference — Neural Network Engine (NNE).
    ('unreal-supp-nne',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/neural-network-engine-in-unreal-engine',
     '"The Neural Network Engine (NNE) provides a common API to access different neural network runtimes, and to evaluate neural networks without the need of runtime specific coding. NNE has various uses that can be applied to real-time inference to augment a game with artificial intelligence (AI) and to implement editor-based features as asset operations, queries, and artist-assisting tools." — banner: "Learn to use this Beta feature, but use caution when shipping with it."'),
    # dedicated-server-runtime — explicit headless, no-rendering server build.
    ('unreal-supp-dedicated-servers',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-dedicated-servers-in-unreal-engine',
     '"Set up and run a dedicated server for your project." — "A dedicated server consists of a server that runs headlessly. This means that there are no clients playing directly in the dedicated server game instance. Every player comes from a connected, remote client. A headless server does not render any visuals and nobody is playing locally on the headless server."'),
    # headless-test-runs — unit/feature test framework plus the Gauntlet session runner.
    ('unreal-supp-automation-tests',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine',
     '"Automation Test Framework — Overview of the automation system used for unit testing, feature testing, and content stress testing." Smoke tests "are intended to be fast so they can run every time the Editor, game, or commandlet starts."'),
    ('unreal-supp-gauntlet',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/gauntlet-automation-framework-in-unreal-engine',
     '"Gauntlet is a framework to run sessions of projects in Unreal Engine that perform tests and validate results. It is specifically designed for, but not limited to, running Unreal sessions on a variety of platforms. An Unreal session is all of the processes needed to execute a game with the Unreal engine. For example, a multiplayer game may require four clients and a server."'),
    # fast-iteration-loop — Live Coding.
    ('unreal-supp-live-coding',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/using-live-coding-to-recompile-unreal-engine-applications-at-runtime',
     '"Unreal Engine (UE) supports Live Coding using an integration of Live++. Live Coding is a system that can rebuild your application\'s C++ code and patch its binaries while the engine is running. This functionality is available during the following scenarios: Editing your application in Unreal Editor. Running your application with Play In Editor (PIE)."'),
    # modern-3d-rendering — Lumen, Nanite, PBR materials, post-processing.
    ('unreal-supp-lumen',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine',
     '"Lumen is Unreal Engine\'s fully dynamic global illumination and reflections system that is designed for next-generation consoles, and it is the default global illumination and reflections system. Lumen renders diffuse interreflection with infinite bounces and indirect specular reflections in large, detailed environments."'),
    ('unreal-supp-nanite',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/nanite-virtualized-geometry-in-unreal-engine',
     '"Nanite is Unreal Engine\'s virtualized geometry system which uses an internal mesh format and rendering technology to render pixel scale detail and high object counts. It intelligently does work on only the detail that is visible on-screen and no more."'),
    ('unreal-supp-pbr-materials',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/physically-based-materials-in-unreal-engine',
     '"An overview of the primary physically based Material inputs and how best to use them." — "Physically based rendering (PBR) means that surfaces approximate the way light behaves in the real world, as opposed to the way we intuitively think it should. Materials that adhere to PBR principles are more accurate and typically more natural looking."'),
    ('unreal-supp-post-process',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/post-process-effects-in-unreal-engine',
     '"Post Process Effects — Learn about the effects that can be applied through placed-volumes and cameras." — "The Lens category contains properties and settings that simulate common real-world effects from a camera lens. Similar to what happens with real-world cameras, Depth of Field applies a blur to a scene based on the distance in front of, or behind, a focal point", alongside auto exposure and bloom controls.'),
    # multi-platform-export — named desktop/mobile targets plus a console deploy tool.
    ('unreal-supp-platform-targets',
     'https://dev.epicgames.com/documentation/en-us/unreal-engine/sharing-and-releasing-projects-for-unreal-engine',
     '"Information on publishing projects on platforms supported by Unreal Engine." — "This section contains guides for packaging and releasing projects for all of the platforms that Unreal Engine supports." It links "Launching to Devices — One-click deploying your project to devices like iOS and Android for testing" and "Unreal Frontend — Tool for managing applications and deploying to consoles."'),
    # asset-marketplace — Fab, Epic's marketplace; fab.com itself answers WAF challenges to
    # non-browser clients, so the reachable source is Epic's Fab documentation hub.
    ('unreal-supp-fab-marketplace',
     'https://dev.epicgames.com/documentation/en-us/fab',
     '"Fab is Epic\'s open marketplace, providing all digital content creators with a single destination to discover, share, buy, and sell digital assets. Creators who sell their work on Fab earn an industry-leading 88% revenue share. The goal of Fab is to provide high-quality, ready-to-use content suitable for all developers and creators, from students to AAA studios."'),
    # privacy-retention-controls — Epic's privacy policy covers Unreal Engine and documents
    # retention criteria and deletion rights. Live URL answers HTTP 403 WAF challenges to
    # non-browser clients; the archived copy is the reachable source.
    ('unreal-supp-privacy-retention',
     'http://web.archive.org/web/20250813040822/https://www.epicgames.com/site/en-US/privacypolicy',
     'Epic privacy policy (live www.epicgames.com/site/en-US/privacypolicy answers HTTP 403 to non-browser clients; archived copy cited). Scope includes "developer tools, including the Developer Portal and Unreal Engine". "7. RETENTION — We generally store personal information for as long as we reasonably need it for the purposes described in this policy". "Data Subject Rights — You may have the right to access, correct, or delete personal data we have collected about you through the Epic Services."'),
    # open-governance-funding — Epic publishes a public product roadmap for Unreal Engine.
    ('unreal-supp-public-roadmap',
     'https://portal.productboard.com/epicgames/1-unreal-engine-public-roadmap',
     'Epic\'s roadmap portal (JS-rendered; strings quoted verbatim from the fetched page\'s embedded data payload): "portalName":"Unreal Engine Public Roadmap", "publiclyAccessible":true, with per-release feature entries such as "Unreal Engine 5.2 contains many improvements in capability, stability, and performance."'),
]

EXTRA_URLS = [
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/physics-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/paper-2d-tile-sets-and-tile-maps-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/mass-entity-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/tasks-systems-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/fbx-content-pipeline',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/the-gl-transmission-format-gltf-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/universal-scene-description-usd-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/using-perforce-as-source-control-for-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/collaboration-and-version-control-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/multi-user-editing-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-autocomplete-for-unreal-editor-python-scripting',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/neural-network-engine-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-dedicated-servers-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/gauntlet-automation-framework-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/using-live-coding-to-recompile-unreal-engine-applications-at-runtime',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/nanite-virtualized-geometry-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/physically-based-materials-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/post-process-effects-in-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/unreal-engine/sharing-and-releasing-projects-for-unreal-engine',
    'https://dev.epicgames.com/documentation/en-us/fab',
]


def main() -> None:
    ef = os.path.join(ROOT, 'open-rankings', 'game-engines', 'evidence', 'unreal.json')
    ev = json.load(open(ef))
    have = {e['id'] for e in ev}
    added = 0
    for iid, url, excerpt in ITEMS:
        if iid in have:
            continue
        ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        added += 1
    if added:
        with open(ef, 'w') as f:
            f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
    print(f'game-engines/unreal: +{added} evidence items ({len(ev)} total)')

    pf = os.path.join(ROOT, 'open-rankings', 'game-engines', 'products.json')
    products = json.load(open(pf))
    for p in products:
        if p['id'] != 'unreal':
            continue
        extra = p['urls'].setdefault('extra', [])
        new_urls = [u for u in EXTRA_URLS if u not in extra]
        extra.extend(new_urls)
        if new_urls:
            with open(pf, 'w') as f:
                f.write(json.dumps(products, indent=2, ensure_ascii=False) + '\n')
        print(f'game-engines/products.json: +{len(new_urls)} urls.extra entries for unreal')


if __name__ == '__main__':
    main()
