#!/usr/bin/env python3
# speech-to-text / speech-is-cheap evidence repair, 2026-11-01 (issue #517, a disclosed
# vendor self-report — the same founder disclosure as the issue #436 bring-up). Speech is
# Cheap's docs release 1.24.0 (2026-10-26) rewrote the pages the 2026-10-23 evidence pack
# quotes and added agent-facing surfaces the pack predates: a hosted MCP server
# (https://mcp.speechischeap.com/mcp, documented at docs.speechischeap.com/mcp.md), an
# x402 per-job USDC payment API, a published versioning/deprecation policy, per-agent API
# key guidance, and a security page.
#
# Every write is gated on live verification at run time (PR #562 review hardening):
#   - Each claimed-docs row carries verbatim check strings; the script fetches the cited
#     page and requires every check string to appear (whitespace-normalized; HTML pages are
#     tag-stripped and entity-unescaped) BEFORE anything is written. A miss aborts the run
#     with no writes.
#   - The MCP endpoint probe requires the exact expected behavior: HTTP 401 to a keyless
#     JSON POST, a WWW-Authenticate Bearer challenge carrying a resource_metadata URL, and
#     a fetched oauth-protected-resource document whose `resource` is the endpoint itself
#     with a non-empty authorization_servers list. Anything else aborts without recording.
#   - Idempotence preserves original verification dates: rows already present are live
#     re-verified but not re-stamped. If the recorded MCP probe row no longer matches live
#     behavior, the script aborts and says so (the correction path is a new dated row, not
#     a silent rewrite).
#
# Three parts:
#   1. Append claimed-docs rows for the new surfaces (skip ids already present).
#   2. Live-probe the hosted MCP endpoint and record the observation as a PRESERVED
#      probe-tier row (preserve: true), the append-*-runtime-probes.py convention: the
#      probe stage wholesale-replaces unmarked probe-tier rows (the documented probe-stage
#      replacement gotcha), and mergeProbeEvidence keeps preserved rows across refreshes.
#      The endpoint answers 401 with an OAuth resource_metadata challenge to a keyless
#      POST, which the stock probe (200/404 only) cannot record.
#   3. Update the two stored excerpts whose SUBSTANCE the 1.24.0 release changed, per
#      issue #517 (the fix-cra-efile-moved-url-2026-10-23.py precedent, extended: there
#      the source moved and the claim held; here the source page says something new, so
#      the excerpt follows the live wording, the url moves to the page's .md copy, and
#      fetchedAt restamps to the verification time — the judge cache invalidates via the
#      evidence hash):
#        - speech-is-cheap-docs-17: `segment_duration` was "Must be between six and 30
#          seconds."; the live Create page says out-of-range values are adjusted, not
#          rejected.
#        - speech-is-cheap-docs-5: language codes were "two-letter ISO 639-1"; the live
#          Languages page adds three-letter Hawaiian (haw) and Cantonese (yue).
#      The other reworded-but-equivalent excerpts stay as dated 2026-10-23 evidence.
#
# Usage: python3 rankings-engine/scripts/append-speech-to-text-sic-docs-evidence-2026-11-01.py
#        (run after any `pnpm engine probe` pass; parts 1 and 3 are order-independent)
import datetime
import html
import json
import os
import re
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EVIDENCE = os.path.join(ROOT, 'open-rankings', 'speech-to-text', 'evidence', 'speech-is-cheap.json')
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
TODAY = NOW[:10]
UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'

MCP_ENDPOINT = 'https://mcp.speechischeap.com/mcp'

# (id, url, excerpt, [verbatim check strings that must appear on the live page]).
NEW_ITEMS = [
    ('speech-is-cheap-supp-mcp-server', 'https://docs.speechischeap.com/mcp.md',
     'MCP Integration: "The Speech is Cheap Model Context Protocol (MCP) server lets AI assistants transcribe audio and video files directly within your conversations." Hosted endpoint: "Connect your AI client to the Speech is Cheap MCP server at: https://mcp.speechischeap.com/mcp"; "The server provides remote MCP connectivity over Streamable HTTP." Sign-in is OAuth against the user\'s API key: "Connecting your assistant uses OAuth" — the sign-in page takes a Speech is Cheap API key and "jobs are billed to the API key you enter".',
     ['The Speech is Cheap Model Context Protocol (MCP) server lets AI assistants transcribe audio and video files directly within your conversations.',
      'https://mcp.speechischeap.com/mcp',
      'The server provides remote MCP connectivity over Streamable HTTP.',
      'Connecting your assistant uses OAuth',
      'jobs are billed to the API key you enter']),
    ('speech-is-cheap-supp-mcp-tools', 'https://docs.speechischeap.com/mcp.md',
     'The MCP server\'s documented tools include "`cancel_job`: Cancels a pending transcription job.", "`prepare_upload`: For local files, returns an upload command that reads an API key from the `SIC_API_KEY` environment variable.", and "`check_access`: Confirms that your API key works and lists current limits, file types, and prices.", plus prompt templates "`transcribe`" and "`subtitles`".',
     ['`cancel_job`: Cancels a pending transcription job.',
      '`prepare_upload`: For local files, returns an upload command that reads an API key from the `SIC_API_KEY` environment variable.',
      '`check_access`: Confirms that your API key works and lists current limits, file types, and prices.']),
    ('speech-is-cheap-supp-x402', 'https://docs.speechischeap.com/x402-v2.md',
     'x402 API: "The x402 API is a speech-to-text API for AI agents. It transcribes audio and video files asynchronously and charges each job to the agent\'s wallet in USDC on Base, with no account or API key." Flow: "POST your job to https://api.speechischeap.com/v2/x402/jobs/ without payment. The service answers `402 Payment Required` with the price and the address to pay in a `PAYMENT-REQUIRED` header. A quote is free and valid for 300 seconds."',
     ['The x402 API is a speech-to-text API for AI agents. It transcribes audio and video files asynchronously and charges each job to the agent\'s wallet in USDC on Base, with no account or API key.',
      'The service answers `402 Payment Required` with the price and the address to pay in a `PAYMENT-REQUIRED` header. A quote is free and valid for 300 seconds.']),
    ('speech-is-cheap-supp-agent-docs-index', 'https://docs.speechischeap.com/llms.txt',
     'The docs origin serves llms.txt (HTTP 200 text/plain) summarizing the agent-facing surfaces: "With the x402 API, an AI agent pays per job in USDC on Base, with no API key. The Edge API transcribes short files synchronously, and an MCP server lets AI assistants transcribe."',
     ['With the x402 API, an AI agent pays per job in USDC on Base, with no API key. The Edge API transcribes short files synchronously, and an MCP server lets AI assistants transcribe.']),
    ('speech-is-cheap-supp-api-keys', 'https://docs.speechischeap.com/dashboard.md',
     'Dashboard guide on API key scoping: "Create a dedicated API key for each agent, script, or pipeline. If one key is exposed or retired, you can revoke it without breaking other integrations."',
     ['Create a dedicated API key for each agent, script, or pipeline. If one key is exposed or retired, you can revoke it without breaking other integrations.']),
    ('speech-is-cheap-supp-versioning', 'https://docs.speechischeap.com/versioning.md',
     'Published versioning and deprecation policy covering the Jobs, x402, and Edge APIs: versions are set in the URL path (e.g. /v2/), "Releases follow Semantic Versioning, and a new version in the path is a new major release", "We release breaking changes as a new version in the URL path", and "You receive at least six months of notice before we remove any API version." Changelogs are published per API.',
     ['and a new version in the path is a new major release',
      'We release breaking changes as a new version in the URL path',
      'You receive at least six months of notice before we remove any API version.']),
    ('speech-is-cheap-supp-security-training', 'https://speechischeap.com/company/security/',
     'Security page, Training and Access: "We never use customer data to train our own models or allow our providers to use it for model training. Personnel do not access private-job content."',
     ['We never use customer data to train our own models or allow our providers to use it for model training.',
      'Personnel do not access private-job content.']),
    ('speech-is-cheap-supp-security-residency', 'https://speechischeap.com/company/security/',
     'Security page on data location: "Transcript storage uses AWS S3 in the US East, Northern Virginia region, us-east-1. Processing infrastructure operates globally. We do not currently offer customer-selectable data residency".',
     ['Transcript storage uses AWS S3 in the US East, Northern Virginia region, us-east-1',
      'Processing infrastructure operates globally. We do not currently offer customer-selectable data residency']),
]

# Substance updates (part 3): id -> (new url, new excerpt, [verbatim checks]).
SUBSTANCE_UPDATES = {
    'speech-is-cheap-docs-17': (
        'https://docs.speechischeap.com/jobs-v2/create.md',
        '`segment_duration` (number, default 30): "The maximum duration of a transcription segment in seconds. The API adjusts a value outside 6 to 30 to that range."',
        ['The maximum duration of a transcription segment in seconds. The API adjusts a value outside 6 to 30 to that range.'],
    ),
    'speech-is-cheap-docs-5': (
        'https://docs.speechischeap.com/languages.md',
        'Language Codes: "Use a code from the following table, such as `en` for English or `es` for Spanish. Most codes are two-letter ISO 639-1 codes. Hawaiian (`haw`) and Cantonese (`yue`) have three letters."',
        ['Use a code from the following table, such as `en` for English or `es` for Spanish. Most codes are two-letter ISO 639-1 codes. Hawaiian (`haw`) and Cantonese (`yue`) have three letters.'],
    ),
}

_PAGE_CACHE: dict = {}


def fetch_text(url: str) -> str:
    if url in _PAGE_CACHE:
        return _PAGE_CACHE[url]
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            if res.status != 200:
                raise SystemExit(f'abort, nothing written: {url} answered HTTP {res.status}, expected 200')
            body = res.read().decode('utf-8', errors='replace')
    except (urllib.error.HTTPError, OSError) as e:
        raise SystemExit(f'abort, nothing written: {url} unreachable ({e})')
    text = html.unescape(re.sub(r'<[^>]+>', ' ', body)) if '</' in body else body
    _PAGE_CACHE[url] = text
    return text


def norm(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


def verify_checks(url: str, checks: list, label: str) -> None:
    page = norm(fetch_text(url))
    for c in checks:
        if norm(c) not in page:
            raise SystemExit(f'abort, nothing written: {label} — check string not found live on {url}: "{c[:90]}"')


def probe_mcp() -> str:
    # Require the exact expected live behavior; anything else aborts without recording.
    req = urllib.request.Request(MCP_ENDPOINT, data=b'{}', method='POST',
                                 headers={'User-Agent': UA, 'Content-Type': 'application/json'})
    try:
        urllib.request.urlopen(req, timeout=25)
        raise SystemExit(f'abort, nothing written: keyless POST to {MCP_ENDPOINT} returned 2xx, expected 401')
    except urllib.error.HTTPError as e:
        status, challenge = e.code, e.headers.get('WWW-Authenticate', '')
    except OSError as e:
        raise SystemExit(f'abort, nothing written: MCP endpoint unreachable ({e})')
    if status != 401:
        raise SystemExit(f'abort, nothing written: keyless POST to {MCP_ENDPOINT} returned HTTP {status}, expected 401')
    if 'Bearer' not in challenge:
        raise SystemExit(f'abort, nothing written: 401 without a WWW-Authenticate Bearer challenge (got: {challenge!r})')
    m = re.search(r'resource_metadata="([^"]+)"', challenge)
    if not m:
        raise SystemExit(f'abort, nothing written: Bearer challenge carries no resource_metadata URL (got: {challenge!r})')
    meta_url = m.group(1)
    req = urllib.request.Request(meta_url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            meta = json.loads(res.read().decode('utf-8'))
    except (urllib.error.HTTPError, OSError, ValueError) as e:
        raise SystemExit(f'abort, nothing written: resource metadata at {meta_url} did not fetch as JSON ({e})')
    if meta.get('resource') != MCP_ENDPOINT:
        raise SystemExit(f'abort, nothing written: metadata resource is {meta.get("resource")!r}, expected {MCP_ENDPOINT!r}')
    auth_servers = meta.get('authorization_servers')
    if not isinstance(auth_servers, list) or not auth_servers:
        raise SystemExit('abort, nothing written: metadata lists no authorization_servers')
    resource_name = meta.get('resource_name', '')
    # Keep this phrasing stable: the stored row's excerpt is part of the judge's cell hash,
    # so a wording-only change here would stale every cached verdict for the product. The
    # validation above, not the sentence, is what guarantees the metadata was fetched.
    return (f'PROBE runtime (recorded {TODAY}): the hosted MCP endpoint is live and cleanly '
            f'auth-gated — a keyless JSON POST to {MCP_ENDPOINT} returned HTTP 401 with '
            f'WWW-Authenticate: {challenge}. The advertised resource metadata at {meta_url} '
            f'names the resource ("{resource_name}") and its authorization server.')


DATE_TOKEN = re.compile(r'recorded \d{4}-\d{2}-\d{2}')


def main() -> None:
    # Phase 1: verify everything live. Any failure aborts before any write.
    for iid, url, _excerpt, checks in NEW_ITEMS:
        verify_checks(url, checks, iid)
    for iid, (url, _excerpt, checks) in SUBSTANCE_UPDATES.items():
        verify_checks(url, checks, iid)
    probe_excerpt = probe_mcp()
    print(f'live verification passed: {len(NEW_ITEMS)} doc rows, {len(SUBSTANCE_UPDATES)} updated pages, MCP endpoint')

    # Phase 2: write. Existing rows keep their original verification dates.
    rows = json.load(open(EVIDENCE))
    by_id = {r['id']: r for r in rows}
    added = 0
    for iid, url, excerpt, _checks in NEW_ITEMS:
        if iid in by_id:
            print(f'{iid}: already present, live re-verified, keeping fetchedAt {by_id[iid]["fetchedAt"]}')
            continue
        rows.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        added += 1

    rt_id = 'speech-is-cheap-probe-rt-1'
    if rt_id in by_id:
        stored = by_id[rt_id]['excerpt']
        if DATE_TOKEN.sub('recorded <d>', stored) != DATE_TOKEN.sub('recorded <d>', probe_excerpt):
            raise SystemExit(
                f'abort, nothing written: live MCP behavior no longer matches the recorded {rt_id}; '
                f'record the change as a new dated row instead of rewriting the old one.\n'
                f'  stored: {stored}\n  live:   {probe_excerpt}')
        print(f'{rt_id}: already present and matches live behavior, keeping fetchedAt {by_id[rt_id]["fetchedAt"]}')
    else:
        rows.append({'id': rt_id, 'tier': 'probe', 'url': MCP_ENDPOINT, 'excerpt': probe_excerpt,
                     'fetchedAt': NOW, 'preserve': True})
        added += 1
        print(f'{rt_id}: recorded — {probe_excerpt[:110]}')

    updated = 0
    for iid, (url, excerpt, _checks) in SUBSTANCE_UPDATES.items():
        row = by_id.get(iid)
        if row is None:
            raise SystemExit(f'abort, nothing written: expected existing row {iid} is missing')
        if row['excerpt'] == excerpt and row['url'] == url:
            print(f'{iid}: already on the live wording, keeping fetchedAt {row["fetchedAt"]}')
            continue
        row['url'] = url
        row['excerpt'] = excerpt
        row['fetchedAt'] = NOW
        updated += 1
        print(f'{iid}: excerpt updated to the live 1.24.0 wording')

    with open(EVIDENCE, 'w') as f:
        f.write(json.dumps(rows, indent=2, ensure_ascii=False) + '\n')
    print(f'speech-to-text/speech-is-cheap: +{added} rows, {updated} substance update(s), {len(rows)} total')


if __name__ == '__main__':
    main()
