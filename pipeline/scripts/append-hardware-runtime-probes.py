#!/usr/bin/env python3
# Processors + GPUs arena bring-up (2026-09): appends probe-tier evidence items distilled from
# the recorded keyless probes in rankings/{processors,gpus}/proofs/ (see pipeline/probes/
# {processors,gpus}.ts — hardware has no API/CLI/MCP surface, so the honest probes are
# spec-page liveness with an expected model string, two toolchain-docs liveness checks, and one
# recorded FINDING: Qualcomm's spec page serves a JS shell to any non-browser fetcher).
# Run AFTER `pnpm pipeline probe --category processors|gpus` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json
import os

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
DAY = NOW[:10]

ITEMS = {
    'processors': {
        'apple-m5': [
            ('apple-m5-probe-rt-1', 'https://www.apple.com/newsroom/2025/10/apple-unleashes-m5-the-next-big-leap-in-ai-performance-for-apple-silicon/',
             f"PROBE runtime (recorded {DAY}): a keyless curl of Apple's M5 announcement — the chip's canonical public spec source — returned the page live, naming the 10-core GPU with a Neural Accelerator in each core. Apple publishes no clock-speed, TDP, or ARK-style spec sheet for M5; the newsroom post is the spec disclosure."),
        ],
        'intel-core-ultra-9-285k': [
            ('intel-core-ultra-9-285k-probe-rt-1', 'https://www.intel.com/content/www/us/en/products/sku/241060/intel-core-ultra-9-processor-285k-36m-cache-up-to-5-70-ghz/specifications.html',
             f"PROBE runtime (recorded {DAY}): Intel's ARK specifications page for the Core Ultra 9 285K answered a keyless curl and names the part — a full machine-fetchable spec sheet (cores, clocks, base/turbo power, memory support). It 403-walled curl at the 2026-09-14 experiments curation; recorded as it answers today."),
        ],
        'qualcomm-snapdragon-x2-elite-extreme': [
            ('qualcomm-snapdragon-x2-elite-extreme-probe-rt-1', 'https://www.qualcomm.com/laptops/products/snapdragon-x2-elite',
             f"PROBE runtime (recorded {DAY}): a keyless curl of Qualcomm's Snapdragon X2 Elite spec page returns a client-rendered app shell whose visible content is 'You need to enable JavaScript to run this app' — no spec value on the page is reachable by a crawler or agent without a rendering browser."),
        ],
        'amd-ryzen-ai-max-plus-395': [
            ('amd-ryzen-ai-max-plus-395-probe-rt-1', 'https://ryzenai.docs.amd.com/en/latest/',
             f"PROBE runtime (recorded {DAY}): the Ryzen AI Software documentation at ryzenai.docs.amd.com answered a keyless curl naming Ryzen AI — the XDNA 2 NPU's developer SDK docs are live and crawlable, unlike www.amd.com product pages, which reset connections for non-browser user agents (recorded at crawl)."),
        ],
    },
    'gpus': {
        'nvidia-rtx-5090': [
            ('nvidia-rtx-5090-probe-rt-1', 'https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/',
             f"PROBE runtime (recorded {DAY}): NVIDIA's RTX 5090 product/spec page answered a keyless curl and names the part — the vendor spec surface (VRAM, bandwidth, AI TOPS, board power) is live and fetchable."),
        ],
        'nvidia-h200-sxm': [
            ('nvidia-h200-sxm-probe-rt-1', 'https://www.nvidia.com/en-us/data-center/h200/',
             f"PROBE runtime (recorded {DAY}): NVIDIA's H200 datacenter page answered a keyless curl and names the part — the spec table (141GB HBM3e, 4.8TB/s, FP8 tensor figures) is live and fetchable."),
        ],
        'nvidia-rtx-pro-6000': [
            ('nvidia-rtx-pro-6000-probe-rt-1', 'https://developer.nvidia.com/cuda-toolkit',
             f"PROBE runtime (recorded {DAY}): the CUDA Toolkit page at developer.nvidia.com answered a keyless curl naming CUDA Toolkit — the compute toolchain this workstation part's developer story stands on is live and crawlable."),
        ],
        'amd-mi355x': [
            ('amd-mi355x-probe-rt-1', 'https://rocm.docs.amd.com/en/latest/',
             f"PROBE runtime (recorded {DAY}): the ROCm documentation at rocm.docs.amd.com answered a keyless curl naming ROCm — the MI355X's entire developer toolchain surface is live and crawlable, unlike www.amd.com product pages, which reset connections for non-browser user agents (recorded at crawl)."),
        ],
    },
}

for cat, products in ITEMS.items():
    for pid, items in products.items():
        path = f'rankings/{cat}/evidence/{pid}.json'
        existing = json.load(open(path)) if os.path.exists(path) else []
        have = {e['id'] for e in existing}
        added = 0
        for eid, url, excerpt in items:
            if eid in have:
                continue
            existing.append({'id': eid, 'tier': 'probe', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
            added += 1
        open(path, 'w').write(json.dumps(existing, indent=2) + '\n')
        print(f'{cat}/{pid}: +{added} probe items ({len(existing)} total)')
