# Government services as agent rails: IRS, federal, and state portals

Research lane, fetched 2026-10-03. Founder ask: test the IRS and other government services,
state and federal, for agenticness. This is an evidence dossier, not an arena — government
services are not vendors, nothing here edits data/, rankings, or scores. Format follows
yc-agentic-claims.md.

## Methodology (dated)

- All live fetches 2026-10-03 with the pipeline UA
  `Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)`, one-shot keyless
  GETs only. robots.txt fetched and respected for every host — nothing probed past a
  disallow. No credentialed logins, no CAPTCHA interaction or bypass, no load testing.
  Where a page bot-walled the pipeline UA, the wall itself is recorded as the finding.
- One keyless GET against a *documented public API endpoint* (api.uspto.gov) to record its
  auth response; no retries.
- Claims that could not be live-verified on a .gov page (because the page is behind a
  login or a bot wall) are marked as such and carry the best reachable citation.
- Corpus cross-check: `content/processes/records/*.json` and the authored
  `data/human-step-audit.json` (loader `lib/humanSteps.ts`). Disagreements are flagged in
  §4; the audit's verdicts are otherwise treated as the baseline.
- llms.txt sweep (honest zero): `irs.gov`, `sam.gov`, `uspto.gov`, `corp.delaware.gov` all
  404; `uscis.gov`, `flag.dol.gov` 403. No government host in scope publishes llms.txt.

## 1. IRS

### 1.1 EIN online assistant — corpus: form_002 n3, form_011 n7, vc_001 n6, qs_063

- robots: https://www.irs.gov/robots.txt is a standard Drupal file (internals disallowed,
  content crawlable). The application host `sa.www4.irs.gov` returned its maintenance page
  (HTTP 503) for robots.txt at fetch time — the assistant runs on an app host with no
  stable published robots.
- Published operating window, from
  https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online
  (fetched 2026-10-03): "This tool is available during the following times (Eastern Time):
  Mon–Fri: 6:00 a.m. – 1:00 a.m. (next day) Sat: 6:00 a.m. – 9:00 p.m. Sun: 6:00 p.m. –
  12:00 a.m." Same page: one session only, no save, "It expires after 15 minutes of
  inactivity"; "Daily limit: You can apply for only 1 EIN per responsible party per day";
  the applicant must be "the responsible party in control of the entity or its authorized
  representative", and "If you're a third-party designee, you must have signed
  authorization to apply."
- No account, no ID.me, no documented CAPTCHA on the entry page. Fallback rail is Form
  SS-4 by fax or mail — fax 855-641-6935 per
  https://www.irs.gov/filing/where-to-file-your-taxes-for-form-ss-4. The fax rail belongs
  to the EIN, not to the 83(b) (see §1.5).
- Third-party intermediaries exist and are the practical API: the IRS itself sanctions
  third-party designees with signed authorization, and commercial services obtain EINs as
  part of formation flows (https://www.middesk.com, https://stripe.com/atlas,
  https://www.clerky.com — all live 200 on 2026-10-03).
- Agent ceiling: the form is mechanically drivable inside the published window, but the
  responsible-party perjury attestation is the gate. Matches the corpus audit
  (form_002 n3 / form_011 n7 / vc_001 n6, all `policy-gate`). The hours window and
  1-per-day limit are additional scheduling constraints the audit does not record.

### 1.2 e-file / MeF — corpus: tax_002 n5b, n6

- MeF is XML-based system-to-system filing
  (https://www.irs.gov/e-file-providers/modernized-e-file-overview: "MeF uses the widely
  accepted Extensible Markup Language (XML) format"). It is not a public API: transmission
  requires becoming an Authorized IRS e-file Provider.
- The real access model, from
  https://www.irs.gov/e-file-providers/become-an-authorized-e-file-provider: e-Services
  sign-in, application, suitability check; principals without professional status "need to
  be fingerprinted using the IRS authorized vendor" (Livescan); "it can take up to 45 days
  from the date of submission for the IRS to approve your e-file application"; approval
  issues an EFIN.
- For information returns (1099s) a genuine machine channel exists: IRIS has a
  "Taxpayer Portal/UI and IRIS Application to Application (A2A)" intake, gated by a
  Transmitter Control Code (https://www.irs.gov/filing/e-file-forms-1099-with-iris).
  Commercial intermediaries ride these rails (e.g. https://www.track1099.com, live 200).
- Agent ceiling: no keyless path; the rail is credentialed professionals and software
  vendors. Matches tax_002 n6 (`policy-gate`: "Only a CPA with an IRS-issued EFIN/PTIN is
  legally authorized to electronically transmit").

### 1.3 IRS Online Account and Business Tax Account — corpus: sit_004 n5, tax_002 n7

- Sign-in for both runs through ID.me
  (https://www.irs.gov/help/creating-an-account-for-irsgov: "You'll need an account with
  ID.me to sign in to access your tax information"). Identity verification is either
  self-service — government photo ID plus selfie/biometric capture — or "a live call with
  an ID.me video chat agent" (same page notes selfie/video/biometric data handling). Both
  paths are liveness checks: a hard agent stop. An agent cannot create or enter an IRS
  online account on a person's behalf under any published path.
- Business Tax Account roles are person-bound
  (https://www.irs.gov/businesses/business-tax-account: sole proprietor by SSN/ITIN;
  "Designated Official (full access)" for entities).
- The IRS document upload tool used in notice responses (sit_004 n5) sits behind the same
  class of wall when authentication is required.

### 1.4 EFTPS — corpus: tax_002 n7

- https://www.eftps.gov/robots.txt is 404 (no published crawl policy). The homepage
  https://www.eftps.gov/eftps/ (fetched 2026-10-03) documents, verbatim: MFA is required —
  "EFTPS is partnering with third-party credential service providers Login.gov and ID.me
  for MFA services. Secure sign-in via Login.gov or ID.me is required as of October 19,
  2023"; enrollment validation ends with "a personal identification number (PIN) via U.S.
  Mail in five to seven business days"; "Payments using this Web site or our voice response
  system must be scheduled by 8 p.m. ET the day before the due date."
- Individuals can no longer enroll at all
  (https://www.irs.gov/payments/eftps-the-electronic-federal-tax-payment-system: "No new
  enrollments for individual taxpayers"); the same page documents the Batch Provider
  Software rail for tax professionals and "New enrollments for EFTPS can take up to five
  business days to process."
- Agent ceiling: physical-mail PIN plus Login.gov/ID.me MFA — two hard stops stacked. The
  business rail for software is the Batch Provider program, not an API. Corpus tax_002 n7
  (`assist`) is consistent; the mail-PIN latency is an additional constraint worth
  recording.

### 1.5 83(b) election — corpus: form_001 n8/n8a, form_012 n8/n8a, startup_002 n4b/n5, equity.us-de.83b-election

The truth, as of 2026-10-03:

- There is no fax rail for the 83(b) and there never was one in scope here; the fax number
  founders encounter belongs to Form SS-4 (§1.1).
- The paper rail persists: Form 15620 (Rev. 4-2025) itself instructs "Submit this
  completed and signed Form 15620 to the IRS via mail"
  (https://www.irs.gov/pub/irs-pdf/f15620.pdf, fetched and text-extracted 2026-10-03), and
  the IRS Pub 525 update says the election is made "by filing a written statement, or Form
  15620 … with the Internal Revenue Service Center where you file your return"
  (https://www.irs.gov/forms-pubs/update-to-the-2024-publication-525-for-section-83b-election).
- An online path now ALSO exists. The IRS mobile-friendly forms program states "Online
  Account (OLA) is required to complete mobile friendly forms that require signatures"
  and Form 15620 resolves in that program's picklist
  (https://www.irs.gov/forms-pubs/mobile-friendly-forms?find=15620). The direct entry point
  `https://www.irs.gov/dmaf/form/f15620` returned 403 (Akamai "Access Denied") to the
  keyless pipeline UA — consistent with an authenticated-only flow. Law-firm advisories
  dated July–August 2025 document the flow end to end (ID.me sign-in, guided Form 15620,
  electronic submit or download-and-mail), e.g.
  https://www.mintz.com/insights-center/viewpoints/2906/2025-07-29-new-electronic-filing-option-section-83b-elections
  and
  https://www.sidley.com/en/insights/newsupdates/2025/08/83b-goes-digital-two-quirks-founders-should-know-before-you-click-submit.
- Agent ceiling: either rail ends at the taxpayer personally — mail requires a wet-signed
  original from the individual; online requires the individual's ID.me (liveness, §1.3).
  The corpus's `policy-gate` on the signature (form_001 n8a, form_012 n8a, startup_002 n4b)
  stands. Its "no e-file option" claims do not — see §4.

## 2. Federal (non-IRS)

### 2.1 SAM.gov

- robots: https://sam.gov/robots.txt standard Drupal, content crawlable.
- Auth wall: SAM.gov sign-in is Login.gov ("Your username and password are managed by
  Login.gov" — GSA Federal Service Desk guidance, e.g.
  https://www.fsd.gov/fsd-gov/answer.do?sysparm_number=KB0011590; https://sam.gov/signin
  live). Login.gov is credential MFA, not biometric liveness by default — a softer wall
  than ID.me, but still person-bound.
- This is the best machine rail in the set: the SAM.gov Entity Management API is public
  and documented at https://open.gsa.gov/api/entity-api/ — API keys tied to SAM.gov
  accounts, "Individual (Personal) Accounts" and "System Accounts", published rate limits,
  an extract API, an OpenAPI spec, and tiered data access ("Unclassified ('Public'),
  Controlled Unclassified Information (CUI) 'For Official Use Only' (FOUO) or CUI
  'Sensitive' entity data, based on the sensitivity level of the user account").
- Corpus: no process record references SAM.gov at all (grep over
  `content/processes/records/` is empty) — an honest gap for any founder selling to the
  government.

### 2.2 USPTO — corpus: legal_002 n5, sit_009 n6/n7, opp_012

- robots: https://www.uspto.gov/robots.txt is minimal (five path disallows, four
  sitemaps). Friendliest crawl posture in the set.
- Reading rails are real: api.uspto.gov answered a keyless GET with HTTP 401
  `{"message":"Unauthorized"}` — a documented API-key model, keys issued free via a
  USPTO.gov account. The developer portals themselves (https://developer.uspto.gov,
  https://data.uspto.gov) serve JS app shells to keyless curl (rendered text ~0 bytes) —
  machine-documented only after JS execution.
- Filing rails are account-gated: "You'll need to create a USPTO.gov account with
  multifactor authentication methods and verify your identity before you can log in to
  access TEAS and Trademark Center. You can preview TEAS forms without logging in"
  (https://www.uspto.gov/trademarks/apply). Patent Center requires an account and notes
  direct API calls for its Workbench/view applications
  (https://www.uspto.gov/patents/apply/patent-center).
- Agent ceiling: status/data (TSDR, ODP) is key-gated but automatable; filing requires a
  verified account plus a sworn declaration. Matches legal_002 n5 and sit_009 n6
  (`policy-gate`) and sit_009 n7 (`third-party-wait`).

### 2.3 USCIS — corpus: hr_011 n6/n7, sit_002 n2/n5

- robots: https://www.uscis.gov/robots.txt (redirects to
  /sites/default/files/robots.txt) sets `Crawl-delay: 10` and disallows, among others, the
  H-1B employer data hub. Respected.
- The public case-status tool host `egov.uscis.gov` answered robots.txt with a Cloudflare
  "Attention Required!" 403 to the pipeline UA — a hard bot wall on the keyless tool.
- A documented developer surface exists: the USCIS Torch API Platform
  (https://developer.uscis.gov/) offers a "Case Status API" ("Provides case status
  information to USCIS customers and their representatives who require regular access")
  and a FOIA Request and Status API, with developer accounts, API keys, a sandbox, and
  email-gated production access.
- Online filing is myUSCIS account-based (https://www.uscis.gov/file-online, live 200);
  there is no filing API.
- Agent ceiling: filing stays human-gated (signature + fees — hr_011 n6 `assist` is
  right); status checking has a sanctioned API path the corpus doesn't know about (§4).

### 2.4 FinCEN BOI

- The obligation itself is (mostly) gone: https://www.fincen.gov/boi (fetched 2026-10-03)
  carries an alert "[Updated August 11, 2026]: FinCEN has finalized its BOI reporting
  rule. Under the new rule: U.S. companies are exempt from the Beneficial Ownership
  Information (BOI) reporting requirements and therefore, are no longer required to file
  BOI reports. … Only certain foreign companies registered to do business in the U.S. must
  report BOI." (Exemptions first introduced by the interim final rule of March 26, 2025.)
- https://boiefiling.fincen.gov/robots.txt serves the SPA's HTML shell, not a robots file
  — no published crawl policy on the filing host.
- Corpus: no record covers BOI (grep empty). Given the 2026 final rule, that zero is now
  correct for US-formed startups; any future guide must carry the foreign-company carve-out.

### 2.5 DOL FLAG (LCA) — corpus: hr_011 n3/n4

- robots: https://flag.dol.gov/robots.txt standard Drupal.
- Auth wall: the FLAG homepage source carries the Login.gov sign-in path
  (`login-gov/login/loa-1`) — accounts are Login.gov-brokered. LCA (ETA-9035) is filed
  inside the portal; public wage data (OFLC wage search and downloads) needs no account
  (https://flag.dol.gov/).
- Agent ceiling: matches hr_011 n3 (`assist` — stage the form, employer attests) and n4
  (`third-party-wait` — the statutory 7-business-day certification clock).

## 3. State portals

### 3.1 Delaware Division of Corporations + franchise tax — corpus: form_001 n4/n5, tax_001 n3/n4, sit_010 n3

- robots: https://corp.delaware.gov/robots.txt is two lines (`Disallow: /wp-admin`).
- Formation has no transactional public portal and no public API: entity forms are
  "PDF fillable" and submitted by upload, fax, or mail
  (https://corp.delaware.gov/howtoform/). Registered agents are the de facto API layer;
  commercial wrappers (Stripe Atlas, Clerky, Middesk — §1.1) ride agent channels.
- Annual report + franchise tax are "required to be filed online", due March 1, $200 +
  1.5%/month penalty (https://corp.delaware.gov/paytaxes/). The filing portal
  https://icis.corp.delaware.gov/ecorp/logintax.aspx is keyless — entry by Business Entity
  File Number plus optional saved-session ID — but its page source includes an image
  CAPTCHA: "Type code from the image" (fetched 2026-10-03, HTTP 200). Not interacted with.
- Agent ceiling: lookup and staging are drivable; the CAPTCHA is a documented anti-bot
  gate at entry, and officer attestation + payment remain with the human (tax_001 n3/n4).
  sit_010 n3's "end to end" drivability claim is contradicted by the CAPTCHA — §4.

### 3.2 California: bizfile + FTB — corpus: form_001 (foreign qualification), qs_047, form_011 n9

- bizfileonline.sos.ca.gov serves everything — including robots.txt — as an Imperva
  Incapsula-protected SPA shell (`/_Incapsula_Resource` script in the page source; no
  robots directives). A documented bot-management wall.
- Policy wall added 2026: "Effective August 1, 2026, web User Access is required for
  Statement of Information filings … Establishing User Access will help in preventing
  unauthorized submissions or filings on your entity's record"
  (https://www.sos.ca.gov/business-programs/bizfile). California is actively moving
  filings behind entity-linked accounts, explicitly as an anti-unauthorized-submission
  measure.
- FTB: https://www.ftb.ca.gov/robots.txt answered 403 Akamai "Access Denied" to the
  pipeline UA — the state tax site bot-walls non-browser agents at the front door.
- Agent ceiling: form_011 n9 calls state tax registration generically `drivable`; for
  California that generalization fails at two documented walls — §4.

### 3.3 New York — corpus: none

- robots: https://dos.ny.gov/robots.txt standard Drupal.
- Online incorporation exists: Certificate of Incorporation can be filed online with
  email receipt, $125 statutory fee
  (https://dos.ny.gov/certificate-incorporation-domestic-business-corporation), through
  the NY Business Express / NY.gov account system
  (https://www.businessexpress.ny.gov/app/answers/cms/a_id/2153/kw/).
- The filing application host `filings.dos.ny.gov` RESET the TLS connection
  (curl exit 56, "Connection reset by peer") to the pipeline UA — a transport-level bot
  wall on the filing app itself.
- Corpus: no NY-specific record (grep empty).

### 3.4 Texas — corpus: none

- https://www.sos.state.tx.us/robots.txt is empty (200, 0 bytes). But the business-filing
  host https://direct.sos.state.tx.us/robots.txt is the most explicit anti-agent posture
  found in this entire sweep: `Disallow: /` for `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`,
  `Googlebot`, `bingbot`, `FacebookExternalHit`, `AhrefsBot`, `meta-externalagent`,
  `DataForSeoBot` — AI crawlers and agents named and banned by name. Respected: nothing on
  that host was fetched beyond robots.txt.
- The published access model (https://www.sos.state.tx.us/corp/sosda/index.shtml):
  SOSPortal "available 24/7", with "a $1.00 statutorily authorized fee associated with
  each search" — pay-per-query, account-based.
- Corpus: no TX-specific record.

### 3.5 Nevada — corpus: none

- https://www.nvsos.gov/robots.txt answered 403 Akamai "Access Denied" (with an Incapsula
  resource in the error page) to the pipeline UA.
- SilverFlume (https://www.nvsilverflume.gov) redirects to
  https://orion.nv.gov/portal/public/ which serves `<META NAME="robots"
  CONTENT="noindex,nofollow">` plus an Incapsula script and an empty body to keyless curl.
  Bot-walled end to end; nothing probed further.
- Corpus: no NV-specific record.

## 4. Corpus cross-check: where the audit and the published record disagree

The human-step audit is right far more than it is wrong — every signature/attestation
`policy-gate` in scope checks out against published .gov language. Four flags:

1. **83(b) "no e-file option" is stale.** form_001 n8 ("There is no e-file option for this
   election"), form_012 n8 ("There is no online submission portal for 83(b) elections"),
   and startup_002 n5 all predate the IRS's online Form 15620 flow (live by Aug 2025 per
   §1.5). The irreducible part was never the mail — it is the taxpayer's personal
   signature/ID.me, which n8a/n4b already capture. The `no-screen` verdicts on n8/n5
   should become something like `policy-gate` (there IS a screen now; it's just the
   taxpayer's own).
2. **USCIS "no public status API" is half-true.** sit_002 n2 says the tracker is
   bot-walled "with no public status API for applicants". The bot wall is confirmed
   (Cloudflare 403, §2.3), but the Torch Case Status API exists at developer.uscis.gov —
   access-gated and aimed at "customers and their representatives who require regular
   access", so the step stays human for a one-off founder, but the honest wording should
   acknowledge the sanctioned API path.
3. **Delaware franchise portal is not CAPTCHA-free.** sit_010 n3: "The portal is a
   straightforward web flow a browser agent can drive end to end; payment approval stays
   with the founder." The ICIS entry page documents an image CAPTCHA (§3.1) — a
   drive-stopping gate the audit omits. "Drive end to end" overstates the ceiling.
4. **"State tax registration is drivable" doesn't generalize.** form_011 n9 marks state
   tax registration `drivable`. For California, FTB 403s the pipeline UA at robots.txt and
   bizfile requires entity-linked User Access for filings since 2026-08-01 (§3.2); Nevada
   and the NY filing host wall keyless agents at the transport layer. Drivability is
   jurisdiction-dependent and should say so.

Honest zeros, not errors: no corpus coverage of SAM.gov, NY/TX/NV filing portals, or
FinCEN BOI (the last now moot for U.S.-formed companies per the 2026 final rule).

## 5. Summary table

Agent ceiling legend — **read**: public data reachable by key/keyless machine rail;
**stage**: agent can fill/drive up to the human attestation; **stop**: documented wall
(liveness ID, CAPTCHA, bot wall, paper) before any useful action.

| Service | Corpus ids | Machine rail (documented) | Auth wall | Bot posture (observed 2026-10-03) | Agent ceiling |
|---|---|---|---|---|---|
| IRS EIN assistant | form_002 n3, form_011 n7, vc_001 n6 | none; third-party designee rail | none (attestation only) | robots open; app host 503 | stage, in published hours; 1/day |
| IRS MeF e-file | tax_002 n5b/n6 | XML A2A for authorized providers; IRIS A2A for 1099s | EFIN (suitability, fingerprints, ≤45 days) / TCC | n/a (credentialed) | stop (keyless); read/write via provider rail |
| IRS Online Account / BTA | sit_004 n5, tax_002 n7 | none | ID.me — selfie/biometric or live video agent | dmaf form entry 403 to pipeline UA | stop (liveness) |
| EFTPS | tax_002 n7 | Batch Provider software (pros) | Login.gov/ID.me MFA + PIN by U.S. Mail (5–7 days) | no robots.txt (404) | stop (mail PIN + MFA) |
| 83(b) / Form 15620 | form_001 n8/n8a, form_012 n8/n8a, startup_002 n4b/n5 | online submit via IRS OLA (new, 2025); else wet-sign + mail; **no fax rail** | ID.me (online) or wet signature (mail) | irs.gov/dmaf 403 to pipeline UA | stop (taxpayer-personal both rails) |
| SAM.gov | — (gap) | Entity Management API, OpenAPI, extracts | Login.gov; API keys (personal/system) | robots open | read (best in class); stage for registration |
| USPTO TEAS / Patent Center | legal_002 n5, sit_009 n6/n7 | api.uspto.gov (401 keyless → API-key), TSDR/ODP | USPTO.gov account + MFA + identity verification to file | robots minimal; dev portals JS-only | read (keyed); stage filings |
| USCIS online filing | hr_011 n6/n7, sit_002 n2/n5 | Torch Case Status + FOIA APIs (gated prod) | myUSCIS account; egov tool Cloudflare-walled | Crawl-delay 10; egov 403 | read (via Torch, if approved); stage filings |
| FinCEN BOI | — (now moot for U.S. cos) | e-filing SPA | n/a for U.S. companies since 2025-03/2026-08 rule | robots serves app shell | n/a — obligation removed |
| DOL FLAG (LCA) | hr_011 n3/n4 | public wage data; no filing API | Login.gov | robots open | read wage data; stage LCA |
| DE DOC + franchise tax | form_001 n4/n5, tax_001 n3/n4, sit_010 n3 | none public; registered-agent channel | keyless file-number entry + image CAPTCHA; officer attestation | robots 2 lines; CAPTCHA documented | stage to CAPTCHA; formation = PDF/upload/fax/mail |
| CA bizfile + FTB | qs_047, form_011 n9 | none public | entity-linked User Access required (2026-08-01) | Incapsula on bizfile; FTB 403s pipeline UA | stop at front door (keyless) |
| NY DOS filing | — (gap) | none public | NY.gov account | robots open; filings host TCP-resets pipeline UA | stage via browser only |
| TX SOSPortal/SOSDirect | — (gap) | none public; $1.00/search | account + per-query fee | robots bans GPTBot/ChatGPT-User/OAI-SearchBot by name | stop (named AI-agent disallow — respected) |
| NV SilverFlume / SOS | — (gap) | none public | portal account | 403 Akamai + Incapsula; noindex,nofollow | stop at front door (keyless) |

llms.txt across all hosts checked: zero (404/403 everywhere).

## 6. Recommendation

**Not a judged arena.** Three structural reasons:

1. These are monopolies, not vendors. An arena ranks substitutable products on judged
   evidence; there is exactly one place to get an EIN. A leaderboard with no alternative
   per row ranks nothing.
2. The pipeline cannot ethically probe the thing that matters. Every interesting surface
   sits behind ID.me liveness, Login.gov MFA, CAPTCHAs, or named robots disallows
   (direct.sos.state.tx.us bans GPTBot-class agents outright). Our own rules — respect
   robots, no credentialed logins, no CAPTCHA interaction — cap probing at exactly the
   walls this dossier already documents. Re-running an "arena" would re-measure the walls.
3. The verdicts would never move. Government rails change on rulemaking timescales; a
   judged arena's value is movement under competition.

**Do instead — both halves of the enrichment path:**

- **Corpus enrichment (geoNote-style agent-rail notes).** The per-step facts in this
  dossier are exactly the shape of the existing human-step audit and belong next to it:
  published hours windows (EIN), mail-PIN latency (EFTPS), liveness walls (ID.me vs
  Login.gov — they are different severities and the corpus should distinguish them),
  CAPTCHA presence (DE ICIS), named-robots bans (TX), and the sanctioned API where one
  exists (SAM.gov, USCIS Torch, USPTO ODP, IRS IRIS). Concretely: fix the four §4
  disagreements (the stale 83(b) "no e-file" claims are founder-facing and now wrong), and
  add a small `agentRail` note field or audit extension carrying wall-type + citation.
- **The intermediary layer IS an arena candidate.** Where government walls stop agents, a
  real vendor market sells the bridge: formation/EIN (Stripe Atlas, Clerky, Firstbase,
  Middesk), registered-agent and filing APIs, 1099/IRIS e-file providers (Track1099,
  Tax1099), trademark filing services. Those are substitutable, probe-able,
  evidence-judgeable vendors — the standard arena shape. If the founder wants a judged
  product out of this work, "government-filing intermediaries" is it; this dossier is the
  access-model ground truth that arena would sit on.

Net: dossier + corpus enrichment now; intermediary arena as the follow-on if the founder
wants rankings.
