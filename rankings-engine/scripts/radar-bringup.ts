// Roster append for auto-approved radar candidates (governance/AGENT_POLICY.md, "Vendor-radar
// candidate approval", founder authorization 2026-10-13): reads a radar-triage dispositions
// file and adds each auto-approved candidate to its existing arena's products.json, up to
// --cap. The append writes roster INPUT only; scores and ranks still come exclusively from the
// scoped standard pipeline (crawl → extract → collect-community → probe → judge --product →
// derive → logos) that the caller runs next. The script never creates an arena, never touches
// a founder-affiliated candidate (triage routes those to needs-human), and skips any product
// already tracked by id or site domain.
//
// Output: one "<arena> <product-id>" line per product added (the workflow loops over these to
// run the scoped pipeline stages).
//
// Invocation:
//   pnpm tsx pipeline/scripts/radar-bringup.ts --triage reports/vendor-radar/<date>-triage.json [--cap 3]
import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR, readCategories } from '../paths'
import { ProductSchema } from '../../lib/schemas'
import { isSharedCodeHostOrigin } from '../stages/probe'
import { normalizeDomain } from '../yc-shared'
import { TriageReportSchema, type Disposition } from './radar-triage'

export const DEFAULT_BRINGUP_CAP = 3 // bound per-run judge spend; the rest stay approved-pending

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function vendorOf(d: Disposition): string {
  const gh = d.bringup?.github?.match(/github\.com\/([\w.-]+)\//)
  if (gh) return gh[1]
  const host = ((): string | null => {
    try {
      return new URL(d.bringup?.site ?? d.url).hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  })()
  return host ?? d.name
}

// Roster-dedupe key: a shared code host (github.com, gitlab.com, …) hosts many distinct
// products, so the key keeps the owner/repo path there; everywhere else the site domain is
// the product's identity (the same split vendor-radar.ts uses for its seen-ledger keys).
// Matching on the bare domain skipped every GitHub-hosted candidate as "already tracked"
// whenever the arena already rostered any GitHub-hosted product (found 2026-10-14,
// logo-design-skill vs agent-skills).
export function rosterDedupeKey(url: string | undefined | null): string | null {
  const domain = normalizeDomain(url)
  if (!domain || !url) return domain
  const withScheme = url.includes('://') ? url : `https://${url}`
  if (!isSharedCodeHostOrigin(withScheme)) return domain
  try {
    const segments = new URL(withScheme).pathname.split('/').filter(Boolean).slice(0, 2)
    return segments.length === 2 ? `${domain}/${segments.join('/').toLowerCase()}` : domain
  } catch {
    return domain
  }
}

export interface BringupResult {
  added: { arena: string; id: string }[]
  skipped: { name: string; reason: string }[]
}

export function applyBringups(triagePath: string, cap: number): BringupResult {
  const triage = TriageReportSchema.parse(JSON.parse(fs.readFileSync(triagePath, 'utf8')))
  const arenas = new Set(readCategories().map((c) => c.id))
  const result: BringupResult = { added: [], skipped: [] }

  for (const d of triage.dispositions) {
    if (d.status !== 'auto-approved' || !d.bringup || !d.arena) continue
    if (result.added.length >= cap) {
      result.skipped.push({ name: d.name, reason: `over the per-run bring-up cap (${cap}); approved-pending for a later run` })
      continue
    }
    if (!arenas.has(d.arena)) {
      result.skipped.push({ name: d.name, reason: `arena ${d.arena} does not exist — the radar never creates rankings` })
      continue
    }
    const rosterPath = path.join(DATA_DIR, d.arena, 'products.json')
    const roster = ProductSchema.array().parse(JSON.parse(fs.readFileSync(rosterPath, 'utf8')))
    const id = slugify(d.name)
    const key = rosterDedupeKey(d.bringup.site)
    if (roster.some((p) => p.id === id || (key !== null && rosterDedupeKey(p.urls.site) === key))) {
      result.skipped.push({ name: d.name, reason: `already tracked in ${d.arena}` })
      continue
    }
    const product = ProductSchema.parse({
      id,
      name: d.name,
      vendor: vendorOf(d),
      type: d.bringup.type,
      urls: {
        site: d.bringup.site,
        ...(d.bringup.docs ? { docs: d.bringup.docs } : {}),
        ...(d.bringup.github ? { github: d.bringup.github } : {}),
      },
    })
    roster.push(product)
    fs.writeFileSync(rosterPath, JSON.stringify(roster, null, 2) + '\n')
    result.added.push({ arena: d.arena, id })
  }
  return result
}

async function main(argv: string[]): Promise<void> {
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i === -1 ? undefined : argv[i + 1]
  }
  const triagePath = arg('--triage')
  if (!triagePath) {
    console.error('usage: pnpm tsx pipeline/scripts/radar-bringup.ts --triage <triage.json> [--cap N]')
    process.exit(1)
  }
  const cap = Number(arg('--cap') ?? DEFAULT_BRINGUP_CAP)
  const { added, skipped } = applyBringups(triagePath, cap)
  for (const s of skipped) console.error(`radar-bringup: skipped ${s.name} — ${s.reason}`)
  for (const a of added) console.log(`${a.arena} ${a.id}`)
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
