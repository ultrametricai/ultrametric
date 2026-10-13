#!/usr/bin/env python3
# document-extraction arena bring-up (2026-09-10): supplements evidence packs with verbatim
# passages from the CRAWLED vendor docs that the LLM extraction pass missed — the kitty
# precedent (append-kitty-docs-evidence.py): per-source extraction caps starved the entire
# compliance/retention/deployment posture (SOC 2, HIPAA, ZDR, on-prem) out of every product's
# pack even though the crawled corpus contains it verbatim. Applied evenly across all six
# products. Every excerpt quotes pipeline/cache/crawl/document-extraction/<product>/*.md
# content (checked at authoring time); URLs are the crawled sources.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'reducto': [
        ('reducto-supp-1', 'https://docs.reducto.ai/security/policies',
         'Security policies, data retention: "We have a Zero Data Retention policy (ZDR) for users on our \'Growth\' tier and above, meaning all data submitted via API is set to expire within 24 hours, except for Studio-run jobs and results saved with persist_results: true. This means that API-submitted data older than 24 hours is automatically deleted."'),
        ('reducto-supp-2', 'https://docs.reducto.ai/security/policies',
         'Security policies, compliance: "SOC 2 Type 2: We have completed our SOC 2 Type I and Type II process." and "HIPAA Compliance: We currently offer a HIPAA compliant processing pipeline for Growth and Enterprise tier customers ... Please reach out to us via email to sign a BAA with us."'),
    ],
    'llamaparse': [
        ('llamaparse-supp-1', 'https://developers.llamaindex.ai/llamaparse/general/enterprise-readiness/',
         'Enterprise readiness: "LlamaParse Platform has completed a SOC 2 Type II audit. The report and subprocessor list are available through the Trust Center. A HIPAA-compliant processing pipeline with a Business Associate Agreement (BAA) is available for Enterprise customers."'),
        ('llamaparse-supp-2', 'https://developers.llamaindex.ai/llamaparse/general/enterprise-readiness/',
         'Enterprise readiness, deployment & data residency: "managed SaaS, single-tenant, BYOC, self-hosting, and regional endpoints" — the platform documents self-hosting and regional deployment options alongside the managed cloud.'),
    ],
    'extend': [
        ('extend-supp-1', 'https://docs.extend.ai/security/compliance',
         'Compliance: "We maintain controls aligned with SOC 2 Type II requirements. Reports and security documentation are available in the Trust Center." The page also documents HIPAA (including filing a HIPAA complaint) and GDPR sections.'),
        ('extend-supp-2', 'https://docs.extend.ai/security/data-handling',
         'Data handling, Zero Data retention: "We maintain automatic data-retention policies that vary in default length by billing tier and can be configured to fit your policy. We also support zero data retention options." — including ZDR with AI subprocessors, configurable at the workspace level.'),
    ],
    'datalab': [
        ('datalab-supp-1', 'https://documentation.datalab.to/docs/on-prem/overview',
         'On-prem overview: "Customers can run our models on infrastructure they control with an Enterprise contract." The paid on-prem options target teams that "Require data privacy/operate in highly-regulated environments", need "Extremely high volume", or "Model training or customization" — while Chandra, Marker, and Surya remain free open source.'),
        ('datalab-supp-2', 'https://www.datalab.to/pricing',
         'Pricing page: the Team plan ($400/mo) lists "BAA / DPA" as included, alongside 400 req/min rate limits; Enterprise adds running on your own infrastructure (air-gapped) with SSO.'),
    ],
    'unstructured': [
        ('unstructured-supp-1', 'https://docs.unstructured.io/business/security-compliance/overview',
         'Security and compliance overview: "SOC 2 Type 2: Controls are implemented and audited for security, availability, and confidentiality. GDPR: Data handling practices conform to the General Data Protection Regulation (GDPR) ... HIPAA: The system meets the security requirements of the Health Insurance Portability and Accountability Act (HIPAA) for safeguarding protected health information (PHI)."'),
    ],
    'mistral-document-ai': [
        ('mistral-document-ai-supp-1', 'https://mistral.ai/solutions/document-ai/',
         'Document AI solution page: positioned for "Compliance-first organizations requiring secure on-premises deployment" with "Secure deployments" — Mistral sells self-hosted/on-prem enterprise deployments of its models alongside La Plateforme, and hosts a public Trust Center at trust.mistral.ai.'),
    ],
}

for product, items in ITEMS.items():
    path = f'rankings/document-extraction/evidence/{product}.json'
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
