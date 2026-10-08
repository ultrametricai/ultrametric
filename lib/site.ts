// Single source of truth for the identifiers that used to be scattered as string literals
// across route handlers, layout, and components: the canonical deployed origin, the basePath
// the app is served under, and the GitHub repo path. Route handlers/pages should import these
// instead of re-declaring `const SITE = ...`.
//
// SITE_URL reads NEXT_PUBLIC_SITE_URL so builds still deployed at a *.vercel.app preview/prod
// URL can override it. Since the 2026-09-28 rebrand the app is served at the domain root — no
// path suffix, no basePath.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ultrametric.ai'
export const DOCS_URL = 'https://docs.ultrametric.ai'
export const REPO = 'ultrametricai/ultrametric'

// The app is served at the domain root since the 2026-09-28 rebrand, so there is no base path.
// Kept (empty) alongside withBase() so the many call sites that prefix plain <img>/<a>
// src/href values don't churn — if a basePath ever returns, this is the single place to set it.
export const BASE_PATH = ''

export function withBase(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${BASE_PATH}${normalized}`
}
