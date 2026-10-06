# Government digital surfaces worldwide: 50 US states and six countries by area

Research lane, fetched 2026-10-06. Founder ask: map government digital surfaces and their
agenticness for all US states and the covered countries, with leaderboards overall and by
area. This is the Phase 1 evidence dossier and roster proposal; no judging happened in this
phase. It extends the live `government-services` arena (nine US agencies in
`data/government-services/`) and the federal dossier
`docs/vendor-research/government-services-agenticness.md` (fetched 2026-10-03), whose
federal findings are not re-verified here.

## Methodology (dated)

- All live fetches 2026-10-06 with the pipeline UA
  `Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)`, one-shot keyless
  GETs, no retries except where the first attempt used a wrong URL or failed before
  reaching the host (DNS). No logins, no CAPTCHA interaction, no filings, no load.
- robots.txt fetched first for every host and treated as law, conservatively:
  - robots.txt answering 401/403/5xx or failing at the transport layer: recorded as a
    front-door wall; nothing else fetched on that host.
  - `User-agent: *` with `Disallow: /`: nothing else fetched.
  - A named LLM-agent bot (GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, CCBot,
    meta-externalagent, and peers) blanket-banned: treated as anti-agent posture; nothing
    else fetched (the Texas precedent from the 2026-10-03 dossier).
  - Path disallows honored by prefix; crawl-delay honored between same-host requests.
- Per host, at most three GETs (robots.txt, landing page, llms.txt) plus, where a public
  API is documented, one keyless GET against the documented endpoint to record its answer.
- Landing bodies were scanned for bot-management products (Incapsula/Imperva, Cloudflare
  challenge, Akamai, Radware, DataDome, PerimeterX, Kasada), CAPTCHA markers, and auth
  copy. A 200 under ~2.5 KB is recorded as a JS app shell (no keyless HTML content).
- What this sweep cannot see: anything behind a login, the actual filing flow past the
  front door, and APIs not reachable from the surfaces checked. "No API found" below
  means none was found on the checked surfaces, not a proof of absence; the two state
  data APIs that were positively verified are marked as such.
- llms.txt: 116 hosts answered the check; zero served one. The llms.txt zero now spans
  every government host this program has ever checked.

Corpus processes gated by these surfaces, applied once rather than per-row: the state
business-registry surface gates form_001 (incorporate), form_011 (LLC), qs_043
(registered agent), qs_045 (review state registration / foreign qualification), and
qs_047 (annual report); the state tax surface gates form_005 (register state taxes),
qs_063 (payroll setup), and the employer steps of hr_001/hr_002. The corpus and the
jurisdiction registry currently carry state-level records for DE, CA, NY, TX, and NV
only; the other 45 states are corpus zeros. `jurisdictions/vendor-geo.json` covers
US/UK/IN/DE/FR; PT and CA (Canada) would be new geo codes.

## 1. The 50 US states

### 1.1 Aggregate posture (observed 2026-10-06)

Business-registry surfaces (50 checked): 26 served real keyless HTML; 13 were walled at
robots.txt itself (403/5xx/transport error, blanket disallow, or named AI-bot ban); 4
served JS app shells; 3 served a bot-management shell (Incapsula on CA and MA, Nevada's
orion.nv.gov); MS answered 403 with a Cloudflare challenge; RI's portal timed out; AZ and
ME needed fallback URLs (details in the table).

Tax surfaces (50 checked): 19 real keyless HTML; 13 JS app shells; 9 walled at robots.txt;
7 put a keyless client into a redirect loop; MO served content behind Incapsula with
reCAPTCHA markers; NH's portal 404s at root. The redirect-loop and JS-shell groups are
mostly one product: GenTax (FAST Enterprises). The platform names itself in Idaho's case
(tax.idaho.gov links its TAP at `idahotap.gentax.com/TAP/_/`, fetched 2026-10-06), and the
same `/_/` SPA signature with near-identical ~1.1 KB JS shells appears across the shell
group. On every host with that signature the keyless rail ends at the shell or a
cookie-gated redirect loop: one vendor's front-end decision sets the agent posture for
roughly 20 of the 50 state tax systems.

Named AI-agent bans found: Texas SOSDirect (GPTBot, ChatGPT-User, OAI-SearchBot,
meta-externalagent, and others, re-confirmed) and Virginia Tax (`User-agent: GPTBot` /
`Disallow: /` at https://www.tax.virginia.gov/robots.txt). Virginia also blanket-disallows
all crawlers on its SCC filing system (cis.scc.virginia.gov, `Disallow: /`), making it the
most closed state across both surfaces.

Keyless data APIs: exactly two were verified live. Colorado's business-entities dataset
answered a keyless GET with entity JSON
(https://data.colorado.gov/resource/4ykn-tg5h.json, HTTP 200), and New York's active
corporations dataset did the same (https://data.ny.gov/resource/n9v6-gdp6.json, HTTP 200);
both ride Socrata open-data platforms, not the registries themselves. No state documents a
filing API on any surface checked. The sanctioned write-path everywhere is a browser
session, and in several states explicitly an account plus CAPTCHA.

CAPTCHA markers on otherwise reachable filing/registration surfaces: IA, SD, UT, WY
(business) and MN, OH, RI (tax; MN's is a Radware Bot Manager interstitial that redirects
keyless clients to validate.perfdrive.com).

### 1.2 Business-registry portals, state by state

Columns: robots.txt posture; what a keyless agent gets at the landing page. "Not fetched"
means robots posture stopped the sweep on that host, which is itself the finding.

| State | Surface (host) | robots.txt | Keyless landing 2026-10-06 |
|---|---|---|---|
| AK | Div. of Corporations (commerce.alaska.gov) | walled (403) | not fetched |
| AL | SOS business entities (sos.alabama.gov) | open (35 disallows) | 200 |
| AR | SOS business services (sos.arkansas.gov) | open (5 disallows, crawl-delay 5) | 200 |
| AZ | ACC eCorp (ecorp.azcc.gov) | host did not resolve (DNS) | azcc.gov/ecorp 404; azcc.gov root 200 |
| CA | bizfile Online (bizfileonline.sos.ca.gov) | HTML shell, no directives | 200 Incapsula JS shell, noindex |
| CO | SOS (coloradosos.gov) | open (24 disallows) | 200; data API verified (§1.1) |
| CT | business.ct.gov | open (39 disallows) | 200 |
| DE | Division of Corporations (corp.delaware.gov) | open (1 disallow) | 200 |
| FL | Sunbiz (dos.fl.gov; efile.sunbiz.org) | HTML shell, no directives | 200 |
| GA | eCorp (ecorp.sos.ga.gov) | walled (403) | not fetched |
| HI | Hawaii Business Express (hbe.ehawaii.gov) | HTML shell, no directives | 200 JS shell |
| IA | Fast Track Filing (filings.sos.iowa.gov) | open (3 disallows) | 200, reCAPTCHA on page |
| ID | SOSBiz (sosbiz.idaho.gov) | open (0 disallows) | 200 JS shell |
| IL | SOS business services (ilsos.gov) | walled (403) | not fetched |
| IN | INBiz (inbiz.in.gov) | none (404) | 200 |
| KS | Kansas Business Center (sos.ks.gov) | open (2 disallows) | 200 |
| KY | Kentucky One Stop (onestop.ky.gov) | open (5 disallows) | 200 |
| LA | geauxBIZ (geauxbiz.sos.la.gov) | `Disallow: /` for * | not fetched |
| MA | Corporations Division (sec.state.ma.us) | open (46 disallows) | 200 Incapsula JS shell, noindex |
| MD | Maryland Business Express (egov.maryland.gov) | open (0 disallows) | 200 |
| ME | SOS corporations (maine.gov/sos) | open (84 disallows) | /sos/cec/corp/ 404; /sos root 200 |
| MI | LARA COFS (cofs.lara.state.mi.us) | TLS handshake refused (curl exit 35, twice) | not fetched; michigan.gov/lara robots also 403 |
| MN | MBLS portal (mblsportal.sos.mn.gov) | open (0 disallows) | 200 |
| MO | SOS business filings (bsd.sos.mo.gov) | none (404) | 200 |
| MS | corp.sos.ms.gov | none (404) | 403 Cloudflare challenge |
| MT | biz.sosmt.gov | walled (403) | not fetched |
| NC | sosnc.gov | none (404) | 200 |
| ND | FirstStop (firststop.sos.nd.gov) | HTML shell, no directives | 200 JS shell |
| NE | SOS business services (sos.nebraska.gov) | open (34 disallows) | 200 |
| NH | QuickStart (quickstart.sos.nh.gov) | walled (403) | not fetched |
| NJ | njportal.com business formation | HTML shell, no directives | 200 |
| NM | enterprise.sos.nm.gov | none (404) | 200 JS shell |
| NV | SilverFlume (nvsilverflume.gov → orion.nv.gov) | HTML shell, no directives | 200 Incapsula JS shell, noindex |
| NY | DOS filings pages (dos.ny.gov) | open (22 disallows) | 200; data API verified (§1.1); filing host TCP-resets per the 2026-10-03 dossier |
| OH | Ohio Business Central (bsportal.ohiosos.gov) | walled (403) | not fetched |
| OK | SOS filing (sos.ok.gov) | `Disallow: /` for * | not fetched |
| OR | Oregon Business Registry (secure.sos.state.or.us) | HTML shell, no directives | 200 |
| PA | Business Filing Services (file.dos.pa.gov) | HTTP 999 | not fetched |
| RI | business.sos.ri.gov | none (404) | connection timeout (curl exit 28) |
| SC | businessfilings.sc.gov | none (404) | 200 |
| SD | sosenterprise.sd.gov | none (404) | 200, reCAPTCHA on page |
| TN | TNBEAR (tnbear.tn.gov) | connection timeout (curl exit 28, twice) | not fetched |
| TX | SOSDirect (direct.sos.state.tx.us) | named AI bans: GPTBot, ChatGPT-User, OAI-SearchBot, meta-externalagent + | not fetched (respected) |
| UT | corporations.utah.gov (commerce.utah.gov) | none (404) | 200, reCAPTCHA on page |
| VA | SCC CIS (cis.scc.virginia.gov) | `Disallow: /` for * | not fetched |
| VT | bizfilings.vermont.gov | HTML shell, no directives | 200 |
| WA | CCFS (ccfs.sos.wa.gov) | none (404) | 200 |
| WI | DFI (dfi.wi.gov) | none (404) | 200 |
| WV | One Stop (onestop.wv.gov) | none (404) | 200 |
| WY | WyoBiz (wyobiz.wyo.gov) | HTML shell, no directives | 200, CAPTCHA markers in source |

### 1.3 State tax registration portals, state by state

| State | Surface (host) | robots.txt | Keyless landing 2026-10-06 |
|---|---|---|---|
| AK | online-tax.alaska.gov | `Disallow: /` for * | not fetched |
| AL | My Alabama Taxes (myalabamataxes.alabama.gov) | open (0 disallows) | 200 GenTax JS shell |
| AR | ATAP (atap.arkansas.gov) | none (404) | redirect loop for keyless client |
| AZ | AZTaxes (aztaxes.gov) | none (404) | 200 |
| CA | CDTFA online services (onlineservices.cdtfa.ca.gov) | none (404) | redirect loop for keyless client; ftb.ca.gov 403s robots per the 2026-10-03 dossier |
| CO | MyTax (mytax.colorado.gov) | host did not resolve (DNS, twice) | tax.colorado.gov open, 200 |
| CT | myconneCT (drs.ct.gov) | robots 504 | not fetched |
| DE | Delaware One Stop (onestop.delaware.gov) | open (10 disallows) | 200 |
| FL | floridarevenue.com | open (9 disallows) | 200 |
| GA | Georgia Tax Center (gtc.dor.ga.gov) | `Disallow: /` for * | not fetched |
| HI | Hawaii Tax Online (hitax.hawaii.gov) | open (0 disallows) | 200 GenTax JS shell |
| IA | GovConnectIowa (govconnect.iowa.gov) | `Disallow: /` for * | not fetched |
| ID | tax.idaho.gov (TAP pages) | open (0 disallows) | 200 |
| IL | MyTax Illinois (mytax.illinois.gov) | HTML shell, no directives | 200 GenTax JS shell |
| IN | INTIME (intime.dor.in.gov) | robots 520 | not fetched |
| KS | KDOR Customer Service Center (kdor.ks.gov) | open (2 disallows) | 200 |
| KY | revenue.ky.gov | open (1 disallow) | 200 |
| LA | LaTAP (latap.revenue.louisiana.gov) | HTML shell, no directives | 200 GenTax JS shell |
| MA | MassTaxConnect (mtc.dor.state.ma.us) | none (404) | redirect loop for keyless client |
| MD | marylandtaxes.gov (→ marylandcomptroller.gov) | open (1 disallow) | 200 |
| ME | Maine Tax Portal (revenue.maine.gov) | open (0 disallows) | 200 GenTax JS shell |
| MI | Michigan Treasury Online (mto.treasury.michigan.gov) | HTML shell, no directives | 200 |
| MN | DOR e-Services (mndor.state.mn.us) | none (404) | 200 Radware Bot Manager CAPTCHA, redirects keyless clients to validate.perfdrive.com |
| MO | MyTax (mytax.mo.gov) | HTML shell, no directives | 200 behind Incapsula, reCAPTCHA markers |
| MS | TAP (tap.dor.ms.gov) | `Disallow: /` for * | not fetched |
| MT | TAP (tap.dor.mt.gov) | HTML shell, no directives | 200 GenTax JS shell |
| NC | ncdor.gov | open (24 disallows) | 200 |
| ND | TAP (apps.nd.gov → tap.tax.nd.gov) | none (404) | 200 GenTax JS shell |
| NE | revenue.nebraska.gov | open (35 disallows) | 200 |
| NH | Granite Tax Connect (gtc.revenue.nh.gov) | open (0 disallows) | 404 at root (GenTax app path required) |
| NJ | NJ-REG (njportal.com) | HTML shell, no directives | 200 |
| NM | TAP (tap.state.nm.us) | none (404) | 200 GenTax JS shell |
| NV | tax.nv.gov | open (4 disallows) | 200 |
| NY | tax.ny.gov online services | open (11 disallows) | 200 |
| OH | Ohio Business Gateway (gateway.ohio.gov) | open (6 disallows) | 200, CAPTCHA markers in source |
| OK | OkTAP (oktap.tax.ok.gov) | `Disallow: /` for * | not fetched |
| OR | Revenue Online (revenueonline.dor.oregon.gov) | none (404) | redirect loop for keyless client |
| PA | myPATH (mypath.pa.gov) | none (404) | redirect loop for keyless client |
| RI | taxportal.ri.gov | none (404) | 200, reCAPTCHA on page |
| SC | MyDORWAY (mydorway.dor.sc.gov) | HTML shell, no directives | 200 GenTax JS shell |
| SD | dor.sd.gov | open (0 disallows) | 200 |
| TN | TNTAP (tntap.tn.gov) | open (2 disallows) | redirect loop for keyless client |
| TX | Comptroller file-and-pay (comptroller.texas.gov) | open (4 disallows) | 200 |
| UT | TAP (tap.utah.gov → tap.tax.utah.gov) | HTML shell, no directives | 200 GenTax JS shell |
| VA | tax.virginia.gov | named AI ban: `User-agent: GPTBot` / `Disallow: /` | not fetched (respected) |
| VT | myVTax (myvtax.vermont.gov) | none (404) | redirect loop for keyless client |
| WA | My DOR (secure.dor.wa.gov) | HTML shell, no directives | 200 JS shell |
| WI | TAP (tap.revenue.wi.gov) | none (404) | 200 JS shell ("My Tax Account") |
| WV | MyTaxes (mytaxes.wvtax.gov) | HTML shell, no directives | 200 GenTax JS shell |
| WY | revenue.wyo.gov | none (404) | 200 |

### 1.4 What the state sweep says

1. **There is no write rail anywhere.** Fifty states, zero filing APIs, zero llms.txt.
   The only machine-readable rails are two read-only Socrata datasets (CO, NY) that live
   outside the registries that own the data.
2. **The tax layer is a platform monoculture.** GenTax's SPA front-end is the de facto
   national answer for state tax registration, and it hands a keyless agent either a
   ~1.1 KB JS shell or a redirect loop in every state that runs it. A single vendor
   conversation would change more state-tax agent posture than fifty separate ones.
3. **Anti-agent posture is spreading by name.** Virginia Tax joins Texas SOSDirect in
   banning GPTBot-class agents explicitly. Both bans were respected; both are findings.
4. **The friendliest full stacks** (both surfaces keyless-reachable, robots open, no
   CAPTCHA or wall observed): CO, DE, FL (registry side), KS, KY, MD, NC, NE, NY (info
   surfaces), SD, WY. The most closed: VA (blanket disallow + named ban), TX (named
   bans + per-query fees), AK, GA, OK, MS (walls on both surfaces), MI (TLS refusal +
   robots 403).

## 2. Six countries by area

Areas match the judged US set: company registry (vs DE/CA/NY/TX SOS + Corporations
layer), tax authority (vs IRS/EFTPS), IP office (vs USPTO), immigration (vs USCIS), plus
each country's one-stop/business-ID layer. One keyless GET per documented API endpoint;
answers quoted verbatim where short.

### 2.1 United Kingdom

| Area | Surface | robots.txt | Keyless landing / API 2026-10-06 |
|---|---|---|---|
| Company registry | Companies House (find-and-update.company-information.service.gov.uk) | none (404) | 200 |
| Company registry | api.company-information.service.gov.uk | n/a (API host) | keyless GET 401 `{"error":"Empty Authorization header","type":"ch:service"}` |
| Company registry | developer.company-information.service.gov.uk | none (404) | 200 ("REST API" docs reachable keyless) |
| Tax | HMRC on gov.uk | open (2 disallows) | 200 |
| Tax | api.service.hmrc.gov.uk | n/a (API host) | keyless GET 406 `{"code":"ACCEPT_HEADER_INVALID","message":"The accept header is missing or invalid"}` (live, versioned REST) |
| Tax | developer.service.hmrc.gov.uk | `Disallow: /` for *; `Allow: /api-documentation` for Googlebot only | not fetched (respected) |
| IP | UK IPO on gov.uk | open (2 disallows) | 200 |
| IP | trademarks.ipo.gov.uk | walled (403) | not fetched |
| Immigration | gov.uk visas and immigration | open (2 disallows) | 200 |
| One-stop | gov.uk/set-up-business | open (2 disallows) | 200; Content API keyless 200 JSON at /api/content/set-up-business |

The UK is the benchmark. Companies House operates a documented public REST API (free
keys; the keyless 401 above is the documented auth model answering correctly), HMRC runs
versioned production APIs under Making Tax Digital, and GOV.UK itself exposes every
content page as keyless JSON. The one discordant note: HMRC's own developer hub
robots-bans every crawler except Googlebot, so the country with the best tax API hides
its API documentation from agents.

### 2.2 India

| Area | Surface | robots.txt | Keyless landing / API 2026-10-06 |
|---|---|---|---|
| Company registry | MCA (mca.gov.in) | walled (403) | not fetched |
| Tax (GST) | gst.gov.in | none (404) | 200; developer.gst.gov.in/apiportal/ 200 (GST API portal, GSP/ASP access model) |
| Tax (income) | incometax.gov.in e-filing | HTML shell, no directives | 200 |
| IP | ipindia.gov.in | open (0 disallows) | 200 |
| Immigration | e-FRRO (indianfrro.gov.in) | none (404) | root 200 ("EfrroOnline"); the long-published /eservices/home.jsp path 404s |
| One-stop | NSWS (nsws.gov.in) | walled (403) | not fetched |

India splits: GST has a real, documented machine channel (the GSP model, with its own
developer portal), while the company registry and the national single window wall agents
at robots.txt itself.

### 2.3 Germany

| Area | Surface | robots.txt | Keyless landing / API 2026-10-06 |
|---|---|---|---|
| Company registry | handelsregister.de | HTML shell, no directives | 200 |
| Company registry | unternehmensregister.de | open (81 disallows) | 200 |
| Tax | ELSTER (elster.de) | none (404) | 200 |
| Tax | esteuer.de (ERiC developer artifacts) | n/a | 200; taxonomy/download bundles served keyless |
| IP | dpma.de | open (1 disallow) | 200 |
| IP | DPMAregister (register.dpma.de) | `Disallow: /` for * with enumerated Allow paths; the target path was not clearly allowed | not fetched |
| Immigration | BAMF (bamf.de) | none (404) | 200 |
| One-stop / business ID | BZSt (bzst.de) | open (4 disallows, crawl-delay 30) | 200 |

Germany's machine rail is real but developer-shaped rather than web-shaped: ELSTER's
ERiC library (the esteuer.de artifacts above) is the sanctioned software channel for tax
filings, used by every German tax product. The registers publish no public API on the
surfaces checked; no national one-stop exists (Gewerbeanmeldung is municipal), so BZSt
stands in as the business-ID layer.

### 2.4 France

| Area | Surface | robots.txt | Keyless landing / API 2026-10-06 |
|---|---|---|---|
| Company registry | Infogreffe (infogreffe.fr) | walled (403) | not fetched |
| Company registry | INPI Guichet unique (procedures.inpi.fr) | none (404) | 200 JS shell |
| Company registry | Annuaire des Entreprises (annuaire-entreprises.data.gouv.fr) | HTML shell, no directives | 200 Incapsula JS shell; but recherche-entreprises.api.gouv.fr answered a keyless GET 200 with full entity JSON |
| Tax | impots.gouv.fr | open (35 disallows) | 200; api.gouv.fr DGFiP producer catalog 200 |
| IP | inpi.fr | open (56 disallows) | 200 (Incapsula present); data.inpi.fr keyless GET 403 |
| Immigration | ANEF (administration-etrangers-en-france.interieur.gouv.fr) | HTML shell, no directives | 200 Incapsula shell |
| One-stop / business ID | INSEE (insee.fr) | open (6 disallows) | 200; SIRENE API keyless GET 401 `{"message":"Unauthorized"}` (documented token model) |

France has the strangest split in the set: the official filing front doors (Guichet
unique, ANEF, annuaire web UI) sit behind Incapsula or JS shells, while the state's data
layer is excellent, with recherche-entreprises.api.gouv.fr serving keyless registry JSON
and SIRENE serving tokened JSON.

### 2.5 Portugal

| Area | Surface | robots.txt | Keyless landing / API 2026-10-06 |
|---|---|---|---|
| Company registry | eportugal.gov.pt | none (404) | root 200; the published Empresa Online paths (/en/espaco-empresa/empresa-online and the PT variant) 404 |
| Company registry | IRN (irn.justica.gov.pt) | open (28 disallows) | 200, reCAPTCHA on page |
| Tax | Portal das Finanças (portaldasfinancas.gov.pt) | none (404) | 200 |
| IP | INPI PT (inpi.justica.gov.pt) | open (28 disallows) | 200, reCAPTCHA on page |
| Immigration | AIMA (aima.gov.pt) | open (3 disallows) | 200 |
| One-stop / open data | dados.gov.pt | robots 500 | API keyless GET 200 (`"access_type": "open"` in the dataset payload) |

Portugal's front doors are reachable but CAPTCHA-marked on the Justiça platform, and the
flagship Empresa Online entry URL is broken at its published path. The open-data API
answers keyless even while the same host's robots.txt 500s.

### 2.6 Canada

| Area | Surface | robots.txt | Keyless landing / API 2026-10-06 |
|---|---|---|---|
| Company registry | Corporations Canada (ised-isde.canada.ca) | open (26 disallows) | 200; the legacy corporation-details GET returns a JS application page, not data |
| Tax | CRA (canada.ca/en/revenue-agency) | open (47 disallows) | 200; Business Registration Online pages 200 |
| IP | CIPO (ised-isde.canada.ca) | open (26 disallows) | 200 |
| Immigration | IRCC (canada.ca) | open (47 disallows) | 200 |
| One-stop | BizPaL (bizpal.ca) | none (404) | 200 |
| Open data | open.canada.ca CKAN API | n/a | keyless GET 200 JSON |

Canada reads as uniformly open at the content layer (canada.ca robots are permissive and
every page checked served real HTML) with no transactional API on any surface checked;
the machine rail is the open-data CKAN layer plus certified-software channels (EFILE)
that mirror the IRS model.

## 3. The comparison the founder asked for

Measured at the front door, the US is behind on machine rails and ahead on nothing:

- **Company registry:** Companies House has a free public REST API; France serves keyless
  registry JSON; Canada and Germany serve open HTML registers. The US state registries
  offer zero filing APIs, two third-platform read datasets, and five states walled at
  robots.txt. Delaware, the registry that matters most for startups, files by PDF upload,
  fax, mail, or registered agent, with a CAPTCHA on its one online portal (2026-10-03
  dossier).
- **Tax:** HMRC exposes versioned production APIs; Germany's ERiC is a sanctioned
  software channel with public artifacts; India's GST runs a developer portal. The IRS
  rail is the credentialed-provider MeF/EFIN path (45-day suitability, fingerprints), and
  the state layer is a GenTax monoculture of JS shells and redirect loops.
- **IP:** USPTO is the one US bright spot (keyed read APIs) and holds up against UKIPO
  (search host walled), DPMA (register robots-closed), INPI (data API 403), INPI-PT
  (CAPTCHA), and CIPO (open HTML, no API found). This is the area where the US likely
  tops the leaderboard.
- **Immigration:** every country's filing path is account-walled; USCIS's Torch API
  (gated) has no verified equivalent in the sweep, though e-FRRO and ANEF were only
  front-door checked.
- **One-stop layer:** GOV.UK's keyless Content API has no US analogue at all.

## 4. Gaps and limits (this phase)

- Hosts that walled robots.txt itself, where nothing further is known: AK/GA/IL/MT/NH/OH
  business registries, PA (HTTP 999), ilsos.gov, MCA (mca.gov.in), NSWS, Infogreffe,
  trademarks.ipo.gov.uk, michigan.gov/lara, plus transient-looking errors (drs.ct.gov
  504, intime.dor.in.gov 520, dados.gov.pt 500) that a Phase 2 re-check should retry
  once before judging.
- mytax.colorado.gov and ecorp.azcc.gov did not resolve from this vantage (curl exit 6,
  two attempts each); both states were assessed via their reachable alternates. TN and
  MI failed at the transport layer on both attempts.
- Auth-wall class behind the front door (account vs ID-proofing vs liveness) is not
  observable keyless for walled hosts; where this dossier is silent, Phase 2 judging must
  rely on each service's published auth documentation (the `auth-requirements-stated`
  story already measures exactly that).
- Filing-rail classification (online vs PDF) is grounded in landing-page copy for open
  hosts and is unknown for walled ones; it is a judge-stage question, not a crawl
  question, for the 22 walled surfaces.
- Sweep artifacts (bodies, headers, parsed robots) live outside the repo; every claim
  above carries its observable (URL + date + response) inline.

## 5. Phase 2 proposal: roster, leaderboards, stories, spend

### 5.1 Roster (31 new products; 40 total in the arena)

Countries, 24 products (6 countries × 4 judged areas; the one-stop/business-ID layer
folds into the registry product's evidence rather than standing alone):

- UK: Companies House, HMRC, UK IPO, Home Office (UKVI)
- India: MCA, GST Network (+ income-tax e-filing as evidence), IP India, e-FRRO/BoI
- Germany: Handelsregister/Unternehmensregister (one product), ELSTER, DPMA, BAMF
- France: INPI Guichet unique (registry; Annuaire/SIRENE as evidence), impots.gouv.fr
  (DGFiP), INPI IP operations, ANEF
- Portugal: IRN/Empresa Online, AT (Portal das Finanças), INPI PT, AIMA
- Canada: Corporations Canada, CRA, CIPO, IRCC

US states, 7 new products beyond the judged DE/CA/NY/TX, chosen to span the posture
spectrum rather than to flatter it: CO (best machine rail), FL (open legacy registry),
WA (open registry, shell tax portal), NJ (keyless formation start), OH (walled registry,
open gateway), MN (Radware-walled tax), VA (most closed: blanket disallow + named GPTBot
ban). Honest-negative rows are the point; VA and MN will score near zero and should.

Not proposed: the other 39 states this round (the two tables above already record their
posture; promote any of them later if a founder ask or corpus record lands there), and
separate one-stop products (GOV.UK, NSWS, BizPaL, eportugal) which would double-count
their parent registries.

### 5.2 Leaderboards without hand-scores

Mechanics, all computed, consistent with the evidence doctrine:

1. Add `country` and `area` fields to the government-services product schema (its own
   schema commit). Every product, including the nine live ones, gets tagged (US federal
   products tag `country: US, area: tax|ip-office|immigration|procurement`).
2. Judge per agency exactly as today: per-story verdicts from evidence, scores from
   `pipeline derive`.
3. Country and area leaderboards are derived rollup views over judged cells, emitted by
   `derive` into a new derived file (e.g. `rollups.json`), never authored: a country's
   area score is its agency's computed arena score; a country's overall score is the
   mean over its four matched areas. The US overall rollup uses the matched federal
   agency per area (USPTO for IP, USCIS for immigration, IRS+EFTPS for tax) plus the
   state-registry mean for the registry area, with the composition stated on the page.
4. Per-area cross-country boards (the founder's "USPTO vs other countries") fall out of
   the same tags: one row per country within an area, each row a judged agency, no
   averaging needed.
5. Bias note: rollups compare only matched areas, so roster composition cannot move a
   country's overall score; adding a fifth area later means adding it for all six
   countries plus the US in the same change.

### 5.3 Stories

The 49 live stories (30 global agentic + 19 category) apply internationally as written;
crawl-policy, public-data-api, online-transaction-end-to-end, keyless-entry-path, and
auth-requirements-stated are exactly what §§1–2 measured. Two additions proposed, both
judgeable from published docs:

- `api-sandbox-available` (machine-rails): a public sandbox or test environment exists
  for the service's machine channel (HMRC and GST publish these; USCIS Torch has one;
  most agencies have nothing, an honest zero).
- `foreign-founder-usable` (founder-guidance): the service documents a path for a
  non-resident founder (ties to the go-global corpus chain; UK/PT/CA document this well,
  several US states not at all).

Existing cached verdicts stay valid; the two new stories add cells for all 40 products.

### 5.4 Spend at the adopted judge model

Basis: `docs/OPUS-5-5-JUDGE-PILOT.md` (adopted 2026-09-30; `pipeline/llm.ts` default
`claude-opus-5-5`): measured ~7,600 input + ~460 output tokens per cell, ≈ $0.040/cell
interactive ($4/$20 per MTok), ≈ $0.020/cell on the Batch API.

- 31 new products × 51 stories ≈ 1,581 cells → ≈ $63 interactive, ≈ $32 batch.
- 2 new stories × 9 existing products = 18 cells → ≈ $0.72 (cache keys keep the other
  existing cells un-rejudged).
- Pre-judge LLM stages (extract, normalize, collect-community) for 31 products are not
  priced in the pilot doc; budgeting them at up to 1x the judge stage gives a ceiling.

Proposal: approve a $150 interactive ceiling (expected ~$65–130), or ~$75 if the fleet
batch path from the pilot doc is used. Crawl evidence for the walled hosts is already
bounded by this dossier, so judge inputs for those products are small.

### 5.5 Founder decision points

1. Roster: 24 country agencies + 7 states as proposed, or trim/extend.
2. Schema: approve `country`/`area` product fields and the derived `rollups.json`.
3. Stories: approve the two additions (or judge with the existing 49 unchanged).
4. Spend: approve the Phase 2 ceiling and interactive-vs-batch choice.
5. Geo layer: add PT and CA (Canada) codes to `jurisdictions/` alongside the judged set.
