// Certification candidate queue: every product whose committed probe evidence
// (pipeline/stages/probe.ts, rankings/<arena>/evidence/<id>.json) shows a verified agent surface —
// a live llms.txt ("PROBE llms.txt: HTTP 200 …") or an officially documented MCP server
// ("official MCP server documented at …") — and which does not already hold an ACTIVE
// (unexpired, lib/certifications.ts) Agent-Ready certification anywhere in the registry.
//
// Pure data → data: no network, no LLM, no keys. The weekly cert-sweep
// (pipeline/scripts/cert-sweep.ts, .github/workflows/cert-sweep.yml) consumes this queue and
// re-runs the live conformance suite (pipeline/scripts/certify.ts) against each candidate; run it
// standalone to inspect the queue:
//
//   pnpm tsx pipeline/scripts/cert-candidates.ts
import fs from 'node:fs'
import path from 'node:path'
import { CertificationsArraySchema, isCertificationExpired } from '../../lib/certifications'
import { EvidenceSchema, ProductSchema, type Evidence, type Product } from '../../lib/schemas'
import { DATA_DIR, readCategories, readJson } from '../paths'

export type CandidateSignal = 'llms-txt' | 'mcp-link'

export interface CertCandidate {
  arena: string
  productId: string
  productName: string
  /** The URL the conformance suite runs against: the product's docs URL, else its site. */
  target: string
  /** Probe-verified agent surfaces backing the candidacy (never empty). */
  signals: CandidateSignal[]
}

// Same prefixes probe.ts stamps into positive evidence excerpts — the substring match keeps
// this decoupled from evidence ids while staying unambiguous (negative items say "HTTP 404").
const LLMS_POSITIVE_PREFIX = 'PROBE llms.txt: HTTP 200'
const MCP_POSITIVE_PREFIX = 'official MCP server documented at'

/** Probe-verified signals in one product's evidence file. Pure — unit-tested directly. */
export function candidateSignals(evidence: Evidence[]): CandidateSignal[] {
  const signals: CandidateSignal[] = []
  const probe = evidence.filter((e) => e.tier === 'probe')
  if (probe.some((e) => e.excerpt.startsWith(LLMS_POSITIVE_PREFIX))) signals.push('llms-txt')
  if (probe.some((e) => e.excerpt.startsWith(MCP_POSITIVE_PREFIX))) signals.push('mcp-link')
  return signals
}

/** Queue ordering: strongest evidence first (llms.txt + MCP beats one signal), then stable
 * arena/product order so weekly runs page through the same queue deterministically. */
export function compareCandidates(a: CertCandidate, b: CertCandidate): number {
  if (a.signals.length !== b.signals.length) return b.signals.length - a.signals.length
  return a.arena === b.arena ? a.productId.localeCompare(b.productId) : a.arena.localeCompare(b.arena)
}

/**
 * The full candidate queue across every arena. A product id certified anywhere (and not
 * expired) is excluded everywhere; a product listed in several arenas is queued once, from the
 * first arena that carries it (same first-wins dedupe as scripts/generate-badges.mjs).
 */
export function collectCertCandidates(now: Date = new Date()): CertCandidate[] {
  const activeCertified = new Set<string>()
  const arenas = readCategories().map((c) => c.id)
  for (const arena of arenas) {
    const certsFile = path.join(DATA_DIR, arena, 'certifications.json')
    if (!fs.existsSync(certsFile)) continue
    for (const cert of readJson(CertificationsArraySchema, certsFile)) {
      if (!isCertificationExpired(cert, now)) activeCertified.add(cert.productId)
    }
  }

  const out: CertCandidate[] = []
  const seen = new Set<string>()
  for (const arena of arenas) {
    const productsFile = path.join(DATA_DIR, arena, 'products.json')
    if (!fs.existsSync(productsFile)) continue
    for (const product of readJson(ProductSchema.array(), productsFile)) {
      if (seen.has(product.id) || activeCertified.has(product.id)) continue
      const evidenceFile = path.join(DATA_DIR, arena, 'evidence', `${product.id}.json`)
      if (!fs.existsSync(evidenceFile)) continue
      const signals = candidateSignals(readJson(EvidenceSchema.array(), evidenceFile))
      if (signals.length === 0) continue
      seen.add(product.id)
      out.push({ arena, productId: product.id, productName: product.name, target: candidateTarget(product), signals })
    }
  }
  return out.sort(compareCandidates)
}

/** The suite target — docs origin preferred, exactly like probe.ts's base URL choice. */
export function candidateTarget(product: Pick<Product, 'urls'>): string {
  return product.urls.docs ?? product.urls.site
}

function main(): void {
  const queue = collectCertCandidates()
  console.log(JSON.stringify(queue, null, 2))
  console.error(`cert-candidates: ${queue.length} uncertified product(s) with probe-verified llms.txt/MCP evidence`)
}

if (require.main === module) main()
