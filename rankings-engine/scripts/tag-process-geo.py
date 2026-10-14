# One-off (2026-09-28 GEO lane): tag every process with geoScope, sync the region flag,
# and attach the curated, curl-verified geoNotes. Run from the repo root.
import json
from collections import OrderedDict

US_STATE = {'form_005', 'tax_001', 'qs_043', 'qs_045', 'qs_047', 'tax_011'}
US = {
    'form_001', 'form_011', 'form_012', 'form_002', 'fund_001', 'fund_002', 'fund_003',
    'fund_004', 'fund_006', 'legal_002', 'tax_002', 'tax_003', 'tax_010', 'qs_023', 'qs_044',
    'qs_063', 'hr_001', 'opp_002', 'startup_002', 'shutdown_001', 'hr_011', 'hr_012',
    'vc_001', 'vc_002', 'scale_002', 'opp_012',
}

N = lambda c, l, u, s: {'country': c, 'summary': s, 'actionUrl': u, 'actionLabel': l}

NOTES = {
    'form_001': [
        N('IN', 'India NSWS (MCA SPICe+ incorporation)', 'https://www.nsws.gov.in/',
          "Incorporate through MCA's SPICe+ integrated form — a single filing covers name reservation, incorporation, PAN, TAN, EPFO/ESIC and optional GST; the government's National Single Window System fronts the process."),
        N('UK', 'Companies House — set up a limited company', 'https://www.gov.uk/limited-company-formation',
          "Register a private limited company with Companies House — online filings are usually approved within 24 hours, and Companies House exposes a live REST filing API, so software-driven incorporation genuinely exists here."),
        N('DE', 'Handelsregister (commercial register)', 'https://www.handelsregister.de/',
          "Form a GmbH (or UG) with a notarized deed — since 2022 the notarial formation can happen by video — and the company exists on registration in the Handelsregister; expect days to weeks, not hours."),
        N('FR', 'INPI guichet unique', 'https://procedures.inpi.fr/',
          "Form a SAS/SASU through the INPI guichet unique — the single online portal for all French business formalities since 2023; registration lands in the RCS via INSEE."),
    ],
    'form_002': [
        N('IN', 'Income Tax e-filing portal (PAN/TAN)', 'https://www.incometax.gov.in/iec/foportal/',
          "PAN and TAN — the company's tax identifiers — are allotted automatically as part of the SPICe+ incorporation filing; the Income Tax e-filing portal is where the company then uses them."),
        N('UK', 'HMRC Corporation Tax (UTR)', 'https://www.gov.uk/corporation-tax',
          "There is no EIN application: HMRC posts the company a Unique Taxpayer Reference (UTR) automatically after incorporation, and you register for Corporation Tax within 3 months of starting business."),
        N('DE', 'ELSTER — tax office registration', 'https://www.elster.de/eportal/start',
          "The tax office issues a Steuernummer after you file the Fragebogen zur steuerlichen Erfassung (tax registration questionnaire) on ELSTER — plus a separate VAT ID from the BZSt if needed."),
    ],
    'tax_001': [
        N('UK', 'Companies House confirmation statement', 'https://www.gov.uk/guidance/confirmation-statement-guidance',
          "The closest analog is the confirmation statement: an annual Companies House filing (£34 online) confirming registered details — the same keep-the-company-in-good-standing ritual, but with no tax attached."),
    ],
    'tax_002': [
        N('IN', 'Income Tax e-filing (ITR-6)', 'https://www.incometax.gov.in/iec/foportal/',
          "Companies file the ITR-6 return electronically on the Income Tax e-filing portal; the tax year runs April–March rather than the calendar year."),
        N('UK', 'HMRC Company Tax Return (CT600)', 'https://www.gov.uk/company-tax-returns',
          "The company files a CT600 Company Tax Return with HMRC within 12 months of its accounting period end — plus statutory accounts to Companies House."),
        N('DE', 'ELSTER — corporate tax returns', 'https://www.elster.de/eportal/start',
          "Corporation tax (Körperschaftsteuer) plus trade tax (Gewerbesteuer) returns are filed electronically through ELSTER, in practice via a Steuerberater."),
        N('FR', 'impots.gouv.fr — espace professionnel', 'https://www.impots.gouv.fr/professionnel',
          "Corporate income tax (impôt sur les sociétés) is declared and paid through the company's espace professionnel on impots.gouv.fr."),
    ],
    'qs_063': [
        N('IN', 'EPFO employer portal', 'https://unifiedportal-emp.epfindia.gov.in/epfo/',
          "Employer setup spans EPF (provident fund) and ESI (state insurance) registration plus state-level professional tax; salary TDS is deposited monthly against the company's TAN."),
        N('UK', 'Register as an employer (PAYE)', 'https://www.gov.uk/register-employer',
          "Register as an employer with HMRC for PAYE before the first payday, then report pay through Real Time Information (RTI) — a submission to HMRC on or before every payment — plus pension auto-enrolment duties."),
        N('DE', 'Betriebsnummern-Service (Bundesagentur für Arbeit)', 'https://www.arbeitsagentur.de/unternehmen/betriebsnummern-service',
          "You need a Betriebsnummer (company number) from the Federal Employment Agency before running payroll, then monthly social-insurance reports to each employee's health insurer and wage tax via ELSTER."),
        N('FR', 'Déclaration préalable à l\'embauche (DPAE)', 'https://entreprendre.service-public.fr/vosdroits/F23107',
          "Every hire starts with a DPAE filed with URSSAF before the employee starts; monthly payroll then flows through the DSN (déclaration sociale nominative), France's unified RTI-style payroll report."),
    ],
    'legal_002': [
        N('IN', 'Intellectual Property India e-filing', 'https://ipindiaonline.gov.in/',
          "Trade marks are filed with the Controller General (CGPDTM) through the IP India e-filing portal; public search runs on the separate tmrsearch portal."),
        N('UK', 'UK IPO — register a trade mark', 'https://www.gov.uk/how-to-register-a-trade-mark',
          "UK marks are filed online with the UK IPO (from £170); since Brexit an EUIPO registration no longer covers the UK, so UK + EU protection means two filings."),
        N('DE', 'DPMA trade mark filing', 'https://www.dpma.de/marken/index.html',
          "National marks are filed with the DPMA (DPMAdirekt online filing); the EU-wide alternative is a single EUIPO application covering all 27 member states."),
        N('FR', 'INPI — dépôt de marque', 'https://www.inpi.fr/comprendre-la-propriete-intellectuelle/la-marque',
          "French marks are filed online with the INPI; as in Germany, an EUIPO application is the single-filing route to EU-wide protection."),
    ],
    'tax_011': [
        N('IN', 'GST portal registration', 'https://www.gst.gov.in/',
          "GST replaces the per-state sales-tax patchwork with one national regime — registration per state of operation on the GST portal; SaaS sold from abroad falls under the OIDAR rules."),
        N('UK', 'Register for VAT (Making Tax Digital)', 'https://www.gov.uk/register-for-vat',
          "Instead of per-state sales tax there is one national VAT registration — mandatory past £90k of taxable turnover (or immediately for many non-established sellers) — with returns filed digitally under Making Tax Digital."),
        N('DE', 'BZSt — VAT identification number', 'https://www.bzst.de/',
          "One German VAT registration (plus a BZSt-issued VAT ID) covers the whole country; for EU-wide B2C digital sales a single OSS (One-Stop-Shop) return replaces per-country registrations."),
    ],
    'tax_010': [
        N('UK', 'Corporation Tax R&D relief', 'https://www.gov.uk/guidance/corporation-tax-research-and-development-rd-relief',
          "The UK analog is R&D tax relief claimed on the CT600 — a merged SME/RDEC scheme for accounting periods from April 2024, with a mandatory additional-information form before the claim."),
        N('FR', 'Crédit d\'impôt recherche (CIR)', 'https://entreprendre.service-public.fr/vosdroits/F23533',
          "France's CIR refunds 30% of qualifying R&D spend (with the CII for innovation on top), claimed with the corporate tax return — one of the most generous schemes in Europe."),
    ],
    'hr_012': [
        N('IN', 'EPFO — Employees\' Provident Fund', 'https://unifiedportal-emp.epfindia.gov.in/epfo/',
          "The EPF is the mandatory retirement vehicle once headcount crosses 20 — 12% of basic pay from employer and employee each, administered through the EPFO employer portal."),
        N('UK', 'Pension auto-enrolment (The Pensions Regulator)', 'https://www.thepensionsregulator.gov.uk/en/employers',
          "Not optional like a 401(k): every UK employer must auto-enrol eligible staff into a workplace pension (8% minimum combined contribution) and declare compliance to The Pensions Regulator."),
    ],
    'fund_004': [
        N('UK', 'EMI share option scheme', 'https://www.gov.uk/tax-employee-share-schemes/enterprise-management-incentives-emis',
          "UK startups grant EMI options — an HMRC-approved scheme with capital-gains treatment; the company agrees a valuation with HMRC in advance (the rough 409A analog) and notifies grants to HMRC."),
    ],
    'hr_011': [
        N('UK', 'Sponsor licence (Skilled Worker)', 'https://www.gov.uk/uk-visa-sponsorship-employers',
          "The company first gets a sponsor licence from the Home Office, then issues Certificates of Sponsorship for Skilled Worker visas — salary-threshold based, with no H-1B-style annual lottery."),
        N('DE', 'Make it in Germany (EU Blue Card)', 'https://www.make-it-in-germany.com/en/',
          "Hiring non-EU talent runs on the EU Blue Card and Skilled Immigration Act routes — salary-threshold based, no lottery, with the government's Make it in Germany portal as the canonical guide."),
    ],
    'shutdown_001': [
        N('UK', 'Strike off a company (DS01)', 'https://www.gov.uk/strike-off-your-company-from-companies-register',
          "A solvent company applies for voluntary strike-off with a £33 DS01 filing to Companies House (or a members' voluntary liquidation for larger balance sheets) — closer to one filing than the DE dissolution + IRS final-return chain."),
    ],
}

with open('open-processes/corpus.json') as f:
    tasks = json.load(f, object_pairs_hook=OrderedDict)

order = ['IN', 'UK', 'DE', 'FR']
for t in tasks:
    tid = t['id']
    scope = 'us-state' if tid in US_STATE else 'us' if tid in US else 'global'
    # region (the 🇺🇸 display flag) syncs with the scope: every US-scoped process wears it.
    if scope != 'global':
        t['region'] = 'us'
    assert (t.get('region') == 'us') == (scope != 'global'), tid
    t['geoScope'] = scope
    if tid in NOTES:
        assert scope != 'global', tid
        notes = sorted(NOTES[tid], key=lambda n: order.index(n['country']))
        t['geoNotes'] = notes
    # Re-order keys: geoScope (+ geoNotes) right after region (after cadence when no flag).
    anchor = 'region' if 'region' in t else 'cadence'
    out = OrderedDict()
    for k, v in t.items():
        if k in ('geoScope', 'geoNotes'):
            continue
        out[k] = v
        if k == anchor:
            out['geoScope'] = t['geoScope']
            if 'geoNotes' in t:
                out['geoNotes'] = t['geoNotes']
    t.clear()
    t.update(out)

from collections import Counter
print(Counter(t['geoScope'] for t in tasks))
print('notes:', sum(len(t.get('geoNotes', [])) for t in tasks))
print('note countries:', Counter(n['country'] for t in tasks for n in t.get('geoNotes', [])))

with open('open-processes/corpus.json', 'w') as f:
    json.dump(tasks, f, indent=2)
    f.write('\n')
