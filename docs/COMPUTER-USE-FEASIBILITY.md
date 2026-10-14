# Computer-use feasibility: company-launch chain

Empirical browser-automation dry-runs (2026-09-14) against the live public sites behind the
human-marked steps of `/processes/chains/company-launch`. Question under test: **where the chain
says "human", could a computer-use agent do it?**

- Harness: `rankings-engine/scripts/computer-use-feasibility.ts` (playwright, headless chromium)
- Evidence: `open-rankings/experiments/computer-use/` — one JSON + one PNG screenshot per step, plus
  `feasibility-report.json` (aggregate)
- Safety envelope actually enforced: **zero submissions, zero accounts created, zero payments,
  zero CAPTCHA bypasses, zero government forms filled**. Fake data only (`Test Example Co`,
  `test@example.com`). Government sites tested read-only (load + field enumeration).

## Verdict key

- `automatable-to-submission` — a scripted browser can reach the form and fill every needed field
  with test data; we stopped at the submit button by design. It does **not** mean an agent can
  complete the step: submission plus downstream KYC/payment/verification stays human.
- `automatable-partial` — automation works up to a named blocker (CAPTCHA, KYC, login, policy).
- `not-automatable` / `not-tested` — could not reach the form / deliberately not exercised.

## Per-step results

| Chain step (task/node) | Target tested | Outcome | Blocker / ceiling | Evidence |
|---|---|---|---|---|
| form_001 n3 — Check name availability | DE Div. of Corporations entity search (icis.corp.delaware.gov) | automatable-partial | Plain ASP.NET form, 3 fields, no CAPTCHA detected on load. Gov policy: enumeration only, search not submitted. Technically scriptable end-to-end; the search itself is read-only. | `delaware-name-search.{json,png}` |
| form_001 n4 — Submit incorporation filing (direct DE route) | DE Document Upload entry (corp.delaware.gov) | automatable-partial | Entry page is informational (only site-search fields); the actual DCIS filing portal is account/login-gated. Filing = legal attestation + payment → human. | `delaware-formation-entry.{json,png}` |
| form_001 n4 — Submit incorporation filing (Clerky route) | Clerky signup (app.clerky.com/signup) | automatable-partial | Email + password fillable (2/2 filled), but **Cloudflare Turnstile** guards account creation — hard stop for unattended automation. Filing itself sits behind the account + payment. | `clerky-start.{json,png}` |
| form_001 n1 — Choose formation service | Stripe Atlas start page (stripe.com/atlas) | automatable-partial | Application sits behind Stripe account creation + $500 fee + founder KYC; stopped at the account boundary by design. | `stripe-atlas-start.{json,png}` |
| form_001 n1 — Choose formation service | Firstbase onboarding wizard (onboarding.firstbase.io/start) | automatable-partial | Wizard reachable; first screen is button-driven (entity-type choice, "Continue"), inputs sit deeper. Navigation scriptable. | `firstbase-start.{json,png}` |
| form_002 n3 — Complete IRS SS-4 online | IRS EIN Assistant (sa.www4.irs.gov/modiein) | automatable-partial | **HTTP 403 "Access Denied" (Akamai/edgesuite) at page load** for a scripted browser — tested Monday 18:12 ET, inside the Mon–Fri 7am–10pm ET operating window, so hours were not the gate; bot detection was. Not bypassed per ToS. | `irs-ein-online.{json,png}` |
| qs_023 n3 — Apply for business account | Mercury signup (app.mercury.com/signup) | automatable-partial | Real application form; first/last name filled (2/3 — the third field, `personal-callsign`, is a likely bot honeypot and was left alone). **Persona KYC vendor script present** — identity verification follows the first page. | `mercury-signup.{json,png}` |
| qs_063 n3 — Sign up for payroll | Gusto company signup (gusto.com/invite/company) | **automatable-to-submission** | 7/8 fields filled (name, email, company, employees, phone, passwords); no CAPTCHA detected pre-submit. "Create account" NOT clicked. Cleanest fill of the run — see screenshot. | `gusto-signup.{json,png}` |
| qs_073 n2 — Sign up and configure (accounting) | Intuit/QuickBooks signup (accounts.intuit.com) | automatable-partial | 3/3 fields filled, but **reCAPTCHA present** on the signup form; also `quickbooks.intuit.com/signup/` resets scripted HTTP/2 connections outright (protocol-level bot protection). | `quickbooks-signup.{json,png}` |
| adjacent — Google Workspace signup (email/workspace provisioning) | workspace.google.com/business/signup/welcome | **automatable-to-submission** (first page) | Business-name field filled; team-size radios clickable. Non-binding welcome page only — account creation, domain verification, and payment follow deeper and were not exercised. | `google-workspace-signup.{json,png}` |
| adjacent — domain registration (launch-website chain) | Porkbun search results for testexampleco.com | automatable-partial | Domain **search** is read-only and fully scriptable (results page loads clean, no bot wall). Purchase requires account + payment — stopped before cart by design. | `domain-registration-search.{json,png}` |

Aggregate: 2 automatable-to-submission, 9 automatable-partial, 0 not-automatable, 0 not-tested.

## What the evidence supports changing (and what it does not)

Labels the evidence supports flipping from plain "human" to **computer-use-assisted** (agent
drives the browser; human reviews and clicks submit / completes KYC):

1. **qs_063 n3 "Sign up for payroll" (person)** — strongest case. Gusto's signup is a plain,
   labeled HTML form with no visible CAPTCHA before submit; an agent can fill everything and hand
   off for the one human click. Ceiling: the submit click (account-creation side effect) stays
   human, and server-side bot scoring is unverified because we never submitted.
2. **qs_023 n3 "Apply for business account" (person)** — assisted fill only. Mercury's application
   form is scriptable (and contains a honeypot field a naive agent would trip). Hard ceiling:
   Persona-powered KYC plus federal identity attestation — the human portion is irreducible, but
   the data entry ahead of it is not.
3. **form_001 n3 "Check name availability"** (already agent-routed) — the corpus's REST-shaped
   `functionCalls` entry is optimistic (no public DE API); the evidence shows the actual mechanism
   would be a scripted browser on a plain ASP.NET form. Supports keeping it agent-routed with
   computer-use as the mechanism, noting DE terms should be reviewed before production use.
4. **qs_073 n2 "Sign up and configure" (person)** — half-flip at best: fill is scriptable but
   Intuit gates submission with reCAPTCHA and protocol-level bot defenses. "Assisted fill, human
   completes" is the honest label.

Labels the evidence says **not** to flip:

- **form_002 n3 "Complete IRS SS-4 online" (form)** — the gapClosers pass marks form-routed steps
  as generic "computer-use candidates"; this dry-run contradicts that for the EIN Assistant. A
  scripted browser is 403-blocked at page load (Akamai), inside operating hours. A supervised
  computer-use agent riding a real user browser session might render differently, but that is
  untested and the IRS's anti-automation posture is explicit. Keep human; keep the
  hours-of-operation caveat (Mon–Fri 7am–10pm ET) in guidance.
- **form_001 n4 "Submit incorporation filing"** — both routes dead-end for unattended automation:
  Clerky account creation is Turnstile-gated, and Delaware's own filing portal is login-gated with
  payment + legal attestation at the end. Assisted pre-fill inside an authenticated human session
  is plausible; autonomous filing is not supported by this evidence.
- **form_001 n6/n7 (bylaws, founder stock)** — behind Clerky login; untestable without a real
  account, which the safety envelope forbids creating. No evidence either way; leave as-is.
- **form_001 n8 "File 83(b)" and n5 "Receive Certificate"** — physical mail and third-party wait
  respectively; not browser problems at all.
- **form_001 n1 / qs_023 n2 "Choose ..." steps** — judgment calls; research-agent assist (already
  covered by gapClosers' `research` rule), not computer use.

## The honest general finding

"The form is scriptable up to submission" ≠ "an agent can complete the step." Across all 11
targets the automation ceiling was always one of the same four walls: **CAPTCHA/bot-detection**
(IRS, Clerky, Intuit, quickbooks.intuit.com at the protocol level), **KYC/identity** (Mercury,
Atlas), **payment/fee** (Atlas, Delaware filing, domain purchase, Workspace), or **legal
attestation** (Delaware, IRS). Computer use reliably removes the *data-entry* minutes from these
"human" steps — it did not, in any tested case, remove the human from the step's binding moment.
This matches gapClosers' existing caution ("assisted, not autonomous — a human supervises") and
the evidence now grounds it per-step.

Reproduce: `pnpm tsx rankings-engine/scripts/computer-use-feasibility.ts` (playwright resolved from
`.proof-scratch/node_modules`; expects chromium in the playwright browser cache). Results vary
with vendors' bot-defense posture — these are point-in-time observations, not permanent facts.
