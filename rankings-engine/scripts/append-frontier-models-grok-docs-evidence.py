#!/usr/bin/env python3
# Grok (xAI) frontier-models bring-up (2026-09-23): supplements the grok evidence pack with
# verbatim passages from CRAWLED/VERIFIED docs.x.ai pages that the LLM extraction pass kept
# missing — the exact append-frontier-models-docs-evidence.py precedent (2026-09-22): the
# 40-story extraction cap over a 64-source corpus starves specific capabilities (pricing,
# rate limits, model lifecycle, retention controls) out of the prompt even though the corpus
# contains them verbatim. Every excerpt below quotes a page in
# rankings-engine/cache/crawl/frontier-models/grok/ fetched 2026-09-23 (grep-verified at authoring
# time). Churn from the follow-up re-judge is settled by
# revert-churn-frontier-models-supp-wave.ts (flips kept only when citing a -supp- id).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'grok': [
        ('grok-supp-pricing', 'https://docs.x.ai/developers/pricing',
         'Pricing docs publish per-model token prices without sales contact: "All prices are in USD", a Text API Pricing table of input / cached input / output prices per 1M tokens per model (e.g. "grok-4.7 (< 200k prompt tokens) | 500k | $2.00 | $0.50 | $6.00"), with the long-context billing rule stated ("requests whose prompt reaches the listed token threshold are billed at the higher rate for all tokens in the request").'),
        ('grok-supp-context', 'https://docs.x.ai/developers/models/grok-4.7',
         'Context windows documented per model: the grok-4.7 model page states "Context window: 500,000 tokens" under "At a glance", and the models/pricing tables carry a Context column per model (500k for grok-4.7/4.6/4.5, 1M for grok-4.3 and the grok-4.20 family, 256k for grok-build-0.1).'),
        ('grok-supp-rate-limits', 'https://docs.x.ai/developers/rate-limits',
         'A dedicated Rate Limits page documents per-model requests-per-second and tokens-per-minute caps at every tier ("grok-4.7 | T0: 150, T1: 172, T2: 208, T3: 312, T4: 500 | T0: 50M ... T4: 100M"), spend-based tier thresholds ($0/$50/$250/$1,000/$5,000), 429 semantics ("Exceeding any limit returns a `429 Too Many Requests` error"), and per-team limits viewable in the xAI Console.'),
        ('grok-supp-models-endpoint', 'https://docs.x.ai/developers/rest-api-reference/inference/models',
         'Programmatic catalog discovery documented in the REST reference: "GET /v1/models — List all models available to the authenticating API key, including model names (ID), creation times, and pricing", with a documented response schema carrying `aliases`, `context_length`, per-token prices, and a `capabilities` object (including accepted `reasoning_effort` values).'),
        ('grok-supp-model-page', 'https://docs.x.ai/developers/models/grok-4.7',
         'Per-model spec pages published: the grok-4.7 page documents modalities ("text, image → text"), context window, capability flags ("Function calling: Yes; Structured outputs: Yes; Reasoning: Yes; Reasoning efforts (supported): `low`, `medium`, `high`, `xhigh`"), pricing, and Batch API support status — a specification card, not a safety/system card.'),
        ('grok-supp-deprecation', 'https://docs.x.ai/developers/migration/may-15-retirement',
         'Model lifecycle handled via dated migration guides: "Grok Model Retirement on May 15, 2026" retires named slugs (grok-4-fast-*, grok-4-0709, grok-code-fast-1, grok-3, ...) with advance notice, an automatic redirect policy ("requests to the retired model slugs above will automatically redirect to `grok-4.3`. The slugs themselves continue to resolve, so you do not need to change your code to avoid breakage"), and a documented pricing impact.'),
        ('grok-supp-aliases', 'https://docs.x.ai/developers/models',
         'A "Model Aliases" section documents the versioning scheme: "`<modelname>` is aliased to the latest stable version. `<modelname>-latest` is aliased to the latest version" — moving aliases for auto-migration alongside pinned versioned model IDs.'),
        ('grok-supp-reasoning-controls', 'https://docs.x.ai/developers/model-capabilities/text/reasoning',
         'Reasoning controls documented: "`grok-4.7`, `grok-4.6`, and `grok-4.5` support the `reasoning_effort` parameter, which controls how much effort the model spends thinking before responding. If not specified, `reasoning_effort` defaults to `\\"high\\"`. Reasoning cannot be disabled." Accepted values `low`/`medium`/`high`/`xhigh` with runnable examples.'),
        ('grok-supp-api-keys', 'https://docs.x.ai/developers/quickstart',
         'Self-serve start documented in the quickstart: "Sign up for an account at console.x.ai, then load it with credits to start using the API. ... Create an API key via the API Keys page, then export it or add it as an environment variable" — no sales contact required, followed by a runnable first request (curl/Python/JavaScript) in the same guide.'),
        ('grok-supp-cost-tracking', 'https://docs.x.ai/developers/cost-tracking',
         'Per-request spend visibility built into the API: "Every inference response from the xAI API includes the exact cost you were charged for that request, returned via a `cost_in_usd_ticks` field in the `usage` object ... This is the actual amount billed, after all applicable discounts"; the management API additionally "facilitates oversight of billing aspects, including monitoring prepaid credit balances and usage".'),
        ('grok-supp-zdr-retention', 'https://docs.x.ai/developers/faq/security',
         'Retention controls documented in the security FAQ: a default 30-day retention plus self-serve Zero Data Retention ("ZDR ensures that API request inputs (i.e., your prompt) and outputs ... are never persisted to disk"), toggleable per team in Team Settings, with programmatic confirmation ("every API response includes an `x-zero-data-retention` header set to `\\"true\\"` or `\\"false\\"`").'),
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
