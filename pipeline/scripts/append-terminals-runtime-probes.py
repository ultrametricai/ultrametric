#!/usr/bin/env python3
# One-shot helper for the terminals arena bring-up (2026-09-04): appends probe-tier evidence
# items distilled from the recorded runtime probes in rankings/terminals/proofs/ (see
# pipeline/probes/terminals.ts). Run AFTER `pnpm pipeline probe
# --category terminals` — that stage wholesale-replaces probe-tier evidence and would wipe
# these items (re-run this script after any probe refresh).
import json
import datetime

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'kitty': [
        {
            'id': 'kitty-probe-rt-1',
            'tier': 'probe',
            'url': 'https://sw.kovidgoyal.net/kitty/remote-control/',
            'excerpt': 'PROBE runtime (recorded 2026-09-04, kitty 0.48.2 via official installer): launched `kitty --detach -o allow_remote_control=socket-only --listen-on unix:/tmp/...`; `kitten @ ls` returned full window/tab/layout state as JSON, `kitten @ send-text "echo PA_PROBE_OK"` executed in the live window, `kitten @ get-text` read the output back, `kitten @ close-window` tore it down — complete external agent-control loop verified hands-on.',
            'fetchedAt': NOW,
        },
    ],
    'wezterm': [
        {
            'id': 'wezterm-probe-rt-1',
            'tier': 'probe',
            'url': 'https://wezterm.org/cli/cli/index.html',
            'excerpt': 'PROBE runtime (recorded 2026-09-04, wezterm 20240203 via brew cask): fully headless control loop verified — `wezterm-mux-server --daemonize`, then `wezterm cli spawn --new-window` returned a pane-id, `wezterm cli send-text --pane-id N "echo PA_PROBE_OK"` delivered, `wezterm cli get-text` read the pane content back, `wezterm cli list` enumerated windows/tabs/panes; no GUI session required.',
            'fetchedAt': NOW,
        },
    ],
    'ghostty': [
        {
            'id': 'ghostty-probe-rt-1',
            'tier': 'probe',
            'url': 'https://ghostty.org/docs',
            'excerpt': 'PROBE runtime (recorded 2026-09-04, Ghostty 1.3.1 via brew cask): `ghostty +list-actions` enumerates 85 bindable actions (new_split, new_tab, ...) and `ghostty +help` documents the +action CLI surface, but no remote-control/IPC interface was found — the macOS CLI supports config +actions only, so an external script or agent cannot send commands to or read output from a running Ghostty instance.',
            'fetchedAt': NOW,
        },
    ],
    'alacritty': [
        {
            'id': 'alacritty-probe-rt-1',
            'tier': 'probe',
            'url': 'https://formulae.brew.sh/cask/alacritty',
            'excerpt': 'PROBE runtime (2026-09-04): `brew install --cask alacritty` fails — Homebrew disabled the cask on 2026-09-01 because the published binaries do not pass the macOS Gatekeeper check; installing on macOS currently means building from source or manually bypassing Gatekeeper, so the runtime `alacritty msg` control probe could not be exercised.',
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'rankings/terminals/evidence/{pid}.json'
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
