#!/usr/bin/env python3
# Evidence-parity repair, wave 1 (2026-11-03), vercel: the 2026-10-27 parity scan
# (rankings-engine/scripts/evidence-parity-scan.ts, re-run against main on 2026-11-03)
# flagged 26 vercel verdict cells whose rationale cites a silent evidence pack.
# Each cell was checked against the vendor's own live pages; this script appends the
# capabilities the vendor documents today (22 items below). Cells where the absence
# still holds are recorded, with what was checked, in
# reports/evidence-parity/2026-11-03-wave1-repairs.json and stay untouched.
#
# Same precedent as append-startup-banking-mercury-fdic-evidence-2026-10-27.py:
# every item is verified live before it is appended (HTTP 200 plus every marker present
# in the tag-stripped page text); any mismatch aborts the run, so a changed page can
# never append a stale excerpt.
#
# Run, then per touched arena:
#   pnpm engine judge --category <arena> --product vercel [--batch]
#   pnpm engine derive --category <arena>
import datetime
import json
import re
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'

# (id, arena evidence file, tier, url, required live markers, excerpt)
ITEMS = [
    ("vercel-parity-api-versioning-policy-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/rest-api",
     ["All endpoints live under the URL https://api.vercel.com and follow the REST architecture",
      "https://api.vercel.com/v6/deployments?teamId=[teamID]"],
     "The REST API overview, 'API basics' section: \"The API is exposed as an HTTP/1 and HTTP/2 service over SSL. All endpoints live under the URL https://api.vercel.com and follow the REST architecture.\" The 'Accessing team resources' example shows a versioned endpoint path: \"To access resources owned by a team, append the Team ID as a query string: https://api.vercel.com/v6/deployments?teamId=[teamID]\". Individual endpoint reference pages also show versioned paths, e.g. \"GET https://api.vercel.com/v3/deployments/{idOrUrl}/events\" (https://vercel.com/docs/rest-api/deployments/get-deployment-events)."),
    ("vercel-parity-custom-metrics-dashboards-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/observability/custom-metrics",
     ["emit application-specific metrics from Vercel Functions and analyze them in Observability",
      "Query a custom metric and filter it by an attribute"],
     "Page titled 'Emit Custom Metrics from Vercel Functions': \"Learn how to emit application-specific metrics from Vercel Functions and analyze them in Observability.\" The 'Access custom metrics data' section shows CLI querying: \"Query a custom metric and filter it by an attribute: terminal vercel metrics database.duration_ms --filter\". Pricing: \"Each custom metric data point counts as one Observability event.\""),
    ("vercel-parity-docker-deploy-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/functions/runtimes/container",
     ["Run any code and library on Vercel Functions with an OCI container image built from a Dockerfile or Containerfile at the project root",
      "Migrate an existing Docker app"],
     "Container Runtime page description: \"Run any code and library on Vercel Functions with an OCI container image built from a Dockerfile or Containerfile at the project root.\" On-page sections include \"Migrate an existing Docker app\", \"Usage\", \"Dockerfile\", \"Services\", \"Port resolution\", \"Limits and pricing\". Vercel also now documents a Container Registry product at /docs/container-registry (listed in the docs product nav)."),
    ("vercel-parity-documented-rate-limits-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/limits",
     ["Rate limits are hard limits that apply to the platform when performing actions that require a response from our API",
      "Maximum duration 300s (5 minutes) default and max 300s default, 800s max, up to 1800s (30 minutes) in beta"],
     "Limits page: \"Rate limits are hard limits that apply to the platform when performing actions that require a response from our API.\" The page carries a full rate-limits table (per-action limits, durations, scopes) plus platform limits including \"Builds per hour (Hobby)\", \"Deployments per day (Hobby)\", \"Concurrent Deployments 1 / Up to 500*\", and Vercel Functions key limits per plan: \"Maximum duration 300s (5 minutes) default and max / 300s default, 800s max, up to 1800s (30 minutes) in beta\". The REST API overview also documents rate-limit response headers: \"Rate limits are specified via response headers: X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset\" (https://vercel.com/docs/rest-api)."),
    ("vercel-parity-edge-websocket-support-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/functions/websockets",
     ["Vercel Functions can serve WebSocket connections, keeping a bidirectional connection open between a client and your server-side code",
      "Fluid compute allows a single function instance to handle multiple WebSocket connections"],
     "Dedicated WebSockets page: \"WebSockets are available on all plans. Vercel Functions can serve WebSocket connections, keeping a bidirectional connection open between a client and your server-side code. Use WebSockets for realtime features such as interactive AI streaming, chat, and collaborative apps. A single WebSocket connection is pinned to one Vercel Function instance. Messages sent over that connection reach the same function instance for the lifetime of the connection, and Fluid compute allows a single function instance to handle multiple WebSocket connections.\""),
    ("vercel-parity-execution-time-limits-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/limits",
     ["Maximum duration 300s (5 minutes) default and max 300s default, 800s max, up to 1800s (30 minutes) in beta",
      "The maximum duration of the Build Step is 45 minutes"],
     "Limits page, Vercel Functions section: \"Vercel Functions run on Fluid compute, which is enabled by default for new projects. Its key limits per plan: Maximum duration: 300s (5 minutes) default and max [Hobby] / 300s default, 800s max, up to 1800s (30 minutes) in beta [Pro and Enterprise]; Memory and CPU: 2 GB / 1 vCPU default and max [Hobby] / 2 GB / 1 vCPU default, up to 4 GB / 2 vCPU max [Pro and Enterprise]\". Build limits: \"The maximum duration of the Build Step is 45 minutes.\""),
    ("vercel-parity-known-overage-pricing-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/pricing",
     ["Fast Data Transfer First 100 GB Flat Rate CDN $0.15 per 1 GB",
      "CDN Requests First 1,000,000 Flat Rate CDN $2.00 per 1,000,000 Requests"],
     "Pricing docs, Managed Infrastructure pricing table (Resource / Hobby Included / Pro Included / On-demand Rates): \"Fast Data Transfer: First 100 GB / Flat Rate CDN / $0.15 per 1 GB; Fast Origin Transfer: First 10 GB / Usage-based / $0.06 per 1 GB; CDN Requests: First 1,000,000 / Flat Rate CDN / $2.00 per 1,000,000 Requests; CDN Request CPU Duration: N/A / 1 Hour / $0.30 per 1 Hour\". Preceding prose: \"Once you pass an included amount or use your credit, Vercel charges per unit of usage.\" Per-region Active CPU and Provisioned Memory on-demand rates are tabled at https://vercel.com/docs/functions/usage-and-pricing, e.g. \"Cleveland, USA (cle1) $0.128 [per Active CPU hour] $0.0106 [per GB-hr]\"."),
    ("vercel-parity-object-storage-uploads-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/vercel-blob",
     ["Vercel Blob is a scalable, cost-effective object storage service with private and public access modes for files up to 5 TB",
      "store images, videos, documents, and other files your app uploads or serves"],
     "Vercel Blob overview: \"Vercel Blob is a scalable, cost-effective object storage service with private and public access modes for files up to 5 TB.\" Body: \"Vercel Blob is Vercel's object storage for files. Use it to store images, videos, documents, and other files your app uploads or serves. Each store lives in one region that you choose, and Vercel's CDN caches your files close to your users.\" The docs nav includes dedicated 'Server Uploads' and 'Client Uploads' pages and JS/Python SDK references; the body references generating \"client tokens for browser uploads\" and multipart uploads."),
    ("vercel-parity-openness-open-license-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "github",
     "https://raw.githubusercontent.com/vercel/vercel/main/LICENSE",
     ["Apache License Version 2.0, January 2004",
      "Copyright 2017 Vercel, Inc."],
     "LICENSE file at the root of the vercel/vercel repository (Vercel's own GitHub org; the repo containing the Vercel CLI and framework builders): \"Apache License, Version 2.0, January 2004\" ... appendix notice: \"Copyright 2017 Vercel, Inc. Licensed under the Apache License, Version 2.0 (the 'License')\". The repo page https://github.com/vercel/vercel also links 'Apache 2.0 License' in its README sidebar."),
    ("vercel-parity-pay-for-active-compute-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/functions/usage-and-pricing",
     ["This is the CPU time your code actively consumes in milliseconds",
      "You are only billed during actual code execution and not during I/O operations"],
     "Fluid compute pricing page, Active CPU resource details: \"This is the CPU time your code actively consumes in milliseconds. You are only billed during actual code execution and not during I/O operations (database queries, like AI model calls, etc.) ... For example: If your function takes 100ms to process data but spends 400ms waiting for a database query, you're only billed for the 100ms of active CPU time.\""),
    ("vercel-parity-privacy-data-residency-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/vercel-blob",
     ["Each store lives in one region that you choose",
      "Choosing your Blob store region"],
     "Vercel Blob overview: \"Each store lives in one region that you choose, and Vercel's CDN caches your files close to your users.\" On-page section: \"Choosing your Blob store region\". Function placement is separately region-selectable: \"The default Function region is Washington, D.C., USA ( iad1 ) for all new projects\" and regions can be set per project or per function (https://vercel.com/docs/functions/configuring-functions/region)."),
    ("vercel-parity-privacy-no-training-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/legal/privacy-notice",
     ["Opt-out of Model Training as described in Section 3 of the Terms of Service",
      "control the use of their information for AI product training"],
     "Vercel Privacy Notice: \"Customers can learn about how to control the use of their information for AI product training here.\" And under Team Preferences: \"Your Team Preferences allow you to: Opt-out of Model Training as described in Section 3 of the Terms of Service.\""),
    ("vercel-parity-privacy-retention-controls-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/logs",
     ["Retention depends on your plan and whether Observability Plus is enabled",
      "For longer log storage, you can use Log Drains"],
     "Logs overview (runtime logs): \"Retention depends on your plan and whether Observability Plus is enabled; see Runtime Logs for current limits. For longer log storage, you can use Log Drains.\" The docs also cover draining audit logs to S3, Splunk, Datadog, and Panther."),
    ("vercel-parity-privacy-telemetry-optout-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/cli/about-telemetry",
     ["You may opt-out of telemetry data collection by running vercel telemetry disable",
      "VERCEL_TELEMETRY_DISABLED=1"],
     "Vercel CLI Telemetry page: \"You may opt-out of telemetry data collection by running vercel telemetry disable\" ... \"Alternatively, you may opt-out by setting an environment variable: VERCEL_TELEMETRY_DISABLED=1.\" The page also documents vercel telemetry status and VERCEL_TELEMETRY_DEBUG=1 (\"When this environment variable is set, data will not be sent to Vercel\")."),
    ("vercel-parity-public-incident-history-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://www.vercel-status.com/history.rss",
     ["Vercel Status - Incident History",
      "https://www.vercel-status.com/incidents/"],
     "Vercel's public status page (Atlassian Statuspage) publishes an incident history feed titled \"Vercel Status - Incident History\" at vercel-status.com, with dated per-incident timelines (Investigating/Identified/Resolved updates) and permanent incident pages, e.g. \"Delays in Logs and Observability data ... Resolved - The issue causing delays in Logs and Observability data has been resolved.\" (https://www.vercel-status.com/incidents/4lgcbsr7l8xn)."),
    ("vercel-parity-published-uptime-sla-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/legal/sla",
     ["available 99.99% of the time, excluding any Excused Downtime events, as defined below",
      "you will receive a Credit equal to the result of the Services Credit calculation in Section 3 of this SLA"],
     "Enterprise Service Level Agreement (Last Updated July 18, 2024): \"Vercel Inc. ... will use commercially reasonable efforts to make the platform as a service that serves your content to your websites and/or applications ('Services') available 99.99% of the time, excluding any Excused Downtime events, as defined below ('Services Level'). ... If the Services fail to meet the above Services Level, you will receive a Credit equal to the result of the Services Credit calculation in Section 3 of this SLA.\""),
    ("vercel-parity-redis-compatible-cache-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/redis",
     ["Vercel lets you connect external Redis databases through the Marketplace",
      "we automatically moved it to Upstash Redis in December 2024"],
     "'Redis on Vercel' docs: \"Vercel lets you connect external Redis databases through the Marketplace, allowing you to integrate high-performance caching and real-time data storage into your Vercel projects without managing Redis servers. Vercel KV is no longer available. If you had an existing Vercel KV store, we automatically moved it to Upstash Redis in December 2024. For new projects, install a Redis integration from the Marketplace. ... Have credentials and environment variables injected into your Vercel project.\""),
    ("vercel-parity-regional-deployment-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/functions/configuring-functions/region",
     ["The default Function region is Washington, D.C., USA ( iad1 ) for all new projects",
      "You can override regions for individual functions using the functions property"],
     "'Configuring regions for Vercel Functions': \"The default Function region is Washington, D.C., USA ( iad1 ) for all new projects.\" Regions can be set in the dashboard, in vercel.json via the regions key (example shows \"regions\": [\"sfo1\"]), via CLI, and \"You can override regions for individual functions using the functions property in your project configuration.\" Also: \"Enterprise users can also use functionFailoverRegions to specify regions that a Vercel Function should failover to if the default region is out of service.\""),
    ("vercel-parity-seat-based-pricing-minimums-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/plans/pro-plan",
     ["The Pro plan is billed monthly based on the number of deploying team seats, paid add-ons, and any on-demand usage during the billing period",
      "Seats with Owner or Member roles: $ 20 /month each"],
     "Vercel Pro Plan docs: \"The Pro plan is billed monthly based on the number of deploying team seats, paid add-ons, and any on-demand usage during the billing period.\" Platform fee includes \"1 deploying team seat included\" and \"$20/month in usage credit\". Additional team seats: \"Seats with Owner or Member roles: $20/month each. These team seats have the ability to configure & deploy projects. Viewer Pro (read-only) seats: Free.\""),
    ("vercel-parity-serverless-sql-query-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/postgres",
     ["Vercel lets you connect external Postgres databases through the Marketplace",
      "including Neon, Prisma Postgres, Supabase, and AWS Aurora Postgres"],
     "'Postgres on Vercel' docs: \"Vercel lets you connect external Postgres databases through the Marketplace, allowing you to connect external Postgres databases to your Vercel projects without managing database servers. Vercel Postgres is no longer available. If you had an existing Vercel Postgres database, we automatically moved it to Neon in December 2024.\" Marketplace benefits: \"Select from a range of Postgres providers, including Neon, Prisma Postgres, Supabase, and AWS Aurora Postgres. Provision and configure a Postgres database with minimal setup. Have credentials and environment variables injected into your Vercel project.\""),
    ("vercel-parity-standards-based-runtime-portability-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/docs/build-output-api",
     ["The Build Output API is a file-system-based specification for a directory structure that can produce a Vercel deployment",
      "Framework authors can take advantage of framework-defined infrastructure by implementing this directory structure as the output of their build command"],
     "Build Output API docs: \"The Build Output API is a file-system-based specification for a directory structure that can produce a Vercel deployment. Framework authors can take advantage of framework-defined infrastructure by implementing this directory structure as the output of their build command. This allows the framework to define and use all of the Vercel platform features.\" Related: the WebSockets page states \"WebSockets in Vercel Functions work exactly like any distributed WebSocket server, so you can use libraries like ws to upgrade connections with no additional configuration\" (https://vercel.com/docs/functions/websockets)."),
    ("vercel-parity-support-response-sla-20261103",
     "open-rankings/edge-platforms/evidence/vercel.json", "claimed-docs",
     "https://vercel.com/legal/support-terms",
     ["Enterprise target response time guidelines",
      "Our target response times relate to the time it takes for Vercel to respond to your initial request"],
     "Vercel Support Terms (Last Updated June 12, 2026): \"Enterprise target response time guidelines. The table below outlines our target response time guidelines for our various support tiers of the Enterprise subscription. Our target response times relate to the time it takes for Vercel to respond to your initial request.\" Severity table (Standard / Premium): Severity 1: <4 business hours / <2 hours (24/7); Severity 2: <8 business hours / <4 business hours; Severity 3: <16 / <6; Severity 4: <16 / <8 business hours. \"We only commit to respond to Customers with an Enterprise subscription, using the target response time guidelines below.\""),
]


_fetch_cache = {}


def fetch(url):
    if url in _fetch_cache:
        return _fetch_cache[url]
    r = subprocess.run(
        ['curl', '-sL', '--max-time', '30', '-A', UA, '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=45)
    body, _, meta = r.stdout.rpartition('\n---META ')
    _fetch_cache[url] = (int(meta.strip() or 0), body)
    return _fetch_cache[url]


def verify(url, markers):
    status, body = fetch(url)
    if status != 200:
        raise SystemExit(f'{url} returned {status}; refusing to append unverified evidence')
    text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', body))
    for marker in markers:
        if marker not in text and marker not in body:
            raise SystemExit(f'{url} no longer contains {marker!r}; the page changed - re-derive the excerpt')


def main():
    by_file = {}
    for iid, evfile, tier, url, markers, excerpt in ITEMS:
        by_file.setdefault(evfile, []).append((iid, tier, url, markers, excerpt))
    for evfile, items in by_file.items():
        ev = json.load(open(evfile))
        existing = {e['id'] for e in ev}
        changed = False
        for iid, tier, url, markers, excerpt in items:
            if iid in existing:
                print(f'{iid}: already present, skipping')
                continue
            verify(url, markers)
            ev.append({'id': iid, 'tier': tier, 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
            print(f'appended {iid} -> {evfile}')
            changed = True
        if changed:
            with open(evfile, 'w') as f:
                f.write(json.dumps(ev, indent=2) + '\n')


if __name__ == '__main__':
    main()
