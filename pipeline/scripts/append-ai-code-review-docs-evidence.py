#!/usr/bin/env python3
# ai-code-review arena bring-up (2026-09-10): supplements evidence packs with verbatim passages
# from the CRAWLED vendor docs that the LLM extraction pass missed — the kitty precedent
# (append-kitty-docs-evidence.py): per-source extraction caps starve specific capabilities
# (here: the entire privacy/no-training posture of every vendor, plus CodeRabbit's dashboard
# and merge-gating pages) out of the prompt even though the crawled corpus contains them
# verbatim. Applied evenly across all six products so the fairness pass favors no one — the
# Greptile item deliberately includes the vendor's de-identified-data training carve-out.
# Every excerpt below quotes pipeline/cache/crawl/ai-code-review/<product>/*.md content
# (checked at authoring time); URLs are the crawled sources.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'coderabbit': [
        ('coderabbit-supp-1', 'https://docs.coderabbit.ai/faq',
         'FAQ, data privacy: "Your proprietary code remains confidential with CodeRabbit. CodeRabbit never uses customer code for model training." and "Neither CodeRabbit, OpenAI, nor Anthropic uses your code to train our models."'),
        ('coderabbit-supp-2', 'https://docs.coderabbit.ai/faq',
         'FAQ, data retention controls: "Data retention only affects storage of code-related data such as learnings and review context"; "On self-hosted CodeRabbit (available for Enterprise), you can opt out of all data retention at any time"; model output logging is a separate, controllable setting.'),
        ('coderabbit-supp-3', 'https://docs.coderabbit.ai/guides/dashboard',
         'Dashboard guide: "The CodeRabbit Dashboard provides visibility into your team\'s review speed, code quality, collaboration patterns, and the impact of AI-assisted reviews. Use the dashboard to track performance, identify bottlenecks, and measure the ROI of CodeRabbit across your organization." A companion page defines every Git-platform review metric.'),
        ('coderabbit-supp-4', 'https://docs.coderabbit.ai/pr-reviews/request-changes-workflow',
         'Request changes workflow: "Request Changes Workflow keeps CodeRabbit\'s review decision synchronized with its actionable feedback. When enabled, CodeRabbit requests changes when a review posts actionable inline comments and approves the pull request after the approval requirements are met" — enabled via reviews.request_changes_workflow in .coderabbit.yaml; the docs show "A GitHub pull request blocked by CodeRabbit\'s request-changes review".'),
    ],
    'greptile': [
        ('greptile-supp-1', 'https://www.greptile.com/security',
         'Security page, self-hosting and logging: "For self-hosted Greptile services, Custom Apps are hosted using your own infrastructure - such as on-premises - so that you and your users can build, run, and, use Greptile in your virtual private cloud (VPC)"; customers "can choose to also self-host LLMs" or bring their own; "Customers can choose to turn off logging and make chats 100% private. Note that in the self-hosted service, logs are stored on customer servers only."'),
        ('greptile-supp-2', 'https://www.greptile.com/security',
         'Security page, De-Identified Data and AI Training (vendor\'s own carve-out): "Greptile may aggregate and anonymize Customer Data (\'De-Identified Data\') for analytical purposes and to monitor, improve, or expand our services, and may use such data to train and improve artificial intelligence algorithms and models (\'AI Training and Learnings\')."'),
    ],
    'graphite': [
        ('graphite-supp-1', 'https://graphite.com/docs/ai-privacy-and-security',
         'AI privacy and security: Graphite\'s AI features "are opt-in and do not store or train on your data"; "Neither Graphite nor any of its subprocessors use your data to train their models" — with contractual prohibitions on its Anthropic and OpenAI subprocessors.'),
    ],
    'qodo': [
        ('qodo-supp-1', 'https://www.qodo.ai/pricing/',
         'Pricing FAQ: "Do you train AI models on my code? No. Qodo does not train models on your code. Your code is used only to generate reviews for your team." Plans list "Strict data retention" as a feature.'),
    ],
    'cursor-bugbot': [
        ('cursor-bugbot-supp-1', 'https://cursor.com/security',
         'Security page, Privacy Mode: "Privacy Mode can be enabled in settings or by a team or enterprise admin. Privacy Mode is available to anyone (free or Pro). New team members inherit the team\'s Privacy Mode settings. When enabled, we will not train on your data."'),
        ('cursor-bugbot-supp-2', 'https://cursor.com/security',
         'Security page, certifications: "Cursor holds AIUC-1, ISO/IEC 27001:2022, and ISO/IEC 42001:2023 certifications, along with a SOC 2 Type II attestation. Certificates and reports are available on request at trust.cursor.com." Accounts can be deleted at any time from the Settings dashboard.'),
    ],
    'cubic': [
        ('cubic-supp-1', 'https://docs.cubic.dev/account/privacy-security',
         'Privacy & security: "No third-party model training on Customer Code — Our AI model providers (e.g., OpenAI, Anthropic) contractually commit that code snippets and metadata passed through their APIs are not used to train or improve their underlying models." Organizations can ask to "completely block AI features ... for your workspace."'),
        ('cubic-supp-2', 'https://docs.cubic.dev/account/privacy-security',
         'Privacy & security: "cubic is SOC 2 Type 1 compliant, demonstrating our commitment to security and trust for our customers. We maintain comprehensive controls for change management, access management, and vulnerability management."'),
    ],
}

for product, items in ITEMS.items():
    path = f'open-rankings/ai-code-review/evidence/{product}.json'
    with open(path) as f:
        evidence = json.load(f)
    existing = {e['id'] for e in evidence}
    added = 0
    for eid, url, excerpt in items:
        if eid in existing:
            continue
        evidence.append({'id': eid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        added += 1
    with open(path, 'w') as f:
        json.dump(evidence, f, indent=2)
        f.write('\n')
    print(f'{product}: +{added} supplemental docs items ({len(evidence)} total)')
