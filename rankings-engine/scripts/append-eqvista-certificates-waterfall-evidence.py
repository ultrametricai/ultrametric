#!/usr/bin/env python3
# Eqvista evidence-gap fix, round 2 of the PR #428 review (2026-10-22): supplements the pack
# with verbatim passages from CRAWLED/VERIFIED vendor pages the LLM extraction pass missed —
# same precedent as append-ai-assistants-muse-docs-evidence.py and this bring-up's round-1
# script (append-payroll-equity-bringup-docs-evidence.py).
#
# The two flagged cells and the gap each fix closes:
#   - digital-share-certificates was judged on share-issuance and generic e-signing rows only;
#     the crawled corpus carries certificate-SPECIFIC first-party lines the extraction skipped:
#     the support site's Certificates category (executor signing role, reissue flows for signed
#     certificates), the migration FAQ confirming electronic certificated shares, and the
#     pricing page listing "E-signing certificates" as a Premium feature. All verbatim in
#     rankings-engine/cache/crawl/equity-management/eqvista/{docs,extra-1}.md.
#   - exit-waterfall-analysis was judged "missing: documentation that the waterfall honors
#     liquidation preferences"; the crawled equity-management-software page states exactly that
#     (share classes with liquidation preferences; investor-ready waterfall reports), verbatim
#     in extra-3.md.
#
# The pack change busts the judge cellHash for every eqvista cell; the follow-up is the scoped
# re-judge (judge --category equity-management --product eqvista) plus derive and the derived
# regens. Verdicts are never edited by hand — the judge re-weighs the corrected inputs.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    ('equity-management', 'eqvista'): [
        ('eqvista-supp-cert-faq', 'https://support.eqvista.com',
         'Migration FAQ: "Does Eqvista support certificated and uncertificated shares? Yes, Eqvista supports both uncertificated (electronic) shares and certificated (digital or paper) shares." And: "I\'ve already issued paper certificates. Can I still issue electronic shares? Yes, you can issue electronic shares if you have already issued paper certificates."'),
        ('eqvista-supp-cert-signing', 'https://support.eqvista.com',
         'Certificates support category (https://eqvista.com/support/category/certificates/): "Create a Custom Role for an Executor Signing the Certificate", "How to Reissue Certificate When Shareholder Has Signed It?", "How to Reissue Certificates?"'),
        ('eqvista-supp-cert-esign-pricing', 'https://eqvista.com/pricing/',
         'Premium plan ("For Founders & Professionals", Get Premium at app.eqvista.com/register) lists: "Everything in Freemium; E-signing certificates & SAFE agreements; Board Resolutions & Voting; Rule 701; Form 3921".'),
        ('eqvista-supp-waterfall-preferences', 'https://eqvista.com/equity-management-software/',
         'Equity management must: "Track different share classes and their liquidation preferences, anti-dilution, and voting rights. Model complex cap-table scenarios and generate investor-ready cap-table and waterfall reports."'),
    ],
}


def append(category: str, pid: str, rows: list[dict]) -> None:
    path = f'open-rankings/{category}/evidence/{pid}.json'
    with open(path) as f:
        pack = json.load(f)
    existing = {e['id'] for e in pack}
    added = 0
    for row in rows:
        if row['id'] in existing:
            print(f'{path}: {row["id"]} already present, skipping')
            continue
        pack.append(row)
        added += 1
    with open(path, 'w') as f:
        json.dump(pack, f, indent=2)
        f.write('\n')
    print(f'{path}: +{added} rows')


for (category, pid), items in ITEMS.items():
    append(category, pid, [
        {'id': i, 'tier': 'claimed-docs', 'url': u, 'excerpt': x, 'fetchedAt': NOW}
        for (i, u, x) in items
    ])
