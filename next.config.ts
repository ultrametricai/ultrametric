import type { NextConfig } from "next";
import { loadProcesses, processSlug } from "./lib/processes";

// Repo directories that pages read with fs ONLY while prerendering (every route except the
// shared-reader routes below is static: force-static or generateStaticParams with
// dynamicParams=false, and every route handler is force-static). Without these excludes,
// the tracer puts lib/data.ts & friends' fs reads into EVERY page trace: measured
// 2026-10-02 at 10.17 GB of traced bytes across 94 .nft.json files (data/ 6.64 GB,
// public/ 1.25 GB — see docs/BUILD-SIZE.md), which is what ENOSPC'd Vercel's output
// packaging. NOTE (verified by probe builds, docs/BUILD-SIZE.md): the Turbopack tracer
// matches these value globs UNANCHORED — "./data/**" also strips "public/data/**" (wanted:
// that is the prebuild mirror from scripts/copy-data.mjs, CDN-served, fetched over HTTP).
// Keep patterns distinctive enough not to collide with node_modules paths; the
// node_modules portion of the traces measured identical (2.02 GB) before and after
// these excludes landed.
const BUILD_TIME_ONLY = [
  "./data/**", // arena corpus (loaded by lib/data.ts at prerender time); also catches the public/data mirror
  "./public/**", // CDN-served; badges/logos/screenshots are fs-listed at prerender time only
  "./pipeline/**",
  "./docs/**",
  "./content/**",
  "./processes/**",
  "./journeys/**",
  "./vendors/**",
];

// What the force-dynamic shared-reader routes read at REQUEST time (so it must survive the
// excludes below — in this tracer, includes are applied after excludes and win; verified
// empirically, see docs/BUILD-SIZE.md). The root layout they render reads data/** (nav:
// loadCategories/loadArenaSections/loadIcpTypes — the palette index moved to the force-static
// /search-index.json route 2026-10-02); the pages read the legacy corpus,
// chains, and the shared records. Kept tight on purpose: over-including would push the
// preview functions toward the per-function size limit (the auto-trace's 34 pipeline
// judge-cache files were dropped — './pipeline/cache/judge/**' re-includes all 34k files /
// 133 MB, and nothing reads them at request time). scripts/check-preview-runtime.mjs boots
// the packaged artifact from ONLY these traces and fails on any ENOENT.
const PREVIEW_RUNTIME = [
  // Unanchored matching means this ALSO re-includes the public/data mirror (~83 MB more per
  // preview function — tolerated; keep an eye on the per-function size limit). Do NOT try to
  // anchor it with a leading slash: '/data/**' makes the tracer's read_glob walk the world
  // and die on node_modules platform-stub symlink loops (TurbopackInternalError, 2026-10-02).
  "./data/**",
  "./public/logos/**",
  "./processes/corpus.json",
  "./processes/artifacts.json",
  "./processes/vendor-registry.json",
  "./processes/business-logic-map.json",
  "./journeys/chains.json",
  "./content/processes/**",
  "./docs/assets/**",
];

const nextConfig: NextConfig = {
  // Served at the domain root (ultrametric.ai/) since the 2026-09-28 rebrand — no basePath.
  // Legacy ultrametric.ai/productarena/* URLs are redirected at the proxy layer
  // (infra/cloudflare-proxy), not here.
  // These dynamic previews render at request time; everything they (and the root layout
  // they render) read from the repo must be listed here, because the '*' excludes below
  // strip those directories from every trace and in this tracer INCLUDES ARE APPLIED
  // AFTER EXCLUDES and win (verified by probe builds — the REVERSE of what
  // node_modules/next/dist/build/collect-build-traces.js does; that file never runs under
  // Turbopack, which traces in Rust).
  outputFileTracingIncludes: {
    '/processes/v2': PREVIEW_RUNTIME,
    '/processes/*/v2': PREVIEW_RUNTIME,
  },
  // '*' is the global route key in the Turbopack tracer. Also verified empirically
  // (probe builds 2026-10-02, see docs/BUILD-SIZE.md): exact keys ('/ops') work, brace
  // alternations ('/{ops,proofs}') work, a single '*' inside a path matches a [param]
  // segment ('/vs/*' matches '/vs/[slug]'), and negated '!{...}' keys are SILENTLY
  // IGNORED — never use them.
  outputFileTracingExcludes: {
    '*': BUILD_TIME_ONLY,
  },
  // In-app route renames only. /documents became /open-documents with the documents/ →
  // open-documents/ directory rename (founder 2026-10-03); the old path stays alive as a
  // permanent redirect, the same old-links-stay-alive posture as the proxy-layer
  // /productarena/* redirects (which remain at infra/cloudflare-proxy, not here).
  redirects: async () => [
    // Stable-ID process URLs (docs/PR171-EXTRACTION.md, port plan item 1): the immutable
    // corpus id — the identity manifests and agents carry — reaches the canonical page
    // directly: /processes/form_001 → /processes/incorporate-c-corp. Derived from the
    // corpus (lib/processes.ts), no route registry; query values pass through (Next
    // redirect semantics), fragments stay in the browser. Alias SLUGS are not redirects:
    // they keep prerendering as full alias pages (app/processes/[slug]/page.tsx).
    ...loadProcesses().flatMap((t) => {
      const slug = processSlug(t.title)
      return t.id === slug ? [] : [{
        source: `/processes/${t.id}`,
        destination: `/processes/${slug}`,
        permanent: true,
      }]
    }),
    {
      source: '/processes/preview',
      destination: '/processes/v2',
      permanent: true,
    },
    {
      source: '/processes/preview/:key',
      destination: '/processes/:key/v2',
      permanent: true,
    },
    {
      source: '/documents',
      destination: '/open-documents',
      permanent: true,
    },
  ],
};

export default nextConfig;
