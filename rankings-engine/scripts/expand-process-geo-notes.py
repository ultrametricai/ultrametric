# One-off (2026-09-29 geo-mapping lane, founder ask: "go map the processes in the countries we
# tried to spike so the geo switcher works"): expand geoNotes from 12 processes / 31 notes to
# honest UK/IN/DE/FR coverage across the US-scoped processes AND the jurisdictionally-flavored
# global ones (founder agreement, offboarding, invoicing, accounting, data protection, …).
# Conventions inherited from tag-process-geo.py: every actionUrl curl-verified live before
# listing (browser UA where hosts bot-block); when an official host blocks (mca.gov.in 403,
# legifrance 403, infogreffe/data.inpi.fr Cloudflare, france-visas challenge, esic.gov.in
# unreachable, shcilestamp 403), the NSWS-substitution precedent applies: substitute the
# nearest verifiable official portal or write no note — never fabricate. Countries with no
# true analog get NO note (the honest banner says so). Run from the repo root.
import json
from collections import Counter, OrderedDict

N = lambda c, l, u, s: {'country': c, 'summary': s, 'actionUrl': u, 'actionLabel': l}

NEW_NOTES = {
    # ── formation ──────────────────────────────────────────────────────────────────────────
    'form_011': [  # Set up an LLC
        N('IN', 'NSWS (MCA LLP incorporation)', 'https://www.nsws.gov.in/',
          "The Indian analog is the LLP: incorporated with the MCA via the FiLLiP form (mca.gov.in blocks automated checks — the government's NSWS portal fronts MCA services), with a partner-drafted LLP agreement filed within 30 days."),
        N('UK', 'Set up and run an LLP', 'https://www.gov.uk/guidance/set-up-and-run-a-limited-liability-partnership-llp',
          "The pass-through analog is the LLP, registered at Companies House — though most UK founders just form a private limited company, since there is no US-style LLC and no check-the-box tax election."),
        N('DE', 'BMWK founders portal (UG/GmbH)', 'https://www.existenzgruender.de/',
          "No LLC analog with pass-through: the low-capital route is the UG (haftungsbeschränkt) — a mini-GmbH formable from €1 with a notarized deed; the ministry's founders portal walks through the choices."),
        N('FR', 'INPI guichet unique (SARL/EURL)', 'https://procedures.inpi.fr/',
          "The closest analog is the SARL (or single-member EURL) — a simpler, statute-driven company than the SAS — formed like every French entity through the INPI guichet unique."),
    ],
    'form_002': [  # Get EIN — IN/UK/DE exist; add FR
        N('FR', 'Obtain a SIREN/SIRET number', 'https://entreprendre.service-public.fr/vosdroits/F32135',
          "No application: INSEE allots the SIREN (company) and SIRET (per-establishment) identifiers automatically when the guichet unique registration lands — they arrive with the company's registration."),
    ],
    'form_005': [  # Register state taxes
        N('IN', 'GST portal (per-state registration)', 'https://www.gst.gov.in/',
          "The state layer is real here: GST registration is per state of operation, and professional tax plus shops-and-establishments registration are state acts — the closest thing to US state tax registration."),
        N('UK', 'HMRC — register for VAT', 'https://www.gov.uk/register-for-vat',
          "No states: registering for taxes means one national HMRC registration each — Corporation Tax (the UTR arrives automatically), PAYE when you employ, and VAT past the £90k threshold."),
        N('DE', 'BMWK founders portal (Gewerbeanmeldung)', 'https://www.existenzgruender.de/',
          "The sub-national layer is municipal: a Gewerbeanmeldung (trade registration) with each municipality you operate in, which drives Gewerbesteuer at that municipality's Hebesatz — plus the one federal tax-office registration via ELSTER."),
        N('FR', 'impots.gouv.fr — espace professionnel', 'https://www.impots.gouv.fr/professionnel',
          "Registrations are national and flow from the guichet unique filing; local business taxes (the CFE) are then assessed per commune automatically — nothing to register state-by-state."),
    ],
    'form_012': [  # Convert an LLC to a C-Corp
        N('IN', 'NSWS (MCA conversion filings)', 'https://www.nsws.gov.in/',
          "The analog is converting an LLP into a private limited company under Companies Act s.366 (form URC-1, plus fresh incorporation paperwork) — an MCA process fronted by NSWS since mca.gov.in blocks automated access; it is slow and tax-sensitive, so many simply incorporate fresh."),
        N('UK', 'HMRC — Incorporation Relief', 'https://www.gov.uk/incorporation-relief',
          "The analog move is incorporating an existing sole trade or partnership into a limited company; HMRC's Incorporation Relief defers the capital gains tax when the business transfers in exchange for shares."),
        N('DE', 'UmwG (conversion law) — full text', 'https://www.gesetze-im-internet.de/umwg_1995/',
          "Changing legal form is a statutory Formwechsel under the Umwandlungsgesetz (e.g. UG to GmbH, or GbR into GmbH) — notarized, registered in the Handelsregister, and usually tax-neutral if done under the UmwStG."),
        N('FR', 'INPI guichet unique (transformation)', 'https://procedures.inpi.fr/',
          "The classic pre-fundraise move is transforming a SARL into a SAS: an extraordinary shareholders' decision, a commissaire report, amended statuts, then the transformation filed through the guichet unique."),
    ],
    # ── fundraising ────────────────────────────────────────────────────────────────────────
    'fund_001': [  # Raise pre-seed (SAFEs)
        N('IN', 'Startup India (DPIIT recognition)', 'https://www.startupindia.gov.in/',
          "Pre-seed runs on CCPS/CCD instruments or the iSAFE (a practitioner adaptation of the SAFE onto compulsorily convertible preference shares); DPIIT Startup-India recognition unlocks the startup tax benefits, and the old 'angel tax' on premium issues was abolished from FY 2025-26."),
        N('UK', 'HMRC — apply to use SEIS', 'https://www.gov.uk/guidance/venture-capital-schemes-apply-to-use-the-seed-enterprise-investment-scheme',
          "The SAFE analog is the ASA (advanced subscription agreement) or convertible loan note — but the round is really driven by SEIS/EIS tax relief: get HMRC advance assurance first, and keep ASA longstop dates inside the 6-month S/EIS window."),
        N('DE', 'BAFA — INVEST grant for angels', 'https://www.bafa.de/DE/Wirtschaft/Beratung_Finanzierung/Invest/invest_node.html',
          "Pre-seed runs on the Wandeldarlehen (convertible loan) — kept notarization-free in most setups — and business angels claim the federal INVEST grant on qualifying equity tickets via BAFA."),
        N('FR', 'Bpifrance Création (state investment bank)', 'https://bpifrance-creation.fr/',
          "The SAFE analog is the BSA-AIR (bon de souscription d'actions — accord d'investissement rapide), a practitioner-standard warrant instrument; Bpifrance, the state investment bank, co-invests and its Création portal is the canonical guide."),
    ],
    'fund_002': [  # Close a priced equity round
        N('IN', 'NSWS (MCA private placement filings)', 'https://www.nsws.gov.in/',
          "A priced round is a private placement under Companies Act s.42: special resolution, a registered-valuer report on price, PAS-3 return of allotment to the MCA (fronted by NSWS — mca.gov.in blocks automated access), and FC-GPR reporting to the RBI within 30 days if the money is foreign."),
        N('UK', 'Companies House — return of allotment (SH01)', 'https://www.gov.uk/government/publications/return-of-allotment-of-shares-sh01',
          "Closing means allotting new shares: board and (usually) shareholder authorities, a subscription and shareholders' agreement, new articles for the preferred class, then the SH01 return of allotment filed at Companies House within a month."),
        N('DE', 'Handelsregister (capital increase)', 'https://www.handelsregister.de/',
          "A priced round is a notarized Kapitalerhöhung: the notary beurkundets the shareholder resolution and subscription, and the new shares only exist once the increase is registered in the Handelsregister — build notary lead time into the closing plan."),
        N('FR', 'INPI guichet unique (capital increase)', 'https://procedures.inpi.fr/',
          "Closing is an augmentation de capital: an extraordinary general meeting, updated statuts, the funds certified on a blocked account, then the capital change filed through the guichet unique into the RCS."),
    ],
    'fund_003': [  # Get a 409A valuation
        N('IN', 'IBBI — registered valuers', 'https://ibbi.gov.in/',
          "No 409A, but pricing is still regulated: share issues need a report from an IBBI-registered valuer (Companies Act) or merchant banker (Income-tax Rule 11UA), and ESOP perquisite tax at exercise runs off fair market value."),
        N('UK', 'HMRC — employment related securities', 'https://www.gov.uk/government/collections/employment-related-securities',
          "The analog is agreeing an EMI valuation with HMRC's Shares and Assets Valuation team (the VAL231 process, now run through HMRC's ERS guidance): it fixes actual and unrestricted market value for 90 days, so grant options inside that window."),
    ],
    'fund_004': [  # Issue stock options — UK exists
        N('IN', 'Startup India (ESOP rules & deferral)', 'https://www.startupindia.gov.in/',
          "ESOPs need a shareholders' special resolution under Companies Act s.62(1)(b) and are taxed as a perquisite at exercise on a registered valuation — DPIIT-recognised startups can defer that perquisite tax by up to five years."),
        N('DE', '§ 19a EStG (deferred taxation of employee equity)', 'https://www.gesetze-im-internet.de/estg/__19a.html',
          "Real options were historically tax-hostile, so most startups grant VSOPs (virtual options, cash-settled); § 19a EStG — expanded by the 2024 Zukunftsfinanzierungsgesetz — now defers the dry-income tax on genuine employee shares for qualifying startups."),
        N('FR', 'BSPCE — Bpifrance Création guide', 'https://bpifrance-creation.fr/encyclopedie/financements/recours-a-investisseurs/bons-souscription-parts-createur-dentreprise',
          "French startups grant BSPCE — founder-company warrants reserved for young companies, with capital-gains-style taxation and no social charges for the employer; the Bpifrance (state investment bank) encyclopedia page is the canonical guide."),
    ],
    'fund_006': [  # Convert SAFEs at the priced round
        N('IN', 'RBI (FDI reporting — FIRMS/FC-GPR)', 'https://www.rbi.org.in/',
          "Convertibles here are CCDs/CCPS (or iSAFEs on CCPS): conversion is a fresh allotment — board resolution, PAS-3 to the MCA — and foreign-held instruments must be reported to the RBI (FC-GPR on the FIRMS portal) within 30 days."),
        N('UK', 'HMRC — apply to use EIS', 'https://www.gov.uk/guidance/venture-capital-schemes-apply-for-the-enterprise-investment-scheme',
          "ASAs convert at the round as a normal allotment (SH01 to Companies House) — and the conversion deadline is hard law for tax relief: S/EIS requires shares to be issued within the ASA's 6-month longstop."),
        N('DE', 'Handelsregister (conversion capital increase)', 'https://www.handelsregister.de/',
          "Wandeldarlehen convert through a notarized capital increase: the loan claim is contributed, the resolution beurkundet, and the new shares exist on registration in the Handelsregister — the notary drives the closing timeline."),
        N('FR', 'INPI guichet unique (BSA-AIR exercise)', 'https://procedures.inpi.fr/',
          "BSA-AIR holders exercise their warrants at the priced round: the resulting augmentation de capital is decided, the statuts updated, and the capital change filed through the guichet unique."),
    ],
    # ── ongoing compliance & tax ───────────────────────────────────────────────────────────
    'tax_001': [  # File DE franchise tax — UK exists
        N('IN', 'NSWS (MCA annual filings)', 'https://www.nsws.gov.in/',
          "No franchise tax; the keep-the-company-alive annual ritual is the MCA pair — financial statements (AOC-4) and the annual return (MGT-7/MGT-7A) — filed on MCA V3 (fronted by NSWS; mca.gov.in blocks automated access), with per-day late fees that compound fast."),
        N('DE', 'DIHK — chamber of commerce (IHK) membership', 'https://www.dihk.de/',
          "No franchise tax; the closest mandatory annual levy is the IHK-Beitrag — every trading company is automatically a chamber-of-commerce member and pays a small revenue-based contribution each year, no filing ritual attached."),
        N('FR', 'CFE — cotisation foncière des entreprises', 'https://entreprendre.service-public.fr/vosdroits/F23547',
          "The closest analog is the CFE: an annual local business levy assessed per commune on every company (with a first-year exemption), paid through the espace professionnel — France's version of 'you pay something every year just for existing'."),
    ],
    'tax_003': [  # Issue 1099s
        N('IN', 'Income Tax e-filing (TDS)', 'https://www.incometax.gov.in/iec/foportal/',
          "Stronger than 1099s: TDS means you deduct tax at source from contractor and professional fees (s.194C/194J) before paying, deposit it monthly against your TAN, file quarterly TDS returns and issue Form 16A certificates to each payee."),
        N('UK', 'HMRC — check employment status (CEST)', 'https://www.gov.uk/guidance/check-employment-status-for-tax',
          "No 1099 regime — ordinary contractors self-assess. Your duty is status instead of paperwork: run off-payroll (IR35) determinations (HMRC's CEST tool) once you are a medium company, and the CIS deduction scheme applies only to construction."),
        N('FR', 'DAS2 — declaration of fees & commissions', 'https://entreprendre.service-public.gouv.fr/vosdroits/R14651',
          "The direct analog is the DAS2: an annual electronic declaration to the tax administration of fees, commissions and honoraria paid to third parties past €2,400 per beneficiary — with stiff penalties for skipping it."),
    ],
    'tax_010': [  # Claim the R&D tax credit — UK/FR exist
        N('IN', 'DSIR — in-house R&D recognition', 'https://dsir.gov.in/',
          "No US-style credit since the 200% weighted deduction lapsed: R&D spend now deducts at 100%, and DSIR recognition of an in-house R&D unit is the gateway to the remaining incentives (customs/GST concessions, government R&D schemes)."),
        N('DE', 'BSFZ — Forschungszulage certification', 'https://www.bescheinigung-forschungszulage.de/',
          "The Forschungszulage (research allowance) refunds 25% of qualifying R&D wages — more for SMEs since 2024 — claimed in two steps: a project certificate from the BSFZ, then the allowance claim with the tax return via ELSTER."),
    ],
    'tax_011': [  # Register for sales tax where you have nexus — IN/UK/DE exist
        N('FR', 'impots.gouv.fr — espace professionnel (TVA)', 'https://www.impots.gouv.fr/professionnel',
          "One national TVA registration replaces the state-by-state patchwork — declared and paid through the espace professionnel — and for EU-wide B2C digital sales a single OSS (One-Stop-Shop) return covers every member state."),
    ],
    # ── quick-setup / operations ───────────────────────────────────────────────────────────
    'qs_043': [  # Set up registered agent
        N('IN', 'NSWS (MCA registered office — INC-22)', 'https://www.nsws.gov.in/',
          "No agent industry: the analog is the registered office itself — declared at (or within 30 days of) incorporation via form INC-22 to the MCA (fronted by NSWS), with the company name displayed at the premises."),
        N('UK', 'Companies House — registered office rules', 'https://www.gov.uk/limited-company-formation/company-address',
          "The analog is the registered office: since the 2023 ECCT Act it must be an 'appropriate address' where documents reliably reach the company (PO boxes alone are out), plus a registered email — agent-provided addresses remain fine."),
        N('DE', 'Handelsregister (business address)', 'https://www.handelsregister.de/',
          "No registered-agent concept: the GmbH registers an inländische Geschäftsanschrift (domestic business address) in the Handelsregister where service of process is valid — keep it current via the notary when you move."),
        N('FR', 'INPI guichet unique (siège social)', 'https://procedures.inpi.fr/',
          "The analog is the siège social declared through the guichet unique: it can be the founder's home or a domiciliation company — the latter must hold a prefectural agrément — and changing it is a formal statuts amendment."),
    ],
    'qs_044': [  # Set up mailing address
        N('UK', 'Companies House — registered office rules', 'https://www.gov.uk/limited-company-formation/company-address',
          "Virtual-office addresses are a normal, legal registered-office choice — but post-ECCT the address must be one where documents actually come to the company's attention, and Companies House now also requires a registered email address."),
    ],
    'qs_045': [  # Review state registration
        N('IN', 'GST portal (multi-state footprint)', 'https://www.gst.gov.in/',
          "The federal texture is real: employees or premises in a new state typically mean a fresh GST registration for that state, plus state professional tax and a shops-and-establishments registration — India's version of foreign qualification."),
        N('UK', 'Register a UK establishment (OS IN01)', 'https://www.gov.uk/government/publications/register-a-uk-establishment-of-an-overseas-company-os-in01',
          "Inside the UK there is nothing to qualify for; the concept appears at the border — a foreign company opening a UK establishment registers it at Companies House with form OS IN01 within a month."),
        N('DE', 'BMWK founders portal (per-municipality registration)', 'https://www.existenzgruender.de/',
          "The analog is municipal: each additional Betriebsstätte (office/branch) needs its own Gewerbeanmeldung with that municipality, and Gewerbesteuer is then apportioned across them — the ministry's founders portal covers the mechanics."),
        N('FR', 'INPI guichet unique (secondary establishment)', 'https://procedures.inpi.fr/',
          "A new office is an établissement secondaire: declared through the guichet unique, which issues a per-establishment SIRET — a formality rather than a qualification battle."),
    ],
    'qs_047': [  # File state annual report
        N('IN', 'NSWS (MCA annual return)', 'https://www.nsws.gov.in/',
          "The annual-report analog is the MCA annual return (MGT-7/MGT-7A) plus financial statements (AOC-4), due after the AGM each year on MCA V3 (fronted by NSWS — mca.gov.in blocks automated access); late fees accrue per day."),
        N('UK', 'File your confirmation statement', 'https://www.gov.uk/file-your-confirmation-statement-with-companies-house',
          "The direct analog is the confirmation statement: at least annually, £34 online, confirming registered details to Companies House — miss it and the registrar can strike the company off."),
        N('DE', 'Unternehmensregister (annual accounts)', 'https://www.unternehmensregister.de/',
          "The ritual here is disclosure: every GmbH must file (or for micro-companies deposit) annual accounts electronically for the Unternehmensregister within 12 months of year-end — enforced with automatic Bundesanzeiger fine proceedings."),
        N('FR', 'INPI guichet unique (dépôt des comptes)', 'https://procedures.inpi.fr/',
          "The analog is the dépôt des comptes annuels: accounts approved by the shareholders within 6 months of year-end, then filed via the guichet unique to the commercial-court registry (confidentiality options exist for small companies)."),
    ],
    'qs_063': [],  # complete
    # ── people ─────────────────────────────────────────────────────────────────────────────
    'hr_001': [  # Hire first employee
        N('IN', 'EPFO employer portal', 'https://unifiedportal-emp.epfindia.gov.in/epfo/',
          "First-hire setup means an appointment letter, checking EPF/ESI applicability thresholds, a state shops-and-establishments registration, and monthly TDS on salary against the company's TAN — the EPFO employer portal anchors the social-security side."),
        N('UK', 'Employ someone: step by step', 'https://www.gov.uk/employing-staff',
          "gov.uk publishes the exact first-hire checklist: right-to-work checks, employers' liability insurance, PAYE registration before the first payday, a written statement of particulars on day one, and pension auto-enrolment."),
        N('DE', 'Betriebsnummern-Service (employer number)', 'https://www.arbeitsagentur.de/unternehmen/betriebsnummern-service',
          "Before the first payslip: a Betriebsnummer from the Federal Employment Agency, registration with the employee's health insurer (which routes all social insurance), statutory accident insurance with the sector's Berufsgenossenschaft, and wage tax via ELSTER."),
        N('FR', 'DPAE — pre-hire declaration', 'https://entreprendre.service-public.fr/vosdroits/F23107',
          "Every hire starts with the DPAE to URSSAF before the start date; add a written contract (French language), affiliation to the mandatory mutuelle and retirement schemes, and the initial médecine du travail visit."),
    ],
    'hr_005': [  # Offboard employee (global — jurisdictionally flavored)
        N('IN', 'Ministry of Labour & Employment', 'https://labour.gov.in/',
          "Offboarding is governed by state shops-and-establishments acts and central law: contractual/statutory notice, gratuity if service crossed five years, leave encashment, and a clean full-and-final settlement — 'at will' does not exist."),
        N('UK', 'Dismissing staff — the rules', 'https://www.gov.uk/dismiss-staff',
          "Dismissal is procedural, not at-will: a fair reason and a fair process (the Acas code), statutory notice periods, and final pay including accrued holiday — tribunals police shortcuts."),
        N('DE', 'KSchG — dismissal protection law', 'https://www.gesetze-im-internet.de/kschg/',
          "The Kündigungsschutzgesetz protects employees after six months in companies with more than ten staff: dismissal needs a legally recognized ground and a WET-INK signed notice letter (electronic form is invalid) — severance deals are the common exit."),
        N('FR', 'Rupture conventionnelle', 'https://entreprendre.service-public.fr/vosdroits/F19030',
          "The standard amicable exit is the rupture conventionnelle: a signed agreement with a mandatory indemnity, a 15-day withdrawal period, and homologation by the labour administration — unilateral licenciement demands strict cause and procedure."),
    ],
    'hr_011': [  # Sponsor a work visa — UK/DE exist
        N('IN', 'Bureau of Immigration (Employment Visa)', 'https://boi.gov.in/',
          "Foreign hires come in on an Employment Visa issued by Indian missions — salary floor around US$25,000, role must not be routinely fillable locally — with post-arrival FRRO registration for long stays; there is no sponsor-licence system."),
        N('FR', 'French Tech Visa for Employees (talent card)', 'https://demarche.numerique.gouv.fr/commencer/passeport-talent-entreprise-innovante',
          "The startup route is the 'talent' residence card: employees of state-recognised innovative companies (French Tech Visa) get a multi-year permit on a salary threshold of about twice the SMIC — no lottery; the attestation request runs on the official démarches portal."),
    ],
    'hr_012': [  # Set up a 401(k) — IN/UK exist
        N('DE', 'BetrAVG — occupational pensions law', 'https://www.gesetze-im-internet.de/betravg/',
          "State pension contributions ride payroll automatically; the 401(k) analog is betriebliche Altersvorsorge — every employer MUST offer salary conversion (Entgeltumwandlung) with a 15% employer top-up when social charges are saved."),
        N('FR', 'AGIRC-ARRCO complementary pension', 'https://www.agirc-arrco.fr/',
          "Mandatory complementary pensions (AGIRC-ARRCO) enroll automatically through payroll's DSN — nothing to set up; the optional analog is a PER d'entreprise (collective retirement savings plan) as a perk."),
    ],
    'scale_002': [  # Set up benefits
        N('IN', 'Ministry of Labour & Employment', 'https://labour.gov.in/',
          "The statutory floor is ESI health cover for lower-wage employees, EPF retirement, and gratuity; on top, a group mediclaim policy is the standard startup benefit — group health cover for employees has been an IRDAI expectation since 2020."),
        N('UK', 'Expenses and benefits for employers', 'https://www.gov.uk/employer-reporting-expenses-benefits',
          "The NHS makes health insurance a perk rather than table stakes; the mandatory piece is pension auto-enrolment, and any private medical or similar benefit is a taxable benefit-in-kind reported to HMRC (P11D or payrolling)."),
        N('DE', 'Deutsche Rentenversicherung', 'https://www.deutsche-rentenversicherung.de/',
          "Health, pension, care and unemployment insurance are statutory and ride payroll — there is no benefits enrollment project; the discretionary layer is a bAV pension offer (mandatory to offer) and perks like the Deutschlandticket or company fitness."),
        N('FR', 'Mandatory complementary health cover (mutuelle)', 'https://entreprendre.service-public.fr/vosdroits/F33754',
          "Every employer must provide a mutuelle — complementary health insurance at least 50% employer-funded — plus prévoyance cover for cadres; both plug into payroll's DSN rather than an open-enrollment season."),
    ],
    'opp_002': [  # Add a contractor (1099)
        N('IN', 'Income Tax e-filing (TDS on fees)', 'https://www.incometax.gov.in/iec/foportal/',
          "Onboarding a contractor means collecting their PAN and deducting TDS from every payment (s.194C/194J), depositing it monthly and reporting it quarterly — plus checking whether their GST registration applies to your invoices."),
        N('UK', 'HMRC — check employment status (CEST)', 'https://www.gov.uk/guidance/check-employment-status-for-tax',
          "Before the contract: an IR35/off-payroll status check (HMRC's CEST tool gives a rulable answer) — medium and large clients must issue a status determination statement, and misclassification lands the tax bill on you."),
        N('DE', 'Deutsche Rentenversicherung (status determination)', 'https://www.deutsche-rentenversicherung.de/',
          "The risk is Scheinselbständigkeit (false self-employment): a one-client contractor working like staff triggers retroactive social contributions — the DRV Clearingstelle runs an official status-determination procedure when in doubt."),
        N('FR', 'URSSAF — attestation de vigilance', 'https://www.urssaf.fr/accueil/attestation-vigilance.html',
          "Contractors must be registered (micro-entrepreneur or company), and for contracts of €5,000+ you must collect and verify their URSSAF attestation de vigilance every six months — plus requalification risk if they work like an employee."),
    ],
    'opp_012': [  # Monitor trademark / handle availability
        N('IN', 'IP India — trade mark public search', 'https://tmrsearch.ipindia.gov.in/tmrpublicsearch/',
          "Monitoring is on the owner: watch the public search portal and the weekly Trade Marks Journal — oppositions run for 4 months from publication of a conflicting application."),
        N('UK', 'UK IPO — search for a trade mark', 'https://www.gov.uk/search-for-trademark',
          "The UK IPO notifies owners of earlier UK marks when a similar application publishes, but acting is on you: a 2-month opposition window (extendable by one) from publication in the journal."),
        N('DE', 'DPMAregister (register & journal)', 'https://register.dpma.de/',
          "The DPMA examines only absolute grounds and does not notify earlier owners — watching DPMAregister (or paying a watch service) is on you, with a 3-month opposition window after publication."),
        N('FR', 'INPI — marques', 'https://www.inpi.fr/',
          "The INPI does not police conflicts for you: monitor the Bulletin officiel de la propriété industrielle via INPI's databases and oppose within 2 months of a conflicting publication."),
    ],
    # ── the founder's worked example ───────────────────────────────────────────────────────
    'startup_002': [  # Sign the founder agreement & split equity
        N('IN', 'Startup India (founder agreement resources)', 'https://www.startupindia.gov.in/',
          "The founders' agreement is enforceable contract law — but it must be properly stamped (stamp duty is a state tax, e-stamping in most states) to be usable in court; mirror transfer restrictions and reverse vesting in the articles, since Indian law won't imply them."),
        N('UK', 'Model articles of association', 'https://www.gov.uk/guidance/model-articles-of-association-for-limited-companies',
          "Vesting is not a default: it lives in a shareholders' agreement plus bespoke articles (the statutory model articles have no leaver or share-class provisions) — founders typically hold ordinary shares with compulsory-transfer 'leaver' clauses, and every allotment is filed at Companies House."),
        N('DE', 'Bundesnotarkammer (notaries)', 'https://www.bnotk.de/',
          "GmbH shares only move by notarial deed (§ 15 GmbHG), so founder vesting is drafted as notarized call-option/clawback clauses in the Gesellschaftervereinbarung — plan founder-agreement changes around notary appointments, not signatures."),
        N('FR', 'Pacte d\'associés — Bpifrance Création guide', 'https://bpifrance-creation.fr/encyclopedie/structures-juridiques/entreprendre-a-plusieurs/pacte-dassocies-organisation',
          "The founder agreement is the pacte d'associés — a private contract alongside the statuts (good faith obligations are real under French law); vesting is built from promesses de cession (share-transfer promises), and the SAS's statutory flexibility makes it the vehicle of choice. Guide from Bpifrance, the state investment bank."),
    ],
    'shutdown_001': [  # Shut down the company — UK exists
        N('IN', 'IBBI (voluntary liquidation) / MCA strike-off', 'https://ibbi.gov.in/',
          "Two exits: MCA strike-off via form STK-2 for a company with no liabilities, or a formal voluntary liquidation under the IBC run by an insolvency professional and overseen by the IBBI — both slower and more document-heavy than a US dissolution."),
        N('DE', 'Handelsregister (Liquidation & Sperrjahr)', 'https://www.handelsregister.de/',
          "Winding up a GmbH is slow by design: a notarized dissolution resolution, liquidators registered, creditors publicly invited — then a mandatory one-year Sperrjahr before assets can distribute and the company is finally deleted from the Handelsregister."),
        N('FR', 'INPI guichet unique (dissolution-liquidation)', 'https://procedures.inpi.fr/',
          "The sequence is dissolution (shareholder decision + legal-announcement publication), a liquidation phase closing the accounts, then radiation from the RCS — every step filed through the guichet unique."),
    ],
    # ── VC fund ────────────────────────────────────────────────────────────────────────────
    'vc_001': [  # Form a VC fund
        N('IN', 'SEBI — Alternative Investment Funds', 'https://www.sebi.gov.in/',
          "Venture funds register with SEBI as Category I AIFs (VCF sub-category): a trust or LLP structure with a SEBI-registered manager, minimum corpus and investor-ticket floors, and ongoing SEBI reporting — registration precedes any fundraising."),
        N('UK', 'FCA — authorisation & registration', 'https://www.fca.org.uk/firms/authorisation',
          "The stack is an English (or Scottish) limited partnership — usually a PFLP — with a GP and an FCA-regulated manager: most emerging managers start as sub-threshold AIFMs registered with the FCA or operate under a regulatory host."),
        N('DE', 'BaFin (AIFM registration)', 'https://www.bafin.de/',
          "The standard vehicle is a GmbH & Co. KG with the manager registered at BaFin as a sub-threshold AIFM under § 2(4) KAGB — full authorization only kicks in past the AuM thresholds."),
        N('FR', 'AMF — fund management authorisation', 'https://www.amf-france.org/',
          "French venture vehicles are FPCIs (professional private-equity funds) run by an AMF-authorised (or registered) management company — AMF approval of the manager is the long pole in the schedule."),
    ],
    'vc_002': [  # Close the fund
        N('IN', 'SEBI (AIF reporting)', 'https://www.sebi.gov.in/',
          "Closing mechanics run through the AIF's PPM terms; SEBI expects the first close within 12 months of the PPM being taken on record, and corpus/close details flow into SEBI's periodic AIF reporting."),
        N('UK', 'Set up and run a limited partnership', 'https://www.gov.uk/guidance/set-up-and-run-a-limited-partnership',
          "First closing is when the LP formally exists as a fund: the limited partnership (usually PFLP-designated) is registered at Companies House, LP capital commitments are documented in the LPA, and AIFM notifications to the FCA follow the close."),
    ],
    # ── flavored global processes ──────────────────────────────────────────────────────────
    'legal_003': [  # Get IP assignments signed
        N('IN', 'Copyright Office India', 'https://copyright.gov.in/',
          "Assignments must be in writing and are read narrowly: the Copyright Act (s.19) voids assignments of unspecified future works and defaults unstated terms to five years — so PIIA-style blanket clauses need Indian-law drafting, plus moral-rights waivers."),
        N('DE', 'ArbnErfG — employee inventions act', 'https://www.gesetze-im-internet.de/arbnerfg/',
          "A blanket PIIA cannot capture patents: the Arbeitnehmererfindungsgesetz gives employees rights in their inventions — the employer must actively claim each reported invention (deemed claimed after four months) and owes statutory compensation."),
        N('FR', 'INPI (employee inventions)', 'https://www.inpi.fr/',
          "Employee inventions follow Code de la propriété intellectuelle L611-7: 'mission' inventions belong to the employer but carry a mandatory rémunération supplémentaire, and copyright's moral rights are unwaivable — the INPI (home of the CNIS disputes commission) is the anchor."),
    ],
    'legal_004': [  # Negotiate SaaS agreement
        N('DE', '§ 305 BGB — standard terms control', 'https://www.gesetze-im-internet.de/bgb/__305.html',
          "German AGB law subjects standard terms to content control EVEN B2B (§§ 305-310 BGB): liability caps and auto-renewal clauses that are routine in US SaaS paper are regularly void here — localize the template, don't just translate it."),
    ],
    'scale_003': [  # Write the employee handbook
        N('IN', 'Ministry of Labour & Employment', 'https://labour.gov.in/',
          "The statutory cousin is standing orders under the Industrial Employment (Standing Orders) Act — certified workplace rules once headcount crosses the state threshold; below it, a well-drafted HR policy plus state shops-and-establishments rules carry the load."),
        N('UK', 'Employment contracts & written particulars', 'https://www.gov.uk/employment-contracts-and-conditions',
          "A written statement of particulars is a DAY-ONE legal right for every employee — the handbook builds on it, and disciplinary/grievance procedures should track the Acas code that tribunals measure employers against."),
        N('DE', 'NachwG — written particulars law', 'https://www.gesetze-im-internet.de/nachwg/',
          "The Nachweisgesetz requires the essential terms of employment in writing (tightened in 2022, with fines); from five employees a works council (Betriebsrat) can be elected, and many 'handbook' topics become co-determination matters."),
        N('FR', 'Règlement intérieur', 'https://entreprendre.service-public.fr/vosdroits/F1905',
          "At 50+ employees a règlement intérieur is mandatory — a formal document covering discipline, health/safety and harassment, filed with the labour inspectorate and the prud'hommes — and it must be in French."),
    ],
    'sales_002': [  # Send an invoice
        N('IN', 'GST e-Invoice portal (IRP)', 'https://einvoice.gst.gov.in/',
          "Invoices are GST documents: registered businesses past ₹5 crore turnover must clear every B2B invoice through the government IRP (e-invoicing) to get an IRN and QR code — an invoice without one simply isn't valid."),
        N('UK', 'Invoicing and taking payment', 'https://www.gov.uk/invoicing-and-taking-payment-from-customers',
          "Invoices must carry the statutory particulars (and full VAT-invoice fields once registered); late payers owe statutory interest at 8% over base under the late-payment legislation — gov.uk documents both."),
        N('DE', '§ 14 UStG — invoice requirements', 'https://www.gesetze-im-internet.de/ustg_1980/__14.html',
          "§ 14 UStG fixes the mandatory invoice fields (sequential number, Steuernummer/USt-IdNr, …) — and since January 2025 every German business must be able to RECEIVE structured e-invoices (XRechnung/ZUGFeRD) for domestic B2B, with issuing phasing in."),
        N('FR', 'Mentions obligatoires sur une facture', 'https://entreprendre.service-public.fr/vosdroits/F31808',
          "French invoices carry a long list of mentions obligatoires (SIREN, RCS, per-line detail, late-payment penalty terms…), and mandatory B2B e-invoicing via accredited platforms (PDP) phases in from September 2026 — receiving first, issuing by 2027."),
    ],
    'qs_073': [  # Set up accounting
        N('IN', 'ICAI (statutory audit)', 'https://www.icai.org/',
          "Books follow the Companies Act and Indian accounting standards, and — unlike everywhere else — EVERY company needs a statutory audit by a chartered accountant from year one, so the auditor relationship starts with the books."),
        N('UK', 'Audit exemption for small companies', 'https://www.gov.uk/audit-exemptions-for-private-limited-companies',
          "Statutory accounts for Companies House are unavoidable, but most startups qualify for the small-company audit exemption; FRS 105/102 set the accounting framework your software must map to."),
        N('DE', 'ELSTER (GoBD-compliant bookkeeping)', 'https://www.elster.de/eportal/start',
          "Bookkeeping must be GoBD-compliant (tamper-evident, German retention rules), the de-facto chart of accounts is DATEV's SKR03/SKR04, and nearly every startup runs the books through a Steuerberater who files via ELSTER."),
        N('FR', 'ANC — Plan Comptable Général', 'https://www.anc.gouv.fr/',
          "France mandates the chart of accounts: the Plan Comptable Général from the ANC is law, and the tax authority can demand your ledger as a standardized FEC file — accounting software must speak both."),
    ],
    'comp_001': [  # Start SOC 2 Type I
        N('UK', 'NCSC — Cyber Essentials', 'https://www.ncsc.gov.uk/cyberessentials/overview',
          "UK buyers ask for Cyber Essentials (the NCSC-backed baseline, mandatory for many government contracts) and ISO 27001 more often than SOC 2 — SOC 2 still travels for US-facing sales."),
        N('DE', 'BSI — IT security authority', 'https://www.bsi.bund.de/',
          "German enterprise security reviews anchor on ISO 27001 (historically also 'auf Basis von BSI IT-Grundschutz') rather than SOC 2 — plan ISO 27001 if the pipeline is DACH enterprise."),
        N('FR', 'ANSSI (cyber.gouv.fr)', 'https://cyber.gouv.fr/',
          "French buyers look for ISO 27001, and cloud vendors selling to the public sector meet ANSSI's SecNumCloud qualification — SOC 2 is a US-market artifact here."),
    ],
    'comp_010': [  # Publish privacy policy & DPA
        N('IN', 'MeitY (DPDP Act 2023)', 'https://www.meity.gov.in/',
          "The Digital Personal Data Protection Act 2023 is the GDPR analog: consent-first processing, notice requirements and data-fiduciary duties, with rules phasing in — privacy paper for India cites the DPDP Act, not the GDPR."),
        N('UK', 'ICO — data protection fee', 'https://ico.org.uk/for-organisations/data-protection-fee/',
          "UK GDPR applies post-Brexit with the ICO as regulator — and there is a concrete registration step US startups miss: nearly every data-processing company must pay the ICO's annual data protection fee."),
        N('DE', 'BfDI — federal data protection authority', 'https://www.bfdi.bund.de/',
          "GDPR plus the BDSG: German specifics include mandatory data protection officers at lower thresholds (generally 20+ people regularly processing personal data) and enforcement by strict state DPAs alongside the federal BfDI."),
        N('FR', 'CNIL', 'https://www.cnil.fr/',
          "The CNIL is Europe's most active enforcer of GDPR cookie/consent rules — its published guidelines on cookies and trackers are effectively the spec for a French-market privacy policy and consent banner."),
    ],
    'comp_011': [  # Keep board minutes on cadence
        N('IN', 'ICSI — secretarial standards', 'https://www.icsi.edu/',
          "Cadence is law, not hygiene: the first board meeting within 30 days of incorporation and at least four a year (gap ≤ 120 days), run per ICSI Secretarial Standard SS-1 — small companies get a lighter two-meeting regime."),
        N('UK', 'Running a limited company', 'https://www.gov.uk/running-a-limited-company',
          "No statutory meeting cadence for private companies, but the Companies Act requires minutes of every board and shareholder decision kept for TEN years — written resolutions are the routine substitute for meetings."),
    ],
    'comp_013': [  # Run the annual penetration test
        N('IN', 'CERT-In (empanelled auditors)', 'https://www.cert-in.org.in/',
          "Security testing here runs through CERT-In's empanelled auditor list, and CERT-In's 2022 directions add real teeth: covered incidents must be reported within six hours — a sharper regime than most customers' annual-pentest ask."),
    ],
    'ins_001': [  # Get insurance quotes
        N('UK', "Employers' liability insurance (mandatory)", 'https://www.gov.uk/employers-liability-insurance',
          "One line is compulsory: employers' liability insurance (≥ £5m from an authorised insurer) from the day you employ anyone, with fines of up to £2,500 per uninsured day — D&O/cyber remain optional buys."),
        N('DE', 'DGUV — statutory accident insurance', 'https://www.dguv.de/',
          "Workplace-accident cover is not shopped for: statutory accident insurance via the sector's Berufsgenossenschaft (DGUV system) is automatic and mandatory — the commercial quotes are for D&O, cyber and Betriebshaftpflicht."),
    ],
    'ops_014': [  # Lease an office
        N('UK', 'Stamp Duty Land Tax', 'https://www.gov.uk/stamp-duty-land-tax',
          "Commercial leases can trigger SDLT on the lease's net present value — a filing US startups don't expect — and watch whether the lease is inside the Landlord & Tenant Act 1954 security-of-tenure regime."),
        N('FR', 'Bail commercial (3-6-9)', 'https://entreprendre.service-public.fr/vosdroits/F23927',
          "The default is the bail commercial '3-6-9': a nine-year lease the TENANT can break every three years, with statutory renewal rights — startups wanting flexibility negotiate a bail dérogatoire (≤ 3 years) instead."),
    ],
    'qs_051': [  # Set up cap table
        N('IN', 'CDSL (dematerialisation)', 'https://www.cdslindia.com/',
          "Since the 2023 MCA amendment, private companies (other than small ones) must DEMATERIALISE their shares — an ISIN via NSDL/CDSL, shares held in demat accounts, and half-yearly PAS-6 reconciliation — so the 'cap table' has an official electronic backbone."),
        N('UK', 'PSC register guidance', 'https://www.gov.uk/guidance/people-with-significant-control-pscs',
          "The legal record is the company's own register of members plus the public PSC (people with significant control) register at Companies House — cap-table software mirrors those registers, not the other way round."),
        N('DE', '§ 40 GmbHG — Gesellschafterliste', 'https://www.gesetze-im-internet.de/gmbhg/__40.html',
          "The cap table has one authoritative form: the Gesellschafterliste filed in the Handelsregister (§ 40 GmbHG), updated by the notary after every transfer — only listed holders count as shareholders against the company."),
    ],
}


def main() -> None:
    with open('open-processes/corpus.json') as f:
        tasks = json.load(f, object_pairs_hook=OrderedDict)

    order = ['IN', 'UK', 'DE', 'FR']
    by_id = {t['id']: t for t in tasks}
    assert set(NEW_NOTES) <= set(by_id), sorted(set(NEW_NOTES) - set(by_id))

    added = Counter()
    for tid, notes in NEW_NOTES.items():
        if not notes:
            continue
        t = by_id[tid]
        existing = t.get('geoNotes', [])
        have = {n['country'] for n in existing}
        fresh = [n for n in notes if n['country'] not in have]
        assert len(fresh) == len(notes), f'{tid}: duplicate country note'
        merged = sorted(existing + fresh, key=lambda n: order.index(n['country']))
        t['geoNotes'] = merged
        for n in fresh:
            added[n['country']] += 1
        # Keep the key order convention: geoNotes directly after geoScope.
        out = OrderedDict()
        for k, v in t.items():
            if k == 'geoNotes':
                continue
            out[k] = v
            if k == 'geoScope':
                out['geoNotes'] = t['geoNotes']
        assert 'geoNotes' in out, tid
        t.clear()
        t.update(out)

    with_notes = [t for t in tasks if t.get('geoNotes')]
    print('added per country:', dict(added), 'total added:', sum(added.values()))
    print('processes with notes:', len(with_notes), '/', len(tasks))
    print('total notes:', sum(len(t['geoNotes']) for t in with_notes))
    print('per country:', Counter(n['country'] for t in with_notes for n in t['geoNotes']))
    print('per scope:', Counter(t['geoScope'] for t in with_notes))

    with open('open-processes/corpus.json', 'w') as f:
        json.dump(tasks, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
