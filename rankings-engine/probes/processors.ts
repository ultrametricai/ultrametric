import type { LocalProbe } from './types'

// Processors arena: hardware has almost no keyless probeable surface — no APIs, no CLIs, no MCP
// servers — so the only honest local probes are "the vendor's own spec page is live and names
// the part" checks, plus one developer-surface check (the Ryzen AI SDK docs the NPU story leans
// on). One probe records a spec-transparency FINDING rather than a pass: qualcomm.com is a
// client-rendered app whose spec page serves only a "You need to enable JavaScript to run this
// app" shell to any non-browser fetcher — recorded reality wins. All probes are keyless,
// read-only curls; nothing installs or mutates state.
export const probes: LocalProbe[] = [
  {
    // Apple's M5 announcement (the chip's canonical spec source — Apple publishes no ARK-style
    // spec sheet) is live and describes the per-GPU-core Neural Accelerators.
    probeId: 'spec-page-live',
    productId: 'apple-m5',
    storyIds: ['published-spec-sheet', 'npu-developer-access'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 'https://www.apple.com/newsroom/2025/10/apple-unleashes-m5-the-next-big-leap-in-ai-performance-for-apple-silicon/' | grep -o 'Neural Accelerator' | head -1`],
    displayCommand: `curl -sL 'https://www.apple.com/newsroom/2025/10/apple-unleashes-m5-…-apple-silicon/' | grep -o 'Neural Accelerator' | head -1  # Apple's canonical M5 spec source, live`,
    expect: /Neural Accelerator/,
    timeoutMs: 30_000,
  },
  {
    // Intel ARK spec page for the 285K answers keyless curls (it 403-walled curl at the
    // 2026-09-14 experiments curation; recorded as it answers today) and names the part.
    probeId: 'ark-spec-page-live',
    productId: 'intel-core-ultra-9-285k',
    storyIds: ['published-spec-sheet'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 'https://www.intel.com/content/www/us/en/products/sku/241060/intel-core-ultra-9-processor-285k-36m-cache-up-to-5-70-ghz/specifications.html' | grep -o '285K' | head -1`],
    displayCommand: `curl -sL 'https://www.intel.com/…/sku/241060/…/specifications.html' | grep -o '285K' | head -1  # Intel ARK spec sheet, live and keyless`,
    expect: /285K/,
    timeoutMs: 30_000,
  },
  {
    // The spec-transparency finding, recorded as-is: Qualcomm's X2 Elite spec page is a
    // client-rendered app — a keyless fetch gets a JS shell, not a spec sheet.
    probeId: 'spec-page-js-shell',
    productId: 'qualcomm-snapdragon-x2-elite-extreme',
    storyIds: ['published-spec-sheet'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 'https://www.qualcomm.com/laptops/products/snapdragon-x2-elite' | grep -o 'enable JavaScript to run this app' | head -1`],
    displayCommand: `curl -sL 'https://www.qualcomm.com/laptops/products/snapdragon-x2-elite' | grep -o 'enable JavaScript to run this app' | head -1  # the vendor spec page serves a JS shell to crawlers — the finding IS the transparency gap`,
    expect: /enable JavaScript to run this app/,
    timeoutMs: 30_000,
  },
  // Launch-audit wave 4 (2026-09-22): the two claimed-docs-only parts get the same honest
  // treatment as the rest of the module — spec-page liveness where the vendor serves keyless
  // fetchers, and the recorded bot-wall finding where it refuses them.
  {
    // Intel ARK spec page for the Core Ultra 7 258V answers keyless curls and names the part
    // (same check as the 285K's ark-spec-page-live).
    probeId: 'ark-spec-page-live',
    productId: 'intel-core-ultra-7-258v',
    storyIds: ['published-spec-sheet'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 'https://www.intel.com/content/www/us/en/products/sku/240957/intel-core-ultra-7-processor-258v-12m-cache-up-to-4-80-ghz/specifications.html' | grep -o '258V' | head -1`],
    displayCommand: `curl -sL 'https://www.intel.com/…/sku/240957/…/specifications.html' | grep -o '258V' | head -1  # Intel ARK spec sheet, live and keyless`,
    expect: /258V/,
    timeoutMs: 30_000,
  },
  {
    // intel.com publishes a real llms.txt (text/plain, quarterly-maintained per its own
    // header) whose Products index links the Core Ultra series pages — vendor-published
    // agent-discovery docs covering this part's family, fetched keylessly.
    probeId: 'site-llms-txt',
    productId: 'intel-core-ultra-7-258v',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -s --max-time 20 https://www.intel.com/llms.txt | grep -i -m 2 'core-ultra'"],
    displayCommand: "curl -s https://www.intel.com/llms.txt | grep -i 'core-ultra'",
    expect: /products\/details\/processors\/core-ultra/,
    timeoutMs: 30_000,
  },
  {
    // The spec-transparency finding for the 9950X3D, recorded as-is (the qualcomm
    // spec-page-js-shell pattern): www.amd.com's bot wall resets keyless non-browser fetches
    // of the part's spec page at the HTTP/2 layer — no spec sheet is served to agents. (The
    // page does render for real browsers; ryzenai.docs.amd.com shows AMD can exempt dev
    // surfaces from the wall when it wants to.)
    probeId: 'spec-page-bot-wall',
    productId: 'amd-ryzen-9-9950x3d',
    storyIds: ['published-spec-sheet'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sSL --max-time 20 'https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x3d.html' 2>&1 | head -1`],
    displayCommand: `curl -sSL 'https://www.amd.com/…/amd-ryzen-9-9950x3d.html' 2>&1 | head -1  # the vendor bot wall refuses keyless fetchers — the finding IS the transparency gap`,
    expect: /curl: \(\d+\)|INTERNAL_ERROR|HTTP\/2 40[13]/,
    timeoutMs: 30_000,
  },
  {
    // The Ryzen AI SDK docs — the developer surface the Strix Halo NPU story stands on — are
    // live and keyless (ryzenai.docs.amd.com is NOT behind the www.amd.com bot wall).
    probeId: 'ryzen-ai-sdk-docs-live',
    productId: 'amd-ryzen-ai-max-plus-395',
    storyIds: ['npu-developer-access', 'local-llm-runtime-support'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 'https://ryzenai.docs.amd.com/en/latest/' | grep -o 'Ryzen AI' | head -1`],
    displayCommand: `curl -sL 'https://ryzenai.docs.amd.com/en/latest/' | grep -o 'Ryzen AI' | head -1  # the NPU SDK docs the local-AI stories lean on, live`,
    expect: /Ryzen AI/,
    timeoutMs: 30_000,
  },
]
