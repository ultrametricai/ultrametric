// Reconciles judge-cache hashes left stale by the 2026-09-11 integrations-directory
// enrichment (commit 54b6a895): that wave appended {product}-intdir-N claimed-docs evidence
// to 35 products as integration-graph fuel, deliberately leaving verdicts untouched — but the
// judge cache key hashes the FULL evidence pack, so every touched product's cells went stale
// and any later `pnpm engine judge --category <cat>` run fails at the assembly staleness
// check (first hit: the 2026-09-14 linear api-quality fix, blocked on asana's stale cells).
//
// Why restamp instead of re-judge: the established churn policy (revert-churn.ts /
// revert-churn-api-quality-wave.ts) reverts any re-rolled cell whose verdict or quality
// changed while citing NO evidence id that is new to the pack. For these products the pack's
// only post-judge additions (the intdir items) are already committed — nothing is "new"
// relative to the committed baseline — so a re-roll + churn-revert provably converges back to
// the committed verdicts with only the hash refreshed. This script jumps straight to that
// fixed point at zero LLM cost: same verdict object, hash restamped to the current pack.
//
// Safety: a cell is only restamped when the cached verdict is byte-identical (deep equal) to
// the committed verdicts.json row — any mismatch aborts, because then the cache and verdicts
// have diverged for a reason this script must not paper over.
//
// Usage: pnpm exec tsx rankings-engine/scripts/restamp-judge-cache-intdir.ts [--write]
//   (no --write: dry run, prints the plan only; --write: applies changes to disk)

import fs from 'node:fs'
import path from 'node:path'
import { cellHash } from '../stages/judge'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
// Keep in sync with rankings-engine/stages/judge.ts. NOTE: this script's wave predates the v4
// judge-model migration (2026-09-30, sonnet-5 → opus-5-5); v4 hashes also fold in the judge
// model id (cellHash's default 4th arg), so a fresh run of this script against post-migration
// caches restamps to v4-scheme hashes. The historical v3 restamps it performed are committed.
const PROMPT_VERSION = 'v4'

// Only the products verified stale-for-intdir-reasons in project-management (the arena the
// linear fix needed unblocked). Other arenas touched by 54b6a895 carry the same staleness;
// extend this map only after verifying, per product, that verdicts.json still matches the
// cache and the pack's only post-judge change is the intdir append.
const WAVE: Record<string, string[]> = {
  'project-management': ['asana', 'clickup', 'notion', 'monday', 'jira'],
  // 2026-09-15 hot-repos fairness wave: the same 54b6a895 staleness blocked judging in three
  // more arenas. Verified per product (tmp check, same method as above): caches 0-stale against
  // 54b6a895^, cache verdicts byte-equal to committed verdicts.json, and every post-judge pack
  // addition is committed 54b6a895 material (the intdir append plus that commit's monotonic
  // re-extract docs/gh items — verdicts deliberately untouched by that wave). Only NON-target
  // products are restamped; the wave's targets (vercel, posthog) get a real re-judge with
  // 54b6a895^ as their churn baseline instead.
  'team-chat': ['slack'],
  'edge-platforms': ['netlify'],
  'product-analytics': ['amplitude', 'mixpanel'],
}

type Story = { id: string; title: string }

let restamped = 0
for (const [cat, pids] of Object.entries(WAVE)) {
  const stories: Story[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', cat, 'stories.json'), 'utf8'))
  const verdicts: Record<string, unknown>[] = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'open-rankings', cat, 'verdicts.json'), 'utf8'),
  )
  const byKey = new Map(verdicts.map((v) => [`${v.productId}:${v.storyId}`, v]))
  for (const pid of pids) {
    const evidence = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-rankings', cat, 'evidence', `${pid}.json`), 'utf8'))
    for (const story of stories) {
      const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', cat, pid, `${story.id}.json`)
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; verdict: unknown }
      const fresh = cellHash(story as never, evidence, PROMPT_VERSION)
      if (cached.hash === fresh) continue
      const committed = byKey.get(`${pid}:${story.id}`)
      // Canonical (key-sorted) comparison: cache files carry raw LLM key order, verdicts.json
      // carries schema key order — only the content must match.
      const canon = (v: unknown) =>
        JSON.stringify(v, Object.keys(v as Record<string, unknown>).sort())
      if (canon(cached.verdict) !== canon(committed)) {
        throw new Error(
          `restamp: ${cat}/${pid}:${story.id} — cached verdict differs from verdicts.json; refusing to restamp`,
        )
      }
      console.log(`RESTAMP ${cat}/${pid}:${story.id} ${cached.hash.slice(0, 8)} -> ${fresh.slice(0, 8)}`)
      restamped++
      if (WRITE) fs.writeFileSync(cacheFile, JSON.stringify({ hash: fresh, verdict: cached.verdict }, null, 2) + '\n')
    }
  }
}
console.log(`${WRITE ? 'Restamped' : 'Would restamp'} ${restamped} cell(s).${WRITE ? '' : ' Run with --write to apply.'}`)
