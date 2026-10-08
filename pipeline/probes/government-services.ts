import type { LocalProbe } from './types'

// Government services: the agencies whose committed evidence shows a genuinely probeable
// public machine surface get recorded runs; everything else in this arena stays replay-free.
// Standing rules (same contract as the wall-probe scripts in pipeline/scripts/
// append-government-services-*-wall-probes.py): every command is a single keyless read-only
// GET with the standard pipeline UA, no logins, no CAPTCHAs, and robots.txt is re-checked per
// host before any recording run. Runtime robots results (2026-10-08, pipeline UA):
//
//   www.gov.uk                       200, /api/content/* not disallowed            → probed
//   api.sam.gov                      404 (no policy published)                     → probed
//   open.gsa.gov                     200, "Disallow:" (everything allowed)         → probed
//   recherche-entreprises.api.gouv.fr 404 (no policy published)                    → probed
//   data.colorado.gov                200, /resource/* not disallowed, crawl-delay 1 → probed
//   open.canada.ca                   200, /data/api/* not disallowed               → probed
//   api.company-information.…gov.uk  robots.txt itself answers the API's 401 auth
//                                    challenge (no readable policy — the Phase-2
//                                    documented-API-host precedent)                → probed
//   api.uspto.gov                    robots.txt itself answers the API's 403 auth
//                                    challenge (the Phase-1 precedent)             → probed
//   api.service.hmrc.gov.uk          200, blanket "Disallow: /" for *              → NOT probed
//
// HMRC is deliberately absent: its API host's robots now blanket-disallows all agents, so no
// run is recorded against it (the committed hmrc-probe-1 evidence remains the citation).
// Hosts whose committed evidence records a named AI-agent ban or a robots-walled front door
// (texas-sos, virginia-scc, mca-india, aima-portugal, ohio-sos, minnesota-sos) are never
// probed here — see lib/agentBans.ts.
//
// Auth-walled surfaces are recorded only as their honest refusal responses: the Companies
// House 401 key challenge and the USPTO 403 challenge are documented keyless answers from
// real machine endpoints (free/registered API-key models, not bot walls).

const UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'

export const probes: LocalProbe[] = [
  {
    // Companies House REST API: a keyless GET against the documented company resource answers
    // the structured 401 challenge its docs describe — free registered API keys, an auth
    // model, not a bot wall (committed evidence companies-house-probe-1).
    probeId: 'api-keyless-auth',
    productId: 'companies-house',
    storyIds: ['agentic-public-api', 'public-data-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -A '${UA}' https://api.company-information.service.gov.uk/company/00000006`],
    // NOTE on wording: lib/proofs.ts redacts the substrings "key"/"token" anywhere in a
    // transcript, so display comments here say "credential-free", never "keyless".
    displayCommand: `curl -si -A '${UA}' https://api.company-information.service.gov.uk/company/00000006  # credential-free → documented 401 challenge (free registered API credentials)`,
    expect: /401/,
    timeoutMs: 30_000,
  },
  {
    // GOV.UK Content API: the one-stop guidance layer above the registry serves every page as
    // keyless JSON (committed evidence companies-house-probe-2).
    probeId: 'govuk-content-api',
    productId: 'companies-house',
    storyIds: ['public-data-api', 'plain-language-guides'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -A '${UA}' https://www.gov.uk/api/content/set-up-business | head -c 400`],
    displayCommand: `curl -s -A '${UA}' https://www.gov.uk/api/content/set-up-business | head -c 400  # credential-free JSON for every GOV.UK guidance page`,
    expect: /"base_path":"\/set-up-business"/,
    timeoutMs: 30_000,
  },
  {
    // SAM.gov Entity Management API: the machine-readable OpenAPI spec its docs page publishes
    // (committed evidence sam-gov-supp-3) answers a keyless GET on open.gsa.gov.
    probeId: 'entity-api-openapi-spec',
    productId: 'sam-gov',
    storyIds: ['machine-readable-spec', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 25 -A '${UA}' https://open.gsa.gov/api/entity-api/v1/openapi.yaml | head -16`],
    displayCommand: `curl -s -A '${UA}' https://open.gsa.gov/api/entity-api/v1/openapi.yaml | head -16  # the Entity Management API's published OpenAPI spec, credential-free`,
    expect: /Entity Management Rest API/,
    timeoutMs: 30_000,
  },
  {
    // The production Entity Management endpoint itself: keyless requests are not routed — the
    // gateway answers a bare 404 (API keys come from a SAM.gov account, per the committed
    // claimed-docs). The refusal is the observation.
    probeId: 'entity-api-keyless-gateway',
    productId: 'sam-gov',
    storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -A '${UA}' https://api.sam.gov/entity-information/v4/entities | head -3`],
    displayCommand: `curl -si -A '${UA}' https://api.sam.gov/entity-information/v4/entities | head -3  # credential-free → gateway 404 (API access rides SAM.gov account credentials)`,
    expect: /404/,
    timeoutMs: 30_000,
  },
  {
    // recherche-entreprises.api.gouv.fr: the French state's company-data API answers a keyless
    // agent with full registry JSON (committed evidence inpi-guichet-unique-probe-2).
    probeId: 'recherche-entreprises-search',
    productId: 'inpi-guichet-unique',
    storyIds: ['public-data-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -A '${UA}' 'https://recherche-entreprises.api.gouv.fr/search?q=inpi' | head -c 400`],
    displayCommand: `curl -s -A '${UA}' 'https://recherche-entreprises.api.gouv.fr/search?q=inpi' | head -c 400  # credential-free registry JSON from the state company-data API`,
    expect: /"nom_complet"/,
    timeoutMs: 30_000,
  },
  {
    // Colorado's business-entities dataset on the Socrata open-data platform: keyless JSON,
    // crawl-delay 1 honored as a single GET (committed evidence colorado-sos-probe-1).
    probeId: 'socrata-business-entities',
    productId: 'colorado-sos',
    storyIds: ['public-data-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -A '${UA}' 'https://data.colorado.gov/resource/4ykn-tg5h.json?$limit=1' | head -c 400`],
    displayCommand: `curl -s -A '${UA}' 'https://data.colorado.gov/resource/4ykn-tg5h.json?$limit=1' | head -c 400  # credential-free business-registry JSON (Socrata open-data platform)`,
    expect: /"entityid"/,
    timeoutMs: 30_000,
  },
  {
    // open.canada.ca CKAN: the national open-data layer answers keyless agents with structured
    // JSON (committed evidence corporations-canada-probe-1). Bare action URL — no query
    // parameters, per the host's robots extras.
    probeId: 'ckan-package-search',
    productId: 'corporations-canada',
    storyIds: ['public-data-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 25 -A '${UA}' https://open.canada.ca/data/api/action/package_search | head -c 300`],
    displayCommand: `curl -s -A '${UA}' https://open.canada.ca/data/api/action/package_search | head -c 300  # credential-free CKAN JSON from the national open-data layer`,
    expect: /"success": true/,
    timeoutMs: 35_000,
  },
  {
    // api.uspto.gov: a real machine endpoint that answers unauthenticated requests with a
    // structured 403 challenge — an API-key model, not a bot wall (committed evidence
    // uspto-probe-4). The honest refusal is the recordable run.
    probeId: 'api-keyless-auth',
    productId: 'uspto',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -si --max-time 20 -A '${UA}' https://api.uspto.gov/`],
    displayCommand: `curl -si -A '${UA}' https://api.uspto.gov/  # credential-free → structured 403 auth challenge`,
    expect: /403/,
    timeoutMs: 30_000,
  },
]
