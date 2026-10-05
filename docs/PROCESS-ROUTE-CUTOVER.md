# Process route compatibility

The shared records in `content/processes/records/` own process titles, descriptions,
instructions, parts, and references on `/processes/<slug>`. Author that content once.
`lib/shared-processes/routes.ts` derives the route registry from those records,
including readable slugs, immutable IDs, `aliases`, and preserved `metadata.slugAliases`.
It rejects ambiguous keys and reserves the existing index route names.

Published preview paths and the incorporation `v2` path redirect directly to the
regular canonical page. Internal reader and index links use the regular route.
The redirect registry is generated with the application configuration; it is not a
second manually maintained catalog. The regular pages are prerendered, indexable,
self-canonical, and sitemap-listed. Unknown records still return not found.

## Execution boundary

The existing corpus, chains, rankings, simulator, graph export, and manifests keep
their default-DAG execution contract. The shared schema intentionally excludes
legacy operation strings. The reader does not infer tool calls from prose or
flatten alternative branches into executable steps. This cutover is not an
execution-schema migration. Existing `/mine` and `/processes/chains/<id>` execution
surfaces and manifest addresses remain available.

Supplementary vendor assessments continue to use their existing judged story
mappings. Explicit extra-arena choices render in separate arena groups with their
original order, scores, and citations. They do not enter function-arena process
aggregates. Zero-score entries remain ineligible for selection. Private account
data and execution authorization are unaffected.

## URL and anchor contract

- Keep `#steps` and old `#step-<task>-<node>` aliases inside their corresponding
  canonical article or method option. Native colon scopes retain reference and
  option ancestry. Alias IDs are mounted only with the content they identify.
- Initial load, hash changes, repeated same-hash clicks, and history navigation
  restore the target and open enclosing details before focusing and scrolling.
  Opening waits for the target's option boundaries to finish hydrating, using
  committed refs rather than an assumed number of animation frames.
- A valid explicit `geo` value wins over a contradictory hidden-option hash. Keep
  both query and hash unchanged; do not claim that the hidden target was reached.
  With no explicit geo, a hash can activate its source-declared regional option.
  A later explicit region click wins and does not reopen the old hash.
- `via` retains its established repeated/comma-separated arena/vendor encoding.
  Explicit valid URL picks precede legacy lens storage and account-stack fallback.
  Unknown query values survive redirects. Browser fragment inheritance is required
  because a server never receives a fragment.
- Shared per-step overrides have no equivalent in the legacy arena-level URL
  encoding. Preserve them locally under `pa-shared-process-selection:<id>`; do not
  invent a lossy `via` value. Provider-level picks continue to use the legacy lens
  storage and share parameter. Automatic restoration leaves the original URL intact.
- A country only selects an explicitly declared regional option. The supported
  legacy country query stays intact where the source has no matching local variant.
  Existing default-scope assessment qualifications remain in effect.

## Reviewed branding bindings

The old logo-image-generation anchor targets the authored image-generation method
inside `brand_002:n1`. The old `brand_002:n2` anchor keeps the pre-existing
`stepGuidanceFor` binding to canonical `n2` and its `brand-logo` artifact. Its old
title, “Set primary logo,” and current title, “Return the useful logo set and design
choices,” have a pre-existing semantic difference that remains a content-review
follow-up. The cutover adds no selection operation, replacement step, or UI label.
The original palette-generation and token-save activities remain within
`brand_003:n1` and `brand_003:n4` guidance respectively.

## Validation

The route, anchor-render, state-restoration, and selection cutover tests enumerate
the committed registry, legacy tasks, aliases, default nodes, and positive vendor
associations. They verify source identity, mounted targets, nested/reference scope
integrity, canonical metadata, alias manifest payloads, graph export equality,
simulator and chain references, unchanged score/citation provenance, and history
and selection behavior. Existing reader, provider, ranking, and simulator tests
remain required.

Run `pnpm exec tsx scripts/check-process-cutover.ts http://localhost:3232` against an
existing local validation server. It checks the actual HTTP redirect matcher,
repeated query preservation, canonical reader pages, and alias manifests. Browser
checks must also cover product story and step links, Back, encoded hashes, regional
conflicts, nested scopes, and keyboard focus.

In the designated build lane, run the existing packaged-runtime gate after the
build. It checks preview/v2 redirects, canonical static reader pages, required
runtime files, and static trace exclusions. Worktree lanes do not run full builds.
