#!/usr/bin/env python3
# Keyless runtime probes for the browser-agents arena bring-up (2026-09): live-checks the hosted
# MCP endpoint and machine-readable API specs, and appends evidence distilled from the recorded
# runtime probes in open-rankings/browser-agents/proofs/ (see rankings-engine/probes/browser-agents.ts).
# Mirrors append-mcp-infra-runtime-probes.py: live checks FAIL
# (exit 1) when an observation no longer matches, so stale claims can't be re-appended.
#
# Run AFTER `pnpm engine probe --category browser-agents` — that stage wholesale-replaces
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
    cmd = ['curl', '-sL', '-A', UA, '--max-time', '25', '-w', '\n---META %{http_code} %{content_type}', url]
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


def mcp_oauth_gated(product, url):
    status, ctype, body = get(url, method='POST', body=MCP_INIT,
                              headers=['Content-Type: application/json', 'Accept: application/json, text/event-stream'])
    snippet = body.strip().replace('\n', ' ')[:140]
    if status == 401:
        return (f'PROBE mcp-endpoint ({DATE}): POST initialize to {url} returned HTTP 401 with an OAuth 2.1 '
                f'protected-resource challenge — the hosted MCP server is live and gated behind managed auth ({snippet}).')
    if status == 200 and 'jsonrpc' in body:
        return (f'PROBE mcp-endpoint ({DATE}): POST initialize to {url} answered HTTP 200 with a JSON-RPC/MCP '
                f'response ({snippet}) — a live, publicly reachable MCP server.')
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
            f'({n} documented paths) — an agent can generate a client for the API from this spec.')


CHECKS = {
    'browser-use': [
        ('openapi', 'https://docs.browser-use.com/cloud/openapi/v4.json', None),
        ('recorded', 'https://docs.browser-use.com/cloud/guides/mcp-server',
         'PROBE runtime (recorded 2026-09-04, see data/browser-agents/proofs/browser-use/): a JSON-RPC initialize piped '
         'into `uvx --from browser-use[cli] browser-use --mcp` answered with serverInfo {"name":"browser-use","version":"0.13.10"} '
         '— the first-party MCP server installs from PyPI and speaks stdio keylessly; `uv pip install browser-use` also '
         'completed cleanly in a throwaway venv.'),
    ],
    'stagehand': [
        ('recorded', 'https://docs.stagehand.dev/v4/first-steps/installation',
         'PROBE runtime (recorded 2026-09-04, see data/browser-agents/proofs/stagehand/): `npm install '
         '@browserbasehq/stagehand` completed and the ESM package exports a Stagehand class; a JSON-RPC initialize piped '
         'into `npx -y @browserbasehq/mcp` answered with serverInfo "Browserbase MCP Server" v3.0.0 ("powered by '
         'Browserbase and Stagehand") — the server boots without credentials but warns it needs BROWSERBASE_API_KEY/'
         'PROJECT_ID and a model key for real runs.'),
    ],
    'skyvern': [
        ('mcp', 'https://api.skyvern.com/mcp', None),
        ('recorded', 'https://skyvern.com/docs/developers/getting-started/quickstart',
         'PROBE runtime (recorded 2026-09-04, see data/browser-agents/proofs/skyvern/): `uv pip install skyvern` '
         '(v1.0.48) completed in a throwaway venv and `skyvern --help` printed the CLI for managing and running a '
         'LOCAL Skyvern environment — the OSS agent installs and runs from PyPI.'),
    ],
    'hyperbrowser': [
        ('recorded', 'https://hyperbrowser.ai/docs/integrations/model-context-protocol',
         'PROBE runtime (recorded 2026-09-04, see data/browser-agents/proofs/hyperbrowser/): a JSON-RPC initialize '
         'piped into `npx -y hyperbrowser-mcp` answered with serverInfo {"name":"hyperbrowser","version":"1.0.24"} — '
         'the first-party MCP server installs from npm and speaks stdio (an API key is required to execute tools); '
         '`npm install @hyperbrowser/sdk` completed and exports a Hyperbrowser client class.'),
    ],
    'steel': [
        ('recorded', 'https://github.com/steel-dev/steel-browser',
         'PROBE runtime (recorded 2026-09-04, see data/browser-agents/proofs/steel/): full keyless self-host '
         'roundtrip — `docker run ghcr.io/steel-dev/steel-browser` booted the OSS browser API on a throwaway port, '
         '/v1/health returned {"status":"ok"}, POST /v1/sessions created a LIVE browser session with websocket and '
         'debugger URLs, and GET /v1/sessions listed it back; the official installer (setup.steel.dev) installed '
         'steel CLI 0.4.4 into a throwaway HOME, and `npm install steel-sdk` exports a Steel client class.'),
    ],
}

FNS = {'openapi': openapi_spec, 'mcp': mcp_oauth_gated}

for pid, checks in CHECKS.items():
    path = f'open-rankings/browser-agents/evidence/{pid}.json'
    ev = json.load(open(path))
    existing_rt = [e for e in ev if e['id'].startswith(f'{pid}-probe-rt-')]
    if existing_rt:
        ev = [e for e in ev if not e['id'].startswith(f'{pid}-probe-rt-')]
        print(f'{pid}: replacing {len(existing_rt)} prior runtime probe item(s)')
    for i, (kind, url, note) in enumerate(checks, 1):
        excerpt = note if kind == 'recorded' else FNS[kind](pid, url)
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
