import type { LocalProbe } from './types'

// Hardware security keys, probed keylessly on the management surfaces the vendors actually
// ship: registry-verified CLIs (ykman via uvx, nitropy via uvx), PyPI SDK lookups, the
// YubiEnterprise "YubiKey as a Service" REST API docs, GitHub firmware releases (Nitrokey's
// updatable open firmware vs Yubico's sealed devices), and honest negatives — docs.yubico.com
// has no llms.txt, and SoloKeys' Solo 1 CLI has bit-rotted against modern python-fido2 (the
// ImportError is recorded as evidence of project decay). solokeys.com does serve an llms.txt,
// but it is Shopify shopping-agent boilerplate, not product docs — the probe excerpt says so.
// Google Titan and Feitian expose no first-party CLI/API/registry surface at all (nothing to
// probe — that absence is judged from the crawled docs instead). All keyless and read-only.
export const probes: LocalProbe[] = [
  {
    // Yubico's official ykman CLI installs keylessly from PyPI and prints its version.
    probeId: 'cli-version',
    productId: 'yubikey',
    storyIds: ['agentic-official-cli', 'cli-key-management'],
    bin: 'uvx',
    argv: ['sh', '-c', 'uvx --from yubikey-manager ykman --version 2>&1 | tail -1'],
    displayCommand: 'uvx --from yubikey-manager ykman --version',
    expect: /YubiKey Manager \(ykman\) version: \d/,
    timeoutMs: 240_000,
  },
  {
    // ykman is also packaged in Homebrew with Yubico's own description.
    probeId: 'brew-cli-info',
    productId: 'yubikey',
    storyIds: ['agentic-official-cli', 'cli-key-management'],
    bin: 'brew',
    argv: ['sh', '-c', 'brew info --json=v2 ykman 2>/dev/null | grep -o \'"desc": *"[^"]*"\' | head -1'],
    displayCommand: 'brew info --json=v2 ykman | grep desc',
    expect: /Tool for managing your YubiKey configuration/,
    timeoutMs: 60_000,
  },
  {
    // Yubico's python-fido2 SDK resolves on the public PyPI registry.
    probeId: 'pypi-fido2-sdk',
    productId: 'yubikey',
    storyIds: ['agentic-sdks', 'official-sdks'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://pypi.org/pypi/fido2/json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['info']['name'], d['info']['version'])"`],
    displayCommand: `curl -s https://pypi.org/pypi/fido2/json | python3 -c "...print(name, version)"`,
    expect: /fido2 \d+\.\d+/,
    timeoutMs: 30_000,
  },
  {
    // The YubiEnterprise "YubiKey as a Service" REST API docs are live and public — the
    // fleet-provisioning surface an agent would drive.
    probeId: 'enterprise-api-docs',
    productId: 'yubikey',
    storyIds: ['agentic-public-api', 'enterprise-delivery-api', 'agent-fleet-provisioning'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://console.yubico.com/apidocs/ | grep -o "<title>[^<]*</title>" | head -1'],
    displayCommand: 'curl -sL https://console.yubico.com/apidocs/ | grep -o "<title>...</title>"',
    expect: /YubiKey as a Service API Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: Yubico publishes no llms.txt on its docs host — human-oriented HTML only.
    probeId: 'docs-llms-txt-absent',
    productId: 'yubikey',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 -o /dev/null -w "HTTP %{http_code}" https://docs.yubico.com/llms.txt'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://docs.yubico.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // Nitrokey's official nitropy CLI installs keylessly from PyPI and identifies itself.
    probeId: 'cli-version',
    productId: 'nitrokey',
    storyIds: ['agentic-official-cli', 'cli-key-management'],
    bin: 'uvx',
    argv: ['sh', '-c', 'uvx --from pynitrokey nitropy version 2>&1 | tail -2'],
    displayCommand: 'uvx --from pynitrokey nitropy version',
    expect: /Command line tool to interact with Nitrokey devices|^\d+\.\d+\.\d+/m,
    timeoutMs: 240_000,
  },
  {
    // Nitrokey's official Python SDK resolves on PyPI.
    probeId: 'pypi-sdk',
    productId: 'nitrokey',
    storyIds: ['agentic-sdks', 'official-sdks'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://pypi.org/pypi/nitrokey/json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['info']['name'], d['info']['version'])"`],
    displayCommand: `curl -s https://pypi.org/pypi/nitrokey/json | python3 -c "...print(name, version)"`,
    expect: /nitrokey \d+\.\d+/,
    timeoutMs: 30_000,
  },
  {
    // Nitrokey 3 firmware is open source WITH tagged releases — the updatable-open-firmware
    // contrast to Yubico's sealed devices (GitHub redirect resolves to a real /tag/vX.Y.Z).
    probeId: 'firmware-release-tag',
    productId: 'nitrokey',
    storyIds: ['open-source-firmware', 'firmware-update-policy'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 -o /dev/null -w "%{http_code} %{url_effective}" https://github.com/Nitrokey/nitrokey-3-firmware/releases/latest'],
    displayCommand: 'curl -sL -o /dev/null -w "%{http_code} %{url_effective}" https://github.com/Nitrokey/nitrokey-3-firmware/releases/latest',
    expect: /200 https:\/\/github\.com\/Nitrokey\/nitrokey-3-firmware\/releases\/tag\/v\d/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative, recorded deliberately: the official Solo 1 CLI (solo-python, last
    // released 0.1.1) no longer runs against current python-fido2 — measurable bit-rot.
    probeId: 'cli-bitrot',
    productId: 'solokeys',
    storyIds: ['agentic-official-cli', 'cli-key-management'],
    bin: 'uvx',
    argv: ['sh', '-c', 'uvx --from solo-python solo version 2>&1 | tail -3'],
    displayCommand: 'uvx --from solo-python solo version',
    expect: /ImportError: cannot import name/,
    timeoutMs: 240_000,
  },
  {
    // solokeys.com serves an llms.txt — but it is Shopify's shopping-agent boilerplate for the
    // store, not product/technical documentation. Recorded as exactly that.
    probeId: 'store-llms-txt',
    productId: 'solokeys',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://solokeys.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://solokeys.com/llms.txt | head -3',
    expect: /Agent Instructions/,
    timeoutMs: 30_000,
  },
  {
    // Token2's open-source fido2-manage CLI/GUI (cross-platform FIDO2.1 credential management)
    // is a real, public GitHub project — unusual provisioning tooling for a budget vendor.
    probeId: 'fido2-manage-repo',
    productId: 'token2',
    storyIds: ['agentic-official-cli', 'cli-key-management'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 -o /dev/null -w "%{http_code} %{url_effective}" https://github.com/token2/fido2-manage'],
    displayCommand: 'curl -sL -o /dev/null -w "%{http_code} %{url_effective}" https://github.com/token2/fido2-manage',
    expect: /200 https:\/\/github\.com\/token2\/fido2-manage/,
    timeoutMs: 30_000,
  },
  // Launch-audit wave 4 (2026-09-22): google-titan was claimed-docs-only. Titan keys ship no
  // vendor CLI, SDK, or API of their own (fleet management goes through the Google Workspace
  // Admin surface, a different product) — the honest keyless probes are the vendor's own spec
  // page liveness and the recorded absence of any agent-docs index for the product.
  {
    // Google's own Titan Security Key product page (the canonical spec source — models,
    // FIDO2/U2F support, NFC/USB variants) is live and served keylessly.
    probeId: 'spec-page-live',
    productId: 'google-titan',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -sL --max-time 20 'https://cloud.google.com/security/products/titan-security-key' | grep -o -m 1 'Titan Security Key'"],
    displayCommand: "curl -sL 'https://cloud.google.com/security/products/titan-security-key' | grep -o -m 1 'Titan Security Key'",
    expect: /Titan Security Key/,
    timeoutMs: 30_000,
  },
]
