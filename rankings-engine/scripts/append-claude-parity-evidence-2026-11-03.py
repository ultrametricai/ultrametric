#!/usr/bin/env python3
# Evidence-parity repair, wave 1 (2026-11-03), claude: the 2026-10-27 parity scan
# (rankings-engine/scripts/evidence-parity-scan.ts, re-run against main on 2026-11-03)
# flagged 24 claude verdict cells whose rationale cites a silent evidence pack.
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
#   pnpm engine judge --category <arena> --product claude [--batch]
#   pnpm engine derive --category <arena>
import datetime
import json
import re
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'

# (id, arena evidence file, tier, url, required live markers, excerpt)
ITEMS = [
    ("claude-parity-agentic-sdks-20261103",
     "open-rankings/ai-assistants/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/cli-sdks-libraries/overview.md",
     ["Official tools for building with the Claude API: client SDKs in seven languages",
      "General-purpose Messages API clients for Python, TypeScript, C#, Go, Java, PHP, and Ruby"],
     "The SDKs/CLI/libraries overview (platform.claude.com/docs/en/cli-sdks-libraries/overview) describes \"Official tools for building with the Claude API: client SDKs in seven languages, the ant CLI, and framework-specific libraries\" and lists \"Client SDKs: General-purpose Messages API clients for Python, TypeScript, C#, Go, Java, PHP, and Ruby. Each SDK provides idiomatic interfaces, type safety, and built-in support for streaming, retries, error handling\"."),
    ("claude-parity-agentic-webhooks-20261103",
     "open-rankings/ai-assistants/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/managed-agents/webhooks.md",
     ["Subscribe to webhooks",
      "Get notified when major events occur without polling.",
      "webhooks notify you of major state changes",
      "managed-agents-2026-04-01"],
     "The Managed Agents docs page titled \"Subscribe to webhooks\" (description: \"Get notified when major events occur without polling.\") states: \"Although most real-time interactions occur through the SSE event stream, webhooks notify you of major state changes.\" It lists supported session event types and registrable endpoints. The surface is in beta, gated by the managed-agents-2026-04-01 beta header, and is scoped to Managed Agents sessions."),
    ("claude-parity-api-interactive-docs-20261103",
     "open-rankings/ai-assistants/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/api/overview.md",
     ["to try out the API in the browser and then generate API keys"],
     "The Claude API overview states: \"The API is made available through the web Console. In the Console, you can use playground (platform.claude.com/playground) to try out the API in the browser and then generate API keys on the API keys page\"."),
    ("claude-parity-machine-readable-docs-20261103",
     "open-rankings/ai-assistants/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/llms.txt",
     ["This file provides an overview of the Anthropic API documentation and developer resources.",
      "The latest version of each Claude Platform SDK and of the ant CLI is at https://platform.claude.com/docs/sdk-versions.json, as JSON."],
     "platform.claude.com/llms.txt opens: \"This file provides an overview of the Anthropic API documentation and developer resources.\" It documents a machine-readable surface: an MCP docs server (\"Connect an MCP client to https://platform.claude.com/docs/mcp (Streamable HTTP transport) to search and read these docs\"), JSON SDK-version metadata (\"The latest version of each Claude Platform SDK and of the ant CLI is at https://platform.claude.com/docs/sdk-versions.json, as JSON.\"), and .md mirrors of every docs page including the full API reference."),
    ("claude-parity-api-versioning-policy-20261103",
     "open-rankings/ai-assistants/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/api/versioning.md",
     ["For any given API version, Anthropic preserves",
      "Anthropic recommends using the latest API version whenever possible.",
      "anthropic-version"],
     "The API Versions page: \"When making API requests, you must send an anthropic-version request header. For example, anthropic-version: 2026-10-21.\" ... \"For any given API version, Anthropic preserves: Existing input parameters, Existing output parameters\" ... \"Generally, if you are using the API as documented in this reference, Anthropic will not break your usage.\" It carries a dated version history (2026-10-21, 2023-06-01, 2023-01-01) with a migration guide for the newest version."),
    ("claude-parity-automation-rules-engine-20261103",
     "open-rankings/ai-assistants/evidence/claude.json", "claimed-docs",
     "https://code.claude.com/docs/en/hooks-guide.md",
     ["Run shell commands automatically when Claude Code edits files, finishes tasks, or needs input.",
      "Hooks are user-defined shell commands. Claude Code runs them at specific points in its lifecycle"],
     "Claude Code's \"Automate actions with hooks\" guide: \"Run shell commands automatically when Claude Code edits files, finishes tasks, or needs input. Format code, send notifications, validate commands, and enforce project rules.\" and \"Hooks are user-defined shell commands. Claude Code runs them at specific points in its lifecycle, which gives you deterministic control: certain actions always happen rather than relying on the LLM to choose to run them.\""),
    ("claude-parity-automation-versioned-workflows-20261103",
     "open-rankings/ai-assistants/evidence/claude.json", "claimed-docs",
     "https://code.claude.com/docs/en/claude-directory.md",
     ["Claude Code reads instructions, settings, skills, subagents, and memory from your project directory",
      "Commit project files to git to share them with your team"],
     "The .claude directory page: \"Claude Code reads instructions, settings, skills, subagents, and memory from your project directory and from ~/.claude in your home directory. Commit project files to git to share them with your team; files in ~/.claude are personal configuration that applies across all your projects.\""),
    ("claude-parity-privacy-data-residency-20261103",
     "open-rankings/ai-assistants/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/manage-claude/data-residency.md",
     ["Data residency controls let you manage where your data is processed and stored.",
      "Controls where data is stored at rest and where endpoint processing",
      "Inference runs only in US-based infrastructure."],
     "The Data residency page (status: stable): \"Data residency controls let you manage where your data is processed and stored. Two independent settings govern this: Inference geo: Controls where model inference runs, on a per-request basis... Workspace geo: Controls where data is stored at rest and where endpoint processing (such as image transcoding and code execution) occurs. Configured at the workspace level in the Claude Console.\" inference_geo values documented: \"global\" and \"us\" (\"Inference runs only in US-based infrastructure.\")."),
    ("claude-parity-agentic-webhooks-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/managed-agents/webhooks.md",
     ["Subscribe to webhooks",
      "Get notified when major events occur without polling.",
      "webhooks notify you of major state changes",
      "managed-agents-2026-04-01"],
     "The Managed Agents docs page titled \"Subscribe to webhooks\" (description: \"Get notified when major events occur without polling.\") states: \"Although most real-time interactions occur through the SSE event stream, webhooks notify you of major state changes.\" Webhook events carry the event type and id; handlers fetch the full object via GET. The surface is in beta, gated by the managed-agents-2026-04-01 beta header, and is scoped to Managed Agents sessions."),
    ("claude-parity-api-interactive-docs-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/api/overview.md",
     ["to try out the API in the browser and then generate API keys"],
     "The Claude API overview states: \"The API is made available through the web Console. In the Console, you can use playground (platform.claude.com/playground) to try out the API in the browser and then generate API keys on the API keys page\"."),
    ("claude-parity-machine-readable-docs-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/llms.txt",
     ["This file provides an overview of the Anthropic API documentation and developer resources.",
      "The latest version of each Claude Platform SDK and of the ant CLI is at https://platform.claude.com/docs/sdk-versions.json, as JSON."],
     "platform.claude.com/llms.txt: \"This file provides an overview of the Anthropic API documentation and developer resources.\" It points to machine-readable surfaces: an MCP docs server at https://platform.claude.com/docs/mcp, SDK/CLI version metadata \"at https://platform.claude.com/docs/sdk-versions.json, as JSON\", and .md mirrors of the full API reference (e.g. /docs/en/api/messages.md)."),
    ("claude-parity-api-sandbox-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/api/overview.md",
     ["to try out the API in the browser and then generate API keys",
      "in the Console to separate environments"],
     "The Claude API overview documents trying the API without integration code: \"In the Console, you can use playground (platform.claude.com/playground) to try out the API in the browser and then generate API keys\", and environment separation: \"Use workspaces in the Console to separate environments and control spend by use case.\""),
    ("claude-parity-drop-in-compat-switch-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk.md",
     ["OpenAI SDK compatibility",
      "Anthropic provides a compatibility layer that lets you use the OpenAI SDK to test the Claude API",
      "is not considered a long-term or production-ready solution for most use cases"],
     "Page titled \"OpenAI SDK compatibility\" (status: stable): \"Anthropic provides a compatibility layer that lets you use the OpenAI SDK to test the Claude API. With a few code changes, you can evaluate Anthropic model capabilities.\" The page walks through pointing the OpenAI SDK at Anthropic (base URL + API key + model name changes) and lists known compatibility limitations. The page scopes the layer: \"This compatibility layer is primarily intended to test and compare model capabilities, and is not considered a long-term or production-ready solution for most use cases.\""),
    ("claude-parity-independent-eval-presence-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "community",
     "https://artificialanalysis.ai/models",
     ["Artificial Analysis",
      "Claude Opus 5.5",
      "Anthropic"],
     "Artificial Analysis's independent model comparison page lists current Claude models by name, including \"Claude Opus 5.5\" (27 raw-HTML mentions), alongside Claude Fable 5.1, Claude Sonnet 5.5, and Claude Haiku 5.5, with Artificial Analysis intelligence/performance metrics. Independently, www.swebench.com's SWE-bench leaderboard HTML includes \"Claude 4.5 Opus\" and many other Claude entries."),
    ("claude-parity-known-limitations-honesty-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/build-with-claude/vision.md",
     ["there are some limitations to be aware of",
      "Claude might hallucinate or make mistakes when interpreting low-quality, rotated, or very small images under 200 pixels.",
      "Claude cannot determine whether an image is AI-generated"],
     "The vision docs carry a Limitations section in the developer docs themselves: \"Although Claude's image understanding capabilities are advanced, there are some limitations to be aware of:\" with bullets including \"Accuracy: Claude might hallucinate or make mistakes when interpreting low-quality, rotated, or very small images under 200 pixels.\", \"Spatial reasoning: Claude's coordinate and localization outputs are approximate.\", \"Counting: Claude can give approximate counts of objects in an image but might not always be precisely accurate\", and \"AI-generated images: Claude cannot determine whether an image is AI-generated and might be incorrect if asked.\""),
    ("claude-parity-open-weights-access-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://www.anthropic.com/transparency",
     ["covers how we protect model weights and respond to safety incidents"],
     "Anthropic's Transparency hub, describing its Frontier Compliance Framework: \"It also covers how we protect model weights and respond to safety incidents.\" The page also lists \"Cybersecurity protection of model weights\" among its commitments."),
    ("claude-parity-openness-full-export-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://privacy.claude.com/en/articles/9450526-export-your-claude-data",
     ["To export your data: Go to Settings",
      "you will receive a download link via email"],
     "Anthropic Privacy Center article \"Export your Claude data\": \"To export your data: Go to Settings > Privacy. Click 'Export data'. Once the export has been processed, you will receive a download link via email.\" It notes exports run from claude.ai web or Claude Desktop and the link expires 24 hours after delivery."),
    ("claude-parity-privacy-data-residency-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://platform.claude.com/docs/en/manage-claude/data-residency.md",
     ["Data residency controls let you manage where your data is processed and stored.",
      "Controls where data is stored at rest and where endpoint processing",
      "Inference runs only in US-based infrastructure."],
     "The Data residency page (status: stable): \"Data residency controls let you manage where your data is processed and stored. Two independent settings govern this: Inference geo: Controls where model inference runs, on a per-request basis. Set through the inference_geo API parameter or as a workspace default. Workspace geo: Controls where data is stored at rest and where endpoint processing (such as image transcoding and code execution) occurs. Configured at the workspace level in the Claude Console.\" Documented inference_geo values: \"global\" (default) and \"us\" (\"Inference runs only in US-based infrastructure.\")."),
    ("claude-parity-privacy-no-training-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://www.anthropic.com/legal/commercial-terms",
     ["Anthropic may not train models on Customer Content from Services."],
     "Anthropic Commercial Terms of Service, section on Customer Content: \"Anthropic agrees that Customer (a) retains all rights to its Inputs, and (b) owns its Outputs. Anthropic disclaims any rights it receives to the Customer Content under these Terms. ... Anthropic may not train models on Customer Content from Services.\" The platform docs reinforce this (api-and-data-retention.md): \"Retained data is never used for model training without your express permission.\""),
    ("claude-parity-privacy-telemetry-optout-20261103",
     "open-rankings/frontier-models/evidence/claude.json", "claimed-docs",
     "https://privacy.claude.com/en/articles/12109829-how-do-i-change-my-model-improvement-privacy-settings",
     ["you can always update your privacy settings",
      "If you decide to turn off the model training setting, we will not use any new chats and coding sessions you have with Claude for future model training"],
     "Privacy Center article \"How do I change my model improvement privacy settings?\": \"...would like to change whether you allow us to use your data to improve Claude, you can always update your privacy settings. If you decide to turn off the model training setting, we will not use any new chats and coding sessions you have with Claude for future model training. Your data will still be included in model training that has already started and in models that have already been trained, but we will stop using your previously stored chats and coding sessions in future model training.\""),
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
