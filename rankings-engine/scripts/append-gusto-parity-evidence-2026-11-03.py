#!/usr/bin/env python3
# Evidence-parity repair, wave 1 (2026-11-03), gusto: the 2026-10-27 parity scan
# (rankings-engine/scripts/evidence-parity-scan.ts, re-run against main on 2026-11-03)
# flagged 56 gusto verdict cells whose rationale cites a silent evidence pack.
# Each cell was checked against the vendor's own live pages; this script appends the
# capabilities the vendor documents today (20 items below). Cells where the absence
# still holds are recorded, with what was checked, in
# reports/evidence-parity/2026-11-03-wave1-repairs.json and stay untouched.
#
# Same precedent as append-startup-banking-mercury-fdic-evidence-2026-10-27.py:
# every item is verified live before it is appended (HTTP 200 plus every marker present
# in the tag-stripped page text); any mismatch aborts the run, so a changed page can
# never append a stale excerpt.
#
# Run, then per touched arena:
#   pnpm engine judge --category <arena> --product gusto [--batch]
#   pnpm engine derive --category <arena>
import datetime
import json
import re
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'

# (id, arena evidence file, tier, url, required live markers, excerpt)
ITEMS = [
    ("gusto-parity-agentic-agent-docs-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/llms.txt",
     ["# Embedded Payroll Documentation",
      "Learn how to set up and test the Gusto Embedded Dev Assistant MCP server for AI-powered tools."],
     "docs.gusto.com serves a plain-text llms.txt index (HTTP 200). It opens \"# Embedded Payroll Documentation\" and lists every guide and API reference page as markdown links, e.g. \"[Dev Assistant MCP](https://docs.gusto.com/embedded-payroll/docs/dev-assistant-mcp.md): Learn how to set up and test the Gusto Embedded Dev Assistant MCP server for AI-powered tools.\""),
    ("gusto-parity-agentic-autonomous-automation-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/webhooks.md",
     ["A webhook is an HTTP request that delivers information about an event as it happens.",
      "your application can perform subsequent business logic after it receives a webhook event"],
     "\"A webhook is an HTTP request that delivers information about an event as it happens. We recommend that you integrate with Gusto’s webhooks infrastructure so that your application can perform subsequent business logic after it receives a webhook event.\""),
    ("gusto-parity-agentic-headless-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/api-fundamentals.md",
     ["The Gusto Embedded API behavior is built on core fundamentals that apply to every endpoint.",
      "pagination, rate limits, and scopes"],
     "\"Learn about the Gusto API, including pagination, rate limits, and scopes. The Gusto Embedded API behavior is built on core fundamentals that apply to every endpoint. These determine how information is displayed, how we handle identical requests, the number of requests you can make per minute, and the actions your application can take.\""),
    ("gusto-parity-agentic-mcp-server-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/dev-assistant-mcp.md",
     ["The Embedded Dev Assistant Model Context Protocol (MCP) server enables AI-powered code editors like Cursor and Windsurf, as well as general-purpose tools like Claude Desktop, to interact directly with the Embedded Payroll API and relevant documentation.",
      "https://embedded-payroll.readme.io/mcp"],
     "\"The Embedded Dev Assistant Model Context Protocol (MCP) server enables AI-powered code editors like Cursor and Windsurf, as well as general-purpose tools like Claude Desktop, to interact directly with the Embedded Payroll API and relevant documentation.\" Setup section gives the hosted remote server config: \"url\": \"https://embedded-payroll.readme.io/mcp\" (Beta)."),
    ("gusto-parity-agentic-official-cli-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "github",
     "https://github.com/Gusto/gusto-cli",
     ["Gusto CLI - public developer interface",
      "Agent-friendly developer interface for Gusto payroll."],
     "Official repo github.com/Gusto/gusto-cli, description \"Gusto CLI - public developer interface\"; README tagline: \"Agent-friendly developer interface for Gusto payroll.\" README shows commands: gusto auth, gusto employee, gusto pay-schedule create, gusto skill install cash-forecasting, gusto feedback."),
    ("gusto-parity-agentic-public-api-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/app-integrations/docs/introduction.md",
     ["This site serves as both a technical reference for the endpoints available and a general overview of payroll.",
      "The Gusto API is currently restricted to [Gusto App Integration](https://gusto.com/product/integrations) and [Embedded Payroll](https://embedded.gusto.com/) partners"],
     "App Integrations API introduction: \"This site serves as both a technical reference for the endpoints available and a general overview of payroll.\" Caveat on the same page: \"The Gusto API is currently restricted to [Gusto App Integration](https://gusto.com/product/integrations) and [Embedded Payroll](https://embedded.gusto.com/) partners.\""),
    ("gusto-parity-agentic-sdks-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/react-sdk.md",
     ["Gusto Embedded Payroll React SDK",
      "offers component libraries with built-in business logic",
      "https://github.com/Gusto/embedded-react-sdk"],
     "\"The **[Gusto Embedded Payroll React SDK](https://sdk.gusto.com/)** offers component libraries with built-in business logic that helps our developers with the complexity of building with payroll APIs.\" GitHub repo linked: https://github.com/Gusto/embedded-react-sdk."),
    ("gusto-parity-agentic-webhooks-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/webhooks.md",
     ["A webhook is an HTTP request that delivers information about an event as it happens.",
      "your application can perform subsequent business logic after it receives a webhook event"],
     "Overview: \"A webhook is an HTTP request that delivers information about an event as it happens. We recommend that you integrate with Gusto’s webhooks infrastructure so that your application can perform subsequent business logic after it receives a webhook event.\" Event catalog spans payroll, bank account, company, contractor, signatory, document and notification events."),
    ("gusto-parity-api-machine-spec-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/openapi/gusto-api.json",
     ["\"openapi\":\"3.1.0\""],
     "Downloadable OpenAPI document (HTTP 200, ~1.4 MB JSON) beginning: {\"openapi\":\"3.1.0\",\"tags\":[{\"name\":\"Introspection\"},{\"name\":\"Companies\"},{\"name\":\"Flows\"},... The index page at https://docs.gusto.com/embedded-payroll/openapi lists \"All OpenAPI Files for v2026-06-15\" linking gusto-api.json."),
    ("gusto-parity-api-sandbox-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/quickstart.md",
     ["for testing in our Demo environment on the [Gusto Developer Portal](https://dev.gusto.com/)"],
     "\"You can create multiple applications for testing in our Demo environment on the [Gusto Developer Portal](https://dev.gusto.com/).\" The demo environment runs against a separate base URL, https://api.gusto-demo.com (shown in curl examples in the versioning and getting-started guides)."),
    ("gusto-parity-api-versioning-policy-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/api-versioning.md",
     ["Gusto uses date-based versioning to provide stability while continuously improving our services.",
      "When a new API version is released, the oldest supported version is marked as deprecated.",
      "Deprecation headers are HTTP headers included in the API response once a version is marked for deprecation"],
     "\"Gusto uses date-based versioning to provide stability while continuously improving our services.\" Deprecation timeline: \"When a new API version is released, the oldest supported version is marked as deprecated. Partners are notified with clear timelines and instructions for upgrading.\" Support window table runs to 'End of life | After 12 months | No longer functional', and \"Deprecation headers are HTTP headers included in the API response once a version is marked for deprecation\" (Deprecation, Sunset, Link headers)."),
    ("gusto-parity-openness-full-export-20261103",
     "open-rankings/legal-ops/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/generate-custom-reports.md",
     ["Gusto provides the capability to create custom reports using custom columns, groupings, and optional filters."],
     "\"Gusto provides the capability to create custom reports using custom columns, groupings, and optional filters.\" (Create via POST companies/{company_uuid}/reports, then retrieve the generated report.)"),
    ("gusto-parity-automation-bulk-operations-20261103",
     "open-rankings/payroll/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/people-batch-api.md",
     ["People Batch API streamlines the ability to create W-2 employees",
      "Create batches of employees in a single request"],
     "\"# People Batch API - Create batches of employees in a single request. The Gusto Embedded Payroll (GEP) People Batch API streamlines the ability to create W-2 employees by allowing you to submit a batch of employees and their essential information—as you might do when onboarding a company—in a single request.\" Processed asynchronously with a webhook when batch results are ready."),
    ("gusto-parity-agentic-agent-docs-20261103",
     "open-rankings/startup-banking/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/llms.txt",
     ["# Embedded Payroll Documentation",
      "Learn how to set up and test the Gusto Embedded Dev Assistant MCP server for AI-powered tools."],
     "docs.gusto.com serves a plain-text llms.txt index (HTTP 200). It opens \"# Embedded Payroll Documentation\" and lists every guide and API reference page as markdown links, e.g. \"[Dev Assistant MCP](https://docs.gusto.com/embedded-payroll/docs/dev-assistant-mcp.md): Learn how to set up and test the Gusto Embedded Dev Assistant MCP server for AI-powered tools.\""),
    ("gusto-parity-agentic-mcp-server-20261103",
     "open-rankings/startup-banking/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/dev-assistant-mcp.md",
     ["The Embedded Dev Assistant Model Context Protocol (MCP) server enables AI-powered code editors like Cursor and Windsurf, as well as general-purpose tools like Claude Desktop, to interact directly with the Embedded Payroll API and relevant documentation.",
      "https://embedded-payroll.readme.io/mcp"],
     "\"The Embedded Dev Assistant Model Context Protocol (MCP) server enables AI-powered code editors like Cursor and Windsurf, as well as general-purpose tools like Claude Desktop, to interact directly with the Embedded Payroll API and relevant documentation.\" Setup section gives the hosted remote server config: \"url\": \"https://embedded-payroll.readme.io/mcp\" (Beta)."),
    ("gusto-parity-agentic-official-cli-20261103",
     "open-rankings/startup-banking/evidence/gusto.json", "github",
     "https://github.com/Gusto/gusto-cli",
     ["Gusto CLI - public developer interface",
      "Agent-friendly developer interface for Gusto payroll."],
     "Official repo github.com/Gusto/gusto-cli, description \"Gusto CLI - public developer interface\"; README tagline: \"Agent-friendly developer interface for Gusto payroll.\" README shows commands: gusto auth, gusto employee, gusto pay-schedule create, gusto skill install cash-forecasting, gusto feedback."),
    ("gusto-parity-agentic-sdks-20261103",
     "open-rankings/startup-banking/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/react-sdk.md",
     ["Gusto Embedded Payroll React SDK",
      "offers component libraries with built-in business logic",
      "https://github.com/Gusto/embedded-react-sdk"],
     "\"The **[Gusto Embedded Payroll React SDK](https://sdk.gusto.com/)** offers component libraries with built-in business logic that helps our developers with the complexity of building with payroll APIs.\" GitHub repo linked: https://github.com/Gusto/embedded-react-sdk."),
    ("gusto-parity-agentic-webhooks-20261103",
     "open-rankings/startup-banking/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/webhooks.md",
     ["A webhook is an HTTP request that delivers information about an event as it happens.",
      "your application can perform subsequent business logic after it receives a webhook event"],
     "Overview: \"A webhook is an HTTP request that delivers information about an event as it happens. We recommend that you integrate with Gusto’s webhooks infrastructure so that your application can perform subsequent business logic after it receives a webhook event.\" Event catalog spans payroll, bank account, company, contractor, signatory, document and notification events."),
    ("gusto-parity-api-machine-spec-20261103",
     "open-rankings/startup-banking/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/openapi/gusto-api.json",
     ["\"openapi\":\"3.1.0\""],
     "Downloadable OpenAPI document (HTTP 200, ~1.4 MB JSON) beginning: {\"openapi\":\"3.1.0\",\"tags\":[{\"name\":\"Introspection\"},{\"name\":\"Companies\"},{\"name\":\"Flows\"},... The index page at https://docs.gusto.com/embedded-payroll/openapi lists \"All OpenAPI Files for v2026-06-15\" linking gusto-api.json."),
    ("gusto-parity-dedicated-accounting-api-20261103",
     "open-rankings/startup-banking/evidence/gusto.json", "claimed-docs",
     "https://docs.gusto.com/embedded-payroll/docs/retrieve-a-general-ledger-report.md",
     ["Retrieve a General Ledger report",
      "the report is generated in a JSON format"],
     "\"# Retrieve a General Ledger report - When you create a General Ledger report and use the resulting request_uuid to retrieve the report, you'll see that the report is generated in a JSON format.\" (POST /v1/payrolls/{payroll_uuid}/reports/general_ledger, then fetch by request_uuid.)"),
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
