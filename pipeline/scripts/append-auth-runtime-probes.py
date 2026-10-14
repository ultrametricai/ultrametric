#!/usr/bin/env python3
# Keyless runtime probes for the auth-platforms arena bring-up (2026-09): live-checks each
# vendor's public status page, remote MCP endpoint (where one exists), and agent-docs artifacts
# (SKILL.md), then appends the observed results as probe-tier evidence items. Same live-check
# discipline as append-inference-runtime-probes.py: every excerpt is generated from an HTTP
# check at run time and the script FAILS if an observation no longer matches the expected shape.
#
# Run AFTER `pnpm pipeline probe --category auth-platforms` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'
MCP_INIT = json.dumps({
    'jsonrpc': '2.0', 'id': 1, 'method': 'initialize',
    'params': {'protocolVersion': '2025-06-18', 'capabilities': {},
               'clientInfo': {'name': 'productarena-probe', 'version': '1.0'}},
})


def fetch(url, method='GET', body=None, headers=None):
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


def status_page(product, url):
    status, ctype, body = fetch(url)
    if status != 200:
        raise SystemExit(f'{product}: status page {url} returned {status}')
    low = body.lower()
    marker = next((m for m in ['operational', 'uptime', 'incident', 'status'] if m in low), None)
    if not marker:
        raise SystemExit(f'{product}: status page {url} has no status markers')
    return (f'PROBE status-page ({NOW[:10]}): {url} returns HTTP 200 and renders a public service-status page '
            f'(page body includes "{marker}").')


def mcp_endpoint(product, url):
    status, ctype, body = fetch(url, method='POST', body=MCP_INIT,
                                headers=['Content-Type: application/json', 'Accept: application/json, text/event-stream'])
    snippet = body.strip().replace('\n', ' ')[:140]
    if status == 200 and ('jsonrpc' in body or 'event:' in body):
        return (f'PROBE mcp-endpoint ({NOW[:10]}): POST initialize to {url} answered HTTP 200 with a JSON-RPC/MCP '
                f'response ({snippet}) — a live, publicly reachable MCP server.')
    if status in (401, 403):
        return (f'PROBE mcp-endpoint ({NOW[:10]}): POST initialize to {url} returned HTTP {status} — the endpoint '
                f'exists and gates MCP sessions behind auth ({snippet}); a spec-compliant client completes the OAuth flow to connect.')
    raise SystemExit(f'{product}: unexpected MCP response {status} from {url}: {snippet}')


def skill_md(product, url):
    status, ctype, body = fetch(url)
    if status != 200 or 'text/plain' not in ctype:
        raise SystemExit(f'{product}: SKILL.md at {url} returned {status} {ctype}')
    first = ' '.join(body.strip().split())[:120]
    return (f'PROBE agent-skill ({NOW[:10]}): GET {url} returns HTTP 200 text/plain — a first-party agent skill file '
            f'coding agents can consume directly ({first}).')


CHECKS = {
    'auth0': [
        ('status', status_page, 'https://status.auth0.com'),
    ],
    'clerk': [
        ('status', status_page, 'https://status.clerk.com'),
        ('skill', skill_md, 'https://clerk.com/SKILL.md'),
    ],
    'workos': [
        ('status', status_page, 'https://status.workos.com'),
        ('mcp', mcp_endpoint, 'https://mcp.workos.com/mcp'),
    ],
    'better-auth': [
        ('mcp', mcp_endpoint, 'https://mcp.better-auth.com/mcp'),
    ],
}

for pid, checks in CHECKS.items():
    path = f'open-rankings/auth-platforms/evidence/{pid}.json'
    ev = json.load(open(path))
    prior = [e for e in ev if e['id'].startswith(f'{pid}-probe-rt-')]
    if prior:
        ev = [e for e in ev if not e['id'].startswith(f'{pid}-probe-rt-')]
        print(f'{pid}: replacing {len(prior)} prior runtime probe item(s)')
    for i, (kind, fn, url) in enumerate(checks, 1):
        ev.append({'id': f'{pid}-probe-rt-{i}', 'tier': 'probe', 'url': url, 'excerpt': fn(pid, url), 'fetchedAt': NOW})
        print(f'{pid}: appended {pid}-probe-rt-{i} ({kind})')
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
print('done')
