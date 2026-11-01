#!/usr/bin/env python3
# Evidence-parity repair (2026-10-27), kong / api-platforms: agentic-sdks and agentic-webhooks
# both judged "none" because the pack "never mentions any official client SDK library" and
# "nothing in the evidence pack documents a webhook or event-subscription feature" — but Kong's
# own developer docs and official GitHub org document both surfaces. Same precedent as
# append-startup-banking-mercury-evidence.py: the capability exists in the vendor corpus and
# never survived pack assembly. Every excerpt below quotes a live-verified page.
#
# Honest counterparts appended alongside the positives, so the judge sees the full picture:
#   - Kong/sdk-konnect-go exists under the official org but its README opens "This is a
#     prototype and should not be used" — it must not be credited as a supported SDK.
#   - Konnect's Notification Hub delivers through email and in-app channels only (no webhook
#     channel); the webhook surfaces are the Konnect/Dev Portal audit-log webhooks and Kong
#     Gateway's Event Hooks entity (on-prem), each quoted from its own page.
#
# Run, then: pnpm engine judge --category api-platforms --product kong
#            pnpm engine derive --category api-platforms
import datetime
import json
import re
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
EVIDENCE = 'open-rankings/api-platforms/evidence/kong.json'

# (id, tier, url, required live markers, excerpt)
ITEMS = [
    ('kong-supp-terraform-providers', 'claimed-docs', 'https://developer.konghq.com/terraform.md',
     ['official Konnect Terraform provider', 'terraform-provider-konnect', 'terraform-provider-kong-gateway'],
     'Docs, "Terraform providers for Kong": "This is the official Konnect Terraform provider. You can use it to '
     'configure Dedicated Cloud Gateways, Control Planes, Gateway Entities, Dev Portal, Teams, and more" '
     '(github.com/Kong/terraform-provider-konnect, registry.terraform.io/providers/Kong/konnect). A `konnect-beta` '
     'provider gives early access to beta features, and "Designed for use with Kong Gateway on-prem, the '
     '`kong-gateway` provider allows you to manage Kong Entities using Terraform" '
     '(github.com/Kong/terraform-provider-kong-gateway); a BETA `kong-mesh` provider manages Mesh policies. Each '
     'provider repo ships pre-built example scenarios.'),
    ('kong-supp-go-kong-admin-sdk', 'github', 'https://github.com/Kong/go-kong',
     ["Go bindings for Kong's Admin API", 'go get github.com/kong/go-kong/kong'],
     'Official Kong org repo Kong/go-kong, "Go bindings for Kong\'s Admin API": installed via '
     '`go get github.com/kong/go-kong/kong`; "go-kong is compatible with Kong 2.x and 3.x. Semantic versioning is '
     'followed for versioning go-kong." The repo runs OSS and Enterprise integration-test workflows against Kong '
     'Gateway and publishes GoDoc API documentation.'),
    ('kong-supp-sdk-konnect-go-prototype', 'github', 'https://github.com/Kong/sdk-konnect-go',
     ['This is a prototype and should not be used'],
     'Official Kong org repo Kong/sdk-konnect-go (a generated Go SDK for the Konnect APIs, with per-operation typed '
     'errors such as sdkerrors.UnauthorizedError): the README opens "This is a prototype and should not be used." '
     'Kong publishes no supported general-purpose Konnect client SDK; the supported programmatic surfaces are the '
     'Konnect REST APIs, the Terraform providers, decK, and kongctl.'),
    ('kong-supp-audit-log-webhooks', 'claimed-docs', 'https://developer.konghq.com/konnect-platform/audit-logs.md',
     ['using a webhook you configure', 'get-audit-log-webhook-status', 'webhook_enabled'],
     'Docs, "Konnect and Dev Portal audit logs": "You can collect audit logs for both the Konnect org and Dev Portal '
     'using a webhook you configure. For Konnect org audit logs, you can also use an audit log pull to retrieve logs '
     'on demand from the API." Webhook health is inspectable in the UI and via the Audit Logs API operation '
     'get-audit-log-webhook-status, with `last_attempt_at` ("The last time Konnect tried to send data to your '
     'webhook"), `last_response_code`, `webhook_enabled`, and `webhook_status` fields; a failed webhook "usually means '
     'that there was an error in the endpoint or the SIEM provider went down that caused the logs to stop streaming."'),
    ('kong-supp-gateway-event-hooks', 'claimed-docs', 'https://developer.konghq.com/gateway/entities/event-hook.md',
     ['An Event Hook is a Kong Gateway entity', 'webhook', 'webhook-custom'],
     'Docs, "Event Hooks" (Kong Gateway entity, on-prem): "An Event Hook is a Kong Gateway entity that can be '
     'configured to listen for specific events from Kong Gateway entities. An Event Hook can be configured to send '
     'information to logs, webhooks, or third-party applications." Sources/events select which entity actions '
     '(create/delete/modify, e.g. on Gateway Services or Admins) trigger it, and four handler types act on the event: '
     '`webhook` (POST to a third-party application), `webhook-custom` (fully customizable POST), `log`, and `lambda` '
     '(custom Lua code).'),
    ('kong-supp-notification-hub-channels', 'claimed-docs', 'https://developer.konghq.com/konnect-platform/notification-hub.md',
     ['two supported channels: email and in-app', 'Notification Hub API'],
     'Docs, "Notifications in Konnect": the Notification Hub "keeps you up to date on critical events across your '
     'organization" (Dev Portal registration requests, API Gateway entity notifications, org access and audit logs, '
     'billing), managed in the UI or via the Notification Hub API — but "Notifications are delivered through two '
     'supported channels: email and in-app (via the bell icon in the Konnect UI)". No webhook delivery channel is '
     'documented for Notification Hub itself; Kong\'s webhook surfaces are the audit-log webhooks and Gateway Event '
     'Hooks.'),
]


def fetch(url):
    r = subprocess.run(
        ['curl', '-s', '-L', '--max-time', '25', '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=35)
    body, _, meta = r.stdout.rpartition('\n---META ')
    return int(meta.strip() or 0), body


def verify(url, markers):
    # GitHub repo pages render the README server-side; fetch the raw README for marker checks.
    fetch_url = url
    m = re.match(r'https://github\.com/([^/]+/[^/]+)$', url)
    if m:
        fetch_url = f'https://raw.githubusercontent.com/{m.group(1)}/main/README.md'
    status, body = fetch(fetch_url)
    if status != 200:
        raise SystemExit(f'{fetch_url} returned {status}; refusing to append unverified evidence')
    text = re.sub(r'\s+', ' ', body)
    for marker in markers:
        if marker not in text:
            raise SystemExit(f'{fetch_url} no longer contains {marker!r}; the page changed — re-derive the excerpt')


def main():
    ev = json.load(open(EVIDENCE))
    existing = {e['id'] for e in ev}

    for iid, tier, url, markers, excerpt in ITEMS:
        if iid in existing:
            print(f'{iid}: already present, skipping')
            continue
        verify(url, markers)
        ev.append({'id': iid, 'tier': tier, 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'appended {iid}')

    with open(EVIDENCE, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')


if __name__ == '__main__':
    main()
