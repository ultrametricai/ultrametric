#!/usr/bin/env python3
# Realtime-infra extraction-gap fix (PR #684 review round): supplements two evidence packs with
# verbatim passages from CRAWLED vendor pages that the LLM extraction passes kept missing — the
# append-api-quality-docs-evidence.py precedent (per-source extraction caps starve specific
# capabilities out of the pack even though the corpus contains them verbatim).
#
# Context, from the PR #684 Greptile P1/P2 findings:
#   - livekit agentic-scoped-keys was judged partial on token-creation quotes alone while the
#     crawled tokens-grants page documents scoped, per-permission, expiring tokens verbatim
#     (rankings-engine/cache/crawl/realtime-infra/livekit/extra-8.md). The extraction run after
#     adding the page captured only the subscribe-only example sentence.
#   - moq-relay udp-blocked-fallback was judged none ("the evidence pack never documents what
#     happens when UDP/QUIC is blocked") while the crawled transport page documents the
#     WebSocket fallback verbatim (rankings-engine/cache/crawl/realtime-infra/moq-relay/extra-1.md).
#
# Every URL below is in that product's products.json urls (docs or extra), crawled into
# rankings-engine/cache/crawl/, and every excerpt quotes the crawled page (checked at authoring
# time, 2026-11-10). Extraction is monotonic and dedups by normalized excerpt, so re-running
# extract after this keeps these items stable. Run judge scoped on both products afterwards.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    ('realtime-infra', 'livekit'): [
        ('livekit-supp-token-grants', 'https://docs.livekit.io/frontends/reference/tokens-grants.md',
         'Docs, "Access tokens & grants": "This token encodes the identity of a participant, name of the room, capabilities (for example, publishing audio, video, or data), and permissions (for example, permission to moderate a room). Access tokens are JWT-based and signed with your API secret to prevent forgery."'),
        ('livekit-supp-token-expiry-grant-table', 'https://docs.livekit.io/frontends/reference/tokens-grants.md',
         'Docs, "Access tokens & grants": "Access tokens also carry an expiration time, after which the server rejects connections with that token." The grants table scopes each token per permission: "roomCreate — Permission to create or delete rooms", "roomAdmin — Permission to moderate a room", "canPublish — Allow participant to publish tracks", "canPublishData — Allow participant to publish data to the room".'),
    ],
    ('realtime-infra', 'moq-relay'): [
        ('moq-relay-supp-websocket-fallback', 'https://doc.moq.dev/concept/transport.md',
         'Docs, "WebSocket fallback": "Where UDP is blocked or WebTransport is missing, clients race a WebSocket connection (wss://) and keep whichever wins. A small multiplexer, qmux, carries MoQ streams over the socket."'),
        ('moq-relay-supp-fallback-automatic', 'https://doc.moq.dev/concept/transport.md',
         'Docs, "WebSocket fallback": "It works everywhere but cannot escape TCP head-of-line blocking, so priority and resets only help once bytes leave the TCP queue. The fallback is automatic in every client; the relay enables it with [web.https]."'),
    ],
}

for (category, pid), items in ITEMS.items():
    path = f'open-rankings/{category}/evidence/{pid}.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    appended = 0
    for iid, url, excerpt in items:
        if iid in existing:
            print(f'{category}/{pid}: {iid} already present, skipping')
            continue
        ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'{category}/{pid}: appended {iid}')
        appended += 1
    if appended:
        with open(path, 'w') as f:
            f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
