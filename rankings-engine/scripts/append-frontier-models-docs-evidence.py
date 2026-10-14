#!/usr/bin/env python3
# Frontier-models arena bring-up (2026-09-22): supplements evidence packs with verbatim passages
# from CRAWLED/VERIFIED vendor pages that the LLM extraction passes kept missing — the
# data-warehouses/auth-platforms precedent (append-data-warehouses-docs-evidence.py): per-source
# extraction caps starve specific capabilities out of the prompt even though the corpus contains
# them verbatim (this arena's jev corpus alone is 116 crawled sources, ~500 chars each in the
# extraction prompt). Every excerpt below quotes a page in rankings-engine/cache/crawl/frontier-models/
# fetched 2026-09-22 (grep-verified at authoring time via .pa-tmp/find-passages.py). Honest
# negatives are included where the crawl PROVED an absence (llama's SSO-gated docs; jev's
# no-fine-tuning statement). Community-replica items attribute third-party status explicitly —
# Open-Jev replicas are NOT TypeSafe products.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'jev': [
        ('jev-supp-pricing', 'https://docs.typesafe.ai/models',
         'Models page publishes the full price list without sales contact: "Price (per Btok / per Mtok) — $42 / $0.042"; "Charged per input token. Output tokens are free. A Btok is a billion tokens and an Mtok is a million tokens."'),
        ('jev-supp-context', 'https://docs.typesafe.ai/models',
         'Context budgets documented precisely per model: "Context length — 64k tokens per request; 32k tokens for `state` plus the longest question", with the exact accounting ("the 64k budget covers the `state` plus all questions combined").'),
        ('jev-supp-rate-limits', 'https://docs.typesafe.ai/models',
         'Rate limits documented with honest volatility caveat: "250,000 tokens per second / 1,200 requests per minute"; "A request over either limit returns `429 Too Many Requests`. Our client SDKs retry with backoff by default and honor the `retry-after` header"; Warning: "Rate limits are adjusting dynamically... limits above can change without notice"; higher limits via enterprise plans.'),
        ('jev-supp-versioning', 'https://docs.typesafe.ai/models',
         'Versioned IDs plus documented alias policy: `jev-latest` ("The most recent stable, official release. The default in our client SDKs") and `jev-preview` resolve to versioned `jev-1.13.0`; "If you have tuned confidence thresholds against a specific version, pin that version\'s ID instead of the alias and move to the new one on your own schedule." The response\'s `model` field reports the versioned ID that answered.'),
        ('jev-supp-models-endpoint', 'https://docs.typesafe.ai/models',
         'Programmatic catalog discovery: "`GET /v1/models` returns the names your account can send in the `model` field, with a description and release date for each", with cURL/Python/JavaScript examples and a documented response schema.'),
        ('jev-supp-jaggedness', 'https://docs.typesafe.ai/model-jaggedness/jev-1.13',
         'A vendor-authored limitations page: "Jev isn\'t perfect. Here are some jagged edges we are aware of with jev-1.13" — nine documented failure modes (literal reading, math and numbers/counting, date-time comparison, indirection, large state full of irrelevant detail, adversarial content, contradictory instructions, structural invariants, generation), each with a "Do this instead" mitigation. "Last reviewed 2026-09-17."'),
        ('jev-supp-no-training', 'https://docs.typesafe.ai/models',
         'Data handling: "Jev is not trained on customer requests or responses. See Legal for the Data Processing Agreement, the Privacy Policy, and details on zero data retention (ZDR) for enterprise customers."'),
        ('jev-supp-no-finetune', 'https://docs.typesafe.ai/models',
         'Honest scope statement (no fine-tuning access, by design): "Jev is not fine-tuned or LoRA-adapted with customer data... the same weights serve every account. You shape its answers to your domain through the request rather than through per-account weights."'),
        ('jev-supp-ecosystem-awesome', 'https://raw.githubusercontent.com/yibie/awesome-jev/main/README.md',
         'Third-party curated ecosystem list (yibie/awesome-jev, 1,253 GitHub stars): "A curated awesome list of public projects and practices built on Jev, TypeSafe AI\'s System One model for typed decisions" — 339 entries across 14 categories (Agent Decisions 40, Classification & Routing 33, Verification & Guardrails 28, Infra/SDKs/Integrations 57...), with per-coding-agent tags (Pi 12, Claude Code 7, Codex 4) and an explicit "A listing is not an endorsement" curation policy.'),
        ('jev-supp-open-replicas', 'https://huggingface.co/ZefanCai/Open-Jev-9B',
         'Community open-weight replicas exist on Hugging Face — ZefanCai/Open-Jev-9B and Open-Jev-2B (tagged "open-jev", "typed-decisions", built on Qwen3.5 via LoRA), AlexWortega/openjev (471 likes) — THIRD-PARTY reproductions of the System One idea, not TypeSafe products; TypeSafe\'s own Jev weights are not published.'),
        ('jev-supp-playground', 'https://docs.typesafe.ai/introduction/quickstart',
         'Self-serve start documented: "Open the Playground (console.typesafe.ai/playground) and log in", paste state, add a Noul/Choice/Score question — then the same quickstart walks through the first API call with the SDKs.'),
    ],
    'claude': [
        ('claude-supp-pricing', 'https://platform.claude.com/docs/en/about-claude/pricing',
         'Pricing docs publish per-MTok prices for every current model without sales contact — a table of base input, 5m/1h cache writes, cache hits, and output prices per model (e.g. a flagship row at "$10 / MTok" input, "$12.50 / MTok" cache write, "$50 / MTok" output), mirrored on anthropic.com/pricing (Opus 5.5: "Input $4 / MTok, Output $20 / MTok").'),
        ('claude-supp-model-ids', 'https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions',
         'Dedicated versioning page: "How Claude model IDs are structured and versioned, including the dateless form" — pinned versioned IDs vs. moving forms, per-platform ID tables on the models overview.'),
        ('claude-supp-deprecations', 'https://platform.claude.com/docs/en/about-claude/model-deprecations',
         'A standing model-deprecations page plus per-model retirement floors on the models overview ("Not sooner than September 1, 2027" / "Not sooner than September 22, 2027") — advance-notice deprecation policy with migration guides.'),
        ('claude-supp-rate-limits', 'https://platform.claude.com/docs/en/api/rate-limits',
         'Rate limits documented with tiers and enforcement semantics: "Maximum number of requests per minute (RPM) and tokens per minute (TPM)"; "a rate of 60 requests per minute (RPM) might be enforced as 1 request per second"; standard per-tier limit tables, viewable per account at /settings/limits.'),
        ('claude-supp-context', 'https://platform.claude.com/docs/en/about-claude/models/overview',
         'Context windows documented per model on the overview ("Context window — 1M tokens") with a dedicated context-windows guide; the API changelog states the current flagship "has a 1M token context window by default, 128k max output tokens".'),
        ('claude-supp-models-endpoint', 'https://platform.claude.com/docs/en/api/overview',
         'Programmatic catalog discovery: "List available Claude models and their details (`GET /v1/models`)"; the changelog notes "`GET /v1/models` and `GET /v1/models/{model_id}` now return `max_input_tokens`, `max_tokens`, and a `capabilities` object. Query the API to discover what each model" supports.'),
        ('claude-supp-system-card', 'https://www.anthropic.com/transparency',
         'Anthropic publishes system cards and safety-testing snapshots: the transparency hub links the "Claude Fable 5.1 & Claude Mythos 5.1 System Card" PDF and summarizes testing across "three critical risk areas" including malicious computer use, alongside Acceptable Use enforcement reporting.'),
    ],
    'gpt': [
        ('gpt-supp-pricing', 'https://developers.openai.com/api/docs/pricing',
         'Pricing docs publish per-model token prices without sales contact: "Prices per 1M tokens", with a standard-pricing table of short/long-context input, cached input, cache writes, and output prices per model, plus batch and fine-tuning price sections.'),
        ('gpt-supp-deprecations', 'https://developers.openai.com/api/docs/deprecations',
         'A standing deprecations page tracks dated shutdowns with pricing and recommended replacements per model (e.g. "2025-06-06 — gpt-4-32k ... recommended replacement gpt-4o"); the changelog states "Upcoming deprecations are listed on the deprecations page".'),
        ('gpt-supp-models-compare', 'https://developers.openai.com/api/docs/models/compare',
         '"Compare current model capabilities, context windows, and token pricing" — a per-model table of context window, max output, and supported endpoints across the current catalog (GPT-6 Astra and the rest of the lineup).'),
        ('gpt-supp-capability-flags', 'https://developers.openai.com/api/docs/changelog',
         'API changelog documents flagship capability set: "GPT-5.5 supports a 1M token context window, image input, structured outputs, function calling, prompt caching, Batch, tool search, built-in computer use, hosted shell, apply patch, Skills" — image input and 1M context are platform-documented.'),
        ('gpt-supp-rate-limits', 'https://developers.openai.com/api/docs/guides/rate-limits',
         'A dedicated rate-limits guide documents limits and how they scale; the prompt-caching guide answers the interaction explicitly ("Cached input tokens still count toward tokens-per-minute limits"), and batch jobs run against "a separate pool of significantly higher rate limits, and a clear 24-hour turnaround time".'),
        ('gpt-supp-cookbook', 'https://developers.openai.com/cookbook/llms.txt',
         'Official OpenAI Cookbook: "Practical code examples and patterns for APIs, agents, evals, multimodal applications, and integrations" — a maintained worked-examples library with its own llms.txt index.'),
    ],
    'gemini': [
        ('gemini-supp-deprecations', 'https://ai.google.dev/gemini-api/docs/deprecations',
         'A standing deprecations page: "Deprecation announcements are made on the Release notes page, and the announced earliest shutdown dates are tracked on this page. Already-shutdown models are indicated" — dated shutdown floors per model.'),
        ('gemini-supp-changelog', 'https://ai.google.dev/gemini-api/docs/changelog',
         'Maintained "Release notes" changelog for the Gemini API — dated entries for model launches, alias moves, and feature releases (e.g. Managed Agents public preview; Live API context-window compression).'),
        ('gemini-supp-aliases', 'https://ai.google.dev/gemini-api/docs/changelog',
         'Alias-to-version policy visible in release notes: launches note "This is now the model behind `gemini-flash-latest`" — `-latest` aliases move on release while versioned model IDs stay pinnable.'),
        ('gemini-supp-terms', 'https://ai.google.dev/gemini-api/terms',
         'Usage terms published for the API: "you must comply with our Prohibited Use Policy, which provides additional details about appropriate conduct when using the Services" — the Gemini API Additional Terms of Service page.'),
    ],
    'llama': [
        ('llama-supp-model-cards', 'https://github.com/meta-llama/llama-models',
         'The canonical llama-models repo carries a per-family table with "**License** | **Model Card**" columns (Llama 2 through Llama 4) — a published model card and use policy for every released weight family; llama.com\'s FAQ points to "Llama 3.1, Llama 3.2, Llama 3.3, and Llama 4 model cards for more information."'),
        ('llama-supp-weights-hf', 'https://huggingface.co/meta-llama',
         'Open weights downloadable from the official meta-llama Hugging Face org after accepting terms: "accept the license terms and acceptable use policy. Requests are processed hourly. In this organization, you can find models in both the original Meta format as well as the Hugging Face transformers format."'),
        ('llama-supp-license', 'https://github.com/meta-llama/llama-models',
         'License posture stated in the canonical repo: "The model weights are licensed for researchers and commercial entities, upholding the principles of openness" — the Llama Community License, not OSI open source; per-family USE_POLICY.md files linked.'),
        ('llama-supp-docs-gated', 'https://www.llama.com/docs/overview/',
         'HONEST NEGATIVE (measured 2026-09-22): llama.com\'s developer docs pages (docs/overview, docs/get-started) served an SSO identity wall to a keyless fetch — "Please confirm your identity. You will be taken to your single sign-on provider" — the documentation surface is not publicly readable without a Meta login.'),
    ],
    'deepseek': [
        ('deepseek-supp-lifecycle', 'https://api-docs.deepseek.com/updates',
         'Model lifecycle handled via dated notices in the News/updates changelog: "The two legacy API model names, `deepseek-chat` and `deepseek-reasoner`, will be discontinued in three months (2026-07-24). During the current period, these two model names point to the non-thinking mode and thinking mode" of the current model — advance notice with alias mapping.'),
        ('deepseek-supp-streaming', 'https://api-docs.deepseek.com/',
         'Streaming documented in the first-call guide: "This is a non-stream example, you can set the `stream` parameter to `true` to get stream response", in both OpenAI and Anthropic API formats.'),
        ('deepseek-supp-concurrency', 'https://api-docs.deepseek.com/quick_start/rate_limit',
         'A dedicated "Rate Limit & Isolation" page documents concurrency limits (pricing page tables show per-model concurrency, e.g. 2500/500) and the keep-alive behavior under load ("Streaming requests: Continuously return SSE keep-alive comments"); the error-codes page documents 429 semantics.'),
        ('deepseek-supp-function-calling', 'https://api-docs.deepseek.com/guides/function_calling',
         'A maintained function-calling guide with runnable OpenAI-format examples (stream or non-stream) — tool use is a documented first-class capability of the API.'),
    ],
    'mistral': [
        ('mistral-supp-open-weights', 'https://mistral.ai/pricing',
         'Open-weights posture stated on the pricing page: "you can self-host our models anywhere. Open-weight models (e.g., Mistral 7B) are Apache 2.0 licensed for research/individual use; while commercial deployments require a Mistral license with separate terms for derivatives and production use"; the docs home labels current models (e.g. "Mistral Small 4 — Apache 2.0"), and llms.txt indexes a "Model weights" page ("Open-source pre-trained and instruction-tuned models with various licenses, download links, and usage guidelines").'),
        ('mistral-supp-models-endpoint', 'https://docs.mistral.ai/api/endpoint/models',
         'Programmatic catalog discovery documented in the API reference: "List Models" (`GET /v1/models`) and "Retrieve Model" endpoints.'),
        ('mistral-supp-known-limitations', 'https://docs.mistral.ai/resources/known-limitations',
         'A standing "Known limitations" page ships in the docs resources section alongside an error glossary — vendor-documented failure modes.'),
        ('mistral-supp-model-cards', 'https://mistral.ai/models',
         'Per-model cards published: the models page links dedicated model-card pages under docs.mistral.ai/models/model-cards/ for each release (e.g. Mistral Large 3 — "Open-weight, general-purpose, flagship multimodal and multilingual model").'),
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/frontier-models/evidence/{pid}.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for iid, url, excerpt in items:
        if iid in existing:
            print(f'{pid}: {iid} already present, skipping')
            continue
        ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'{pid}: appended {iid}')
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
print('done')
