# Repo split: executed record

One-page record of the 2026 repo split, written 2026-10-14. The full plan this file
previously held (the file partition, the hard-case analyses, the cutover sequence,
risks, and the Phase 0/1 execution notes) is in this file's git history.

## What the split did

The public repo `ultrametricai/ultrametric` became the open artifact: the arena
evidence and rankings (`open-rankings/`), the founder processes (`open-processes/`,
`content/processes/`), the legal layer (`open-law/` with its `citations/` registry,
`jurisdictions/`), the lore (`open-lore/`), the document registry (`open-documents/`), the open modules
(`open-modules/`, `lib/openstartup/`), the schemas, the pipeline, and their tests.
The site that renders it at ultrametric.ai moved to a fresh private repo,
`ultrametricai/ultrametric-app-private`: the Next.js app, components, site-side lib
and scripts, site public assets, the `infra/cloudflare-proxy` worker, and the UI test
suites.

The private repo consumes this one as a pinned snapshot: its committed `open.lock`
names a commit SHA and tarball sha256 of this repo, and its prebuild runs
`scripts/sync-open.mjs`, which downloads that tarball, verifies the checksum, and
materializes every `open-manifest.json` path marked `overlay: true` at its canonical
path. A site deploy therefore reads the artifact at an explicit, reviewable pin, and
an overlay path that collides with a file tracked in the private repo fails the build.

## When

- 2026-10-08: plan founder-ordered and written; Phases 0 and 1 landed additively in
  place (`open-manifest.json`, `scripts/sync-open.mjs`, the boundary refactors, the
  test census).
- 2026-10-09: production switched; the Vercel origin behind the ultrametric.ai proxy
  has built from the private repo at its `open.lock` pin since.
- 2026-10-12: site code deleted here (strip PR #253) after every manifest-closed path
  was byte-compared against the private repo; the check and its reconciliations are
  recorded in [REPO-SPLIT-STRIP-VERIFICATION.md](./REPO-SPLIT-STRIP-VERIFICATION.md).

## Where things moved

| Old home | Now |
| --- | --- |
| `app/`, `components/`, site-side `lib/` and `scripts/`, site `public/` assets, `infra/cloudflare-proxy/`, Next/Vercel configs, UI test suites | Private repo `ultrametricai/ultrametric-app-private` |
| `data/` | `open-rankings/` (via `rankings/`, PRs #265 and #308) |
| `vendors/` | `open-rankings/reviews/` |
| `processes/` and `journeys/` | `open-processes/` |
| `rules/` and `law/` | `open-law/` |
| `lore/` | `open-lore/` |
| `sources/` and `resources/` | `open-law/citations/` (via the top-level `citations/`, since folded into the law layer) |

Every tracked path in this repo is disposition `open` in `open-manifest.json`;
`pnpm manifest:check` and `__tests__/repo-split.test.ts` (with
`docs/repo-split-census.json`) hold the boundary. The repo was stripped, not
rewritten: old SHAs keep resolving, pre-split `open.lock` pins stay fetchable, and the
full plan text stays in history.
