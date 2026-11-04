#!/usr/bin/env python3
# Evidence-parity repair, wave 1 (2026-11-03), gemini: the 2026-10-27 parity scan
# (rankings-engine/scripts/evidence-parity-scan.ts, re-run against main on 2026-11-03)
# flagged 23 gemini verdict cells whose rationale cites a silent evidence pack.
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
#   pnpm engine judge --category <arena> --product gemini [--batch]
#   pnpm engine derive --category <arena>
import datetime
import json
import re
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'

# (id, arena evidence file, tier, url, required live markers, excerpt)
ITEMS = [
    ("gemini-parity-agentic-mcp-client-20261103",
     "open-rankings/ai-assistants/evidence/gemini.json", "github",
     "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/tools/mcp-server.md",
     ["MCP servers with Gemini CLI",
      "This document provides a guide to configuring and using Model Context Protocol (MCP) servers with Gemini CLI."],
     "Official Gemini CLI documentation (google-gemini GitHub org), docs/tools/mcp-server.md, opens: \"MCP servers with Gemini CLI. This document provides a guide to configuring and using Model Context Protocol (MCP) servers with Gemini CLI.\" The repo README also states: \"Configure MCP servers in `~/.gemini/settings.json` to extend Gemini CLI\" and \"Use MCP servers to connect new capabilities\"."),
    ("gemini-parity-agentic-public-api-20261103",
     "open-rankings/ai-assistants/evidence/gemini.json", "claimed-docs",
     "https://aistudio.google.com/docs.md",
     ["Welcome to Gemini API",
      "Go from a quick prompt to production apps and agents with the Gemini API."],
     "Gemini API documentation home (Google AI Studio docs): \"Welcome to Gemini API. Go from a quick prompt to production apps and agents with the Gemini API. Tackle complex coding and multimodal reasoning with Gemini, or hand multi-step work to a managed agent.\""),
    ("gemini-parity-api-machine-spec-20261103",
     "open-rankings/ai-assistants/evidence/gemini.json", "claimed-docs",
     "https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta",
     ["\"kind\": \"discovery#restDescription\"",
      "\"title\": \"Gemini API\"",
      "\"rootUrl\": \"https://generativelanguage.googleapis.com/\""],
     "The Gemini API endpoint publishes a machine-readable Google API discovery document (equivalent of an OpenAPI spec), HTTP 200 JSON: \"canonicalName\": \"Generative Language\", \"version\": \"v1beta\", \"title\": \"Gemini API\", \"revision\": \"20261103\", \"protocol\": \"rest\", \"rootUrl\": \"https://generativelanguage.googleapis.com/\", \"kind\": \"discovery#restDescription\"."),
    ("gemini-parity-api-sandbox-20261103",
     "open-rankings/ai-assistants/evidence/gemini.json", "claimed-docs",
     "https://aistudio.google.com/docs/pricing.md",
     ["Start building free of charge with generous limits",
      "Google AI Studio usage is free of charge in all"],
     "Gemini Developer API pricing page: \"Start building free of charge with generous limits, then scale up with prepaid and pay-as-you-go pricing for your production-ready applications.\" and \"Google AI Studio usage is free of charge in all [available regions]\". The Free tier card lists \"Free input & output tokens\" for developers and small projects getting started."),
    ("gemini-parity-automation-bulk-operations-20261103",
     "open-rankings/ai-assistants/evidence/gemini.json", "claimed-docs",
     "https://aistudio.google.com/docs/batch-api.md",
     ["The Gemini Batch API is designed to process large volumes of requests",
      "The target turnaround time is 24 hours"],
     "Batch API docs: \"The Gemini Batch API is designed to process large volumes of requests asynchronously at [50% of the standard cost]. The target turnaround time is 24 hours, but in majority of cases, it is much quicker. Use Batch API for large-scale, non-urgent tasks such as data pre-processing or running evaluations where an immediate response is not required.\""),
    ("gemini-parity-computer-use-desktop-20261103",
     "open-rankings/ai-assistants/evidence/gemini.json", "claimed-docs",
     "https://aistudio.google.com/docs/computer-use.md",
     ["The Computer Use tool lets you build browser, mobile, and desktop control agents that interact with and automate tasks."],
     "Gemini API Computer use docs: \"The Computer Use tool lets you build browser, mobile, and desktop control agents that interact with and automate tasks. Using screenshots, the model can \\\"see\\\" a computer screen, and \\\"act\\\" by generating specific UI actions like mouse clicks and keyboard inputs.\" Gemini 4 and Gemini 3.x models support \"Multi-environment support: build agents for browser, mobile, and desktop environments.\""),
    ("gemini-parity-export-my-data-20261103",
     "open-rankings/ai-assistants/evidence/gemini.json", "claimed-docs",
     "https://support.google.com/gemini/answer/13594961",
     ["Requesting content removal and exporting your information",
      "You can also export your information."],
     "Gemini Apps Privacy Hub (Gemini Apps Help), section \"Requesting content removal and exporting your information\": \"You can request the removal of content under our policies or applicable laws. You can also export your information.\" The word \"export\" links to https://takeout.google.com/ (Google Takeout)."),
    ("gemini-parity-agentic-mcp-client-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://aistudio.google.com/docs/function-calling.md",
     ["Remote MCP (Model Context Protocol)",
      "Interactions API supports connecting to remote MCP servers to give the model access to external tools and services."],
     "Gemini API function calling docs, section \"Remote MCP (Model Context Protocol)\": \"Interactions API supports connecting to remote MCP servers to give the model access to external tools and services. You provide the server `name` and `url` in the tools configuration.\" Constraints documented: Streamable HTTP servers only (SSE not supported)."),
    ("gemini-parity-agentic-mcp-server-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://aistudio.google.com/docs/coding-agents.md",
     ["Connect the Gemini Docs MCP server",
      "gives your agent live access to the entire documentation site"],
     "Gemini API coding-agents docs, section \"Connect the Gemini Docs MCP server\": \"The public **Gemini Docs MCP server** (`https://gemini-api-docs-mcp.dev`) gives your agent live access to the entire documentation site. Your agent can search and read documentation pages to check request schemas, model limits, and new features\". The docs index (aistudio.google.com/llms.txt) lists it as \"Gemini Docs MCP server ... Model Context Protocol server providing live documentation search\"."),
    ("gemini-parity-agentic-official-cli-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://aistudio.google.com/docs/cli.md",
     ["Gemini API CLI",
      "is a stateless, zero-dependency command-line client built for AI agents with shell access, scripts, and CI pipelines"],
     "Gemini API docs, \"Gemini API CLI\" page: \"The Gemini API CLI (`gemini-api`) is a stateless, zero-dependency command-line client built for AI agents with shell access, scripts, and CI pipelines. Your coding agent can use it to generate text and media, analyze files, and delegate tasks to [Gemini managed agents].\""),
    ("gemini-parity-agentic-webhooks-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://aistudio.google.com/docs/webhooks.md",
     ["Webhooks allow the Gemini API to push real-time notifications to your server when asynchronous or Long-Running Operations (LROs) complete.",
      "Instead of polling"],
     "Gemini API Webhooks docs: \"Webhooks allow the Gemini API to push real-time notifications to your server when asynchronous or Long-Running Operations (LROs) complete. This replaces the need to poll the API for status updates... Webhooks are available for operations like [Batch] jobs, [Interactions] and [video generation].\" A full WebhookService REST reference exists (create, ping, rotateSigningSecret, list, get, update, delete)."),
    ("gemini-parity-documented-context-window-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://aistudio.google.com/docs/models/gemini-4-argon.md",
     ["Context window (unified input and output token limit)** 1,048,576",
      "Max output** 65,536 (default synchronous) / up to 1,048,576"],
     "Model page for the current flagship, Gemini 4 Argon, Token limits row: \"**Context window (unified input and output token limit)** 1,048,576 ... **Max output** 65,536 (default synchronous) / up to 1,048,576 (with [long decode])\". The all-models page also lists per-model specs (e.g. \"Model code gemini-4-argon, Context 1M tokens, Max output 65K / 1M tokens\")."),
    ("gemini-parity-independent-eval-presence-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "community",
     "https://artificialanalysis.ai/models",
     ["Gemini 4 Carbon",
      "highest intelligence models"],
     "Artificial Analysis independent model comparison (artificialanalysis.ai/models): \"Gemini 4 Carbon (high) and Claude Opus 5.5 (max with fallback) are the highest intelligence models, followed by Gemini 4 Carbon (medium) and Claude Opus 5.5 (xhigh with fallback).\" Gemini models appear throughout the third-party leaderboard."),
    ("gemini-parity-known-limitations-honesty-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://deepmind.google/models/model-cards/gemini-4-argon/",
     ["Known Limitations",
      "may exhibit some of the general limitations of foundation models, such as hallucinations",
      "There may also be occasional slowness or timeout issues"],
     "Gemini 4 Argon model card (Google DeepMind), section \"Intended Usage and Limitations > Known Limitations\": \"Gemini 4 Argon may exhibit some of the general limitations of foundation models, such as hallucinations. There may also be occasional slowness or timeout issues. The knowledge cutoff for Gemini 4 is March 2026, but in some domains the model's knowledge may be less up to date.\""),
    ("gemini-parity-model-card-published-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://deepmind.google/models/model-cards/gemini-4-argon/",
     ["Gemini 4 Argon - Model Card",
      "Model Cards are intended to provide essential information on Gemini models, including known limitations, mitigation approaches, and safety performance."],
     "Google DeepMind publishes an HTML model card for the current flagship: \"Gemini 4 Argon - Model Card\", \"Published: October 2026\". \"Model Cards are intended to provide essential information on Gemini models, including known limitations, mitigation approaches, and safety performance.\" Sections: Model Information, Model Data (training dataset), Implementation and Sustainability, Distribution, Evaluation, Intended Usage and Limitations, Safety & Security. A \"View PDF version\" link is offered."),
    ("gemini-parity-openness-full-export-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://support.google.com/gemini/answer/13594961",
     ["Requesting content removal and exporting your information",
      "You can also export your information."],
     "Gemini Apps Privacy Hub: \"You can request the removal of content under our policies or applicable laws. You can also export your information.\" (the \"export\" link points to https://takeout.google.com/, Google Takeout)."),
    ("gemini-parity-privacy-data-residency-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/data-residency",
     ["Data stored at rest in the customer selected location remains at rest in that location",
      "The geographic location of this processing is determined by your choice of endpoint"],
     "Google Cloud Gemini Enterprise Agent Platform \"Data residency\" page: \"Data stored at rest in the customer selected location remains at rest in that location, independent of the Gemini Enterprise Agent Platform endpoint called by that customer's request.\" and \"ML processing ... The geographic location of this processing is determined by your choice of endpoint\", with global vs jurisdictional/regional endpoints distinguished (global endpoints \"don't provide any data residency guarantees\")."),
    ("gemini-parity-privacy-no-training-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://aistudio.google.com/docs/terms.md",
     ["Google doesn't use your prompts (including associated system instructions, cached content, and files such as images, videos, or documents) or responses to improve our products"],
     "Gemini API Additional Terms of Service, \"Paid Services > How Google Uses Your Data\": \"When you use Paid Services, including, for example, the paid quota of the Gemini API, Google doesn't use your prompts (including associated system instructions, cached content, and files such as images, videos, or documents) or responses to improve our products\". By contrast, for Unpaid Services: \"Google uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products and services and machine learning technologies\"."),
    ("gemini-parity-privacy-retention-controls-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention",
     ["Gemini Enterprise Agent Platform and zero data retention",
      "customers must take specific actions",
      "To achieve zero data retention, do not enable this feature"],
     "Google Cloud page \"Gemini Enterprise Agent Platform and zero data retention\" documents how customers reach zero retention for Gemini model usage: \"customers must take specific actions within each of these areas\" (prompt logging for abuse monitoring, data caching, grounding logs), e.g. for the 24-hour Live API session-resumption cache: \"To achieve zero data retention, do not enable this feature.\" It also documents default implicit caching of Customer Data and how to turn retention surfaces off."),
    ("gemini-parity-privacy-telemetry-optout-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "github",
     "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/resources/tos-privacy.md",
     ["Usage statistics opt-out",
      "You may opt-out from sending Gemini CLI Usage Statistics to Google"],
     "Gemini CLI Terms of Service and Privacy Notice doc (google-gemini GitHub org), section \"Usage statistics opt-out\": \"You may opt-out from sending Gemini CLI Usage Statistics to Google by following the instructions available here: [Usage Statistics Configuration].\" The CLI telemetry doc additionally shows OpenTelemetry telemetry is off by default (`GEMINI_TELEMETRY_ENABLED` default `false`)."),
    ("gemini-parity-safety-evaluations-published-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://deepmind.google/models/model-cards/gemini-4-argon/",
     ["We conduct manual red teaming by specialist teams",
      "we perform testing following the guidelines in Google DeepMind",
      "Frontier Safety Framework (FSF)"],
     "Gemini 4 Argon model card, Safety & Security: \"Human Red Teaming Results: We conduct manual red teaming by specialist teams...\"; \"Automated Red Teaming to dynamically evaluate Gemini for safety and security considerations at scale, complementing human red teaming and static evaluations; Ethics & Safety Reviews were conducted ahead of the model's release. In addition, we perform testing following the guidelines in Google DeepMind's Frontier Safety Framework (FSF).\" Internal safety evaluation results tables are published on the same page."),
    ("gemini-parity-self-serve-fine-tuning-20261103",
     "open-rankings/frontier-models/evidence/gemini.json", "claimed-docs",
     "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tuning/supervised-tuning/use",
     ["Tune Gemini models with supervised fine-tuning",
      "This document describes how to tune a Gemini model by using supervised fine-tuning.",
      "The following Gemini models support supervised tuning"],
     "Google Cloud doc \"Tune Gemini models with supervised fine-tuning\": \"This document describes how to tune a Gemini model by using supervised fine-tuning.\" ... \"Supported models: The following Gemini models support supervised tuning: Gemini 3.5 Flash-Lite, Gemini 3.5 Flash, Gemini 3.1 Flash-Lite, Gemini 2.5 Pro, Gemini 2.5 Flash-Lite, Gemini 2.5 Flash.\" The page documents creating tuning jobs via console, REST, and the Google Gen AI SDK."),
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
