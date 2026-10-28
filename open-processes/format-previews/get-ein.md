<!-- Layout preview derived from open-processes/get-ein.json and its committed page. -->

# Get EIN

> **Format preview.** This page reorganizes the existing record for review.

[Overview](#overview) · [Before you start](#before-you-start) · [Geography](#geography) · [Steps](#steps-at-a-glance) · [Outputs](#outputs)

## Overview

Apply for an Employer Identification Number (EIN) from the IRS for the newly incorporated company.

| Field | Value |
| --- | --- |
| Kind | process |
| Phase | formation |
| Cadence | once |
| Geo scope | us |
| Complexity | simple |
| Reversibility | hard to undo |
| Active work | ~12 min |
| Elapsed including waits | ~12 min |
| Agent support | manual guide |

IRS EIN application is a web form with no API. System provides step-by-step guidance and pre-fills company data.

## Before you start

Required artifacts:

- Certificate of Incorporation — from [Incorporate C-Corp](incorporate-c-corp.md)

| Information to gather | Required by the record |
| --- | --- |
| legal name | Yes |
| state of incorporation | Yes |
| address | Yes |
| founder ssn | Yes |

## Geography

Country rows describe the guidance recorded here. Local notes and step alternatives do not establish a complete country-specific workflow.

| Country | Recorded guidance | Steps with local alternatives or resolutions |
| --- | --- | --- |
| [India](#geo-in) | Handled within another local process | — |
| [United Kingdom](#geo-uk) | Handled within another local process | — |
| [Germany](#geo-de) | Local analog note | — |
| [France](#geo-fr) | Handled within another local process | — |
| [Portugal](#geo-pt) | Handled within another local process | — |
| [Canada](#geo-ca) | Handled within another local process | — |
| [New Zealand](#geo-nz) | Handled within another local process | — |
| [Singapore](#geo-sg) | Handled within another local process | — |
| [Australia](#geo-au) | Local analog note | — |
| [South Korea](#geo-kr) | Local analog note | — |
| [Hong Kong](#geo-hk) | Handled within another local process | — |
| [Estonia](#geo-ee) | Handled within another local process | — |

## Steps at a glance

Use the recorded prerequisites and conditions below to follow the path. Row order is for navigation.

| Step | Handled by | Time estimate | Incoming dependencies |
| --- | --- | --- |
| [1. Pre-fill EIN application data](#step-1) | Agent | ~1 min | Entry step |
| [2. Complete IRS SS-4 form online](#step-2) | Form / portal | ~10 min | [Step 1](#step-1) |
| [3. Store EIN in company records](#step-3) | Agent | ~1 min | [Step 2](#step-2) |

## Step details

<a id="step-1"></a>

### 1. Pre-fill EIN application data

agent-runnable · ~1 min

Collect the legal name, formation details and address from the accepted entity documents. Identify the responsible party, business activity, tax classification and reason for applying. Check whether an EIN already exists and which IRS application channel the entity can use. Resolve uncertain answers with the responsible person before filing, and keep tax identifiers in the private application workspace.

- Sources: [IRS get an EIN](https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number)

<a id="step-2"></a>

### 2. Complete IRS SS-4 form online

manual form/portal · ~10 min · hard to undo

Use the IRS application method for which the entity and responsible party qualify. Review the answers against the prepared facts and current instructions. The authorized representative approves submission; a third-party designee needs signed authorization. Complete the required identity or signature steps and save the IRS confirmation. If the applicant is ineligible for the online assistant, use the appropriate IRS alternative with accurate identity details.

- Verify: The EIN is issued in the XX-XXXXXXX format at the end of the online session — retain the CP 575 confirmation notice; banks and payroll providers ask for it. ([www.irs.gov](https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online))
- Cost: free (free, as of 2026-10-01, [www.irs.gov](https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online)). The IRS issues EINs for free; third-party services charge to file on your behalf.
- Produces: EIN assignment letter
- Canonical vendor: IRS
- Do it yourself: [IRS EIN online application](https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online)
- Sources: [IRS get an EIN](https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number)

<a id="step-3"></a>

### 3. Store EIN in company records

agent-runnable · ~1 min

Save the IRS confirmation letter in the restricted company tax records. Check its legal name and EIN against the application and resolve mismatches with the filer. Use the issued letter as the source for banking and tax setup, and make it retrievable by authorized finance staff and advisers without exposing the number in public records.

- Sources: [IRS get an EIN](https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number)

## Country details

<a id="geo-in"></a>

### India

- Absorbed: PAN and TAN — the company's tax identifiers — are allotted automatically as part of the SPICe+ incorporation filing; the Income Tax e-filing portal is where the company then uses them. ([Income Tax e-filing portal (PAN/TAN)](https://www.incometax.gov.in/iec/foportal/))

<a id="geo-uk"></a>

### United Kingdom

- Absorbed: There is no EIN application: HMRC posts the company a Unique Taxpayer Reference (UTR) automatically after incorporation, and you register for Corporation Tax within 3 months of starting business. ([HMRC Corporation Tax (UTR)](https://www.gov.uk/corporation-tax))

<a id="geo-de"></a>

### Germany

- The tax office issues a Steuernummer after you file the Fragebogen zur steuerlichen Erfassung (tax registration questionnaire) on ELSTER — plus a separate VAT ID from the BZSt if needed. ([ELSTER — tax office registration](https://www.elster.de/eportal/start))

<a id="geo-fr"></a>

### France

- Absorbed: No application: INSEE allots the SIREN (company) and SIRET (per-establishment) identifiers automatically when the guichet unique registration lands — they arrive with the company's registration. ([Obtain a SIREN/SIRET number](https://entreprendre.service-public.fr/vosdroits/F32135))

<a id="geo-pt"></a>

### Portugal

- Absorbed: No separate tax-ID application: the NIPC issued at incorporation is the company's tax number (NIF), and filing the declaração de início de atividade with the tax authority activates it for corporate tax and VAT. ([Portal das Finanças (AT)](https://www.portaldasfinancas.gov.pt/))

<a id="geo-ca"></a>

### Canada

- Absorbed: A CRA business number is issued automatically with federal (and most provincial) incorporation — you add program accounts to it (payroll RP, GST/HST RT, corporate tax RC) through Business Registration Online rather than applying for a separate tax ID. ([CRA — business number registration](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/registering-your-business.html))

<a id="geo-nz"></a>

### New Zealand

- Absorbed: No separate tax-ID application: the Companies Office incorporation application lets you choose to register for an Inland Revenue (IRD) number, a GST number, and as an employer in the same filing. ([Incorporating a company — Companies Register](https://companies-register.companiesoffice.govt.nz/help-centre/starting-a-company/incorporating-a-company/))

<a id="geo-sg"></a>

### Singapore

- Absorbed: There is no EIN application: ACRA assigns the company's UEN at incorporation and it is the identification number across Singapore government agencies, IRAS included — tax filings simply run on it. ([Bizfile (ACRA)](https://www.bizfile.gov.sg/))

<a id="geo-au"></a>

### Australia

- The tax identifiers are a real application: the company applies to the Australian Business Register for an ABN (the company TFN rides the same flow), and most founders file it inside the Business Registration Service alongside the ASIC company registration (law rule [au.abn-registration](../../open-law/AU/au-abn-registration.json)). ([Register for an ABN](https://business.gov.au/registrations/register-for-an-australian-business-number-abn))

<a id="geo-kr"></a>

### South Korea

- The tax identity is the business registration number (사업자등록번호), applied for with the district tax office within 20 days of starting business and available before the start date (Value-Added Tax Act Article 8); corporations file it through Hometax after the registry incorporation. ([Hometax (NTS e-filing)](https://www.hometax.go.kr/))

<a id="geo-hk"></a>

### Hong Kong

- Absorbed: There is no separate application: the one-stop incorporation files the Notice to Business Registration Office (IRBR1) with the NNC1, so the business registration certificate — whose number doubles as the company's tax reference — issues together with the certificate of incorporation (law rule [hk.business-registration-certificate](../../open-law/HK/hk-business-registration-certificate.json)). ([IRD — business registration](https://www.ird.gov.hk/eng/tax/bre.htm))

<a id="geo-ee"></a>

### Estonia

- Absorbed: The tax identity arrives with formation: the registry code (registrikood) is assigned on entry in the commercial register and identifies the company to the Tax and Customs Board; a separate VAT number comes only with VAT registration (law rule [ee.vat-registration-threshold](../../open-law/EE/ee-vat-registration-threshold.json)). ([e-Business Register](https://ariregister.rik.ee/eng))

## Outputs

- EIN assignment letter

## Related records

- Part of the chain [Company launch](company-launch.md)

---

Source record: [`open-processes/get-ein.json`](../get-ein.json) · [Current format](../pages/get-ein.md)
