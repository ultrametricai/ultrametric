// Ultrametric CLI/MCP step map (founder ask 2026-09-30) — the curated, verified list of corpus
// processes a user can DRIVE through our own shipped `ultrametric` CLI (npm 0.4.1) or the hosted
// MCP server (https://api.ultrametric.ai/mcp) today.
//
// First-party display contract:
//   - Display-only. This map NEVER feeds scoring, never displaces or reorders a judged
//     top-vendor pick, and every render site must carry a visible first-party disclosure.
//   - "Drive" is the honest verb: the CLI/MCP serves the process guide and saves run records
//     (`process open` / MCP `open_process`); it executes nothing — the user's agent does the work.
//     Its own docs state "no tool executes a process or an external action".
//   - An entry exists ONLY where the live production catalog (verified via a logged-in
//     `ultrametric process list --json`, 2026-09-30) serves a hosted process whose RESULT is the
//     same as the corpus task's. Hosted processes with no same-result corpus task are excluded on
//     purpose: company-profile, ai-native-assessment, branding (a coordinator over the three
//     brand tasks), delaware-review (a good-standing REVIEW, not tax_001's franchise-tax FILING).
//   - Catalog access is per-account (PostHog `process-<id>` flags); the verification account is
//     internal, so external availability can be narrower. releasedIn records that provenance.
//
// Mirrors the lib/processIcons.ts house pattern: in-code Record, accessor returns null on a
// miss (callers render nothing), coverage + stale-key tests in lib/__tests__/ultrametricCli.test.ts.

export interface UltrametricCliSupport {
  /** Hosted process ID in the production catalog at api.ultrametric.ai. */
  processId: string
  /** Published version observed in the production catalog on the audit date. */
  processVersion: number
  /** The exact shipped CLI invocation that opens/resumes the hosted run. */
  command: string
  /** The hosted MCP tool with the same operation, permissions, and storage. */
  mcpTool: string
  /** Shipped artifact + catalog audit provenance for this entry. */
  releasedIn: string
}

const RELEASED = 'ultrametric@0.4.1 · production catalog 2026-09-30'

const entry = (processId: string, processVersion: number): UltrametricCliSupport => ({
  processId,
  processVersion,
  command: `ultrametric process open ${processId}`,
  mcpTool: 'open_process',
  releasedIn: RELEASED,
})

/** Corpus taskId → the live hosted process that yields the same result. */
export const ULTRAMETRIC_CLI_STEPS: Record<string, UltrametricCliSupport> = {
  form_001: entry('incorporate-c-corp', 3), // Incorporate C-Corp
  form_002: entry('get-ein', 1), // Get EIN
  qs_043: entry('set-up-registered-agent', 1), // Set up registered agent
  qs_050: entry('track-runway', 3), // Track runway
  qs_051: entry('set-up-cap-table', 1), // Set up cap table
  startup_002: entry('founder-agreement-equity-split', 1), // Sign the founder agreement & split equity
  brand_001: entry('generate-a-company-name', 2), // Generate a company name
  brand_002: entry('generate-a-brand-logo', 2), // Generate a brand logo
  brand_003: entry('pick-a-brand-color-palette', 2), // Pick a brand color palette
  domain_001: entry('check-domain-availability', 3), // Check domain availability
}

/** First-party affiliation sentence — same posture as the Foreloop/AFK arena disclosures. */
export const ULTRAMETRIC_CLI_DISCLOSURE =
  'The Ultrametric CLI/MCP is built by Ultrametric Inc, which also operates this site. ' +
  'First-party affordance: it serves the process guide and saves run records — your agent does the work. ' +
  'It never affects the judged vendor picks.'

/** Null on a miss — callers render nothing, never a fabricated capability. */
export function ultrametricCliFor(taskId: string): UltrametricCliSupport | null {
  return ULTRAMETRIC_CLI_STEPS[taskId] ?? null
}
