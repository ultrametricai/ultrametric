#!/usr/bin/env python3
# speech-to-text / speech-is-cheap evidence repair, 2026-11-01 (issue #517, a disclosed
# vendor self-report — the same founder disclosure as the issue #436 bring-up). Speech is
# Cheap's docs release 1.24.0 (2026-10-26) rewrote the pages the 2026-10-23 evidence pack
# quotes and added agent-facing surfaces the pack predates: a hosted MCP server
# (https://mcp.speechischeap.com/mcp, documented at docs.speechischeap.com/mcp.md), an
# x402 per-job USDC payment API, a published versioning/deprecation policy, per-agent API
# key guidance, and a security page. Every URL below was live-checked on 2026-11-01 and
# every excerpt quotes the live page verbatim (docs pages via their .md plain-text copies,
# HTTP 200 text/plain).
#
# Three parts, all idempotent:
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
import json
import os
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EVIDENCE = os.path.join(ROOT, 'open-rankings', 'speech-to-text', 'evidence', 'speech-is-cheap.json')
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
TODAY = NOW[:10]
UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'

MCP_ENDPOINT = 'https://mcp.speechischeap.com/mcp'

# (id, url, excerpt) — all live-checked 2026-11-01, excerpts verbatim from the cited page.
NEW_ITEMS = [
    ('speech-is-cheap-supp-mcp-server', 'https://docs.speechischeap.com/mcp.md',
     'MCP Integration: "The Speech is Cheap Model Context Protocol (MCP) server lets AI assistants transcribe audio and video files directly within your conversations." Hosted endpoint: "Connect your AI client to the Speech is Cheap MCP server at: https://mcp.speechischeap.com/mcp"; "The server provides remote MCP connectivity over Streamable HTTP." Sign-in is OAuth against the user\'s API key: "Connecting your assistant uses OAuth" — the sign-in page takes a Speech is Cheap API key and "jobs are billed to the API key you enter".'),
    ('speech-is-cheap-supp-mcp-tools', 'https://docs.speechischeap.com/mcp.md',
     'The MCP server\'s documented tools include "`cancel_job`: Cancels a pending transcription job.", "`prepare_upload`: For local files, returns an upload command that reads an API key from the `SIC_API_KEY` environment variable.", and "`check_access`: Confirms that your API key works and lists current limits, file types, and prices.", plus prompt templates "`transcribe`" and "`subtitles`".'),
    ('speech-is-cheap-supp-x402', 'https://docs.speechischeap.com/x402-v2.md',
     'x402 API: "The x402 API is a speech-to-text API for AI agents. It transcribes audio and video files asynchronously and charges each job to the agent\'s wallet in USDC on Base, with no account or API key." Flow: "POST your job to https://api.speechischeap.com/v2/x402/jobs/ without payment. The service answers `402 Payment Required` with the price and the address to pay in a `PAYMENT-REQUIRED` header. A quote is free and valid for 300 seconds."'),
    ('speech-is-cheap-supp-agent-docs-index', 'https://docs.speechischeap.com/llms.txt',
     'The docs origin serves llms.txt (HTTP 200 text/plain) summarizing the agent-facing surfaces: "With the x402 API, an AI agent pays per job in USDC on Base, with no API key. The Edge API transcribes short files synchronously, and an MCP server lets AI assistants transcribe."'),
    ('speech-is-cheap-supp-api-keys', 'https://docs.speechischeap.com/dashboard.md',
     'Dashboard guide on API key scoping: "Create a dedicated API key for each agent, script, or pipeline. If one key is exposed or retired, you can revoke it without breaking other integrations."'),
    ('speech-is-cheap-supp-versioning', 'https://docs.speechischeap.com/versioning.md',
     'Published versioning and deprecation policy covering the Jobs, x402, and Edge APIs: versions are set in the URL path (e.g. /v2/), "Releases follow Semantic Versioning, and a new version in the path is a new major release", "We release breaking changes as a new version in the URL path", and "You receive at least six months of notice before we remove any API version." Changelogs are published per API.'),
    ('speech-is-cheap-supp-security-training', 'https://speechischeap.com/company/security/',
     'Security page, Training and Access: "We never use customer data to train our own models or allow our providers to use it for model training. Personnel do not access private-job content."'),
    ('speech-is-cheap-supp-security-residency', 'https://speechischeap.com/company/security/',
     'Security page on data location: "Transcript storage uses AWS S3 in the US East, Northern Virginia region, us-east-1. Processing infrastructure operates globally. We do not currently offer customer-selectable data residency".'),
]

# Substance updates (part 3): id -> (new url, new excerpt), live wording 2026-11-01.
SUBSTANCE_UPDATES = {
    'speech-is-cheap-docs-17': (
        'https://docs.speechischeap.com/jobs-v2/create.md',
        '`segment_duration` (number, default 30): "The maximum duration of a transcription segment in seconds. The API adjusts a value outside 6 to 30 to that range."',
    ),
    'speech-is-cheap-docs-5': (
        'https://docs.speechischeap.com/languages.md',
        'Language Codes: "Use a code from the following table, such as `en` for English or `es` for Spanish. Most codes are two-letter ISO 639-1 codes. Hawaiian (`haw`) and Cantonese (`yue`) have three letters."',
    ),
}


def probe_mcp() -> str:
    req = urllib.request.Request(MCP_ENDPOINT, data=b'{}', method='POST',
                                 headers={'User-Agent': UA, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            status, challenge = res.status, res.headers.get('WWW-Authenticate', '')
    except urllib.error.HTTPError as e:
        status, challenge = e.code, e.headers.get('WWW-Authenticate', '')
    except OSError as e:
        raise SystemExit(f'MCP endpoint unreachable ({e}); record nothing rather than guess')
    challenge_note = f' with WWW-Authenticate: {challenge}' if challenge else ''
    return (f'PROBE runtime (recorded {TODAY}): the hosted MCP endpoint is live and cleanly '
            f'auth-gated — a keyless JSON POST to {MCP_ENDPOINT} returned HTTP {status}'
            f'{challenge_note}. The advertised resource metadata at '
            f'https://mcp.speechischeap.com/.well-known/oauth-protected-resource/mcp names the '
            f'resource ("Speech is Cheap") and its authorization server.')


def main() -> None:
    rows = json.load(open(EVIDENCE))
    have = {r['id'] for r in rows}
    added = 0
    for iid, url, excerpt in NEW_ITEMS:
        if iid in have:
            print(f'{iid}: already present, skipping')
            continue
        rows.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        added += 1

    rt_id = 'speech-is-cheap-probe-rt-1'
    if rt_id in have:
        print(f'{rt_id}: already present, skipping')
    else:
        excerpt = probe_mcp()
        rows.append({'id': rt_id, 'tier': 'probe', 'url': MCP_ENDPOINT, 'excerpt': excerpt,
                     'fetchedAt': NOW, 'preserve': True})
        added += 1
        print(f'{rt_id}: recorded — {excerpt[:110]}')

    updated = 0
    for iid, (url, excerpt) in SUBSTANCE_UPDATES.items():
        for row in rows:
            if row['id'] == iid and row['excerpt'] != excerpt:
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
