import type { LocalProbe } from './types'

// GPUs arena: like processors, hardware exposes no keyless API/CLI/MCP surface to probe, so the
// honest local probes are spec-page-liveness checks with an expected model string, plus the two
// toolchain docs surfaces the software-toolchain stories stand on (CUDA Toolkit and ROCm docs —
// both live, keyless). www.amd.com product pages reset connections for non-browser UAs (the
// crawl worked around it with a rendered prefetch), so AMD's probeable surface here is its docs
// host, not the marketing page. All probes are keyless, read-only curls.
export const probes: LocalProbe[] = [
  {
    // NVIDIA's RTX 5090 product/spec page is live and names the part.
    probeId: 'spec-page-live',
    productId: 'nvidia-rtx-5090',
    storyIds: ['memory-spec-bandwidth', 'power-spec-planning'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 'https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/' | grep -o 'RTX 5090' | head -1`],
    displayCommand: `curl -sL 'https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/' | grep -o 'RTX 5090' | head -1  # vendor spec page, live and keyless`,
    expect: /RTX 5090/,
    timeoutMs: 30_000,
  },
  {
    // NVIDIA's H200 datacenter spec page is live and names the part.
    probeId: 'spec-page-live',
    productId: 'nvidia-h200-sxm',
    storyIds: ['memory-spec-bandwidth', 'datacenter-scale-out'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 'https://www.nvidia.com/en-us/data-center/h200/' | grep -o 'H200' | head -1`],
    displayCommand: `curl -sL 'https://www.nvidia.com/en-us/data-center/h200/' | grep -o 'H200' | head -1  # vendor spec page, live and keyless`,
    expect: /H200/,
    timeoutMs: 30_000,
  },
  {
    // The CUDA Toolkit docs — the toolchain surface every NVIDIA compute story stands on —
    // are live and keyless.
    probeId: 'cuda-toolkit-docs-live',
    productId: 'nvidia-rtx-pro-6000',
    storyIds: ['compute-toolchain-support'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 'https://developer.nvidia.com/cuda-toolkit' | grep -o 'CUDA Toolkit' | head -1`],
    displayCommand: `curl -sL 'https://developer.nvidia.com/cuda-toolkit' | grep -o 'CUDA Toolkit' | head -1  # the toolchain docs the compute stories lean on, live`,
    expect: /CUDA Toolkit/,
    timeoutMs: 30_000,
  },
  {
    // The ROCm docs — the MI355X's entire developer story — are live and keyless
    // (rocm.docs.amd.com is NOT behind the www.amd.com bot wall).
    probeId: 'rocm-docs-live',
    productId: 'amd-mi355x',
    storyIds: ['compute-toolchain-support', 'ml-framework-support'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 'https://rocm.docs.amd.com/en/latest/' | grep -o 'ROCm' | head -1`],
    displayCommand: `curl -sL 'https://rocm.docs.amd.com/en/latest/' | grep -o 'ROCm' | head -1  # the ROCm toolchain docs, live`,
    expect: /ROCm/,
    timeoutMs: 30_000,
  },
]
