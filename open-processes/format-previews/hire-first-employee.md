<!-- Layout preview derived from open-processes/hire-first-employee.json and its committed page. -->

# Hire first employee

> **Format preview.** This page reorganizes the existing record for review.

[Overview](#overview) · [Before you start](#before-you-start) · [Geography](#geography) · [Steps](#steps-at-a-glance) · [Outputs](#outputs)

## Overview

Complete the full hiring process including offer letter, onboarding, payroll setup, and benefits enrollment.

| Field | Value |
| --- | --- |
| Kind | process |
| Phase | hr |
| Cadence | once |
| Geo scope | global |
| Complexity | complex |
| Reversibility | hard to undo |
| Active work | ~1.0 h |
| Elapsed including waits | ~4.0 d |
| Agent support | partial |

Gusto's Embedded Payroll API supports onboarding, pay schedules, and payroll; Carta's API drafts option grants for board approval. Offer letter drafting automatable. Background checks and benefits selection require human interaction.

## Before you start

Required artifacts:

- Payroll account — from [Set up payroll](set-up-payroll.md)
- Benefits plan — from [Set up benefits](../pages/set-up-benefits.md)
- 409A valuation report — from [Get a 409A valuation](get-a-409a-valuation.md)
- Company email workspace — from [Set up company email & docs](../pages/set-up-company-email-docs.md)
- Team chat workspace — from [Set up team chat](../pages/set-up-team-chat.md)

| Information to gather | Required by the record |
| --- | --- |
| employee name | Yes |
| employee role | Yes |
| employee salary | Yes |
| employee start date | Yes |
| equity grant shares | Optional |

## Geography

Country rows describe the guidance recorded here. Local notes and step alternatives do not establish a complete country-specific workflow.

| Country | Recorded guidance | Steps with local alternatives or resolutions |
| --- | --- | --- |
| [United States](#geo-us) | step resolution | [6](#step-6) |
| [India](#geo-in) | Local analog note | — |
| [United Kingdom](#geo-uk) | Local analog note; step resolution | [6](#step-6) |
| [Germany](#geo-de) | Local analog note | — |
| [France](#geo-fr) | Local analog note; step resolution | [6](#step-6) |
| [Portugal](#geo-pt) | Local analog note; step resolution | [6](#step-6) |
| [Canada](#geo-ca) | Local analog note | — |
| [New Zealand](#geo-nz) | Local analog note | — |
| [Singapore](#geo-sg) | Local analog note; step resolution | [6](#step-6) |
| [Australia](#geo-au) | Local analog note; step resolution | [6](#step-6) |
| [South Korea](#geo-kr) | Local analog note; step resolution | [6](#step-6) |
| [Hong Kong](#geo-hk) | Local analog note; step resolution | [6](#step-6) |
| [Estonia](#geo-ee) | Local analog note; step resolution | [6](#step-6) |

## Steps at a glance

Use the recorded prerequisites and conditions below to follow the path. Row order is for navigation.

| Step | Handled by | Time estimate | Incoming dependencies |
| --- | --- | --- |
| [1. Draft offer letter](#step-1) | Agent; approval required | ~10 min | Entry step |
| [2. Send offer for signature](#step-2) | Agent; approval required | ~5 min | [Step 1](#step-1) |
| [3. Candidate accepts (1-3 days)](#step-3) | Human; includes waiting | ~3 d | [Step 2](#step-2) |
| [4. Add the employee in your payroll platform](#step-4) | Agent; approval required | ~5 min | [Step 3](#step-3) |
| [5. Set up payroll schedule](#step-5) | Agent; approval required | ~10 min | [Step 4](#step-4) |
| [6. Employee completes the hiring formalities: right-to-work verification and tax withholding forms](#step-6) | Human; signature required; includes waiting | ~1 d | [Step 4](#step-4) |
| [7. Set up benefits enrollment](#step-7) | Form / portal; approval required | ~10 min | [Step 4](#step-4) |
| [8. Create company email](#step-8) | Form / portal; approval required | ~5 min | [Step 4](#step-4) |
| [9. Add to the team chat](#step-9) | Agent; approval required | ~2 min | [Step 8](#step-8) |
| [10. Grant stock options](#step-10) | Agent; approval required | ~15 min | [Step 3](#step-3) |

## Step details

<a id="step-1"></a>

### 1. Draft offer letter

agent-runnable · ~10 min · human approval required

Draft the offer from the agreed role, reporting line, work location, start date and compensation package. Separate firm commitments from proposed equity, variable pay or conditions that still need a decision. Use the employment template reviewed for that location, and highlight departures from it for the hiring manager and people lead. The resulting draft should make the candidate’s terms clear and expose the few points that must be settled before sending.

- Vendor options: ChatGPT, Claude, Gemini, Grok
- Ranked market: [ai-assistants](../../open-rankings/ai-assistants)

<a id="step-2"></a>

### 2. Send offer for signature

agent-runnable · ~5 min · human approval required · hard to undo

Check that the offer contains the agreed terms and attachments, then verify the candidate’s delivery address and the company signer. Once the hiring manager clears the package for release, set the signature fields and signer order and send it through the company’s signing service. Route questions and negotiated changes back to the hiring owner, then circulate any revised package consistently to both signers.

- Canonical vendor: DocuSign

<a id="step-3"></a>

### 3. Candidate accepts (1-3 days)

human · ~3 d · async wait

Follow up on the offer actually sent, using any agreed response date or extension. Route negotiation questions to the hiring owner and update the package if terms change. On acceptance, check that the required parties signed the same version and reconfirm the start date. Give onboarding the executed agreement and settled employment details so payroll, equipment and introductions can be arranged.

- Produces: Signed offer / employment agreement
- Cross-arena market: [workflow-automation](../../open-rankings/workflow-automation)
- Next: steps 4 and 10 — all follow this step

<a id="step-4"></a>

### 4. Add the employee in your payroll platform

agent-runnable · ~5 min · human approval required

| Option | Applies when |
| --- | --- |
| Default — Add the employee in your payroll platform | Recorded default |
| EOR hire (no local employing entity) | The hire is in a country where the company has no employing entity - an employer of record employs them on your behalf |
| Contractor-first trial | The engagement starts as a paid contractor trial before a full-time offer |

Choose the employment arrangement from the person’s work country, the employing entity and the reviewed worker classification. For a direct hire, build the payroll profile from the signed agreement: pay basis, amount, start date, location and manager. Let the employee supply sensitive personal and payment details through onboarding. Payroll should resolve missing registrations or funding setup before activation; an EOR hire or contractor needs its own downstream process.

- Canonical vendor: Gusto
- Vendor options: Gusto, Rippling, Deel, Justworks
- Ranked market: [payroll](../../open-rankings/payroll)
- Sources: [IRS: Independent contractor or employee](https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee)
- Next: steps 5, 6, 7 and 8 — all follow this step

Options:
  - **Default — Add the employee in your payroll platform** — agent-runnable · ~5 min · human approval required

    Use direct employee onboarding when the classification and employing entity support it in the person’s work location. Enter the signed pay terms, start date and verified employee details into payroll. Resolve required registrations and employee onboarding tasks with the payroll team before activation, then check the first-pay setup. Keep any missing information assigned to the person who can supply it.
  - **EOR hire (no local employing entity)**

    When: The hire is in a country where the company has no employing entity - an employer of record employs them on your behalf

    Assess an EOR for the actual country and role with the people lead and local adviser. Compare the legal employer, contract terms, total cost, benefits, funding and termination responsibilities in the provider’s proposal before committing. Coordinate contract execution and start clearance through the selected arrangement. Use the applicable local payroll and employment process in place of the downstream direct-hire tasks.

    - Canonical vendor: Deel
    - Vendor options: Deel, Rippling, Remote
  - **Contractor-first trial** — agent-runnable

    When: The engagement starts as a paid contractor trial before a full-time offer

    Review the proposed working relationship before considering a contractor engagement. Define the services, deliverables, independence and payment terms, and have the relevant adviser assess classification. If contracting fits, use the contractor agreement and tax-documentation process. If the role is employment in substance, use an employment route. Calling the arrangement a trial does not establish contractor status.

    - Vendor options: Gusto, Deel
    - Sources: [IRS: Independent contractor or employee](https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee)

<a id="step-5"></a>

### 5. Set up payroll schedule

agent-runnable · ~10 min · human approval required

Set the pay periods, paydays and input cutoffs around the agreed compensation terms. Check the permitted frequency for the employee’s work location and the provider’s actual funding lead time. Work through the first partial period and any bonus, commission or reimbursement treatment with payroll. Share the resulting calendar with the employee and the managers responsible for submitting changes.

- Canonical vendor: Gusto

*This path ends here.*

<a id="step-6"></a>

### 6. Employee completes the hiring formalities: right-to-work verification and tax withholding forms

human (legally required signature) · ~1 d · async wait

*Follows step 4.*

Run the start-date formalities your jurisdiction requires: verify the employee's right to work, and collect the tax and withholding forms payroll needs for the first wage payment. The deadlines are statutory and run off the first day of employment, so calendar them against the start date. Keep identity and tax records restricted.

- Verify: The jurisdiction's required right-to-work verification and tax forms are on file by their statutory deadlines; retain them, they are inspectable.
- Canonical vendor: Gusto
- Cross-arena market: [workflow-automation](../../open-rankings/workflow-automation)
- Sources: [USCIS: Completing Section 2](https://www.uscis.gov/i-9-central/completing-form-i-9/completing-section-2-employer-review-and-attestation) · [USCIS: Employment Eligibility Verification](https://www.uscis.gov/i-9) · [USCIS: Instructions for Form I-9](https://www.uscis.gov/sites/default/files/document/forms/i-9instr.pdf) · [IRS: Publication 15 (2026), Employer’s Tax Guide](https://www.irs.gov/publications/p15) · [IRS: Topic 753, Form W-4](https://www.irs.gov/taxtopics/tc753)

*This path ends here.*

<a id="step-7"></a>

### 7. Set up benefits enrollment

manual form/portal · ~10 min · human approval required

*Follows step 4.*

Identify the enrollment tasks that apply under the selected plans and employment terms. Check eligibility, coverage start, employee contributions and any dependent information needed. Send the employee the relevant plan materials and enrollment route so they can make their own elections. Resolve incomplete or rejected enrollment with the benefits administrator, then reconcile accepted coverage and payroll deductions before confirming that benefits are active.

- Canonical vendor: Gusto
- Sources: [DOL: Health plans](https://www.dol.gov/index.php/agencies/ebsa/employers-and-advisers/plan-administration-and-compliance/health-plans)

*This path ends here.*

<a id="step-8"></a>

### 8. Create company email

manual form/portal · ~5 min · human approval required

| Option | Applies when |
| --- | --- |
| Default — Google Admin console | Recorded default |
| Microsoft 365 mailbox | The company runs on Outlook/Teams rather than Google Workspace |

*Follows step 4.*

Use the company’s existing email suite and account-naming convention. Check the employee’s identity, company domain, license and access start date, including any existing account or alias that could conflict. The workspace administrator provisions the account under the normal access process. Send activation instructions securely and check that the employee can sign in and receive mail before handing off the mailbox as ready.

- Canonical vendor: Gmail
- Do it yourself: [Google Admin console](https://admin.google.com/)
- Sources: [Google Workspace: Add an account for a new user](https://knowledge.workspace.google.com/admin/users/add-an-account-for-a-new-user)

Options:
  - **Default — Google Admin console** — manual form/portal · ~5 min · human approval required

    In Google Workspace, the authorized user administrator checks the domain, employee name, existing identities and available license before adding the account. Apply the intended organizational settings and security policy, then send activation instructions securely. Check sign-in and mailbox availability. If a service is still provisioning, investigate its status on the existing account.
  - **Microsoft 365 mailbox**

    When: The company runs on Outlook/Teams rather than Google Workspace

    In Microsoft 365, the authorized administrator creates or reconciles the employee’s account under the company domain. Assign the appropriate location, license and application access, handling administrative privileges as a separate access decision. Send activation instructions securely and check mailbox and service availability. Resolve licensing or provisioning failures before directing the employee to use the account for work.

    - Vendor options: Microsoft 365
    - Sources: [Microsoft Learn: Add users and assign licenses in Microsoft 365](https://learn.microsoft.com/en-us/microsoft-365/admin/add-users/add-users?view=o365-worldwide)

<a id="step-9"></a>

### 9. Add to the team chat

agent-runnable · ~2 min · human approval required

Invite the employee using their verified company identity and the access level agreed for their role. Add the team and onboarding channels their manager identifies, checking restricted or externally shared spaces with their owners. Point the employee to communication norms and the support contact. Resolve access problems within the permissions needed for the employee’s work.

- Canonical vendor: Slack

*This path ends here.*

<a id="step-10"></a>

### 10. Grant stock options

agent-runnable · ~15 min · human approval required · hard to undo

*Follows step 3.*

Prepare the proposed award from the offer, current equity plan and grant workflow. Reconcile the recipient, award type, quantity, vesting and pricing support with counsel or the equity administrator. Obtain the required board or delegated approval before issuing documents or changing ownership records. Track execution and acceptance against the approved terms, with the grant linked to its authorization and resulting ledger entry.

- Canonical vendor: Carta

## Country details

<a id="geo-us"></a>

### United States

- Step 6: Employee completes I-9 and W-4 The employee completes and signs I-9 Section 1 by the first day of employment; the employer or authorized representative completes Section 2 within three business days after that first day, or on the first day if employment lasts fewer than three business days (law rule [us-fed.i9-verification-deadline](../../open-law/US-FED/us-fed-i9-verification-deadline.json)). Let the employee choose acceptable documents. Separately, request Form W-4 when work starts and use it for federal withholding on the first wage payment; payroll applies IRS default withholding if a valid W-4 is missing and checks applicable state forms. ([USCIS I-9 Central](https://www.uscis.gov/i-9-central))

<a id="geo-in"></a>

### India

- First-hire setup means an appointment letter, checking EPF/ESI applicability thresholds, a state shops-and-establishments registration, and monthly TDS on salary against the company's TAN — the EPFO employer portal anchors the social-security side. ([EPFO employer portal](https://unifiedportal-emp.epfindia.gov.in/epfo/))

<a id="geo-uk"></a>

### United Kingdom

- gov.uk publishes the exact first-hire checklist: right-to-work checks, employers' liability insurance, PAYE registration before the first payday, a written statement of particulars on day one, and pension auto-enrolment. ([Employ someone: step by step](https://www.gov.uk/employing-staff))
- Step 6: Right-to-work checks, and the written statement of particulars given by day one The written statement's principal particulars are due in a single document not later than the beginning of the employment (law rule [uk.written-statement-timing](../../open-law/UK/uk-written-statement-timing.json)); gov.uk's first-hire checklist carries the rest, including employers' liability insurance and PAYE registration before the first payday. ([Employ someone: step by step](https://www.gov.uk/employing-staff))

<a id="geo-de"></a>

### Germany

- Before the first payslip: a Betriebsnummer from the Federal Employment Agency, registration with the employee's health insurer (which routes all social insurance), statutory accident insurance with the sector's Berufsgenossenschaft, and wage tax via ELSTER. ([Betriebsnummern-Service (employer number)](https://www.arbeitsagentur.de/unternehmen/betriebsnummern-service))

<a id="geo-fr"></a>

### France

- Every hire starts with the DPAE to URSSAF before the start date; add a written contract (French language), affiliation to the mandatory mutuelle and retirement schemes, and the initial médecine du travail visit. ([DPAE — pre-hire declaration](https://entreprendre.service-public.fr/vosdroits/F23107))
- Step 6: Declare the hire to URSSAF (the DPAE) before the start date ([DPAE — pre-hire declaration](https://entreprendre.service-public.fr/vosdroits/F23107))

<a id="geo-pt"></a>

### Portugal

- The first-hire checklist is national: report the admission to Segurança Social before the start date, take out the mandatory work-accident insurance (private insurers), and put the written contract terms in place — the government guide walks it through. ([gov.pt — contratar trabalhadores](https://www.gov.pt/guias/contratar-trabalhadores))
- Step 6: Report the admission to Segurança Social before the start date ([gov.pt — contratar trabalhadores](https://www.gov.pt/guias/contratar-trabalhadores))

<a id="geo-ca"></a>

### Canada

- Before the first payday: a payroll (RP) account on the business number, provincial workers'-compensation registration, and employment-standards minimums from the employee's province (federally regulated industries follow the Canada Labour Code). ([CRA — payroll](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll.html))

<a id="geo-nz"></a>

### New Zealand

- First-hire formalities: a written employment agreement signed before day one (a 90-day trial is valid only if signed before work starts), employer registration with Inland Revenue, and KiwiSaver auto-enrolment for eligible new employees. ([Employment agreements — Employment New Zealand](https://www.employment.govt.nz/starting-employment/employment-agreements/))

<a id="geo-sg"></a>

### Singapore

- MOM's baseline is concrete: issue written key employment terms within 14 days of the start, pay CPF for citizen and PR employees from the first wage, insure anyone WICA requires, and check work-pass status before a foreign hire starts. ([MOM — key employment terms](https://www.mom.gov.sg/employment-practices/contract-of-service/key-employment-terms))
- Step 6: Issue the written key employment terms within 14 days of the start and get a CPF Submission Number before the first payroll month closes ([MOM — key employment terms](https://www.mom.gov.sg/employment-practices/contract-of-service/key-employment-terms))

<a id="geo-au"></a>

### Australia

- The first-hire formalities: give the Fair Work Information Statement on or before day one (law rule [au.fair-work-information-statement](../../open-law/AU/au-fair-work-information-statement.json)), collect a TFN declaration, offer superannuation choice (defaulting to the stapled fund), take out workers' compensation insurance in your state, and report pay through Single Touch Payroll. ([Guide to hiring employees](https://business.gov.au/people/employees/hiring-employees))
- Step 6: Right-to-work checks, the TFN declaration, superannuation choice with the stapled-fund fallback, and the Fair Work Information Statement on or before day one (law rule au.fair-work-information-statement) ([Guide to hiring employees](https://business.gov.au/people/employees/hiring-employees))

<a id="geo-kr"></a>

### South Korea

- First-hire formalities: written terms delivered under Labor Standards Act Article 17, wage-withholding registration with the tax office, and the four social insurances registered through the shared portal; the employment and industrial-accident establishment report and the health-insurance workplace report run on 14-day clocks, with national pension reported on its own schedule. ([Four social insurances portal (4대사회보험)](https://www.4insure.or.kr/))
- Step 6: Written terms delivered, withholding registered, and the four insurances enrolled Deliver the written statement of wage composition, working hours, holiday and annual leave when the contract is concluded (law rule [kr.written-terms-of-employment](../../open-law/KR/kr-written-terms-of-employment.json)), and enroll the hire in the four social insurances, with the employment and industrial-accident establishment report due within 14 days (law rule [kr.employment-insurance-establishment-report](../../open-law/KR/kr-employment-insurance-establishment-report.json)). The shared portal files all four in one pass. ([Four social insurances portal (4대사회보험)](https://www.4insure.or.kr/))

<a id="geo-hk"></a>

### Hong Kong

- First-hire duties are concrete: enrol the employee in an MPF scheme within the first 60 days (law rule [hk.mpf-enrolment-deadline](../../open-law/HK/hk-mpf-enrolment-deadline.json)), notify the Inland Revenue Department on Form IR56E within 3 months of commencement (law rule [hk.employers-return-obligations](../../open-law/HK/hk-employers-return-obligations.json)), and hold employees' compensation insurance before work starts. ([MPFA — enrol employees](https://www.mpfa.org.hk/en/mpf-system/enrolment-and-termination/employers-enrolment-for-employees))
- Step 6: First-hire formalities: MPF enrolment within the first 60 days, the IR56E notification to the IRD within 3 months of commencement, and employees' compensation insurance in force before work starts The MPF 60-day clock is law rule [hk.mpf-enrolment-deadline](../../open-law/HK/hk-mpf-enrolment-deadline.json), the IR56E window is law rule [hk.employers-return-obligations](../../open-law/HK/hk-employers-return-obligations.json), and Employees' Compensation Ordinance section 40 makes EC insurance compulsory for every employee from day one. ([MPFA — enrol employees](https://www.mpfa.org.hk/en/mpf-system/enrolment-and-termination/employers-enrolment-for-employees))

<a id="geo-ee"></a>

### Estonia

- First-hire formalities: a written employment contract carrying the § 5 working-conditions catalog (law rule [ee.employment-contract-written-form](../../open-law/EE/ee-employment-contract-written-form.json)) and an employment-register entry before work starts (law rule [ee.employment-register-before-work](../../open-law/EE/ee-employment-register-before-work.json)); the payroll taxes then ride the monthly TSD. ([Employment register (e-MTA)](https://www.emta.ee/en/business-client/registration-business/employment-register))
- Step 6: Written contract plus an employment-register entry before work starts Put the § 5 working-conditions catalog in the written contract (law rule [ee.employment-contract-written-form](../../open-law/EE/ee-employment-contract-written-form.json)) and enter the hire in the employment register at the latest by the moment work begins (law rule [ee.employment-register-before-work](../../open-law/EE/ee-employment-register-before-work.json)); withholding then rides the monthly TSD. ([Employment register (e-MTA)](https://www.emta.ee/en/business-client/registration-business/employment-register))

## Outputs

- Signed offer / employment agreement

## Related records

- Part of the chain [First hire](../pages/first-hire.md)

---

Source record: [`open-processes/hire-first-employee.json`](../hire-first-employee.json) · [Current format](../pages/hire-first-employee.md)
