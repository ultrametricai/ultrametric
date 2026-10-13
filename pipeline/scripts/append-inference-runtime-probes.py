#!/usr/bin/env python3
# Keyless runtime probes for the inference-providers arena bring-up (2026-09): live-checks each
# provider's OpenAI-style `GET /v1/models` catalog endpoint, public status page, and (where the
# vendor documents one) remote MCP endpoint, then appends the observed results as probe-tier
# evidence items. Mirrors append-terminals-runtime-probes.py, but every excerpt is generated
# from a live HTTP check at run time — the script FAILS (exit 1) if an observation no longer
# matches the expected shape, so stale claims can't be silently re-appended.
#
# Run AFTER `pnpm pipeline probe --category inference-providers` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json
import subprocess
import sys

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
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


def models_endpoint(product, url):
    status, ctype, body = get(url)
    date = NOW[:10]
    if status == 200:
        try:
            data = json.loads(body)
            items = data['data'] if isinstance(data, dict) else data
            n = len(items)
        except Exception:
            raise SystemExit(f'{product}: {url} returned 200 but body is not a model list')
        return (f'PROBE models-endpoint ({date}): GET {url} with NO API key returned HTTP 200 with a machine-readable '
                f'catalog of {n} models — an agent can enumerate the live model list keylessly via the OpenAI-compatible models endpoint.')
    if status in (401, 403):
        snippet = body.strip().replace('\n', ' ')[:120]
        return (f'PROBE models-endpoint ({date}): GET {url} without a key returned HTTP {status} ({snippet}) — the '
                f'OpenAI-style models endpoint is live and speaks JSON, but enumerating the catalog requires an API key.')
    raise SystemExit(f'{product}: unexpected status {status} for {url}')


def status_page(product, url):
    status, ctype, body = get(url)
    if status != 200:
        raise SystemExit(f'{product}: status page {url} returned {status}')
    low = body.lower()
    marker = next((m for m in ['operational', 'uptime', 'incident', 'status'] if m in low), None)
    if not marker:
        raise SystemExit(f'{product}: status page {url} has no status markers')
    date = NOW[:10]
    return (f'PROBE status-page ({date}): {url} returns HTTP 200 and renders a public service-status page '
            f'(page body includes "{marker}").')


def mcp_endpoint(product, url):
    status, ctype, body = get(url, method='POST', body=MCP_INIT,
                              headers=['Content-Type: application/json', 'Accept: application/json, text/event-stream'])
    date = NOW[:10]
    snippet = body.strip().replace('\n', ' ')[:140]
    if status == 200 and ('jsonrpc' in body or 'event:' in body):
        return (f'PROBE mcp-endpoint ({date}): POST initialize to {url} answered HTTP 200 with a JSON-RPC/MCP response '
                f'({snippet}) — a live, publicly reachable MCP server.')
    if status in (401, 403) and ('www-authenticate' in body.lower() or 'unauthorized' in low_or(body) or status == 401):
        return (f'PROBE mcp-endpoint ({date}): POST initialize to {url} returned HTTP {status} — the endpoint exists and '
                f'gates MCP sessions behind auth ({snippet}).')
    raise SystemExit(f'{product}: unexpected MCP response {status} from {url}: {snippet}')


def low_or(s):
    return s.lower()


CHECKS = {
    'groq': [
        ('models', 'https://api.groq.com/openai/v1/models'),
        ('status', 'https://groqstatus.com'),
    ],
    'together-ai': [
        ('models', 'https://api.together.xyz/v1/models'),
        ('status', 'https://status.together.ai'),
        ('mcp', 'https://docs.together.ai/mcp'),
    ],
    'fireworks-ai': [
        ('models', 'https://api.fireworks.ai/inference/v1/models'),
        ('status', 'https://status.fireworks.ai'),
    ],
    'cerebras': [
        ('models', 'https://api.cerebras.ai/v1/models'),
        ('status', 'https://status.cerebras.ai'),
    ],
    'deepinfra': [
        ('models', 'https://api.deepinfra.com/v1/openai/models'),
        ('status', 'https://status.deepinfra.com'),
    ],
    'baseten': [
        ('models', 'https://inference.baseten.co/v1/models'),
        ('status', 'https://status.baseten.co'),
        ('mcp', 'https://docs.baseten.co/mcp'),
    ],
}

FNS = {'models': models_endpoint, 'status': status_page, 'mcp': mcp_endpoint}

for pid, checks in CHECKS.items():
    path = f'rankings/inference-providers/evidence/{pid}.json'
    ev = json.load(open(path))
    existing_rt = [e for e in ev if e['id'].startswith(f'{pid}-probe-rt-')]
    if existing_rt:
        ev = [e for e in ev if not e['id'].startswith(f'{pid}-probe-rt-')]
        print(f'{pid}: replacing {len(existing_rt)} prior runtime probe item(s)')
    for i, (kind, url) in enumerate(checks, 1):
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
