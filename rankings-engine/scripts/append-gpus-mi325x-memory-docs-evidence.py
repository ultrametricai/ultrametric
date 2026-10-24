#!/usr/bin/env python3
# gpus refresh review follow-up (2026-10-23, PR #455): the generic extraction captured the
# MI325X row of the ROCm GPU-specs table without its column headers
# (amd-mi325x-docs-21: "MI325X CDNA3 gfx942 256 304 (38 per XCD) 64"), so the memory verdicts
# had to guess what "256" meant. This appends labeled claimed-docs evidence — the
# supp-evidence precedent (append-startup-law-firms-docs-evidence.py): verbatim passages the
# generic pass missed, fetched live by this script so every excerpt states what was observed.
#
#   1. The same ROCm table row re-quoted WITH its column headers, in the table's own order
#      (rocm.docs.amd.com/en/latest/reference/gpu-arch-specs.html, "AMD Instinct GPUs":
#      Name / Architecture / LLVM target name / VRAM (GiB) / Compute Units / Wavefront Size).
#   2. The AMD Instinct system-acceptance page's prose memory spec for the MI325X
#      (instinct.docs.amd.com), which states capacity and memory type per accelerator.
#
# Both hosts answer the standard pipeline UA (the www.amd.com front door does not — see
# append-gpus-amd-wall-probes.py). Ids continue the pack's docs-N numbering. Idempotent by id.
# Re-judge amd-mi325x and re-derive after running this.
import json
import os
import sys
import urllib.request

UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'gpus', 'evidence', 'amd-mi325x.json')

ITEMS = [
    {
        'id': 'amd-mi325x-docs-22',
        'url': 'https://rocm.docs.amd.com/en/latest/reference/gpu-arch-specs.html',
        'must_contain': ['MI325X', 'VRAM (GiB)'],
        'excerpt': (
            'AMD GPU specifications, "AMD Instinct GPUs" table (columns in table order: Name; '
            'Architecture; LLVM target name; VRAM (GiB); Compute Units; Wavefront Size) — MI325X row: '
            'Name: MI325X; Architecture: CDNA3; LLVM target name: gfx942; VRAM (GiB): 256; '
            'Compute Units: 304 (38 per XCD); Wavefront Size: 64.'
        ),
    },
    {
        'id': 'amd-mi325x-docs-23',
        'url': 'https://instinct.docs.amd.com/projects/system-acceptance/en/latest/gpus/mi325x.html',
        'must_contain': ['256GB of HBM3 memory per accelerator'],
        'excerpt': (
            'AMD Instinct MI325X system acceptance guide: "configuration that hosts 8 AMD Instinct '
            'MI325X OAM (OCP Accelerator Module) accelerators with a total of 2TB of HBM3 memory. '
            'Each MI325X GPU features multiple chiplet design with 8 XCDs (Accelerator Complex Dies) '
            'and 256GB of HBM3 memory per accelerator. It utilizes AMD’s CDNA 3 architecture with '
            'fully-meshed Infinity Fabric™ connectivity between accelerators."'
        ),
    },
]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode('utf-8', 'replace')


ev = json.load(open(PATH))
existing = {e['id'] for e in ev}
changed = False
for item in ITEMS:
    if item['id'] in existing:
        print(f"{item['id']}: already present, skipping")
        continue
    page = fetch(item['url'])
    flat = ' '.join(page.split())
    for needle in item['must_contain']:
        if needle not in flat:
            sys.exit(f"ABORT: {item['url']} no longer contains {needle!r} — refresh the excerpt before appending")
    fetched_at = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    ev.append({
        'id': item['id'],
        'tier': 'claimed-docs',
        'url': item['url'],
        'excerpt': item['excerpt'],
        'fetchedAt': fetched_at,
    })
    changed = True
    print(f"{item['id']}: appended (source verified live)")

if changed:
    with open(PATH, 'w') as f:
        json.dump(ev, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'wrote {PATH}')
else:
    print('no changes')
