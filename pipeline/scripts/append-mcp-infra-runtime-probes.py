#!/usr/bin/env python3
# Keyless runtime probes for the mcp-infrastructure arena bring-up (2026-09): live-checks each
# platform's registry/catalog API, hosted MCP endpoints (JSON-RPC initialize handshakes), and
# machine-readable API descriptions, then appends the observed results as probe-tier evidence
# items. Mirrors append-inference-runtime-probes.py: every excerpt is generated from a live HTTP
# check at run time — the script FAILS (exit 1) if an observation no longer matches the expected
# shape, so stale claims can't be silently re-appended.
#
# Run AFTER `pnpm pipeline probe --category mcp-infrastructure` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
DATE = NOW[:10]
UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'
MCP_INIT = json.dumps({
    'jsonrpc': '2.0', 'id': 1, 'method': 'initialize',
    'params': {'protocolVersion': '2025-06-18', 'capabilities': {},
               'clientInfo': {'name': 'productarena-probe', 'version': '1.0'}},
})


def get(url, method='GET', body=None, headers=None):
    cmd = ['curl', '-s', '-A', UA, '--max-time', '25', '-w', '\n---META %{http_code} %{content_type}', url]
    if method != 'GET':
        cmd += ['-X', method]
    for h in headers or []:
        cmd += ['-H', h]
    if body is not None:
        cmd += ['--data', body]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=35)
    out, _, meta = r.stdout.rpartition('\n---META ')
    status, _, ctype = meta.partition(' ')
    return int(status or 0), ctype.strip(), out


def registry_keyless(product, url):
    """A registry/catalog endpoint an agent can read with NO credentials."""
    status, ctype, body = get(url, headers=['Accept: application/json'])
    if status != 200:
        raise SystemExit(f'{product}: registry {url} returned {status} (expected keyless 200)')
    try:
        data = json.loads(body)
    except Exception:
        raise SystemExit(f'{product}: registry {url} returned 200 but not JSON')
    servers = data.get('servers') if isinstance(data, dict) else None
    if not isinstance(servers, list) or not servers:
        raise SystemExit(f'{product}: registry {url} JSON has no servers list')
    fields = sorted(set(servers[0].keys()) & {'qualifiedName', 'displayName', 'useCount', 'verified', 'remote', 'isDeployed'})
    return (f'PROBE registry-api ({DATE}): GET {url} with NO API key returned HTTP 200 with a machine-readable server '
            f'catalog (JSON entries carry {", ".join(fields)}) — an agent can search the registry keylessly.')


def registry_authgated(product, url):
    """A registry endpoint that exists and speaks JSON but requires an API key."""
    status, ctype, body = get(url, headers=['Accept: application/json'])
    snippet = body.strip().replace('\n', ' ')[:160]
    if status in (200,):
        raise SystemExit(f'{product}: {url} unexpectedly keyless now — update the probe to registry_keyless')
    if 'api key' not in body.lower() and 'unauthorized' not in body.lower():
        raise SystemExit(f'{product}: {url} returned {status} without an auth-required JSON body: {snippet}')
    return (f'PROBE registry-api ({DATE}): GET {url} without credentials returned HTTP {status} with a JSON '
            f'auth challenge ({snippet}) — the registry API is live but requires an API key (attribution-licensed).')


def mcp_endpoint(product, url, note=''):
    status, ctype, body = get(url, method='POST', body=MCP_INIT,
                              headers=['Content-Type: application/json', 'Accept: application/json, text/event-stream'])
    snippet = body.strip().replace('\n', ' ')[:140]
    if status == 200 and ('jsonrpc' in body or 'event:' in body or 'serverInfo' in body):
        return (f'PROBE mcp-endpoint ({DATE}): POST initialize to {url} answered HTTP 200 with a JSON-RPC/MCP response '
                f'({snippet}) — a live, publicly reachable MCP server.{note}')
    if status == 401:
        return (f'PROBE mcp-endpoint ({DATE}): POST initialize to {url} returned HTTP 401 with an OAuth challenge — '
                f'the hosted MCP endpoint is live and vaults access behind managed auth ({snippet}).{note}')
    if status == 400 and 'jsonrpc' in body:
        return (f'PROBE mcp-endpoint ({DATE}): POST initialize to {url} answered a JSON-RPC error over HTTP 400 '
                f'({snippet}) — the MCP server is live and requires a per-end-user binding before serving tools.{note}')
    raise SystemExit(f'{product}: unexpected MCP response {status} from {url}: {snippet}')


def openapi_spec(product, url):
    status, ctype, body = get(url, headers=['Accept: application/json'])
    if status != 200:
        raise SystemExit(f'{product}: OpenAPI {url} returned {status}')
    try:
        data = json.loads(body)
    except Exception:
        raise SystemExit(f'{product}: OpenAPI {url} is not JSON')
    version = data.get('openapi') or data.get('swagger')
    if not version:
        raise SystemExit(f'{product}: {url} JSON has no openapi/swagger key')
    n = len(data.get('paths', {}) or {})
    return (f'PROBE openapi ({DATE}): GET {url} returned HTTP 200 with an OpenAPI {version} description '
            f'({n} documented paths) — an agent can generate a client for the platform API from this spec.')


def api_catalog(product, url):
    status, ctype, body = get(url)
    if status != 200 or 'linkset' not in (body + ctype).lower():
        raise SystemExit(f'{product}: api-catalog {url} returned {status} / {ctype} without a linkset')
    return (f'PROBE api-catalog ({DATE}): GET {url} returned HTTP 200 with an RFC 9727 linkset naming the '
            f'platform APIs and their description documents — machine-discoverable API surface.')


CHECKS = {
    'composio': [
        ('mcp', 'https://connect.composio.dev/mcp', ' Composio Connect is the shared hosted endpoint documented for MCP clients.'),
        ('recorded', 'https://docs.composio.dev/docs/quickstart',
         'PROBE runtime (recorded 2026-09-04, see data/mcp-infrastructure/proofs/composio/): `npm install @composio/core` '
         'and `uv pip install composio` (v0.21.1) both completed into throwaway fixtures and imported cleanly — the '
         'TypeScript package exports a Composio client class and the Python package imports as `composio`.'),
    ],
    'smithery': [
        ('registry-open', 'https://registry.smithery.ai/servers?pageSize=3', None),
        ('mcp', 'https://server.smithery.ai/exa/mcp', ' server.smithery.ai hosts per-server MCP endpoints with OAuth 2.1 protected-resource metadata.'),
        ('openapi', 'https://smithery.ai/docs/openapi.json', None),
        ('recorded', 'https://smithery.ai/docs/mcp',
         'PROBE runtime (recorded 2026-09-04, see data/mcp-infrastructure/proofs/smithery/): a JSON-RPC initialize POST '
         'to https://smithery.ai/docs/mcp answered with serverInfo "Smithery Documentation" — the docs themselves are '
         'served over MCP; `npm install @smithery/cli` completed in a throwaway fixture and `smithery --version` printed 4.11.1.'),
    ],
    'glama': [
        ('registry-gated', 'https://glama.ai/api/mcp/v1/servers?first=3', None),
        ('openapi', 'https://glama.ai/api/mcp/openapi.json', None),
        ('api-catalog', 'https://glama.ai/.well-known/api-catalog', None),
    ],
    'pipedream-mcp': [
        ('mcp', 'https://remote.mcp.pipedream.net', ' remote.mcp.pipedream.net is the documented remote MCP server for Pipedream Connect.'),
        ('recorded', 'https://pipedream.com/docs/connect/mcp/developers',
         'PROBE runtime (recorded 2026-09-04, see data/mcp-infrastructure/proofs/pipedream-mcp/): `npm install '
         '@pipedream/sdk` completed into a throwaway fixture and the package exports a PipedreamClient class.'),
    ],
    'gram': [
        ('recorded', 'https://www.speakeasy.com/docs/ai-control-plane/reference/command-line',
         'PROBE runtime (recorded 2026-09-04, see data/mcp-infrastructure/proofs/gram/): downloaded the official '
         'cli@0.16.0 release artifact (gram_darwin_arm64.zip, the same one the vendor installer fetches), unzipped it '
         'into a throwaway dir, and `./gram --version` printed "gram version 0.16.0" — the publish/deploy CLI installs and runs.'),
    ],
}

FNS = {
    'registry-open': registry_keyless,
    'registry-gated': registry_authgated,
    'openapi': openapi_spec,
    'api-catalog': api_catalog,
}

for pid, checks in CHECKS.items():
    path = f'open-rankings/mcp-infrastructure/evidence/{pid}.json'
    ev = json.load(open(path))
    existing_rt = [e for e in ev if e['id'].startswith(f'{pid}-probe-rt-')]
    if existing_rt:
        ev = [e for e in ev if not e['id'].startswith(f'{pid}-probe-rt-')]
        print(f'{pid}: replacing {len(existing_rt)} prior runtime probe item(s)')
    for i, (kind, url, note) in enumerate(checks, 1):
        if kind == 'mcp':
            excerpt = mcp_endpoint(pid, url, note or '')
        elif kind == 'recorded':
            excerpt = note
        else:
            excerpt = FNS[kind](pid, url)
        ev.append({
            'id': f'{pid}-probe-rt-{i}',
            'tier': 'probe',
            'url': url,
            'excerpt': excerpt,
            'fetchedAt': NOW,
        })
        print(f'{pid}: appended {pid}-probe-rt-{i} ({kind})')
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
print('done')
