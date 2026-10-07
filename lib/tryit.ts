import { loadCategory, stripPersonaPrefix } from './data'
import { isLiveCapable } from './liveProbes'
import { mcpEndpointFor } from './mcpEndpoints'
import { loadProcesses, processSlug, VENDOR_ARENA, vendorProductId, type ProcessTask } from './processes'
import { proofsForProduct, readProofTranscript } from './proofs'
import type { Story } from './schemas'
import { stripSgr, type TryItStory } from './tryitReplay'

// Server-side assembly for the product pages' "Try it" section (components/TryIt/*): which
// products get the section at all, the story menu built from recorded proofs (lib/proofs.ts)
// plus the live MCP handshake (lib/mcpEndpoints.ts allowlist), and the founder-process
// cross-links. Client-safe types/logic live in lib/tryitReplay.ts — this module owns the fs
// reads and stays server-only.

// A product is "tryable" when its "Test it in sandbox" section will actually render something:
// at least one REPLAYABLE recorded proof (kind 'terminal' WITH a readable transcript — video
// proofs play in ProofsSection, not the microterminal, and a stale index entry whose transcript
// file is missing renders nothing) or an allowlisted live MCP endpoint. This is exactly the
// predicate TryItSection renders on (buildRecordedStories + mcpEndpointFor), so the header's
// "Test in Ultrametric" CTA can never point at an empty section. Products with neither keep
// their existing primary CTA: no fake try.
export function hasTryIt(category: string, productId: string): boolean {
  return (
    proofsForProduct(category, productId).some(
      (p) => p.kind === 'terminal' && readProofTranscript(category, p) !== null,
    ) ||
    mcpEndpointFor(category, productId) !== null
  )
}

// The recorded-session story menu: one entry per terminal proof, titled by the prefixed user
// stories the proof substantiates. Transcripts are read and SGR-stripped here (server) so the
// client component receives plain serializable props.
export function buildRecordedStories(category: string, productId: string, stories: Story[]): TryItStory[] {
  const titleById = new Map(stories.map((s) => [s.id, stripPersonaPrefix(s.title)]))
  const entries: TryItStory[] = []
  for (const proof of proofsForProduct(category, productId)) {
    if (proof.kind !== 'terminal') continue
    const transcript = readProofTranscript(category, proof)
    if (!transcript) continue
    const titles = proof.storyIds.map((id) => titleById.get(id) ?? id)
    entries.push({
      id: proof.probeId,
      title: titles.join(' · ') || proof.probeId,
      kind: 'recorded',
      command: proof.command,
      recordedAt: proof.recordedAt,
      exitCode: proof.exitCode,
      transcript: stripSgr(transcript),
      // Pure-HTTP probes in the generated live manifest also get a "run live" button — the
      // worker re-runs the exact command as a fetch (lib/liveProbes.ts; CLI/pty probes stay
      // replay-only, labeled as recordings).
      live: isLiveCapable(category, productId, proof.probeId),
    })
  }
  return entries
}

// The vendor's own MCP DOCS page for the live-probe follow-up panel (Microterminal's "vendor's
// MCP docs →"). products.json links.mcp is sometimes the documentation page (docs.stripe.com/mcp)
// and sometimes the endpoint itself (mcp.xero.com/mcp — the generate-mcp-allowlist.mjs source);
// only a non-endpoint link is a docs page worth sending a human to. Falls back to the product's
// general docs, then its site — there is always somewhere useful to point.
export function mcpDocsUrlFor(category: string, productId: string, dir?: string): string | null {
  const product = loadCategory(category, dir).products.find((p) => p.id === productId)
  if (!product) return null
  const mcpLink = product.links?.mcp
  if (mcpLink) {
    try {
      if (!new URL(mcpLink).hostname.toLowerCase().startsWith('mcp.')) return mcpLink
    } catch { /* malformed — fall through */ }
  }
  return product.urls.docs ?? product.urls.site ?? null
}

export interface ProcessLink {
  slug: string
  title: string
}

// Founder processes (lib/processes.ts) whose DAG runs on this product — surfaced under the
// microterminal as future prefixed stories ("this product appears in: run-payroll →"). Uses
// the VENDOR_ARENA reverse mapping: a corpus vendor key resolves to its judged product id via
// vendorProductId (usually identical), so finding the key whose product id and arena both match
// means this product IS that vendor here.
export function processesFeaturing(category: string, productId: string, dir?: string): ProcessLink[] {
  const vendorKey = Object.keys(VENDOR_ARENA).find(
    (v) => VENDOR_ARENA[v] === category && vendorProductId(v) === productId,
  )
  if (!vendorKey) return []
  const featuring = (task: ProcessTask) =>
    task.dag.nodes.some((n) => n.vendor === vendorKey || (n.vendorOptions ?? []).includes(vendorKey)) ||
    task.vendors.includes(vendorKey)
  return loadProcesses(dir)
    .filter(featuring)
    .slice(0, 6)
    .map((t) => ({ slug: processSlug(t.title), title: t.title }))
}
